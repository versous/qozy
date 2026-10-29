import React, { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/services/firebase';

export default function RootLayout() {
  const segments = useSegments();
  const router = useRouter();
  const [initialized, setInitialized] = useState(auth === null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

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
    <Stack screenOptions={{ headerShown: false }} />
  );
}
