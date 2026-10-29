import AsyncStorage from '@react-native-async-storage/async-storage';
import { FirebaseError } from 'firebase/app';
import {
  getAuth,
  getReactNativePersistence,
  initializeAuth,
  type Auth,
} from 'firebase/auth';

import { app, db, isFirebaseConfigured } from './firebaseConfig';

export { db, isFirebaseConfigured };

const initializeNativeAuth = (): Auth | null => {
  if (!app) return null;

  try {
    return initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch (error) {
    if (error instanceof FirebaseError && error.code === 'auth/already-initialized') {
      return getAuth(app);
    }
    throw error;
  }
};

export const auth = initializeNativeAuth();
export default app;
