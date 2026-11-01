import { typography } from '@/theme/typography';
import React, { useCallback, useEffect, useState } from 'react';
import { Animated, Easing, ImageBackground, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';

import { BreathingProgress } from '@/components/BreathingProgress';
import { AmbientGlow, SessionDeviceStatus } from '@/components/SessionDeviceStatus';
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
  const music = useMusic('meditation');
  const { play: playMeditation, pause: pauseMeditation } = music;
  const [isComplete, setIsComplete] = useState(false);
  const [completionOpacity] = useState(() => new Animated.Value(0));
  const handleComplete = useCallback(() => {
    setIsComplete(true);
    Animated.timing(completionOpacity, {
      toValue: 1,
      duration: 1_800,
      easing: Easing.inOut(Easing.ease),
      useNativeDriver: true,
    }).start();
  }, [completionOpacity]);
  const {
    secondsLeft,
    isActive,
    startTimer,
    pauseTimer,
    resetTimer,
  } = useTimer(duration, handleComplete);

  useEffect(() => {
    startTimer();
  }, [startTimer]);

  useEffect(() => {
    playMeditation();
    return () => pauseMeditation();
  }, [pauseMeditation, playMeditation]);

  const leaveSession = () => {
    pauseTimer();
    router.back();
  };

  const progress = (duration * 60 - secondsLeft) / (duration * 60);
  const restartSession = () => {
    completionOpacity.setValue(0);
    setIsComplete(false);
    resetTimer();
    startTimer();
  };
  const sessionLayerOpacity = completionOpacity.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0],
  });

  return (
    <ImageBackground
      source={require('@/assets/images/breathing-room.jpg')}
      resizeMode="cover"
      style={styles.background}>
      <View style={styles.scrim} />
      <AmbientGlow />
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
        <View style={styles.topRow}>
          <Text style={styles.brand}>nid · Méditer</Text>
          <View style={styles.topActions}>
            <SessionDeviceStatus />
            <Pressable onPress={leaveSession} accessibilityRole="button" style={styles.quitButton}>
              <Text style={styles.quitText}>×  Quitter</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.sessionStage}>
          <Animated.View
            pointerEvents={isComplete ? 'none' : 'auto'}
            style={[styles.sessionCard, { opacity: sessionLayerOpacity }]}>
            <Text style={styles.eyebrow}>MOMENT POUR TOI</Text>
            <Text style={styles.activity}>{activity}</Text>
            <Text style={styles.total}>Un instant après l’autre · {duration} min</Text>
            <BreathingProgress
              progress={progress}
              isActive={isActive}
              complete={isComplete}
              size={112}
              align="left"
            />
            <Text style={styles.gentlePrompt}>Inspire doucement. Tu n’as rien à réussir.</Text>

            <Pressable
              accessibilityRole="button"
              onPress={isActive ? pauseTimer : startTimer}
              disabled={secondsLeft === 0}
              style={[styles.primaryButton, styles.compactButton, secondsLeft === 0 && styles.disabledButton]}>
              <Text style={styles.primaryButtonText}>
                {secondsLeft === 0 ? '✓  Séance terminée' : isActive ? 'Ⅱ  Pause' : '▷  Reprendre'}
              </Text>
            </Pressable>

            {secondsLeft === 0 ? (
              <Pressable onPress={restartSession} style={styles.resetButton}>
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
          </Animated.View>
          <Animated.View
            pointerEvents={isComplete ? 'auto' : 'none'}
            style={[styles.sessionCard, styles.restCard, { opacity: completionOpacity }]}>
            <Text style={styles.restSymbol}>☾</Text>
            <Text style={styles.restTitle}>Le moment est venu de souffler</Text>
            <Text style={styles.gentlePrompt}>Belle parenthèse. Tu as pris ce temps pour toi.</Text>
            <Pressable onPress={restartSession} style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>Recommencer doucement</Text>
            </Pressable>
          </Animated.View>
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
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.xs },
  topActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  brand: { color: palette.surface, fontSize: 13, fontWeight: '700', textShadowColor: 'rgba(0,0,0,0.3)', textShadowRadius: 4 },
  quitButton: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: borderRadius.extraLarge, backgroundColor: palette.surface },
  quitText: { color: palette.textPrimary, fontSize: 10, fontWeight: '600' },
  sessionStage: { width: '100%', marginLeft: -spacing.md, paddingLeft: spacing.xs, alignItems: 'flex-start', justifyContent: 'center' },
  sessionCard: { width: '76%', maxWidth: 280, alignSelf: 'flex-start', padding: spacing.sm, borderRadius: borderRadius.medium, backgroundColor: withAlpha(palette.surface, 0.38), borderWidth: 1, borderColor: withAlpha(palette.surface, 0.5), overflow: 'hidden' },
  restCard: { position: 'absolute', backgroundColor: withAlpha(palette.sagePale, 0.5) },
  eyebrow: { color: palette.sage, fontSize: 8, letterSpacing: 0.8, fontWeight: '700' },
  activity: { color: palette.textPrimary, fontSize: 17, fontFamily: typography.fonts.display, fontWeight: '600', marginTop: spacing.xs },
  total: { color: palette.textSecondary, fontSize: 9, marginTop: spacing.xs, marginBottom: spacing.xs },
  gentlePrompt: { color: palette.textPrimary, fontSize: 10, lineHeight: 15, textAlign: 'center', marginBottom: spacing.sm },
  progressTrack: { height: 4, borderRadius: 2, backgroundColor: palette.border, overflow: 'hidden', marginBottom: spacing.sm },
  progressFill: { height: '100%', borderRadius: 2, backgroundColor: palette.sage },
  primaryButton: { minHeight: 40, alignItems: 'center', justifyContent: 'center', borderRadius: borderRadius.extraLarge, backgroundColor: palette.sage },
  compactButton: { width: 140, minHeight: 34, alignSelf: 'center' },
  primaryButtonText: { color: palette.surface, fontSize: 11, fontWeight: '700' },
  disabledButton: { opacity: 0.7 },
  resetButton: { alignItems: 'center', paddingTop: spacing.sm },
  resetText: { color: palette.textSecondary, fontSize: 10, fontWeight: '600' },
  restSymbol: { color: palette.clay, fontSize: 30, textAlign: 'center' },
  restTitle: { color: palette.textPrimary, fontSize: 19, lineHeight: 25, fontFamily: typography.fonts.display, fontWeight: '600', textAlign: 'center', marginVertical: spacing.md },
  musicRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingTop: spacing.sm, marginTop: spacing.sm, borderTopWidth: 1, borderTopColor: palette.border },
  musicCopy: { flex: 1 },
  musicTitle: { color: palette.textPrimary, fontSize: 8, fontWeight: '700' },
  musicArtist: { color: palette.textSecondary, fontSize: 8, marginTop: 2 },
  musicButton: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: palette.sagePale },
  musicButtonText: { color: palette.sage, fontSize: 13, fontWeight: '700' },
  footer: { color: palette.surface, fontSize: 10, fontFamily: typography.fonts.display, fontStyle: 'italic', textAlign: 'center', textShadowColor: 'rgba(0,0,0,0.35)', textShadowRadius: 5, marginBottom: spacing.sm },
});

function withAlpha(hexColor: string, alpha: number) {
  const color = hexColor.replace('#', '');
  const red = Number.parseInt(color.slice(0, 2), 16);
  const green = Number.parseInt(color.slice(2, 4), 16);
  const blue = Number.parseInt(color.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}
