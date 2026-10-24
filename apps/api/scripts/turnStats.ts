import { WalkGraph } from '../src/graph/walkGraph.js';
import { LoopPlanner } from '../src/graph/loopPlanner.js';
import { angleDifference, bearingBetween } from '../src/utils/geo.js';
import { Traversal } from '../src/graph/walkGraph.js';

// Counts real turns (>= 45 degrees at an intersection) in planned loops.
const graph = WalkGraph.load(new URL('../../../data/graphs/dubai.graph', import.meta.url).pathname);

function heading(t: Traversal, atEnd: boolean): number {
  const g = graph.traversalGeometry(t);
  return atEnd
    ? bearingBetween(g[g.length - 2], g[g.length - 1])
    : bearingBetween(g[0], g[1]);
}

function turns(ts: Traversal[]): number {
  let n = 0;
  for (let i = 1; i < ts.length; i++) {
    if (graph.degree(graph.traversalStart(ts[i])) < 3) continue;
    if (angleDifference(heading(ts[i - 1], true), heading(ts[i], false)) >= 45) n++;
  }
  return n;
}

const places: Record<string, { latitude: number; longitude: number }> = {
  difc: { latitude: 25.2048, longitude: 55.2708 },
  downtown: { latitude: 25.1972, longitude: 55.2744 },
  marina: { latitude: 25.0784, longitude: 55.1394 },
  karama: { latitude: 25.2425, longitude: 55.3045 },
  barsha: { latitude: 25.1050, longitude: 55.1990 },
  jlt: { latitude: 25.0700, longitude: 55.1440 },
};
let totalTurns = 0, totalKm = 0, totalMs = 0;
for (const [name, origin] of Object.entries(places)) {
  const snap = graph.snap(origin, 150)!;
  for (const minutes of [15, 30]) {
    const maxLen = ((minutes - 2.5) * 60) / (3.6 / 5 + 0.02);
    const t = performance.now();
    const routes = new LoopPlanner(graph, {
      originNode: snap.node,
      targetLengthMeters: maxLen * 0.95,
      minLengthMeters: maxLen * 0.7,
      maxLengthMeters: maxLen,
    }).plan(3);
    const ms = performance.now() - t;
    totalMs += ms;
    const desc = routes.map((r) => {
      const n = turns(r.traversals);
      totalTurns += n; totalKm += r.lengthMeters / 1000;
      return `${Math.round(r.lengthMeters)}m ${n} turns`;
    });
    console.log(`${name.padEnd(9)} ${minutes}m ${Math.round(ms)}ms | ${desc.join(' ; ')}`);
  }
}
console.log(`turns per km: ${(totalTurns / totalKm).toFixed(1)}, avg plan ${Math.round(totalMs / 12)}ms`);
