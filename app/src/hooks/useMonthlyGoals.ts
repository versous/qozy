import { doc, onSnapshot, Timestamp } from 'firebase/firestore';
import { useCallback, useEffect, useState } from 'react';

import { auth, db } from '@/services/firebase';
import {
  applyPendingWrites,
  getCachedDocuments,
  getPendingWrites,
  queueOfflineWrite,
  reportFirestoreConnectivity,
  saveCachedDocuments,
} from '@/services/offlineStore';

export interface MonthlyGoals {
  id: string;
  habitTarget: number;
  taskTarget: number;
  updatedAt?: Timestamp;
}

export function useMonthlyGoals(monthKey: string) {
  const [goal, setGoal] = useState<MonthlyGoals | null>(null);
  const [error, setError] = useState<string | null>(null);
  const userId = auth?.currentUser?.uid;
  const queryKey = `${userId ?? 'guest'}:${monthKey}`;
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const loaded = !userId || !db || loadedKey === queryKey;

  useEffect(() => {
    if (!userId || !db) return;

    let active = true;
    let receivedServerSnapshot = false;
    const collectionKey = `monthlyGoals:${monthKey}`;

    void Promise.all([
      getCachedDocuments<MonthlyGoals>(userId, collectionKey),
      getPendingWrites(userId, collectionKey),
    ]).then(([cachedGoals, pendingWrites]) => {
      if (!active || receivedServerSnapshot) return;
      const [cachedGoal] = applyPendingWrites(cachedGoals, pendingWrites);
      setGoal(cachedGoal ?? null);
      setLoadedKey(queryKey);
    }).catch((reason: unknown) => {
      if (!active) return;
      setError(reason instanceof Error
        ? `Impossible de lire l’objectif enregistré : ${reason.message}`
        : 'Impossible de lire l’objectif enregistré.');
      setLoadedKey(queryKey);
    });

    const unsubscribe = onSnapshot(
      doc(db, 'users', userId, 'monthlyGoals', monthKey),
      { includeMetadataChanges: true },
      (snapshot) => {
        if (!snapshot.metadata.fromCache) receivedServerSnapshot = true;
        const remoteGoals: MonthlyGoals[] = snapshot.exists()
          ? [{ ...(snapshot.data() as Omit<MonthlyGoals, 'id'>), id: snapshot.id }]
          : [];

        void saveCachedDocuments(userId, collectionKey, remoteGoals)
          .then(async () => {
            const pendingWrites = await getPendingWrites(userId, collectionKey);
            if (!active) return;
            const [visibleGoal] = applyPendingWrites(remoteGoals, pendingWrites);
            setGoal(visibleGoal ?? null);
            setLoadedKey(queryKey);
            setError(null);
          })
          .catch((reason: unknown) => {
            if (!active) return;
            setError(reason instanceof Error
              ? `Impossible d’enregistrer l’objectif localement : ${reason.message}`
              : 'Impossible d’enregistrer l’objectif localement.');
          });
        reportFirestoreConnectivity(userId, !snapshot.metadata.fromCache);
      },
      (reason) => {
        if (!active) return;
        setError(reason.message);
        setLoadedKey(queryKey);
        reportFirestoreConnectivity(userId, false);
      }
    );

    return () => {
      active = false;
      unsubscribe();
    };
  }, [monthKey, queryKey, userId]);

  const saveGoal = useCallback(async (habitTarget: number, taskTarget: number) => {
    if (!db || !userId) throw new Error('Connecte-toi pour enregistrer tes objectifs.');
    if (!Number.isInteger(habitTarget) || habitTarget < 1 || habitTarget > 1000
      || !Number.isInteger(taskTarget) || taskTarget < 1 || taskTarget > 1000) {
      throw new Error('Les objectifs doivent être compris entre 1 et 1 000.');
    }

    const updatedAt = Timestamp.now();
    await queueOfflineWrite({
      collectionKey: `monthlyGoals:${monthKey}`,
      documentId: monthKey,
      path: `users/${userId}/monthlyGoals/${monthKey}`,
      kind: 'set',
      data: { habitTarget, taskTarget, updatedAt },
    }, userId);

    setGoal({
      id: monthKey,
      habitTarget,
      taskTarget,
      updatedAt,
    });
    setError(null);
  }, [monthKey, userId]);

  return { goal, loaded, error, saveGoal };
}
