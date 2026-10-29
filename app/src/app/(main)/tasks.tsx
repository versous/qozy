import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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

import { BottomNavigation } from '@/components/BottomNavigation';
import { CosyButton } from '@/components/common/CosyButton';
import { WeekdaySelector } from '@/components/WeekdaySelector';
import { ALL_HABIT_DAYS, type HabitDay, useHabits } from '@/hooks/useHabits';
import { TaskPriority, TodoTask, useTasks } from '@/hooks/useTasks';
import { colors, spacing, borderRadius } from '@/theme/colors';

type Filter = 'active' | 'done' | 'all';

const filters: { key: Filter; label: string }[] = [
  { key: 'active', label: 'À mon rythme' },
  { key: 'done', label: 'Terminées' },
  { key: 'all', label: 'Toutes' },
];
const todayLabel = new Date().toLocaleDateString('fr-FR', { weekday: 'long' }).toLocaleUpperCase('fr-FR');
const priorities: { value: TaskPriority; label: string }[] = [
  { value: 'urgent', label: 'Urgent' },
  { value: 'important', label: 'Important' },
  { value: 'normal', label: 'Normal' },
];

const isValidDate = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};

export default function TasksScreen() {
  const { habits, loading, error, addHabit, toggleHabit } = useHabits();
  const {
    tasks,
    loading: tasksLoading,
    error: tasksError,
    saveTask,
    toggleTask,
    deleteTask,
  } = useTasks();
  const [filter, setFilter] = useState<Filter>('active');
  const [isAdding, setIsAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [habitDays, setHabitDays] = useState<HabitDay[]>(ALL_HABIT_DAYS);
  const [saveError, setSaveError] = useState('');
  const [saving, setSaving] = useState(false);
  const [isTaskModalVisible, setIsTaskModalVisible] = useState(false);
  const [editingTask, setEditingTask] = useState<TodoTask | null>(null);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [taskDueDate, setTaskDueDate] = useState('');
  const [taskPriority, setTaskPriority] = useState<TaskPriority>('normal');
  const [taskError, setTaskError] = useState('');
  const [savingTask, setSavingTask] = useState(false);
  const pending = habits.filter((habit) => !habit.isCompleted);
  const completed = habits.filter((habit) => habit.isCompleted);
  const visibleHabits = filter === 'active' ? pending : filter === 'done' ? completed : habits;
  const pendingTasks = tasks.filter((task) => !task.completed);
  const completedTasks = tasks.filter((task) => task.completed);

  const openTaskModal = (task?: TodoTask) => {
    setEditingTask(task ?? null);
    setTaskTitle(task?.title ?? '');
    setTaskDescription(task?.description ?? '');
    setTaskDueDate(task?.dueDate ?? '');
    setTaskPriority(task?.priority ?? 'normal');
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
      }, editingTask?.id);
      setIsTaskModalVisible(false);
    } catch (reason) {
      setTaskError(reason instanceof Error ? reason.message : 'Impossible d’enregistrer cette tâche.');
    } finally {
      setSavingTask(false);
    }
  };

  const confirmDeleteTask = (task: TodoTask) => {
    Alert.alert('Supprimer cette tâche ?', task.title, [
      { text: 'Garder', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: () => {
          void deleteTask(task.id).catch((reason) => {
            Alert.alert(
              'Suppression impossible',
              reason instanceof Error ? reason.message : 'Réessaie plus tard.'
            );
          });
        },
      },
    ]);
  };

  const saveHabit = async () => {
    setSaving(true);
    setSaveError('');
    try {
      await addHabit(title, '🌱', habitDays);
      setTitle('');
      setHabitDays(ALL_HABIT_DAYS);
      setIsAdding(false);
    } catch (reason) {
      setSaveError(reason instanceof Error ? reason.message : "Impossible d'ajouter ce petit pas.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.brandLine}>
          <Text style={styles.brand}>nid</Text>
          <Text style={styles.brandCaption}>À VOTRE RYTHME</Text>
        </View>
        <Text style={styles.eyebrow}>{todayLabel} · MES PETITS PAS</Text>
        <Text style={styles.title}>Ma journée</Text>
        <Text style={styles.subtitle}>Mes tâches et mes habitudes, sans pression.</Text>

        <View style={styles.progressCard}>
          <View style={styles.progressIcon}><Text style={styles.progressIconText}>✳</Text></View>
          <View style={styles.progressCopy}>
            <Text style={styles.progressTitle}>
              {completed.length ? `Déjà ${completed.length} petit${completed.length > 1 ? 's' : ''} pas accompli${completed.length > 1 ? 's' : ''}` : 'Chaque petit pas compte'}
            </Text>
            <Text style={styles.progressSubtitle}>Même les petites victoires méritent d’être célébrées.</Text>
          </View>
        </View>

        <View style={styles.sectionHeading}>
          <View>
            <Text style={styles.sectionTitle}>Mes tâches</Text>
            <Text style={styles.sectionHint}>Une chose après l’autre.</Text>
          </View>
          <Text style={styles.sectionCount}>{pendingTasks.length} à faire</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => openTaskModal()}
            style={styles.addTaskChip}>
            <Text style={styles.addTaskText}>＋ Ajouter</Text>
          </Pressable>
        </View>
        {tasksError ? <Text style={styles.error}>{tasksError}</Text> : null}
        {tasksLoading ? (
          <ActivityIndicator color={colors.sage} style={styles.loader} />
        ) : tasks.length ? (
          <View style={styles.taskList}>
            {tasks.map((task) => (
              <View key={task.id} style={styles.todoCard}>
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: task.completed }}
                  onPress={() => {
                    void toggleTask(task).catch((reason) =>
                      Alert.alert(
                        'Modification impossible',
                        reason instanceof Error ? reason.message : 'Réessaie plus tard.'
                      )
                    );
                  }}
                  style={[styles.checkbox, task.completed && styles.checkboxDone]}>
                  {task.completed ? <Text style={styles.checkmark}>✓</Text> : null}
                </Pressable>
                <View style={styles.todoCopy}>
                  <Text style={[styles.taskTitle, task.completed && styles.taskTitleDone]}>
                    {task.title}
                  </Text>
                  {task.description ? (
                    <Text style={styles.taskMeta}>{task.description}</Text>
                  ) : null}
                  <View style={styles.taskBadges}>
                    <Text style={[
                      styles.priorityBadge,
                      task.priority === 'urgent' && styles.priorityUrgent,
                      task.priority === 'important' && styles.priorityImportant,
                    ]}>
                      {task.priority === 'urgent' ? 'Urgent' : task.priority === 'important' ? 'Important' : 'Normal'}
                    </Text>
                    {task.dueDate ? (
                      <Text style={styles.dueDate}>Échéance · {task.dueDate}</Text>
                    ) : null}
                  </View>
                </View>
                <View style={styles.todoActions}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Modifier ${task.title}`}
                    onPress={() => openTaskModal(task)}
                    hitSlop={8}>
                    <Text style={styles.todoAction}>✎</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Supprimer ${task.title}`}
                    onPress={() => confirmDeleteTask(task)}
                    hitSlop={8}>
                    <Text style={styles.todoDelete}>×</Text>
                  </Pressable>
                </View>
              </View>
            ))}
            {completedTasks.length ? (
              <Text style={styles.completedSummary}>
                {completedTasks.length} tâche{completedTasks.length > 1 ? 's' : ''} terminée{completedTasks.length > 1 ? 's' : ''}
              </Text>
            ) : null}
          </View>
        ) : (
          <Pressable onPress={() => openTaskModal()} style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Aucune tâche pour le moment</Text>
            <Text style={styles.emptyText}>Ajoute la première, puis avance à ton rythme.</Text>
          </Pressable>
        )}

        <View style={styles.sectionHeading}>
          <View>
            <Text style={styles.sectionTitle}>Mes habitudes</Text>
            <Text style={styles.sectionHint}>Chaque petit pas compte.</Text>
          </View>
        </View>

        <View style={styles.filters}>
          {filters.map((item) => {
            const selected = filter === item.key;
            return (
              <Pressable
                key={item.key}
                onPress={() => setFilter(item.key)}
                style={[styles.filterChip, selected && styles.filterChipSelected]}>
                <Text style={[styles.filterText, selected && styles.filterTextSelected]}>{item.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.sectionHeading}>
          <Text style={styles.sectionTitle}>À mon rythme</Text>
          <Text style={styles.sectionCount}>{pending.length} habitude{pending.length > 1 ? 's' : ''}</Text>
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {loading ? (
          <ActivityIndicator color={colors.sage} style={styles.loader} />
        ) : visibleHabits.length ? (
          <View style={styles.taskList}>
            {visibleHabits.map((habit) => (
              <Pressable
                key={habit.id}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: habit.isCompleted }}
                onPress={() => {
                  void toggleHabit(habit.id).catch((reason) =>
                    Alert.alert(
                      'Modification impossible',
                      reason instanceof Error ? reason.message : 'Réessaie plus tard.'
                    )
                  );
                }}
                style={styles.taskRow}>
                <View style={[styles.checkbox, habit.isCompleted && styles.checkboxDone]}>
                  {habit.isCompleted ? <Text style={styles.checkmark}>✓</Text> : null}
                </View>
                <View style={styles.taskCopy}>
                  <Text style={[styles.taskTitle, habit.isCompleted && styles.taskTitleDone]}>
                    {habit.title}
                  </Text>
                  <Text style={styles.taskMeta}>
                    {habit.isCompleted ? 'Terminée aujourd’hui' : 'Un petit pas, à ton rythme'}
                    {habit.streak > 0 ? ` · ${habit.streak} jours` : ''}
                  </Text>
                </View>
                <Text style={styles.taskArrow}>›</Text>
              </Pressable>
            ))}
          </View>
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>
              {filter === 'done' ? 'Rien de terminé pour le moment' : 'Une chose à la fois'}
            </Text>
            <Text style={styles.emptyText}>
              {filter === 'done'
                ? 'Tu peux célébrer chaque petit progrès ici.'
                : 'Ajoute une tâche douce pour commencer ta journée.'}
            </Text>
          </View>
        )}

        <View style={styles.sectionHeadingDone}>
          <Text style={styles.sectionTitle}>Bouger en douceur</Text>
          <Pressable onPress={() => router.push('/movement')} hitSlop={8}>
            <Text style={styles.link}>Voir les exercices</Text>
          </Pressable>
        </View>
        <Pressable onPress={() => router.push('/movement')} style={styles.exerciseBanner}>
          <View style={styles.exerciseBadge}><Text style={styles.exerciseBadgeText}>✳</Text></View>
          <View style={styles.exerciseCopy}>
            <Text style={styles.exerciseTitle}>Un moment pour ton corps</Text>
            <Text style={styles.exerciseSubtitle}>Des mouvements doux, sans pression.</Text>
          </View>
          <Text style={styles.taskArrow}>›</Text>
        </Pressable>

        <CosyButton
          title="+  Ajouter un petit pas"
          onPress={() => setIsAdding(true)}
          style={styles.addButton}
        />
      </ScrollView>

      <BottomNavigation active="tasks" />

      <Modal visible={isAdding} transparent animationType="slide" onRequestClose={() => setIsAdding(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modal}>
            <View style={styles.handle} />
            <Text style={styles.modalEyebrow}>À TON RYTHME</Text>
            <Text style={styles.modalTitle}>Un petit pas</Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="Ex. Lire quelques pages"
              placeholderTextColor={colors.textLight}
              style={styles.input}
              editable={!saving}
              returnKeyType="done"
              onSubmitEditing={() => void saveHabit()}
            />
            <WeekdaySelector selectedDays={habitDays} onChange={setHabitDays} disabled={saving} />
            {saveError ? <Text style={styles.error}>{saveError}</Text> : null}
            <CosyButton
              title={saving ? 'Ajout en cours…' : 'Ajouter à ma journée'}
              onPress={() => void saveHabit()}
              disabled={saving || !title.trim() || !habitDays.length}
              style={styles.modalAction}
            />
            <Pressable onPress={() => setIsAdding(false)} style={styles.cancel}>
              <Text style={styles.cancelText}>Pas maintenant</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal
        visible={isTaskModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIsTaskModalVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modal}>
            <View style={styles.handle} />
            <Text style={styles.modalEyebrow}>À TON RYTHME</Text>
            <Text style={styles.modalTitle}>{editingTask ? 'Modifier ma tâche' : 'Nouvelle tâche'}</Text>
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
                    onPress={() => setTaskPriority(priority.value)}
                    style={[styles.priorityOption, selected && styles.priorityOptionSelected]}>
                    <Text style={[styles.priorityOptionText, selected && styles.priorityOptionTextSelected]}>
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
            {taskError ? <Text style={styles.error}>{taskError}</Text> : null}
            <CosyButton
              title={savingTask ? 'Enregistrement…' : editingTask ? 'Enregistrer' : 'Ajouter à ma journée'}
              onPress={() => void handleSaveTask()}
              disabled={savingTask || !taskTitle.trim()}
              style={styles.modalAction}
            />
            <Pressable onPress={() => setIsTaskModalVisible(false)} style={styles.cancel}>
              <Text style={styles.cancelText}>Pas maintenant</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.lg },
  brandLine: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm, marginBottom: spacing.lg },
  brand: { color: colors.textPrimary, fontSize: 27, fontFamily: 'serif', fontWeight: '700' },
  brandCaption: { color: colors.textSecondary, fontSize: 8, letterSpacing: 1, fontWeight: '600' },
  eyebrow: { color: colors.sage, fontSize: 9, letterSpacing: 0.8, fontWeight: '700', marginBottom: 5 },
  title: { color: colors.textPrimary, fontSize: 26, fontFamily: 'serif', fontWeight: '600' },
  subtitle: { color: colors.textSecondary, fontSize: 12, marginTop: 4, marginBottom: spacing.md },
  progressCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderRadius: borderRadius.medium, backgroundColor: colors.sagePale },
  progressIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  progressIconText: { color: colors.sage, fontSize: 20 },
  progressCopy: { flex: 1 },
  progressTitle: { color: colors.sage, fontSize: 12, fontWeight: '700' },
  progressSubtitle: { color: colors.textSecondary, fontSize: 9, marginTop: 3 },
  filters: { flexDirection: 'row', gap: spacing.xs, marginTop: spacing.md, marginBottom: spacing.md },
  filterChip: { paddingHorizontal: 13, paddingVertical: 8, borderRadius: borderRadius.extraLarge, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  filterChipSelected: { backgroundColor: colors.sage, borderColor: colors.sage },
  filterText: { color: colors.textSecondary, fontSize: 10, fontWeight: '600' },
  filterTextSelected: { color: colors.surface },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  sectionTitle: { color: colors.textPrimary, fontSize: 16, fontFamily: 'serif', fontWeight: '600' },
  sectionHint: { color: colors.textSecondary, fontSize: 10, marginTop: 3 },
  sectionCount: { color: colors.textSecondary, fontSize: 10 },
  error: { color: colors.error, fontSize: 11, marginBottom: spacing.sm },
  loader: { padding: spacing.lg },
  taskList: { backgroundColor: colors.surface, borderRadius: borderRadius.medium, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md },
  todoCard: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  todoCopy: { flex: 1, gap: 4 },
  taskBadges: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.xs },
  priorityBadge: { overflow: 'hidden', color: colors.sage, fontSize: 8, fontWeight: '700', paddingHorizontal: 7, paddingVertical: 3, borderRadius: borderRadius.extraLarge, backgroundColor: colors.sagePale },
  priorityUrgent: { color: colors.error, backgroundColor: '#FCE9E6' },
  priorityImportant: { color: colors.clay, backgroundColor: colors.peachLight },
  dueDate: { color: colors.textSecondary, fontSize: 8 },
  todoActions: { alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  todoAction: { color: colors.sage, fontSize: 17 },
  todoDelete: { color: colors.textSecondary, fontSize: 20, lineHeight: 20 },
  completedSummary: { color: colors.textSecondary, fontSize: 9, textAlign: 'center', paddingVertical: spacing.sm },
  addTaskChip: { paddingHorizontal: spacing.sm, paddingVertical: 7, borderRadius: borderRadius.extraLarge, backgroundColor: colors.sage },
  addTaskText: { color: colors.surface, fontSize: 10, fontWeight: '700' },
  taskRow: { minHeight: 65, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  checkbox: { width: 21, height: 21, borderRadius: 7, borderWidth: 1, borderColor: colors.sage, alignItems: 'center', justifyContent: 'center' },
  checkboxDone: { backgroundColor: colors.sage },
  checkmark: { color: colors.surface, fontSize: 13, fontWeight: '700' },
  taskCopy: { flex: 1 },
  taskTitle: { color: colors.textPrimary, fontSize: 12, fontWeight: '600' },
  taskTitleDone: { textDecorationLine: 'line-through', color: colors.textSecondary },
  taskMeta: { color: colors.textSecondary, fontSize: 9, marginTop: 4 },
  taskArrow: { color: colors.sage, fontSize: 22 },
  emptyCard: { padding: spacing.md, backgroundColor: colors.surface, borderRadius: borderRadius.medium, borderWidth: 1, borderColor: colors.border },
  emptyTitle: { color: colors.textPrimary, fontSize: 12, fontWeight: '600' },
  emptyText: { color: colors.textSecondary, fontSize: 10, lineHeight: 16, marginTop: 4 },
  sectionHeadingDone: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.lg, marginBottom: spacing.sm },
  link: { color: colors.sage, fontSize: 10, fontWeight: '600' },
  exerciseBanner: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, backgroundColor: colors.peachLight, borderRadius: borderRadius.medium },
  exerciseBadge: { width: 38, height: 38, borderRadius: 12, backgroundColor: colors.peach, alignItems: 'center', justifyContent: 'center' },
  exerciseBadgeText: { color: colors.clay, fontSize: 19 },
  exerciseCopy: { flex: 1 },
  exerciseTitle: { color: colors.textPrimary, fontSize: 12, fontWeight: '600' },
  exerciseSubtitle: { color: colors.textSecondary, fontSize: 9, marginTop: 3 },
  addButton: { backgroundColor: colors.sage, borderWidth: 0, borderRadius: borderRadius.extraLarge, marginTop: spacing.md },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(42,48,39,0.38)' },
  modal: { padding: spacing.lg, paddingBottom: spacing.xl, backgroundColor: colors.background, borderTopLeftRadius: borderRadius.large, borderTopRightRadius: borderRadius.large },
  handle: { width: 38, height: 4, alignSelf: 'center', borderRadius: 2, backgroundColor: colors.border, marginBottom: spacing.md },
  modalEyebrow: { color: colors.sage, fontSize: 9, fontWeight: '700', letterSpacing: 1, textAlign: 'center' },
  modalTitle: { color: colors.textPrimary, fontSize: 22, fontFamily: 'serif', fontWeight: '600', textAlign: 'center', marginVertical: spacing.sm },
  input: { minHeight: 50, backgroundColor: colors.surface, borderRadius: borderRadius.small, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, color: colors.textPrimary },
  descriptionInput: { minHeight: 72, paddingTop: spacing.sm, textAlignVertical: 'top' },
  formLabel: { color: colors.textPrimary, fontSize: 11, fontWeight: '600', marginBottom: spacing.xs },
  priorityOptions: { flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.sm },
  priorityOption: { flex: 1, alignItems: 'center', paddingVertical: spacing.sm, borderRadius: borderRadius.extraLarge, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  priorityOptionSelected: { backgroundColor: colors.sage, borderColor: colors.sage },
  priorityOptionText: { color: colors.textSecondary, fontSize: 9, fontWeight: '600' },
  priorityOptionTextSelected: { color: colors.surface },
  modalAction: { backgroundColor: colors.sage, borderWidth: 0, marginTop: spacing.md },
  cancel: { alignItems: 'center', padding: spacing.md },
  cancelText: { color: colors.textSecondary, fontSize: 12, fontWeight: '600' },
});
