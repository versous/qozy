import React from 'react';
import { Alert, ImageBackground, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';

import { useTimer } from '@/hooks/useTimer';
import { borderRadius, colors, spacing } from '@/theme/colors';

export default function FocusScreen() {
  const { activity, minutes } = useLocalSearchParams<{ activity?: string; minutes?: string }>();
  const requestedMinutes = Number(minutes);
  const duration =
    Number.isInteger(requestedMinutes) && requestedMinutes > 0 && requestedMinutes <= 90
      ? requestedMinutes
      : 25;

  return (
    <FocusSession
      key={`${activity ?? 'Lire'}-${duration}`}
      activity={activity ?? 'Lire'}
      duration={duration}
    />
  );
}

function FocusSession({ activity, duration }: { activity: string; duration: number }) {
  const { secondsLeft, isActive, startTimer, pauseTimer, resetTimer, formatTime } = useTimer(
    duration,
    () => Alert.alert('Belle séance', 'Tu as pris ce temps pour toi. Bravo.')
  );

  const leaveSession = () => {
    pauseTimer();
    router.back();
  };

  return (
    <ImageBackground
      source={require('@/assets/images/focus-room.jpg')}
      resizeMode="cover"
      style={styles.background}>
      <View style={styles.scrim} />
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
        <Pressable onPress={leaveSession} hitSlop={10} style={styles.backButton}>
          <Text style={styles.backText}>‹  Quitter ma bulle</Text>
        </Pressable>

        <View style={styles.sessionCard}>
          <Text style={styles.eyebrow}>FOCUS EN COURS</Text>
          <Text style={styles.activity}>{activity}</Text>
          <Text style={styles.timer}>{formatTime()}</Text>
          <Text style={styles.total}>Durée totale · {duration} min</Text>

          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                { width: `${((duration * 60 - secondsLeft) / (duration * 60)) * 100}%` },
              ]}
            />
          </View>

          <Pressable
            onPress={isActive ? pauseTimer : startTimer}
            disabled={secondsLeft === 0}
            style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed, secondsLeft === 0 && styles.disabled]}>
            <Text style={styles.primaryButtonText}>
              {isActive ? 'Ⅱ  Pause' : secondsLeft === 0 ? '✓  Séance terminée' : '▷  Commencer'}
            </Text>
          </Pressable>

          {secondsLeft === 0 ? (
            <Pressable onPress={resetTimer} style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>Recommencer</Text>
            </Pressable>
          ) : null}
        </View>

        <Text style={styles.footer}>Une chose à la fois. Tu es exactement là où il faut.</Text>
      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1, backgroundColor: colors.background },
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(39, 43, 35, 0.14)' },
  safeArea: { flex: 1, justifyContent: 'space-between', padding: spacing.md },
  backButton: { alignSelf: 'flex-start', paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: borderRadius.extraLarge, backgroundColor: 'rgba(255,252,246,0.88)' },
  backText: { color: colors.textPrimary, fontSize: 11, fontWeight: '600' },
  sessionCard: { alignSelf: 'flex-start', width: '100%', maxWidth: 300, padding: spacing.md, borderRadius: borderRadius.medium, backgroundColor: 'rgba(255,252,246,0.96)' },
  eyebrow: { color: colors.sage, fontSize: 8, letterSpacing: 0.9, fontWeight: '700' },
  activity: { color: colors.textPrimary, fontSize: 17, fontFamily: 'serif', fontWeight: '600', marginTop: spacing.xs },
  timer: { color: colors.textPrimary, fontSize: 34, fontWeight: '500', fontVariant: ['tabular-nums'], marginTop: spacing.xs },
  total: { color: colors.textSecondary, fontSize: 9, marginTop: 1, marginBottom: spacing.sm },
  progressTrack: { height: 4, borderRadius: 2, backgroundColor: colors.border, overflow: 'hidden', marginBottom: spacing.sm },
  progressFill: { height: '100%', borderRadius: 2, backgroundColor: colors.sage },
  primaryButton: { minHeight: 40, alignItems: 'center', justifyContent: 'center', borderRadius: borderRadius.extraLarge, backgroundColor: colors.sage },
  primaryButtonText: { color: colors.surface, fontSize: 11, fontWeight: '700' },
  secondaryButton: { alignItems: 'center', paddingTop: spacing.sm },
  secondaryButtonText: { color: colors.textSecondary, fontSize: 10, fontWeight: '600' },
  footer: { color: colors.surface, fontSize: 10, fontFamily: 'serif', fontStyle: 'italic', textAlign: 'center', textShadowColor: 'rgba(0,0,0,0.35)', textShadowRadius: 5, marginBottom: spacing.sm },
  pressed: { opacity: 0.82 },
  disabled: { opacity: 0.7 },
});
