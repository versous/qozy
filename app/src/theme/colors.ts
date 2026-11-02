export const lightColors = {
  background: '#F7F4EC',
  surface: '#FFFCF6',
  primary: '#65795F',
  secondary: '#E8BFA8',
  accent: '#E6EDDF',
  textPrimary: '#41473C',
  textSecondary: '#858477',
  textLight: '#B8B4A7',
  sage: '#65795F',
  sageLight: '#E8EDDF',
  sagePale: '#EAF0E3',
  peach: '#F0DDD0',
  peachLight: '#F7E9DE',
  clay: '#B97C61',
  border: '#EEE9DE',
  error: '#E57373',
  success: '#81C784',
  warning: '#FFB74D',
};

export const darkColors = {
  background: '#171A16',
  surface: '#222720',
  primary: '#A8BB9D',
  secondary: '#B77F64',
  accent: '#303A2F',
  textPrimary: '#F0EEE6',
  textSecondary: '#B4B5A9',
  textLight: '#85897D',
  sage: '#A8BB9D',
  sageLight: '#344033',
  sagePale: '#293229',
  peach: '#3A2D27',
  peachLight: '#342820',
  clay: '#D49A7D',
  border: '#363C33',
  error: '#F08D8D',
  success: '#91C99B',
  warning: '#E8B66C',
};

export type AppColors = typeof lightColors;

export const colors = lightColors;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export const borderRadius = {
  small: 12,
  medium: 18,
  large: 24,
  extraLarge: 32, // Pour l'aspect très arrondi et organique
};
