// @vitest-environment happy-dom
import { createElement } from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ThemeProvider } from './ThemeProvider';
import {
  DARK_TOKENS,
  LIGHT_TOKENS,
  resolveDesignTokenCssVariables,
} from './tokens';

const themeState = vi.hoisted(() => ({ darkMode: false }));

vi.mock('../store/useAppStore', () => ({
  useAppStore: (
    selector: (state: { appSettings: { darkMode: boolean } }) => unknown,
  ) => selector({ appSettings: { darkMode: themeState.darkMode } }),
}));

describe('ThemeProvider token application', () => {
  let container: HTMLDivElement | null = null;

  afterEach(() => {
    container?.remove();
    container = null;
    document.documentElement.removeAttribute('data-theme');

    for (const variable of Object.keys(resolveDesignTokenCssVariables(LIGHT_TOKENS))) {
      document.documentElement.style.removeProperty(variable);
    }
  });

  it.each([
    ['light', false, LIGHT_TOKENS],
    ['dark', true, DARK_TOKENS],
  ] as const)('applies every mapped %s token to the document root', async (mode, darkMode, tokens) => {
    themeState.darkMode = darkMode;
    container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(createElement(ThemeProvider, null, createElement('span')));
    });

    expect(document.documentElement.getAttribute('data-theme')).toBe(mode);
    for (const [variable, value] of Object.entries(resolveDesignTokenCssVariables(tokens))) {
      expect(document.documentElement.style.getPropertyValue(variable), variable).toBe(value);
    }

    act(() => root.unmount());
  });
});
