import { describe, expect, it } from 'vitest';
import {
  applySearchHighlight,
  escHtml,
  liveInlineHtml,
  renderInlineMarkdownHtml,
} from './editableRender';
import type { BlockEditorColors } from './editorTypes';

const c: BlockEditorColors = {
  bg: '#fff', text: '#111', textMuted: '#666', textFaint: '#999',
  accent: '#8B5CF6', accentBg: '#eee', border: '#ddd', card: '#fff',
  cardHov: '#f5f5f5', input: '#fff', inputBdr: '#ccc', toolbar: '#f9f9f9',
  danger: '#f00', green: '#0f0', codeBg: '#f1f5f9', calloutBg: '#fafafa',
  toggleBg: 'transparent', quoteBdr: '#ccc', selection: '#eef',
};

describe('editableRender', () => {
  it('escHtml escapes entities', () => {
    expect(escHtml('<a&>')).toBe('&lt;a&amp;&gt;');
  });

  it('renderInlineMarkdownHtml bold', () => {
    expect(renderInlineMarkdownHtml('**bold**', c)).toContain('<strong>bold</strong>');
  });

  it('renderInlineMarkdownHtml italic', () => {
    expect(renderInlineMarkdownHtml('*x*', c)).toContain('<em>x</em>');
  });

  it('renderInlineMarkdownHtml wiki link', () => {
    const html = renderInlineMarkdownHtml('[[Note]]', c, '', ['Note']);
    expect(html).toContain('be-wikilink');
    expect(html).toContain('data-wiki="Note"');
  });

  it('renderInlineMarkdownHtml broken wiki', () => {
    const html = renderInlineMarkdownHtml('[[Missing]]', c, '', ['Other']);
    expect(html).toContain('be-wikilink-broken');
  });

  it('renderInlineMarkdownHtml tag', () => {
    const html = renderInlineMarkdownHtml('hello #tag', c);
    expect(html).toContain('be-tag');
    expect(html).toContain('#tag');
  });

  it('liveInlineHtml wiki chip', () => {
    const html = liveInlineHtml('[[X]]', c, ['X']);
    expect(html).toContain('be-wiki-chip');
    expect(html).toContain('be-bracket');
  });

  it('liveInlineHtml bold with markers', () => {
    const html = liveInlineHtml('**b**', c);
    expect(html).toContain('be-mark');
    expect(html).toContain('<strong>');
  });

  it('mixed formatting', () => {
    const html = liveInlineHtml('**[[w]]**', c, ['w']);
    expect(html).toContain('<strong>');
    expect(html).toContain('be-wiki-chip');
  });

  it('applySearchHighlight does not match inside HTML tags or attributes', () => {
    const html = '<em><span class="be-mark">*</span>hello<span class="be-mark">*</span></em>';
    expect(applySearchHighlight(html, 'em')).toBe(html);
    expect(applySearchHighlight(html, 'mark')).toBe(html);
    expect(applySearchHighlight(html, 'be-mark')).toBe(html);
  });

  it('applySearchHighlight wraps visible text only', () => {
    expect(applySearchHighlight('<em>hello</em>', 'hel'))
      .toBe('<em><mark class="be-search-hl">hel</mark>lo</em>');
  });

  it('liveInlineHtml search does not corrupt decoration markup', () => {
    const html = liveInlineHtml('*italic*', c, [], 'italic');
    expect(html).not.toMatch(/e-mark"><em>/);
    expect(html).toContain('be-search-hl');
    expect(html).toContain('<em>');
  });

  it('renderInlineMarkdownHtml search does not corrupt emphasis tags', () => {
    const html = renderInlineMarkdownHtml('*italic text*', c, 'em');
    expect(html).not.toMatch(/e-mark"><em>/);
    expect(html).toContain('<em>');
  });
});
