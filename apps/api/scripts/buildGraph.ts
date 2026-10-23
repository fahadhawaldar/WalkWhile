/**
 * Builds a pedestrian graph file from an OSM OPL export of highway ways
 * (produced by scripts/prepareOsm.sh).
 *
 * Usage: tsx scripts/buildGraph.ts <input.opl> <output.graph> [source label]
 */
import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import { haversineDistance } from '../src/utils/geo.js';
import { writeGraphFile } from '../src/graph/graphFile.js';
import {
  assessWalkability,
  EdgeKind,
  pickName,
  Tags,
} from '../src/graph/walkability.js';

interface RawWay {
  nodeIds: number[];
  lons: number[];
  lats: number[];
  costFactor: number;
  kind: EdgeKind;
  name: string | null;
}

function unescapeOpl(value: string): string {
  return value.replace(/%([0-9a-fA-F]+)%/g, (_m, hex: string) =>
    String.fromCodePoint(parseInt(hex, 16))
  );
}

function parseTags(field: string): Tags {
  const tags: Tags = {};
  if (!field) return tags;
  for (const pair of field.split(',')) {
    const eq = pair.indexOf('=');
    if (eq <= 0) continue;
    tags[unescapeOpl(pair.slice(0, eq))] = unescapeOpl(pair.slice(eq + 1));
  }
  return tags;
}

function parseWayLine(line: string): RawWay | null {
  let tagField = '';
  let nodeField = '';
  for (const field of line.split(' ')) {
    if (field.startsWith('T')) tagField = field.slice(1);
    else if (field.startsWith('N')) nodeField = field.slice(1);
  }

  const tags = parseTags(tagField);
  const walk = assessWalkability(tags);
  if (!walk || !nodeField) return null;

  const nodeIds: number[] = [];
  const lons: number[] = [];
  const lats: number[] = [];

  // Node refs look like "n123x55.2708y25.2048"; missing locations ("x y")
  // occur at extract borders and split the way there.
  for (const ref of nodeField.split(',')) {
    const x = ref.indexOf('x');
    const y = ref.indexOf('y');
    const lon = parseFloat(ref.slice(x + 1, y));
    const lat = parseFloat(ref.slice(y + 1));
    if (Number.isNaN(lon) || Number.isNaN(lat)) continue;
    nodeIds.push(Number(ref.slice(1, x)));
    lons.push(lon);
    lats.push(lat);
  }

  if (nodeIds.length < 2) return null;

  return {
    nodeIds,
    lons,
    lats,
    costFactor: walk.costFactor,
    kind: walk.kind,
    name: pickName(tags),
  };
}

async function main(): Promise<void> {
  const [inputPath, outputPath, source = 'OpenStreetMap'] =
    process.argv.slice(2);
  if (!inputPath || !outputPath) {
    console.error(
      'Usage: tsx scripts/buildGraph.ts <input.opl> <output.graph> [source]'
    );
    process.exit(1);
  }

  const ways: RawWay[] = [];
  const useCount = new Map<number, number>();

  const lines = createInterface({ input: createReadStream(inputPath) });
  for await (const line of lines) {
    if (!line.startsWith('w')) continue;
    const way = parseWayLine(line);
    if (!way) continue;
    ways.push(way);
    for (let i = 0; i < way.nodeIds.length; i++) {
      const id = way.nodeIds[i];
      // Way endpoints always become graph nodes.
      const weight = i === 0 || i === way.nodeIds.length - 1 ? 2 : 1;
      useCount.set(id, (useCount.get(id) ?? 0) + weight);
    }
  }
  console.log(`Walkable ways: ${ways.length}`);

  const nodeIndex = new Map<number, number>();
  const nodeLon: number[] = [];
  const nodeLat: number[] = [];
  const nameIndex = new Map<string, number>();
  const names: string[] = [];

  const edgeFrom: number[] = [];
  const edgeTo: number[] = [];
  const edgeLength: number[] = [];
  const edgeCost: number[] = [];
  const edgeKind: number[] = [];
  const edgeName: number[] = [];
  const geomStart: number[] = [];
  const geom: number[] = [];

  let minLon = Infinity;
  let minLat = Infinity;
  let maxLon = -Infinity;
  let maxLat = -Infinity;

  const graphNode = (way: RawWay, i: number): number => {
    const id = way.nodeIds[i];
    let idx = nodeIndex.get(id);
    if (idx === undefined) {
      idx = nodeLon.length;
      nodeIndex.set(id, idx);
      nodeLon.push(way.lons[i]);
      nodeLat.push(way.lats[i]);
      minLon = Math.min(minLon, way.lons[i]);
      maxLon = Math.max(maxLon, way.lons[i]);
      minLat = Math.min(minLat, way.lats[i]);
      maxLat = Math.max(maxLat, way.lats[i]);
    }
    return idx;
  };

  for (const way of ways) {
    let nameId = -1;
    if (way.name) {
      nameId = nameIndex.get(way.name) ?? -1;
      if (nameId === -1) {
        nameId = names.length;
        names.push(way.name);
        nameIndex.set(way.name, nameId);
      }
    }

    let segmentStart = 0;
    for (let i = 1; i < way.nodeIds.length; i++) {
      const isLast = i === way.nodeIds.length - 1;
      if (!isLast && (useCount.get(way.nodeIds[i]) ?? 0) < 2) continue;

      const from = graphNode(way, segmentStart);
      const to = graphNode(way, i);

      let length = 0;
      for (let k = segmentStart + 1; k <= i; k++) {
        length += haversineDistance(
          [way.lons[k - 1], way.lats[k - 1]],
          [way.lons[k], way.lats[k]]
        );
      }

      if (from !== to && length > 0) {
        edgeFrom.push(from);
        edgeTo.push(to);
        edgeLength.push(length);
        edgeCost.push(way.costFactor);
        edgeKind.push(way.kind);
        edgeName.push(nameId);
        geomStart.push(geom.length / 2);
        for (let k = segmentStart; k <= i; k++) {
          geom.push(way.lons[k], way.lats[k]);
        }
      }

      segmentStart = i;
    }
  }
  geomStart.push(geom.length / 2);

  writeGraphFile(outputPath, {
    header: {
      nodeCount: nodeLon.length,
      edgeCount: edgeFrom.length,
      geomCoordCount: geom.length / 2,
      names,
      bbox: [minLon, minLat, maxLon, maxLat],
      source,
      builtAt: new Date().toISOString(),
    },
    nodeLon: Float64Array.from(nodeLon),
    nodeLat: Float64Array.from(nodeLat),
    edgeFrom: Uint32Array.from(edgeFrom),
    edgeTo: Uint32Array.from(edgeTo),
    edgeLength: Float32Array.from(edgeLength),
    edgeCost: Float32Array.from(edgeCost),
    edgeKind: Uint8Array.from(edgeKind),
    edgeName: Int32Array.from(edgeName),
    geomStart: Uint32Array.from(geomStart),
    geom: Float64Array.from(geom),
  });

  console.log(
    `Graph: ${nodeLon.length} nodes, ${edgeFrom.length} edges, ${
      geom.length / 2
    } geometry points, ${names.length} street names -> ${outputPath}`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
