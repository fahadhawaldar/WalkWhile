import { z } from 'zod';
import { CoordinateSchema } from './api.js';

/**
 * A finished walk, as saved to the user's history. The id is generated on the
 * phone so a sync that is retried updates the same walk instead of adding a
 * second copy.
 */
export const WalkRecordSchema = z.object({
  id: z.string().uuid(),
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime(),
  /** completed: made it back to the start. interrupted: stopped early. */
  outcome: z.enum(['completed', 'interrupted']),
  waitType: z.enum(['fixed', 'flexible']),
  plannedMinutes: z.number().min(0).max(24 * 60),
  durationSeconds: z.number().int().min(0),
  distanceMeters: z.number().int().min(0),
  steps: z.number().int().min(0),
  /** Still had time left on the timer when the walk ended. */
  returnedOnTime: z.boolean(),
  origin: CoordinateSchema,
  /** The planned route, as [longitude, latitude] pairs. */
  routeCoordinates: z
    .array(z.tuple([z.number(), z.number()]))
    .max(20_000)
    .default([]),
});

export type WalkRecord = z.infer<typeof WalkRecordSchema>;

export interface WalkListResponse {
  walks: WalkRecord[];
  /** Pass as `before` to fetch the next page; null when there are no more. */
  nextCursor: string | null;
}

export interface AuthUser {
  id: string;
  isAnonymous: boolean;
  email: string | null;
}

export interface AuthSession {
  user: AuthUser;
  accessToken: string;
  /** Seconds until the access token expires. */
  expiresIn: number;
  refreshToken: string;
}

export const LinkIdentityRequestSchema = z.object({
  provider: z.enum(['apple', 'google']),
  /** The identity token (JWT) returned by Sign in with Apple / Google. */
  idToken: z.string().min(1),
});

export type LinkIdentityRequest = z.infer<typeof LinkIdentityRequestSchema>;

export const RefreshSessionRequestSchema = z.object({
  refreshToken: z.string().min(1),
});
