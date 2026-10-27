import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { colors, spacing, borderRadius } from '../../theme/colors';
import { typography } from '../../theme/typography';

interface HabitCardProps {
  title: string;
  streak: number;
  isCompleted: boolean;
  onToggle: () => void;
  icon?: string;
}

export const HabitCard: React.FC<HabitCardProps> = ({
  title,
  streak,
  isCompleted,
  onToggle,
  icon = '🌱'
}) => {
  return (
    <TouchableOpacity
      onPress={onToggle}
      activeOpacity={0.9}
      style={[
        styles.card,
        { backgroundColor: isCompleted ? colors.accent : colors.surface }
      ]}
    >
      <View style={styles.leftSection}>
        <View style={styles.iconContainer}>
          <Text style={styles.iconText}>{icon}</Text>
        </View>
        <View>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.streakText}>🔥 {streak} jours de suite</Text>
        </View>
      </View>

      <TouchableOpacity
        style={[styles.checkbox, isCompleted && styles.checkboxChecked]}
        onPress={onToggle}
      >
        {isCompleted && <Text style={styles.checkMark}>✓</Text>}
      </TouchableOpacity>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderRadius: borderRadius.medium,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  iconText: {
    fontSize: 20,
  },
  title: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.medium,
    color: colors.textPrimary,
  },
  streakText: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
  },
  checkbox: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  checkboxChecked: {
    backgroundColor: colors.primary,
  },
  checkMark: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
