import { useEffect, useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Check, Clock3, Flag, Flame } from 'lucide-react-native';
import { UniversalMap } from '../src/components/UniversalMap';
import { AppText } from '../src/components/ui/AppText';
import { Button } from '../src/components/ui/Button';
import { CountUp } from '../src/components/ui/CountUp';
import { ProgressRing } from '../src/components/ui/ProgressRing';
import { useWalkStats, WEEKLY_GOAL } from '../src/history/stats';
import { todayKey, useTodaySteps } from '../src/profile/steps';
import { useWalkStore } from '../src/store/useWalkStore';
import { layout, motion, Palette, radius, shadows, spacing, type, useColors, useThemedStyles } from '../src/theme';
import { speak } from '../modules/walk-voice';
import { haptics } from '../src/utils/haptics';

type Outcome = 'on_time' | 'late' | 'ended';

const enter = (i: number) =>
  FadeInDown.duration(motion.slow).delay(250 + 80 * i).easing(motion.easeOutFn);

export default function SummaryScreen() {
  const c = useColors();
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();
  const {
    origin,
    generatedRoutes,
    selectedRouteIndex,
    activeState,
    startTime,
    elapsedSeconds,
    availableMinutes,
    remainingSeconds,
    distanceWalkedMeters,
    stepCount,
    resetWalk,
  } = useWalkStore();

  const route = generatedRoutes[selectedRouteIndex];
  const plannedSeconds = availableMinutes * 60;
  const outcome: Outcome =
    activeState !== 'completed' ? 'ended' : elapsedSeconds <= plannedSeconds ? 'on_time' : 'late';

  // Count this walk even if it has not reached the server yet.
  const thisWalk = useMemo(
    () =>
      startTime !== null && elapsedSeconds >= 30
        ? {
            startedAt: new Date(startTime).toISOString(),
            distanceMeters: Math.round(distanceWalkedMeters),
            steps: stepCount,
          }
        : null,
    [startTime, elapsedSeconds, distanceWalkedMeters, stepCount]
  );
  const stats = useWalkStats(thisWalk);
  const { steps: todaySteps } = useTodaySteps();
  const dailyStepGoal = useWalkStore((s) => s.dailyStepGoal);
  const stepsToday = todaySteps ?? stats?.todayWalkSteps ?? null;
  const goalReached = !!dailyStepGoal && stepsToday !== null && stepsToday >= dailyStepGoal;

  // The first time today's goal is crossed, make a moment of it.
  useEffect(() => {
    if (!goalReached) return;
    const state = useWalkStore.getState();
    const today = todayKey();
    if (state.goalCelebratedOn === today) return;
    state.markGoalCelebrated(today);
    haptics.success();
    if (state.voiceEnabled) speak("And that's your step goal for today.");
  }, [goalReached]);

  useEffect(() => {
    if (outcome === 'on_time') haptics.success();
    if (useWalkStore.getState().voiceEnabled) {
      speak(outcome === 'on_time' ? "You're back on time. Nice walk." : outcome === 'late' ? "You're back. Nice walk." : 'Walk saved.');
    }
  }, [outcome]);

  const handleDone = () => {
    haptics.tap();
    resetWalk();
    router.replace('/');
  };

  const minutes = Math.max(1, Math.round(elapsedSeconds / 60));
  const spare = Math.round(remainingSeconds / 60);
  const late = Math.max(1, Math.round((elapsedSeconds - plannedSeconds) / 60));

  const copy: Record<Outcome, { title: string; body: string }> = {
    on_time: {
      title: 'Back on time',
      body:
        spare >= 1
          ? `With ${spare} min to spare. That wait turned into a walk.`
          : 'Right on the minute. That wait turned into a walk.',
    },
    late: {
      title: 'You made it back',
      body: `${late} min later than planned. A bigger buffer in settings can help next time.`,
    },
    ended: {
      title: 'Walk saved',
      body: 'You ended early, and every minute on your feet still counts.',
    },
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <OutcomeBadge outcome={outcome} />
          <Animated.View entering={enter(0)} style={styles.heroText}>
            <AppText variant="largeTitle" style={styles.center}>
              {copy[outcome].title}
            </AppText>
            <AppText variant="subhead" style={styles.center}>
              {copy[outcome].body}
            </AppText>
          </Animated.View>
        </View>

        <Animated.View entering={enter(1)} style={styles.stats}>
          <Stat label="km">
            <CountUp value={distanceWalkedMeters / 1000} format="km" delay={400} style={[type.numberLarge, { color: c.ink }]} />
          </Stat>
          <View style={styles.divider} />
          <Stat label="steps">
            <CountUp value={stepCount} delay={480} style={[type.numberLarge, { color: c.ink }]} />
          </Stat>
          <View style={styles.divider} />
          <Stat label="min">
            <CountUp value={minutes} delay={560} style={[type.numberLarge, { color: c.ink }]} />
          </Stat>
        </Animated.View>

        {stats && (
          <Animated.View entering={enter(2)} style={styles.week}>
            {dailyStepGoal && stepsToday !== null ? (
              <ProgressRing
                progress={stepsToday / dailyStepGoal}
                size={64}
                strokeWidth={7}
                color={c.mint}
                trackColor={c.ringTrackOnForest}
                delay={700}
              >
                <AppText variant="footnote" color={c.onForest} style={styles.ringText}>
                  {Math.min(999, Math.round((stepsToday / dailyStepGoal) * 100))}%
                </AppText>
              </ProgressRing>
            ) : (
              <ProgressRing
                progress={stats.weekWalks / WEEKLY_GOAL}
                size={64}
                strokeWidth={7}
                color={c.mint}
                trackColor={c.ringTrackOnForest}
                delay={700}
              >
                <AppText variant="headline" color={c.onForest} style={styles.ringText}>
                  {Math.min(stats.weekWalks, 99)}/{WEEKLY_GOAL}
                </AppText>
              </ProgressRing>
            )}
            <View style={{ flex: 1, gap: spacing.xxs }}>
              <AppText variant="headline" color={c.onForest}>
                {dailyStepGoal && stepsToday !== null
                  ? goalReached
                    ? 'Daily step goal reached'
                    : `${(dailyStepGoal - stepsToday).toLocaleString()} steps to go today`
                  : stats.weekWalks >= WEEKLY_GOAL
                    ? 'Weekly goal reached'
                    : `${WEEKLY_GOAL - stats.weekWalks} more this week`}
              </AppText>
              <View style={styles.streakRow}>
                {stats.streakDays > 0 && <Flame size={14} color={c.mint} fill={c.mint} />}
                <AppText variant="footnote" color={c.onForestMuted} style={{ flexShrink: 1 }}>
                  {stats.streakDays > 1
                    ? `${stats.streakDays}-day streak. Walk tomorrow to make it ${stats.streakDays + 1}.`
                    : 'Walk again tomorrow to start a streak.'}
                </AppText>
              </View>
            </View>
          </Animated.View>
        )}

        {route && (
          <Animated.View entering={enter(3)} style={styles.mapWrap}>
            <UniversalMap origin={origin} routes={[route]} selectedRouteIndex={0} height={180} />
          </Animated.View>
        )}
      </ScrollView>

      <Animated.View entering={enter(4)} style={styles.footer}>
        <Button size="lg" title="Done" onPress={handleDone} />
      </Animated.View>
    </SafeAreaView>
  );
}

function OutcomeBadge({ outcome }: { outcome: Outcome }) {
  const c = useColors();
  const styles = useThemedStyles(makeStyles);
  const scale = useSharedValue(0.6);
  const opacity = useSharedValue(0);
  const iconScale = useSharedValue(0.4);

  useEffect(() => {
    opacity.value = withTiming(1, { duration: motion.base, easing: motion.easeOut });
    scale.value = withSpring(1, motion.springBouncy);
    iconScale.value = withDelay(120, withSpring(1, motion.springBouncy));
  }, [opacity, scale, iconScale]);

  const circleStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));
  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: iconScale.value }],
  }));

  const tone =
    outcome === 'on_time'
      ? { bg: c.mint, fg: c.forest, Icon: Check }
      : outcome === 'late'
        ? { bg: c.warningSoft, fg: c.warning, Icon: Clock3 }
        : { bg: c.surfaceMuted, fg: c.ink, Icon: Flag };

  return (
    <Animated.View style={[styles.badge, { backgroundColor: tone.bg }, circleStyle]}>
      <Animated.View style={iconStyle}>
        <tone.Icon size={44} color={tone.fg} strokeWidth={3} />
      </Animated.View>
    </Animated.View>
  );
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.stat}>
      {children}
      <AppText variant="caption">{label}</AppText>
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: c.background,
  },
  scroll: {
    padding: layout.screenPadding,
    gap: spacing.lg,
  },
  hero: {
    alignItems: 'center',
    gap: spacing.xl,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.sm,
  },
  heroText: {
    gap: spacing.sm,
    alignItems: 'center',
  },
  center: {
    textAlign: 'center',
  },
  badge: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stats: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xl,
    backgroundColor: c.surface,
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    ...shadows.card,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xxs,
  },
  divider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
    backgroundColor: c.separator,
  },
  week: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    padding: spacing.xl,
    backgroundColor: c.forest,
    borderRadius: radius.lg,
    borderCurve: 'continuous',
  },
  ringText: {
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  streakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  mapWrap: {
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  footer: {
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
});
