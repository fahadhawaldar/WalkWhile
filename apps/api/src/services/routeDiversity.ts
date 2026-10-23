import { GeoJSONPosition } from '@walkwhile/shared';
import { DEFAULTS } from '@walkwhile/shared';
import {
  pointToSegmentDistance,
  sampleLineString,
} from '../utils/geo.js';

/**
 * Checks if a single point lies within bufferMeters of any segment in a line string.
 */
function isPointNearLineString(
  point: GeoJSONPosition,
  lineCoordinates: GeoJSONPosition[],
  bufferMeters: number
): boolean {
  if (lineCoordinates.length < 2) return false;

  for (let i = 0; i < lineCoordinates.length - 1; i++) {
    const segStart = lineCoordinates[i];
    const segEnd = lineCoordinates[i + 1];
    const dist = pointToSegmentDistance(point, segStart, segEnd);
    if (dist <= bufferMeters) {
      return true;
    }
  }

  return false;
}

/**
 * Calculates the spatial overlap ratio between two route coordinate geometries.
 * Returns a value between 0.0 (completely distinct) and 1.0 (identical paths).
 *
 * It samples points every 20 meters along each route and checks if they fall within
 * a pedestrian buffer corridor (default 25m) of the other route.
 */
export function calculateSpatialOverlap(
  coordsA: GeoJSONPosition[],
  coordsB: GeoJSONPosition[],
  bufferMeters: number = DEFAULTS.SPATIAL_BUFFER_DISTANCE_METERS,
  stepMeters = 20
): number {
  if (coordsA.length < 2 || coordsB.length < 2) return 0;

  const samplesA = sampleLineString(coordsA, stepMeters);
  const samplesB = sampleLineString(coordsB, stepMeters);

  if (samplesA.length === 0 || samplesB.length === 0) return 0;

  // Fraction of Route A that lies along Route B's corridor
  let overlappingPointsA = 0;
  for (const pt of samplesA) {
    if (isPointNearLineString(pt, coordsB, bufferMeters)) {
      overlappingPointsA++;
    }
  }
  const ratioA = overlappingPointsA / samplesA.length;

  // Fraction of Route B that lies along Route A's corridor
  let overlappingPointsB = 0;
  for (const pt of samplesB) {
    if (isPointNearLineString(pt, coordsA, bufferMeters)) {
      overlappingPointsB++;
    }
  }
  const ratioB = overlappingPointsB / samplesB.length;

  // Overlap is the maximum directional overlap
  return Math.max(ratioA, ratioB);
}

export interface CandidateWithGeometry {
  geometry: {
    coordinates: GeoJSONPosition[];
  };
  distanceMeters: number;
  durationSeconds: number;
}

/**
 * Filters a list of candidate routes to ensure spatial diversity.
 * Removes routes that share more than maxOverlapRatio (default 65%) with an already-selected route.
 * Selects up to maxRoutes (default 3) distinct candidates.
 */
export function filterDiverseCandidates<T extends CandidateWithGeometry>(
  candidates: T[],
  maxRoutes: number = DEFAULTS.MAX_ROUTES,
  maxOverlapRatio: number = DEFAULTS.MAX_ROUTE_OVERLAP_RATIO
): T[] {
  if (candidates.length <= 1) return candidates.slice(0, maxRoutes);

  const selected: T[] = [];

  for (const candidate of candidates) {
    if (selected.length >= maxRoutes) break;

    // Check overlap with all previously selected routes
    let isTooSimilar = false;
    for (const chosen of selected) {
      const overlap = calculateSpatialOverlap(
        candidate.geometry.coordinates,
        chosen.geometry.coordinates
      );

      if (overlap >= maxOverlapRatio) {
        isTooSimilar = true;
        break;
      }
    }

    if (!isTooSimilar) {
      selected.push(candidate);
    }
  }

  return selected;
}
