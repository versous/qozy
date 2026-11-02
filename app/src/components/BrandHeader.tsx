import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import type { ReactNode } from 'react';

import { spacing, type AppColors } from '@/theme/colors';
import { useAppTheme } from '@/theme/ThemeProvider';
import { typography } from '@/theme/typography';

export function BrandHeader({ trailing }: { trailing?: ReactNode }) {
  const colors = useAppTheme().colors;
  const styles = createStyles(colors);

  return (
    <View style={styles.container}>
      <View style={styles.brand}>
        <Svg width={17} height={19} viewBox="0 0 17 19" accessibilityLabel="Pousse">
          <Path
            d="M8.5 17.5V9.4M8.5 12.2C5.7 12.2 3.6 10.1 3.6 7.3c2.8 0 4.9 2.1 4.9 4.9ZM8.5 9.7c0-2.8 2.1-4.9 4.9-4.9 0 2.8-2.1 4.9-4.9 4.9ZM8.5 8.2C6.5 8.2 5 6.7 5 4.7c2 0 3.5 1.5 3.5 3.5Z"
            fill="none"
            stroke={colors.sage}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.4}
          />
        </Svg>
        <Text style={styles.wordmark}>nid</Text>
        <Text style={styles.tagline}>À VOTRE RYTHME</Text>
      </View>
      {trailing}
    </View>
  );
}

const createStyles = (palette: AppColors) => StyleSheet.create({
  container: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  wordmark: {
    color: palette.textPrimary,
    fontSize: 22,
    lineHeight: 27,
    fontFamily: typography.fonts.display,
    fontWeight: '700',
  },
  tagline: {
    color: palette.textSecondary,
    fontSize: 7,
    letterSpacing: 0.8,
    fontWeight: '600',
    marginLeft: 2,
  },
});
