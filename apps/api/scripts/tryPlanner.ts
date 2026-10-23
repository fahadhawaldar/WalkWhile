import { WalkGraph } from '../src/graph/walkGraph.js';
import { LoopPlanner } from '../src/graph/loopPlanner.js';

const t0 = performance.now();
const graph = WalkGraph.load(new URL('../../../data/graphs/dubai.graph', import.meta.url).pathname);
console.log(`load ${Math.round(performance.now() - t0)}ms`);

const places: Record<string, { latitude: number; longitude: number }> = {
  difc: { latitude: 25.2048, longitude: 55.2708 },
  downtown: { latitude: 25.1972, longitude: 55.2744 },
  marina: { latitude: 25.0784, longitude: 55.1394 },
};
const speed = 5;
for (const [name, origin] of Object.entries(places)) {
  const snap = graph.snap(origin, 150);
  if (!snap) { console.log(name, 'no snap'); continue; }
  for (const minutes of [10, 25, 45]) {
    for (const flexible of [false, true]) {
      const budgetSec = (minutes - 2.5) * 60;
      const maxLen = budgetSec / (3.6 / speed + 0.02);
      const t = performance.now();
      let routes: ReturnType<LoopPlanner['plan']> = [];
      for (const relax of flexible ? [1, 1.5, 2, 3] : [1]) {
        routes = new LoopPlanner(graph, {
          originNode: snap.node,
          targetLengthMeters: maxLen * 0.95,
          minLengthMeters: maxLen * 0.7,
          maxLengthMeters: maxLen,
          maxReturnMeters: flexible ? ((3 * 60 * speed) / 3.6) * relax : undefined,
        }).plan();
        if (routes.some((r) => r.type === 'loop')) break;
      }
      const ms = Math.round(performance.now() - t);
      const top = routes.slice(0, 3).map((r) => `${r.type[0]} ${Math.round(r.lengthMeters)}m ret${Math.round(r.maxReturnMeters)} s${r.score.toFixed(2)}`);
      console.log(`${name} ${minutes}m ${flexible ? 'flex' : 'fixed'} target ${Math.round(maxLen * 0.95)} | ${routes.length} cands ${ms}ms | ${top.join(' ; ')}`);
    }
  }
}
