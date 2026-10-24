import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useKeepAwake } from 'expo-keep-awake';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Plus, Square, Undo2, UserCheck } from 'lucide-react-native';
import { WalkWhileApiClient } from '../src/api/client';
import { TurnInstructionCard } from '../src/components/TurnInstructionCard';
import { UniversalMap } from '../src/components/UniversalMap';
import { WalkStatusBar } from '../src/components/WalkStatusBar';
import { recordFinishedWalk } from '../src/history/walkHistory';
import { useWalkTracking } from '../src/hooks/useWalkTracking';
import { useWalkStore } from '../src/store/useWalkStore';
import { COLORS } from '../src/theme/colors';
import { distanceBetween } from '../src/utils/location';
import { cancelWalkAlerts, scheduleWalkAlerts } from '../src/utils/notifications';

const RETURN_CHECK_INTERVAL_MS = 15_000;
// Close enough to the start to count as back.
const ARRIVED_METERS = 35;
// Share of the route that must be walked before arriving counts as finishing.
const MIN_PROGRESS_TO_FINISH = 0.85;
const OFF_ROUTE_METERS = 50;
const EXTEND_MINUTES = 5;

export default function ActiveWalkScreen() {
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
  } = useWalkStore();

  const route = generatedRoutes[selectedRouteIndex];
  const { progressIndex, offRouteMeters, heading } = useWalkTracking(route);
  const finished = useRef(false);
  const insets = useSafeAreaInsets();
  // Heights of the panels floating over the map, so it can keep the walker
  // centred in the visible part.
  const [topHudHeight, setTopHudHeight] = useState(0);
  const [bottomHudHeight, setBottomHudHeight] = useState(0);

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
      } catch (err) {
        console.warn('Failed to refresh return evaluation:', err);
      }
    };
    const timer = setInterval(check, RETURN_CHECK_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [updateReturnAssessment]);

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
    if (!state.currentPosition) return;
    try {
      const result = await WalkWhileApiClient.calculateReturnRoute({
        originalOrigin: state.origin,
        currentLocation: state.currentPosition,
        remainingMinutes: state.remainingSeconds / 60,
        walkingSpeedKmh: state.walkingSpeedKmh,
        safetyBufferMinutes: state.safetyBufferMinutes,
      });
      triggerReturn(result.route);
      const minutes = Math.max(1, Math.round(result.calibratedDurationSeconds / 60));
      Alert.alert(
        reason === 'arrived' ? 'Heading back' : 'Return route ready',
        `Follow the red dashed line. About ${minutes} min back to your starting point.`
      );
    } catch {
      triggerReturn();
    }
  };

  const handleEndWalk = () => {
    Alert.alert('End Walk', 'Are you sure you want to stop this walk?', [
      { text: 'Continue Walking', style: 'cancel' },
      { text: 'Stop Walk', style: 'destructive', onPress: () => finish(false) },
    ]);
  };

  const steps =
    activeState === 'returning' && returnRoute
      ? returnRoute.instructions
      : route?.instructions ?? [];
  const stepIndex =
    activeState === 'returning'
      ? 0
      : Math.max(
          0,
          steps.findIndex((s) => progressIndex <= s.waypointIndices[1])
        );
  const currentStep = steps[stepIndex];
  const nextStep = steps[stepIndex + 1];

  return (
    <View style={styles.container}>
      {/* Full-screen live map */}
      <UniversalMap
        origin={origin}
        routes={route ? [route] : []}
        selectedRouteIndex={0}
        currentPosition={currentPosition}
        returnRoute={activeState === 'returning' ? returnRoute : null}
        followUser
        heading={heading}
        progressIndex={progressIndex}
        fullScreen
        mapPadding={{ top: topHudHeight, bottom: bottomHudHeight }}
      />

      {/* Time left and return status, floating over the top of the map */}
      <View
        style={[styles.topHud, { paddingTop: insets.top + 8 }]}
        onLayout={(e) => setTopHudHeight(e.nativeEvent.layout.height)}
        pointerEvents="box-none"
      >
        <WalkStatusBar
          remainingSeconds={remainingSeconds}
          status={returnSafetyStatus}
          message={returnSafetyMessage}
        />
      </View>

      <View
        style={[styles.bottomHud, { paddingBottom: insets.bottom + 12 }]}
        onLayout={(e) => setBottomHudHeight(e.nativeEvent.layout.height)}
      >
        {/* Turn-by-Turn Instruction & Progress */}
        <TurnInstructionCard
          step={currentStep}
          nextStep={nextStep}
          totalDistanceMeters={route?.distanceMeters}
          walkedDistanceMeters={Math.round(distanceWalkedMeters)}
          stepCount={stepCount}
        />

        {activeState === 'walking' && offRouteMeters > OFF_ROUTE_METERS && (
          <View style={styles.offRouteBanner}>
            <Text style={styles.offRouteText}>
              You are off the route. That's fine, just keep an eye on the timer.
            </Text>
          </View>
        )}

        {waitType === 'flexible' && activeState === 'walking' && (
          <View style={styles.flexibleRow}>
            <TouchableOpacity
              style={styles.arrivedButton}
              onPress={() => handleHeadBackNow('arrived')}
              activeOpacity={0.85}
            >
              <UserCheck size={18} color="#FFFFFF" strokeWidth={2.5} />
              <Text style={styles.arrivedButtonText}>They're here</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.extendButton}
              onPress={() => extendWalk(EXTEND_MINUTES)}
              activeOpacity={0.85}
            >
              <Plus size={16} color={COLORS.primary} strokeWidth={2.5} />
              <Text style={styles.extendButtonText}>{EXTEND_MINUTES} min</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Action Controls */}
        <View style={styles.controlsRow}>
          <TouchableOpacity
            style={styles.returnButton}
            onPress={() => handleHeadBackNow('manual')}
            activeOpacity={0.8}
          >
            <Undo2 size={18} color="#92400E" strokeWidth={2.5} />
            <Text style={styles.returnButtonText}>Head Back (Shortest)</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.stopButton}
            onPress={handleEndWalk}
            activeOpacity={0.8}
          >
            <Square size={16} color="#DC2626" fill="#DC2626" />
            <Text style={styles.stopButtonText}>Stop</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  topHud: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
  },
  bottomHud: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 4,
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  controlsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  returnButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FEF3C7',
    paddingVertical: 14,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#F59E0B',
  },
  returnButtonText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#92400E',
  },
  stopButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#EF4444',
  },
  stopButtonText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#DC2626',
  },
  flexibleRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  arrivedButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: 18,
  },
  arrivedButtonText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  extendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: COLORS.accentSoft,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 18,
  },
  extendButtonText: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.primary,
  },
  offRouteBanner: {
    marginTop: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: '#FEF3C7',
  },
  offRouteText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#92400E',
    textAlign: 'center',
  },
});
