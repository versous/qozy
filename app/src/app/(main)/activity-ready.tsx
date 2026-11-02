import { typography } from '@/theme/typography';
import React, { useEffect, useState } from 'react';
import { Animated, Easing, ImageBackground, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';

import { useMusic } from '@/services/MusicProvider';
import { borderRadius, spacing, type AppColors } from '@/theme/colors';
import { useAppTheme } from '@/theme/ThemeProvider';

export default function ActivityReadyScreen() {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const {
    activity: requestedActivity,
    minutes: requestedMinutes,
    category: requestedCategory,
    repetitions: requestedRepetitions,
    exerciseId,
  } = useLocalSearchParams<{
    activity?: string;
    minutes?: string;
    category?: string;
    repetitions?: string;
    exerciseId?: string;
  }>();
  const category = requestedCategory === 'meditation'
    ? 'meditation'
    : requestedCategory === 'sport' ? 'sport' : 'lofi';
  const music = useMusic(category);
  const [progress] = useState(() => new Animated.Value(0));
  const activity = requestedActivity ?? (category === 'meditation' ? 'Méditer' : 'Ta séance');
  const parsedMinutes = Number(requestedMinutes);
  const minutes = Number.isInteger(parsedMinutes) && parsedMinutes > 0 && parsedMinutes <= 90
    ? parsedMinutes
    : category === 'meditation' ? 10 : 25;
  const parsedRepetitions = Number(requestedRepetitions);
  const repetitions = category === 'sport' && Number.isInteger(parsedRepetitions)
    && parsedRepetitions > 0 && parsedRepetitions <= 1000
    ? parsedRepetitions
    : undefined;

  useEffect(() => {
    if (music.isLoaded && !music.isBuffering) {
      progress.stopAnimation();
      progress.setValue(1);
      return;
    }

    progress.setValue(0);
    const loadingAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(progress, {
          toValue: 0.8,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
        Animated.timing(progress, {
          toValue: 0.15,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
      ]),
    );
    loadingAnimation.start();
    return () => loadingAnimation.stop();
  }, [music.isBuffering, music.isLoaded, progress]);

  const startActivity = () => {
    if (!music.isLoaded || music.isBuffering) return;
    music.play();
    router.replace({
      pathname: category === 'meditation' ? '/meditation-session' : '/focus',
      params: {
        activity,
        minutes: String(minutes),
        category,
        ...(repetitions ? { repetitions: String(repetitions) } : {}),
        ...(exerciseId ? { exerciseId } : {}),
      },
    });
  };

  return (
    <ImageBackground
      source={category === 'meditation'
        ? require('@/assets/images/breathing-room.jpg')
        : category === 'sport'
          ? require('@/assets/images/exercise-session.jpg')
          : require('@/assets/images/focus-room.jpg')}
      resizeMode="cover"
      style={styles.background}>
      <View style={styles.scrim} />
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.back}>
          <Text style={styles.backText}>‹  Retour</Text>
        </Pressable>
        <View style={styles.card}>
          <Text style={styles.eyebrow}>ON PRÉPARE TON ESPACE</Text>
          <Text style={styles.title}>{activity}</Text>
          <Text style={styles.subtitle}>
            {repetitions ? `${repetitions} répétitions · ` : `${minutes} min · `}{category === 'meditation'
              ? 'Méditation'
              : category === 'sport' ? 'Musique de sport' : 'Ambiance Lofi'}
          </Text>
          <ImageBackground
            source={category === 'meditation'
              ? require('@/assets/images/breathing-room.jpg')
              : category === 'sport'
                ? require('@/assets/images/exercise-session.jpg')
                : require('@/assets/images/focus-room.jpg')}
            resizeMode="cover"
            style={styles.art}
            imageStyle={styles.artImage}>
            <View style={styles.artScrim} />
            <Text style={styles.artIcon}>{category === 'meditation' ? '☾' : category === 'sport' ? '⚡' : '♫'}</Text>
            <Text style={styles.artTitle}>{music.currentTrack.title}</Text>
            <Text style={styles.artArtist}>{music.currentTrack.artist}</Text>
          </ImageBackground>
          <View
            accessibilityRole="progressbar"
            accessibilityValue={{ min: 0, max: 100, now: music.isLoaded && !music.isBuffering ? 100 : 15 }}
            style={styles.progressTrack}>
            <Animated.View style={[
              styles.progressFill,
              { width: progress.interpolate({ inputRange: [0, 1], outputRange: ['15%', '100%'] }) },
            ]} />
          </View>
          <Text style={styles.loadingText}>
            {music.isBuffering
              ? 'La musique se charge…'
              : music.isLoaded
                ? 'Tout est prêt, prends ton temps.'
                : 'Préparation de la musique…'}
          </Text>
          <Pressable
            accessibilityRole="button"
            disabled={!music.isLoaded || music.isBuffering}
            onPress={startActivity}
            style={[styles.startButton, (!music.isLoaded || music.isBuffering) && styles.buttonDisabled]}>
            <Text style={styles.startText}>
              {music.isLoaded && !music.isBuffering ? 'Commencer doucement' : 'Chargement…'}
            </Text>
          </Pressable>
          {category === 'lofi' ? (
            <Pressable
              accessibilityRole="link"
              onPress={() => router.push('/music-library')}
              style={styles.changeMusic}>
              <Text style={styles.changeMusicText}>Choisir une autre musique</Text>
            </Pressable>
          ) : null}
        </View>
      </SafeAreaView>
    </ImageBackground>
  );
}

const createStyles = (palette: AppColors) => StyleSheet.create({
  background: { flex: 1, backgroundColor: palette.background },
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(26, 34, 28, 0.35)' },
  safeArea: { flex: 1, justifyContent: 'space-between', padding: spacing.md },
  back: { alignSelf: 'flex-start', paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: borderRadius.extraLarge, backgroundColor: palette.surface },
  backText: { color: palette.textPrimary, fontSize: 11, fontWeight: '600' },
  card: { padding: spacing.md, borderRadius: borderRadius.medium, backgroundColor: palette.surface },
  eyebrow: { color: palette.sage, fontSize: 8, letterSpacing: 0.8, fontWeight: '700' },
  title: { color: palette.textPrimary, fontSize: 21, fontFamily: typography.fonts.display, fontWeight: '600', marginTop: spacing.xs },
  subtitle: { color: palette.textSecondary, fontSize: 10, marginTop: 3 },
  art: { minHeight: 140, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', padding: spacing.sm, marginTop: spacing.md, borderRadius: borderRadius.medium, backgroundColor: palette.peach },
  artImage: { borderRadius: borderRadius.medium },
  artScrim: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(34, 30, 25, 0.34)' },
  artIcon: { color: '#FFFDF7', fontSize: 24 },
  artTitle: { color: '#FFFDF7', fontSize: 11, fontWeight: '700', marginTop: 4, textAlign: 'center' },
  artArtist: { color: '#FFFDF7', fontSize: 9, marginTop: 2 },
  progressTrack: { height: 6, overflow: 'hidden', borderRadius: 3, backgroundColor: palette.border, marginTop: spacing.md },
  progressFill: { height: '100%', borderRadius: 3, backgroundColor: palette.sage },
  loadingText: { color: palette.textSecondary, fontSize: 9, textAlign: 'center', marginTop: spacing.xs },
  startButton: { minHeight: 42, alignItems: 'center', justifyContent: 'center', borderRadius: borderRadius.extraLarge, backgroundColor: palette.sage, marginTop: spacing.md },
  startText: { color: palette.surface, fontSize: 10, fontWeight: '700' },
  buttonDisabled: { opacity: 0.55 },
  changeMusic: { alignSelf: 'center', padding: spacing.sm, marginTop: spacing.xs },
  changeMusicText: { color: palette.sage, fontSize: 9, fontWeight: '600' },
});
