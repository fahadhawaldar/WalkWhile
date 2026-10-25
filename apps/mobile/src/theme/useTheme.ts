import { useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { darkColors, lightColors, Palette } from './colors';

/** The palette for the current appearance (system, or the in-app choice). */
export function useColors(): Palette {
  return useColorScheme() === 'dark' ? darkColors : lightColors;
}

/**
 * Styles built from the current palette, rebuilt only when the appearance
 * changes. `factory` should be defined at module level.
 */
export function useThemedStyles<T>(factory: (c: Palette) => T): T {
  const c = useColors();
  return useMemo(() => factory(c), [c, factory]);
}
