import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { auth } from '@/services/firebase';
import {
  getOfflineSyncStatus,
  initializeOfflineSync,
  subscribeOfflineStore,
  type OfflineSyncStatus,
} from '@/services/offlineStore';
import { useAppTheme } from '@/theme/ThemeProvider';

const defaultStatus: OfflineSyncStatus = {
  isOnline: null,
  pendingWrites: 0,
  error: null,
};

export function OfflineSyncProvider({ children }: React.PropsWithChildren) {
  const { colors } = useAppTheme();
  const [userId, setUserId] = useState(auth?.currentUser?.uid ?? null);

  useEffect(() => {
    if (!auth) return;
    return onAuthStateChanged(auth, (user) => {
      setUserId(user?.uid ?? null);
    });
  }, []);

  useEffect(() => {
    if (userId) void initializeOfflineSync(userId);
  }, [userId]);

  const status = useSyncExternalStore(
    (onStoreChange) => userId
      ? subscribeOfflineStore((changedUserId) => {
        if (changedUserId === userId) onStoreChange();
      })
      : () => {},
    () => userId ? getOfflineSyncStatus(userId) : defaultStatus,
    () => defaultStatus
  );

  const message = status.error;

  return (
    <View style={styles.container}>
      <View style={styles.content}>{children}</View>
      {message ? (
        <SafeAreaView edges={['bottom']} style={[styles.banner, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.message, { color: status.error ? colors.error : colors.textSecondary }]}>
            {message}
          </Text>
        </SafeAreaView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  banner: {
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  message: {
    fontSize: 11,
    textAlign: 'center',
  },
});
