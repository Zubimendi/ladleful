export interface ThemeColors {
  bg: string;
  surface: string;
  surfaceElevated: string;
  text: string;
  textSecondary: string;
  textOnPrimary: string;
  primary: string;
  primaryPressed: string;
  primarySoft: string;
  accent: string;
  accentSoft: string;
  danger: string;
  dangerSoft: string;
  warning: string;
  warningSoft: string;
  border: string;
  chipBg: string;
}

export const LIGHT_COLORS: ThemeColors = {
  bg: '#F6F7F3',
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  text: '#1F2A24',
  textSecondary: '#55635B',
  textOnPrimary: '#FFFFFF',
  primary: '#2F6B3B',
  primaryPressed: '#25552E',
  primarySoft: '#E6F0E8',
  accent: '#B45309',
  accentSoft: '#FEF3C7',
  danger: '#B91C1C',
  dangerSoft: '#FEE2E2',
  warning: '#92400E',
  warningSoft: '#FEF3C7',
  border: '#DDE3DC',
  chipBg: '#ECEFE9',
};

export const DARK_COLORS: ThemeColors = {
  bg: '#101512',
  surface: '#192019',
  surfaceElevated: '#212A22',
  text: '#EEF3EE',
  textSecondary: '#A5B3A9',
  textOnPrimary: '#101512',
  primary: '#7BC48B',
  primaryPressed: '#64AD74',
  primarySoft: '#1E3323',
  accent: '#FBBF24',
  accentSoft: '#332810',
  danger: '#F87171',
  dangerSoft: '#3B1818',
  warning: '#FBBF24',
  warningSoft: '#332810',
  border: '#2A352B',
  chipBg: '#222B23',
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const RADIUS = {
  sm: 8,
  md: 12,
  lg: 16,
  pill: 999,
} as const;

export const TOUCH_TARGET = {
  min: 48,
  cook: 64,
} as const;

export const TYPOGRAPHY = {
  title: { fontSize: 28, lineHeight: 34, fontWeight: '700' as const, letterSpacing: -0.4 },
  heading: { fontSize: 20, lineHeight: 26, fontWeight: '600' as const, letterSpacing: -0.2 },
  subheading: { fontSize: 17, lineHeight: 23, fontWeight: '600' as const },
  body: { fontSize: 16, lineHeight: 24, fontWeight: '400' as const },
  label: { fontSize: 14, lineHeight: 20, fontWeight: '600' as const },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '400' as const },
  cookStep: { fontSize: 24, lineHeight: 34, fontWeight: '500' as const },
  timer: { fontSize: 32, lineHeight: 36, fontWeight: '700' as const },
} as const;

export const RECIPE_TILE_PALETTE = [
  { bg: '#2F6B3B', fg: '#FFFFFF' },
  { bg: '#B45309', fg: '#FFFFFF' },
  { bg: '#7C2D12', fg: '#FFFFFF' },
  { bg: '#1E40AF', fg: '#FFFFFF' },
  { bg: '#4C1D95', fg: '#FFFFFF' },
  { bg: '#0F766E', fg: '#FFFFFF' },
] as const;

export function getRecipeTileColor(title: string): { bg: string; fg: string } {
  let hash = 0;
  for (let i = 0; i < title.length; i++) {
    hash = (hash * 31 + title.charCodeAt(i)) | 0;
  }
  const idx = Math.abs(hash) % RECIPE_TILE_PALETTE.length;
  return RECIPE_TILE_PALETTE[idx]!;
}
