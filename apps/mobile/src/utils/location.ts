import * as Location from 'expo-location';
import { Coordinate } from '@walkwhile/shared';

export interface LocationPreset {
  id: string;
  name: string;
  description: string;
  coordinate: Coordinate;
}

export const PRESET_LOCATIONS: LocationPreset[] = [
  {
    id: 'difc',
    name: 'DIFC Gate District, Dubai',
    description: 'Pedestrian avenues, footbridges & plaza podiums',
    coordinate: { latitude: 25.2048, longitude: 55.2708 },
  },
  {
    id: 'downtown',
    name: 'Downtown / Burj Park, Dubai',
    description: 'Lake promenade & pedestrian loop around Burj Lake',
    coordinate: { latitude: 25.1972, longitude: 55.2744 },
  },
  {
    id: 'marina',
    name: 'Dubai Marina Promenade',
    description: 'Linear waterfront esplanade & marina bridges',
    coordinate: { latitude: 25.0784, longitude: 55.1394 },
  },
];

export async function requestLocationPermission(): Promise<boolean> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    return status === 'granted';
  } catch (err) {
    console.warn('Failed to request location permission:', err);
    return false;
  }
}

export async function getCurrentLocation(): Promise<Coordinate | null> {
  try {
    const hasPermission = await requestLocationPermission();
    if (!hasPermission) return null;

    const loc = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });

    return {
      latitude: loc.coords.latitude,
      longitude: loc.coords.longitude,
    };
  } catch (err) {
    console.warn('Failed to obtain current GPS location:', err);
    return null;
  }
}

export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  return `${(meters / 1000).toFixed(1)} km`;
}

export function formatDuration(seconds: number): string {
  const mins = Math.round(seconds / 60);
  if (mins < 60) {
    return `${mins} min`;
  }
  const hrs = Math.floor(mins / 60);
  const remainingMins = mins % 60;
  return `${hrs}h ${remainingMins}m`;
}

const EARTH_RADIUS_METERS = 6371000;

/** Great-circle distance between two coordinates, in meters. */
export function distanceBetween(a: Coordinate, b: Coordinate): number {
  const toRad = Math.PI / 180;
  const dLat = (b.latitude - a.latitude) * toRad;
  const dLon = (b.longitude - a.longitude) * toRad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.latitude * toRad) *
      Math.cos(b.latitude * toRad) *
      Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

/** Compass bearing from a to b, in degrees clockwise from North. */
export function bearingBetween(a: Coordinate, b: Coordinate): number {
  const toRad = Math.PI / 180;
  const lat1 = a.latitude * toRad;
  const lat2 = b.latitude * toRad;
  const dLon = (b.longitude - a.longitude) * toRad;
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}
