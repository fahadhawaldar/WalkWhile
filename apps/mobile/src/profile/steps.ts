import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Pedometer } from 'expo-sensors';

const DAY_MS = 24 * 60 * 60 * 1000;
// iOS keeps this many days of step history.
const HISTORY_DAYS = 7;
const GOAL_STEP = 500;
const MIN_GOAL = 3000;
const MAX_GOAL = 15000;
const FALLBACK_GOAL = 6000;

export function startOfToday(now = new Date()): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export function todayKey(now = new Date()): string {
  const d = startOfToday(now);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Rounds a goal to a tidy number in range. */
export function clampGoal(steps: number): number {
  return Math.min(MAX_GOAL, Math.max(MIN_GOAL, Math.ceil(steps / GOAL_STEP) * GOAL_STEP));
}

export const GOAL_INCREMENT = GOAL_STEP;

/** Whole-day step history from the phone's motion chip; iOS only. */
async function pedometerReady(request: boolean): Promise<boolean> {
  if (Platform.OS !== 'ios') return false;
  try {
    if (!(await Pedometer.isAvailableAsync())) return false;
    const permission = request
      ? await Pedometer.requestPermissionsAsync()
      : await Pedometer.getPermissionsAsync();
    return permission.granted;
  } catch {
    return false;
  }
}

/**
 * A goal a little above the walker's recent average, so it is reachable.
 * Asks for motion access if needed. Falls back to a gentle default.
 */
export async function suggestStepGoal(): Promise<{ goal: number; averageSteps: number | null }> {
  if (!(await pedometerReady(true))) return { goal: FALLBACK_GOAL, averageSteps: null };
  const today = startOfToday();
  const days: number[] = [];
  for (let i = 1; i <= HISTORY_DAYS; i++) {
    const start = new Date(today.getTime() - i * DAY_MS);
    const end = new Date(start.getTime() + DAY_MS);
    try {
      const { steps } = await Pedometer.getStepCountAsync(start, end);
      // Zero usually means the phone stayed home, not a day without walking.
      if (steps > 0) days.push(steps);
    } catch {
      // Older than iOS keeps; stop here.
      break;
    }
  }
  if (days.length === 0) return { goal: FALLBACK_GOAL, averageSteps: null };
  const average = Math.round(days.reduce((a, b) => a + b, 0) / days.length);
  return { goal: clampGoal(average * 1.1), averageSteps: average };
}

/**
 * Steps taken today, all day (not only on walks), updating live while the
 * screen is open. Null where the phone can't report them (Android,
 * simulator, or motion access not granted).
 */
export function useTodaySteps(): { steps: number | null; refresh: () => void } {
  const [steps, setSteps] = useState<number | null>(null);
  const [nonce, setNonce] = useState(0);
  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  useFocusEffect(
    useCallback(() => {
      let live = true;
      let subscription: { remove: () => void } | null = null;
      (async () => {
        if (!(await pedometerReady(false))) return;
        try {
          const { steps: before } = await Pedometer.getStepCountAsync(startOfToday(), new Date());
          if (!live) return;
          setSteps(before);
          subscription = Pedometer.watchStepCount(({ steps: since }) => {
            if (live) setSteps(before + since);
          });
        } catch {
          // Leave it unknown.
        }
      })();
      return () => {
        live = false;
        subscription?.remove();
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [nonce])
  );

  return { steps, refresh };
}

/** Whether the phone could report whole-day steps if asked. */
export function useStepsSupported(): boolean {
  const [supported, setSupported] = useState(false);
  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    Pedometer.isAvailableAsync()
      .then(setSupported)
      .catch(() => setSupported(false));
  }, []);
  return supported;
}
