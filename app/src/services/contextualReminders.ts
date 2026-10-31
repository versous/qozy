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

export type ContextualReminders = {
  time: TimeReminder;
  location: LocationReminder;
};

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
  if (!stored) return DEFAULT_REMINDERS;

  const parsed = JSON.parse(stored) as Partial<ContextualReminders>;
  return {
    time: { ...DEFAULT_REMINDERS.time, ...parsed.time },
    location: { ...DEFAULT_REMINDERS.location, ...parsed.location },
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
