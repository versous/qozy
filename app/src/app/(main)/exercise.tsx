import { typography } from '@/theme/typography';
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
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams, type Href } from 'expo-router';

import { BottomNavigation } from '@/components/BottomNavigation';
import { BrandHeader } from '@/components/BrandHeader';
import { CosyButton } from '@/components/common/CosyButton';
import { DeleteConfirmationModal } from '@/components/DeleteConfirmationModal';
import { deleteExerciseReminder, saveExerciseReminder } from '@/services/contextualReminders';
import {
  Exercise,
  ExerciseCounterMode,
  ExerciseMode,
  isExerciseScheduledOnDate,
  useExercises,
} from '@/hooks/useExercises';
import { type HabitDay } from '@/hooks/useHabits';
import { WeekdaySelector } from '@/components/WeekdaySelector';
import { getPoseExercise } from '@/components/exercisePoseSupport';
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
  { name: 'Pompes', duration: 1, mode: 'repetitions', targetReps: 20, intensity: 'Modérée', equipment: 'Sans matériel', note: '' },
  { name: 'Squats', duration: 1, mode: 'repetitions', targetReps: 15, intensity: 'Douce', equipment: 'Sans matériel', note: '' },
];

const filters: Filter[] = ['Tous', 'Doux', 'Sans matériel'];
const activityCategories = ['Exercice · Mouvement', 'Bien-être', 'Étirement', 'Renforcement'];

export default function ExerciseScreen() {
  const colors = useAppTheme().colors;
  const styles = createStyles(colors);
  const { mode: requestedMode } = useLocalSearchParams<{ mode?: string }>();
  const { exercises, today, loading, error, toggleToday, addCustomExercise, updateCustomExercise, deleteExercise, setExerciseReminder } = useExercises();
  const [mode, setMode] = useState<'library' | 'create'>(requestedMode === 'create' ? 'create' : 'library');
  const [filter, setFilter] = useState<Filter>('Tous');
  const [search, setSearch] = useState('');
  const [savingName, setSavingName] = useState('');
  const [saveError, setSaveError] = useState('');
  const [name, setName] = useState('');
  const [duration, setDuration] = useState('15');
  const [exerciseMode, setExerciseMode] = useState<ExerciseMode>('timer');
  const [targetReps, setTargetReps] = useState('20');
  const [intensity, setIntensity] = useState<Intensity>('Douce');
  const [equipment, setEquipment] = useState('Sans matériel');
  const [note, setNote] = useState('');
  const [category, setCategory] = useState('Exercice · Mouvement');
  const [counterMode, setCounterMode] = useState<ExerciseCounterMode>('manual');
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderTime, setReminderTime] = useState('18:00');
  const [reminderDays, setReminderDays] = useState<HabitDay[]>([1, 2, 3, 4, 5]);
  const [addNewToToday, setAddNewToToday] = useState(true);
  const [routineDays, setRoutineDays] = useState<HabitDay[]>([1, 2, 3, 4, 5]);
  const [editingExercise, setEditingExercise] = useState<Exercise | null>(null);
  const [deleteActionExerciseId, setDeleteActionExerciseId] = useState<string | null>(null);
  const [exerciseToDelete, setExerciseToDelete] = useState<Exercise | null>(null);

  const customExercises = exercises.filter(
    (exercise) => !catalog.some((item) => item.name === exercise.name)
  );
  const availableExercises = useMemo(
    () => [
      ...catalog,
      ...customExercises.map(({ name, duration, mode, targetReps, intensity, equipment, note }) => ({
        name,
        duration,
        mode,
        targetReps,
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
  const selectedExercises = exercises.filter((exercise) => isExerciseScheduledOnDate(exercise, today));
  const selectedDuration = selectedExercises
    .filter((exercise) => exercise.mode !== 'repetitions')
    .reduce((total, exercise) => total + exercise.duration, 0);
  const selectedRepetitions = selectedExercises
    .filter((exercise) => exercise.mode === 'repetitions')
    .reduce((total, exercise) => total + (exercise.targetReps ?? 0), 0);

  const toggleExercise = async (exercise: Activity) => {
    setSavingName(exercise.name);
    setSaveError('');
    try {
      await toggleToday(
        exercise.name,
        exercise.duration,
        exercise.intensity,
        exercise.equipment,
        exercise.mode ?? 'timer',
        exercise.targetReps ?? undefined,
      );
    } catch (reason) {
      setSaveError(reason instanceof Error ? reason.message : 'Impossible de modifier la routine.');
    } finally {
      setSavingName('');
    }
  };

  const openExerciseEditor = (exercise: Exercise) => {
    setEditingExercise(exercise);
    setName(exercise.name);
    setDuration(String(exercise.duration));
    setExerciseMode(exercise.mode ?? 'timer');
    setTargetReps(String(exercise.targetReps ?? 20));
    setIntensity(exercise.intensity === 'Modérée' ? 'Modérée' : 'Douce');
    setEquipment(exercise.equipment);
    setNote(exercise.note);
    setCategory(exercise.category ?? 'Exercice · Mouvement');
    setCounterMode(exercise.counterMode ?? 'manual');
    setReminderEnabled(exercise.reminderEnabled ?? false);
    setReminderTime(exercise.reminderTime ?? '18:00');
    setReminderDays(exercise.routineDays?.length ? exercise.routineDays : [1, 2, 3, 4, 5]);
    setRoutineDays(exercise.routineDays?.length ? exercise.routineDays : [1, 2, 3, 4, 5]);
    setAddNewToToday(Boolean(exercise.routineEnabled));
    setSaveError('');
    setMode('create');
  };

  const startNewExercise = () => {
    setEditingExercise(null);
    setName('');
    setDuration('15');
    setExerciseMode('timer');
    setTargetReps('20');
    setIntensity('Douce');
    setEquipment('Sans matériel');
    setNote('');
    setCategory('Exercice · Mouvement');
    setCounterMode('manual');
    setReminderEnabled(false);
    setReminderTime('18:00');
    setReminderDays([1, 2, 3, 4, 5]);
    setAddNewToToday(true);
    setRoutineDays([1, 2, 3, 4, 5]);
    setSaveError('');
    setMode('create');
  };

  const saveCustom = async () => {
    const minutes = Number(duration);
    const repetitions = Number(targetReps);
    if (!name.trim()) {
      setSaveError('Donne un nom à ton exercice.');
      return;
    }
    if (exerciseMode === 'timer' && (!Number.isInteger(minutes) || minutes < 1 || minutes > 180)) {
      setSaveError('Choisis une durée entre 1 et 180 minutes.');
      return;
    }
    if (exerciseMode === 'repetitions' && (!Number.isInteger(repetitions) || repetitions < 1 || repetitions > 1000)) {
      setSaveError('Choisis un nombre de répétitions entre 1 et 1 000.');
      return;
    }
    if (exerciseMode === 'repetitions' && counterMode === 'camera' && !getPoseExercise(name)) {
      setSaveError('Le comptage caméra est disponible uniquement pour les pompes et les squats.');
      return;
    }
    if (reminderEnabled && !reminderDays.length) {
      setSaveError('Choisis au moins un jour pour ton rappel.');
      return;
    }
    const validReminderTime = /^([01]\d|2[0-3]):[0-5]\d$/.test(reminderTime);
    if (reminderEnabled && !validReminderTime) {
      setSaveError('Choisis une heure de rappel valide au format HH:MM.');
      return;
    }
    const savedReminderTime = validReminderTime ? reminderTime : '18:00';

    setSavingName('custom');
    setSaveError('');
    try {
      let exerciseId: string;
      if (editingExercise) {
        await updateCustomExercise(
          editingExercise.id,
          name,
          minutes,
          intensity,
          equipment,
          note,
          routineDays,
          addNewToToday,
          exerciseMode,
          exerciseMode === 'repetitions' ? repetitions : undefined,
          { category, counterMode, reminderEnabled: false, reminderTime: savedReminderTime },
        );
        exerciseId = editingExercise.id;
      } else {
        exerciseId = await addCustomExercise(
          name,
          minutes,
          intensity,
          equipment.trim() || 'Sans matériel',
          note,
          addNewToToday,
          routineDays,
          exerciseMode,
          exerciseMode === 'repetitions' ? repetitions : undefined,
          { category, counterMode, reminderEnabled: false, reminderTime: savedReminderTime },
        );
      }
      let reminderError = '';
      try {
        await saveExerciseReminder(exerciseId, name, reminderDays, savedReminderTime, reminderEnabled);
        if (reminderEnabled) await setExerciseReminder(exerciseId, true, savedReminderTime);
      } catch (reason) {
        await deleteExerciseReminder(exerciseId);
        await setExerciseReminder(exerciseId, false, savedReminderTime);
        reminderError = reason instanceof Error
          ? `Activité enregistrée, mais rappel non activé : ${reason.message}`
          : 'Activité enregistrée, mais rappel non activé.';
      }
      setName('');
      setDuration('15');
      setExerciseMode('timer');
      setTargetReps('20');
      setIntensity('Douce');
      setEquipment('Sans matériel');
      setNote('');
      setCategory('Exercice · Mouvement');
      setCounterMode('manual');
      setReminderEnabled(false);
      setReminderTime('18:00');
      setReminderDays([1, 2, 3, 4, 5]);
      setAddNewToToday(true);
      setRoutineDays([1, 2, 3, 4, 5]);
      setEditingExercise(null);
      setSaveError(reminderError);
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
        <BrandHeader />
        {mode === 'create' ? (
          <>
            <Pressable onPress={() => setMode('library')} hitSlop={8} style={styles.back}>
              <Text style={styles.backText}>‹  Mes activités</Text>
            </Pressable>
            <Text style={styles.editorTitle}>{editingExercise ? 'Ajuster mon activité' : 'Un moment à ma façon'}</Text>
            <Text style={styles.subtitle}>Nouvelle activité · Crée ton propre rituel.</Text>
          </>
        ) : (
          <>
            <Pressable onPress={() => router.back()} hitSlop={8} style={styles.back}>
              <Text style={styles.backText}>‹  Aujourd’hui</Text>
            </Pressable>
            <Text style={styles.eyebrow}>AUJOURD’HUI · {formatToday.toLocaleUpperCase('fr-FR')}</Text>
            <Text style={styles.title}>Exercice</Text>
            <Text style={styles.subtitle}>Bouger un peu, se faire du bien.</Text>

            <View style={styles.hero}>
              <Image
                source={require('@/assets/images/exercise-session.jpg')}
                resizeMode="cover"
                style={styles.heroImage}
                accessibilityLabel="Un moment de mouvement doux dans une pièce lumineuse"
              />
              <View style={styles.heroScrim} />
              <View style={styles.heroCopy}>
                <Text style={styles.heroTitle}>Un moment pour toi</Text>
                <Text style={styles.heroSubtitle}>On bouge ensemble, à ton rythme.</Text>
                <Text style={styles.lofi}>⚡  MUSIQUE POUR BOUGER</Text>
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
              <Pressable onPress={startNewExercise} style={[styles.segmentItem, styles.segmentSelected]}>
                <Text style={[styles.segmentText, styles.segmentTextSelected]}>Créer le mien</Text>
              </Pressable>
              <Pressable onPress={() => setMode('library')} style={styles.segmentItem}>
                <Text style={styles.segmentText}>Bibliothèque</Text>
              </Pressable>
            </View>
          </>
        )}

        {mode === 'create' ? (
          <View style={styles.formCard}>
            <View style={styles.formHero}>
              <Image
                source={require('@/assets/images/exercise-session.jpg')}
                resizeMode="cover"
                style={styles.formHeroImage}
                accessibilityLabel="Un moment pour toi"
              />
            </View>
            <Text style={styles.label}>Nom de l’activité *</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Ex. Yoga, marche, pompes…"
              placeholderTextColor={colors.textLight}
              style={styles.input}
              maxLength={70}
            />
            <Text style={styles.label}>Catégorie</Text>
            <View style={styles.categoryOptions}>
              {activityCategories.map((value) => (
                <Pressable
                  key={value}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: category === value }}
                  onPress={() => setCategory(value)}
                  style={[styles.categoryChip, category === value && styles.categoryChipSelected]}>
                  <Text style={[styles.categoryText, category === value && styles.categoryTextSelected]}>{value}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.sectionLabel}>Comment mesurer mon activité ?</Text>
            <View style={styles.modeOptions}>
              {([
                { value: 'timer', label: 'Durée' },
                { value: 'repetitions', label: 'Répétitions' },
              ] as const).map((option) => (
                <Pressable
                  key={option.value}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: exerciseMode === option.value }}
                  onPress={() => setExerciseMode(option.value)}
                  style={[styles.modeOption, exerciseMode === option.value && styles.modeOptionSelected]}>
                  <Text style={[styles.modeOptionText, exerciseMode === option.value && styles.modeOptionTextSelected]}>
                    {option.label}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.label}>{exerciseMode === 'timer' ? 'Durée de mon activité' : 'Répétitions par série'}</Text>
            <View style={styles.stepper}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Diminuer la quantité"
                onPress={() => exerciseMode === 'timer'
                  ? setDuration(String(Math.max(1, Number(duration || 1) - 1)))
                  : setTargetReps(String(Math.max(1, Number(targetReps || 1) - 1)))}
                style={styles.stepperButton}>
                <Text style={styles.stepperSymbol}>−</Text>
              </Pressable>
              <TextInput
                value={exerciseMode === 'timer' ? duration : targetReps}
                onChangeText={exerciseMode === 'timer' ? setDuration : setTargetReps}
                keyboardType="number-pad"
                style={styles.stepperInput}
                accessibilityLabel={exerciseMode === 'timer' ? 'Durée en minutes' : 'Nombre de répétitions'}
              />
              <Text style={styles.stepperUnit}>{exerciseMode === 'timer' ? 'min' : 'rép.'}</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Augmenter la quantité"
                onPress={() => exerciseMode === 'timer'
                  ? setDuration(String(Math.min(180, Number(duration || 0) + 1)))
                  : setTargetReps(String(Math.min(1000, Number(targetReps || 0) + 1)))}
                style={styles.stepperButton}>
                <Text style={styles.stepperSymbol}>＋</Text>
              </Pressable>
            </View>
            {exerciseMode === 'repetitions' ? (
              <>
                <Text style={styles.sectionLabel}>Comment compter ?</Text>
                <View style={styles.modeOptions}>
                  <Pressable
                    accessibilityRole="radio"
                    accessibilityState={{ selected: counterMode === 'manual' }}
                    onPress={() => setCounterMode('manual')}
                    style={[styles.modeOption, counterMode === 'manual' && styles.modeOptionSelected]}>
                    <Text style={[styles.modeOptionText, counterMode === 'manual' && styles.modeOptionTextSelected]}>Manuellement</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="radio"
                    accessibilityState={{ selected: counterMode === 'camera' }}
                    onPress={() => getPoseExercise(name) && setCounterMode('camera')}
                    disabled={!getPoseExercise(name)}
                    style={[styles.modeOption, counterMode === 'camera' && styles.modeOptionSelected, !getPoseExercise(name) && styles.disabledOption]}>
                    <Text style={[styles.modeOptionText, counterMode === 'camera' && styles.modeOptionTextSelected]}>Avec la caméra</Text>
                  </Pressable>
                </View>
                <Text style={styles.helperText}>
                  {getPoseExercise(name)
                    ? 'Le comptage caméra est disponible pour les pompes et les squats.'
                    : 'Le comptage caméra est proposé uniquement pour les pompes et les squats. Tu peux compter manuellement.'}
                </Text>
              </>
            ) : null}
            <View style={styles.intensityRow}>
              <Text style={styles.label}>Intensité</Text>
              {(['Douce', 'Modérée'] as const).map((value) => (
                <Pressable key={value} onPress={() => setIntensity(value)} style={[styles.intensityChip, intensity === value && styles.intensityChipSelected]}>
                  <Text style={[styles.intensityText, intensity === value && styles.intensityTextSelected]}>{value}</Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.routineDaysHeading}>
              <Text style={styles.label}>Jours de ma routine</Text>
              <Pressable accessibilityRole="button" onPress={() => setRoutineDays([1, 2, 3, 4, 5])}>
                <Text style={styles.weekdaysPreset}>Lun. au ven.</Text>
              </Pressable>
            </View>
            <WeekdaySelector selectedDays={routineDays} onChange={setRoutineDays} disabled={savingName !== ''} />

            <View style={styles.reminderHeader}>
              <View style={styles.addTodayCopy}>
                <Text style={styles.addTodayTitle}>Me rappeler cette activité</Text>
                <Text style={styles.addTodayHint}>Une notification douce aux jours choisis.</Text>
              </View>
              <Switch
                value={reminderEnabled}
                onValueChange={setReminderEnabled}
                trackColor={{ false: colors.border, true: colors.sage }}
                thumbColor={colors.surface}
                accessibilityLabel="Activer le rappel"
              />
            </View>
            {reminderEnabled ? (
              <View style={styles.reminderOptions}>
                <WeekdaySelector selectedDays={reminderDays} onChange={setReminderDays} disabled={savingName !== ''} />
                <View style={styles.reminderTimeRow}>
                  <Text style={styles.label}>Heure du rappel</Text>
                  <TextInput
                    value={reminderTime}
                    onChangeText={setReminderTime}
                    keyboardType="numbers-and-punctuation"
                    placeholder="18:00"
                    accessibilityLabel="Heure du rappel au format heures minutes"
                    style={[styles.input, styles.timeInput]}
                  />
                </View>
              </View>
            ) : null}
            <Text style={styles.label}>Matériel nécessaire</Text>
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
            <CosyButton
              title={savingName === 'custom' ? 'Enregistrement…' : editingExercise ? 'Enregistrer les changements' : 'Créer mon activité'}
              onPress={() => void saveCustom()}
              disabled={savingName !== ''}
              style={styles.primaryButton}
            />
            <Text style={styles.footnote}>Tu pourras modifier ton activité plus tard.</Text>
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
            <Text style={styles.longPressHint}>Maintiens un exercice déjà ajouté à ta routine pour afficher « Supprimer ».</Text>
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
              const selected = saved ? isExerciseScheduledOnDate(saved, today) : false;
              const isCustom = Boolean(saved && customExercises.some((item) => item.id === saved.id));
              return (
                <View key={exercise.name} style={styles.exerciseCard}>
                  <Pressable
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: selected }}
                    accessibilityHint={saved ? 'Maintiens appuyé pour afficher le bouton de suppression.' : undefined}
                    disabled={savingName !== ''}
                    onPress={() => void toggleExercise(exercise)}
                    onLongPress={saved ? () => setDeleteActionExerciseId(saved.id) : undefined}
                    delayLongPress={400}
                    style={styles.exerciseSelectArea}>
                    <View style={styles.exerciseIcon}><Text style={styles.exerciseIconText}>✳</Text></View>
                    <View style={styles.exerciseCopy}>
                      <Text style={styles.exerciseName}>{exercise.name}</Text>
                      <Text style={styles.exerciseMeta}>
                        {exercise.mode === 'repetitions'
                          ? `${exercise.targetReps ?? 1} répétitions`
                          : `${exercise.duration} min`}
                        {' · '}{exercise.intensity} · {exercise.equipment}
                      </Text>
                    </View>
                    <View style={[styles.checkbox, selected && styles.checkboxSelected]}>
                      {selected ? <Text style={styles.checkboxCheck}>✓</Text> : null}
                    </View>
                  </Pressable>
                  {saved?.routineEnabled ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Ouvrir le calendrier Premium de ${exercise.name}`}
                      onPress={() => router.push({
                        pathname: '/routine-calendar',
                        params: { kind: 'exercise', id: saved.id, title: saved.name },
                      } as Href)}
                      hitSlop={8}
                      style={styles.exerciseCalendar}>
                      <Text style={styles.exerciseEditText}>▦</Text>
                    </Pressable>
                  ) : null}
                  {isCustom ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Modifier ${exercise.name}`}
                      disabled={savingName !== ''}
                      onPress={() => saved && openExerciseEditor(saved)}
                      hitSlop={8}
                      style={styles.exerciseEdit}>
                      <Text style={styles.exerciseEditText}>✎</Text>
                    </Pressable>
                  ) : null}
                  {saved && deleteActionExerciseId === saved.id ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Supprimer ${exercise.name} de ma routine`}
                      onPress={() => {
                        setExerciseToDelete(saved);
                        setDeleteActionExerciseId(null);
                      }}
                      style={styles.exerciseDelete}>
                      <Text style={styles.exerciseDeleteText}>Supprimer</Text>
                    </Pressable>
                  ) : null}
                </View>
              );
            })}
            {!filteredExercises.length ? <Text style={styles.emptyText}>Aucun exercice ne correspond à ta recherche.</Text> : null}
            {saveError ? <Text style={styles.error}>{saveError}</Text> : null}
            <View style={styles.selectionSummary}>
              <Text style={styles.selectionCount}>
                {selectedExercises.length} sélectionné{selectedExercises.length > 1 ? 's' : ''}
                {selectedDuration ? ` · ${selectedDuration} min` : ''}
                {selectedRepetitions ? ` · ${selectedRepetitions} répétitions` : ''}
              </Text>
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
      <DeleteConfirmationModal
        visible={Boolean(exerciseToDelete)}
        itemName={exerciseToDelete?.name ?? ''}
        onCancel={() => setExerciseToDelete(null)}
        onConfirm={async () => {
          if (!exerciseToDelete) return;
          try {
            await deleteExerciseReminder(exerciseToDelete.id);
            await deleteExercise(exerciseToDelete.id);
            setExerciseToDelete(null);
          } catch (reason) {
            setSaveError(reason instanceof Error ? reason.message : 'Impossible de supprimer cet exercice.');
            setExerciseToDelete(null);
          }
        }}
      />
    </SafeAreaView>
  );
}

const createStyles = (palette: AppColors) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.background },
  content: { padding: spacing.md, paddingBottom: spacing.lg },
  brandLine: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm, marginBottom: spacing.md },
  brand: { color: palette.textPrimary, fontSize: 27, fontFamily: typography.fonts.display, fontWeight: '700' },
  brandCaption: { color: palette.textSecondary, fontSize: 8, letterSpacing: 1, fontWeight: '600' },
  back: { alignSelf: 'flex-start', marginBottom: spacing.sm },
  backText: { color: palette.sage, fontSize: 12, fontWeight: '600' },
  editorTitle: { color: palette.textPrimary, fontSize: 23, fontFamily: typography.fonts.display, fontWeight: '600', marginTop: 4 },
  eyebrow: { color: palette.sage, fontSize: 9, fontWeight: '700', letterSpacing: 0.7 },
  title: { color: palette.textPrimary, fontSize: 26, fontFamily: typography.fonts.display, fontWeight: '600', marginTop: 4 },
  subtitle: { color: palette.textSecondary, fontSize: 12, marginTop: 3, marginBottom: spacing.md },
  hero: { height: 136, overflow: 'hidden', borderRadius: borderRadius.medium, marginBottom: spacing.sm, justifyContent: 'center' },
  heroImage: { ...StyleSheet.absoluteFill, width: '100%', height: '100%' },
  heroScrim: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(40, 43, 34, 0.17)' },
  heroCopy: { maxWidth: '62%', padding: spacing.md },
  heroTitle: { color: '#FFFDF7', fontSize: 17, fontFamily: typography.fonts.display, fontWeight: '700' },
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
  formHero: { height: 170, overflow: 'hidden', borderRadius: borderRadius.medium, marginBottom: spacing.sm, backgroundColor: palette.sagePale },
  formHeroImage: { width: '100%', height: '100%' },
  formTitle: { color: palette.textPrimary, fontSize: 19, fontFamily: typography.fonts.display, fontWeight: '600' },
  formSubtitle: { color: palette.textSecondary, fontSize: 10, marginTop: 3, marginBottom: spacing.md },
  label: { color: palette.textPrimary, fontSize: 10, fontWeight: '700', marginBottom: 5, marginTop: spacing.sm },
  sectionLabel: { color: palette.textPrimary, fontSize: 12, fontWeight: '700', marginTop: spacing.md, marginBottom: spacing.xs },
  categoryOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  categoryChip: { paddingHorizontal: spacing.sm, paddingVertical: 7, borderRadius: borderRadius.extraLarge, backgroundColor: palette.background, borderWidth: 1, borderColor: palette.border },
  categoryChipSelected: { backgroundColor: palette.sage, borderColor: palette.sage },
  categoryText: { color: palette.textSecondary, fontSize: 8, fontWeight: '600' },
  categoryTextSelected: { color: palette.surface },
  routineDaysHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.xs },
  weekdaysPreset: { color: palette.sage, fontSize: 9, fontWeight: '600' },
  optional: { color: palette.textSecondary, fontWeight: '400' },
  input: { minHeight: 42, borderRadius: borderRadius.small, paddingHorizontal: spacing.sm, backgroundColor: palette.background, borderWidth: 1, borderColor: palette.border, color: palette.textPrimary, fontSize: 11 },
  durationInputRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  durationInput: { width: 62 },
  modeOptions: { flexDirection: 'row', gap: spacing.xs },
  modeOption: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 38, paddingHorizontal: spacing.xs, borderRadius: borderRadius.small, backgroundColor: palette.background, borderWidth: 1, borderColor: palette.border },
  modeOptionSelected: { backgroundColor: palette.sage, borderColor: palette.sage },
  modeOptionText: { color: palette.textSecondary, fontSize: 9, fontWeight: '600', textAlign: 'center' },
  modeOptionTextSelected: { color: palette.surface },
  disabledOption: { opacity: 0.45 },
  helperText: { color: palette.textSecondary, fontSize: 9, lineHeight: 14, marginTop: spacing.xs },
  stepper: { minHeight: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingHorizontal: spacing.sm, borderRadius: borderRadius.small, backgroundColor: palette.background, borderWidth: 1, borderColor: palette.border },
  stepperButton: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 17, backgroundColor: palette.sagePale },
  stepperSymbol: { color: palette.sage, fontSize: 19, fontWeight: '600' },
  stepperInput: { minWidth: 52, color: palette.textPrimary, fontSize: 18, fontWeight: '700', textAlign: 'center' },
  stepperUnit: { color: palette.textSecondary, fontSize: 10, marginRight: spacing.sm },
  intensityRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.xs },
  intensityChip: { paddingHorizontal: 8, paddingVertical: 6, borderRadius: borderRadius.extraLarge, backgroundColor: palette.background },
  intensityChipSelected: { backgroundColor: palette.sage },
  intensityText: { color: palette.textSecondary, fontSize: 9 },
  intensityTextSelected: { color: palette.surface },
  reminderHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, borderRadius: borderRadius.small, backgroundColor: palette.sagePale, marginTop: spacing.md },
  reminderOptions: { padding: spacing.sm, marginTop: spacing.xs, borderRadius: borderRadius.small, backgroundColor: palette.background },
  reminderTimeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  timeInput: { width: 90, minHeight: 38, textAlign: 'center', fontWeight: '700' },
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
  longPressHint: { color: palette.textSecondary, fontSize: 8, lineHeight: 12, marginBottom: spacing.xs },
  sectionTitle: { color: palette.textPrimary, fontSize: 16, fontFamily: typography.fonts.display, fontWeight: '600' },
  sectionSubtitle: { color: palette.textSecondary, fontSize: 9, marginTop: 3 },
  muted: { color: palette.textSecondary, fontSize: 9 },
  searchInput: { height: 42, borderRadius: borderRadius.small, paddingHorizontal: spacing.sm, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border, color: palette.textPrimary, fontSize: 11 },
  filters: { flexDirection: 'row', gap: spacing.xs, marginVertical: spacing.sm },
  filterChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: borderRadius.extraLarge, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border },
  filterChipSelected: { backgroundColor: palette.sage, borderColor: palette.sage },
  filterText: { color: palette.textSecondary, fontSize: 9, fontWeight: '600' },
  filterTextSelected: { color: palette.surface },
  loader: { padding: spacing.sm },
  librarySubhead: { color: palette.textPrimary, fontSize: 13, fontFamily: typography.fonts.display, fontWeight: '600', marginBottom: spacing.xs },
  exerciseCard: { minHeight: 59, flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.sm, borderRadius: borderRadius.small, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border, marginBottom: spacing.xs },
  exerciseSelectArea: { flex: 1, minHeight: 57, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  exerciseEdit: { padding: spacing.xs },
  exerciseDelete: { paddingHorizontal: spacing.sm, paddingVertical: 6, borderRadius: borderRadius.extraLarge, backgroundColor: palette.peachLight },
  exerciseDeleteText: { color: palette.clay, fontSize: 8, fontWeight: '700' },
  exerciseCalendar: { padding: spacing.xs },
  exerciseEditText: { color: palette.sage, fontSize: 17 },
  exerciseIcon: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: palette.sagePale },
  exerciseIconText: { color: palette.sage, fontSize: 17 },
  exerciseCopy: { flex: 1 },
  exerciseName: { color: palette.textPrimary, fontSize: 11, fontWeight: '600' },
  exerciseMeta: { color: palette.textSecondary, fontSize: 8, marginTop: 3 },
  emptyText: { color: palette.textSecondary, fontSize: 10, padding: spacing.md, textAlign: 'center' },
  selectionSummary: { padding: spacing.sm, marginTop: spacing.sm, borderRadius: borderRadius.small, backgroundColor: palette.sagePale },
  selectionCount: { color: palette.sage, fontSize: 10, fontWeight: '600', textAlign: 'center' },
});
