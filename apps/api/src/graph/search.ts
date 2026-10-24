import { angleDifference, haversineDistance } from '../utils/geo.js';
import { Traversal, WalkGraph } from './walkGraph.js';

/** Cost of walking an edge; return Infinity to forbid it. */
export type EdgeWeight = (edge: number) => number;

export interface ShortestPathTree {
  source: number;
  /** Cost from source to each settled node. */
  cost: Map<number, number>;
  /** Edge used to reach each node (absent for the source). */
  prevEdge: Map<number, number>;
}

/** Minimal binary min-heap keyed by priority. */
class MinHeap {
  private readonly items: number[] = [];
  private readonly priorities: number[] = [];

  get size(): number {
    return this.items.length;
  }

  push(item: number, priority: number): void {
    this.items.push(item);
    this.priorities.push(priority);
    let i = this.items.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.priorities[parent] <= this.priorities[i]) break;
      this.swap(i, parent);
      i = parent;
    }
  }

  pop(): { item: number; priority: number } {
    const item = this.items[0];
    const priority = this.priorities[0];
    const lastItem = this.items.pop()!;
    const lastPriority = this.priorities.pop()!;
    if (this.items.length > 0) {
      this.items[0] = lastItem;
      this.priorities[0] = lastPriority;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let smallest = i;
        if (l < this.items.length && this.priorities[l] < this.priorities[smallest]) smallest = l;
        if (r < this.items.length && this.priorities[r] < this.priorities[smallest]) smallest = r;
        if (smallest === i) break;
        this.swap(i, smallest);
        i = smallest;
      }
    }
    return { item, priority };
  }

  private swap(a: number, b: number): void {
    [this.items[a], this.items[b]] = [this.items[b], this.items[a]];
    [this.priorities[a], this.priorities[b]] = [this.priorities[b], this.priorities[a]];
  }
}

/** Plain walking distance, ignoring preferences. */
export function lengthWeight(graph: WalkGraph): EdgeWeight {
  return (edge) => graph.edgeLength(edge);
}

/**
 * Dijkstra from source, settling every node whose cost is <= maxCost.
 */
export function shortestPathTree(
  graph: WalkGraph,
  source: number,
  weight: EdgeWeight,
  maxCost: number
): ShortestPathTree {
  const cost = new Map<number, number>([[source, 0]]);
  const prevEdge = new Map<number, number>();
  const settled = new Set<number>();
  const heap = new MinHeap();
  heap.push(source, 0);

  while (heap.size > 0) {
    const { item: node, priority } = heap.pop();
    if (settled.has(node)) continue;
    settled.add(node);

    graph.forEachNeighbor(node, (edge, neighbor) => {
      if (settled.has(neighbor)) return;
      const next = priority + weight(edge);
      if (next > maxCost) return;
      const known = cost.get(neighbor);
      if (known === undefined || next < known) {
        cost.set(neighbor, next);
        prevEdge.set(neighbor, edge);
        heap.push(neighbor, next);
      }
    });
  }

  // Drop nodes that were reached but never settled within budget.
  for (const node of cost.keys()) {
    if (!settled.has(node)) {
      cost.delete(node);
      prevEdge.delete(node);
    }
  }

  return { source, cost, prevEdge };
}

/** Traversals from the tree's source to target, or null if unreachable. */
export function pathFromTree(
  graph: WalkGraph,
  tree: ShortestPathTree,
  target: number
): Traversal[] | null {
  if (!tree.cost.has(target)) return null;
  const path: Traversal[] = [];
  let node = target;
  while (node !== tree.source) {
    const edge = tree.prevEdge.get(node)!;
    const forward = graph.data.edgeTo[edge] === node;
    path.push({ edge, forward });
    node = forward ? graph.data.edgeFrom[edge] : graph.data.edgeTo[edge];
  }
  return path.reverse();
}

// Cost of turning at an intersection, in metres of walking: a 90 degree turn
// is worth a 60m detour, so among similar paths the one that keeps going
// straight wins over one that zigzags through the street grid.
const TURN_COST_METERS = 60;
// Bends gentler than this are just the street curving, not a turn.
const STRAIGHT_DEGREES = 30;
// Doubling back at an intersection is far worse than any normal turn.
const U_TURN_DEGREES = 150;
const U_TURN_COST_METERS = 200;

/** Extra cost of leaving an intersection along `next` after arriving via `prev`. */
export function turnCost(
  graph: WalkGraph,
  prev: Traversal,
  next: Traversal,
  rightAngleCost = TURN_COST_METERS
): number {
  // Only real intersections count; elsewhere there is no choice to make.
  if (graph.degree(graph.traversalEnd(prev)) < 3) return 0;
  const angle = angleDifference(graph.arrivalHeading(prev), graph.departureHeading(next));
  if (angle < STRAIGHT_DEGREES) return 0;
  if (angle >= U_TURN_DEGREES) return U_TURN_COST_METERS;
  return (rightAngleCost * angle) / 90;
}

export interface FindPathOptions {
  maxCost?: number;
  /** The traversal that brought the walker to source, so the first turn is costed too. */
  arrivedVia?: Traversal;
  /** Cost of a 90 degree turn; lower it when the shortest path matters most. */
  turnCostMeters?: number;
}

/**
 * A* point-to-point search that also charges for turns at intersections.
 * It searches over traversals (which way the walker is facing) rather than
 * nodes, since the cost of the next edge depends on the edge that came before.
 * `minWeightPerMeter` must not exceed the smallest weight/length ratio any
 * edge can have, so the straight-line heuristic stays admissible.
 */
export function findPath(
  graph: WalkGraph,
  source: number,
  target: number,
  weight: EdgeWeight,
  minWeightPerMeter: number,
  { maxCost = Infinity, arrivedVia, turnCostMeters = TURN_COST_METERS }: FindPathOptions = {}
): Traversal[] | null {
  if (source === target) return [];

  const targetPos = graph.position(target);
  const heuristic = (n: number) =>
    haversineDistance(graph.position(n), targetPos) * minWeightPerMeter;

  // A state is a traversal encoded as edge * 2 + (forward ? 1 : 0).
  const decode = (state: number): Traversal => ({ edge: state >> 1, forward: (state & 1) === 1 });
  const cost = new Map<number, number>();
  const prevState = new Map<number, number>();
  const settled = new Set<number>();
  const heap = new MinHeap();

  const relax = (from: Traversal | undefined, fromState: number, base: number, node: number) => {
    graph.forEachNeighbor(node, (edge, neighbor) => {
      const forward = graph.data.edgeFrom[edge] === node;
      const state = edge * 2 + (forward ? 1 : 0);
      if (settled.has(state)) return;
      const next = { edge, forward };
      const total =
        base + weight(edge) + (from ? turnCost(graph, from, next, turnCostMeters) : 0);
      if (total > maxCost) return;
      const known = cost.get(state);
      if (known === undefined || total < known) {
        cost.set(state, total);
        prevState.set(state, fromState);
        heap.push(state, total + heuristic(neighbor));
      }
    });
  };

  relax(arrivedVia, -1, 0, source);

  while (heap.size > 0) {
    const { item: state } = heap.pop();
    if (settled.has(state)) continue;
    settled.add(state);
    const traversal = decode(state);
    const node = graph.traversalEnd(traversal);
    if (node === target) {
      const path: Traversal[] = [];
      for (let s = state; s !== -1; s = prevState.get(s)!) path.push(decode(s));
      return path.reverse();
    }
    relax(traversal, state, cost.get(state)!, node);
  }

  return null;
}
