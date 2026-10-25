import { ReactNode, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import Animated, {
  useAnimatedProps,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { motion, Palette, useColors, useThemedStyles } from '../../theme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/** A ring that fills to `progress` (0–1), animating whenever it changes. */
export function ProgressRing({
  progress,
  size = 56,
  strokeWidth = 6,
  color,
  trackColor,
  delay = 0,
  children,
}: {
  progress: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  trackColor?: string;
  delay?: number;
  children?: ReactNode;
}) {
  const c = useColors();
  const styles = useThemedStyles(makeStyles);
  const stroke = color ?? c.mint;
  const track = trackColor ?? c.surfaceMuted;
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;
  const fill = useSharedValue(0);

  useEffect(() => {
    fill.value = withDelay(
      delay,
      withTiming(Math.min(1, Math.max(0, progress)), { duration: 800, easing: motion.easeOut })
    );
  }, [progress, delay, fill]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - fill.value),
  }));

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={strokeWidth} fill="none" />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          animatedProps={animatedProps}
        />
      </Svg>
      {children ? <View style={[StyleSheet.absoluteFill, styles.center]}>{children}</View> : null}
    </View>
  );
}

const makeStyles = (_c: Palette) =>
  StyleSheet.create({
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
