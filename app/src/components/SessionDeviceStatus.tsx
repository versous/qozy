import React, { useEffect, useState } from 'react';
import { addBatteryLevelListener, getBatteryLevelAsync } from 'expo-battery';
import { Animated, StyleSheet, Text, View } from 'react-native';

import { spacing, type AppColors } from '@/theme/colors';
import { useAppTheme } from '@/theme/ThemeProvider';

export function useDeviceStatus() {
  const [now, setNow] = useState(() => new Date());
  const [batteryLevel, setBatteryLevel] = useState<number | null>(null);

  useEffect(() => {
    const clockInterval = setInterval(() => setNow(new Date()), 30_000);
    let active = true;
    void getBatteryLevelAsync().then((level) => {
      if (active && level >= 0) setBatteryLevel(level);
    }).catch((error: unknown) => {
      console.warn('Impossible de lire le niveau de batterie.', error);
    });
    const batterySubscription = addBatteryLevelListener(({ batteryLevel: level }) => {
      if (level >= 0) setBatteryLevel(level);
    });
    return () => {
      active = false;
      clearInterval(clockInterval);
      batterySubscription.remove();
    };
  }, []);

  return {
    time: now.toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }),
    batteryPercent: batteryLevel === null ? null : Math.round(batteryLevel * 100),
  };
}

export function SessionDeviceStatus() {
  const { colors } = useAppTheme();
  const styles = createStatusStyles(colors);
  const { time, batteryPercent } = useDeviceStatus();

  return (
    <View accessibilityLabel={`Heure ${time}${batteryPercent === null ? '' : `, batterie ${batteryPercent} pour cent`}`} style={styles.row}>
      <Text style={styles.value}>{time}</Text>
      {batteryPercent === null ? null : (
        <Text style={styles.value}>▰ {batteryPercent}%</Text>
      )}
    </View>
  );
}

export function AmbientGlow() {
  const [opacity] = useState(() => new Animated.Value(0.12));

  useEffect(() => {
    const pulse = Animated.loop(Animated.sequence([
      Animated.timing(opacity, { toValue: 0.34, duration: 5_000, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0.12, duration: 5_000, useNativeDriver: true }),
    ]));
    pulse.start();
    return () => pulse.stop();
  }, [opacity]);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Animated.View style={[styles.glow, { opacity }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  glow: {
    position: 'absolute',
    top: '12%',
    right: '-20%',
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: '#FFE7B3',
  },
});

const createStatusStyles = (palette: AppColors) => StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 20,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
  },
  value: {
    color: palette.textPrimary,
    fontSize: 13,
    lineHeight: 18,
    fontVariant: ['tabular-nums'],
    fontWeight: '700',
  },
});
