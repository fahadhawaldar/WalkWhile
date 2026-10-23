import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowRight, ChevronLeft, Sparkles } from 'lucide-react-native';
import { RouteCard } from '../src/components/RouteCard';
import { UniversalMap } from '../src/components/UniversalMap';
import { useWalkStore } from '../src/store/useWalkStore';
import { COLORS } from '../src/theme/colors';

export default function RoutesScreen() {
  const router = useRouter();
  const {
    origin,
    generatedRoutes,
    selectedRouteIndex,
    setSelectedRouteIndex,
    availableMinutes,
  } = useWalkStore();

  if (!generatedRoutes || generatedRoutes.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyTitle}>No Routes Available</Text>
          <Text style={styles.emptySubtitle}>
            Please return to the home screen and try adjusting your time budget
            or location.
          </Text>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.replace('/')}
          >
            <Text style={styles.backButtonText}>Back to Home</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* Top Header Summary */}
      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.iconBackButton}
        >
          <ChevronLeft size={24} color={COLORS.primary} />
        </TouchableOpacity>
        <View style={styles.topBarContent}>
          <Text style={styles.topBarTitle}>
            {generatedRoutes.length} Routes Generated
          </Text>
          <Text style={styles.topBarSubtitle}>
            {availableMinutes} min budget • Origin: {origin.latitude.toFixed(4)},{' '}
            {origin.longitude.toFixed(4)}
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Interactive Map */}
        <View style={styles.mapWrapper}>
          <UniversalMap
            origin={origin}
            routes={generatedRoutes}
            selectedRouteIndex={selectedRouteIndex}
            onSelectRoute={(idx) => setSelectedRouteIndex(idx)}
            height={260}
          />
        </View>

        {/* Route Options Header */}
        <View style={styles.optionsHeader}>
          <Sparkles size={16} color={COLORS.primary} />
          <Text style={styles.optionsTitle}>SELECT YOUR WALKING ROUTE</Text>
        </View>

        {/* List of Route Cards */}
        {generatedRoutes.map((route, idx) => (
          <RouteCard
            key={route.id || idx}
            route={route}
            index={idx}
            isSelected={selectedRouteIndex === idx}
            onSelect={() => setSelectedRouteIndex(idx)}
          />
        ))}

        {/* Preview CTA */}
        <TouchableOpacity
          style={styles.previewButton}
          activeOpacity={0.85}
          onPress={() => router.push('/preview')}
        >
          <Text style={styles.previewButtonText}>
            Preview Route {selectedRouteIndex + 1}
          </Text>
          <ArrowRight size={20} color="#FFFFFF" strokeWidth={2.5} />
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
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderColor: COLORS.border,
  },
  iconBackButton: {
    padding: 6,
    marginRight: 8,
  },
  topBarContent: {
    flex: 1,
  },
  topBarTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.primary,
  },
  topBarSubtitle: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 36,
  },
  mapWrapper: {
    marginBottom: 16,
  },
  optionsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginVertical: 10,
  },
  optionsTitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    color: COLORS.textMuted,
  },
  previewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: COLORS.primary,
    paddingVertical: 16,
    borderRadius: 22,
    marginTop: 18,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  previewButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  backButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 14,
  },
  backButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
