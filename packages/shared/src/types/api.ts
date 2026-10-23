import { z } from 'zod';
import { Coordinate } from './coordinates.js';
import {
  WalkingRoute,
  ReturnRouteStatus,
  RecommendedReturnAction,
} from './routes.js';

export const CoordinateSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

export const GenerateRoutesRequestSchema = z
  .object({
    origin: CoordinateSchema,
    availableMinutes: z
      .number()
      .min(5, 'Available time must be at least 5 minutes')
      .max(60, 'Available time cannot exceed 60 minutes'),
    walkingSpeedKmh: z
      .number()
      .min(2, 'Walking speed must be at least 2 km/h')
      .max(10, 'Walking speed cannot exceed 10 km/h')
      .default(5),
    safetyBufferMinutes: z
      .number()
      .min(0.5, 'Safety buffer must be at least 0.5 minutes')
      .max(15, 'Safety buffer cannot exceed 15 minutes')
      .default(2.5),
    maxRoutes: z.number().int().min(1).max(5).default(3),
    /**
     * fixed: the wait ends at a known time (air fryer, laundry), so use it all.
     * flexible: the wait might end early (a friend on the way), so stay close.
     */
    waitType: z.enum(['fixed', 'flexible']).default('fixed'),
    /** Flexible waits: the furthest the walker should get, in minutes back. */
    maxReturnMinutes: z
      .number()
      .min(1, 'Max return time must be at least 1 minute')
      .max(15, 'Max return time cannot exceed 15 minutes')
      .default(3),
  })
  .refine((data) => data.safetyBufferMinutes < data.availableMinutes, {
    message: 'Safety buffer must be less than available time',
    path: ['safetyBufferMinutes'],
  });

/** A validated request, with defaults applied. */
export type GenerateRoutesRequest = z.infer<typeof GenerateRoutesRequestSchema>;
/** What clients send; fields with defaults may be omitted. */
export type GenerateRoutesRequestInput = z.input<
  typeof GenerateRoutesRequestSchema
>;

export interface GenerateRoutesResponse {
  request: GenerateRoutesRequest;
  origin: Coordinate;
  walkingBudgetMinutes: number;
  targetDistanceMeters: number;
  routes: WalkingRoute[];
  count: number;
  message?: string;
  warnings: string[];
  disclaimer: string;
}

export const ReturnRouteRequestSchema = z.object({
  originalOrigin: CoordinateSchema,
  currentLocation: CoordinateSchema,
  remainingMinutes: z.number().min(0, 'Remaining minutes cannot be negative'),
  walkingSpeedKmh: z.number().min(2).max(10).default(5),
  safetyBufferMinutes: z.number().min(0).max(15).default(2.5),
});

export type ReturnRouteRequest = z.infer<typeof ReturnRouteRequestSchema>;

export interface ReturnRouteResponse {
  route: WalkingRoute;
  originalOrigin: Coordinate;
  currentLocation: Coordinate;
  remainingMinutes: number;
  estimatedDurationSeconds: number;
  calibratedDurationSeconds: number;
  safetyMarginSeconds: number;
  status: ReturnRouteStatus;
  recommendedAction: RecommendedReturnAction;
  message: string;
  disclaimer: string;
}

export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}
