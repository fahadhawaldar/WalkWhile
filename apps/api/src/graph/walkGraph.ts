import { Coordinate, GeoJSONPosition } from '@walkwhile/shared';
import { haversineDistance } from '../utils/geo.js';
import { GraphData, readGraphFile } from './graphFile.js';
import { EdgeKind } from './walkability.js';

/** One edge traversed in a particular direction. */
export interface Traversal {
  edge: number;
  forward: boolean;
}

export interface SnapResult {
  node: number;
  distanceMeters: number;
}

// ~550m cells at Dubai's latitude.
const GRID_CELL_DEGREES = 0.005;

// Nodes in components smaller than this are isolated fragments (a footway
// inside a compound, a mapping error) and are never used as start points.
const MIN_COMPONENT_SIZE = 200;

/**
 * In-memory pedestrian graph with adjacency lists and a spatial grid index.
 */
export class WalkGraph {
  readonly data: GraphData;
  readonly nodeCount: number;
  readonly edgeCount: number;

  /** CSR adjacency: neighbours of n are adjEdge/adjNode[adjStart[n]..adjStart[n+1]). */
  private readonly adjStart: Uint32Array;
  private readonly adjEdge: Uint32Array;
  private readonly adjNode: Uint32Array;

  private readonly componentSize: Uint32Array;
  private readonly grid = new Map<string, number[]>();

  constructor(data: GraphData) {
    this.data = data;
    this.nodeCount = data.header.nodeCount;
    this.edgeCount = data.header.edgeCount;

    const degree = new Uint32Array(this.nodeCount);
    for (let e = 0; e < this.edgeCount; e++) {
      degree[data.edgeFrom[e]]++;
      degree[data.edgeTo[e]]++;
    }

    this.adjStart = new Uint32Array(this.nodeCount + 1);
    for (let n = 0; n < this.nodeCount; n++) {
      this.adjStart[n + 1] = this.adjStart[n] + degree[n];
    }

    this.adjEdge = new Uint32Array(this.edgeCount * 2);
    this.adjNode = new Uint32Array(this.edgeCount * 2);
    const fill = this.adjStart.slice(0, this.nodeCount);
    for (let e = 0; e < this.edgeCount; e++) {
      const a = data.edgeFrom[e];
      const b = data.edgeTo[e];
      this.adjEdge[fill[a]] = e;
      this.adjNode[fill[a]++] = b;
      this.adjEdge[fill[b]] = e;
      this.adjNode[fill[b]++] = a;
    }

    this.componentSize = this.computeComponentSizes();

    for (let n = 0; n < this.nodeCount; n++) {
      const key = this.cellKey(data.nodeLon[n], data.nodeLat[n]);
      const bucket = this.grid.get(key);
      if (bucket) bucket.push(n);
      else this.grid.set(key, [n]);
    }
  }

  static load(path: string): WalkGraph {
    return new WalkGraph(readGraphFile(path));
  }

  /** Calls fn(edge, neighbour) for every edge touching node. */
  forEachNeighbor(node: number, fn: (edge: number, neighbor: number) => void): void {
    for (let i = this.adjStart[node]; i < this.adjStart[node + 1]; i++) {
      fn(this.adjEdge[i], this.adjNode[i]);
    }
  }

  degree(node: number): number {
    return this.adjStart[node + 1] - this.adjStart[node];
  }

  position(node: number): GeoJSONPosition {
    return [this.data.nodeLon[node], this.data.nodeLat[node]];
  }

  edgeLength(edge: number): number {
    return this.data.edgeLength[edge];
  }

  edgeCost(edge: number): number {
    return this.data.edgeCost[edge];
  }

  edgeKind(edge: number): EdgeKind {
    return this.data.edgeKind[edge] as EdgeKind;
  }

  edgeName(edge: number): string | null {
    const idx = this.data.edgeName[edge];
    return idx >= 0 ? this.data.header.names[idx] : null;
  }

  /** The node reached after traversing the edge in the given direction. */
  traversalEnd(t: Traversal): number {
    return t.forward ? this.data.edgeTo[t.edge] : this.data.edgeFrom[t.edge];
  }

  traversalStart(t: Traversal): number {
    return t.forward ? this.data.edgeFrom[t.edge] : this.data.edgeTo[t.edge];
  }

  /** Geometry of an edge in traversal order, endpoints included. */
  traversalGeometry(t: Traversal): GeoJSONPosition[] {
    const { geom, geomStart } = this.data;
    const coords: GeoJSONPosition[] = [];
    for (let i = geomStart[t.edge]; i < geomStart[t.edge + 1]; i++) {
      coords.push([geom[i * 2], geom[i * 2 + 1]]);
    }
    if (!t.forward) coords.reverse();
    return coords;
  }

  contains(coord: Coordinate): boolean {
    const [minLon, minLat, maxLon, maxLat] = this.data.header.bbox;
    return (
      coord.longitude >= minLon &&
      coord.longitude <= maxLon &&
      coord.latitude >= minLat &&
      coord.latitude <= maxLat
    );
  }

  /**
   * Finds the nearest well-connected node within maxDistanceMeters,
   * or null if there is none.
   */
  snap(coord: Coordinate, maxDistanceMeters: number): SnapResult | null {
    const cx = Math.floor(coord.longitude / GRID_CELL_DEGREES);
    const cy = Math.floor(coord.latitude / GRID_CELL_DEGREES);

    let best: SnapResult | null = null;
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const bucket = this.grid.get(`${cx + dx}:${cy + dy}`);
        if (!bucket) continue;
        for (const n of bucket) {
          if (this.componentSize[n] < MIN_COMPONENT_SIZE) continue;
          const d = haversineDistance(this.position(n), coord);
          if (d <= maxDistanceMeters && (!best || d < best.distanceMeters)) {
            best = { node: n, distanceMeters: d };
          }
        }
      }
    }
    return best;
  }

  private cellKey(lon: number, lat: number): string {
    return `${Math.floor(lon / GRID_CELL_DEGREES)}:${Math.floor(
      lat / GRID_CELL_DEGREES
    )}`;
  }

  private computeComponentSizes(): Uint32Array {
    const component = new Int32Array(this.nodeCount).fill(-1);
    const sizes: number[] = [];
    const stack: number[] = [];

    for (let start = 0; start < this.nodeCount; start++) {
      if (component[start] !== -1) continue;
      const id = sizes.length;
      let size = 0;
      component[start] = id;
      stack.push(start);
      while (stack.length > 0) {
        const n = stack.pop()!;
        size++;
        for (let i = this.adjStart[n]; i < this.adjStart[n + 1]; i++) {
          const m = this.adjNode[i];
          if (component[m] === -1) {
            component[m] = id;
            stack.push(m);
          }
        }
      }
      sizes.push(size);
    }

    const result = new Uint32Array(this.nodeCount);
    for (let n = 0; n < this.nodeCount; n++) result[n] = sizes[component[n]];
    return result;
  }
}
