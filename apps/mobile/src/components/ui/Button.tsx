import { ReactNode } from 'react';
import { ActivityIndicator, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { Palette, radius, shadows, spacing, useColors, useThemedStyles } from '../../theme';
import { AppText } from './AppText';
import { PressableScale } from './PressableScale';

const variantsFor = (c: Palette) => ({
  primary: { background: c.forest, text: c.onForest, shadow: shadows.button },
  secondary: { background: c.surface, text: c.ink, shadow: shadows.card },
  tinted: { background: c.mintSoft, text: c.mintInk, shadow: null },
  danger: { background: c.urgentSoft, text: c.urgent, shadow: null },
});

type Variant = keyof ReturnType<typeof variantsFor>;

const sizes = {
  md: { height: 52, paddingHorizontal: spacing.xl, text: 'headline' as const },
  lg: { height: 60, paddingHorizontal: spacing.xxl, text: 'headline' as const },
};

interface ButtonProps {
  title: string;
  onPress?: () => void;
  variant?: Variant;
  size?: keyof typeof sizes;
  /** Rendered before the title. */
  icon?: ReactNode;
  loading?: boolean;
  /** Shown instead of the title while loading. */
  loadingTitle?: string;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  loading,
  loadingTitle,
  disabled,
  style,
  accessibilityHint,
}: ButtonProps) {
  const c = useColors();
  const styles = useThemedStyles(makeStyles);
  const v = variantsFor(c)[variant];
  const s = sizes[size];
  const inactive = disabled || loading;

  return (
    <PressableScale
      onPress={onPress}
      disabled={inactive}
      accessibilityLabel={title}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      style={[
        styles.base,
        { backgroundColor: v.background, height: s.height, paddingHorizontal: s.paddingHorizontal },
        v.shadow,
        disabled && !loading && styles.disabled,
        style,
      ]}
    >
      <View style={styles.row}>
        {loading ? <ActivityIndicator color={v.text} /> : icon}
        <AppText variant={s.text} color={v.text}>
          {loading && loadingTitle ? loadingTitle : title}
        </AppText>
      </View>
    </PressableScale>
  );
}

const makeStyles = (_c: Palette) =>
  StyleSheet.create({
  base: {
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  disabled: {
    opacity: 0.45,
  },
});
