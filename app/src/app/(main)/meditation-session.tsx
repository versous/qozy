import React, { useCallback, useEffect } from 'react';
import { Alert, ImageBackground, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';

import { useTimer } from '@/hooks/useTimer';
import { useMusic } from '@/services/MusicProvider';
import { borderRadius, spacing, type AppColors } from '@/theme/colors';
import { useAppTheme } from '@/theme/ThemeProvider';

export default function MeditationSessionScreen() {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const { activity: requestedActivity, minutes: requestedMinutes } =
    useLocalSearchParams<{ activity?: string; minutes?: string }>();
  const parsedMinutes = Number(requestedMinutes);
  const duration = Number.isInteger(parsedMinutes) && parsedMinutes > 0 && parsedMinutes <= 60
    ? parsedMinutes
    : 10;
  const activity = requestedActivity ?? 'Méditer';
  const music = useMusic();
  const handleComplete = useCallback(() => {
    Alert.alert('Belle parenthèse', 'Tu as pris ce temps pour toi. Bravo.');
  }, []);
  const {
    secondsLeft,
    isActive,
    startTimer,
    pauseTimer,
    resetTimer,
    formatTime,
  } = useTimer(duration, handleComplete);

  useEffect(() => {
    startTimer();
  }, [startTimer]);

  const leaveSession = () => {
    pauseTimer();
    router.back();
  };

  const progress = (duration * 60 - secondsLeft) / (duration * 60);

  return (
    <ImageBackground
      source={require('@/assets/images/breathing-room.jpg')}
      resizeMode="cover"
      style={styles.background}>
      <View style={styles.scrim} />
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
        <View style={styles.topRow}>
          <Text style={styles.brand}>nid · Méditer</Text>
          <Pressable onPress={leaveSession} accessibilityRole="button" style={styles.quitButton}>
            <Text style={styles.quitText}>×  Quitter</Text>
          </Pressable>
        </View>

        <View style={styles.sessionCard}>
          <Text style={styles.eyebrow}>MOMENT POUR TOI</Text>
          <Text style={styles.activity}>{activity}</Text>
          <Text style={styles.timer}>{formatTime()}</Text>
          <Text style={styles.total}>Durée choisie · {duration} min</Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${Math.min(100, progress * 100)}%` }]} />
          </View>

          <Pressable
            accessibilityRole="button"
            onPress={isActive ? pauseTimer : startTimer}
            disabled={secondsLeft === 0}
            style={[styles.primaryButton, secondsLeft === 0 && styles.disabledButton]}>
            <Text style={styles.primaryButtonText}>
              {secondsLeft === 0 ? '✓  Séance terminée' : isActive ? 'Ⅱ  Pause' : '▷  Reprendre'}
            </Text>
          </Pressable>

          {secondsLeft === 0 ? (
            <Pressable
              onPress={() => {
                resetTimer();
                startTimer();
              }}
              style={styles.resetButton}>
              <Text style={styles.resetText}>Recommencer</Text>
            </Pressable>
          ) : null}

          <View style={styles.musicRow}>
            <View style={styles.musicCopy}>
              <Text style={styles.musicTitle} numberOfLines={1}>{music.currentTrack.title}</Text>
              <Text style={styles.musicArtist}>{music.currentTrack.artist}</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={music.isPlaying ? 'Mettre la musique en pause' : 'Reprendre la musique'}
              onPress={music.togglePlayback}
              style={styles.musicButton}>
              <Text style={styles.musicButtonText}>{music.isPlaying ? 'Ⅱ' : '▷'}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Passer à la musique suivante"
              onPress={music.nextTrack}
              style={styles.musicButton}>
              <Text style={styles.musicButtonText}>»</Text>
            </Pressable>
          </View>
        </View>

        <Text style={styles.footer}>Inspire doucement. Tu n’as rien à réussir.</Text>
      </SafeAreaView>
    </ImageBackground>
  );
}

const createStyles = (palette: AppColors) => StyleSheet.create({
  background: { flex: 1, backgroundColor: palette.background },
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(25, 30, 24, 0.28)' },
  safeArea: { flex: 1, justifyContent: 'space-between', padding: spacing.md },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { color: palette.surface, fontSize: 13, fontWeight: '700', textShadowColor: 'rgba(0,0,0,0.3)', textShadowRadius: 4 },
  quitButton: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: borderRadius.extraLarge, backgroundColor: palette.surface },
  quitText: { color: palette.textPrimary, fontSize: 10, fontWeight: '600' },
  sessionCard: { width: 235, padding: spacing.md, borderRadius: borderRadius.medium, backgroundColor: palette.surface },
  eyebrow: { color: palette.sage, fontSize: 8, letterSpacing: 0.8, fontWeight: '700' },
  activity: { color: palette.textPrimary, fontSize: 17, fontFamily: 'serif', fontWeight: '600', marginTop: spacing.xs },
  timer: { color: palette.textPrimary, fontSize: 32, fontWeight: '500', fontVariant: ['tabular-nums'], marginTop: spacing.xs },
  total: { color: palette.textSecondary, fontSize: 9, marginTop: 1, marginBottom: spacing.sm },
  progressTrack: { height: 4, borderRadius: 2, backgroundColor: palette.border, overflow: 'hidden', marginBottom: spacing.sm },
  progressFill: { height: '100%', borderRadius: 2, backgroundColor: palette.sage },
  primaryButton: { minHeight: 40, alignItems: 'center', justifyContent: 'center', borderRadius: borderRadius.extraLarge, backgroundColor: palette.sage },
  primaryButtonText: { color: palette.surface, fontSize: 11, fontWeight: '700' },
  disabledButton: { opacity: 0.7 },
  resetButton: { alignItems: 'center', paddingTop: spacing.sm },
  resetText: { color: palette.textSecondary, fontSize: 10, fontWeight: '600' },
  musicRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingTop: spacing.sm, marginTop: spacing.sm, borderTopWidth: 1, borderTopColor: palette.border },
  musicCopy: { flex: 1 },
  musicTitle: { color: palette.textPrimary, fontSize: 8, fontWeight: '700' },
  musicArtist: { color: palette.textSecondary, fontSize: 8, marginTop: 2 },
  musicButton: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: palette.sagePale },
  musicButtonText: { color: palette.sage, fontSize: 13, fontWeight: '700' },
  footer: { color: palette.surface, fontSize: 10, fontFamily: 'serif', fontStyle: 'italic', textAlign: 'center', textShadowColor: 'rgba(0,0,0,0.35)', textShadowRadius: 5, marginBottom: spacing.sm },
});
