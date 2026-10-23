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
