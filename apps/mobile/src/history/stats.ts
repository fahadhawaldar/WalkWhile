import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { learnProfile } from '../profile/pace';
import { useWalkStore } from '../store/useWalkStore';
import { fetchWalkHistory, HistoryWalk } from './walkHistory';

/** Walks a week that count as "a good week". */
export const WEEKLY_GOAL = 4;

export interface WalkStats {
  weekWalks: number;
  weekDistanceMeters: number;
  weekSteps: number;
  /** Consecutive days with a walk, ending today or yesterday. */
  streakDays: number;
  /** Whether today already has a walk (so the streak is safe for today). */
  walkedToday: boolean;
  totalWalks: number;
  /** Steps taken on WalkWhile walks today. */
  todayWalkSteps: number;
}

export function startOfWeek(now: Date): Date {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const daysSinceMonday = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - daysSinceMonday);
  return d;
}

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

export function computeStats(walks: Pick<HistoryWalk, 'startedAt' | 'distanceMeters' | 'steps'>[], now = new Date()): WalkStats {
  const weekStart = startOfWeek(now).getTime();
  const thisWeek = walks.filter((w) => new Date(w.startedAt).getTime() >= weekStart);

  const days = new Set(walks.map((w) => dayKey(new Date(w.startedAt))));
  const cursor = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const walkedToday = days.has(dayKey(cursor));
  const todayWalkSteps = walks
    .filter((w) => dayKey(new Date(w.startedAt)) === dayKey(cursor))
    .reduce((sum, w) => sum + w.steps, 0);
  // A streak survives until the end of the day after the last walk.
  if (!walkedToday) cursor.setDate(cursor.getDate() - 1);
  let streakDays = 0;
  while (days.has(dayKey(cursor))) {
    streakDays += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return {
    weekWalks: thisWeek.length,
    weekDistanceMeters: thisWeek.reduce((sum, w) => sum + w.distanceMeters, 0),
    weekSteps: thisWeek.reduce((sum, w) => sum + w.steps, 0),
    streakDays,
    walkedToday,
    totalWalks: walks.length,
    todayWalkSteps,
  };
}

/**
 * Stats from the latest page of history, refreshed whenever the screen comes
 * into focus. `extra` lets a screen count a walk that may not be saved yet.
 */
export function useWalkStats(extra?: Pick<HistoryWalk, 'startedAt' | 'distanceMeters' | 'steps'> | null) {
  const [walks, setWalks] = useState<HistoryWalk[] | null>(null);

  useFocusEffect(
    useCallback(() => {
      let live = true;
      fetchWalkHistory()
        .then((page) => {
          // Keep the learned pace and stride current with every new walk.
          // Offline, only unsynced walks are listed; don't learn from those.
          if (!page.offline) useWalkStore.getState().setLearned(learnProfile(page.walks));
          if (live) setWalks(page.walks);
        })
        .catch(() => live && setWalks([]));
      return () => {
        live = false;
      };
    }, [])
  );

  if (walks === null) return null;
  const all =
    extra && !walks.some((w) => w.startedAt === extra.startedAt) ? [extra, ...walks] : walks;
  return computeStats(all);
}
