import { Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Check, Minus, Plus } from 'lucide-react-native';
import { AppText } from '../src/components/ui/AppText';
import { Button } from '../src/components/ui/Button';
import { PressableScale } from '../src/components/ui/PressableScale';
import { SegmentedControl } from '../src/components/ui/SegmentedControl';
import { useWalkStore } from '../src/store/useWalkStore';
import { layout, Palette, radius, spacing, useColors, useThemedStyles } from '../src/theme';
import { WALKS_TO_LEARN } from '../src/profile/pace';
import { clampGoal, GOAL_INCREMENT } from '../src/profile/steps';
import { haptics } from '../src/utils/haptics';
import { PRESET_LOCATIONS } from '../src/utils/location';

const PACES = [
  { value: 'auto', label: 'Auto' },
  { value: '3.5', label: 'Relaxed' },
  { value: '5', label: 'Steady' },
  { value: '6.5', label: 'Brisk' },
];
const BUFFERS = [
  { value: 1.5, label: '1.5 min' },
  { value: 2.5, label: '2.5 min' },
  { value: 5.0, label: '5 min' },
];

export default function SettingsSheet() {
  const c = useColors();
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();
  const {
    walkingSpeedKmh,
    paceMode,
    setPace,
    learned,
    dailyStepGoal,
    setDailyStepGoal,
    safetyBufferMinutes,
    setSafetyBufferMinutes,
    origin,
    originSource,
    setOrigin,
    simulateWalk,
    setSimulateWalk,
    voiceEnabled,
    setVoiceEnabled,
    appearance,
    setAppearance,
  } = useWalkStore();

  return (
    <ScrollView contentContainerStyle={styles.content} bounces={false}>
      <AppText variant="title">Walk settings</AppText>

      <View style={styles.section}>
        <AppText variant="headline">Your pace</AppText>
        <AppText variant="subhead">Routes are sized to how fast you walk.</AppText>
        <SegmentedControl
          segments={PACES}
          value={paceMode === 'auto' ? 'auto' : String(walkingSpeedKmh)}
          onChange={(v) => (v === 'auto' ? setPace('auto') : setPace('manual', Number(v)))}
        />
        <AppText variant="caption">
          {paceMode === 'manual'
            ? `${walkingSpeedKmh} km/h`
            : learned.paceKmh !== null
              ? `${learned.paceKmh} km/h, learned from your last ${learned.paceWalks} walks`
              : `Using ${walkingSpeedKmh} km/h until you've finished ${WALKS_TO_LEARN} walks (${learned.paceWalks} so far)`}
        </AppText>
      </View>

      <View style={styles.section}>
        <AppText variant="headline">Daily step goal</AppText>
        <AppText variant="subhead">All your steps today count, not just walks.</AppText>
        {dailyStepGoal ? (
          <View style={styles.stepper}>
            <PressableScale
              style={styles.stepButton}
              pressedScale={0.92}
              disabled={dailyStepGoal <= clampGoal(0)}
              onPress={() => {
                haptics.selection();
                setDailyStepGoal(clampGoal(dailyStepGoal - GOAL_INCREMENT));
              }}
              accessibilityLabel="Lower goal"
            >
              <Minus size={18} color={c.ink} strokeWidth={2.4} />
            </PressableScale>
            <AppText variant="number" style={{ flex: 1, textAlign: 'center' }}>
              {dailyStepGoal.toLocaleString()}
            </AppText>
            <PressableScale
              style={styles.stepButton}
              pressedScale={0.92}
              disabled={dailyStepGoal >= clampGoal(Infinity)}
              onPress={() => {
                haptics.selection();
                setDailyStepGoal(clampGoal(dailyStepGoal + GOAL_INCREMENT));
              }}
              accessibilityLabel="Raise goal"
            >
              <Plus size={18} color={c.ink} strokeWidth={2.4} />
            </PressableScale>
          </View>
        ) : (
          <Button
            title="Set a goal"
            variant="tinted"
            onPress={() => {
              haptics.selection();
              setDailyStepGoal(6000);
            }}
          />
        )}
      </View>

      <View style={styles.section}>
        <AppText variant="headline">Back early by</AppText>
        <AppText variant="subhead">
          A cushion so a red light or a slow block never makes you late.
        </AppText>
        <SegmentedControl segments={BUFFERS} value={safetyBufferMinutes} onChange={setSafetyBufferMinutes} />
      </View>

      <View style={styles.toggleRow}>
        <View style={{ flex: 1, gap: spacing.xxs }}>
          <AppText variant="headline">Voice guidance</AppText>
          <AppText variant="subhead">
            Turns, time checks and when to head back, spoken with your phone in your pocket.
          </AppText>
        </View>
        <Switch value={voiceEnabled} onValueChange={setVoiceEnabled} trackColor={{ true: c.forest }} />
      </View>

      <View style={styles.section}>
        <AppText variant="headline">Appearance</AppText>
        <SegmentedControl
          segments={[
            { value: 'system', label: 'System' },
            { value: 'light', label: 'Light' },
            { value: 'dark', label: 'Dark' },
          ]}
          value={appearance}
          onChange={setAppearance}
        />
      </View>

      {__DEV__ && (
        <View style={styles.section}>
          <AppText variant="headline">Developer</AppText>
          <View style={styles.group}>
            {PRESET_LOCATIONS.map((preset, i) => {
              const selected =
                originSource === 'preset' &&
                Math.abs(origin.latitude - preset.coordinate.latitude) < 0.0001 &&
                Math.abs(origin.longitude - preset.coordinate.longitude) < 0.0001;
              return (
                <Pressable
                  key={preset.id}
                  onPress={() => {
                    haptics.selection();
                    setOrigin(preset.coordinate, 'preset');
                  }}
                  style={({ pressed }) => [
                    styles.row,
                    i > 0 && styles.rowDivider,
                    pressed && { backgroundColor: c.surfaceMuted },
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                >
                  <View style={{ flex: 1 }}>
                    <AppText variant="callout">{preset.name}</AppText>
                    <AppText variant="caption" numberOfLines={1}>
                      {preset.description}
                    </AppText>
                  </View>
                  {selected && <Check size={18} color={c.mintInk} strokeWidth={2.5} />}
                </Pressable>
              );
            })}
            <View style={[styles.row, styles.rowDivider]}>
              <AppText variant="callout" style={{ flex: 1 }}>
                Simulate walking
              </AppText>
              <Switch value={simulateWalk} onValueChange={setSimulateWalk} />
            </View>
          </View>
        </View>
      )}

      <Button title="Done" variant="secondary" onPress={() => router.back()} />
    </ScrollView>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
  content: {
    padding: layout.screenPadding,
    paddingTop: spacing.xxl,
    gap: spacing.xxl,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.xs,
    borderRadius: radius.md,
    borderCurve: 'continuous',
    backgroundColor: c.background,
  },
  stepButton: {
    width: layout.minTouch,
    height: layout.minTouch,
    borderRadius: radius.full,
    backgroundColor: c.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  section: {
    gap: spacing.sm,
  },
  group: {
    marginTop: spacing.xs,
    borderRadius: radius.md,
    borderCurve: 'continuous',
    backgroundColor: c.background,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: layout.minTouch,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  rowDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.separator,
  },
});
