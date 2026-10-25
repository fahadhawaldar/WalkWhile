import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import {
  ArrowRight,
  ChevronRight,
  Flame,
  History,
  LocateFixed,
  LocateOff,
  Minus,
  Plus,
  SlidersHorizontal,
} from 'lucide-react-native';
import { DEFAULTS } from '@walkwhile/shared';
import { WalkWhileApiClient } from '../src/api/client';
import { AppText } from '../src/components/ui/AppText';
import { Button } from '../src/components/ui/Button';
import { PressableScale } from '../src/components/ui/PressableScale';
import { ProgressRing } from '../src/components/ui/ProgressRing';
import { SegmentedControl } from '../src/components/ui/SegmentedControl';
import { GoalPrompt, StepsCard } from '../src/components/StepsCard';
import { useWalkStats, WEEKLY_GOAL } from '../src/history/stats';
import { DEFAULT_STRIDE_METERS } from '../src/profile/pace';
import { useTodaySteps } from '../src/profile/steps';
import { useWalkStore } from '../src/store/useWalkStore';
import { layout, motion, Palette, radius, shadows, spacing, type, useColors, useThemedStyles } from '../src/theme';
import { haptics } from '../src/utils/haptics';
import { formatDistance, getCurrentLocation } from '../src/utils/location';

const QUICK_MINUTES = [5, 10, 15, 20, 30, 45];
const MIN_MINUTES = DEFAULTS.MIN_AVAILABLE_MINUTES;
const MAX_MINUTES = DEFAULTS.MAX_AVAILABLE_MINUTES;
// Holding +/- repeats after this delay, at this rate.
const REPEAT_DELAY_MS = 350;
const REPEAT_EVERY_MS = 90;

function greeting(now = new Date()): string {
  const h = now.getHours();
  if (h < 5) return 'Still up?';
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

const enter = (i: number) =>
  FadeInDown.duration(motion.slow).delay(60 * i).easing(motion.easeOutFn);

export default function HomeScreen() {
  const c = useColors();
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();
  const {
    origin,
    originSource,
    setOrigin,
    availableMinutes,
    setAvailableMinutes,
    walkingSpeedKmh,
    safetyBufferMinutes,
    setGeneratedRoutes,
    waitType,
    setWaitType,
    maxReturnMinutes,
    dailyStepGoal,
    goalPromptDismissed,
    setDailyStepGoal,
    dismissGoalPrompt,
    learned,
  } = useWalkStore();
  const stats = useWalkStats();
  const { steps: todaySteps, refresh: refreshSteps } = useTodaySteps();

  const [locating, setLocating] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const locate = async () => {
    setLocating(true);
    const loc = await getCurrentLocation();
    setLocating(false);
    if (loc) setOrigin(loc, 'gps');
  };

  // You are standing where the walk starts, so locate right away.
  useEffect(() => {
    locate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Without a GPS fix the origin is only a placeholder; developers may use
  // the preset test locations instead.
  const hasLocation =
    originSource === 'gps' || originSource === 'preset' || (__DEV__ && !locating);

  const budgetMinutes = Math.max(0, availableMinutes - safetyBufferMinutes);
  const targetMeters = Math.round((walkingSpeedKmh * 1000 * budgetMinutes) / 60);
  const walkSteps = Math.round(targetMeters / (learned.strideMeters ?? DEFAULT_STRIDE_METERS));
  const stepsSoFar = todaySteps ?? stats?.todayWalkSteps ?? null;
  let stepsHint: string | null = null;
  if (dailyStepGoal && stepsSoFar !== null && stepsSoFar < dailyStepGoal) {
    const after = stepsSoFar + walkSteps;
    stepsHint =
      after >= dailyStepGoal
        ? `≈ ${walkSteps.toLocaleString()} steps · finishes today's goal`
        : `≈ ${walkSteps.toLocaleString()} steps · gets you to ${Math.round((after / dailyStepGoal) * 100)}% of today's goal`;
  } else if (walkSteps > 0) {
    stepsHint = `≈ ${walkSteps.toLocaleString()} steps`;
  }

  const setMinutes = (m: number) => {
    const next = Math.min(MAX_MINUTES, Math.max(MIN_MINUTES, m));
    if (next === useWalkStore.getState().availableMinutes) return;
    haptics.selection();
    setAvailableMinutes(next);
    setError(null);
  };

  const handleFind = async () => {
    haptics.tap();
    setError(null);
    setGenerating(true);
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
        haptics.error();
        setError(
          response.message ||
            "No walkable loop fits that time here. Try a few more minutes."
        );
        return;
      }
      setGeneratedRoutes(response.routes);
      router.push('/routes');
    } catch {
      haptics.error();
      setError("Couldn't reach WalkWhile. Check your connection and try again.");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* Header */}
        <Animated.View entering={enter(0)} style={styles.header}>
          <View style={{ flex: 1 }}>
            <AppText variant="footnote">{greeting()}</AppText>
            <AppText variant="largeTitle">Walk while{'\n'}you wait</AppText>
          </View>
          <PressableScale
            onPress={() => router.push('/history')}
            style={styles.iconButton}
            accessibilityLabel="Your walks"
            hitSlop={8}
          >
            <History size={20} color={c.ink} strokeWidth={2.2} />
          </PressableScale>
        </Animated.View>

        {/* This week: the reason to come back */}
        <Animated.View entering={enter(1)}>
          {dailyStepGoal ? (
            <StepsCard
              stats={stats}
              todaySteps={todaySteps}
              goal={dailyStepGoal}
              onPress={() => router.push('/history')}
            />
          ) : !goalPromptDismissed ? (
            <GoalPrompt
              onSet={(goal) => {
                setDailyStepGoal(goal);
                refreshSteps();
              }}
              onAdjust={(goal) => {
                setDailyStepGoal(goal);
                refreshSteps();
                router.push('/settings');
              }}
              onDismiss={dismissGoalPrompt}
            />
          ) : (
            <MomentumCard stats={stats} onPress={() => router.push('/history')} />
          )}
        </Animated.View>

        {/* Time */}
        <Animated.View entering={enter(2)} style={styles.timeCard}>
          <AppText variant="footnote" style={styles.cardLabel}>
            How long do you have?
          </AppText>

          <View style={styles.timeRow}>
            <StepButton
              icon="minus"
              disabled={availableMinutes <= MIN_MINUTES}
              onStep={() => setMinutes(useWalkStore.getState().availableMinutes - 1)}
            />
            <TickingMinutes value={availableMinutes} />
            <StepButton
              icon="plus"
              disabled={availableMinutes >= MAX_MINUTES}
              onStep={() => setMinutes(useWalkStore.getState().availableMinutes + 1)}
            />
          </View>

          <View style={styles.chips}>
            {QUICK_MINUTES.map((m) => (
              <Chip key={m} label={`${m}`} selected={availableMinutes === m} onPress={() => setMinutes(m)} />
            ))}
          </View>
        </Animated.View>

        {/* Wait type */}
        <Animated.View entering={enter(3)} style={styles.waitBlock}>
          <SegmentedControl
            accessibilityLabel="What are you waiting for?"
            segments={[
              { value: 'fixed', label: 'Exact time' },
              { value: 'flexible', label: "Someone's coming" },
            ]}
            value={waitType}
            onChange={setWaitType}
          />
          <Animated.View key={waitType} entering={FadeIn.duration(motion.base)}>
            <AppText variant="subhead" style={styles.waitHint}>
              {waitType === 'fixed'
                ? `A ~${formatDistance(targetMeters)} loop that gets you back ${safetyBufferMinutes} min early.`
                : `Small loops that never take you more than ~${maxReturnMinutes} min from your spot.`}
            </AppText>
            {stepsHint && (
              <AppText variant="footnote" color={c.mintInk} style={styles.stepsHint}>
                {stepsHint}
              </AppText>
            )}
          </Animated.View>
        </Animated.View>
      </ScrollView>

      {/* Pinned bottom: where, how, go */}
      <Animated.View entering={enter(4)} style={styles.footer}>
        <View style={styles.metaRow}>
          <LocationPill
            locating={locating}
            source={originSource}
            onRetry={locate}
          />
          <PressableScale
            style={styles.metaPill}
            onPress={() => router.push('/settings')}
            accessibilityLabel="Walk settings"
            accessibilityHint="Change walking pace and safety buffer"
          >
            <SlidersHorizontal size={15} color={c.inkSecondary} />
            <AppText variant="footnote">{walkingSpeedKmh} km/h</AppText>
          </PressableScale>
        </View>

        {error && (
          <Animated.View entering={FadeIn.duration(motion.base)}>
            <AppText variant="footnote" color={c.urgent} style={styles.error}>
              {error}
            </AppText>
          </Animated.View>
        )}

        <Button
          size="lg"
          title={hasLocation ? 'Find my walk' : 'Finding you…'}
          loading={generating}
          loadingTitle="Finding loops near you…"
          disabled={!hasLocation}
          onPress={handleFind}
          icon={hasLocation ? <ArrowRight size={20} color={c.onForest} strokeWidth={2.5} /> : null}
        />
        {__DEV__ && originSource === 'default' && !locating && (
          <AppText variant="caption" style={styles.devNote}>
            Dev: no GPS fix, using {origin.latitude.toFixed(3)}, {origin.longitude.toFixed(3)}
          </AppText>
        )}
      </Animated.View>
    </SafeAreaView>
  );
}

/** The big minutes number; nudges up or down as it changes. */
function TickingMinutes({ value }: { value: number }) {
  const c = useColors();
  const styles = useThemedStyles(makeStyles);
  const previous = useRef(value);
  const offset = useSharedValue(0);
  const opacity = useSharedValue(1);

  useEffect(() => {
    if (value === previous.current) return;
    const direction = value > previous.current ? 1 : -1;
    previous.current = value;
    offset.value = withSequence(
      withTiming(direction * 10, { duration: 0 }),
      withTiming(0, { duration: motion.fast, easing: motion.easeOut })
    );
    opacity.value = withSequence(
      withTiming(0.35, { duration: 0 }),
      withTiming(1, { duration: motion.fast, easing: motion.easeOut })
    );
  }, [value, offset, opacity]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: offset.value }],
  }));

  return (
    <View
      style={styles.timeValue}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={`${value} minutes`}
    >
      <Animated.Text style={[type.display, { color: c.ink }, style]}>{value}</Animated.Text>
      <AppText variant="headline" color={c.inkSecondary} style={styles.timeUnit}>
        min
      </AppText>
    </View>
  );
}

function StepButton({
  icon,
  disabled,
  onStep,
}: {
  icon: 'plus' | 'minus';
  disabled: boolean;
  onStep: () => void;
}) {
  const c = useColors();
  const styles = useThemedStyles(makeStyles);
  const repeat = useRef<ReturnType<typeof setInterval> | null>(null);
  const stop = () => {
    if (repeat.current) clearInterval(repeat.current);
    repeat.current = null;
  };
  useEffect(() => stop, []);

  const Icon = icon === 'plus' ? Plus : Minus;
  return (
    <PressableScale
      style={[styles.stepButton, disabled && styles.stepDisabled]}
      pressedScale={0.92}
      disabled={disabled}
      onPress={onStep}
      delayLongPress={REPEAT_DELAY_MS}
      onLongPress={() => {
        stop();
        repeat.current = setInterval(onStep, REPEAT_EVERY_MS);
      }}
      onPressOut={stop}
      accessibilityLabel={icon === 'plus' ? 'One more minute' : 'One minute less'}
      hitSlop={6}
    >
      <Icon size={22} color={c.ink} strokeWidth={2.4} />
    </PressableScale>
  );
}

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const c = useColors();
  const styles = useThemedStyles(makeStyles);
  return (
    <PressableScale
      onPress={onPress}
      pressedScale={0.94}
      style={[styles.chip, selected && styles.chipSelected]}
      accessibilityLabel={`${label} minutes`}
      accessibilityState={{ selected }}
    >
      <AppText variant="callout" color={selected ? c.onForest : c.ink} style={styles.chipText}>
        {label}
      </AppText>
    </PressableScale>
  );
}

function MomentumCard({
  stats,
  onPress,
}: {
  stats: ReturnType<typeof useWalkStats>;
  onPress: () => void;
}) {
  const c = useColors();
  const styles = useThemedStyles(makeStyles);
  const walks = stats?.weekWalks ?? 0;
  const streak = stats?.streakDays ?? 0;

  let headline: string;
  let detail: string;
  if (!stats) {
    headline = 'This week';
    detail = ' ';
  } else if (stats.totalWalks === 0) {
    headline = 'Your first walk is waiting';
    detail = 'Start one now. Even 5 minutes counts.';
  } else if (walks >= WEEKLY_GOAL) {
    headline = 'Weekly goal reached';
    detail = `${walks} walks this week. Keep it rolling.`;
  } else {
    headline = `${walks} of ${WEEKLY_GOAL} walks this week`;
    detail =
      streak > 0
        ? stats.walkedToday
          ? `${streak}-day streak. Nicely done today.`
          : `${streak}-day streak. Walk today to keep it.`
        : `${WEEKLY_GOAL - walks} more to hit your weekly goal.`;
  }

  return (
    <PressableScale onPress={onPress} pressedScale={0.98} style={styles.momentum} accessibilityLabel={`${headline}. ${detail}`}>
      <ProgressRing progress={walks / WEEKLY_GOAL} size={52} strokeWidth={6} delay={300}>
        <AppText variant="callout" style={styles.ringText}>
          {walks}
        </AppText>
      </ProgressRing>
      <View style={{ flex: 1, gap: 2 }}>
        <AppText variant="headline">{headline}</AppText>
        <AppText variant="footnote">{detail}</AppText>
      </View>
      {streak > 1 ? (
        <View style={styles.streakBadge}>
          <Flame size={14} color={c.warning} fill={c.warning} />
          <AppText variant="footnote" color={c.warning} style={{ fontWeight: '700' }}>
            {streak}
          </AppText>
        </View>
      ) : (
        <ChevronRight size={18} color={c.inkTertiary} />
      )}
    </PressableScale>
  );
}

function LocationPill({
  locating,
  source,
  onRetry,
}: {
  locating: boolean;
  source: 'gps' | 'preset' | 'default';
  onRetry: () => void;
}) {
  const c = useColors();
  const styles = useThemedStyles(makeStyles);
  const label = locating
    ? 'Locating…'
    : source === 'gps'
      ? 'Starting here'
      : source === 'preset'
        ? 'Test location'
        : 'Location off · retry';
  const ok = !locating && source !== 'default';
  return (
    <Pressable
      onPress={onRetry}
      disabled={locating}
      style={({ pressed }) => [styles.metaPill, pressed && { opacity: 0.6 }]}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint="Find your current location again"
    >
      {ok ? (
        <View style={styles.liveDot} />
      ) : locating ? (
        <LocateFixed size={15} color={c.inkSecondary} />
      ) : (
        <LocateOff size={15} color={c.urgent} />
      )}
      <AppText variant="footnote" color={source === 'default' && !locating ? c.urgent : undefined}>
        {label}
      </AppText>
    </Pressable>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: c.background,
  },
  scroll: {
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    marginBottom: spacing.xs,
  },
  iconButton: {
    width: layout.minTouch,
    height: layout.minTouch,
    borderRadius: radius.full,
    backgroundColor: c.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.card,
  },
  momentum: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    padding: spacing.lg,
    backgroundColor: c.surface,
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    ...shadows.card,
  },
  ringText: {
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    backgroundColor: c.warningSoft,
  },
  timeCard: {
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    backgroundColor: c.surface,
    borderRadius: radius.xl,
    borderCurve: 'continuous',
    gap: spacing.lg,
    ...shadows.card,
  },
  cardLabel: {
    textAlign: 'center',
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  timeValue: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.xs,
  },
  timeUnit: {
    marginLeft: spacing.xxs,
  },
  stepButton: {
    width: 52,
    height: 52,
    borderRadius: radius.full,
    backgroundColor: c.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDisabled: {
    opacity: 0.35,
  },
  chips: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.xs,
  },
  chip: {
    flex: 1,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: c.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipSelected: {
    backgroundColor: c.forest,
  },
  chipText: {
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  waitBlock: {
    gap: spacing.md,
  },
  waitHint: {
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
  },
  stepsHint: {
    textAlign: 'center',
    marginTop: spacing.xs,
    fontWeight: '600',
  },
  footer: {
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    gap: spacing.md,
    backgroundColor: c.background,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 36,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    backgroundColor: c.surfaceMuted,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: c.mint,
  },
  error: {
    textAlign: 'center',
  },
  devNote: {
    textAlign: 'center',
  },
});
