import { describe, expect, it } from 'vitest';
import { makeBlock } from './blockUtils';
import {
  exitEmptyListBlock,
  isListType,
  listSplitExtras,
  numberedMarker,
  renumberNumberedLists,
} from './listBlocks';

describe('listBlocks', () => {
  it('isListType', () => {
    expect(isListType('bullet')).toBe(true);
    expect(isListType('paragraph')).toBe(false);
  });

  it('exitEmptyListBlock converts to paragraph', () => {
    const b = makeBlock('bullet', { id: 'a', content: '' });
    const next = exitEmptyListBlock([b], 'a');
    expect(next[0].type).toBe('paragraph');
    expect(next[0].indent).toBe(0);
  });

  it('renumberNumberedLists', () => {
    const blocks = [
      makeBlock('numbered', { id: 'a', content: 'one', listIndex: 9 }),
      makeBlock('numbered', { id: 'b', content: 'two' }),
      makeBlock('paragraph', { id: 'c', content: 'break' }),
      makeBlock('numbered', { id: 'd', content: 'three' }),
    ];
    const next = renumberNumberedLists(blocks);
    expect(next[0].listIndex).toBe(1);
    expect(next[1].listIndex).toBe(2);
    expect(next[3].listIndex).toBe(1);
  });

  it('listSplitExtras increments numbered index', () => {
    const cur = makeBlock('numbered', { listIndex: 2 });
    expect(listSplitExtras(cur, 'numbered').listIndex).toBe(3);
  });

  it('numberedMarker uses listIndex', () => {
    expect(numberedMarker(makeBlock('numbered', { listIndex: 4 }))).toBe(4);
  });
});
