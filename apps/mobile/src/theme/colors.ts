export const COLORS = {
  // Brand colors
  primary: '#1B4332',       // Dark forest green
  primaryLight: '#2D6A4F',  // Mid forest green
  accent: '#52B788',        // Vibrant emerald green
  accentSoft: '#D8F3DC',    // Soft mint background
  accentUltraLight: '#E8F5E9',

  // Surfaces & Backgrounds
  background: '#F8F9FA',
  surface: '#FFFFFF',
  surfaceSubtle: '#F1F5F9',
  border: '#E2E8F0',
  borderDark: '#CBD5E1',

  // Text hierarchy
  textPrimary: '#0F172A',
  textSecondary: '#475569',
  textMuted: '#94A3B8',
  textWhite: '#FFFFFF',

  // Status & Alerts
  safe: '#16A34A',
  warning: '#F59E0B',
  urgent: '#DC2626',
  overdue: '#991B1B',

  // Route colors for map distinction
  routeColors: [
    '#1B4332', // Route 1: Forest Green
    '#028090', // Route 2: Ocean Teal
    '#4361EE', // Route 3: Royal Blue
  ],
  returnRouteColor: '#DC2626', // Return route: Bright warning crimson
} as const;
