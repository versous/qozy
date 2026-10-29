import { FirebaseError } from 'firebase/app';
import {
  collection,
  doc,
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

export type TaskPriority = 'urgent' | 'important' | 'normal';

export interface TodoTask {
  id: string;
  title: string;
  description: string;
  priority: TaskPriority;
  dueDate: string | null;
  completed: boolean;
  userId: string;
  createdAt: Timestamp;
}

type TaskInput = Pick<TodoTask, 'title' | 'description' | 'priority' | 'dueDate'>;

export function useTasks() {
  const [tasks, setTasks] = useState<TodoTask[]>([]);
  const [loadedUserId, setLoadedUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const userId = auth?.currentUser?.uid;
  const loading = Boolean(userId && db && loadedUserId !== userId && !error);

  useEffect(() => {
    if (!userId || !db) return;

    let active = true;
    let receivedServerSnapshot = false;
    const hydrateCache = async () => {
      const [cachedTasks, pendingWrites] = await Promise.all([
        getCachedDocuments<TodoTask>(userId, 'tasks'),
        getPendingWrites(userId, 'tasks'),
      ]);
      if (!active || receivedServerSnapshot) return;
      setTasks(sortTasks(applyPendingWrites(cachedTasks, pendingWrites)));
      setLoadedUserId(userId);
    };

    void hydrateCache().catch((reason: unknown) => {
      if (active) {
        setError(reason instanceof Error
          ? `Impossible de lire les tâches enregistrées sur cet appareil : ${reason.message}`
          : 'Impossible de lire les tâches enregistrées sur cet appareil.');
      }
    });

    const tasksQuery = query(collection(db, 'tasks'), where('userId', '==', userId));
    const unsubscribe = onSnapshot(
      tasksQuery,
      { includeMetadataChanges: true },
      (snapshot) => {
        if (!snapshot.metadata.fromCache) receivedServerSnapshot = true;
        const remoteTasks = snapshot.docs.map((task) => ({
          ...task.data(),
          id: task.id,
        })) as TodoTask[];
        void Promise.all([
          saveCachedDocuments(userId, 'tasks', remoteTasks),
          getPendingWrites(userId, 'tasks'),
        ]).then(([, pendingWrites]) => {
          if (!active) return;
          setTasks(sortTasks(applyPendingWrites(remoteTasks, pendingWrites)));
          setLoadedUserId(userId);
          setError(null);
        }).catch((reason: unknown) => {
          if (active) {
            setError(reason instanceof Error
              ? `Impossible d’enregistrer les tâches localement : ${reason.message}`
              : 'Impossible d’enregistrer les tâches localement.');
          }
        });
        reportFirestoreConnectivity(userId, !snapshot.metadata.fromCache);
      },
      (reason) => {
        reportFirestoreConnectivity(userId, false);
        if (reason instanceof FirebaseError && reason.code === 'permission-denied') {
          setError('Accès aux tâches refusé. Vérifie ta connexion puis réessaie.');
          return;
        }
        setError('Impossible de charger les tâches. Vérifie ta connexion puis réessaie.');
      }
    );
    return () => {
      active = false;
      unsubscribe();
    };
  }, [userId]);

  const saveTask = async (input: TaskInput, taskId?: string) => {
    if (!db || !userId) throw new Error('Connectez-vous pour enregistrer une tâche.');
    const title = input.title.trim();
    if (!title) throw new Error('Le titre de la tâche ne peut pas être vide.');

    const taskData = {
      title,
      description: input.description.trim(),
      priority: input.priority,
      dueDate: input.dueDate,
      userId,
    };

    const documentId = taskId ?? doc(collection(db, 'tasks')).id;
    if (taskId && !tasks.some((task) => task.id === taskId)) {
      throw new Error('Cette tâche est introuvable sur cet appareil.');
    }
    const write = await queueOfflineWrite({
      collectionKey: 'tasks',
      documentId,
      path: `tasks/${documentId}`,
      kind: taskId ? 'update' : 'set',
      data: taskId
        ? taskData
        : { ...taskData, completed: false, createdAt: Timestamp.now() },
    }, userId);

    setTasks((currentTasks) => sortTasks(applyPendingWrites(
      currentTasks,
      [write]
    )));
  };

  const toggleTask = async (task: TodoTask) => {
    if (!db || !userId) throw new Error('Connectez-vous pour modifier une tâche.');
    if (!tasks.some((currentTask) => currentTask.id === task.id)) {
      throw new Error('Cette tâche est introuvable sur cet appareil.');
    }
    const write = await queueOfflineWrite({
      collectionKey: 'tasks',
      documentId: task.id,
      path: `tasks/${task.id}`,
      kind: 'update',
      data: { completed: !task.completed },
    }, userId);
    setTasks((currentTasks) => sortTasks(applyPendingWrites(currentTasks, [write])));
  };

  const deleteTask = async (taskId: string) => {
    if (!db || !userId) throw new Error('Connectez-vous pour supprimer une tâche.');
    const write = await queueOfflineWrite({
      collectionKey: 'tasks',
      documentId: taskId,
      path: `tasks/${taskId}`,
      kind: 'delete',
    }, userId);
    setTasks((currentTasks) => applyPendingWrites(currentTasks, [write]));
  };

  return {
    tasks: userId && loadedUserId === userId ? tasks : [],
    loading,
    error,
    saveTask,
    toggleTask,
    deleteTask,
  };
}

function sortTasks(tasks: TodoTask[]) {
  return [...tasks].sort((first, second) => {
    if (first.completed !== second.completed) return first.completed ? 1 : -1;
    if (first.dueDate && second.dueDate) return first.dueDate.localeCompare(second.dueDate);
    if (first.dueDate) return -1;
    if (second.dueDate) return 1;
    return second.createdAt.toMillis() - first.createdAt.toMillis();
  });
}
