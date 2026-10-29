import { Pressable, StyleSheet, Text, View } from 'react-native';

import { borderRadius, spacing, type AppColors } from '@/theme/colors';
import { useAppTheme } from '@/theme/ThemeProvider';
import { type HabitDay } from '@/hooks/useHabits';

const days: { value: HabitDay; label: string; accessibilityLabel: string }[] = [
  { value: 1, label: 'L', accessibilityLabel: 'Lundi' },
  { value: 2, label: 'M', accessibilityLabel: 'Mardi' },
  { value: 3, label: 'M', accessibilityLabel: 'Mercredi' },
  { value: 4, label: 'J', accessibilityLabel: 'Jeudi' },
  { value: 5, label: 'V', accessibilityLabel: 'Vendredi' },
  { value: 6, label: 'S', accessibilityLabel: 'Samedi' },
  { value: 0, label: 'D', accessibilityLabel: 'Dimanche' },
];

export function WeekdaySelector({
  selectedDays,
  onChange,
  disabled = false,
}: {
  selectedDays: HabitDay[];
  onChange: (days: HabitDay[]) => void;
  disabled?: boolean;
}) {
  const colors = useAppTheme().colors;
  const styles = createStyles(colors);
  const allSelected = selectedDays.length === days.length;

  const toggleDay = (day: HabitDay) => {
    const nextDays = selectedDays.includes(day)
      ? selectedDays.filter((selectedDay) => selectedDay !== day)
      : [...selectedDays, day];
    onChange(nextDays);
  };

  return (
    <View style={styles.container}>
      <View style={styles.heading}>
        <Text style={styles.label}>Répéter</Text>
        {allSelected ? (
          <Text style={styles.everyday}>Quotidienne</Text>
        ) : (
          <Pressable
            accessibilityRole="button"
            onPress={() => onChange(days.map((day) => day.value))}
            disabled={disabled}
            hitSlop={6}>
            <Text style={styles.everyday}>Tous les jours</Text>
          </Pressable>
        )}
      </View>
      <View style={styles.days}>
        {days.map((day) => {
          const selected = selectedDays.includes(day.value);
          return (
            <Pressable
              key={day.value}
              accessibilityRole="checkbox"
              accessibilityLabel={day.accessibilityLabel}
              accessibilityState={{ checked: selected, disabled }}
              onPress={() => toggleDay(day.value)}
              disabled={disabled}
              style={[styles.day, selected && styles.daySelected, disabled && styles.dayDisabled]}>
              <Text style={[styles.dayText, selected && styles.dayTextSelected]}>
                {day.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={styles.hint}>
        {selectedDays.length
          ? selectedDays.length === days.length
            ? 'Prévue chaque jour'
            : `${selectedDays.length} jour${selectedDays.length > 1 ? 's' : ''} par semaine`
          : 'Choisis au moins un jour'}
      </Text>
    </View>
  );
}

const createStyles = (palette: AppColors) => StyleSheet.create({
  container: {
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  heading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: {
    color: palette.textPrimary,
    fontSize: 11,
    fontWeight: '600',
  },
  everyday: {
    color: palette.sage,
    fontSize: 10,
    fontWeight: '600',
  },
  days: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.xs,
  },
  day: {
    flex: 1,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.extraLarge,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
  },
  daySelected: {
    backgroundColor: palette.sage,
    borderColor: palette.sage,
  },
  dayDisabled: {
    opacity: 0.6,
  },
  dayText: {
    color: palette.textSecondary,
    fontSize: 10,
    fontWeight: '600',
  },
  dayTextSelected: {
    color: palette.surface,
  },
  hint: {
    color: palette.textSecondary,
    fontSize: 9,
  },
});
