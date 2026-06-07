import { createContext, useContext } from 'react';
import type { DesignTokens, ThemeMode } from './tokens';

export interface ThemeContextValue {
  mode: ThemeMode;
  darkMode: boolean;
  tokens: DesignTokens;
}

export const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return ctx;
}

/** Safe variant — returns null outside provider (e.g. tests). */
export function useThemeOptional(): ThemeContextValue | null {
  return useContext(ThemeContext);
}
