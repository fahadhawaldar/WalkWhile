import { describe, expect, it } from 'vitest';
import { GeoJSONPosition } from '@walkwhile/shared';
import {
  calculateSpatialOverlap,
  filterDiverseCandidates,
} from '../src/services/routeDiversity.js';

describe('Spatial Route Overlap Detection', () => {
  // Origin around DIFC Dubai: [55.2708, 25.2048]
  const origin: GeoJSONPosition = [55.2708, 25.2048];

  // Route A: Loop heading North-East
  const routeA: GeoJSONPosition[] = [
    origin,
    [55.2718, 25.2058],
    [55.2728, 25.2058],
    [55.2728, 25.2048],
    origin,
  ];

  // Identical to Route A
  const routeAIdentical: GeoJSONPosition[] = [
    origin,
    [55.2718, 25.2058],
    [55.2728, 25.2058],
    [55.2728, 25.2048],
    origin,
  ];

  // Route B: Completely separate loop heading South-West (500m away)
  const routeB: GeoJSONPosition[] = [
    origin,
    [55.2658, 25.2008],
    [55.2648, 25.2008],
    [55.2648, 25.2018],
    origin,
  ];

  it('detects 100% overlap for identical route geometries', () => {
    const overlap = calculateSpatialOverlap(routeA, routeAIdentical);
    expect(overlap).toBeGreaterThanOrEqual(0.95);
  });

  it('detects low/no overlap for geographically separated loops', () => {
    const overlap = calculateSpatialOverlap(routeA, routeB);
    // Overlap should be low (only near the origin start point)
    expect(overlap).toBeLessThan(0.35);
  });

  it('filters out redundant routes sharing more than 65% corridor overlap', () => {
    const candidate1 = {
      id: '1',
      geometry: { coordinates: routeA },
      distanceMeters: 600,
      durationSeconds: 400,
    };
    const candidate2Duplicate = {
      id: '2',
      geometry: { coordinates: routeAIdentical },
      distanceMeters: 605,
      durationSeconds: 405,
    };
    const candidate3Distinct = {
      id: '3',
      geometry: { coordinates: routeB },
      distanceMeters: 610,
      durationSeconds: 410,
    };

    const candidates = [candidate1, candidate2Duplicate, candidate3Distinct];
    const filtered = filterDiverseCandidates(candidates, 3, 0.65);

    expect(filtered.length).toBe(2);
    expect(filtered.map((c) => c.id)).toEqual(['1', '3']);
  });
});
