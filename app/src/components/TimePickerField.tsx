import { typography } from '@/theme/typography';
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { borderRadius, spacing, type AppColors } from '@/theme/colors';
import { useAppTheme } from '@/theme/ThemeProvider';

const hours = Array.from({ length: 12 }, (_, index) => String(index + 8).padStart(2, '0'));
const minutes = ['00', '30'];

export function TimePickerField({
  value,
  onChange,
  disabled = false,
}: {
  value: string | null;
  onChange: (value: string | null) => void;
  disabled?: boolean;
}) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedHour, selectedMinute] = value?.split(':') ?? ['09', '00'];

  return (
    <View style={styles.container}>
      <View style={styles.field}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={value ? `Heure choisie : ${value}` : 'Choisir une heure'}
          accessibilityState={{ disabled }}
          disabled={disabled}
          onPress={() => setIsOpen((open) => !open)}
          style={styles.fieldAction}>
          <Text style={styles.icon}>◷</Text>
          <Text style={[styles.fieldText, !value && styles.placeholder]}>
            {value ?? 'Choisir une heure (facultatif)'}
          </Text>
          <Text style={styles.arrow}>{isOpen ? '⌃' : '›'}</Text>
        </Pressable>
        {value ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Retirer l’heure"
            disabled={disabled}
            onPress={() => {
              onChange(null);
              setIsOpen(false);
            }}
            hitSlop={8}
            style={styles.clearButton}>
            <Text style={styles.clearText}>×</Text>
          </Pressable>
        ) : null}
      </View>
      {isOpen ? (
        <View style={styles.picker}>
          <Text style={styles.label}>Heure</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.options}>
            {hours.map((hour) => (
              <Pressable
                key={hour}
                accessibilityRole="button"
                accessibilityState={{ selected: hour === selectedHour }}
                onPress={() => onChange(`${hour}:${selectedMinute}`)}
                style={[styles.option, hour === selectedHour && styles.optionSelected]}>
                <Text style={[styles.optionText, hour === selectedHour && styles.optionTextSelected]}>{hour}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <Text style={styles.label}>Minutes</Text>
          <View style={styles.minuteOptions}>
            {minutes.map((minute) => (
              <Pressable
                key={minute}
                accessibilityRole="button"
                accessibilityState={{ selected: minute === selectedMinute }}
                onPress={() => onChange(`${selectedHour}:${minute}`)}
                style={[styles.option, styles.minuteOption, minute === selectedMinute && styles.optionSelected]}>
                <Text style={[styles.optionText, minute === selectedMinute && styles.optionTextSelected]}>{minute}</Text>
              </Pressable>
            ))}
          </View>
          <Pressable onPress={() => setIsOpen(false)} style={styles.done}>
            <Text style={styles.doneText}>Valider l’heure</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const createStyles = (palette: AppColors) => StyleSheet.create({
  container: { marginTop: spacing.sm },
  field: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, borderRadius: borderRadius.medium, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.surface },
  fieldAction: { flex: 1, minHeight: 46, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  icon: { color: palette.sage, fontSize: 17 },
  fieldText: { flex: 1, color: palette.textPrimary, fontSize: 11 },
  placeholder: { color: palette.textLight },
  arrow: { color: palette.sage, fontSize: 19 },
  clearButton: { width: 28, height: 32, alignItems: 'center', justifyContent: 'center' },
  clearText: { color: palette.textSecondary, fontSize: 22 },
  picker: { padding: spacing.sm, marginTop: spacing.xs, borderRadius: borderRadius.medium, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border },
  label: { color: palette.textSecondary, fontSize: 9, fontWeight: '700', marginBottom: spacing.xs },
  options: { gap: spacing.xs, paddingVertical: 2 },
  option: { minWidth: 38, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: borderRadius.extraLarge, backgroundColor: palette.sagePale },
  optionSelected: { backgroundColor: palette.sage },
  optionText: { color: palette.sage, fontSize: 10, fontWeight: '600' },
  optionTextSelected: { color: palette.surface },
  minuteOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  minuteOption: { flex: 1, minWidth: 38 },
  done: { alignSelf: 'flex-end', paddingHorizontal: spacing.md, paddingVertical: spacing.xs, marginTop: spacing.sm, borderRadius: borderRadius.extraLarge, backgroundColor: palette.sage },
  doneText: { color: palette.surface, fontSize: 10, fontFamily: typography.fonts.display, fontWeight: '600' },
});
