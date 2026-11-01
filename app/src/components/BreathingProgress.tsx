import React, { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { spacing, type AppColors } from '@/theme/colors';
import { useAppTheme } from '@/theme/ThemeProvider';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export function BreathingProgress({
  progress,
  isActive,
  complete,
  size = 150,
  align = 'center',
}: {
  progress: number;
  isActive: boolean;
  complete: boolean;
  size?: number;
  align?: 'center' | 'left';
}) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const [fillProgress] = useState(() => new Animated.Value(progress));
  const [breath] = useState(() => new Animated.Value(1));
  const strokeWidth = Math.max(9, size * 0.12);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  useEffect(() => {
    const fillAnimation = Animated.timing(fillProgress, {
      toValue: progress,
      duration: 900,
      easing: Easing.inOut(Easing.ease),
      useNativeDriver: false,
    });
    fillAnimation.start();
    return () => fillAnimation.stop();
  }, [fillProgress, progress]);

  useEffect(() => {
    if (!isActive || complete) {
      Animated.timing(breath, {
        toValue: 1,
        duration: 700,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }).start();
      return;
    }

    const breathing = Animated.loop(Animated.sequence([
      Animated.timing(breath, {
        toValue: 1.08,
        duration: 3_500,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(breath, {
        toValue: 0.96,
        duration: 3_500,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }),
    ]));
    breathing.start();
    return () => breathing.stop();
  }, [breath, complete, isActive]);

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={complete ? 'Séance terminée' : 'Progression douce de la séance'}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }}
      style={[styles.container, align === 'left' && styles.containerLeft]}>
      <View
        style={[
          styles.ring,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
          },
        ]}>
        <Svg width={size} height={size}>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="transparent"
            stroke={withAlpha(colors.sagePale, 0.72)}
            strokeWidth={strokeWidth}
          />
          <AnimatedCircle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="transparent"
            stroke={colors.sage}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={fillProgress.interpolate({
              inputRange: [0, 1],
              outputRange: [circumference, 0],
            })}
            rotation="-90"
            origin={`${size / 2}, ${size / 2}`}
          />
        </Svg>
        <Animated.View style={[styles.center, { transform: [{ scale: breath }] }]}>
          <Text style={styles.percentage}>{Math.round(progress * 100)}%</Text>
          <Text style={styles.caption}>{complete ? 'Terminé' : 'Accompli'}</Text>
        </Animated.View>
      </View>
    </View>
  );
}

const createStyles = (palette: AppColors) => StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.md },
  containerLeft: { alignItems: 'flex-start' },
  ring: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  center: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  percentage: { color: palette.textPrimary, fontSize: 21, fontVariant: ['tabular-nums'], fontWeight: '700' },
  caption: { color: palette.textSecondary, fontSize: 9, fontWeight: '600', marginTop: 2 },
});

function withAlpha(hexColor: string, alpha: number) {
  const color = hexColor.replace('#', '');
  const red = Number.parseInt(color.slice(0, 2), 16);
  const green = Number.parseInt(color.slice(2, 4), 16);
  const blue = Number.parseInt(color.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}
