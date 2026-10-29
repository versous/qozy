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
  trackedDates: string[];
  progressByDate: Record<string, number>;
  todayProgress: number;
  goalType: HabitGoalType;
  goalTarget: number;
  goalUnit: string;
  icon: string;
  frequencyDays: HabitDay[];
  userId: string;
  createdAt: Timestamp;
}

export type HabitGoalType = 'check' | 'count' | 'timer';

export interface HabitGoal {
  type: HabitGoalType;
  target: number;
  unit: string;
}

export type HabitDay = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export const ALL_HABIT_DAYS: HabitDay[] = [0, 1, 2, 3, 4, 5, 6];

interface HabitDocument {
  id: string;
  title: string;
  userId: string;
  icon?: string;
  frequencyDays?: unknown;
  goalType?: unknown;
  goalTarget?: unknown;
  goalUnit?: unknown;
  createdAt?: Timestamp;
}

interface CompletionDocument {
  id: string;
  habitId: string;
  date: string;
  userId: string;
  progress?: number;
}

const normalizeGoalType = (value: unknown): HabitGoalType =>
  value === 'count' || value === 'timer' ? value : 'check';

const normalizeGoalTarget = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 1;

const normalizeGoalUnit = (value: unknown, type: HabitGoalType) =>
  type === 'timer' ? 'minutes' : typeof value === 'string' && value.trim() ? value.trim() : 'fois';

const getCompletionTarget = (habit: Pick<Habit, 'goalType' | 'goalTarget'>) =>
  habit.goalType === 'timer' ? habit.goalTarget * 60 : habit.goalTarget;

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
      const progressByHabit = new Map<string, Record<string, number>>();
      visibleCompletions.forEach((completion) => {
        const dates = completionDates.get(completion.habitId) ?? new Set<string>();
        if (typeof completion.progress === 'number' && Number.isFinite(completion.progress)) {
          const progress = progressByHabit.get(completion.habitId) ?? {};
          progress[completion.date] = completion.progress;
          progressByHabit.set(completion.habitId, progress);
        } else {
          dates.add(completion.date);
        }
        completionDates.set(completion.habitId, dates);
      });

      setHabits(visibleHabits.map((habit) => {
          const storedDates = completionDates.get(habit.id) ?? new Set<string>();
          const goalType = normalizeGoalType(habit.goalType);
          const goalTarget = normalizeGoalTarget(habit.goalTarget);
          const goalUnit = normalizeGoalUnit(habit.goalUnit, goalType);
          const progress = progressByHabit.get(habit.id) ?? {};
          const dates = new Set(storedDates);
          if (goalType !== 'check') {
            Object.entries(progress).forEach(([date, value]) => {
              if (value >= getCompletionTarget({ goalType, goalTarget })) dates.add(date);
              else dates.delete(date);
            });
          }
          const frequencyDays = normalizeFrequencyDays(habit.frequencyDays);
          return {
            ...habit,
            streak: getStreak(dates, today, frequencyDays),
            isCompleted: dates.has(today),
            completedDates: [...dates],
            trackedDates: [...new Set([...storedDates, ...Object.keys(progress)])],
            progressByDate: progress,
            todayProgress: progress[today] ?? 0,
            goalType,
            goalTarget,
            goalUnit,
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
    frequencyDays: HabitDay[] = ALL_HABIT_DAYS,
    goal: HabitGoal = { type: 'check', target: 1, unit: 'fois' }
  ) => {
    if (!db || !userId) throw new Error('Connectez-vous pour ajouter une habitude.');
    const trimmedTitle = title.trim();
    if (!trimmedTitle) throw new Error('Le nom de l’habitude ne peut pas être vide.');
    if (!frequencyDays.length) throw new Error('Choisis au moins un jour pour cette habitude.');
    if (!['check', 'count', 'timer'].includes(goal.type)) throw new Error('Choisis un type d’objectif valide.');
    if (!Number.isFinite(goal.target) || goal.target < 1 || goal.target > 10000) {
      throw new Error('L’objectif doit être compris entre 1 et 10 000.');
    }
    if (goal.type === 'check' && goal.target !== 1) throw new Error('Une habitude simple ne peut pas avoir de cible chiffrée.');
    if (goal.type === 'count' && !goal.unit.trim()) throw new Error('Précise l’unité de ton objectif.');

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
        goalType: goal.type,
        goalTarget: goal.type === 'check' ? 1 : goal.target,
        goalUnit: normalizeGoalUnit(goal.unit, goal.type),
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
      trackedDates: habit.trackedDates ?? [],
      progressByDate: habit.progressByDate ?? {},
      todayProgress: habit.todayProgress ?? 0,
      goalType: normalizeGoalType(habit.goalType),
      goalTarget: normalizeGoalTarget(habit.goalTarget),
      goalUnit: normalizeGoalUnit(habit.goalUnit, normalizeGoalType(habit.goalType)),
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
    if (habit.goalType !== 'check') throw new Error('Utilise les commandes de progression de cette habitude.');
    if (!habit.frequencyDays.includes(new Date(`${date}T00:00:00`).getDay() as HabitDay)) {
      throw new Error('Cette habitude n’est pas prévue ce jour-là.');
    }

    const isCompleted = habit.completedDates.includes(date);
    const wasTracked = habit.trackedDates.includes(date);
    const nextIsCompleted = !isCompleted;
    const completionId = `${habitId}:${date}`;
    const pendingWrite = queueOfflineWrite({
      collectionKey: 'habitCompletions',
      documentId: completionId,
      path: `habits/${habitId}/completions/${date}`,
      kind: nextIsCompleted ? 'set' : 'delete',
      data: nextIsCompleted ? { habitId, date, userId } : undefined,
    }, userId);

    setHabits((currentHabits) => currentHabits.map((currentHabit) => {
      if (currentHabit.id !== habitId) return currentHabit;
      const dates = new Set(currentHabit.completedDates);
      if (nextIsCompleted) dates.add(date);
      else dates.delete(date);
      return {
        ...currentHabit,
        completedDates: [...dates],
        trackedDates: nextIsCompleted
          ? [...new Set([...currentHabit.trackedDates, date])]
          : currentHabit.trackedDates.filter((trackedDate) => trackedDate !== date),
        isCompleted: dates.has(today),
        streak: getStreak(dates, today, currentHabit.frequencyDays),
      };
    }));

    try {
      return await pendingWrite;
    } catch (reason) {
      setHabits((currentHabits) => currentHabits.map((currentHabit) => {
        if (currentHabit.id !== habitId) return currentHabit;
        const dates = new Set(currentHabit.completedDates);
        if (dates.has(date) !== nextIsCompleted) return currentHabit;
        if (isCompleted) dates.add(date);
        else dates.delete(date);
        return {
          ...currentHabit,
          completedDates: [...dates],
          trackedDates: wasTracked
            ? [...new Set([...currentHabit.trackedDates, date])]
            : currentHabit.trackedDates.filter((trackedDate) => trackedDate !== date),
          isCompleted: dates.has(today),
          streak: getStreak(dates, today, currentHabit.frequencyDays),
        };
      }));
      throw reason;
    }
  };

  const toggleHabit = async (habitId: string) => toggleHabitForDate(habitId, today);

  const updateHabitProgress = async (habitId: string, progress: number, date = today) => {
    if (!db || !userId) throw new Error('Connectez-vous pour modifier vos habitudes.');
    if (!Number.isFinite(progress) || progress < 0 || progress > 10000000) {
      throw new Error('Cette progression est invalide.');
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || getDateKey(new Date(`${date}T00:00:00`)) !== date) {
      throw new Error('Cette date est invalide.');
    }
    if (date > today) throw new Error('Une habitude future ne peut pas être modifiée.');

    const habit = habits.find((item) => item.id === habitId);
    if (!habit || habit.userId !== userId) throw new Error('Cette habitude est introuvable sur cet appareil.');
    if (habit.goalType === 'check') throw new Error('Cette habitude ne possède pas d’objectif chiffré.');
    if (!habit.frequencyDays.includes(new Date(`${date}T00:00:00`).getDay() as HabitDay)) {
      throw new Error('Cette habitude n’est pas prévue ce jour-là.');
    }
    if (!Number.isInteger(progress)) throw new Error('Cette progression doit être un nombre entier.');

    const completionId = `${habitId}:${date}`;
    const previousProgress = habit.progressByDate[date];
    const wasTracked = habit.trackedDates.includes(date);
    const wasCompleted = habit.completedDates.includes(date);
    const nextDates = new Set(habit.completedDates);
    if (progress >= getCompletionTarget(habit)) nextDates.add(date);
    else nextDates.delete(date);

    setHabits((current) => current.map((item) => item.id !== habitId ? item : {
      ...item,
      todayProgress: date === today ? progress : item.todayProgress,
      progressByDate: { ...item.progressByDate, [date]: progress },
      trackedDates: item.trackedDates.includes(date) ? item.trackedDates : [...item.trackedDates, date],
      completedDates: [...new Set([
        ...item.completedDates.filter((completedDate) => completedDate !== date),
        ...(progress >= getCompletionTarget(item) ? [date] : []),
      ])],
      isCompleted: date === today ? nextDates.has(today) : item.isCompleted,
      streak: getStreak(nextDates, today, item.frequencyDays),
    }));

    try {
      await queueOfflineWrite({
        collectionKey: 'habitCompletions',
        documentId: completionId,
        path: `habits/${habitId}/completions/${date}`,
        kind: 'set',
        data: { habitId, date, userId, progress },
      }, userId);
    } catch (reason) {
      setHabits((current) => current.map((item) => {
        if (item.id !== habitId) return item;
        const progressByDate = { ...item.progressByDate };
        if (previousProgress === undefined) delete progressByDate[date];
        else progressByDate[date] = previousProgress;
        const completedDates = wasCompleted
          ? [...new Set([...item.completedDates, date])]
          : item.completedDates.filter((completedDate) => completedDate !== date);
        const trackedDates = wasTracked
          ? [...new Set([...item.trackedDates, date])]
          : item.trackedDates.filter((trackedDate) => trackedDate !== date);
        return {
          ...item,
          todayProgress: date === today ? previousProgress ?? 0 : item.todayProgress,
          progressByDate,
          trackedDates,
          completedDates,
          isCompleted: date === today ? wasCompleted : item.isCompleted,
          streak: getStreak(new Set(completedDates), today, item.frequencyDays),
        };
      }));
      throw reason;
    }
  };

  const deleteHabit = async (habitId: string) => {
    if (!db || !userId) throw new Error('Connectez-vous pour supprimer une habitude.');

    const habit = habits.find((item) => item.id === habitId);
    if (!habit || habit.userId !== userId) throw new Error('Cette habitude est introuvable sur cet appareil.');

    for (const date of habit.trackedDates) {
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
    updateHabitProgress,
    deleteHabit,
  };
};
