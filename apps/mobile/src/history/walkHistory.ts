import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { WalkListResponse, WalkRecord } from '@walkwhile/shared';
import { authedFetch } from '../api/session';
import { useWalkStore } from '../store/useWalkStore';

// Finished walks waiting to reach the server, so none are lost offline.
const PENDING_KEY = 'walkwhile.pendingWalks';
// Walks this short were almost certainly started by mistake.
const MIN_SAVED_SECONDS = 30;

export interface HistoryWalk extends WalkRecord {
  /** Saved on the phone but not on the server yet. */
  pending?: boolean;
}

async function readPending(): Promise<WalkRecord[]> {
  try {
    const raw = await AsyncStorage.getItem(PENDING_KEY);
    return raw ? (JSON.parse(raw) as WalkRecord[]) : [];
  } catch {
    return [];
  }
}

async function writePending(walks: WalkRecord[]): Promise<void> {
  await AsyncStorage.setItem(PENDING_KEY, JSON.stringify(walks));
}

/** Builds the history record for the walk that just ended, from the store. */
function currentWalkRecord(completed: boolean): WalkRecord | null {
  const s = useWalkStore.getState();
  if (s.startTime === null) return null;
  const endedAt = Date.now();
  const durationSeconds = Math.round((endedAt - s.startTime) / 1000);
  if (durationSeconds < MIN_SAVED_SECONDS) return null;

  const route = s.generatedRoutes[s.selectedRouteIndex];
  return {
    id: Crypto.randomUUID(),
    startedAt: new Date(s.startTime).toISOString(),
    endedAt: new Date(endedAt).toISOString(),
    outcome: completed ? 'completed' : 'interrupted',
    waitType: s.waitType,
    plannedMinutes: s.availableMinutes,
    durationSeconds,
    distanceMeters: Math.round(s.distanceWalkedMeters),
    steps: s.stepCount,
    returnedOnTime: completed && durationSeconds <= s.availableMinutes * 60,
    origin: s.origin,
    routeCoordinates: (route?.geometry.coordinates ?? []) as [number, number][],
  };
}

/** Saves the walk that just ended, then tries to upload it. */
export async function recordFinishedWalk(completed: boolean): Promise<void> {
  const record = currentWalkRecord(completed);
  if (!record) return;
  await writePending([...(await readPending()), record]);
  syncPendingWalks().catch(() => {
    // Offline or server down: it stays queued for the next sync.
  });
}

let syncing: Promise<void> | null = null;

/** Uploads queued walks. Safe to call often; saves are idempotent. */
export function syncPendingWalks(): Promise<void> {
  syncing ??= (async () => {
    for (const walk of await readPending()) {
      const response = await authedFetch(`/api/v1/walks/${walk.id}`, {
        method: 'PUT',
        body: JSON.stringify(walk),
      });
      // Server errors are retried later; a rejected walk (bad data, id clash)
      // never will succeed, so drop it rather than block the queue.
      if (response.status >= 500) throw new Error(`Sync failed (${response.status})`);
      const remaining = (await readPending()).filter((w) => w.id !== walk.id);
      await writePending(remaining);
    }
  })().finally(() => {
    syncing = null;
  });
  return syncing;
}

/**
 * A page of history, newest first. The first page also includes walks still
 * waiting to sync, so a walk shows up even when finished offline.
 */
export async function fetchWalkHistory(
  before?: string
): Promise<{ walks: HistoryWalk[]; nextCursor: string | null; offline: boolean }> {
  if (!before) await syncPendingWalks().catch(() => {});
  const pending = before ? [] : await readPending();

  try {
    const query = new URLSearchParams({ limit: '50', ...(before ? { before } : {}) });
    const response = await authedFetch(`/api/v1/walks?${query}`);
    if (!response.ok) throw new Error(`History failed (${response.status})`);
    const page = (await response.json()) as WalkListResponse;
    const synced = new Set(page.walks.map((w) => w.id));
    const local = pending.filter((w) => !synced.has(w.id)).map((w) => ({ ...w, pending: true }));
    return {
      walks: [...local, ...page.walks].sort((a, b) => b.startedAt.localeCompare(a.startedAt)),
      nextCursor: page.nextCursor,
      offline: false,
    };
  } catch {
    return {
      walks: pending.map((w) => ({ ...w, pending: true })).reverse(),
      nextCursor: null,
      offline: true,
    };
  }
}

/** One walk, from the server or (if not synced yet) the phone. */
export async function getWalk(id: string): Promise<HistoryWalk | null> {
  const local = (await readPending()).find((w) => w.id === id);
  if (local) return { ...local, pending: true };
  const response = await authedFetch(`/api/v1/walks/${id}`);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error('Could not load the walk');
  return ((await response.json()) as { walk: WalkRecord }).walk;
}

export async function deleteWalk(id: string): Promise<void> {
  await writePending((await readPending()).filter((w) => w.id !== id));
  const response = await authedFetch(`/api/v1/walks/${id}`, { method: 'DELETE' });
  if (!response.ok && response.status !== 404) throw new Error('Could not delete the walk');
}
