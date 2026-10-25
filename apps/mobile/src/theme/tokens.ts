import { Platform, TextStyle, ViewStyle } from 'react-native';
import { Easing } from 'react-native-reanimated';
import type { Palette } from './colors';

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 48,
} as const;

export const radius = {
  sm: 10,
  md: 14,
  lg: 20,
  xl: 28,
  full: 9999,
} as const;

// SF Pro Rounded for numbers on iOS; the system font elsewhere.
const rounded = Platform.select({ ios: 'ui-rounded', default: undefined });

export const type = {
  display: {
    fontFamily: rounded,
    fontSize: 72,
    lineHeight: 76,
    fontWeight: '700',
    letterSpacing: -2,
    fontVariant: ['tabular-nums'],
  },
  numberLarge: {
    fontFamily: rounded,
    fontSize: 40,
    lineHeight: 44,
    fontWeight: '700',
    letterSpacing: -1,
    fontVariant: ['tabular-nums'],
  },
  number: {
    fontFamily: rounded,
    fontSize: 22,
    lineHeight: 26,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  largeTitle: { fontSize: 32, lineHeight: 38, fontWeight: '700', letterSpacing: -0.6 },
  title: { fontSize: 22, lineHeight: 28, fontWeight: '700', letterSpacing: -0.3 },
  headline: { fontSize: 17, lineHeight: 22, fontWeight: '600' },
  body: { fontSize: 16, lineHeight: 22, fontWeight: '400' },
  callout: { fontSize: 15, lineHeight: 20, fontWeight: '500' },
  subhead: { fontSize: 14, lineHeight: 19, fontWeight: '400' },
  footnote: { fontSize: 13, lineHeight: 18, fontWeight: '500' },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '500' },
} as const satisfies Record<string, TextStyle>;

export type TypeVariant = keyof typeof type;

/** Default text color for each style, as a palette key. */
export const typeColor: Record<TypeVariant, keyof Palette> = {
  display: 'ink',
  numberLarge: 'ink',
  number: 'ink',
  largeTitle: 'ink',
  title: 'ink',
  headline: 'ink',
  body: 'ink',
  callout: 'ink',
  subhead: 'inkSecondary',
  footnote: 'inkSecondary',
  caption: 'inkTertiary',
};

// Legacy shadow props: the app runs on the old architecture, where boxShadow
// is not supported.
export const shadows = {
  card: {
    shadowColor: '#0B1410',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  raised: {
    shadowColor: '#0B1410',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 6,
  },
  button: {
    shadowColor: '#123A2A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 16,
    elevation: 6,
  },
} as const satisfies Record<string, ViewStyle>;

export const motion = {
  press: 120,
  fast: 180,
  base: 260,
  slow: 420,
  /** Strong ease-out for anything entering or changing state. */
  easeOut: Easing.bezier(0.23, 1, 0.32, 1),
  /** The same curve as a plain function, for entering/exiting animations. */
  easeOutFn: Easing.bezierFn(0.23, 1, 0.32, 1),
  /** Something moving between two places on screen. */
  easeInOut: Easing.bezier(0.77, 0, 0.175, 1),
  /** Settle with no overshoot. */
  spring: { damping: 20, stiffness: 220, mass: 1 },
  /** A small, deliberate overshoot for celebration moments. */
  springBouncy: { damping: 11, stiffness: 180, mass: 1 },
} as const;

export const layout = {
  screenPadding: spacing.xl,
  minTouch: 44,
} as const;
