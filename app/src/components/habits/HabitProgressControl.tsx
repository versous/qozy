import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Habit } from '@/hooks/useHabits';
import { auth } from '@/services/firebase';
import { borderRadius, spacing, type AppColors } from '@/theme/colors';
import { useAppTheme } from '@/theme/ThemeProvider';

interface HabitProgressControlProps {
  habit: Habit;
  onProgress: (progress: number, date?: string) => Promise<void>;
}

interface StoredTimer {
  date: string;
  startedAt: number;
}

const getTodayKey = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

const getTimerKey = (habitId: string) =>
  `qozy-habit-timer:${auth?.currentUser?.uid ?? 'local'}:${habitId}`;

const getElapsedSeconds = (timer: StoredTimer | null, now: number) => {
  if (!timer) return 0;
  const [year, month, day] = timer.date.split('-').map(Number);
  const midnight = new Date(year, month - 1, day + 1).getTime();
  return Math.max(0, Math.floor((Math.min(now, midnight) - timer.startedAt) / 1000));
};

const formatClock = (seconds: number) => {
  const total = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const remaining = total % 60;
  return [hours, minutes, remaining].map((part) => String(part).padStart(2, '0')).join(':');
};

export function HabitProgressControl({ habit, onProgress }: HabitProgressControlProps) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const [timer, setTimer] = useState<StoredTimer | null>(null);
  const [timerLoaded, setTimerLoaded] = useState(false);
  const [now, setNow] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const target = habit.goalType === 'timer' ? habit.goalTarget * 60 : habit.goalTarget;
  const progress = habit.todayProgress;
  const timerElapsed = getElapsedSeconds(timer, now);
  const timerProgress = timer
    ? (habit.progressByDate[timer.date] ?? 0) + timerElapsed
    : progress;
  const currentProgress = habit.goalType === 'timer' ? timerProgress : progress;

  useEffect(() => {
    let active = true;
    const key = getTimerKey(habit.id);
    void AsyncStorage.getItem(key).then(async (stored) => {
      if (!stored) {
        if (active) setTimerLoaded(true);
        return;
      }
      const parsed = JSON.parse(stored) as StoredTimer;
      if (!Number.isFinite(parsed.startedAt) || !/^\d{4}-\d{2}-\d{2}$/.test(parsed.date)) {
        await AsyncStorage.removeItem(key);
        if (active) setTimerLoaded(true);
        return;
      }
      if (active) {
        setTimer(parsed);
        setTimerLoaded(true);
      }
    }).catch((reason: unknown) => {
      if (active) {
        setError(reason instanceof Error ? reason.message : 'Le chronomètre n’a pas pu être restauré.');
        setTimerLoaded(true);
      }
    });
    return () => {
      active = false;
    };
  }, [habit.id]);

  useEffect(() => {
    if (!timer) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [timer]);

  const updateCount = async (delta: number) => {
    const next = Math.max(0, Math.min(10000000, progress + delta));
    setSaving(true);
    setError('');
    try {
      await onProgress(next);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'La progression n’a pas pu être enregistrée.');
    } finally {
      setSaving(false);
    }
  };

  const startTimer = async () => {
    setSaving(true);
    setError('');
    try {
      const started = { date: getTodayKey(), startedAt: Date.now() };
      await AsyncStorage.setItem(getTimerKey(habit.id), JSON.stringify(started));
      setTimer(started);
      setNow(Date.now());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Le chronomètre n’a pas pu démarrer.');
    } finally {
      setSaving(false);
    }
  };

  const stopTimer = async () => {
    if (!timer) return;
    setSaving(true);
    setError('');
    try {
      const completedElapsed = getElapsedSeconds(timer, Date.now());
      if (completedElapsed < 1) {
        setError('Laisse le chronomètre tourner au moins une seconde avant de l’arrêter.');
        return;
      }
      await onProgress(
        (habit.progressByDate[timer.date] ?? 0) + completedElapsed,
        timer.date
      );
      await AsyncStorage.removeItem(getTimerKey(habit.id));
      setTimer(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Le temps n’a pas pu être enregistré.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.summary}>
        <Text style={styles.value}>
          {habit.goalType === 'timer'
            ? `${Math.floor(currentProgress / 60)} / ${habit.goalTarget} min`
            : `${Math.floor(progress)} / ${habit.goalTarget} ${habit.goalUnit}`}
        </Text>
        <Text style={[styles.status, habit.isCompleted && !timer && styles.statusDone]}>
          {timer && timer.date !== getTodayKey()
            ? 'Chrono commencé un autre jour'
            : habit.isCompleted
              ? 'Objectif atteint, bravo'
              : 'Chaque petit pas compte'}
        </Text>
      </View>
      {habit.goalType === 'timer' ? (
        <View style={styles.timerRow}>
          <Text style={styles.clock}>{formatClock(timerElapsed)}</Text>
          <Pressable
            accessibilityRole="button"
            disabled={saving || !timerLoaded}
            onPress={() => void (timer ? stopTimer() : startTimer())}
            style={[styles.action, timer && styles.actionStop, saving && styles.disabled]}>
            <Text style={[styles.actionText, timer && styles.actionTextStop]}>
              {saving || !timerLoaded ? '…' : timer ? 'Pause' : 'Démarrer'}
            </Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.countRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Retirer une unité de ${habit.title}`}
            disabled={saving || progress <= 0}
            onPress={() => void updateCount(-1)}
            style={[styles.countAction, (saving || progress <= 0) && styles.disabled]}>
            <Text style={styles.countActionText}>−</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Ajouter une unité à ${habit.title}`}
            disabled={saving || habit.isCompleted}
            onPress={() => void updateCount(1)}
            style={[styles.action, styles.countAdd, (saving || habit.isCompleted) && styles.disabled]}>
            <Text style={styles.actionText}>+1</Text>
          </Pressable>
        </View>
      )}
      {habit.goalType === 'timer' ? (
        <View style={styles.track}>
          <View style={[styles.trackFill, { width: `${Math.min(100, (currentProgress / target) * 100)}%` }]} />
        </View>
      ) : null}
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const createStyles = (palette: AppColors) => StyleSheet.create({
  container: { width: '100%', gap: spacing.xs, paddingTop: spacing.xs },
  summary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.xs },
  value: { flexShrink: 1, color: palette.textPrimary, fontSize: 11, fontWeight: '700' },
  status: { flexShrink: 1, color: palette.textSecondary, fontSize: 9, textAlign: 'right' },
  statusDone: { color: palette.sage, fontWeight: '700' },
  countRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: spacing.xs },
  timerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  clock: { color: palette.sage, fontSize: 14, fontVariant: ['tabular-nums'], fontWeight: '700' },
  action: { minWidth: 74, minHeight: 32, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.md, borderRadius: borderRadius.extraLarge, backgroundColor: palette.sage },
  countAdd: { minWidth: 48, minHeight: 30, paddingHorizontal: spacing.sm },
  actionStop: { backgroundColor: palette.peachLight },
  actionText: { color: palette.surface, fontSize: 10, fontWeight: '700' },
  actionTextStop: { color: palette.clay },
  countAction: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center', borderRadius: 15, backgroundColor: palette.sagePale },
  countActionText: { color: palette.sage, fontSize: 18, fontWeight: '600' },
  track: { height: 4, overflow: 'hidden', borderRadius: 2, backgroundColor: palette.sagePale },
  trackFill: { height: '100%', borderRadius: 2, backgroundColor: palette.sage },
  disabled: { opacity: 0.45 },
  error: { color: palette.error, fontSize: 9 },
});
