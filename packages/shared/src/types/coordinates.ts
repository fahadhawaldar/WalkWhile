/**
 * Geospatial coordinate types for WalkWhile.
 */

export interface Coordinate {
  latitude: number;
  longitude: number;
}

/**
 * GeoJSON coordinate pair [longitude, latitude]
 * Note: Standard GeoJSON puts longitude first!
 */
export type GeoJSONPosition = [number, number];

export interface GeoJSONLineString {
  type: 'LineString';
  coordinates: GeoJSONPosition[];
}

export interface GeoJSONFeature<G = GeoJSONLineString, P = Record<string, unknown>> {
  type: 'Feature';
  geometry: G;
  properties: P;
  bbox?: [number, number, number, number];
}

export interface GeoJSONFeatureCollection<G = GeoJSONLineString, P = Record<string, unknown>> {
  type: 'FeatureCollection';
  features: Array<GeoJSONFeature<G, P>>;
  bbox?: [number, number, number, number];
}
