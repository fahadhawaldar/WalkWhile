import { useRef, useState } from 'react';
import {
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  FadeIn,
  FadeOut,
  SlideInDown,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import { ChevronDown, ChevronLeft, Play } from 'lucide-react-native';
import { WalkingRoute } from '@walkwhile/shared';
import { UniversalMap } from '../src/components/UniversalMap';
import { AppText } from '../src/components/ui/AppText';
import { Button } from '../src/components/ui/Button';
import { PressableScale } from '../src/components/ui/PressableScale';
import { useWalkStore } from '../src/store/useWalkStore';
import { layout, motion, Palette, radius, shadows, spacing, useColors, useThemedStyles } from '../src/theme';
import { requestBackgroundTracking } from '../src/utils/backgroundLocation';
import { haptics } from '../src/utils/haptics';
import { formatDistance } from '../src/utils/location';
import { minutesOf, routeName } from '../src/utils/routeName';

const CARD_GAP = spacing.md;

export default function RoutesScreen() {
  const c = useColors();
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { origin, generatedRoutes, selectedRouteIndex, setSelectedRouteIndex, startWalk } =
    useWalkStore();
  const listRef = useRef<FlatList<WalkingRoute>>(null);
  const [panelHeight, setPanelHeight] = useState(0);
  const [showSteps, setShowSteps] = useState(false);

  const cardWidth = width - layout.screenPadding * 2;
  const route = generatedRoutes[selectedRouteIndex];

  if (!route) {
    return (
      <View style={[styles.empty, { paddingTop: insets.top }]}>
        <AppText variant="title">No routes right now</AppText>
        <AppText variant="subhead" style={{ textAlign: 'center' }}>
          Go back and try a little more time.
        </AppText>
        <Button title="Back" variant="secondary" onPress={() => router.replace('/')} />
      </View>
    );
  }

  const select = (index: number) => {
    if (index === useWalkStore.getState().selectedRouteIndex) return;
    haptics.selection();
    setSelectedRouteIndex(index);
    setShowSteps(false);
  };

  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(e.nativeEvent.contentOffset.x / (cardWidth + CARD_GAP));
    select(Math.min(generatedRoutes.length - 1, Math.max(0, index)));
  };

  const handleStart = async () => {
    haptics.thud();
    // Keep tracking and speaking with the phone in a pocket. If the walker
    // declines, the walk still runs while the screen is on.
    if (!useWalkStore.getState().simulateWalk) await requestBackgroundTracking();
    startWalk();
    router.replace('/active');
  };

  return (
    <View style={styles.container}>
      <UniversalMap
        origin={origin}
        routes={generatedRoutes}
        selectedRouteIndex={selectedRouteIndex}
        onSelectRoute={(i) => {
          select(i);
          listRef.current?.scrollToIndex({ index: i, animated: true });
        }}
        fullScreen
        mapPadding={{ top: insets.top + 56, bottom: panelHeight }}
      />

      <PressableScale
        onPress={() => router.back()}
        style={[styles.back, { top: insets.top + spacing.sm }]}
        accessibilityLabel="Back"
        hitSlop={8}
      >
        <ChevronLeft size={24} color={c.ink} strokeWidth={2.4} />
      </PressableScale>

      <Animated.View
        entering={SlideInDown.duration(motion.slow).easing(motion.easeOutFn)}
        style={[styles.panel, { paddingBottom: insets.bottom + spacing.md }]}
        onLayout={(e) => setPanelHeight(e.nativeEvent.layout.height)}
      >
        <View style={styles.panelHeader}>
          <AppText variant="headline">
            {generatedRoutes.length === 1 ? 'Your walk' : `${generatedRoutes.length} walks for you`}
          </AppText>
          {generatedRoutes.length > 1 && (
            <Dots count={generatedRoutes.length} active={selectedRouteIndex} />
          )}
        </View>

        <FlatList
          ref={listRef}
          data={generatedRoutes}
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={cardWidth + CARD_GAP}
          decelerationRate="fast"
          contentContainerStyle={{ paddingHorizontal: layout.screenPadding, gap: CARD_GAP }}
          keyExtractor={(r, i) => r.id ?? String(i)}
          onMomentumScrollEnd={onScrollEnd}
          getItemLayout={(_, index) => ({
            length: cardWidth + CARD_GAP,
            offset: (cardWidth + CARD_GAP) * index,
            index,
          })}
          renderItem={({ item, index }) => (
            <RouteCard
              route={item}
              index={index}
              width={cardWidth}
              selected={index === selectedRouteIndex}
              onPress={() => {
                select(index);
                listRef.current?.scrollToIndex({ index, animated: true });
              }}
            />
          )}
        />

        {route.instructions?.length > 0 && (
          <View style={styles.stepsBlock}>
            <PressableScale
              pressedScale={0.98}
              onPress={() => {
                haptics.selection();
                setShowSteps((s) => !s);
              }}
              style={styles.stepsToggle}
              accessibilityLabel={showSteps ? 'Hide directions' : 'Show directions'}
              accessibilityState={{ expanded: showSteps }}
            >
              <AppText variant="footnote" style={{ fontWeight: '600' }}>
                {showSteps ? 'Hide directions' : `${route.instructions.length} turns · see directions`}
              </AppText>
              <Chevron open={showSteps} />
            </PressableScale>
            {showSteps && (
              <Animated.View entering={FadeIn.duration(motion.base)} exiting={FadeOut.duration(motion.fast)}>
                <ScrollView style={styles.stepsList} nestedScrollEnabled>
                  {route.instructions.map((step, i) => (
                    <View key={i} style={styles.step}>
                      <AppText variant="caption" style={styles.stepIndex}>
                        {i + 1}
                      </AppText>
                      <View style={{ flex: 1 }}>
                        <AppText variant="callout">{step.instruction}</AppText>
                        <AppText variant="caption">{formatDistance(step.distanceMeters)}</AppText>
                      </View>
                    </View>
                  ))}
                </ScrollView>
              </Animated.View>
            )}
          </View>
        )}

        <View style={styles.cta}>
          <Button
            size="lg"
            title="Start walking"
            onPress={handleStart}
            icon={<Play size={18} color={c.onForest} fill={c.onForest} />}
          />
          <AppText variant="caption" style={styles.disclaimer}>
            Times are estimates from open map data. Stay aware of traffic.
          </AppText>
        </View>
      </Animated.View>
    </View>
  );
}

function RouteCard({
  route,
  index,
  width,
  selected,
  onPress,
}: {
  route: WalkingRoute;
  index: number;
  width: number;
  selected: boolean;
  onPress: () => void;
}) {
  const c = useColors();
  const styles = useThemedStyles(makeStyles);
  const color = c.routeColors[index % c.routeColors.length];
  const ringStyle = useAnimatedStyle(() => ({
    borderColor: withTiming(selected ? color : 'transparent', { duration: motion.fast }),
  }));
  const furthest =
    route.maxReturnSeconds !== undefined ? minutesOf(route.maxReturnSeconds) : null;

  return (
    <PressableScale
      onPress={onPress}
      pressedScale={0.98}
      style={{ width }}
      accessibilityLabel={`${routeName(route, index)}, about ${minutesOf(route.calibratedDurationSeconds)} minutes, ${formatDistance(route.distanceMeters)}`}
      accessibilityState={{ selected }}
    >
      <Animated.View style={[styles.card, ringStyle]}>
        <View style={styles.cardTop}>
          <View style={[styles.swatch, { backgroundColor: color }]} />
          <AppText variant="footnote" numberOfLines={1} style={{ flex: 1, fontWeight: '600' }}>
            {routeName(route, index)}
          </AppText>
          {index === 0 && (
            <View style={styles.bestBadge}>
              <AppText variant="caption" color={c.mintInk} style={{ fontWeight: '700' }}>
                Best fit
              </AppText>
            </View>
          )}
        </View>
        <View style={styles.cardStats}>
          <View style={styles.bigStat}>
            <AppText variant="numberLarge">{minutesOf(route.calibratedDurationSeconds)}</AppText>
            <AppText variant="callout" color={c.inkSecondary}>
              min
            </AppText>
          </View>
          <View style={styles.smallStats}>
            <AppText variant="callout" style={{ fontWeight: '600' }}>
              {formatDistance(route.distanceMeters)}
            </AppText>
            <AppText variant="caption">
              {furthest !== null
                ? `max ${furthest} min from start`
                : route.type === 'loop'
                  ? 'loop'
                  : 'out & back'}
            </AppText>
          </View>
        </View>
      </Animated.View>
    </PressableScale>
  );
}

function Dots({ count, active }: { count: number; active: number }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.dots}>
      {Array.from({ length: count }, (_, i) => (
        <Dot key={i} active={i === active} />
      ))}
    </View>
  );
}

function Dot({ active }: { active: boolean }) {
  const c = useColors();
  const styles = useThemedStyles(makeStyles);
  // Absolutely sized, childless: animating width is cheap here.
  const style = useAnimatedStyle(() => ({
    width: withTiming(active ? 18 : 6, { duration: motion.base, easing: motion.easeOut }),
    backgroundColor: withTiming(active ? c.ink : c.surfaceSunken, { duration: motion.base }),
  }));
  return <Animated.View style={[styles.dot, style]} />;
}

function Chevron({ open }: { open: boolean }) {
  const c = useColors();
  const style = useAnimatedStyle(() => ({
    transform: [{ rotate: withTiming(open ? '180deg' : '0deg', { duration: motion.base, easing: motion.easeOut }) }],
  }));
  return (
    <Animated.View style={style}>
      <ChevronDown size={16} color={c.inkSecondary} />
    </Animated.View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: c.background,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: layout.screenPadding,
  },
  back: {
    position: 'absolute',
    left: layout.screenPadding,
    width: layout.minTouch,
    height: layout.minTouch,
    borderRadius: radius.full,
    backgroundColor: c.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.raised,
  },
  panel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: spacing.xl,
    gap: spacing.lg,
    backgroundColor: c.background,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderCurve: 'continuous',
    ...shadows.raised,
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: layout.screenPadding,
  },
  dots: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  dot: {
    height: 6,
    borderRadius: 3,
  },
  card: {
    padding: spacing.lg,
    gap: spacing.md,
    backgroundColor: c.surface,
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    borderWidth: 2,
    ...shadows.card,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  swatch: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  bestBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: radius.full,
    backgroundColor: c.mintSoft,
  },
  cardStats: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  bigStat: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.xs,
  },
  smallStats: {
    alignItems: 'flex-end',
    gap: spacing.xxs,
  },
  stepsBlock: {
    paddingHorizontal: layout.screenPadding,
    gap: spacing.sm,
  },
  stepsToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    minHeight: 36,
  },
  stepsList: {
    maxHeight: 200,
  },
  step: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.separator,
  },
  stepIndex: {
    width: 18,
    textAlign: 'right',
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  cta: {
    paddingHorizontal: layout.screenPadding,
    gap: spacing.sm,
  },
  disclaimer: {
    textAlign: 'center',
  },
});
