import { typography } from '@/theme/typography';
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { BottomNavigation } from '@/components/BottomNavigation';
import { useTasks } from '@/hooks/useTasks';
import {
  TIME_CATEGORIES,
  useTimeTracking,
  type TimeCategory,
  type TimeEntry,
} from '@/hooks/useTimeTracking';
import { exportTimeEntriesCsv, exportTimeEntriesPdf } from '@/services/timeTrackingExport';
import { borderRadius, spacing, type AppColors } from '@/theme/colors';
import { useAppTheme } from '@/theme/ThemeProvider';

function formatDuration(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
}

function getCategoryLabel(categoryId: TimeCategory) {
  return TIME_CATEGORIES.find((category) => category.id === categoryId)?.label ?? 'Autre';
}

function formatEntryDate(entry: TimeEntry) {
  return entry.startedAt.toDate().toLocaleDateString('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

function formatEntryTime(entry: TimeEntry) {
  const start = entry.startedAt.toDate().toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  });
  const end = entry.endedAt.toDate().toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  });
  return `${start} – ${end}`;
}

export default function TimeTrackingScreen() {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const { tasks } = useTasks();
  const {
    entries,
    activeSession,
    elapsedSeconds,
    timerLoaded,
    loading,
    error,
    isStarting,
    isStopping,
    startTimer,
    stopTimer,
  } = useTimeTracking();
  const [category, setCategory] = useState<TimeCategory>('code');
  const [project, setProject] = useState('');
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<'csv' | 'pdf' | null>(null);
  const selectedTask = tasks.find((task) => task.id === selectedTaskId) ?? null;
  const pendingTasks = tasks.filter((task) => !task.completed);
  const totalSeconds = useMemo(
    () => entries.reduce((sum, entry) => sum + entry.durationSeconds, 0),
    [entries]
  );
  const monthlySeconds = useMemo(() => {
    const now = new Date();
    return entries.reduce((sum, entry) => {
      const start = entry.startedAt.toDate();
      return start.getFullYear() === now.getFullYear() && start.getMonth() === now.getMonth()
        ? sum + entry.durationSeconds
        : sum;
    }, 0);
  }, [entries]);

  const handleStart = async () => {
    setActionError(null);
    try {
      await startTimer({
        category,
        project,
        taskId: selectedTask?.id ?? null,
        taskTitle: selectedTask?.title ?? null,
      });
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : 'Impossible de démarrer le chronomètre.');
    }
  };

  const handleStop = async () => {
    setActionError(null);
    try {
      await stopTimer();
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : 'Impossible d’enregistrer la session.');
    }
  };

  const handleExport = async (format: 'csv' | 'pdf') => {
    setActionError(null);
    setExporting(format);
    try {
      if (format === 'csv') await exportTimeEntriesCsv(entries);
      else await exportTimeEntriesPdf(entries);
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : 'Impossible de préparer cet export.');
    } finally {
      setExporting(null);
    }
  };

  const categoryTotals = useMemo(() => entries.reduce<Record<string, number>>((totals, entry) => {
    totals[entry.category] = (totals[entry.category] ?? 0) + entry.durationSeconds;
    return totals;
  }, {}), [entries]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.back()}
          style={styles.backButton}>
          <Text style={styles.backText}>‹  Retour</Text>
        </Pressable>

        <Text style={styles.eyebrow}>À TON RYTHME</Text>
        <Text style={styles.title}>Mon temps, sans pression.</Text>
        <Text style={styles.subtitle}>
          Lance le chronomètre quand tu le souhaites. Tu peux quitter cet écran : le temps continue.
        </Text>

        {activeSession ? (
          <View style={styles.timerCard}>
            <View style={styles.liveIndicator} />
            <Text style={styles.activeLabel}>TON MOMENT EN COURS</Text>
            <Text style={styles.timer}>{formatDuration(elapsedSeconds)}</Text>
            <Text style={styles.activeDescription}>
              {getCategoryLabel(activeSession.category)}
              {activeSession.project ? ` · ${activeSession.project}` : ''}
            </Text>
            {activeSession.taskTitle ? (
              <Text style={styles.activeTask}>{activeSession.taskTitle}</Text>
            ) : null}
            <Pressable
              accessibilityRole="button"
              disabled={isStopping}
              onPress={() => void handleStop()}
              style={[styles.stopButton, isStopping && styles.disabled]}>
              {isStopping
                ? <ActivityIndicator color={colors.surface} />
                : <Text style={styles.stopButtonText}>Terminer ce moment</Text>}
            </Pressable>
            <Text style={styles.softNote}>Chaque minute compte, même si tu t’arrêtes ici.</Text>
          </View>
        ) : (
          <View style={styles.startCard}>
            <Text style={styles.cardTitle}>Qu’aimerais-tu suivre ?</Text>
            <View style={styles.categories}>
              {TIME_CATEGORIES.map((item) => {
                const selected = category === item.id;
                return (
                  <Pressable
                    key={item.id}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() => setCategory(item.id)}
                    style={[styles.categoryChip, selected && styles.categoryChipSelected]}>
                    <Text style={[styles.categoryText, selected && styles.categoryTextSelected]}>
                      {item.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <TextInput
              value={project}
              onChangeText={setProject}
              placeholder="Projet (facultatif, ex. Révisions)"
              placeholderTextColor={colors.textLight}
              style={styles.projectInput}
              maxLength={100}
              returnKeyType="done"
            />

            {pendingTasks.length ? (
              <>
                <Text style={styles.fieldLabel}>Relier à un petit pas (facultatif)</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.taskChoices}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected: selectedTaskId === null }}
                    onPress={() => setSelectedTaskId(null)}
                    style={[styles.taskChip, selectedTaskId === null && styles.taskChipSelected]}>
                    <Text style={[styles.taskChipText, selectedTaskId === null && styles.taskChipTextSelected]}>
                      Aucun
                    </Text>
                  </Pressable>
                  {pendingTasks.map((task) => {
                    const selected = task.id === selectedTaskId;
                    return (
                      <Pressable
                        key={task.id}
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                        onPress={() => setSelectedTaskId(task.id)}
                        style={[styles.taskChip, selected && styles.taskChipSelected]}>
                        <Text numberOfLines={1} style={[styles.taskChipText, selected && styles.taskChipTextSelected]}>
                          {task.title}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </>
            ) : null}

            <Pressable
              accessibilityRole="button"
              disabled={!timerLoaded || isStarting}
              onPress={() => void handleStart()}
              style={[styles.startButton, (!timerLoaded || isStarting) && styles.disabled]}>
              {isStarting
                ? <ActivityIndicator color={colors.surface} />
                : <Text style={styles.startButtonText}>
                  {timerLoaded ? 'Commencer à suivre mon temps' : 'On prépare le chronomètre…'}
                </Text>}
            </Pressable>
            <Text style={styles.softNote}>Un seul chronomètre à la fois, que tu peux arrêter quand tu veux.</Text>
          </View>
        )}

        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        {actionError ? <Text style={styles.errorText}>{actionError}</Text> : null}

        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Ce mois-ci</Text>
            <Text style={styles.summaryValue}>{formatDuration(monthlySeconds)}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Tout mon temps suivi</Text>
            <Text style={styles.summaryValue}>{formatDuration(totalSeconds)}</Text>
          </View>
        </View>

        {Object.keys(categoryTotals).length ? (
          <View style={styles.summaryCard}>
            <Text style={styles.cardTitle}>Par catégorie</Text>
            {Object.entries(categoryTotals).map(([categoryId, seconds]) => (
              <View key={categoryId} style={styles.categoryTotalRow}>
                <Text style={styles.categoryTotalLabel}>
                  {getCategoryLabel(categoryId as TimeCategory)}
                </Text>
                <Text style={styles.categoryTotalValue}>{formatDuration(seconds)}</Text>
              </View>
            ))}
          </View>
        ) : null}

        <View style={styles.historyHeading}>
          <View>
            <Text style={styles.cardTitle}>Mes sessions</Text>
            <Text style={styles.historyHint}>Ton historique, prêt à être exporté.</Text>
          </View>
          {loading ? <ActivityIndicator color={colors.sage} /> : null}
        </View>

        {entries.length ? (
          <View style={styles.historyList}>
            {entries.slice(0, 40).map((entry) => (
              <View key={entry.id} style={styles.entryCard}>
                <View style={styles.entryTop}>
                  <Text style={styles.entryCategory}>{getCategoryLabel(entry.category)}</Text>
                  <Text style={styles.entryDuration}>{formatDuration(entry.durationSeconds)}</Text>
                </View>
                <Text style={styles.entryDate}>{formatEntryDate(entry)} · {formatEntryTime(entry)}</Text>
                {entry.project ? <Text style={styles.entryProject}>{entry.project}</Text> : null}
                {entry.taskTitle ? <Text style={styles.entryTask}>{entry.taskTitle}</Text> : null}
              </View>
            ))}
            {entries.length > 40 ? (
              <Text style={styles.historyHint}>Les exports contiennent les {entries.length} sessions.</Text>
            ) : null}
          </View>
        ) : !loading ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Aucun temps à retrouver pour le moment.</Text>
            <Text style={styles.historyHint}>Quand tu le souhaites, démarre ton premier chronomètre.</Text>
          </View>
        ) : null}

        <View style={styles.exportRow}>
          <Pressable
            accessibilityRole="button"
            disabled={!entries.length || exporting !== null}
            onPress={() => void handleExport('csv')}
            style={[styles.exportButton, (!entries.length || exporting !== null) && styles.disabled]}>
            <Text style={styles.exportButtonText}>{exporting === 'csv' ? 'Préparation…' : 'Exporter CSV'}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={!entries.length || exporting !== null}
            onPress={() => void handleExport('pdf')}
            style={[styles.exportButton, styles.pdfButton, (!entries.length || exporting !== null) && styles.disabled]}>
            <Text style={styles.exportButtonText}>{exporting === 'pdf' ? 'Préparation…' : 'Exporter PDF'}</Text>
          </Pressable>
        </View>
        <Text style={styles.exportHint}>
          Les exports contiennent toutes tes sessions, avec leur catégorie, projet, horaire et durée.
        </Text>
      </ScrollView>
      <BottomNavigation active="tasks" />
    </SafeAreaView>
  );
}

const createStyles = (palette: AppColors) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.background },
  content: { padding: spacing.md, paddingBottom: spacing.xl },
  backButton: { alignSelf: 'flex-start', marginBottom: spacing.md },
  backText: { color: palette.sage, fontSize: 12, fontWeight: '600' },
  eyebrow: { color: palette.sage, fontSize: 9, letterSpacing: 1.2, fontWeight: '700' },
  title: { color: palette.textPrimary, fontSize: 26, lineHeight: 33, fontFamily: typography.fonts.display, fontWeight: '600', marginTop: 5 },
  subtitle: { color: palette.textSecondary, fontSize: 11, lineHeight: 17, marginTop: 5, marginBottom: spacing.md },
  timerCard: { alignItems: 'center', padding: spacing.lg, borderRadius: borderRadius.large, backgroundColor: palette.sagePale },
  liveIndicator: { width: 9, height: 9, borderRadius: 5, backgroundColor: palette.sage, marginBottom: spacing.xs },
  activeLabel: { color: palette.sage, fontSize: 8, letterSpacing: 1, fontWeight: '700' },
  timer: { color: palette.textPrimary, fontSize: 42, fontVariant: ['tabular-nums'], fontFamily: typography.fonts.display, fontWeight: '600', marginVertical: spacing.xs },
  activeDescription: { color: palette.textSecondary, fontSize: 11 },
  activeTask: { color: palette.textPrimary, fontSize: 10, fontWeight: '600', marginTop: 4 },
  stopButton: { width: '100%', minHeight: 46, alignItems: 'center', justifyContent: 'center', borderRadius: borderRadius.extraLarge, backgroundColor: palette.sage, marginTop: spacing.md },
  stopButtonText: { color: palette.surface, fontSize: 11, fontWeight: '700' },
  softNote: { color: palette.textSecondary, fontSize: 9, lineHeight: 14, textAlign: 'center', marginTop: spacing.sm },
  startCard: { padding: spacing.md, borderRadius: borderRadius.large, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border },
  cardTitle: { color: palette.textPrimary, fontSize: 15, fontFamily: typography.fonts.display, fontWeight: '600' },
  categories: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.sm },
  categoryChip: { paddingHorizontal: spacing.sm, paddingVertical: 8, borderRadius: borderRadius.extraLarge, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.background },
  categoryChipSelected: { backgroundColor: palette.sage, borderColor: palette.sage },
  categoryText: { color: palette.textSecondary, fontSize: 9, fontWeight: '600' },
  categoryTextSelected: { color: palette.surface },
  projectInput: { minHeight: 44, paddingHorizontal: spacing.sm, borderWidth: 1, borderColor: palette.border, borderRadius: borderRadius.medium, backgroundColor: palette.background, color: palette.textPrimary, fontSize: 11, marginTop: spacing.md },
  fieldLabel: { color: palette.textSecondary, fontSize: 9, fontWeight: '600', marginTop: spacing.md },
  taskChoices: { gap: spacing.xs, paddingVertical: spacing.xs },
  taskChip: { maxWidth: 180, paddingHorizontal: spacing.sm, paddingVertical: 7, borderRadius: borderRadius.extraLarge, backgroundColor: palette.background, borderWidth: 1, borderColor: palette.border },
  taskChipSelected: { backgroundColor: palette.sagePale, borderColor: palette.sage },
  taskChipText: { color: palette.textSecondary, fontSize: 9 },
  taskChipTextSelected: { color: palette.sage, fontWeight: '700' },
  startButton: { minHeight: 46, alignItems: 'center', justifyContent: 'center', borderRadius: borderRadius.extraLarge, backgroundColor: palette.sage, marginTop: spacing.md },
  startButtonText: { color: palette.surface, fontSize: 10, fontWeight: '700' },
  disabled: { opacity: 0.55 },
  errorText: { color: palette.error, fontSize: 10, lineHeight: 15, marginTop: spacing.sm },
  summaryRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  summaryCard: { flex: 1, padding: spacing.md, borderRadius: borderRadius.medium, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border, marginTop: spacing.sm },
  summaryLabel: { color: palette.textSecondary, fontSize: 8 },
  summaryValue: { color: palette.sage, fontSize: 15, fontWeight: '700', marginTop: 6 },
  categoryTotalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: spacing.sm },
  categoryTotalLabel: { color: palette.textSecondary, fontSize: 10 },
  categoryTotalValue: { color: palette.textPrimary, fontSize: 10, fontWeight: '600' },
  historyHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.lg },
  historyHint: { color: palette.textSecondary, fontSize: 9, lineHeight: 14, marginTop: 3 },
  historyList: { gap: spacing.xs, marginTop: spacing.xs },
  entryCard: { padding: spacing.sm, borderRadius: borderRadius.medium, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border },
  entryTop: { flexDirection: 'row', justifyContent: 'space-between' },
  entryCategory: { color: palette.sage, fontSize: 10, fontWeight: '700' },
  entryDuration: { color: palette.textPrimary, fontSize: 10, fontWeight: '700' },
  entryDate: { color: palette.textSecondary, fontSize: 8, marginTop: 4 },
  entryProject: { color: palette.textPrimary, fontSize: 9, marginTop: 4 },
  entryTask: { color: palette.textSecondary, fontSize: 9, marginTop: 3 },
  emptyCard: { alignItems: 'center', padding: spacing.md, borderRadius: borderRadius.medium, backgroundColor: palette.surface, marginTop: spacing.sm },
  emptyTitle: { color: palette.textPrimary, fontSize: 11, fontWeight: '600' },
  exportRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
  exportButton: { flex: 1, minHeight: 42, alignItems: 'center', justifyContent: 'center', borderRadius: borderRadius.extraLarge, backgroundColor: palette.sage },
  pdfButton: { backgroundColor: palette.clay },
  exportButtonText: { color: palette.surface, fontSize: 10, fontWeight: '700' },
  exportHint: { color: palette.textSecondary, fontSize: 8, lineHeight: 13, textAlign: 'center', marginTop: spacing.xs },
});
