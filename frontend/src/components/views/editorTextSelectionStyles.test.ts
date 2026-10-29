import { describe, expect, it } from 'vitest';
import { EDITOR_CHROME_STYLES } from './editorChromeStyles';
import { buildEditorCssVariables } from './features/block-editor/utils/editorThemeStyle';
import type { BlockEditorColors } from './editorTypes';

const colors = (isDark: boolean, accent = '#6D28D9'): BlockEditorColors => ({
  bg: isDark ? '#111' : '#fff',
  text: isDark ? '#f4f4f5' : '#18181b',
  textMuted: isDark ? '#a1a1aa' : '#52525b',
  textFaint: isDark ? '#71717a' : '#a1a1aa',
  accent,
  accentBg: isDark ? 'rgba(109,40,217,0.14)' : 'rgba(109,40,217,0.1)',
  border: isDark ? '#3f3f46' : '#d4d4d8',
  card: isDark ? '#18181b' : '#fff',
  cardHov: isDark ? '#27272a' : '#f4f4f5',
  input: isDark ? '#18181b' : '#fff',
  inputBdr: isDark ? '#3f3f46' : '#d4d4d8',
  toolbar: isDark ? '#18181b' : '#fff',
  danger: '#dc2626',
  green: '#16a34a',
  codeBg: isDark ? '#27272a' : '#f4f4f5',
  calloutBg: isDark ? '#27272a' : '#fafafa',
  toggleBg: 'transparent',
  quoteBdr: isDark ? '#52525b' : '#d4d4d8',
  selection: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(109,40,217,0.04)',
  isDark,
});

describe('Notes editor text and block selection styles', () => {
  it.each([
    ['light', false, '22%'],
    ['dark', true, '34%'],
  ] as const)('uses the theme accent for %s native text selection', (_mode, isDark, strength) => {
    const variables = buildEditorCssVariables(colors(isDark)) as unknown as Record<string, string>;

    expect(variables['--be-text-selection-bg']).toBe(
      `color-mix(in srgb, #6D28D9 ${strength}, transparent)`,
    );
  });

  it('scopes native selection painting to the Notes editor root', () => {
    expect(EDITOR_CHROME_STYLES).toContain('.be-editor-root ::selection');
    expect(EDITOR_CHROME_STYLES).toContain('.be-editor-root ::-moz-selection');
    expect(EDITOR_CHROME_STYLES).toContain('background-color: var(--be-text-selection-bg');
  });

  it('keeps selected-block decoration out of the gutter controls', () => {
    expect(EDITOR_CHROME_STYLES).toContain(
      '.be-block-selected:not(.be-toggle-header-block) > .be-content',
    );
    expect(EDITOR_CHROME_STYLES).toContain('var(--be-block-selection-outline');
    expect(EDITOR_CHROME_STYLES).not.toContain('.be-block-selected:not(.be-toggle-header-block)::after');
  });
});
