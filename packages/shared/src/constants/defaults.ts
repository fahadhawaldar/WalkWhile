export const DEFAULTS = {
  AVAILABLE_MINUTES: 10,
  WALKING_SPEED_KMH: 5.0,
  SAFETY_BUFFER_MINUTES: 2.5,
  MAX_ROUTES: 3,
  MIN_AVAILABLE_MINUTES: 5,
  MAX_AVAILABLE_MINUTES: 60,
  MIN_WALKING_SPEED_KMH: 2.0,
  MAX_WALKING_SPEED_KMH: 10.0,
  MIN_SAFETY_BUFFER_MINUTES: 0.5,
  MAX_SAFETY_BUFFER_MINUTES: 15.0,

  /**
   * Pedestrian tolerance parameters
   */
  // Maximum distance (in meters) the route start/end may be from requested origin (pedestrian network snapping)
  MAX_ORIGIN_DISTANCE_METERS: 150,

  // Maximum allowed overlap ratio (65%) between two candidate routes
  MAX_ROUTE_OVERLAP_RATIO: 0.65,

  // Maximum distance (in meters) for two points to be considered sharing the same pedestrian corridor
  SPATIAL_BUFFER_DISTANCE_METERS: 25,

  // Maximum allowed deviation from target distance ratio (e.g. 1.6x)
  MAX_DISTANCE_STRETCH_RATIO: 1.6,

  // Additional pedestrian crossing / intersection buffer per kilometer (seconds)
  PEDESTRIAN_INTERSECTION_ALLOWANCE_PER_KM_SECONDS: 20,

  // Standard legal and safety disclaimer required by product guidelines
  SAFETY_DISCLAIMER:
    'WalkWhile provides estimated pedestrian routes based on OpenStreetMap data. Estimated times and conditions are advisory only. Weather, traffic, construction, and personal pace vary. WalkWhile does not guarantee on-time return or certify path safety. Always stay aware of your surroundings and prioritize personal safety.',
} as const;
