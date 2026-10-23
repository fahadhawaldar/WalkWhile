/**
 * Decides which OpenStreetMap ways a pedestrian can use, and how much the
 * route planner should prefer them.
 *
 * The cost factor multiplies an edge's length when choosing routes (lower is
 * nicer to walk). Reported distances always use the real length.
 */

export type Tags = Record<string, string>;

export enum EdgeKind {
  Road = 0,
  Footway = 1,
  Steps = 2,
  Crossing = 3,
  Path = 4,
  Pedestrian = 5,
}

export interface WalkabilityResult {
  costFactor: number;
  kind: EdgeKind;
}

/**
 * The lowest cost factor any edge can have. Path searches rely on this to
 * keep their straight-line heuristic admissible.
 */
export const MIN_COST_FACTOR = 0.9;

const EXCLUDED_HIGHWAYS = new Set([
  'motorway',
  'motorway_link',
  'trunk',
  'trunk_link',
  'construction',
  'proposed',
  'abandoned',
  'raceway',
  'bus_guideway',
  'busway',
  'escape',
  'corridor',
  'platform',
  'elevator',
  'rest_area',
  'services',
]);

const BASE_COST: Record<string, number> = {
  pedestrian: 0.9,
  footway: 0.9,
  living_street: 0.9,
  path: 1.0,
  track: 1.1,
  cycleway: 1.3,
  residential: 1.1,
  service: 1.2,
  unclassified: 1.1,
  road: 1.2,
  steps: 1.2,
  tertiary: 1.4,
  tertiary_link: 1.4,
  secondary: 1.8,
  secondary_link: 1.8,
  primary: 2.5,
  primary_link: 2.5,
};

const ROAD_HIGHWAYS = new Set([
  'residential',
  'service',
  'unclassified',
  'road',
  'tertiary',
  'tertiary_link',
  'secondary',
  'secondary_link',
  'primary',
  'primary_link',
]);

const FOOT_ALLOWED = new Set(['yes', 'designated', 'permissive']);

export function assessWalkability(tags: Tags): WalkabilityResult | null {
  const highway = tags.highway;
  if (!highway || EXCLUDED_HIGHWAYS.has(highway)) return null;

  const base = BASE_COST[highway];
  if (base === undefined) return null;

  const foot = tags.foot;
  if (foot === 'no' || foot === 'use_sidepath') return null;

  const access = tags.access;
  if (
    (access === 'no' || access === 'private') &&
    !(foot && FOOT_ALLOWED.has(foot))
  ) {
    return null;
  }

  if (tags.indoor === 'yes') return null;
  if (tags.area === 'yes' && highway !== 'pedestrian' && highway !== 'footway') {
    return null;
  }

  const isRoad = ROAD_HIGHWAYS.has(highway);
  if (isRoad && tags.tunnel === 'yes') return null;

  if (highway === 'service') {
    const service = tags.service;
    if (service === 'driveway' || service === 'drive-through') return null;
  }

  let costFactor = base;
  if (isRoad) {
    const sidewalk = tags.sidewalk ?? tags['sidewalk:both'];
    if (sidewalk === 'no' || sidewalk === 'none') {
      costFactor *= 1.5;
    } else if (
      sidewalk === 'both' ||
      sidewalk === 'left' ||
      sidewalk === 'right' ||
      sidewalk === 'yes' ||
      sidewalk === 'separate'
    ) {
      costFactor = Math.max(1.0, costFactor * 0.85);
    }
  }

  if (foot === 'designated' && !isRoad) {
    costFactor = Math.min(costFactor, 0.9);
  }

  return { costFactor, kind: classifyKind(highway, tags) };
}

function classifyKind(highway: string, tags: Tags): EdgeKind {
  if (highway === 'steps') return EdgeKind.Steps;
  if (tags.footway === 'crossing' || tags.cycleway === 'crossing') {
    return EdgeKind.Crossing;
  }
  if (highway === 'pedestrian') return EdgeKind.Pedestrian;
  if (highway === 'footway') return EdgeKind.Footway;
  if (highway === 'path' || highway === 'track' || highway === 'cycleway') {
    return EdgeKind.Path;
  }
  return EdgeKind.Road;
}

/**
 * Picks a display name, preferring English (most visitors and residents in
 * Dubai read street signs in English).
 */
export function pickName(tags: Tags): string | null {
  return tags['name:en'] ?? tags.name ?? tags.ref ?? null;
}
