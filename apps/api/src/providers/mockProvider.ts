import { GeoJSONPosition } from '@walkwhile/shared';
import {
  haversineDistance,
  projectCoordinate,
} from '../utils/geo.js';
import {
  IRoutingProvider,
  ProviderOutAndBackParams,
  ProviderReturnParams,
  ProviderRoundTripParams,
  ProviderRouteCandidate,
} from './types.js';

export class MockRoutingProvider implements IRoutingProvider {
  public readonly name = 'mock';
  public shouldFail = false;
  public failureMessage = 'Simulated routing provider failure';
  public failureCode = 502;

  /**
   * Generates a realistic polygon loop starting and ending at the origin.
   * Uses seed to vary the orientation and geometry of the loop.
   */
  async generateRoundTrip(
    params: ProviderRoundTripParams
  ): Promise<ProviderRouteCandidate | null> {
    if (this.shouldFail) {
      const err = new Error(this.failureMessage) as Error & {
        statusCode?: number;
      };
      err.statusCode = this.failureCode;
      throw err;
    }

    const { origin, targetDistanceMeters, seed } = params;
    const numPoints = params.points ?? 6;

    // Approximate loop radius: Circumference ≈ targetDistanceMeters -> R ≈ targetDistance / (2 * PI)
    const effectiveRadius = Math.max(30, targetDistanceMeters / (2 * Math.PI));

    // Base angle offset determined by seed so different seeds face different directions
    const baseAngleOffset = (seed * 73) % 360;

    const coordinates: GeoJSONPosition[] = [
      [origin.longitude, origin.latitude],
    ];

    let totalDist = 0;
    let prevCoord = origin;

    for (let i = 1; i < numPoints; i++) {
      const angle = baseAngleOffset + (i / numPoints) * 360;
      // Slight radius wobble (+/- 15%) per point
      const wobble = 1 + (((seed + i * 17) % 30) - 15) / 100;
      const pointDist = effectiveRadius * wobble;

      const nextCoord = projectCoordinate(origin, angle, pointDist);
      coordinates.push([nextCoord.longitude, nextCoord.latitude]);

      totalDist += haversineDistance(prevCoord, nextCoord);
      prevCoord = nextCoord;
    }

    // Close loop back to origin
    coordinates.push([origin.longitude, origin.latitude]);
    totalDist += haversineDistance(prevCoord, origin);

    // Standard pedestrian speed is approx 1.38 m/s (~5 km/h)
    const durationSeconds = Math.round(totalDist / 1.38);

    return {
      geometry: {
        type: 'LineString',
        coordinates,
      },
      distanceMeters: Math.round(totalDist),
      durationSeconds,
      instructions: [
        {
          instruction: 'Head out from starting point along pedestrian path',
          distanceMeters: Math.round(totalDist / numPoints),
          durationSeconds: Math.round(durationSeconds / numPoints),
          type: 1,
          name: 'Pedestrian Walkway',
          waypointIndices: [0, 1],
        },
        {
          instruction: 'Follow walkway loop around the perimeter',
          distanceMeters: Math.round(
            (totalDist * (numPoints - 2)) / numPoints
          ),
          durationSeconds: Math.round(
            (durationSeconds * (numPoints - 2)) / numPoints
          ),
          type: 2,
          name: 'Plaza Path',
          waypointIndices: [1, numPoints - 1],
        },
        {
          instruction: 'Arrive back at your starting point',
          distanceMeters: Math.round(totalDist / numPoints),
          durationSeconds: Math.round(durationSeconds / numPoints),
          type: 10,
          name: 'Origin',
          waypointIndices: [numPoints - 1, numPoints],
        },
      ],
      type: 'loop',
      seed,
    };
  }

  /**
   * Generates a safe out-and-back route from origin to turnaround point and back.
   */
  async generateOutAndBack(
    params: ProviderOutAndBackParams
  ): Promise<ProviderRouteCandidate | null> {
    if (this.shouldFail) {
      const err = new Error(this.failureMessage) as Error & {
        statusCode?: number;
      };
      err.statusCode = this.failureCode;
      throw err;
    }

    const { origin, turnaroundPoint } = params;

    // Create 3 waypoints outbound and 3 waypoints inbound along the path
    const coordinates: GeoJSONPosition[] = [
      [origin.longitude, origin.latitude],
    ];

    const midLat = (origin.latitude + turnaroundPoint.latitude) / 2;
    const midLon = (origin.longitude + turnaroundPoint.longitude) / 2;

    // Outbound
    coordinates.push([midLon, midLat]);
    coordinates.push([turnaroundPoint.longitude, turnaroundPoint.latitude]);

    // Inbound (walk back)
    coordinates.push([midLon, midLat]);
    coordinates.push([origin.longitude, origin.latitude]);

    const oneWayDist = haversineDistance(origin, turnaroundPoint);
    const totalDist = Math.round(oneWayDist * 2);
    const durationSeconds = Math.round(totalDist / 1.38);

    return {
      geometry: {
        type: 'LineString',
        coordinates,
      },
      distanceMeters: totalDist,
      durationSeconds,
      instructions: [
        {
          instruction: 'Walk outbound along pedestrian walkway',
          distanceMeters: Math.round(totalDist / 2),
          durationSeconds: Math.round(durationSeconds / 2),
          type: 1,
          name: 'Esplanade',
          waypointIndices: [0, 2],
        },
        {
          instruction: 'Reach turnaround point and turn back',
          distanceMeters: 0,
          durationSeconds: 10,
          type: 6,
          name: 'Turnaround Waypoint',
          waypointIndices: [2, 2],
        },
        {
          instruction: 'Return along the same walkway back to starting point',
          distanceMeters: Math.round(totalDist / 2),
          durationSeconds: Math.round(durationSeconds / 2),
          type: 10,
          name: 'Starting Point',
          waypointIndices: [2, 4],
        },
      ],
      type: 'out_and_back',
    };
  }

  /**
   * Calculates return route from current location back to original origin.
   */
  async calculateReturnRoute(
    params: ProviderReturnParams
  ): Promise<ProviderRouteCandidate> {
    if (this.shouldFail) {
      const err = new Error(this.failureMessage) as Error & {
        statusCode?: number;
      };
      err.statusCode = this.failureCode;
      throw err;
    }

    const { currentLocation, originalOrigin } = params;
    const dist = haversineDistance(currentLocation, originalOrigin);

    // Direct pedestrian path with intermediate waypoint
    const midLat = (currentLocation.latitude + originalOrigin.latitude) / 2;
    const midLon = (currentLocation.longitude + originalOrigin.longitude) / 2;

    const coordinates: GeoJSONPosition[] = [
      [currentLocation.longitude, currentLocation.latitude],
      [midLon, midLat],
      [originalOrigin.longitude, originalOrigin.latitude],
    ];

    const durationSeconds = Math.round(dist / 1.38);

    return {
      geometry: {
        type: 'LineString',
        coordinates,
      },
      distanceMeters: Math.round(dist),
      durationSeconds,
      instructions: [
        {
          instruction: 'Head straight towards your starting point',
          distanceMeters: Math.round(dist),
          durationSeconds,
          type: 1,
          name: 'Direct Return Path',
          waypointIndices: [0, 2],
        },
      ],
      type: 'out_and_back',
    };
  }
}
