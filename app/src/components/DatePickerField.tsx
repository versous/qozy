import React, { useCallback, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SwipeDismissSheet } from '@/components/SwipeDismissSheet';
import { borderRadius, spacing, type AppColors } from '@/theme/colors';
import { useAppTheme } from '@/theme/ThemeProvider';

const weekdays = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

function getDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function parseDate(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function formatDate(value: string) {
  return parseDate(value).toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function getMonthCells(month: Date) {
  const offset = (new Date(month.getFullYear(), month.getMonth(), 1).getDay() + 6) % 7;
  const numberOfDays = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  return Array.from({ length: 42 }, (_, index) => {
    const day = index - offset + 1;
    return day > 0 && day <= numberOfDays
      ? new Date(month.getFullYear(), month.getMonth(), day)
      : null;
  });
}

export function DatePickerField({
  value,
  onChange,
  disabled = false,
  placeholder = 'Choisir une date',
}: {
  value: string | null;
  onChange: (value: string | null) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const [isOpen, setIsOpen] = useState(false);
  const [month, setMonth] = useState(() => value
    ? new Date(parseDate(value).getFullYear(), parseDate(value).getMonth(), 1)
    : new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const dismissDatePicker = useCallback(() => setIsOpen(false), []);
  const cells = getMonthCells(month);
  const today = getDateKey(new Date());
  const monthLabel = month.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

  const shiftMonth = (amount: number) => {
    setMonth((current) => new Date(current.getFullYear(), current.getMonth() + amount, 1));
  };

  const selectDate = (date: Date) => {
    onChange(getDateKey(date));
    setIsOpen(false);
  };

  return (
    <>
      <View style={[styles.field, disabled && styles.disabled]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={value ? `Date choisie : ${formatDate(value)}` : placeholder}
          accessibilityState={{ disabled }}
          disabled={disabled}
          onPress={() => {
            if (value) {
              const selected = parseDate(value);
              setMonth(new Date(selected.getFullYear(), selected.getMonth(), 1));
            }
            setIsOpen(true);
          }}
          style={styles.fieldAction}>
          <Text style={styles.fieldIcon}>▦</Text>
          <Text style={[styles.fieldText, !value && styles.placeholder]}>
            {value ? formatDate(value) : placeholder}
          </Text>
          {!value ? <Text style={styles.fieldArrow}>›</Text> : null}
        </Pressable>
        {value ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Retirer la date"
            disabled={disabled}
            hitSlop={8}
            onPress={() => onChange(null)}
            style={styles.clearButton}>
            <Text style={styles.clearText}>×</Text>
          </Pressable>
        ) : null}
      </View>

      <Modal
        visible={isOpen}
        transparent
        animationType="none"
        onRequestClose={dismissDatePicker}>
        <SafeAreaView style={styles.modalBackdrop}>
          <SwipeDismissSheet visible={isOpen} onDismiss={dismissDatePicker} style={styles.modal}>
            <Text style={styles.modalEyebrow}>À TON RYTHME</Text>
            <Text style={styles.modalTitle}>Choisir un jour</Text>
            <View style={styles.monthHeader}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Mois précédent"
                onPress={() => shiftMonth(-1)}
                style={styles.monthArrow}>
                <Text style={styles.monthArrowText}>‹</Text>
              </Pressable>
              <Text style={styles.monthTitle}>{monthLabel}</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Mois suivant"
                onPress={() => shiftMonth(1)}
                style={styles.monthArrow}>
                <Text style={styles.monthArrowText}>›</Text>
              </Pressable>
            </View>
            <View style={styles.weekdays}>
              {weekdays.map((day, index) => (
                <Text key={`${day}-${index}`} style={styles.weekday}>{day}</Text>
              ))}
            </View>
            <View style={styles.days}>
              {cells.map((date, index) => {
                if (!date) return <View key={`empty-${index}`} style={styles.day} />;
                const dateKey = getDateKey(date);
                const selected = dateKey === value;
                const isToday = dateKey === today;
                return (
                  <Pressable
                    key={dateKey}
                    accessibilityRole="button"
                    accessibilityLabel={formatDate(dateKey)}
                    accessibilityState={{ selected }}
                    onPress={() => selectDate(date)}
                    style={[styles.day, selected && styles.daySelected]}>
                    <Text style={[
                      styles.dayText,
                      isToday && styles.dayToday,
                      selected && styles.dayTextSelected,
                    ]}>
                      {date.getDate()}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
                selectDate(new Date());
              }}
              style={styles.todayButton}>
              <Text style={styles.todayText}>Choisir aujourd’hui</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => setIsOpen(false)}
              style={styles.cancelButton}>
              <Text style={styles.cancelText}>Fermer</Text>
            </Pressable>
          </SwipeDismissSheet>
        </SafeAreaView>
      </Modal>
    </>
  );
}

const createStyles = (palette: AppColors) => StyleSheet.create({
  field: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, borderRadius: borderRadius.medium, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.surface },
  fieldAction: { flex: 1, minHeight: 46, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  disabled: { opacity: 0.55 },
  fieldIcon: { color: palette.sage, fontSize: 16 },
  fieldText: { flex: 1, color: palette.textPrimary, fontSize: 11 },
  placeholder: { color: palette.textLight },
  fieldArrow: { color: palette.sage, fontSize: 20 },
  clearButton: { width: 28, height: 32, alignItems: 'center', justifyContent: 'center' },
  clearText: { color: palette.textSecondary, fontSize: 22 },
  modalBackdrop: { flex: 1, justifyContent: 'center', padding: spacing.md, backgroundColor: 'rgba(0,0,0,0.42)' },
  modal: { padding: spacing.md, borderRadius: borderRadius.large, backgroundColor: palette.background, borderWidth: 1, borderColor: palette.border },
  modalEyebrow: { color: palette.sage, fontSize: 8, letterSpacing: 1, fontWeight: '700' },
  modalTitle: { color: palette.textPrimary, fontSize: 20, fontFamily: 'serif', fontWeight: '600', marginTop: 4 },
  monthHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.md },
  monthArrow: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 19, backgroundColor: palette.surface },
  monthArrowText: { color: palette.sage, fontSize: 25, lineHeight: 28 },
  monthTitle: { color: palette.textPrimary, fontSize: 13, fontWeight: '700', textTransform: 'capitalize' },
  weekdays: { flexDirection: 'row', marginTop: spacing.sm },
  weekday: { width: '14.2857%', color: palette.textSecondary, textAlign: 'center', fontSize: 10, fontWeight: '600' },
  days: { flexDirection: 'row', flexWrap: 'wrap', marginTop: spacing.xs },
  day: { width: '14.2857%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: borderRadius.extraLarge },
  daySelected: { backgroundColor: palette.sage },
  dayText: { color: palette.textPrimary, fontSize: 12 },
  dayToday: { color: palette.sage, fontWeight: '700' },
  dayTextSelected: { color: palette.surface, fontWeight: '700' },
  todayButton: { alignSelf: 'center', padding: spacing.sm, marginTop: spacing.xs },
  todayText: { color: palette.sage, fontSize: 11, fontWeight: '700' },
  cancelButton: { minHeight: 42, alignItems: 'center', justifyContent: 'center', borderTopWidth: 1, borderColor: palette.border, marginTop: spacing.xs },
  cancelText: { color: palette.textSecondary, fontSize: 11, fontWeight: '600' },
});
