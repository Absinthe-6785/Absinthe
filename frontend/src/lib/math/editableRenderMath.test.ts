import { describe, expect, it, vi } from 'vitest';

vi.mock('katex', () => ({
  default: {
    renderToString: (expr: string) => `<span class="katex">${expr}</span>`,
  },
}));

import {
  liveInlineHtml,
  renderInlineMarkdownHtml,
} from '../../components/views/editableRender';
import type { BlockEditorColors } from '../../components/views/editorTypes';

const c: BlockEditorColors = {
  bg: '#fff', text: '#111', textMuted: '#666', textFaint: '#999',
  accent: '#8B5CF6', accentBg: '#eee', border: '#ddd', card: '#fff',
  cardHov: '#f5f5f5', input: '#fff', inputBdr: '#ccc', toolbar: '#f9f9f9',
  danger: '#f00', green: '#0f0', codeBg: '#f1f5f9', calloutBg: '#fafafa',
  toggleBg: 'transparent', quoteBdr: '#ccc', selection: '#eef',
};

describe('editableRender math', () => {
  it('renders inline math in read-only mode', () => {
    const html = renderInlineMarkdownHtml('Theorem: $a^2+b^2=c^2$.', c);
    expect(html).toContain('be-math-inline');
    expect(html).toContain('katex');
    expect(html).toContain('a^2+b^2=c^2');
  });

  it('renders display math centered', () => {
    const html = renderInlineMarkdownHtml('$$\\frac{1}{2}$$', c);
    expect(html).toContain('be-math-display');
    expect(html).toContain('katex');
  });

  it('does not render currency as math', () => {
    const html = renderInlineMarkdownHtml('Pay $5 or $10.', c);
    expect(html).not.toContain('be-math-inline');
    expect(html).toContain('$5');
    expect(html).toContain('$10');
  });

  it('preserves raw LaTeX in live edit placeholders', () => {
    const html = liveInlineHtml('Use $x^2$ here.', c);
    expect(html).toContain('be-live-math-inline');
    expect(html).toContain('be-live-code');
    expect(html).toContain('x^2');
  });

  it('highlights search matches inside math source', () => {
    const html = renderInlineMarkdownHtml('$$b^2-4ac$$', c, 'b^2-4ac');
    expect(html).toContain('be-math-search-hl');
  });
});
