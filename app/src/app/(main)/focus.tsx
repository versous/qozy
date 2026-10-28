import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity } from 'react-native';
import { colors, spacing, borderRadius } from '@/src/theme/colors';
import { typography } from '@/src/theme/typography';
import { CosyButton } from '@/src/components/common/CosyButton';
import { useTimer } from '@/src/hooks/useTimer';
import { router } from 'expo-router';

const PomodoroScreen = () => {
  const { secondsLeft, isActive, startTimer, pauseTimer, resetTimer, formatTime } = useTimer(25);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>← Retour</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.timerContainer}>
        <View style={styles.circle}>
          <Text style={styles.timerText}>{formatTime()}</Text>
          <Text style={styles.timerLabel}>{isActive ? 'Concentration...' : 'Prêt ?'}</Text>
        </View>
      </View>

      <View style={styles.controls}>
        {!isActive ? (
          <CosyButton
            title="Démarrer"
            onPress={startTimer}
            style={styles.mainButton}
          />
        ) : (
          <CosyButton
            title="Pause"
            onPress={pauseTimer}
            variant="outline"
            style={styles.mainButton}
          />
        )}

        <CosyButton
          title="Réinitialiser"
          onPress={resetTimer}
          variant="outline"
          style={styles.resetButton}
        />
      </View>

      <View style={styles.footer}>
        <Text style={styles.tipText}>
          Astuce : Prenez une pause de 5 minutes après chaque session ! ☕
        </Text>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xl,
  },
  header: {
    width: '100%',
    paddingHorizontal: spacing.lg,
    alignItems: 'flex-start',
  },
  backButton: {
    padding: spacing.sm,
  },
  backText: {
    color: colors.textSecondary,
    fontSize: typography.sizes.md,
  },
  timerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  circle: {
    width: 280,
    height: 280,
    borderRadius: 140,
    borderWidth: 10,
    borderColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.surface,
    elevation: 10,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 10 },
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
    marginTop: 8,
  },
  controls: {
    width: '100%',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  mainButton: {
    width: '100%',
    height: 60,
    borderRadius: borderRadius.large,
  },
  resetButton: {
    width: '100%',
    height: 50,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
  },
  tipText: {
    textAlign: 'center',
    color: colors.textSecondary,
    fontSize: typography.sizes.sm,
    fontStyle: 'italic',
  },
});

export default PomodoroScreen;
