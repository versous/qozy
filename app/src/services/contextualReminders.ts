import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { getPermissionsAsync, requestPermissionsAsync } from 'expo-notifications/build/NotificationPermissions';
import { setNotificationHandler } from 'expo-notifications/build/NotificationsHandler';
import { SchedulableTriggerInputTypes } from 'expo-notifications/build/Notifications.types';
import { AndroidImportance } from 'expo-notifications/build/NotificationChannelManager.types';
import { cancelScheduledNotificationAsync } from 'expo-notifications/build/cancelScheduledNotificationAsync';
import { scheduleNotificationAsync } from 'expo-notifications/build/scheduleNotificationAsync';
import { setNotificationChannelAsync } from 'expo-notifications/build/setNotificationChannelAsync';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';

const STORAGE_KEY = 'qozy-contextual-reminders';
const GEOFENCE_TASK = 'qozy-contextual-location-reminder';
const GEOFENCE_ID = 'qozy-saved-place';
const ANDROID_CHANNEL = 'qozy-gentle-reminders';

export type TimeReminder = {
  enabled: boolean;
  hour: number;
  minute: number;
  message: string;
  notificationId: string | null;
};

export type LocationReminder = {
  enabled: boolean;
  latitude: number | null;
  longitude: number | null;
  message: string;
};

export type ScheduledReminder = {
  id: string;
  title: string;
  category: string;
  message: string;
  hour: number;
  minute: number;
  days: number[];
  enabled: boolean;
  notificationIds: string[];
};

export type ContextualReminders = {
  time: TimeReminder;
  location: LocationReminder;
  schedules: ScheduledReminder[];
};

const defaultSchedules: ScheduledReminder[] = [
  {
    id: 'reading',
    title: 'Mon moment de lecture',
    category: 'Habitude · Lire 10 minutes',
    message: 'Prends un petit moment pour lire, à ton rythme.',
    hour: 8,
    minute: 30,
    days: [1, 2, 3, 4, 5],
    enabled: false,
    notificationIds: [],
  },
  {
    id: 'hydration',
    title: 'Une pause pour boire',
    category: 'Hydratation · Notification douce',
    message: 'Une petite pause pour boire un verre d’eau.',
    hour: 15,
    minute: 0,
    days: [0, 1, 2, 3, 4, 5, 6],
    enabled: false,
    notificationIds: [],
  },
  {
    id: 'breathing',
    title: 'Respirer au calme',
    category: 'Méditation · Respiration guidée',
    message: 'Accorde-toi un instant pour respirer calmement.',
    hour: 21,
    minute: 30,
    days: [1, 3, 5],
    enabled: false,
    notificationIds: [],
  },
];

export const DEFAULT_REMINDERS: ContextualReminders = {
  time: {
    enabled: false,
    hour: 9,
    minute: 0,
    message: 'Un moment pour toi, à ton rythme.',
    notificationId: null,
  },
  location: {
    enabled: false,
    latitude: null,
    longitude: null,
    message: 'Tu es arrivé·e. Prends un instant pour toi.',
  },
  schedules: defaultSchedules,
};

setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

type GeofenceTaskData = {
  eventType: Location.GeofencingEventType;
  region: Location.LocationRegion;
};

if (Platform.OS !== 'web' && !TaskManager.isTaskDefined(GEOFENCE_TASK)) {
  TaskManager.defineTask<GeofenceTaskData>(GEOFENCE_TASK, async ({ data, error }) => {
    if (error) {
      console.warn('Le rappel de localisation n’a pas pu être traité.', error);
      return;
    }

    if (data?.eventType !== Location.GeofencingEventType.Enter || data.region.identifier !== GEOFENCE_ID) {
      return;
    }

    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    if (!stored) return;

    const reminders = JSON.parse(stored) as ContextualReminders;
    if (!reminders.location.enabled) return;

    await scheduleNotificationAsync({
      content: {
        title: 'Un petit moment pour toi',
        body: reminders.location.message,
        sound: false,
      },
      trigger: null,
    });
  });
}

export async function loadContextualReminders(): Promise<ContextualReminders> {
  const stored = await AsyncStorage.getItem(STORAGE_KEY);
  if (!stored) return {
    ...DEFAULT_REMINDERS,
    schedules: defaultSchedules.map((schedule) => ({ ...schedule, days: [...schedule.days] })),
  };

  const parsed = JSON.parse(stored) as Partial<ContextualReminders>;
  const legacyTime = { ...DEFAULT_REMINDERS.time, ...parsed.time };
  const schedules = Array.isArray(parsed.schedules)
    ? parsed.schedules.map((schedule) => ({
      ...schedule,
      days: Array.isArray(schedule.days) ? schedule.days : [],
      notificationIds: Array.isArray(schedule.notificationIds) ? schedule.notificationIds : [],
    }))
    : defaultSchedules.map((schedule, index) => index === 0
      ? {
        ...schedule,
        hour: legacyTime.hour,
        minute: legacyTime.minute,
        message: legacyTime.message,
        enabled: legacyTime.enabled,
        notificationIds: legacyTime.notificationId ? [legacyTime.notificationId] : [],
      }
      : { ...schedule, days: [...schedule.days] });
  return {
    time: legacyTime,
    location: { ...DEFAULT_REMINDERS.location, ...parsed.location },
    schedules,
  };
}

async function saveContextualReminders(reminders: ContextualReminders) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(reminders));
}

async function ensureNotificationPermission() {
  if (Platform.OS === 'web') {
    throw new Error('Les rappels sont disponibles dans l’application mobile installée.');
  }

  if (Platform.OS === 'android') {
    await setNotificationChannelAsync(ANDROID_CHANNEL, {
      name: 'Rappels doux',
      importance: AndroidImportance.DEFAULT,
      sound: null,
    });
  }

  let permission = await getPermissionsAsync();
  if (!permission.granted) permission = await requestPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Autorise les notifications dans les réglages de ton téléphone pour activer ce rappel.');
  }
}

export async function saveTimeReminder(
  current: ContextualReminders,
  reminder: Omit<TimeReminder, 'notificationId'>,
): Promise<ContextualReminders> {
  const updated: ContextualReminders = {
    ...current,
    time: { ...reminder, notificationId: current.time.notificationId },
  };

  if (reminder.enabled) {
    await ensureNotificationPermission();
    const newNotificationId = await scheduleNotificationAsync({
      content: {
        title: 'Un petit moment pour toi',
        body: reminder.message,
        sound: false,
        ...(Platform.OS === 'android' ? { channelId: ANDROID_CHANNEL } : {}),
      },
      trigger: {
        type: SchedulableTriggerInputTypes.DAILY,
        hour: reminder.hour,
        minute: reminder.minute,
      },
    });

    updated.time.notificationId = newNotificationId;
    try {
      await saveContextualReminders(updated);
    } catch (error) {
      await cancelScheduledNotificationAsync(newNotificationId);
      throw error;
    }
    if (current.time.notificationId) {
      await cancelScheduledNotificationAsync(current.time.notificationId);
    }
    return updated;
  }

  if (current.time.notificationId) {
    await cancelScheduledNotificationAsync(current.time.notificationId);
  }
  updated.time.notificationId = null;
  await saveContextualReminders(updated);
  return updated;
}

export async function saveScheduledReminder(
  current: ContextualReminders,
  reminder: ScheduledReminder
): Promise<ContextualReminders> {
  const title = reminder.title.trim();
  const message = reminder.message.trim();
  if (!title) throw new Error('Donne un nom à ce rappel.');
  if (!message) throw new Error('Ajoute un petit message à ce rappel.');
  if (!Number.isInteger(reminder.hour) || reminder.hour < 0 || reminder.hour > 23
    || !Number.isInteger(reminder.minute) || reminder.minute < 0 || reminder.minute > 59) {
    throw new Error('Choisis une heure valide.');
  }
  const days = [...new Set(reminder.days)].filter((day) => Number.isInteger(day) && day >= 0 && day <= 6);
  if (!days.length) throw new Error('Choisis au moins un jour.');

  const existing = current.schedules.find((item) => item.id === reminder.id);
  let notificationIds: string[] = [];
  if (reminder.enabled) {
    await ensureNotificationPermission();
    if (Platform.OS === 'android') {
      await setNotificationChannelAsync(ANDROID_CHANNEL, {
        name: 'Rappels doux',
        importance: AndroidImportance.DEFAULT,
        sound: null,
      });
    }

    try {
      for (const day of days) {
        notificationIds.push(await scheduleNotificationAsync({
          content: {
            title,
            body: message,
            sound: false,
            ...(Platform.OS === 'android' ? { channelId: ANDROID_CHANNEL } : {}),
          },
          trigger: {
            type: SchedulableTriggerInputTypes.WEEKLY,
            weekday: day === 0 ? 1 : day + 1,
            hour: reminder.hour,
            minute: reminder.minute,
            ...(Platform.OS === 'android' ? { channelId: ANDROID_CHANNEL } : {}),
          },
        }));
      }
    } catch (error) {
      await Promise.all(notificationIds.map((id) => cancelScheduledNotificationAsync(id)));
      throw error;
    }
  }

  const updatedSchedules = current.schedules.some((item) => item.id === reminder.id)
    ? current.schedules.map((item) => item.id === reminder.id
      ? { ...reminder, title, message, days, notificationIds }
      : item)
    : [...current.schedules, { ...reminder, title, message, days, notificationIds }];
  const legacyTime = updatedSchedules[0]
    ? {
      ...current.time,
      enabled: updatedSchedules[0].enabled,
      hour: updatedSchedules[0].hour,
      minute: updatedSchedules[0].minute,
      message: updatedSchedules[0].message,
      notificationId: updatedSchedules[0].notificationIds[0] ?? null,
    }
    : current.time;
  const updated = { ...current, time: legacyTime, schedules: updatedSchedules };
  try {
    await saveContextualReminders(updated);
  } catch (error) {
    await Promise.all(notificationIds.map((id) => cancelScheduledNotificationAsync(id)));
    throw error;
  }
  if (existing?.notificationIds.length) {
    await Promise.all(existing.notificationIds.map((id) => cancelScheduledNotificationAsync(id)));
  }
  return updated;
}

export async function saveHabitReminder(
  habitId: string,
  title: string,
  days: number[],
  time: string,
  enabled: boolean
) {
  const [hour, minute] = time.split(':').map(Number);
  const current = await loadContextualReminders();
  const reminderId = `habit:${habitId}`;
  const existing = current.schedules.find((schedule) => schedule.id === reminderId);
  return saveScheduledReminder(current, {
    id: reminderId,
    title: `Ton rituel · ${title}`,
    category: 'Habitude · Rituel personnalisé',
    message: `C’est le moment de prendre soin de ton rituel « ${title} », à ton rythme.`,
    hour,
    minute,
    days,
    enabled,
    notificationIds: existing?.notificationIds ?? [],
  });
}

export async function saveExerciseReminder(
  exerciseId: string,
  title: string,
  days: number[],
  time: string,
  enabled: boolean
) {
  const [hour, minute] = time.split(':').map(Number);
  const current = await loadContextualReminders();
  const reminderId = `exercise:${exerciseId}`;
  const existing = current.schedules.find((schedule) => schedule.id === reminderId);
  return saveScheduledReminder(current, {
    id: reminderId,
    title: `Ton exercice · ${title}`,
    category: 'Exercice · Rappel personnalisé',
    message: `C’est le moment de bouger avec « ${title} », à ton rythme.`,
    hour,
    minute,
    days,
    enabled,
    notificationIds: existing?.notificationIds ?? [],
  });
}

export async function deleteExerciseReminder(exerciseId: string) {
  const current = await loadContextualReminders();
  return deleteScheduledReminder(current, `exercise:${exerciseId}`);
}

export async function deleteScheduledReminder(
  current: ContextualReminders,
  reminderId: string
): Promise<ContextualReminders> {
  const reminder = current.schedules.find((item) => item.id === reminderId);
  const schedules = current.schedules.filter((item) => item.id !== reminderId);
  const updated = {
    ...current,
    schedules,
    time: schedules[0]
      ? {
        ...current.time,
        enabled: schedules[0].enabled,
        hour: schedules[0].hour,
        minute: schedules[0].minute,
        message: schedules[0].message,
        notificationId: schedules[0].notificationIds[0] ?? null,
      }
      : { ...current.time, enabled: false, notificationId: null },
  };
  await saveContextualReminders(updated);
  if (reminder?.notificationIds.length) {
    await Promise.all(reminder.notificationIds.map((id) => cancelScheduledNotificationAsync(id)));
  }
  return updated;
}

export async function saveLocationReminder(
  current: ContextualReminders,
  reminder: Omit<LocationReminder, 'latitude' | 'longitude'>,
): Promise<ContextualReminders> {
  if (!reminder.enabled) {
    if (Platform.OS !== 'web' && await Location.hasStartedGeofencingAsync(GEOFENCE_TASK)) {
      await Location.stopGeofencingAsync(GEOFENCE_TASK);
    }
    const updated = {
      ...current,
      location: { ...reminder, latitude: null, longitude: null },
    };
    await saveContextualReminders(updated);
    return updated;
  }

  if (Platform.OS === 'web') {
    throw new Error('Les rappels de localisation nécessitent l’application mobile installée.');
  }

  await ensureNotificationPermission();
  const foregroundPermission = await Location.requestForegroundPermissionsAsync();
  if (!foregroundPermission.granted) {
    throw new Error('Autorise l’accès à ta position pour définir ce rappel.');
  }

  const backgroundPermission = await Location.requestBackgroundPermissionsAsync();
  if (!backgroundPermission.granted) {
    throw new Error('Autorise la localisation en arrière-plan pour recevoir le rappel même lorsque Qozy est fermé.');
  }

  let latitude: number;
  let longitude: number;
  if (current.location.enabled
    && typeof current.location.latitude === 'number'
    && Number.isFinite(current.location.latitude)
    && typeof current.location.longitude === 'number'
    && Number.isFinite(current.location.longitude)) {
    latitude = current.location.latitude;
    longitude = current.location.longitude;
  } else {
    const position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    latitude = position.coords.latitude;
    longitude = position.coords.longitude;
  }
  const updated: ContextualReminders = {
    ...current,
    location: {
      ...reminder,
      latitude,
      longitude,
    },
  };

  await Location.startGeofencingAsync(GEOFENCE_TASK, [{
    identifier: GEOFENCE_ID,
    latitude,
    longitude,
    radius: 150,
    notifyOnEnter: true,
    notifyOnExit: false,
  }]);

  try {
    await saveContextualReminders(updated);
  } catch (error) {
    await Location.stopGeofencingAsync(GEOFENCE_TASK);
    throw error;
  }

  return updated;
}
