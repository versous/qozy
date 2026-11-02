import AsyncStorage from '@react-native-async-storage/async-storage';
import { collection, onSnapshot } from 'firebase/firestore';
import { useEffect, useMemo, useState } from 'react';

import { auth, db } from '@/services/firebase';
import {
  applyPendingWrites,
  getCachedDocuments,
  getPendingWrites,
  queueOfflineWrite,
  reportFirestoreConnectivity,
  saveCachedDocuments,
} from '@/services/offlineStore';

const DAILY_GOAL_MILLILITERS = 2000;
const entryCache = new Map<string, HydrationEntry[]>();
const entryLoads = new Map<string, Promise<HydrationEntry[]>>();
const entryListeners = new Map<string, Set<(entries: HydrationEntry[]) => void>>();
const entryWriteQueues = new Map<string, Promise<void>>();

export interface HydrationEntry {
  id: string;
  date: string;
  milliliters: number;
  createdAt: number;
  container?: string;
}

function getDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function getStorageKey(userId: string) {
  return `qozy-hydration:${userId}`;
}

function normalizeEntries(value: unknown): HydrationEntry[] {
  if (!Array.isArray(value)) {
    if (!value || typeof value !== 'object') return [];
    const legacy = value as { date?: unknown; milliliters?: unknown };
    if (
      typeof legacy.date !== 'string'
      || typeof legacy.milliliters !== 'number'
      || !Number.isInteger(legacy.milliliters)
      || legacy.milliliters <= 0
    ) return [];
    return [{
      id: `legacy-${legacy.date}`,
      date: legacy.date,
      milliliters: legacy.milliliters,
      createdAt: new Date(`${legacy.date}T12:00:00`).getTime(),
    }];
  }

  return value.filter((entry): entry is HydrationEntry => (
    Boolean(entry)
    && typeof entry === 'object'
    && typeof entry.id === 'string'
    && typeof entry.date === 'string'
    && /^\d{4}-\d{2}-\d{2}$/.test(entry.date)
    && typeof entry.milliliters === 'number'
    && Number.isInteger(entry.milliliters)
    && entry.milliliters > 0
    && typeof entry.createdAt === 'number'
    && Number.isFinite(entry.createdAt)
    && (entry.container === undefined || typeof entry.container === 'string')
  ));
}

function publishEntries(storageKey: string, entries: HydrationEntry[]) {
  entryCache.set(storageKey, entries);
  entryListeners.get(storageKey)?.forEach((listener) => listener(entries));
}

function subscribeToEntries(storageKey: string, listener: (entries: HydrationEntry[]) => void) {
  const listeners = entryListeners.get(storageKey) ?? new Set();
  listeners.add(listener);
  entryListeners.set(storageKey, listeners);
  return () => {
    listeners.delete(listener);
    if (!listeners.size) entryListeners.delete(storageKey);
  };
}

function loadEntries(storageKey: string) {
  const cached = entryCache.get(storageKey);
  if (cached) return Promise.resolve(cached);

  const pendingLoad = entryLoads.get(storageKey);
  if (pendingLoad) return pendingLoad;

  const load = AsyncStorage.getItem(storageKey).then((stored) => {
    const entries = normalizeEntries(stored ? JSON.parse(stored) : []);
    const latestEntries = entryCache.get(storageKey) ?? entries;
    publishEntries(storageKey, latestEntries);
    return latestEntries;
  }).finally(() => {
    entryLoads.delete(storageKey);
  });
  entryLoads.set(storageKey, load);
  return load;
}

function updateEntries(
  storageKey: string,
  userId: string,
  update: (entries: HydrationEntry[]) => HydrationEntry[]
) {
  const previous = entryWriteQueues.get(storageKey) ?? Promise.resolve();
  const operation = previous.then(async () => {
    const currentEntries = await loadEntries(storageKey);
    const nextEntries = update(currentEntries);
    await AsyncStorage.setItem(storageKey, JSON.stringify(nextEntries));
    publishEntries(storageKey, nextEntries);
    await saveCachedDocuments(userId, 'hydration', nextEntries);

    const previousById = new Map(currentEntries.map((entry) => [entry.id, entry]));
    const nextById = new Map(nextEntries.map((entry) => [entry.id, entry]));
    const writes = [
      ...nextEntries
        .filter((entry) => JSON.stringify(previousById.get(entry.id)) !== JSON.stringify(entry))
        .map((entry) => queueOfflineWrite({
          collectionKey: 'hydration',
          documentId: entry.id,
          path: `users/${userId}/hydration/${entry.id}`,
          kind: 'set' as const,
          data: {
            date: entry.date,
            milliliters: entry.milliliters,
            createdAt: entry.createdAt,
            ...(entry.container ? { container: entry.container } : {}),
          },
        }, userId)),
      ...currentEntries
        .filter((entry) => !nextById.has(entry.id))
        .map((entry) => queueOfflineWrite({
          collectionKey: 'hydration',
          documentId: entry.id,
          path: `users/${userId}/hydration/${entry.id}`,
          kind: 'delete' as const,
        }, userId)),
    ];
    await Promise.all(writes);
  });
  entryWriteQueues.set(storageKey, operation.then(() => undefined, () => undefined));
  return operation;
}

export function useHydration() {
  const userId = auth?.currentUser?.uid ?? null;
  const [today, setToday] = useState(() => getDateKey(new Date()));
  const [selectedDate, setSelectedDate] = useState(today);
  const [entries, setEntries] = useState<HydrationEntry[]>([]);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dailyGoalMilliliters, setDailyGoalMilliliters] = useState(DAILY_GOAL_MILLILITERS);
  const [loadedGoalUserId, setLoadedGoalUserId] = useState<string | null>(null);
  const storageKey = userId ? getStorageKey(userId) : null;
  const queryKey = storageKey ? `${storageKey}:${today}` : null;
  const isLoaded = Boolean(queryKey && loadedKey === queryKey);
  const isGoalLoaded = Boolean(userId && loadedGoalUserId === userId);

  useEffect(() => {
    if (!userId) return;

    let active = true;
    void AsyncStorage.getItem(`qozy-hydration-goal:${userId}`).then((storedGoal) => {
      if (!active) return;
      const goal = Number(storedGoal);
      setDailyGoalMilliliters(
        Number.isInteger(goal) && goal >= 250 && goal <= 10000
          ? goal
          : DAILY_GOAL_MILLILITERS
      );
      setLoadedGoalUserId(userId);
    }).catch((reason: unknown) => {
      if (!active) return;
      setError(reason instanceof Error
        ? `Impossible de lire ton repère d’hydratation : ${reason.message}`
        : 'Impossible de lire ton repère d’hydratation.');
      setLoadedGoalUserId(userId);
    });

    return () => {
      active = false;
    };
  }, [userId]);

  useEffect(() => {
    const now = new Date();
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 50);
    const timeout = setTimeout(() => {
      const nextDay = getDateKey(new Date());
      setToday(nextDay);
      setSelectedDate((current) => current === today ? nextDay : current);
    }, midnight.getTime() - now.getTime());

    return () => clearTimeout(timeout);
  }, [today]);

  useEffect(() => {
    if (!storageKey || !queryKey || !userId || !db) return;

    let active = true;
    let receivedServerSnapshot = false;
    let checkedLegacyMigration = false;
    const unsubscribe = subscribeToEntries(storageKey, (nextEntries) => {
      if (active) setEntries(nextEntries);
    });
    void Promise.all([
      loadEntries(storageKey),
      getCachedDocuments<HydrationEntry>(userId, 'hydration'),
      getPendingWrites(userId, 'hydration'),
    ]).then(([localEntries, cachedEntries, pendingWrites]) => {
      if (!active) return;
      const base = cachedEntries.length ? cachedEntries : localEntries;
      const visibleEntries = applyPendingWrites(base, pendingWrites);
      publishEntries(storageKey, visibleEntries);
      setError(null);
      setLoadedKey(queryKey);
    }).catch((reason: unknown) => {
      if (!active) return;
      setEntries([]);
      setError(reason instanceof Error
        ? `Impossible de lire ton suivi d’hydratation : ${reason.message}`
        : 'Impossible de lire ton suivi d’hydratation.');
      setLoadedKey(queryKey);
    });

    const unsubscribeRemote = onSnapshot(
      collection(db, 'users', userId, 'hydration'),
      { includeMetadataChanges: true },
      (snapshot) => {
        const fromCache = snapshot.metadata.fromCache;
        if (!fromCache) receivedServerSnapshot = true;
        reportFirestoreConnectivity(userId, !fromCache);

        const remoteEntries = snapshot.docs.map((document) => ({
          ...document.data(),
          id: document.id,
        })).filter((entry): entry is HydrationEntry => normalizeEntries([entry]).length === 1);

        void (async () => {
          const localEntries = await loadEntries(storageKey);
          if (!fromCache && !checkedLegacyMigration) {
            checkedLegacyMigration = true;
            const migrationKey = `${storageKey}:cloud-migrated`;
            const alreadyMigrated = await AsyncStorage.getItem(migrationKey);
            if (!alreadyMigrated && !remoteEntries.length && localEntries.length) {
              await Promise.all(localEntries.map((entry) => queueOfflineWrite({
                collectionKey: 'hydration',
                documentId: entry.id,
                path: `users/${userId}/hydration/${entry.id}`,
                kind: 'set',
                data: {
                  date: entry.date,
                  milliliters: entry.milliliters,
                  createdAt: entry.createdAt,
                  ...(entry.container ? { container: entry.container } : {}),
                },
              }, userId)));
              await AsyncStorage.setItem(migrationKey, 'true');
            }
          }

          const baseEntries = fromCache && !receivedServerSnapshot
            ? localEntries
            : remoteEntries;
          await saveCachedDocuments(userId, 'hydration', baseEntries);
          const pendingWrites = await getPendingWrites(userId, 'hydration');
          if (!active) return;
          publishEntries(storageKey, applyPendingWrites(baseEntries, pendingWrites));
          setLoadedKey(queryKey);
          setError(null);
        })().catch((reason: unknown) => {
          if (!active) return;
          setError(reason instanceof Error
            ? `Impossible de synchroniser ton hydratation : ${reason.message}`
            : 'Impossible de synchroniser ton hydratation.');
        });
      },
      (reason) => {
        reportFirestoreConnectivity(userId, false);
        if (!active) return;
        setError(reason.message || 'Impossible de synchroniser ton hydratation pour le moment.');
      }
    );

    return () => {
      active = false;
      unsubscribe();
      unsubscribeRemote();
    };
  }, [queryKey, storageKey, userId]);

  const selectedEntries = useMemo(() => entries
    .filter((entry) => entry.date === selectedDate)
    .sort((first, second) => second.createdAt - first.createdAt), [entries, selectedDate]);
  const selectedMilliliters = selectedEntries.reduce(
    (total, entry) => total + entry.milliliters,
    0
  );
  const todayMilliliters = entries.reduce(
    (total, entry) => total + (entry.date === today ? entry.milliliters : 0),
    0
  );
  const dailyTotals = useMemo(() => {
    const totals = new Map<string, number>();
    entries.forEach((entry) => {
      totals.set(entry.date, (totals.get(entry.date) ?? 0) + entry.milliliters);
    });
    return totals;
  }, [entries]);

  const saveEntries = async (update: (current: HydrationEntry[]) => HydrationEntry[]) => {
    if (!storageKey || !queryKey || !isLoaded) {
      throw new Error('Ton suivi d’hydratation est encore en cours de chargement.');
    }
    if (!userId) throw new Error('Connecte-toi pour enregistrer ton hydratation.');
    await updateEntries(storageKey, userId, update);
    setError(null);
  };

  const addWater = async (milliliters: number, container?: string) => {
    if (!Number.isInteger(milliliters) || milliliters < 50 || milliliters > 5000) {
      throw new Error('Choisis une quantité comprise entre 50 et 5 000 ml.');
    }
    if (selectedDate !== today) {
      throw new Error('Tu peux ajouter une prise d’eau uniquement pour aujourd’hui.');
    }
    const now = Date.now();
    await saveEntries((currentEntries) => [
      ...currentEntries,
      {
        id: `${now}-${Math.random().toString(36).slice(2, 8)}`,
        date: getDateKey(new Date(now)),
        milliliters,
        createdAt: now,
        ...(container ? { container } : {}),
      },
    ]);
  };

  const undoLastEntry = async () => {
    await saveEntries((currentEntries) => {
      const lastEntry = currentEntries
        .filter((entry) => entry.date === today)
        .sort((first, second) => second.createdAt - first.createdAt)[0];
      return lastEntry
        ? currentEntries.filter((entry) => entry.id !== lastEntry.id)
        : currentEntries;
    });
  };

  const removeEntry = async (entryId: string) => {
    if (selectedDate !== today) {
      throw new Error('Tu peux modifier uniquement les prises d’aujourd’hui.');
    }
    await saveEntries((currentEntries) =>
      currentEntries.filter((entry) => entry.id !== entryId)
    );
  };

  const saveDailyGoal = async (milliliters: number) => {
    if (!Number.isInteger(milliliters) || milliliters < 250 || milliliters > 10000) {
      throw new Error('Choisis un repère compris entre 250 et 10 000 ml.');
    }
    if (!userId || !isGoalLoaded) {
      throw new Error('Ton repère est encore en cours de chargement.');
    }
    await AsyncStorage.setItem(`qozy-hydration-goal:${userId}`, String(milliliters));
    setDailyGoalMilliliters(milliliters);
  };

  return {
    today,
    selectedDate,
    setSelectedDate,
    entries: isLoaded ? entries : [],
    selectedEntries: isLoaded ? selectedEntries : [],
    milliliters: isLoaded ? (selectedDate === today ? todayMilliliters : selectedMilliliters) : 0,
    todayMilliliters: isLoaded ? todayMilliliters : 0,
    dailyGoalMilliliters: isGoalLoaded ? dailyGoalMilliliters : DAILY_GOAL_MILLILITERS,
    goalLoading: Boolean(userId && !isGoalLoaded),
    saveDailyGoal,
    removeEntry,
    dailyTotals: isLoaded ? dailyTotals : new Map<string, number>(),
    loading: Boolean(queryKey && !isLoaded),
    error,
    addWater,
    undoLastEntry,
  };
}
