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

- **`OpenRouteServiceProvider`**: Communicates with the official OpenRouteService API (`POST /v2/directions/foot-walking/geojson` with `options.round_trip`).
- **`MockRoutingProvider`**: Provides deterministic, topologically sound pedestrian geometry for offline development and automated testing.
- **Provider Switching**: Automatically selects `OpenRouteServiceProvider` when `OPENROUTESERVICE_API_KEY` is present, or defaults safely to `MockRoutingProvider`.

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
