import { readFileSync, writeFileSync } from 'node:fs';

/**
 * On-disk format for a pedestrian graph built from OpenStreetMap.
 *
 * Layout: "WWG1" magic, uint32 header byte length, JSON header, zero padding
 * to an 8-byte boundary, then the typed arrays in the order of ARRAY_SPECS.
 *
 * Nodes are intersections and dead ends. Each edge is an undirected street
 * segment between two nodes, with its full geometry stored in `geom` as
 * interleaved [lon, lat] pairs from geomStart[e] to geomStart[e + 1].
 */

const MAGIC = 'WWG1';

export interface GraphHeader {
  nodeCount: number;
  edgeCount: number;
  geomCoordCount: number;
  names: string[];
  bbox: [number, number, number, number];
  source: string;
  builtAt: string;
}

export interface GraphArrays {
  nodeLon: Float64Array;
  nodeLat: Float64Array;
  edgeFrom: Uint32Array;
  edgeTo: Uint32Array;
  edgeLength: Float32Array;
  edgeCost: Float32Array;
  edgeKind: Uint8Array;
  edgeName: Int32Array;
  geomStart: Uint32Array;
  geom: Float64Array;
}

export interface GraphData extends GraphArrays {
  header: GraphHeader;
}

type ArrayCtor =
  | Float64ArrayConstructor
  | Float32ArrayConstructor
  | Uint32ArrayConstructor
  | Int32ArrayConstructor
  | Uint8ArrayConstructor;

const ARRAY_SPECS: Array<{
  key: keyof GraphArrays;
  ctor: ArrayCtor;
  length: (h: GraphHeader) => number;
}> = [
  { key: 'nodeLon', ctor: Float64Array, length: (h) => h.nodeCount },
  { key: 'nodeLat', ctor: Float64Array, length: (h) => h.nodeCount },
  { key: 'geom', ctor: Float64Array, length: (h) => h.geomCoordCount * 2 },
  { key: 'edgeFrom', ctor: Uint32Array, length: (h) => h.edgeCount },
  { key: 'edgeTo', ctor: Uint32Array, length: (h) => h.edgeCount },
  { key: 'edgeLength', ctor: Float32Array, length: (h) => h.edgeCount },
  { key: 'edgeCost', ctor: Float32Array, length: (h) => h.edgeCount },
  { key: 'edgeName', ctor: Int32Array, length: (h) => h.edgeCount },
  { key: 'geomStart', ctor: Uint32Array, length: (h) => h.edgeCount + 1 },
  { key: 'edgeKind', ctor: Uint8Array, length: (h) => h.edgeCount },
];

function align8(n: number): number {
  return Math.ceil(n / 8) * 8;
}

export function writeGraphFile(path: string, data: GraphData): void {
  const headerBytes = Buffer.from(JSON.stringify(data.header), 'utf8');
  const prefixLength = align8(MAGIC.length + 4 + headerBytes.length);

  const parts: Buffer[] = [];
  const prefix = Buffer.alloc(prefixLength);
  prefix.write(MAGIC, 0, 'ascii');
  prefix.writeUInt32LE(headerBytes.length, 4);
  headerBytes.copy(prefix, 8);
  parts.push(prefix);

  for (const spec of ARRAY_SPECS) {
    const arr = data[spec.key];
    if (arr.length !== spec.length(data.header)) {
      throw new Error(`Graph array ${spec.key} has unexpected length`);
    }
    const bytes = Buffer.from(arr.buffer, arr.byteOffset, arr.byteLength);
    parts.push(bytes);
    const pad = align8(bytes.length) - bytes.length;
    if (pad > 0) parts.push(Buffer.alloc(pad));
  }

  writeFileSync(path, Buffer.concat(parts));
}

export function readGraphFile(path: string): GraphData {
  const file = readFileSync(path);
  if (file.toString('ascii', 0, 4) !== MAGIC) {
    throw new Error(`${path} is not a WalkWhile graph file`);
  }

  const headerLength = file.readUInt32LE(4);
  const header = JSON.parse(
    file.toString('utf8', 8, 8 + headerLength)
  ) as GraphHeader;

  let offset = align8(8 + headerLength);
  const arrays: Partial<GraphArrays> = {};

  for (const spec of ARRAY_SPECS) {
    const length = spec.length(header);
    const byteLength = length * spec.ctor.BYTES_PER_ELEMENT;
    // Copy into a fresh buffer so typed array alignment is guaranteed.
    const copy = new Uint8Array(byteLength);
    copy.set(file.subarray(offset, offset + byteLength));
    (arrays as Record<string, unknown>)[spec.key] = new spec.ctor(copy.buffer);
    offset += align8(byteLength);
  }

  return { header, ...(arrays as GraphArrays) };
}
