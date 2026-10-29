import AsyncStorage from '@react-native-async-storage/async-storage';
import { FirebaseError } from 'firebase/app';
import {
  deleteDoc,
  doc,
  setDoc,
  Timestamp,
  updateDoc,
} from 'firebase/firestore';

import { db } from '@/services/firebase';

export type OfflineWriteKind = 'set' | 'update' | 'delete';

export interface OfflineWrite {
  id: string;
  userId: string;
  collectionKey: string;
  documentId: string;
  path: string;
  kind: OfflineWriteKind;
  data?: Record<string, unknown>;
  createdAt: number;
}

export interface OfflineDocument {
  id: string;
}

export interface OfflineSyncStatus {
  isOnline: boolean | null;
  pendingWrites: number;
  error: string | null;
}

const listeners = new Set<(userId: string) => void>();
const statuses = new Map<string, OfflineSyncStatus>();
const onlineUsers = new Set<string>();
let storageQueue: Promise<void> = Promise.resolve();
const runningSyncs = new Map<string, Promise<void>>();
const emptyStatus: OfflineSyncStatus = Object.freeze({
  isOnline: null,
  pendingWrites: 0,
  error: null,
});

const cacheKey = (userId: string, collectionKey: string) =>
  `qozy-cache:${userId}:${collectionKey}`;
const outboxKey = (userId: string) => `qozy-outbox:${userId}`;

const serializeValue = (value: unknown): unknown => {
  if (value instanceof Timestamp) return { __qozyTimestamp: value.toMillis() };
  if (Array.isArray(value)) return value.map(serializeValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [key, serializeValue(child)])
    );
  }
  return value;
};

const deserializeValue = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(deserializeValue);
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (typeof record.__qozyTimestamp === 'number') {
      return Timestamp.fromMillis(record.__qozyTimestamp);
    }
    return Object.fromEntries(
      Object.entries(record).map(([key, child]) => [key, deserializeValue(child)])
    );
  }
  return value;
};

const runStorageTask = <T,>(task: () => Promise<T>): Promise<T> => {
  const result = storageQueue.then(task, task);
  storageQueue = result.then(() => undefined, () => undefined);
  return result;
};

const readStoredValue = async <T,>(key: string, fallback: T): Promise<T> => {
  const value = await AsyncStorage.getItem(key);
  return value === null ? fallback : deserializeValue(JSON.parse(value)) as T;
};

const writeStoredValue = (key: string, value: unknown) =>
  AsyncStorage.setItem(key, JSON.stringify(serializeValue(value)));

const getStatus = (userId: string): OfflineSyncStatus =>
  statuses.get(userId) ?? emptyStatus;

const publish = (userId: string, status: OfflineSyncStatus) => {
  statuses.set(userId, status);
  listeners.forEach((listener) => listener(userId));
};

export const subscribeOfflineStore = (listener: (userId: string) => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const getOfflineSyncStatus = (userId: string) => getStatus(userId);

export const getCachedDocuments = <T extends OfflineDocument>(
  userId: string,
  collectionKey: string
) =>
  runStorageTask(() => readStoredValue<T[]>(cacheKey(userId, collectionKey), []));

export const saveCachedDocuments = <T extends OfflineDocument>(
  userId: string,
  collectionKey: string,
  documents: T[]
) =>
  runStorageTask(() => writeStoredValue(cacheKey(userId, collectionKey), documents));

export const getPendingWrites = (userId: string, collectionKey?: string) =>
  runStorageTask(async () => {
    const writes = await readStoredValue<OfflineWrite[]>(outboxKey(userId), []);
    return collectionKey
      ? writes.filter((write) => write.collectionKey === collectionKey)
      : writes;
  });

export const applyPendingWrites = <T extends OfflineDocument>(
  documents: T[],
  writes: OfflineWrite[]
): T[] => {
  let nextDocuments = [...documents];

  writes.forEach((write) => {
    const index = nextDocuments.findIndex((document) => document.id === write.documentId);
    if (write.kind === 'delete') {
      nextDocuments = nextDocuments.filter((document) => document.id !== write.documentId);
      return;
    }
    if (!write.data) return;
    if (write.kind === 'set') {
      const document = { ...write.data, id: write.documentId } as T;
      if (index < 0) nextDocuments.push(document);
      else nextDocuments[index] = document;
      return;
    }
    if (index >= 0) {
      nextDocuments[index] = { ...nextDocuments[index], ...write.data };
    }
  });

  return nextDocuments;
};

const updatePendingCount = async (userId: string) => {
  const writes = await getPendingWrites(userId);
  const current = getStatus(userId);
  publish(userId, { ...current, pendingWrites: writes.length });
};

export const initializeOfflineSync = async (userId: string) => {
  try {
    await updatePendingCount(userId);
    requestPendingSync(userId);
  } catch (error) {
    const current = getStatus(userId);
    publish(userId, {
      ...current,
      error: error instanceof Error
        ? `Impossible de lire les modifications en attente : ${error.message}`
        : 'Impossible de lire les modifications en attente.',
    });
  }
};

export const queueOfflineWrite = async (
  write: Omit<OfflineWrite, 'id' | 'createdAt' | 'userId'>,
  userId: string
) => {
  const queuedWrite: OfflineWrite = {
    ...write,
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    userId,
    createdAt: Date.now(),
  };

  await runStorageTask(async () => {
    const writes = await readStoredValue<OfflineWrite[]>(outboxKey(userId), []);
    writes.push(queuedWrite);
    await writeStoredValue(outboxKey(userId), writes);
  });
  await updatePendingCount(userId);
  requestPendingSync(userId);
  return queuedWrite;
};

const removePendingWrite = async (userId: string, writeId: string) => {
  await runStorageTask(async () => {
    const writes = await readStoredValue<OfflineWrite[]>(outboxKey(userId), []);
    await writeStoredValue(
      outboxKey(userId),
      writes.filter((write) => write.id !== writeId)
    );
  });
  await updatePendingCount(userId);
};

const applyWriteToFirestore = async (write: OfflineWrite) => {
  if (!db) throw new Error('Firebase n’est pas configuré.');
  const reference = doc(db, write.path);

  if (write.kind === 'delete') {
    await deleteDoc(reference);
  } else if (write.kind === 'set') {
    if (!write.data) throw new Error('Une écriture locale est incomplète.');
    await setDoc(reference, write.data);
  } else {
    if (!write.data) throw new Error('Une écriture locale est incomplète.');
    await updateDoc(reference, write.data);
  }
};

export const requestPendingSync = (userId: string) => {
  if (!onlineUsers.has(userId)) return;
  void flushPendingWrites(userId);
};

const flushPendingWrites = (userId: string) => {
  const running = runningSyncs.get(userId);
  if (running) return running;

  const task = (async () => {
    let syncFailed = false;
    try {
      while (onlineUsers.has(userId)) {
        const [write] = await getPendingWrites(userId);
        if (!write) break;
        try {
          await applyWriteToFirestore(write);
        } catch (error) {
          const current = getStatus(userId);
          publish(userId, {
            ...current,
            error: error instanceof FirebaseError && error.code === 'permission-denied'
              ? 'Une modification hors ligne a été refusée par les règles de sécurité.'
              : 'La synchronisation a échoué. Les modifications restent enregistrées sur cet appareil.',
          });
          syncFailed = true;
          break;
        }
        await removePendingWrite(userId, write.id);
      }

    } catch (error) {
      const current = getStatus(userId);
      publish(userId, {
        ...current,
        error: error instanceof Error
          ? `La synchronisation a échoué : ${error.message}`
          : 'La synchronisation a échoué. Les modifications restent enregistrées sur cet appareil.',
      });
      syncFailed = true;
    } finally {
      runningSyncs.delete(userId);
    }

    const current = getStatus(userId);
    if (!syncFailed && current.pendingWrites === 0) {
      publish(userId, { ...current, error: null });
    }
  })();

  runningSyncs.set(userId, task);
  return task;
};

export const reportFirestoreConnectivity = (userId: string, isOnline: boolean) => {
  const current = getStatus(userId);
  if (!isOnline) {
    onlineUsers.delete(userId);
    publish(userId, { ...current, isOnline: false });
    return;
  }
  onlineUsers.add(userId);
  publish(userId, { ...current, isOnline: true });
  requestPendingSync(userId);
};
