import { describe, expect, it } from 'vitest';
import { makeBlock } from '../../../../../blockUtils';
import {
  applyPointerSelection,
  clearSelection,
  extendSelectionByArrow,
  getDocumentOrderedIds,
  haveSameParent,
  selectRange,
  selectSingle,
  toggleInSelection,
  isBlockVisuallySelected,
} from './blockSelection';

describe('blockSelection', () => {
  const blocks = [
    { ...makeBlock('paragraph'), id: 'a' },
    { ...makeBlock('paragraph'), id: 'b' },
    { ...makeBlock('toggle'), id: 't', children: [
      { ...makeBlock('paragraph'), id: 'c' },
      { ...makeBlock('paragraph'), id: 'd' },
    ] },
    { ...makeBlock('paragraph'), id: 'e' },
  ];

  it('selectSingle returns one id', () => {
    expect([...selectSingle('a')]).toEqual(['a']);
  });

  it('toggleInSelection adds and removes', () => {
    expect([...toggleInSelection(selectSingle('a'), 'b')]).toEqual(['a', 'b']);
    expect([...toggleInSelection(new Set(['a', 'b']), 'a')]).toEqual(['b']);
  });

  it('clearSelection is empty', () => {
    expect(clearSelection().size).toBe(0);
  });

  it('getDocumentOrderedIds is depth-first preorder', () => {
    expect(getDocumentOrderedIds(blocks)).toEqual(['a', 'b', 't', 'c', 'd', 'e']);
  });

  it('selectRange between document-order ids', () => {
    const ordered = ['a', 'b', 't', 'c', 'd', 'e'];
    expect([...selectRange('a', 'e', ordered)]).toEqual(['a', 'b', 't', 'c', 'd', 'e']);
    expect([...selectRange('e', 'a', ordered)]).toEqual(['a', 'b', 't', 'c', 'd', 'e']);
  });

  it('haveSameParent for root siblings', () => {
    expect(haveSameParent(blocks, 'a', 'b')).toBe(true);
    expect(haveSameParent(blocks, 'a', 'c')).toBe(false);
  });

  it('shift range same parent root siblings', () => {
    const r = applyPointerSelection(blocks, clearSelection(), 'a', 'b', { shiftKey: true, additiveKey: false });
    expect([...r.selected]).toEqual(['a', 'b']);
  });

  it('shift range crosses toggle boundary (K-82)', () => {
    const r = applyPointerSelection(blocks, clearSelection(), 'a', 'c', { shiftKey: true, additiveKey: false });
    expect([...r.selected]).toEqual(['a', 'b', 't', 'c']);
  });

  it('shift range from toggle child to root sibling', () => {
    const r = applyPointerSelection(blocks, clearSelection(), 'c', 'e', { shiftKey: true, additiveKey: false });
    expect([...r.selected]).toEqual(['c', 'd', 'e']);
  });

  it('ctrl additive selection', () => {
    const sel = selectSingle('b');
    const r = applyPointerSelection(blocks, sel, 'b', 'e', { shiftKey: false, additiveKey: true });
    expect([...r.selected].sort()).toEqual(['b', 'e']);
  });

  it('plain click replaces selection', () => {
    const r = applyPointerSelection(blocks, new Set(['a', 'b']), 'a', 'e', { shiftKey: false, additiveKey: false });
    expect([...r.selected]).toEqual(['e']);
    expect(r.anchorId).toBe('e');
  });

  it('extendSelectionByArrow uses document order', () => {
    const down = extendSelectionByArrow(blocks, 'a', 'a', 'down');
    expect(down && [...down.selected]).toEqual(['a', 'b']);
    const cross = extendSelectionByArrow(blocks, 'b', 'b', 'down');
    expect(cross && [...cross.selected]).toEqual(['b', 't']);
    const up = extendSelectionByArrow(blocks, 'e', 'e', 'up');
    expect(up && [...up.selected]).toEqual(['d', 'e']);
  });
});

describe('blockSelection large document', () => {
  function buildLargeDoc(blockCount: number) {
    const blocks = [];
    for (let i = 0; i < blockCount; i++) {
      if (i > 0 && i % 25 === 0) {
        blocks.push({
          ...makeBlock('toggle'),
          id: `toggle-${i}`,
          content: `Section ${i}`,
          children: [
            { ...makeBlock('paragraph'), id: `child-${i}-1`, content: 'nested' },
            { ...makeBlock('paragraph'), id: `child-${i}-2`, content: 'nested' },
          ],
        });
      } else {
        blocks.push({ ...makeBlock('paragraph'), id: `p-${i}`, content: `Line ${i}` });
      }
    }
    return blocks;
  }

  it('shift range across 100+ blocks with toggles stays O(n) slice', () => {
    const blocks = buildLargeDoc(120);
    const ordered = getDocumentOrderedIds(blocks);
    expect(ordered.length).toBeGreaterThan(120);
    const r = applyPointerSelection(blocks, clearSelection(), ordered[0]!, ordered[ordered.length - 1]!, {
      shiftKey: true,
      additiveKey: false,
    });
    expect(r.selected.size).toBe(ordered.length);
  });
});

describe('isBlockVisuallySelected', () => {
  it('marks collapsed toggle header when a hidden child is selected', () => {
    const child = makeBlock('paragraph', { id: 'c', content: 'child' });
    const toggle = makeBlock('toggle', { id: 't', content: 'toggle', collapsed: true, children: [child] });
    const selected = new Set(['c']);
    expect(isBlockVisuallySelected(toggle, selected)).toBe(true);
    expect(isBlockVisuallySelected(child, selected)).toBe(true);
  });

  it('does not mark expanded toggle header when only child is selected', () => {
    const child = makeBlock('paragraph', { id: 'c', content: 'child' });
    const toggle = makeBlock('toggle', { id: 't', content: 'toggle', collapsed: false, children: [child] });
    const selected = new Set(['c']);
    expect(isBlockVisuallySelected(toggle, selected)).toBe(false);
  });
});
