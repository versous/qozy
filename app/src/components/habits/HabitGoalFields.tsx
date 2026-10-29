import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import type { HabitGoalType } from '@/hooks/useHabits';
import { borderRadius, spacing, type AppColors } from '@/theme/colors';
import { useAppTheme } from '@/theme/ThemeProvider';

interface HabitGoalFieldsProps {
  type: HabitGoalType;
  target: string;
  unit: string;
  disabled?: boolean;
  onTypeChange: (type: HabitGoalType) => void;
  onTargetChange: (target: string) => void;
  onUnitChange: (unit: string) => void;
}

const goalTypes: { value: HabitGoalType; label: string }[] = [
  { value: 'check', label: 'Simple' },
  { value: 'count', label: 'Quantité' },
  { value: 'timer', label: 'Chrono' },
];

export function HabitGoalFields({
  type,
  target,
  unit,
  disabled = false,
  onTypeChange,
  onTargetChange,
  onUnitChange,
}: HabitGoalFieldsProps) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Comment veux-tu suivre cet objectif ?</Text>
      <View style={styles.options}>
        {goalTypes.map((option) => {
          const selected = type === option.value;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected, disabled }}
              disabled={disabled}
              onPress={() => onTypeChange(option.value)}
              style={[styles.option, selected && styles.optionSelected]}>
              <Text style={[styles.optionText, selected && styles.optionTextSelected]}>{option.label}</Text>
            </Pressable>
          );
        })}
      </View>
      {type !== 'check' ? (
        <View style={styles.goalRow}>
          <TextInput
            accessibilityLabel={type === 'timer' ? 'Objectif en minutes' : 'Objectif en quantité'}
            editable={!disabled}
            keyboardType="number-pad"
            maxLength={5}
            onChangeText={onTargetChange}
            placeholder={type === 'timer' ? '15' : '20'}
            placeholderTextColor={colors.textLight}
            style={[styles.input, styles.targetInput]}
            value={target}
          />
          {type === 'timer' ? (
            <Text style={styles.unit}>minutes · chronomètre intégré</Text>
          ) : (
            <TextInput
              accessibilityLabel="Unité de l’objectif"
              editable={!disabled}
              maxLength={24}
              onChangeText={onUnitChange}
              placeholder="pages"
              placeholderTextColor={colors.textLight}
              style={[styles.input, styles.unitInput]}
              value={unit}
            />
          )}
        </View>
      ) : null}
    </View>
  );
}

const createStyles = (palette: AppColors) => StyleSheet.create({
  container: { marginBottom: spacing.md },
  label: { color: palette.textSecondary, fontSize: 10, fontWeight: '600', marginBottom: spacing.xs },
  options: { flexDirection: 'row', gap: spacing.xs },
  option: { flex: 1, minHeight: 34, alignItems: 'center', justifyContent: 'center', borderRadius: borderRadius.extraLarge, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border },
  optionSelected: { backgroundColor: palette.sagePale, borderColor: palette.sage },
  optionText: { color: palette.textSecondary, fontSize: 10, fontWeight: '600' },
  optionTextSelected: { color: palette.sage },
  goalRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
  input: { minHeight: 42, borderRadius: borderRadius.small, paddingHorizontal: spacing.sm, backgroundColor: palette.surface, color: palette.textPrimary, borderWidth: 1, borderColor: palette.border, fontSize: 12 },
  targetInput: { width: 72, textAlign: 'center' },
  unitInput: { flex: 1 },
  unit: { color: palette.textSecondary, fontSize: 10 },
});
