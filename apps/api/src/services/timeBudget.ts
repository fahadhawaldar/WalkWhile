import {
  DEFAULTS,
  ReturnRouteStatus,
  RecommendedReturnAction,
} from '@walkwhile/shared';

export interface TimeBudgetResult {
  availableMinutes: number;
  safetyBufferMinutes: number;
  walkingBudgetMinutes: number;
  targetDistanceMeters: number;
  walkingSpeedKmh: number;
}

/**
 * Calculates the available walking time budget and initial target distance.
 *
 * walkingBudgetMinutes = max(0, availableMinutes - safetyBufferMinutes)
 * targetDistanceMeters = walkingSpeedKmh * 1000 * walkingBudgetMinutes / 60
 */
export function calculateTimeBudget(params: {
  availableMinutes: number;
  walkingSpeedKmh?: number;
  safetyBufferMinutes?: number;
}): TimeBudgetResult {
  const walkingSpeedKmh =
    params.walkingSpeedKmh ?? DEFAULTS.WALKING_SPEED_KMH;
  const safetyBufferMinutes =
    params.safetyBufferMinutes ?? DEFAULTS.SAFETY_BUFFER_MINUTES;

  const walkingBudgetMinutes = Math.max(
    0,
    params.availableMinutes - safetyBufferMinutes
  );

  const targetDistanceMeters = Math.round(
    (walkingSpeedKmh * 1000 * walkingBudgetMinutes) / 60
  );

  return {
    availableMinutes: params.availableMinutes,
    safetyBufferMinutes,
    walkingBudgetMinutes,
    targetDistanceMeters,
    walkingSpeedKmh,
  };
}

/**
 * Recalibrates estimated walking duration based on the user's specific walking speed
 * and adds realistic pedestrian intersection allowances (stoplights, road crossings).
 */
export function calibrateRouteDuration(
  distanceMeters: number,
  walkingSpeedKmh: number,
  includeCrossingAllowance = true
): number {
  const speedMetersPerSecond = (walkingSpeedKmh * 1000) / 3600;
  const baseWalkingSeconds = distanceMeters / speedMetersPerSecond;

  let crossingAllowanceSeconds = 0;
  if (includeCrossingAllowance) {
    const distanceKm = distanceMeters / 1000;
    crossingAllowanceSeconds =
      distanceKm * DEFAULTS.PEDESTRIAN_INTERSECTION_ALLOWANCE_PER_KM_SECONDS;
  }

  return Math.round(baseWalkingSeconds + crossingAllowanceSeconds);
}

/**
 * Verifies if a given route duration plus safety buffer fits within available time.
 * Rejects routes where estimated duration + safety buffer exceeds available time.
 */
export function isRouteWithinBudget(
  durationSeconds: number,
  safetyBufferMinutes: number,
  availableMinutes: number
): boolean {
  const totalRequiredMinutes = durationSeconds / 60 + safetyBufferMinutes;
  return totalRequiredMinutes <= availableMinutes;
}

export interface ReturnSafetyAssessment {
  estimatedDurationSeconds: number;
  remainingMinutes: number;
  safetyBufferMinutes: number;
  safetyMarginSeconds: number;
  status: ReturnRouteStatus;
  recommendedAction: RecommendedReturnAction;
  message: string;
}

/**
 * Evaluates return journey feasibility against remaining time and safety margin.
 */
export function evaluateReturnSafety(
  estimatedDurationSeconds: number,
  remainingMinutes: number,
  safetyBufferMinutes: number
): ReturnSafetyAssessment {
  const remainingSeconds = remainingMinutes * 60;
  const safetyBufferSeconds = safetyBufferMinutes * 60;
  const safetyMarginSeconds = Math.round(
    remainingSeconds - estimatedDurationSeconds
  );

  let status: ReturnRouteStatus;
  let recommendedAction: RecommendedReturnAction;
  let message: string;

  if (safetyMarginSeconds < 0) {
    status = 'overdue';
    recommendedAction = 'turn_around_immediately';
    message = `You are behind schedule by ${Math.abs(
      Math.round(safetyMarginSeconds / 60)
    )} min. Turn around immediately.`;
  } else if (safetyMarginSeconds < safetyBufferSeconds * 0.5) {
    status = 'urgent';
    recommendedAction = 'turn_around_immediately';
    message = `Critical buffer threshold reached (${Math.round(
      safetyMarginSeconds / 60
    )} min left). Turn back now.`;
  } else if (safetyMarginSeconds <= safetyBufferSeconds) {
    status = 'warning';
    recommendedAction = 'head_back_now';
    message = `Entering safety buffer. Head back now to arrive on time.`;
  } else {
    status = 'safe';
    recommendedAction = 'continue';
    message = `On track. You have ${Math.round(
      safetyMarginSeconds / 60
    )} min before the safety buffer starts.`;
  }

  return {
    estimatedDurationSeconds,
    remainingMinutes,
    safetyBufferMinutes,
    safetyMarginSeconds,
    status,
    recommendedAction,
    message,
  };
}
