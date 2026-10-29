import React from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { BottomNavigation } from '@/components/BottomNavigation';
import { CosyButton } from '@/components/common/CosyButton';
import { Exercise, useExercises } from '@/hooks/useExercises';
import { borderRadius, colors, spacing } from '@/theme/colors';

export default function MovementScreen() {
  const { exercises, today, loading, error, toggleCompleted } = useExercises();
  const todaysExercises = exercises.filter((exercise) => exercise.selectedDate === today);
  const completed = todaysExercises.filter((exercise) => exercise.completedDate === today).length;
  const nextExercise = todaysExercises.find((exercise) => exercise.completedDate !== today);
  const formatDate = new Date().toLocaleDateString('fr-FR', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  }).toLocaleUpperCase('fr-FR');

  const handleToggle = async (exercise: Exercise) => {
    try {
      await toggleCompleted(exercise.id);
    } catch (reason) {
      Alert.alert(
        'Mise à jour impossible',
        reason instanceof Error ? reason.message : 'Réessaie plus tard.'
      );
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={styles.back}>
          <Text style={styles.backText}>‹  Mes petits pas</Text>
        </Pressable>
        <View style={styles.brandLine}>
          <Text style={styles.brand}>nid</Text>
          <Text style={styles.brandCaption}>À VOTRE RYTHME</Text>
        </View>
        <Text style={styles.eyebrow}>AUJOURD’HUI · {formatDate}</Text>
        <Text style={styles.title}>Exercice</Text>
        <Text style={styles.subtitle}>Bouger un peu, se faire du bien.</Text>

        <View style={styles.hero}>
          <Image
            source={require('@/assets/images/exercise-room.jpg')}
            resizeMode="cover"
            style={styles.heroImage}
            accessibilityLabel="Un moment calme pour bouger à la maison"
          />
          <View style={styles.heroScrim} />
          <View style={styles.heroCopy}>
            <Text style={styles.heroTitle}>Un moment pour toi</Text>
            <Text style={styles.heroSubtitle}>On bouge ensemble, à ton rythme.</Text>
            <Text style={styles.lofi}>♫  AMBIANCE LOFI</Text>
          </View>
        </View>

        <View style={styles.progressCard}>
          <View style={styles.progressHeading}>
            <Text style={styles.progressTitle}>
              {completed ? `Déjà ${completed} exercice${completed > 1 ? 's' : ''} réalisé${completed > 1 ? 's' : ''}, bravo !` : 'Mon mouvement du jour'}
            </Text>
            <Text style={styles.progressDate}>{formatDate}</Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: todaysExercises.length ? `${(completed / todaysExercises.length) * 100}%` : '0%' }]} />
          </View>
          <Text style={styles.progressCount}>{completed} / {todaysExercises.length || 3}</Text>
        </View>

        <View style={styles.sectionHeading}>
          <Text style={styles.sectionTitle}>Ma routine du jour</Text>
          <Text style={styles.sectionCount}>{todaysExercises.length} exercice{todaysExercises.length > 1 ? 's' : ''}</Text>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {todaysExercises.map((exercise) => {
          const isDone = exercise.completedDate === today;
          return (
            <Pressable
              key={exercise.id}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: isDone }}
              onPress={() => void handleToggle(exercise)}
              style={styles.exerciseCard}>
              <View style={[styles.checkbox, isDone && styles.checkboxDone]}>
                {isDone ? <Text style={styles.checkmark}>✓</Text> : null}
              </View>
              <View style={styles.exerciseCopy}>
                <Text style={[styles.exerciseName, isDone && styles.exerciseNameDone]}>{exercise.name}</Text>
                <Text style={styles.exerciseMeta}>
                  {exercise.duration} min · {exercise.intensity} · {isDone ? 'Terminé' : exercise.equipment}
                </Text>
              </View>
              <Text style={styles.arrow}>›</Text>
            </Pressable>
          );
        })}

        {!loading && !todaysExercises.length ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Ta routine commence ici</Text>
            <Text style={styles.emptyText}>Choisis un mouvement simple, juste pour aujourd’hui.</Text>
          </View>
        ) : null}

        {nextExercise ? (
          <CosyButton
            title={`▷  Faire mon prochain exercice · ${nextExercise.duration} min`}
            onPress={() => router.push({
              pathname: '/focus',
              params: { activity: nextExercise.name, minutes: String(nextExercise.duration) },
            })}
            style={styles.primaryButton}
          />
        ) : null}

        <View style={styles.actions}>
          <Pressable onPress={() => router.push({ pathname: '/exercise', params: { mode: 'create' } })} style={styles.secondaryButton}>
            <Text style={styles.secondaryIcon}>＋</Text>
            <Text style={styles.secondaryText}>Créer mon exercice</Text>
          </Pressable>
          <Pressable onPress={() => router.push('/exercise')} style={styles.secondaryButton}>
            <Text style={styles.secondaryIcon}>▦</Text>
            <Text style={styles.secondaryText}>Choisir un exercice</Text>
          </Pressable>
        </View>

        {todaysExercises.length && completed === todaysExercises.length ? (
          <Text style={styles.congrats}>C’est fait, bravo. Chaque pas compte.</Text>
        ) : null}
      </ScrollView>
      <BottomNavigation active="tasks" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.lg },
  back: { alignSelf: 'flex-start', marginBottom: spacing.sm },
  backText: { color: colors.sage, fontSize: 12, fontWeight: '600' },
  brandLine: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm, marginBottom: spacing.md },
  brand: { color: colors.textPrimary, fontSize: 27, fontFamily: 'serif', fontWeight: '700' },
  brandCaption: { color: colors.textSecondary, fontSize: 8, letterSpacing: 1, fontWeight: '600' },
  eyebrow: { color: colors.sage, fontSize: 9, fontWeight: '700', letterSpacing: 0.7 },
  title: { color: colors.textPrimary, fontSize: 26, fontFamily: 'serif', fontWeight: '600', marginTop: 4 },
  subtitle: { color: colors.textSecondary, fontSize: 12, marginTop: 3, marginBottom: spacing.md },
  hero: { height: 138, overflow: 'hidden', borderRadius: borderRadius.medium, marginBottom: spacing.sm, justifyContent: 'center' },
  heroImage: { ...StyleSheet.absoluteFill, width: '100%', height: '100%' },
  heroScrim: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(40,43,34,0.18)' },
  heroCopy: { maxWidth: '62%', padding: spacing.md },
  heroTitle: { color: '#FFFDF7', fontSize: 17, fontFamily: 'serif', fontWeight: '700' },
  heroSubtitle: { color: '#FFFDF7', fontSize: 10, lineHeight: 15, marginTop: 4 },
  lofi: { color: '#FFFDF7', fontSize: 8, fontWeight: '700', letterSpacing: 0.6, marginTop: 6 },
  progressCard: { padding: spacing.sm, backgroundColor: colors.sagePale, borderRadius: borderRadius.small, marginBottom: spacing.md },
  progressHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  progressTitle: { color: colors.sage, fontSize: 11, fontWeight: '700' },
  progressDate: { color: colors.textSecondary, fontSize: 8 },
  progressTrack: { height: 6, overflow: 'hidden', borderRadius: 3, backgroundColor: colors.surface, marginTop: spacing.sm },
  progressFill: { height: '100%', borderRadius: 3, backgroundColor: colors.sage },
  progressCount: { color: colors.textSecondary, fontSize: 8, textAlign: 'right', marginTop: 4 },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  sectionTitle: { color: colors.textPrimary, fontSize: 15, fontFamily: 'serif', fontWeight: '600' },
  sectionCount: { color: colors.textSecondary, fontSize: 9 },
  error: { color: colors.error, fontSize: 10, marginBottom: spacing.sm },
  exerciseCard: { minHeight: 61, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.sm, borderRadius: borderRadius.small, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.xs },
  checkbox: { width: 21, height: 21, borderRadius: 7, borderWidth: 1, borderColor: colors.sage, alignItems: 'center', justifyContent: 'center' },
  checkboxDone: { backgroundColor: colors.sage },
  checkmark: { color: colors.surface, fontSize: 13, fontWeight: '700' },
  exerciseCopy: { flex: 1 },
  exerciseName: { color: colors.textPrimary, fontSize: 11, fontWeight: '600' },
  exerciseNameDone: { color: colors.textSecondary, textDecorationLine: 'line-through' },
  exerciseMeta: { color: colors.textSecondary, fontSize: 8, marginTop: 3 },
  arrow: { color: colors.sage, fontSize: 21 },
  emptyCard: { padding: spacing.md, borderRadius: borderRadius.small, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  emptyTitle: { color: colors.textPrimary, fontSize: 11, fontWeight: '600' },
  emptyText: { color: colors.textSecondary, fontSize: 9, lineHeight: 14, marginTop: 4 },
  primaryButton: { backgroundColor: colors.sage, borderWidth: 0, borderRadius: borderRadius.extraLarge, marginTop: spacing.md },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  secondaryButton: { flex: 1, minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, borderRadius: borderRadius.small, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  secondaryIcon: { color: colors.sage, fontSize: 15 },
  secondaryText: { color: colors.sage, fontSize: 9, fontWeight: '600' },
  congrats: { color: colors.sage, fontSize: 11, fontFamily: 'serif', fontStyle: 'italic', textAlign: 'center', marginTop: spacing.md },
});
