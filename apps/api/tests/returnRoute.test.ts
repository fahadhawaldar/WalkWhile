import { describe, expect, it } from 'vitest';
import { ReturnRouteRequest } from '@walkwhile/shared';
import { MockRoutingProvider } from '../src/providers/mockProvider.js';
import { calculateReturnRoute } from '../src/services/returnRoute.js';

describe('Return Route Calculation Service', () => {
  const originalOrigin = {
    latitude: 25.2048,
    longitude: 55.2708,
  };

  // User walked 300m away
  const currentLocation = {
    latitude: 25.2070,
    longitude: 55.2720,
  };

  it('calculates return path and marks status as safe when plenty of time remains', async () => {
    const provider = new MockRoutingProvider();

    const request: ReturnRouteRequest = {
      originalOrigin,
      currentLocation,
      remainingMinutes: 8,
      walkingSpeedKmh: 5,
      safetyBufferMinutes: 2.5,
    };

    const result = await calculateReturnRoute(request, provider);

    expect(result.originalOrigin).toEqual(originalOrigin);
    expect(result.currentLocation).toEqual(currentLocation);
    expect(result.status).toBe('safe');
    expect(result.recommendedAction).toBe('continue');
    expect(result.safetyMarginSeconds).toBeGreaterThan(0);
    expect(result.route.geometry.type).toBe('LineString');
  });

  it('triggers head_back_now warning when safety buffer is reached', async () => {
    const provider = new MockRoutingProvider();

    // With a return trip taking ~4-5 minutes, having only 6 minutes left eats into the 2.5m buffer
    const request: ReturnRouteRequest = {
      originalOrigin,
      currentLocation,
      remainingMinutes: 5.5,
      walkingSpeedKmh: 5,
      safetyBufferMinutes: 2.5,
    };

    const result = await calculateReturnRoute(request, provider);

    expect(['warning', 'urgent']).toContain(result.status);
    expect(['head_back_now', 'turn_around_immediately']).toContain(
      result.recommendedAction
    );
  });
});
