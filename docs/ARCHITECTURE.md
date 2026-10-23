# WalkWhile: Architecture & Engineering Design

WalkWhile turns waiting time into walking opportunities. It accepts a user's current or selected origin and an available time budget, and generates up to 3 validated, distinct pedestrian walking routes that start and end at the same location.

---

## 1. Monorepo Structure

```
walkwhile/
├── apps/
│   ├── api/                 # Node.js + Express + TypeScript routing backend
│   └── mobile/              # React Native + Expo Router + TypeScript app (Milestones 2 & 3)
├── packages/
│   └── shared/              # Shared types, Zod schemas, domain models, and constants
├── docs/                    # Architecture, API specs, and integration test guide
├── package.json             # Monorepo root workspace configuration
└── tsconfig.base.json       # Base TypeScript configuration
```

---

## 2. Core Routing Pipeline

The route generation process follows an 8-step pipeline:

```
+-----------------------------------------------------------+
| 1. Input Validation (Coordinates, Time Bounds, Speeds)    |
+-----------------------------------------------------------+
                             |
                             v
+-----------------------------------------------------------+
| 2. Time-Budget Calculation:                               |
|    walkingBudget = max(0, available - safetyBuffer)       |
|    targetDistance = speed * walkingBudget                 |
+-----------------------------------------------------------+
                             |
                             v
+-----------------------------------------------------------+
| 3. Multi-Seed Routing Query:                              |
|    Query IRoutingProvider with diverse seeds [1,42,99...] |
+-----------------------------------------------------------+
                             |
                             v
+-----------------------------------------------------------+
| 4. Normalization & Spatial Boundary Checks:               |
|    - GeoJSON LineString validation                        |
|    - Origin snap tolerance check (<= 150m)                |
|    - Reject broken or zero-distance geometries            |
+-----------------------------------------------------------+
                             |
                             v
+-----------------------------------------------------------+
| 5. Duration Calibration & Strict Budget Gate:             |
|    - User-calibrated duration + intersection buffer       |
|    - Gate: duration + safetyBuffer <= availableTime       |
+-----------------------------------------------------------+
                             |
                             v
+-----------------------------------------------------------+
| 6. Spatial Corridor Overlap & Diversity Engine:           |
|    - Resample routes every 20 meters                      |
|    - Compute bidirectional corridor overlap (25m buffer)  |
|    - Discard routes with > 65% overlap                    |
+-----------------------------------------------------------+
                             |
                             v
+-----------------------------------------------------------+
| 7. Out-and-Back Fallback:                                 |
|    - If < maxRoutes, generate multi-waypoint out-and-back |
|    - Radiate along bearings (0°, 120°, 240°)              |
+-----------------------------------------------------------+
                             |
                             v
+-----------------------------------------------------------+
| 8. Structured Response Delivery:                          |
|    - GeoJSON LineStrings, steps, warnings, disclaimers    |
+-----------------------------------------------------------+
```

---

## 3. Provider Abstraction (`IRoutingProvider`)

To ensure WalkWhile is never locked into a single provider, all routing operations are implemented behind `IRoutingProvider`:

```typescript
export interface IRoutingProvider {
  readonly name: string;
  generateRoundTrip(params: ProviderRoundTripParams): Promise<ProviderRouteCandidate | null>;
  generateOutAndBack(params: ProviderOutAndBackParams): Promise<ProviderRouteCandidate | null>;
  calculateReturnRoute(params: ProviderReturnParams): Promise<ProviderRouteCandidate>;
}
```

- **`OsmGraphProvider`** (default): WalkWhile's own planner running on a pedestrian graph built from OpenStreetMap (see section 7). Implements `planWalkingRoutes`, which replaces the seed-based round-trip calls.
- **`OpenRouteServiceProvider`**: Communicates with the official OpenRouteService API (`POST /v2/directions/foot-walking/geojson` with `options.round_trip`).
- **`MockRoutingProvider`**: Provides deterministic, topologically sound pedestrian geometry for offline development and automated testing.
- **Provider Switching**: `ROUTING_PROVIDER=osm` (default) loads the graph at `GRAPH_PATH`; `openrouteservice` needs `OPENROUTESERVICE_API_KEY`. Either falls back to `MockRoutingProvider` when its data or key is missing.

---

## 4. Time Budget & Speed Calibration

$$\text{walkingBudgetMinutes} = \max(0, \text{availableMinutes} - \text{safetyBufferMinutes})$$

$$\text{targetDistanceMeters} = \frac{\text{walkingSpeedKmh} \times 1000 \times \text{walkingBudgetMinutes}}{60}$$

### Pedestrian Crossing Allowance
Standard pedestrian routing often assumes uninterrupted travel. WalkWhile adds an intersection and crossing buffer:
$$\text{allowance} = \frac{\text{distanceMeters}}{1000} \times 20\text{ seconds}$$

---

## 5. Spatial Overlap Algorithm

Rather than checking if start/end points or total distances match:
1. Each route is discretized into points every $20\text{m}$.
2. For each point $p_a$ in Route $A$, we determine if $p_a$ is within $25\text{m}$ of any segment in Route $B$.
3. Bidirectional overlap score:
   $$\text{overlap}(A, B) = \max\left(\frac{|\text{points}_A \text{ near } B|}{|\text{points}_A|}, \frac{|\text{points}_B \text{ near } A|}{|\text{points}_B|}\right)$$
4. Candidates with $\text{overlap} \ge 0.65$ are pruned.

---

## 6. Safety & Disclaimers

In accordance with core requirements:
- The app **never** promises guaranteed on-time arrival or declares a path 100% safe.
- Standard disclaimers are attached to every API response and displayed prominently in client views.

---

## 7. Own Routing on OpenStreetMap (`apps/api/src/graph/`)

Public Overpass servers proved too slow (30s+ or timeouts) for someone standing on a street, so WalkWhile keeps its own copy of the street network.

**Data pipeline** (`apps/api/scripts/prepareOsm.sh`, needs `brew install osmium-tool`): downloads the Geofabrik GCC extract, cuts the Dubai bounding box, keeps `highway` ways, and runs `scripts/buildGraph.ts`, which applies the walkability rules and writes `data/graphs/dubai.graph` (~42 MB, ~290k intersections, ~400k segments). Both `data/raw/` and `data/graphs/` are git-ignored; rerun the script to refresh the data.

| File | Role |
| :--- | :--- |
| `walkability.ts` | Which OSM ways are walkable and a preference cost per way (footpaths < quiet streets < big roads; motorways, trunk roads, private and road tunnels excluded). |
| `graphFile.ts` | Compact binary graph format (typed arrays + JSON header). |
| `walkGraph.ts` | In-memory graph: adjacency lists, spatial grid for snapping, small disconnected fragments ignored. |
| `search.ts` | Dijkstra shortest-path tree and A* point-to-point search. |
| `loopPlanner.ts` | Loop generation (below). |
| `directions.ts` | Route geometry and turn-by-turn steps from edge sequences. |

**Loop planning.** One Dijkstra tree from the start gives the walking distance *back* from every nearby intersection. Loops are triangles start → A → B → start, with A and B picked from that tree by bearing and distance, legs found with A* (already used streets cost 5x, so legs avoid doubling back), and the triangle rescaled until the length is within a few percent of the target. Candidates are scored on length accuracy, street reuse, walking comfort and, for flexible waits, how far they stray.

**Wait types.**
- `fixed` (air fryer, laundry): one loop that uses ~95% of the walking budget.
- `flexible` (friend on the way): a pool of small loops ("petals") in every direction is combined greedily, most distinct first, until the time is filled, so the walker never gets more than `maxReturnMinutes` from the start. In sparse areas the limit is relaxed (1.5x, 2x, 3x) and a warning is returned. Every route reports `maxReturnSeconds`.

**Return routes** are A* shortest paths from the walker's snapped position to the start, entirely in memory (no network calls).
