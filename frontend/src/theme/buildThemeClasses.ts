import type { Theme } from '../types';

/**
 * Tailwind class bundles for legacy views that receive a `theme` prop.
 * All classes resolve via CSS variables set by ThemeProvider.
 */
export function buildThemeClasses(): Theme {
  return {
    card: 'bg-surface text-foreground shadow-absinthe-md rounded-absinthe-xl',
    input: 'bg-surface-alt text-foreground placeholder:text-muted border border-border',
    border: 'border-border',
    text: 'text-foreground',
    textMuted: 'text-muted',
    hoverBg: 'hover:bg-surface-alt',
  };
}
