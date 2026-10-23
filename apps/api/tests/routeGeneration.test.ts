import { describe, expect, it } from 'vitest';
import { GenerateRoutesRequest } from '@walkwhile/shared';
import { MockRoutingProvider } from '../src/providers/mockProvider.js';
import { generateWalkingRoutes } from '../src/services/routeGeneration.js';
import { haversineDistance } from '../src/utils/geo.js';

describe('Route Generation Service', () => {
  const difcOrigin = {
    latitude: 25.2048,
    longitude: 55.2708,
  };

  it('generates up to 3 validated, distinct routes for a 10-minute budget', async () => {
    const provider = new MockRoutingProvider();

    const request: GenerateRoutesRequest = {
      origin: difcOrigin,
      availableMinutes: 10,
      walkingSpeedKmh: 5,
      safetyBufferMinutes: 2.5,
      maxRoutes: 3,
      waitType: 'fixed',
      maxReturnMinutes: 3,
    };

    const result = await generateWalkingRoutes(request, provider);

    expect(result.origin).toEqual(difcOrigin);
    expect(result.walkingBudgetMinutes).toBe(7.5);
    expect(result.targetDistanceMeters).toBe(625);
    expect(result.routes.length).toBeGreaterThanOrEqual(1);
    expect(result.routes.length).toBeLessThanOrEqual(3);

    // Verify each generated route meets all specifications
    for (const route of result.routes) {
      expect(route.geometry.type).toBe('LineString');
      expect(route.geometry.coordinates.length).toBeGreaterThanOrEqual(4);

      // Verify route genuinely starts and ends near origin (< 150m tolerance)
      const startCoord = route.geometry.coordinates[0];
      const endCoord =
        route.geometry.coordinates[route.geometry.coordinates.length - 1];

      const startDist = haversineDistance(startCoord, difcOrigin);
      const endDist = haversineDistance(endCoord, difcOrigin);

      expect(startDist).toBeLessThanOrEqual(150);
      expect(endDist).toBeLessThanOrEqual(150);

      // Verify duration plus safety buffer strictly fits available time
      const totalMinutes =
        route.calibratedDurationSeconds / 60 + request.safetyBufferMinutes;
      expect(totalMinutes).toBeLessThanOrEqual(request.availableMinutes);

      // Verify instructions exist
      expect(route.instructions.length).toBeGreaterThan(0);
    }
  });

  it('falls back to out-and-back routes when loops are unavailable', async () => {
    const provider = new MockRoutingProvider();
    // Simulate provider where circular loops fail (e.g., cul-de-sac or linear corridor)
    provider.generateRoundTrip = async () => null;

    const request: GenerateRoutesRequest = {
      origin: difcOrigin,
      availableMinutes: 10,
      walkingSpeedKmh: 5,
      safetyBufferMinutes: 2.5,
      maxRoutes: 3,
      waitType: 'fixed',
      maxReturnMinutes: 3,
    };

    const result = await generateWalkingRoutes(request, provider);

    expect(result.routes.length).toBeGreaterThanOrEqual(1);
    expect(result.routes.some((r) => r.type === 'out_and_back')).toBe(true);
    expect(
      result.warnings.some((w) => w.includes('out-and-back paths'))
    ).toBe(true);
  });

  it('returns clean explanation message when provider fails entirely', async () => {
    const provider = new MockRoutingProvider();
    provider.shouldFail = true;

    const request: GenerateRoutesRequest = {
      origin: difcOrigin,
      availableMinutes: 10,
      walkingSpeedKmh: 5,
      safetyBufferMinutes: 2.5,
      maxRoutes: 3,
      waitType: 'fixed',
      maxReturnMinutes: 3,
    };

    const result = await generateWalkingRoutes(request, provider);

    expect(result.routes.length).toBe(0);
    expect(result.message).toContain('No suitable pedestrian routes');
  });
});
