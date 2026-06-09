// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { makeBlock } from './blockUtils';
import {
  applyPasteAtBlock,
  applyPasteBlocksAt,
  clipboardToBlocks,
} from './features/block-editor/features/clipboard';

describe('toggle header paste (UX-3A)', () => {
  const toggle = makeBlock('toggle', {
    id: 't1',
    content: 'Header',
    children: [makeBlock('paragraph', { content: 'child' })],
  });
  const after = makeBlock('paragraph', { id: 'after', content: 'after' });

  it('multi-block paste on toggle header inserts siblings, preserves children', () => {
    const pasted = [
      makeBlock('paragraph', { content: 'P1' }),
      makeBlock('paragraph', { content: 'P2' }),
    ];
    const result = applyPasteBlocksAt([toggle, after], 't1', 6, 6, pasted)!;
    expect(result.blocks.map(b => b.type)).toEqual(['toggle', 'paragraph', 'paragraph', 'paragraph']);
    const t = result.blocks[0];
    expect(t.id).toBe('t1');
    expect(t.content).toBe('Header');
    expect(t.children).toHaveLength(1);
    expect(t.children[0].content).toBe('child');
    expect(result.blocks[1].content).toBe('P1');
    expect(result.blocks[2].content).toBe('P2');
    expect(result.blocks[3].id).toBe('after');
  });

  it('single paragraph paste merges into toggle header', () => {
    const pasted = [makeBlock('paragraph', { content: ' text' })];
    const result = applyPasteBlocksAt([toggle], 't1', 6, 6, pasted)!;
    expect(result.blocks).toHaveLength(1);
    expect(result.blocks[0].content).toBe('Header text');
    expect(result.blocks[0].children[0].content).toBe('child');
    expect(result.focusBlockId).toBe('t1');
  });

  it('single non-paragraph block paste becomes sibling', () => {
    const pasted = [makeBlock('heading2', { content: 'Sub' })];
    const result = applyPasteBlocksAt([toggle], 't1', 0, 0, pasted)!;
    expect(result.blocks).toHaveLength(2);
    expect(result.blocks[0].type).toBe('toggle');
    expect(result.blocks[1].type).toBe('heading2');
    expect(result.blocks[1].content).toBe('Sub');
  });

  it('multiline plain paste on toggle header inserts siblings', () => {
    const result = applyPasteAtBlock([toggle, after], 't1', 6, 6, '- one\n- two')!;
    expect(result.blocks[0].type).toBe('toggle');
    expect(result.blocks[0].children[0].content).toBe('child');
    expect(result.blocks[1].type).toBe('bullet');
    expect(result.blocks[2].type).toBe('bullet');
    expect(result.blocks[3].id).toBe('after');
  });

  it('inline plain paste on toggle header merges header text', () => {
    const result = applyPasteAtBlock([toggle], 't1', 6, 6, '!');
    expect(result?.blocks[0].content).toBe('Header!');
    expect(result?.blocks[0].children[0].content).toBe('child');
  });

  it('Absinthe HTML copy → paste round-trip via clipboardToBlocks + applyPasteBlocksAt', () => {
    const html = `<details class="btoggle">
      <summary class="btsummary">Copied</summary>
      <div class="btbody"><p>Inside</p></div>
    </details>`;
    const dt = { getData: (t: string) => (t === 'text/html' ? html : '') };
    const pasted = clipboardToBlocks(dt)!;
    expect(pasted[0].type).toBe('toggle');
    expect(pasted[0].children[0].content).toBe('Inside');

    const host = makeBlock('toggle', { id: 'host', content: 'Host', children: [] });
    const result = applyPasteBlocksAt([host], 'host', 4, 4, pasted)!;
    expect(result.blocks[0].content).toBe('Host');
    expect(result.blocks[1].type).toBe('toggle');
    expect(result.blocks[1].content).toBe('Copied');
    expect(result.blocks[1].children[0].content).toBe('Inside');
  });
});
