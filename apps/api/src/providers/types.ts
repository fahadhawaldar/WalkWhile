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
  /** Longest walking distance back to the start from any point on the route. */
  maxReturnDistanceMeters?: number;
}

export interface ProviderPlanParams {
  origin: Coordinate;
  /** Length to aim for. */
  targetDistanceMeters: number;
  minDistanceMeters: number;
  maxDistanceMeters: number;
  /** Flexible waits: never take the walker further than this from the start. */
  maxReturnDistanceMeters?: number;
}

export interface ProviderPlanResult {
  /** Best first. */
  candidates: ProviderRouteCandidate[];
  warnings: string[];
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

  /**
   * Plans complete walking routes in one call. Providers that implement this
   * are used instead of the seed-based generateRoundTrip/generateOutAndBack.
   */
  planWalkingRoutes?(params: ProviderPlanParams): Promise<ProviderPlanResult>;
}
