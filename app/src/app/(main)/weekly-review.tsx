import React from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { useExercises, isExerciseScheduledOnDate } from '@/hooks/useExercises';
import { useHabits, type Habit } from '@/hooks/useHabits';
import { useTasks, type TodoTask } from '@/hooks/useTasks';
import { usePremium } from '@/services/PremiumProvider';
import { borderRadius, spacing, type AppColors } from '@/theme/colors';
import { useAppTheme } from '@/theme/ThemeProvider';

function getDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
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
  const planned = tasks.filter((task) =>
    task.dueDate && task.dueDate >= startKey && task.dueDate <= endKey
  );
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
      const completedDates = exercise.completedDates ?? [];
      if (completedDates.includes(dateKey) || exercise.completedDate === dateKey) completed += 1;
    });
    date.setDate(date.getDate() + 1);
  }

  return { planned, completed };
}

function getPercent(completed: number, planned: number) {
  return planned > 0 ? Math.min(100, Math.round((completed / planned) * 100)) : 0;
}

export default function WeeklyReviewScreen() {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const { isPremium } = usePremium();
  const { allHabits, loading: habitsLoading, error: habitsError } = useHabits();
  const { exercises, loading: exercisesLoading, error: exercisesError } = useExercises();
  const { tasks, loading: tasksLoading, error: tasksError } = useTasks();
  const today = new Date();
  const todayKey = getDateKey(today);
  const weekStart = new Date(`${todayKey}T00:00:00`);
  weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const weekly = [
    getHabitSummary(allHabits, weekStart, today),
    getTaskSummary(tasks, weekStart, today),
    getExerciseSummary(exercises, weekStart, today),
  ];
  const monthly = [
    getHabitSummary(allHabits, monthStart, today),
    getTaskSummary(tasks, monthStart, today),
    getExerciseSummary(exercises, monthStart, today),
  ];
  const weeklyPlanned = weekly.reduce((sum, item) => sum + item.planned, 0);
  const weeklyCompleted = weekly.reduce((sum, item) => sum + item.completed, 0);
  const monthlyPlanned = monthly.reduce((sum, item) => sum + item.planned, 0);
  const monthlyCompleted = monthly.reduce((sum, item) => sum + item.completed, 0);
  const monthlyPercent = getPercent(monthlyCompleted, monthlyPlanned);
  const weekLabel = `${weekStart.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })} – ${today.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}`;
  const monthLabel = today.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>‹  Retour</Text>
        </Pressable>
        <Text style={styles.eyebrow}>QOZY PREMIUM</Text>
        <Text style={styles.title}>Bilan hebdomadaire</Text>
        <Text style={styles.subtitle}>Un regard doux sur tes petits pas, sans chercher la perfection.</Text>

        {!isPremium ? (
          <View style={styles.lockedCard}>
            <Text style={styles.lockedTitle}>Tes repères dans le temps</Text>
            <Text style={styles.bodyText}>Le bilan hebdomadaire et la progression circulaire du mois sont réservés à Qozy Premium.</Text>
            <Pressable accessibilityRole="button" onPress={() => router.push('/premium')} style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>Découvrir Premium</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View style={styles.sectionHeading}>
              <Text style={styles.sectionTitle}>Cette semaine</Text>
              <Text style={styles.sectionMeta}>{weekLabel}</Text>
            </View>
            <View style={styles.card}>
              {(habitsLoading || tasksLoading || exercisesLoading) ? (
                <ActivityIndicator color={colors.sage} />
              ) : (
                <>
                  <Text style={styles.totalValue}>{weeklyCompleted} / {weeklyPlanned}</Text>
                  <Text style={styles.bodyText}>petits pas réalisés cette semaine</Text>
                  <Metric label="Habitudes" completed={weekly[0].completed} planned={weekly[0].planned} styles={styles} colors={colors} />
                  <Metric label="Tâches planifiées" completed={weekly[1].completed} planned={weekly[1].planned} styles={styles} colors={colors} />
                  <Metric label="Exercices" completed={weekly[2].completed} planned={weekly[2].planned} styles={styles} colors={colors} />
                </>
              )}
            </View>

            <View style={styles.sectionHeading}>
              <Text style={styles.sectionTitle}>Progression du mois</Text>
              <Text style={styles.sectionMeta}>{monthLabel}</Text>
            </View>
            <View style={styles.card}>
              {(habitsLoading || tasksLoading || exercisesLoading) ? (
                <ActivityIndicator color={colors.sage} />
              ) : (
                <>
                  <ProgressRing percent={monthlyPercent} colors={colors} styles={styles} />
                  <Text style={styles.monthSummary}>
                    {monthlyPlanned > 0
                      ? `${monthlyCompleted} petits pas sur ${monthlyPlanned} prévus`
                      : 'Aucune activité planifiée pour le moment'}
                  </Text>
                  <Text style={styles.bodyText}>Chaque effort compte, à ton propre rythme.</Text>
                </>
              )}
            </View>
            {habitsError || tasksError || exercisesError ? (
              <Text style={styles.errorText}>{habitsError || tasksError || exercisesError}</Text>
            ) : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Metric({
  label,
  completed,
  planned,
  styles,
  colors,
}: {
  label: string;
  completed: number;
  planned: number;
  styles: ReturnType<typeof createStyles>;
  colors: AppColors;
}) {
  const percent = getPercent(completed, planned);
  return (
    <View style={styles.metric}>
      <View style={styles.metricHeading}>
        <Text style={styles.metricLabel}>{label}</Text>
        <Text style={styles.metricValue}>{completed} / {planned}</Text>
      </View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${percent}%`, backgroundColor: colors.sage }]} />
      </View>
    </View>
  );
}

function ProgressRing({
  percent,
  colors,
  styles,
}: {
  percent: number;
  colors: AppColors;
  styles: ReturnType<typeof createStyles>;
}) {
  const segments = 48;
  const activeSegments = Math.round((percent / 100) * segments);

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel="Progression du mois"
      accessibilityValue={{ min: 0, max: 100, now: percent }}
      style={styles.ring}>
      {Array.from({ length: segments }, (_, index) => {
        const angle = (index / segments) * Math.PI * 2 - Math.PI / 2;
        const left = 61 + Math.cos(angle) * 49 - 3;
        const top = 61 + Math.sin(angle) * 49 - 3;
        return (
          <View
            key={index}
            style={[
              styles.ringDot,
              {
                left,
                top,
                backgroundColor: index < activeSegments ? colors.sage : colors.sagePale,
              },
            ]}
          />
        );
      })}
      <View style={styles.ringCenter}>
        <Text style={styles.ringPercent}>{percent}%</Text>
        <Text style={styles.ringCaption}>du mois</Text>
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
  title: { color: palette.textPrimary, fontSize: 27, lineHeight: 34, fontFamily: 'serif', fontWeight: '600', marginTop: 6 },
  subtitle: { color: palette.textSecondary, fontSize: 12, lineHeight: 19, marginTop: 7 },
  sectionHeading: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: spacing.sm, marginTop: spacing.lg, marginBottom: spacing.sm },
  sectionTitle: { color: palette.textPrimary, fontSize: 16, fontFamily: 'serif', fontWeight: '600' },
  sectionMeta: { color: palette.textSecondary, fontSize: 9 },
  card: { padding: spacing.md, borderRadius: borderRadius.medium, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border, gap: spacing.md },
  totalValue: { color: palette.sage, fontSize: 25, fontFamily: 'serif', fontWeight: '700' },
  bodyText: { color: palette.textSecondary, fontSize: 10, lineHeight: 16 },
  metric: { gap: 7 },
  metricHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  metricLabel: { flex: 1, color: palette.textPrimary, fontSize: 11 },
  metricValue: { color: palette.sage, fontSize: 11, fontWeight: '700' },
  progressTrack: { height: 7, borderRadius: borderRadius.extraLarge, backgroundColor: palette.sagePale, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: borderRadius.extraLarge },
  ring: { width: 122, height: 122, alignSelf: 'center', position: 'relative', marginVertical: spacing.sm },
  ringDot: { position: 'absolute', width: 6, height: 6, borderRadius: 3 },
  ringCenter: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  ringPercent: { color: palette.textPrimary, fontSize: 25, fontFamily: 'serif', fontWeight: '700' },
  ringCaption: { color: palette.textSecondary, fontSize: 9, marginTop: 1 },
  monthSummary: { color: palette.textPrimary, fontSize: 12, textAlign: 'center', fontWeight: '600' },
  lockedCard: { padding: spacing.md, marginTop: spacing.lg, borderRadius: borderRadius.medium, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border, gap: spacing.sm },
  lockedTitle: { color: palette.textPrimary, fontSize: 15, fontFamily: 'serif', fontWeight: '600' },
  primaryButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: borderRadius.extraLarge, backgroundColor: palette.sage, marginTop: spacing.xs },
  primaryButtonText: { color: palette.surface, fontSize: 11, fontWeight: '700' },
  errorText: { color: palette.error, fontSize: 11, lineHeight: 16, marginTop: spacing.sm },
});
