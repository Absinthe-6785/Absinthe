// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { htmlDocumentToBlocks } from './features/block-editor/features/clipboard';
import { isDetailsToggleElement, toggleBlockFromDetails } from './htmlToggleParser';

describe('htmlToggleParser', () => {
  it('isDetailsToggleElement matches details and .btoggle', () => {
    const details = new DOMParser().parseFromString('<details><summary>x</summary></details>', 'text/html')
      .body.firstElementChild!;
    const btoggle = new DOMParser().parseFromString(
      '<div class="btoggle"><summary>x</summary></div>', 'text/html',
    ).body.firstElementChild!;
    expect(isDetailsToggleElement(details)).toBe(true);
    expect(isDetailsToggleElement(btoggle)).toBe(true);
    expect(isDetailsToggleElement(document.createElement('div'))).toBe(false);
  });

  it('toggleBlockFromDetails returns null without summary', () => {
    const el = new DOMParser().parseFromString('<details><p>orphan</p></details>', 'text/html')
      .body.firstElementChild as HTMLElement;
    const result = toggleBlockFromDetails(el, () => []);
    expect(result).toBeNull();
  });

  it('parses open/collapsed from details.open', () => {
    const openHtml = '<details open><summary>Open</summary></details>';
    const closedHtml = '<details><summary>Closed</summary></details>';
    const openEl = new DOMParser().parseFromString(openHtml, 'text/html').body.firstElementChild as HTMLElement;
    const closedEl = new DOMParser().parseFromString(closedHtml, 'text/html').body.firstElementChild as HTMLElement;
    expect(toggleBlockFromDetails(openEl, () => [])?.collapsed).toBe(false);
    expect(toggleBlockFromDetails(closedEl, () => [])?.collapsed).toBe(true);
  });

  it('empty toggle children remain []', () => {
    const el = new DOMParser().parseFromString(
      '<details><summary>Empty</summary></details>', 'text/html',
    ).body.firstElementChild as HTMLElement;
    const block = toggleBlockFromDetails(el, () => [])!;
    expect(block.type).toBe('toggle');
    expect(block.children).toEqual([]);
  });

  it('reads body from .btbody wrapper (Absinthe export)', () => {
    const html = `<details class="btoggle">
      <summary class="btsummary">Title</summary>
      <div class="btbody"><p>Body line</p></div>
    </details>`;
    const blocks = htmlDocumentToBlocks(html)!;
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe('toggle');
    expect(blocks[0].content).toBe('Title');
    expect(blocks[0].children).toHaveLength(1);
    expect(blocks[0].children[0].type).toBe('paragraph');
    expect(blocks[0].children[0].content).toBe('Body line');
  });
});

describe('htmlDocumentToBlocks toggle integration', () => {
  it('Notion-style details → toggle with body children', () => {
    const html = '<details><summary>Notion toggle</summary><p>Child A</p><p>Child B</p></details>';
    const blocks = htmlDocumentToBlocks(html)!;
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe('toggle');
    expect(blocks[0].content).toBe('Notion toggle');
    expect(blocks[0].children.map(c => c.content)).toEqual(['Child A', 'Child B']);
  });

  it('preserves nested toggle hierarchy', () => {
    const html = `<details open>
      <summary>Outer</summary>
      <p>Outer child</p>
      <details>
        <summary>Inner</summary>
        <p>Inner child</p>
      </details>
    </details>`;
    const blocks = htmlDocumentToBlocks(html)!;
    expect(blocks).toHaveLength(1);
    const outer = blocks[0];
    expect(outer.type).toBe('toggle');
    expect(outer.content).toBe('Outer');
    expect(outer.children[0].content).toBe('Outer child');
    const inner = outer.children[1];
    expect(inner.type).toBe('toggle');
    expect(inner.content).toBe('Inner');
    expect(inner.children[0].content).toBe('Inner child');
  });

  it('Absinthe .btoggle copy round-trip preserves structure', () => {
    const html = `<details class="btoggle" id="btg-abc">
      <summary class="btsummary">Exported</summary>
      <div class="btbody"><p>Line 1</p><ul><li>nested list</li></ul></div>
    </details>`;
    const blocks = htmlDocumentToBlocks(html)!;
    expect(blocks[0].type).toBe('toggle');
    expect(blocks[0].content).toBe('Exported');
    expect(blocks[0].children[0].content).toBe('Line 1');
    expect(blocks[0].children[1].type).toBe('bullet');
    expect(blocks[0].children[1].content).toBe('nested list');
  });

  it('details without summary falls back to paragraph', () => {
    const blocks = htmlDocumentToBlocks('<details><p>no summary</p></details>')!;
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe('paragraph');
    expect(blocks[0].content).toMatch(/no summary/);
  });
});
