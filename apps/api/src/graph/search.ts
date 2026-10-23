import { haversineDistance } from '../utils/geo.js';
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

/**
 * A* point-to-point search. `minWeightPerMeter` must not exceed the smallest
 * weight/length ratio any edge can have, so the straight-line heuristic stays
 * admissible.
 */
export function findPath(
  graph: WalkGraph,
  source: number,
  target: number,
  weight: EdgeWeight,
  minWeightPerMeter: number,
  maxCost = Infinity
): Traversal[] | null {
  if (source === target) return [];

  const targetPos = graph.position(target);
  const heuristic = (n: number) =>
    haversineDistance(graph.position(n), targetPos) * minWeightPerMeter;

  const cost = new Map<number, number>([[source, 0]]);
  const prevEdge = new Map<number, number>();
  const settled = new Set<number>();
  const heap = new MinHeap();
  heap.push(source, heuristic(source));

  while (heap.size > 0) {
    const { item: node } = heap.pop();
    if (settled.has(node)) continue;
    if (node === target) break;
    settled.add(node);
    const base = cost.get(node)!;

    graph.forEachNeighbor(node, (edge, neighbor) => {
      if (settled.has(neighbor)) return;
      const next = base + weight(edge);
      if (next > maxCost) return;
      const known = cost.get(neighbor);
      if (known === undefined || next < known) {
        cost.set(neighbor, next);
        prevEdge.set(neighbor, edge);
        heap.push(neighbor, next + heuristic(neighbor));
      }
    });
  }

  if (!prevEdge.has(target)) return null;
  return pathFromTree(graph, { source, cost, prevEdge }, target);
}
