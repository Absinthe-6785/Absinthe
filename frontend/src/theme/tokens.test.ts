import { describe, expect, it, vi } from 'vitest';
import {
  DARK_TOKENS,
  LIGHT_TOKENS,
  applyTokensToElement,
  tokensForMode,
} from './tokens';

const COLOR_KEYS = [
  'background', 'surface', 'surfaceAlt', 'text', 'muted', 'border',
  'primary', 'primaryHover', 'primaryForeground',
] as const;

describe('Absinthe design tokens', () => {
  it('light theme uses Ivory Paper + Purple', () => {
    expect(LIGHT_TOKENS.colors.background).toBe('#F5F0E8');
    expect(LIGHT_TOKENS.colors.primary).toBe('#8B5CF6');
  });

  it('dark theme uses Midnight Purple + Charcoal', () => {
    expect(DARK_TOKENS.colors.background).toBe('#0E0E10');
    expect(DARK_TOKENS.colors.surface).toBe('#1B1B1F');
    expect(DARK_TOKENS.colors.primary).toBe('#8B5CF6');
  });

  it.each(COLOR_KEYS)('both themes define %s', key => {
    expect(LIGHT_TOKENS.colors[key]).toBeTruthy();
    expect(DARK_TOKENS.colors[key]).toBeTruthy();
  });

  it('tokensForMode switches palette', () => {
    expect(tokensForMode('light')).toBe(LIGHT_TOKENS);
    expect(tokensForMode('dark')).toBe(DARK_TOKENS);
  });

  it('applyTokensToElement sets CSS variables', () => {
    const style = { setProperty: vi.fn() } as unknown as CSSStyleDeclaration;
    const el = { style } as unknown as HTMLElement;
    applyTokensToElement(el, LIGHT_TOKENS);
    expect(style.setProperty).toHaveBeenCalledWith('--color-primary', '#8B5CF6');
    expect(style.setProperty).toHaveBeenCalledWith('--radius-md', '12px');
    expect(style.setProperty).toHaveBeenCalledWith('--shadow-menu', LIGHT_TOKENS.shadow.menu);
  });
});
