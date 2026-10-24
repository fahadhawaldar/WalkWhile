import { Coordinate, GeoJSONPosition } from '@walkwhile/shared';

const EARTH_RADIUS_METERS = 6371000;

/**
 * Converts degrees to radians.
 */
export function degreesToRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Converts radians to degrees.
 */
export function radiansToDegrees(radians: number): number {
  return (radians * 180) / Math.PI;
}

/**
 * Calculates Great Circle distance between two coordinates using the Haversine formula.
 * Returns distance in meters.
 */
export function haversineDistance(
  coord1: Coordinate | GeoJSONPosition,
  coord2: Coordinate | GeoJSONPosition
): number {
  const lat1 = Array.isArray(coord1) ? coord1[1] : coord1.latitude;
  const lon1 = Array.isArray(coord1) ? coord1[0] : coord1.longitude;
  const lat2 = Array.isArray(coord2) ? coord2[1] : coord2.latitude;
  const lon2 = Array.isArray(coord2) ? coord2[0] : coord2.longitude;

  const dLat = degreesToRadians(lat2 - lat1);
  const dLon = degreesToRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(degreesToRadians(lat1)) *
      Math.cos(degreesToRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_METERS * c;
}

/**
 * Projects a new coordinate given an origin, bearing (0-360 degrees clockwise from North),
 * and distance in meters.
 */
export function projectCoordinate(
  origin: Coordinate,
  bearingDegrees: number,
  distanceMeters: number
): Coordinate {
  const lat1 = degreesToRadians(origin.latitude);
  const lon1 = degreesToRadians(origin.longitude);
  const bearing = degreesToRadians(bearingDegrees);
  const angularDistance = distanceMeters / EARTH_RADIUS_METERS;

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(angularDistance) +
      Math.cos(lat1) * Math.sin(angularDistance) * Math.cos(bearing)
  );

  const lon2 =
    lon1 +
    Math.atan2(
      Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(lat1),
      Math.cos(angularDistance) - Math.sin(lat1) * Math.sin(lat2)
    );

  return {
    latitude: radiansToDegrees(lat2),
    longitude: radiansToDegrees(lon2),
  };
}

/**
 * Calculates perpendicular / minimum distance from a point to a line segment in meters.
 */
export function pointToSegmentDistance(
  point: GeoJSONPosition,
  segStart: GeoJSONPosition,
  segEnd: GeoJSONPosition
): number {
  const [px, py] = point; // [lon, lat]
  const [x1, y1] = segStart;
  const [x2, y2] = segEnd;

  // Approximate flat-earth projection scaled for local latitude
  const midLat = degreesToRadians((y1 + y2) / 2);
  const kx = Math.cos(midLat);

  const dx = (x2 - x1) * kx;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;

  if (lenSq === 0) {
    return haversineDistance(point, segStart);
  }

  // Projection parameter t
  const t = Math.max(
    0,
    Math.min(1, (((px - x1) * kx * dx + (py - y1) * dy) / lenSq))
  );

  const projLon = x1 + (t * (x2 - x1));
  const projLat = y1 + (t * (y2 - y1));

  return haversineDistance(point, [projLon, projLat]);
}

/**
 * Resamples a LineString's coordinates into evenly spaced points (every stepMeters).
 * Useful for spatial buffer overlap detection.
 */
export function sampleLineString(
  coordinates: GeoJSONPosition[],
  stepMeters = 20
): GeoJSONPosition[] {
  if (coordinates.length === 0) return [];
  if (coordinates.length === 1) return [coordinates[0]];

  const samples: GeoJSONPosition[] = [coordinates[0]];
  let accumulatedDistance = 0;

  for (let i = 0; i < coordinates.length - 1; i++) {
    const p1 = coordinates[i];
    const p2 = coordinates[i + 1];
    const segDist = haversineDistance(p1, p2);

    if (segDist === 0) continue;

    let d = stepMeters - accumulatedDistance;
    while (d <= segDist) {
      const ratio = d / segDist;
      const interpLon = p1[0] + (p2[0] - p1[0]) * ratio;
      const interpLat = p1[1] + (p2[1] - p1[1]) * ratio;
      samples.push([interpLon, interpLat]);
      d += stepMeters;
    }

    accumulatedDistance = (accumulatedDistance + segDist) % stepMeters;
  }

  // Always include the final coordinate
  const last = coordinates[coordinates.length - 1];
  if (
    haversineDistance(samples[samples.length - 1], last) > stepMeters * 0.5
  ) {
    samples.push(last);
  }

  return samples;
}

/**
 * Initial bearing from one position to another, in degrees clockwise from North.
 */
export function bearingBetween(from: [number, number], to: [number, number]): number {
  const toRad = Math.PI / 180;
  const lat1 = from[1] * toRad;
  const lat2 = to[1] * toRad;
  const dLon = (to[0] - from[0]) * toRad;
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/**
 * Smallest angle between two bearings, 0-180 degrees.
 */
export function angleDifference(a: number, b: number): number {
  const d = Math.abs((((a - b) % 360) + 360) % 360);
  return d > 180 ? 360 - d : d;
}
