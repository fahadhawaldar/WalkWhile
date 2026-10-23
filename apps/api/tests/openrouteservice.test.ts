import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  OpenRouteServiceError,
  OpenRouteServiceProvider,
} from '../src/providers/openrouteservice.js';

describe('OpenRouteService Provider Client', () => {
  const mockApiKey = 'test-ors-api-key';
  let provider: OpenRouteServiceProvider;

  beforeEach(() => {
    provider = new OpenRouteServiceProvider({
      apiKey: mockApiKey,
      baseUrl: 'https://api.openrouteservice.org',
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('correctly maps ORS GeoJSON response into a ProviderRouteCandidate', async () => {
    const fakeOrsResponse = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: [
              [55.2708, 25.2048],
              [55.2718, 25.2058],
              [55.2708, 25.2048],
            ],
          },
          properties: {
            summary: {
              distance: 620.5,
              duration: 440.0,
            },
            segments: [
              {
                distance: 620.5,
                duration: 440.0,
                steps: [
                  {
                    distance: 310.0,
                    duration: 220.0,
                    type: 1,
                    instruction: 'Head north on Walkway',
                    name: 'Walkway',
                    way_points: [0, 1],
                  },
                ],
              },
            ],
          },
        },
      ],
    };

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => fakeOrsResponse,
    } as Response);

    const result = await provider.generateRoundTrip({
      origin: { latitude: 25.2048, longitude: 55.2708 },
      targetDistanceMeters: 625,
      seed: 42,
    });

    expect(result).not.toBeNull();
    expect(result?.distanceMeters).toBe(621);
    expect(result?.durationSeconds).toBe(440);
    expect(result?.type).toBe('loop');
    expect(result?.instructions.length).toBe(1);
    expect(result?.instructions[0].instruction).toBe('Head north on Walkway');
  });

  it('handles 429 rate limiting with a descriptive OpenRouteServiceError', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 429,
      json: async () => ({
        error: { message: 'Rate limit exceeded' },
      }),
    } as Response);

    await expect(
      provider.generateRoundTrip({
        origin: { latitude: 25.2048, longitude: 55.2708 },
        targetDistanceMeters: 625,
        seed: 1,
      })
    ).rejects.toThrow(OpenRouteServiceError);
  });

  it('throws an unauthorized error if API key is empty', async () => {
    const unauthenticatedProvider = new OpenRouteServiceProvider({
      apiKey: '',
    });

    await expect(
      unauthenticatedProvider.generateRoundTrip({
        origin: { latitude: 25.2048, longitude: 55.2708 },
        targetDistanceMeters: 625,
        seed: 1,
      })
    ).rejects.toThrow(/OPENROUTESERVICE_API_KEY is not configured/);
  });
});
