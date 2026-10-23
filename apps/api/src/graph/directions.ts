import { Coordinate, GeoJSONPosition, RouteStep } from '@walkwhile/shared';
import { haversineDistance } from '../utils/geo.js';
import { angleDifference, bearingBetween } from './loopPlanner.js';
import { EdgeKind } from './walkability.js';
import { Traversal, WalkGraph } from './walkGraph.js';

export interface AssembledRoute {
  coordinates: GeoJSONPosition[];
  distanceMeters: number;
  steps: RouteStep[];
}

// Bends sharper than this start a new step even on the same street.
const TURN_THRESHOLD_DEGREES = 50;
// Unnamed footpaths zigzag a lot; only clear turns are worth announcing.
const UNNAMED_TURN_THRESHOLD_DEGREES = 70;
// Steps shorter than this are folded into the previous step.
const MIN_STEP_METERS = 20;
// Connectors shorter than this (GPS noise) are not drawn.
const MIN_CONNECTOR_METERS = 5;

interface StepDraft {
  name: string | null;
  kind: EdgeKind;
  turn: number | null;
  startCoord: number;
  endCoord: number;
  distance: number;
}

/**
 * Turns a sequence of edge traversals into route geometry and turn-by-turn
 * steps. `from` and `to` are the walker's real positions; short straight
 * connectors are added between them and the snapped graph nodes.
 */
export function assembleRoute(
  graph: WalkGraph,
  traversals: Traversal[],
  from: Coordinate,
  to: Coordinate,
  arrivalText: string
): AssembledRoute {
  const coordinates: GeoJSONPosition[] = [];
  const drafts: StepDraft[] = [];
  let distance = 0;

  const push = (pos: GeoJSONPosition) => {
    const last = coordinates[coordinates.length - 1];
    if (last && last[0] === pos[0] && last[1] === pos[1]) return;
    if (last) distance += haversineDistance(last, pos);
    coordinates.push(pos);
  };

  const fromPos: GeoJSONPosition = [from.longitude, from.latitude];
  const toPos: GeoJSONPosition = [to.longitude, to.latitude];

  const firstNode =
    traversals.length > 0 ? graph.position(graph.traversalStart(traversals[0])) : null;
  push(fromPos);
  if (firstNode && haversineDistance(fromPos, firstNode) >= MIN_CONNECTOR_METERS) {
    push(firstNode);
  }

  let previousBearing: number | null = null;
  for (const t of traversals) {
    const geometry = graph.traversalGeometry(t);
    const name = graph.edgeName(t.edge);
    const kind = graph.edgeKind(t.edge);
    const startCoord = Math.max(0, coordinates.length - 1);
    const distanceBefore = distance;

    const entryBearing = bearingBetween(geometry[0], geometry[1]);
    const turn =
      previousBearing === null ? null : signedTurn(previousBearing, entryBearing);

    for (const pos of geometry) push(pos);
    previousBearing = bearingBetween(
      geometry[geometry.length - 2],
      geometry[geometry.length - 1]
    );

    const current = drafts[drafts.length - 1];
    const threshold =
      name === null ? UNNAMED_TURN_THRESHOLD_DEGREES : TURN_THRESHOLD_DEGREES;
    const sameWay =
      current &&
      current.name === name &&
      current.kind === kind &&
      (turn === null || Math.abs(turn) < threshold);

    if (sameWay) {
      current.endCoord = coordinates.length - 1;
      current.distance += distance - distanceBefore;
    } else {
      drafts.push({
        name,
        kind,
        turn,
        startCoord,
        endCoord: coordinates.length - 1,
        distance: distance - distanceBefore,
      });
    }
  }

  // Fold tiny steps (short connectors between paths) into the previous one,
  // except road crossings, which are always worth announcing.
  const merged: StepDraft[] = [];
  for (const d of drafts) {
    const previous = merged[merged.length - 1];
    if (previous && d.distance < MIN_STEP_METERS && d.kind !== EdgeKind.Crossing) {
      previous.endCoord = d.endCoord;
      previous.distance += d.distance;
    } else {
      merged.push(d);
    }
  }

  if (haversineDistance(coordinates[coordinates.length - 1], toPos) >= MIN_CONNECTOR_METERS) {
    push(toPos);
  } else {
    coordinates[coordinates.length - 1] = toPos;
  }

  const steps: RouteStep[] = merged.map((d, i) => ({
    instruction: describeStep(d, i === 0, coordinates),
    distanceMeters: Math.round(d.distance),
    durationSeconds: 0,
    type: i === 0 ? 'depart' : turnType(d.turn),
    name: d.name ?? '',
    waypointIndices: [d.startCoord, d.endCoord],
  }));

  steps.push({
    instruction: arrivalText,
    distanceMeters: 0,
    durationSeconds: 0,
    type: 'arrive',
    name: '',
    waypointIndices: [coordinates.length - 1, coordinates.length - 1],
  });

  return { coordinates, distanceMeters: distance, steps };
}

/** Negative = left, positive = right, in degrees. */
function signedTurn(fromBearing: number, toBearing: number): number {
  const magnitude = angleDifference(fromBearing, toBearing);
  const clockwise = (((toBearing - fromBearing) % 360) + 360) % 360;
  return clockwise <= 180 ? magnitude : -magnitude;
}

function turnType(turn: number | null): string {
  if (turn === null) return 'continue';
  const abs = Math.abs(turn);
  const side = turn < 0 ? 'left' : 'right';
  if (abs < 20) return 'continue';
  if (abs < 60) return `slight-${side}`;
  if (abs < 140) return side;
  return 'uturn';
}

function wayLabel(d: StepDraft): string {
  if (d.name) return d.name;
  switch (d.kind) {
    case EdgeKind.Steps:
      return 'the steps';
    case EdgeKind.Pedestrian:
      return 'the pedestrian walkway';
    case EdgeKind.Path:
      return 'the path';
    case EdgeKind.Footway:
      return 'the footpath';
    default:
      return 'the street';
  }
}

function describeStep(
  d: StepDraft,
  isFirst: boolean,
  coordinates: GeoJSONPosition[]
): string {
  const label = wayLabel(d);

  if (d.kind === EdgeKind.Crossing) {
    return isFirst ? 'Cross the road' : `${turnPhrase(d.turn)} and cross the road`;
  }

  if (isFirst) {
    const a = coordinates[d.startCoord];
    const b = coordinates[Math.min(d.endCoord, d.startCoord + 1)];
    return `Head ${compass(bearingBetween(a, b))} on ${label}`;
  }

  const phrase = turnPhrase(d.turn);
  return phrase === 'Continue' ? `Continue onto ${label}` : `${phrase} onto ${label}`;
}

function turnPhrase(turn: number | null): string {
  switch (turnType(turn)) {
    case 'slight-left':
      return 'Bear left';
    case 'slight-right':
      return 'Bear right';
    case 'left':
      return 'Turn left';
    case 'right':
      return 'Turn right';
    case 'uturn':
      return 'Turn around';
    default:
      return 'Continue';
  }
}

function compass(bearing: number): string {
  const names = [
    'north',
    'northeast',
    'east',
    'southeast',
    'south',
    'southwest',
    'west',
    'northwest',
  ];
  return names[Math.round(bearing / 45) % 8];
}
