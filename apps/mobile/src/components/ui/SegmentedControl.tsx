import { useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { motion, Palette, radius, shadows, spacing, useColors, useThemedStyles } from '../../theme';
import { haptics } from '../../utils/haptics';
import { AppText } from './AppText';

interface Segment<T> {
  value: T;
  label: string;
}

/**
 * Two to four peers with a white thumb that glides to the chosen one.
 */
export function SegmentedControl<T extends string | number>({
  segments,
  value,
  onChange,
  accessibilityLabel,
}: {
  segments: Segment<T>[];
  value: T;
  onChange: (value: T) => void;
  accessibilityLabel?: string;
}) {
  const c = useColors();
  const styles = useThemedStyles(makeStyles);
  const [width, setWidth] = useState(0);
  const index = Math.max(0, segments.findIndex((s) => s.value === value));
  const segmentWidth = width > 0 ? (width - PADDING * 2) / segments.length : 0;

  const thumbStyle = useAnimatedStyle(() => ({
    width: segmentWidth,
    transform: [
      {
        translateX: withTiming(index * segmentWidth, {
          duration: motion.base,
          easing: motion.easeOut,
        }),
      },
    ],
  }));

  return (
    <View
      style={styles.track}
      onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
    >
      {segmentWidth > 0 && <Animated.View style={[styles.thumb, thumbStyle]} />}
      {segments.map((segment) => {
        const selected = segment.value === value;
        return (
          <Pressable
            key={String(segment.value)}
            style={styles.segment}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => {
              if (selected) return;
              haptics.selection();
              onChange(segment.value);
            }}
          >
            <AppText variant="footnote" color={selected ? c.ink : c.inkSecondary} style={styles.label}>
              {segment.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const PADDING = 3;

const makeStyles = (c: Palette) =>
  StyleSheet.create({
  track: {
    flexDirection: 'row',
    backgroundColor: c.surfaceMuted,
    borderRadius: radius.md,
    borderCurve: 'continuous',
    padding: PADDING,
  },
  thumb: {
    position: 'absolute',
    top: PADDING,
    bottom: PADDING,
    left: PADDING,
    backgroundColor: c.segmentThumb,
    borderRadius: radius.md - PADDING,
    borderCurve: 'continuous',
    ...shadows.card,
  },
  segment: {
    flex: 1,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  label: {
    fontWeight: '600',
  },
});
