import { typography } from '@/theme/typography';
import React, { type ComponentType, useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Animated, Easing, ImageBackground, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useTimer } from '@/hooks/useTimer';
import { useExercises } from '@/hooks/useExercises';
import { useMusic } from '@/services/MusicProvider';
import { AmbientGlow, SessionDeviceStatus } from '@/components/SessionDeviceStatus';
import { BreathingProgress } from '@/components/BreathingProgress';
import {
  getPoseCounterStatusMessage,
  getPoseExercise,
  type CameraRepCounterProps,
  type PoseCounterStatus,
} from '@/components/exercisePoseSupport';
import { borderRadius, spacing, type AppColors } from '@/theme/colors';
import { useAppTheme } from '@/theme/ThemeProvider';

export default function FocusScreen() {
  const { activity, minutes, category, repetitions, exerciseId } = useLocalSearchParams<{
    activity?: string;
    minutes?: string;
    category?: string;
    repetitions?: string;
    exerciseId?: string;
  }>();
  const requestedMinutes = Number(minutes);
  const duration =
    Number.isInteger(requestedMinutes) && requestedMinutes > 0 && requestedMinutes <= 90
      ? requestedMinutes
      : 25;
  const requestedRepetitions = Number(repetitions);
  const targetRepetitions = Number.isInteger(requestedRepetitions)
    && requestedRepetitions > 0 && requestedRepetitions <= 1000
    ? requestedRepetitions
    : undefined;

  return (
    <FocusSession
      key={`${activity ?? 'Lire'}-${duration}-${targetRepetitions ?? 'timer'}`}
      activity={activity ?? 'Lire'}
      duration={duration}
      musicCategory={category === 'sport' ? 'sport' : 'lofi'}
      targetRepetitions={targetRepetitions}
      exerciseId={exerciseId}
    />
  );
}

function FocusSession({
  activity,
  duration,
  musicCategory,
  targetRepetitions,
  exerciseId,
}: {
  activity: string;
  duration: number;
  musicCategory: 'lofi' | 'sport';
  targetRepetitions?: number;
  exerciseId?: string;
}) {
  const colors = useAppTheme().colors;
  const styles = createStyles(colors);
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const [isComplete, setIsComplete] = useState(false);
  const [repetitionsDone, setRepetitionsDone] = useState(0);
  const [isSavingCompletion, setIsSavingCompletion] = useState(false);
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [cameraStatus, setCameraStatus] = useState<PoseCounterStatus>('unavailable');
  const [cameraError, setCameraError] = useState('');
  const [CameraRepCounter, setCameraRepCounter] = useState<ComponentType<CameraRepCounterProps> | null>(null);
  const cameraLoadRequest = useRef(0);
  const [completionOpacity] = useState(() => new Animated.Value(0));
  const { toggleCompleted } = useExercises();
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
  const cameraSupported = musicCategory === 'sport'
    && Boolean(targetRepetitions && getPoseExercise(activity));
  const manualCounterAvailable = !cameraEnabled
    || ['permission-required', 'unavailable', 'error'].includes(cameraStatus);
  const handleCameraCount = useCallback((count: number) => {
    const updatedCount = Math.min(count, targetRepetitions ?? count);
    setRepetitionsDone(updatedCount);
    if (targetRepetitions && updatedCount >= targetRepetitions) {
      cameraLoadRequest.current += 1;
      setCameraEnabled(false);
    }
  }, [targetRepetitions]);
  const handleCameraStatus = useCallback((status: PoseCounterStatus, error?: string) => {
    setCameraStatus(status);
    setCameraError(error ?? '');
  }, []);
  const toggleCameraCounter = async () => {
    if (cameraEnabled) {
      cameraLoadRequest.current += 1;
      setCameraEnabled(false);
      setCameraStatus('unavailable');
      setCameraError('');
      return;
    }

    setCameraEnabled(true);
    setCameraStatus('initializing');
    setCameraError('');
    const requestId = ++cameraLoadRequest.current;
    try {
      // Metro resolves the platform file; require avoids split-bundle module IDs.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { CameraRepCounter: LoadedCameraRepCounter } = require('@/components/CameraRepCounter') as {
        CameraRepCounter: ComponentType<CameraRepCounterProps>;
      };
      if (requestId === cameraLoadRequest.current) {
        setCameraRepCounter(() => LoadedCameraRepCounter);
      }
    } catch (reason) {
      if (requestId !== cameraLoadRequest.current) return;
      const message = reason instanceof Error ? reason.message : 'Le module caméra est indisponible.';
      setCameraError(
        `Cette version de Qozy ne contient pas les modules natifs de la caméra. Installe une nouvelle compilation de l’application. (${message})`,
      );
      setCameraStatus('error');
    }
  };

  useEffect(() => {
    if (musicCategory !== 'sport') return;
    playMusic();
    return () => pauseMusic();
  }, [musicCategory, pauseMusic, playMusic]);

  const leaveSession = () => {
    pauseTimer();
    router.back();
  };
  const openRitual = () => {
    router.push({
      pathname: '/ritual',
      params: { activity },
    });
  };
  const restartSession = () => {
    completionOpacity.setValue(0);
    setIsComplete(false);
    setRepetitionsDone(0);
    if (targetRepetitions) return;
    resetTimer();
    startTimer();
  };
  const validateRepetitions = async () => {
    if (!targetRepetitions || repetitionsDone < targetRepetitions || isSavingCompletion) return;
    setIsSavingCompletion(true);
    try {
      if (exerciseId) await toggleCompleted(exerciseId);
      handleComplete();
    } catch (reason) {
      Alert.alert(
        'Séance non enregistrée',
        reason instanceof Error ? reason.message : 'Réessaie de valider ta séance.',
      );
    } finally {
      setIsSavingCompletion(false);
    }
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
      {cameraEnabled && CameraRepCounter && !isComplete ? (
        <CameraRepCounter
          activity={activity}
          targetRepetitions={targetRepetitions ?? 1}
          onCountChange={handleCameraCount}
          onStatusChange={handleCameraStatus}
        />
      ) : null}
      <AmbientGlow />
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
        <View style={styles.topBar}>
          <Pressable onPress={leaveSession} hitSlop={10} style={styles.backButton}>
            <Text style={styles.backText}>‹  Quitter ma bulle</Text>
          </Pressable>
          <SessionDeviceStatus />
        </View>

        <View style={[styles.sessionStage, isLandscape && styles.sessionStageLandscape]}>
          <Animated.View
            pointerEvents={isComplete ? 'none' : 'auto'}
            style={[
              styles.sessionCard,
              isLandscape && styles.sessionCardLandscape,
              cameraEnabled && styles.cameraSessionCard,
              {
                opacity: sessionLayerOpacity,
                height: isLandscape ? '100%' : undefined,
              },
            ]}>
            {isLandscape ? (
              <View style={styles.sessionLandscapeLayout}>
                <View style={styles.progressLandscape}>
                  <BreathingProgress
                    progress={targetRepetitions
                      ? repetitionsDone / targetRepetitions
                      : (duration * 60 - secondsLeft) / (duration * 60)}
                    isActive={targetRepetitions ? repetitionsDone > 0 : isActive}
                    complete={isComplete}
                    size={96}
                    align="center"
                  />
                </View>
                <ScrollView
                  style={styles.landscapeContent}
                  contentContainerStyle={styles.landscapeContentInner}
                  showsVerticalScrollIndicator
                  nestedScrollEnabled>
                  <Text style={styles.eyebrow}>{musicCategory === 'sport' ? 'MOUVEMENT EN COURS' : 'FOCUS EN COURS'}</Text>
                  <Text style={styles.activity}>{activity}</Text>
                  {musicCategory === 'lofi' && /lire|étud|etud/i.test(activity) ? (
                    <Pressable accessibilityRole="button" onPress={openRitual} style={styles.ritualLink}>
                      <Text style={styles.ritualLinkText}>Configurer mon rituel</Text>
                    </Pressable>
                  ) : null}
                  <Text style={styles.total}>
                    {targetRepetitions
                      ? `${targetRepetitions} répétitions · à ton rythme`
                      : `${duration} min · un moment rien qu’à toi`}
                  </Text>
                  {targetRepetitions && cameraEnabled ? (
                    <Text style={styles.cameraStatus}>
                      {getPoseCounterStatusMessage(cameraStatus)}
                      {'\n'}Image analysée sur cet appareil, non enregistrée.
                    </Text>
                  ) : null}
                  {targetRepetitions ? (
                    <Text style={styles.repCount}>{repetitionsDone} / {targetRepetitions} répétitions</Text>
                  ) : null}
                  {targetRepetitions && manualCounterAvailable ? (
                    <>
                      <View style={styles.repControls}>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel="Retirer une répétition"
                          disabled={repetitionsDone === 0 || isSavingCompletion}
                          onPress={() => setRepetitionsDone((count) => Math.max(0, count - 1))}
                          style={[styles.repAdjustButton, (repetitionsDone === 0 || isSavingCompletion) && styles.disabled]}>
                          <Text style={styles.repAdjustText}>−</Text>
                        </Pressable>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel="Ajouter une répétition"
                          disabled={repetitionsDone >= targetRepetitions || isSavingCompletion}
                          onPress={() => setRepetitionsDone((count) => Math.min(targetRepetitions, count + 1))}
                          style={[styles.primaryButton, styles.repAddButton, repetitionsDone >= targetRepetitions && styles.disabled]}>
                          <Text style={styles.primaryButtonText}>＋  Ajouter</Text>
                        </Pressable>
                      </View>
                      <Pressable
                        accessibilityRole="button"
                        disabled={repetitionsDone < targetRepetitions || isSavingCompletion}
                        onPress={() => void validateRepetitions()}
                        style={[styles.primaryButton, styles.validateButton, styles.validateButtonLandscape, (repetitionsDone < targetRepetitions || isSavingCompletion) && styles.disabled]}>
                        <Text style={styles.primaryButtonText}>
                          {isSavingCompletion ? 'Enregistrement…' : '✓  Valider ma série'}
                        </Text>
                      </Pressable>
                    </>
                  ) : null}
                  {cameraSupported ? (
                    <>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityState={{ selected: cameraEnabled }}
                        onPress={() => void toggleCameraCounter()}
                        style={styles.cameraToggle}>
                        <Text style={styles.cameraToggleText}>
                          {cameraEnabled ? '▣  Désactiver le comptage caméra' : '◎  Compter avec la caméra'}
                        </Text>
                      </Pressable>
                      {cameraError ? <Text style={styles.cameraError}>{cameraError}</Text> : null}
                    </>
                  ) : null}
                  <Text style={styles.gentlePrompt}>
                    {targetRepetitions
                      ? 'Compte chaque mouvement, sans te presser.'
                      : isActive ? 'Laisse le temps passer doucement.' : 'Commence quand tu te sens prêt·e.'}
                  </Text>
                  {!targetRepetitions ? (
                    <Pressable
                      onPress={isActive ? pauseTimer : startTimer}
                      disabled={secondsLeft === 0}
                      style={({ pressed }) => [styles.primaryButton, styles.compactButton, pressed && styles.pressed, secondsLeft === 0 && styles.disabled]}>
                      <Text style={styles.primaryButtonText}>
                        {isActive ? 'Ⅱ  Pause' : secondsLeft === 0 ? '✓  Séance terminée' : '▷  Commencer'}
                      </Text>
                    </Pressable>
                  ) : null}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={music.isPlaying ? 'Mettre l’ambiance en pause' : 'Reprendre l’ambiance sonore'}
                    onPress={music.togglePlayback}
                    style={styles.musicButton}>
                    <Text style={styles.musicButtonText}>
                      {music.isPlaying ? '♫  Ambiance activée · Pause' : '♫  Reprendre l’ambiance'}
                    </Text>
                  </Pressable>
                </ScrollView>
              </View>
            ) : (
              <>
            <Text style={styles.eyebrow}>{musicCategory === 'sport' ? 'MOUVEMENT EN COURS' : 'FOCUS EN COURS'}</Text>
            <Text style={styles.activity}>{activity}</Text>
            {musicCategory === 'lofi' && /lire|étud|etud/i.test(activity) ? (
              <Pressable accessibilityRole="button" onPress={openRitual} style={styles.ritualLink}>
                <Text style={styles.ritualLinkText}>Configurer mon rituel</Text>
              </Pressable>
            ) : null}
            <Text style={styles.total}>
              {targetRepetitions
                ? `${targetRepetitions} répétitions · à ton rythme`
                : `${duration} min · un moment rien qu’à toi`}
            </Text>
            <BreathingProgress
              progress={targetRepetitions
                ? repetitionsDone / targetRepetitions
                : (duration * 60 - secondsLeft) / (duration * 60)}
              isActive={targetRepetitions ? repetitionsDone > 0 : isActive}
              complete={isComplete}
              size={112}
              align="left"
            />
            {targetRepetitions && cameraEnabled ? (
              <Text style={styles.cameraStatus}>
                {getPoseCounterStatusMessage(cameraStatus)}
                {'\n'}Image analysée sur cet appareil, non enregistrée.
              </Text>
            ) : null}
            {targetRepetitions ? (
              <Text style={styles.repCount}>{repetitionsDone} / {targetRepetitions} répétitions</Text>
            ) : null}
            {targetRepetitions && manualCounterAvailable ? (
              <>
                <View style={styles.repControls}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Retirer une répétition"
                    disabled={repetitionsDone === 0 || isSavingCompletion}
                    onPress={() => setRepetitionsDone((count) => Math.max(0, count - 1))}
                    style={[styles.repAdjustButton, (repetitionsDone === 0 || isSavingCompletion) && styles.disabled]}>
                    <Text style={styles.repAdjustText}>−</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Ajouter une répétition"
                    disabled={repetitionsDone >= targetRepetitions || isSavingCompletion}
                    onPress={() => setRepetitionsDone((count) => Math.min(targetRepetitions, count + 1))}
                    style={[styles.primaryButton, styles.repAddButton, repetitionsDone >= targetRepetitions && styles.disabled]}>
                    <Text style={styles.primaryButtonText}>＋  Ajouter</Text>
                  </Pressable>
                </View>
                <Pressable
                  accessibilityRole="button"
                  disabled={repetitionsDone < targetRepetitions || isSavingCompletion}
                  onPress={() => void validateRepetitions()}
                  style={[styles.primaryButton, styles.validateButton, (repetitionsDone < targetRepetitions || isSavingCompletion) && styles.disabled]}>
                  <Text style={styles.primaryButtonText}>
                    {isSavingCompletion ? 'Enregistrement…' : '✓  Valider ma série'}
                  </Text>
                </Pressable>
              </>
            ) : null}
            {cameraSupported ? (
              <>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: cameraEnabled }}
                  onPress={() => void toggleCameraCounter()}
                  style={styles.cameraToggle}>
                  <Text style={styles.cameraToggleText}>
                    {cameraEnabled ? '▣  Désactiver le comptage caméra' : '◎  Compter avec la caméra'}
                  </Text>
                </Pressable>
                {cameraError ? <Text style={styles.cameraError}>{cameraError}</Text> : null}
              </>
            ) : null}
            <Text style={styles.gentlePrompt}>
              {targetRepetitions
                ? 'Compte chaque mouvement, sans te presser.'
                : isActive ? 'Laisse le temps passer doucement.' : 'Commence quand tu te sens prêt·e.'}
            </Text>

            {!targetRepetitions ? (
              <Pressable
                onPress={isActive ? pauseTimer : startTimer}
                disabled={secondsLeft === 0}
                style={({ pressed }) => [styles.primaryButton, styles.compactButton, pressed && styles.pressed, secondsLeft === 0 && styles.disabled]}>
                <Text style={styles.primaryButtonText}>
                  {isActive ? 'Ⅱ  Pause' : secondsLeft === 0 ? '✓  Séance terminée' : '▷  Commencer'}
                </Text>
              </Pressable>
            ) : null}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={music.isPlaying ? 'Mettre l’ambiance en pause' : 'Reprendre l’ambiance sonore'}
              onPress={music.togglePlayback}
              style={styles.musicButton}>
              <Text style={styles.musicButtonText}>
                {music.isPlaying ? '♫  Ambiance activée · Pause' : '♫  Reprendre l’ambiance'}
              </Text>
            </Pressable>
              </>
            )}
          </Animated.View>

          <Animated.View
            pointerEvents={isComplete ? 'auto' : 'none'}
            style={[
            styles.sessionCard,
            styles.restCard,
            isLandscape && styles.sessionCardLandscape,
            { opacity: completionLayerOpacity },
            ]}>
            <Text style={styles.restSymbol}>☾</Text>
            <Text style={styles.restTitle}>Le moment est venu de souffler</Text>
            <Text style={styles.gentlePrompt}>Tu as pris ce temps pour toi. C’est déjà beaucoup.</Text>
            <Pressable onPress={targetRepetitions ? leaveSession : restartSession} style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>
                {targetRepetitions ? 'Retour à ma routine' : 'Recommencer doucement'}
              </Text>
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
  sessionStageLandscape: { flex: 1, minHeight: 0, alignItems: 'flex-start', justifyContent: 'center', paddingVertical: spacing.xs, transform: [{ translateY: -32 }] },
  sessionCard: { alignSelf: 'flex-start', width: '76%', maxWidth: 280, padding: spacing.sm, borderRadius: borderRadius.medium, backgroundColor: withAlpha(palette.surface, 0.38), borderWidth: 1, borderColor: withAlpha(palette.surface, 0.5), overflow: 'hidden' },
  sessionCardLandscape: { width: '92%', maxWidth: 620, height: '100%', maxHeight: '100%', padding: spacing.xs, flexShrink: 1 },
  sessionLandscapeLayout: { flexDirection: 'row', alignItems: 'center', flex: 1, minHeight: 0, gap: spacing.sm },
  progressLandscape: { width: 102, alignItems: 'center', justifyContent: 'center' },
  landscapeContent: { flex: 1, minHeight: 0 },
  landscapeContentInner: { flexGrow: 1, justifyContent: 'center', paddingVertical: spacing.xs },
  restCard: { position: 'absolute', alignSelf: 'flex-start', width: '76%', backgroundColor: withAlpha(palette.sagePale, 0.5) },
  eyebrow: { color: palette.sage, fontSize: 8, letterSpacing: 0.9, fontWeight: '700' },
  activity: { color: palette.textPrimary, fontSize: 17, fontFamily: typography.fonts.display, fontWeight: '600', marginTop: spacing.xs },
  ritualLink: { alignSelf: 'flex-start', marginTop: spacing.xs, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: borderRadius.extraLarge, backgroundColor: palette.sagePale },
  ritualLinkText: { color: palette.sage, fontSize: 8, fontWeight: '700' },
  total: { color: palette.textSecondary, fontSize: 9, marginTop: 3 },
  cameraSessionCard: { backgroundColor: withAlpha(palette.surface, 0.86) },
  cameraStatus: { color: palette.textSecondary, fontSize: 9, lineHeight: 14, textAlign: 'center', marginBottom: spacing.sm },
  cameraToggle: { alignSelf: 'center', paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, marginBottom: spacing.sm, borderRadius: borderRadius.extraLarge, backgroundColor: palette.sagePale },
  cameraToggleText: { color: palette.sage, fontSize: 9, fontWeight: '700' },
  cameraError: { color: palette.error, fontSize: 8, textAlign: 'center', marginBottom: spacing.xs },
  repCount: { color: palette.sage, fontSize: 12, fontWeight: '700', textAlign: 'center', marginBottom: spacing.sm },
  repControls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  repAdjustButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 18, backgroundColor: palette.sagePale },
  repAdjustText: { color: palette.sage, fontSize: 20, fontWeight: '700' },
  repAddButton: { minHeight: 36, paddingHorizontal: spacing.md },
  validateButton: { width: '100%', marginBottom: spacing.sm },
  validateButtonLandscape: { width: 190, minHeight: 32, alignSelf: 'center', marginBottom: spacing.xs },
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
