import { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { GeoJSONPosition } from '@walkwhile/shared';
import { COLORS } from '../theme/colors';
import { UniversalMapProps } from './mapTypes';

const EDGE_PADDING = { top: 40, right: 40, bottom: 40, left: 40 };

function toLatLng([longitude, latitude]: GeoJSONPosition) {
  return { latitude, longitude };
}

/**
 * Native map (Apple Maps on iOS) showing the walking routes, the start point,
 * the walker's live position and any active return route.
 */
export const UniversalMap: React.FC<UniversalMapProps> = ({
  origin,
  routes = [],
  selectedRouteIndex = 0,
  currentPosition,
  returnRoute,
  height = 320,
  onSelectRoute,
  followUser = false,
}) => {
  const mapRef = useRef<MapView>(null);

  const routeCoords = useMemo(
    () => routes.map((r) => r.geometry.coordinates.map(toLatLng)),
    [routes]
  );
  const returnCoords = useMemo(
    () => returnRoute?.geometry.coordinates.map(toLatLng) ?? [],
    [returnRoute]
  );

  const frameAll = () => {
    const all = [origin, ...routeCoords.flat(), ...returnCoords];
    if (all.length > 1) {
      mapRef.current?.fitToCoordinates(all, {
        edgePadding: EDGE_PADDING,
        animated: true,
      });
    }
  };

  // Frame the routes whenever they change (not on every GPS update).
  useEffect(() => {
    if (!followUser) frameAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeCoords, returnCoords, followUser]);

  useEffect(() => {
    if (followUser && currentPosition) {
      mapRef.current?.animateCamera(
        // altitude is used by Apple Maps, zoom by Google Maps.
        { center: currentPosition, altitude: 700, zoom: 17 },
        { duration: 500 }
      );
    }
  }, [followUser, currentPosition]);

  // Draw the selected route last so it sits on top.
  const drawOrder = routes
    .map((_, i) => i)
    .sort((a, b) => Number(a === selectedRouteIndex) - Number(b === selectedRouteIndex));

  return (
    <View style={[styles.container, { height }]}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={{
          ...origin,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }}
        onMapReady={frameAll}
        showsUserLocation={!currentPosition}
        showsPointsOfInterest
        showsCompass={false}
        toolbarEnabled={false}
      >
        {drawOrder.map((i) => {
          const selected = i === selectedRouteIndex;
          return (
            <Polyline
              key={routes[i].id ?? i}
              coordinates={routeCoords[i]}
              strokeColor={
                selected
                  ? COLORS.routeColors[i % COLORS.routeColors.length]
                  : 'rgba(100, 116, 139, 0.55)'
              }
              strokeWidth={selected ? 5 : 3}
              lineJoin="round"
              lineCap="round"
              tappable={!!onSelectRoute}
              onPress={() => onSelectRoute?.(i)}
            />
          );
        })}

        {returnCoords.length > 1 && (
          <Polyline
            coordinates={returnCoords}
            strokeColor={COLORS.returnRouteColor}
            strokeWidth={5}
            lineDashPattern={[8, 6]}
          />
        )}

        <Marker coordinate={origin} anchor={{ x: 0.5, y: 0.5 }}>
          <View style={styles.originMarker}>
            <Text style={styles.originText}>START</Text>
          </View>
        </Marker>

        {currentPosition && (
          <Marker coordinate={currentPosition} anchor={{ x: 0.5, y: 0.5 }}>
            <View style={styles.youOuter}>
              <View style={styles.youInner} />
            </View>
          </Marker>
        )}
      </MapView>

      {routes.length > 1 && onSelectRoute && (
        <View style={styles.selector}>
          {routes.map((_, i) => {
            const color = COLORS.routeColors[i % COLORS.routeColors.length];
            const selected = i === selectedRouteIndex;
            return (
              <TouchableOpacity
                key={i}
                onPress={() => onSelectRoute(i)}
                style={[
                  styles.selectorPill,
                  { borderColor: color },
                  selected && { backgroundColor: color },
                ]}
              >
                <Text style={[styles.selectorText, selected && styles.selectorTextActive]}>
                  {i + 1}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      <Text style={styles.attribution}>Routes © OpenStreetMap contributors</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: COLORS.surfaceSubtle,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  originMarker: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  originText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  youOuter: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(37, 99, 235, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  youInner: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#2563EB',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  selector: {
    position: 'absolute',
    top: 10,
    right: 10,
    flexDirection: 'row',
    gap: 6,
  },
  selectorPill: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectorText: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  selectorTextActive: {
    color: '#FFFFFF',
  },
  attribution: {
    position: 'absolute',
    bottom: 4,
    left: 8,
    fontSize: 9,
    color: COLORS.textSecondary,
    backgroundColor: 'rgba(255,255,255,0.7)',
    paddingHorizontal: 4,
    borderRadius: 4,
  },
});
