import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  collection,
  collectionGroup,
  getDocs,
  query,
  where,
  writeBatch,
  type Firestore,
  type DocumentReference,
} from 'firebase/firestore';
import type { User } from 'firebase/auth';

import { auth, db } from '@/services/firebase';
import { deleteScheduledReminder, loadContextualReminders } from '@/services/contextualReminders';
import { setKeepOfflineCopy } from '@/services/offlineStore';

async function deleteDocumentReferences(database: Firestore, references: DocumentReference[]) {
  for (let offset = 0; offset < references.length; offset += 450) {
    const batch = writeBatch(database);
    references.slice(offset, offset + 450).forEach((reference) => batch.delete(reference));
    await batch.commit();
  }
}

export async function deleteAccountData(user: User) {
  if (!db || !auth || auth.currentUser?.uid !== user.uid) {
    throw new Error('Connecte-toi au compte à supprimer avant de réessayer.');
  }

  const [habits, completions, exercises, tasks, timeEntries, hydration, moments, goals] = await Promise.all([
    getDocs(query(collection(db, 'habits'), where('userId', '==', user.uid))),
    getDocs(query(collectionGroup(db, 'completions'), where('userId', '==', user.uid))),
    getDocs(query(collection(db, 'exercises'), where('userId', '==', user.uid))),
    getDocs(query(collection(db, 'tasks'), where('userId', '==', user.uid))),
    getDocs(query(collection(db, 'timeEntries'), where('userId', '==', user.uid))),
    getDocs(collection(db, 'users', user.uid, 'hydration')),
    getDocs(collection(db, 'users', user.uid, 'smallMoments')),
    getDocs(collection(db, 'users', user.uid, 'monthlyGoals')),
  ]);
  const references = [
    ...completions.docs.map((snapshot) => snapshot.ref),
    ...habits.docs.map((snapshot) => snapshot.ref),
    ...exercises.docs.map((snapshot) => snapshot.ref),
    ...tasks.docs.map((snapshot) => snapshot.ref),
    ...timeEntries.docs.map((snapshot) => snapshot.ref),
    ...hydration.docs.map((snapshot) => snapshot.ref),
    ...moments.docs.map((snapshot) => snapshot.ref),
    ...goals.docs.map((snapshot) => snapshot.ref),
  ];
  await deleteDocumentReferences(db, references);

  let reminders = await loadContextualReminders();
  for (const reminder of [...reminders.schedules]) {
    if (reminder.id.startsWith('habit:') || reminder.id.startsWith('exercise:')) {
      reminders = await deleteScheduledReminder(reminders, reminder.id);
    }
  }

  const keys = await AsyncStorage.getAllKeys();
  const userKeys = keys.filter((key) =>
    key.includes(user.uid)
    || key === 'qozy-contextual-reminders'
  );
  if (userKeys.length) await AsyncStorage.multiRemove(userKeys);

  await setKeepOfflineCopy(user.uid, false);
  const remainingKeys = (await AsyncStorage.getAllKeys()).filter((key) =>
    key.includes(user.uid)
  );
  if (remainingKeys.length) await AsyncStorage.multiRemove(remainingKeys);
}
