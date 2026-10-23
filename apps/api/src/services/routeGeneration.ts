import {
  DEFAULTS,
  GenerateRoutesRequest,
  GenerateRoutesResponse,
  WalkingRoute,
} from '@walkwhile/shared';
import { getRoutingProvider, IRoutingProvider } from '../providers/index.js';
import { haversineDistance, projectCoordinate } from '../utils/geo.js';
import { filterDiverseCandidates } from './routeDiversity.js';
import {
  calculateTimeBudget,
  calibrateRouteDuration,
  isRouteWithinBudget,
} from './timeBudget.js';

const CANDIDATE_SEEDS = [1, 42, 99, 137, 256];
const OUT_AND_BACK_BEARINGS = [0, 120, 240];

export async function generateWalkingRoutes(
  request: GenerateRoutesRequest,
  customProvider?: IRoutingProvider
): Promise<GenerateRoutesResponse> {
  const provider = customProvider ?? getRoutingProvider();
  const warnings: string[] = [];

  // Step 1 & 2: Calculate walking budget
  const budget = calculateTimeBudget({
    availableMinutes: request.availableMinutes,
    walkingSpeedKmh: request.walkingSpeedKmh,
    safetyBufferMinutes: request.safetyBufferMinutes,
  });

  const { targetDistanceMeters, walkingBudgetMinutes } = budget;

  // Step 3: Request candidate round-trips using diverse seeds
  const roundTripPromises = CANDIDATE_SEEDS.map((seed) =>
    provider
      .generateRoundTrip({
        origin: request.origin,
        targetDistanceMeters,
        seed,
        points: 5,
      })
      .catch((err) => {
        // Individual seed failure shouldn't abort the entire generation
        console.warn(`[RouteGeneration] Seed ${seed} failed:`, err.message);
        return null;
      })
  );

  const rawCandidates = await Promise.all(roundTripPromises);

  // Step 4, 5, 6, 7: Validate & normalize candidate loops
  const validLoopCandidates: WalkingRoute[] = [];

  for (let i = 0; i < rawCandidates.length; i++) {
    const raw = rawCandidates[i];
    if (!raw || !raw.geometry || raw.geometry.coordinates.length < 4) {
      continue;
    }

    const coords = raw.geometry.coordinates;
    const startPoint = coords[0];
    const endPoint = coords[coords.length - 1];

    // Check 6: Starts and ends near origin (within tolerance, accounting for OSM pedestrian snapping)
    const startDistance = haversineDistance(startPoint, request.origin);
    const endDistance = haversineDistance(endPoint, request.origin);

    if (
      startDistance > DEFAULTS.MAX_ORIGIN_DISTANCE_METERS ||
      endDistance > DEFAULTS.MAX_ORIGIN_DISTANCE_METERS
    ) {
      continue;
    }

    // Check 5: Length sanity (cannot be 0 or excessively long)
    if (
      raw.distanceMeters <= 50 ||
      raw.distanceMeters >
        targetDistanceMeters * DEFAULTS.MAX_DISTANCE_STRETCH_RATIO
    ) {
      continue;
    }

    // Check 4 & 7: Duration calibration and time budget check
    const calibratedDuration = calibrateRouteDuration(
      raw.distanceMeters,
      request.walkingSpeedKmh
    );

    if (
      !isRouteWithinBudget(
        calibratedDuration,
        request.safetyBufferMinutes,
        request.availableMinutes
      )
    ) {
      continue;
    }

    validLoopCandidates.push({
      id: `route_loop_${Date.now()}_${i + 1}`,
      type: 'loop',
      geometry: raw.geometry,
      distanceMeters: raw.distanceMeters,
      durationSeconds: raw.durationSeconds,
      calibratedDurationSeconds: calibratedDuration,
      instructions: raw.instructions,
      warnings: [],
      summary: `Circular loop (~${Math.round(
        raw.distanceMeters
      )}m, ~${Math.round(calibratedDuration / 60)} min)`,
    });
  }

  // Step 8, 9, 10: Diversity filtering for loops
  let selectedRoutes = filterDiverseCandidates(
    validLoopCandidates,
    request.maxRoutes,
    DEFAULTS.MAX_ROUTE_OVERLAP_RATIO
  );

  // Step 12: Fallback to out-and-back if fewer than desired routes are found
  if (selectedRoutes.length < request.maxRoutes) {
    // Target 90% of half-distance to ensure out-and-back comfortably fits within available time
    const halfDistance = Math.round((targetDistanceMeters * 0.9) / 2);

    for (const bearing of OUT_AND_BACK_BEARINGS) {
      if (selectedRoutes.length >= request.maxRoutes) break;

      try {
        const turnaroundPoint = projectCoordinate(
          request.origin,
          bearing,
          halfDistance
        );

        const outAndBackRaw = await provider.generateOutAndBack({
          origin: request.origin,
          turnaroundPoint,
        });

        if (
          !outAndBackRaw ||
          !outAndBackRaw.geometry ||
          outAndBackRaw.geometry.coordinates.length < 3
        ) {
          continue;
        }

        const calibratedDuration = calibrateRouteDuration(
          outAndBackRaw.distanceMeters,
          request.walkingSpeedKmh
        );

        if (
          !isRouteWithinBudget(
            calibratedDuration,
            request.safetyBufferMinutes,
            request.availableMinutes
          )
        ) {
          continue;
        }

        const outAndBackRoute: WalkingRoute = {
          id: `route_outandback_${Date.now()}_${bearing}`,
          type: 'out_and_back',
          geometry: outAndBackRaw.geometry,
          distanceMeters: outAndBackRaw.distanceMeters,
          durationSeconds: outAndBackRaw.durationSeconds,
          calibratedDurationSeconds: calibratedDuration,
          instructions: outAndBackRaw.instructions,
          warnings: ['Out-and-back route along the same pedestrian corridor.'],
          summary: `Out-and-back route (~${Math.round(
            outAndBackRaw.distanceMeters
          )}m, ~${Math.round(calibratedDuration / 60)} min)`,
        };

        // Check diversity against already selected routes
        const testSet = [...selectedRoutes, outAndBackRoute];
        const diverseSet = filterDiverseCandidates(
          testSet,
          request.maxRoutes,
          DEFAULTS.MAX_ROUTE_OVERLAP_RATIO
        );

        if (diverseSet.length > selectedRoutes.length) {
          selectedRoutes = diverseSet;
        }
      } catch (err) {
        console.warn(
          `[RouteGeneration] Out-and-back generation at bearing ${bearing} failed:`,
          (err as Error).message
        );
      }
    }

    if (selectedRoutes.some((r) => r.type === 'out_and_back')) {
      warnings.push(
        'Some routes are out-and-back paths due to limited pedestrian loop connectivity in this area.'
      );
    }
  }

  // Step 11 & 13: Handle insufficient routes or zero routes
  let message: string | undefined;
  if (selectedRoutes.length === 0) {
    message =
      'No suitable pedestrian routes could be confidently generated within your time budget and safety margin for this location. Consider increasing available time or moving closer to pedestrian-accessible walkways.';
  } else if (selectedRoutes.length < request.maxRoutes) {
    message = `Generated ${selectedRoutes.length} route(s). Fewer than ${request.maxRoutes} were returned to prevent redundant or unsafe paths.`;
  }

  return {
    request,
    origin: request.origin,
    walkingBudgetMinutes,
    targetDistanceMeters,
    routes: selectedRoutes,
    count: selectedRoutes.length,
    message,
    warnings,
    disclaimer: DEFAULTS.SAFETY_DISCLAIMER,
  };
}
