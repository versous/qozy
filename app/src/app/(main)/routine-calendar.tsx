import { typography } from '@/theme/typography';
import React, { useMemo } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';

import { useExercises } from '@/hooks/useExercises';
import { useHabits, type Habit } from '@/hooks/useHabits';
import { usePremium } from '@/services/PremiumProvider';
import { borderRadius, spacing, type AppColors } from '@/theme/colors';
import { useAppTheme } from '@/theme/ThemeProvider';

const WEEK_COUNT = 52;

function getDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function getWeeks(today: Date) {
  const firstDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  firstDay.setDate(firstDay.getDate() - ((firstDay.getDay() + 6) % 7) - (WEEK_COUNT - 1) * 7);
  return Array.from({ length: WEEK_COUNT }, (_, weekIndex) =>
    Array.from({ length: 7 }, (_, dayIndex) => {
      const date = new Date(firstDay);
      date.setDate(firstDay.getDate() + weekIndex * 7 + dayIndex);
      return date;
    })
  );
}

function getHabitLevel(habit: Habit, date: string) {
  if (habit.completedDates.includes(date)) return 4;
  const progress = habit.progressByDate[date] ?? 0;
  if (progress <= 0 || habit.goalType === 'check') return 0;
  const target = habit.goalType === 'timer' ? habit.goalTarget * 60 : habit.goalTarget;
  return Math.min(3, Math.max(1, Math.ceil((progress / target) * 3)));
}

export default function RoutineCalendarScreen() {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const { isPremium } = usePremium();
  const { id, kind, title: requestedTitle } = useLocalSearchParams<{
    id?: string;
    kind?: 'habit' | 'exercise';
    title?: string;
  }>();
  const { allHabits, loading: habitsLoading, error: habitsError } = useHabits();
  const { exercises, loading: exercisesLoading, error: exercisesError } = useExercises();
  const today = useMemo(() => new Date(), []);
  const todayKey = getDateKey(today);
  const weeks = useMemo(() => getWeeks(today), [today]);
  const habit = kind === 'habit' ? allHabits.find((item) => item.id === id) : undefined;
  const exercise = kind === 'exercise' ? exercises.find((item) => item.id === id) : undefined;
  const title = habit?.title ?? exercise?.name ?? requestedTitle ?? 'Ma routine';
  const loading = habitsLoading || exercisesLoading;
  const error = habitsError || exercisesError;
  const completionDates = new Set([
    ...(exercise?.completedDates ?? []),
    ...(exercise?.completedDate ? [exercise.completedDate] : []),
  ]);
  const isMissing = !loading && (kind === 'habit' ? !habit : kind === 'exercise' ? !exercise : true);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>‹  Retour à ma routine</Text>
        </Pressable>
        <Text style={styles.eyebrow}>QOZY PREMIUM</Text>
        <Text style={styles.title}>Le calendrier de</Text>
        <Text style={styles.routineTitle}>{title}</Text>
        <Text style={styles.subtitle}>Chaque carré garde la trace de tes petits pas.</Text>

        {!isPremium ? (
          <View style={styles.lockedCard}>
            <Text style={styles.lockedIcon}>✦</Text>
            <Text style={styles.cardTitle}>Ton année, à ton rythme</Text>
            <Text style={styles.bodyText}>
              Le calendrier de progression de chaque routine est réservé à Qozy Premium.
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/premium')}
              style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>Découvrir Premium</Text>
            </Pressable>
          </View>
        ) : loading ? (
          <ActivityIndicator color={colors.sage} style={styles.loader} />
        ) : error ? (
          <Text style={styles.errorText}>{error}</Text>
        ) : isMissing ? (
          <View style={styles.emptyCard}>
            <Text style={styles.cardTitle}>Cette routine est introuvable</Text>
            <Text style={styles.bodyText}>Retourne à ta liste et choisis une routine enregistrée.</Text>
          </View>
        ) : (
          <>
            <View style={styles.calendarCard}>
              <View style={styles.monthLabels}>
                {weeks.map((week, index) => {
                  const firstDay = week.find((date) => date.getDate() <= 7);
                  return firstDay ? (
                    <Text key={`${index}-${getDateKey(firstDay)}`} style={styles.monthLabel}>
                      {firstDay.toLocaleDateString('fr-FR', { month: 'short' })}
                    </Text>
                  ) : null;
                })}
              </View>
              <View style={styles.heatmap}>
                {weeks.map((week, weekIndex) => (
                  <View key={weekIndex} style={styles.weekColumn}>
                    {week.map((date) => {
                      const dateKey = getDateKey(date);
                      const isFuture = dateKey > todayKey;
                      const level = habit
                        ? getHabitLevel(habit, dateKey)
                        : completionDates.has(dateKey) ? 4 : 0;
                      return (
                        <View
                          key={dateKey}
                          accessibilityLabel={`${date.toLocaleDateString('fr-FR')}${level ? ', progression enregistrée' : ''}`}
                          style={[
                            styles.dayCell,
                            styles[`level${level}` as 'level0'],
                            dateKey === todayKey && styles.todayCell,
                            isFuture && styles.futureCell,
                          ]}
                        />
                      );
                    })}
                  </View>
                ))}
              </View>
              <View style={styles.legend}>
                <Text style={styles.legendLabel}>Moins</Text>
                {[0, 1, 2, 3, 4].map((level) => (
                  <View key={level} style={[styles.legendCell, styles[`level${level}` as 'level0']]} />
                ))}
                <Text style={styles.legendLabel}>Plus</Text>
              </View>
            </View>
            <View style={styles.reassuranceCard}>
              <Text style={styles.reassuranceTitle}>À ton rythme</Text>
              <Text style={styles.bodyText}>
                Les jours sans activité font aussi partie de ton parcours. Reviens quand tu en as envie.
              </Text>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (palette: AppColors) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.background },
  content: { padding: spacing.md, paddingBottom: spacing.xl },
  backButton: { alignSelf: 'flex-start', paddingVertical: spacing.xs, marginBottom: spacing.md },
  backText: { color: palette.sage, fontSize: 12, fontWeight: '600' },
  eyebrow: { color: palette.sage, fontSize: 9, fontWeight: '700', letterSpacing: 0.9 },
  title: { color: palette.textSecondary, fontSize: 18, fontFamily: typography.fonts.display, marginTop: spacing.sm },
  routineTitle: { color: palette.textPrimary, fontSize: 25, fontFamily: typography.fonts.display, fontWeight: '600', marginTop: 2 },
  subtitle: { color: palette.textSecondary, fontSize: 11, lineHeight: 17, marginTop: 5, marginBottom: spacing.lg },
  lockedCard: { alignItems: 'center', padding: spacing.lg, borderRadius: borderRadius.medium, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border },
  lockedIcon: { color: palette.sage, fontSize: 25, marginBottom: spacing.sm },
  cardTitle: { color: palette.textPrimary, fontSize: 15, fontFamily: typography.fonts.display, fontWeight: '600', textAlign: 'center' },
  bodyText: { color: palette.textSecondary, fontSize: 11, lineHeight: 17, textAlign: 'center', marginTop: spacing.xs },
  primaryButton: { alignItems: 'center', justifyContent: 'center', minHeight: 42, paddingHorizontal: spacing.lg, marginTop: spacing.md, borderRadius: borderRadius.extraLarge, backgroundColor: palette.sage },
  primaryButtonText: { color: palette.surface, fontSize: 11, fontWeight: '700' },
  emptyCard: { alignItems: 'center', padding: spacing.lg, borderRadius: borderRadius.medium, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border },
  loader: { padding: spacing.xl },
  errorText: { color: palette.error, fontSize: 11 },
  calendarCard: { padding: spacing.sm, borderRadius: borderRadius.medium, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border },
  monthLabels: { height: 18, flexDirection: 'row', justifyContent: 'space-between', marginLeft: 21, marginBottom: spacing.xs },
  monthLabel: { color: palette.textSecondary, fontSize: 8, textTransform: 'capitalize' },
  heatmap: { flexDirection: 'row', justifyContent: 'space-between', gap: 1 },
  weekColumn: { gap: 1 },
  dayCell: { width: 4, height: 4, borderRadius: 1 },
  level0: { backgroundColor: palette.sagePale },
  level1: { backgroundColor: '#C9D9B6' },
  level2: { backgroundColor: '#9AB888' },
  level3: { backgroundColor: '#6E9569' },
  level4: { backgroundColor: palette.sage },
  todayCell: { borderWidth: 1, borderColor: palette.textPrimary },
  futureCell: { opacity: 0.35 },
  legend: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4, marginTop: spacing.md },
  legendLabel: { color: palette.textSecondary, fontSize: 8, marginHorizontal: 3 },
  legendCell: { width: 8, height: 8, borderRadius: 2 },
  reassuranceCard: { padding: spacing.md, marginTop: spacing.md, borderRadius: borderRadius.medium, backgroundColor: palette.sagePale },
  reassuranceTitle: { color: palette.sage, fontSize: 12, fontWeight: '700', textAlign: 'center' },
});
