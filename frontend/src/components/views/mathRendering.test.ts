import { describe, expect, it, vi } from 'vitest';

vi.mock('katex', () => ({
  default: {
    renderToString: (expr: string, opts: { displayMode: boolean; throwOnError: boolean }) =>
      `<span data-katex="${expr}" data-display="${opts.displayMode}"></span>`,
  },
}));

import { renderKatexHtml } from './mathRendering';

describe('mathRendering', () => {
  it('returns null for empty expression', () => {
    expect(renderKatexHtml('')).toBeNull();
    expect(renderKatexHtml('   ')).toBeNull();
  });

  it('renders valid LaTeX via bundled katex', () => {
    const html = renderKatexHtml('a^2');
    expect(html).toContain('data-katex="a^2"');
    expect(html).toContain('data-display="true"');
  });

  it('renders inline mode when displayMode is false', () => {
    const html = renderKatexHtml('x^2', false);
    expect(html).toContain('data-display="false"');
  });

  it('renders quadratic formula display math', () => {
    const html = renderKatexHtml(String.raw`\frac{-b\pm\sqrt{b^2-4ac}}{2a}`, true);
    expect(html).toContain('data-katex');
  });

  it('renders align environment', () => {
    const html = renderKatexHtml(String.raw`\begin{align}a&=b\\c&=d\end{align}`, true);
    expect(html).toBeTruthy();
  });

  it('renders matrix environment', () => {
    const html = renderKatexHtml(String.raw`\begin{pmatrix}1&0\\0&1\end{pmatrix}`, true);
    expect(html).toBeTruthy();
  });
});
