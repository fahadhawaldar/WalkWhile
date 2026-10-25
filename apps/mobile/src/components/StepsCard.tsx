import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { ChevronRight, Flame, Footprints, X } from 'lucide-react-native';
import { WalkStats } from '../history/stats';
import { suggestStepGoal } from '../profile/steps';
import { motion, Palette, radius, shadows, spacing, useColors, useThemedStyles } from '../theme';
import { haptics } from '../utils/haptics';
import { AppText } from './ui/AppText';
import { Button } from './ui/Button';
import { PressableScale } from './ui/PressableScale';
import { ProgressRing } from './ui/ProgressRing';

/**
 * Today's steps against the daily goal, the walker's reason to open the app
 * even when not waiting. `todaySteps` is null where the phone can't report
 * whole-day steps; then only WalkWhile walks count.
 */
export function StepsCard({
  stats,
  todaySteps,
  goal,
  onPress,
}: {
  stats: WalkStats | null;
  todaySteps: number | null;
  goal: number;
  onPress: () => void;
}) {
  const c = useColors();
  const styles = useThemedStyles(makeStyles);
  const steps = todaySteps ?? stats?.todayWalkSteps ?? 0;
  const reached = steps >= goal;
  const streak = stats?.streakDays ?? 0;
  const progress = steps / goal;

  const detailParts = [
    reached ? 'Goal reached today' : `${(goal - steps).toLocaleString()} to go`,
    todaySteps === null ? 'from your walks' : null,
    stats ? `${stats.weekWalks} ${stats.weekWalks === 1 ? 'walk' : 'walks'} this week` : null,
  ].filter(Boolean);

  return (
    <PressableScale
      onPress={onPress}
      pressedScale={0.98}
      style={styles.card}
      accessibilityLabel={`${steps} of ${goal} steps today. ${detailParts.join('. ')}`}
    >
      <ProgressRing progress={progress} size={56} strokeWidth={6} delay={300}>
        <AppText variant="caption" color={c.ink} style={styles.percent}>
          {Math.min(999, Math.round(progress * 100))}%
        </AppText>
      </ProgressRing>
      <View style={{ flex: 1, gap: 2 }}>
        <AppText variant="headline" style={styles.tabular}>
          {steps.toLocaleString()}
          <AppText variant="headline" color={c.inkTertiary}>
            {' '}/ {goal.toLocaleString()} steps
          </AppText>
        </AppText>
        <AppText variant="footnote">{detailParts.join(' · ')}</AppText>
      </View>
      {streak > 1 ? (
        <View style={styles.streak}>
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

/** One-time card that suggests a daily goal from the last week of steps. */
export function GoalPrompt({
  onSet,
  onDismiss,
  onAdjust,
}: {
  onSet: (goal: number) => void;
  onDismiss: () => void;
  onAdjust: (goal: number) => void;
}) {
  const c = useColors();
  const styles = useThemedStyles(makeStyles);
  const [loading, setLoading] = useState(false);
  const [suggestion, setSuggestion] = useState<{ goal: number; averageSteps: number | null } | null>(null);

  const suggest = async () => {
    haptics.tap();
    setLoading(true);
    setSuggestion(await suggestStepGoal());
    setLoading(false);
  };

  return (
    <View style={styles.prompt}>
      <PressableScale onPress={onDismiss} style={styles.close} hitSlop={10} accessibilityLabel="Not now">
        <X size={16} color={c.inkTertiary} />
      </PressableScale>
      <View style={styles.promptIcon}>
        <Footprints size={20} color={c.mintInk} />
      </View>
      {suggestion ? (
        <Animated.View entering={FadeIn.duration(motion.base)} style={styles.promptBody}>
          <AppText variant="headline">Aim for {suggestion.goal.toLocaleString()} steps a day?</AppText>
          <AppText variant="footnote">
            {suggestion.averageSteps !== null
              ? `You've averaged ${suggestion.averageSteps.toLocaleString()} a day this week. A little more is a good start.`
              : 'A gentle start. You can change it any time in settings.'}
          </AppText>
          <View style={styles.promptButtons}>
            <Button
              title="Set goal"
              style={{ flex: 1 }}
              onPress={() => {
                haptics.success();
                onSet(suggestion.goal);
              }}
            />
            <Button title="Adjust" variant="secondary" onPress={() => onAdjust(suggestion.goal)} />
          </View>
        </Animated.View>
      ) : (
        <View style={styles.promptBody}>
          <AppText variant="headline">Set a daily step goal</AppText>
          <AppText variant="footnote">
            We'll suggest one from your last week of steps, and show how each walk gets you closer.
          </AppText>
          <Button
            title="Suggest a goal"
            variant="tinted"
            loading={loading}
            onPress={suggest}
            style={{ marginTop: spacing.xs }}
          />
        </View>
      )}
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    padding: spacing.lg,
    backgroundColor: c.surface,
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    ...shadows.card,
  },
  percent: {
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  tabular: {
    fontVariant: ['tabular-nums'],
  },
  streak: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    backgroundColor: c.warningSoft,
  },
  prompt: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.lg,
    backgroundColor: c.surface,
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    ...shadows.card,
  },
  promptIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: c.mintSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  promptBody: {
    flex: 1,
    gap: spacing.xs,
    paddingRight: spacing.lg,
  },
  promptButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  close: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
});
