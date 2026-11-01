import { Platform } from 'react-native';

const roundedFont = Platform.select({
  ios: 'Avenir Next',
  android: 'sans-serif-rounded',
  web: 'Avenir Next, system-ui, sans-serif',
  default: 'System',
}) ?? 'System';

export const typography = {
  fonts: {
    regular: 'System',
    bold: 'System',
    italic: 'System',
    display: roundedFont,
  },
  sizes: {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 20,
    xl: 24,
    xxl: 32,
  },
  weights: {
    light: '300',
    regular: '400',
    medium: '500',
    bold: '700',
  },
} as const;
