import { FirebaseError } from 'firebase/app';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { useEffect, useState } from 'react';

import { auth, db } from '@/services/firebase';

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

    const tasksQuery = query(collection(db, 'tasks'), where('userId', '==', userId));
    return onSnapshot(
      tasksQuery,
      (snapshot) => {
        const nextTasks = snapshot.docs.map((task) => ({
          ...task.data(),
          id: task.id,
        })) as TodoTask[];
        nextTasks.sort((first, second) => {
          if (first.completed !== second.completed) return first.completed ? 1 : -1;
          if (first.dueDate && second.dueDate) return first.dueDate.localeCompare(second.dueDate);
          if (first.dueDate) return -1;
          if (second.dueDate) return 1;
          return second.createdAt.toMillis() - first.createdAt.toMillis();
        });
        setTasks(nextTasks);
        setLoadedUserId(userId);
        setError(null);
      },
      (reason) => {
        if (reason instanceof FirebaseError && reason.code === 'permission-denied') {
          setError('Accès aux tâches refusé. Vérifie ta connexion puis réessaie.');
          return;
        }
        setError('Impossible de charger les tâches. Vérifie ta connexion puis réessaie.');
      }
    );
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

    if (taskId) {
      await updateDoc(doc(db, 'tasks', taskId), taskData);
    } else {
      await addDoc(collection(db, 'tasks'), {
        ...taskData,
        completed: false,
        createdAt: Timestamp.now(),
      });
    }
  };

  const toggleTask = async (task: TodoTask) => {
    if (!db || !userId) throw new Error('Connectez-vous pour modifier une tâche.');
    await updateDoc(doc(db, 'tasks', task.id), { completed: !task.completed });
  };

  const deleteTask = async (taskId: string) => {
    if (!db || !userId) throw new Error('Connectez-vous pour supprimer une tâche.');
    await deleteDoc(doc(db, 'tasks', taskId));
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
