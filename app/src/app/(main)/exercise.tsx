import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';

import { BottomNavigation } from '@/components/BottomNavigation';
import { CosyButton } from '@/components/common/CosyButton';
import { Exercise, useExercises } from '@/hooks/useExercises';
import { borderRadius, spacing, type AppColors } from '@/theme/colors';
import { useAppTheme } from '@/theme/ThemeProvider';

type Intensity = 'Douce' | 'Modérée';
type Filter = 'Tous' | 'Doux' | 'Sans matériel';
type Activity = Omit<Exercise, 'id' | 'userId' | 'createdAt' | 'selectedDate' | 'completedDate'>;

const catalog: Activity[] = [
  { name: 'Yoga tout doux', duration: 10, intensity: 'Douce', equipment: 'Sans matériel', note: '' },
  { name: 'Marche tranquille', duration: 15, intensity: 'Douce', equipment: 'En plein air', note: '' },
  { name: 'Mobilité des épaules', duration: 5, intensity: 'Douce', equipment: 'Sans matériel', note: '' },
  { name: 'Renforcement léger', duration: 12, intensity: 'Modérée', equipment: 'Un tapis', note: '' },
  { name: 'Pause étirements', duration: 5, intensity: 'Douce', equipment: 'Sur une chaise', note: '' },
];

const filters: Filter[] = ['Tous', 'Doux', 'Sans matériel'];

export default function ExerciseScreen() {
  const colors = useAppTheme().colors;
  const styles = createStyles(colors);
  const { mode: requestedMode } = useLocalSearchParams<{ mode?: string }>();
  const { exercises, today, loading, error, toggleToday, addCustomExercise } = useExercises();
  const [mode, setMode] = useState<'library' | 'create'>(requestedMode === 'create' ? 'create' : 'library');
  const [filter, setFilter] = useState<Filter>('Tous');
  const [search, setSearch] = useState('');
  const [savingName, setSavingName] = useState('');
  const [saveError, setSaveError] = useState('');
  const [name, setName] = useState('');
  const [duration, setDuration] = useState('15');
  const [intensity, setIntensity] = useState<Intensity>('Douce');
  const [equipment, setEquipment] = useState('Sans matériel');
  const [note, setNote] = useState('');
  const [addNewToToday, setAddNewToToday] = useState(true);

  const customExercises = exercises.filter(
    (exercise) => !catalog.some((item) => item.name === exercise.name)
  );
  const availableExercises = useMemo(
    () => [
      ...catalog,
      ...customExercises.map(({ name, duration, intensity, equipment, note }) => ({
        name,
        duration,
        intensity,
        equipment,
        note,
      })),
    ],
    [customExercises]
  );
  const filteredExercises = availableExercises.filter((exercise) => {
    const matchesSearch = exercise.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase());
    const matchesFilter =
      filter === 'Tous' ||
      (filter === 'Doux' && exercise.intensity === 'Douce') ||
      (filter === 'Sans matériel' && exercise.equipment === 'Sans matériel');
    return matchesSearch && matchesFilter;
  });
  const selectedExercises = exercises.filter((exercise) => exercise.selectedDate === today);
  const selectedDuration = selectedExercises.reduce((total, exercise) => total + exercise.duration, 0);

  const toggleExercise = async (exercise: Activity) => {
    setSavingName(exercise.name);
    setSaveError('');
    try {
      await toggleToday(exercise.name, exercise.duration, exercise.intensity, exercise.equipment);
    } catch (reason) {
      setSaveError(reason instanceof Error ? reason.message : 'Impossible de modifier la routine.');
    } finally {
      setSavingName('');
    }
  };

  const saveCustom = async () => {
    const minutes = Number(duration);
    if (!name.trim()) {
      setSaveError('Donne un nom à ton exercice.');
      return;
    }
    if (!Number.isInteger(minutes) || minutes < 1 || minutes > 180) {
      setSaveError('Choisis une durée entre 1 et 180 minutes.');
      return;
    }

    setSavingName('custom');
    setSaveError('');
    try {
      await addCustomExercise(name, minutes, intensity, equipment.trim() || 'Sans matériel', note, addNewToToday);
      setName('');
      setNote('');
      setMode('library');
    } catch (reason) {
      setSaveError(reason instanceof Error ? reason.message : "Impossible d'enregistrer l'exercice.");
    } finally {
      setSavingName('');
    }
  };

  const formatToday = new Date().toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: 'short' });

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.brandLine}>
          <Text style={styles.brand}>nid</Text>
          <Text style={styles.brandCaption}>À VOTRE RYTHME</Text>
        </View>
        <Pressable onPress={() => router.back()} hitSlop={8} style={styles.back}>
          <Text style={styles.backText}>‹  Aujourd’hui</Text>
        </Pressable>
        <Text style={styles.eyebrow}>AUJOURD’HUI · {formatToday.toLocaleUpperCase('fr-FR')}</Text>
        <Text style={styles.title}>Exercice</Text>
        <Text style={styles.subtitle}>Bouger un peu, se faire du bien.</Text>

        <View style={styles.hero}>
          <Image
            source={require('@/assets/images/exercise-room.jpg')}
            resizeMode="cover"
            style={styles.heroImage}
            accessibilityLabel="Un moment de mouvement doux dans une pièce lumineuse"
          />
          <View style={styles.heroScrim} />
          <View style={styles.heroCopy}>
            <Text style={styles.heroTitle}>Un moment pour toi</Text>
            <Text style={styles.heroSubtitle}>On bouge ensemble, à ton rythme.</Text>
            <Text style={styles.lofi}>♫  AMBIANCE LOFI</Text>
          </View>
        </View>

        <View style={styles.progressCard}>
          <View style={styles.progressMark}><Text style={styles.progressMarkText}>✓</Text></View>
          <View style={styles.progressCopy}>
            <Text style={styles.progressTitle}>
              {selectedExercises.length ? `${selectedExercises.length} exercice${selectedExercises.length > 1 ? 's' : ''} choisi${selectedExercises.length > 1 ? 's' : ''}, bravo !` : 'Ton mouvement du jour'}
            </Text>
            <Text style={styles.progressSubtitle}>{formatToday} · {selectedExercises.length} / 3</Text>
          </View>
          <Text style={styles.progressValue}>{selectedExercises.length}/3</Text>
        </View>

        <View style={styles.segment}>
          <Pressable
            onPress={() => setMode('create')}
            style={[styles.segmentItem, mode === 'create' && styles.segmentSelected]}>
            <Text style={[styles.segmentText, mode === 'create' && styles.segmentTextSelected]}>Créer le mien</Text>
          </Pressable>
          <Pressable
            onPress={() => setMode('library')}
            style={[styles.segmentItem, mode === 'library' && styles.segmentSelected]}>
            <Text style={[styles.segmentText, mode === 'library' && styles.segmentTextSelected]}>Bibliothèque</Text>
          </Pressable>
        </View>

        {mode === 'create' ? (
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>Un exercice à moi</Text>
            <Text style={styles.formSubtitle}>Tes envies, ton mouvement, ton rythme.</Text>
            <Text style={styles.label}>Nom de l’exercice *</Text>
            <TextInput value={name} onChangeText={setName} placeholder="Ma marche du soir" placeholderTextColor={colors.textLight} style={styles.input} maxLength={70} />
            <Text style={styles.label}>Durée *</Text>
            <View style={styles.durationInputRow}>
              <TextInput value={duration} onChangeText={setDuration} keyboardType="number-pad" style={[styles.input, styles.durationInput]} />
              <Text style={styles.inputSuffix}>min</Text>
              <View style={styles.flexSpace} />
              <Text style={styles.label}>Intensité</Text>
              {(['Douce', 'Modérée'] as const).map((value) => (
                <Pressable key={value} onPress={() => setIntensity(value)} style={[styles.intensityChip, intensity === value && styles.intensityChipSelected]}>
                  <Text style={[styles.intensityText, intensity === value && styles.intensityTextSelected]}>{value}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.label}>Matériel</Text>
            <TextInput value={equipment} onChangeText={setEquipment} placeholder="Sans matériel" placeholderTextColor={colors.textLight} style={styles.input} />
            <Text style={styles.label}>Mon petit repère <Text style={styles.optional}>(facultatif)</Text></Text>
            <TextInput value={note} onChangeText={setNote} placeholder="Une petite note pour m’encourager..." placeholderTextColor={colors.textLight} style={[styles.input, styles.noteInput]} multiline />
            <Pressable onPress={() => setAddNewToToday((value) => !value)} style={styles.addTodayRow}>
              <View style={[styles.checkbox, addNewToToday && styles.checkboxSelected]}>
                {addNewToToday ? <Text style={styles.checkboxCheck}>✓</Text> : null}
              </View>
              <View style={styles.addTodayCopy}>
                <Text style={styles.addTodayTitle}>Ajouter à ma routine dès aujourd’hui</Text>
                <Text style={styles.addTodayHint}>Il sera à cocher dans ton suivi du jour.</Text>
              </View>
            </Pressable>
            {saveError ? <Text style={styles.error}>{saveError}</Text> : null}
            <CosyButton title={savingName === 'custom' ? 'Enregistrement…' : 'Enregistrer mon exercice'} onPress={() => void saveCustom()} disabled={savingName !== ''} style={styles.primaryButton} />
            <Text style={styles.footnote}>* Champs essentiels · Tu pourras le modifier plus tard.</Text>
          </View>
        ) : (
          <View style={styles.library}>
            <View style={styles.libraryHeading}>
              <View>
                <Text style={styles.sectionTitle}>À chacun son mouvement</Text>
                <Text style={styles.sectionSubtitle}>Des idées pour ta routine, sans pression.</Text>
              </View>
              <Text style={styles.muted}>{filteredExercises.length} exercices</Text>
            </View>
            <TextInput value={search} onChangeText={setSearch} placeholder="⌕  Rechercher un exercice" placeholderTextColor={colors.textLight} style={styles.searchInput} />
            <View style={styles.filters}>
              {filters.map((value) => (
                <Pressable key={value} onPress={() => setFilter(value)} style={[styles.filterChip, filter === value && styles.filterChipSelected]}>
                  <Text style={[styles.filterText, filter === value && styles.filterTextSelected]}>{value}</Text>
                </Pressable>
              ))}
            </View>
            {error ? <Text style={styles.error}>{error}</Text> : null}
            {loading ? <ActivityIndicator color={colors.sage} style={styles.loader} /> : null}
            <Text style={styles.librarySubhead}>Pour bouger en douceur</Text>
            {filteredExercises.map((exercise) => {
              const saved = exercises.find((item) => item.name === exercise.name);
              const selected = saved?.selectedDate === today;
              return (
                <Pressable
                  key={exercise.name}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: selected }}
                  disabled={savingName !== ''}
                  onPress={() => void toggleExercise(exercise)}
                  style={styles.exerciseCard}>
                  <View style={styles.exerciseIcon}><Text style={styles.exerciseIconText}>✳</Text></View>
                  <View style={styles.exerciseCopy}>
                    <Text style={styles.exerciseName}>{exercise.name}</Text>
                    <Text style={styles.exerciseMeta}>{exercise.duration} min · {exercise.intensity} · {exercise.equipment}</Text>
                  </View>
                  <View style={[styles.checkbox, selected && styles.checkboxSelected]}>
                    {selected ? <Text style={styles.checkboxCheck}>✓</Text> : null}
                  </View>
                </Pressable>
              );
            })}
            {!filteredExercises.length ? <Text style={styles.emptyText}>Aucun exercice ne correspond à ta recherche.</Text> : null}
            {saveError ? <Text style={styles.error}>{saveError}</Text> : null}
            <View style={styles.selectionSummary}>
              <Text style={styles.selectionCount}>{selectedExercises.length} sélectionné{selectedExercises.length > 1 ? 's' : ''} · {selectedDuration} min à ton rythme</Text>
              <CosyButton
                title="Ajouter à aujourd’hui"
                onPress={() => router.replace('/movement')}
                disabled={!selectedExercises.length || loading}
                style={styles.primaryButton}
              />
            </View>
          </View>
        )}
      </ScrollView>
      <BottomNavigation active="tasks" />
    </SafeAreaView>
  );
}

const createStyles = (palette: AppColors) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.background },
  content: { padding: spacing.md, paddingBottom: spacing.lg },
  brandLine: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm, marginBottom: spacing.md },
  brand: { color: palette.textPrimary, fontSize: 27, fontFamily: 'serif', fontWeight: '700' },
  brandCaption: { color: palette.textSecondary, fontSize: 8, letterSpacing: 1, fontWeight: '600' },
  back: { alignSelf: 'flex-start', marginBottom: spacing.sm },
  backText: { color: palette.sage, fontSize: 12, fontWeight: '600' },
  eyebrow: { color: palette.sage, fontSize: 9, fontWeight: '700', letterSpacing: 0.7 },
  title: { color: palette.textPrimary, fontSize: 26, fontFamily: 'serif', fontWeight: '600', marginTop: 4 },
  subtitle: { color: palette.textSecondary, fontSize: 12, marginTop: 3, marginBottom: spacing.md },
  hero: { height: 136, overflow: 'hidden', borderRadius: borderRadius.medium, marginBottom: spacing.sm, justifyContent: 'center' },
  heroImage: { ...StyleSheet.absoluteFill, width: '100%', height: '100%' },
  heroScrim: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(40, 43, 34, 0.17)' },
  heroCopy: { maxWidth: '62%', padding: spacing.md },
  heroTitle: { color: '#FFFDF7', fontSize: 17, fontFamily: 'serif', fontWeight: '700' },
  heroSubtitle: { color: '#FFFDF7', fontSize: 10, lineHeight: 15, marginTop: 4 },
  lofi: { color: '#FFFDF7', fontSize: 8, fontWeight: '700', letterSpacing: 0.6, marginTop: 6 },
  progressCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, borderRadius: borderRadius.small, backgroundColor: palette.sagePale },
  progressMark: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center', borderRadius: 15, backgroundColor: palette.sage },
  progressMarkText: { color: palette.surface, fontSize: 15, fontWeight: '700' },
  progressCopy: { flex: 1 },
  progressTitle: { color: palette.sage, fontSize: 11, fontWeight: '700' },
  progressSubtitle: { color: palette.textSecondary, fontSize: 9, marginTop: 3 },
  progressValue: { color: palette.sage, fontSize: 12, fontWeight: '700' },
  segment: { flexDirection: 'row', backgroundColor: palette.sageLight, borderRadius: borderRadius.extraLarge, padding: 3, marginVertical: spacing.md },
  segmentItem: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: borderRadius.extraLarge },
  segmentSelected: { backgroundColor: palette.sage },
  segmentText: { color: palette.textSecondary, fontSize: 10, fontWeight: '600' },
  segmentTextSelected: { color: palette.surface },
  formCard: { padding: spacing.md, backgroundColor: palette.surface, borderRadius: borderRadius.medium, borderWidth: 1, borderColor: palette.border },
  formTitle: { color: palette.textPrimary, fontSize: 19, fontFamily: 'serif', fontWeight: '600' },
  formSubtitle: { color: palette.textSecondary, fontSize: 10, marginTop: 3, marginBottom: spacing.md },
  label: { color: palette.textPrimary, fontSize: 10, fontWeight: '700', marginBottom: 5, marginTop: spacing.sm },
  optional: { color: palette.textSecondary, fontWeight: '400' },
  input: { minHeight: 42, borderRadius: borderRadius.small, paddingHorizontal: spacing.sm, backgroundColor: palette.background, borderWidth: 1, borderColor: palette.border, color: palette.textPrimary, fontSize: 11 },
  durationInputRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  durationInput: { width: 62 },
  inputSuffix: { color: palette.textSecondary, fontSize: 10 },
  flexSpace: { flex: 1 },
  intensityChip: { paddingHorizontal: 8, paddingVertical: 6, borderRadius: borderRadius.extraLarge, backgroundColor: palette.background },
  intensityChipSelected: { backgroundColor: palette.sage },
  intensityText: { color: palette.textSecondary, fontSize: 9 },
  intensityTextSelected: { color: palette.surface },
  noteInput: { minHeight: 62, paddingTop: spacing.sm, textAlignVertical: 'top' },
  addTodayRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, borderRadius: borderRadius.small, backgroundColor: palette.sagePale, marginTop: spacing.md },
  checkbox: { width: 21, height: 21, borderRadius: 7, borderWidth: 1, borderColor: palette.sage, alignItems: 'center', justifyContent: 'center' },
  checkboxSelected: { backgroundColor: palette.sage },
  checkboxCheck: { color: palette.surface, fontSize: 13, fontWeight: '700' },
  addTodayCopy: { flex: 1 },
  addTodayTitle: { color: palette.sage, fontSize: 10, fontWeight: '700' },
  addTodayHint: { color: palette.textSecondary, fontSize: 9, marginTop: 3 },
  error: { color: palette.error, fontSize: 10, marginTop: spacing.sm },
  primaryButton: { backgroundColor: palette.sage, borderWidth: 0, borderRadius: borderRadius.extraLarge, marginTop: spacing.md },
  footnote: { color: palette.textSecondary, fontSize: 8, textAlign: 'center', marginTop: spacing.sm },
  library: { paddingBottom: spacing.md },
  libraryHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  sectionTitle: { color: palette.textPrimary, fontSize: 16, fontFamily: 'serif', fontWeight: '600' },
  sectionSubtitle: { color: palette.textSecondary, fontSize: 9, marginTop: 3 },
  muted: { color: palette.textSecondary, fontSize: 9 },
  searchInput: { height: 42, borderRadius: borderRadius.small, paddingHorizontal: spacing.sm, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border, color: palette.textPrimary, fontSize: 11 },
  filters: { flexDirection: 'row', gap: spacing.xs, marginVertical: spacing.sm },
  filterChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: borderRadius.extraLarge, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border },
  filterChipSelected: { backgroundColor: palette.sage, borderColor: palette.sage },
  filterText: { color: palette.textSecondary, fontSize: 9, fontWeight: '600' },
  filterTextSelected: { color: palette.surface },
  loader: { padding: spacing.sm },
  librarySubhead: { color: palette.textPrimary, fontSize: 13, fontFamily: 'serif', fontWeight: '600', marginBottom: spacing.xs },
  exerciseCard: { minHeight: 59, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.sm, borderRadius: borderRadius.small, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border, marginBottom: spacing.xs },
  exerciseIcon: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: palette.sagePale },
  exerciseIconText: { color: palette.sage, fontSize: 17 },
  exerciseCopy: { flex: 1 },
  exerciseName: { color: palette.textPrimary, fontSize: 11, fontWeight: '600' },
  exerciseMeta: { color: palette.textSecondary, fontSize: 8, marginTop: 3 },
  emptyText: { color: palette.textSecondary, fontSize: 10, padding: spacing.md, textAlign: 'center' },
  selectionSummary: { padding: spacing.sm, marginTop: spacing.sm, borderRadius: borderRadius.small, backgroundColor: palette.sagePale },
  selectionCount: { color: palette.sage, fontSize: 10, fontWeight: '600', textAlign: 'center' },
});
