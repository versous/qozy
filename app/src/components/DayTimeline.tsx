import { typography } from '@/theme/typography';
import React, { useMemo, useRef, useState } from 'react';
import {
  Animated,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import type { TodoTask } from '@/hooks/useTasks';
import { borderRadius, spacing, type AppColors } from '@/theme/colors';
import { useAppTheme } from '@/theme/ThemeProvider';

const DAY_START_MINUTES = 8 * 60;
const DAY_END_MINUTES = 20 * 60;
const SLOT_MINUTES = 30;
const SLOT_HEIGHT = 42;
const NUMBER_OF_SLOTS = (DAY_END_MINUTES - DAY_START_MINUTES) / SLOT_MINUTES;

function toMinutes(value: string) {
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

function toTime(value: number) {
  const minutes = Math.round(value / SLOT_MINUTES) * SLOT_MINUTES;
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

function getTaskStart(task: TodoTask) {
  return task.startTime ? toMinutes(task.startTime) : DAY_START_MINUTES;
}

export function DayTimeline({
  tasks,
  onSchedule,
  onUnschedule,
}: {
  tasks: TodoTask[];
  onSchedule: (taskId: string, startTime: string) => Promise<void>;
  onUnschedule: (taskId: string) => Promise<void>;
}) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const gridRef = useRef<View>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const scheduledTasks = useMemo(
    () => tasks.filter((task) => Boolean(task.startTime))
      .sort((first, second) => (first.startTime ?? '').localeCompare(second.startTime ?? '')),
    [tasks]
  );
  const unscheduledTasks = useMemo(
    () => tasks.filter((task) => !task.startTime),
    [tasks]
  );

  const placeTask = async (task: TodoTask, minutes: number) => {
    const duration = task.durationMinutes ?? 60;
    const latestStart = DAY_END_MINUTES - duration;
    const nextStart = Math.max(
      DAY_START_MINUTES,
      Math.min(latestStart, Math.round(minutes / SLOT_MINUTES) * SLOT_MINUTES)
    );
    const nextEnd = nextStart + duration;
    const conflict = scheduledTasks.some((other) => {
      if (other.id === task.id) return false;
      const otherStart = getTaskStart(other);
      const otherEnd = otherStart + (other.durationMinutes ?? 60);
      return nextStart < otherEnd && nextEnd > otherStart;
    });

    if (conflict) {
      setNotice('Ce créneau est déjà occupé. Choisis un autre moment, sans te presser.');
      return;
    }

    setNotice(null);
    setSelectedTaskId(null);
    try {
      await onSchedule(task.id, toTime(nextStart));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Impossible de déplacer ce petit pas.');
    }
  };

  const handleDropFromPool = (task: TodoTask, moveY: number) => {
    gridRef.current?.measureInWindow((_x, y, _width, height) => {
      const relativePosition = Math.max(0, Math.min(height - 1, moveY - y));
      const slot = Math.floor(relativePosition / SLOT_HEIGHT);
      void placeTask(task, DAY_START_MINUTES + slot * SLOT_MINUTES);
    });
  };

  const handleDropScheduled = (task: TodoTask, dy: number) => {
    const startMinutes = getTaskStart(task);
    void placeTask(task, startMinutes + (dy / SLOT_HEIGHT) * SLOT_MINUTES);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.intro}>
        Fais glisser un petit pas vers un créneau, ou choisis-le puis touche une heure.
        Chaque bloc dure une heure et se cale par pas de 30 minutes.
      </Text>

      {unscheduledTasks.length ? (
        <View style={styles.pool}>
          <Text style={styles.poolTitle}>À placer quand tu le souhaites</Text>
          <View style={styles.poolList}>
            {unscheduledTasks.map((task) => (
              <DraggableTask
                key={task.id}
                task={task}
                selected={selectedTaskId === task.id}
                styles={styles}
                onSelect={() => setSelectedTaskId(task.id)}
                onDrop={(_dy, moveY) => handleDropFromPool(task, moveY)}
              />
            ))}
          </View>
        </View>
      ) : null}

      {notice ? <Text style={styles.notice}>{notice}</Text> : null}

      <ScrollView
        style={styles.timelineScroll}
        nestedScrollEnabled
        showsVerticalScrollIndicator={false}>
        <View style={styles.timelineRow}>
          <View style={styles.hourLabels}>
            {Array.from({ length: NUMBER_OF_SLOTS }, (_, index) => (
              <View key={index} style={styles.hourLabelCell}>
                {index % 2 === 0 ? (
                  <Text style={styles.hourLabel}>{`${8 + index / 2}:00`}</Text>
                ) : null}
              </View>
            ))}
            <Text style={styles.hourLabel}>20:00</Text>
          </View>

          <View ref={gridRef} collapsable={false} style={styles.grid}>
            {Array.from({ length: NUMBER_OF_SLOTS }, (_, index) => {
              const minute = DAY_START_MINUTES + index * SLOT_MINUTES;
              return (
                <Pressable
                  key={index}
                  accessibilityRole="button"
                  accessibilityLabel={`Placer à ${toTime(minute)}`}
                  onPress={() => {
                    const selected = unscheduledTasks.find((task) => task.id === selectedTaskId);
                    if (selected) void placeTask(selected, minute);
                  }}
                  style={[
                    styles.slot,
                    index % 2 === 0 && styles.hourSlot,
                    selectedTaskId && styles.dropSlot,
                  ]}
                />
              );
            })}
            {scheduledTasks.map((task) => (
              <ScheduledTask
                key={task.id}
                task={task}
                styles={styles}
                onDrop={(dy) => handleDropScheduled(task, dy)}
                onUnschedule={() => {
                  setNotice(null);
                  void onUnschedule(task.id).catch((error: unknown) => {
                    setNotice(error instanceof Error ? error.message : 'Impossible de retirer ce créneau.');
                  });
                }}
              />
            ))}
          </View>
        </View>
      </ScrollView>

      {!tasks.length ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>Un espace pour respirer</Text>
          <Text style={styles.emptyText}>Ajoute un petit pas à cette journée pour lui choisir un moment.</Text>
        </View>
      ) : null}
    </View>
  );
}

function DraggableTask({
  task,
  selected,
  styles,
  onSelect,
  onDrop,
}: {
  task: TodoTask;
  selected: boolean;
  styles: ReturnType<typeof createStyles>;
  onSelect: () => void;
  onDrop: (dy: number, moveY: number) => void;
}) {
  const [translation] = useState(() => new Animated.Value(0));
  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: () => {
      onSelect();
      translation.setValue(0);
    },
    onPanResponderMove: (_event, gesture) => translation.setValue(gesture.dy),
    onPanResponderRelease: (_event, gesture) => {
      translation.setValue(0);
      if (Math.abs(gesture.dy) > 8) onDrop(gesture.dy, gesture.moveY);
    },
    onPanResponderTerminate: () => translation.setValue(0),
  }), [onDrop, onSelect, translation]);

  return (
    <Animated.View
      style={[
        styles.poolTask,
        selected && styles.poolTaskSelected,
        { transform: [{ translateY: translation }] },
      ]}>
      <View style={styles.dragHandle} {...panResponder.panHandlers}>
        <Text style={styles.dragHandleText}>⠿</Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected }}
        onPress={onSelect}
        style={styles.poolTaskCopy}>
        <Text numberOfLines={1} style={styles.poolTaskTitle}>{task.title}</Text>
        <Text style={styles.poolTaskHint}>à placer · 1 h</Text>
      </Pressable>
    </Animated.View>
  );
}

function ScheduledTask({
  task,
  styles,
  onDrop,
  onUnschedule,
}: {
  task: TodoTask;
  styles: ReturnType<typeof createStyles>;
  onDrop: (dy: number) => void;
  onUnschedule: () => void;
}) {
  const [translation] = useState(() => new Animated.Value(0));
  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: () => translation.setValue(0),
    onPanResponderMove: (_event, gesture) => translation.setValue(gesture.dy),
    onPanResponderRelease: (_event, gesture) => {
      translation.setValue(0);
      if (Math.abs(gesture.dy) > 8) onDrop(gesture.dy);
    },
    onPanResponderTerminate: () => translation.setValue(0),
  }), [onDrop, translation]);
  const start = getTaskStart(task);
  const top = ((start - DAY_START_MINUTES) / SLOT_MINUTES) * SLOT_HEIGHT;
  const blockHeight = ((task.durationMinutes ?? 60) / SLOT_MINUTES) * SLOT_HEIGHT;

  return (
    <Animated.View
      style={[
        styles.scheduledTask,
        { top, height: blockHeight, transform: [{ translateY: translation }] },
      ]}>
      <View style={styles.scheduledHandle} {...panResponder.panHandlers}>
        <Text style={styles.scheduledTime}>{task.startTime}</Text>
        <Text numberOfLines={1} style={styles.scheduledTitle}>{task.title}</Text>
        <Text style={styles.dragHandleText}>⠿</Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Retirer ${task.title} du planning`}
        onPress={onUnschedule}
        style={styles.unscheduleButton}>
        <Text style={styles.unscheduleText}>×</Text>
      </Pressable>
    </Animated.View>
  );
}

const createStyles = (palette: AppColors) => StyleSheet.create({
  container: { gap: spacing.sm },
  intro: { color: palette.textSecondary, fontSize: 10, lineHeight: 16 },
  pool: { padding: spacing.sm, borderRadius: borderRadius.medium, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border },
  poolTitle: { color: palette.textSecondary, fontSize: 9, fontWeight: '700', marginBottom: spacing.xs },
  poolList: { gap: spacing.xs },
  poolTask: { minHeight: 42, flexDirection: 'row', alignItems: 'center', borderRadius: borderRadius.small, backgroundColor: palette.sagePale },
  poolTaskSelected: { borderWidth: 1, borderColor: palette.sage },
  dragHandle: { width: 40, height: 42, alignItems: 'center', justifyContent: 'center' },
  dragHandleText: { color: palette.sage, fontSize: 18, fontWeight: '700' },
  poolTaskCopy: { flex: 1, justifyContent: 'center', paddingVertical: spacing.xs },
  poolTaskTitle: { color: palette.textPrimary, fontSize: 10, fontWeight: '600' },
  poolTaskHint: { color: palette.textSecondary, fontSize: 8, marginTop: 2 },
  notice: { color: palette.clay, fontSize: 10, lineHeight: 15 },
  timelineScroll: { maxHeight: 620, borderRadius: borderRadius.medium },
  timelineRow: { flexDirection: 'row', paddingTop: spacing.xs },
  hourLabels: { width: 48, alignItems: 'flex-end', paddingRight: spacing.xs },
  hourLabelCell: { height: SLOT_HEIGHT },
  hourLabel: { color: palette.textSecondary, fontSize: 8, transform: [{ translateY: -5 }] },
  grid: { flex: 1, height: NUMBER_OF_SLOTS * SLOT_HEIGHT, position: 'relative', borderLeftWidth: 1, borderLeftColor: palette.border },
  slot: { height: SLOT_HEIGHT, borderTopWidth: 1, borderTopColor: palette.border },
  hourSlot: { borderTopColor: palette.textLight },
  dropSlot: { backgroundColor: palette.sagePale },
  scheduledTask: { position: 'absolute', left: 4, right: 4, minHeight: 34, flexDirection: 'row', alignItems: 'center', borderRadius: borderRadius.small, backgroundColor: palette.sage },
  scheduledHandle: { flex: 1, minWidth: 0, height: '100%', flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.xs },
  scheduledTime: { color: palette.surface, fontSize: 8, fontWeight: '700' },
  scheduledTitle: { flex: 1, color: palette.surface, fontSize: 9, fontWeight: '600' },
  unscheduleButton: { width: 28, height: '100%', alignItems: 'center', justifyContent: 'center' },
  unscheduleText: { color: palette.surface, fontSize: 18 },
  empty: { padding: spacing.md, alignItems: 'center', borderRadius: borderRadius.medium, backgroundColor: palette.surface },
  emptyTitle: { color: palette.textPrimary, fontFamily: typography.fonts.display, fontSize: 14, fontWeight: '600' },
  emptyText: { color: palette.textSecondary, fontSize: 10, textAlign: 'center', marginTop: 4 },
});
