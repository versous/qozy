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
export type TaskStatus = 'todo' | 'in_progress' | 'completed';

export interface TodoTask {
  id: string;
  title: string;
  description: string;
  category?: string;
  project?: string;
  priority: TaskPriority;
  status?: TaskStatus;
  dueDate: string | null;
  startTime?: string | null;
  durationMinutes?: number | null;
  completed: boolean;
  completedDate?: string | null;
  completedDates?: string[];
  userId: string;
  createdAt: Timestamp;
}

type TaskInput = Pick<TodoTask, 'title' | 'description' | 'priority' | 'dueDate'>
  & Partial<Pick<TodoTask, 'category' | 'project' | 'status' | 'startTime' | 'durationMinutes'>>;

function normalizeTask(task: TodoTask): TodoTask {
  const status: TaskStatus = task.status === 'todo' || task.status === 'in_progress' || task.status === 'completed'
    ? task.status
    : task.completed ? 'completed' : 'todo';
  return {
    ...task,
    status,
    completed: status === 'completed',
    completedDate: task.completedDate ?? null,
    completedDates: Array.isArray(task.completedDates) ? task.completedDates : [],
  };
}

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
      setTasks(sortTasks(applyPendingWrites(
        cachedTasks.map(normalizeTask),
        pendingWrites
      )));
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
        const remoteTasks = snapshot.docs.map((task) => normalizeTask({
          ...task.data(),
          id: task.id,
        } as TodoTask));
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
    if (input.startTime && !/^([01]\d|2[0-3]):[0-5]\d$/.test(input.startTime)) {
      throw new Error('Choisis une heure valide.');
    }

    const existingTask = taskId ? tasks.find((task) => task.id === taskId) : undefined;
    const status = input.status ?? existingTask?.status ?? (existingTask?.completed ? 'completed' : 'todo');
    const today = new Date();
    const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const completedDates = existingTask?.completedDates ?? [];
    const wasCompleted = existingTask?.status === 'completed' || existingTask?.completed === true;
    const completedDate = status === 'completed'
      ? existingTask?.completedDate ?? todayKey
      : null;
    const nextCompletedDates = status === 'completed'
      ? wasCompleted ? completedDates : [...new Set([...completedDates, todayKey])]
      : wasCompleted && existingTask?.completedDate
        ? completedDates.filter((date) => date !== existingTask.completedDate)
        : completedDates;
    const taskData = {
      title,
      description: input.description.trim(),
      category: input.category ?? existingTask?.category ?? 'Études',
      project: (input.project ?? existingTask?.project ?? '').trim(),
      priority: input.priority,
      status,
      completed: status === 'completed',
      completedDate,
      completedDates: nextCompletedDates,
      dueDate: input.dueDate,
      startTime: input.startTime ?? null,
      durationMinutes: input.startTime
        ? input.durationMinutes ?? existingTask?.durationMinutes ?? 60
        : null,
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
        : {
        ...taskData,
        createdAt: Timestamp.now(),
      },
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
    const today = new Date();
    const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const completedDates = task.completedDates ?? [];
    const nextCompletedDates = task.completed
      ? completedDates.filter((date) => date !== task.completedDate)
      : [...new Set([...completedDates, todayKey])];
    const write = await queueOfflineWrite({
      collectionKey: 'tasks',
      documentId: task.id,
      path: `tasks/${task.id}`,
      kind: 'update',
      data: {
        completed: !task.completed,
        status: task.completed ? 'todo' : 'completed',
        completedDate: task.completed ? null : todayKey,
        completedDates: nextCompletedDates,
      },
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

  const scheduleTask = async (taskId: string, dueDate: string, startTime: string) => {
    if (!db || !userId) throw new Error('Connecte-toi pour planifier un petit pas.');
    if (!/^\d{2}:\d{2}$/.test(startTime)) throw new Error('Choisis un horaire valide.');
    const [hours, minutes] = startTime.split(':').map(Number);
    if (hours < 8 || hours >= 20 || ![0, 30].includes(minutes)) {
      throw new Error('Le planning va de 8 h à 20 h, par pas de 30 minutes.');
    }

    const task = tasks.find((item) => item.id === taskId);
    if (!task) throw new Error('Ce petit pas est introuvable sur cet appareil.');
    const write = await queueOfflineWrite({
      collectionKey: 'tasks',
      documentId: taskId,
      path: `tasks/${taskId}`,
      kind: 'update',
      data: { dueDate, startTime, durationMinutes: task.durationMinutes ?? 60 },
    }, userId);
    setTasks((currentTasks) => sortTasks(applyPendingWrites(currentTasks, [write])));
  };

  const unscheduleTask = async (taskId: string) => {
    if (!db || !userId) throw new Error('Connecte-toi pour modifier ton planning.');
    const task = tasks.find((item) => item.id === taskId);
    if (!task) throw new Error('Ce petit pas est introuvable sur cet appareil.');
    const write = await queueOfflineWrite({
      collectionKey: 'tasks',
      documentId: taskId,
      path: `tasks/${taskId}`,
      kind: 'update',
      data: { startTime: null, durationMinutes: null },
    }, userId);
    setTasks((currentTasks) => sortTasks(applyPendingWrites(currentTasks, [write])));
  };

  return {
    tasks: userId && loadedUserId === userId ? tasks : [],
    loading,
    error,
    saveTask,
    toggleTask,
    deleteTask,
    scheduleTask,
    unscheduleTask,
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
