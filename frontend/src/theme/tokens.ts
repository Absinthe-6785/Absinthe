/** Absinthe Design System — semantic tokens (Sprint E-0) */

export type ThemeMode = 'light' | 'dark';

export interface ColorTokens {
  background: string;
  surface: string;
  surfaceAlt: string;
  /** Visually raised surface; currently appearance-equivalent to surface. */
  surfaceElevated: string;
  /** Quiet semantic surface; currently appearance-equivalent to surfaceAlt. */
  surfaceMuted: string;
  text: string;
  muted: string;
  /** Secondary/helper copy; distinct from muted fills even when current values match. */
  mutedForeground: string;
  border: string;
  primary: string;
  primaryHover: string;
  /** Text/icons on primary-filled controls */
  primaryForeground: string;
  /** Selected control or region fill; distinct authority from decorative accents. */
  selected: string;
  warning: string;
  danger: string;
  success: string;
  /** Keyboard focus indicator color; behavior remains owned by UI-03. */
  focus: string;
  /** Disabled text/icon color; opacity behavior remains component-owned for now. */
  disabled: string;
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

export interface TypographyTokens {
  /** Shared product headings; document/editor typography remains workspace-specific. */
  headingFamily: string;
}

/** Decorative-only Pixel/Cosmos vocabulary. Never use these as semantic state aliases. */
export interface CosmosDecorativeTokens {
  void: string;
  paleBlueDot: string;
  starlight: string;
  orbit: string;
  satellite: string;
  dust: string;
  traceGlow: string;
}

export interface DesignTokens {
  colors: ColorTokens;
  spacing: SpacingTokens;
  radius: RadiusTokens;
  shadow: ShadowTokens;
  typography: TypographyTokens;
  cosmosDecorative: CosmosDecorativeTokens;
}

/** Light — Ivory Paper + Purple */
export const LIGHT_TOKENS: DesignTokens = {
  colors: {
    background: '#F5F0E8',
    surface: '#FAF7F2',
    surfaceAlt: '#EDE8DF',
    surfaceElevated: '#FAF7F2',
    surfaceMuted: '#EDE8DF',
    text: '#1C1917',
    muted: '#78716C',
    mutedForeground: '#78716C',
    border: '#E7E0D5',
    primary: '#8B5CF6',
    primaryHover: '#7C3AED',
    primaryForeground: '#FFFFFF',
    selected: '#8B5CF6',
    warning: '#F59E0B',
    danger: '#DC2626',
    success: '#15803D',
    focus: '#8B5CF6',
    disabled: '#78716C',
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
  typography: {
    headingFamily: "'Montserrat', sans-serif",
  },
  cosmosDecorative: {
    void: '#F5F0E8',
    paleBlueDot: '#3B82F6',
    starlight: '#FFFFFF',
    orbit: '#E7E0D5',
    satellite: '#78716C',
    dust: '#EDE8DF',
    traceGlow: 'rgba(139,92,246,0.08)',
  },
};

/** Dark — Midnight Purple + Charcoal */
export const DARK_TOKENS: DesignTokens = {
  colors: {
    background: '#0E0E10',
    surface: '#1B1B1F',
    surfaceAlt: '#252529',
    surfaceElevated: '#1B1B1F',
    surfaceMuted: '#252529',
    text: '#F4F4F5',
    muted: '#A1A1AA',
    mutedForeground: '#A1A1AA',
    border: '#2E2E33',
    primary: '#8B5CF6',
    primaryHover: '#A78BFA',
    primaryForeground: '#FFFFFF',
    selected: '#8B5CF6',
    warning: '#F59E0B',
    danger: '#F87171',
    success: '#4ADE80',
    focus: '#8B5CF6',
    disabled: '#A1A1AA',
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
  typography: LIGHT_TOKENS.typography,
  cosmosDecorative: {
    void: '#0E0E10',
    paleBlueDot: '#60A5FA',
    starlight: '#F4F4F5',
    orbit: '#2E2E33',
    satellite: '#A1A1AA',
    dust: '#252529',
    traceGlow: 'rgba(139,92,246,0.14)',
  },
};

export function tokensForMode(mode: ThemeMode): DesignTokens {
  return mode === 'dark' ? DARK_TOKENS : LIGHT_TOKENS;
}

type CssVariableMap<T> = { readonly [K in keyof T]: `--${string}` };

/** Complete production mapping from typed token fields to runtime CSS variables. */
export const DESIGN_TOKEN_CSS_VARIABLES = {
  colors: {
    background: '--color-background',
    surface: '--color-surface',
    surfaceAlt: '--color-surface-alt',
    surfaceElevated: '--color-surface-elevated',
    surfaceMuted: '--color-surface-muted',
    text: '--color-text',
    muted: '--color-muted',
    mutedForeground: '--color-muted-foreground',
    border: '--color-border',
    primary: '--color-primary',
    primaryHover: '--color-primary-hover',
    primaryForeground: '--color-primary-fg',
    selected: '--color-selected',
    warning: '--color-warning',
    danger: '--color-danger',
    success: '--color-success',
    focus: '--color-focus',
    disabled: '--color-disabled',
    overlay: '--color-overlay',
    sidebar: '--color-sidebar',
    sidebarHover: '--color-sidebar-hover',
    sidebarMuted: '--color-sidebar-muted',
    accentBg: '--color-accent-bg',
    input: '--color-input',
    inputBorder: '--color-input-border',
  },
  spacing: {
    xs: '--spacing-xs',
    sm: '--spacing-sm',
    md: '--spacing-md',
    lg: '--spacing-lg',
    xl: '--spacing-xl',
    '2xl': '--spacing-2xl',
    page: '--spacing-page',
  },
  radius: {
    sm: '--radius-sm',
    md: '--radius-md',
    lg: '--radius-lg',
    xl: '--radius-xl',
    '2xl': '--radius-2xl',
    full: '--radius-full',
  },
  shadow: {
    sm: '--shadow-sm',
    md: '--shadow-md',
    lg: '--shadow-lg',
    xl: '--shadow-xl',
    menu: '--shadow-menu',
  },
  typography: {
    headingFamily: '--font-heading',
  },
  cosmosDecorative: {
    void: '--cosmos-void',
    paleBlueDot: '--cosmos-pale-blue-dot',
    starlight: '--cosmos-starlight',
    orbit: '--cosmos-orbit',
    satellite: '--cosmos-satellite',
    dust: '--cosmos-dust',
    traceGlow: '--cosmos-trace-glow',
  },
} as const satisfies {
  readonly [Group in keyof DesignTokens]: CssVariableMap<DesignTokens[Group]>;
};

/** Resolve the complete CSS-variable payload consumed by ThemeProvider. */
export function resolveDesignTokenCssVariables(tokens: DesignTokens): Record<string, string> {
  const resolved: Record<string, string> = {};
  const groups = Object.keys(DESIGN_TOKEN_CSS_VARIABLES) as Array<keyof DesignTokens>;

  for (const group of groups) {
    const variables = DESIGN_TOKEN_CSS_VARIABLES[group] as Record<string, string>;
    const values = tokens[group] as unknown as Record<string, string>;
    for (const tokenName of Object.keys(variables)) {
      resolved[variables[tokenName]!] = values[tokenName]!;
    }
  }

  return resolved;
}

/** Apply all design tokens as CSS custom properties on an element (usually :root). */
export function applyTokensToElement(el: HTMLElement, tokens: DesignTokens): void {
  for (const [variable, value] of Object.entries(resolveDesignTokenCssVariables(tokens))) {
    el.style.setProperty(variable, value);
  }
}
