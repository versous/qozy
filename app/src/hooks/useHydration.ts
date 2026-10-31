import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useMemo, useState } from 'react';

import { auth } from '@/services/firebase';

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
  update: (entries: HydrationEntry[]) => HydrationEntry[]
) {
  const previous = entryWriteQueues.get(storageKey) ?? Promise.resolve();
  const operation = previous.then(async () => {
    const currentEntries = await loadEntries(storageKey);
    const nextEntries = update(currentEntries);
    await AsyncStorage.setItem(storageKey, JSON.stringify(nextEntries));
    publishEntries(storageKey, nextEntries);
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
  const storageKey = userId ? getStorageKey(userId) : null;
  const queryKey = storageKey ? `${storageKey}:${today}` : null;
  const isLoaded = Boolean(queryKey && loadedKey === queryKey);

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
    if (!storageKey || !queryKey) return;

    let active = true;
    const unsubscribe = subscribeToEntries(storageKey, (nextEntries) => {
      if (active) setEntries(nextEntries);
    });
    void loadEntries(storageKey).then((nextEntries) => {
      if (!active) return;
      setEntries(nextEntries);
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

    return () => {
      active = false;
      unsubscribe();
    };
  }, [queryKey, storageKey]);

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
    await updateEntries(storageKey, update);
    setError(null);
  };

  const addWater = async (milliliters: number) => {
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

  return {
    today,
    selectedDate,
    setSelectedDate,
    entries: isLoaded ? entries : [],
    selectedEntries: isLoaded ? selectedEntries : [],
    milliliters: isLoaded ? (selectedDate === today ? todayMilliliters : selectedMilliliters) : 0,
    todayMilliliters: isLoaded ? todayMilliliters : 0,
    dailyGoalMilliliters: DAILY_GOAL_MILLILITERS,
    dailyTotals: isLoaded ? dailyTotals : new Map<string, number>(),
    loading: Boolean(queryKey && !isLoaded),
    error,
    addWater,
    undoLastEntry,
  };
}
