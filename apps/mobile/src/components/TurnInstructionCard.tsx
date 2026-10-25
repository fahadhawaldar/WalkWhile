import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Flag,
  Footprints,
  Navigation,
  RotateCcw,
} from 'lucide-react-native';
import { RouteStep } from '@walkwhile/shared';
import { motion, Palette, radius, spacing, useColors, useThemedStyles } from '../theme';
import { formatDistance } from '../utils/location';
import { AppText } from './ui/AppText';

interface TurnInstructionCardProps {
  step?: RouteStep;
  nextStep?: RouteStep;
  totalDistanceMeters?: number;
  walkedDistanceMeters?: number;
  stepCount?: number;
}

function StepIcon({ instruction }: { instruction: string }) {
  const c = useColors();
  const lower = instruction.toLowerCase();
  const props = { size: 22, color: c.onForest, strokeWidth: 2.5 };
  if (lower.includes('left')) return <ArrowLeft {...props} />;
  if (lower.includes('right')) return <ArrowRight {...props} />;
  if (lower.includes('turn around') || lower.includes('back')) return <RotateCcw {...props} />;
  if (lower.includes('arrive') || lower.includes('starting point')) return <Flag {...props} />;
  return <ArrowUp {...props} />;
}

/** Next turn, then a thin progress line with distance and steps. */
export function TurnInstructionCard({
  step,
  nextStep,
  totalDistanceMeters,
  walkedDistanceMeters,
  stepCount,
}: TurnInstructionCardProps) {
  const c = useColors();
  const styles = useThemedStyles(makeStyles);
  const [trackWidth, setTrackWidth] = useState(0);
  const progress =
    totalDistanceMeters !== undefined && walkedDistanceMeters !== undefined
      ? Math.min(1, walkedDistanceMeters / Math.max(1, totalDistanceMeters))
      : null;

  // The fill is absolutely positioned and childless, so animating its width
  // never re-lays-out anything else.
  const fillStyle = useAnimatedStyle(() => ({
    width: withTiming((progress ?? 0) * trackWidth, { duration: motion.slow, easing: motion.easeOut }),
  }));

  return (
    <View style={styles.container}>
      <Animated.View key={step?.instruction ?? 'none'} entering={FadeIn.duration(motion.base)} style={styles.mainRow}>
        <View style={styles.icon}>
          {step ? <StepIcon instruction={step.instruction} /> : <Navigation size={22} color={c.onForest} />}
        </View>
        <View style={styles.content}>
          {step ? (
            <>
              <AppText variant="number">{formatDistance(step.distanceMeters)}</AppText>
              <AppText variant="callout" numberOfLines={2}>
                {step.instruction}
              </AppText>
            </>
          ) : (
            <>
              <AppText variant="headline">Follow the line</AppText>
              <AppText variant="footnote">It brings you back to your spot.</AppText>
            </>
          )}
        </View>
      </Animated.View>

      {nextStep && (
        <AppText variant="caption" numberOfLines={1} style={styles.next}>
          Then {nextStep.instruction.charAt(0).toLowerCase() + nextStep.instruction.slice(1)}
        </AppText>
      )}

      {progress !== null && (
        <View style={styles.progress}>
          <View style={styles.track} onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}>
            <Animated.View style={[styles.fill, fillStyle]} />
          </View>
          <View style={styles.progressRow}>
            <AppText variant="caption">
              {formatDistance(walkedDistanceMeters ?? 0)} of {formatDistance(totalDistanceMeters ?? 0)}
            </AppText>
            {!!stepCount && (
              <View style={styles.steps}>
                <Footprints size={12} color={c.inkTertiary} />
                <AppText variant="caption">{stepCount.toLocaleString()} steps</AppText>
              </View>
            )}
          </View>
        </View>
      )}
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
  container: {
    padding: spacing.lg,
    gap: spacing.md,
    backgroundColor: c.surface,
    borderRadius: radius.lg,
    borderCurve: 'continuous',
  },
  mainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  icon: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    borderCurve: 'continuous',
    backgroundColor: c.forest,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
  },
  next: {
    marginTop: -spacing.xs,
    marginLeft: 48 + spacing.md,
  },
  progress: {
    gap: spacing.xs,
  },
  track: {
    height: 4,
    borderRadius: 2,
    backgroundColor: c.surfaceMuted,
    overflow: 'hidden',
  },
  fill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 2,
    backgroundColor: c.mint,
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  steps: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
});
