import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { colors, spacing, borderRadius } from '../../theme/colors';

interface CosyButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline';
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export const CosyButton: React.FC<CosyButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  style,
  textStyle
}) => {

  const getBackgroundColor = () => {
    switch (variant) {
      case 'primary': return colors.primary;
      case 'secondary': return colors.secondary;
      case 'outline': return 'transparent';
      default: return colors.primary;
    }
  };

  const getTextColor = () => {
    switch (variant) {
      case 'outline': return colors.primary;
      default: return '#FFFFFF';
    }
  };

  const getBorderColor = () => {
    if (variant === 'outline') return colors.primary;
    return 'transparent';
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={[
        styles.button,
        { backgroundColor: getBackgroundColor(), borderColor: getBorderColor() },
        style
      ]}
    >
      <Text style={[styles.text, { color: getTextColor() }, textStyle]}>
        {title}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.extraLarge,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    elevation: 2, // Légère ombre pour le relief
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  text: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
});
