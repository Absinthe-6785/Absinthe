// @vitest-environment happy-dom
import { createElement } from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useIsMobile } from './useIsMobile';
import { useViewportLayout } from './useViewportLayout';
import { VIEWPORT_MEDIA_QUERIES } from '../lib/responsiveLayout';

const mediaListeners = new Set<() => void>();

function setViewportWidth(width: number): void {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
  mediaListeners.forEach(listener => listener());
}

function ViewportProbe() {
  const mobile = useIsMobile();
  const layout = useViewportLayout();
  return createElement('output', {
    'data-mobile-hook': mobile ? 'true' : 'false',
    'data-layout-mobile': layout.isMobile ? 'true' : 'false',
    'data-layout-category': layout.category,
    'data-layout-narrow': layout.isNarrow ? 'true' : 'false',
  });
}

describe('viewport hooks', () => {
  let root: Root;
  let container: HTMLDivElement;

  beforeEach(() => {
    mediaListeners.clear();
    vi.stubGlobal('matchMedia', vi.fn((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: (_type: string, listener: () => void) => mediaListeners.add(listener),
      removeEventListener: (_type: string, listener: () => void) => mediaListeners.delete(listener),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })));
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  it.each([
    [767, 'true', 'mobile', 'true'],
    [768, 'false', 'tablet', 'true'],
    [769, 'false', 'tablet', 'true'],
    [1023, 'false', 'tablet', 'true'],
    [1024, 'false', 'desktop', 'true'],
    [1025, 'false', 'desktop', 'true'],
    [1279, 'false', 'desktop', 'true'],
    [1280, 'false', 'wide', 'false'],
    [1281, 'false', 'wide', 'false'],
  ] as const)('keeps both hooks aligned at %ipx', async (width, mobile, category, narrow) => {
    setViewportWidth(width);
    await act(async () => root.render(createElement(ViewportProbe)));
    const output = container.querySelector('output');
    expect(output?.getAttribute('data-mobile-hook')).toBe(mobile);
    expect(output?.getAttribute('data-layout-mobile')).toBe(mobile);
    expect(output?.getAttribute('data-layout-category')).toBe(category);
    expect(output?.getAttribute('data-layout-narrow')).toBe(narrow);
  });

  it('updates when the viewport crosses the wide boundary', async () => {
    setViewportWidth(1279);
    await act(async () => root.render(createElement(ViewportProbe)));
    expect(container.querySelector('output')?.getAttribute('data-layout-category')).toBe('desktop');

    await act(async () => setViewportWidth(1280));
    const output = container.querySelector('output');
    expect(output?.getAttribute('data-layout-category')).toBe('wide');
    expect(output?.getAttribute('data-layout-narrow')).toBe('false');
    expect(vi.mocked(window.matchMedia).mock.calls.map(([query]) => query)).toEqual([
      VIEWPORT_MEDIA_QUERIES.mobile,
      VIEWPORT_MEDIA_QUERIES.mobile,
      VIEWPORT_MEDIA_QUERIES.compact,
      VIEWPORT_MEDIA_QUERIES.narrow,
    ]);
  });
});
