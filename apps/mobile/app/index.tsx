import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Clock,
  Compass,
  Footprints,
  LocateFixed,
  MapPin,
  Minus,
  Plus,
  Settings,
  ShieldCheck,
  Timer,
  History,
  Users,
  Zap,
} from 'lucide-react-native';
import { WaitType } from '@walkwhile/shared';
import { WalkWhileApiClient } from '../src/api/client';
import { useWalkStore } from '../src/store/useWalkStore';
import { COLORS } from '../src/theme/colors';
import {
  getCurrentLocation,
  PRESET_LOCATIONS,
  formatDistance,
} from '../src/utils/location';

const WAIT_TYPES: Array<{
  value: WaitType;
  title: string;
  subtitle: string;
  Icon: typeof Timer;
}> = [
  {
    value: 'fixed',
    title: 'Exact time',
    subtitle: 'Air fryer, laundry, parking',
    Icon: Timer,
  },
  {
    value: 'flexible',
    title: 'Someone is coming',
    subtitle: 'Stay close in case they are early',
    Icon: Users,
  },
];

const QUICK_MINUTES = [5, 10, 15, 20, 30, 45];
const SPEED_OPTIONS = [
  { label: 'Relaxed (3.5 km/h)', value: 3.5 },
  { label: 'Moderate (5.0 km/h)', value: 5.0 },
  { label: 'Brisk (6.5 km/h)', value: 6.5 },
];
const BUFFER_OPTIONS = [
  { label: '1.5 min buffer', value: 1.5 },
  { label: '2.5 min buffer', value: 2.5 },
  { label: '5.0 min buffer', value: 5.0 },
];

export default function HomeScreen() {
  const router = useRouter();
  const {
    origin,
    setOrigin,
    availableMinutes,
    setAvailableMinutes,
    walkingSpeedKmh,
    setWalkingSpeedKmh,
    safetyBufferMinutes,
    setSafetyBufferMinutes,
    setGeneratedRoutes,
    waitType,
    setWaitType,
    maxReturnMinutes,
    simulateWalk,
    setSimulateWalk,
  } = useWalkStore();

  const [isLoadingGps, setIsLoadingGps] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [usingGps, setUsingGps] = useState(false);

  // Calculate live preview metrics
  const budgetMinutes = Math.max(0, availableMinutes - safetyBufferMinutes);
  const targetDistanceMeters = Math.round(
    (walkingSpeedKmh * 1000 * budgetMinutes) / 60
  );

  const handleUseCurrentLocation = async (silent = false) => {
    setIsLoadingGps(true);
    const loc = await getCurrentLocation();
    setIsLoadingGps(false);
    if (loc) {
      setOrigin(loc);
      setUsingGps(true);
    } else if (!silent) {
      Alert.alert(
        'GPS Unavailable',
        'Could not get your current location. Check that location access is allowed for WalkWhile.'
      );
    }
  };

  // You are standing where the walk starts, so locate right away.
  useEffect(() => {
    handleUseCurrentLocation(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Without a GPS fix the origin is only a placeholder; developers may use
  // the preset test locations instead.
  const hasLocation = usingGps || (__DEV__ && !isLoadingGps);

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      // Read the latest settings so a just-arrived GPS fix is never missed.
      const state = useWalkStore.getState();
      const response = await WalkWhileApiClient.generateRoutes({
        origin: state.origin,
        availableMinutes: state.availableMinutes,
        walkingSpeedKmh: state.walkingSpeedKmh,
        safetyBufferMinutes: state.safetyBufferMinutes,
        maxRoutes: 3,
        waitType: state.waitType,
        maxReturnMinutes: state.maxReturnMinutes,
      });

      if (!response.routes || response.routes.length === 0) {
        Alert.alert(
          'No Routes Found',
          response.message ||
            'Could not find suitable pedestrian routes near this location within your time budget.'
        );
        setIsGenerating(false);
        return;
      }

      setGeneratedRoutes(response.routes);
      setIsGenerating(false);
      router.push('/routes');
    } catch (err: unknown) {
      setIsGenerating(false);
      Alert.alert(
        'Generation Failed',
        (err as Error).message ||
          'Failed to reach routing service. Make sure the API server is running.'
      );
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Brand Header */}
        <View style={styles.header}>
          <View style={styles.logoBadge}>
            <Footprints size={26} color="#FFFFFF" strokeWidth={2.5} />
          </View>
          <Text style={styles.appName}>WalkWhile</Text>
          <Text style={styles.tagline}>
            Turn waiting time into walking opportunities.
          </Text>
          <TouchableOpacity
            style={styles.historyButton}
            onPress={() => router.push('/history')}
            activeOpacity={0.8}
          >
            <History size={15} color={COLORS.primary} strokeWidth={2.5} />
            <Text style={styles.historyButtonText}>Your walks</Text>
          </TouchableOpacity>
        </View>

        {/* Wait Type */}
        <View style={styles.waitTypeRow}>
          {WAIT_TYPES.map(({ value, title, subtitle, Icon }) => {
            const active = waitType === value;
            return (
              <TouchableOpacity
                key={value}
                style={[styles.waitTypeCard, active && styles.waitTypeCardActive]}
                onPress={() => setWaitType(value)}
                activeOpacity={0.85}
              >
                <Icon size={20} color={active ? '#FFFFFF' : COLORS.primary} />
                <Text style={[styles.waitTypeTitle, active && styles.waitTypeTextActive]}>
                  {title}
                </Text>
                <Text
                  style={[styles.waitTypeSubtitle, active && styles.waitTypeTextActive]}
                >
                  {subtitle}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Available Time Budget Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Clock size={18} color={COLORS.primary} />
            <Text style={styles.cardTitle}>HOW MUCH TIME DO YOU HAVE?</Text>
          </View>

          <View style={styles.timeDisplayRow}>
            <TouchableOpacity
              style={styles.stepperButton}
              onPress={() =>
                setAvailableMinutes(Math.max(5, availableMinutes - 1))
              }
            >
              <Minus size={20} color={COLORS.primary} strokeWidth={2.5} />
            </TouchableOpacity>

            <View style={styles.timeValueContainer}>
              <Text style={styles.timeNumber}>{availableMinutes}</Text>
              <Text style={styles.timeUnit}>MINUTES</Text>
            </View>

            <TouchableOpacity
              style={styles.stepperButton}
              onPress={() =>
                setAvailableMinutes(Math.min(60, availableMinutes + 1))
              }
            >
              <Plus size={20} color={COLORS.primary} strokeWidth={2.5} />
            </TouchableOpacity>
          </View>

          {/* Quick chips */}
          <View style={styles.chipsContainer}>
            {QUICK_MINUTES.map((m) => (
              <TouchableOpacity
                key={m}
                onPress={() => setAvailableMinutes(m)}
                style={[
                  styles.chip,
                  availableMinutes === m && styles.chipActive,
                ]}
              >
                <Text
                  style={[
                    styles.chipText,
                    availableMinutes === m && styles.chipTextActive,
                  ]}
                >
                  {m}m
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Target Distance Hint */}
          <View style={styles.targetHintRow}>
            <Zap size={14} color={COLORS.accent} />
            <Text style={styles.targetHintText}>
              {waitType === 'fixed'
                ? `Target: ~${formatDistance(targetDistanceMeters)} loop with ${safetyBufferMinutes}m safety cushion`
                : `Small loops, never more than ~${maxReturnMinutes} min from your spot`}
            </Text>
          </View>
        </View>

        {/* Starting Location Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <MapPin size={18} color={COLORS.primary} />
            <Text style={styles.cardTitle}>STARTING LOCATION</Text>
          </View>

          <TouchableOpacity
            style={styles.gpsButton}
            onPress={() => handleUseCurrentLocation()}
            disabled={isLoadingGps}
          >
            {isLoadingGps ? (
              <ActivityIndicator size="small" color={COLORS.primary} />
            ) : (
              <LocateFixed size={18} color={COLORS.primary} />
            )}
            <Text style={styles.gpsButtonText}>
              {isLoadingGps
                ? 'Finding you...'
                : usingGps
                  ? `Your location (${origin.latitude.toFixed(4)}, ${origin.longitude.toFixed(4)})`
                  : 'Use My Current Location'}
            </Text>
          </TouchableOpacity>

          {__DEV__ && (
            <>
              <Text style={styles.presetLabel}>Developer: test locations</Text>
              <View style={styles.presetsList}>
                {PRESET_LOCATIONS.map((preset) => {
                  const isSelected =
                    Math.abs(origin.latitude - preset.coordinate.latitude) <
                      0.0001 &&
                    Math.abs(origin.longitude - preset.coordinate.longitude) <
                      0.0001;

                  return (
                    <TouchableOpacity
                      key={preset.id}
                      style={[
                        styles.presetItem,
                        isSelected && styles.presetItemActive,
                      ]}
                      onPress={() => {
                        setOrigin(preset.coordinate);
                        setUsingGps(false);
                      }}
                    >
                      <View style={styles.presetContent}>
                        <Text
                          style={[
                            styles.presetName,
                            isSelected && styles.presetNameActive,
                          ]}
                        >
                          {preset.name}
                        </Text>
                        <Text style={styles.presetDescription} numberOfLines={1}>
                          {preset.description}
                        </Text>
                      </View>
                      {isSelected && (
                        <View style={styles.activeCheck}>
                          <ShieldCheck size={16} color={COLORS.primary} />
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
              <View style={styles.simulateRow}>
                <Text style={styles.presetLabel}>Developer: simulate walking</Text>
                <Switch value={simulateWalk} onValueChange={setSimulateWalk} />
              </View>
            </>
          )}
        </View>

        {/* Optional Speed & Safety Settings Accordion */}
        <TouchableOpacity
          style={styles.settingsHeader}
          onPress={() => setShowSettings(!showSettings)}
        >
          <View style={styles.settingsHeaderLeft}>
            <Settings size={16} color={COLORS.textMuted} />
            <Text style={styles.settingsHeaderText}>
              Speed ({walkingSpeedKmh} km/h) & Safety Cushion (
              {safetyBufferMinutes} min)
            </Text>
          </View>
          <Text style={styles.settingsToggleText}>
            {showSettings ? 'Hide' : 'Customize'}
          </Text>
        </TouchableOpacity>

        {showSettings && (
          <View style={styles.settingsBody}>
            <Text style={styles.settingLabel}>WALKING PACE</Text>
            <View style={styles.optionRow}>
              {SPEED_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  style={[
                    styles.optionPill,
                    walkingSpeedKmh === opt.value && styles.optionPillActive,
                  ]}
                  onPress={() => setWalkingSpeedKmh(opt.value)}
                >
                  <Text
                    style={[
                      styles.optionPillText,
                      walkingSpeedKmh === opt.value &&
                        styles.optionPillTextActive,
                    ]}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.settingLabel, { marginTop: 14 }]}>
              SAFETY RETURN BUFFER
            </Text>
            <View style={styles.optionRow}>
              {BUFFER_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  style={[
                    styles.optionPill,
                    safetyBufferMinutes === opt.value && styles.optionPillActive,
                  ]}
                  onPress={() => setSafetyBufferMinutes(opt.value)}
                >
                  <Text
                    style={[
                      styles.optionPillText,
                      safetyBufferMinutes === opt.value &&
                        styles.optionPillTextActive,
                    ]}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Primary CTA */}
        <TouchableOpacity
          style={[
            styles.primaryButton,
            (isGenerating || !hasLocation) && styles.buttonDisabled,
          ]}
          onPress={handleGenerate}
          disabled={isGenerating || !hasLocation}
          activeOpacity={0.85}
        >
          {isGenerating ? (
            <View style={styles.buttonLoadingRow}>
              <ActivityIndicator size="small" color="#FFFFFF" />
              <Text style={styles.primaryButtonText}>
                Crafting Pedestrian Loops...
              </Text>
            </View>
          ) : (
            <View style={styles.buttonRow}>
              <Compass size={22} color="#FFFFFF" strokeWidth={2.5} />
              <Text style={styles.primaryButtonText}>
                {hasLocation
                  ? 'Generate Walking Routes'
                  : 'Finding your location...'}
              </Text>
            </View>
          )}
        </TouchableOpacity>

        <Text style={styles.disclaimerText}>
          WalkWhile prioritizes getting you back on time. Maps show real pedestrian
          corridors without imaginary straight lines.
        </Text>
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
  header: {
    alignItems: 'center',
    marginVertical: 16,
  },
  logoBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  appName: {
    fontSize: 28,
    fontWeight: '900',
    color: COLORS.primary,
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: '500',
    marginTop: 4,
    textAlign: 'center',
  },
  historyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: COLORS.accentSoft,
  },
  historyButtonText: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.primary,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 24,
    padding: 20,
    marginVertical: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  cardTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.textMuted,
    letterSpacing: 1,
  },
  timeDisplayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  stepperButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeValueContainer: {
    alignItems: 'center',
  },
  timeNumber: {
    fontSize: 56,
    fontWeight: '900',
    color: COLORS.primary,
    lineHeight: 64,
  },
  timeUnit: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.textMuted,
    letterSpacing: 1.5,
    marginTop: -4,
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
    marginTop: 16,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: COLORS.surfaceSubtle,
  },
  chipActive: {
    backgroundColor: COLORS.primary,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  chipTextActive: {
    color: '#FFFFFF',
  },
  targetHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderColor: COLORS.border,
  },
  targetHintText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  gpsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.accentSoft,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 16,
    marginBottom: 16,
  },
  gpsButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.primary,
  },
  waitTypeRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  waitTypeCard: {
    flex: 1,
    padding: 14,
    borderRadius: 20,
    backgroundColor: COLORS.surface,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    gap: 4,
  },
  waitTypeCardActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  waitTypeTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginTop: 4,
  },
  waitTypeSubtitle: {
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  waitTypeTextActive: {
    color: '#FFFFFF',
  },
  simulateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  presetLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textMuted,
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  presetsList: {
    gap: 8,
  },
  presetItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  presetItemActive: {
    borderColor: COLORS.primary,
    backgroundColor: '#FAFDFB',
  },
  presetContent: {
    flex: 1,
  },
  presetName: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  presetNameActive: {
    color: COLORS.primary,
  },
  presetDescription: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  activeCheck: {
    marginLeft: 8,
  },
  settingsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  settingsHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  settingsHeaderText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  settingsToggleText: {
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: '700',
  },
  settingsBody: {
    backgroundColor: COLORS.surface,
    padding: 16,
    borderRadius: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  settingLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.textMuted,
    letterSpacing: 1,
    marginBottom: 8,
  },
  optionRow: {
    gap: 6,
  },
  optionPill: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: COLORS.surfaceSubtle,
    alignItems: 'center',
  },
  optionPillActive: {
    backgroundColor: COLORS.primaryLight,
  },
  optionPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  optionPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  primaryButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 18,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  buttonLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  disclaimerText: {
    fontSize: 11,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: 14,
    lineHeight: 16,
  },
});
