import React, { useMemo } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { useExercises } from '@/hooks/useExercises';
import { useHabits, type Habit } from '@/hooks/useHabits';
import { useTasks } from '@/hooks/useTasks';
import { usePremium } from '@/services/PremiumProvider';
import { borderRadius, spacing, type AppColors } from '@/theme/colors';
import { useAppTheme } from '@/theme/ThemeProvider';

const DAY_LABELS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const WEEK_COUNT = 52;

function getDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function getHeatmapWeeks(today: Date) {
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

function getHabitIntensity(habit: Habit, date: string) {
  if (habit.completedDates.includes(date)) return 4;
  const progress = habit.progressByDate[date] ?? 0;
  if (progress <= 0 || habit.goalType === 'check') return 0;
  const target = habit.goalType === 'timer' ? habit.goalTarget * 60 : habit.goalTarget;
  return Math.min(3, Math.max(1, Math.ceil((progress / target) * 3)));
}

export default function ActivityCalendarScreen() {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const { isPremium } = usePremium();
  const { allHabits, loading: habitsLoading, error: habitsError } = useHabits();
  const { exercises, loading: exercisesLoading, error: exercisesError } = useExercises();
  const { tasks, loading: tasksLoading, error: tasksError } = useTasks();
  const today = useMemo(() => new Date(), []);
  const todayKey = getDateKey(today);
  const weeks = useMemo(() => getHeatmapWeeks(today), [today]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>‹  Retour</Text>
        </Pressable>
        <Text style={styles.eyebrow}>QOZY PREMIUM</Text>
        <Text style={styles.title}>Calendrier de mes activités</Text>
        <Text style={styles.subtitle}>Chaque carré raconte un petit pas, jour après jour.</Text>

        {!isPremium ? (
          <View style={styles.lockedCard}>
            <Text style={styles.cardTitle}>Ton année en un coup d’œil</Text>
            <Text style={styles.bodyText}>Les calendriers d’activité façon GitHub sont réservés à Qozy Premium.</Text>
            <Pressable accessibilityRole="button" onPress={() => router.push('/premium')} style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>Découvrir Premium</Text>
            </Pressable>
          </View>
        ) : (habitsLoading || exercisesLoading || tasksLoading) ? (
          <ActivityIndicator color={colors.sage} style={styles.loader} />
        ) : (
          <>
            {allHabits.map((habit) => (
              <View key={`habit-${habit.id}`} style={styles.activityCard}>
                <View style={styles.cardHeading}>
                  <View style={styles.activityIcon}><Text style={styles.activityIconText}>{habit.icon || '◉'}</Text></View>
                  <View style={styles.cardCopy}>
                    <Text style={styles.cardTitle}>{habit.title}</Text>
                    <Text style={styles.bodyText}>Habitude · {habit.goalType === 'check' ? 'Régularité' : `${habit.goalTarget} ${habit.goalUnit}`}</Text>
                  </View>
                </View>
                <Heatmap weeks={weeks} todayKey={todayKey} levelForDate={(date) => getHabitIntensity(habit, date)} colors={colors} styles={styles} />
              </View>
            ))}
            {exercises.map((exercise) => {
              const completionDates = new Set([
                ...(exercise.completedDates ?? []),
                ...(exercise.completedDate ? [exercise.completedDate] : []),
              ]);
              return (
                <View key={`exercise-${exercise.id}`} style={styles.activityCard}>
                  <View style={styles.cardHeading}>
                    <View style={styles.activityIcon}><Text style={styles.activityIconText}>✳</Text></View>
                    <View style={styles.cardCopy}>
                      <Text style={styles.cardTitle}>{exercise.name}</Text>
                      <Text style={styles.bodyText}>Exercice · {exercise.duration} min</Text>
                    </View>
                  </View>
                  <Heatmap
                    weeks={weeks}
                    todayKey={todayKey}
                    levelForDate={(date) => completionDates.has(date) ? 4 : 0}
                    colors={colors}
                    styles={styles}
                  />
                </View>
              );
            })}
            {tasks.map((task) => {
              const completionDates = new Set(task.completedDates ?? []);
              return (
                <View key={`task-${task.id}`} style={styles.activityCard}>
                  <View style={styles.cardHeading}>
                    <View style={styles.activityIcon}><Text style={styles.activityIconText}>✓</Text></View>
                    <View style={styles.cardCopy}>
                      <Text style={styles.cardTitle}>{task.title}</Text>
                      <Text style={styles.bodyText}>Petit pas{task.dueDate ? ` · prévu le ${task.dueDate}` : ''}</Text>
                    </View>
                  </View>
                  <Heatmap
                    weeks={weeks}
                    todayKey={todayKey}
                    levelForDate={(date) => completionDates.has(date) ? 4 : 0}
                    colors={colors}
                    styles={styles}
                  />
                </View>
              );
            })}
            {!allHabits.length && !exercises.length && !tasks.length ? (
              <View style={styles.emptyCard}>
                <Text style={styles.cardTitle}>Ton calendrier se remplira doucement</Text>
                <Text style={styles.bodyText}>Ajoute une habitude ou un exercice pour commencer à voir tes repères.</Text>
              </View>
            ) : null}
          </>
        )}
        {habitsError || exercisesError || tasksError ? (
          <Text style={styles.errorText}>{habitsError || exercisesError || tasksError}</Text>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function Heatmap({
  weeks,
  todayKey,
  levelForDate,
  colors,
  styles,
}: {
  weeks: Date[][];
  todayKey: string;
  levelForDate: (date: string) => number;
  colors: AppColors;
  styles: ReturnType<typeof createStyles>;
}) {
  const activeDays = weeks.flat().filter((day) => {
    const key = getDateKey(day);
    return key <= todayKey && levelForDate(key) > 0;
  }).length;

  return (
    <View style={styles.heatmapSection}>
      <View style={styles.heatmapHeading}>
        <Text style={styles.bodyText}>Environ un an</Text>
        <Text style={styles.activeDays}>{activeDays} jour{activeDays === 1 ? '' : 's'} actif{activeDays === 1 ? '' : 's'}</Text>
      </View>
      <View style={styles.heatmapRow}>
        <View style={styles.weekdayLabels}>
          {DAY_LABELS.map((label, index) => (
            <Text key={`${label}-${index}`} style={styles.weekdayLabel}>{index % 2 === 0 ? label : ''}</Text>
          ))}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View>
            <View style={styles.monthLabels}>
              {weeks.map((week, index) => (
                <Text key={getDateKey(week[0])} style={styles.monthLabel}>
                  {index === 0 || week[0].getDate() <= 7
                    ? week[0].toLocaleDateString('fr-FR', { month: 'short' })
                    : ''}
                </Text>
              ))}
            </View>
            <View style={styles.weeks}>
              {weeks.map((week) => (
                <View key={getDateKey(week[0])} style={styles.weekColumn}>
                  {week.map((date) => {
                    const dateKey = getDateKey(date);
                    const level = dateKey <= todayKey ? levelForDate(dateKey) : 0;
                    return (
                      <View
                        key={dateKey}
                        accessibilityLabel={`${date.toLocaleDateString('fr-FR')}: ${level ? 'activité réalisée' : 'aucune activité enregistrée'}`}
                        style={[
                          styles.dayCell,
                          { backgroundColor: level ? colors.sage : colors.border, opacity: level ? 0.3 + level * 0.17 : 1 },
                        ]}
                      />
                    );
                  })}
                </View>
              ))}
            </View>
          </View>
        </ScrollView>
      </View>
      <View style={styles.legend}>
        <Text style={styles.bodyText}>Moins</Text>
        {[0, 1, 2, 3].map((level) => (
          <View
            key={level}
            style={[
              styles.legendCell,
              { backgroundColor: level ? colors.sage : colors.border, opacity: level ? 0.3 + level * 0.17 : 1 },
            ]}
          />
        ))}
        <Text style={styles.bodyText}>Plus</Text>
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
  activityCard: { padding: spacing.md, marginTop: spacing.md, borderRadius: borderRadius.medium, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border },
  cardHeading: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  activityIcon: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 18, backgroundColor: palette.sagePale },
  activityIconText: { color: palette.sage, fontSize: 16 },
  cardCopy: { flex: 1, gap: 3 },
  cardTitle: { color: palette.textPrimary, fontSize: 13, fontWeight: '700' },
  bodyText: { color: palette.textSecondary, fontSize: 9, lineHeight: 14 },
  heatmapSection: { marginTop: spacing.md },
  heatmapHeading: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.xs },
  activeDays: { color: palette.sage, fontSize: 9, fontWeight: '700' },
  heatmapRow: { flexDirection: 'row', alignItems: 'flex-start' },
  weekdayLabels: { gap: 3, paddingTop: 18, paddingRight: spacing.xs },
  weekdayLabel: { width: 11, height: 10, color: palette.textSecondary, fontSize: 7, textAlign: 'center' },
  monthLabels: { height: 15, flexDirection: 'row', gap: 3 },
  monthLabel: { width: 11, color: palette.textSecondary, fontSize: 7, textTransform: 'capitalize' },
  weeks: { flexDirection: 'row', gap: 3 },
  weekColumn: { gap: 3 },
  dayCell: { width: 9, height: 9, borderRadius: 2 },
  legend: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4, marginTop: spacing.sm },
  legendCell: { width: 8, height: 8, borderRadius: 2 },
  emptyCard: { padding: spacing.md, marginTop: spacing.lg, borderRadius: borderRadius.medium, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border, gap: spacing.xs },
  lockedCard: { padding: spacing.md, marginTop: spacing.lg, borderRadius: borderRadius.medium, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border, gap: spacing.sm },
  primaryButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: borderRadius.extraLarge, backgroundColor: palette.sage, marginTop: spacing.xs },
  primaryButtonText: { color: palette.surface, fontSize: 11, fontWeight: '700' },
  loader: { marginVertical: spacing.xl },
  errorText: { color: palette.error, fontSize: 11, lineHeight: 16, marginTop: spacing.sm },
});
