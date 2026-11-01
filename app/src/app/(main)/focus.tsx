import { typography } from '@/theme/typography';
import React, { useCallback, useEffect, useState } from 'react';
import { Animated, Easing, ImageBackground, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useTimer } from '@/hooks/useTimer';
import { useMusic } from '@/services/MusicProvider';
import { AmbientGlow, SessionDeviceStatus } from '@/components/SessionDeviceStatus';
import { BreathingProgress } from '@/components/BreathingProgress';
import { borderRadius, spacing, type AppColors } from '@/theme/colors';
import { useAppTheme } from '@/theme/ThemeProvider';

export default function FocusScreen() {
  const { activity, minutes, category } = useLocalSearchParams<{
    activity?: string;
    minutes?: string;
    category?: string;
  }>();
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
      musicCategory={category === 'sport' ? 'sport' : 'lofi'}
    />
  );
}

function FocusSession({
  activity,
  duration,
  musicCategory,
}: {
  activity: string;
  duration: number;
  musicCategory: 'lofi' | 'sport';
}) {
  const colors = useAppTheme().colors;
  const styles = createStyles(colors);
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
  const { secondsLeft, isActive, startTimer, pauseTimer, resetTimer } = useTimer(
    duration,
    handleComplete
  );
  const music = useMusic(musicCategory);
  const playMusic = music.play;
  const pauseMusic = music.pause;

  useEffect(() => {
    if (musicCategory !== 'sport') return;
    playMusic();
    return () => pauseMusic();
  }, [musicCategory, pauseMusic, playMusic]);

  const leaveSession = () => {
    pauseTimer();
    router.back();
  };
  const restartSession = () => {
    completionOpacity.setValue(0);
    setIsComplete(false);
    resetTimer();
    startTimer();
  };
  const completionLayerOpacity = completionOpacity;
  const sessionLayerOpacity = completionOpacity.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0],
  });

  return (
    <ImageBackground
      source={musicCategory === 'sport'
        ? require('@/assets/images/exercise-session.jpg')
        : require('@/assets/images/focus-room.jpg')}
      resizeMode="cover"
      style={styles.background}>
      <View style={styles.scrim} />
      <AmbientGlow />
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
        <View style={styles.topBar}>
          <Pressable onPress={leaveSession} hitSlop={10} style={styles.backButton}>
            <Text style={styles.backText}>‹  Quitter ma bulle</Text>
          </Pressable>
          <SessionDeviceStatus />
        </View>

        <View style={styles.sessionStage}>
          <Animated.View
            pointerEvents={isComplete ? 'none' : 'auto'}
            style={[styles.sessionCard, { opacity: sessionLayerOpacity }]}>
            <Text style={styles.eyebrow}>{musicCategory === 'sport' ? 'MOUVEMENT EN COURS' : 'FOCUS EN COURS'}</Text>
            <Text style={styles.activity}>{activity}</Text>
            <Text style={styles.total}>{duration} min · un moment rien qu’à toi</Text>
            <BreathingProgress
              progress={(duration * 60 - secondsLeft) / (duration * 60)}
              isActive={isActive}
              complete={isComplete}
              size={112}
              align="left"
            />
            <Text style={styles.gentlePrompt}>
              {isActive ? 'Laisse le temps passer doucement.' : 'Commence quand tu te sens prêt·e.'}
            </Text>

            <Pressable
              onPress={isActive ? pauseTimer : startTimer}
              disabled={secondsLeft === 0}
              style={({ pressed }) => [styles.primaryButton, styles.compactButton, pressed && styles.pressed, secondsLeft === 0 && styles.disabled]}>
              <Text style={styles.primaryButtonText}>
                {isActive ? 'Ⅱ  Pause' : secondsLeft === 0 ? '✓  Séance terminée' : '▷  Commencer'}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={music.isPlaying ? 'Mettre l’ambiance en pause' : 'Reprendre l’ambiance sonore'}
              onPress={music.togglePlayback}
              style={styles.musicButton}>
              <Text style={styles.musicButtonText}>
                {music.isPlaying ? '♫  Ambiance activée · Pause' : '♫  Reprendre l’ambiance'}
              </Text>
            </Pressable>
          </Animated.View>

          <Animated.View
            pointerEvents={isComplete ? 'auto' : 'none'}
            style={[styles.sessionCard, styles.restCard, { opacity: completionLayerOpacity }]}>
            <Text style={styles.restSymbol}>☾</Text>
            <Text style={styles.restTitle}>Le moment est venu de souffler</Text>
            <Text style={styles.gentlePrompt}>Tu as pris ce temps pour toi. C’est déjà beaucoup.</Text>
            <Pressable onPress={restartSession} style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>Recommencer doucement</Text>
            </Pressable>
          </Animated.View>
        </View>

        <Text style={styles.footer}>Une chose à la fois. Tu es exactement là où il faut.</Text>
      </SafeAreaView>
    </ImageBackground>
  );
}

const createStyles = (palette: AppColors) => StyleSheet.create({
  background: { flex: 1, backgroundColor: palette.background },
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0, 0, 0, 0.28)' },
  safeArea: { flex: 1, justifyContent: 'space-between', padding: spacing.md },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  backButton: { alignSelf: 'flex-start', paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: borderRadius.extraLarge, backgroundColor: palette.surface },
  backText: { color: palette.textPrimary, fontSize: 11, fontWeight: '600' },
  sessionStage: { width: '100%', marginLeft: -spacing.md, paddingLeft: spacing.xs, alignItems: 'flex-start', justifyContent: 'center' },
  sessionCard: { alignSelf: 'flex-start', width: '76%', maxWidth: 280, padding: spacing.sm, borderRadius: borderRadius.medium, backgroundColor: withAlpha(palette.surface, 0.38), borderWidth: 1, borderColor: withAlpha(palette.surface, 0.5), overflow: 'hidden' },
  restCard: { position: 'absolute', alignSelf: 'flex-start', width: '76%', backgroundColor: withAlpha(palette.sagePale, 0.5) },
  eyebrow: { color: palette.sage, fontSize: 8, letterSpacing: 0.9, fontWeight: '700' },
  activity: { color: palette.textPrimary, fontSize: 17, fontFamily: typography.fonts.display, fontWeight: '600', marginTop: spacing.xs },
  total: { color: palette.textSecondary, fontSize: 9, marginTop: 3 },
  gentlePrompt: { color: palette.textSecondary, fontSize: 10, lineHeight: 15, textAlign: 'center', marginBottom: spacing.sm },
  primaryButton: { minHeight: 42, alignItems: 'center', justifyContent: 'center', borderRadius: borderRadius.extraLarge, backgroundColor: palette.sage },
  compactButton: { width: 140, minHeight: 34, alignSelf: 'center' },
  primaryButtonText: { color: palette.surface, fontSize: 11, fontWeight: '700' },
  musicButton: { alignSelf: 'center', paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, marginTop: spacing.sm, borderRadius: borderRadius.extraLarge, backgroundColor: palette.sagePale },
  musicButtonText: { color: palette.sage, fontSize: 9, fontWeight: '600' },
  restSymbol: { color: palette.clay, fontSize: 30, textAlign: 'center' },
  restTitle: { color: palette.textPrimary, fontSize: 19, lineHeight: 25, fontFamily: typography.fonts.display, fontWeight: '600', textAlign: 'center', marginVertical: spacing.md },
  footer: { color: palette.surface, fontSize: 10, fontFamily: typography.fonts.display, fontStyle: 'italic', textAlign: 'center', textShadowColor: 'rgba(0,0,0,0.35)', textShadowRadius: 5, marginBottom: spacing.sm },
  pressed: { opacity: 0.82 },
  disabled: { opacity: 0.7 },
});

function withAlpha(hexColor: string, alpha: number) {
  const color = hexColor.replace('#', '');
  const red = Number.parseInt(color.slice(0, 2), 16);
  const green = Number.parseInt(color.slice(2, 4), 16);
  const blue = Number.parseInt(color.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}
