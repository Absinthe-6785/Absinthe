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

  it('recognizes hyphenated, Korean, and Japanese tags as whole tokens', () => {
    const hyphenatedRead = renderInlineMarkdownHtml('#work-notes', c);
    const koreanRead = renderInlineMarkdownHtml('#노트-태그', c);
    const japaneseRead = renderInlineMarkdownHtml('#東京_日記', c);
    const hyphenatedEdit = liveInlineHtml('#work-notes', c);
    const koreanEdit = liveInlineHtml('#노트-태그', c);
    const japaneseEdit = liveInlineHtml('#東京_日記', c);

    for (const [html, tag] of [
      [hyphenatedRead, 'work-notes'], [koreanRead, '노트-태그'], [japaneseRead, '東京_日記'],
      [hyphenatedEdit, 'work-notes'], [koreanEdit, '노트-태그'], [japaneseEdit, '東京_日記'],
    ]) {
      expect(html).toContain(`data-tag="${tag}"`);
    }
  });

  it('keeps tag-looking text inside inline code untouched in reading and editing renderers', () => {
    const source = 'literal `example #tag`';
    expect(renderInlineMarkdownHtml(source, c)).toContain('<code style=');
    expect(renderInlineMarkdownHtml(source, c)).toContain('example #tag</code>');
    expect(renderInlineMarkdownHtml(source, c)).not.toContain('data-tag=');
    expect(liveInlineHtml(source, c)).toContain('example #tag');
    expect(liveInlineHtml(source, c)).not.toContain('data-tag=');
  });

  it('does not turn tags inside wiki links or footnote references into nested tag markup', () => {
    const source = '[[#topic]] [^#ref]';
    const read = renderInlineMarkdownHtml(source, c);
    const edit = liveInlineHtml(source, c);

    for (const html of [read, edit]) {
      expect(html).not.toContain('data-tag=');
      expect(html).toContain('#topic');
      expect(html).toContain('#ref');
    }
  });

  it('recognizes tags across formatting and punctuation without interpreting math or HTML source', () => {
    const source = '**bold #태그-name**, (#東京), $\\text{#literal-tag}$ <img src=x>';
    const read = renderInlineMarkdownHtml(source, c);
    const edit = liveInlineHtml(source, c);

    for (const html of [read, edit]) {
      expect(html).toContain('data-tag="태그-name"');
      expect(html).toContain('data-tag="東京"');
      expect(html).not.toContain('data-tag="literal-tag"');
      expect(html).not.toContain('<img src=x>');
    }
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
