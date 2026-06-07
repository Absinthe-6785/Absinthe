import { useEffect, useMemo, type ReactNode } from 'react';
import { useAppStore } from '../store/useAppStore';
import { applyTokensToElement, tokensForMode, type ThemeMode } from './tokens';
import { ThemeContext, type ThemeContextValue } from './ThemeContext';

interface ThemeProviderProps {
  children: ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const darkMode = useAppStore(s => s.appSettings.darkMode);
  const mode: ThemeMode = darkMode ? 'dark' : 'light';
  const tokens = useMemo(() => tokensForMode(mode), [mode]);

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', mode);
    applyTokensToElement(root, tokens);
  }, [mode, tokens]);

  const value = useMemo<ThemeContextValue>(
    () => ({ mode, darkMode, tokens }),
    [mode, darkMode, tokens],
  );

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}
