import { describe, expect, it } from 'vitest';
import { flattenBlockIds, makeBlock } from './blockUtils';
import { applyMultiBlockDragDrop } from './multiBlockDrag';

describe('multiBlockDrag', () => {
  it('moves two siblings before a third', () => {
    const blocks = [
      { ...makeBlock('paragraph'), id: 'a' },
      { ...makeBlock('paragraph'), id: 'b' },
      { ...makeBlock('paragraph'), id: 'c' },
    ];
    const next = applyMultiBlockDragDrop(blocks, ['b', 'c'], 'a', 'before');
    expect(flattenBlockIds(next!)).toEqual(['b', 'c', 'a']);
  });

  it('moves blocks into toggle inside', () => {
    const blocks = [
      { ...makeBlock('paragraph'), id: 'a' },
      { ...makeBlock('toggle'), id: 't', children: [] },
      { ...makeBlock('paragraph'), id: 'b' },
    ];
    const next = applyMultiBlockDragDrop(blocks, ['a', 'b'], 't', 'inside');
    expect(flattenBlockIds(next!)).toEqual(['t', 'a', 'b']);
    const toggle = next!.find(b => b.id === 't');
    expect(toggle?.children.map(c => c.id)).toEqual(['a', 'b']);
  });

  it('rejects drop on descendant', () => {
    const blocks = [
      { ...makeBlock('toggle'), id: 't', children: [
        { ...makeBlock('paragraph'), id: 'c' },
      ] },
      { ...makeBlock('paragraph'), id: 'a' },
    ];
    expect(applyMultiBlockDragDrop(blocks, ['t'], 'c', 'before')).toBeNull();
  });

  it('preserves relative order', () => {
    const blocks = [
      { ...makeBlock('paragraph'), id: 'a' },
      { ...makeBlock('paragraph'), id: 'b' },
      { ...makeBlock('paragraph'), id: 'c' },
      { ...makeBlock('paragraph'), id: 'd' },
    ];
    const next = applyMultiBlockDragDrop(blocks, ['b', 'd'], 'c', 'after');
    expect(flattenBlockIds(next!)).toEqual(['a', 'c', 'b', 'd']);
  });
});
