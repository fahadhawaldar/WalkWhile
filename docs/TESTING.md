# WalkWhile: Testing & Verification Guide

This document details how to execute automated tests and conduct real-world integration verification across diverse pedestrian layouts.

---

## 1. Automated Testing

### Run All Unit and Integration Tests
```bash
npm test
```
Or specifically inside the API package:
```bash
cd apps/api
npm test
```

### Run Type Checking
```bash
npm run typecheck
```

---

## 2. Test Coverage Overview

| Test Suite | File | What is Verified |
| :--- | :--- | :--- |
| **Time Budget & Bounds** | `tests/timeBudget.test.ts` | Formula calculations (5m, 10m, 60m budgets), duration calibration, crossing allowances, and return status triggers (`safe`, `warning`, `urgent`, `overdue`). |
| **Spatial Overlap & Diversity** | `tests/routeDiversity.test.ts` | Equidistant point sampling, 25m pedestrian corridor buffer evaluation, 100% detection on duplicates, pruning routes with $>65\%$ overlap. |
| **Route Generation Engine** | `tests/routeGeneration.test.ts` | 10-minute target budget generation, GeoJSON LineString validation, origin snap proximity ($\le 150\text{m}$), out-and-back fallback when loops fail, and clean error explanation. |
| **Return Route** | `tests/returnRoute.test.ts` | Shortest return path calculation, safety margin evaluation, dynamic status and recommended action triggers. |
| **OpenRouteService Client** | `tests/openrouteservice.test.ts` | GeoJSON parsing, rate limit (429) handling, timeout abort, missing API key detection. |
| **Express API Endpoints** | `tests/apiEndpoints.test.ts` | Full HTTP pipeline: `GET /health`, `POST /api/v1/routes/generate`, `POST /api/v1/routes/return`, input validation errors (400 Bad Request). |

---

## 3. Real-World Integration Testing (Dubai Test Locations)

To test the system against real-world pedestrian environments using OpenRouteService:

1. Obtain a free OpenRouteService API key at [openrouteservice.org/dev/#/api-keys](https://openrouteservice.org/dev/#/api-keys).
2. Set `OPENROUTESERVICE_API_KEY=your_key` in `apps/api/.env`.
3. Start the server:
   ```bash
   npm run api
   ```

### Test Location 1: DIFC Gate District (Dense Urban Pedestrian Podium)
- **Coordinates**: `25.2048, 55.2708`
- **Characteristics**: Multi-level pedestrian walkways, bridges, and podium plazas.
- **Test Command**:
  ```bash
  curl -X POST http://localhost:3000/api/v1/routes/generate \
    -H "Content-Type: application/json" \
    -d '{
      "origin": { "latitude": 25.2048, "longitude": 55.2708 },
      "availableMinutes": 10,
      "walkingSpeedKmh": 5,
      "safetyBufferMinutes": 2.5,
      "maxRoutes": 3
    }'
  ```
- **Expected Outcome**: Multiple circular pedestrian loops weaving through DIFC Gate Avenue and precincts.

### Test Location 2: Downtown Dubai / Burj Park (Lakeside Promenade)
- **Coordinates**: `25.1972, 55.2744`
- **Characteristics**: Continuous waterfront loop around Burj Lake and Burj Park.
- **Expected Outcome**: Closed loop along the lake promenade returning to Burj Park without vehicular crossings.

### Test Location 3: Dubai Marina Promenade (Linear Waterfront)
- **Coordinates**: `25.0784, 55.1394`
- **Characteristics**: Long linear promenade with pedestrian bridges spaced far apart.
- **Expected Outcome**: Tests the engine's ability to identify loops via bridges or seamlessly fall back to an out-and-back route along the marina walk.

---

## 4. Live Return Monitoring Test
Simulate a user 350 meters into their walk who has 4 minutes remaining:
```bash
curl -X POST http://localhost:3000/api/v1/routes/return \
  -H "Content-Type: application/json" \
  -d '{
    "originalOrigin": { "latitude": 25.2048, "longitude": 55.2708 },
    "currentLocation": { "latitude": 25.2075, "longitude": 55.2725 },
    "remainingMinutes": 4,
    "walkingSpeedKmh": 5,
    "safetyBufferMinutes": 2.5
  }'
```
- **Expected Outcome**: Returns shortest return path, computes safety margin, and returns `warning` or `urgent` status advising the user to head back immediately.
