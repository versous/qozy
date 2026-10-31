import React, { useCallback, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Directory, File, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';

import { CosyButton } from '@/components/common/CosyButton';
import { BottomNavigation } from '@/components/BottomNavigation';
import { HabitGoalFields } from '@/components/habits/HabitGoalFields';
import { HabitProgressControl } from '@/components/habits/HabitProgressControl';
import { WeekdaySelector } from '@/components/WeekdaySelector';
import { ALL_HABIT_DAYS, type HabitDay, type HabitGoalType, useHabits } from '@/hooks/useHabits';
import { useHydration } from '@/hooks/useHydration';
import { auth } from '@/services/firebase';
import { borderRadius, spacing, type AppColors } from '@/theme/colors';
import { useAppTheme } from '@/theme/ThemeProvider';
import { typography } from '@/theme/typography';

type ActivityCategory = 'movement' | 'focus' | 'calm';
type ActivityImageId = 'movement' | 'focus' | 'calm' | 'nature';

type Activity = {
  id: string;
  title: string;
  detail: string;
  duration: number;
  icon: string;
  category: ActivityCategory;
  image: ActivityImageId;
  custom?: boolean;
  imageUri?: string;
  imageCustomized?: boolean;
  completedDate?: string;
  tasks?: ActivityTask[];
};

type ActivityTask = {
  id: string;
  title: string;
  detail: string;
  completedDate?: string;
};

const ACTIVITY_STORAGE_KEY = 'qozy-small-moments';
const activityImages: { id: ActivityImageId; label: string; source: number }[] = [
  { id: 'movement', label: 'Mouvement', source: require('@/assets/images/exercise-room.jpg') },
  { id: 'focus', label: 'Concentration', source: require('@/assets/images/focus-room.jpg') },
  { id: 'calm', label: 'Calme', source: require('@/assets/images/breathing-room.jpg') },
  { id: 'nature', label: 'Nature', source: require('@/assets/images/home-hero.jpg') },
];
const activityIcons = ['🌿', '☀️', '🧘', '📖', '🎨', '🚶', '☕', '✨'];
const activityIdeas: {
  title: string;
  detail: string;
  category: ActivityCategory;
  icon: string;
  image: ActivityImageId;
  suggestions: { title: string; detail: string }[];
}[] = [
  {
    title: 'Dessiner librement',
    detail: 'Quelques traits, sans chercher la perfection',
    category: 'calm',
    icon: '🎨',
    image: 'calm',
    suggestions: [
      { title: 'Croquer un objet près de moi', detail: 'Choisir une tasse, une plante ou un livre et le dessiner simplement.' },
      { title: 'Dessiner des formes et des motifs', detail: 'Remplir une page de petits cercles, feuilles ou lignes.' },
      { title: 'Faire un autoportrait imaginaire', detail: 'Me dessiner comme je me sens aujourd’hui, sans modèle.' },
      { title: 'Dessiner un paysage rêvé', detail: 'Inventer un endroit où j’aimerais me reposer.' },
    ],
  },
  {
    title: 'Lire quelques pages',
    detail: 'Une petite pause avec un livre',
    category: 'focus',
    icon: '📖',
    image: 'focus',
    suggestions: [
      { title: 'Lire cinq pages', detail: 'M’arrêter quand j’en ai envie, sans objectif à finir.' },
      { title: 'Découvrir un chapitre', detail: 'Me laisser porter par quelques pages de mon livre.' },
      { title: 'Lire un poème ou une citation', detail: 'Choisir quelques lignes qui me font du bien.' },
      { title: 'Écouter quelques minutes un livre audio', detail: 'Fermer les yeux ou m’installer confortablement.' },
    ],
  },
  {
    title: 'Prendre soin des plantes',
    detail: 'Un peu de verdure et de douceur',
    category: 'calm',
    icon: '🪴',
    image: 'nature',
    suggestions: [
      { title: 'Arroser mes fleurs', detail: 'Vérifier la terre et donner un peu d’eau aux plantes qui en ont besoin.' },
      { title: 'Enlever les feuilles fanées', detail: 'Retirer doucement les feuilles sèches ou abîmées.' },
      { title: 'Arracher quelques mauvaises herbes', detail: 'Faire un petit tour du jardin, à mon rythme.' },
      { title: 'Nettoyer les feuilles ou rempoter une plante', detail: 'Choisir un petit geste pour aider ma plante à grandir.' },
    ],
  },
  {
    title: 'Écouter de la musique',
    detail: 'Une chanson juste pour toi',
    category: 'calm',
    icon: '🎵',
    image: 'calm',
    suggestions: [
      { title: 'Écouter ma chanson préférée', detail: 'Prendre quelques minutes pour vraiment l’écouter.' },
      { title: 'Découvrir un nouveau morceau', detail: 'Laisser une nouvelle musique me surprendre.' },
      { title: 'Créer une mini-playlist douceur', detail: 'Rassembler trois chansons qui m’apaisent.' },
      { title: 'Chanter ou bouger sur une chanson', detail: 'Me laisser porter par la musique, sans chercher à bien faire.' },
    ],
  },
  {
    title: 'Écrire dans un carnet',
    detail: 'Déposer quelques pensées',
    category: 'focus',
    icon: '✍️',
    image: 'focus',
    suggestions: [
      { title: 'Noter trois choses qui m’ont fait du bien', detail: 'Même les toutes petites choses comptent.' },
      { title: 'Écrire ce que j’ai en tête', detail: 'Déposer mes pensées sur le papier, sans les organiser.' },
      { title: 'Écrire une lettre que je ne posterai pas', detail: 'Mettre des mots sur quelque chose qui compte pour moi.' },
      { title: 'Faire une liste de mes envies', detail: 'Noter une idée, un rêve ou une chose que j’aimerais essayer.' },
    ],
  },
  {
    title: 'Faire une petite promenade',
    detail: 'Prendre l’air à ton rythme',
    category: 'movement',
    icon: '🚶',
    image: 'nature',
    suggestions: [
      { title: 'Faire le tour du quartier', detail: 'Marcher quelques minutes et rentrer quand je le souhaite.' },
      { title: 'Repérer trois jolies choses', detail: 'Observer les couleurs, les plantes ou les détails autour de moi.' },
      { title: 'Marcher dans un endroit calme', detail: 'Choisir un parc, une rue tranquille ou un coin de nature.' },
      { title: 'Sortir prendre l’air cinq minutes', detail: 'Une petite pause dehors, même juste au coin de la rue.' },
    ],
  },
  {
    title: 'Colorier un dessin',
    detail: 'Choisir des couleurs et ralentir',
    category: 'calm',
    icon: '🖍️',
    image: 'calm',
    suggestions: [
      { title: 'Colorier une petite zone', detail: 'Choisir une couleur et avancer sans se presser.' },
      { title: 'Créer ma palette du jour', detail: 'Associer quelques couleurs qui reflètent mon humeur.' },
      { title: 'Colorier en écoutant une musique douce', detail: 'Faire de ce moment une pause sensorielle.' },
      { title: 'Inventer un motif coloré', detail: 'Répéter des formes et des couleurs librement.' },
    ],
  },
  {
    title: 'Préparer une boisson chaude',
    detail: 'Un petit rituel réconfortant',
    category: 'calm',
    icon: '☕',
    image: 'nature',
    suggestions: [
      { title: 'Préparer mon thé préféré', detail: 'Prendre le temps de choisir et de savourer une tasse.' },
      { title: 'Découvrir une nouvelle infusion', detail: 'Essayer un parfum que je connais peu.' },
      { title: 'Faire une pause avec un chocolat chaud', detail: 'M’installer confortablement pour quelques gorgées.' },
      { title: 'Boire ma boisson près d’une fenêtre', detail: 'Observer dehors et profiter tranquillement de l’instant.' },
    ],
  },
];
const defaultActivities: Activity[] = [
  { id: 'movement', title: 'Exercice', detail: 'Bouger en douceur', duration: 15, icon: '✳', category: 'movement', image: 'movement' },
  { id: 'focus', title: 'Focus', detail: 'Avancer sur une chose', duration: 25, icon: '▤', category: 'focus', image: 'focus' },
  { id: 'meditation', title: 'Méditation', detail: 'Prendre un instant pour soi', duration: 10, icon: '◉', category: 'calm', image: 'calm' },
];

const todayLabel = new Date().toLocaleDateString('fr-FR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

export default function Dashboard() {
  const colors = useAppTheme().colors;
  const styles = createStyles(colors);
  const { habits, allHabits, loading, error, addHabit, toggleHabit, updateHabitProgress, deleteHabit } = useHabits();
  const hydration = useHydration();
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [newHabitTitle, setNewHabitTitle] = useState('');
  const [newHabitDays, setNewHabitDays] = useState<HabitDay[]>(ALL_HABIT_DAYS);
  const [newHabitGoalType, setNewHabitGoalType] = useState<HabitGoalType>('check');
  const [newHabitGoalTarget, setNewHabitGoalTarget] = useState('20');
  const [newHabitGoalUnit, setNewHabitGoalUnit] = useState('pages');
  const [isSaving, setIsSaving] = useState(false);
  const [isUpdatingWater, setIsUpdatingWater] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [isActivityModalVisible, setIsActivityModalVisible] = useState(false);
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
  const [newActivityTitle, setNewActivityTitle] = useState('');
  const [newActivityDetail, setNewActivityDetail] = useState('');
  const [newActivityDuration, setNewActivityDuration] = useState('10');
  const [newActivityCategory, setNewActivityCategory] = useState<ActivityCategory>('calm');
  const [newActivityImage, setNewActivityImage] = useState<ActivityImageId>('calm');
  const [newActivityImageUri, setNewActivityImageUri] = useState<string | null>(null);
  const [newActivityImageSelected, setNewActivityImageSelected] = useState(false);
  const [newActivityIcon, setNewActivityIcon] = useState('🌿');
  const [selectedActivityIdea, setSelectedActivityIdea] = useState<string | null>(null);
  const [selectedActivityTasks, setSelectedActivityTasks] = useState<ActivityTask[]>([]);
  const [customActivities, setCustomActivities] = useState<Activity[]>([]);
  const [loadedActivityUserId, setLoadedActivityUserId] = useState<string | null>(null);
  const cleanedLireHabitsUserId = React.useRef<string | null>(null);
  const [activityModalDragY] = useState(() => new Animated.Value(0));
  const activityModalPanResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponderCapture: (_event, gesture) =>
      gesture.dy > 6 && gesture.dy > Math.abs(gesture.dx),
    onPanResponderTerminationRequest: () => false,
    onPanResponderMove: (_event, gesture) => activityModalDragY.setValue(Math.max(0, gesture.dy)),
    onPanResponderRelease: (_event, gesture) => {
      if (gesture.dy > 70 || gesture.vy > 0.8) {
        setIsActivityModalVisible(false);
        setEditingActivity(null);
        activityModalDragY.setValue(0);
      } else {
        Animated.spring(activityModalDragY, {
          toValue: 0,
          useNativeDriver: true,
        }).start();
      }
    },
    onPanResponderTerminate: () => {
      Animated.spring(activityModalDragY, {
        toValue: 0,
        useNativeDriver: true,
      }).start();
    },
  }), [activityModalDragY]);
  const firstName = auth?.currentUser?.displayName?.split(' ')[0] || 'toi';
  const userId = auth?.currentUser?.uid ?? null;
  const visibleCustomActivities = userId && loadedActivityUserId === userId ? customActivities : [];
  const visibleActivities = [...defaultActivities, ...visibleCustomActivities];

  React.useEffect(() => {
    if (!userId || loading || error || cleanedLireHabitsUserId.current === userId) return;
    cleanedLireHabitsUserId.current = userId;
    const cleanupKey = `qozy-cleaned-duplicate-lire-habits:${userId}`;
    void AsyncStorage.getItem(cleanupKey).then(async (completed) => {
      if (completed) return;
      const duplicates = allHabits
        .filter((habit) => habit.title.trim().toLocaleLowerCase('fr-FR') === 'lire')
        .slice(0, 3);
      for (const habit of duplicates) {
        await deleteHabit(habit.id);
      }
      await AsyncStorage.setItem(cleanupKey, 'true');
    }).catch((reason: unknown) => {
      Alert.alert(
        'Suppression des doublons impossible',
        reason instanceof Error ? reason.message : 'Impossible de retirer les trois habitudes « Lire ».'
      );
    });
  }, [allHabits, deleteHabit, error, loading, userId]);

  useFocusEffect(useCallback(() => {
    if (!userId) return;
    let active = true;
    void AsyncStorage.getItem(`${ACTIVITY_STORAGE_KEY}:${userId}`).then((stored) => {
      if (!active) return;
      if (!stored) {
        setCustomActivities([]);
      } else {
        const parsed: unknown = JSON.parse(stored);
        const validActivities = Array.isArray(parsed)
          ? parsed.filter((activity): activity is Activity => (
            Boolean(activity)
            && typeof activity === 'object'
            && typeof activity.id === 'string'
            && typeof activity.title === 'string'
            && typeof activity.detail === 'string'
            && typeof activity.duration === 'number'
            && activity.duration >= 1
            && activity.duration <= 90
            && typeof activity.icon === 'string'
            && ['movement', 'focus', 'calm'].includes(activity.category)
            && ['movement', 'focus', 'calm', 'nature'].includes(activity.image)
            && (activity.imageUri === undefined || typeof activity.imageUri === 'string')
            && (activity.imageCustomized === undefined || typeof activity.imageCustomized === 'boolean')
          ))
          : [];
        setCustomActivities(validActivities);
      }
      setLoadedActivityUserId(userId);
    }).catch((reason: unknown) => {
      if (active) {
        Alert.alert(
          'Bibliothèque indisponible',
          reason instanceof Error ? reason.message : 'Impossible de charger tes petits moments.'
        );
      }
    });
    return () => {
      active = false;
    };
  }, [userId]));

  const handleAddHabit = async () => {
    setIsSaving(true);
    setSaveError('');
    try {
      await addHabit(newHabitTitle, '🌱', newHabitDays, {
        type: newHabitGoalType,
        target: newHabitGoalType === 'check' ? 1 : Number(newHabitGoalTarget),
        unit: newHabitGoalUnit,
      });
      setNewHabitTitle('');
      setNewHabitDays(ALL_HABIT_DAYS);
      setNewHabitGoalType('check');
      setNewHabitGoalTarget('20');
      setNewHabitGoalUnit('pages');
      setIsModalVisible(false);
    } catch (reason) {
      setSaveError(reason instanceof Error ? reason.message : "Impossible d'ajouter l'habitude.");
    } finally {
      setIsSaving(false);
    }
  };

  const openActivity = (activity: Activity) => {
    if (activity.custom) {
      router.push({ pathname: '/moment', params: { id: activity.id } });
    } else if (activity.category === 'movement') {
      router.push('/movement');
    } else if (activity.category === 'calm') {
      router.push({
        pathname: '/breathing',
        params: { activity: activity.title, minutes: String(activity.duration) },
      });
    } else {
      router.push({ pathname: '/prepare', params: { activity: activity.title } });
    }
  };
  const openActivityEditor = (activity: Activity) => {
    setEditingActivity(activity);
    setSelectedActivityIdea(
      activityIdeas.some((idea) => idea.title === activity.title) ? activity.title : null
    );
    setNewActivityTitle(activity.title);
    setNewActivityDetail(activity.detail);
    setNewActivityDuration(String(activity.duration));
    setNewActivityCategory(activity.category);
    setNewActivityImage(activity.image);
    setNewActivityImageUri(activity.imageUri ?? null);
    setNewActivityImageSelected(!activity.imageUri && !activity.imageCustomized);
    setNewActivityIcon(activity.icon);
    setSelectedActivityTasks(activity.tasks ?? []);
    setIsActivityModalVisible(true);
  };
  const chooseActivityIdea = (idea: typeof activityIdeas[number]) => {
    if (selectedActivityIdea !== idea.title) setSelectedActivityTasks([]);
    setSelectedActivityIdea(idea.title);
    setNewActivityTitle(idea.title);
    setNewActivityDetail(idea.detail);
    setNewActivityCategory(idea.category);
    setNewActivityIcon(idea.icon);
    setNewActivityImage(idea.image);
    setNewActivityImageUri(null);
    setNewActivityImageSelected(false);
  };
  const toggleActivitySuggestion = (suggestion: typeof activityIdeas[number]['suggestions'][number]) => {
    setSelectedActivityTasks((current) => current.some((task) => task.title === suggestion.title)
      ? current.filter((task) => task.title !== suggestion.title)
      : [...current, {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        title: suggestion.title,
        detail: suggestion.detail,
      }]);
  };
  const pickActivityPhoto = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Accès aux photos nécessaire', 'Autorise l’accès à tes photos pour choisir une image personnelle.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.7,
        base64: Platform.OS === 'web',
      });
      if (result.canceled) return;
      const photo = result.assets[0];
      if (!photo) throw new Error('Aucune photo n’a été sélectionnée.');
      setNewActivityImageUri(photo.uri);
      setNewActivityImageSelected(false);
    } catch (reason) {
      Alert.alert(
        'Photo indisponible',
        reason instanceof Error ? reason.message : 'Impossible d’ouvrir ta galerie photo.'
      );
    }
  };
  const persistActivityPhoto = async (uri: string, activityId: string) => {
    if (Platform.OS === 'web') {
      const asset = await fetch(uri);
      const imageBlob = await asset.blob();
      const reader = new FileReader();
      const dataUrl = await new Promise<string>((resolve, reject) => {
        reader.onload = () => typeof reader.result === 'string'
          ? resolve(reader.result)
          : reject(new Error('Impossible de préparer cette image.'));
        reader.onerror = () => reject(new Error('Impossible de lire cette image.'));
        reader.readAsDataURL(imageBlob);
      });
      return dataUrl;
    }
    const extension = uri.match(/\.(png|webp|heic|jpg|jpeg)(?:[?#]|$)/i)?.[1]?.toLowerCase() ?? 'jpg';
    const folder = new Directory(Paths.document, 'qozy-small-moments', userId ?? 'local');
    folder.create({ idempotent: true, intermediates: true });
    const photoFile = new File(folder, `${activityId}-${Date.now()}.${extension}`);
    await new File(uri).copy(photoFile);
    return photoFile.uri;
  };
  const removeActivityPhoto = (uri?: string) => {
    if (!uri || Platform.OS === 'web' || !uri.startsWith(Paths.document.uri)) return;
    const file = new File(uri);
    if (file.exists) file.delete();
  };
  const saveCustomActivity = async () => {
    const title = newActivityTitle.trim();
    const duration = Number(newActivityDuration);
    if (!userId || loadedActivityUserId !== userId) {
      Alert.alert('Bibliothèque en chargement', 'Attends un instant puis réessaie.');
      return;
    }
    if (!title || title.length > 40 || !Number.isInteger(duration) || duration < 1 || duration > 90) {
      Alert.alert('Petit moment à vérifier', 'Ajoute un nom (40 caractères maximum) et une durée de 1 à 90 minutes.');
      return;
    }

    const activityId = editingActivity?.id ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    let imageUri = newActivityImageUri;
    try {
      if (imageUri && imageUri !== editingActivity?.imageUri) {
        imageUri = await persistActivityPhoto(imageUri, activityId);
      }
    } catch (reason) {
      Alert.alert(
        'Photo non enregistrée',
        reason instanceof Error ? reason.message : 'Impossible d’enregistrer cette photo.'
      );
      return;
    }
    const updatedActivity: Activity = {
      id: activityId,
      title,
      detail: newActivityDetail.trim() || 'Un moment choisi pour toi',
      duration,
      icon: newActivityIcon,
      category: newActivityCategory,
      image: newActivityImage,
      custom: true,
      imageUri: imageUri ?? undefined,
      imageCustomized: !newActivityImageSelected,
      completedDate: editingActivity?.completedDate,
      tasks: selectedActivityTasks,
    };
    const nextActivities = editingActivity
      ? customActivities.map((activity) => activity.id === editingActivity.id ? updatedActivity : activity)
      : [...customActivities, updatedActivity];
    try {
      await AsyncStorage.setItem(`${ACTIVITY_STORAGE_KEY}:${userId}`, JSON.stringify(nextActivities));
      setCustomActivities(nextActivities);
      if (editingActivity?.imageUri && editingActivity.imageUri !== imageUri) {
        removeActivityPhoto(editingActivity.imageUri);
      }
      setEditingActivity(null);
      setNewActivityTitle('');
      setNewActivityDetail('');
      setNewActivityDuration('10');
      setNewActivityImageUri(null);
      setNewActivityImageSelected(false);
      setIsActivityModalVisible(false);
    } catch (reason) {
      Alert.alert(
        'Petit moment non enregistré',
        reason instanceof Error ? reason.message : 'Impossible d’enregistrer ce petit moment.'
      );
    }
  };
  const confirmDeleteCustomActivity = () => {
    if (!userId || !editingActivity) return;
    Alert.alert('Supprimer ce petit moment ?', editingActivity.title, [
      { text: 'Garder', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: () => {
          const nextActivities = customActivities.filter((activity) => activity.id !== editingActivity.id);
          void AsyncStorage.setItem(`${ACTIVITY_STORAGE_KEY}:${userId}`, JSON.stringify(nextActivities))
            .then(() => {
              setCustomActivities(nextActivities);
              removeActivityPhoto(editingActivity.imageUri);
              setEditingActivity(null);
              setIsActivityModalVisible(false);
            })
            .catch((reason: unknown) => {
              Alert.alert(
                'Suppression impossible',
                reason instanceof Error ? reason.message : 'Impossible de supprimer ce petit moment.'
              );
            });
        },
      },
    ]);
  };
  const selectActivityImage = (image: ActivityImageId) => {
    setNewActivityImage(image);
    setNewActivityImageUri(null);
    setNewActivityImageSelected(true);
  };
  const waterRemaining = Math.max(0, hydration.dailyGoalMilliliters - hydration.milliliters);
  const hydrationProgress = Math.min(
    100,
    Math.round((hydration.milliliters / hydration.dailyGoalMilliliters) * 100)
  );
  const updateWater = async (amount: number) => {
    setIsUpdatingWater(true);
    try {
      if (amount > 0) {
        await hydration.addWater(amount);
      } else {
        await hydration.undoLastEntry();
      }
    } catch (reason) {
      Alert.alert(
        'Hydratation non mise à jour',
        reason instanceof Error ? reason.message : 'Réessaie plus tard.'
      );
    } finally {
      setIsUpdatingWater(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}>
          <View style={styles.brandLine}>
            <Text style={styles.brandMark}>nid</Text>
            <Text style={styles.brandCaption}>À VOTRE RYTHME</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Ouvrir mon compte"
            onPress={() => router.push('/profile')}
            style={styles.avatar}>
            <Text style={styles.avatarText}>{firstName.charAt(0).toUpperCase()}</Text>
          </Pressable>
        </View>

        <Text style={styles.dateLabel}>{todayLabel}</Text>
        <Text style={styles.pageTitle}>Une chose à la fois, {firstName}.</Text>

        <View style={styles.heroCard}>
          <Image
            source={require('@/assets/images/home-hero.jpg')}
            contentFit="cover"
            transition={180}
            style={styles.heroImage}
            accessibilityLabel="Une personne profite d'un moment calme chez elle" />
          <View style={styles.heroOverlay}>
            <View style={styles.heroPill}>
              <Text style={styles.heroPillText}>☀  Un matin tout doux</Text>
            </View>
          </View>
        </View>

        <View style={styles.focusCard}>
          <View style={styles.focusIcon}>
            <Text style={styles.focusIconText}>◷</Text>
          </View>
          <View style={styles.focusCopy}>
            <Text style={styles.eyebrow}>UN PEU DE CONCENTRATION</Text>
            <Text style={styles.focusTitle}>Un focus de 25 minutes</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push({ pathname: '/prepare', params: { activity: 'Lire' } })}
            style={({ pressed }) => [styles.focusAction, pressed && styles.pressed]}>
            <Text style={styles.focusActionText}>Entrer dans ma bulle</Text>
            <Text style={styles.actionArrow}>›</Text>
          </Pressable>
        </View>

        <View style={styles.hydrationCard}>
          <View style={styles.hydrationHeading}>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/hydration')}
              style={styles.hydrationOpen}>
              <View>
                <Text style={styles.eyebrow}>UN PETIT GESTE POUR TOI</Text>
                <Text style={styles.hydrationTitle}>Mon hydratation</Text>
              </View>
              <Text style={styles.hydrationOpenArrow}>›</Text>
            </Pressable>
            <Text style={styles.hydrationIcon}>◉</Text>
          </View>
          <View style={styles.hydrationAmountRow}>
            <Text style={styles.hydrationAmount}>
              {hydration.milliliters.toLocaleString('fr-FR')} ml
            </Text>
            <Text style={styles.hydrationGoal}>
              sur {hydration.dailyGoalMilliliters.toLocaleString('fr-FR')} ml
            </Text>
          </View>
          <View
            accessibilityRole="progressbar"
            accessibilityLabel="Progression de l’hydratation aujourd’hui"
            accessibilityValue={{ min: 0, max: 100, now: hydrationProgress }}
            style={styles.hydrationTrack}>
            <View style={[styles.hydrationFill, { width: `${hydrationProgress}%` }]} />
          </View>
          <Text style={styles.hydrationRemaining}>
            {hydration.loading
              ? 'On prépare ton suivi…'
              : waterRemaining > 0
                ? `Il te reste ${waterRemaining.toLocaleString('fr-FR')} ml pour ton repère.`
                : 'Ton repère du jour est atteint. Bravo !'}
          </Text>
          {hydration.error ? <Text style={styles.hydrationError}>{hydration.error}</Text> : null}
          <View style={styles.hydrationActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Annuler la dernière prise d’eau"
              disabled={hydration.loading || isUpdatingWater || hydration.milliliters === 0}
              onPress={() => void updateWater(-1)}
              style={[styles.hydrationAction, styles.hydrationDecrease, (hydration.loading || isUpdatingWater || hydration.milliliters === 0) && styles.hydrationActionDisabled]}>
              <Text style={styles.hydrationDecreaseText}>Annuler la dernière prise</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Ajouter 250 millilitres"
              disabled={hydration.loading || isUpdatingWater}
              onPress={() => void updateWater(250)}
              style={[styles.hydrationAction, styles.hydrationIncrease, (hydration.loading || isUpdatingWater) && styles.hydrationActionDisabled]}>
              <Text style={styles.hydrationIncreaseText}>＋ 250 ml</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.sectionHeading}>
          <View>
            <Text style={styles.sectionTitle}>Mes petits moments</Text>
            <Text style={styles.sectionSubtitle}>Choisis un petit moment pour toi.</Text>
          </View>
          <Text style={styles.sectionAccent}>{visibleActivities.length} idées</Text>
        </View>

        <View style={styles.activityList}>
          {visibleActivities.map((activity) => (
            <View key={activity.id} style={styles.activityCard}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={activity.custom
                  ? `Ouvrir la fiche ${activity.title}`
                  : `Commencer ${activity.title}`}
                onPress={() => openActivity(activity)}
                style={({ pressed }) => [styles.activityCardPress, pressed && styles.pressed]}>
                <View style={[styles.activityImageWrap, { backgroundColor: colors.sagePale }]}>
                  {activity.imageUri ? (
                    <Image
                      source={{ uri: activity.imageUri }}
                      contentFit="cover"
                      transition={180}
                      style={styles.activityImage}
                      accessibilityLabel={`Photo personnelle : ${activity.title}`}
                    />
                  ) : activity.custom && activity.imageCustomized ? (
                    <View style={styles.activityArtwork}>
                      <Text style={styles.activityArtworkIcon}>{activity.icon}</Text>
                    </View>
                  ) : (
                    <Image
                      source={activityImages.find((image) => image.id === activity.image)?.source
                        ?? require('@/assets/images/home-hero.jpg')}
                      contentFit="cover"
                      transition={180}
                      style={styles.activityImage}
                      accessibilityLabel={`Illustration : ${activity.title}`}
                    />
                  )}
                  <View style={styles.activityIconBadge}>
                    <Text style={styles.activityIconText}>{activity.icon}</Text>
                  </View>
                </View>
                <View style={styles.activityCopy}>
                  <Text style={styles.activityTitle}>{activity.title}</Text>
                  <Text style={styles.activityDetail}>{activity.detail}</Text>
                  <Text style={styles.activityDuration}>{activity.duration} min · À ton rythme</Text>
                </View>
                <View style={styles.activityAction}>
                  <Text style={styles.activityActionText}>
                    {activity.custom
                      ? `${activity.tasks?.length ?? 0} tâche${activity.tasks?.length === 1 ? '' : 's'} ›`
                      : 'Commencer ›'}
                  </Text>
                </View>
              </Pressable>
              {activity.custom ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Modifier ${activity.title}`}
                  onPress={() => openActivityEditor(activity)}
                  hitSlop={8}
                  style={styles.activityEditButton}>
                  <Text style={styles.activityEditText}>✎</Text>
                </Pressable>
              ) : null}
            </View>
          ))}
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setEditingActivity(null);
              setNewActivityTitle('');
              setNewActivityDetail('');
              setNewActivityDuration('10');
              setNewActivityCategory('calm');
              setNewActivityImage('calm');
              setNewActivityImageUri(null);
              setNewActivityImageSelected(false);
              setSelectedActivityIdea(null);
              setSelectedActivityTasks([]);
              setNewActivityIcon('🌿');
              setIsActivityModalVisible(true);
            }}
            style={({ pressed }) => [styles.addActivityCard, pressed && styles.pressed]}>
            <View style={styles.addActivityIcon}><Text style={styles.addActivityIconText}>＋</Text></View>
            <View style={styles.activityCopy}>
              <Text style={styles.addActivityTitle}>Créer un petit moment</Text>
              <Text style={styles.activityDetail}>Choisis son image, son icône et sa durée.</Text>
            </View>
            <Text style={styles.actionArrow}>›</Text>
          </Pressable>
        </View>

        <View style={styles.sectionHeading}>
          <View>
            <Text style={styles.sectionTitle}>Le fil de ma journée</Text>
            <Text style={styles.sectionSubtitle}>Chaque petit pas compte.</Text>
          </View>
          <Pressable onPress={() => router.push('/tasks')} hitSlop={8}>
            <Text style={styles.seeAll}>Voir tout</Text>
          </Pressable>
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        {loading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color={colors.sage} />
            <Text style={styles.emptyText}>On prépare ton espace…</Text>
          </View>
        ) : habits.length ? (
          <View style={styles.habitList}>
            {habits.slice(0, 3).map((habit) => habit.goalType === 'check' ? (
              <Pressable
                key={habit.id}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: habit.isCompleted }}
                onPress={() => {
                  void toggleHabit(habit.id).catch((reason) => {
                    Alert.alert(
                      'Modification impossible',
                      reason instanceof Error ? reason.message : 'Réessaie plus tard.'
                    );
                  });
                }}
                style={styles.habitRow}>
                <View style={[styles.habitCheck, habit.isCompleted && styles.habitCheckDone]}>
                  {habit.isCompleted ? <Text style={styles.checkmark}>✓</Text> : null}
                </View>
                <Text style={[styles.habitTitle, habit.isCompleted && styles.habitTitleDone]}>
                  {habit.title}
                </Text>
                <Text style={styles.habitStreak}>
                  {habit.isCompleted ? 'Bravo' : 'À ton rythme'}
                </Text>
              </Pressable>
            ) : (
              <View key={habit.id} style={[styles.habitRow, styles.quantifiedHabitRow]}>
                <View style={[styles.habitCheck, habit.isCompleted && styles.habitCheckDone]}>
                  {habit.isCompleted ? <Text style={styles.checkmark}>✓</Text> : null}
                </View>
                <View style={styles.quantifiedHabitCopy}>
                  <Text style={[styles.habitTitle, habit.isCompleted && styles.habitTitleDone]}>
                    {habit.title}
                  </Text>
                  <HabitProgressControl
                    habit={habit}
                    onProgress={(progress, date) => updateHabitProgress(habit.id, progress, date)}
                  />
                </View>
              </View>
            ))}
          </View>
        ) : (
          <Pressable onPress={() => setIsModalVisible(true)} style={styles.emptyCard}>
            <View style={styles.emptyIcon}>
              <Text style={styles.emptyIconText}>＋</Text>
            </View>
            <View style={styles.emptyCopy}>
              <Text style={styles.emptyTitle}>Commence doucement</Text>
              <Text style={styles.emptyText}>Ajoute une habitude à ton rythme.</Text>
            </View>
            <Text style={styles.actionArrow}>›</Text>
          </Pressable>
        )}

        <Text style={styles.reassurance}>Vous n’avez pas à tout faire aujourd’hui.</Text>
      </ScrollView>

      <BottomNavigation active="today" />

      <Modal
        visible={isModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setIsModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalEyebrow}>UN PETIT PAS POUR TOI</Text>
            <Text style={styles.modalTitle}>Nouvelle habitude</Text>
            <TextInput
              style={styles.input}
              placeholder="Ex. Lire quelques pages"
              placeholderTextColor={colors.textLight}
              value={newHabitTitle}
              onChangeText={setNewHabitTitle}
              autoFocus
              editable={!isSaving}
              returnKeyType="done"
              onSubmitEditing={() => void handleAddHabit()}
            />
            <HabitGoalFields
              type={newHabitGoalType}
              target={newHabitGoalTarget}
              unit={newHabitGoalUnit}
              disabled={isSaving}
              onTypeChange={setNewHabitGoalType}
              onTargetChange={setNewHabitGoalTarget}
              onUnitChange={setNewHabitGoalUnit}
            />
            <WeekdaySelector selectedDays={newHabitDays} onChange={setNewHabitDays} disabled={isSaving} />
            {saveError ? <Text style={styles.errorText}>{saveError}</Text> : null}
            <CosyButton
              title={isSaving ? 'Ajout en cours…' : 'Ajouter à ma journée'}
              onPress={() => void handleAddHabit()}
              disabled={isSaving || !newHabitTitle.trim() || !newHabitDays.length || (
                newHabitGoalType !== 'check'
                && (!/^\d+$/.test(newHabitGoalTarget) || Number(newHabitGoalTarget) < 1 || Number(newHabitGoalTarget) > 10000)
              ) || (newHabitGoalType === 'count' && !newHabitGoalUnit.trim())}
              style={styles.modalButton}
            />
            <Pressable onPress={() => setIsModalVisible(false)} style={styles.cancelButton}>
              <Text style={styles.cancelText}>Pas maintenant</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal
        visible={isActivityModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => {
          setIsActivityModalVisible(false);
          setEditingActivity(null);
        }}>
        <View style={styles.modalOverlay}>
          <ScrollView
            contentContainerStyle={styles.activityModalScroll}
            keyboardShouldPersistTaps="handled">
            <Animated.View
              style={[styles.activityModal, { transform: [{ translateY: activityModalDragY }] }]}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Fermer en faisant glisser vers le bas"
                onPress={() => {
                  setIsActivityModalVisible(false);
                  setEditingActivity(null);
                }}
                {...activityModalPanResponder.panHandlers}
                style={styles.modalHandleTarget}>
                <View style={styles.modalHandle} />
                <Text style={styles.modalSwipeHint}>Glisse vers le bas pour fermer</Text>
              </Pressable>
              <Text style={styles.modalEyebrow}>À TON IMAGE</Text>
              <Text style={styles.modalTitle}>{editingActivity ? 'Modifier mon petit moment' : 'Créer un petit moment'}</Text>
              <Text style={styles.activityFormLabel}>Comment l’appeler ?</Text>
              <TextInput
                accessibilityLabel="Nom du petit moment"
                value={newActivityTitle}
                onChangeText={setNewActivityTitle}
                placeholder="Ex. Dessiner quelques minutes"
                placeholderTextColor={colors.textLight}
                maxLength={40}
                returnKeyType="next"
                style={styles.input}
              />
              <Text style={styles.activityFormLabel}>Un petit sous-titre</Text>
              <TextInput
                accessibilityLabel="Description du petit moment"
                value={newActivityDetail}
                onChangeText={setNewActivityDetail}
                placeholder="Ex. Faire une pause créative"
                placeholderTextColor={colors.textLight}
                maxLength={60}
                returnKeyType="done"
                style={styles.input}
              />
              <Text style={styles.activityFormLabel}>Quel genre de moment ?</Text>
              <View style={styles.optionRow}>
                {([
                  { id: 'calm', label: 'Me poser', icon: '☼' },
                  { id: 'focus', label: 'Avancer', icon: '▤' },
                  { id: 'movement', label: 'Bouger', icon: '✳' },
                ] as const).map((option) => (
                  <Pressable
                    key={option.id}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: newActivityCategory === option.id }}
                    onPress={() => setNewActivityCategory(option.id)}
                    style={[styles.categoryOption, newActivityCategory === option.id && styles.categoryOptionSelected]}>
                    <Text style={styles.categoryIcon}>{option.icon}</Text>
                    <Text style={[styles.categoryLabel, newActivityCategory === option.id && styles.categoryLabelSelected]}>
                      {option.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <Text style={styles.activityFormLabel}>Des idées pour t’inspirer</Text>
              <Text style={styles.activityFormHint}>Choisis une idée et adapte-la à ton envie.</Text>
              <View style={styles.ideaGrid}>
                {activityIdeas.map((idea) => (
                  <Pressable
                    key={idea.title}
                    accessibilityRole="button"
                    onPress={() => chooseActivityIdea(idea)}
                    style={[styles.ideaCard, selectedActivityIdea === idea.title && styles.ideaCardSelected]}>
                    <View style={styles.ideaIconWrap}>
                      <Text style={styles.ideaIcon}>{idea.icon}</Text>
                    </View>
                    <Text style={styles.ideaTitle}>{idea.title}</Text>
                    <Text style={styles.ideaDetail}>{idea.detail}</Text>
                  </Pressable>
                ))}
              </View>
              {activityIdeas
                .filter((idea) => idea.title === selectedActivityIdea)
                .map((idea) => (
                  <View key={idea.title} style={styles.suggestionSection}>
                    <Text style={styles.activityFormLabel}>Choisis les tâches à placer dans cette fiche</Text>
                    <View style={styles.suggestionList}>
                      {idea.suggestions.map((suggestion) => (
                        <Pressable
                          key={suggestion.title}
                          accessibilityRole="button"
                          accessibilityState={{
                            checked: selectedActivityTasks.some((task) => task.title === suggestion.title),
                          }}
                          onPress={() => toggleActivitySuggestion(suggestion)}
                          style={[
                            styles.suggestionCard,
                            selectedActivityTasks.some((task) => task.title === suggestion.title)
                              && styles.suggestionCardSelected,
                          ]}>
                          <View style={[
                            styles.suggestionCheck,
                            selectedActivityTasks.some((task) => task.title === suggestion.title)
                              && styles.suggestionCheckSelected,
                          ]}>
                            {selectedActivityTasks.some((task) => task.title === suggestion.title)
                              ? <Text style={styles.suggestionCheckmark}>✓</Text>
                              : null}
                          </View>
                          <View style={styles.suggestionIconWrap}>
                            <Text style={styles.suggestionIcon}>{idea.icon}</Text>
                          </View>
                          <View style={styles.suggestionCopy}>
                            <Text style={styles.suggestionTitle}>{suggestion.title}</Text>
                            <Text style={styles.suggestionDetail}>{suggestion.detail}</Text>
                          </View>
                        </Pressable>
                      ))}
                    </View>
                    <Text style={styles.activityFormHint}>
                      {selectedActivityTasks.length
                        ? `${selectedActivityTasks.length} tâche${selectedActivityTasks.length > 1 ? 's' : ''} dans ta fiche.`
                        : 'Tu pourras aussi ajouter tes propres tâches dans la fiche.'}
                    </Text>
                  </View>
                ))}
              <Text style={styles.activityFormLabel}>Photo personnelle (facultative)</Text>
              <Text style={styles.activityFormHint}>Choisis une image dans ta galerie, ou garde ton illustration.</Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => void pickActivityPhoto()}
                style={styles.pickPhotoButton}>
                {newActivityImageUri ? (
                  <Image source={{ uri: newActivityImageUri }} contentFit="cover" style={styles.photoPreview} />
                ) : (
                  <View style={styles.photoPlaceholder}>
                    <Text style={styles.photoPlaceholderIcon}>{newActivityIcon}</Text>
                  </View>
                )}
                <View style={styles.photoButtonCopy}>
                  <Text style={styles.photoButtonTitle}>
                    {newActivityImageUri ? 'Changer ma photo' : 'Ajouter ma propre photo'}
                  </Text>
                  <Text style={styles.activityFormHint}>Elle reste enregistrée sur cet appareil.</Text>
                </View>
                <Text style={styles.actionArrow}>›</Text>
              </Pressable>
              {newActivityImageUri ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    setNewActivityImageUri(null);
                    setNewActivityImageSelected(false);
                  }}
                  style={styles.removePhotoButton}>
                  <Text style={styles.removePhotoText}>Retirer la photo et garder mon illustration</Text>
                </Pressable>
              ) : null}
              <Text style={styles.activityFormLabel}>Ou choisis une image d’ambiance</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.imageLibrary}>
                <Pressable
                  accessibilityRole="radio"
                  accessibilityLabel="Garder mon illustration personnalisée sans photo"
                  accessibilityState={{ selected: !newActivityImageUri && !newActivityImageSelected }}
                  onPress={() => {
                    setNewActivityImageUri(null);
                    setNewActivityImageSelected(false);
                  }}
                  style={[
                    styles.imageOption,
                    !newActivityImageUri && !newActivityImageSelected && styles.imageOptionSelected,
                  ]}>
                  <View style={styles.imageOptionArtwork}>
                    <Text style={styles.imageOptionArtworkIcon}>{newActivityIcon}</Text>
                  </View>
                  <Text style={styles.imageOptionLabel}>Mon illustration</Text>
                </Pressable>
                {activityImages.map((image) => (
                  <Pressable
                    key={image.id}
                    accessibilityRole="radio"
                    accessibilityLabel={`Choisir la photo ${image.label}`}
                    accessibilityState={{ selected: newActivityImageSelected && newActivityImage === image.id }}
                    onPress={() => selectActivityImage(image.id)}
                    style={[styles.imageOption, newActivityImageSelected && newActivityImage === image.id && styles.imageOptionSelected]}>
                    <Image source={image.source} contentFit="cover" style={styles.imageOptionPhoto} />
                    <Text style={styles.imageOptionLabel}>{image.label}</Text>
                  </Pressable>
                ))}
              </ScrollView>
              <Text style={styles.activityFormLabel}>Choisis une icône</Text>
              <View style={styles.iconLibrary}>
                {activityIcons.map((icon) => (
                  <Pressable
                    key={icon}
                    accessibilityRole="radio"
                    accessibilityLabel={`Choisir l’icône ${icon}`}
                    accessibilityState={{ selected: newActivityIcon === icon }}
                    onPress={() => setNewActivityIcon(icon)}
                    style={[styles.iconOption, newActivityIcon === icon && styles.iconOptionSelected]}>
                    <Text style={styles.iconOptionText}>{icon}</Text>
                  </Pressable>
                ))}
              </View>
              <Text style={styles.activityFormLabel}>Durée · 1 à 90 minutes</Text>
              <View style={styles.durationRow}>
                {['5', '10', '15', '25', '30'].map((duration) => (
                  <Pressable
                    key={duration}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: newActivityDuration === duration }}
                    onPress={() => setNewActivityDuration(duration)}
                    style={[styles.durationOption, newActivityDuration === duration && styles.durationOptionSelected]}>
                    <Text style={[styles.durationOptionText, newActivityDuration === duration && styles.durationOptionTextSelected]}>
                      {duration} min
                    </Text>
                  </Pressable>
                ))}
              </View>
              <TextInput
                accessibilityLabel="Durée personnalisée en minutes"
                value={newActivityDuration}
                onChangeText={(value) => setNewActivityDuration(value.replace(/[^\d]/g, '').slice(0, 2))}
                keyboardType="number-pad"
                placeholder="Ou entre une durée"
                placeholderTextColor={colors.textLight}
                style={styles.durationInput}
              />
              <CosyButton
                title={editingActivity ? 'Enregistrer les changements' : 'Ajouter à mes petits moments'}
                onPress={() => void saveCustomActivity()}
                disabled={!newActivityTitle.trim() || !newActivityDuration || (
                  !editingActivity && visibleCustomActivities.length >= 12
                )}
                style={styles.modalButton}
              />
              {editingActivity ? (
                <Pressable onPress={confirmDeleteCustomActivity} style={styles.cancelButton}>
                  <Text style={styles.deleteActivityText}>Supprimer ce petit moment</Text>
                </Pressable>
              ) : visibleCustomActivities.length >= 12 ? (
                <Text style={styles.activityLimit}>Tu peux garder jusqu’à 12 petits moments personnalisés.</Text>
              ) : null}
              <Pressable onPress={() => {
                setIsActivityModalVisible(false);
                setEditingActivity(null);
              }} style={styles.cancelButton}>
                <Text style={styles.cancelText}>Pas maintenant</Text>
              </Pressable>
            </Animated.View>
          </ScrollView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const createStyles = (palette: AppColors) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: palette.background,
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  brandLine: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
  },
  brandMark: {
    color: palette.textPrimary,
    fontSize: 28,
    fontFamily: 'serif',
    fontWeight: '700',
    letterSpacing: -1,
  },
  brandCaption: {
    color: palette.textSecondary,
    fontSize: 8,
    fontWeight: '600',
    letterSpacing: 1.1,
  },
  avatar: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: palette.peach,
  },
  avatarText: {
    color: palette.clay,
    fontSize: 12,
    fontWeight: '700',
  },
  dateLabel: {
    color: palette.textSecondary,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  pageTitle: {
    color: palette.textPrimary,
    fontSize: 25,
    lineHeight: 32,
    fontFamily: 'serif',
    marginBottom: spacing.md,
  },
  heroCard: {
    overflow: 'hidden',
    borderRadius: borderRadius.large,
    aspectRatio: 1.78,
    marginBottom: spacing.md,
    backgroundColor: palette.peach,
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroOverlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'flex-end',
    padding: spacing.sm,
  },
  heroPill: {
    alignSelf: 'flex-start',
    backgroundColor: palette.surface,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: borderRadius.extraLarge,
  },
  heroPillText: {
    color: palette.textPrimary,
    fontSize: 11,
    fontWeight: '600',
  },
  focusCard: {
    backgroundColor: palette.sagePale,
    borderRadius: borderRadius.medium,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  focusIcon: {
    position: 'absolute',
    left: spacing.md,
    top: spacing.md,
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 17,
    backgroundColor: palette.surface,
  },
  focusIconText: {
    color: palette.sage,
    fontSize: 20,
  },
  focusCopy: {
    paddingLeft: 44,
    marginBottom: spacing.md,
  },
  eyebrow: {
    color: palette.sage,
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 0.75,
    marginBottom: 4,
  },
  focusTitle: {
    color: palette.textPrimary,
    fontSize: 15,
    fontFamily: 'serif',
    fontWeight: '600',
  },
  focusAction: {
    backgroundColor: palette.sage,
    minHeight: 42,
    borderRadius: borderRadius.extraLarge,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  focusActionText: {
    color: palette.surface,
    fontSize: 12,
    fontWeight: '600',
  },
  hydrationCard: {
    padding: spacing.md,
    marginBottom: spacing.md,
    borderRadius: borderRadius.medium,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
  },
  hydrationHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  hydrationOpen: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  hydrationOpenArrow: {
    color: palette.sage,
    fontSize: 20,
  },
  hydrationTitle: {
    color: palette.textPrimary,
    fontSize: 16,
    fontFamily: 'serif',
    fontWeight: '600',
  },
  hydrationIcon: {
    color: palette.sage,
    fontSize: 22,
  },
  hydrationAmountRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  hydrationAmount: {
    color: palette.textPrimary,
    fontSize: 21,
    fontWeight: '700',
  },
  hydrationGoal: {
    color: palette.textSecondary,
    fontSize: 10,
  },
  hydrationTrack: {
    height: 8,
    overflow: 'hidden',
    marginTop: spacing.sm,
    borderRadius: borderRadius.extraLarge,
    backgroundColor: palette.sagePale,
  },
  hydrationFill: {
    height: '100%',
    borderRadius: borderRadius.extraLarge,
    backgroundColor: palette.sage,
  },
  hydrationRemaining: {
    color: palette.textSecondary,
    fontSize: 10,
    marginTop: spacing.xs,
  },
  hydrationError: {
    color: palette.error,
    fontSize: 10,
    marginTop: spacing.xs,
  },
  hydrationActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  hydrationAction: {
    flex: 1,
    minHeight: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.extraLarge,
  },
  hydrationDecrease: {
    borderWidth: 1,
    borderColor: palette.border,
  },
  hydrationIncrease: {
    backgroundColor: palette.sage,
  },
  hydrationDecreaseText: {
    color: palette.sage,
    fontSize: 10,
    fontWeight: '600',
  },
  hydrationIncreaseText: {
    color: palette.surface,
    fontSize: 10,
    fontWeight: '600',
  },
  hydrationActionDisabled: {
    opacity: 0.5,
  },
  actionArrow: {
    color: palette.sage,
    fontSize: 22,
    lineHeight: 24,
  },
  sectionHeading: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    color: palette.textPrimary,
    fontSize: 18,
    fontFamily: 'serif',
    fontWeight: '600',
  },
  sectionSubtitle: {
    color: palette.textSecondary,
    fontSize: 11,
    marginTop: 3,
  },
  sectionAccent: {
    color: palette.sage,
    fontSize: 10,
    fontWeight: '600',
  },
  activityList: {
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  activityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    minHeight: 104,
    borderRadius: borderRadius.medium,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
  },
  activityCardPress: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 82,
  },
  activityEditButton: {
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.sm,
  },
  activityEditText: {
    color: palette.sage,
    fontSize: 17,
  },
  activityImageWrap: {
    width: 82,
    height: 82,
    position: 'relative',
    overflow: 'hidden',
    borderRadius: borderRadius.medium,
  },
  activityImage: {
    width: '100%',
    height: '100%',
  },
  activityArtwork: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.peachLight,
  },
  activityArtworkIcon: {
    fontSize: 34,
  },
  activityIconBadge: {
    position: 'absolute',
    right: 4,
    bottom: 4,
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 15,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
  },
  activityIconText: {
    color: palette.sage,
    fontSize: 18,
    fontWeight: '700',
  },
  activityCopy: {
    flex: 1,
    paddingHorizontal: spacing.sm,
    gap: 2,
  },
  activityTitle: {
    color: palette.textPrimary,
    fontSize: 14,
    fontFamily: 'serif',
    fontWeight: '600',
  },
  activityDetail: {
    color: palette.textSecondary,
    fontSize: 10,
  },
  activityDuration: {
    color: palette.sage,
    fontSize: 10,
    fontWeight: '600',
    marginTop: 3,
  },
  addActivityCard: {
    minHeight: 70,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: borderRadius.medium,
    borderWidth: 1,
    borderColor: palette.border,
    borderStyle: 'dashed',
    backgroundColor: palette.sagePale,
  },
  addActivityIcon: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: palette.surface,
  },
  addActivityIconText: {
    color: palette.sage,
    fontSize: 22,
  },
  addActivityTitle: {
    color: palette.textPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
  activityAction: {
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: borderRadius.extraLarge,
    backgroundColor: palette.peachLight,
  },
  activityCheck: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: palette.sage,
    backgroundColor: palette.surface,
  },
  activityCheckDone: {
    backgroundColor: palette.sage,
  },
  activityCheckmark: {
    color: palette.surface,
    fontSize: 13,
    fontWeight: '700',
  },
  deleteActivityText: {
    color: palette.error,
    fontSize: 12,
    fontWeight: '600',
  },
  activityActionText: {
    color: palette.clay,
    fontSize: 9,
    fontWeight: '600',
  },
  seeAll: {
    color: palette.sage,
    fontSize: 11,
    fontWeight: '600',
  },
  errorText: {
    color: palette.error,
    fontSize: typography.sizes.sm,
    marginBottom: spacing.sm,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.md,
  },
  habitList: {
    backgroundColor: palette.surface,
    borderRadius: borderRadius.medium,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: palette.border,
  },
  habitRow: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  quantifiedHabitRow: {
    alignItems: 'flex-start',
    paddingVertical: spacing.sm,
  },
  quantifiedHabitCopy: {
    flex: 1,
  },
  habitCheck: {
    width: 20,
    height: 20,
    borderWidth: 1,
    borderColor: palette.sage,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  habitCheckDone: {
    backgroundColor: palette.sage,
  },
  checkmark: {
    color: palette.surface,
    fontSize: 12,
    fontWeight: '700',
  },
  habitTitle: {
    color: palette.textPrimary,
    fontSize: 12,
    flex: 1,
  },
  habitTitleDone: {
    color: palette.textSecondary,
    textDecorationLine: 'line-through',
  },
  habitStreak: {
    color: palette.sage,
    fontSize: 10,
  },
  emptyCard: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: borderRadius.medium,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
  },
  emptyIcon: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 19,
    backgroundColor: palette.sagePale,
  },
  emptyIconText: {
    color: palette.sage,
    fontSize: 22,
  },
  emptyCopy: {
    flex: 1,
  },
  emptyTitle: {
    color: palette.textPrimary,
    fontSize: 12,
    fontWeight: '600',
  },
  emptyText: {
    color: palette.textSecondary,
    fontSize: 10,
    marginTop: 2,
  },
  reassurance: {
    color: palette.textSecondary,
    fontSize: 11,
    fontFamily: 'serif',
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: spacing.md,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(42, 48, 39, 0.38)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    alignItems: 'stretch',
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    borderTopLeftRadius: borderRadius.large,
    borderTopRightRadius: borderRadius.large,
    backgroundColor: palette.background,
  },
  activityModalScroll: {
    flexGrow: 1,
    justifyContent: 'flex-end',
  },
  activityModal: {
    alignItems: 'stretch',
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    borderTopLeftRadius: borderRadius.large,
    borderTopRightRadius: borderRadius.large,
    backgroundColor: palette.background,
  },
  activityFormLabel: {
    color: palette.textPrimary,
    fontSize: 11,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  activityFormHint: {
    color: palette.textSecondary,
    fontSize: 10,
    lineHeight: 15,
    marginBottom: spacing.xs,
  },
  ideaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  ideaCard: {
    width: '31.5%',
    minHeight: 105,
    padding: spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.small,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
  },
  ideaCardSelected: {
    borderColor: palette.sage,
    backgroundColor: palette.sagePale,
  },
  suggestionSection: {
    marginBottom: spacing.md,
  },
  suggestionList: {
    gap: spacing.xs,
  },
  suggestionCard: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: borderRadius.small,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
  },
  suggestionCardSelected: {
    borderColor: palette.sage,
    backgroundColor: palette.sagePale,
  },
  suggestionCheck: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: palette.sage,
    backgroundColor: palette.surface,
  },
  suggestionCheckSelected: {
    backgroundColor: palette.sage,
  },
  suggestionCheckmark: {
    color: palette.surface,
    fontSize: 13,
    fontWeight: '700',
  },
  suggestionIconWrap: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 15,
    backgroundColor: palette.sagePale,
  },
  suggestionIcon: {
    fontSize: 16,
  },
  suggestionCopy: {
    flex: 1,
  },
  suggestionTitle: {
    color: palette.textPrimary,
    fontSize: 10,
    fontWeight: '700',
  },
  suggestionDetail: {
    color: palette.textSecondary,
    fontSize: 9,
    lineHeight: 13,
    marginTop: 2,
  },
  ideaIconWrap: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 17,
    backgroundColor: palette.sagePale,
    marginBottom: 5,
  },
  ideaIcon: {
    fontSize: 18,
  },
  ideaTitle: {
    color: palette.textPrimary,
    fontSize: 9,
    fontWeight: '700',
    textAlign: 'center',
  },
  ideaDetail: {
    color: palette.textSecondary,
    fontSize: 8,
    lineHeight: 11,
    textAlign: 'center',
    marginTop: 3,
  },
  pickPhotoButton: {
    minHeight: 70,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.xs,
    borderRadius: borderRadius.small,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    marginBottom: spacing.xs,
  },
  photoPreview: {
    width: 58,
    height: 50,
    borderRadius: borderRadius.small,
  },
  photoPlaceholder: {
    width: 58,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.small,
    backgroundColor: palette.peachLight,
  },
  photoPlaceholderIcon: {
    fontSize: 25,
  },
  photoButtonCopy: {
    flex: 1,
  },
  photoButtonTitle: {
    color: palette.textPrimary,
    fontSize: 11,
    fontWeight: '700',
  },
  removePhotoButton: {
    alignSelf: 'flex-start',
    paddingVertical: spacing.xs,
  },
  removePhotoText: {
    color: palette.sage,
    fontSize: 10,
    fontWeight: '600',
  },
  optionRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  categoryOption: {
    flex: 1,
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: borderRadius.small,
    backgroundColor: palette.surface,
  },
  categoryOptionSelected: {
    borderColor: palette.sage,
    backgroundColor: palette.sagePale,
  },
  categoryIcon: {
    color: palette.sage,
    fontSize: 15,
  },
  categoryLabel: {
    color: palette.textSecondary,
    fontSize: 9,
    fontWeight: '600',
  },
  categoryLabelSelected: {
    color: palette.sage,
  },
  imageLibrary: {
    gap: spacing.sm,
    paddingBottom: spacing.md,
  },
  imageOption: {
    width: 92,
    padding: 3,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: borderRadius.small,
    backgroundColor: palette.surface,
  },
  imageOptionSelected: {
    borderWidth: 2,
    borderColor: palette.sage,
  },
  imageOptionPhoto: {
    width: '100%',
    height: 58,
    borderRadius: 5,
  },
  imageOptionArtwork: {
    height: 58,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 5,
    backgroundColor: palette.peachLight,
  },
  imageOptionArtworkIcon: {
    fontSize: 25,
  },
  imageOptionLabel: {
    color: palette.textSecondary,
    fontSize: 8,
    textAlign: 'center',
    marginVertical: 4,
  },
  iconLibrary: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  iconOption: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 19,
    backgroundColor: palette.surface,
  },
  iconOptionSelected: {
    borderColor: palette.sage,
    backgroundColor: palette.sagePale,
  },
  iconOptionText: {
    fontSize: 17,
  },
  durationRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  durationOption: {
    flex: 1,
    minHeight: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.extraLarge,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
  },
  durationOptionSelected: {
    borderColor: palette.sage,
    backgroundColor: palette.sagePale,
  },
  durationOptionText: {
    color: palette.textSecondary,
    fontSize: 9,
  },
  durationOptionTextSelected: {
    color: palette.sage,
    fontWeight: '700',
  },
  durationInput: {
    minHeight: 42,
    borderRadius: borderRadius.small,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
    backgroundColor: palette.surface,
    color: palette.textPrimary,
    borderWidth: 1,
    borderColor: palette.border,
  },
  activityLimit: {
    color: palette.textSecondary,
    fontSize: 9,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  modalHandle: {
    width: 38,
    height: 4,
    alignSelf: 'center',
    borderRadius: 2,
    backgroundColor: palette.border,
  },
  modalHandleTarget: {
    minHeight: 34,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  modalSwipeHint: {
    color: palette.textSecondary,
    fontSize: 8,
    marginTop: 5,
  },
  modalEyebrow: {
    color: palette.sage,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
    textAlign: 'center',
  },
  modalTitle: {
    color: palette.textPrimary,
    fontSize: 23,
    fontFamily: 'serif',
    fontWeight: '600',
    textAlign: 'center',
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  input: {
    minHeight: 50,
    borderRadius: borderRadius.small,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
    backgroundColor: palette.surface,
    color: palette.textPrimary,
    borderWidth: 1,
    borderColor: palette.border,
  },
  modalButton: {
    backgroundColor: palette.sage,
    borderRadius: borderRadius.extraLarge,
    borderWidth: 0,
    marginTop: spacing.xs,
  },
  cancelButton: {
    alignItems: 'center',
    padding: spacing.md,
  },
  cancelText: {
    color: palette.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.82,
  },
});
