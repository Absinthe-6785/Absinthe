import type { CSSProperties } from 'react';
import type { BlockEditorColors } from '../../../editorTypes';

export function buildEditorCssVariables(colors: BlockEditorColors): CSSProperties {
  return {
    '--be-accent': colors.accent,
    '--be-accent-bg': colors.accentBg,
    '--be-link': colors.linkColor ?? colors.accent,
    '--be-code-bg': colors.codeBg,
    '--be-placeholder-color': colors.textFaint,
    '--be-text': colors.text,
    '--be-doc-width': colors.documentMaxWidth ? `${colors.documentMaxWidth}px` : '720px',
    '--be-font-family': colors.fontFamily ?? 'system-ui, sans-serif',
    '--be-font-size': colors.fontSize ? `${colors.fontSize}px` : '16px',
    '--be-search-hl-bg': colors.searchHlBg ?? colors.accentBg,
    '--be-search-hl-color': colors.searchHlColor ?? colors.text,
    '--be-block-hover-bg': colors.isDark ? 'rgba(139,92,246,0.06)' : 'rgba(139,92,246,0.035)',
    '--be-block-active-bg': colors.blockFocusBg ?? 'transparent',
    '--be-block-selected-bg': colors.blockSelectedBg ?? 'rgba(139,92,246,0.05)',
    '--be-block-active-selected-bg': colors.isDark ? 'rgba(139,92,246,0.08)' : 'rgba(139,92,246,0.08)',
    '--be-toggle-bg': colors.toggleBg ?? 'transparent',
    '--be-toggle-hover-bg': colors.isDark ? 'rgba(139,92,246,0.05)' : 'rgba(139,92,246,0.04)',
    '--be-toggle-rail': colors.isDark ? 'rgba(139,92,246,0.18)' : 'rgba(139,92,246,0.16)',
    '--be-toggle-rail-collapsed': colors.isDark ? 'rgba(139,92,246,0.24)' : 'rgba(139,92,246,0.20)',
    '--be-border': colors.border,
    '--be-text-muted': colors.textMuted,
    '--be-menu-shadow': colors.menuShadow ?? '0 8px 24px rgba(0,0,0,0.1)',
  } as CSSProperties;
}
