import { useEffect, useRef, useState } from 'react';
import * as Location from 'expo-location';
import { Pedometer } from 'expo-sensors';
import { Coordinate, WalkingRoute } from '@walkwhile/shared';
import { useWalkStore } from '../store/useWalkStore';
import { bearingBetween, distanceBetween } from '../utils/location';

// Fixes less accurate than this still move the marker but don't count
// towards distance walked (GPS jitter would inflate it).
const MAX_ACCURACY_FOR_DISTANCE_METERS = 35;
// Ignore movements smaller than this (standing still with GPS drift).
const MIN_MOVE_METERS = 3;
// Loops pass near the start twice, so only search a window ahead of the
// last known progress point instead of the whole route.
const SEARCH_BEHIND = 5;
const SEARCH_AHEAD = 120;
// Average walking stride, for estimating steps on a simulated walk.
const STRIDE_METERS = 0.75;
// Compass readings arrive many times a second; skip changes smaller than this.
const MIN_HEADING_CHANGE_DEGREES = 5;

export interface WalkProgress {
  /** Index of the route coordinate the walker is closest to. */
  progressIndex: number;
  /** Distance from the walker to that coordinate. */
  offRouteMeters: number;
}

export interface WalkTracking extends WalkProgress {
  /** Direction the walker is facing, in degrees from North, once known. */
  heading: number | null;
}

function toCoordinate([longitude, latitude]: [number, number]): Coordinate {
  return { latitude, longitude };
}

/**
 * Follows the walker's position during an active walk (real GPS, or a
 * simulated walk along the route in development) and tracks progress.
 */
export function useWalkTracking(route: WalkingRoute | undefined): WalkTracking {
  const simulateWalk = useWalkStore((s) => s.simulateWalk);
  const updateCurrentPosition = useWalkStore((s) => s.updateCurrentPosition);
  const addWalkedDistance = useWalkStore((s) => s.addWalkedDistance);
  const currentPosition = useWalkStore((s) => s.currentPosition);
  const startTime = useWalkStore((s) => s.startTime);
  const distanceWalkedMeters = useWalkStore((s) => s.distanceWalkedMeters);
  const setStepCount = useWalkStore((s) => s.setStepCount);

  const [progress, setProgress] = useState<WalkProgress>({
    progressIndex: 0,
    offRouteMeters: 0,
  });
  const lastCounted = useRef<Coordinate | null>(null);
  const [heading, setHeading] = useState<number | null>(null);

  const updateHeading = (next: number) =>
    setHeading((prev) => {
      if (prev === null) return next;
      const diff = Math.abs(((next - prev + 540) % 360) - 180);
      return diff < MIN_HEADING_CHANGE_DEGREES ? prev : next;
    });

  // Position source: GPS or simulation.
  useEffect(() => {
    lastCounted.current = null;

    const accept = (pos: Coordinate, accuracy: number | null) => {
      updateCurrentPosition(pos);
      if (accuracy !== null && accuracy > MAX_ACCURACY_FOR_DISTANCE_METERS) {
        return;
      }
      if (lastCounted.current) {
        const moved = distanceBetween(lastCounted.current, pos);
        if (moved < MIN_MOVE_METERS) return;
        addWalkedDistance(moved);
      }
      lastCounted.current = pos;
    };

    if (simulateWalk) {
      if (!route) return;
      const coords = route.geometry.coordinates;
      const startedAt = Date.now();
      const timer = setInterval(() => {
        const ratio = Math.min(
          1,
          (Date.now() - startedAt) / 1000 / Math.max(1, route.calibratedDurationSeconds)
        );
        const idx = Math.min(coords.length - 1, Math.floor(ratio * (coords.length - 1)));
        const next = coords[Math.min(coords.length - 1, idx + 1)];
        if (next !== coords[idx]) {
          updateHeading(bearingBetween(toCoordinate(coords[idx]), toCoordinate(next)));
        }
        accept(toCoordinate(coords[idx]), null);
      }, 1000);
      return () => clearInterval(timer);
    }

    let subscription: Location.LocationSubscription | null = null;
    let headingSubscription: Location.LocationSubscription | null = null;
    let cancelled = false;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted' || cancelled) return;
      subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          distanceInterval: MIN_MOVE_METERS,
          timeInterval: 2000,
        },
        (loc) =>
          accept(
            { latitude: loc.coords.latitude, longitude: loc.coords.longitude },
            loc.coords.accuracy
          )
      );
      // The compass shows which way the phone points, even when standing still.
      headingSubscription = await Location.watchHeadingAsync((h) => {
        const value = h.trueHeading >= 0 ? h.trueHeading : h.magHeading;
        updateHeading(value);
      });
      if (cancelled) {
        subscription.remove();
        headingSubscription.remove();
      }
    })();

    return () => {
      cancelled = true;
      subscription?.remove();
      headingSubscription?.remove();
    };
  }, [simulateWalk, route, updateCurrentPosition, addWalkedDistance]);

  // Steps from the phone's motion coprocessor. Counting starts from the walk's
  // start time, so steps survive a reload of the app mid-walk.
  useEffect(() => {
    if (simulateWalk || startTime === null) return;
    let subscription: { remove: () => void } | null = null;
    let cancelled = false;
    (async () => {
      try {
        if (!(await Pedometer.isAvailableAsync())) return;
        const { granted } = await Pedometer.requestPermissionsAsync();
        if (!granted || cancelled) return;
        const { steps: before } = await Pedometer.getStepCountAsync(
          new Date(startTime),
          new Date()
        );
        if (cancelled) return;
        setStepCount(before);
        // watchStepCount reports steps since subscribing.
        subscription = Pedometer.watchStepCount(({ steps }) => setStepCount(before + steps));
      } catch (err) {
        console.warn('Step counting unavailable:', err);
      }
    })();
    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, [simulateWalk, startTime, setStepCount]);

  // A simulated walk has no real steps; estimate them from distance.
  useEffect(() => {
    if (simulateWalk) setStepCount(Math.round(distanceWalkedMeters / STRIDE_METERS));
  }, [simulateWalk, distanceWalkedMeters, setStepCount]);

  // Progress along the route.
  useEffect(() => {
    if (!route || !currentPosition) return;
    const coords = route.geometry.coordinates;
    setProgress((prev) => {
      const from = Math.max(0, prev.progressIndex - SEARCH_BEHIND);
      const to = Math.min(coords.length - 1, prev.progressIndex + SEARCH_AHEAD);
      let best = prev.progressIndex;
      let bestDistance = Infinity;
      for (let i = from; i <= to; i++) {
        const d = distanceBetween(currentPosition, toCoordinate(coords[i]));
        if (d < bestDistance) {
          bestDistance = d;
          best = i;
        }
      }
      return { progressIndex: best, offRouteMeters: bestDistance };
    });
  }, [route, currentPosition]);

  return { ...progress, heading };
}
