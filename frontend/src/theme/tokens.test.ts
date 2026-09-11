import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { describe, expect, it, vi } from 'vitest';
import {
  DESIGN_TOKEN_CSS_VARIABLES,
  DARK_TOKENS,
  LIGHT_TOKENS,
  applyTokensToElement,
  resolveDesignTokenCssVariables,
  tokensForMode,
} from './tokens';

const require = createRequire(import.meta.url);
const tailwindConfig = require('../../tailwind.config.cjs') as {
  theme: { extend: { colors: Record<string, string | Record<string, string>> } };
};

function parseRootVariables(css: string): Map<string, string> {
  const rootStart = css.indexOf(':root');
  const blockStart = css.indexOf('{', rootStart);
  const blockEnd = css.indexOf('}', blockStart);
  if (rootStart < 0 || blockStart < 0 || blockEnd < 0) return new Map();

  return new Map(
    Array.from(css.slice(blockStart + 1, blockEnd).matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g))
      .map(match => [match[1]!, match[2]!.trim()]),
  );
}

function normalizeCssValue(value: string): string {
  return value.replace(/\s+/g, '').toLowerCase();
}

function toKebabCase(value: string): string {
  return value.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`);
}

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

  it('keeps light and dark token groups complete against the production CSS mapping', () => {
    for (const group of Object.keys(DESIGN_TOKEN_CSS_VARIABLES) as Array<keyof typeof DESIGN_TOKEN_CSS_VARIABLES>) {
      for (const tokenName of Object.keys(DESIGN_TOKEN_CSS_VARIABLES[group])) {
        expect((LIGHT_TOKENS[group] as Record<string, string>)[tokenName], `light ${group}.${tokenName}`).toBeTruthy();
        expect((DARK_TOKENS[group] as Record<string, string>)[tokenName], `dark ${group}.${tokenName}`).toBeTruthy();
      }
    }
  });

  it('keeps semantic states distinct from decorative Cosmos roles', () => {
    for (const tokens of [LIGHT_TOKENS, DARK_TOKENS]) {
      expect(tokens.colors.warning).not.toBe(tokens.colors.danger);
      expect(tokens.colors.success).not.toBe(tokens.colors.selected);
      expect(tokens.colors.focus).not.toBe(tokens.colors.background);
      expect(tokens.colors.disabled).not.toBe(tokens.colors.text);
      expect(tokens.cosmosDecorative.paleBlueDot).not.toBe(tokens.colors.danger);
      expect(tokens.cosmosDecorative.paleBlueDot).not.toBe(tokens.colors.success);
    }
  });

  it('tokensForMode switches palette', () => {
    expect(tokensForMode('light')).toBe(LIGHT_TOKENS);
    expect(tokensForMode('dark')).toBe(DARK_TOKENS);
  });

  it('applyTokensToElement sets CSS variables', () => {
    const style = { setProperty: vi.fn() } as unknown as CSSStyleDeclaration;
    const el = { style } as unknown as HTMLElement;
    applyTokensToElement(el, LIGHT_TOKENS);
    const expected = resolveDesignTokenCssVariables(LIGHT_TOKENS);
    expect(style.setProperty).toHaveBeenCalledTimes(Object.keys(expected).length);
    for (const [variable, value] of Object.entries(expected)) {
      expect(style.setProperty).toHaveBeenCalledWith(variable, value);
    }
  });

  it('synchronizes the light bootstrap fallback with the production token mapping', () => {
    const css = readFileSync(join(process.cwd(), 'src', 'index.css'), 'utf8');
    const rootVariables = parseRootVariables(css);
    const expected = resolveDesignTokenCssVariables(LIGHT_TOKENS);

    for (const [variable, value] of Object.entries(expected)) {
      expect(rootVariables.has(variable), `${variable} bootstrap fallback`).toBe(true);
      expect(normalizeCssValue(rootVariables.get(variable)!), variable)
        .toBe(normalizeCssValue(value));
    }

    const typedPrefixes = ['--color-', '--spacing-', '--radius-', '--shadow-', '--cosmos-'];
    const bootstrapOwned = Array.from(rootVariables.keys()).filter(variable => (
      typedPrefixes.some(prefix => variable.startsWith(prefix)) || variable === '--font-heading'
    ));
    expect(new Set(bootstrapOwned)).toEqual(new Set(Object.keys(expected)));
  });

  it('exposes the new semantic and decorative roles through Tailwind', () => {
    const colors = tailwindConfig.theme.extend.colors;
    const semanticMappings = {
      'surface-elevated': DESIGN_TOKEN_CSS_VARIABLES.colors.surfaceElevated,
      'surface-muted': DESIGN_TOKEN_CSS_VARIABLES.colors.surfaceMuted,
      selected: DESIGN_TOKEN_CSS_VARIABLES.colors.selected,
      warning: DESIGN_TOKEN_CSS_VARIABLES.colors.warning,
      focus: DESIGN_TOKEN_CSS_VARIABLES.colors.focus,
      disabled: DESIGN_TOKEN_CSS_VARIABLES.colors.disabled,
      overlay: DESIGN_TOKEN_CSS_VARIABLES.colors.overlay,
    };

    for (const [utility, variable] of Object.entries(semanticMappings)) {
      expect(colors[utility]).toBe(`var(${variable})`);
    }

    const cosmos = colors.cosmos as Record<string, string>;
    for (const [tokenName, variable] of Object.entries(DESIGN_TOKEN_CSS_VARIABLES.cosmosDecorative)) {
      expect(cosmos[toKebabCase(tokenName)]).toBe(`var(${variable})`);
    }
  });
});
