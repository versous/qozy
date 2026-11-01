import { typography } from '@/theme/typography';
import React, { useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { useHabits } from '@/hooks/useHabits';
import { useMonthlyGoals } from '@/hooks/useMonthlyGoals';
import { useTasks } from '@/hooks/useTasks';
import { usePremium } from '@/services/PremiumProvider';
import { borderRadius, spacing, type AppColors } from '@/theme/colors';
import { useAppTheme } from '@/theme/ThemeProvider';

const termsUrl = process.env.EXPO_PUBLIC_TERMS_OF_USE_URL;
const privacyUrl = process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL;

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
  const { allHabits, loading: habitsLoading, error: habitsError } = useHabits();
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
  const hasCurrentDraft = goalDraft?.monthKey === monthKey;
  const habitTarget = hasCurrentDraft ? goalDraft.habitTarget : goal?.habitTarget ?? 20;
  const taskTarget = hasCurrentDraft ? goalDraft.taskTarget : goal?.taskTarget ?? 8;

  const weekStart = new Date(`${todayKey}T00:00:00`);
  weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const weeklyHabits = getHabitSummary(allHabits, weekStart, now);
  const monthlyHabits = getHabitSummary(allHabits, monthStart, now);
  const weeklyTasks = getTaskSummary(tasks, weekStart, now);
  const monthlyTasks = getTaskSummary(tasks, monthStart, now);
  const weekLabel = `${weekStart.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })} – ${now.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}`;
  const monthLabel = now.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

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

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Retour"
          onPress={() => router.back()}
          style={styles.backButton}>
          <Text style={styles.backText}>‹  Retour</Text>
        </Pressable>

        <Text style={styles.eyebrow}>QOZY PREMIUM</Text>
        <Text style={styles.title}>
          {isPremium ? 'Tes repères dans le temps.' : 'Avance avec plus de clarté.'}
        </Text>
        <Text style={styles.subtitle}>
          Des bilans concrets pour célébrer tes progrès, sans pression.
        </Text>

        {canPreview ? (
          <View style={styles.previewCard}>
            <View style={styles.previewCopy}>
              <Text style={styles.previewTitle}>Aperçu développeur</Text>
              <Text style={styles.previewDetail}>
                Active Premium pour tester les bilans, objectifs et morceaux réservés. Cela ne crée aucun achat.
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

        {isPremium ? (
          <>
            <View style={styles.sectionHeading}>
              <Text style={styles.sectionTitle}>Cette semaine</Text>
              <Text style={styles.sectionMeta}>{weekLabel}</Text>
            </View>
            <View style={styles.reportCard}>
              <Text style={styles.cardEyebrow}>TON BILAN HEBDOMADAIRE</Text>
              <MetricRow
                label="Habitudes réalisées"
                value={`${weeklyHabits.completed} / ${weeklyHabits.planned}`}
                percent={getPercent(weeklyHabits.completed, weeklyHabits.planned)}
                styles={styles}
                colors={colors}
              />
              <MetricRow
                label="Petits pas du calendrier"
                value={`${weeklyTasks.completed} / ${weeklyTasks.planned}`}
                percent={getPercent(weeklyTasks.completed, weeklyTasks.planned)}
                styles={styles}
                colors={colors}
              />
            </View>

            <View style={styles.sectionHeading}>
              <Text style={styles.sectionTitle}>Progression du mois</Text>
              <Text style={styles.sectionMeta}>{monthLabel}</Text>
            </View>
            <View style={styles.reportCard}>
              <MetricRow
                label="Rendez-vous avec tes habitudes"
                value={`${monthlyHabits.completed} / ${monthlyHabits.planned}`}
                percent={getPercent(monthlyHabits.completed, monthlyHabits.planned)}
                styles={styles}
                colors={colors}
              />
              <MetricRow
                label="Petits pas prévus"
                value={`${monthlyTasks.completed} / ${monthlyTasks.planned}`}
                percent={getPercent(monthlyTasks.completed, monthlyTasks.planned)}
                styles={styles}
                colors={colors}
              />
              <Text style={styles.helperText}>
                Les petits pas sont comptés selon leur date prévue et leur état actuel.
              </Text>
            </View>
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
                onPress={() => router.push('/weekly-review')}
                style={styles.featureLink}>
                <View style={styles.featureLinkCopy}>
                  <Text style={styles.featureLinkTitle}>Bilan hebdomadaire</Text>
                  <Text style={styles.featureLinkSubtitle}>Voir mon cercle de progression du mois</Text>
                </View>
                <Text style={styles.featureLinkArrow}>›</Text>
              </Pressable>
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
            <View style={styles.benefitCard}>
              <FeatureRow title="Bilan hebdomadaire" detail="Retrouve les petits pas accomplis cette semaine." styles={styles} />
              <FeatureRow title="Progression du mois" detail="Visualise tes habitudes et tes petits pas au fil des jours." styles={styles} />
              <FeatureRow title="Calendrier de chaque activité" detail="Repère tes jours actifs dans une vue annuelle." styles={styles} />
              <FeatureRow title="Petits moments personnalisés" detail="Crée et modifie tes propres activités, avec tes photos et leurs étapes." styles={styles} />
              <FeatureRow title="Bibliothèque musicale étendue" detail="Débloque des titres Lofi et de méditation supplémentaires. Deux morceaux de chaque catégorie restent inclus en Standard." styles={styles} />
              <FeatureRow title="Historique d’hydratation" detail="Retrouve tes volumes d’eau enregistrés au fil des jours." styles={styles} />
              <FeatureRow title="Objectifs du mois" detail="Choisis un cap doux et suis ta progression." styles={styles} />
            </View>

            <Text style={styles.planHeading}>Choisis ton rythme</Text>
            <View style={styles.planCard}>
              <View style={styles.planCopy}>
                <Text style={styles.planTitle}>Mensuel</Text>
                <Text style={styles.planDetail}>Renouvellement chaque mois</Text>
              </View>
              {monthlyPackage ? (
                <Text style={styles.price}>{monthlyPackage.product.priceString}</Text>
              ) : <Text style={styles.priceUnavailable}>Indisponible</Text>}
              <Pressable
                accessibilityRole="button"
                disabled={!monthlyPackage || purchaseUnavailable}
                onPress={() => void handlePurchase(monthlyPackage)}
                style={[styles.purchaseButton, (!monthlyPackage || purchaseUnavailable) && styles.disabledButton]}>
                <Text style={styles.purchaseButtonText}>
                  {isPurchasing ? 'Achat en cours…' : 'Choisir le mensuel'}
                </Text>
              </Pressable>
            </View>

            <View style={[styles.planCard, styles.annualCard]}>
              <View style={styles.planCopy}>
                <Text style={styles.planTitle}>Annuel</Text>
                <Text style={styles.planDetail}>Renouvellement chaque année</Text>
              </View>
              {annualPackage ? (
                <Text style={styles.price}>{annualPackage.product.priceString}</Text>
              ) : <Text style={styles.priceUnavailable}>Indisponible</Text>}
              <Pressable
                accessibilityRole="button"
                disabled={!annualPackage || purchaseUnavailable}
                onPress={() => void handlePurchase(annualPackage)}
                style={[styles.purchaseButton, (!annualPackage || purchaseUnavailable) && styles.disabledButton]}>
                <Text style={styles.purchaseButtonText}>
                  {isPurchasing ? 'Achat en cours…' : 'Choisir l’annuel'}
                </Text>
              </Pressable>
            </View>

            <Text style={styles.renewalNote}>
              Le paiement est confirmé par ta boutique et l’abonnement se renouvelle automatiquement.
              Tu peux le gérer ou l’annuler depuis les réglages de ton compte App Store ou Google Play.
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
            {message ? <Text style={styles.errorText}>{message}</Text> : null}
            <Pressable
              accessibilityRole="button"
              disabled={isPurchasing || status === 'unavailable'}
              onPress={() => void restore()}
              style={styles.restoreButton}>
              <Text style={styles.restoreText}>Restaurer mes achats</Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function MetricRow({
  label,
  value,
  percent,
  styles,
  colors,
}: {
  label: string;
  value: string;
  percent: number;
  styles: ReturnType<typeof createStyles>;
  colors: AppColors;
}) {
  return (
    <View style={styles.metric}>
      <View style={styles.metricHeading}>
        <Text style={styles.metricLabel}>{label}</Text>
        <Text style={styles.metricValue}>{value}</Text>
      </View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${percent}%`, backgroundColor: colors.sage }]} />
      </View>
    </View>
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

function FeatureRow({
  title,
  detail,
  styles,
}: {
  title: string;
  detail: string;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.featureRow}>
      <View style={styles.featureIcon}><Text style={styles.featureIconText}>✓</Text></View>
      <View style={styles.featureCopy}>
        <Text style={styles.featureTitle}>{title}</Text>
        <Text style={styles.featureDetail}>{detail}</Text>
      </View>
    </View>
  );
}

const createStyles = (palette: AppColors) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.background },
  content: { padding: spacing.md, paddingBottom: spacing.xl },
  backButton: { alignSelf: 'flex-start', marginBottom: spacing.md },
  backText: { color: palette.sage, fontSize: 13, fontWeight: '600' },
  eyebrow: { color: palette.sage, fontSize: 9, letterSpacing: 1.2, fontWeight: '700' },
  title: { color: palette.textPrimary, fontSize: 27, lineHeight: 34, fontFamily: typography.fonts.display, fontWeight: '600', marginTop: 6 },
  subtitle: { color: palette.textSecondary, fontSize: 12, lineHeight: 19, marginTop: 7 },
  sectionHeading: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: spacing.sm, marginTop: spacing.lg, marginBottom: spacing.sm },
  sectionTitle: { color: palette.textPrimary, fontSize: 16, fontFamily: typography.fonts.display, fontWeight: '600' },
  sectionMeta: { color: palette.textSecondary, fontSize: 9 },
  reportCard: { padding: spacing.md, borderRadius: borderRadius.medium, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border, gap: spacing.md },
  cardEyebrow: { color: palette.sage, fontSize: 8, letterSpacing: 1, fontWeight: '700' },
  metric: { gap: 7 },
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
  benefitCard: { padding: spacing.md, borderRadius: borderRadius.medium, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border, marginTop: spacing.lg },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm },
  featureIcon: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center', borderRadius: 15, backgroundColor: palette.sagePale },
  featureIconText: { color: palette.sage, fontSize: 13, fontWeight: '700' },
  featureCopy: { flex: 1, gap: 3 },
  featureTitle: { color: palette.textPrimary, fontSize: 12, fontWeight: '700' },
  featureDetail: { color: palette.textSecondary, fontSize: 10, lineHeight: 15 },
  featureLinks: { gap: spacing.sm, marginTop: spacing.md },
  featureLink: { minHeight: 62, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, borderRadius: borderRadius.medium, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border },
  featureLinkCopy: { flex: 1, gap: 3 },
  featureLinkTitle: { color: palette.textPrimary, fontSize: 11, fontWeight: '700' },
  featureLinkSubtitle: { color: palette.textSecondary, fontSize: 9 },
  featureLinkArrow: { color: palette.sage, fontSize: 22 },
  planHeading: { color: palette.textPrimary, fontSize: 16, fontFamily: typography.fonts.display, fontWeight: '600', marginTop: spacing.lg, marginBottom: spacing.sm },
  planCard: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm, padding: spacing.md, borderRadius: borderRadius.medium, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border, marginBottom: spacing.sm },
  annualCard: { borderColor: palette.sage },
  planCopy: { flex: 1, minWidth: '50%' },
  planTitle: { color: palette.textPrimary, fontSize: 13, fontWeight: '700' },
  planDetail: { color: palette.textSecondary, fontSize: 9, marginTop: 3 },
  price: { color: palette.sage, fontSize: 15, fontWeight: '700' },
  priceUnavailable: { color: palette.textLight, fontSize: 10 },
  purchaseButton: { width: '100%', minHeight: 42, alignItems: 'center', justifyContent: 'center', borderRadius: borderRadius.extraLarge, backgroundColor: palette.sage },
  purchaseButtonText: { color: palette.surface, fontSize: 11, fontWeight: '700' },
  renewalNote: { color: palette.textSecondary, fontSize: 9, lineHeight: 14, marginTop: spacing.xs },
  restoreButton: { alignSelf: 'center', padding: spacing.md },
  legalLinks: { flexDirection: 'row', justifyContent: 'center', gap: spacing.md, marginTop: spacing.sm },
  restoreText: { color: palette.sage, fontSize: 11, fontWeight: '600' },
  previewCard: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm, padding: spacing.md, borderRadius: borderRadius.medium, backgroundColor: palette.peachLight, borderWidth: 1, borderColor: palette.secondary, marginTop: spacing.lg },
  previewCopy: { flex: 1, minWidth: '55%', gap: 4 },
  previewTitle: { color: palette.textPrimary, fontSize: 11, fontWeight: '700' },
  previewDetail: { color: palette.textSecondary, fontSize: 9, lineHeight: 14 },
  previewButton: { minWidth: 82, minHeight: 34, alignItems: 'center', justifyContent: 'center', borderRadius: borderRadius.extraLarge, borderWidth: 1, borderColor: palette.clay, paddingHorizontal: spacing.sm },
  previewButtonActive: { backgroundColor: palette.clay },
  previewButtonText: { color: palette.clay, fontSize: 9, fontWeight: '700' },
  previewButtonTextActive: { color: palette.surface },
  previewNotice: { width: '100%', color: palette.clay, fontSize: 8, letterSpacing: 0.6, fontWeight: '700' },
});
