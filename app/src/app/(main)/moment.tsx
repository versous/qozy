import { typography } from '@/theme/typography';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BottomNavigation } from '@/components/BottomNavigation';
import { BrandHeader } from '@/components/BrandHeader';
import { CosyButton } from '@/components/common/CosyButton';
import { auth } from '@/services/firebase';
import { queueOfflineWrite, saveCachedDocuments } from '@/services/offlineStore';
import { borderRadius, spacing, type AppColors } from '@/theme/colors';
import { useAppTheme } from '@/theme/ThemeProvider';

type ActivityTask = {
  id: string;
  title: string;
  detail: string;
  completedDates?: string[];
};

type Activity = {
  id: string;
  title: string;
  detail: string;
  duration: number;
  icon: string;
  category?: 'movement' | 'focus' | 'calm';
  image: 'movement' | 'focus' | 'calm' | 'nature';
  imageUri?: string;
  imageCustomized?: boolean;
  completedDate?: string;
  tasks?: ActivityTask[];
};

const STORAGE_KEY = 'qozy-small-moments';
const getTodayKey = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};
const imageSources = {
  movement: require('@/assets/images/exercise-session.jpg'),
  focus: require('@/assets/images/focus-room.jpg'),
  calm: require('@/assets/images/breathing-room.jpg'),
  nature: require('@/assets/images/home-hero.jpg'),
};

export default function MomentScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const userId = auth?.currentUser?.uid;
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const [activity, setActivity] = useState<Activity | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [error, setError] = useState('');
  const today = getTodayKey();
  const completedCount = activity?.tasks?.filter((task) => task.completedDates?.includes(today)).length ?? 0;
  const tasks = activity?.tasks ?? [];

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        if (!userId || !id) throw new Error('Ce petit moment est introuvable.');
        const stored = await AsyncStorage.getItem(`${STORAGE_KEY}:${userId}`);
        const activities = stored ? JSON.parse(stored) as Activity[] : [];
        const selected = activities.find((item) => item.id === id);
        if (!selected) throw new Error('Ce petit moment est introuvable.');
        const normalized = selected.tasks
          ? selected
          : {
            ...selected,
            tasks: [{ id: `legacy-${selected.id}`, title: selected.title, detail: selected.detail }],
          };
        if (!selected.tasks) {
          await AsyncStorage.setItem(
            `${STORAGE_KEY}:${userId}`,
            JSON.stringify(activities.map((item) => item.id === selected.id ? normalized : item))
          );
        }
        if (active) setActivity(normalized);
      } catch (reason) {
        if (active) {
          setError(reason instanceof Error ? reason.message : 'Impossible de charger ce petit moment.');
        }
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [id, userId]);

  const saveTasks = async (nextTasks: ActivityTask[]): Promise<boolean> => {
    if (!userId || !activity) {
      setError('Connecte-toi pour modifier ce petit moment.');
      return false;
    }
    setSaving(true);
    setError('');
    try {
      const stored = await AsyncStorage.getItem(`${STORAGE_KEY}:${userId}`);
      const activities = stored ? JSON.parse(stored) as Activity[] : [];
      const nextActivities = activities.map((item) => item.id === activity.id
        ? { ...item, tasks: nextTasks }
        : item);
      await AsyncStorage.setItem(`${STORAGE_KEY}:${userId}`, JSON.stringify(nextActivities));
      await saveCachedDocuments(userId, 'smallMoments', nextActivities);
      await queueOfflineWrite({
        collectionKey: 'smallMoments',
        documentId: activity.id,
        path: `users/${userId}/smallMoments/${activity.id}`,
        kind: 'set',
        data: {
          title: activity.title,
          detail: activity.detail,
          duration: activity.duration,
          icon: activity.icon,
          category: activity.category ?? 'calm',
          image: activity.image,
          custom: true,
          imageCustomized: activity.imageCustomized ?? false,
          completedDate: activity.completedDate ?? null,
          tasks: nextTasks.map((task) => ({
            id: task.id,
            title: task.title,
            detail: task.detail,
            completedDates: task.completedDates ?? [],
          })),
          ...(activity.imageUri?.startsWith('https://') ? { imageUri: activity.imageUri } : {}),
          userId,
        },
      }, userId);
      setActivity({ ...activity, tasks: nextTasks });
      return true;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Impossible d’enregistrer cette modification.');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const toggleTask = (task: ActivityTask) => {
    const completedDates = task.completedDates ?? [];
    const nextCompletedDates = completedDates.includes(today)
      ? completedDates.filter((date) => date !== today)
      : [...completedDates, today];
    void saveTasks(tasks.map((item) => item.id === task.id
      ? { ...item, completedDates: nextCompletedDates }
      : item));
  };

  const addTask = () => {
    const title = newTaskTitle.trim();
    if (!title) return;
    void saveTasks([
      ...tasks,
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        title,
        detail: '',
      },
    ]).then((saved) => {
      if (saved) setNewTaskTitle('');
    });
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <BrandHeader />
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.backButton}>
          <Text style={styles.backText}>‹  Aujourd’hui</Text>
        </Pressable>

        {loading ? (
          <ActivityIndicator color={colors.sage} style={styles.loader} />
        ) : activity ? (
          <>
            <View style={styles.hero}>
              {activity.imageUri ? (
                <Image source={{ uri: activity.imageUri }} contentFit="cover" style={styles.heroImage} />
              ) : (
                <Image source={imageSources[activity.image]} contentFit="cover" style={styles.heroImage} />
              )}
              <View style={styles.heroOverlay}>
                <Text style={styles.heroIcon}>{activity.icon}</Text>
              </View>
            </View>
            <Text style={styles.eyebrow}>MON PETIT MOMENT</Text>
            <Text style={styles.title}>{activity.title}</Text>
            <Text style={styles.subtitle}>{activity.detail}</Text>

            <View style={styles.progressCard}>
              <Text style={styles.progressIcon}>✳</Text>
              <View style={styles.progressCopy}>
                <Text style={styles.progressTitle}>
                  {completedCount
                    ? `${completedCount} petit${completedCount > 1 ? 's' : ''} pas accompli${completedCount > 1 ? 's' : ''}`
                    : 'À ton rythme'}
                </Text>
                <Text style={styles.progressHint}>
                  {tasks.length
                    ? `${completedCount} sur ${tasks.length} tâche${tasks.length > 1 ? 's' : ''} cochée${tasks.length > 1 ? 's' : ''} aujourd’hui`
                    : 'Ajoute une tâche, ou profite simplement de ce moment.'}
                </Text>
              </View>
            </View>

            <View style={styles.sectionHeading}>
              <Text style={styles.sectionTitle}>Mes petits pas pour ce moment</Text>
              <Text style={styles.count}>{tasks.length}</Text>
            </View>
            {tasks.length ? tasks.map((task) => {
              const isCompleted = task.completedDates?.includes(today) ?? false;
              return (
                <Pressable
                  key={task.id}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: isCompleted, disabled: saving }}
                  disabled={saving}
                  onPress={() => toggleTask(task)}
                  style={styles.taskCard}>
                  <View style={[styles.checkbox, isCompleted && styles.checkboxDone]}>
                    {isCompleted ? <Text style={styles.checkmark}>✓</Text> : null}
                  </View>
                  <View style={styles.taskCopy}>
                    <Text style={[styles.taskTitle, isCompleted && styles.taskTitleDone]}>{task.title}</Text>
                    {task.detail ? <Text style={styles.taskDetail}>{task.detail}</Text> : null}
                  </View>
                </Pressable>
              );
            }) : (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>Ta fiche est prête</Text>
                <Text style={styles.emptyText}>Ajoute les petites actions que tu aimerais y retrouver.</Text>
              </View>
            )}

            <Text style={styles.addLabel}>Ajouter un petit pas à cette fiche</Text>
            <TextInput
              value={newTaskTitle}
              onChangeText={setNewTaskTitle}
              onSubmitEditing={addTask}
              returnKeyType="done"
              maxLength={80}
              placeholder="Ex. Arroser les fleurs"
              placeholderTextColor={colors.textLight}
              style={styles.input}
              editable={!saving}
            />
            {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
            <CosyButton
              title={saving ? 'Enregistrement…' : 'Ajouter à ma fiche'}
              onPress={addTask}
              disabled={saving || !newTaskTitle.trim()}
              style={styles.addButton}
            />
          </>
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Petit moment indisponible</Text>
            <Text style={styles.error}>{error}</Text>
          </View>
        )}
      </ScrollView>
      <BottomNavigation active="today" />
    </SafeAreaView>
  );
}

const createStyles = (palette: AppColors) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.background },
  content: { padding: spacing.md, paddingBottom: spacing.lg },
  backButton: { alignSelf: 'flex-start', paddingVertical: spacing.xs, marginBottom: spacing.sm },
  backText: { color: palette.sage, fontSize: 13, fontWeight: '600' },
  loader: { padding: spacing.xl },
  hero: { height: 172, overflow: 'hidden', borderRadius: borderRadius.medium, marginBottom: spacing.md },
  heroImage: { width: '100%', height: '100%' },
  heroOverlay: { ...StyleSheet.absoluteFill, alignItems: 'flex-end', justifyContent: 'flex-end', padding: spacing.md },
  heroIcon: { fontSize: 36, textShadowColor: 'rgba(0,0,0,0.28)', textShadowRadius: 6 },
  eyebrow: { color: palette.sage, fontSize: 9, fontWeight: '700', letterSpacing: 0.9 },
  title: { color: palette.textPrimary, fontSize: 26, fontFamily: typography.fonts.display, fontWeight: '600', marginTop: 4 },
  subtitle: { color: palette.textSecondary, fontSize: 12, marginTop: 4, marginBottom: spacing.md },
  progressCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderRadius: borderRadius.medium, backgroundColor: palette.sagePale, marginBottom: spacing.lg },
  progressIcon: { color: palette.sage, fontSize: 22 },
  progressCopy: { flex: 1 },
  progressTitle: { color: palette.sage, fontSize: 12, fontWeight: '700' },
  progressHint: { color: palette.textSecondary, fontSize: 10, marginTop: 3 },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  sectionTitle: { color: palette.textPrimary, fontSize: 17, fontFamily: typography.fonts.display, fontWeight: '600' },
  count: { color: palette.textSecondary, fontSize: 10 },
  taskCard: { minHeight: 66, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, marginBottom: spacing.xs, borderRadius: borderRadius.small, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border },
  checkbox: { width: 23, height: 23, alignItems: 'center', justifyContent: 'center', borderRadius: 7, borderWidth: 1, borderColor: palette.sage },
  checkboxDone: { backgroundColor: palette.sage },
  checkmark: { color: palette.surface, fontSize: 14, fontWeight: '700' },
  taskCopy: { flex: 1 },
  taskTitle: { color: palette.textPrimary, fontSize: 12, fontWeight: '600' },
  taskTitleDone: { color: palette.textSecondary, textDecorationLine: 'line-through' },
  taskDetail: { color: palette.textSecondary, fontSize: 10, lineHeight: 15, marginTop: 3 },
  emptyCard: { padding: spacing.md, marginBottom: spacing.md, borderRadius: borderRadius.medium, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border },
  emptyTitle: { color: palette.textPrimary, fontSize: 13, fontWeight: '600' },
  emptyText: { color: palette.textSecondary, fontSize: 11, lineHeight: 17, marginTop: 4 },
  addLabel: { color: palette.textPrimary, fontSize: 11, fontWeight: '700', marginTop: spacing.md, marginBottom: spacing.xs },
  input: { minHeight: 48, paddingHorizontal: spacing.md, borderRadius: borderRadius.small, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border, color: palette.textPrimary },
  error: { color: palette.error, fontSize: 11, marginTop: spacing.sm },
  addButton: { backgroundColor: palette.sage, borderWidth: 0, borderRadius: borderRadius.extraLarge, marginTop: spacing.sm },
});
