import {
  DEFAULTS,
  ReturnRouteRequest,
  ReturnRouteResponse,
  WalkingRoute,
} from '@walkwhile/shared';
import { getRoutingProvider, IRoutingProvider } from '../providers/index.js';
import {
  calibrateRouteDuration,
  evaluateReturnSafety,
} from './timeBudget.js';

export async function calculateReturnRoute(
  request: ReturnRouteRequest,
  customProvider?: IRoutingProvider
): Promise<ReturnRouteResponse> {
  const provider = customProvider ?? getRoutingProvider();

  const walkingSpeedKmh =
    request.walkingSpeedKmh ?? DEFAULTS.WALKING_SPEED_KMH;
  const safetyBufferMinutes =
    request.safetyBufferMinutes ?? DEFAULTS.SAFETY_BUFFER_MINUTES;

  const rawCandidate = await provider.calculateReturnRoute({
    currentLocation: request.currentLocation,
    originalOrigin: request.originalOrigin,
  });

  const calibratedDuration = calibrateRouteDuration(
    rawCandidate.distanceMeters,
    walkingSpeedKmh
  );

  const safetyAssessment = evaluateReturnSafety(
    calibratedDuration,
    request.remainingMinutes,
    safetyBufferMinutes
  );

  const returnRoute: WalkingRoute = {
    id: `return_${Date.now()}`,
    type: 'out_and_back',
    geometry: rawCandidate.geometry,
    distanceMeters: rawCandidate.distanceMeters,
    durationSeconds: rawCandidate.durationSeconds,
    calibratedDurationSeconds: calibratedDuration,
    instructions: rawCandidate.instructions,
    warnings:
      safetyAssessment.status === 'urgent' ||
      safetyAssessment.status === 'overdue'
        ? [safetyAssessment.message]
        : [],
    summary: `Return path (${Math.round(
      rawCandidate.distanceMeters
    )}m, ~${Math.round(calibratedDuration / 60)} min)`,
  };

  return {
    route: returnRoute,
    originalOrigin: request.originalOrigin,
    currentLocation: request.currentLocation,
    remainingMinutes: request.remainingMinutes,
    estimatedDurationSeconds: rawCandidate.durationSeconds,
    calibratedDurationSeconds: calibratedDuration,
    safetyMarginSeconds: safetyAssessment.safetyMarginSeconds,
    status: safetyAssessment.status,
    recommendedAction: safetyAssessment.recommendedAction,
    message: safetyAssessment.message,
    disclaimer: DEFAULTS.SAFETY_DISCLAIMER,
  };
}
