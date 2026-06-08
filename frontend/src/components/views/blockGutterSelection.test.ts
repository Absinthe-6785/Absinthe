// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { makeBlock } from './blockUtils';
import { deleteSelectedBlocks, duplicateSelectedBlocks } from './multiBlockOps';
import {
  beginGutterSelection,
  finishGutterSelection,
  hitTestBlockIdFromPoint,
  isGutterDragStart,
  isTextSelectionTarget,
  updateGutterSelection,
} from './blockGutterSelection';

describe('blockGutterSelection', () => {
  const rootSiblings = ['a', 'b', 'c', 'd', 'e'];
  const blocks = rootSiblings.map(id => ({ ...makeBlock('paragraph', { content: id }), id }));
  const withToggle = [
    ...blocks.slice(0, 2),
    {
      ...makeBlock('toggle', { id: 't', children: [
        { ...makeBlock('paragraph'), id: 'x' },
        { ...makeBlock('paragraph'), id: 'y' },
      ] }),
    },
    ...blocks.slice(2),
  ];

  it('beginGutterSelection stores anchor and pointer', () => {
    expect(beginGutterSelection('b', 1)).toEqual({ anchorId: 'b', pointerId: 1 });
  });

  it('anchor equals hover selects single block', () => {
    expect([...updateGutterSelection(blocks, 'c', 'c')]).toEqual(['c']);
  });

  it('drag B→D selects B,C,D', () => {
    expect([...updateGutterSelection(blocks, 'b', 'd')]).toEqual(['b', 'c', 'd']);
  });

  it('reverse drag D→B selects B,C,D', () => {
    expect([...updateGutterSelection(blocks, 'd', 'b')]).toEqual(['b', 'c', 'd']);
  });

  it('parent boundary clamp: root anchor cannot select toggle child', () => {
    expect([...updateGutterSelection(withToggle, 'b', 'x')]).toEqual(['b']);
  });

  it('parent boundary clamp: toggle child cannot select root sibling', () => {
    expect([...updateGutterSelection(withToggle, 'x', 'c')]).toEqual(['x']);
  });

  it('toggle siblings select in range', () => {
    expect([...updateGutterSelection(withToggle, 'x', 'y')]).toEqual(['x', 'y']);
  });

  it('finishGutterSelection returns stable anchor', () => {
    const r = finishGutterSelection(blocks, 'b', 'd');
    expect([...r.selected]).toEqual(['b', 'c', 'd']);
    expect(r.anchorId).toBe('b');
  });

  it('isGutterDragStart accepts gutter, rejects grip', () => {
    document.body.innerHTML = `
      <div class="be-gutter"><button class="be-grip">g</button><span class="zone"></span></div>
    `;
    const gutter = document.querySelector('.be-gutter')!;
    const zone = document.querySelector('.zone')!;
    const grip = document.querySelector('.be-grip')!;
    expect(isGutterDragStart(zone)).toBe(true);
    expect(isGutterDragStart(grip)).toBe(false);
    expect(isGutterDragStart(gutter)).toBe(true);
  });

  it('isTextSelectionTarget detects contentEditable', () => {
    const el = document.createElement('div');
    el.contentEditable = 'true';
    expect(isTextSelectionTarget(el)).toBe(true);
    expect(isTextSelectionTarget(document.createElement('div'))).toBe(false);
  });

  it('hitTestBlockIdFromPoint resolves data-drag-id', () => {
    const root = document.createElement('div');
    root.className = 'be-editor-root';
    root.innerHTML = `
      <div class="be-block" data-drag-id="b"><div class="be-content"><p>hi</p></div></div>
    `;
    document.body.appendChild(root);
    const p = root.querySelector('p')!;
    const rect = { left: 0, top: 0, width: 10, height: 10, right: 10, bottom: 10 };
    p.getBoundingClientRect = () => rect as DOMRect;
    (document as Document).elementFromPoint = () => p;
    expect(hitTestBlockIdFromPoint(5, 5, root)).toBe('b');
  });

  it('delete selected blocks regression after gutter range', () => {
    const selected = updateGutterSelection(blocks, 'b', 'd');
    const next = deleteSelectedBlocks(blocks, selected);
    expect(next.map(b => b.id)).toEqual(['a', 'e']);
  });

  it('duplicate selected blocks regression after gutter range', () => {
    const selected = updateGutterSelection(blocks, 'b', 'd');
    const next = duplicateSelectedBlocks(blocks, selected);
    const ids = next.map(b => b.id);
    expect(ids).toHaveLength(8);
    expect(ids.slice(0, 4)).toEqual(['a', 'b', 'c', 'd']);
    expect(ids[7]).toBe('e');
    expect(new Set(ids).size).toBe(8);
  });
});
