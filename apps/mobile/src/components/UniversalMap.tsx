import { useMemo } from 'react';
import {
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Coordinate, WalkingRoute } from '@walkwhile/shared';
import { Compass } from 'lucide-react-native';
import { COLORS } from '../theme/colors';

interface UniversalMapProps {
  origin: Coordinate;
  routes?: WalkingRoute[];
  selectedRouteIndex?: number;
  currentPosition?: Coordinate | null;
  returnRoute?: WalkingRoute | null;
  height?: number;
  onSelectRoute?: (index: number) => void;
}

export const UniversalMap: React.FC<UniversalMapProps> = ({
  origin,
  routes = [],
  selectedRouteIndex = 0,
  currentPosition,
  returnRoute,
  height = 320,
  onSelectRoute,
}) => {
  // Compute bounding box encompassing origin, all routes, return route, and current position
  const bbox = useMemo(() => {
    let minLat = origin.latitude;
    let maxLat = origin.latitude;
    let minLon = origin.longitude;
    let maxLon = origin.longitude;

    const includeCoord = (lat: number, lon: number) => {
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
      if (lon < minLon) minLon = lon;
      if (lon > maxLon) maxLon = lon;
    };

    if (currentPosition) {
      includeCoord(currentPosition.latitude, currentPosition.longitude);
    }

    for (const r of routes) {
      for (const [lon, lat] of r.geometry.coordinates) {
        includeCoord(lat, lon);
      }
    }

    if (returnRoute) {
      for (const [lon, lat] of returnRoute.geometry.coordinates) {
        includeCoord(lat, lon);
      }
    }

    // Add padding margin (15%)
    const latSpan = Math.max(0.002, maxLat - minLat);
    const lonSpan = Math.max(0.002, maxLon - minLon);

    return {
      minLat: minLat - latSpan * 0.15,
      maxLat: maxLat + latSpan * 0.15,
      minLon: minLon - lonSpan * 0.15,
      maxLon: maxLon + lonSpan * 0.15,
      latSpan: latSpan * 1.3,
      lonSpan: lonSpan * 1.3,
    };
  }, [origin, routes, currentPosition, returnRoute]);

  // Projects [lon, lat] coordinate to SVG viewbox percentages (0..100)
  const projectToViewBox = (
    lon: number,
    lat: number
  ): { x: number; y: number } => {
    const x = ((lon - bbox.minLon) / bbox.lonSpan) * 100;
    // Invert Y because latitude increases North but SVG Y increases downwards
    const y = ((bbox.maxLat - lat) / bbox.latSpan) * 100;
    return {
      x: Math.max(2, Math.min(98, x)),
      y: Math.max(2, Math.min(98, y)),
    };
  };

  const originProj = projectToViewBox(origin.longitude, origin.latitude);
  const currentProj = currentPosition
    ? projectToViewBox(currentPosition.longitude, currentPosition.latitude)
    : null;

  return (
    <View style={[styles.container, { height }]}>
      {/* Map Surface Grid Background */}
      <View style={styles.mapCanvas}>
        {/* Subtle grid lines resembling streets */}
        <View style={styles.gridOverlay}>
          <View style={[styles.gridLineH, { top: '25%' }]} />
          <View style={[styles.gridLineH, { top: '50%' }]} />
          <View style={[styles.gridLineH, { top: '75%' }]} />
          <View style={[styles.gridLineV, { left: '25%' }]} />
          <View style={[styles.gridLineV, { left: '50%' }]} />
          <View style={[styles.gridLineV, { left: '75%' }]} />
        </View>

        {/* SVG Route Renderer for Web & Cross-Platform */}
        {Platform.OS === 'web' ? (
          <svg
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              pointerEvents: 'none',
            }}
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
          >
            {/* Draw non-selected routes first */}
            {routes.map((route, i) => {
              if (i === selectedRouteIndex) return null;
              const points = route.geometry.coordinates
                .map(([lon, lat]) => {
                  const p = projectToViewBox(lon, lat);
                  return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
                })
                .join(' ');

              const color =
                COLORS.routeColors[i % COLORS.routeColors.length];
              return (
                <polyline
                  key={route.id || i}
                  points={points}
                  fill="none"
                  stroke={color}
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={0.45}
                />
              );
            })}

            {/* Draw selected route highlighted on top */}
            {routes[selectedRouteIndex] && (
              <polyline
                points={routes[selectedRouteIndex].geometry.coordinates
                  .map(([lon, lat]) => {
                    const p = projectToViewBox(lon, lat);
                    return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
                  })
                  .join(' ')}
                fill="none"
                stroke={
                  COLORS.routeColors[
                    selectedRouteIndex % COLORS.routeColors.length
                  ]
                }
                strokeWidth="4"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={0.95}
              />
            )}

            {/* Draw return route if active */}
            {returnRoute && (
              <polyline
                points={returnRoute.geometry.coordinates
                  .map(([lon, lat]) => {
                    const p = projectToViewBox(lon, lat);
                    return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
                  })
                  .join(' ')}
                fill="none"
                stroke={COLORS.returnRouteColor}
                strokeWidth="3.5"
                strokeDasharray="2,2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
          </svg>
        ) : null}

        {/* Origin / Starting Pin */}
        <View
          style={[
            styles.originMarker,
            {
              left: `${originProj.x}%`,
              top: `${originProj.y}%`,
            },
          ]}
        >
          <View style={styles.originDot} />
          <View style={styles.originBadge}>
            <Text style={styles.originText}>START</Text>
          </View>
        </View>

        {/* Current GPS Position Marker */}
        {currentProj && (
          <View
            style={[
              styles.currentMarker,
              {
                left: `${currentProj.x}%`,
                top: `${currentProj.y}%`,
              },
            ]}
          >
            <View style={styles.currentPulse} />
            <View style={styles.currentDot} />
          </View>
        )}

        {/* Compass & Attribution Indicator */}
        <View style={styles.watermark}>
          <Compass size={14} color={COLORS.textMuted} />
          <Text style={styles.watermarkText}>OpenStreetMap Pedestrian Grid</Text>
        </View>

        {/* Route Selector Badges overlay on map */}
        {routes.length > 1 && onSelectRoute && (
          <View style={styles.routeSelectorOverlay}>
            {routes.map((_, idx) => (
              <TouchableOpacity
                key={idx}
                onPress={() => onSelectRoute(idx)}
                style={[
                  styles.routeBadgePill,
                  selectedRouteIndex === idx && styles.routeBadgePillActive,
                  {
                    borderColor:
                      COLORS.routeColors[idx % COLORS.routeColors.length],
                  },
                ]}
              >
                <View
                  style={[
                    styles.routePillDot,
                    {
                      backgroundColor:
                        COLORS.routeColors[idx % COLORS.routeColors.length],
                    },
                  ]}
                />
                <Text
                  style={[
                    styles.routePillText,
                    selectedRouteIndex === idx && styles.routePillTextActive,
                  ]}
                >
                  R{idx + 1}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#EBF4F0',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  mapCanvas: {
    flex: 1,
    position: 'relative',
    backgroundColor: '#F0FDF4',
  },
  gridOverlay: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.15,
  },
  gridLineH: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: COLORS.primary,
  },
  gridLineV: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: COLORS.primary,
  },
  originMarker: {
    position: 'absolute',
    alignItems: 'center',
    transform: [{ translateX: -12 }, { translateY: -12 }],
    zIndex: 10,
  },
  originDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: COLORS.primary,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  originBadge: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
    marginTop: 2,
  },
  originText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  currentMarker: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ translateX: -10 }, { translateY: -10 }],
    zIndex: 20,
  },
  currentPulse: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(59, 130, 246, 0.25)',
  },
  currentDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#2563EB',
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
  },
  watermark: {
    position: 'absolute',
    bottom: 8,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  watermarkText: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  routeSelectorOverlay: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    gap: 6,
    zIndex: 30,
  },
  routeBadgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1.5,
    gap: 4,
  },
  routeBadgePillActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  routePillDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  routePillText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  routePillTextActive: {
    color: COLORS.textPrimary,
    fontWeight: '800',
  },
});
