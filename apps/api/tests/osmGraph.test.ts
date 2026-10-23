import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { GenerateRoutesRequest } from '@walkwhile/shared';
import { GraphData, readGraphFile, writeGraphFile } from '../src/graph/graphFile.js';
import { LoopPlanner, removeBacktracks } from '../src/graph/loopPlanner.js';
import { assessWalkability, EdgeKind } from '../src/graph/walkability.js';
import { WalkGraph } from '../src/graph/walkGraph.js';
import { OsmGraphProvider } from '../src/providers/osmGraphProvider.js';
import { generateWalkingRoutes } from '../src/services/routeGeneration.js';
import { calculateReturnRoute } from '../src/services/returnRoute.js';
import { haversineDistance } from '../src/utils/geo.js';

const ORIGIN = { latitude: 25.2048, longitude: 55.2708 };
const BLOCK_METERS = 100;
const GRID_SIZE = 21; // 2km x 2km, origin in the middle

/** A square street grid of footpaths with 100m blocks centred on ORIGIN. */
function buildGridGraph(): GraphData {
  const dLat = BLOCK_METERS / 111_320;
  const dLon = BLOCK_METERS / (111_320 * Math.cos((ORIGIN.latitude * Math.PI) / 180));
  const half = Math.floor(GRID_SIZE / 2);

  const nodeLon: number[] = [];
  const nodeLat: number[] = [];
  for (let j = 0; j < GRID_SIZE; j++) {
    for (let i = 0; i < GRID_SIZE; i++) {
      nodeLon.push(ORIGIN.longitude + (i - half) * dLon);
      nodeLat.push(ORIGIN.latitude + (j - half) * dLat);
    }
  }

  const edges: Array<[number, number]> = [];
  const id = (i: number, j: number) => j * GRID_SIZE + i;
  for (let j = 0; j < GRID_SIZE; j++) {
    for (let i = 0; i < GRID_SIZE; i++) {
      if (i + 1 < GRID_SIZE) edges.push([id(i, j), id(i + 1, j)]);
      if (j + 1 < GRID_SIZE) edges.push([id(i, j), id(i, j + 1)]);
    }
  }

  const geom: number[] = [];
  const geomStart: number[] = [];
  const edgeLength: number[] = [];
  for (const [a, b] of edges) {
    geomStart.push(geom.length / 2);
    geom.push(nodeLon[a], nodeLat[a], nodeLon[b], nodeLat[b]);
    edgeLength.push(
      haversineDistance([nodeLon[a], nodeLat[a]], [nodeLon[b], nodeLat[b]])
    );
  }
  geomStart.push(geom.length / 2);

  return {
    header: {
      nodeCount: nodeLon.length,
      edgeCount: edges.length,
      geomCoordCount: geom.length / 2,
      names: ['Grid Avenue'],
      bbox: [
        Math.min(...nodeLon),
        Math.min(...nodeLat),
        Math.max(...nodeLon),
        Math.max(...nodeLat),
      ],
      source: 'test grid',
      builtAt: new Date(0).toISOString(),
    },
    nodeLon: Float64Array.from(nodeLon),
    nodeLat: Float64Array.from(nodeLat),
    edgeFrom: Uint32Array.from(edges.map((e) => e[0])),
    edgeTo: Uint32Array.from(edges.map((e) => e[1])),
    edgeLength: Float32Array.from(edgeLength),
    edgeCost: new Float32Array(edges.length).fill(1),
    edgeKind: new Uint8Array(edges.length).fill(EdgeKind.Footway),
    edgeName: Int32Array.from(edges.map((_, k) => (k % 2 === 0 ? 0 : -1))),
    geomStart: Uint32Array.from(geomStart),
    geom: Float64Array.from(geom),
  };
}

const graph = new WalkGraph(buildGridGraph());
const provider = new OsmGraphProvider(graph);

function request(overrides: Partial<GenerateRoutesRequest>): GenerateRoutesRequest {
  return {
    origin: ORIGIN,
    availableMinutes: 20,
    walkingSpeedKmh: 5,
    safetyBufferMinutes: 2.5,
    maxRoutes: 3,
    waitType: 'fixed',
    maxReturnMinutes: 3,
    ...overrides,
  };
}

describe('walkability rules', () => {
  it('excludes motorways, trunk roads and ways closed to pedestrians', () => {
    expect(assessWalkability({ highway: 'motorway' })).toBeNull();
    expect(assessWalkability({ highway: 'trunk' })).toBeNull();
    expect(assessWalkability({ highway: 'residential', foot: 'no' })).toBeNull();
    expect(assessWalkability({ highway: 'service', access: 'private' })).toBeNull();
    expect(assessWalkability({ highway: 'service', service: 'driveway' })).toBeNull();
    expect(assessWalkability({ highway: 'secondary', tunnel: 'yes' })).toBeNull();
  });

  it('keeps private ways that explicitly allow pedestrians', () => {
    expect(
      assessWalkability({ highway: 'service', access: 'private', foot: 'yes' })
    ).not.toBeNull();
  });

  it('prefers footpaths over busy roads', () => {
    const footway = assessWalkability({ highway: 'footway' })!;
    const primary = assessWalkability({ highway: 'primary' })!;
    expect(footway.costFactor).toBeLessThan(primary.costFactor);
    expect(footway.kind).toBe(EdgeKind.Footway);
    expect(
      assessWalkability({ highway: 'footway', footway: 'crossing' })!.kind
    ).toBe(EdgeKind.Crossing);
  });
});

describe('graph file', () => {
  it('round-trips through disk', () => {
    const dir = mkdtempSync(join(tmpdir(), 'walkwhile-graph-'));
    const path = join(dir, 'grid.graph');
    const data = buildGridGraph();
    writeGraphFile(path, data);
    const loaded = readGraphFile(path);

    expect(loaded.header.nodeCount).toBe(data.header.nodeCount);
    expect(Array.from(loaded.edgeFrom)).toEqual(Array.from(data.edgeFrom));
    expect(Array.from(loaded.geom)).toEqual(Array.from(data.geom));
    expect(loaded.header.names).toEqual(['Grid Avenue']);
  });
});

describe('loop planner', () => {
  const snap = graph.snap(ORIGIN, 150)!;

  it('removes immediate back-and-forth moves', () => {
    expect(
      removeBacktracks([
        { edge: 1, forward: true },
        { edge: 2, forward: true },
        { edge: 2, forward: false },
        { edge: 3, forward: true },
      ])
    ).toEqual([
      { edge: 1, forward: true },
      { edge: 3, forward: true },
    ]);
  });

  it('plans fixed-wait loops that start and end at the origin within length bounds', () => {
    const routes = new LoopPlanner(graph, {
      originNode: snap.node,
      targetLengthMeters: 1500,
      minLengthMeters: 1100,
      maxLengthMeters: 1600,
    }).plan();

    expect(routes.length).toBeGreaterThan(0);
    for (const route of routes) {
      expect(graph.traversalStart(route.traversals[0])).toBe(snap.node);
      expect(graph.traversalEnd(route.traversals[route.traversals.length - 1])).toBe(
        snap.node
      );
      expect(route.lengthMeters).toBeGreaterThanOrEqual(1100);
      expect(route.lengthMeters).toBeLessThanOrEqual(1600);
    }
    expect(routes[0].type).toBe('loop');
  });

  it('keeps flexible-wait routes close to the origin', () => {
    const limit = 300;
    const routes = new LoopPlanner(graph, {
      originNode: snap.node,
      targetLengthMeters: 2000,
      minLengthMeters: 1200,
      maxLengthMeters: 2100,
      maxReturnMeters: limit,
    }).plan();

    expect(routes.length).toBeGreaterThan(0);
    for (const route of routes) {
      expect(route.maxReturnMeters).toBeLessThanOrEqual(limit * 1.15);
    }
  });
});

describe('OSM graph provider', () => {
  it('generates budget-respecting routes with turn-by-turn steps', async () => {
    const req = request({ availableMinutes: 20 });
    const result = await generateWalkingRoutes(req, provider);

    expect(result.routes.length).toBeGreaterThan(0);
    for (const route of result.routes) {
      const coords = route.geometry.coordinates;
      expect(haversineDistance(coords[0], ORIGIN)).toBeLessThanOrEqual(150);
      expect(haversineDistance(coords[coords.length - 1], ORIGIN)).toBeLessThanOrEqual(150);
      expect(route.calibratedDurationSeconds / 60 + req.safetyBufferMinutes).toBeLessThanOrEqual(
        req.availableMinutes
      );
      expect(route.instructions[0].type).toBe('depart');
      expect(route.instructions[route.instructions.length - 1].type).toBe('arrive');
      expect(route.maxReturnSeconds).toBeGreaterThan(0);
    }
  });

  it('flexible waits stay closer to the start than fixed waits', async () => {
    const fixed = await generateWalkingRoutes(request({ availableMinutes: 30 }), provider);
    const flexible = await generateWalkingRoutes(
      request({ availableMinutes: 30, waitType: 'flexible', maxReturnMinutes: 3 }),
      provider
    );

    const furthest = (routes: typeof fixed.routes) =>
      Math.min(...routes.map((r) => r.maxReturnSeconds!));
    expect(flexible.routes.length).toBeGreaterThan(0);
    expect(furthest(flexible.routes)).toBeLessThan(furthest(fixed.routes));
  });

  it('rejects locations outside the covered area', async () => {
    await expect(
      generateWalkingRoutes(
        request({ origin: { latitude: 24.4539, longitude: 54.3773 } }),
        provider
      )
    ).rejects.toMatchObject({ statusCode: 422 });
  });

  it('routes back to the origin from the current position', async () => {
    const result = await calculateReturnRoute(
      {
        originalOrigin: ORIGIN,
        currentLocation: { latitude: ORIGIN.latitude + 0.004, longitude: ORIGIN.longitude + 0.004 },
        remainingMinutes: 15,
        walkingSpeedKmh: 5,
        safetyBufferMinutes: 2.5,
      },
      provider
    );

    const coords = result.route.geometry.coordinates;
    expect(haversineDistance(coords[coords.length - 1], ORIGIN)).toBeLessThan(1);
    // Grid walking (Manhattan distance) is ~890m for this offset.
    expect(result.route.distanceMeters).toBeGreaterThan(800);
    expect(result.route.distanceMeters).toBeLessThan(1000);
    expect(result.status).toBe('safe');
  });
});
