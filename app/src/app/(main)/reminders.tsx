import { typography } from '@/theme/typography';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
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
import { router } from 'expo-router';
import * as Linking from 'expo-linking';
import { getPermissionsAsync } from 'expo-notifications/build/NotificationPermissions';
import type { NotificationPermissionsStatus } from 'expo-notifications/build/NotificationPermissions.types';

import { BottomNavigation } from '@/components/BottomNavigation';
import { BrandHeader } from '@/components/BrandHeader';
import { SwipeDismissSheet } from '@/components/SwipeDismissSheet';
import {
  DEFAULT_REMINDERS,
  deleteScheduledReminder,
  loadContextualReminders,
  saveLocationReminder,
  saveScheduledReminder,
  type ContextualReminders,
  type ScheduledReminder,
} from '@/services/contextualReminders';
import { borderRadius, spacing, type AppColors } from '@/theme/colors';
import { useAppTheme } from '@/theme/ThemeProvider';

const weekdays = [
  { index: 1, short: 'Lun.', full: 'Lundi' },
  { index: 2, short: 'Mar.', full: 'Mardi' },
  { index: 3, short: 'Mer.', full: 'Mercredi' },
  { index: 4, short: 'Jeu.', full: 'Jeudi' },
  { index: 5, short: 'Ven.', full: 'Vendredi' },
  { index: 6, short: 'Sam.', full: 'Samedi' },
  { index: 0, short: 'Dim.', full: 'Dimanche' },
];

function formatTime(hour: number, minute: number) {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function formatDays(days: number[]) {
  if (days.length === 7) return 'Tous les jours';
  return weekdays.filter((day) => days.includes(day.index)).map((day) => day.short).join(' · ');
}

function createReminderDraft(reminder?: ScheduledReminder): ScheduledReminder {
  return reminder
    ? { ...reminder, days: [...reminder.days], notificationIds: [...reminder.notificationIds] }
    : {
      id: `reminder-${Date.now()}`,
      title: '',
      category: 'Petit moment',
      message: '',
      hour: 9,
      minute: 0,
      days: [1, 2, 3, 4, 5],
      enabled: false,
      notificationIds: [],
    };
}

export default function RemindersScreen() {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const [reminders, setReminders] = useState<ContextualReminders>(DEFAULT_REMINDERS);
  const [loading, setLoading] = useState(true);
  const [permission, setPermission] = useState<NotificationPermissionsStatus | null>(null);
  const [savingReminderId, setSavingReminderId] = useState<string | null>(null);
  const [savingLocation, setSavingLocation] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [editorVisible, setEditorVisible] = useState(false);
  const [draft, setDraft] = useState<ScheduledReminder>(() => createReminderDraft());
  const [editingExisting, setEditingExisting] = useState(false);
  const [hourInput, setHourInput] = useState('09');
  const [minuteInput, setMinuteInput] = useState('00');
  const [locationExpanded, setLocationExpanded] = useState(false);

  const refreshPermission = useCallback(async () => {
    if (Platform.OS === 'web') {
      setPermission(null);
      return;
    }
    const status = await getPermissionsAsync();
    setPermission(status);
  }, []);

  useEffect(() => {
    let active = true;
    void Promise.all([
      loadContextualReminders(),
      Platform.OS === 'web' ? Promise.resolve(null) : getPermissionsAsync(),
    ]).then(([saved, status]) => {
      if (!active) return;
      setReminders(saved);
      setPermission(status);
      setLocationExpanded(saved.location.enabled);
    }).catch((reason: unknown) => {
      if (active) {
        setError(reason instanceof Error
          ? reason.message
          : 'Les rappels enregistrés n’ont pas pu être chargés.');
      }
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      void refreshPermission().catch((reason: unknown) => {
        setError(reason instanceof Error
          ? reason.message
          : 'Le statut des notifications n’a pas pu être vérifié.');
      });
    });
    return () => subscription.remove();
  }, [refreshPermission]);

  const visibleSchedules = reminders.schedules.filter((reminder) => !reminder.id.startsWith('habit:'));
  const activeCount = visibleSchedules.filter((reminder) => reminder.enabled).length;
  const notificationsAllowed = permission?.granted === true;

  const openEditor = (reminder?: ScheduledReminder) => {
    const nextDraft = createReminderDraft(reminder);
    setDraft(nextDraft);
    setHourInput(String(nextDraft.hour).padStart(2, '0'));
    setMinuteInput(String(nextDraft.minute).padStart(2, '0'));
    setEditingExisting(Boolean(reminder));
    setError('');
    setNotice('');
    setEditorVisible(true);
  };

  const closeEditor = () => setEditorVisible(false);

  const toggleDraftDay = (day: number) => {
    setDraft((current) => ({
      ...current,
      days: current.days.includes(day)
        ? current.days.filter((selected) => selected !== day)
        : [...current.days, day],
    }));
  };

  const handleSaveReminder = async () => {
    const hour = Number(hourInput);
    const minute = Number(minuteInput);
    if (!/^\d{1,2}$/.test(hourInput) || hour < 0 || hour > 23) {
      setError('Saisis une heure comprise entre 00 et 23.');
      return;
    }
    if (!/^\d{1,2}$/.test(minuteInput) || minute < 0 || minute > 59) {
      setError('Saisis des minutes comprises entre 00 et 59.');
      return;
    }
    setSavingReminderId(draft.id);
    setError('');
    setNotice('');
    try {
      const updated = await saveScheduledReminder(reminders, { ...draft, hour, minute });
      setReminders(updated);
      setEditorVisible(false);
      await refreshPermission();
      setNotice(draft.enabled ? 'Ton rappel est enregistré.' : 'Ton rappel est enregistré en pause.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Le rappel n’a pas pu être enregistré.');
    } finally {
      setSavingReminderId(null);
    }
  };

  const handleToggleReminder = async (reminder: ScheduledReminder) => {
    setSavingReminderId(reminder.id);
    setError('');
    setNotice('');
    try {
      const updated = await saveScheduledReminder(reminders, {
        ...reminder,
        enabled: !reminder.enabled,
      });
      setReminders(updated);
      await refreshPermission();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Le rappel n’a pas pu être modifié.');
    } finally {
      setSavingReminderId(null);
    }
  };

  const handleDeleteReminder = async () => {
    setSavingReminderId(draft.id);
    setError('');
    try {
      const updated = await deleteScheduledReminder(reminders, draft.id);
      setReminders(updated);
      setEditorVisible(false);
      setNotice('Le rappel a été supprimé.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Le rappel n’a pas pu être supprimé.');
    } finally {
      setSavingReminderId(null);
    }
  };

  const handleOpenSettings = async () => {
    setError('');
    try {
      await Linking.openSettings();
    } catch (reason) {
      setError(reason instanceof Error
        ? reason.message
        : 'Les réglages de notification n’ont pas pu être ouverts.');
    }
  };

  const handleToggleLocation = async () => {
    setSavingLocation(true);
    setError('');
    setNotice('');
    try {
      const updated = await saveLocationReminder(reminders, {
        enabled: !reminders.location.enabled,
        message: reminders.location.message,
      });
      setReminders(updated);
      await refreshPermission();
      setNotice(updated.location.enabled
        ? 'Ton rappel de lieu est activé.'
        : 'Ton rappel de lieu est en pause.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Le rappel de lieu n’a pas pu être modifié.');
    } finally {
      setSavingLocation(false);
    }
  };

  const handleSaveLocationMessage = async () => {
    setSavingLocation(true);
    setError('');
    setNotice('');
    try {
      const updated = await saveLocationReminder(reminders, {
        enabled: reminders.location.enabled,
        message: reminders.location.message,
      });
      setReminders(updated);
      setNotice('Le message de ton rappel de lieu est enregistré.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Le message du rappel n’a pas pu être enregistré.');
    } finally {
      setSavingLocation(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <View style={styles.loading}><ActivityIndicator color={colors.sage} /></View>
        <BottomNavigation active="account" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <BrandHeader
          trailing={
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Retour au compte"
              onPress={() => router.push('/profile')}
              style={styles.avatar}>
              <Text style={styles.avatarText}>L</Text>
            </Pressable>
          }
        />
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/profile')}
          style={styles.backLink}>
          <Text style={styles.backLinkText}>‹  Mon compte</Text>
        </Pressable>
        <Text style={styles.title}>Mes rappels</Text>
        <Text style={styles.subtitle}>De petites invitations, jamais des obligations.</Text>

        {!notificationsAllowed ? (
          <View style={styles.permissionCard}>
            <View style={styles.permissionIcon}>
              <Text style={styles.permissionIconText}>♧</Text>
            </View>
            <View style={styles.permissionCopy}>
              <Text style={styles.permissionTitle}>
                {Platform.OS === 'web' ? 'Notifications sur mobile' : 'Notifications non autorisées'}
              </Text>
              <Text style={styles.permissionDescription}>
                {Platform.OS === 'web'
                  ? 'Les rappels programmés sont disponibles dans l’application mobile.'
                  : 'Tes rappels restent enregistrés, mais aucune alerte ne peut s’afficher. Autorise les notifications dans les réglages de l’appareil.'}
              </Text>
            </View>
          </View>
        ) : null}
        {!notificationsAllowed && Platform.OS !== 'web' ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => void handleOpenSettings()}
            style={({ pressed }) => [styles.settingsButton, pressed && styles.pressed]}>
            <Text style={styles.settingsIcon}>⚙</Text>
            <Text style={styles.settingsButtonText}>Ouvrir les réglages de notification</Text>
          </Pressable>
        ) : null}

        <View style={styles.sectionHeading}>
          <Text style={styles.sectionTitle}>Mes horaires</Text>
          <Text style={styles.activeCount}>{activeCount} actif{activeCount === 1 ? '' : 's'}</Text>
        </View>

        {visibleSchedules.map((reminder) => (
          <View key={reminder.id} style={styles.reminderCard}>
            <View style={styles.reminderTop}>
              <Text style={styles.reminderTime}>{formatTime(reminder.hour, reminder.minute)}</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Modifier ${reminder.title}`}
                onPress={() => openEditor(reminder)}
                hitSlop={8}
                style={styles.editButton}>
                <Text style={styles.editIcon}>✎</Text>
              </Pressable>
            </View>
            <View style={styles.reminderDetails}>
              <View style={styles.reminderCopy}>
                <Text numberOfLines={1} style={styles.reminderTitle}>{reminder.title}</Text>
                <Text numberOfLines={1} style={styles.reminderCategory}>{reminder.category}</Text>
              </View>
              <Pressable
                accessibilityRole="switch"
                accessibilityLabel={`${reminder.enabled ? 'Désactiver' : 'Activer'} ${reminder.title}`}
                accessibilityState={{ checked: reminder.enabled, disabled: savingReminderId === reminder.id }}
                disabled={savingReminderId === reminder.id}
                onPress={() => void handleToggleReminder(reminder)}
                style={[
                  styles.toggleTrack,
                  reminder.enabled && styles.toggleTrackActive,
                  savingReminderId === reminder.id && styles.disabled,
                ]}>
                {savingReminderId === reminder.id
                  ? <ActivityIndicator size="small" color={colors.sage} />
                  : <View style={[styles.toggleThumb, reminder.enabled && styles.toggleThumbActive]} />}
              </Pressable>
            </View>
            <Text style={styles.reminderDays}>{formatDays(reminder.days)}</Text>
          </View>
        ))}

        <Pressable
          accessibilityRole="button"
          onPress={() => openEditor()}
          style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}>
          <Text style={styles.addButtonText}>＋  Ajouter un rappel</Text>
        </Pressable>

        <View style={styles.noteCard}>
          <Text style={styles.noteTitle}>Un rappel peut être mis en pause.</Text>
          <Text style={styles.noteText}>
            Les interrupteurs indiquent tes préférences. L’autorisation de l’appareil reste nécessaire.
          </Text>
        </View>

        <View style={styles.locationCard}>
          <View style={styles.locationHeader}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: locationExpanded }}
              onPress={() => setLocationExpanded((expanded) => !expanded)}
              style={styles.locationExpandButton}>
              <View style={styles.locationIcon}>
                <Text style={styles.locationIconText}>⌖</Text>
              </View>
              <View style={styles.locationCopy}>
                <Text style={styles.locationTitle}>Rappel à l’arrivée</Text>
                <Text style={styles.locationSubtitle}>Optionnel · près d’un lieu enregistré</Text>
              </View>
              <Text style={styles.locationChevron}>{locationExpanded ? '⌄' : '›'}</Text>
            </Pressable>
          </View>
          {locationExpanded ? (
            <>
              <TextInput
                accessibilityLabel="Message du rappel de localisation"
                maxLength={140}
                onChangeText={(message) => setReminders((current) => ({
                  ...current,
                  location: { ...current.location, message },
                }))}
                placeholder="Ton message pour cet endroit"
                placeholderTextColor={colors.textLight}
                style={styles.locationInput}
                value={reminders.location.message}
              />
              <View style={styles.locationActions}>
                <Pressable
                  accessibilityRole="switch"
                  accessibilityState={{ checked: reminders.location.enabled, disabled: savingLocation }}
                  disabled={savingLocation}
                  onPress={() => void handleToggleLocation()}
                  style={[
                    styles.toggleTrack,
                    reminders.location.enabled && styles.toggleTrackActive,
                    savingLocation && styles.disabled,
                  ]}>
                  {savingLocation
                    ? <ActivityIndicator size="small" color={colors.sage} />
                    : <View style={[styles.toggleThumb, reminders.location.enabled && styles.toggleThumbActive]} />}
                </Pressable>
                <Text style={styles.locationStateText}>
                  {reminders.location.enabled ? 'Activé' : 'En pause'}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  disabled={savingLocation}
                  onPress={() => void handleSaveLocationMessage()}
                  style={[styles.locationSaveButton, savingLocation && styles.disabled]}>
                  <Text style={styles.locationSaveText}>Enregistrer le message</Text>
                </Pressable>
              </View>
            </>
          ) : null}
        </View>

        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
        {notice ? <Text style={styles.notice}>{notice}</Text> : null}
      </ScrollView>
      <BottomNavigation active="account" />

      <Modal
        visible={editorVisible}
        animationType="slide"
        transparent
        onRequestClose={closeEditor}>
        <View style={styles.modalBackdrop}>
          <SwipeDismissSheet
            visible={editorVisible}
            onDismiss={closeEditor}
            style={styles.modal}>
            <ScrollView
              contentContainerStyle={styles.modalContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}>
              <Text style={styles.modalEyebrow}>{editingExisting ? 'TON PETIT RENDEZ-VOUS' : 'À TON RYTHME'}</Text>
              <Text style={styles.modalTitle}>{editingExisting ? 'Modifier le rappel' : 'Ajouter un rappel'}</Text>
              <Text style={styles.fieldLabel}>Nom du rappel</Text>
              <TextInput
                accessibilityLabel="Nom du rappel"
                maxLength={60}
                onChangeText={(title) => setDraft((current) => ({ ...current, title }))}
                placeholder="Ex. Prendre une pause"
                placeholderTextColor={colors.textLight}
                style={styles.input}
                value={draft.title}
              />
              <Text style={styles.fieldLabel}>Petit message</Text>
              <TextInput
                accessibilityLabel="Message du rappel"
                maxLength={140}
                onChangeText={(message) => setDraft((current) => ({ ...current, message }))}
                placeholder="Un mot doux pour toi"
                placeholderTextColor={colors.textLight}
                style={styles.input}
                value={draft.message}
              />
              <Text style={styles.fieldLabel}>À quelle heure ?</Text>
              <View style={styles.editorTimeRow}>
                <TextInput
                  accessibilityLabel="Heure du rappel, de 0 à 23"
                  keyboardType="number-pad"
                  maxLength={2}
                  onChangeText={(value) => {
                    if (!/^\d{0,2}$/.test(value)) return;
                    setHourInput(value);
                    const parsed = Number(value);
                    if (value && parsed <= 23) {
                      setDraft((current) => ({ ...current, hour: parsed }));
                    }
                  }}
                  onEndEditing={() => setHourInput((value) => value.padStart(2, '0'))}
                  selectTextOnFocus
                  style={styles.timeInput}
                  value={hourInput}
                />
                <Text style={styles.timeSeparator}>:</Text>
                <TextInput
                  accessibilityLabel="Minutes du rappel, de 0 à 59"
                  keyboardType="number-pad"
                  maxLength={2}
                  onChangeText={(value) => {
                    if (!/^\d{0,2}$/.test(value)) return;
                    setMinuteInput(value);
                    const parsed = Number(value);
                    if (value && parsed <= 59) {
                      setDraft((current) => ({ ...current, minute: parsed }));
                    }
                  }}
                  onEndEditing={() => setMinuteInput((value) => value.padStart(2, '0'))}
                  selectTextOnFocus
                  style={styles.timeInput}
                  value={minuteInput}
                />
                <Text style={styles.timeFormat}>24 h</Text>
              </View>
              <Text style={styles.fieldLabel}>Quels jours ?</Text>
              <View style={styles.daysRow}>
                {weekdays.map((day) => {
                  const selected = draft.days.includes(day.index);
                  return (
                    <Pressable
                      key={day.index}
                      accessibilityRole="button"
                      accessibilityLabel={day.full}
                      accessibilityState={{ selected }}
                      onPress={() => toggleDraftDay(day.index)}
                      style={[styles.dayChip, selected && styles.dayChipSelected]}>
                      <Text style={[styles.dayChipText, selected && styles.dayChipTextSelected]}>
                        {day.short.replace('.', '').slice(0, 1)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <Text style={styles.daysHint}>{formatDays(draft.days) || 'Choisis au moins un jour'}</Text>
              <Pressable
                accessibilityRole="switch"
                accessibilityState={{ checked: draft.enabled }}
                onPress={() => setDraft((current) => ({ ...current, enabled: !current.enabled }))}
                style={styles.editorToggleRow}>
                <Text style={styles.editorToggleLabel}>Activer ce rappel</Text>
                <View style={[styles.toggleTrack, draft.enabled && styles.toggleTrackActive]}>
                  <View style={[styles.toggleThumb, draft.enabled && styles.toggleThumbActive]} />
                </View>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                disabled={savingReminderId === draft.id || !draft.title.trim() || !draft.message.trim() || !draft.days.length}
                onPress={() => void handleSaveReminder()}
                style={[
                  styles.addButton,
                  styles.modalSaveButton,
                  (savingReminderId === draft.id || !draft.title.trim() || !draft.message.trim() || !draft.days.length) && styles.disabled,
                ]}>
                {savingReminderId === draft.id
                  ? <ActivityIndicator color={colors.surface} />
                  : <Text style={styles.addButtonText}>Enregistrer mon rappel</Text>}
              </Pressable>
              {editingExisting ? (
                <Pressable
                  accessibilityRole="button"
                  disabled={savingReminderId === draft.id}
                  onPress={() => void handleDeleteReminder()}
                  style={styles.deleteButton}>
                  <Text style={styles.deleteButtonText}>Supprimer ce rappel</Text>
                </Pressable>
              ) : null}
              <Pressable
                accessibilityRole="button"
                onPress={closeEditor}
                style={styles.cancelButton}>
                <Text style={styles.cancelButtonText}>Annuler</Text>
              </Pressable>
            </ScrollView>
          </SwipeDismissSheet>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const createStyles = (palette: AppColors) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.background },
  content: { paddingHorizontal: spacing.md, paddingBottom: spacing.md },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  avatar: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center', borderRadius: 15, backgroundColor: palette.peach },
  avatarText: { color: palette.clay, fontSize: 11, fontWeight: '700' },
  backLink: { alignSelf: 'flex-start', marginTop: -spacing.sm, marginBottom: spacing.sm },
  backLinkText: { color: palette.sage, fontSize: 9, fontWeight: '700' },
  title: { color: palette.textPrimary, fontSize: 24, lineHeight: 30, fontFamily: typography.fonts.display, fontWeight: '600' },
  subtitle: { color: palette.textSecondary, fontSize: 9, marginTop: 2, marginBottom: spacing.md },
  permissionCard: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, padding: spacing.sm, borderRadius: borderRadius.medium, backgroundColor: palette.peachLight },
  permissionIcon: { width: 25, height: 25, alignItems: 'center', justifyContent: 'center' },
  permissionIconText: { color: palette.clay, fontSize: 15 },
  permissionCopy: { flex: 1 },
  permissionTitle: { color: palette.textPrimary, fontSize: 9, fontWeight: '700' },
  permissionDescription: { color: palette.textSecondary, fontSize: 8, lineHeight: 11, marginTop: 3 },
  settingsButton: { minHeight: 34, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, marginTop: spacing.xs, marginBottom: spacing.sm, borderRadius: borderRadius.extraLarge, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border },
  settingsIcon: { color: palette.sage, fontSize: 12 },
  settingsButtonText: { color: palette.sage, fontSize: 8, fontWeight: '700' },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.xs, marginBottom: spacing.xs },
  sectionTitle: { color: palette.textPrimary, fontSize: 15, fontFamily: typography.fonts.display, fontWeight: '600' },
  activeCount: { color: palette.sage, fontSize: 8, fontWeight: '700' },
  reminderCard: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, marginBottom: spacing.xs, borderRadius: borderRadius.medium, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border },
  reminderTop: { minHeight: 28, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  reminderTime: { color: palette.textPrimary, fontSize: 18, lineHeight: 23, fontFamily: typography.fonts.display, fontVariant: ['tabular-nums'] },
  editButton: { width: 30, height: 28, alignItems: 'center', justifyContent: 'center' },
  editIcon: { color: palette.sage, fontSize: 15 },
  reminderDetails: { minHeight: 28, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  reminderCopy: { flex: 1 },
  reminderTitle: { color: palette.textPrimary, fontSize: 8, fontWeight: '700' },
  reminderCategory: { color: palette.textSecondary, fontSize: 7, marginTop: 2 },
  toggleTrack: { width: 32, height: 18, alignItems: 'flex-start', justifyContent: 'center', padding: 2, borderRadius: 10, backgroundColor: palette.border },
  toggleTrackActive: { alignItems: 'flex-end', backgroundColor: palette.sage },
  toggleThumb: { width: 14, height: 14, borderRadius: 7, backgroundColor: palette.surface },
  toggleThumbActive: { backgroundColor: palette.surface },
  reminderDays: { color: palette.textSecondary, fontSize: 7, marginTop: 3, marginBottom: 2 },
  addButton: { minHeight: 36, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: spacing.xs, borderRadius: borderRadius.extraLarge, backgroundColor: palette.sage },
  addButtonText: { color: palette.surface, fontSize: 9, fontWeight: '700' },
  locationCard: { padding: spacing.sm, marginTop: spacing.sm, borderRadius: borderRadius.medium, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border },
  locationHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  locationExpandButton: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  locationIcon: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: palette.peachLight },
  locationIconText: { color: palette.clay, fontSize: 15 },
  locationCopy: { flex: 1 },
  locationTitle: { color: palette.textPrimary, fontSize: 8, fontWeight: '700' },
  locationSubtitle: { color: palette.textSecondary, fontSize: 7, marginTop: 2 },
  locationChevron: { color: palette.sage, fontSize: 18 },
  locationInput: { minHeight: 32, paddingHorizontal: spacing.sm, marginTop: spacing.xs, borderRadius: borderRadius.small, borderWidth: 1, borderColor: palette.border, color: palette.textPrimary, fontSize: 8 },
  locationActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.xs },
  locationStateText: { color: palette.textSecondary, fontSize: 8 },
  locationSaveButton: { marginLeft: 'auto', paddingHorizontal: spacing.sm, paddingVertical: 6, borderRadius: borderRadius.extraLarge, backgroundColor: palette.sagePale },
  locationSaveText: { color: palette.sage, fontSize: 7, fontWeight: '700' },
  noteCard: { padding: spacing.sm, marginTop: spacing.sm, borderRadius: borderRadius.medium, backgroundColor: palette.sagePale },
  noteTitle: { color: palette.textPrimary, fontSize: 8, fontWeight: '700' },
  noteText: { color: palette.textSecondary, fontSize: 7, lineHeight: 10, marginTop: 4 },
  error: { color: palette.error, fontSize: 9, lineHeight: 13, marginTop: spacing.sm },
  notice: { color: palette.sage, fontSize: 9, lineHeight: 13, marginTop: spacing.sm },
  pressed: { opacity: 0.75 },
  disabled: { opacity: 0.55 },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(42, 48, 39, 0.38)' },
  modal: { maxHeight: '90%', padding: spacing.md, paddingBottom: spacing.xl, borderTopLeftRadius: borderRadius.large, borderTopRightRadius: borderRadius.large, backgroundColor: palette.background },
  modalContent: { flexGrow: 1, paddingBottom: spacing.sm },
  modalEyebrow: { color: palette.sage, fontSize: 8, fontWeight: '700', letterSpacing: 0.9, textAlign: 'center' },
  modalTitle: { color: palette.textPrimary, fontSize: 21, fontFamily: typography.fonts.display, fontWeight: '600', textAlign: 'center', marginVertical: spacing.sm },
  fieldLabel: { color: palette.textPrimary, fontSize: 9, fontWeight: '700', marginTop: spacing.sm, marginBottom: 5 },
  input: { minHeight: 42, paddingHorizontal: spacing.sm, borderRadius: borderRadius.small, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.surface, color: palette.textPrimary, fontSize: 10 },
  editorTimeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs },
  timeInput: { width: 58, height: 48, borderRadius: borderRadius.small, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border, color: palette.textPrimary, fontSize: 25, fontVariant: ['tabular-nums'], fontFamily: typography.fonts.display, textAlign: 'center' },
  timeSeparator: { color: palette.textPrimary, fontSize: 25, fontFamily: typography.fonts.display },
  timeFormat: { color: palette.textSecondary, fontSize: 8, marginLeft: spacing.xs },
  daysRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.xs },
  dayChip: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 16, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border },
  dayChipSelected: { backgroundColor: palette.sage, borderColor: palette.sage },
  dayChipText: { color: palette.textSecondary, fontSize: 9, fontWeight: '700' },
  dayChipTextSelected: { color: palette.surface },
  daysHint: { color: palette.textSecondary, fontSize: 8, marginTop: 5 },
  editorToggleRow: { minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.sm },
  editorToggleLabel: { color: palette.textPrimary, fontSize: 10, fontWeight: '600' },
  modalSaveButton: { marginTop: spacing.sm },
  deleteButton: { minHeight: 36, alignItems: 'center', justifyContent: 'center', marginTop: spacing.xs },
  deleteButtonText: { color: palette.error, fontSize: 9, fontWeight: '700' },
  cancelButton: { minHeight: 32, alignItems: 'center', justifyContent: 'center', marginTop: spacing.xs },
  cancelButtonText: { color: palette.textSecondary, fontSize: 9, fontWeight: '600' },
});
