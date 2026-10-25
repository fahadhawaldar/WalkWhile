import { WalkingRoute } from '@walkwhile/shared';

const UNNAMED = /^(|-|unnamed|unnamed road|footway|path|sidewalk|pedestrian path)$/i;

/**
 * A human name for a route from the street it spends longest on, e.g.
 * "Loop via Al Saada St". Falls back to "Loop 2".
 */
export function routeName(route: WalkingRoute, index: number): string {
  const shape = route.type === 'loop' ? 'Loop' : 'Out & back';
  const byStreet = new Map<string, number>();
  for (const step of route.instructions ?? []) {
    const name = step.name?.trim() ?? '';
    if (UNNAMED.test(name)) continue;
    byStreet.set(name, (byStreet.get(name) ?? 0) + step.distanceMeters);
  }
  let best: string | null = null;
  let bestMeters = 0;
  for (const [name, meters] of byStreet) {
    if (meters > bestMeters) {
      best = name;
      bestMeters = meters;
    }
  }
  return best ? `${shape} via ${best}` : `${shape} ${index + 1}`;
}

export function minutesOf(seconds: number): number {
  return Math.max(1, Math.round(seconds / 60));
}
