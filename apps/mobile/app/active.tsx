import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useKeepAwake } from 'expo-keep-awake';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInDown, FadeOut, SlideInDown } from 'react-native-reanimated';
import { CornerUpLeft, Plus, Square, UserCheck, Volume2, VolumeX } from 'lucide-react-native';
import { ReturnRouteStatus } from '@walkwhile/shared';
import { WalkWhileApiClient } from '../src/api/client';
import { TurnInstructionCard } from '../src/components/TurnInstructionCard';
import { UniversalMap } from '../src/components/UniversalMap';
import { WalkStatusBar } from '../src/components/WalkStatusBar';
import { AppText } from '../src/components/ui/AppText';
import { Button } from '../src/components/ui/Button';
import { PressableScale } from '../src/components/ui/PressableScale';
import { recordFinishedWalk } from '../src/history/walkHistory';
import { useVoiceGuidance } from '../src/hooks/useVoiceGuidance';
import { useWalkTracking } from '../src/hooks/useWalkTracking';
import { useWalkStore } from '../src/store/useWalkStore';
import { motion, Palette, radius, shadows, spacing, useColors, useThemedStyles } from '../src/theme';
import { haptics } from '../src/utils/haptics';
import { distanceBetween } from '../src/utils/location';
import { cancelWalkAlerts, scheduleWalkAlerts } from '../src/utils/notifications';
import { minutesOf } from '../src/utils/routeName';

const RETURN_CHECK_INTERVAL_MS = 15_000;
// Without a fresh return estimate for this long, say so instead of
// pretending the status is current.
const STALE_AFTER_MS = 45_000;
// Close enough to the start to count as back.
const ARRIVED_METERS = 35;
// Share of the route that must be walked before arriving counts as finishing.
const MIN_PROGRESS_TO_FINISH = 0.85;
const OFF_ROUTE_METERS = 50;
const EXTEND_MINUTES = 5;
const TOAST_MS = 4_000;

const SEVERITY: Record<ReturnRouteStatus, number> = { safe: 0, warning: 1, urgent: 2, overdue: 3 };

export default function ActiveWalkScreen() {
  const c = useColors();
  const styles = useThemedStyles(makeStyles);
  useKeepAwake();
  const router = useRouter();
  const {
    origin,
    generatedRoutes,
    selectedRouteIndex,
    activeState,
    startTime,
    availableMinutes,
    remainingSeconds,
    distanceWalkedMeters,
    stepCount,
    tickSecond,
    currentPosition,
    returnRoute,
    returnSafetyStatus,
    returnSafetyMessage,
    safetyBufferMinutes,
    waitType,
    triggerReturn,
    completeWalk,
    interruptWalk,
    extendWalk,
    updateReturnAssessment,
    voiceEnabled,
    setVoiceEnabled,
  } = useWalkStore();

  const route = generatedRoutes[selectedRouteIndex];
  const { progressIndex, offRouteMeters, heading } = useWalkTracking(route);
  const finished = useRef(false);
  const insets = useSafeAreaInsets();
  // Heights of the panels floating over the map, so it can keep the walker
  // centred in the visible part.
  const [topHudHeight, setTopHudHeight] = useState(0);
  const [bottomHudHeight, setBottomHudHeight] = useState(0);
  const [lastCheckAt, setLastCheckAt] = useState(() => Date.now());
  const [toast, setToast] = useState<string | null>(null);
  const [headingBack, setHeadingBack] = useState(false);

  const showToast = useCallback((text: string) => {
    setToast(text);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), TOAST_MS);
    return () => clearTimeout(t);
  }, [toast]);

  const finish = useCallback(
    (completed: boolean) => {
      if (finished.current) return;
      finished.current = true;
      cancelWalkAlerts();
      recordFinishedWalk(completed).catch((err) =>
        console.warn('Could not save the walk to history:', err)
      );
      if (completed) completeWalk();
      else interruptWalk();
      router.replace('/summary');
    },
    [completeWalk, interruptWalk, router]
  );

  // Countdown, derived from the wall clock.
  useEffect(() => {
    const timer = setInterval(tickSecond, 1000);
    return () => clearInterval(timer);
  }, [tickSecond]);

  // Pocket alerts; rescheduled when the walk is extended.
  useEffect(() => {
    if (startTime === null) return;
    scheduleWalkAlerts({ startTime, availableMinutes, safetyBufferMinutes });
  }, [startTime, availableMinutes, safetyBufferMinutes]);

  useEffect(() => () => {
    cancelWalkAlerts();
  }, []);

  // Periodically ask the server how long the walk back takes from here.
  useEffect(() => {
    const check = async () => {
      const state = useWalkStore.getState();
      if (!state.currentPosition) return;
      try {
        const result = await WalkWhileApiClient.calculateReturnRoute({
          originalOrigin: state.origin,
          currentLocation: state.currentPosition,
          remainingMinutes: state.remainingSeconds / 60,
          walkingSpeedKmh: state.walkingSpeedKmh,
          safetyBufferMinutes: state.safetyBufferMinutes,
        });
        state.updateReturnAssessment({
          route: result.route,
          status: result.status,
          action: result.recommendedAction,
          message: result.message,
        });
        setLastCheckAt(Date.now());
      } catch (err) {
        console.warn('Failed to refresh return evaluation:', err);
      }
    };
    const timer = setInterval(check, RETURN_CHECK_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [updateReturnAssessment]);

  // A buzz whenever the return status gets more serious, so the walker
  // notices without looking.
  const lastSeverity = useRef(SEVERITY[returnSafetyStatus]);
  useEffect(() => {
    const severity = SEVERITY[returnSafetyStatus] ?? 0;
    if (severity > lastSeverity.current) haptics.warning();
    lastSeverity.current = severity;
  }, [returnSafetyStatus]);

  // Arrival detection.
  useEffect(() => {
    if (!route || !currentPosition) return;
    const nearStart = distanceBetween(currentPosition, origin) < ARRIVED_METERS;
    const lastIndex = route.geometry.coordinates.length - 1;
    const walkedEnough =
      activeState === 'returning' ||
      progressIndex >= lastIndex * MIN_PROGRESS_TO_FINISH;
    if (nearStart && walkedEnough) finish(true);
  }, [route, currentPosition, origin, progressIndex, activeState, finish]);

  const handleHeadBackNow = async (reason: 'manual' | 'arrived') => {
    const state = useWalkStore.getState();
    if (!state.currentPosition || headingBack) return;
    haptics.tap();
    setHeadingBack(true);
    try {
      const result = await WalkWhileApiClient.calculateReturnRoute({
        originalOrigin: state.origin,
        currentLocation: state.currentPosition,
        remainingMinutes: state.remainingSeconds / 60,
        walkingSpeedKmh: state.walkingSpeedKmh,
        safetyBufferMinutes: state.safetyBufferMinutes,
      });
      triggerReturn(result.route);
      setLastCheckAt(Date.now());
      const minutes = minutesOf(result.calibratedDurationSeconds);
      showToast(
        reason === 'arrived'
          ? `On your way. About ${minutes} min back, follow the red line.`
          : `Shortest way back: about ${minutes} min. Follow the red line.`
      );
    } catch {
      triggerReturn();
      showToast('Heading back. Retrace your route to your spot.');
    } finally {
      setHeadingBack(false);
    }
  };

  const handleExtend = () => {
    haptics.selection();
    extendWalk(EXTEND_MINUTES);
    showToast(`Added ${EXTEND_MINUTES} min. New time: ${useWalkStore.getState().availableMinutes} min.`);
  };

  const handleEndWalk = () => {
    Alert.alert('End this walk?', 'It will be saved to your walks.', [
      { text: 'Keep walking', style: 'cancel' },
      {
        text: 'End walk',
        style: 'destructive',
        onPress: () => {
          haptics.thud();
          finish(false);
        },
      },
    ]);
  };

  const returning = activeState === 'returning';
  const steps = returning && returnRoute ? returnRoute.instructions : route?.instructions ?? [];
  const stepIndex = returning
    ? 0
    : Math.max(0, steps.findIndex((s) => progressIndex <= s.waypointIndices[1]));
  const currentStep = steps[stepIndex];
  const nextStep = steps[stepIndex + 1];

  const backBy = startTime !== null ? new Date(startTime + availableMinutes * 60_000) : null;
  const returnMinutes = returnRoute ? minutesOf(returnRoute.calibratedDurationSeconds) : null;
  const stale = Date.now() - lastCheckAt > STALE_AFTER_MS;
  const offRoute = activeState === 'walking' && offRouteMeters > OFF_ROUTE_METERS;

  const { say } = useVoiceGuidance({
    enabled: voiceEnabled,
    active: activeState === 'walking' || returning,
    guideRoute: returning && returnRoute ? returnRoute : route,
    steps,
    stepIndex,
    currentPosition,
    remainingSeconds,
    availableMinutes,
    status: returnSafetyStatus,
    returnMinutes,
    offRoute,
  });
  // Banners are spoken too, for a walker who isn't looking.
  useEffect(() => {
    if (toast) say(toast);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast]);

  return (
    <View style={styles.container}>
      {/* Full-screen live map */}
      <UniversalMap
        origin={origin}
        routes={route ? [route] : []}
        selectedRouteIndex={0}
        currentPosition={currentPosition}
        returnRoute={returning ? returnRoute : null}
        followUser
        heading={heading}
        progressIndex={progressIndex}
        fullScreen
        mapPadding={{ top: topHudHeight, bottom: bottomHudHeight }}
      />

      {/* Time left and return status, floating over the top of the map */}
      <Animated.View
        entering={FadeInDown.duration(motion.slow).easing(motion.easeOutFn)}
        style={[styles.topHud, { paddingTop: insets.top + spacing.sm }]}
        onLayout={(e) => setTopHudHeight(e.nativeEvent.layout.height)}
        pointerEvents="box-none"
      >
        <WalkStatusBar
          remainingSeconds={remainingSeconds}
          status={returnSafetyStatus}
          message={returnSafetyMessage}
          backBy={backBy}
          returnMinutes={returnMinutes}
          stale={stale}
          returning={returning}
        />
        {toast && (
          <Animated.View
            key={toast}
            entering={FadeInDown.duration(motion.base).easing(motion.easeOutFn)}
            exiting={FadeOut.duration(motion.base)}
            style={styles.toast}
            accessibilityLiveRegion="polite"
          >
            <AppText variant="footnote" color={c.onForest}>
              {toast}
            </AppText>
          </Animated.View>
        )}
      </Animated.View>

      <Animated.View
        entering={SlideInDown.duration(motion.slow).easing(motion.easeOutFn)}
        style={[styles.bottomHud, { paddingBottom: insets.bottom + spacing.md }]}
        onLayout={(e) => setBottomHudHeight(e.nativeEvent.layout.height)}
      >
        <TurnInstructionCard
          step={currentStep}
          nextStep={nextStep}
          totalDistanceMeters={route?.distanceMeters}
          walkedDistanceMeters={Math.round(distanceWalkedMeters)}
          stepCount={stepCount}
        />

        {offRoute && (
          <Animated.View entering={FadeIn.duration(motion.base)} exiting={FadeOut.duration(motion.fast)} style={styles.offRoute}>
            <AppText variant="footnote" color={c.warning} style={{ textAlign: 'center', fontWeight: '600' }}>
              Off the route. That's fine, just watch the timer.
            </AppText>
          </Animated.View>
        )}

        {waitType === 'flexible' && activeState === 'walking' && (
          <View style={styles.row}>
            <Button
              title="They're here"
              style={{ flex: 1 }}
              loading={headingBack}
              onPress={() => handleHeadBackNow('arrived')}
              icon={<UserCheck size={18} color={c.onForest} strokeWidth={2.4} />}
            />
            <Button
              title={`${EXTEND_MINUTES} min`}
              variant="tinted"
              onPress={handleExtend}
              accessibilityHint="They're running late; add five minutes"
              icon={<Plus size={16} color={c.mintInk} strokeWidth={2.6} />}
            />
          </View>
        )}

        <View style={styles.row}>
          {!returning ? (
            <Button
              title="Head back"
              variant={waitType === 'flexible' ? 'secondary' : SEVERITY[returnSafetyStatus] > 0 ? 'primary' : 'secondary'}
              style={{ flex: 1 }}
              loading={headingBack && waitType !== 'flexible'}
              onPress={() => handleHeadBackNow('manual')}
              accessibilityHint="Shows the shortest way back to your spot"
              icon={
                <CornerUpLeft
                  size={18}
                  strokeWidth={2.4}
                  color={waitType !== 'flexible' && SEVERITY[returnSafetyStatus] > 0 ? c.onForest : c.ink}
                />
              }
            />
          ) : (
            <View style={[styles.returningPill, { flex: 1 }]}>
              <CornerUpLeft size={16} color={c.mintInk} strokeWidth={2.4} />
              <AppText variant="callout" color={c.mintInk} style={{ fontWeight: '600' }}>
                On the way back
              </AppText>
            </View>
          )}
          <PressableScale
            onPress={() => {
              haptics.selection();
              setVoiceEnabled(!voiceEnabled);
            }}
            style={styles.voice}
            accessibilityLabel={voiceEnabled ? 'Mute voice guidance' : 'Turn on voice guidance'}
            accessibilityState={{ selected: voiceEnabled }}
          >
            {voiceEnabled ? (
              <Volume2 size={20} color={c.ink} strokeWidth={2.2} />
            ) : (
              <VolumeX size={20} color={c.inkTertiary} strokeWidth={2.2} />
            )}
          </PressableScale>
          <PressableScale
            onPress={handleEndWalk}
            style={styles.stop}
            accessibilityLabel="End walk"
          >
            <Square size={16} color={c.urgent} fill={c.urgent} />
          </PressableScale>
        </View>
      </Animated.View>
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: c.background,
  },
  topHud: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  toast: {
    alignSelf: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.full,
    backgroundColor: c.forest,
    ...shadows.raised,
  },
  bottomHud: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    gap: spacing.md,
    backgroundColor: c.background,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderCurve: 'continuous',
    ...shadows.raised,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  offRoute: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: c.warningSoft,
  },
  returningPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    height: 52,
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    backgroundColor: c.mintSoft,
  },
  voice: {
    width: 52,
    height: 52,
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    backgroundColor: c.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.card,
  },
  stop: {
    width: 52,
    height: 52,
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    backgroundColor: c.urgentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
