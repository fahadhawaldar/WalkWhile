import { RouteStep } from '@walkwhile/shared';
import {
  IRoutingProvider,
  ProviderOutAndBackParams,
  ProviderReturnParams,
  ProviderRoundTripParams,
  ProviderRouteCandidate,
} from './types.js';

interface OrsStep {
  distance: number;
  duration: number;
  type: number | string;
  instruction: string;
  name: string;
  way_points: [number, number];
}

interface OrsSegment {
  distance: number;
  duration: number;
  steps?: OrsStep[];
}

interface OrsFeature {
  type: 'Feature';
  geometry: {
    type: 'LineString';
    coordinates: [number, number][];
  };
  properties: {
    summary: {
      distance: number;
      duration: number;
    };
    segments?: OrsSegment[];
  };
}

interface OrsFeatureCollection {
  type: 'FeatureCollection';
  features: OrsFeature[];
}

export class OpenRouteServiceError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public details?: unknown
  ) {
    super(message);
    this.name = 'OpenRouteServiceError';
  }
}

export class OpenRouteServiceProvider implements IRoutingProvider {
  public readonly name = 'openrouteservice';
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly timeoutMs: number;

  constructor(options: {
    apiKey: string;
    baseUrl?: string;
    timeoutMs?: number;
  }) {
    this.apiKey = options.apiKey;
    this.baseUrl = (
      options.baseUrl ?? 'https://api.openrouteservice.org'
    ).replace(/\/$/, '');
    this.timeoutMs = options.timeoutMs ?? 12000;
  }

  private async postDirections(
    payload: Record<string, unknown>
  ): Promise<OrsFeatureCollection> {
    if (!this.apiKey) {
      throw new OpenRouteServiceError(
        'OPENROUTESERVICE_API_KEY is not configured',
        401
      );
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(
        `${this.baseUrl}/v2/directions/foot-walking/geojson`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            Accept: 'application/json, application/geo+json',
            Authorization: this.apiKey,
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        }
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        let errorDetails: unknown = null;
        try {
          errorDetails = await response.json();
        } catch {
          errorDetails = await response.text();
        }

        if (response.status === 429) {
          throw new OpenRouteServiceError(
            'OpenRouteService rate limit exceeded. Please try again shortly.',
            429,
            errorDetails
          );
        }

        if (response.status === 401 || response.status === 403) {
          throw new OpenRouteServiceError(
            'Invalid OpenRouteService API key or unauthorized request.',
            response.status,
            errorDetails
          );
        }

        const msg =
          typeof errorDetails === 'object' &&
          errorDetails &&
          'error' in errorDetails &&
          typeof (errorDetails as { error?: { message?: string } }).error
            ?.message === 'string'
            ? (errorDetails as { error: { message: string } }).error.message
            : `OpenRouteService request failed with status ${response.status}`;

        throw new OpenRouteServiceError(msg, response.status, errorDetails);
      }

      const data = (await response.json()) as OrsFeatureCollection;
      return data;
    } catch (err: unknown) {
      clearTimeout(timeoutId);
      if (err instanceof OpenRouteServiceError) {
        throw err;
      }
      if (err && typeof err === 'object' && 'name' in err && err.name === 'AbortError') {
        throw new OpenRouteServiceError(
          'OpenRouteService request timed out',
          504
        );
      }
      throw new OpenRouteServiceError(
        `Failed to reach OpenRouteService: ${(err as Error).message}`,
        502,
        err
      );
    }
  }

  private mapFeatureToCandidate(
    feature: OrsFeature,
    type: 'loop' | 'out_and_back',
    seed?: number
  ): ProviderRouteCandidate | null {
    if (
      !feature.geometry ||
      feature.geometry.type !== 'LineString' ||
      !Array.isArray(feature.geometry.coordinates) ||
      feature.geometry.coordinates.length < 2
    ) {
      return null;
    }

    const summary = feature.properties?.summary;
    const distanceMeters = summary?.distance ?? 0;
    const durationSeconds = summary?.duration ?? 0;

    const instructions: RouteStep[] = [];
    const segments = feature.properties?.segments;
    if (Array.isArray(segments)) {
      for (const segment of segments) {
        if (Array.isArray(segment.steps)) {
          for (const step of segment.steps) {
            instructions.push({
              instruction: step.instruction,
              distanceMeters: step.distance,
              durationSeconds: step.duration,
              type: step.type,
              name: step.name || 'Pedestrian Path',
              waypointIndices: step.way_points,
            });
          }
        }
      }
    }

    return {
      geometry: {
        type: 'LineString',
        coordinates: feature.geometry.coordinates,
      },
      distanceMeters: Math.round(distanceMeters),
      durationSeconds: Math.round(durationSeconds),
      instructions,
      type,
      seed,
      providerRaw: feature,
    };
  }

  async generateRoundTrip(
    params: ProviderRoundTripParams
  ): Promise<ProviderRouteCandidate | null> {
    const payload = {
      coordinates: [[params.origin.longitude, params.origin.latitude]],
      options: {
        round_trip: {
          length: Math.round(params.targetDistanceMeters),
          points: params.points ?? 5,
          seed: params.seed,
        },
      },
      instructions: true,
      language: 'en',
    };

    const data = await this.postDirections(payload);
    if (!data.features || data.features.length === 0) {
      return null;
    }

    return this.mapFeatureToCandidate(data.features[0], 'loop', params.seed);
  }

  async generateOutAndBack(
    params: ProviderOutAndBackParams
  ): Promise<ProviderRouteCandidate | null> {
    const payload = {
      coordinates: [
        [params.origin.longitude, params.origin.latitude],
        [params.turnaroundPoint.longitude, params.turnaroundPoint.latitude],
        [params.origin.longitude, params.origin.latitude],
      ],
      instructions: true,
      language: 'en',
    };

    const data = await this.postDirections(payload);
    if (!data.features || data.features.length === 0) {
      return null;
    }

    return this.mapFeatureToCandidate(data.features[0], 'out_and_back');
  }

  async calculateReturnRoute(
    params: ProviderReturnParams
  ): Promise<ProviderRouteCandidate> {
    const payload = {
      coordinates: [
        [params.currentLocation.longitude, params.currentLocation.latitude],
        [params.originalOrigin.longitude, params.originalOrigin.latitude],
      ],
      instructions: true,
      language: 'en',
    };

    const data = await this.postDirections(payload);
    if (!data.features || data.features.length === 0) {
      throw new OpenRouteServiceError(
        'Could not calculate pedestrian return path between coordinates',
        422
      );
    }

    const candidate = this.mapFeatureToCandidate(
      data.features[0],
      'out_and_back'
    );
    if (!candidate) {
      throw new OpenRouteServiceError(
        'Returned geometry for return route is invalid',
        502
      );
    }

    return candidate;
  }
}
