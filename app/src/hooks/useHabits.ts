import { useState, useEffect } from 'react';
import { db, auth } from '../services/firebase';
import {
  collection,
  addDoc,
  query,
  where,
  onSnapshot,
  updateDoc,
  doc,
  deleteDoc,
  Timestamp
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

export const useHabits = () => {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [loading, setLoading] = useState(true);

  const userId = auth.currentUser?.uid;

  useEffect(() => {
    if (!userId) return;

    const q = query(collection(db, 'habits'), where('userId', '==', userId));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const habitsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Habit[];

      setHabits(habitsData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [userId]);

  const addHabit = async (title: string, icon: string = '🌱') => {
    if (!userId) return;
    try {
      await addDoc(collection(db, 'habits'), {
        title,
        icon,
        streak: 0,
        isCompleted: false,
        userId,
        createdAt: Timestamp.now(),
      });
    } catch (error) {
      console.error("Erreur lors de l'ajout :", error);
    }
  };

  const toggleHabit = async (habitId: string, currentStatus: boolean) => {
    try {
      const habitRef = doc(db, 'habits', habitId);
      await updateDoc(habitRef, {
        isCompleted: !currentStatus,
        streak: !currentStatus ? (habits.find(h => h.id === habitId)?.streak || 0) + 1 : (habits.find(h => h.id === habitId)?.streak || 0) - 1
      });
    } catch (error) {
      console.error("Erreur lors du toggle :", error);
    }
  };

  const deleteHabit = async (habitId: string) => {
    try {
      await deleteDoc(doc(db, 'habits', habitId));
    } catch (error) {
      console.error("Erreur lors de la suppression :", error);
    }
  };

  return {
    habits,
    loading,
    addHabit,
    toggleHabit,
    deleteHabit,
  };
};
