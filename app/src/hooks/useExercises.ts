import { useEffect, useState } from 'react';
import { auth, db } from '@/services/firebase';
import {
  collection,
  doc,
  onSnapshot,
  query,
  Timestamp,
  where,
} from 'firebase/firestore';
import {
  applyPendingWrites,
  getCachedDocuments,
  getPendingWrites,
  queueOfflineWrite,
  reportFirestoreConnectivity,
  saveCachedDocuments,
} from '@/services/offlineStore';

export interface Exercise {
  id: string;
  name: string;
  duration: number;
  intensity: string;
  equipment: string;
  note: string;
  selectedDate: string | null;
  completedDate: string | null;
  userId: string;
  createdAt: Timestamp;
}

const getDateKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

export function useExercises() {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loadedUserId, setLoadedUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [today, setToday] = useState(() => getDateKey(new Date()));
  const userId = auth?.currentUser?.uid;
  const loading = Boolean(userId && db && loadedUserId !== userId && !error);

  useEffect(() => {
    const now = new Date();
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 50);
    const timeout = setTimeout(
      () => setToday(getDateKey(new Date())),
      midnight.getTime() - now.getTime()
    );

    return () => clearTimeout(timeout);
  }, [today]);

  useEffect(() => {
    if (!userId || !db) return;

    let active = true;
    let receivedServerSnapshot = false;
    void Promise.all([
      getCachedDocuments<Exercise>(userId, 'exercises'),
      getPendingWrites(userId, 'exercises'),
    ]).then(([cachedExercises, pendingWrites]) => {
      if (!active || receivedServerSnapshot) return;
      setExercises(applyPendingWrites(cachedExercises, pendingWrites));
      setLoadedUserId(userId);
    }).catch((reason: unknown) => {
      if (active) {
        setError(reason instanceof Error
          ? `Impossible de lire les exercices enregistrés sur cet appareil : ${reason.message}`
          : 'Impossible de lire les exercices enregistrés sur cet appareil.');
      }
    });

    const exercisesQuery = query(collection(db, 'exercises'), where('userId', '==', userId));
    const unsubscribe = onSnapshot(
      exercisesQuery,
      { includeMetadataChanges: true },
      (snapshot) => {
        if (!snapshot.metadata.fromCache) receivedServerSnapshot = true;
        const remoteExercises = snapshot.docs.map((exercise) => ({
          ...exercise.data(),
          id: exercise.id,
        })) as Exercise[];
        void Promise.all([
          saveCachedDocuments(userId, 'exercises', remoteExercises),
          getPendingWrites(userId, 'exercises'),
        ]).then(([, pendingWrites]) => {
          if (!active) return;
          setExercises(applyPendingWrites(remoteExercises, pendingWrites));
          setLoadedUserId(userId);
          setError(null);
        }).catch((reason: unknown) => {
          if (active) {
            setError(reason instanceof Error
              ? `Impossible d’enregistrer les exercices localement : ${reason.message}`
              : 'Impossible d’enregistrer les exercices localement.');
          }
        });
        reportFirestoreConnectivity(userId, !snapshot.metadata.fromCache);
      },
      (reason) => {
        reportFirestoreConnectivity(userId, false);
        setError(reason.message);
      }
    );
    return () => {
      active = false;
      unsubscribe();
    };
  }, [userId]);

  const saveExercise = async (exercise: Omit<Exercise, 'id' | 'userId' | 'createdAt'>) => {
    if (!db || !userId) throw new Error('Connectez-vous pour enregistrer un exercice.');
    const name = exercise.name.trim();
    if (!name) throw new Error('Le nom de l’exercice ne peut pas être vide.');

    const id = doc(collection(db, 'exercises')).id;
    const write = await queueOfflineWrite({
      collectionKey: 'exercises',
      documentId: id,
      path: `exercises/${id}`,
      kind: 'set',
      data: { ...exercise, name, userId, createdAt: Timestamp.now() },
    }, userId);
    setExercises((current) => applyPendingWrites(current, [write]));
  };

  const toggleToday = async (name: string, duration: number, intensity: string, equipment: string) => {
    if (!db || !userId) throw new Error('Connectez-vous pour modifier votre routine.');
    const existing = exercises.find((exercise) => exercise.name === name);
    if (existing) {
      const write = await queueOfflineWrite({
        collectionKey: 'exercises',
        documentId: existing.id,
        path: `exercises/${existing.id}`,
        kind: 'update',
        data: {
        selectedDate: existing.selectedDate === today ? null : today,
        ...(existing.selectedDate === today ? { completedDate: null } : {}),
        },
      }, userId);
      setExercises((current) => applyPendingWrites(current, [write]));
      return;
    }

    await saveExercise({
      name,
      duration,
      intensity,
      equipment,
      note: '',
      selectedDate: today,
      completedDate: null,
    });
  };

  const toggleCompleted = async (exerciseId: string) => {
    if (!db || !userId) throw new Error('Connectez-vous pour suivre votre routine.');
    const exercise = exercises.find((item) => item.id === exerciseId);
    if (!exercise || exercise.selectedDate !== today) {
      throw new Error('Cet exercice ne fait pas partie de votre routine du jour.');
    }

    const write = await queueOfflineWrite({
      collectionKey: 'exercises',
      documentId: exerciseId,
      path: `exercises/${exerciseId}`,
      kind: 'update',
      data: { completedDate: exercise.completedDate === today ? null : today },
    }, userId);
    setExercises((current) => applyPendingWrites(current, [write]));
  };

  const addCustomExercise = async (
    name: string,
    duration: number,
    intensity: string,
    equipment: string,
    note: string,
    addToToday: boolean
  ) => {
    await saveExercise({
      name,
      duration,
      intensity,
      equipment,
      note: note.trim(),
      selectedDate: addToToday ? today : null,
      completedDate: null,
    });
  };

  return {
    exercises: userId && loadedUserId === userId ? exercises : [],
    today,
    loading,
    error,
    toggleToday,
    toggleCompleted,
    addCustomExercise,
  };
}
