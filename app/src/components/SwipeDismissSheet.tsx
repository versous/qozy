import React, { useEffect, useMemo, useState } from 'react';
import {
  Animated,
  PanResponder,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { borderRadius, spacing, type AppColors } from '@/theme/colors';
import { useAppTheme } from '@/theme/ThemeProvider';

interface SwipeDismissSheetProps extends React.PropsWithChildren {
  onDismiss: () => void;
  visible: boolean;
  style?: StyleProp<ViewStyle>;
}

export function SwipeDismissSheet({ children, onDismiss, visible, style }: SwipeDismissSheetProps) {
  const { colors } = useAppTheme();
  const { height } = useWindowDimensions();
  const styles = createStyles(colors);
  const [dragY] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (visible) dragY.setValue(0);
  }, [dragY, visible]);

  const panResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_event, gesture) =>
      gesture.dy > 6 && gesture.dy > Math.abs(gesture.dx),
    onPanResponderTerminationRequest: () => false,
    onPanResponderMove: (_event, gesture) => dragY.setValue(Math.max(0, gesture.dy)),
    onPanResponderRelease: (_event, gesture) => {
      if (gesture.dy > 70 || gesture.vy > 0.8) {
        Animated.timing(dragY, {
          toValue: height,
          duration: 180,
          useNativeDriver: true,
        }).start(({ finished }) => {
          if (!finished) return;
          onDismiss();
        });
        return;
      }

      Animated.spring(dragY, {
        toValue: 0,
        useNativeDriver: true,
      }).start();
    },
    onPanResponderTerminate: () => {
      Animated.spring(dragY, {
        toValue: 0,
        useNativeDriver: true,
      }).start();
    },
  }), [dragY, height, onDismiss]);

  return (
    <Animated.View
      style={[styles.sheet, style, { transform: [{ translateY: dragY }] }]}>
      <View
        accessibilityRole="button"
        accessibilityLabel="Fermer en faisant glisser vers le bas"
        accessibilityHint="Fais glisser le panneau vers le bas pour le fermer."
        {...panResponder.panHandlers}
        style={styles.handleTarget}>
        <View style={styles.handle} />
        <Text style={styles.hint}>Glisse vers le bas pour fermer</Text>
      </View>
      {children}
    </Animated.View>
  );
}

const createStyles = (palette: AppColors) => StyleSheet.create({
  sheet: {
    maxHeight: '92%',
    overflow: 'hidden',
  },
  handleTarget: {
    minHeight: 38,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  handle: {
    width: 38,
    height: 4,
    borderRadius: borderRadius.extraLarge,
    backgroundColor: palette.border,
  },
  hint: {
    color: palette.textSecondary,
    fontSize: 8,
    marginTop: 5,
  },
});
