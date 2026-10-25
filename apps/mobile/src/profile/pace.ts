import { DEFAULTS, WalkRecord } from '@walkwhile/shared';
import { LearnedProfile } from '../store/useWalkStore';

// A walk counts towards pace only if it was a real walk.
const MIN_SECONDS = 3 * 60;
const MIN_METERS = 200;
// Outside this range it was mostly standing, or the GPS jumped.
const MIN_KMH = 2.5;
const MAX_KMH = 7.5;
/** Walks needed before the learned pace replaces the default. */
export const WALKS_TO_LEARN = 3;
const RECENT_WALKS = 10;
// Stride outside this range means the step count or distance is off.
const MIN_STRIDE = 0.4;
const MAX_STRIDE = 1.1;
export const DEFAULT_STRIDE_METERS = 0.75;

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Learns walking pace and stride from finished walks, newest first.
 *
 * Route times are planned as distance / speed plus a crossing allowance per
 * km, so the allowance is taken out of each walk's time here; otherwise
 * crossings would be counted twice.
 */
export function learnProfile(
  walks: Pick<WalkRecord, 'outcome' | 'durationSeconds' | 'distanceMeters' | 'steps'>[]
): LearnedProfile {
  const real = walks.filter(
    (w) =>
      w.outcome === 'completed' &&
      w.durationSeconds >= MIN_SECONDS &&
      w.distanceMeters >= MIN_METERS
  );

  const speeds: number[] = [];
  for (const w of real) {
    const crossingSeconds =
      (w.distanceMeters / 1000) * DEFAULTS.PEDESTRIAN_INTERSECTION_ALLOWANCE_PER_KM_SECONDS;
    const movingSeconds = w.durationSeconds - crossingSeconds;
    if (movingSeconds <= 0) continue;
    const kmh = (w.distanceMeters / movingSeconds) * 3.6;
    if (kmh >= MIN_KMH && kmh <= MAX_KMH) speeds.push(kmh);
    if (speeds.length === RECENT_WALKS) break;
  }

  const withSteps = real.filter((w) => w.steps > 0).slice(0, RECENT_WALKS);
  const steps = withSteps.reduce((sum, w) => sum + w.steps, 0);
  const meters = withSteps.reduce((sum, w) => sum + w.distanceMeters, 0);
  const stride = steps > 0 ? meters / steps : null;

  return {
    paceKmh:
      speeds.length >= WALKS_TO_LEARN ? Math.round(median(speeds) * 10) / 10 : null,
    paceWalks: speeds.length,
    strideMeters:
      stride !== null && stride >= MIN_STRIDE && stride <= MAX_STRIDE
        ? Math.round(stride * 100) / 100
        : null,
  };
}
