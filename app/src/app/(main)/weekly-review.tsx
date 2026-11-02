import { typography } from '@/theme/typography';
import React, { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { BottomNavigation } from '@/components/BottomNavigation';
import { BrandHeader } from '@/components/BrandHeader';
import { useExercises, isExerciseScheduledOnDate } from '@/hooks/useExercises';
import { useHabits, type Habit } from '@/hooks/useHabits';
import { useHydration } from '@/hooks/useHydration';
import { useTasks, type TodoTask } from '@/hooks/useTasks';
import { useTimeTracking, type TimeCategory, type TimeEntry } from '@/hooks/useTimeTracking';
import { usePremium } from '@/services/PremiumProvider';
import { borderRadius, spacing, type AppColors } from '@/theme/colors';
import { useAppTheme } from '@/theme/ThemeProvider';

type ReviewPeriod = 'day' | 'week' | 'month';

const CATEGORY_COLORS: Record<TimeCategory, string> = {
  code: '#667F62',
  study: '#667F62',
  leisure: '#B76548',
  wellbeing: '#9BAE85',
  admin: '#D5AA70',
  other: '#858B7E',
};

function getDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function getPeriodRange(today: Date, period: ReviewPeriod) {
  const end = new Date(today);
  end.setHours(23, 59, 59, 999);
  const start = new Date(today);
  start.setHours(0, 0, 0, 0);
  if (period === 'week') start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  if (period === 'month') start.setDate(1);
  return { start, end };
}

function formatPeriodDate(today: Date, period: ReviewPeriod) {
  if (period === 'day') {
    return today.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }
  if (period === 'month') {
    return today.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  }
  const { start } = getPeriodRange(today, period);
  return `${start.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} – ${today.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}`;
}

function getHabitSummary(habits: Habit[], start: Date, end: Date) {
  let planned = 0;
  let completed = 0;
  const date = new Date(start);
  while (date <= end) {
    const dateKey = getDateKey(date);
    habits.forEach((habit) => {
      if (!habit.frequencyDays.includes(date.getDay() as 0 | 1 | 2 | 3 | 4 | 5 | 6)) return;
      planned += 1;
      if (habit.completedDates.includes(dateKey)) completed += 1;
    });
    date.setDate(date.getDate() + 1);
  }
  return { planned, completed };
}

function getTaskSummary(tasks: TodoTask[], start: Date, end: Date) {
  const startKey = getDateKey(start);
  const endKey = getDateKey(end);
  const planned = tasks.filter((task) => task.dueDate && task.dueDate >= startKey && task.dueDate <= endKey);
  return { planned: planned.length, completed: planned.filter((task) => task.completed).length };
}

function getExerciseSummary(
  exercises: ReturnType<typeof useExercises>['exercises'],
  start: Date,
  end: Date
) {
  let planned = 0;
  let completed = 0;
  const date = new Date(start);
  while (date <= end) {
    const dateKey = getDateKey(date);
    exercises.forEach((exercise) => {
      if (!isExerciseScheduledOnDate(exercise, dateKey)) return;
      planned += 1;
      if ((exercise.completedDates ?? []).includes(dateKey) || exercise.completedDate === dateKey) completed += 1;
    });
    date.setDate(date.getDate() + 1);
  }
  return { planned, completed };
}

function getPercent(completed: number, planned: number) {
  return planned > 0 ? Math.min(100, Math.round((completed / planned) * 100)) : 0;
}

function formatMinutes(seconds: number) {
  const minutes = Math.round(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (hours && remainder) return `${hours} h ${remainder} min`;
  if (hours) return `${hours} h`;
  return `${minutes} min`;
}

function getCategoryLabel(categoryId: TimeCategory) {
  const labels: Record<TimeCategory, string> = {
    code: 'Créatif',
    study: 'Études',
    leisure: 'Loisirs',
    wellbeing: 'Bien-être',
    admin: 'Organisation',
    other: 'Autre',
  };
  return labels[categoryId];
}

function getTimeEntryDate(entry: TimeEntry) {
  return getDateKey(entry.startedAt.toDate());
}

export default function WeeklyReviewScreen() {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const { isPremium, status: premiumStatus } = usePremium();
  const { allHabits, loading: habitsLoading, error: habitsError } = useHabits();
  const { exercises, loading: exercisesLoading, error: exercisesError } = useExercises();
  const { tasks, loading: tasksLoading, error: tasksError } = useTasks();
  const { entries, loading: timeLoading, error: timeError } = useTimeTracking();
  const hydration = useHydration();
  const [period, setPeriod] = useState<ReviewPeriod>('day');
  const today = new Date();
  const { start, end } = getPeriodRange(today, period);
  const startKey = getDateKey(start);
  const endKey = getDateKey(end);
  const rangeLabel = formatPeriodDate(today, period);

  const taskSummary = getTaskSummary(tasks, start, end);
  const habitSummary = getHabitSummary(allHabits, start, end);
  const exerciseSummary = getExerciseSummary(exercises, start, end);
  const periodTimeEntries = entries.filter((entry) => {
    const date = getTimeEntryDate(entry);
    return date >= startKey && date <= endKey;
  });
  const pumpSummary = getExerciseSummary(
    exercises.filter((exercise) => exercise.name.toLocaleLowerCase('fr-FR').includes('pompe')),
    start,
    end
  );
  const totalTimeSeconds = periodTimeEntries.reduce((sum, entry) => sum + entry.durationSeconds, 0);
  const timeByCategory = periodTimeEntries.reduce<Record<string, { seconds: number; project: string }>>((result, entry) => {
    const existing = result[entry.category] ?? { seconds: 0, project: entry.project };
    result[entry.category] = {
      seconds: existing.seconds + entry.durationSeconds,
      project: existing.project || entry.project,
    };
    return result;
  }, {});
  const categories = Object.entries(timeByCategory).sort((a, b) => b[1].seconds - a[1].seconds);
  const completeLoading = habitsLoading || tasksLoading || exercisesLoading || timeLoading || hydration.loading;
  const rangeHydrationEntries = hydration.entries.filter((entry) => entry.date >= startKey && entry.date <= endKey);
  const waterTotal = rangeHydrationEntries.reduce((sum, entry) => sum + entry.milliliters, 0);
  const waterPercent = getPercent(waterTotal, hydration.dailyGoalMilliliters * (
    Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1)
  ));
  const tasksPercent = getPercent(taskSummary.completed, taskSummary.planned);
  const habitsPercent = getPercent(habitSummary.completed, habitSummary.planned);
  const exercisesPercent = getPercent(exerciseSummary.completed, exerciseSummary.planned);
  const displayedHabits = allHabits.filter((habit) => {
    const scheduled = habit.frequencyDays.some((day) => {
      const date = new Date(start);
      while (date <= end) {
        if (date.getDay() === day) return true;
        date.setDate(date.getDate() + 1);
      }
      return false;
    });
    return scheduled;
  }).slice(0, 3);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <BrandHeader />
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>‹  Mon compte</Text>
        </Pressable>
        <Text style={styles.eyebrow}>QOZY PREMIUM</Text>
        <Text style={styles.title}>Mes petits progrès</Text>
        <Text style={styles.subtitle}>Prendre du recul, accueillir le chemin.</Text>

        {premiumStatus === 'loading' ? (
          <ActivityIndicator color={colors.sage} style={styles.loader} />
        ) : !isPremium ? (
          <View style={styles.lockedCard}>
            <View style={styles.lockedBadge}>
              <Text style={styles.lockedBadgeText}>✦ PREMIUM</Text>
            </View>
            <Text style={styles.lockedTitle}>Tous tes progrès, réunis au même endroit</Text>
            <Text style={styles.lockedText}>
              Retrouve le temps consacré à tes projets, tes habitudes, tes tâches, tes exercices et ton hydratation sur une période de ton choix.
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/premium')}
              style={styles.lockedButton}>
              <Text style={styles.lockedButtonText}>Découvrir Premium</Text>
            </Pressable>
          </View>
        ) : (
          <>
        <View style={styles.periodTabs}>
          {([
            ['day', 'Jour'],
            ['week', 'Semaine'],
            ['month', 'Mois'],
          ] as const).map(([key, label]) => (
            <Pressable
              key={key}
              accessibilityRole="tab"
              accessibilityState={{ selected: period === key }}
              onPress={() => setPeriod(key)}
              style={[styles.periodTab, period === key && styles.periodTabSelected]}>
              <Text style={[styles.periodTabText, period === key && styles.periodTabTextSelected]}>{label}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.dateCard}>
          <Text style={styles.dateTitle}>{rangeLabel}</Text>
          <Text style={styles.dateNote}>
            Ton temps en cours n’est pas inclus dans le bilan. Chaque progrès compte, sans pression.
          </Text>
        </View>

        {completeLoading ? (
          <ActivityIndicator color={colors.sage} style={styles.loader} />
        ) : (
          <>
            <View style={styles.sectionHeading}>
              <Text style={styles.sectionTitle}>Le temps qui compte</Text>
              <Text style={styles.sectionMeta}>{formatMinutes(totalTimeSeconds)}</Text>
            </View>
            <View style={styles.timeCard}>
              <Text style={styles.cardLead}>
                {formatMinutes(totalTimeSeconds)} enregistrées · {periodTimeEntries.length} {periodTimeEntries.length === 1 ? 'session' : 'sessions'}
              </Text>
              {categories.length ? (
                <>
                  <View style={styles.stackedBar}>
                    {categories.map(([category, value]) => (
                      <View
                        key={category}
                        style={[
                          styles.stackedSegment,
                          {
                            flex: value.seconds,
                            backgroundColor: CATEGORY_COLORS[category as TimeCategory] ?? colors.sage,
                          },
                        ]}
                      />
                    ))}
                  </View>
                  {categories.map(([category, value]) => (
                    <View key={category} style={styles.timeCategoryRow}>
                      <View style={styles.timeCategoryCopy}>
                        <View style={[styles.categoryDot, { backgroundColor: CATEGORY_COLORS[category as TimeCategory] ?? colors.sage }]} />
                        <View style={styles.categoryTextWrap}>
                          <Text style={styles.categoryTitle}>{getCategoryLabel(category as TimeCategory)}</Text>
                          {value.project ? <Text style={styles.categoryProject}>Projet {value.project}</Text> : null}
                        </View>
                      </View>
                      <Text style={styles.categoryDuration}>{formatMinutes(value.seconds)}</Text>
                    </View>
                  ))}
                </>
              ) : (
                <Text style={styles.emptyHint}>Aucune session terminée sur cette période.</Text>
              )}
            </View>

            <View style={styles.statGrid}>
              <View style={styles.statCard}>
                <Text style={styles.statFraction}>{taskSummary.completed} / {taskSummary.planned}</Text>
                <Text style={styles.statTitle}>Tâches terminées</Text>
                <Text style={styles.statHint}>{tasksPercent} % des tâches prévues</Text>
              </View>
              <View style={[styles.statCard, styles.statCardTinted]}>
                <Text style={styles.statFraction}>{habitSummary.completed} / {habitSummary.planned}</Text>
                <Text style={styles.statTitle}>Habitudes validées</Text>
                <Text style={styles.statHint}>{habitsPercent} % des habitudes prévues</Text>
              </View>
            </View>

            <View style={styles.sectionHeading}>
              <Text style={styles.sectionTitle}>La régularité en douceur</Text>
            </View>
            <View style={styles.habitsCard}>
              {displayedHabits.length ? displayedHabits.map((habit) => {
                const summary = getHabitSummary([habit], start, end);
                const percent = getPercent(summary.completed, summary.planned);
                return (
                  <View key={habit.id} style={styles.habitRow}>
                    <View style={styles.habitHeader}>
                      <Text style={styles.habitTitle}>{habit.title}</Text>
                      <Text style={styles.habitPlan}>{summary.planned} {summary.planned === 1 ? 'jour prévu' : 'jours prévus'}</Text>
                    </View>
                    <View style={styles.habitTrack}>
                      <View style={[styles.habitFill, { width: `${percent}%` }]} />
                    </View>
                    <Text style={styles.habitFooter}>
                      {summary.completed} validation{summary.completed === 1 ? '' : 's'} / {summary.planned} prévues
                    </Text>
                  </View>
                );
              }) : (
                <Text style={styles.emptyHint}>Ajoute une habitude pour suivre ta régularité.</Text>
              )}
            </View>

            <View style={styles.sectionHeading}>
              <Text style={styles.sectionTitle}>Corps et bien-être</Text>
            </View>
            <View style={styles.wellbeingCard}>
              <SummaryRow
                icon="⌁"
                title={`Exercices · ${exerciseSummary.completed} sur ${exerciseSummary.planned} réalisés`}
                subtitle="Réveil du corps, dos et pompes validés"
                value={`${exercisesPercent} %`}
                styles={styles}
                onPress={() => router.push('/exercise')}
              />
              <SummaryRow
                icon="↗"
                title={`Pompes · ${pumpSummary.completed} séances validées`}
                subtitle={pumpSummary.planned ? `Dernier suivi · ${getPercent(pumpSummary.completed, pumpSummary.planned)} %` : 'Ajoute une activité pompes pour la retrouver ici.'}
                value={pumpSummary.planned ? `+${pumpSummary.completed}` : '—'}
                styles={styles}
                onPress={() => router.push('/movement')}
              />
              <SummaryRow
                icon="♧"
                title={`Hydratation · ${waterTotal.toLocaleString('fr-FR')} ml / ${(hydration.dailyGoalMilliliters * (period === 'day' ? 1 : period === 'week' ? 7 : today.getDate())).toLocaleString('fr-FR')} ml`}
                subtitle={`${rangeHydrationEntries.length} prise${rangeHydrationEntries.length === 1 ? '' : 's'} d’eau · Repère quotidien : ${hydration.dailyGoalMilliliters.toLocaleString('fr-FR')} ml`}
                value={`${waterPercent} %`}
                styles={styles}
                onPress={() => router.push('/hydration')}
              />
            </View>
          </>
        )}

        <View style={styles.premiumCard}>
          <Text style={styles.premiumIcon}>✧</Text>
          <View style={styles.premiumCopy}>
            <Text style={styles.premiumTitle}>Ton espace de progression</Text>
            <Text style={styles.premiumText}>Merci de faire partie de Qozy Premium. Continue à célébrer chaque petit pas.</Text>
          </View>
        </View>
        {habitsError || tasksError || exercisesError || timeError || hydration.error ? (
          <Text style={styles.errorText}>{habitsError || tasksError || exercisesError || timeError || hydration.error}</Text>
        ) : null}
          </>
        )}
      </ScrollView>
      <BottomNavigation active="account" />
    </SafeAreaView>
  );
}

function SummaryRow({
  icon,
  title,
  subtitle,
  value,
  styles,
  onPress,
}: {
  icon: string;
  title: string;
  subtitle: string;
  value: string;
  styles: ReturnType<typeof createStyles>;
  onPress: () => void;
}) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.summaryRow}>
      <View style={styles.summaryIcon}><Text style={styles.summaryIconText}>{icon}</Text></View>
      <View style={styles.summaryCopy}>
        <Text numberOfLines={1} style={styles.summaryTitle}>{title}</Text>
        <Text numberOfLines={1} style={styles.summarySubtitle}>{subtitle}</Text>
      </View>
      <Text style={styles.summaryValue}>{value}</Text>
    </Pressable>
  );
}

const createStyles = (palette: AppColors) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.background },
  content: { padding: spacing.md, paddingBottom: spacing.lg },
  backButton: { alignSelf: 'flex-start', marginTop: spacing.sm, marginBottom: spacing.md },
  backText: { color: palette.sage, fontSize: 9, fontWeight: '700' },
  eyebrow: { color: palette.sage, fontSize: 8, letterSpacing: 1.1, fontWeight: '700' },
  title: { color: palette.textPrimary, fontSize: 24, lineHeight: 31, fontFamily: typography.fonts.display, fontWeight: '600', marginTop: spacing.xs },
  subtitle: { color: palette.textSecondary, fontSize: 9, lineHeight: 14, marginTop: 2 },
  periodTabs: { flexDirection: 'row', padding: 3, marginTop: spacing.md, borderRadius: borderRadius.extraLarge, backgroundColor: palette.sagePale },
  periodTab: { flex: 1, minHeight: 33, alignItems: 'center', justifyContent: 'center', borderRadius: borderRadius.extraLarge },
  periodTabSelected: { backgroundColor: palette.sage },
  periodTabText: { color: palette.textSecondary, fontSize: 8, fontWeight: '700' },
  periodTabTextSelected: { color: palette.surface },
  dateCard: { padding: spacing.sm, marginTop: spacing.md, borderRadius: borderRadius.medium, backgroundColor: palette.sagePale },
  dateTitle: { color: palette.textPrimary, fontSize: 9, fontWeight: '700', textTransform: 'capitalize' },
  dateNote: { color: palette.textSecondary, fontSize: 7, lineHeight: 11, marginTop: spacing.xs },
  sectionHeading: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: spacing.sm, marginTop: spacing.md, marginBottom: spacing.xs },
  sectionTitle: { color: palette.textPrimary, fontSize: 14, fontFamily: typography.fonts.display, fontWeight: '600' },
  sectionMeta: { color: palette.sage, fontSize: 8, fontWeight: '700' },
  timeCard: { padding: spacing.sm, borderRadius: borderRadius.medium, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border },
  cardLead: { color: palette.textPrimary, fontSize: 8, fontWeight: '700', marginBottom: spacing.xs },
  stackedBar: { height: 12, flexDirection: 'row', gap: 2, overflow: 'hidden', borderRadius: borderRadius.extraLarge, marginBottom: spacing.xs },
  stackedSegment: { height: '100%', borderRadius: borderRadius.extraLarge },
  timeCategoryRow: { minHeight: 32, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.xs },
  timeCategoryCopy: { flex: 1, flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs },
  categoryDot: { width: 7, height: 7, borderRadius: 2, marginTop: 3 },
  categoryTextWrap: { flex: 1 },
  categoryTitle: { color: palette.textPrimary, fontSize: 8, fontWeight: '700' },
  categoryProject: { color: palette.textSecondary, fontSize: 7, marginTop: 2 },
  categoryDuration: { color: palette.textPrimary, fontSize: 8, fontWeight: '700' },
  emptyHint: { color: palette.textSecondary, fontSize: 8, lineHeight: 13, paddingVertical: spacing.xs },
  statGrid: { flexDirection: 'row', gap: spacing.xs, marginTop: spacing.sm },
  statCard: { flex: 1, minHeight: 85, justifyContent: 'center', padding: spacing.sm, borderRadius: borderRadius.medium, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border },
  statCardTinted: { backgroundColor: palette.sagePale, borderColor: palette.sagePale },
  statFraction: { color: palette.textPrimary, fontSize: 23, fontFamily: typography.fonts.display, lineHeight: 28 },
  statTitle: { color: palette.textPrimary, fontSize: 8, fontWeight: '700', marginTop: 2 },
  statHint: { color: palette.textSecondary, fontSize: 7, marginTop: 5 },
  habitsCard: { paddingHorizontal: spacing.sm, borderRadius: borderRadius.medium, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border },
  habitRow: { paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: palette.border },
  habitHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.xs },
  habitTitle: { flex: 1, color: palette.textPrimary, fontSize: 8, fontWeight: '700' },
  habitPlan: { color: palette.sage, fontSize: 7, fontWeight: '700' },
  habitTrack: { height: 5, overflow: 'hidden', borderRadius: borderRadius.extraLarge, backgroundColor: palette.sagePale, marginTop: spacing.xs },
  habitFill: { height: '100%', borderRadius: borderRadius.extraLarge, backgroundColor: palette.sage },
  habitFooter: { color: palette.textSecondary, fontSize: 7, marginTop: spacing.xs },
  wellbeingCard: { gap: spacing.xs },
  summaryRow: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.xs, borderRadius: borderRadius.medium, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border },
  summaryIcon: { width: 29, height: 29, alignItems: 'center', justifyContent: 'center', borderRadius: 9, backgroundColor: palette.sagePale },
  summaryIconText: { color: palette.sage, fontSize: 14 },
  summaryCopy: { flex: 1, minWidth: 0 },
  summaryTitle: { color: palette.textPrimary, fontSize: 7, fontWeight: '700' },
  summarySubtitle: { color: palette.textSecondary, fontSize: 6, marginTop: 3 },
  summaryValue: { color: palette.sage, fontSize: 8, fontWeight: '700' },
  premiumCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, marginTop: spacing.md, borderRadius: borderRadius.medium, backgroundColor: palette.sagePale },
  premiumIcon: { color: palette.sage, fontSize: 18 },
  premiumCopy: { flex: 1 },
  premiumTitle: { color: palette.textPrimary, fontSize: 8, fontWeight: '700' },
  premiumText: { color: palette.textSecondary, fontSize: 7, lineHeight: 11, marginTop: 3 },
  premiumArrow: { color: palette.sage, fontSize: 17 },
  lockedCard: { padding: spacing.md, marginTop: spacing.lg, borderRadius: borderRadius.medium, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border },
  lockedBadge: { alignSelf: 'flex-start', paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: borderRadius.extraLarge, backgroundColor: palette.sagePale },
  lockedBadgeText: { color: palette.sage, fontSize: 8, fontWeight: '700', letterSpacing: 0.6 },
  lockedTitle: { color: palette.textPrimary, fontSize: 16, lineHeight: 22, fontFamily: typography.fonts.display, fontWeight: '600', marginTop: spacing.md },
  lockedText: { color: palette.textSecondary, fontSize: 9, lineHeight: 15, marginTop: spacing.xs },
  lockedButton: { minHeight: 43, alignItems: 'center', justifyContent: 'center', marginTop: spacing.md, borderRadius: borderRadius.extraLarge, backgroundColor: palette.sage },
  lockedButtonText: { color: palette.surface, fontSize: 9, fontWeight: '700' },
  loader: { marginVertical: spacing.lg },
  errorText: { color: palette.error, fontSize: 8, lineHeight: 12, marginTop: spacing.sm },
});
