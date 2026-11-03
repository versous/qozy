import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, type Href } from 'expo-router';
import { deleteUser, EmailAuthProvider, onAuthStateChanged, reauthenticateWithCredential, signOut, type User } from 'firebase/auth';
import { FirebaseError } from 'firebase/app';

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
import { deleteAccountData } from '@/services/accountDeletion';

const defaultSyncStatus: OfflineSyncStatus = { isOnline: null, pendingWrites: 0, error: null };

export default function ProfileScreen() {
  const { colors } = useAppTheme();
  const { isPremium } = usePremium();
  const styles = createStyles(colors);
  const { habits, loading, error } = useHabits();
  const [user, setUser] = useState<User | null>(auth?.currentUser ?? null);
  const [accountError, setAccountError] = useState('');
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  useEffect(() => {
    if (!auth) return;
    return onAuthStateChanged(auth, setUser);
  }, []);
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
    setAccountError('');
    setIsSigningOut(true);
    try {
      await signOut(auth);
    } catch {
      setAccountError('La déconnexion n’a pas abouti. Réessaie.');
    } finally {
      setIsSigningOut(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!auth || !user?.email) {
      setAccountError('La suppression de ce type de compte nécessite une reconnexion.');
      return;
    }
    if (deleteConfirmation !== 'SUPPRIMER') {
      setAccountError('Saisis SUPPRIMER pour confirmer la suppression définitive.');
      return;
    }
    if (!deletePassword) {
      setAccountError('Saisis ton mot de passe pour confirmer ton identité.');
      return;
    }
    setAccountError('');
    setIsDeletingAccount(true);
    try {
      const credential = EmailAuthProvider.credential(user.email, deletePassword);
      await reauthenticateWithCredential(user, credential);
      await deleteAccountData(user);
      await deleteUser(user);
      setDeleteModalVisible(false);
      setDeletePassword('');
      setDeleteConfirmation('');
      router.replace('/');
    } catch (reason) {
      if (reason instanceof FirebaseError && reason.code === 'auth/wrong-password') {
        setAccountError('Mot de passe incorrect.');
      } else if (reason instanceof FirebaseError && reason.code === 'auth/requires-recent-login') {
        setAccountError('Reconnecte-toi puis réessaie de supprimer ton compte.');
      } else {
        setAccountError(reason instanceof Error
          ? `La suppression n’a pas abouti : ${reason.message}`
          : 'La suppression du compte a échoué. Réessaie.');
      }
    } finally {
      setIsDeletingAccount(false);
    }
  };

  const openSubscriptionManagement = async () => {
    router.push('/premium');
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
            <Text style={styles.name}>{user ? name : 'Retrouver mon Nid'}</Text>
            <Text style={styles.email}>{user ? email : 'Tes petits pas, à ton rythme.'}</Text>
            <Text style={styles.accountNote}>
              {user ? 'Compte connecté · Tes données personnelles' : 'Tu peux utiliser l’application sans compte.'}
            </Text>
          </View>
        </View>
        {!user ? (
          <View style={styles.guestAccountCard}>
            <Text style={styles.guestTitle}>Retrouver ton Nid</Text>
            <Text style={styles.guestDescription}>Connecte-toi ou crée un compte pour synchroniser tes données et retrouver tes habitudes sur tes appareils.</Text>
            <CosyButton title="Se connecter" onPress={() => router.push('/(auth)/login')} style={styles.accountButton} />
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/(auth)/login?mode=register')}
              style={styles.createAccountButton}>
              <Text style={styles.createAccountText}>Nouveau ici ? Créer un compte</Text>
            </Pressable>
            <Text style={styles.offlineNote}>Tu peux découvrir l’application sans compte. La synchronisation de tes données nécessite un compte.</Text>
          </View>
        ) : null}

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
          accessibilityRole="button"
          onPress={() => router.push('/settings' as Href)}
          style={({ pressed }) => [styles.menuRow, pressed && styles.pressed]}>
          <View style={[styles.menuIcon, styles.menuIconSage]}><Text style={styles.menuIconText}>⚙</Text></View>
          <View style={styles.menuCopy}>
            <Text style={styles.menuTitle}>Paramètres et accessibilité</Text>
            <Text style={styles.menuSubtitle}>Thème, lecture et données</Text>
          </View>
          <Text style={styles.menuArrow}>›</Text>
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

        {accountError ? <Text style={styles.error}>{accountError}</Text> : null}
        <CosyButton
          title={isPremium ? 'Gérer mon abonnement' : 'Changer d’abonnement'}
          variant="outline"
          onPress={() => void openSubscriptionManagement()}
          style={styles.accountActionButton}
        />
        {user ? (
          <>
            <CosyButton
              title={isSigningOut ? 'Déconnexion…' : 'Se déconnecter'}
              variant="outline"
              onPress={() => void handleSignOut()}
              disabled={isSigningOut || !auth}
              style={styles.signOutButton}
            />
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setAccountError('');
                setDeleteModalVisible(true);
              }}
              style={styles.deleteAccountButton}>
              <Text style={styles.deleteAccountText}>Supprimer mon compte</Text>
            </Pressable>
          </>
        ) : null}
        <Text style={styles.footer}>Prends le temps qu’il te faut. 🌿</Text>
      </ScrollView>
      <BottomNavigation active="account" />
      <Modal
        visible={deleteModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!isDeletingAccount) setDeleteModalVisible(false);
        }}>
        <View style={styles.deleteBackdrop}>
          <View style={styles.deleteModal}>
            <Text style={styles.deleteTitle}>Supprimer définitivement ton compte ?</Text>
            <Text style={styles.deleteDescription}>
              Tes données synchronisées seront supprimées. Les abonnements App Store ou Google Play doivent être résiliés séparément avant la suppression.
            </Text>
            <Pressable onPress={() => void openSubscriptionManagement()} style={styles.subscriptionLink}>
              <Text style={styles.subscriptionLinkText}>Voir les options d’abonnement →</Text>
            </Pressable>
            <Text style={styles.deleteLabel}>Mot de passe</Text>
            <TextInput
              value={deletePassword}
              onChangeText={setDeletePassword}
              secureTextEntry
              editable={!isDeletingAccount}
              placeholder="Confirme ton identité"
              placeholderTextColor={colors.textLight}
              style={styles.deleteInput}
            />
            <Text style={styles.deleteLabel}>Écris SUPPRIMER pour confirmer</Text>
            <TextInput
              value={deleteConfirmation}
              onChangeText={setDeleteConfirmation}
              autoCapitalize="characters"
              editable={!isDeletingAccount}
              style={styles.deleteInput}
            />
            {accountError ? <Text style={styles.error}>{accountError}</Text> : null}
            <CosyButton
              title={isDeletingAccount ? 'Suppression…' : 'Supprimer mon compte'}
              onPress={() => void handleDeleteAccount()}
              disabled={isDeletingAccount}
              style={styles.confirmDeleteButton}
            />
            <Pressable
              disabled={isDeletingAccount}
              onPress={() => setDeleteModalVisible(false)}
              style={styles.cancelDeleteButton}>
              <Text style={styles.cancelDeleteText}>Annuler</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
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
  guestAccountCard: { padding: spacing.md, marginTop: spacing.sm, borderRadius: borderRadius.medium, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border },
  guestTitle: { color: palette.textPrimary, fontSize: 17, fontFamily: typography.fonts.display, fontWeight: '600' },
  guestDescription: { color: palette.textSecondary, fontSize: 10, lineHeight: 15, marginTop: spacing.xs },
  accountButton: { backgroundColor: palette.sage, borderRadius: borderRadius.extraLarge, marginTop: spacing.sm },
  createAccountButton: { alignItems: 'center', paddingVertical: spacing.sm },
  createAccountText: { color: palette.sage, fontSize: 9, fontWeight: '700' },
  offlineNote: { color: palette.textSecondary, fontSize: 8, lineHeight: 12, padding: spacing.sm, borderRadius: borderRadius.small, backgroundColor: palette.sagePale },
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
  signOutButton: { marginTop: spacing.md, borderColor: palette.border, backgroundColor: palette.surface },
  accountActionButton: { marginTop: spacing.sm, borderColor: palette.border, backgroundColor: palette.surface },
  deleteAccountButton: { alignItems: 'center', padding: spacing.sm, marginTop: spacing.xs },
  deleteAccountText: { color: palette.error, fontSize: 9, fontWeight: '700' },
  deleteBackdrop: { flex: 1, justifyContent: 'center', padding: spacing.md, backgroundColor: 'rgba(0,0,0,0.42)' },
  deleteModal: { padding: spacing.md, borderRadius: borderRadius.medium, backgroundColor: palette.surface },
  deleteTitle: { color: palette.textPrimary, fontSize: 17, fontFamily: typography.fonts.display, fontWeight: '600' },
  deleteDescription: { color: palette.textSecondary, fontSize: 10, lineHeight: 15, marginTop: spacing.xs },
  subscriptionLink: { alignSelf: 'flex-start', paddingVertical: spacing.sm },
  subscriptionLinkText: { color: palette.sage, fontSize: 9, fontWeight: '700' },
  deleteLabel: { color: palette.textPrimary, fontSize: 9, fontWeight: '700', marginTop: spacing.sm, marginBottom: spacing.xs },
  deleteInput: { minHeight: 42, borderRadius: borderRadius.small, paddingHorizontal: spacing.sm, backgroundColor: palette.background, borderWidth: 1, borderColor: palette.border, color: palette.textPrimary, fontSize: 11 },
  confirmDeleteButton: { backgroundColor: palette.error, borderWidth: 0, borderRadius: borderRadius.extraLarge, marginTop: spacing.md },
  cancelDeleteButton: { alignItems: 'center', padding: spacing.sm },
  cancelDeleteText: { color: palette.sage, fontSize: 10, fontWeight: '700' },
  footer: { color: palette.textSecondary, fontSize: 10, fontFamily: typography.fonts.display, fontStyle: 'italic', textAlign: 'center', marginTop: spacing.sm },
  pressed: { opacity: 0.78 },
});
