import React, { useState, useSyncExternalStore } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, type Href } from 'expo-router';
import { signOut } from 'firebase/auth';

import { BottomNavigation } from '@/components/BottomNavigation';
import { BrandHeader } from '@/components/BrandHeader';
import { CosyButton } from '@/components/common/CosyButton';
import { useHabits } from '@/hooks/useHabits';
import { auth } from '@/services/firebase';
import { getOfflineSyncStatus, subscribeOfflineStore, type OfflineSyncStatus } from '@/services/offlineStore';
import { usePremium } from '@/services/PremiumProvider';
import { borderRadius, spacing, type AppColors } from '@/theme/colors';
import { useAppTheme } from '@/theme/ThemeProvider';
import { typography } from '@/theme/typography';

const defaultSyncStatus: OfflineSyncStatus = { isOnline: null, pendingWrites: 0, error: null };

export default function ProfileScreen() {
  const { colors, mode, toggleMode } = useAppTheme();
  const { isPremium, isPreview } = usePremium();
  const isDark = mode === 'dark';
  const styles = createStyles(colors);
  const { habits, loading, error } = useHabits();
  const [signOutError, setSignOutError] = useState('');
  const [isSigningOut, setIsSigningOut] = useState(false);
  const user = auth?.currentUser;
  const syncStatus = useSyncExternalStore(
    (onStoreChange) => user
      ? subscribeOfflineStore((changedUserId) => {
        if (changedUserId === user.uid) onStoreChange();
      })
      : () => {},
    () => user ? getOfflineSyncStatus(user.uid) : defaultSyncStatus,
    () => defaultSyncStatus
  );
  const name = user?.displayName?.trim() || 'Mon espace';
  const email = user?.email || 'Adresse e-mail indisponible';
  const initials = name === 'Mon espace'
    ? (user?.email?.charAt(0) || 'Q').toUpperCase()
    : name.split(/\s+/).slice(0, 2).map((part) => part.charAt(0)).join('').toUpperCase();
  const syncMessage = syncStatus.error
    ?? (syncStatus.isOnline === false
      ? `Hors ligne · ${syncStatus.pendingWrites} modification${syncStatus.pendingWrites === 1 ? '' : 's'} en attente`
      : syncStatus.pendingWrites > 0
        ? `${syncStatus.pendingWrites} modification${syncStatus.pendingWrites === 1 ? '' : 's'} en attente`
        : null);

  const handleSignOut = async () => {
    if (!auth) return;
    setSignOutError('');
    setIsSigningOut(true);
    try {
      await signOut(auth);
      router.replace('/(auth)/login');
    } catch {
      setSignOutError('La déconnexion n’a pas abouti. Réessaie.');
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <BrandHeader
          trailing={
            <View style={styles.headerAvatar}>
              <Text style={styles.headerAvatarText}>{initials}</Text>
            </View>
          }
        />

        <Text style={styles.eyebrow}>MON ESPACE</Text>
        <Text style={styles.title}>Mon petit espace</Text>
        <Text style={styles.intro}>Tout ce qui fait ton nid, {name === 'Mon espace' ? 'à ton rythme' : `${name.split(/\s+/)[0]}, à ton rythme`}.</Text>

        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <View style={styles.profileCopy}>
            <Text style={styles.name}>{name}</Text>
            <Text style={styles.email}>{email}</Text>
            <Text style={styles.accountNote}>Compte connecté · Tes données personnelles</Text>
          </View>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {syncMessage ? (
          <View style={[styles.statusCard, syncStatus.error && styles.statusCardError]}>
            <View style={styles.statusIcon}><Text style={styles.statusIconText}>⌁</Text></View>
            <View style={styles.statusCopy}>
              <Text style={styles.statusTitle}>
                {syncStatus.error ? 'Synchronisation interrompue' : 'Hors ligne · modifications en attente'}
              </Text>
              <Text style={styles.statusDescription}>{syncMessage}</Text>
            </View>
          </View>
        ) : null}
        {(syncStatus.pendingWrites > 0 || syncStatus.error) ? (
          <View style={styles.syncCard}>
            <View style={styles.syncIcon}><Text style={styles.syncIconText}>◷</Text></View>
            <View style={styles.statusCopy}>
              <Text style={styles.syncTitle}>Synchronisation en attente</Text>
              <Text style={styles.statusDescription}>
                {syncStatus.error ?? 'Tes données enregistrées localement seront envoyées dès que la connexion sera rétablie.'}
              </Text>
            </View>
          </View>
        ) : null}

        <View style={styles.sectionHeading}>
          <Text style={styles.sectionTitle}>À mon rythme</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/tasks')}
          style={({ pressed }) => [styles.menuRow, pressed && styles.pressed]}>
          <View style={[styles.menuIcon, styles.menuIconSage]}><Text style={styles.menuIconText}>◷</Text></View>
          <View style={styles.menuCopy}>
            <Text style={styles.menuTitle}>Mes habitudes</Text>
            <Text style={styles.menuSubtitle}>{loading ? 'Chargement…' : `${habits.length} habitude${habits.length === 1 ? '' : 's'} · Mes petits pas`}</Text>
          </View>
          <Text style={styles.menuArrow}>›</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/movement')}
          style={({ pressed }) => [styles.menuRow, pressed && styles.pressed]}>
          <View style={[styles.menuIcon, styles.menuIconSage]}><Text style={styles.menuIconText}>♧</Text></View>
          <View style={styles.menuCopy}>
            <Text style={styles.menuTitle}>Mes activités</Text>
            <Text style={styles.menuSubtitle}>Créer une activité personnalisée</Text>
          </View>
          <Text style={styles.menuArrow}>›</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/reminders' as Href)}
          style={({ pressed }) => [styles.menuRow, pressed && styles.pressed]}>
          <View style={[styles.menuIcon, styles.menuIconSage]}><Text style={styles.menuIconText}>♧</Text></View>
          <View style={styles.menuCopy}>
            <Text style={styles.menuTitle}>Mes rappels</Text>
            <Text style={styles.menuSubtitle}>Choisir une heure ou un lieu</Text>
          </View>
          <Text style={styles.menuArrow}>›</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/weekly-review' as Href)}
          style={({ pressed }) => [styles.menuRow, pressed && styles.pressed]}>
          <View style={[styles.menuIcon, styles.menuIconSage]}><Text style={styles.menuIconText}>▥</Text></View>
          <View style={styles.menuCopy}>
            <Text style={styles.menuTitle}>Mes bilans</Text>
            <Text style={styles.menuSubtitle}>Temps, tâches et bien-être</Text>
          </View>
          <Text style={styles.menuArrow}>›</Text>
        </Pressable>

        <View style={styles.sectionHeading}>
          <Text style={styles.sectionTitle}>Mon Nid</Text>
        </View>
        <Pressable
          accessibilityRole="switch"
          accessibilityState={{ checked: isDark }}
          onPress={toggleMode}
          style={({ pressed }) => [styles.menuRow, pressed && styles.pressed]}>
          <View style={[styles.menuIcon, styles.menuIconSage]}><Text style={styles.menuIconText}>⚙</Text></View>
          <View style={styles.menuCopy}>
            <Text style={styles.menuTitle}>Paramètres et accessibilité</Text>
            <Text style={styles.menuSubtitle}>Thème, lecture et données</Text>
          </View>
          <View style={[styles.themeSwitch, isDark && styles.themeSwitchActive]}>
            <Text style={[styles.themeSwitchText, isDark && styles.themeSwitchTextActive]}>{isDark ? 'Sombre' : 'Clair'}</Text>
          </View>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/music-library')}
          style={({ pressed }) => [styles.menuRow, pressed && styles.pressed]}>
          <View style={[styles.menuIcon, styles.menuIconSage]}><Text style={styles.menuIconText}>♫</Text></View>
          <View style={styles.menuCopy}>
            <Text style={styles.menuTitle}>Bibliothèque musicale</Text>
            <Text style={styles.menuSubtitle}>Des ambiances pour t’accompagner</Text>
          </View>
          <Text style={styles.menuArrow}>›</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/premium')}
          style={({ pressed }) => [styles.premiumButton, pressed && styles.pressed]}>
          <Text style={styles.premiumButtonIcon}>✳</Text>
          <Text style={styles.premiumButtonText}>
            {isPremium ? 'Mon espace Premium' : 'Découvrir Premium'}
          </Text>
          {isPreview ? <Text style={styles.previewLabel}>APERÇU</Text> : null}
        </Pressable>

        {signOutError ? <Text style={styles.error}>{signOutError}</Text> : null}
        <CosyButton
          title={isSigningOut ? 'Déconnexion…' : 'Se déconnecter'}
          variant="outline"
          onPress={() => void handleSignOut()}
          disabled={isSigningOut || !auth}
          style={styles.signOutButton}
        />
        <Text style={styles.footer}>Prends le temps qu’il te faut. 🌿</Text>
      </ScrollView>
      <BottomNavigation active="account" />
    </SafeAreaView>
  );
}

const createStyles = (palette: AppColors) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.background },
  content: { paddingHorizontal: spacing.md, paddingBottom: spacing.lg },
  headerAvatar: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center', borderRadius: 15, backgroundColor: palette.peach },
  headerAvatarText: { color: palette.clay, fontSize: 11, fontWeight: '700' },
  eyebrow: { color: palette.sage, fontSize: 9, letterSpacing: 0.8, fontWeight: '700' },
  title: { color: palette.textPrimary, fontSize: 23, lineHeight: 29, fontFamily: typography.fonts.display, fontWeight: '600', marginTop: 4 },
  intro: { color: palette.textSecondary, fontSize: 10, lineHeight: 15, marginTop: 2, marginBottom: spacing.md },
  profileCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, borderRadius: borderRadius.medium, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.peach },
  avatarText: { color: palette.clay, fontSize: 16, fontWeight: '700' },
  profileCopy: { flex: 1 },
  name: { color: palette.textPrimary, fontSize: 13, fontWeight: '700' },
  email: { color: palette.textSecondary, fontSize: 9, marginTop: 2 },
  accountNote: { color: palette.sage, fontSize: 8, marginTop: 4 },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.md, marginBottom: spacing.xs },
  sectionTitle: { color: palette.textPrimary, fontSize: 17, fontFamily: typography.fonts.display, fontWeight: '600' },
  error: { color: palette.error, fontSize: 11, marginTop: spacing.sm },
  statusCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, marginTop: spacing.sm, borderRadius: borderRadius.medium, backgroundColor: palette.peachLight, borderWidth: 1, borderColor: palette.peach },
  statusCardError: { borderColor: palette.error },
  statusIcon: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center', borderRadius: 15, backgroundColor: palette.surface },
  statusIconText: { color: palette.clay, fontSize: 18, fontWeight: '700' },
  statusCopy: { flex: 1 },
  statusTitle: { color: palette.textPrimary, fontSize: 10, fontWeight: '700' },
  statusDescription: { color: palette.textSecondary, fontSize: 8, lineHeight: 12, marginTop: 3 },
  syncCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, marginTop: spacing.xs, borderRadius: borderRadius.medium, backgroundColor: palette.sagePale },
  syncIcon: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center', borderRadius: 15, backgroundColor: palette.surface },
  syncIconText: { color: palette.sage, fontSize: 16 },
  syncTitle: { color: palette.textPrimary, fontSize: 10, fontWeight: '700' },
  menuRow: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.sm, marginBottom: spacing.xs, borderRadius: borderRadius.medium, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border },
  menuIcon: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 11 },
  menuIconSage: { backgroundColor: palette.sagePale },
  menuIconText: { color: palette.sage, fontSize: 16 },
  menuCopy: { flex: 1 },
  menuTitle: { color: palette.textPrimary, fontSize: 10, fontWeight: '600' },
  menuSubtitle: { color: palette.textSecondary, fontSize: 8, marginTop: 2 },
  menuArrow: { color: palette.sage, fontSize: 22 },
  themeSwitch: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: borderRadius.extraLarge, backgroundColor: palette.sagePale },
  themeSwitchActive: { backgroundColor: palette.sage },
  themeSwitchText: { color: palette.sage, fontSize: 8, fontWeight: '700' },
  themeSwitchTextActive: { color: palette.surface },
  premiumButton: { minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, marginTop: spacing.sm, borderRadius: borderRadius.extraLarge, backgroundColor: palette.sagePale },
  premiumButtonIcon: { color: palette.sage, fontSize: 14 },
  premiumButtonText: { color: palette.sage, fontSize: 10, fontWeight: '700' },
  previewLabel: { color: palette.textSecondary, fontSize: 7, fontWeight: '700' },
  signOutButton: { marginTop: spacing.md, borderColor: palette.border, backgroundColor: palette.surface },
  footer: { color: palette.textSecondary, fontSize: 10, fontFamily: typography.fonts.display, fontStyle: 'italic', textAlign: 'center', marginTop: spacing.sm },
  pressed: { opacity: 0.78 },
});
