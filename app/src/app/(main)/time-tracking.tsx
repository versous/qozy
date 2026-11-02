import { typography } from '@/theme/typography';
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Svg, { Circle } from 'react-native-svg';

import { BottomNavigation } from '@/components/BottomNavigation';
import { BrandHeader } from '@/components/BrandHeader';
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

type ScreenTab = 'timer' | 'history';
const TIMER_TARGET_SECONDS = 25 * 60;

function formatDuration(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
}

function formatTimer(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return minutes >= 60
    ? formatDuration(seconds)
    : `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
}

function formatShortDuration(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours && minutes) return `${hours} h ${minutes} min`;
  if (hours) return `${hours} h`;
  return `${Math.max(minutes, 1)} min`;
}

function getCategoryLabel(categoryId: TimeCategory) {
  return TIME_CATEGORIES.find((category) => category.id === categoryId)?.label ?? 'Autre';
}

function getCategoryIcon(categoryId: TimeCategory) {
  const icons: Record<TimeCategory, string> = {
    code: '⌘',
    study: '▤',
    leisure: '◉',
    wellbeing: '♡',
    admin: '☷',
    other: '✳',
  };
  return icons[categoryId];
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
  return `${start}–${end}`;
}

function isToday(entry: TimeEntry, today: string) {
  const date = entry.startedAt.toDate();
  const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  return key === today;
}

function getDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export default function TimeTrackingScreen() {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const { tasks } = useTasks();
  const {
    entries,
    activeSession,
    elapsedSeconds,
    isPaused,
    timerLoaded,
    loading,
    error,
    isStarting,
    isStopping,
    startTimer,
    pauseTimer,
    resumeTimer,
    stopTimer,
    addManualEntry,
  } = useTimeTracking();
  const [tab, setTab] = useState<ScreenTab>('timer');
  const [category, setCategory] = useState<TimeCategory>('study');
  const [project, setProject] = useState('');
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [isCategoryMenuOpen, setIsCategoryMenuOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<'csv' | 'pdf' | null>(null);
  const [isManualModalVisible, setIsManualModalVisible] = useState(false);
  const [manualDuration, setManualDuration] = useState('25');
  const [manualCategory, setManualCategory] = useState<TimeCategory>('study');
  const [manualProject, setManualProject] = useState('');
  const [isAddingManual, setIsAddingManual] = useState(false);

  const selectedTask = tasks.find((task) => task.id === selectedTaskId) ?? null;
  const pendingTasks = tasks.filter((task) => !task.completed);
  const todayKey = getDateKey(new Date());
  const todaysEntries = useMemo(
    () => entries.filter((entry) => isToday(entry, todayKey)),
    [entries, todayKey]
  );
  const olderEntries = useMemo(
    () => entries.filter((entry) => !isToday(entry, todayKey)),
    [entries, todayKey]
  );
  const todaysSeconds = useMemo(
    () => todaysEntries.reduce((sum, entry) => sum + entry.durationSeconds, 0),
    [todaysEntries]
  );
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
  const timerProgress = Math.min(1, elapsedSeconds / TIMER_TARGET_SECONDS);

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

  const handlePause = async () => {
    setActionError(null);
    try {
      if (isPaused) await resumeTimer();
      else await pauseTimer();
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : 'Impossible de modifier le chronomètre.');
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

  const handleManualSave = async () => {
    const minutes = Number(manualDuration);
    if (!/^\d+$/.test(manualDuration) || minutes < 1 || minutes > 1440) {
      setActionError('Indique une durée comprise entre 1 et 1 440 minutes.');
      return;
    }
    setActionError(null);
    setIsAddingManual(true);
    try {
      await addManualEntry({
        category: manualCategory,
        project: manualProject,
        durationSeconds: minutes * 60,
      });
      setIsManualModalVisible(false);
      setManualProject('');
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : 'Impossible d’ajouter cette session.');
    } finally {
      setIsAddingManual(false);
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
        <BrandHeader />
        <Pressable
          accessibilityRole="button"
          onPress={() => router.back()}
          style={styles.backButton}>
          <Text style={styles.backText}>‹  Aujourd’hui</Text>
        </Pressable>
        <Text style={styles.title}>Le temps pour moi</Text>
        <Text style={styles.subtitle}>
          {new Date().toLocaleDateString('fr-FR', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
          })} · Observer, sans se juger.
        </Text>

        <View style={styles.tabs}>
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === 'timer' }}
            onPress={() => setTab('timer')}
            style={[styles.tab, tab === 'timer' && styles.tabSelected]}>
            <Text style={[styles.tabText, tab === 'timer' && styles.tabTextSelected]}>Minuterie</Text>
          </Pressable>
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === 'history' }}
            onPress={() => setTab('history')}
            style={[styles.tab, tab === 'history' && styles.tabSelected]}>
            <Text style={[styles.tabText, tab === 'history' && styles.tabTextSelected]}>Historique</Text>
          </Pressable>
        </View>

        {tab === 'timer' ? (
          <>
            {!activeSession ? (
              <View style={styles.setupCard}>
                <Text style={styles.fieldLabel}>Catégorie</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ expanded: isCategoryMenuOpen }}
                  onPress={() => setIsCategoryMenuOpen((open) => !open)}
                  style={styles.selectField}>
                  <Text style={styles.selectValue}>{getCategoryLabel(category)}</Text>
                  <Text style={styles.selectChevron}>{isCategoryMenuOpen ? '⌃' : '⌄'}</Text>
                </Pressable>
                {isCategoryMenuOpen ? (
                  <View style={styles.categoryMenu}>
                    {TIME_CATEGORIES.map((item) => (
                      <Pressable
                        key={item.id}
                        accessibilityRole="button"
                        accessibilityState={{ selected: category === item.id }}
                        onPress={() => {
                          setCategory(item.id);
                          setIsCategoryMenuOpen(false);
                        }}
                        style={[styles.categoryOption, category === item.id && styles.categoryOptionSelected]}>
                        <Text style={[styles.categoryOptionText, category === item.id && styles.categoryOptionTextSelected]}>
                          {item.label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                ) : null}

                <Text style={[styles.fieldLabel, styles.projectLabel]}>Projet</Text>
                <TextInput
                  value={project}
                  onChangeText={setProject}
                  placeholder="Ex. Design · Révisions"
                  placeholderTextColor={colors.textLight}
                  style={styles.projectInput}
                  maxLength={100}
                  returnKeyType="done"
                />

                {pendingTasks.length ? (
                  <>
                    <Text style={styles.fieldLabel}>Relier à une tâche (facultatif)</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.taskChoices}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityState={{ selected: selectedTaskId === null }}
                        onPress={() => setSelectedTaskId(null)}
                        style={[styles.taskChip, selectedTaskId === null && styles.taskChipSelected]}>
                        <Text style={[styles.taskChipText, selectedTaskId === null && styles.taskChipTextSelected]}>
                          Aucune
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
                      {timerLoaded ? 'Commencer ma session' : 'On prépare le chronomètre…'}
                    </Text>}
                </Pressable>
              </View>
            ) : (
              <View style={styles.timerCard}>
                <Text style={styles.activeLabel}>
                  {isPaused ? 'SESSION EN PAUSE' : `SESSION EN COURS · DEPUIS ${new Date(activeSession.startedAtMs).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`}
                </Text>
                <View
                  accessibilityRole="progressbar"
                  accessibilityLabel={`Session de ${formatDuration(elapsedSeconds)}`}
                  accessibilityValue={{ min: 0, max: TIMER_TARGET_SECONDS, now: Math.min(elapsedSeconds, TIMER_TARGET_SECONDS) }}
                  style={styles.timerRing}>
                  <Svg width={156} height={156} viewBox="0 0 156 156" style={styles.timerSvg}>
                    <Circle cx={78} cy={78} r={62} fill="none" stroke={colors.border} strokeWidth={7} />
                    <Circle
                      cx={78}
                      cy={78}
                      r={62}
                      fill="none"
                      stroke={colors.sage}
                      strokeWidth={7}
                      strokeDasharray={`${2 * Math.PI * 62} ${2 * Math.PI * 62}`}
                      strokeDashoffset={2 * Math.PI * 62 * (1 - timerProgress)}
                      rotation={-90}
                      origin="78, 78"
                    />
                  </Svg>
                  <View style={styles.timerCenter}>
                    <Text style={styles.timer}>{formatTimer(elapsedSeconds)}</Text>
                    <Text style={styles.timerGoal}>objectif · 25 min</Text>
                  </View>
                </View>
                <Text style={styles.activeDescription}>
                  {getCategoryLabel(activeSession.category)}
                  {activeSession.project ? ` · ${activeSession.project}` : ''}
                </Text>
                {activeSession.taskTitle ? <Text style={styles.activeTask}>{activeSession.taskTitle}</Text> : null}
                <View style={styles.timerActions}>
                  <Pressable
                    accessibilityRole="button"
                    disabled={isStopping}
                    onPress={() => void handlePause()}
                    style={[styles.pauseButton, isStopping && styles.disabled]}>
                    <Text style={styles.pauseButtonText}>{isPaused ? '▶  Reprendre' : 'Ⅱ  Pause'}</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    disabled={isStopping}
                    onPress={() => void handleStop()}
                    style={[styles.finishButton, isStopping && styles.disabled]}>
                    {isStopping
                      ? <ActivityIndicator color={colors.sage} />
                      : <Text style={styles.finishButtonText}>□  Terminer</Text>}
                  </Pressable>
                </View>
                <Text style={styles.softNote}>
                  {isPaused ? 'Le temps est en pause.' : 'Ce temps n’est pas encore enregistré.'}
                </Text>
              </View>
            )}
          </>
        ) : (
          <>
            <View style={styles.historyHeading}>
              <Text style={styles.historyTitle}>Sessions terminées</Text>
              <Text style={styles.todayLabel}>Aujourd’hui</Text>
            </View>
            {loading ? <ActivityIndicator color={colors.sage} style={styles.loader} /> : null}
            {todaysEntries.length ? (
              <View style={styles.historyList}>
                {todaysEntries.map((entry) => (
                  <View key={entry.id} style={styles.entryCard}>
                    <View style={styles.entryIcon}>
                      <Text style={styles.entryIconText}>{getCategoryIcon(entry.category)}</Text>
                    </View>
                    <View style={styles.entryCopy}>
                      <Text numberOfLines={1} style={styles.entryTitle}>
                        {entry.project || getCategoryLabel(entry.category)}
                      </Text>
                      <Text style={styles.entrySubtitle}>
                        {formatEntryTime(entry)} · {getCategoryLabel(entry.category)}
                        {entry.taskTitle ? ` / ${entry.taskTitle}` : ''}
                      </Text>
                    </View>
                    <Text style={styles.entryDuration}>{formatShortDuration(entry.durationSeconds)}</Text>
                  </View>
                ))}
              </View>
            ) : !loading ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>Aucune session terminée aujourd’hui.</Text>
                <Text style={styles.historyHint}>Chaque moment compte, même les plus courts.</Text>
              </View>
            ) : null}

            <View style={styles.recordedCard}>
              <View style={styles.recordedHeading}>
                <Text style={styles.recordedTitle}>Temps enregistré</Text>
                <Text style={styles.recordedTotal}>{formatShortDuration(todaysSeconds)}</Text>
              </View>
              <Text style={styles.recordedBreakdown}>
                {Object.entries(categoryTotals)
                  .filter(([categoryId]) => todaysEntries.some((entry) => entry.category === categoryId))
                  .map(([categoryId, seconds]) => `${getCategoryLabel(categoryId as TimeCategory)} ${formatShortDuration(
                    todaysEntries
                      .filter((entry) => entry.category === categoryId)
                      .reduce((sum, entry) => sum + entry.durationSeconds, 0)
                  )}`)
                  .join(' · ') || 'Aucun temps terminé enregistré.'}
              </Text>
              <Text style={styles.recordedHint}>Total des sessions terminées uniquement.</Text>
            </View>

            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setActionError(null);
                setManualDuration('25');
                setManualCategory(category);
                setManualProject('');
                setIsManualModalVisible(true);
              }}
              style={styles.manualButton}>
              <Text style={styles.manualButtonText}>＋  Ajouter une session manuellement</Text>
            </Pressable>

            {olderEntries.length ? (
              <>
                <View style={styles.historyHeading}>
                  <Text style={styles.historyTitle}>Jours précédents</Text>
                </View>
                <View style={styles.historyList}>
                  {olderEntries.slice(0, 40).map((entry) => (
                    <View key={entry.id} style={styles.entryCard}>
                      <View style={styles.entryIcon}>
                        <Text style={styles.entryIconText}>{getCategoryIcon(entry.category)}</Text>
                      </View>
                      <View style={styles.entryCopy}>
                        <Text numberOfLines={1} style={styles.entryTitle}>
                          {entry.project || getCategoryLabel(entry.category)}
                        </Text>
                        <Text style={styles.entrySubtitle}>
                          {formatEntryDate(entry)} · {formatEntryTime(entry)} · {getCategoryLabel(entry.category)}
                        </Text>
                      </View>
                      <Text style={styles.entryDuration}>{formatShortDuration(entry.durationSeconds)}</Text>
                    </View>
                  ))}
                </View>
              </>
            ) : null}

            <View style={styles.summaryRow}>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryLabel}>Ce mois-ci</Text>
                <Text style={styles.summaryValue}>{formatShortDuration(monthlySeconds)}</Text>
              </View>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryLabel}>Tout mon temps suivi</Text>
                <Text style={styles.summaryValue}>{formatShortDuration(totalSeconds)}</Text>
              </View>
            </View>

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
            <Text style={styles.exportHint}>Les exports reprennent toutes tes sessions, avec leur catégorie, projet, horaire et durée.</Text>
          </>
        )}

        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        {actionError ? <Text style={styles.errorText}>{actionError}</Text> : null}
      </ScrollView>
      <BottomNavigation active="tasks" />

      <Modal
        visible={isManualModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIsManualModalVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modal}>
            <Text style={styles.modalEyebrow}>HISTORIQUE</Text>
            <Text style={styles.modalTitle}>Ajouter une session</Text>
            <Text style={styles.modalDescription}>La session sera ajoutée à tes temps terminés.</Text>
            <Text style={styles.fieldLabel}>Catégorie</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.manualCategories}>
              {TIME_CATEGORIES.map((item) => (
                <Pressable
                  key={item.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected: manualCategory === item.id }}
                  onPress={() => setManualCategory(item.id)}
                  style={[styles.taskChip, manualCategory === item.id && styles.taskChipSelected]}>
                  <Text style={[styles.taskChipText, manualCategory === item.id && styles.taskChipTextSelected]}>
                    {item.label}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
            <Text style={[styles.fieldLabel, styles.projectLabel]}>Projet (facultatif)</Text>
            <TextInput
              value={manualProject}
              onChangeText={setManualProject}
              placeholder="Ex. Design · Révisions"
              placeholderTextColor={colors.textLight}
              style={styles.projectInput}
              maxLength={100}
              returnKeyType="done"
            />
            <Text style={[styles.fieldLabel, styles.projectLabel]}>Durée (minutes)</Text>
            <TextInput
              accessibilityLabel="Durée en minutes"
              value={manualDuration}
              onChangeText={(value) => setManualDuration(value.replace(/[^\d]/g, '').slice(0, 4))}
              keyboardType="number-pad"
              style={styles.projectInput}
              maxLength={4}
            />
            <Pressable
              accessibilityRole="button"
              disabled={isAddingManual || !manualDuration}
              onPress={() => void handleManualSave()}
              style={[styles.startButton, (isAddingManual || !manualDuration) && styles.disabled]}>
              {isAddingManual
                ? <ActivityIndicator color={colors.surface} />
                : <Text style={styles.startButtonText}>Ajouter à l’historique</Text>}
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => setIsManualModalVisible(false)}
              style={styles.cancelButton}>
              <Text style={styles.cancelButtonText}>Annuler</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const createStyles = (palette: AppColors) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.background },
  content: { padding: spacing.md, paddingBottom: spacing.xl },
  backButton: { alignSelf: 'flex-start', marginTop: spacing.sm, marginBottom: spacing.md },
  backText: { color: palette.sage, fontSize: 10, fontWeight: '700' },
  title: { color: palette.textPrimary, fontSize: 25, lineHeight: 32, fontFamily: typography.fonts.display, fontWeight: '600' },
  subtitle: { color: palette.textSecondary, fontSize: 9, lineHeight: 14, marginTop: 2, marginBottom: spacing.md, textTransform: 'capitalize' },
  tabs: { flexDirection: 'row', padding: 3, marginBottom: spacing.md, borderRadius: borderRadius.extraLarge, backgroundColor: palette.sagePale },
  tab: { flex: 1, minHeight: 34, alignItems: 'center', justifyContent: 'center', borderRadius: borderRadius.extraLarge },
  tabSelected: { backgroundColor: palette.sage },
  tabText: { color: palette.textSecondary, fontSize: 9, fontWeight: '700' },
  tabTextSelected: { color: palette.surface },
  setupCard: { padding: spacing.md, borderRadius: borderRadius.large, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border },
  fieldLabel: { color: palette.textPrimary, fontSize: 9, fontWeight: '700', marginBottom: 5 },
  selectField: { minHeight: 43, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.sm, borderWidth: 1, borderColor: palette.border, borderRadius: borderRadius.small, backgroundColor: palette.background },
  selectValue: { color: palette.textSecondary, fontSize: 10 },
  selectChevron: { color: palette.sage, fontSize: 16 },
  categoryMenu: { padding: spacing.xs, marginTop: 4, borderWidth: 1, borderColor: palette.border, borderRadius: borderRadius.small, backgroundColor: palette.background },
  categoryOption: { minHeight: 35, justifyContent: 'center', paddingHorizontal: spacing.sm, borderRadius: borderRadius.small },
  categoryOptionSelected: { backgroundColor: palette.sagePale },
  categoryOptionText: { color: palette.textSecondary, fontSize: 9 },
  categoryOptionTextSelected: { color: palette.sage, fontWeight: '700' },
  projectLabel: { marginTop: spacing.sm },
  projectInput: { minHeight: 43, paddingHorizontal: spacing.sm, borderWidth: 1, borderColor: palette.border, borderRadius: borderRadius.small, backgroundColor: palette.background, color: palette.textPrimary, fontSize: 10 },
  taskChoices: { gap: spacing.xs, paddingVertical: spacing.xs },
  taskChip: { maxWidth: 180, paddingHorizontal: spacing.sm, paddingVertical: 7, borderRadius: borderRadius.extraLarge, backgroundColor: palette.background, borderWidth: 1, borderColor: palette.border },
  taskChipSelected: { backgroundColor: palette.sagePale, borderColor: palette.sage },
  taskChipText: { color: palette.textSecondary, fontSize: 8 },
  taskChipTextSelected: { color: palette.sage, fontWeight: '700' },
  startButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: borderRadius.extraLarge, backgroundColor: palette.sage, marginTop: spacing.md },
  startButtonText: { color: palette.surface, fontSize: 9, fontWeight: '700' },
  disabled: { opacity: 0.55 },
  timerCard: { alignItems: 'center', padding: spacing.md, borderRadius: borderRadius.large, backgroundColor: palette.sagePale },
  activeLabel: { color: palette.sage, fontSize: 8, letterSpacing: 0.5, fontWeight: '700', textAlign: 'center' },
  timerRing: { width: 156, height: 156, position: 'relative', marginVertical: spacing.md },
  timerSvg: { position: 'absolute', top: 0, left: 0 },
  timerCenter: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  timer: { color: palette.textPrimary, fontSize: 28, fontVariant: ['tabular-nums'], fontFamily: typography.fonts.display, fontWeight: '600' },
  timerGoal: { color: palette.textSecondary, fontSize: 8, marginTop: 3 },
  activeDescription: { color: palette.textSecondary, fontSize: 9, textAlign: 'center' },
  activeTask: { color: palette.textPrimary, fontSize: 9, fontWeight: '600', marginTop: 4 },
  timerActions: { flexDirection: 'row', gap: spacing.xs, width: '100%', marginTop: spacing.md },
  pauseButton: { flex: 1, minHeight: 40, alignItems: 'center', justifyContent: 'center', borderRadius: borderRadius.extraLarge, backgroundColor: palette.sage },
  pauseButtonText: { color: palette.surface, fontSize: 9, fontWeight: '700' },
  finishButton: { flex: 1, minHeight: 40, alignItems: 'center', justifyContent: 'center', borderRadius: borderRadius.extraLarge, backgroundColor: palette.surface },
  finishButtonText: { color: palette.sage, fontSize: 9, fontWeight: '700' },
  softNote: { color: palette.textSecondary, fontSize: 8, lineHeight: 13, textAlign: 'center', marginTop: spacing.sm },
  historyHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.xs, marginBottom: spacing.xs },
  historyTitle: { color: palette.textPrimary, fontSize: 15, fontFamily: typography.fonts.display, fontWeight: '600' },
  todayLabel: { color: palette.sage, fontSize: 8, fontWeight: '700' },
  loader: { marginVertical: spacing.md },
  historyList: { gap: spacing.xs },
  entryCard: { minHeight: 55, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: borderRadius.medium, backgroundColor: palette.surface },
  entryIcon: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center', borderRadius: 9, backgroundColor: palette.sagePale },
  entryIconText: { color: palette.sage, fontSize: 15 },
  entryCopy: { flex: 1, minWidth: 0 },
  entryTitle: { color: palette.textPrimary, fontSize: 9, fontWeight: '700' },
  entrySubtitle: { color: palette.textSecondary, fontSize: 7, marginTop: 3 },
  entryDuration: { color: palette.sage, fontSize: 8, fontWeight: '700' },
  emptyCard: { alignItems: 'center', padding: spacing.md, borderRadius: borderRadius.medium, backgroundColor: palette.surface },
  emptyTitle: { color: palette.textPrimary, fontSize: 10, fontWeight: '600', textAlign: 'center' },
  historyHint: { color: palette.textSecondary, fontSize: 8, lineHeight: 13, marginTop: 4 },
  recordedCard: { padding: spacing.sm, marginTop: spacing.sm, borderRadius: borderRadius.medium, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border },
  recordedHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  recordedTitle: { color: palette.textPrimary, fontSize: 9, fontWeight: '700' },
  recordedTotal: { color: palette.textPrimary, fontSize: 21, fontFamily: typography.fonts.display },
  recordedBreakdown: { color: palette.textSecondary, fontSize: 8, lineHeight: 13, marginTop: spacing.xs },
  recordedHint: { color: palette.textLight, fontSize: 7, lineHeight: 12, marginTop: spacing.xs },
  manualButton: { minHeight: 41, alignItems: 'center', justifyContent: 'center', marginTop: spacing.sm, borderRadius: borderRadius.extraLarge, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border },
  manualButtonText: { color: palette.sage, fontSize: 9, fontWeight: '700' },
  summaryRow: { flexDirection: 'row', gap: spacing.xs, marginTop: spacing.sm },
  summaryCard: { flex: 1, padding: spacing.sm, borderRadius: borderRadius.medium, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border },
  summaryLabel: { color: palette.textSecondary, fontSize: 7 },
  summaryValue: { color: palette.sage, fontSize: 12, fontWeight: '700', marginTop: 4 },
  exportRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  exportButton: { flex: 1, minHeight: 40, alignItems: 'center', justifyContent: 'center', borderRadius: borderRadius.extraLarge, backgroundColor: palette.sage },
  pdfButton: { backgroundColor: palette.clay },
  exportButtonText: { color: palette.surface, fontSize: 9, fontWeight: '700' },
  exportHint: { color: palette.textSecondary, fontSize: 7, lineHeight: 12, textAlign: 'center', marginTop: spacing.xs },
  errorText: { color: palette.error, fontSize: 9, lineHeight: 14, marginTop: spacing.sm },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(42, 48, 39, 0.38)' },
  modal: { padding: spacing.lg, paddingBottom: spacing.xl, borderTopLeftRadius: borderRadius.large, borderTopRightRadius: borderRadius.large, backgroundColor: palette.background },
  modalEyebrow: { color: palette.sage, fontSize: 8, fontWeight: '700', letterSpacing: 0.8, textAlign: 'center' },
  modalTitle: { color: palette.textPrimary, fontSize: 20, fontFamily: typography.fonts.display, fontWeight: '600', textAlign: 'center', marginTop: spacing.xs },
  modalDescription: { color: palette.textSecondary, fontSize: 9, lineHeight: 14, textAlign: 'center', marginTop: spacing.xs, marginBottom: spacing.md },
  manualCategories: { gap: spacing.xs, paddingVertical: spacing.xs },
  cancelButton: { minHeight: 36, alignItems: 'center', justifyContent: 'center', marginTop: spacing.xs },
  cancelButtonText: { color: palette.textSecondary, fontSize: 9, fontWeight: '600' },
});
