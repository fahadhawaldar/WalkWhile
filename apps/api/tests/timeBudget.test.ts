import { describe, expect, it } from 'vitest';
import {
  calculateTimeBudget,
  calibrateRouteDuration,
  evaluateReturnSafety,
  isRouteWithinBudget,
} from '../src/services/timeBudget.js';

describe('Time Budget Calculations', () => {
  it('correctly calculates 10-minute budget with 2.5 min buffer at 5 km/h', () => {
    const result = calculateTimeBudget({
      availableMinutes: 10,
      walkingSpeedKmh: 5,
      safetyBufferMinutes: 2.5,
    });

    expect(result.walkingBudgetMinutes).toBe(7.5);
    // targetDistance = 5 * 1000 * 7.5 / 60 = 625 meters
    expect(result.targetDistanceMeters).toBe(625);
  });

  it('correctly calculates 5-minute budget with 1 min buffer at 5 km/h', () => {
    const result = calculateTimeBudget({
      availableMinutes: 5,
      walkingSpeedKmh: 5,
      safetyBufferMinutes: 1,
    });

    expect(result.walkingBudgetMinutes).toBe(4);
    // targetDistance = 5 * 1000 * 4 / 60 = 333.33 -> 333
    expect(result.targetDistanceMeters).toBe(333);
  });

  it('correctly calculates 60-minute budget with 5 min buffer at 6 km/h', () => {
    const result = calculateTimeBudget({
      availableMinutes: 60,
      walkingSpeedKmh: 6,
      safetyBufferMinutes: 5,
    });

    expect(result.walkingBudgetMinutes).toBe(55);
    // targetDistance = 6 * 1000 * 55 / 60 = 5500 meters
    expect(result.targetDistanceMeters).toBe(5500);
  });

  it('uses default values when optional parameters are omitted', () => {
    const result = calculateTimeBudget({
      availableMinutes: 10,
    });

    expect(result.walkingSpeedKmh).toBe(5.0);
    expect(result.safetyBufferMinutes).toBe(2.5);
    expect(result.walkingBudgetMinutes).toBe(7.5);
    expect(result.targetDistanceMeters).toBe(625);
  });
});

describe('Route Duration Calibration and Budget Enforcement', () => {
  it('calibrates route duration based on user walking speed', () => {
    const distanceMeters = 1000;
    // At 5 km/h, base speed is 1.3888 m/s -> 720 seconds + 20s intersection allowance = 740s
    const calibrated = calibrateRouteDuration(distanceMeters, 5.0);
    expect(calibrated).toBe(740);
  });

  it('approves routes whose duration plus safety buffer fits within available time', () => {
    // 400 seconds = 6.66 min. + 2.5 min safety buffer = 9.16 min <= 10 min
    const withinBudget = isRouteWithinBudget(400, 2.5, 10);
    expect(withinBudget).toBe(true);
  });

  it('rejects routes whose duration plus safety buffer exceeds available time', () => {
    // 500 seconds = 8.33 min. + 2.5 min safety buffer = 10.83 min > 10 min
    const withinBudget = isRouteWithinBudget(500, 2.5, 10);
    expect(withinBudget).toBe(false);
  });
});

describe('Return Safety Margin Evaluation', () => {
  it('returns "safe" when plenty of time remains before buffer', () => {
    // 6 minutes remaining, 3 minute return duration, 2.5 min buffer -> margin = 3 min > 2.5 min buffer
    const assessment = evaluateReturnSafety(180, 6, 2.5);
    expect(assessment.status).toBe('safe');
    expect(assessment.recommendedAction).toBe('continue');
    expect(assessment.safetyMarginSeconds).toBe(180);
  });

  it('returns "warning" when inside safety buffer', () => {
    // 5 minutes remaining, 3 minute return duration (180s), 2.5 min buffer (150s)
    // margin = 120s (2 min), which is <= buffer (150s) but > half-buffer (75s)
    const assessment = evaluateReturnSafety(180, 5, 2.5);
    expect(assessment.status).toBe('warning');
    expect(assessment.recommendedAction).toBe('head_back_now');
  });

  it('returns "urgent" when below critical threshold', () => {
    // 3.5 minutes remaining (210s), 3 minute return duration (180s), 2.5 min buffer (150s)
    // margin = 30s (< 75s critical threshold)
    const assessment = evaluateReturnSafety(180, 3.5, 2.5);
    expect(assessment.status).toBe('urgent');
    expect(assessment.recommendedAction).toBe('turn_around_immediately');
  });

  it('returns "overdue" when return duration exceeds remaining time', () => {
    // 2 minutes remaining (120s), 3 minute return duration (180s)
    // margin = -60s
    const assessment = evaluateReturnSafety(180, 2, 2.5);
    expect(assessment.status).toBe('overdue');
    expect(assessment.recommendedAction).toBe('turn_around_immediately');
    expect(assessment.safetyMarginSeconds).toBeLessThan(0);
  });
});
