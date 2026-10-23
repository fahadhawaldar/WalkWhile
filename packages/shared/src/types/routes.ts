import { GeoJSONLineString } from './coordinates.js';

export type RouteType = 'loop' | 'out_and_back';

export type WaitType = 'fixed' | 'flexible';

export interface RouteStep {
  instruction: string;
  distanceMeters: number;
  durationSeconds: number;
  type: number | string;
  name: string;
  waypointIndices: [number, number];
}

export interface WalkingRoute {
  id: string;
  type: RouteType;
  geometry: GeoJSONLineString;
  distanceMeters: number;
  durationSeconds: number;
  calibratedDurationSeconds: number;
  instructions: RouteStep[];
  warnings: string[];
  overlapScore?: number;
  summary?: string;
  /** Longest calibrated walk back to the start from any point on the route. */
  maxReturnSeconds?: number;
}

export type ActiveWalkState =
  | 'idle'
  | 'generating'
  | 'ready'
  | 'walking'
  | 'returning'
  | 'completed'
  | 'interrupted';

export type ReturnRouteStatus = 'safe' | 'warning' | 'urgent' | 'overdue';

export type RecommendedReturnAction =
  | 'continue'
  | 'head_back_now'
  | 'turn_around_immediately';
