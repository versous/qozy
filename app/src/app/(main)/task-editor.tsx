import { typography } from '@/theme/typography';
import React, { useState } from 'react';
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
import { router, useLocalSearchParams } from 'expo-router';

import { BottomNavigation } from '@/components/BottomNavigation';
import { BrandHeader } from '@/components/BrandHeader';
import { CosyButton } from '@/components/common/CosyButton';
import { DatePickerField } from '@/components/DatePickerField';
import { useTasks, type TaskStatus, type TodoTask } from '@/hooks/useTasks';
import { borderRadius, spacing, type AppColors } from '@/theme/colors';
import { useAppTheme } from '@/theme/ThemeProvider';

const categories = ['Études', 'Travail', 'Personnel', 'Bien-être'];
const statuses: { value: TaskStatus; label: string }[] = [
  { value: 'todo', label: 'À faire' },
  { value: 'in_progress', label: 'En cours' },
  { value: 'completed', label: 'Terminée' },
];

function getDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function isValidDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function getEndTime(task: TodoTask | undefined) {
  if (!task?.startTime) return '09:25';
  const [hours, minutes] = task.startTime.split(':').map(Number);
  const end = (hours * 60 + minutes + (task.durationMinutes ?? 25)) % (24 * 60);
  return `${String(Math.floor(end / 60)).padStart(2, '0')}:${String(end % 60).padStart(2, '0')}`;
}

function cleanTime(value: string) {
  const digits = value.replace(/[^\d]/g, '').slice(0, 4);
  return digits.length > 2 ? `${digits.slice(0, 2)}:${digits.slice(2)}` : digits;
}

function TaskEditorForm({ task, initialDate }: { task?: TodoTask; initialDate?: string }) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const { saveTask, deleteTask } = useTasks();
  const [title, setTitle] = useState(task?.title ?? '');
  const [date, setDate] = useState(task?.dueDate ?? (initialDate && isValidDate(initialDate) ? initialDate : getDateKey(new Date())));
  const [startTime, setStartTime] = useState(task?.startTime ?? '09:00');
  const [endTime, setEndTime] = useState(getEndTime(task));
  const [category, setCategory] = useState(task?.category ?? 'Études');
  const [project, setProject] = useState(task?.project ?? '');
  const [note, setNote] = useState(task?.description ?? '');
  const [status, setStatus] = useState<TaskStatus>(
    task?.status ?? (task?.completed ? 'completed' : 'todo'),
  );
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const durationMinutes = (time: string) => {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  };

  const handleSave = async () => {
    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setError('Donne un titre à ton petit pas.');
      return;
    }
    if (!isValidDate(date)) {
      setError('Choisis une date valide.');
      return;
    }
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(startTime)
      || !/^([01]\d|2[0-3]):[0-5]\d$/.test(endTime)) {
      setError('Saisis une heure valide au format HH:MM.');
      return;
    }
    const duration = durationMinutes(endTime) - durationMinutes(startTime);
    if (duration <= 0) {
      setError('L’heure de fin doit être après l’heure de début.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      await saveTask({
        title: cleanTitle,
        description: note,
        category,
        project,
        priority: task?.priority ?? 'normal',
        dueDate: date,
        startTime,
        durationMinutes: duration,
        status,
      }, task?.id);
      router.back();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Impossible d’enregistrer ce petit pas.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!task) return;
    setDeleting(true);
    setError('');
    try {
      await deleteTask(task.id);
      router.back();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Impossible de supprimer ce petit pas.');
    } finally {
      setDeleting(false);
      setConfirmingDelete(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <BrandHeader />
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>‹  Mes tâches</Text>
        </Pressable>
        <Text style={styles.title}>{task ? 'Ajuster mon petit pas' : 'Mon petit pas'}</Text>
        <Text style={styles.subtitle}>{task ? 'Mode modification · Tâche existante' : 'Un petit pas, à ton rythme'}</Text>

        <View style={styles.noticeCard}>
          <Text style={styles.noticeIcon}>✎</Text>
          <View style={styles.noticeCopy}>
            <Text style={styles.noticeTitle}>{task ? 'Modifications non enregistrées' : 'Un moment à toi'}</Text>
            <Text style={styles.noticeText}>
              {task
                ? 'La date et le créneau ci-dessous remplaceront la planification actuelle après sauvegarde.'
                : 'Choisis un moment et avance à ton rythme.'}
            </Text>
          </View>
        </View>

        <Text style={styles.fieldLabel}>Titre du petit pas</Text>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="Ex. Relire mon cours de design"
          placeholderTextColor={colors.textLight}
          editable={!saving}
          maxLength={100}
          returnKeyType="done"
          style={styles.textInput}
        />

        <Text style={styles.sectionTitle}>Une place dans ma journée</Text>
        <Text style={styles.fieldLabel}>Date</Text>
        <DatePickerField value={date || null} onChange={(value) => setDate(value ?? '')} disabled={saving} />

        <View style={styles.timeRow}>
          <View style={styles.timeColumn}>
            <Text style={styles.fieldLabel}>Début</Text>
            <View style={styles.timeField}>
              <TextInput
                accessibilityLabel="Heure de début"
                value={startTime}
                onChangeText={(value) => setStartTime(cleanTime(value))}
                placeholder="09:00"
                placeholderTextColor={colors.textLight}
                editable={!saving}
                keyboardType="numbers-and-punctuation"
                maxLength={5}
                style={styles.timeInput}
              />
              <Text style={styles.timeIcon}>◷</Text>
            </View>
          </View>
          <View style={styles.timeColumn}>
            <Text style={styles.fieldLabel}>Fin</Text>
            <View style={styles.timeField}>
              <TextInput
                accessibilityLabel="Heure de fin"
                value={endTime}
                onChangeText={(value) => setEndTime(cleanTime(value))}
                placeholder="09:25"
                placeholderTextColor={colors.textLight}
                editable={!saving}
                keyboardType="numbers-and-punctuation"
                maxLength={5}
                style={styles.timeInput}
              />
              <Text style={styles.timeIcon}>◷</Text>
            </View>
          </View>
        </View>
        <Text style={styles.durationText}>
          {/^([01]\d|2[0-3]):[0-5]\d$/.test(startTime) && /^([01]\d|2[0-3]):[0-5]\d$/.test(endTime)
            && durationMinutes(endTime) > durationMinutes(startTime)
            ? `Durée prévue : ${durationMinutes(endTime) - durationMinutes(startTime)} minutes · Créneau disponible`
            : 'Choisis un créneau valide.'}
        </Text>
        <Pressable accessibilityRole="button" onPress={() => router.push('/calendar')} style={styles.calendarLink}>
          <Text style={styles.calendarLinkText}>Voir cette journée dans le calendrier →</Text>
        </Pressable>

        <Text style={styles.fieldLabel}>Catégorie</Text>
        <View style={styles.categoryOptions}>
          {categories.map((item) => {
            const selected = category === item;
            return (
              <Pressable
                key={item}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => setCategory(item)}
                style={[styles.categoryOption, selected && styles.categorySelected]}>
                <Text style={[styles.categoryText, selected && styles.categoryTextSelected]}>{item}</Text>
                <Text style={[styles.categoryArrow, selected && styles.categoryTextSelected]}>⌄</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.fieldLabel}>Projet</Text>
        <TextInput
          value={project}
          onChangeText={setProject}
          placeholder="Nom du projet (facultatif)"
          placeholderTextColor={colors.textLight}
          editable={!saving}
          maxLength={100}
          style={styles.textInput}
        />

        <Text style={styles.fieldLabel}>Mon petit repère · Note</Text>
        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder="Une note pour t’accompagner…"
          placeholderTextColor={colors.textLight}
          editable={!saving}
          multiline
          maxLength={500}
          style={[styles.textInput, styles.noteInput]}
        />

        <Text style={styles.sectionTitle}>Où j’en suis</Text>
        <View style={styles.statusOptions}>
          {statuses.map((item) => {
            const selected = status === item.value;
            return (
              <Pressable
                key={item.value}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                disabled={saving}
                onPress={() => setStatus(item.value)}
                style={[styles.statusOption, selected && styles.statusSelected]}>
                <Text style={[styles.statusText, selected && styles.statusTextSelected]}>
                  {selected && item.value === 'completed' ? '✓  ' : ''}{item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
        <CosyButton
          title={saving ? 'Enregistrement…' : task ? '✓  Enregistrer les modifications' : '✓  Ajouter à ma journée'}
          onPress={() => void handleSave()}
          disabled={saving || !title.trim()}
          style={styles.saveButton}
        />
        <Pressable accessibilityRole="button" disabled={saving} onPress={() => router.back()} style={styles.cancelButton}>
          <Text style={styles.cancelText}>Annuler les modifications</Text>
        </Pressable>
        {task ? (
          confirmingDelete ? (
            <View style={styles.deleteConfirmation}>
              <Text style={styles.deleteConfirmationText}>Supprimer définitivement « {task.title} » ?</Text>
              <View style={styles.deleteActions}>
                <Pressable
                  accessibilityRole="button"
                  disabled={deleting}
                  onPress={() => setConfirmingDelete(false)}
                  style={styles.keepButton}>
                  <Text style={styles.cancelText}>Garder</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  disabled={deleting}
                  onPress={() => void handleDelete()}
                  style={styles.confirmDeleteButton}>
                  {deleting
                    ? <ActivityIndicator color={colors.surface} />
                    : <Text style={styles.confirmDeleteText}>Supprimer</Text>}
                </Pressable>
              </View>
            </View>
          ) : (
            <Pressable
              accessibilityRole="button"
              disabled={saving || deleting}
              onPress={() => setConfirmingDelete(true)}
              style={styles.deleteButton}>
              <Text style={styles.deleteText}>Supprimer ce petit pas</Text>
            </Pressable>
          )
        ) : null}
      </ScrollView>
      <BottomNavigation active="tasks" />
    </SafeAreaView>
  );
}

export default function TaskEditorScreen() {
  const { taskId, date } = useLocalSearchParams<{ taskId?: string; date?: string }>();
  const colors = useAppTheme().colors;
  const styles = createStyles(colors);
  const { tasks, loading, error } = useTasks();

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <ActivityIndicator color={colors.sage} style={styles.loading} />
      </SafeAreaView>
    );
  }
  if (error) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <Text accessibilityRole="alert" style={styles.error}>{error}</Text>
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.cancelButton}>
          <Text style={styles.cancelText}>Retour</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const task = taskId ? tasks.find((item) => item.id === taskId) : undefined;
  if (taskId && !task) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <Text style={styles.error}>Ce petit pas est introuvable.</Text>
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.cancelButton}>
          <Text style={styles.cancelText}>Retour</Text>
        </Pressable>
      </SafeAreaView>
    );
  }
  return <TaskEditorForm key={task?.id ?? `new-task-${date ?? ''}`} task={task} initialDate={date} />;
}

const createStyles = (palette: AppColors) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.background },
  content: { padding: spacing.md, paddingBottom: spacing.lg },
  backButton: { alignSelf: 'flex-start', marginTop: spacing.xs, marginBottom: spacing.sm },
  backText: { color: palette.sage, fontSize: 10, fontWeight: '700' },
  title: { color: palette.textPrimary, fontSize: 22, lineHeight: 28, fontFamily: typography.fonts.display, fontWeight: '600' },
  subtitle: { color: palette.textSecondary, fontSize: 8, lineHeight: 13, marginTop: 3, marginBottom: spacing.sm },
  noticeCard: { flexDirection: 'row', gap: spacing.xs, padding: spacing.sm, marginBottom: spacing.sm, borderRadius: borderRadius.medium, backgroundColor: palette.peach },
  noticeIcon: { color: palette.clay, fontSize: 14 },
  noticeCopy: { flex: 1 },
  noticeTitle: { color: palette.clay, fontSize: 8, fontWeight: '700' },
  noticeText: { color: palette.textSecondary, fontSize: 7, lineHeight: 11, marginTop: 3 },
  fieldLabel: { color: palette.textPrimary, fontSize: 8, fontWeight: '700', marginTop: spacing.xs, marginBottom: 4 },
  textInput: { minHeight: 37, paddingHorizontal: spacing.sm, borderWidth: 1, borderColor: palette.border, borderRadius: borderRadius.small, backgroundColor: palette.surface, color: palette.textPrimary, fontSize: 8 },
  sectionTitle: { color: palette.textPrimary, fontSize: 14, fontFamily: typography.fonts.display, fontWeight: '600', marginTop: spacing.sm, marginBottom: 2 },
  timeRow: { flexDirection: 'row', gap: spacing.sm },
  timeColumn: { flex: 1 },
  timeField: { minHeight: 37, flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.sm, borderWidth: 1, borderColor: palette.border, borderRadius: borderRadius.small, backgroundColor: palette.surface },
  timeInput: { flex: 1, color: palette.textPrimary, fontSize: 8, paddingVertical: 0 },
  timeIcon: { color: palette.sage, fontSize: 12 },
  durationText: { color: palette.textSecondary, fontSize: 7, marginTop: 4 },
  calendarLink: { alignSelf: 'flex-start', paddingVertical: spacing.xs },
  calendarLinkText: { color: palette.sage, fontSize: 7, fontWeight: '700' },
  categoryOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  categoryOption: { flex: 1, minWidth: '46%', minHeight: 35, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.sm, borderWidth: 1, borderColor: palette.border, borderRadius: borderRadius.small, backgroundColor: palette.surface },
  categorySelected: { borderColor: palette.sage, backgroundColor: palette.sagePale },
  categoryText: { color: palette.textPrimary, fontSize: 8 },
  categoryTextSelected: { color: palette.sage, fontWeight: '700' },
  categoryArrow: { color: palette.textSecondary, fontSize: 12 },
  noteInput: { minHeight: 64, paddingTop: spacing.sm, textAlignVertical: 'top', lineHeight: 13 },
  statusOptions: { minHeight: 37, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 3, marginTop: spacing.xs, borderRadius: borderRadius.extraLarge, backgroundColor: palette.sagePale },
  statusOption: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 8, borderRadius: borderRadius.extraLarge },
  statusSelected: { backgroundColor: palette.sage },
  statusText: { color: palette.textSecondary, fontSize: 7, fontWeight: '600' },
  statusTextSelected: { color: palette.surface },
  saveButton: { minHeight: 39, backgroundColor: palette.sage, borderWidth: 0, borderRadius: borderRadius.extraLarge, marginTop: spacing.sm },
  cancelButton: { minHeight: 34, alignItems: 'center', justifyContent: 'center', marginTop: spacing.xs, borderRadius: borderRadius.extraLarge, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border },
  cancelText: { color: palette.sage, fontSize: 8, fontWeight: '700' },
  deleteButton: { minHeight: 30, alignItems: 'center', justifyContent: 'center' },
  deleteText: { color: palette.clay, fontSize: 8 },
  deleteConfirmation: { padding: spacing.sm, marginTop: spacing.xs, borderWidth: 1, borderColor: palette.peach, borderRadius: borderRadius.medium, backgroundColor: palette.peachLight },
  deleteConfirmationText: { color: palette.textPrimary, fontSize: 8, lineHeight: 12, textAlign: 'center' },
  deleteActions: { flexDirection: 'row', gap: spacing.xs, marginTop: spacing.sm },
  keepButton: { flex: 1, minHeight: 34, alignItems: 'center', justifyContent: 'center', borderRadius: borderRadius.extraLarge, backgroundColor: palette.surface },
  confirmDeleteButton: { flex: 1, minHeight: 34, alignItems: 'center', justifyContent: 'center', borderRadius: borderRadius.extraLarge, backgroundColor: palette.clay },
  confirmDeleteText: { color: palette.surface, fontSize: 8, fontWeight: '700' },
  error: { color: palette.error, fontSize: 8, lineHeight: 12, marginTop: spacing.xs },
  loading: { marginVertical: spacing.xl },
});
