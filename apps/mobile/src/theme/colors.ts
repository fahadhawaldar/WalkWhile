/**
 * The palette. Light: warm paper background, deep forest ink, one fresh mint
 * accent. Dark: a green-black night version of the same. Status colors are
 * reserved for the return-time state of a walk.
 */
export const lightColors = {
  // Brand
  forest: '#123A2A', // primary surfaces, primary buttons
  forestSoft: '#1F5A41',
  mint: '#3DD68C', // progress, success, "you are on track"
  mintSoft: '#DDF7E9',
  mintInk: '#0B6B3F', // mint-family text on light surfaces

  // Surfaces
  background: '#F5F4EF',
  surface: '#FFFFFF',
  surfaceMuted: '#ECEBE4',
  surfaceSunken: '#E4E2DA',
  separator: 'rgba(18, 26, 20, 0.08)',
  segmentThumb: '#FFFFFF',

  // Text
  ink: '#111A15',
  inkSecondary: '#5B6560',
  inkTertiary: '#98A09B',
  onForest: '#FFFFFF',
  onForestMuted: 'rgba(255, 255, 255, 0.64)',

  // Return status
  safe: '#16A15C',
  safeSoft: '#E2F6EA',
  warning: '#D9861C',
  warningSoft: '#FCF0DC',
  urgent: '#E0453A',
  urgentSoft: '#FCE6E3',
  overdue: '#A8241B',
  overdueSoft: '#F8D9D5',

  // Map
  routeColors: ['#123A2A', '#0E7C86', '#4F5BD5'],
  routeInactive: 'rgba(91, 101, 96, 0.5)',
  routeWalked: 'rgba(91, 101, 96, 0.45)',
  returnRoute: '#E0453A',
  you: '#2F6BFF',

  ringTrackOnForest: 'rgba(255, 255, 255, 0.14)',
  shadow: '#0B1410',
  scrim: 'rgba(17, 26, 21, 0.4)',
  white: '#FFFFFF',
};

export type Palette = typeof lightColors;

export const darkColors: Palette = {
  forest: '#1E6E49',
  forestSoft: '#2A8559',
  mint: '#3DD68C',
  mintSoft: '#16382A',
  mintInk: '#62E2A4',

  background: '#0C110E',
  surface: '#161D19',
  surfaceMuted: '#212A25',
  surfaceSunken: '#2C3630',
  separator: 'rgba(255, 255, 255, 0.08)',
  // Raised above the track, so lighter than it at night.
  segmentThumb: '#38443D',

  ink: '#ECF1EE',
  inkSecondary: '#A2ACA6',
  inkTertiary: '#6C7670',
  onForest: '#FFFFFF',
  onForestMuted: 'rgba(255, 255, 255, 0.7)',

  safe: '#3DD68C',
  safeSoft: '#16382A',
  warning: '#F0A847',
  warningSoft: '#3A2B14',
  urgent: '#FF6E62',
  urgentSoft: '#3E1D1A',
  overdue: '#FF8F86',
  overdueSoft: '#4A201C',

  routeColors: ['#5BE3A0', '#3CC7D1', '#8C95FF'],
  routeInactive: 'rgba(200, 210, 204, 0.4)',
  routeWalked: 'rgba(200, 210, 204, 0.35)',
  returnRoute: '#FF6E62',
  you: '#4D8BFF',

  ringTrackOnForest: 'rgba(255, 255, 255, 0.18)',
  shadow: '#000000',
  scrim: 'rgba(0, 0, 0, 0.55)',
  white: '#FFFFFF',
};
