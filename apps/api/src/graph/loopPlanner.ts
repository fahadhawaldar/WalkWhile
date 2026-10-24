import { RouteType } from '@walkwhile/shared';
import { angleDifference, bearingBetween, haversineDistance } from '../utils/geo.js';
import {
  findPath,
  lengthWeight,
  pathFromTree,
  ShortestPathTree,
  shortestPathTree,
  turnCost,
} from './search.js';
import { MIN_COST_FACTOR } from './walkability.js';
import { Traversal, WalkGraph } from './walkGraph.js';

export interface LoopPlanOptions {
  originNode: number;
  /** Length the planner aims for. */
  targetLengthMeters: number;
  /** Routes outside [min, max] are discarded. */
  minLengthMeters: number;
  maxLengthMeters: number;
  /**
   * Flexible waits: the route must never take the walker further than this
   * (in walking distance) from the start. Undefined for fixed waits.
   */
  maxReturnMeters?: number;
}

export interface PlannedRoute {
  type: RouteType;
  traversals: Traversal[];
  lengthMeters: number;
  /** Longest walk back to the start from any point on the route. */
  maxReturnMeters: number;
  /** Lower is better. */
  score: number;
}

// Penalty multiplier for walking an edge the route already uses.
const REUSE_PENALTY = 5;
// Loops reusing more than this share of their length are rejected. Petal
// loops all pass back through the start, so they are allowed more overlap.
const MAX_REUSE_RATIO = 0.35;
const MAX_PETAL_REUSE_RATIO = 0.5;
// Rough ratio of network walking distance to straight-line distance.
const DETOUR_FACTOR = 1.3;
const BEARINGS = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330];
const SPREADS = [60, 100];
const CALIBRATION_ROUNDS = 4;
// Score weight for turning, per metre of turn cost per metre walked. A loop
// with a 90 degree turn every 100m scores about 0.5 worse than a straight one.
const TURN_SCORE_WEIGHT = 1.5;

interface Waypoint {
  node: number;
  distance: number;
  bearing: number;
}

export class LoopPlanner {
  private readonly returnTree: ShortestPathTree;
  private readonly waypoints: Waypoint[];

  constructor(
    private readonly graph: WalkGraph,
    private readonly options: LoopPlanOptions
  ) {
    const bound =
      options.maxReturnMeters ?? (options.maxLengthMeters / 2) * 1.05;
    this.returnTree = shortestPathTree(
      graph,
      options.originNode,
      lengthWeight(graph),
      bound
    );

    const origin = graph.position(options.originNode);
    this.waypoints = [];
    for (const [node, distance] of this.returnTree.cost) {
      // Dead ends make poor turning points (they force a U-turn).
      if (node === options.originNode || graph.degree(node) < 2) continue;
      this.waypoints.push({
        node,
        distance,
        bearing: bearingBetween(origin, graph.position(node)),
      });
    }
  }

  plan(limit = 12): PlannedRoute[] {
    const candidates =
      this.options.maxReturnMeters === undefined
        ? this.singleLoops()
        : this.petalLoops();
    candidates.push(...this.outAndBackCandidates());

    candidates.sort((a, b) => a.score - b.score);
    return dedupe(candidates).slice(0, limit);
  }

  /** Fixed waits: one big loop that uses the whole walking budget. */
  private singleLoops(): PlannedRoute[] {
    const routes: PlannedRoute[] = [];
    for (const bearing of BEARINGS) {
      for (const spread of SPREADS) {
        const loop = this.buildLoop(
          this.options.targetLengthMeters,
          bearing,
          spread,
          new Map()
        );
        const route = loop && this.evaluate('loop', loop);
        if (route) routes.push(route);
      }
    }
    return routes;
  }

  /**
   * Flexible waits: chain several small loops ("petals") around the start so
   * the walker never strays far. Builds a pool of petals in every direction,
   * then greedily combines the most distinct ones until the time is filled.
   */
  private petalLoops(): PlannedRoute[] {
    const { targetLengthMeters, maxLengthMeters, maxReturnMeters } =
      this.options;
    const petalTarget = Math.min(targetLengthMeters, 3.2 * maxReturnMeters!);

    const pool: Array<{ loop: Traversal[]; length: number; edges: Set<number> }> = [];
    for (const bearing of BEARINGS) {
      for (const spread of SPREADS) {
        const loop = this.buildLoop(petalTarget, bearing, spread, new Map());
        if (!loop) continue;
        pool.push({
          loop,
          length: this.length(loop),
          edges: new Set(loop.map((t) => t.edge)),
        });
      }
    }

    const routes: PlannedRoute[] = [];
    for (const first of pool) {
      const chosen = [first];
      const usedEdges = new Set(first.edges);
      let total = first.length;

      while (total < targetLengthMeters * 0.9) {
        let next: (typeof pool)[number] | null = null;
        let nextOverlap = Infinity;
        for (const petal of pool) {
          if (chosen.includes(petal)) continue;
          if (total + petal.length > maxLengthMeters) continue;
          let shared = 0;
          for (const t of petal.loop) {
            if (usedEdges.has(t.edge)) shared += this.graph.edgeLength(t.edge);
          }
          const overlap = shared / petal.length;
          if (overlap < nextOverlap) {
            nextOverlap = overlap;
            next = petal;
          }
        }
        if (!next) break;
        chosen.push(next);
        for (const e of next.edges) usedEdges.add(e);
        total += next.length;
      }

      const route = this.evaluate(
        'loop',
        removeBacktracks(chosen.flatMap((p) => p.loop))
      );
      if (route) routes.push(route);
    }
    return routes;
  }

  /**
   * Builds one triangular loop origin -> A -> B -> origin heading roughly
   * towards `bearing`, rescaling the triangle until its length is close to
   * the target.
   */
  private buildLoop(
    target: number,
    bearing: number,
    spread: number,
    alreadyUsed: Map<number, number>
  ): Traversal[] | null {
    const { originNode, maxReturnMeters } = this.options;
    const halfSpread = spread / 2;
    let radius =
      target / (2 + 2 * Math.sin((halfSpread * Math.PI) / 180)) / 1.1;
    if (maxReturnMeters !== undefined) {
      radius = Math.min(radius, maxReturnMeters);
    }

    let best: { loop: Traversal[]; error: number } | null = null;

    for (let round = 0; round < CALIBRATION_ROUNDS; round++) {
      const a = this.pickWaypoint(radius, bearing - halfSpread);
      const b = this.pickWaypoint(radius, bearing + halfSpread);
      if (a === null || b === null || a === b) break;

      const used = new Map(alreadyUsed);
      const weight = (edge: number) =>
        this.graph.edgeLength(edge) *
        this.graph.edgeCost(edge) *
        (used.has(edge) ? REUSE_PENALTY : 1);

      const loop: Traversal[] = [];
      let from = originNode;
      let failed = false;
      for (const to of [a, b, originNode]) {
        const leg = findPath(this.graph, from, to, weight, MIN_COST_FACTOR, {
          arrivedVia: loop[loop.length - 1],
        });
        if (!leg) {
          failed = true;
          break;
        }
        for (const t of leg) {
          used.set(t.edge, (used.get(t.edge) ?? 0) + 1);
          loop.push(t);
        }
        from = to;
      }
      if (failed) break;

      const trimmed = removeBacktracks(loop);
      const length = this.length(trimmed);
      if (length === 0) break;

      const error = Math.abs(length - target) / target;
      if (!best || error < best.error) best = { loop: trimmed, error };
      if (error < 0.04) break;

      radius *= Math.min(2, Math.max(0.5, target / length));
      if (maxReturnMeters !== undefined) {
        radius = Math.min(radius, maxReturnMeters);
      }
    }

    return best?.loop ?? null;
  }

  /** Walk straight out along the shortest path and come back the same way. */
  private outAndBackCandidates(): PlannedRoute[] {
    const half = this.options.targetLengthMeters / 2;
    if (
      this.options.maxReturnMeters !== undefined &&
      half > this.options.maxReturnMeters
    ) {
      return [];
    }

    const routes: PlannedRoute[] = [];
    for (const bearing of [0, 60, 120, 180, 240, 300]) {
      const turnaround = this.pickWaypoint(half, bearing);
      if (turnaround === null) continue;
      const out = pathFromTree(this.graph, this.returnTree, turnaround);
      if (!out || out.length === 0) continue;
      const back = [...out]
        .reverse()
        .map((t) => ({ edge: t.edge, forward: !t.forward }));
      const route = this.evaluate('out_and_back', [...out, ...back]);
      if (route) routes.push(route);
    }
    return routes;
  }

  private pickWaypoint(radius: number, bearing: number): number | null {
    let best: number | null = null;
    let bestScore = Infinity;
    for (const w of this.waypoints) {
      const distanceError = Math.abs(w.distance - radius) / radius;
      if (distanceError > 0.35) continue;
      const angleError = angleDifference(w.bearing, bearing);
      if (angleError > 45) continue;
      const score = angleError / 45 + distanceError / 0.35;
      if (score < bestScore) {
        bestScore = score;
        best = w.node;
      }
    }
    return best;
  }

  private evaluate(type: RouteType, traversals: Traversal[]): PlannedRoute | null {
    const { minLengthMeters, maxLengthMeters, targetLengthMeters, maxReturnMeters } =
      this.options;
    const length = this.length(traversals);
    if (length < minLengthMeters || length > maxLengthMeters) return null;

    const seen = new Set<number>();
    let reusedLength = 0;
    let weightedLength = 0;
    let maxReturn = 0;
    let turning = 0;
    const origin = this.graph.position(this.options.originNode);

    for (const [i, t] of traversals.entries()) {
      if (i > 0) turning += turnCost(this.graph, traversals[i - 1], t);
      const edgeLength = this.graph.edgeLength(t.edge);
      if (seen.has(t.edge)) reusedLength += edgeLength;
      seen.add(t.edge);
      weightedLength += edgeLength * this.graph.edgeCost(t.edge);

      const node = this.graph.traversalEnd(t);
      const back =
        this.returnTree.cost.get(node) ??
        haversineDistance(this.graph.position(node), origin) * DETOUR_FACTOR;
      maxReturn = Math.max(maxReturn, back);
    }

    const reuse = reusedLength / length;
    const maxReuse =
      maxReturnMeters === undefined ? MAX_REUSE_RATIO : MAX_PETAL_REUSE_RATIO;
    if (type === 'loop' && reuse > maxReuse) return null;
    if (maxReturnMeters !== undefined && maxReturn > maxReturnMeters * 1.15) {
      return null;
    }

    const lengthError = Math.abs(length - targetLengthMeters) / targetLengthMeters;
    const comfort = weightedLength / length - MIN_COST_FACTOR;
    let score =
      4 * lengthError + 2 * reuse + comfort + TURN_SCORE_WEIGHT * (turning / length);
    if (maxReturnMeters !== undefined) {
      score += maxReturn / maxReturnMeters;
    }

    return {
      type,
      traversals,
      lengthMeters: length,
      maxReturnMeters: maxReturn,
      score,
    };
  }

  private length(traversals: Traversal[]): number {
    let total = 0;
    for (const t of traversals) total += this.graph.edgeLength(t.edge);
    return total;
  }
}

/**
 * Removes immediate back-and-forth moves (walking an edge and straight back),
 * which appear when a waypoint sits at the end of a short spur.
 */
export function removeBacktracks(traversals: Traversal[]): Traversal[] {
  const stack: Traversal[] = [];
  for (const t of traversals) {
    const top = stack[stack.length - 1];
    if (top && top.edge === t.edge && top.forward !== t.forward) {
      stack.pop();
    } else {
      stack.push(t);
    }
  }
  return stack;
}

function dedupe(routes: PlannedRoute[]): PlannedRoute[] {
  const seen = new Set<string>();
  return routes.filter((r) => {
    const key = r.traversals
      .map((t) => t.edge)
      .sort((a, b) => a - b)
      .join(',');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
