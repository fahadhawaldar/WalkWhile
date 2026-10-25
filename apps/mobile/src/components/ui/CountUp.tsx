import { useEffect } from 'react';
import { StyleProp, TextInput, TextStyle } from 'react-native';
import Animated, {
  useAnimatedProps,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { motion } from '../../theme';

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

/**
 * A number that counts up from zero on mount, drawn on the UI thread (no
 * re-render per frame). Used only on celebration moments.
 */
export function CountUp({
  value,
  format = 'integer',
  delay = 0,
  style,
}: {
  value: number;
  /** integer: 1,234 · km: 1.2 (one decimal) */
  format?: 'integer' | 'km';
  delay?: number;
  style?: StyleProp<TextStyle>;
}) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(delay, withTiming(value, { duration: 900, easing: motion.easeOut }));
  }, [value, delay, progress]);

  const animatedProps = useAnimatedProps(() => {
    const v = progress.value;
    let text: string;
    if (format === 'km') {
      text = v.toFixed(1);
    } else {
      // toLocaleString is not available in worklets; group thousands by hand.
      text = Math.round(v)
        .toString()
        .replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }
    return { text, defaultValue: text } as never;
  });

  return (
    <AnimatedTextInput
      editable={false}
      underlineColorAndroid="transparent"
      style={[{ padding: 0 }, style]}
      animatedProps={animatedProps}
      accessibilityLabel={format === 'km' ? `${value.toFixed(1)}` : `${Math.round(value)}`}
    />
  );
}
