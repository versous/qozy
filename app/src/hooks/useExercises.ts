import { useEffect, useState } from 'react';

import { auth, db } from '@/services/firebase';
import { ALL_HABIT_DAYS, type HabitDay } from '@/hooks/useHabits';
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

export type ExerciseMode = 'timer' | 'repetitions';

export interface Exercise {
  id: string;
  name: string;
  duration: number;
  mode?: ExerciseMode;
  targetReps?: number | null;
  intensity: string;
  equipment: string;
  note: string;
  selectedDate: string | null;
  completedDate: string | null;
  completedDates?: string[];
  routineDays?: HabitDay[];
  routineEnabled?: boolean;
  userId: string;
  createdAt: Timestamp;
}

const getDateKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

function getCompletedDates(exercise: Exercise) {
  const dates = exercise.completedDates ?? [];
  return exercise.completedDate && !dates.includes(exercise.completedDate)
    ? [...dates, exercise.completedDate]
    : dates;
}

export function isExerciseScheduledOnDate(exercise: Exercise, date: string) {
  if (exercise.selectedDate === date) return true;
  if (!exercise.routineEnabled || !exercise.routineDays?.length) return false;
  const [year, month, day] = date.split('-').map(Number);
  return exercise.routineDays.includes(new Date(year, month - 1, day).getDay() as HabitDay);
}

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
      setExercises(applyPendingWrites(cachedExercises, pendingWrites).map((exercise) => ({
        ...exercise,
        completedDates: getCompletedDates(exercise),
        routineDays: exercise.routineDays ?? [],
        routineEnabled: exercise.routineEnabled ?? false,
      })));
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
        const normalizedExercises = remoteExercises.map((exercise) => ({
          ...exercise,
          completedDates: getCompletedDates(exercise),
          routineDays: exercise.routineDays ?? [],
          routineEnabled: exercise.routineEnabled ?? false,
        }));
        void Promise.all([
          saveCachedDocuments(userId, 'exercises', normalizedExercises),
          getPendingWrites(userId, 'exercises'),
        ]).then(([, pendingWrites]) => {
          if (!active) return;
          setExercises(applyPendingWrites(normalizedExercises, pendingWrites));
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

  const toggleToday = async (
    name: string,
    duration: number,
    intensity: string,
    equipment: string,
    mode: ExerciseMode = 'timer',
    targetReps?: number
  ) => {
    if (!db || !userId) throw new Error('Connectez-vous pour modifier votre routine.');
    const existing = exercises.find((exercise) => exercise.name === name);
    if (existing) {
      const selectedToday = isExerciseScheduledOnDate(existing, today);
      const day = new Date(`${today}T00:00:00`).getDay() as HabitDay;
      const routineDays = existing.routineDays ?? [];
      const nextRoutineDays = selectedToday && existing.routineEnabled
        ? routineDays.filter((routineDay) => routineDay !== day)
        : routineDays;
      const write = await queueOfflineWrite({
        collectionKey: 'exercises',
        documentId: existing.id,
        path: `exercises/${existing.id}`,
        kind: 'update',
        data: {
          selectedDate: selectedToday ? null : today,
          ...(selectedToday && existing.routineEnabled
            ? {
              routineDays: nextRoutineDays,
              routineEnabled: nextRoutineDays.length > 0,
            }
            : {}),
        },
      }, userId);
      setExercises((current) => applyPendingWrites(current, [write]));
      return;
    }

    await saveExercise({
      name,
      duration,
      mode,
      targetReps: mode === 'repetitions' ? targetReps ?? 1 : null,
      intensity,
      equipment,
      note: '',
      selectedDate: today,
      completedDate: null,
      completedDates: [],
      routineDays: [],
      routineEnabled: false,
    });
  };

  const toggleCompleted = async (exerciseId: string) => {
    if (!db || !userId) throw new Error('Connectez-vous pour suivre votre routine.');
    const exercise = exercises.find((item) => item.id === exerciseId);
    if (!exercise || !isExerciseScheduledOnDate(exercise, today)) {
      throw new Error('Cet exercice ne fait pas partie de votre routine du jour.');
    }

    const completedDates = getCompletedDates(exercise);
    const isCompleted = completedDates.includes(today);
    const nextCompletedDates = isCompleted
      ? completedDates.filter((date) => date !== today)
      : [...completedDates, today];
    const write = await queueOfflineWrite({
      collectionKey: 'exercises',
      documentId: exerciseId,
      path: `exercises/${exerciseId}`,
      kind: 'update',
      data: {
        completedDate: isCompleted ? null : today,
        completedDates: nextCompletedDates,
      },
    }, userId);
    setExercises((current) => applyPendingWrites(current, [write]));
  };

  const addCustomExercise = async (
    name: string,
    duration: number,
    intensity: string,
    equipment: string,
    note: string,
    addToToday: boolean,
    routineDays: HabitDay[] = ALL_HABIT_DAYS,
    mode: ExerciseMode = 'timer',
    targetReps?: number
  ) => {
    await saveExercise({
      name,
      duration,
      mode,
      targetReps: mode === 'repetitions' ? targetReps ?? 1 : null,
      intensity,
      equipment,
      note: note.trim(),
      selectedDate: addToToday ? today : null,
      completedDate: null,
      completedDates: [],
      routineDays: [...new Set(routineDays)],
      routineEnabled: addToToday,
    });
  };

  const updateCustomExercise = async (
    exerciseId: string,
    name: string,
    duration: number,
    intensity: string,
    equipment: string,
    note: string,
    routineDays: HabitDay[],
    routineEnabled: boolean,
    mode: ExerciseMode = 'timer',
    targetReps?: number
  ) => {
    if (!db || !userId) throw new Error('Connectez-vous pour modifier un exercice.');
    const exercise = exercises.find((item) => item.id === exerciseId);
    if (!exercise || exercise.userId !== userId) {
      throw new Error('Cet exercice est introuvable sur cet appareil.');
    }

    const trimmedName = name.trim();
    const trimmedEquipment = equipment.trim() || 'Sans matériel';
    const trimmedNote = note.trim();
    if (!trimmedName) throw new Error('Le nom de l’exercice ne peut pas être vide.');
    if (mode === 'timer' && (!Number.isInteger(duration) || duration < 1 || duration > 180)) {
      throw new Error('Choisis une durée entre 1 et 180 minutes.');
    }
    if (mode === 'repetitions' && (!Number.isInteger(targetReps) || !targetReps || targetReps < 1 || targetReps > 1000)) {
      throw new Error('Choisis un nombre de répétitions entre 1 et 1 000.');
    }
    if (routineEnabled && !routineDays.length) {
      throw new Error('Choisis au moins un jour pour ta routine.');
    }

    const updatedExercise = {
      name: trimmedName,
      duration,
      mode,
      targetReps: mode === 'repetitions' ? targetReps : null,
      intensity,
      equipment: trimmedEquipment,
      note: trimmedNote,
      routineDays: routineEnabled ? [...new Set(routineDays)] : [],
      routineEnabled,
      selectedDate: routineEnabled ? exercise.selectedDate : null,
    };
    const write = await queueOfflineWrite({
      collectionKey: 'exercises',
      documentId: exerciseId,
      path: `exercises/${exerciseId}`,
      kind: 'update',
      data: updatedExercise,
    }, userId);
    setExercises((current) => applyPendingWrites(current, [write]));
  };

  return {
    exercises: userId && loadedUserId === userId ? exercises : [],
    today,
    loading,
    error,
    toggleToday,
    toggleCompleted,
    addCustomExercise,
    updateCustomExercise,
  };
}
