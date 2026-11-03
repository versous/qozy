import { typography } from '@/theme/typography';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { useHabits } from '@/hooks/useHabits';
import { useMonthlyGoals } from '@/hooks/useMonthlyGoals';
import { useTasks } from '@/hooks/useTasks';
import { usePremium } from '@/services/PremiumProvider';
import { BrandHeader } from '@/components/BrandHeader';
import { borderRadius, spacing, type AppColors } from '@/theme/colors';
import { useAppTheme } from '@/theme/ThemeProvider';

const termsUrl = process.env.EXPO_PUBLIC_TERMS_OF_USE_URL;
const privacyUrl = process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL;
const premiumFeatures = [
  { title: 'Tâches, calendrier et habitudes', free: 'Inclus', premium: 'Inclus' },
  { title: 'Exercices de base et comptage manuel', free: 'Inclus', premium: 'Inclus' },
  { title: 'Focus, méditation et respiration guidée', free: 'Sélection', premium: 'Tout + extras' },
  { title: 'Hydratation et suivi du temps', free: 'Inclus', premium: 'Inclus' },
  { title: 'Musique Lofi, Nature et Piano', free: 'Sélection', premium: 'Tout + extras' },
  { title: 'Bilans', free: 'Quotidiens', premium: 'Avancés' },
];

function getDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function getHabitSummary(
  habits: ReturnType<typeof useHabits>['allHabits'],
  start: Date,
  end: Date
) {
  let planned = 0;
  let completed = 0;
  const date = new Date(start);

  while (date <= end) {
    const dateKey = getDateKey(date);
    const weekday = date.getDay();
    habits.forEach((habit) => {
      if (!habit.frequencyDays.includes(weekday as 0 | 1 | 2 | 3 | 4 | 5 | 6)) return;
      planned += 1;
      if (habit.completedDates.includes(dateKey)) completed += 1;
    });
    date.setDate(date.getDate() + 1);
  }

  return { planned, completed };
}

function getTaskSummary(
  tasks: ReturnType<typeof useTasks>['tasks'],
  start: Date,
  end: Date
) {
  const startKey = getDateKey(start);
  const endKey = getDateKey(end);
  const planned = tasks.filter((task) =>
    task.dueDate && task.dueDate >= startKey && task.dueDate <= endKey
  );
  return {
    planned: planned.length,
    completed: planned.filter((task) => task.completed).length,
  };
}

function getPercent(value: number, target: number) {
  return target > 0 ? Math.min(100, Math.round((value / target) * 100)) : 0;
}

export default function PremiumScreen() {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const {
    isPremium,
    isPreview,
    canPreview,
    setPreviewEnabled,
    status,
    message,
    monthlyPackage,
    annualPackage,
    managementUrl,
    isPurchasing,
    purchase,
    restore,
    manageSubscription,
  } = usePremium();
  const {
    habits: dailyHabits,
    allHabits,
    loading: habitsLoading,
    error: habitsError,
    toggleHabit,
  } = useHabits();
  const { tasks, loading: tasksLoading, error: tasksError } = useTasks();
  const now = new Date();
  const todayKey = getDateKey(now);
  const monthKey = todayKey.slice(0, 7);
  const { goal, loaded: goalsLoaded, error: goalsError, saveGoal } = useMonthlyGoals(monthKey);
  const [goalDraft, setGoalDraft] = useState<{
    monthKey: string;
    habitTarget: number;
    taskTarget: number;
  } | null>(null);
  const [isSavingGoal, setIsSavingGoal] = useState(false);
  const [goalMessage, setGoalMessage] = useState<string | null>(null);
  const [legalError, setLegalError] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'annual'>('annual');
  const hasCurrentDraft = goalDraft?.monthKey === monthKey;
  const habitTarget = hasCurrentDraft ? goalDraft.habitTarget : goal?.habitTarget ?? 20;
  const taskTarget = hasCurrentDraft ? goalDraft.taskTarget : goal?.taskTarget ?? 8;

  const weekStart = new Date(`${todayKey}T00:00:00`);
  weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthlyHabits = getHabitSummary(allHabits, monthStart, now);
  const monthlyTasks = getTaskSummary(tasks, monthStart, now);
  const monthLabel = now.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  const completedDailyHabits = dailyHabits.filter((habit) => habit.isCompleted).length;

  const changeTarget = (kind: 'habit' | 'task', delta: number) => {
    setGoalMessage(null);
    setGoalDraft({
      monthKey,
      habitTarget: kind === 'habit' ? Math.max(1, Math.min(1000, habitTarget + delta)) : habitTarget,
      taskTarget: kind === 'task' ? Math.max(1, Math.min(1000, taskTarget + delta)) : taskTarget,
    });
  };

  const handleSaveGoal = async () => {
    setIsSavingGoal(true);
    setGoalMessage(null);
    try {
      await saveGoal(habitTarget, taskTarget);
      setGoalMessage('Tes objectifs du mois sont enregistrés.');
    } catch (error) {
      setGoalMessage(error instanceof Error ? error.message : 'Impossible d’enregistrer tes objectifs.');
    } finally {
      setIsSavingGoal(false);
    }
  };

  const handlePurchase = async (selectedPackage: typeof monthlyPackage) => {
    if (selectedPackage) await purchase(selectedPackage);
  };

  const openLegalPage = async (url: string | undefined) => {
    if (!url) {
      setLegalError('Ajoute l’adresse de cette page dans la configuration de l’application.');
      return;
    }
    try {
      await Linking.openURL(url);
      setLegalError(null);
    } catch (error) {
      setLegalError(error instanceof Error ? error.message : 'Impossible d’ouvrir cette page.');
    }
  };

  const purchaseUnavailable = isPurchasing || status !== 'ready' || !termsUrl || !privacyUrl;
  const selectedPackage = selectedPlan === 'monthly' ? monthlyPackage : annualPackage;
  const selectedPlanLabel = selectedPlan === 'monthly' ? 'mensuel' : 'annuel';

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <BrandHeader />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Retour"
          onPress={() => router.back()}
          style={styles.backButton}>
          <Text style={styles.backText}>‹  {isPremium ? 'Retour' : 'Mon compte'}</Text>
        </Pressable>

        {isPremium ? (
          <>
            <Text style={styles.eyebrow}>À TON RYTHME</Text>
            <Text style={styles.title}>Mes petits rituels</Text>
            <Text style={styles.subtitle}>La régularité se construit en douceur.</Text>
          </>
        ) : null}

        {isPremium ? (
          <>
            <View style={styles.dailySummaryCard}>
              <View style={styles.dailySummaryHeader}>
                <Text style={styles.dailySummaryTitle}>
                  {completedDailyHabits} habitude{completedDailyHabits === 1 ? '' : 's'} sur {dailyHabits.length} validée{dailyHabits.length === 1 ? '' : 's'} aujourd’hui
                </Text>
                <Text style={styles.dailySummaryPercent}>
                  {getPercent(completedDailyHabits, dailyHabits.length)} %
                </Text>
              </View>
              <View style={styles.dailyProgressTrack}>
                <View style={[styles.dailyProgressFill, { width: `${getPercent(completedDailyHabits, dailyHabits.length)}%` }]} />
              </View>
              <Text style={styles.dailySummaryNote}>
                {now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'short' })} · Chaque petit pas compte.
              </Text>
            </View>

            <View style={styles.sectionHeading}>
              <Text style={styles.sectionTitle}>Prendre soin du quotidien</Text>
              <Text style={styles.sectionMeta}>{now.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</Text>
            </View>
            {habitsLoading ? (
              <ActivityIndicator color={colors.sage} style={styles.loader} />
            ) : dailyHabits.length ? (
              dailyHabits.map((habit) => {
                const weekly = getHabitSummary([habit], weekStart, now);
                const dailyProgress = habit.goalType === 'check'
                  ? habit.isCompleted ? 100 : 0
                  : getPercent(
                    habit.todayProgress,
                    habit.goalType === 'timer' ? habit.goalTarget * 60 : habit.goalTarget
                  );
                const progressLabel = habit.goalType === 'timer'
                  ? `${Math.floor(habit.todayProgress / 60)} / ${habit.goalTarget} min`
                  : habit.goalType === 'count'
                    ? `${habit.todayProgress} / ${habit.goalTarget} ${habit.goalUnit}`
                    : `${weekly.completed} / ${weekly.planned} validations cette semaine`;
                return (
                  <View key={habit.id} style={styles.ritualCard}>
                    <View style={styles.ritualHeader}>
                      <View style={styles.ritualIcon}>
                        <Text style={styles.ritualIconText}>{habit.icon || '◉'}</Text>
                      </View>
                      <View style={styles.ritualCopy}>
                        <Text style={styles.ritualTitle}>{habit.title}</Text>
                        <Text style={styles.ritualSchedule}>
                          {habit.frequencyDays.length === 7
                            ? 'Tous les jours'
                            : `${habit.frequencyDays.length} jour${habit.frequencyDays.length === 1 ? '' : 's'} prévu${habit.frequencyDays.length === 1 ? '' : 's'} cette semaine`}
                          {habit.streak ? ` · ${habit.streak} jours de suite` : ''}
                        </Text>
                      </View>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Modifier ${habit.title}`}
                        onPress={() => router.push('/tasks')}
                        hitSlop={8}>
                        <Text style={styles.editHabit}>✎</Text>
                      </Pressable>
                    </View>
                    <View style={styles.dailyProgressTrack}>
                      <View style={[styles.dailyProgressFill, { width: `${dailyProgress}%` }]} />
                    </View>
                    <Text style={styles.ritualMeta}>
                      {progressLabel} · {habit.isCompleted ? 'Rituel validé' : 'À ton rythme'}
                    </Text>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityState={{ checked: habit.isCompleted }}
                      onPress={() => {
                        if (habit.goalType !== 'check') {
                          router.push('/tasks');
                          return;
                        }
                        void toggleHabit(habit.id).catch((reason: unknown) => {
                          Alert.alert(
                            'Modification impossible',
                            reason instanceof Error ? reason.message : 'Réessaie plus tard.'
                          );
                        });
                      }}
                      style={[
                        styles.ritualAction,
                        habit.isCompleted && styles.ritualActionDone,
                        habit.goalType !== 'check' && styles.ritualActionDisabled,
                      ]}>
                      <Text style={[
                        styles.ritualActionText,
                        habit.isCompleted && styles.ritualActionTextDone,
                      ]}>
                        {habit.goalType !== 'check'
                          ? '＋  Suivre ma progression'
                          : habit.isCompleted
                            ? '✓  Fait aujourd’hui · Annuler'
                            : '✓  Valider mon rituel'}
                      </Text>
                    </Pressable>
                  </View>
                );
              })
            ) : (
              <View style={styles.emptyHabitsCard}>
                <Text style={styles.emptyHabitsText}>Pas encore de rituel prévu aujourd’hui.</Text>
              </View>
            )}
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/tasks')}
              style={styles.createHabitButton}>
              <Text style={styles.createHabitText}>＋  Créer une habitude</Text>
            </Pressable>
            <Text style={styles.habitsFootnote}>
              Une série compte les jours programmés consécutifs. Les jours de repos ne l’interrompent pas.
            </Text>

            <View style={styles.sectionHeading}>
              <Text style={styles.sectionTitle}>Mes objectifs du mois</Text>
              <Text style={styles.sectionMeta}>{monthLabel}</Text>
            </View>
            <View style={styles.reportCard}>
              {!goalsLoaded ? (
                <ActivityIndicator color={colors.sage} />
              ) : (
                <>
                  <GoalControl
                    title="Habitudes réalisées"
                    current={monthlyHabits.completed}
                    target={habitTarget}
                    onDecrease={() => changeTarget('habit', -1)}
                    onIncrease={() => changeTarget('habit', 1)}
                    percent={getPercent(monthlyHabits.completed, habitTarget)}
                    styles={styles}
                    colors={colors}
                  />
                  <GoalControl
                    title="Petits pas accomplis"
                    current={monthlyTasks.completed}
                    target={taskTarget}
                    onDecrease={() => changeTarget('task', -1)}
                    onIncrease={() => changeTarget('task', 1)}
                    percent={getPercent(monthlyTasks.completed, taskTarget)}
                    styles={styles}
                    colors={colors}
                  />
                  {goalsError ? <Text style={styles.errorText}>{goalsError}</Text> : null}
                  {goalMessage ? <Text style={styles.helperText}>{goalMessage}</Text> : null}
                  <Pressable
                    accessibilityRole="button"
                    disabled={isSavingGoal}
                    onPress={() => void handleSaveGoal()}
                    style={[styles.saveButton, isSavingGoal && styles.disabledButton]}>
                    {isSavingGoal
                      ? <ActivityIndicator color={colors.surface} />
                      : <Text style={styles.saveButtonText}>Enregistrer mes objectifs</Text>}
                  </Pressable>
                </>
              )}
            </View>
            <View style={styles.featureLinks}>
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push('/activity-calendar')}
                style={styles.featureLink}>
                <View style={styles.featureLinkCopy}>
                  <Text style={styles.featureLinkTitle}>Calendrier de mes activités</Text>
                  <Text style={styles.featureLinkSubtitle}>Un aperçu quotidien comme une heatmap</Text>
                </View>
                <Text style={styles.featureLinkArrow}>›</Text>
              </Pressable>
            </View>
            {habitsError || tasksError
              ? <Text style={styles.errorText}>{habitsError || tasksError}</Text>
              : null}
            {(habitsLoading || tasksLoading) ? (
              <ActivityIndicator color={colors.sage} style={styles.loader} />
            ) : null}
            {managementUrl ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => void manageSubscription()}
                style={styles.restoreButton}>
                <Text style={styles.restoreText}>Gérer mon abonnement</Text>
              </Pressable>
            ) : null}
          </>
        ) : (
          <>
            <Text style={styles.freeTitle}>Un cocon un peu plus grand</Text>
            <Text style={styles.freeSubtitle}>Le nécessaire reste gratuit. Le reste, à ton envie.</Text>
            <View style={styles.premiumHero}>
              <Image
                source={require('@/assets/images/home-hero.jpg')}
                resizeMode="cover"
                style={styles.premiumHeroImage}
                accessibilityLabel="Un moment de calme dans son cocon"
              />
            </View>
            <View style={styles.premiumIntroCard}>
              <Text style={styles.premiumIntroIcon}>✳</Text>
              <View style={styles.featureCopy}>
                <Text style={styles.featureTitle}>Plus d’ambiances, plus de recul</Text>
                <Text style={styles.featureDetail}>Premium ajoute des univers sonores et des analyses, sans retirer tes essentiels.</Text>
              </View>
            </View>

            <Text style={styles.comparisonHeading}>Choisir ce qui me convient</Text>
            <View style={styles.comparisonCard}>
              <View style={[styles.comparisonRow, styles.comparisonHeader]}>
                <Text style={[styles.comparisonFeature, styles.comparisonHeaderText]}>Dans mon Nid</Text>
                <Text style={[styles.comparisonValue, styles.comparisonHeaderText]}>Gratuit</Text>
                <Text style={[styles.comparisonValue, styles.comparisonPremium]}>Premium</Text>
              </View>
              {premiumFeatures.map((feature) => (
                <View key={feature.title} style={styles.comparisonRow}>
                  <Text style={styles.comparisonFeature}>{feature.title}</Text>
                  <Text style={styles.comparisonValue}>{feature.free}</Text>
                  <Text style={[styles.comparisonValue, styles.comparisonPremium]}>{feature.premium}</Text>
                </View>
              ))}
            </View>

            <Text style={styles.planHeading}>Choisir mon abonnement</Text>
            <View style={styles.planChoices}>
              <PlanChoice
                label="Mensuel"
                detail="Renouvellement chaque mois"
                price={monthlyPackage?.product.priceString ?? 'Indisponible'}
                selected={selectedPlan === 'monthly'}
                onPress={() => setSelectedPlan('monthly')}
                styles={styles}
              />
              <PlanChoice
                label="Annuel"
                detail="Renouvellement chaque année"
                price={annualPackage?.product.priceString ?? 'Indisponible'}
                selected={selectedPlan === 'annual'}
                onPress={() => setSelectedPlan('annual')}
                styles={styles}
              />
            </View>
            {purchaseUnavailable ? (
              <View style={styles.unavailableCard}>
                <Text style={styles.unavailableIcon}>▣</Text>
                <View style={styles.featureCopy}>
                  <Text style={styles.unavailableTitle}>Achat indisponible dans cette version</Text>
                  <Text style={styles.unavailableDetail}>
                    {message ?? (!termsUrl || !privacyUrl
                      ? 'Les liens des conditions et de confidentialité doivent être configurés pour activer les achats.'
                      : 'Les achats Premium ne sont pas disponibles pour le moment.')}
                  </Text>
                </View>
              </View>
            ) : null}
            <Pressable
              accessibilityRole="button"
              disabled={!selectedPackage || purchaseUnavailable}
              onPress={() => void handlePurchase(selectedPackage)}
              style={[styles.purchaseButton, (!selectedPackage || purchaseUnavailable) && styles.disabledButton]}>
              <Text style={styles.purchaseButtonText}>
                {isPurchasing
                  ? 'Achat en cours…'
                  : purchaseUnavailable
                    ? 'Achat indisponible'
                    : `Continuer avec l’offre ${selectedPlanLabel}`}
              </Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.freeContinueButton}>
              <Text style={styles.freeContinueText}>Continuer avec l’offre gratuite</Text>
            </Pressable>
            <Text style={styles.renewalNote}>
              Le paiement est confirmé par ta boutique et l’abonnement se renouvelle automatiquement. Résiliation possible depuis les réglages de ton App Store ou Google Play.
            </Text>
            <View style={styles.legalLinks}>
              <Pressable accessibilityRole="link" onPress={() => void openLegalPage(termsUrl)}>
                <Text style={styles.restoreText}>Conditions d’utilisation</Text>
              </Pressable>
              <Pressable accessibilityRole="link" onPress={() => void openLegalPage(privacyUrl)}>
                <Text style={styles.restoreText}>Confidentialité</Text>
              </Pressable>
            </View>
            {!termsUrl || !privacyUrl ? (
              <Text style={styles.errorText}>
                Configure les liens des conditions d’utilisation et de confidentialité pour activer l’achat.
              </Text>
            ) : null}
            {legalError ? <Text style={styles.errorText}>{legalError}</Text> : null}
            {status === 'loading' ? <ActivityIndicator color={colors.sage} style={styles.loader} /> : null}
            {message && !purchaseUnavailable ? <Text style={styles.errorText}>{message}</Text> : null}
            <Pressable
              accessibilityRole="button"
              disabled={isPurchasing || status === 'unavailable'}
              onPress={() => void restore()}
              style={styles.restoreButton}>
              <Text style={styles.restoreText}>Restaurer mes achats</Text>
            </Pressable>
          </>
        )}
        {canPreview ? (
          <View style={styles.previewCard}>
            <View style={styles.previewCopy}>
              <Text style={styles.previewTitle}>Aperçu développeur</Text>
              <Text style={styles.previewDetail}>
                Active Premium pour tester les objectifs, le calendrier d’activités et les contenus réservés. Cela ne crée aucun achat.
              </Text>
            </View>
            <Pressable
              accessibilityRole="switch"
              accessibilityLabel="Aperçu développeur Premium"
              accessibilityState={{ checked: isPreview }}
              onPress={() => setPreviewEnabled(!isPreview)}
              style={[styles.previewButton, isPreview && styles.previewButtonActive]}>
              <Text style={[styles.previewButtonText, isPreview && styles.previewButtonTextActive]}>
                {isPreview ? 'Désactiver' : 'Activer'}
              </Text>
            </Pressable>
            {isPreview ? (
              <Text style={styles.previewNotice}>
                MODE APERÇU · Premium n’est pas acheté sur ce compte.
              </Text>
            ) : null}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function GoalControl({
  title,
  current,
  target,
  onDecrease,
  onIncrease,
  percent,
  styles,
  colors,
}: {
  title: string;
  current: number;
  target: number;
  onDecrease: () => void;
  onIncrease: () => void;
  percent: number;
  styles: ReturnType<typeof createStyles>;
  colors: AppColors;
}) {
  return (
    <View style={styles.goal}>
      <View style={styles.metricHeading}>
        <Text style={styles.metricLabel}>{title}</Text>
        <Text style={styles.metricValue}>{current} / {target}</Text>
      </View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${percent}%`, backgroundColor: colors.sage }]} />
      </View>
      <View style={styles.goalControls}>
        <Text style={styles.goalLabel}>Mon objectif</Text>
        <View style={styles.stepper}>
          <Pressable accessibilityRole="button" accessibilityLabel={`Diminuer ${title}`} onPress={onDecrease} style={styles.stepButton}>
            <Text style={styles.stepText}>−</Text>
          </Pressable>
          <Text style={styles.stepValue}>{target}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel={`Augmenter ${title}`} onPress={onIncrease} style={styles.stepButton}>
            <Text style={styles.stepText}>＋</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function PlanChoice({
  label,
  detail,
  price,
  selected,
  onPress,
  styles,
}: {
  label: string;
  detail: string;
  price: string;
  selected: boolean;
  onPress: () => void;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.planChoice, selected && styles.planChoiceSelected]}>
      <View style={styles.planChoiceCopy}>
        <Text style={styles.planTitle}>{label}</Text>
        <Text style={styles.planDetail}>{detail}</Text>
      </View>
      <Text style={styles.planPrice}>{price}</Text>
      <View style={[styles.planRadio, selected && styles.planRadioSelected]}>
        {selected ? <View style={styles.planRadioDot} /> : null}
      </View>
    </Pressable>
  );
}

const createStyles = (palette: AppColors) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.background },
  content: { padding: spacing.md, paddingBottom: spacing.xl },
  backButton: { alignSelf: 'flex-start', marginBottom: spacing.xs },
  backText: { color: palette.sage, fontSize: 10, fontWeight: '600' },
  freeTitle: { color: palette.textPrimary, fontSize: 21, lineHeight: 26, fontFamily: typography.fonts.display, fontWeight: '600', marginTop: spacing.xs },
  freeSubtitle: { color: palette.textSecondary, fontSize: 9, lineHeight: 14, marginTop: 2, marginBottom: spacing.sm },
  eyebrow: { color: palette.sage, fontSize: 9, letterSpacing: 1.2, fontWeight: '700' },
  title: { color: palette.textPrimary, fontSize: 27, lineHeight: 34, fontFamily: typography.fonts.display, fontWeight: '600', marginTop: 6 },
  subtitle: { color: palette.textSecondary, fontSize: 12, lineHeight: 19, marginTop: 7 },
  sectionHeading: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: spacing.sm, marginTop: spacing.lg, marginBottom: spacing.sm },
  sectionTitle: { color: palette.textPrimary, fontSize: 16, fontFamily: typography.fonts.display, fontWeight: '600' },
  sectionMeta: { color: palette.textSecondary, fontSize: 9 },
  reportCard: { padding: spacing.md, borderRadius: borderRadius.medium, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border, gap: spacing.md },
  cardEyebrow: { color: palette.sage, fontSize: 8, letterSpacing: 1, fontWeight: '700' },
  metricHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  metricLabel: { flex: 1, color: palette.textPrimary, fontSize: 11 },
  metricValue: { color: palette.sage, fontSize: 12, fontWeight: '700' },
  progressTrack: { height: 7, borderRadius: borderRadius.extraLarge, backgroundColor: palette.sagePale, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: borderRadius.extraLarge },
  helperText: { color: palette.textSecondary, fontSize: 10, lineHeight: 15 },
  goal: { gap: 7, marginBottom: spacing.sm },
  goalControls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 },
  goalLabel: { color: palette.textSecondary, fontSize: 10 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  stepButton: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center', borderRadius: 15, backgroundColor: palette.sagePale },
  stepText: { color: palette.sage, fontSize: 16, fontWeight: '700' },
  stepValue: { minWidth: 30, color: palette.textPrimary, textAlign: 'center', fontSize: 12, fontWeight: '700' },
  saveButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: borderRadius.extraLarge, backgroundColor: palette.sage, marginTop: spacing.xs },
  saveButtonText: { color: palette.surface, fontSize: 11, fontWeight: '700' },
  disabledButton: { opacity: 0.55 },
  errorText: { color: palette.error, fontSize: 11, lineHeight: 16, marginTop: spacing.sm },
  loader: { marginVertical: spacing.md },
  premiumHero: { height: 92, overflow: 'hidden', borderRadius: borderRadius.medium, marginBottom: spacing.sm },
  premiumHeroImage: { width: '100%', height: '100%' },
  premiumIntroCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, borderRadius: borderRadius.medium, backgroundColor: palette.sagePale },
  premiumIntroIcon: { color: palette.sage, fontSize: 19 },
  featureCopy: { flex: 1, gap: 3 },
  featureTitle: { color: palette.textPrimary, fontSize: 9, fontWeight: '700' },
  featureDetail: { color: palette.textSecondary, fontSize: 7, lineHeight: 11 },
  featureLinks: { gap: spacing.sm, marginTop: spacing.md },
  featureLink: { minHeight: 62, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, borderRadius: borderRadius.medium, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border },
  featureLinkCopy: { flex: 1, gap: 3 },
  featureLinkTitle: { color: palette.textPrimary, fontSize: 11, fontWeight: '700' },
  featureLinkSubtitle: { color: palette.textSecondary, fontSize: 9 },
  featureLinkArrow: { color: palette.sage, fontSize: 22 },
  comparisonHeading: { color: palette.textPrimary, fontSize: 13, fontFamily: typography.fonts.display, fontWeight: '600', marginTop: spacing.sm, marginBottom: spacing.xs },
  comparisonCard: { paddingHorizontal: spacing.xs, paddingVertical: 2, borderRadius: borderRadius.medium, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border },
  comparisonRow: { flexDirection: 'row', alignItems: 'center', minHeight: 31, paddingVertical: spacing.xs, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.border },
  comparisonHeader: { minHeight: 29, backgroundColor: palette.background, borderBottomWidth: 0 },
  comparisonFeature: { flex: 1.5, color: palette.textPrimary, fontSize: 7, lineHeight: 10, paddingRight: spacing.xs },
  comparisonValue: { flex: 0.8, color: palette.sage, fontSize: 7, lineHeight: 10, textAlign: 'center' },
  comparisonHeaderText: { fontWeight: '700', color: palette.textPrimary },
  comparisonPremium: { color: palette.clay },
  planHeading: { color: palette.textPrimary, fontSize: 13, fontFamily: typography.fonts.display, fontWeight: '600', marginTop: spacing.sm, marginBottom: spacing.xs },
  planChoices: { gap: spacing.xs },
  planChoice: { minHeight: 46, flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.sm, borderRadius: borderRadius.medium, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border },
  planChoiceSelected: { borderColor: palette.sage, backgroundColor: palette.sagePale },
  planChoiceCopy: { flex: 1 },
  planTitle: { color: palette.textPrimary, fontSize: 9, fontWeight: '700' },
  planDetail: { color: palette.textSecondary, fontSize: 7, marginTop: 2 },
  planPrice: { color: palette.sage, fontSize: 9, fontWeight: '700' },
  planRadio: { width: 15, height: 15, alignItems: 'center', justifyContent: 'center', borderRadius: 8, borderWidth: 1, borderColor: palette.textSecondary },
  planRadioSelected: { borderColor: palette.sage },
  planRadioDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: palette.sage },
  unavailableCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, marginTop: spacing.sm, borderRadius: borderRadius.medium, backgroundColor: palette.peachLight },
  unavailableIcon: { color: palette.clay, fontSize: 14 },
  unavailableTitle: { color: palette.textPrimary, fontSize: 8, fontWeight: '700' },
  unavailableDetail: { color: palette.textSecondary, fontSize: 7, lineHeight: 10, marginTop: 2 },
  purchaseButton: { width: '100%', minHeight: 38, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.sm, marginTop: spacing.xs, borderRadius: borderRadius.extraLarge, backgroundColor: palette.sage },
  purchaseButtonText: { color: palette.surface, fontSize: 9, fontWeight: '700', textAlign: 'center' },
  freeContinueButton: { minHeight: 36, alignItems: 'center', justifyContent: 'center', marginTop: spacing.xs, borderRadius: borderRadius.extraLarge, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border },
  freeContinueText: { color: palette.sage, fontSize: 8, fontWeight: '700' },
  renewalNote: { color: palette.textSecondary, fontSize: 7, lineHeight: 11, textAlign: 'center', marginTop: spacing.xs },
  restoreButton: { alignSelf: 'center', padding: spacing.md },
  legalLinks: { flexDirection: 'row', justifyContent: 'center', gap: spacing.md, marginTop: spacing.xs },
  restoreText: { color: palette.sage, fontSize: 8, fontWeight: '600' },
  previewCard: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm, padding: spacing.md, borderRadius: borderRadius.medium, backgroundColor: palette.peachLight, borderWidth: 1, borderColor: palette.secondary, marginTop: spacing.lg },
  previewCopy: { flex: 1, minWidth: '55%', gap: 4 },
  previewTitle: { color: palette.textPrimary, fontSize: 11, fontWeight: '700' },
  previewDetail: { color: palette.textSecondary, fontSize: 9, lineHeight: 14 },
  previewButton: { minWidth: 82, minHeight: 34, alignItems: 'center', justifyContent: 'center', borderRadius: borderRadius.extraLarge, borderWidth: 1, borderColor: palette.clay, paddingHorizontal: spacing.sm },
  previewButtonActive: { backgroundColor: palette.clay },
  previewButtonText: { color: palette.clay, fontSize: 9, fontWeight: '700' },
  previewButtonTextActive: { color: palette.surface },
  previewNotice: { width: '100%', color: palette.clay, fontSize: 8, letterSpacing: 0.6, fontWeight: '700' },
  dailySummaryCard: { padding: spacing.sm, marginTop: spacing.md, borderRadius: borderRadius.medium, backgroundColor: palette.sagePale },
  dailySummaryHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.xs },
  dailySummaryTitle: { flex: 1, color: palette.textPrimary, fontSize: 8, fontWeight: '700' },
  dailySummaryPercent: { color: palette.sage, fontSize: 8, fontWeight: '700' },
  dailyProgressTrack: { height: 5, overflow: 'hidden', borderRadius: borderRadius.extraLarge, backgroundColor: palette.border, marginTop: spacing.xs },
  dailyProgressFill: { height: '100%', borderRadius: borderRadius.extraLarge, backgroundColor: palette.sage },
  dailySummaryNote: { color: palette.textSecondary, fontSize: 7, marginTop: spacing.xs, textTransform: 'capitalize' },
  ritualCard: { padding: spacing.sm, marginBottom: spacing.xs, borderRadius: borderRadius.medium, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border },
  ritualHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  ritualIcon: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center', borderRadius: 9, backgroundColor: palette.sagePale },
  ritualIconText: { color: palette.sage, fontSize: 14 },
  ritualCopy: { flex: 1, minWidth: 0 },
  ritualTitle: { color: palette.textPrimary, fontSize: 8, fontWeight: '700' },
  ritualSchedule: { color: palette.textSecondary, fontSize: 7, marginTop: 3 },
  editHabit: { color: palette.sage, fontSize: 16 },
  ritualMeta: { color: palette.textSecondary, fontSize: 7, marginTop: spacing.xs },
  ritualAction: { minHeight: 32, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.sm, marginTop: spacing.sm, borderRadius: borderRadius.extraLarge, backgroundColor: palette.sagePale },
  ritualActionDone: { backgroundColor: palette.sage },
  ritualActionDisabled: { opacity: 0.7 },
  ritualActionText: { color: palette.sage, fontSize: 8, fontWeight: '700' },
  ritualActionTextDone: { color: palette.surface },
  emptyHabitsCard: { padding: spacing.md, borderRadius: borderRadius.medium, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border },
  emptyHabitsText: { color: palette.textSecondary, fontSize: 9 },
  createHabitButton: { minHeight: 40, alignItems: 'center', justifyContent: 'center', marginTop: spacing.xs, borderRadius: borderRadius.extraLarge, backgroundColor: palette.sage },
  createHabitText: { color: palette.surface, fontSize: 9, fontWeight: '700' },
  habitsFootnote: { color: palette.textSecondary, fontSize: 7, lineHeight: 11, marginTop: spacing.sm },
});
