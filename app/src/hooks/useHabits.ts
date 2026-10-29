import { useEffect, useState } from 'react';
import { auth, db } from '../services/firebase';
import { FirebaseError } from 'firebase/app';
import {
  collection,
  collectionGroup,
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
  type OfflineDocument,
} from '../services/offlineStore';

export interface Habit {
  id: string;
  title: string;
  streak: number;
  isCompleted: boolean;
  completedDates: string[];
  icon: string;
  frequencyDays: HabitDay[];
  userId: string;
  createdAt: Timestamp;
}

export type HabitDay = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export const ALL_HABIT_DAYS: HabitDay[] = [0, 1, 2, 3, 4, 5, 6];

interface HabitDocument {
  id: string;
  title: string;
  userId: string;
  icon?: string;
  frequencyDays?: unknown;
  createdAt?: Timestamp;
}

interface CompletionDocument {
  id: string;
  habitId: string;
  date: string;
  userId: string;
}

const getDateKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

const getPreviousDateKey = (dateKey: string) => {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day - 1)).toISOString().slice(0, 10);
};

const normalizeFrequencyDays = (days: unknown): HabitDay[] => {
  if (!Array.isArray(days)) return ALL_HABIT_DAYS;
  const validDays = days.filter(
    (day): day is HabitDay =>
      typeof day === 'number' && ALL_HABIT_DAYS.includes(day as HabitDay)
  );
  return validDays.length ? validDays : ALL_HABIT_DAYS;
};

const getPreviousScheduledDateKey = (dateKey: string, frequencyDays: HabitDay[]) => {
  const [year, month, day] = dateKey.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  for (let offset = 1; offset <= 7; offset += 1) {
    date.setUTCDate(date.getUTCDate() - 1);
    if (frequencyDays.includes(date.getUTCDay() as HabitDay)) {
      return date.toISOString().slice(0, 10);
    }
  }

  return getPreviousDateKey(dateKey);
};

const getStreak = (
  completionDates: Set<string>,
  today: string,
  frequencyDays: HabitDay[]
) => {
  let date = completionDates.has(today)
    ? today
    : getPreviousScheduledDateKey(today, frequencyDays);
  let streak = 0;

  while (completionDates.has(date)) {
    streak += 1;
    date = getPreviousScheduledDateKey(date, frequencyDays);
  }

  return streak;
};

export const useHabits = () => {
  const [habits, setHabits] = useState<Habit[]>([]);
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
    let habitDocuments: HabitDocument[] = [];
    let completionDocuments: CompletionDocument[] = [];
    let habitsLoaded = false;
    let completionsLoaded = false;
    let active = true;
    let serverHabitsLoaded = false;
    let serverCompletionsLoaded = false;

    const updateHabits = async () => {
      if (!habitsLoaded || !completionsLoaded) return;

      const [habitWrites, completionWrites] = await Promise.all([
        getPendingWrites(userId, 'habits'),
        getPendingWrites(userId, 'habitCompletions'),
      ]);
      if (!active) return;
      const visibleHabits = applyPendingWrites(habitDocuments, habitWrites);
      const visibleCompletions = applyPendingWrites(completionDocuments, completionWrites);
      const completionDates = new Map<string, Set<string>>();
      visibleCompletions.forEach((completion) => {
        const dates = completionDates.get(completion.habitId) ?? new Set<string>();
        dates.add(completion.date);
        completionDates.set(completion.habitId, dates);
      });

      setHabits(visibleHabits.map((habit) => {
          const dates = completionDates.get(habit.id) ?? new Set<string>();
          const frequencyDays = normalizeFrequencyDays(habit.frequencyDays);
          return {
            ...habit,
            streak: getStreak(dates, today, frequencyDays),
            isCompleted: dates.has(today),
            completedDates: [...dates],
            icon: habit.icon ?? '🌱',
            frequencyDays,
            createdAt: habit.createdAt ?? Timestamp.now(),
          };
        }));
      setLoadedUserId(userId);
      setError(null);
    };

    const handleError = (reason: Error) => {
      if (reason instanceof FirebaseError && reason.code === 'failed-precondition') {
        setError('La synchronisation se prépare encore. Réessaie dans quelques minutes.');
        return;
      }
      if (reason instanceof FirebaseError && reason.code === 'permission-denied') {
        setError('Accès aux habitudes refusé. Vérifie ta connexion puis réessaie.');
        return;
      }
      setError('Impossible de charger les habitudes. Vérifie ta connexion puis réessaie.');
    };

    void Promise.all([
      getCachedDocuments<HabitDocument & OfflineDocument>(userId, 'habits'),
      getCachedDocuments<CompletionDocument>(userId, 'habitCompletions'),
    ]).then(([cachedHabits, cachedCompletions]) => {
      if (!active || serverHabitsLoaded || serverCompletionsLoaded) return;
      habitDocuments = cachedHabits;
      completionDocuments = cachedCompletions;
      habitsLoaded = true;
      completionsLoaded = true;
      void updateHabits();
    }).catch((reason: unknown) => {
      if (active) {
        setError(reason instanceof Error
          ? `Impossible de lire les habitudes enregistrées sur cet appareil : ${reason.message}`
          : 'Impossible de lire les habitudes enregistrées sur cet appareil.');
      }
    });

    const habitsQuery = query(collection(db, 'habits'), where('userId', '==', userId));
    const unsubscribeHabits = onSnapshot(
      habitsQuery,
      { includeMetadataChanges: true },
      (snapshot) => {
        if (!snapshot.metadata.fromCache) serverHabitsLoaded = true;
        habitDocuments = snapshot.docs.map((habit) => ({
          ...(habit.data() as HabitDocument),
          id: habit.id,
        }));
        habitsLoaded = true;
        void saveCachedDocuments(userId, 'habits', habitDocuments)
          .then(updateHabits)
          .catch((reason: unknown) => {
            if (active) setError(reason instanceof Error
              ? `Impossible d’enregistrer les habitudes localement : ${reason.message}`
              : 'Impossible d’enregistrer les habitudes localement.');
          });
        reportFirestoreConnectivity(userId, !snapshot.metadata.fromCache);
      },
      handleError
    );

    const completionsQuery = query(
      collectionGroup(db, 'completions'),
      where('userId', '==', userId)
    );
    const unsubscribeCompletions = onSnapshot(
      completionsQuery,
      { includeMetadataChanges: true },
      (snapshot) => {
        if (!snapshot.metadata.fromCache) serverCompletionsLoaded = true;
        completionDocuments = snapshot.docs.flatMap((completion) => {
          const data = completion.data() as CompletionDocument;
          if (!data.habitId || !data.date) return [];
          return [{ ...data, id: `${data.habitId}:${data.date}` }];
        });
        completionsLoaded = true;
        void saveCachedDocuments(userId, 'habitCompletions', completionDocuments)
          .then(updateHabits)
          .catch((reason: unknown) => {
            if (active) setError(reason instanceof Error
              ? `Impossible d’enregistrer l’historique localement : ${reason.message}`
              : 'Impossible d’enregistrer l’historique localement.');
          });
        reportFirestoreConnectivity(userId, !snapshot.metadata.fromCache);
      },
      handleError
    );

    return () => {
      active = false;
      unsubscribeHabits();
      unsubscribeCompletions();
    };
  }, [today, userId]);

  const addHabit = async (
    title: string,
    icon = '🌱',
    frequencyDays: HabitDay[] = ALL_HABIT_DAYS
  ) => {
    if (!db || !userId) throw new Error('Connectez-vous pour ajouter une habitude.');
    const trimmedTitle = title.trim();
    if (!trimmedTitle) throw new Error('Le nom de l’habitude ne peut pas être vide.');
    if (!frequencyDays.length) throw new Error('Choisis au moins un jour pour cette habitude.');

    const habitId = doc(collection(db, 'habits')).id;
    const write = await queueOfflineWrite({
      collectionKey: 'habits',
      documentId: habitId,
      path: `habits/${habitId}`,
      kind: 'set',
      data: {
        title: trimmedTitle,
        icon,
        frequencyDays: [...new Set(frequencyDays)],
        userId,
        createdAt: Timestamp.now(),
      },
    }, userId);
    setHabits((current) => applyPendingWrites(current, [write]).map((habit) => ({
      ...habit,
      streak: habit.streak ?? 0,
      isCompleted: habit.isCompleted ?? false,
      completedDates: habit.completedDates ?? [],
      frequencyDays: normalizeFrequencyDays(habit.frequencyDays),
      icon: habit.icon ?? '🌱',
      createdAt: habit.createdAt ?? Timestamp.now(),
    })));
  };

  const toggleHabitForDate = async (habitId: string, date: string) => {
    if (!db || !userId) throw new Error('Connectez-vous pour modifier vos habitudes.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || getDateKey(new Date(`${date}T00:00:00`)) !== date) {
      throw new Error('Cette date est invalide.');
    }
    if (date > today) throw new Error('Une habitude future ne peut pas être validée.');

    const habit = habits.find((item) => item.id === habitId);
    if (!habit || habit.userId !== userId) throw new Error('Cette habitude est introuvable sur cet appareil.');
    if (!habit.frequencyDays.includes(new Date(`${date}T00:00:00`).getDay() as HabitDay)) {
      throw new Error('Cette habitude n’est pas prévue ce jour-là.');
    }

    const isCompleted = habit.completedDates.includes(date);
    const completionId = `${habitId}:${date}`;
    const write = await queueOfflineWrite({
      collectionKey: 'habitCompletions',
      documentId: completionId,
      path: `habits/${habitId}/completions/${date}`,
      kind: isCompleted ? 'delete' : 'set',
      data: isCompleted ? undefined : { habitId, date, userId },
    }, userId);

    setHabits((currentHabits) => currentHabits.map((currentHabit) => {
      if (currentHabit.id !== habitId) return currentHabit;
      const dates = new Set(currentHabit.completedDates);
      if (isCompleted) dates.delete(date);
      else dates.add(date);
      return {
        ...currentHabit,
        completedDates: [...dates],
        isCompleted: dates.has(today),
        streak: getStreak(dates, today, currentHabit.frequencyDays),
      };
    }));
    return write;
  };

  const toggleHabit = async (habitId: string) => toggleHabitForDate(habitId, today);

  const deleteHabit = async (habitId: string) => {
    if (!db || !userId) throw new Error('Connectez-vous pour supprimer une habitude.');

    const habit = habits.find((item) => item.id === habitId);
    if (!habit || habit.userId !== userId) throw new Error('Cette habitude est introuvable sur cet appareil.');

    for (const date of habit.completedDates) {
      await queueOfflineWrite({
        collectionKey: 'habitCompletions',
        documentId: `${habitId}:${date}`,
        path: `habits/${habitId}/completions/${date}`,
        kind: 'delete',
      }, userId);
    }
    const write = await queueOfflineWrite({
      collectionKey: 'habits',
      documentId: habitId,
      path: `habits/${habitId}`,
      kind: 'delete',
    }, userId);
    setHabits((current) => applyPendingWrites(current, [write]));
  };

  return {
    habits: userId && loadedUserId === userId
      ? habits.filter((habit) => habit.frequencyDays.includes(new Date().getDay() as HabitDay))
      : [],
    allHabits: userId && loadedUserId === userId ? habits : [],
    loading,
    error,
    addHabit,
    toggleHabit,
    toggleHabitForDate,
    deleteHabit,
  };
};
