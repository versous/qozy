import { typography } from '@/theme/typography';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';

import { BottomNavigation } from '@/components/BottomNavigation';
import { BrandHeader } from '@/components/BrandHeader';
import { HabitGoalFields } from '@/components/habits/HabitGoalFields';
import { WeekdaySelector } from '@/components/WeekdaySelector';
import { type Habit, type HabitDay, type HabitGoalType, useHabits } from '@/hooks/useHabits';
import { saveHabitReminder } from '@/services/contextualReminders';
import { borderRadius, spacing, type AppColors } from '@/theme/colors';
import { useAppTheme } from '@/theme/ThemeProvider';

function isReading(activity: string) {
  return /lire|lecture/i.test(activity);
}

function getDefaultTitle(activity: string) {
  return isReading(activity) ? 'Lire 10 minutes' : 'Étudier 25 minutes';
}

function matchesActivity(habit: Habit, activity: string) {
  return isReading(activity)
    ? /lire|lecture/i.test(habit.title)
    : /étud|etud|cours/i.test(habit.title);
}

function normalizeActivity(value?: string) {
  return value && /étud|etud|study/i.test(value) ? 'Étudier' : 'Lire';
}

function RitualEditor({ activity, habit }: { activity: string; habit: Habit | null }) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const { addHabit, updateHabit, setHabitRitual } = useHabits();
  const [title, setTitle] = useState(habit?.title ?? getDefaultTitle(activity));
  const [days, setDays] = useState<HabitDay[]>(habit?.frequencyDays ?? [1, 2, 3, 4, 5]);
  const [goalType, setGoalType] = useState<HabitGoalType>(habit?.goalType ?? 'timer');
  const [goalTarget, setGoalTarget] = useState(String(habit?.goalTarget ?? (isReading(activity) ? 10 : 25)));
  const [goalUnit, setGoalUnit] = useState(habit?.goalUnit ?? 'pages');
  const [scheduledTime, setScheduledTime] = useState(habit?.scheduledTime ?? '08:30');
  const [reminderEnabled, setReminderEnabled] = useState(habit?.reminderEnabled ?? false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const isEditing = Boolean(habit);
  const reminderUnavailable = reminderEnabled && !scheduledTime;

  const adjustTarget = (delta: number) => {
    const current = Number(goalTarget) || (goalType === 'timer' ? 10 : 1);
    setGoalTarget(String(Math.max(1, Math.min(10000, current + delta))));
  };

  const handleSave = async () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError('Donne un nom à ton rituel.');
      return;
    }
    if (!days.length) {
      setError('Choisis au moins un jour de la semaine.');
      return;
    }
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(scheduledTime)) {
      setError('Saisis une heure valide au format HH:MM.');
      return;
    }
    if (goalType !== 'check' && (!/^\d+$/.test(goalTarget) || Number(goalTarget) < 1 || Number(goalTarget) > 10000)) {
      setError('Ton objectif doit être compris entre 1 et 10 000.');
      return;
    }
    if (goalType === 'count' && !goalUnit.trim()) {
      setError('Précise l’unité de ton objectif.');
      return;
    }

    setSaving(true);
    setError('');
    setNotice('');
    try {
      const goal = {
        type: goalType,
        target: goalType === 'check' ? 1 : Number(goalTarget),
        unit: goalUnit,
      };
      let habitId: string;
      if (habit) {
        await updateHabit(habit.id, trimmedTitle, days, goal, {
          scheduledTime,
          reminderEnabled: false,
        });
        habitId = habit.id;
      } else {
        habitId = await addHabit(trimmedTitle, '🌱', days, goal, {
          scheduledTime,
          reminderEnabled: false,
        });
      }

      try {
        await saveHabitReminder(habitId, trimmedTitle, days, scheduledTime, reminderEnabled);
        await setHabitRitual(habitId, { scheduledTime, reminderEnabled });
      } catch (reason) {
        const rollback = await Promise.allSettled([
          saveHabitReminder(habitId, trimmedTitle, days, scheduledTime, false),
          setHabitRitual(habitId, { scheduledTime, reminderEnabled: false }),
        ]);
        if (rollback.some((result) => result.status === 'rejected')) {
          throw new Error('Le rituel a été enregistré, mais la configuration du rappel n’a pas pu être annulée. Vérifie tes rappels avant de réessayer.');
        }
        throw reason;
      }
      setNotice(isEditing ? 'Les modifications de ton rituel sont enregistrées.' : 'Ton rituel est créé.');
      router.back();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Impossible d’enregistrer ce rituel.');
    } finally {
      setSaving(false);
    }
  };

  const goalLabel = goalType === 'timer' ? 'Objectif par jour programmé' : 'Objectif pour chaque jour prévu';

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <BrandHeader />
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>‹  Mes habitudes</Text>
        </Pressable>
        <Text style={styles.title}>{isReading(activity) ? 'Mon rituel de lecture' : 'Mon rituel d’étude'}</Text>
        <Text style={styles.subtitle}>
          {isEditing ? 'Mode modification' : 'Un rituel simple, à ton rythme'} · {habit?.title ?? getDefaultTitle(activity)}
        </Text>

        <View style={styles.tipCard}>
          <View style={styles.tipIcon}><Text style={styles.tipIconText}>{isReading(activity) ? '▤' : '✎'}</Text></View>
          <View style={styles.tipCopy}>
            <Text style={styles.tipTitle}>{isReading(activity) ? 'Une page après l’autre' : 'Un pas après l’autre'}</Text>
            <Text style={styles.tipDescription}>
              {isReading(activity)
                ? 'Ton moment à toi, les jours qui te conviennent.'
                : 'Choisis un moment pour avancer, sans te mettre la pression.'}
            </Text>
          </View>
        </View>

        <Text style={styles.fieldLabel}>Nom de l’habitude</Text>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder={getDefaultTitle(activity)}
          placeholderTextColor={colors.textLight}
          editable={!saving}
          maxLength={80}
          returnKeyType="done"
          style={styles.textInput}
        />

        <View style={styles.formSection}>
          <WeekdaySelector selectedDays={days} onChange={setDays} disabled={saving} />
        </View>

        <Text style={styles.fieldLabel}>Horaire prévu</Text>
        <View style={styles.timeField}>
          <TextInput
            accessibilityLabel="Horaire prévu, format heures et minutes"
            value={scheduledTime}
            onChangeText={(value) => setScheduledTime(value.replace(/[^\d:]/g, '').slice(0, 5))}
            placeholder="08:30"
            placeholderTextColor={colors.textLight}
            editable={!saving}
            keyboardType="numbers-and-punctuation"
            maxLength={5}
            style={styles.timeInput}
          />
          <Text style={styles.timeIcon}>◷</Text>
        </View>
        <Text style={styles.timeHint}>Format 24 h, par exemple 08:30 ou 17:45.</Text>

        <View style={styles.reminderCard}>
          <View style={styles.reminderCopy}>
            <Text style={styles.reminderTitle}>Me rappeler ce rituel</Text>
            <Text style={styles.reminderSubtitle}>{reminderEnabled ? `À ${scheduledTime} · Notification activée` : 'À l’horaire prévu · Désactivé'}</Text>
            <Text style={styles.reminderNote}>Les notifications doivent être autorisées sur cet appareil.</Text>
          </View>
          <Switch
            accessibilityLabel="Me rappeler ce rituel"
            value={reminderEnabled}
            onValueChange={setReminderEnabled}
            disabled={saving}
            trackColor={{ false: colors.border, true: colors.sageLight }}
            thumbColor={reminderEnabled ? colors.sage : colors.surface}
          />
        </View>

        <Text style={styles.fieldLabel}>{goalLabel}</Text>
        <HabitGoalFields
          type={goalType}
          target={goalTarget}
          unit={goalUnit}
          disabled={saving}
          typeLocked={isEditing}
          onTypeChange={(value) => {
            setGoalType(value);
            if (value === 'timer' && goalUnit === 'pages') setGoalUnit('minutes');
            if (value === 'count' && goalUnit === 'minutes') setGoalUnit('pages');
          }}
          onTargetChange={setGoalTarget}
          onUnitChange={setGoalUnit}
        />
        {goalType !== 'check' ? (
          <View style={styles.stepper}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Diminuer l’objectif"
              disabled={saving || Number(goalTarget) <= 1}
              onPress={() => adjustTarget(-1)}
              style={styles.stepButton}>
              <Text style={styles.stepButtonText}>−</Text>
            </Pressable>
            <Text style={styles.stepperValue}>
              {goalTarget} {goalType === 'timer' ? 'minutes' : goalUnit}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Augmenter l’objectif"
              disabled={saving || Number(goalTarget) >= 10000}
              onPress={() => adjustTarget(1)}
              style={styles.stepButton}>
              <Text style={styles.stepButtonText}>＋</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.preserveCard}>
          <Text style={styles.preserveTitle}>♧  Tes progrès sont conservés</Text>
          <Text style={styles.preserveText}>
            Modifier les jours ou l’objectif ne supprime pas les validations précédentes. La nouvelle planification s’appliquera après sauvegarde.
          </Text>
        </View>

        {notice ? <Text style={styles.notice}>{notice}</Text> : null}
        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
        {reminderUnavailable ? <Text style={styles.error}>Choisis un horaire avant d’activer le rappel.</Text> : null}
        <Pressable
          accessibilityRole="button"
          disabled={saving || !title.trim() || !days.length || reminderUnavailable}
          onPress={() => void handleSave()}
          style={[styles.saveButton, (saving || !title.trim() || !days.length || reminderUnavailable) && styles.disabled]}>
          {saving
            ? <ActivityIndicator color={colors.surface} />
            : <Text style={styles.saveButtonText}>✓  {isEditing ? 'Enregistrer les modifications' : 'Créer mon rituel'}</Text>}
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.cancelButton}>
          <Text style={styles.cancelText}>Modifications non enregistrées · Annuler</Text>
        </Pressable>
      </ScrollView>
      <BottomNavigation active="tasks" />
    </SafeAreaView>
  );
}

export default function RitualScreen() {
  const { activity: requestedActivity, habitId } = useLocalSearchParams<{ activity?: string; habitId?: string }>();
  const activity = normalizeActivity(requestedActivity);
  const colors = useAppTheme().colors;
  const styles = createStyles(colors);
  const habits = useHabits();

  if (habits.loading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <ActivityIndicator color={colors.sage} style={styles.loading} />
      </SafeAreaView>
    );
  }
  if (habits.error) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <Text style={styles.error}>{habits.error}</Text>
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.cancelButton}>
          <Text style={styles.cancelText}>Retour</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const habit = habits.allHabits.find((item) => item.id === habitId)
    ?? habits.allHabits.find((item) => matchesActivity(item, activity))
    ?? null;
  return <RitualEditor key={`${activity}-${habit?.id ?? 'new'}`} activity={activity} habit={habit} />;
}

const createStyles = (palette: AppColors) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.background },
  content: { padding: spacing.md, paddingBottom: spacing.lg },
  backButton: { alignSelf: 'flex-start', marginTop: spacing.xs, marginBottom: spacing.sm },
  backText: { color: palette.sage, fontSize: 9, fontWeight: '700' },
  title: { color: palette.textPrimary, fontSize: 22, lineHeight: 28, fontFamily: typography.fonts.display, fontWeight: '600' },
  subtitle: { color: palette.textSecondary, fontSize: 8, lineHeight: 13, marginTop: 3, marginBottom: spacing.sm, textTransform: 'capitalize' },
  tipCard: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: spacing.xs, padding: spacing.xs, marginBottom: spacing.sm, borderRadius: borderRadius.medium, backgroundColor: palette.sagePale },
  tipIcon: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: borderRadius.small, backgroundColor: palette.surface },
  tipIconText: { color: palette.sage, fontSize: 18 },
  tipCopy: { flex: 1 },
  tipTitle: { color: palette.textPrimary, fontSize: 8, fontWeight: '700' },
  tipDescription: { color: palette.textSecondary, fontSize: 7, lineHeight: 11, marginTop: 3 },
  fieldLabel: { color: palette.textPrimary, fontSize: 8, fontWeight: '700', marginTop: spacing.xs, marginBottom: 4 },
  textInput: { minHeight: 37, paddingHorizontal: spacing.sm, borderWidth: 1, borderColor: palette.border, borderRadius: borderRadius.small, backgroundColor: palette.surface, color: palette.textPrimary, fontSize: 8 },
  formSection: { marginTop: spacing.sm },
  timeField: { minHeight: 38, flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.sm, borderWidth: 1, borderColor: palette.border, borderRadius: borderRadius.small, backgroundColor: palette.surface },
  timeInput: { flex: 1, color: palette.textPrimary, fontSize: 9, paddingVertical: 0 },
  timeIcon: { color: palette.sage, fontSize: 14 },
  timeHint: { color: palette.textSecondary, fontSize: 7, marginTop: 3 },
  reminderCard: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, marginTop: spacing.sm, borderRadius: borderRadius.medium, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border },
  reminderCopy: { flex: 1 },
  reminderTitle: { color: palette.textPrimary, fontSize: 8, fontWeight: '700' },
  reminderSubtitle: { color: palette.textSecondary, fontSize: 7, marginTop: 3 },
  reminderNote: { color: palette.clay, fontSize: 6, marginTop: 3 },
  stepper: { minHeight: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.xs, marginTop: -spacing.sm, marginBottom: spacing.sm, borderRadius: borderRadius.extraLarge, backgroundColor: palette.sagePale },
  stepButton: { width: 27, height: 27, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: palette.surface },
  stepButtonText: { color: palette.sage, fontSize: 15, fontWeight: '700' },
  stepperValue: { color: palette.textPrimary, fontSize: 8, fontWeight: '700' },
  preserveCard: { padding: spacing.sm, marginTop: spacing.xs, borderRadius: borderRadius.medium, backgroundColor: palette.sagePale },
  preserveTitle: { color: palette.textPrimary, fontSize: 8, fontWeight: '700' },
  preserveText: { color: palette.textSecondary, fontSize: 7, lineHeight: 11, marginTop: 3, paddingLeft: spacing.md },
  saveButton: { minHeight: 39, alignItems: 'center', justifyContent: 'center', marginTop: spacing.sm, borderRadius: borderRadius.extraLarge, backgroundColor: palette.sage },
  saveButtonText: { color: palette.surface, fontSize: 8, fontWeight: '700' },
  disabled: { opacity: 0.5 },
  cancelButton: { minHeight: 30, alignItems: 'center', justifyContent: 'center' },
  cancelText: { color: palette.textSecondary, fontSize: 7 },
  error: { color: palette.error, fontSize: 8, lineHeight: 12, marginTop: spacing.xs },
  notice: { color: palette.sage, fontSize: 8, marginTop: spacing.xs },
  loading: { marginVertical: spacing.xl },
});
