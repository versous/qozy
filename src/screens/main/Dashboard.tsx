import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView, ActivityIndicator, Modal } from 'react-native';
import { colors, spacing, borderRadius } from '../theme/colors';
import { typography } from '../theme/typography';
import { CosyButton } from '../components/common/CosyButton';
import { HabitCard } from '../components/habits/HabitCard';
import { useHabits } from '../hooks/useHabits';
import { TextInput } from 'react-native';

const Dashboard = () => {
  const { habits, loading, addHabit, toggleHabit } = useHabits();
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [newHabitTitle, setNewHabitTitle] = useState('');

  const handleAddHabit = () => {
    if (newHabitTitle.trim()) {
      addHabit(newHabitTitle);
      setNewHabitTitle('');
      setIsModalVisible(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Chargement de votre espace cosy...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>

        {/* Header Section */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Bonjour, Marc ! ✨</Text>
            <Text style={styles.subtitle}>Prêt pour une journée cosy ?</Text>
          </View>
          <View style={styles.profileCircle} />
        </View>

        {/* Focus Card */}
        <View style={styles.focusCard}>
          <View>
            <Text style={styles.focusTitle}>Session Focus</Text>
            <Text style={styles.focusSubtitle}>25 minutes de concentration</Text>
          </View>
          <CosyButton
            title="Lancer"
            onPress={() => {}}
            style={styles.focusButton}
          />
        </View>

        {/* Habits Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Mes Habitudes</Text>
          {habits.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>Aucune habitude pour le moment. {'\n'}Commencez par en ajouter une ! 🌱</Text>
            </View>
          ) : (
            habits.map(habit => (
              <HabitCard
                key={habit.id}
                title={habit.title}
                streak={habit.streak}
                isCompleted={habit.isCompleted}
                icon={habit.icon}
                onToggle={() => toggleHabit(habit.id, habit.isCompleted)}
              />
            ))
          )}

          <CosyButton
            title="+ Ajouter une habitude"
            variant="outline"
            onPress={() => setIsModalVisible(true)}
            style={styles.addButton}
          />
        </View>

        {/* Modal Ajout Habitude */}
        <Modal visible={isModalVisible} animationType="slide" transparent={true}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Nouvelle Habitude</Text>
              <TextInput
                style={styles.input}
                placeholder="Ex: Méditation, Lecture..."
                value={newHabitTitle}
                onChangeText={setNewHabitTitle}
                autoFocus
              />
              <View style={styles.modalButtons}>
                <CosyButton title="Annuler" variant="outline" onPress={() => setIsModalVisible(false)} style={{flex: 1, marginRight: 10}} />
                <CosyButton title="Ajouter" onPress={handleAddHabit} style={{flex: 1}} />
              </View>
            </View>
          </View>
        </Modal>

      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centered: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: spacing.sm,
    color: colors.textSecondary,
    fontSize: typography.sizes.sm,
  },
  scrollContent: {
    padding: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xl,
    marginTop: spacing.md,
  },
  greeting: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    marginTop: 4,
  },
  profileCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.secondary,
    borderWidth: 2,
    borderColor: '#FFF',
  },
  focusCard: {
    backgroundColor: colors.primary,
    padding: spacing.lg,
    borderRadius: borderRadius.large,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xl,
    elevation: 4,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  focusTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: '#FFF',
  },
  focusSubtitle: {
    fontSize: typography.sizes.sm,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },
  focusButton: {
    backgroundColor: '#FFF',
  },
  section: {
    marginTop: spacing.md,
  },
  sectionTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.medium,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  addButton: {
    marginTop: spacing.md,
    borderStyle: 'dashed',
  },
  emptyState: {
    alignItems: 'center',
    padding: spacing.xl,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.medium,
    marginBottom: spacing.md,
  },
  emptyText: {
    textAlign: 'center',
    color: colors.textSecondary,
    fontSize: typography.sizes.sm,
    lineHeight: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modalContent: {
    backgroundColor: colors.background,
    width: '100%',
    borderRadius: borderRadius.large,
    padding: spacing.lg,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  input: {
    width: '100%',
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: borderRadius.medium,
    marginBottom: spacing.lg,
    fontSize: typography.sizes.md,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  modalButtons: {
    flexDirection: 'row',
    width: '100%',
  },
});

export default Dashboard;
