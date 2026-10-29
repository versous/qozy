import { useEffect, useState } from 'react';
import { auth, db } from '@/services/firebase';
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  query,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore';

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

    const exercisesQuery = query(collection(db, 'exercises'), where('userId', '==', userId));
    return onSnapshot(
      exercisesQuery,
      (snapshot) => {
        setExercises(
          snapshot.docs.map((exercise) => ({
            ...exercise.data(),
            id: exercise.id,
          })) as Exercise[]
        );
        setLoadedUserId(userId);
        setError(null);
      },
      (reason) => setError(reason.message)
    );
  }, [userId]);

  const saveExercise = async (exercise: Omit<Exercise, 'id' | 'userId' | 'createdAt'>) => {
    if (!db || !userId) throw new Error('Connectez-vous pour enregistrer un exercice.');
    const name = exercise.name.trim();
    if (!name) throw new Error('Le nom de l’exercice ne peut pas être vide.');

    await addDoc(collection(db, 'exercises'), {
      ...exercise,
      name,
      userId,
      createdAt: Timestamp.now(),
    });
  };

  const toggleToday = async (name: string, duration: number, intensity: string, equipment: string) => {
    if (!db || !userId) throw new Error('Connectez-vous pour modifier votre routine.');
    const existing = exercises.find((exercise) => exercise.name === name);
    if (existing) {
      await updateDoc(doc(db, 'exercises', existing.id), {
        selectedDate: existing.selectedDate === today ? null : today,
        ...(existing.selectedDate === today ? { completedDate: null } : {}),
      });
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

    await updateDoc(doc(db, 'exercises', exerciseId), {
      completedDate: exercise.completedDate === today ? null : today,
    });
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
