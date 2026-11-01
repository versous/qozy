import { typography } from '@/theme/typography';
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';

import { BottomNavigation } from '@/components/BottomNavigation';
import { CosyButton } from '@/components/common/CosyButton';
import { spacing, borderRadius, type AppColors } from '@/theme/colors';
import { useAppTheme } from '@/theme/ThemeProvider';

const durations = [10, 25, 40];
const activities = [
  { title: 'Lire', description: 'Une session calme pour retrouver son rythme.', minutes: 25, icon: '▤' },
  { title: 'Étudier', description: 'Se concentrer sur un cours ou un projet.', minutes: 25, icon: '✎' },
  { title: 'Méditer', description: 'Une pause pour respirer et se ressourcer.', minutes: 10, icon: '◉' },
];

export default function PrepareScreen() {
  const colors = useAppTheme().colors;
  const styles = createStyles(colors);
  const { activity: initialActivity } = useLocalSearchParams<{ activity?: string }>();
  const [activity, setActivity] = useState(initialActivity ?? 'Lire');
  const [duration, setDuration] = useState(25);
  const [customDuration, setCustomDuration] = useState('');
  const [sessionType, setSessionType] = useState<'Focus' | 'Petite pause' | 'Longue pause'>('Focus');
  const selectedActivity = activities.find((item) => item.title === activity) ?? activities[0];

  const startSession = () =>
    router.push({
      pathname: '/activity-ready',
      params: { activity, minutes: String(duration), category: 'lofi' },
    });

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.backButton}>
          <Text style={styles.backText}>‹  Aujourd’hui</Text>
        </Pressable>
        <Text style={styles.eyebrow}>À VOTRE RYTHME</Text>
        <Text style={styles.title}>Préparer ma séance</Text>
        <Text style={styles.subtitle}>Choisis une activité, un temps et lance ta session Focus.</Text>

        <View style={styles.segment}>
          {(['Focus', 'Petite pause', 'Longue pause'] as const).map((value) => (
            <Pressable
              key={value}
              onPress={() => {
                setSessionType(value);
                if (value === 'Petite pause') setDuration(10);
                if (value === 'Focus') setDuration(25);
                if (value === 'Longue pause') setDuration(40);
              }}
              style={[styles.segmentItem, sessionType === value && styles.segmentActive]}>
              <Text style={[styles.segmentText, sessionType === value && styles.segmentActiveText]}>
                {value}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.featureCard}>
          <View style={styles.featureArt}>
            <Text style={styles.featureArtText}>{selectedActivity.icon}</Text>
          </View>
          <View style={styles.featureCopy}>
            <Text style={styles.featureTitle}>{activity === 'Lire' ? 'Travailler avec toi' : `${activity} avec toi`}</Text>
            <Text style={styles.featureDescription}>Choisis une tâche, une durée et lance ta session Focus.</Text>
            <Text style={styles.lofi}>♫  AMBIANCE LOFI</Text>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Mes activités</Text>
          <Text style={styles.muted}>3 activités</Text>
        </View>
        {activities.map((item) => {
          const selected = item.title === activity;
          return (
            <Pressable
              key={item.title}
              onPress={() => {
                setActivity(item.title);
                setDuration(item.minutes);
                setSessionType('Focus');
              }}
              style={[styles.activityCard, selected && styles.activityCardSelected]}>
              <View style={[styles.activityIcon, selected && styles.activityIconSelected]}>
                <Text style={styles.activityIconText}>{item.icon}</Text>
              </View>
              <View style={styles.activityCopy}>
                <Text style={styles.activityTitle}>{item.title}</Text>
                <Text style={styles.activityDescription}>{item.description}</Text>
                <Text style={styles.activityDuration}>{item.minutes} min · temps par défaut</Text>
              </View>
              <Text style={styles.selectText}>{selected ? 'Choisi' : 'Choisir'}</Text>
            </Pressable>
          );
        })}

        <View style={styles.durationCard}>
          <View style={styles.durationHeader}>
            <Text style={styles.sectionTitle}>Durée personnalisable</Text>
            <Text style={styles.durationCurrent}>{duration} min</Text>
          </View>
          <View style={styles.durationOptions}>
            {durations.map((minutes) => (
              <Pressable
                key={minutes}
                onPress={() => {
                  setDuration(minutes);
                  setCustomDuration('');
                }}
                style={[styles.durationOption, duration === minutes && !customDuration && styles.durationOptionSelected]}>
                <Text style={[styles.durationText, duration === minutes && !customDuration && styles.durationTextSelected]}>
                  {minutes} min
                </Text>
              </Pressable>
              ))}
              <Pressable
                onPress={() => {
                  setCustomDuration((value) => value || '30');
                  setDuration(30);
                }}
                style={[styles.durationOption, Boolean(customDuration) && styles.durationOptionSelected]}>
                <Text style={[styles.durationText, Boolean(customDuration) && styles.durationTextSelected]}>Personnalisée</Text>
              </Pressable>
          </View>
          {customDuration ? (
              <View style={styles.customDurationRow}>
                <Text style={styles.customDurationLabel}>Ta durée (1 à 90 min)</Text>
                <TextInput
                  value={customDuration}
                  onChangeText={(value) => {
                    setCustomDuration(value);
                    const minutes = Number(value);
                    if (Number.isInteger(minutes) && minutes > 0 && minutes <= 90) setDuration(minutes);
                  }}
                  keyboardType="number-pad"
                  maxLength={2}
                  style={styles.customDurationInput}
                  accessibilityLabel="Durée personnalisée en minutes"
                />
              </View>
          ) : null}
        </View>

        <CosyButton title="Commencer la séance" onPress={startSession} style={styles.startButton} />
      </ScrollView>
      <BottomNavigation active="today" />
    </SafeAreaView>
  );
}

const createStyles = (palette: AppColors) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.background },
  content: { padding: spacing.md, paddingBottom: spacing.lg },
  backButton: { alignSelf: 'flex-start', paddingVertical: spacing.xs, marginBottom: spacing.sm },
  backText: { color: palette.sage, fontSize: 13, fontWeight: '600' },
  eyebrow: { color: palette.sage, fontSize: 9, fontWeight: '700', letterSpacing: 1, marginBottom: 5 },
  title: { color: palette.textPrimary, fontSize: 26, fontFamily: typography.fonts.display, fontWeight: '600' },
  subtitle: { color: palette.textSecondary, fontSize: 12, lineHeight: 18, marginTop: 5, marginBottom: spacing.md },
  segment: { flexDirection: 'row', backgroundColor: palette.sageLight, borderRadius: borderRadius.extraLarge, padding: 3, marginBottom: spacing.md },
  segmentActive: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.sage, borderRadius: borderRadius.extraLarge, paddingVertical: 9 },
  segmentActiveText: { color: palette.surface, fontSize: 11, fontWeight: '700' },
  segmentItem: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 9 },
  segmentText: { color: palette.textSecondary, fontSize: 10 },
  featureCard: { flexDirection: 'row', gap: spacing.sm, backgroundColor: palette.peach, borderRadius: borderRadius.medium, padding: spacing.sm, marginBottom: spacing.md },
  featureArt: { width: 76, minHeight: 80, borderRadius: borderRadius.small, backgroundColor: palette.peachLight, alignItems: 'center', justifyContent: 'center' },
  featureArtText: { color: palette.clay, fontSize: 30 },
  featureCopy: { flex: 1, justifyContent: 'center', paddingRight: spacing.xs },
  featureTitle: { color: palette.textPrimary, fontSize: 15, fontFamily: typography.fonts.display, fontWeight: '600' },
  featureDescription: { color: palette.textSecondary, fontSize: 10, lineHeight: 15, marginTop: 3 },
  lofi: { color: palette.clay, fontSize: 8, fontWeight: '700', letterSpacing: 0.6, marginTop: 6 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  sectionTitle: { color: palette.textPrimary, fontSize: 15, fontFamily: typography.fonts.display, fontWeight: '600' },
  muted: { color: palette.textSecondary, fontSize: 10 },
  activityCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 74, padding: spacing.sm, backgroundColor: palette.surface, borderRadius: borderRadius.small, borderWidth: 1, borderColor: palette.border, marginBottom: spacing.xs },
  activityCardSelected: { borderColor: palette.sage, backgroundColor: palette.sagePale },
  activityIcon: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: borderRadius.small, backgroundColor: palette.sagePale },
  activityIconSelected: { backgroundColor: palette.sageLight },
  activityIconText: { color: palette.sage, fontSize: 22 },
  activityCopy: { flex: 1 },
  activityTitle: { color: palette.textPrimary, fontSize: 13, fontFamily: typography.fonts.display, fontWeight: '600' },
  activityDescription: { color: palette.textSecondary, fontSize: 9, marginTop: 2 },
  activityDuration: { color: palette.sage, fontSize: 9, fontWeight: '600', marginTop: 4 },
  selectText: { color: palette.clay, fontSize: 9, fontWeight: '600', paddingHorizontal: spacing.xs },
  durationCard: { backgroundColor: palette.sagePale, padding: spacing.sm, borderRadius: borderRadius.small, marginTop: spacing.sm },
  durationHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  durationCurrent: { color: palette.sage, fontSize: 10, fontWeight: '700', backgroundColor: palette.surface, paddingHorizontal: 10, paddingVertical: 5, borderRadius: borderRadius.extraLarge },
  durationOptions: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.xs },
  durationOption: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: borderRadius.extraLarge, backgroundColor: palette.surface },
  durationOptionSelected: { backgroundColor: palette.sage },
  durationText: { color: palette.textSecondary, fontSize: 9, fontWeight: '600' },
  durationTextSelected: { color: palette.surface },
  customDurationRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.sm },
  customDurationLabel: { color: palette.textSecondary, fontSize: 9 },
  customDurationInput: { minWidth: 52, height: 34, borderRadius: borderRadius.small, paddingHorizontal: spacing.sm, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border, color: palette.textPrimary, textAlign: 'center', fontSize: 11 },
  startButton: { backgroundColor: palette.sage, borderWidth: 0, borderRadius: borderRadius.extraLarge, marginTop: spacing.md },
});
