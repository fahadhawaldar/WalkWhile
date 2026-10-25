import { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, Text, useColorScheme, View } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import Svg, { Defs, Path, RadialGradient, Stop } from 'react-native-svg';
import { GeoJSONPosition } from '@walkwhile/shared';
import { Palette, useColors, useThemedStyles } from '../theme';
import { UniversalMapProps } from './mapTypes';

const EDGE_PADDING = { top: 40, right: 40, bottom: 40, left: 40 };
// Camera height while following the walker (Apple Maps); shows a couple of
// blocks around them. Google Maps uses the zoom level instead.
const FOLLOW_ALTITUDE = 350;
const FOLLOW_ZOOM = 18;
// Size of the "you" marker, including the heading cone around the dot.
const YOU_SIZE = 64;
const NO_PADDING = { top: 0, bottom: 0 };

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
  heading = null,
  progressIndex,
  fullScreen = false,
  mapPadding = NO_PADDING,
}) => {
  const scheme = useColorScheme();
  const c = useColors();
  const styles = useThemedStyles(makeStyles);
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

  const followCamera = (animated: boolean) => {
    const camera = {
      center: currentPosition ?? origin,
      altitude: FOLLOW_ALTITUDE,
      zoom: FOLLOW_ZOOM,
      heading: 0,
      pitch: 0,
    };
    if (animated) mapRef.current?.animateCamera(camera, { duration: 500 });
    else mapRef.current?.setCamera(camera);
  };

  const onMapReady = () => {
    if (followUser) followCamera(false);
    else frameAll();
  };

  // Frame the routes whenever they change (not on every GPS update).
  useEffect(() => {
    if (!followUser) frameAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeCoords, returnCoords, followUser]);

  useEffect(() => {
    if (followUser && currentPosition) followCamera(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [followUser, currentPosition]);

  // Split the selected route at the walker's progress: walked part faded,
  // the rest in full colour. Once heading back, the whole loop is behind them.
  const selectedCoords = routeCoords[selectedRouteIndex] ?? [];
  const tracking = progressIndex !== undefined && selectedCoords.length > 1;
  const splitAt = returnCoords.length > 1 ? selectedCoords.length - 1 : progressIndex ?? 0;
  const walkedCoords = tracking ? selectedCoords.slice(0, splitAt + 1) : [];
  const aheadCoords = tracking ? selectedCoords.slice(splitAt) : selectedCoords;

  // Draw the selected route last so it sits on top.
  const drawOrder = routes
    .map((_, i) => i)
    .sort((a, b) => Number(a === selectedRouteIndex) - Number(b === selectedRouteIndex));

  return (
    <View style={fullScreen ? styles.fullScreen : [styles.container, { height }]}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={{
          ...(followUser ? currentPosition ?? origin : origin),
          latitudeDelta: followUser ? 0.003 : 0.01,
          longitudeDelta: followUser ? 0.003 : 0.01,
        }}
        onMapReady={onMapReady}
        mapPadding={{ ...mapPadding, left: 0, right: 0 }}
        userInterfaceStyle={scheme === 'dark' ? 'dark' : 'light'}
        // While following, keep North up so the heading cone reads correctly.
        rotateEnabled={!followUser}
        pitchEnabled={!followUser}
        // The start marker already sits where the walker stands; the live
        // position is drawn by our own marker during a walk.
        showsUserLocation={false}
        showsPointsOfInterest
        showsCompass={false}
        toolbarEnabled={false}
      >
        {drawOrder.map((i) => {
          const selected = i === selectedRouteIndex;
          if (selected && tracking && aheadCoords.length < 2) return null;
          return (
            <Polyline
              key={routes[i].id ?? i}
              coordinates={selected ? aheadCoords : routeCoords[i]}
              strokeColor={
                selected
                  ? c.routeColors[i % c.routeColors.length]
                  : c.routeInactive
              }
              strokeWidth={selected ? 5 : 3}
              lineJoin="round"
              lineCap="round"
              tappable={!!onSelectRoute}
              onPress={() => onSelectRoute?.(i)}
            />
          );
        })}

        {walkedCoords.length > 1 && (
          <Polyline
            coordinates={walkedCoords}
            strokeColor={c.routeWalked}
            strokeWidth={5}
            lineJoin="round"
            lineCap="round"
          />
        )}

        {returnCoords.length > 1 && (
          <Polyline
            coordinates={returnCoords}
            strokeColor={c.returnRoute}
            strokeWidth={5}
            lineDashPattern={[8, 6]}
          />
        )}

        <Marker coordinate={origin} anchor={{ x: 0.5, y: 0.5 }}>
          <View style={styles.originMarker}>
            <View style={styles.originDot} />
            <Text style={styles.originText}>Your spot</Text>
          </View>
        </Marker>

        {currentPosition && (
          <Marker coordinate={currentPosition} anchor={{ x: 0.5, y: 0.5 }}>
            <View style={styles.you}>
              {heading !== null && (
                <Svg
                  width={YOU_SIZE}
                  height={YOU_SIZE}
                  style={[StyleSheet.absoluteFill, { transform: [{ rotate: `${heading}deg` }] }]}
                >
                  <Defs>
                    <RadialGradient id="cone" cx="50%" cy="50%" r="50%">
                      <Stop offset="0.2" stopColor={c.you} stopOpacity="0.55" />
                      <Stop offset="1" stopColor={c.you} stopOpacity="0" />
                    </RadialGradient>
                  </Defs>
                  {/* 70 degree wedge pointing up from the centre. */}
                  <Path d="M32 32 L13.6 5.8 A32 32 0 0 1 50.4 5.8 Z" fill="url(#cone)" />
                </Svg>
              )}
              <View style={styles.youOuter}>
                <View style={styles.youInner} />
              </View>
            </View>
          </Marker>
        )}
      </MapView>

      <Text style={[styles.attribution, { bottom: mapPadding.bottom + 4 }]}>Routes © OpenStreetMap contributors</Text>
    </View>
  );
};

const makeStyles = (c: Palette) =>
  StyleSheet.create({
  container: {
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: c.surfaceMuted,
    borderWidth: 1,
    borderColor: c.separator,
  },
  fullScreen: {
    flex: 1,
    backgroundColor: c.surfaceMuted,
  },
  originMarker: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: c.forest,
    paddingLeft: 6,
    paddingRight: 10,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: c.white,
  },
  originDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: c.mint,
  },
  originText: {
    color: c.white,
    fontSize: 11,
    fontWeight: '700',
  },
  you: {
    width: YOU_SIZE,
    height: YOU_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  youOuter: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(47, 107, 255, 0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  youInner: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: c.you,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  attribution: {
    position: 'absolute',
    bottom: 4,
    left: 8,
    fontSize: 9,
    color: c.inkSecondary,
    // Translucent page colour behind the small print.
    backgroundColor: `${c.background}B3`,
    paddingHorizontal: 4,
    borderRadius: 4,
  },
});
