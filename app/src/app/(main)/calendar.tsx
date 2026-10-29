import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BottomNavigation } from '@/components/BottomNavigation';
import { CosyButton } from '@/components/common/CosyButton';
import { useHabits } from '@/hooks/useHabits';
import { useTasks, type TaskPriority, type TodoTask } from '@/hooks/useTasks';
import { borderRadius, colors, spacing } from '@/theme/colors';

const weekdayLabels = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const priorities: { value: TaskPriority; label: string }[] = [
  { value: 'urgent', label: 'Urgent' },
  { value: 'important', label: 'Important' },
  { value: 'normal', label: 'Normal' },
];

function getDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function getCalendarCells(month: Date) {
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const offset = (new Date(year, monthIndex, 1).getDay() + 6) % 7;
  const dayCount = new Date(year, monthIndex + 1, 0).getDate();

  return Array.from({ length: 42 }, (_, index) => {
    const day = index - offset + 1;
    return day > 0 && day <= dayCount ? new Date(year, monthIndex, day) : null;
  });
}

function shiftMonth(month: Date, amount: number) {
  return new Date(month.getFullYear(), month.getMonth() + amount, 1);
}

function formatMonth(month: Date) {
  const label = month.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function getPriorityLabel(task: TodoTask) {
  if (task.priority === 'urgent') return 'Urgente';
  if (task.priority === 'important') return 'Importante';
  return 'Normale';
}

function isValidDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

export default function CalendarScreen() {
  const todayKey = getDateKey(new Date());
  const { allHabits, loading: habitsLoading, error: habitsError, toggleHabitForDate } = useHabits();
  const { tasks, loading: tasksLoading, error: tasksError, toggleTask, saveTask } = useTasks();
  const [month, setMonth] = useState(() => {
    const current = new Date();
    return new Date(current.getFullYear(), current.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const [isTaskModalVisible, setIsTaskModalVisible] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [taskDueDate, setTaskDueDate] = useState(todayKey);
  const [taskPriority, setTaskPriority] = useState<TaskPriority>('normal');
  const [taskError, setTaskError] = useState('');
  const [savingTask, setSavingTask] = useState(false);
  const cells = useMemo(() => getCalendarCells(month), [month]);
  const selectedDateObject = new Date(`${selectedDate}T00:00:00`);
  const selectedHabits = allHabits.filter((habit) =>
    habit.frequencyDays.includes(selectedDateObject.getDay() as 0 | 1 | 2 | 3 | 4 | 5 | 6)
  );
  const selectedTasks = tasks.filter((task) => task.dueDate === selectedDate);
  const monthLabel = formatMonth(month);
  const selectedDateLabel = selectedDate === todayKey
    ? 'Aujourd’hui'
    : selectedDateObject.toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });

  const tasksForDate = (date: Date) => tasks.filter((task) => task.dueDate === getDateKey(date)).length;
  const habitsForDate = (date: Date) => {
    const day = date.getDay() as 0 | 1 | 2 | 3 | 4 | 5 | 6;
    return allHabits.filter((habit) => habit.frequencyDays.includes(day)).length;
  };

  const handleMonthChange = (amount: number) => {
    const nextMonth = shiftMonth(month, amount);
    setMonth(nextMonth);
    if (selectedDate.slice(0, 7) !== getDateKey(nextMonth).slice(0, 7)) {
      setSelectedDate(getDateKey(nextMonth));
    }
  };

  const handleTaskToggle = async (task: TodoTask) => {
    try {
      await toggleTask(task);
    } catch (reason) {
      Alert.alert(
        'Modification impossible',
        reason instanceof Error ? reason.message : 'Réessaie plus tard.'
      );
    }
  };

  const handleHabitToggle = async (habitId: string) => {
    try {
      await toggleHabitForDate(habitId, selectedDate);
    } catch (reason) {
      Alert.alert(
        'Modification impossible',
        reason instanceof Error ? reason.message : 'Réessaie plus tard.'
      );
    }
  };

  const openTaskModal = () => {
    setTaskTitle('');
    setTaskDescription('');
    setTaskDueDate(selectedDate);
    setTaskPriority('normal');
    setTaskError('');
    setIsTaskModalVisible(true);
  };

  const handleSaveTask = async () => {
    const dueDate = taskDueDate.trim();
    if (dueDate && !isValidDate(dueDate)) {
      setTaskError('Saisis une date valide au format AAAA-MM-JJ.');
      return;
    }

    setSavingTask(true);
    setTaskError('');
    try {
      await saveTask({
        title: taskTitle,
        description: taskDescription,
        priority: taskPriority,
        dueDate: dueDate || null,
      });
      setIsTaskModalVisible(false);
    } catch (reason) {
      setTaskError(reason instanceof Error ? reason.message : 'Impossible d’enregistrer cette tâche.');
    } finally {
      setSavingTask(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.brandLine}>
          <Text style={styles.brand}>nid</Text>
          <Text style={styles.brandCaption}>À VOTRE RYTHME</Text>
        </View>
        <Text style={styles.eyebrow}>MES REPÈRES</Text>
        <Text style={styles.title}>Mon calendrier</Text>
        <Text style={styles.subtitle}>Un aperçu doux de ce qui compte, jour après jour.</Text>

        <View style={styles.calendarCard}>
          <View style={styles.monthHeader}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Mois précédent"
              onPress={() => handleMonthChange(-1)}
              style={styles.monthArrow}>
              <Text style={styles.monthArrowText}>‹</Text>
            </Pressable>
            <Text style={styles.monthTitle}>{monthLabel}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Mois suivant"
              onPress={() => handleMonthChange(1)}
              style={styles.monthArrow}>
              <Text style={styles.monthArrowText}>›</Text>
            </Pressable>
          </View>

          <View style={styles.weekdayRow}>
            {weekdayLabels.map((label, index) => (
              <Text key={`${label}-${index}`} style={styles.weekdayLabel}>{label}</Text>
            ))}
          </View>

          <View style={styles.daysGrid}>
            {cells.map((date, index) => {
              if (!date) return <View key={`empty-${index}`} style={styles.dayCell} />;
              const dateKey = getDateKey(date);
              const selected = dateKey === selectedDate;
              const isToday = dateKey === todayKey;
              const taskCount = tasksForDate(date);
              const habitCount = habitsForDate(date);

              return (
                <Pressable
                  key={dateKey}
                  accessibilityRole="button"
                  accessibilityLabel={date.toLocaleDateString('fr-FR', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                  })}
                  accessibilityState={{ selected }}
                  onPress={() => setSelectedDate(dateKey)}
                  style={[styles.dayCell, selected && styles.dayCellSelected]}>
                  <Text style={[
                    styles.dayNumber,
                    isToday && styles.dayNumberToday,
                    selected && styles.dayNumberSelected,
                  ]}>
                    {date.getDate()}
                  </Text>
                  <View style={styles.dayIndicators}>
                    {taskCount > 0 ? <View style={[styles.indicator, styles.taskIndicator]} /> : null}
                    {habitCount > 0 ? <View style={[styles.indicator, styles.habitIndicator]} /> : null}
                  </View>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.legend}>
            <View style={styles.legendItem}>
              <View style={[styles.indicator, styles.taskIndicator]} />
              <Text style={styles.legendText}>Tâches</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.indicator, styles.habitIndicator]} />
              <Text style={styles.legendText}>Habitudes prévues</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                const current = new Date();
                setMonth(new Date(current.getFullYear(), current.getMonth(), 1));
                setSelectedDate(getDateKey(current));
              }}>
              <Text style={styles.todayLink}>Aujourd’hui</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.sectionHeading}>
          <View>
            <Text style={styles.sectionTitle}>{selectedDateLabel}</Text>
            <Text style={styles.sectionSubtitle}>Tes petits pas pour cette journée.</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={openTaskModal}
            style={styles.addTaskButton}>
            <Text style={styles.addTaskButtonText}>＋ Ajouter</Text>
          </Pressable>
        </View>

        {habitsError ? <Text style={styles.errorText}>{habitsError}</Text> : null}
        {tasksError ? <Text style={styles.errorText}>{tasksError}</Text> : null}
        {(habitsLoading || tasksLoading) ? (
          <ActivityIndicator color={colors.sage} style={styles.loader} />
        ) : null}

        {selectedTasks.map((task) => (
          <Pressable
            key={task.id}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: task.completed }}
            onPress={() => void handleTaskToggle(task)}
            style={styles.dayItem}>
            <View style={[styles.checkbox, task.completed && styles.checkboxDone]}>
              {task.completed ? <Text style={styles.checkmark}>✓</Text> : null}
            </View>
            <View style={styles.itemCopy}>
              <Text style={[styles.itemTitle, task.completed && styles.itemTitleDone]}>
                {task.title}
              </Text>
              <Text style={styles.itemMeta}>
                {task.description || `Priorité ${getPriorityLabel(task).toLowerCase()}`}
              </Text>
            </View>
            <Text style={styles.itemType}>TÂCHE</Text>
          </Pressable>
        ))}

        {selectedHabits.map((habit) => {
          const completed = habit.completedDates.includes(selectedDate);
          const canComplete = selectedDate <= todayKey;

          return (
            <Pressable
              key={habit.id}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: completed, disabled: !canComplete }}
              onPress={() => canComplete && void handleHabitToggle(habit.id)}
              style={[styles.dayItem, !canComplete && styles.dayItemDisabled]}>
              <View style={[styles.checkbox, completed && styles.checkboxDone, styles.roundCheckbox]}>
                {completed ? <Text style={styles.checkmark}>✓</Text> : null}
              </View>
              <View style={styles.itemCopy}>
                <Text style={[styles.itemTitle, completed && styles.itemTitleDone]}>{habit.title}</Text>
                <Text style={styles.itemMeta}>
                  {canComplete ? `${habit.streak} jour${habit.streak === 1 ? '' : 's'} de régularité` : 'Prévue'}
                </Text>
              </View>
              <Text style={styles.itemType}>HABITUDE</Text>
            </Pressable>
          );
        })}

        {!habitsLoading && !tasksLoading && !selectedTasks.length && !selectedHabits.length ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>☼</Text>
            <Text style={styles.emptyTitle}>Une journée toute légère</Text>
            <Text style={styles.emptyText}>Aucune tâche ni habitude prévue ici.</Text>
          </View>
        ) : null}

        <View style={styles.premiumCard}>
          <View style={styles.premiumHeader}>
            <View style={styles.premiumIcon}><Text style={styles.premiumIconText}>✦</Text></View>
            <View style={styles.premiumCopy}>
              <Text style={styles.premiumTitle}>Tes repères dans le temps</Text>
              <Text style={styles.premiumSubtitle}>Progression et objectifs</Text>
            </View>
            <View style={styles.premiumBadge}><Text style={styles.premiumBadgeText}>PREMIUM</Text></View>
          </View>
          <View style={styles.premiumDivider} />
          <View style={styles.premiumFeatures}>
            <View style={styles.premiumFeature}>
              <Text style={styles.premiumFeatureIcon}>↗</Text>
              <Text style={styles.premiumFeatureText}>Bilan hebdomadaire</Text>
            </View>
            <View style={styles.premiumFeature}>
              <Text style={styles.premiumFeatureIcon}>◷</Text>
              <Text style={styles.premiumFeatureText}>Progression du mois</Text>
            </View>
            <View style={styles.premiumFeature}>
              <Text style={styles.premiumFeatureIcon}>◎</Text>
              <Text style={styles.premiumFeatureText}>Objectifs du mois</Text>
            </View>
          </View>
          <Text style={styles.premiumNote}>
            Les analyses détaillées et rapports arriveront avec l’offre Premium.
          </Text>
        </View>
      </ScrollView>
      <BottomNavigation active="calendar" />

      <Modal
        visible={isTaskModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIsTaskModalVisible(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalBackdrop}>
          <ScrollView
            contentContainerStyle={styles.modalScrollContent}
            keyboardShouldPersistTaps="handled">
            <View style={styles.modal}>
              <View style={styles.modalHandle} />
              <Text style={styles.modalEyebrow}>À TON RYTHME</Text>
              <Text style={styles.modalTitle}>Une nouvelle tâche</Text>
              <TextInput
                value={taskTitle}
                onChangeText={setTaskTitle}
                placeholder="Que souhaites-tu faire ?"
                placeholderTextColor={colors.textLight}
                style={styles.input}
                editable={!savingTask}
                maxLength={100}
                autoFocus
              />
              <TextInput
                value={taskDescription}
                onChangeText={setTaskDescription}
                placeholder="Description (facultative)"
                placeholderTextColor={colors.textLight}
                style={[styles.input, styles.descriptionInput]}
                editable={!savingTask}
                multiline
                maxLength={500}
              />
              <Text style={styles.formLabel}>Priorité</Text>
              <View style={styles.priorityOptions}>
                {priorities.map((priority) => {
                  const selected = taskPriority === priority.value;
                  return (
                    <Pressable
                      key={priority.value}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      onPress={() => setTaskPriority(priority.value)}
                      style={[styles.priorityOption, selected && styles.priorityOptionSelected]}>
                      <Text style={[
                        styles.priorityOptionText,
                        selected && styles.priorityOptionTextSelected,
                      ]}>
                        {priority.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <TextInput
                value={taskDueDate}
                onChangeText={setTaskDueDate}
                placeholder="Échéance (AAAA-MM-JJ, facultative)"
                placeholderTextColor={colors.textLight}
                style={styles.input}
                editable={!savingTask}
                maxLength={10}
                autoCapitalize="none"
              />
              {taskError ? <Text style={styles.errorText}>{taskError}</Text> : null}
              <CosyButton
                title={savingTask ? 'Enregistrement…' : 'Ajouter à ma journée'}
                onPress={() => void handleSaveTask()}
                disabled={savingTask || !taskTitle.trim()}
                style={styles.modalAction}
              />
              <Pressable
                accessibilityRole="button"
                onPress={() => setIsTaskModalVisible(false)}
                style={styles.cancelButton}>
                <Text style={styles.cancelButtonText}>Pas maintenant</Text>
              </Pressable>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  brandLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  brand: {
    color: colors.sage,
    fontSize: 24,
    fontFamily: 'serif',
    fontWeight: '700',
  },
  brandCaption: {
    color: colors.textSecondary,
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 1.4,
  },
  eyebrow: {
    color: colors.clay,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  title: {
    color: colors.textPrimary,
    fontFamily: 'serif',
    fontSize: 30,
    fontWeight: '600',
    marginTop: spacing.xs,
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  calendarCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: borderRadius.large,
    borderWidth: 1,
    padding: spacing.md,
  },
  monthHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  monthArrow: {
    alignItems: 'center',
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  monthArrowText: {
    color: colors.sage,
    fontSize: 28,
    lineHeight: 32,
  },
  monthTitle: {
    color: colors.textPrimary,
    fontFamily: 'serif',
    fontSize: 18,
    fontWeight: '600',
  },
  weekdayRow: {
    flexDirection: 'row',
    marginBottom: spacing.xs,
  },
  weekdayLabel: {
    color: colors.textSecondary,
    flex: 1,
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    alignItems: 'center',
    borderRadius: 13,
    height: 46,
    justifyContent: 'center',
    width: `${100 / 7}%`,
  },
  dayCellSelected: {
    backgroundColor: colors.sage,
  },
  dayNumber: {
    color: colors.textPrimary,
    fontSize: 12,
  },
  dayNumberToday: {
    color: colors.clay,
    fontWeight: '700',
  },
  dayNumberSelected: {
    color: colors.surface,
    fontWeight: '700',
  },
  dayIndicators: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 3,
    height: 6,
    marginTop: 1,
  },
  indicator: {
    borderRadius: 3,
    height: 5,
    width: 5,
  },
  taskIndicator: {
    backgroundColor: colors.clay,
  },
  habitIndicator: {
    backgroundColor: colors.sage,
  },
  legend: {
    alignItems: 'center',
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.sm,
    paddingTop: spacing.md,
  },
  legendItem: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 5,
  },
  legendText: {
    color: colors.textSecondary,
    fontSize: 9,
  },
  todayLink: {
    color: colors.sage,
    fontSize: 10,
    fontWeight: '700',
    marginLeft: 'auto',
  },
  sectionHeading: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontFamily: 'serif',
    fontSize: 21,
    fontWeight: '600',
  },
  sectionSubtitle: {
    color: colors.textSecondary,
    fontSize: 10,
    marginTop: 2,
  },
  addTaskButton: {
    backgroundColor: colors.sage,
    borderRadius: borderRadius.extraLarge,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  addTaskButtonText: {
    color: colors.surface,
    fontSize: 10,
    fontWeight: '700',
  },
  errorText: {
    color: colors.error,
    fontSize: 11,
    marginBottom: spacing.sm,
  },
  loader: {
    marginVertical: spacing.md,
  },
  dayItem: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: borderRadius.medium,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.xs,
    minHeight: 62,
    paddingHorizontal: spacing.md,
  },
  dayItemDisabled: {
    opacity: 0.75,
  },
  checkbox: {
    alignItems: 'center',
    borderColor: colors.sage,
    borderRadius: 6,
    borderWidth: 1,
    height: 20,
    justifyContent: 'center',
    width: 20,
  },
  roundCheckbox: {
    borderRadius: 10,
  },
  checkboxDone: {
    backgroundColor: colors.sage,
  },
  checkmark: {
    color: colors.surface,
    fontSize: 12,
    fontWeight: '700',
  },
  itemCopy: {
    flex: 1,
  },
  itemTitle: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: '600',
  },
  itemTitleDone: {
    color: colors.textSecondary,
    textDecorationLine: 'line-through',
  },
  itemMeta: {
    color: colors.textSecondary,
    fontSize: 9,
    marginTop: 3,
  },
  itemType: {
    color: colors.textLight,
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  emptyCard: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: borderRadius.medium,
    borderWidth: 1,
    marginTop: spacing.xs,
    padding: spacing.lg,
  },
  emptyIcon: {
    color: colors.sage,
    fontSize: 22,
  },
  emptyTitle: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '600',
    marginTop: spacing.xs,
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: 10,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  premiumCard: {
    backgroundColor: colors.sagePale,
    borderColor: colors.sageLight,
    borderRadius: borderRadius.large,
    borderWidth: 1,
    marginTop: spacing.lg,
    padding: spacing.md,
  },
  premiumHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  premiumIcon: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 19,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  premiumIconText: {
    color: colors.sage,
    fontSize: 18,
  },
  premiumCopy: {
    flex: 1,
  },
  premiumTitle: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
  premiumSubtitle: {
    color: colors.textSecondary,
    fontSize: 9,
    marginTop: 2,
  },
  premiumBadge: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.extraLarge,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
  },
  premiumBadgeText: {
    color: colors.sage,
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  premiumDivider: {
    backgroundColor: colors.border,
    height: 1,
    marginVertical: spacing.md,
  },
  premiumFeatures: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  premiumFeature: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.medium,
    flex: 1,
    gap: spacing.xs,
    minHeight: 68,
    justifyContent: 'center',
    padding: spacing.sm,
  },
  premiumFeatureIcon: {
    color: colors.sage,
    fontSize: 17,
  },
  premiumFeatureText: {
    color: colors.textPrimary,
    fontSize: 9,
    fontWeight: '600',
    textAlign: 'center',
  },
  premiumNote: {
    color: colors.textSecondary,
    fontSize: 9,
    lineHeight: 14,
    marginTop: spacing.sm,
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(42, 48, 39, 0.38)',
  },
  modalScrollContent: {
    flexGrow: 1,
    justifyContent: 'flex-end',
  },
  modal: {
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    backgroundColor: colors.background,
    borderTopLeftRadius: borderRadius.large,
    borderTopRightRadius: borderRadius.large,
  },
  modalHandle: {
    width: 38,
    height: 4,
    alignSelf: 'center',
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: spacing.md,
  },
  modalEyebrow: {
    color: colors.sage,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
    textAlign: 'center',
  },
  modalTitle: {
    color: colors.textPrimary,
    fontSize: 22,
    fontFamily: 'serif',
    fontWeight: '600',
    textAlign: 'center',
    marginVertical: spacing.sm,
  },
  input: {
    minHeight: 50,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.small,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  descriptionInput: {
    minHeight: 72,
    paddingTop: spacing.sm,
    textAlignVertical: 'top',
  },
  formLabel: {
    color: colors.textPrimary,
    fontSize: 11,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  priorityOptions: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  priorityOption: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.extraLarge,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  priorityOptionSelected: {
    backgroundColor: colors.sage,
    borderColor: colors.sage,
  },
  priorityOptionText: {
    color: colors.textSecondary,
    fontSize: 9,
    fontWeight: '600',
  },
  priorityOptionTextSelected: {
    color: colors.surface,
  },
  modalAction: {
    backgroundColor: colors.sage,
    borderWidth: 0,
    borderRadius: borderRadius.extraLarge,
    marginTop: spacing.xs,
  },
  cancelButton: {
    alignItems: 'center',
    padding: spacing.md,
  },
  cancelButtonText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
});
