import { useEffect, useRef } from 'react';
import { Coordinate, ReturnRouteStatus, RouteStep, WalkingRoute } from '@walkwhile/shared';
import { speak, stopSpeaking } from '../../modules/walk-voice';
import { distanceBetween } from '../utils/location';

// Announce a turn when the walker gets this close to it.
const TURN_AHEAD_METERS = 25;
// Minutes-left callouts while things are on track.
const TIME_CALLOUTS_MINUTES = [5, 2];
// Don't repeat the off-route warning more often than this.
const OFF_ROUTE_REPEAT_MS = 90_000;

interface VoiceGuidanceInput {
  enabled: boolean;
  /** Walking or returning; nothing is spoken otherwise. */
  active: boolean;
  /** The route being followed now: the walk, or the way back once returning. */
  guideRoute: WalkingRoute | null | undefined;
  steps: RouteStep[];
  stepIndex: number;
  currentPosition: Coordinate | null;
  remainingSeconds: number;
  availableMinutes: number;
  status: ReturnRouteStatus;
  returnMinutes: number | null;
  offRoute: boolean;
}

function lowerFirst(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1);
}

/**
 * Speaks the walk: the start, each upcoming turn, minutes left, and return
 * warnings. Works with the screen locked as long as background location is
 * keeping the app awake.
 */
export function useVoiceGuidance({
  enabled,
  active,
  guideRoute,
  steps,
  stepIndex,
  currentPosition,
  remainingSeconds,
  availableMinutes,
  status,
  returnMinutes,
  offRoute,
}: VoiceGuidanceInput) {
  const say = (text: string) => {
    if (enabled && active) speak(text);
  };

  // Stop mid-sentence when muted or the walk ends.
  useEffect(() => {
    if (!enabled || !active) stopSpeaking();
  }, [enabled, active]);
  useEffect(() => () => stopSpeaking(), []);

  // Start.
  const started = useRef(false);
  useEffect(() => {
    if (started.current || !active) return;
    started.current = true;
    const first = steps[0]?.instruction;
    say(`Walk started. You have ${availableMinutes} minutes.${first ? ` ${first}.` : ''}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  // Upcoming turns: announce each turn once, just before reaching it. On
  // the way back there is no progress index, so any step ahead may be next.
  // Turns are keyed by place, because the way back is recomputed (with a new
  // id) every few seconds.
  const announced = useRef(new Set<string>());
  useEffect(() => {
    if (!guideRoute || !currentPosition) return;
    const coords = guideRoute.geometry.coordinates;
    for (let i = stepIndex + 1; i < steps.length; i++) {
      const at = coords[steps[i].waypointIndices[0]];
      if (!at) continue;
      const key = `${at[0].toFixed(4)},${at[1].toFixed(4)}`;
      if (announced.current.has(key)) continue;
      const meters = distanceBetween(currentPosition, { latitude: at[1], longitude: at[0] });
      if (meters > TURN_AHEAD_METERS) continue;
      announced.current.add(key);
      const instruction = steps[i].instruction;
      say(meters < 10 ? `${instruction}.` : `In ${Math.round(meters / 5) * 5} meters, ${lowerFirst(instruction)}.`);
      return;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guideRoute, steps, stepIndex, currentPosition]);

  // Return status: say it whenever it gets more serious.
  const lastStatus = useRef<ReturnRouteStatus>(status);
  useEffect(() => {
    const order: ReturnRouteStatus[] = ['safe', 'warning', 'urgent', 'overdue'];
    const worse = order.indexOf(status) > order.indexOf(lastStatus.current);
    lastStatus.current = status;
    if (!worse) return;
    const back = returnMinutes !== null ? ` About ${returnMinutes} minutes to your spot.` : '';
    if (status === 'warning') say(`Time to start heading back.${back}`);
    else if (status === 'urgent') say(`Head back now.${back}`);
    else if (status === 'overdue') say("You're running late. Head straight back.");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  // Minutes left, while on track (warnings above cover the rest).
  const spokenMinutes = useRef(new Set<number>());
  useEffect(() => {
    if (remainingSeconds === 0 && !spokenMinutes.current.has(0)) {
      spokenMinutes.current.add(0);
      say("Time's up.");
      return;
    }
    if (status !== 'safe') return;
    for (const m of TIME_CALLOUTS_MINUTES) {
      if (availableMinutes <= m + 1 || spokenMinutes.current.has(m)) continue;
      if (remainingSeconds <= m * 60 && remainingSeconds > m * 60 - 15) {
        spokenMinutes.current.add(m);
        say(`${m} minutes left.`);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remainingSeconds]);

  // Off route, at most once in a while.
  const lastOffRoute = useRef(0);
  useEffect(() => {
    if (!offRoute) return;
    if (Date.now() - lastOffRoute.current < OFF_ROUTE_REPEAT_MS) return;
    lastOffRoute.current = Date.now();
    say("You're off the route. That's fine, just keep an eye on the time.");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offRoute]);

  return { say };
}
