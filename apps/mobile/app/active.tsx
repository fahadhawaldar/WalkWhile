import { useEffect, useState } from 'react';
import {
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Square,
  Undo2,
} from 'lucide-react-native';
import { WalkWhileApiClient } from '../src/api/client';
import { CountdownTimer } from '../src/components/CountdownTimer';
import { ReturnAlertBanner } from '../src/components/ReturnAlertBanner';
import { TurnInstructionCard } from '../src/components/TurnInstructionCard';
import { UniversalMap } from '../src/components/UniversalMap';
import { useWalkStore } from '../src/store/useWalkStore';
import { COLORS } from '../src/theme/colors';

export default function ActiveWalkScreen() {
  const router = useRouter();
  const {
    origin,
    generatedRoutes,
    selectedRouteIndex,
    remainingSeconds,
    elapsedSeconds,
    walkingSpeedKmh,
    tickSecond,
    currentPosition,
    updateCurrentPosition,
    returnRoute,
    returnSafetyStatus,
    recommendedReturnAction,
    returnSafetyMessage,
    safetyBufferMinutes,
    triggerReturn,
    completeWalk,
    interruptWalk,
    updateReturnAssessment,
  } = useWalkStore();

  const route = generatedRoutes[selectedRouteIndex];
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  // Active walk tick timer: decrements remainingSeconds every second
  useEffect(() => {
    const timer = setInterval(() => {
      tickSecond();
    }, 1000);

    return () => clearInterval(timer);
  }, [tickSecond]);

  // Simulate GPS position moving along the route coordinates
  useEffect(() => {
    if (!route || !route.geometry || route.geometry.coordinates.length === 0)
      return;

    const coords = route.geometry.coordinates;
    const totalPoints = coords.length;
    const totalEstimatedSeconds = Math.max(1, route.calibratedDurationSeconds);

    // Calculate which coordinate the user is near based on elapsed time ratio
    const progressRatio = Math.min(1, elapsedSeconds / totalEstimatedSeconds);
    const pointIdx = Math.min(
      totalPoints - 1,
      Math.floor(progressRatio * (totalPoints - 1))
    );

    const [lon, lat] = coords[pointIdx];
    updateCurrentPosition({ latitude: lat, longitude: lon });

    // Step index progress
    if (route.instructions && route.instructions.length > 0) {
      const stepIdx = Math.min(
        route.instructions.length - 1,
        Math.floor(progressRatio * route.instructions.length)
      );
      setCurrentStepIndex(stepIdx);
    }

    // Automatically complete walk when reaching 100% of loop or remainingSeconds === 0
    if (progressRatio >= 0.98 && elapsedSeconds > 10) {
      completeWalk();
      router.replace('/summary');
    }
  }, [
    elapsedSeconds,
    route,
    updateCurrentPosition,
    completeWalk,
    router,
  ]);

  // Periodically query the backend return route evaluation (every 10 seconds)
  useEffect(() => {
    if (!currentPosition || elapsedSeconds < 3) return;

    const checkReturnFeasibility = async () => {
      try {
        const remainingMinutes = remainingSeconds / 60;
        const result = await WalkWhileApiClient.calculateReturnRoute({
          originalOrigin: origin,
          currentLocation: currentPosition,
          remainingMinutes,
          walkingSpeedKmh,
          safetyBufferMinutes,
        });

        updateReturnAssessment({
          route: result.route,
          status: result.status,
          action: result.recommendedAction,
          message: result.message,
        });
      } catch (err) {
        console.warn('Failed to refresh return evaluation:', err);
      }
    };

    if (elapsedSeconds % 10 === 0) {
      checkReturnFeasibility();
    }
  }, [
    elapsedSeconds,
    currentPosition,
    origin,
    remainingSeconds,
    walkingSpeedKmh,
    safetyBufferMinutes,
    updateReturnAssessment,
  ]);

  const handleHeadBackNow = async () => {
    if (!currentPosition) return;
    try {
      const remainingMinutes = remainingSeconds / 60;
      const result = await WalkWhileApiClient.calculateReturnRoute({
        originalOrigin: origin,
        currentLocation: currentPosition,
        remainingMinutes,
        walkingSpeedKmh,
        safetyBufferMinutes,
      });

      triggerReturn(result.route);
      Alert.alert(
        'Return Route Activated',
        'Directing you back to your starting point via the shortest pedestrian path.'
      );
    } catch {
      triggerReturn();
    }
  };

  const handleEndWalk = () => {
    Alert.alert('End Walk', 'Are you sure you want to stop this walk?', [
      { text: 'Continue Walking', style: 'cancel' },
      {
        text: 'Stop Walk',
        style: 'destructive',
        onPress: () => {
          interruptWalk();
          router.replace('/summary');
        },
      },
    ]);
  };

  const currentStep = route?.instructions?.[currentStepIndex];
  const nextStep = route?.instructions?.[currentStepIndex + 1];
  const walkedMeters = Math.round(
    (route?.distanceMeters || 600) *
      Math.min(1, elapsedSeconds / Math.max(1, route?.calibratedDurationSeconds || 400))
  );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Top Countdown HUD */}
      <View style={styles.topHud}>
        <CountdownTimer
          remainingSeconds={remainingSeconds}
          safetyStatus={returnSafetyStatus}
        />

        {/* Dynamic Return Safety Alert */}
        <ReturnAlertBanner
          status={returnSafetyStatus}
          action={recommendedReturnAction}
          message={returnSafetyMessage}
          safetyMarginSeconds={remainingSeconds - (route?.calibratedDurationSeconds || 300)}
        />
      </View>

      {/* Interactive Active Map */}
      <View style={styles.mapContainer}>
        <UniversalMap
          origin={origin}
          routes={route ? [route] : []}
          selectedRouteIndex={0}
          currentPosition={currentPosition}
          returnRoute={returnRoute}
          height={300}
        />
      </View>

      {/* Turn-by-Turn Instruction & Progress */}
      <View style={styles.bottomHud}>
        <TurnInstructionCard
          step={currentStep}
          nextStep={nextStep}
          totalDistanceMeters={route?.distanceMeters}
          walkedDistanceMeters={walkedMeters}
        />

        {/* Action Controls */}
        <View style={styles.controlsRow}>
          <TouchableOpacity
            style={styles.returnButton}
            onPress={handleHeadBackNow}
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  topHud: {
    paddingHorizontal: 16,
    paddingTop: 8,
    backgroundColor: COLORS.background,
  },
  mapContainer: {
    flex: 1,
    paddingHorizontal: 16,
    marginVertical: 8,
  },
  bottomHud: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    backgroundColor: COLORS.background,
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
});
