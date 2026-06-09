// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { htmlDocumentToBlocks } from './htmlDocumentToBlocks';

/** Regression: table must not swallow surrounding blocks (original Plus / paste bug). */
const TABLE_SANDWICH_HTML = `<h1>Title</h1>
<p>A</p>
<table>
<thead><tr><th>Col</th></tr></thead>
<tbody><tr><td>1</td></tr></tbody>
</table>
<p>B</p>
<ul><li>C</li></ul>`;

describe('htmlDocumentToBlocks', () => {
  it('preserves DOM order in table sandwich fixture', () => {
    const blocks = htmlDocumentToBlocks(TABLE_SANDWICH_HTML);
    expect(blocks).toBeTruthy();
    expect(blocks!.map(b => b.type)).toEqual([
      'heading1',
      'paragraph',
      'table',
      'paragraph',
      'bullet',
    ]);
    expect(blocks![0].content).toBe('Title');
    expect(blocks![1].content).toBe('A');
    expect(blocks![2].tableHeaders).toEqual(['Col']);
    expect(blocks![3].content).toBe('B');
    expect(blocks![4].content).toBe('C');
  });

  it('maps h1–h4 headings (h4 → heading3)', () => {
    const html = '<h1>H1</h1><h2>H2</h2><h3>H3</h3><h4>H4</h4>';
    const blocks = htmlDocumentToBlocks(html)!;
    expect(blocks.map(b => b.type)).toEqual(['heading1', 'heading2', 'heading3', 'heading3']);
    expect(blocks[3].content).toBe('H4');
  });

  it('maps h5/h6 to heading3', () => {
    const blocks = htmlDocumentToBlocks('<h5>H5</h5><h6>H6</h6>')!;
    expect(blocks.every(b => b.type === 'heading3')).toBe(true);
  });

  it('parses details/summary as toggle blocks (UX-3A)', () => {
    const blocks = htmlDocumentToBlocks(
      '<details><summary>Summary</summary><p>Body</p></details>',
    )!;
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe('toggle');
    expect(blocks[0].content).toBe('Summary');
    expect(blocks[0].children[0].type).toBe('paragraph');
    expect(blocks[0].children[0].content).toBe('Body');
  });

  it('callout-like div falls back to paragraph (no callout detection)', () => {
    const blocks = htmlDocumentToBlocks(
      '<div class="callout">Important note</div>',
    )!;
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe('paragraph');
    expect(blocks[0].content).toBe('Important note');
  });

  it('unwraps wrapper divs and walks children in order', () => {
    const html = '<div><p>One</p><p>Two</p></div>';
    const blocks = htmlDocumentToBlocks(html)!;
    expect(blocks.map(b => b.content)).toEqual(['One', 'Two']);
  });

  it('parses blockquote, pre, hr, and nested lists', () => {
    const html = '<blockquote>Q</blockquote><pre>code</pre><hr><ul><li>a<ul><li>b</li></ul></li></ul>';
    const blocks = htmlDocumentToBlocks(html)!;
    expect(blocks[0].type).toBe('quote');
    expect(blocks[1].type).toBe('code');
    expect(blocks[2].type).toBe('divider');
    expect(blocks[3].type).toBe('bullet');
    expect(blocks[4].type).toBe('bullet');
    expect(blocks[4].indent).toBe(1);
  });

  it('returns null for empty HTML', () => {
    expect(htmlDocumentToBlocks('')).toBeNull();
    expect(htmlDocumentToBlocks('   ')).toBeNull();
  });
});
