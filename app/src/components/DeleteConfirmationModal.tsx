import { typography } from '@/theme/typography';
import React, { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { borderRadius, spacing, type AppColors } from '@/theme/colors';
import { useAppTheme } from '@/theme/ThemeProvider';

export function DeleteConfirmationModal({
  visible,
  itemName,
  onCancel,
  onConfirm,
}: {
  visible: boolean;
  itemName: string;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
}) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  const confirm = async () => {
    setDeleting(true);
    setError('');
    try {
      await onConfirm();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'La suppression a échoué. Réessaie.');
    } finally {
      setDeleting(false);
    }
  };

  const cancel = () => {
    if (deleting) return;
    setError('');
    onCancel();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => {
        cancel();
      }}>
      <View style={styles.backdrop}>
        <View style={styles.modal}>
          <Text style={styles.eyebrow}>CONFIRMATION</Text>
          <Text style={styles.title}>Supprimer cet élément ?</Text>
          <Text style={styles.itemName}>{itemName}</Text>
          {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              disabled={deleting}
              onPress={cancel}
              style={styles.cancelButton}>
              <Text style={styles.cancelText}>Garder</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={deleting}
              onPress={() => void confirm()}
              style={styles.deleteButton}>
              {deleting
                ? <ActivityIndicator color={colors.surface} />
                : <Text style={styles.deleteText}>Supprimer</Text>}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (palette: AppColors) => StyleSheet.create({
  backdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.md, backgroundColor: 'rgba(42,48,39,0.42)' },
  modal: { width: '100%', maxWidth: 380, padding: spacing.lg, borderRadius: borderRadius.large, backgroundColor: palette.background },
  eyebrow: { color: palette.sage, fontSize: 9, fontWeight: '700', letterSpacing: 1, textAlign: 'center' },
  title: { color: palette.textPrimary, fontSize: 18, fontFamily: typography.fonts.display, fontWeight: '600', textAlign: 'center', marginTop: spacing.xs },
  itemName: { color: palette.textSecondary, fontSize: 11, textAlign: 'center', marginTop: spacing.sm },
  error: { color: palette.error, fontSize: 10, textAlign: 'center', marginTop: spacing.sm },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  cancelButton: { flex: 1, minHeight: 40, alignItems: 'center', justifyContent: 'center', borderRadius: borderRadius.extraLarge, backgroundColor: palette.sagePale },
  cancelText: { color: palette.sage, fontSize: 10, fontWeight: '700' },
  deleteButton: { flex: 1, minHeight: 40, alignItems: 'center', justifyContent: 'center', borderRadius: borderRadius.extraLarge, backgroundColor: palette.clay },
  deleteText: { color: palette.surface, fontSize: 10, fontWeight: '700' },
});
