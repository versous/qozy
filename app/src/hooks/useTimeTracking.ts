import AsyncStorage from '@react-native-async-storage/async-storage';
import { FirebaseError } from 'firebase/app';
import {
  collection,
  onSnapshot,
  query,
  Timestamp,
  where,
} from 'firebase/firestore';
import { useEffect, useState } from 'react';

import { auth, db } from '@/services/firebase';
import {
  applyPendingWrites,
  getCachedDocuments,
  getPendingWrites,
  queueOfflineWrite,
  reportFirestoreConnectivity,
  saveCachedDocuments,
} from '@/services/offlineStore';

export const TIME_CATEGORIES = [
  { id: 'code', label: 'Code' },
  { id: 'study', label: 'Étude' },
  { id: 'leisure', label: 'Loisir' },
  { id: 'wellbeing', label: 'Bien-être' },
  { id: 'admin', label: 'Organisation' },
  { id: 'other', label: 'Autre' },
] as const;

export type TimeCategory = typeof TIME_CATEGORIES[number]['id'];

export interface ActiveTimeSession {
  id: string;
  category: TimeCategory;
  project: string;
  taskId: string | null;
  taskTitle: string | null;
  startedAtMs: number;
  pausedAtMs?: number | null;
  pausedSeconds?: number;
}

export interface TimeEntry {
  id: string;
  category: TimeCategory;
  project: string;
  taskId: string | null;
  taskTitle: string | null;
  startedAt: Timestamp;
  endedAt: Timestamp;
  durationSeconds: number;
  userId: string;
}

const activeSessionKey = (userId: string) => `qozy-active-timer:${userId}`;

function isTimeCategory(value: unknown): value is TimeCategory {
  return TIME_CATEGORIES.some((category) => category.id === value);
}

function sortEntries(entries: TimeEntry[]) {
  return [...entries].sort((first, second) =>
    second.startedAt.toMillis() - first.startedAt.toMillis()
  );
}

export function useTimeTracking() {
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [activeSession, setActiveSession] = useState<ActiveTimeSession | null>(null);
  const [now, setNow] = useState(0);
  const [loadedUserId, setLoadedUserId] = useState<string | null>(null);
  const [timerLoadedUserId, setTimerLoadedUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const userId = auth?.currentUser?.uid;
  const loading = Boolean(userId && db && loadedUserId !== userId && !error);

  useEffect(() => {
    if (!activeSession) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [activeSession]);

  useEffect(() => {
    if (!userId || !db) return;

    let active = true;
    let receivedServerSnapshot = false;
    const restoreActiveTimer = async () => {
      const rawTimer = await AsyncStorage.getItem(activeSessionKey(userId));
      if (!active) return;
      if (!rawTimer) {
        setActiveSession(null);
        return;
      }
      const savedTimer: unknown = JSON.parse(rawTimer);
      if (!savedTimer || typeof savedTimer !== 'object') {
        throw new Error('Le chronomètre enregistré est illisible.');
      }
      const timer = savedTimer as Partial<ActiveTimeSession>;
      if (typeof timer.id !== 'string'
        || !isTimeCategory(timer.category)
        || typeof timer.project !== 'string'
        || typeof timer.startedAtMs !== 'number'
        || !Number.isFinite(timer.startedAtMs)
        || timer.startedAtMs > Date.now()) {
        throw new Error('Les informations du chronomètre enregistré sont invalides.');
      }
      setActiveSession({
        id: timer.id,
        category: timer.category,
        project: timer.project,
        taskId: typeof timer.taskId === 'string' ? timer.taskId : null,
        taskTitle: typeof timer.taskTitle === 'string' ? timer.taskTitle : null,
        startedAtMs: timer.startedAtMs,
        pausedAtMs: typeof timer.pausedAtMs === 'number' ? timer.pausedAtMs : null,
        pausedSeconds: typeof timer.pausedSeconds === 'number' ? timer.pausedSeconds : 0,
      });
      setNow(Date.now());
    };

    void Promise.all([
      getCachedDocuments<TimeEntry>(userId, 'timeEntries'),
      getPendingWrites(userId, 'timeEntries'),
      restoreActiveTimer(),
    ]).then(([cachedEntries, pendingWrites]) => {
      if (!active || receivedServerSnapshot) return;
      setEntries(sortEntries(applyPendingWrites(cachedEntries, pendingWrites)));
      setLoadedUserId(userId);
    }).catch((reason: unknown) => {
      if (!active) return;
      setError(reason instanceof Error
        ? `Impossible de lire le chronomètre ou l’historique : ${reason.message}`
        : 'Impossible de lire le chronomètre ou l’historique.');
    }).finally(() => {
      if (active) setTimerLoadedUserId(userId);
    });

    const entriesQuery = query(
      collection(db, 'timeEntries'),
      where('userId', '==', userId)
    );
    const unsubscribe = onSnapshot(
      entriesQuery,
      { includeMetadataChanges: true },
      (snapshot) => {
        if (!snapshot.metadata.fromCache) receivedServerSnapshot = true;
        const remoteEntries = snapshot.docs.map((entry) => ({
          ...(entry.data() as Omit<TimeEntry, 'id'>),
          id: entry.id,
        }));
        void Promise.all([
          saveCachedDocuments(userId, 'timeEntries', remoteEntries),
          getPendingWrites(userId, 'timeEntries'),
        ]).then(([, pendingWrites]) => {
          if (!active) return;
          setEntries(sortEntries(applyPendingWrites(remoteEntries, pendingWrites)));
          setLoadedUserId(userId);
          setError(null);
        }).catch((reason: unknown) => {
          if (active) setError(reason instanceof Error
            ? `Impossible d’enregistrer l’historique localement : ${reason.message}`
            : 'Impossible d’enregistrer l’historique localement.');
        });
        reportFirestoreConnectivity(userId, !snapshot.metadata.fromCache);
      },
      (reason) => {
        reportFirestoreConnectivity(userId, false);
        if (active) {
          setError(reason instanceof FirebaseError && reason.code === 'permission-denied'
            ? 'L’accès à ton historique de temps est refusé.'
            : 'Impossible de synchroniser ton historique de temps pour le moment.');
        }
      }
    );

    return () => {
      active = false;
      unsubscribe();
    };
  }, [userId]);

  const startTimer = async ({
    category,
    project,
    taskId,
    taskTitle,
  }: {
    category: TimeCategory;
    project: string;
    taskId: string | null;
    taskTitle: string | null;
  }) => {
    if (!userId) throw new Error('Connecte-toi pour enregistrer ton temps.');
    if (activeSession || isStarting) throw new Error('Un chronomètre est déjà en cours.');
    setIsStarting(true);
    const session: ActiveTimeSession = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      category,
      project: project.trim().slice(0, 100),
      taskId,
      taskTitle,
      startedAtMs: Date.now(),
    };
    try {
      await AsyncStorage.setItem(activeSessionKey(userId), JSON.stringify(session));
      setActiveSession(session);
      setNow(Date.now());
      setError(null);
    } finally {
      setIsStarting(false);
    }
  };

  const stopTimer = async () => {
    if (!userId || !db) throw new Error('Connecte-toi pour enregistrer ton temps.');
    if (!activeSession || isStopping) throw new Error('Aucun chronomètre en cours.');
    setIsStopping(true);
    const endedAtMs = Date.now();
    const currentPauseSeconds = activeSession.pausedAtMs
      ? Math.floor((endedAtMs - activeSession.pausedAtMs) / 1000)
      : 0;
    const durationSeconds = Math.floor(
      (endedAtMs - activeSession.startedAtMs) / 1000
      - (activeSession.pausedSeconds ?? 0)
      - currentPauseSeconds
    );
    if (durationSeconds < 1) {
      setIsStopping(false);
      throw new Error('Laisse au moins une seconde au chronomètre pour enregistrer la session.');
    }

    const entryId = activeSession.id;
    const entry: TimeEntry = {
      id: entryId,
      category: activeSession.category,
      project: activeSession.project,
      taskId: activeSession.taskId,
      taskTitle: activeSession.taskTitle,
      startedAt: Timestamp.fromMillis(activeSession.startedAtMs),
      endedAt: Timestamp.fromMillis(endedAtMs),
      durationSeconds,
      userId,
    };

    try {
      await queueOfflineWrite({
        collectionKey: 'timeEntries',
        documentId: entryId,
        path: `timeEntries/${entryId}`,
        kind: 'set',
        data: {
          category: entry.category,
          project: entry.project,
          taskId: entry.taskId,
          taskTitle: entry.taskTitle,
          startedAt: entry.startedAt,
          endedAt: entry.endedAt,
          durationSeconds: entry.durationSeconds,
          userId: entry.userId,
        },
      }, userId);
      await AsyncStorage.removeItem(activeSessionKey(userId));
      setEntries((currentEntries) => sortEntries([...currentEntries, entry]));
      setActiveSession(null);
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error
        ? `La session n’a pas pu être enregistrée : ${reason.message}`
        : 'La session n’a pas pu être enregistrée.');
      throw reason;
    } finally {
      setIsStopping(false);
    }
  };

  const pauseTimer = async () => {
    if (!userId || !activeSession || activeSession.pausedAtMs) return;
    const pausedSession = { ...activeSession, pausedAtMs: Date.now() };
    await AsyncStorage.setItem(activeSessionKey(userId), JSON.stringify(pausedSession));
    setActiveSession(pausedSession);
  };

  const resumeTimer = async () => {
    if (!userId || !activeSession?.pausedAtMs) return;
    const resumedSession = {
      ...activeSession,
      pausedAtMs: null,
      pausedSeconds: (activeSession.pausedSeconds ?? 0)
        + Math.floor((Date.now() - activeSession.pausedAtMs) / 1000),
    };
    await AsyncStorage.setItem(activeSessionKey(userId), JSON.stringify(resumedSession));
    setActiveSession(resumedSession);
  };

  const addManualEntry = async ({
    category,
    project,
    durationSeconds,
  }: {
    category: TimeCategory;
    project: string;
    durationSeconds: number;
  }) => {
    if (!userId || !db) throw new Error('Connecte-toi pour enregistrer ton temps.');
    if (!Number.isInteger(durationSeconds) || durationSeconds < 60 || durationSeconds > 86400) {
      throw new Error('La durée doit être comprise entre 1 minute et 24 heures.');
    }

    const endedAtMs = Date.now();
    const entryId = `manual-${endedAtMs}-${Math.random().toString(36).slice(2, 8)}`;
    const entry: TimeEntry = {
      id: entryId,
      category,
      project: project.trim().slice(0, 100),
      taskId: null,
      taskTitle: null,
      startedAt: Timestamp.fromMillis(endedAtMs - durationSeconds * 1000),
      endedAt: Timestamp.fromMillis(endedAtMs),
      durationSeconds,
      userId,
    };

    await queueOfflineWrite({
      collectionKey: 'timeEntries',
      documentId: entryId,
      path: `timeEntries/${entryId}`,
      kind: 'set',
      data: {
        category: entry.category,
        project: entry.project,
        taskId: entry.taskId,
        taskTitle: entry.taskTitle,
        startedAt: entry.startedAt,
        endedAt: entry.endedAt,
        durationSeconds: entry.durationSeconds,
        userId: entry.userId,
      },
    }, userId);
    setEntries((currentEntries) => sortEntries([...currentEntries, entry]));
  };

  return {
    entries: userId && loadedUserId === userId ? entries : [],
    activeSession: userId && timerLoadedUserId === userId ? activeSession : null,
    timerLoaded: !userId || timerLoadedUserId === userId,
    elapsedSeconds: activeSession
      ? Math.max(0, Math.floor(
        ((activeSession.pausedAtMs ?? now) - activeSession.startedAtMs) / 1000
        - (activeSession.pausedSeconds ?? 0)
      ))
      : 0,
    isPaused: Boolean(activeSession?.pausedAtMs),
    loading,
    error,
    isStarting,
    isStopping,
    startTimer,
    pauseTimer,
    resumeTimer,
    stopTimer,
    addManualEntry,
  };
}
