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
  CheckCircle2,
  Clock,
  Footprints,
  RotateCcw,
  Route,
  ShieldCheck,
  XCircle,
} from 'lucide-react-native';
import { UniversalMap } from '../src/components/UniversalMap';
import { useWalkStore } from '../src/store/useWalkStore';
import { COLORS } from '../src/theme/colors';
import { formatDistance, formatDuration } from '../src/utils/location';

export default function SummaryScreen() {
  const router = useRouter();
  const {
    origin,
    generatedRoutes,
    selectedRouteIndex,
    activeState,
    elapsedSeconds,
    remainingSeconds,
    distanceWalkedMeters,
    stepCount,
    resetWalk,
  } = useWalkStore();

  const route = generatedRoutes[selectedRouteIndex];
  const isCompleted = activeState === 'completed';

  const handleFinish = () => {
    resetWalk();
    router.replace('/');
  };

  const walkedDistanceMeters = Math.round(distanceWalkedMeters);
  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Status Header Badge */}
        <View style={styles.statusHeader}>
          <View
            style={[
              styles.iconCircle,
              isCompleted ? styles.iconCompleted : styles.iconInterrupted,
            ]}
          >
            {isCompleted ? (
              <CheckCircle2 size={48} color="#059669" strokeWidth={2.5} />
            ) : (
              <XCircle size={48} color="#DC2626" strokeWidth={2.5} />
            )}
          </View>
          <Text style={styles.statusTitle}>
            {isCompleted ? 'Walk Completed On Time!' : 'Walk Concluded'}
          </Text>
          <Text style={styles.statusSubtitle}>
            {isCompleted
              ? 'You turned waiting time into healthy walking steps and returned with time to spare.'
              : 'You stopped your walk and safely returned to your starting point.'}
          </Text>
        </View>

        {/* Metrics Grid Card */}
        <View style={styles.metricsCard}>
          <View style={styles.metricsRow}>
            <View style={styles.metricCell}>
              <View style={styles.metricIconRow}>
                <Clock size={16} color={COLORS.primary} />
                <Text style={styles.metricLabel}>TOTAL TIME</Text>
              </View>
              <Text style={styles.metricValue}>
                {formatDuration(elapsedSeconds)}
              </Text>
            </View>

            <View style={styles.metricDivider} />

            <View style={styles.metricCell}>
              <View style={styles.metricIconRow}>
                <Route size={16} color={COLORS.primary} />
                <Text style={styles.metricLabel}>DISTANCE</Text>
              </View>
              <Text style={styles.metricValue}>
                {formatDistance(walkedDistanceMeters)}
              </Text>
            </View>

            <View style={styles.metricDivider} />

            <View style={styles.metricCell}>
              <View style={styles.metricIconRow}>
                <Footprints size={16} color={COLORS.primary} />
                <Text style={styles.metricLabel}>STEPS</Text>
              </View>
              <Text style={styles.metricValue}>{stepCount.toLocaleString()}</Text>
            </View>
          </View>

          <View style={styles.cushionRow}>
            <ShieldCheck size={18} color={COLORS.safe} />
            <Text style={styles.cushionText}>
              Returned with ~{Math.round(remainingSeconds / 60)} min remaining on
              your timer
            </Text>
          </View>
        </View>

        {/* Route Snapshot Map */}
        {route && (
          <View style={styles.mapCard}>
            <Text style={styles.mapLabel}>WALK ROUTE SNAPSHOT</Text>
            <UniversalMap
              origin={origin}
              routes={[route]}
              selectedRouteIndex={0}
              height={220}
            />
          </View>
        )}

        {/* Return to Home CTA */}
        <TouchableOpacity
          style={styles.doneButton}
          onPress={handleFinish}
          activeOpacity={0.85}
        >
          <RotateCcw size={20} color="#FFFFFF" strokeWidth={2.5} />
          <Text style={styles.doneButtonText}>Back to Home</Text>
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
    padding: 20,
    paddingBottom: 40,
  },
  statusHeader: {
    alignItems: 'center',
    marginVertical: 16,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  iconCompleted: {
    backgroundColor: '#D1FAE5',
  },
  iconInterrupted: {
    backgroundColor: '#FEE2E2',
  },
  statusTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: COLORS.textPrimary,
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  statusSubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 16,
  },
  metricsCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 22,
    padding: 20,
    marginVertical: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderColor: COLORS.border,
  },
  metricCell: {
    flex: 1,
    alignItems: 'center',
  },
  metricIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  metricLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.textMuted,
    letterSpacing: 1,
  },
  metricValue: {
    fontSize: 22,
    fontWeight: '900',
    color: COLORS.textPrimary,
  },
  metricDivider: {
    width: 1,
    height: 36,
    backgroundColor: COLORS.border,
  },
  cushionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingTop: 14,
  },
  cushionText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.safe,
  },
  mapCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 20,
  },
  mapLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.textMuted,
    letterSpacing: 1,
    marginBottom: 10,
  },
  doneButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: COLORS.primary,
    paddingVertical: 18,
    borderRadius: 24,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  doneButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
  },
});
