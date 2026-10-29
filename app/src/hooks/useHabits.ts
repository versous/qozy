import { useEffect, useState } from 'react';
import { auth, db } from '../services/firebase';
import { FirebaseError } from 'firebase/app';
import {
  collection,
  collectionGroup,
  doc,
  getDocs,
  onSnapshot,
  query,
  runTransaction,
  Timestamp,
  where,
  writeBatch,
  addDoc,
} from 'firebase/firestore';

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
    const completionDates = new Map<string, Set<string>>();
    let habitsLoaded = false;
    let completionsLoaded = false;

    const updateHabits = () => {
      if (!habitsLoaded || !completionsLoaded) return;

      setHabits(
        habitDocuments.map((habit) => {
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
        })
      );
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

    const habitsQuery = query(collection(db, 'habits'), where('userId', '==', userId));
    const unsubscribeHabits = onSnapshot(
      habitsQuery,
      (snapshot) => {
        habitDocuments = snapshot.docs.map((habit) => ({
          ...(habit.data() as HabitDocument),
          id: habit.id,
        }));
        habitsLoaded = true;
        updateHabits();
      },
      handleError
    );

    const completionsQuery = query(
      collectionGroup(db, 'completions'),
      where('userId', '==', userId)
    );
    const unsubscribeCompletions = onSnapshot(
      completionsQuery,
      (snapshot) => {
        completionDates.clear();
        snapshot.docs.forEach((completion) => {
          const data = completion.data() as CompletionDocument;
          if (!data.habitId || !data.date) return;
          const dates = completionDates.get(data.habitId) ?? new Set<string>();
          dates.add(data.date);
          completionDates.set(data.habitId, dates);
        });
        completionsLoaded = true;
        updateHabits();
      },
      handleError
    );

    return () => {
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

    await addDoc(collection(db, 'habits'), {
      title: trimmedTitle,
      icon,
      frequencyDays: [...new Set(frequencyDays)],
      userId,
      createdAt: Timestamp.now(),
    });
  };

  const toggleHabitForDate = async (habitId: string, date: string) => {
    if (!db || !userId) throw new Error('Connectez-vous pour modifier vos habitudes.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || getDateKey(new Date(`${date}T00:00:00`)) !== date) {
      throw new Error('Cette date est invalide.');
    }
    if (date > today) throw new Error('Une habitude future ne peut pas être validée.');

    const habitRef = doc(db, 'habits', habitId);
    const completionRef = doc(db, 'habits', habitId, 'completions', date);

    await runTransaction(db, async (transaction) => {
      const habit = await transaction.get(habitRef);
      if (!habit.exists() || habit.data().userId !== userId) {
        throw new Error('Cette habitude est introuvable.');
      }
      if (!normalizeFrequencyDays(habit.data().frequencyDays).includes(
        new Date(`${date}T00:00:00`).getDay() as HabitDay
      )) {
        throw new Error('Cette habitude n’est pas prévue ce jour-là.');
      }

      const completion = await transaction.get(completionRef);
      if (completion.exists()) {
        transaction.delete(completionRef);
      } else {
        transaction.set(completionRef, { habitId, date, userId });
      }
    });
  };

  const toggleHabit = async (habitId: string) => toggleHabitForDate(habitId, today);

  const deleteHabit = async (habitId: string) => {
    if (!db || !userId) throw new Error('Connectez-vous pour supprimer une habitude.');

    const habitRef = doc(db, 'habits', habitId);
    const habit = await runTransaction(db, async (transaction) => {
      const snapshot = await transaction.get(habitRef);
      if (!snapshot.exists() || snapshot.data().userId !== userId) {
        throw new Error('Cette habitude est introuvable.');
      }
      return snapshot;
    });

    const completions = await getDocs(collection(db, 'habits', habit.id, 'completions'));
    for (let index = 0; index < completions.docs.length; index += 500) {
      const batch = writeBatch(db);
      completions.docs.slice(index, index + 500).forEach((completion) => batch.delete(completion.ref));
      await batch.commit();
    }

    await runTransaction(db, async (transaction) => {
      const currentHabit = await transaction.get(habitRef);
      if (!currentHabit.exists() || currentHabit.data().userId !== userId) {
        throw new Error('Cette habitude est introuvable.');
      }
      transaction.delete(habitRef);
    });
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
