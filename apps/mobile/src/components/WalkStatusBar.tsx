import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { CloudOff } from 'lucide-react-native';
import { ReturnRouteStatus } from '@walkwhile/shared';
import { motion, Palette, radius, shadows, spacing, useColors, useThemedStyles } from '../theme';
import { AppText } from './ui/AppText';

interface WalkStatusBarProps {
  remainingSeconds: number;
  status: ReturnRouteStatus;
  message: string;
  /** Wall-clock time the wait ends. */
  backBy: Date | null;
  /** Minutes the walk back takes from here, once the server has said. */
  returnMinutes: number | null;
  /** The return estimate is old (no signal), so only the timer is reliable. */
  stale: boolean;
  returning: boolean;
}

// Ordered by how worried the walker should be.
const statusConfig = (
  c: Palette
): Record<ReturnRouteStatus, { label: string; tint: string; soft: string }> => ({
  safe: { label: 'On track', tint: c.safe, soft: c.surface },
  warning: { label: 'Start heading back', tint: c.warning, soft: c.warningSoft },
  urgent: { label: 'Head back now', tint: c.urgent, soft: c.urgentSoft },
  overdue: { label: 'Running late', tint: c.overdue, soft: c.overdueSoft },
});

function clock(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * The walk's one important number, floating over the map: time left, with
 * the return status as a colour the walker can read at a glance.
 */
export function WalkStatusBar({
  remainingSeconds,
  status,
  message,
  backBy,
  returnMinutes,
  stale,
  returning,
}: WalkStatusBarProps) {
  const c = useColors();
  const styles = useThemedStyles(makeStyles);
  const STATUS = statusConfig(c);
  const config = STATUS[status] ?? STATUS.safe;
  const calm = status === 'safe';

  const cardStyle = useAnimatedStyle(() => ({
    backgroundColor: withTiming(config.soft, { duration: motion.slow }),
  }));

  // The dot breathes while the walker needs to act.
  const pulse = useSharedValue(1);
  useEffect(() => {
    if (calm) {
      cancelAnimation(pulse);
      pulse.value = withTiming(1, { duration: motion.fast });
    } else {
      pulse.value = withRepeat(
        withSequence(
          withTiming(1.6, { duration: 700, easing: motion.easeOut }),
          withTiming(1, { duration: 700, easing: motion.easeOut })
        ),
        -1
      );
    }
  }, [calm, pulse]);
  const haloStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
    opacity: 2 - pulse.value - 0.4,
  }));

  const backByText = backBy
    ? backBy.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
    : null;

  let detail: string | null = null;
  if (!calm && message) detail = message;
  else if (returning && returnMinutes !== null) detail = `About ${returnMinutes} min to your spot`;
  else if (returnMinutes !== null) detail = `${returnMinutes} min walk back from here`;

  return (
    <Animated.View
      style={[styles.card, cardStyle]}
      accessible
      accessibilityRole="summary"
      accessibilityLabel={`${config.label}. ${Math.floor(remainingSeconds / 60)} minutes ${remainingSeconds % 60} seconds left.${detail ? ` ${detail}` : ''}`}
      accessibilityLiveRegion="polite"
    >
      <View style={styles.topRow}>
        <View style={styles.status}>
          <View style={styles.dotWrap}>
            <Animated.View style={[styles.halo, { backgroundColor: config.tint }, haloStyle]} />
            <View style={[styles.dot, { backgroundColor: config.tint }]} />
          </View>
          <AppText variant="footnote" color={config.tint} style={styles.statusText}>
            {returning && calm ? 'Heading back' : config.label}
          </AppText>
        </View>
        {backByText && <AppText variant="caption">Back by {backByText}</AppText>}
      </View>

      <View style={styles.timeRow}>
        <AppText variant="numberLarge" color={calm ? c.ink : config.tint}>
          {clock(remainingSeconds)}
        </AppText>
        <AppText variant="footnote">left</AppText>
      </View>

      {detail && (
        <Animated.View key={detail} entering={FadeIn.duration(motion.base)}>
          <AppText variant="footnote" color={calm ? c.inkSecondary : config.tint}>
            {detail}
          </AppText>
        </Animated.View>
      )}

      {stale && (
        <View style={styles.stale}>
          <CloudOff size={13} color={c.inkTertiary} />
          <AppText variant="caption">No signal. Trust the timer.</AppText>
        </View>
      )}
    </Animated.View>
  );
}

const makeStyles = (_c: Palette) =>
  StyleSheet.create({
  card: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    gap: spacing.xxs,
    ...shadows.raised,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  statusText: {
    fontWeight: '700',
  },
  dotWrap: {
    width: 10,
    height: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  halo: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
  },
  stale: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xxs,
  },
});
