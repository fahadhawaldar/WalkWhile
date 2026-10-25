import { Platform } from 'react-native';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';

/**
 * Location updates that keep arriving with the phone locked in a pocket, so
 * the walk keeps tracking, timing and speaking. iOS shows the blue location
 * pill while this runs.
 */
const WALK_LOCATION_TASK = 'walkwhile-walk-location';

type Listener = (location: Location.LocationObject) => void;
const listeners = new Set<Listener>();

// Must be defined at module load, before the app renders, so iOS can deliver
// updates to it.
TaskManager.defineTask<{ locations: Location.LocationObject[] }>(
  WALK_LOCATION_TASK,
  async ({ data, error }) => {
    if (error || !data) return;
    for (const location of data.locations) {
      listeners.forEach((listener) => listener(location));
    }
  }
);

/** Asks to keep tracking with the screen off. False if the user says no. */
export async function requestBackgroundTracking(): Promise<boolean> {
  try {
    const { status } = await Location.requestBackgroundPermissionsAsync();
    return status === 'granted';
  } catch {
    return false;
  }
}

/**
 * Starts background updates and calls `onLocation` for each fix. Resolves to
 * a stop function, or null if background tracking is unavailable (the caller
 * then falls back to foreground-only tracking).
 */
export async function startBackgroundTracking(
  onLocation: Listener,
  options: { distanceInterval: number; timeInterval: number }
): Promise<(() => void) | null> {
  if (Platform.OS === 'web') return null;
  try {
    const { status } = await Location.getBackgroundPermissionsAsync();
    if (status !== 'granted') return null;
    listeners.add(onLocation);
    await Location.startLocationUpdatesAsync(WALK_LOCATION_TASK, {
      accuracy: Location.Accuracy.BestForNavigation,
      distanceInterval: options.distanceInterval,
      timeInterval: options.timeInterval,
      activityType: Location.ActivityType.Fitness,
      pausesUpdatesAutomatically: false,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: 'Walk in progress',
        notificationBody: 'WalkWhile is guiding you back on time.',
        notificationColor: '#123A2A',
      },
    });
    return () => {
      listeners.delete(onLocation);
      Location.stopLocationUpdatesAsync(WALK_LOCATION_TASK).catch(() => {});
    };
  } catch (err) {
    listeners.delete(onLocation);
    console.warn('Background location unavailable:', err);
    return null;
  }
}
