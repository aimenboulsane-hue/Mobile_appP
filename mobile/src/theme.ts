export const colors = {
  primary: '#1E3A8A',
  primaryDark: '#172554',
  primarySoft: '#E8EEFB',
  onPrimary: '#FFFFFF',
  onPrimaryMuted: '#C7D5F5',

  background: '#F4F6FA',
  surface: '#FFFFFF',
  surfaceMuted: '#F1F5F9',
  border: '#E2E8F0',
  text: '#0F172A',
  textSecondary: '#475569',
  textMuted: '#94A3B8',

  success: '#15803D',
  successSoft: '#DCFCE7',
  warning: '#B45309',
  warningSoft: '#FEF3C7',
  danger: '#B91C1C',
  dangerSoft: '#FEE2E2',

  overlay: 'rgba(15, 23, 42, 0.55)',
} as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

export const radius = { sm: 8, md: 12, lg: 16, pill: 999 } as const;

export const fontSize = { xs: 12, sm: 14, md: 16, lg: 18, xl: 22, xxl: 30 } as const;

export const fontWeight = { regular: '400', medium: '500', semibold: '600', bold: '700' } as const;

export const touchSize = 48;

export const tabBar = { height: 64, iconSize: 22, labelSize: 10 } as const;

export const shadow = {
  shadowColor: '#0F172A',
  shadowOpacity: 0.06,
  shadowRadius: 8,
  shadowOffset: { width: 0, height: 2 },
  elevation: 2,
} as const;

export type Tone = 'primary' | 'success' | 'warning' | 'danger' | 'neutral';

export const tones: Record<Tone, { fg: string; bg: string }> = {
  primary: { fg: colors.primary, bg: colors.primarySoft },
  success: { fg: colors.success, bg: colors.successSoft },
  warning: { fg: colors.warning, bg: colors.warningSoft },
  danger: { fg: colors.danger, bg: colors.dangerSoft },
  neutral: { fg: colors.textSecondary, bg: colors.surfaceMuted },
};
