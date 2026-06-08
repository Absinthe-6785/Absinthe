// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { makeBlock } from './blockUtils';
import { deleteSelectedBlocks, duplicateSelectedBlocks } from './multiBlockOps';
import {
  finishGutterSelection,
  isGutterDragStart,
  updateGutterSelection,
} from './blockGutterSelection';

describe('blockGutterSelection', () => {
  const blocks = ['a', 'b', 'c', 'd', 'e'].map(id =>
    ({ ...makeBlock('paragraph', { content: id }), id }),
  );

  it('drag B→D selects B,C,D', () => {
    expect([...updateGutterSelection(blocks, 'b', 'd')]).toEqual(['b', 'c', 'd']);
  });

  it('reverse drag D→B selects B,C,D', () => {
    expect([...updateGutterSelection(blocks, 'd', 'b')]).toEqual(['b', 'c', 'd']);
  });

  it('parent boundary clamp', () => {
    const withToggle = [
      blocks[0],
      blocks[1],
      {
        ...makeBlock('toggle', { id: 't', children: [
          { ...makeBlock('paragraph'), id: 'x' },
          { ...makeBlock('paragraph'), id: 'y' },
        ] }),
      },
      ...blocks.slice(2),
    ];
    expect([...updateGutterSelection(withToggle, 'b', 'x')]).toEqual(['b']);
    expect([...updateGutterSelection(withToggle, 'x', 'c')]).toEqual(['x']);
  });

  it('isGutterDragStart accepts strip only', () => {
    document.body.innerHTML = `
      <div class="be-gutter">
        <div class="be-gutter-strip"></div>
        <button class="be-grip"></button>
      </div>`;
    expect(isGutterDragStart(document.querySelector('.be-gutter-strip'))).toBe(true);
    expect(isGutterDragStart(document.querySelector('.be-grip'))).toBe(false);
  });

  it('delete/duplicate regression on gutter range', () => {
    const selected = updateGutterSelection(blocks, 'b', 'd');
    expect(deleteSelectedBlocks(blocks, selected).map(b => b.id)).toEqual(['a', 'e']);
    const dup = duplicateSelectedBlocks(blocks, selected);
    expect(dup).toHaveLength(8);
    expect(dup.map(b => b.id).slice(0, 4)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('finishGutterSelection keeps anchor', () => {
    const r = finishGutterSelection(blocks, 'b', 'd');
    expect([...r.selected]).toEqual(['b', 'c', 'd']);
    expect(r.anchorId).toBe('b');
  });
});
