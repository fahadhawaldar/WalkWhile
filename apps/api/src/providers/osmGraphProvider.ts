import { Coordinate, DEFAULTS } from '@walkwhile/shared';
import { assembleRoute } from '../graph/directions.js';
import { LoopPlanner } from '../graph/loopPlanner.js';
import { findPath, lengthWeight } from '../graph/search.js';
import { WalkGraph } from '../graph/walkGraph.js';
import {
  IRoutingProvider,
  ProviderPlanParams,
  ProviderPlanResult,
  ProviderReturnParams,
  ProviderRouteCandidate,
} from './types.js';

// Mid-walk the user may have wandered into a mall or park, so allow a looser
// snap for return routes than for the start.
const MAX_RETURN_SNAP_METERS = 400;
// Flexible waits in sparse areas: progressively allow straying further.
const FLEXIBLE_RELAXATION = [1, 1.5, 2, 3];
// Walks back accept at most a few metres of detour per turn avoided.
const RETURN_TURN_COST_METERS = 5;
// Default pace used for per-step durations (the route total is recalibrated
// to the user's pace later).
const STEP_SPEED_MPS = 5 / 3.6;

function routingError(message: string, statusCode: number): Error {
  return Object.assign(new Error(message), { statusCode });
}

/**
 * Routes on WalkWhile's own pedestrian graph built from OpenStreetMap data.
 */
export class OsmGraphProvider implements IRoutingProvider {
  readonly name = 'osm-graph';

  constructor(private readonly graph: WalkGraph) {}

  async planWalkingRoutes(params: ProviderPlanParams): Promise<ProviderPlanResult> {
    const snap = this.snapOrThrow(params.origin, DEFAULTS.MAX_ORIGIN_DISTANCE_METERS);
    // The walk to and from the nearest street counts towards the budget.
    const connector = snap.distanceMeters * 2;
    const warnings: string[] = [];

    const relaxations =
      params.maxReturnDistanceMeters === undefined ? [1] : FLEXIBLE_RELAXATION;

    for (const relax of relaxations) {
      const planner = new LoopPlanner(this.graph, {
        originNode: snap.node,
        targetLengthMeters: params.targetDistanceMeters - connector,
        minLengthMeters: params.minDistanceMeters - connector,
        maxLengthMeters: params.maxDistanceMeters - connector,
        maxReturnMeters:
          params.maxReturnDistanceMeters === undefined
            ? undefined
            : params.maxReturnDistanceMeters * relax,
      });
      const planned = planner.plan();
      if (!planned.some((r) => r.type === 'loop') && relax !== relaxations[relaxations.length - 1]) {
        continue;
      }
      if (relax > 1) {
        warnings.push(
          'There are few paths close to your starting point, so these routes go a little further than usual.'
        );
      }

      const candidates = planned.map((route) => {
        const assembled = assembleRoute(
          this.graph,
          route.traversals,
          params.origin,
          params.origin,
          'Arrive back at your starting point'
        );
        return this.toCandidate(assembled, route.type, route.maxReturnMeters + snap.distanceMeters);
      });
      return { candidates, warnings };
    }

    return { candidates: [], warnings };
  }

  async calculateReturnRoute(params: ProviderReturnParams): Promise<ProviderRouteCandidate> {
    const from = this.snapOrThrow(params.currentLocation, MAX_RETURN_SNAP_METERS);
    const to = this.snapOrThrow(params.originalOrigin, DEFAULTS.MAX_ORIGIN_DISTANCE_METERS);

    // Getting back on time comes first: turns only break ties between
    // near-equal paths.
    const path = findPath(this.graph, from.node, to.node, lengthWeight(this.graph), 1, {
      turnCostMeters: RETURN_TURN_COST_METERS,
    });
    if (!path) {
      throw routingError('No walking path back to your starting point was found.', 422);
    }

    const assembled = assembleRoute(
      this.graph,
      path,
      params.currentLocation,
      params.originalOrigin,
      'Arrive at your starting point'
    );
    return this.toCandidate(assembled, 'out_and_back', assembled.distanceMeters);
  }

  async generateRoundTrip(): Promise<ProviderRouteCandidate | null> {
    // Superseded by planWalkingRoutes.
    return null;
  }

  async generateOutAndBack(): Promise<ProviderRouteCandidate | null> {
    // Superseded by planWalkingRoutes.
    return null;
  }

  private snapOrThrow(coord: Coordinate, maxDistance: number) {
    if (!this.graph.contains(coord)) {
      throw routingError('WalkWhile currently covers Dubai only.', 422);
    }
    const snap = this.graph.snap(coord, maxDistance);
    if (!snap) {
      throw routingError(
        `No walkable path found within ${maxDistance}m of this location.`,
        422
      );
    }
    return snap;
  }

  private toCandidate(
    assembled: ReturnType<typeof assembleRoute>,
    type: ProviderRouteCandidate['type'],
    maxReturnDistanceMeters: number
  ): ProviderRouteCandidate {
    for (const step of assembled.steps) {
      step.durationSeconds = Math.round(step.distanceMeters / STEP_SPEED_MPS);
    }
    return {
      geometry: { type: 'LineString', coordinates: assembled.coordinates },
      distanceMeters: assembled.distanceMeters,
      durationSeconds: Math.round(assembled.distanceMeters / STEP_SPEED_MPS),
      instructions: assembled.steps,
      type,
      maxReturnDistanceMeters,
    };
  }
}
