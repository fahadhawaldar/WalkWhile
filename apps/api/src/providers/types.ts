import {
  Coordinate,
  GeoJSONLineString,
  RouteStep,
  RouteType,
} from '@walkwhile/shared';

export interface ProviderRouteCandidate {
  geometry: GeoJSONLineString;
  distanceMeters: number;
  durationSeconds: number;
  instructions: RouteStep[];
  type: RouteType;
  seed?: number;
  providerRaw?: unknown;
}

export interface ProviderRoundTripParams {
  origin: Coordinate;
  targetDistanceMeters: number;
  seed: number;
  points?: number;
}

export interface ProviderOutAndBackParams {
  origin: Coordinate;
  turnaroundPoint: Coordinate;
}

export interface ProviderReturnParams {
  currentLocation: Coordinate;
  originalOrigin: Coordinate;
}

export interface IRoutingProvider {
  readonly name: string;

  /**
   * Generates a circular/closed pedestrian round trip starting and ending at origin.
   */
  generateRoundTrip(
    params: ProviderRoundTripParams
  ): Promise<ProviderRouteCandidate | null>;

  /**
   * Generates an out-and-back pedestrian route via an explicit turnaround waypoint.
   */
  generateOutAndBack(
    params: ProviderOutAndBackParams
  ): Promise<ProviderRouteCandidate | null>;

  /**
   * Calculates the shortest pedestrian return route from current location back to origin.
   */
  calculateReturnRoute(
    params: ProviderReturnParams
  ): Promise<ProviderRouteCandidate>;
}
