import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BottomNavigation } from '@/components/BottomNavigation';
import {
  DEFAULT_REMINDERS,
  loadContextualReminders,
  saveLocationReminder,
  saveTimeReminder,
  type ContextualReminders,
} from '@/services/contextualReminders';
import { borderRadius, spacing, type AppColors } from '@/theme/colors';
import { useAppTheme } from '@/theme/ThemeProvider';

function formatTime(hour: number, minute: number) {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function stepTime(hour: number, minute: number, amount: number) {
  const totalMinutes = (hour * 60 + minute + amount + 1440) % 1440;
  return { hour: Math.floor(totalMinutes / 60), minute: totalMinutes % 60 };
}

export default function RemindersScreen() {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const [reminders, setReminders] = useState<ContextualReminders>(DEFAULT_REMINDERS);
  const [loading, setLoading] = useState(true);
  const [savingTime, setSavingTime] = useState(false);
  const [savingLocation, setSavingLocation] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let active = true;
    void loadContextualReminders()
      .then((saved) => {
        if (active) setReminders(saved);
      })
      .catch(() => {
        if (active) setError('Les rappels enregistrés n’ont pas pu être chargés.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const saveTime = async (enabled: boolean) => {
    setSavingTime(true);
    setError('');
    setNotice('');
    try {
      const updated = await saveTimeReminder(reminders, { ...reminders.time, enabled });
      setReminders(updated);
      setNotice(enabled ? 'Ton rappel quotidien est enregistré.' : 'Ton rappel quotidien est désactivé.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Le rappel horaire n’a pas pu être enregistré.');
    } finally {
      setSavingTime(false);
    }
  };

  const saveLocation = async (enabled: boolean) => {
    setSavingLocation(true);
    setError('');
    setNotice('');
    try {
      const updated = await saveLocationReminder(reminders, {
        enabled,
        message: reminders.location.message,
      });
      setReminders(updated);
      setNotice(enabled
        ? 'Ton rappel se déclenchera à ton arrivée près de cet endroit.'
        : 'Ton rappel de localisation est désactivé.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Le rappel de localisation n’a pas pu être enregistré.');
    } finally {
      setSavingLocation(false);
    }
  };

  const adjustTime = (amount: number) => {
    const next = stepTime(reminders.time.hour, reminders.time.minute, amount);
    setReminders((current) => ({ ...current, time: { ...current.time, ...next } }));
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
        <Text style={styles.eyebrow}>À TON RYTHME</Text>
        <Text style={styles.title}>Des rappels tout en douceur</Text>
        <Text style={styles.subtitle}>Choisis un moment ou un lieu. Tu peux tout désactiver quand tu le souhaites.</Text>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.icon}><Text style={styles.iconText}>☼</Text></View>
            <View style={styles.copy}>
              <Text style={styles.cardTitle}>Un moment dans la journée</Text>
              <Text style={styles.cardSubtitle}>Un rappel quotidien à l’heure de ton choix.</Text>
            </View>
          </View>

          <View style={styles.timePicker}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Retirer quinze minutes"
              onPress={() => adjustTime(-15)}
              style={styles.timeArrow}>
              <Text style={styles.timeArrowText}>−</Text>
            </Pressable>
            <Text style={styles.timeValue}>{formatTime(reminders.time.hour, reminders.time.minute)}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Ajouter quinze minutes"
              onPress={() => adjustTime(15)}
              style={styles.timeArrow}>
              <Text style={styles.timeArrowText}>+</Text>
            </Pressable>
          </View>
          <Text style={styles.hint}>Ajuste par tranches de 15 minutes.</Text>
          <TextInput
            accessibilityLabel="Message du rappel quotidien"
            maxLength={140}
            onChangeText={(message) => setReminders((current) => ({
              ...current,
              time: { ...current.time, message },
            }))}
            placeholder="Un message qui te fait du bien"
            placeholderTextColor={colors.textLight}
            style={styles.input}
            value={reminders.time.message}
          />
          <Pressable
            accessibilityRole="switch"
            accessibilityState={{ checked: reminders.time.enabled, disabled: savingTime }}
            disabled={savingTime}
            onPress={() => void saveTime(!reminders.time.enabled)}
            style={[styles.action, reminders.time.enabled && styles.actionActive, savingTime && styles.disabled]}>
            {savingTime ? <ActivityIndicator color={colors.surface} /> : (
              <Text style={[styles.actionText, reminders.time.enabled && styles.actionTextActive]}>
                {reminders.time.enabled ? 'Désactiver le rappel' : 'Activer le rappel quotidien'}
              </Text>
            )}
          </Pressable>
          {reminders.time.enabled ? (
            <Pressable
              accessibilityRole="button"
              disabled={savingTime}
              onPress={() => void saveTime(true)}
              style={[styles.saveChanges, savingTime && styles.disabled]}>
              <Text style={styles.saveChangesText}>Enregistrer les modifications</Text>
            </Pressable>
          ) : null}
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={[styles.icon, styles.locationIcon]}><Text style={styles.iconText}>⌖</Text></View>
            <View style={styles.copy}>
              <Text style={styles.cardTitle}>À l’arrivée près d’un lieu</Text>
              <Text style={styles.cardSubtitle}>Enregistre ta position actuelle comme repère.</Text>
            </View>
          </View>
          <TextInput
            accessibilityLabel="Message du rappel de localisation"
            maxLength={140}
            onChangeText={(message) => setReminders((current) => ({
              ...current,
              location: { ...current.location, message },
            }))}
            placeholder="Un message pour ton arrivée"
            placeholderTextColor={colors.textLight}
            style={styles.input}
            value={reminders.location.message}
          />
          <Text style={styles.privacy}>
            La position est enregistrée uniquement sur ce téléphone. Une autorisation de localisation en arrière-plan est nécessaire.
          </Text>
          <Pressable
            accessibilityRole="switch"
            accessibilityState={{ checked: reminders.location.enabled, disabled: savingLocation }}
            disabled={savingLocation}
            onPress={() => void saveLocation(!reminders.location.enabled)}
            style={[styles.action, reminders.location.enabled && styles.actionActive, savingLocation && styles.disabled]}>
            {savingLocation ? <ActivityIndicator color={colors.surface} /> : (
              <Text style={[styles.actionText, reminders.location.enabled && styles.actionTextActive]}>
                {reminders.location.enabled ? 'Désactiver le rappel de lieu' : 'Enregistrer ce lieu et activer'}
              </Text>
            )}
          </Pressable>
          {reminders.location.enabled ? (
            <Pressable
              accessibilityRole="button"
              disabled={savingLocation}
              onPress={() => void saveLocation(true)}
              style={[styles.saveChanges, savingLocation && styles.disabled]}>
              <Text style={styles.saveChangesText}>Enregistrer les modifications</Text>
            </Pressable>
          ) : null}
          {reminders.location.enabled ? (
            <Text style={styles.hint}>Rappel à l’entrée dans une zone d’environ 150 m autour du lieu enregistré.</Text>
          ) : null}
        </View>

        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
        {notice ? <Text style={styles.notice}>{notice}</Text> : null}
      </ScrollView>
      <BottomNavigation active="account" />
    </SafeAreaView>
  );
}

const createStyles = (palette: AppColors) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.background },
  content: { padding: spacing.md, paddingBottom: spacing.xl },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  eyebrow: { color: palette.sage, fontSize: 9, letterSpacing: 1, fontWeight: '700', marginTop: spacing.sm },
  title: { color: palette.textPrimary, fontSize: 26, lineHeight: 33, fontFamily: 'serif', fontWeight: '600', marginTop: 6 },
  subtitle: { color: palette.textSecondary, fontSize: 12, lineHeight: 19, marginTop: 6, marginBottom: spacing.md },
  card: { padding: spacing.md, marginTop: spacing.md, borderRadius: borderRadius.medium, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  icon: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.sagePale },
  locationIcon: { backgroundColor: palette.peachLight },
  iconText: { color: palette.sage, fontSize: 21 },
  copy: { flex: 1 },
  cardTitle: { color: palette.textPrimary, fontSize: 14, fontWeight: '700' },
  cardSubtitle: { color: palette.textSecondary, fontSize: 10, lineHeight: 15, marginTop: 3 },
  timePicker: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xl, marginTop: spacing.lg },
  timeArrow: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.sagePale },
  timeArrowText: { color: palette.sage, fontSize: 24 },
  timeValue: { color: palette.textPrimary, fontSize: 33, fontVariant: ['tabular-nums'], fontWeight: '600' },
  hint: { color: palette.textSecondary, fontSize: 10, textAlign: 'center', marginTop: 6 },
  input: { minHeight: 48, paddingHorizontal: spacing.sm, marginTop: spacing.md, borderRadius: borderRadius.small, borderWidth: 1, borderColor: palette.border, color: palette.textPrimary, fontSize: 12 },
  privacy: { color: palette.textSecondary, fontSize: 10, lineHeight: 16, marginTop: spacing.md },
  action: { minHeight: 46, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.md, marginTop: spacing.md, borderRadius: borderRadius.extraLarge, backgroundColor: palette.sagePale },
  actionActive: { backgroundColor: palette.sage },
  actionText: { color: palette.sage, fontSize: 11, fontWeight: '700', textAlign: 'center' },
  actionTextActive: { color: palette.surface },
  saveChanges: { minHeight: 40, alignItems: 'center', justifyContent: 'center', marginTop: spacing.xs, borderRadius: borderRadius.extraLarge, borderWidth: 1, borderColor: palette.border },
  saveChangesText: { color: palette.textSecondary, fontSize: 10, fontWeight: '600' },
  disabled: { opacity: 0.6 },
  error: { color: palette.error, fontSize: 11, lineHeight: 16, marginTop: spacing.md },
  notice: { color: palette.sage, fontSize: 11, lineHeight: 16, marginTop: spacing.md },
});
