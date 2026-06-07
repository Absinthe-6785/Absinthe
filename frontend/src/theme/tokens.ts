/** Absinthe Design System — semantic tokens (Sprint E-0) */

export type ThemeMode = 'light' | 'dark';

export interface ColorTokens {
  background: string;
  surface: string;
  surfaceAlt: string;
  text: string;
  muted: string;
  border: string;
  primary: string;
  primaryHover: string;
  /** Text/icons on primary-filled controls */
  primaryForeground: string;
  danger: string;
  success: string;
  overlay: string;
  /** Sidebar rail — slightly distinct from main surface */
  sidebar: string;
  sidebarHover: string;
  sidebarMuted: string;
  accentBg: string;
  input: string;
  inputBorder: string;
}

export interface SpacingTokens {
  xs: string;
  sm: string;
  md: string;
  lg: string;
  xl: string;
  '2xl': string;
  page: string;
}

export interface RadiusTokens {
  sm: string;
  md: string;
  lg: string;
  xl: string;
  '2xl': string;
  full: string;
}

export interface ShadowTokens {
  sm: string;
  md: string;
  lg: string;
  xl: string;
  menu: string;
}

export interface DesignTokens {
  colors: ColorTokens;
  spacing: SpacingTokens;
  radius: RadiusTokens;
  shadow: ShadowTokens;
}

/** Light — Ivory Paper + Purple */
export const LIGHT_TOKENS: DesignTokens = {
  colors: {
    background: '#F5F0E8',
    surface: '#FAF7F2',
    surfaceAlt: '#EDE8DF',
    text: '#1C1917',
    muted: '#78716C',
    border: '#E7E0D5',
    primary: '#8B5CF6',
    primaryHover: '#7C3AED',
    primaryForeground: '#FFFFFF',
    danger: '#DC2626',
    success: '#15803D',
    overlay: 'rgba(0,0,0,0.45)',
    sidebar: '#F0EBE3',
    sidebarHover: '#E5DFD5',
    sidebarMuted: '#A8A29E',
    accentBg: 'rgba(139,92,246,0.08)',
    input: '#F5F2EC',
    inputBorder: '#E7E0D5',
  },
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '12px',
    lg: '16px',
    xl: '24px',
    '2xl': '32px',
    page: '12px',
  },
  radius: {
    sm: '8px',
    md: '12px',
    lg: '16px',
    xl: '24px',
    '2xl': '32px',
    full: '9999px',
  },
  shadow: {
    sm: '0 1px 2px rgba(28,25,23,0.06)',
    md: '0 4px 12px rgba(28,25,23,0.08)',
    lg: '0 8px 24px rgba(28,25,23,0.10)',
    xl: '0 16px 48px rgba(28,25,23,0.12)',
    menu: '0 8px 24px rgba(28,25,23,0.12)',
  },
};

/** Dark — Midnight Purple + Charcoal */
export const DARK_TOKENS: DesignTokens = {
  colors: {
    background: '#0E0E10',
    surface: '#1B1B1F',
    surfaceAlt: '#252529',
    text: '#F4F4F5',
    muted: '#A1A1AA',
    border: '#2E2E33',
    primary: '#8B5CF6',
    primaryHover: '#A78BFA',
    primaryForeground: '#FFFFFF',
    danger: '#F87171',
    success: '#4ADE80',
    overlay: 'rgba(0,0,0,0.60)',
    sidebar: '#16161A',
    sidebarHover: '#252529',
    sidebarMuted: '#71717A',
    accentBg: 'rgba(139,92,246,0.14)',
    input: '#252529',
    inputBorder: '#3F3F46',
  },
  spacing: LIGHT_TOKENS.spacing,
  radius: LIGHT_TOKENS.radius,
  shadow: {
    sm: '0 1px 2px rgba(0,0,0,0.25)',
    md: '0 4px 12px rgba(0,0,0,0.35)',
    lg: '0 8px 24px rgba(0,0,0,0.45)',
    xl: '0 16px 48px rgba(0,0,0,0.55)',
    menu: '0 8px 32px rgba(0,0,0,0.55)',
  },
};

export function tokensForMode(mode: ThemeMode): DesignTokens {
  return mode === 'dark' ? DARK_TOKENS : LIGHT_TOKENS;
}

/** Apply all design tokens as CSS custom properties on an element (usually :root). */
export function applyTokensToElement(el: HTMLElement, tokens: DesignTokens): void {
  const { colors: c, spacing: s, radius: r, shadow: sh } = tokens;
  const set = (k: string, v: string) => el.style.setProperty(k, v);

  set('--color-background', c.background);
  set('--color-surface', c.surface);
  set('--color-surface-alt', c.surfaceAlt);
  set('--color-text', c.text);
  set('--color-muted', c.muted);
  set('--color-border', c.border);
  set('--color-primary', c.primary);
  set('--color-primary-hover', c.primaryHover);
  set('--color-primary-fg', c.primaryForeground);
  set('--color-danger', c.danger);
  set('--color-success', c.success);
  set('--color-overlay', c.overlay);
  set('--color-sidebar', c.sidebar);
  set('--color-sidebar-hover', c.sidebarHover);
  set('--color-sidebar-muted', c.sidebarMuted);
  set('--color-accent-bg', c.accentBg);
  set('--color-input', c.input);
  set('--color-input-border', c.inputBorder);

  set('--spacing-xs', s.xs);
  set('--spacing-sm', s.sm);
  set('--spacing-md', s.md);
  set('--spacing-lg', s.lg);
  set('--spacing-xl', s.xl);
  set('--spacing-2xl', s['2xl']);
  set('--spacing-page', s.page);

  set('--radius-sm', r.sm);
  set('--radius-md', r.md);
  set('--radius-lg', r.lg);
  set('--radius-xl', r.xl);
  set('--radius-2xl', r['2xl']);
  set('--radius-full', r.full);

  set('--shadow-sm', sh.sm);
  set('--shadow-md', sh.md);
  set('--shadow-lg', sh.lg);
  set('--shadow-xl', sh.xl);
  set('--shadow-menu', sh.menu);
}
