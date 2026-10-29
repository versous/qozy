import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { CosyButton } from '@/components/common/CosyButton';
import { BottomNavigation } from '@/components/BottomNavigation';
import { useHabits } from '@/hooks/useHabits';
import { auth } from '@/services/firebase';
import { borderRadius, colors, spacing } from '@/theme/colors';
import { typography } from '@/theme/typography';

const activities = [
  { title: 'Exercice', detail: 'Faire du sport avec toi', duration: '15 min', icon: '✳', tint: colors.peach },
  { title: 'Focus', detail: 'Lire un livre avec toi', duration: '25 min', icon: '▤', tint: colors.sageLight },
  { title: 'Méditation', detail: 'Méditer avec toi', duration: '10 min', icon: '◉', tint: colors.sagePale },
];

const todayLabel = new Date().toLocaleDateString('fr-FR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

export default function Dashboard() {
  const { habits, loading, error, addHabit, toggleHabit } = useHabits();
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [newHabitTitle, setNewHabitTitle] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const firstName = auth?.currentUser?.displayName?.split(' ')[0] || 'toi';

  const handleAddHabit = async () => {
    setIsSaving(true);
    setSaveError('');
    try {
      await addHabit(newHabitTitle);
      setNewHabitTitle('');
      setIsModalVisible(false);
    } catch (reason) {
      setSaveError(reason instanceof Error ? reason.message : "Impossible d'ajouter l'habitude.");
    } finally {
      setIsSaving(false);
    }
  };

  const openActivity = (activity: string) => {
    if (activity === 'Exercice') {
      router.push('/movement');
    } else if (activity === 'Méditation') {
      router.push({ pathname: '/breathing', params: { activity: 'Revenir à soi', minutes: '5' } });
    } else {
      router.push({ pathname: '/prepare', params: { activity: 'Lire' } });
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}>
          <View style={styles.brandLine}>
            <Text style={styles.brandMark}>nid</Text>
            <Text style={styles.brandCaption}>À VOTRE RYTHME</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Ouvrir mon compte"
            onPress={() => router.push('/profile')}
            style={styles.avatar}>
            <Text style={styles.avatarText}>{firstName.charAt(0).toUpperCase()}</Text>
          </Pressable>
        </View>

        <Text style={styles.dateLabel}>{todayLabel}</Text>
        <Text style={styles.pageTitle}>Une chose à la fois, {firstName}.</Text>

        <View style={styles.heroCard}>
          <Image
            source={require('@/assets/images/home-hero.jpg')}
            contentFit="cover"
            transition={180}
            style={styles.heroImage}
            accessibilityLabel="Une personne profite d'un moment calme chez elle" />
          <View style={styles.heroOverlay}>
            <View style={styles.heroPill}>
              <Text style={styles.heroPillText}>☀  Un matin tout doux</Text>
            </View>
          </View>
        </View>

        <View style={styles.focusCard}>
          <View style={styles.focusIcon}>
            <Text style={styles.focusIconText}>◷</Text>
          </View>
          <View style={styles.focusCopy}>
            <Text style={styles.eyebrow}>UN PEU DE CONCENTRATION</Text>
            <Text style={styles.focusTitle}>Un focus de 25 minutes</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push({ pathname: '/prepare', params: { activity: 'Lire' } })}
            style={({ pressed }) => [styles.focusAction, pressed && styles.pressed]}>
            <Text style={styles.focusActionText}>Entrer dans ma bulle</Text>
            <Text style={styles.actionArrow}>›</Text>
          </Pressable>
        </View>

        <View style={styles.sectionHeading}>
          <View>
            <Text style={styles.sectionTitle}>À écouter, à votre rythme</Text>
            <Text style={styles.sectionSubtitle}>Choisis un petit moment pour toi.</Text>
          </View>
          <Text style={styles.sectionAccent}>3 idées</Text>
        </View>

        <View style={styles.activityList}>
          {activities.map((activity) => (
            <Pressable
              key={activity.title}
              accessibilityRole="button"
              onPress={() => openActivity(activity.title)}
              style={({ pressed }) => [styles.activityCard, pressed && styles.pressed]}>
              <View style={[styles.activityImageWrap, { backgroundColor: activity.tint }]}>
                <Image
                  source={require('@/assets/images/home-hero.jpg')}
                  contentFit="cover"
                  style={styles.activityImage}
                />
                <View style={styles.activityIcon}>
                  <Text style={styles.activityIconText}>{activity.icon}</Text>
                </View>
              </View>
              <View style={styles.activityCopy}>
                <Text style={styles.activityTitle}>{activity.title}</Text>
                <Text style={styles.activityDetail}>{activity.detail}</Text>
                <Text style={styles.activityDuration}>{activity.duration}</Text>
              </View>
              <View style={styles.activityAction}>
                <Text style={styles.activityActionText}>Commencer</Text>
              </View>
            </Pressable>
          ))}
        </View>

        <View style={styles.sectionHeading}>
          <View>
            <Text style={styles.sectionTitle}>Le fil de ma journée</Text>
            <Text style={styles.sectionSubtitle}>Chaque petit pas compte.</Text>
          </View>
          <Pressable onPress={() => router.push('/tasks')} hitSlop={8}>
            <Text style={styles.seeAll}>Voir tout</Text>
          </Pressable>
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        {loading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color={colors.sage} />
            <Text style={styles.emptyText}>On prépare ton espace…</Text>
          </View>
        ) : habits.length ? (
          <View style={styles.habitList}>
            {habits.slice(0, 3).map((habit) => (
              <Pressable
                key={habit.id}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: habit.isCompleted }}
                onPress={() => {
                  void toggleHabit(habit.id).catch((reason) => {
                    Alert.alert(
                      'Modification impossible',
                      reason instanceof Error ? reason.message : 'Réessaie plus tard.'
                    );
                  });
                }}
                style={styles.habitRow}>
                <View style={[styles.habitCheck, habit.isCompleted && styles.habitCheckDone]}>
                  {habit.isCompleted ? <Text style={styles.checkmark}>✓</Text> : null}
                </View>
                <Text style={[styles.habitTitle, habit.isCompleted && styles.habitTitleDone]}>
                  {habit.title}
                </Text>
                <Text style={styles.habitStreak}>{habit.streak} j.</Text>
              </Pressable>
            ))}
          </View>
        ) : (
          <Pressable onPress={() => setIsModalVisible(true)} style={styles.emptyCard}>
            <View style={styles.emptyIcon}>
              <Text style={styles.emptyIconText}>＋</Text>
            </View>
            <View style={styles.emptyCopy}>
              <Text style={styles.emptyTitle}>Commence doucement</Text>
              <Text style={styles.emptyText}>Ajoute une habitude à ton rythme.</Text>
            </View>
            <Text style={styles.actionArrow}>›</Text>
          </Pressable>
        )}

        <Text style={styles.reassurance}>Vous n’avez pas à tout faire aujourd’hui.</Text>
      </ScrollView>

      <BottomNavigation active="today" />

      <Modal
        visible={isModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setIsModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalEyebrow}>UN PETIT PAS POUR TOI</Text>
            <Text style={styles.modalTitle}>Nouvelle habitude</Text>
            <TextInput
              style={styles.input}
              placeholder="Ex. Lire quelques pages"
              placeholderTextColor={colors.textLight}
              value={newHabitTitle}
              onChangeText={setNewHabitTitle}
              autoFocus
              editable={!isSaving}
              returnKeyType="done"
              onSubmitEditing={() => void handleAddHabit()}
            />
            {saveError ? <Text style={styles.errorText}>{saveError}</Text> : null}
            <CosyButton
              title={isSaving ? 'Ajout en cours…' : 'Ajouter à ma journée'}
              onPress={() => void handleAddHabit()}
              disabled={isSaving || !newHabitTitle.trim()}
              style={styles.modalButton}
            />
            <Pressable onPress={() => setIsModalVisible(false)} style={styles.cancelButton}>
              <Text style={styles.cancelText}>Pas maintenant</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  brandLine: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
  },
  brandMark: {
    color: colors.textPrimary,
    fontSize: 28,
    fontFamily: 'serif',
    fontWeight: '700',
    letterSpacing: -1,
  },
  brandCaption: {
    color: colors.textSecondary,
    fontSize: 8,
    fontWeight: '600',
    letterSpacing: 1.1,
  },
  avatar: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: colors.peach,
  },
  avatarText: {
    color: colors.clay,
    fontSize: 12,
    fontWeight: '700',
  },
  dateLabel: {
    color: colors.textSecondary,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  pageTitle: {
    color: colors.textPrimary,
    fontSize: 25,
    lineHeight: 32,
    fontFamily: 'serif',
    marginBottom: spacing.md,
  },
  heroCard: {
    overflow: 'hidden',
    borderRadius: borderRadius.large,
    aspectRatio: 1.78,
    marginBottom: spacing.md,
    backgroundColor: colors.peach,
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroOverlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'flex-end',
    padding: spacing.sm,
  },
  heroPill: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surface,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: borderRadius.extraLarge,
  },
  heroPillText: {
    color: colors.textPrimary,
    fontSize: 11,
    fontWeight: '600',
  },
  focusCard: {
    backgroundColor: colors.sagePale,
    borderRadius: borderRadius.medium,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  focusIcon: {
    position: 'absolute',
    left: spacing.md,
    top: spacing.md,
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 17,
    backgroundColor: colors.surface,
  },
  focusIconText: {
    color: colors.sage,
    fontSize: 20,
  },
  focusCopy: {
    paddingLeft: 44,
    marginBottom: spacing.md,
  },
  eyebrow: {
    color: colors.sage,
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 0.75,
    marginBottom: 4,
  },
  focusTitle: {
    color: colors.textPrimary,
    fontSize: 15,
    fontFamily: 'serif',
    fontWeight: '600',
  },
  focusAction: {
    backgroundColor: colors.sage,
    minHeight: 42,
    borderRadius: borderRadius.extraLarge,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  focusActionText: {
    color: colors.surface,
    fontSize: 12,
    fontWeight: '600',
  },
  actionArrow: {
    color: colors.sage,
    fontSize: 22,
    lineHeight: 24,
  },
  sectionHeading: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: 18,
    fontFamily: 'serif',
    fontWeight: '600',
  },
  sectionSubtitle: {
    color: colors.textSecondary,
    fontSize: 11,
    marginTop: 3,
  },
  sectionAccent: {
    color: colors.sage,
    fontSize: 10,
    fontWeight: '600',
  },
  activityList: {
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  activityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    minHeight: 90,
    borderRadius: borderRadius.medium,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  activityImageWrap: {
    width: 66,
    height: 66,
    overflow: 'hidden',
    borderRadius: borderRadius.small,
  },
  activityImage: {
    width: '100%',
    height: '100%',
  },
  activityIcon: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 252, 246, 0.36)',
  },
  activityIconText: {
    color: colors.sage,
    fontSize: 24,
    fontWeight: '600',
  },
  activityCopy: {
    flex: 1,
    paddingHorizontal: spacing.sm,
    gap: 2,
  },
  activityTitle: {
    color: colors.textPrimary,
    fontSize: 14,
    fontFamily: 'serif',
    fontWeight: '600',
  },
  activityDetail: {
    color: colors.textSecondary,
    fontSize: 10,
  },
  activityDuration: {
    color: colors.sage,
    fontSize: 10,
    fontWeight: '600',
    marginTop: 3,
  },
  activityAction: {
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: borderRadius.extraLarge,
    backgroundColor: colors.peachLight,
  },
  activityActionText: {
    color: colors.clay,
    fontSize: 9,
    fontWeight: '600',
  },
  seeAll: {
    color: colors.sage,
    fontSize: 11,
    fontWeight: '600',
  },
  errorText: {
    color: colors.error,
    fontSize: typography.sizes.sm,
    marginBottom: spacing.sm,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.md,
  },
  habitList: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.medium,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  habitRow: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  habitCheck: {
    width: 20,
    height: 20,
    borderWidth: 1,
    borderColor: colors.sage,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  habitCheckDone: {
    backgroundColor: colors.sage,
  },
  checkmark: {
    color: colors.surface,
    fontSize: 12,
    fontWeight: '700',
  },
  habitTitle: {
    color: colors.textPrimary,
    fontSize: 12,
    flex: 1,
  },
  habitTitleDone: {
    color: colors.textSecondary,
    textDecorationLine: 'line-through',
  },
  habitStreak: {
    color: colors.sage,
    fontSize: 10,
  },
  emptyCard: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: borderRadius.medium,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyIcon: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 19,
    backgroundColor: colors.sagePale,
  },
  emptyIconText: {
    color: colors.sage,
    fontSize: 22,
  },
  emptyCopy: {
    flex: 1,
  },
  emptyTitle: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: '600',
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: 10,
    marginTop: 2,
  },
  reassurance: {
    color: colors.textSecondary,
    fontSize: 11,
    fontFamily: 'serif',
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: spacing.md,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(42, 48, 39, 0.38)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    alignItems: 'stretch',
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    borderTopLeftRadius: borderRadius.large,
    borderTopRightRadius: borderRadius.large,
    backgroundColor: colors.background,
  },
  modalHandle: {
    width: 38,
    height: 4,
    alignSelf: 'center',
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: spacing.md,
  },
  modalEyebrow: {
    color: colors.sage,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
    textAlign: 'center',
  },
  modalTitle: {
    color: colors.textPrimary,
    fontSize: 23,
    fontFamily: 'serif',
    fontWeight: '600',
    textAlign: 'center',
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  input: {
    minHeight: 50,
    borderRadius: borderRadius.small,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
    backgroundColor: colors.surface,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalButton: {
    backgroundColor: colors.sage,
    borderRadius: borderRadius.extraLarge,
    borderWidth: 0,
    marginTop: spacing.xs,
  },
  cancelButton: {
    alignItems: 'center',
    padding: spacing.md,
  },
  cancelText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.82,
  },
});
