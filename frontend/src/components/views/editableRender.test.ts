import { describe, expect, it } from 'vitest';
import {
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
});
