import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import {
  ActivityIndicator,
  AppState,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Linking from 'expo-linking';
import { getPermissionsAsync } from 'expo-notifications/build/NotificationPermissions';
import type { NotificationPermissionsStatus } from 'expo-notifications/build/NotificationPermissions.types';

import { BottomNavigation } from '@/components/BottomNavigation';
import { BrandHeader } from '@/components/BrandHeader';
import { getLocalOfflineData, getKeepOfflineCopy, getOfflineSyncStatus, setKeepOfflineCopy, subscribeOfflineStore, type OfflineSyncStatus } from '@/services/offlineStore';
import { borderRadius, spacing, type AppColors } from '@/theme/colors';
import { useAppTheme, type TextSize, type ThemeMode } from '@/theme/ThemeProvider';
import { typography } from '@/theme/typography';
import { auth } from '@/services/firebase';

const defaultSyncStatus: OfflineSyncStatus = { isOnline: null, pendingWrites: 0, error: null };
const themeModes: { value: ThemeMode; label: string }[] = [
  { value: 'light', label: 'Clair' },
  { value: 'dark', label: 'Sombre' },
  { value: 'system', label: 'Système' },
];
const textSizes: { value: TextSize; label: string }[] = [
  { value: 'standard', label: 'Standard' },
  { value: 'large', label: 'Grande' },
  { value: 'largest', label: 'Très grande' },
];
export default function SettingsScreen() {
  const {
    colors,
    mode,
    textSize,
    highContrast,
    reduceMotion,
    setMode,
    setTextSize,
    setHighContrast,
    setReduceMotion,
  } = useAppTheme();
  const styles = createStyles(colors);
  const user = auth?.currentUser;
  const [permission, setPermission] = useState<NotificationPermissionsStatus | null>(null);
  const [keepOffline, setKeepOffline] = useState(true);
  const [loadingPreferences, setLoadingPreferences] = useState(true);
  const [localDataVisible, setLocalDataVisible] = useState(false);
  const [localData, setLocalData] = useState<{ cachedCollections: Record<string, { id: string }[]>; pendingWrites: unknown[] } | null>(null);
  const [loadingLocalData, setLoadingLocalData] = useState(false);
  const [savingOffline, setSavingOffline] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const syncStatus = useSyncExternalStore(
    (onStoreChange) => user
      ? subscribeOfflineStore((changedUserId) => {
        if (changedUserId === user.uid) onStoreChange();
      })
      : () => {},
    () => user ? getOfflineSyncStatus(user.uid) : defaultSyncStatus,
    () => defaultSyncStatus
  );

  const refreshPermission = useCallback(async () => {
    if (Platform.OS === 'web') {
      setPermission(null);
      return;
    }
    setPermission(await getPermissionsAsync());
  }, []);

  useEffect(() => {
    let active = true;
    if (Platform.OS !== 'web') {
      void getPermissionsAsync().then((status) => {
        if (active) setPermission(status);
      }).catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : 'Le statut des notifications n’a pas pu être vérifié.');
      });
    }
    void (user ? getKeepOfflineCopy(user.uid) : Promise.resolve(true)).then((keep) => {
      if (active) setKeepOffline(keep);
    }).catch((reason: unknown) => {
      if (active) setError(reason instanceof Error ? reason.message : 'Les paramètres n’ont pas pu être chargés.');
    }).finally(() => {
      if (active) setLoadingPreferences(false);
    });
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      void refreshPermission().catch((reason: unknown) => {
        setError(reason instanceof Error ? reason.message : 'Le statut des notifications n’a pas pu être vérifié.');
      });
    });
    return () => {
      active = false;
      subscription.remove();
    };
  }, [refreshPermission, user]);

  const handleKeepOfflineChange = async (enabled: boolean) => {
    if (!user) return;
    setSavingOffline(true);
    setError('');
    setNotice('');
    try {
      await setKeepOfflineCopy(user.uid, enabled);
      setKeepOffline(enabled);
      if (!enabled) setNotice('La copie locale synchronisée a été supprimée. Les modifications en attente restent conservées.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Le réglage hors ligne n’a pas pu être enregistré.');
    } finally {
      setSavingOffline(false);
    }
  };

  const openLocalData = async () => {
    if (!user) return;
    setLocalDataVisible(true);
    setLoadingLocalData(true);
    setError('');
    try {
      setLocalData(await getLocalOfflineData(user.uid));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Les données locales n’ont pas pu être lues.');
    } finally {
      setLoadingLocalData(false);
    }
  };

  const exportLocalData = async () => {
    if (!localData) return;
    setExporting(true);
    setError('');
    try {
      const contents = JSON.stringify({
        exportedAt: new Date().toISOString(),
        account: user?.email ?? null,
        ...localData,
      }, null, 2);
      const filename = `qozy-donnees-locales-${new Date().toISOString().slice(0, 10)}.json`;
      if (Platform.OS === 'web') {
        if (typeof document === 'undefined' || typeof URL.createObjectURL !== 'function') {
          throw new Error('Le téléchargement n’est pas disponible dans ce navigateur.');
        }
        const url = URL.createObjectURL(new Blob([contents], { type: 'application/json' }));
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
      } else {
        const file = new File(Paths.cache, filename);
        file.create({ overwrite: true });
        file.write(contents);
        if (!await Sharing.isAvailableAsync()) {
          throw new Error('Le partage de fichiers n’est pas disponible sur cet appareil.');
        }
        await Sharing.shareAsync(file.uri, { mimeType: 'application/json', dialogTitle: 'Exporter mes données locales' });
      }
      setNotice('Export de tes données locales préparé.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'L’export des données a échoué.');
    } finally {
      setExporting(false);
    }
  };

  const openDeviceSettings = async () => {
    if (Platform.OS === 'web') {
      router.push('/reminders');
      return;
    }
    try {
      await Linking.openSettings();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Les réglages de l’appareil n’ont pas pu être ouverts.');
    }
  };

  const cachedCount = localData
    ? Object.values(localData.cachedCollections).reduce((total, documents) => total + documents.length, 0)
    : 0;
  const notificationsLabel = Platform.OS === 'web'
    ? 'Notifications disponibles dans l’application mobile'
    : permission?.granted
      ? 'Autorisation accordée'
      : permission?.canAskAgain
        ? 'Autorisation non accordée'
        : 'Autorisation à modifier dans les réglages';
  const syncTitle = syncStatus.error
    ? 'Synchronisation à vérifier'
    : syncStatus.isOnline === false
      ? 'Hors ligne · copie sur cet appareil'
      : syncStatus.pendingWrites > 0
        ? 'Synchronisation en cours'
        : 'Synchronisé · prêt à continuer';
  const syncDescription = syncStatus.error
    ?? (syncStatus.pendingWrites > 0
      ? `${syncStatus.pendingWrites} modification${syncStatus.pendingWrites === 1 ? '' : 's'} en attente de synchronisation.`
      : syncStatus.isOnline === false
        ? 'Les modifications seront envoyées au retour du réseau.'
        : 'Tes données enregistrées sont à jour sur cet appareil.');

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <BrandHeader />
        <Pressable onPress={() => router.back()} hitSlop={8} style={styles.backLink}>
          <Text style={styles.backLinkText}>‹  Mon compte</Text>
        </Pressable>
        <Text style={styles.title}>Un Nid qui me ressemble</Text>
        <Text style={styles.subtitle}>Le confort se règle à ta façon.</Text>

        <Text style={styles.sectionTitle}>Apparence</Text>
        <View style={styles.segment}>
          {themeModes.map((item) => (
            <Pressable
              key={item.value}
              accessibilityRole="radio"
              accessibilityState={{ selected: mode === item.value }}
              onPress={() => setMode(item.value)}
              style={[styles.segmentOption, mode === item.value && styles.segmentOptionSelected]}>
              <Text style={[styles.segmentText, mode === item.value && styles.segmentTextSelected]}>{item.label}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.hint}>Système suit le thème de ton appareil.</Text>

        <Text style={styles.sectionTitle}>Lecture et confort</Text>
        <View style={styles.card}>
          <Text style={styles.fieldLabel}>Taille du texte</Text>
          <View style={styles.segment}>
            {textSizes.map((item) => (
              <Pressable
                key={item.value}
                accessibilityRole="radio"
                accessibilityState={{ selected: textSize === item.value }}
                onPress={() => setTextSize(item.value)}
                style={[styles.segmentOption, textSize === item.value && styles.segmentOptionSelected]}>
                <Text style={[styles.segmentText, textSize === item.value && styles.segmentTextSelected]}>{item.label}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={[styles.previewTitle, { fontSize: textSize === 'standard' ? 16 : textSize === 'large' ? 19 : 22 }]}>Une chose à la fois.</Text>
          <Text style={[styles.previewBody, { fontSize: textSize === 'standard' ? 11 : textSize === 'large' ? 13 : 15 }]}>Un aperçu pour lire sans effort.</Text>
        </View>
        <View style={[styles.card, styles.cardSpaced]}>
          <PreferenceSwitch
            title="Contraste renforcé"
            subtitle="Textes et repères plus marqués"
            value={highContrast}
            onChange={setHighContrast}
            colors={colors}
            styles={styles}
          />
          <PreferenceSwitch
            title="Réduire les animations"
            subtitle="Transitions et mouvements apaisés"
            value={reduceMotion}
            onChange={setReduceMotion}
            colors={colors}
            styles={styles}
          />
        </View>

        <Text style={styles.sectionTitle}>Notifications</Text>
        <View style={styles.card}>
          <Text style={styles.fieldLabel}>Autoriser les rappels dans Nid</Text>
          <Text style={styles.hint}>Préférence enregistrée · {notificationsLabel}</Text>
          <Pressable onPress={() => router.push('/reminders')} style={styles.inlineLink}>
            <Text style={styles.inlineLinkText}>Gérer mes rappels →</Text>
          </Pressable>
          {permission?.granted === false ? (
            <Pressable onPress={() => void openDeviceSettings()} style={styles.inlineLink}>
              <Text style={styles.inlineLinkText}>Gérer l’autorisation de l’appareil →</Text>
            </Pressable>
          ) : null}
          {Platform.OS === 'web' ? (
            <Pressable onPress={() => router.push('/reminders')} style={styles.inlineLink}>
              <Text style={styles.inlineLinkText}>Gérer mes rappels →</Text>
            </Pressable>
          ) : null}
        </View>

        <Text style={styles.sectionTitle}>Données et synchronisation</Text>
        <View style={styles.syncCard}>
          <View style={styles.syncIcon}><Text style={styles.syncIconText}>⌁</Text></View>
          <View style={styles.switchCopy}>
            <Text style={styles.fieldLabel}>{syncTitle}</Text>
            <Text style={styles.hint}>{syncDescription}</Text>
          </View>
        </View>
        <View style={[styles.card, styles.cardSpaced]}>
          <PreferenceSwitch
            title="Conserver une copie hors ligne"
            subtitle="Tâches, habitudes et journaux locaux"
            value={keepOffline}
            onChange={(value) => void handleKeepOfflineChange(value)}
            disabled={loadingPreferences || savingOffline || !user}
            colors={colors}
            styles={styles}
          />
          {savingOffline ? <ActivityIndicator color={colors.sage} style={styles.loader} /> : null}
          <Text style={styles.hint}>Les modifications en attente restent conservées même si tu désactives la copie hors ligne.</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={() => void openLocalData()}
          style={({ pressed }) => [styles.localDataRow, pressed && styles.pressed]}>
          <View style={styles.localDataIcon}><Text style={styles.localDataIconText}>▤</Text></View>
          <View style={styles.switchCopy}>
            <Text style={styles.fieldLabel}>Mes données locales</Text>
            <Text style={styles.hint}>Consulter ou exporter mes données</Text>
          </View>
          <Text style={styles.arrow}>›</Text>
        </Pressable>
        <Text style={styles.footer}>Navigation avec libellés, cibles tactiles confortables et commandes qui ne reposent pas uniquement sur la couleur.</Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {notice ? <Text style={styles.notice}>{notice}</Text> : null}
      </ScrollView>
      <BottomNavigation active="account" />
      <Modal
        visible={localDataVisible}
        transparent
        animationType={reduceMotion ? 'none' : 'fade'}
        onRequestClose={() => setLocalDataVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Mes données locales</Text>
            {loadingLocalData ? (
              <ActivityIndicator color={colors.sage} style={styles.loader} />
            ) : localData ? (
              <>
                <Text style={styles.modalBody}>{cachedCount} élément{cachedCount === 1 ? '' : 's'} en copie locale · {localData.pendingWrites.length} modification{localData.pendingWrites.length === 1 ? '' : 's'} en attente.</Text>
                <Text style={styles.hint}>L’export contient les données mises en cache et les modifications locales en attente pour ce compte.</Text>
                <Pressable onPress={() => void exportLocalData()} disabled={exporting} style={styles.exportButton}>
                  <Text style={styles.exportButtonText}>{exporting ? 'Préparation…' : 'Exporter mes données'}</Text>
                </Pressable>
              </>
            ) : (
              <Text style={styles.modalBody}>Aucune donnée locale n’a pu être chargée.</Text>
            )}
            {error ? <Text style={styles.error}>{error}</Text> : null}
            {notice ? <Text style={styles.notice}>{notice}</Text> : null}
            <Pressable onPress={() => setLocalDataVisible(false)} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>Fermer</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function PreferenceSwitch({
  title,
  subtitle,
  value,
  onChange,
  disabled = false,
  colors,
  styles,
}: {
  title: string;
  subtitle: string;
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  colors: AppColors;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.switchRow}>
      <View style={styles.switchCopy}>
        <Text style={styles.fieldLabel}>{title}</Text>
        <Text style={styles.hint}>{subtitle}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        trackColor={{ false: colors.border, true: colors.sage }}
        thumbColor={colors.surface}
        accessibilityLabel={title}
      />
    </View>
  );
}

const createStyles = (palette: AppColors) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.background },
  content: { paddingHorizontal: spacing.md, paddingBottom: spacing.lg },
  backLink: { alignSelf: 'flex-start', marginBottom: spacing.sm },
  backLinkText: { color: palette.sage, fontSize: 10, fontWeight: '700' },
  title: { color: palette.textPrimary, fontSize: 22, lineHeight: 28, fontFamily: typography.fonts.display, fontWeight: '600' },
  subtitle: { color: palette.textSecondary, fontSize: 10, marginTop: 2, marginBottom: spacing.md },
  sectionTitle: { color: palette.textPrimary, fontSize: 16, fontFamily: typography.fonts.display, fontWeight: '600', marginTop: spacing.sm, marginBottom: spacing.xs },
  segment: { flexDirection: 'row', gap: 2, padding: 3, borderRadius: borderRadius.extraLarge, backgroundColor: palette.sageLight, marginTop: spacing.xs },
  segmentOption: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 34, paddingHorizontal: 3, borderRadius: borderRadius.extraLarge },
  segmentOptionSelected: { backgroundColor: palette.sage },
  segmentText: { color: palette.sage, fontSize: 8, fontWeight: '700', textAlign: 'center' },
  segmentTextSelected: { color: palette.surface },
  hint: { color: palette.textSecondary, fontSize: 8, lineHeight: 12, marginTop: 3 },
  card: { padding: spacing.sm, borderRadius: borderRadius.medium, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border },
  cardSpaced: { marginTop: spacing.xs },
  fieldLabel: { color: palette.textPrimary, fontSize: 9, lineHeight: 13, fontWeight: '700' },
  previewTitle: { color: palette.textPrimary, fontFamily: typography.fonts.display, fontWeight: '600', marginTop: spacing.sm },
  previewBody: { color: palette.textPrimary, marginTop: spacing.xs },
  switchRow: { minHeight: 45, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  switchCopy: { flex: 1 },
  syncCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, borderRadius: borderRadius.medium, backgroundColor: palette.sagePale },
  syncIcon: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center', borderRadius: 15, backgroundColor: palette.surface },
  syncIconText: { color: palette.sage, fontSize: 18 },
  inlineLink: { alignSelf: 'flex-start', paddingTop: spacing.xs },
  inlineLinkText: { color: palette.sage, fontSize: 9, fontWeight: '700' },
  loader: { padding: spacing.xs },
  localDataRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.sm, marginTop: spacing.sm, borderRadius: borderRadius.medium, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border },
  localDataIcon: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: palette.sagePale },
  localDataIconText: { color: palette.sage, fontSize: 15 },
  arrow: { color: palette.textSecondary, fontSize: 21 },
  footer: { color: palette.textSecondary, fontSize: 8, lineHeight: 12, marginTop: spacing.md },
  error: { color: palette.error, fontSize: 10, marginTop: spacing.sm },
  notice: { color: palette.sage, fontSize: 9, marginTop: spacing.sm },
  modalBackdrop: { flex: 1, justifyContent: 'center', padding: spacing.md, backgroundColor: 'rgba(0,0,0,0.42)' },
  modalCard: { padding: spacing.md, borderRadius: borderRadius.medium, backgroundColor: palette.surface },
  modalTitle: { color: palette.textPrimary, fontSize: 18, fontFamily: typography.fonts.display, fontWeight: '600' },
  modalBody: { color: palette.textPrimary, fontSize: 11, lineHeight: 17, marginTop: spacing.sm },
  exportButton: { alignItems: 'center', padding: spacing.sm, marginTop: spacing.md, borderRadius: borderRadius.extraLarge, backgroundColor: palette.sage },
  exportButtonText: { color: palette.surface, fontSize: 10, fontWeight: '700' },
  closeButton: { alignItems: 'center', padding: spacing.sm, marginTop: spacing.xs },
  closeButtonText: { color: palette.sage, fontSize: 10, fontWeight: '700' },
  pressed: { opacity: 0.75 },
});
