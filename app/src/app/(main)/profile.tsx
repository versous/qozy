import React, { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { signOut } from 'firebase/auth';

import { BottomNavigation } from '@/components/BottomNavigation';
import { CosyButton } from '@/components/common/CosyButton';
import { useHabits } from '@/hooks/useHabits';
import { auth } from '@/services/firebase';
import { borderRadius, colors, spacing } from '@/theme/colors';
import { typography } from '@/theme/typography';

export default function ProfileScreen() {
  const { habits, loading, error } = useHabits();
  const [signOutError, setSignOutError] = useState('');
  const [isSigningOut, setIsSigningOut] = useState(false);
  const user = auth?.currentUser;
  const name = user?.displayName?.trim() || 'Mon espace';
  const email = user?.email || 'Adresse e-mail indisponible';
  const initials = name === 'Mon espace'
    ? (user?.email?.charAt(0) || 'Q').toUpperCase()
    : name.split(/\s+/).slice(0, 2).map((part) => part.charAt(0)).join('').toUpperCase();
  const completedHabits = habits.filter((habit) => habit.isCompleted).length;

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
        <View style={styles.brandLine}>
          <Text style={styles.brand}>nid</Text>
          <Text style={styles.brandCaption}>À VOTRE RYTHME</Text>
        </View>

        <Text style={styles.eyebrow}>MON ESPACE</Text>
        <Text style={styles.title}>Le temps de prendre soin de toi.</Text>

        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <View style={styles.profileCopy}>
            <Text style={styles.name}>{name}</Text>
            <Text style={styles.email}>{email}</Text>
          </View>
          <Text style={styles.sparkle}>✳</Text>
        </View>

        <View style={styles.sectionHeading}>
          <Text style={styles.sectionTitle}>Ma journée</Text>
          <Text style={styles.sectionMeta}>Un pas après l’autre</Text>
        </View>
        <View style={styles.statsCard}>
          <View style={styles.stat}>
            {loading ? (
              <ActivityIndicator size="small" color={colors.sage} />
            ) : (
              <Text style={styles.statValue}>{completedHabits}</Text>
            )}
            <Text style={styles.statLabel}>petits pas réalisés</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            {loading ? (
              <ActivityIndicator size="small" color={colors.sage} />
            ) : (
              <Text style={styles.statValue}>{habits.length}</Text>
            )}
            <Text style={styles.statLabel}>habitudes choisies</Text>
          </View>
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.sectionHeading}>
          <Text style={styles.sectionTitle}>Mon espace Qozy</Text>
        </View>
        <View style={styles.planCard}>
          <View style={styles.planTop}>
            <View style={styles.planIcon}>
              <Text style={styles.planIconText}>☼</Text>
            </View>
            <View style={styles.planCopy}>
              <Text style={styles.planTitle}>Ton espace essentiel</Text>
              <Text style={styles.planSubtitle}>Un cocon pour avancer à ton rythme.</Text>
            </View>
            <View style={styles.planBadge}>
              <Text style={styles.planBadgeText}>ACTIF</Text>
            </View>
          </View>
          <View style={styles.planRule} />
          <Text style={styles.planNote}>
            Les options Premium arrivent bientôt. Pour le moment, toutes les fonctionnalités affichées restent gratuites.
          </Text>
        </View>

        <View style={styles.sectionHeading}>
          <Text style={styles.sectionTitle}>Compte</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/tasks')}
          style={({ pressed }) => [styles.menuRow, pressed && styles.pressed]}>
          <View style={[styles.menuIcon, styles.menuIconSage]}>
            <Text style={styles.menuIconText}>☷</Text>
          </View>
          <View style={styles.menuCopy}>
            <Text style={styles.menuTitle}>Mes petits pas</Text>
            <Text style={styles.menuSubtitle}>Retrouver ma journée</Text>
          </View>
          <Text style={styles.menuArrow}>›</Text>
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

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.lg },
  brandLine: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm, marginBottom: spacing.lg },
  brand: { color: colors.textPrimary, fontSize: 27, fontFamily: 'serif', fontWeight: '700' },
  brandCaption: { color: colors.textSecondary, fontSize: 8, letterSpacing: 1, fontWeight: '600' },
  eyebrow: { color: colors.sage, fontSize: 9, letterSpacing: 0.8, fontWeight: '700' },
  title: { color: colors.textPrimary, fontSize: 25, lineHeight: 32, fontFamily: 'serif', fontWeight: '600', marginTop: 5, marginBottom: spacing.md },
  profileCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: borderRadius.medium, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  avatar: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.peach },
  avatarText: { color: colors.clay, fontSize: 18, fontWeight: '700' },
  profileCopy: { flex: 1 },
  name: { color: colors.textPrimary, fontSize: typography.sizes.md, fontWeight: '700' },
  email: { color: colors.textSecondary, fontSize: 11, marginTop: 4 },
  sparkle: { color: colors.sage, fontSize: 18 },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.lg, marginBottom: spacing.sm },
  sectionTitle: { color: colors.textPrimary, fontSize: 16, fontFamily: 'serif', fontWeight: '600' },
  sectionMeta: { color: colors.textSecondary, fontSize: 9 },
  statsCard: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md, borderRadius: borderRadius.medium, backgroundColor: colors.sagePale },
  stat: { flex: 1, minHeight: 58, alignItems: 'center', justifyContent: 'center', gap: 5 },
  statValue: { color: colors.sage, fontSize: 23, fontFamily: 'serif', fontWeight: '700' },
  statLabel: { color: colors.textSecondary, fontSize: 9 },
  statDivider: { width: 1, height: 38, backgroundColor: colors.border },
  error: { color: colors.error, fontSize: 11, marginTop: spacing.sm },
  planCard: { padding: spacing.md, borderRadius: borderRadius.medium, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  planTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  planIcon: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 19, backgroundColor: colors.peachLight },
  planIconText: { color: colors.clay, fontSize: 20 },
  planCopy: { flex: 1 },
  planTitle: { color: colors.textPrimary, fontSize: 12, fontWeight: '700' },
  planSubtitle: { color: colors.textSecondary, fontSize: 9, marginTop: 3 },
  planBadge: { paddingHorizontal: 8, paddingVertical: 5, borderRadius: borderRadius.extraLarge, backgroundColor: colors.sagePale },
  planBadgeText: { color: colors.sage, fontSize: 8, fontWeight: '700', letterSpacing: 0.4 },
  planRule: { height: 1, backgroundColor: colors.border, marginVertical: spacing.sm },
  planNote: { color: colors.textSecondary, fontSize: 10, lineHeight: 16 },
  menuRow: { minHeight: 62, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.sm, borderRadius: borderRadius.medium, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  menuIcon: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  menuIconSage: { backgroundColor: colors.sagePale },
  menuIconText: { color: colors.sage, fontSize: 18 },
  menuCopy: { flex: 1 },
  menuTitle: { color: colors.textPrimary, fontSize: 11, fontWeight: '600' },
  menuSubtitle: { color: colors.textSecondary, fontSize: 9, marginTop: 3 },
  menuArrow: { color: colors.sage, fontSize: 22 },
  signOutButton: { marginTop: spacing.lg, borderColor: colors.border, backgroundColor: colors.surface },
  footer: { color: colors.textSecondary, fontSize: 10, fontFamily: 'serif', fontStyle: 'italic', textAlign: 'center', marginTop: spacing.md },
  pressed: { opacity: 0.78 },
});
