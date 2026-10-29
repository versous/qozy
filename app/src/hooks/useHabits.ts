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
  icon: string;
  userId: string;
  createdAt: Timestamp;
}

interface HabitDocument {
  id: string;
  title: string;
  userId: string;
  icon?: string;
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

const getStreak = (completionDates: Set<string>, today: string) => {
  let date = completionDates.has(today) ? today : getPreviousDateKey(today);
  let streak = 0;

  while (completionDates.has(date)) {
    streak += 1;
    date = getPreviousDateKey(date);
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
          return {
            ...habit,
            streak: getStreak(dates, today),
            isCompleted: dates.has(today),
            icon: habit.icon ?? '🌱',
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

  const addHabit = async (title: string, icon = '🌱') => {
    if (!db || !userId) throw new Error('Connectez-vous pour ajouter une habitude.');
    const trimmedTitle = title.trim();
    if (!trimmedTitle) throw new Error('Le nom de l’habitude ne peut pas être vide.');

    await addDoc(collection(db, 'habits'), {
      title: trimmedTitle,
      icon,
      userId,
      createdAt: Timestamp.now(),
    });
  };

  const toggleHabit = async (habitId: string) => {
    if (!db || !userId) throw new Error('Connectez-vous pour modifier vos habitudes.');

    const habitRef = doc(db, 'habits', habitId);
    const completionRef = doc(db, 'habits', habitId, 'completions', today);

    await runTransaction(db, async (transaction) => {
      const habit = await transaction.get(habitRef);
      if (!habit.exists() || habit.data().userId !== userId) {
        throw new Error('Cette habitude est introuvable.');
      }

      const completion = await transaction.get(completionRef);
      if (completion.exists()) {
        transaction.delete(completionRef);
      } else {
        transaction.set(completionRef, { habitId, date: today, userId });
      }
    });
  };

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
    habits: userId && loadedUserId === userId ? habits : [],
    loading,
    error,
    addHabit,
    toggleHabit,
    deleteHabit,
  };
};
