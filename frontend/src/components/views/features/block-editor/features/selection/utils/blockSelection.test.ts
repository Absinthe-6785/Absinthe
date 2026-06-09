import { describe, expect, it } from 'vitest';
import { makeBlock } from '../../../../../blockUtils';
import {
  applyPointerSelection,
  clearSelection,
  haveSameParent,
  selectRange,
  selectSingle,
  toggleInSelection,
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

  it('selectRange between siblings', () => {
    const siblings = ['a', 'b', 't', 'e'];
    expect([...selectRange('a', 'e', siblings)]).toEqual(['a', 'b', 't', 'e']);
    expect([...selectRange('e', 'a', siblings)]).toEqual(['a', 'b', 't', 'e']);
  });

  it('haveSameParent for root siblings', () => {
    expect(haveSameParent(blocks, 'a', 'b')).toBe(true);
    expect(haveSameParent(blocks, 'a', 'c')).toBe(false);
  });

  it('shift range same parent', () => {
    const r = applyPointerSelection(blocks, clearSelection(), 'a', 'b', { shiftKey: true, additiveKey: false });
    expect([...r.selected]).toEqual(['a', 'b']);
  });

  it('shift range different parent falls back to single', () => {
    const r = applyPointerSelection(blocks, clearSelection(), 'a', 'c', { shiftKey: true, additiveKey: false });
    expect([...r.selected]).toEqual(['c']);
  });

  it('ctrl additive selection', () => {
    let sel = selectSingle('b');
    const r = applyPointerSelection(blocks, sel, 'b', 'e', { shiftKey: false, additiveKey: true });
    expect([...r.selected].sort()).toEqual(['b', 'e']);
  });

  it('plain click replaces selection', () => {
    const r = applyPointerSelection(blocks, new Set(['a', 'b']), 'a', 'e', { shiftKey: false, additiveKey: false });
    expect([...r.selected]).toEqual(['e']);
    expect(r.anchorId).toBe('e');
  });
});
