import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView } from 'react-native';
import { colors, spacing, borderRadius } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { CosyButton } from '../components/common/CosyButton';
import { useTimer } from '../../hooks/useTimer';

const PomodoroScreen = () => {
  const {
    formatTime,
    isActive,
    startTimer,
    pauseTimer,
    resetTimer
  } = useTimer(25, () => {
    alert('Session terminée ! Prenez une pause cosy. ☕');
  });

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>

        {/* Lofi Ambience Header */}
        <View style={styles.ambienceHeader}>
          <Text style={styles.ambienceText}>🎧 Lofi Beats playing...</Text>
          <TouchableOpacity style={styles.audioToggle}>
            <Text style={styles.audioToggleText}>Pause</Text>
          </TouchableOpacity>
        </View>

        {/* Timer Circle */}
        <View style={styles.timerContainer}>
          <View style={styles.timerCircle}>
            <Text style={styles.timerText}>{formatTime()}</Text>
            <Text style={styles.timerLabel}>Concentration</Text>
          </View>
        </View>

        {/* Controls */}
        <View style={styles.controls}>
          {!isActive ? (
            <CosyButton
              title="Commencer"
              onPress={startTimer}
              style={styles.mainButton}
            />
          ) : (
            <CosyButton
              title="Pause"
              onPress={pauseTimer}
              variant="secondary"
              style={styles.mainButton}
            />
          )}

          <TouchableOpacity onPress={resetTimer} style={styles.resetButton}>
            <Text style={styles.resetText}>Réinitialiser</Text>
          </TouchableOpacity>
        </View>

      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  ambienceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.medium,
    alignSelf: 'center',
  },
  ambienceText: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    marginRight: spacing.sm,
  },
  audioToggle: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: 4,
  },
  audioToggleText: {
    fontSize: 10,
    color: '#FFF',
    fontWeight: 'bold',
  },
  timerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerCircle: {
    width: 280,
    height: 280,
    borderRadius: 140,
    borderWidth: 12,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    elevation: 10,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
  },
  timerText: {
    fontSize: 64,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  timerLabel: {
    fontSize: typography.sizes.md,
    color: colors.textSecondary,
    marginTop: -10,
  },
  controls: {
    width: '100%',
    alignItems: 'center',
    gap: spacing.md,
  },
  mainButton: {
    width: '80%',
    height: 60,
  },
  resetButton: {
    marginTop: spacing.md,
  },
  resetText: {
    color: colors.textSecondary,
    fontSize: typography.sizes.sm,
    textDecorationLine: 'underline',
  },
});

export default PomodoroScreen;
