import { describe, expect, it, afterEach, beforeAll } from 'vitest';
import { renderKatexHtml } from './mathRendering';

type KatexWindow = Window & { katex?: { renderToString: (expr: string, opts: { displayMode: boolean; throwOnError: boolean }) => string } };

describe('mathRendering', () => {
  let origKatex: KatexWindow['katex'];

  beforeAll(() => {
    if (typeof globalThis.window === 'undefined') {
      (globalThis as typeof globalThis & { window: KatexWindow }).window = globalThis as unknown as KatexWindow;
    }
    origKatex = window.katex;
  });

  afterEach(() => {
    if (origKatex) window.katex = origKatex;
    else delete (window as KatexWindow).katex;
  });

  it('returns null for empty expression', () => {
    expect(renderKatexHtml('')).toBeNull();
    expect(renderKatexHtml('   ')).toBeNull();
  });

  it('returns null when katex is unavailable', () => {
    delete (window as { katex?: unknown }).katex;
    expect(renderKatexHtml('x^2')).toBeNull();
  });

  it('renders valid LaTeX via katex', () => {
    window.katex = {
      renderToString: (expr, opts) => `<span data-katex="${expr}" data-display="${opts.displayMode}"></span>`,
    };
    const html = renderKatexHtml('a^2');
    expect(html).toContain('data-katex="a^2"');
    expect(html).toContain('data-display="true"');
  });

  it('returns null when katex throws', () => {
    window.katex = {
      renderToString: () => { throw new Error('bad'); },
    };
    expect(renderKatexHtml('\\bad')).toBeNull();
  });

  it('uses throwOnError false path for invalid but non-throwing katex', () => {
    window.katex = {
      renderToString: () => '',
    };
    expect(renderKatexHtml('\\invalid')).toBe('');
  });
});
