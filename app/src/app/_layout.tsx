import React, { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { onAuthStateChanged } from 'firebase/auth';
import { Platform } from 'react-native';
import * as ScreenOrientation from 'expo-screen-orientation';
import { auth } from '@/services/firebase';
import { OfflineSyncProvider } from '@/services/OfflineSyncProvider';
import { ThemeProvider } from '@/theme/ThemeProvider';

export default function RootLayout() {
  const segments = useSegments();
  const router = useRouter();
  const isFocusScreen = segments.join('/') === '(main)/focus';
  const [initialized, setInitialized] = useState(auth === null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    if (Platform.OS === 'web') return;

    let isCurrent = true;
    const orientation = isFocusScreen
      ? ScreenOrientation.OrientationLock.LANDSCAPE
      : ScreenOrientation.OrientationLock.PORTRAIT_UP;

    void ScreenOrientation.lockAsync(orientation).catch((error: unknown) => {
      if (isCurrent) {
        console.warn('Impossible de modifier l’orientation de l’écran.', error);
      }
    });

    return () => {
      isCurrent = false;
    };
  }, [isFocusScreen]);

  useEffect(() => {
    if (!auth) return;

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setIsAuthenticated(user !== null);
      setInitialized(true);
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!initialized) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!isAuthenticated && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (isAuthenticated && inAuthGroup) {
      router.replace('/');
    }
  }, [isAuthenticated, segments, initialized, router]);

  if (!initialized) {
    return null;
  }

  return (
    <ThemeProvider>
      <OfflineSyncProvider>
        <Stack screenOptions={{ headerShown: false }} />
      </OfflineSyncProvider>
    </ThemeProvider>
  );
}
