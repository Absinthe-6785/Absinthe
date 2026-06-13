import { describe, expect, it } from 'vitest';
import { flattenBlockIds, makeBlock } from './blockUtils';
import { deleteSelectedBlocks, duplicateSelectedBlocks, resolveFocusAfterBlockDelete } from './multiBlockOps';

describe('multiBlockOps', () => {
  const blocks = [
    { ...makeBlock('paragraph'), id: 'a', content: 'A' },
    { ...makeBlock('paragraph'), id: 'b', content: 'B' },
    { ...makeBlock('paragraph'), id: 'c', content: 'C' },
  ];

  it('deleteSelectedBlocks removes multiple in document order', () => {
    const next = deleteSelectedBlocks(blocks, ['b', 'a']);
    expect(flattenBlockIds(next)).toEqual(['c']);
  });

  it('deleteSelectedBlocks leaves empty paragraph when all removed', () => {
    const next = deleteSelectedBlocks(blocks, ['a', 'b', 'c']);
    expect(next).toHaveLength(1);
    expect(next[0].type).toBe('paragraph');
  });

  it('duplicateSelectedBlocks clones in order after last selected', () => {
    const next = duplicateSelectedBlocks(blocks, ['a', 'c']);
    const ids = flattenBlockIds(next);
    expect(ids).toHaveLength(5);
    expect(ids.slice(0, 3)).toEqual(['a', 'b', 'c']);
    expect(ids[3]).not.toBe('a');
    expect(ids[4]).not.toBe('c');
  });

  it('resolveFocusAfterBlockDelete focuses previous block at content end', () => {
    const next = deleteSelectedBlocks(blocks, ['b']);
    const focus = resolveFocusAfterBlockDelete(blocks, ['b'], next);
    expect(focus).toEqual({ blockId: 'a', offset: 1 });
  });

  it('resolveFocusAfterBlockDelete focuses next block at start when deleting the first', () => {
    const next = deleteSelectedBlocks(blocks, ['a']);
    const focus = resolveFocusAfterBlockDelete(blocks, ['a'], next);
    expect(focus).toEqual({ blockId: 'b', offset: 'start' });
  });

  it('resolveFocusAfterBlockDelete focuses replacement paragraph when all removed', () => {
    const next = deleteSelectedBlocks(blocks, ['a', 'b', 'c']);
    const focus = resolveFocusAfterBlockDelete(blocks, ['a', 'b', 'c'], next);
    expect(focus?.blockId).toBe(next[0].id);
    expect(focus?.offset).toBe('start');
  });
});
