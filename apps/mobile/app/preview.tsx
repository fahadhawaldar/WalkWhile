import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Play,
  Repeat,
  ShieldAlert,
  Undo2,
} from 'lucide-react-native';
import { UniversalMap } from '../src/components/UniversalMap';
import { useWalkStore } from '../src/store/useWalkStore';
import { COLORS } from '../src/theme/colors';
import { formatDistance } from '../src/utils/location';

export default function RoutePreviewScreen() {
  const router = useRouter();
  const {
    origin,
    generatedRoutes,
    selectedRouteIndex,
    safetyBufferMinutes,
    startWalk,
  } = useWalkStore();

  const route = generatedRoutes[selectedRouteIndex];

  if (!route) {
    router.replace('/routes');
    return null;
  }

  const durationMinutes = Math.round(route.calibratedDurationSeconds / 60);

  const handleStartWalk = () => {
    startWalk();
    router.replace('/active');
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Map Header */}
        <View style={styles.mapContainer}>
          <UniversalMap
            origin={origin}
            routes={[route]}
            selectedRouteIndex={0}
            height={280}
          />
        </View>

        {/* Route Header Card */}
        <View style={styles.overviewCard}>
          <View style={styles.titleRow}>
            <Text style={styles.routeNumber}>
              Route {selectedRouteIndex + 1}
            </Text>
            <View
              style={[
                styles.badge,
                route.type === 'loop'
                  ? styles.loopBadge
                  : styles.outAndBackBadge,
              ]}
            >
              {route.type === 'loop' ? (
                <Repeat size={12} color="#065F46" />
              ) : (
                <Undo2 size={12} color="#92400E" />
              )}
              <Text
                style={[
                  styles.badgeText,
                  route.type === 'loop'
                    ? styles.loopText
                    : styles.outAndBackText,
                ]}
              >
                {route.type === 'loop'
                  ? 'CIRCULAR LOOP'
                  : 'OUT & BACK PEDESTRIAN'}
              </Text>
            </View>
          </View>

          {/* Metrics Grid */}
          <View style={styles.metricsGrid}>
            <View style={styles.metricCell}>
              <Text style={styles.metricLabel}>WALK TIME</Text>
              <Text style={styles.metricValue}>~{durationMinutes} min</Text>
              <Text style={styles.metricSub}>calibrated pace</Text>
            </View>
            <View style={styles.metricCell}>
              <Text style={styles.metricLabel}>TOTAL DISTANCE</Text>
              <Text style={styles.metricValue}>
                {formatDistance(route.distanceMeters)}
              </Text>
              <Text style={styles.metricSub}>pedestrian paths</Text>
            </View>
            <View style={styles.metricCell}>
              <Text style={styles.metricLabel}>SAFETY BUFFER</Text>
              <Text style={[styles.metricValue, { color: COLORS.accent }]}>
                +{safetyBufferMinutes} min
              </Text>
              <Text style={styles.metricSub}>arrival cushion</Text>
            </View>
          </View>
        </View>

        {/* Turn-by-Turn Maneuvers List */}
        <View style={styles.stepsCard}>
          <Text style={styles.sectionTitle}>PEDESTRIAN DIRECTIONS</Text>
          {route.instructions?.length > 0 ? (
            route.instructions.map((step, idx) => (
              <View key={idx} style={styles.stepItem}>
                <View style={styles.stepNumberBadge}>
                  <Text style={styles.stepNumber}>{idx + 1}</Text>
                </View>
                <View style={styles.stepDetails}>
                  <Text style={styles.stepInstruction}>
                    {step.instruction}
                  </Text>
                  <Text style={styles.stepDistance}>
                    {formatDistance(step.distanceMeters)} • {step.name}
                  </Text>
                </View>
              </View>
            ))
          ) : (
            <Text style={styles.stepInstruction}>
              Follow circular pedestrian walkway back to starting point.
            </Text>
          )}
        </View>

        {/* Safety & Non-Guarantee Notice (Core Requirement #14) */}
        <View style={styles.disclaimerCard}>
          <ShieldAlert size={18} color="#D97706" style={styles.alertIcon} />
          <Text style={styles.disclaimerText}>
            Advisory estimate based on open pedestrian data. WalkWhile does not
            guarantee path safety or traffic-free crossings. Always prioritize
            personal awareness.
          </Text>
        </View>

        {/* Start Walk CTA */}
        <TouchableOpacity
          style={styles.startButton}
          activeOpacity={0.85}
          onPress={handleStartWalk}
        >
          <Play size={22} color="#FFFFFF" fill="#FFFFFF" />
          <Text style={styles.startButtonText}>Start Walking Now</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  mapContainer: {
    marginBottom: 14,
  },
  overviewCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 14,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  routeNumber: {
    fontSize: 22,
    fontWeight: '900',
    color: COLORS.primary,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  loopBadge: {
    backgroundColor: '#D1FAE5',
  },
  outAndBackBadge: {
    backgroundColor: '#FEF3C7',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  loopText: {
    color: '#065F46',
  },
  outAndBackText: {
    color: '#92400E',
  },
  metricsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderColor: COLORS.border,
    paddingTop: 12,
  },
  metricCell: {
    alignItems: 'center',
    flex: 1,
  },
  metricLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.textMuted,
    letterSpacing: 0.8,
    marginBottom: 3,
  },
  metricValue: {
    fontSize: 18,
    fontWeight: '900',
    color: COLORS.textPrimary,
  },
  metricSub: {
    fontSize: 10,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  stepsCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.textMuted,
    letterSpacing: 1,
    marginBottom: 14,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  stepNumberBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.surfaceSubtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    marginTop: 2,
  },
  stepNumber: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.primary,
  },
  stepDetails: {
    flex: 1,
  },
  stepInstruction: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
    lineHeight: 18,
  },
  stepDistance: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  disclaimerCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFFBEB',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#FDE68A',
    marginBottom: 18,
  },
  alertIcon: {
    marginRight: 10,
    marginTop: 2,
  },
  disclaimerText: {
    fontSize: 12,
    color: '#92400E',
    lineHeight: 17,
    flex: 1,
    fontWeight: '500',
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: COLORS.primary,
    paddingVertical: 18,
    borderRadius: 24,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  startButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
  },
});
