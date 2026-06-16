import { describe, expect, it } from 'vitest';
import { flattenBlockIds, makeBlock } from './blockUtils';
import {
  deleteSelectedBlocks,
  duplicateSelectedBlocks,
  indentSelectedBlocks,
  outdentSelectedBlocks,
  resolveFocusAfterBlockDelete,
} from './multiBlockOps';

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

  it('duplicateSelectedBlocks does not double-clone toggle children when header is selected', () => {
    const child = makeBlock('paragraph', { id: 'c', content: 'child' });
    const toggle = makeBlock('toggle', { id: 't', content: 'toggle', children: [child] });
    const root = [toggle, makeBlock('paragraph', { id: 'x', content: 'x' })];
    const next = duplicateSelectedBlocks(root, ['t', 'c']);
    const toggles = next.filter(b => b.type === 'toggle');
    expect(toggles).toHaveLength(2);
    expect(toggles.every(t => t.children.length === 1)).toBe(true);
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

  it('indentSelectedBlocks indents multiple siblings in document order', () => {
    const a = makeBlock('paragraph', { id: 'a', content: 'A' });
    const b = makeBlock('paragraph', { id: 'b', content: 'B' });
    const c = makeBlock('paragraph', { id: 'c', content: 'C' });
    const root = [a, b, c];
    const next = indentSelectedBlocks(root, ['b', 'c']);
    expect(next).not.toBeNull();
    expect(next).toHaveLength(1);
    expect(next![0].type).toBe('toggle');
    expect(next![0].children.map(x => x.id)).toEqual(['b', 'c']);
  });

  it('indentSelectedBlocks collapses toggle+child to header only', () => {
    const child = makeBlock('paragraph', { id: 'c', content: 'child' });
    const toggle = makeBlock('toggle', { id: 't', content: 'toggle', children: [child] });
    const para = makeBlock('paragraph', { id: 'p', content: 'p' });
    const root = [toggle, para];
    const next = indentSelectedBlocks(root, ['t', 'c', 'p']);
    expect(next).not.toBeNull();
    expect(flattenBlockIds(next!).filter(id => id === 'p').length).toBe(1);
  });

  it('outdentSelectedBlocks outdents nested toggles in reverse order', () => {
    const inner = makeBlock('paragraph', { id: 'inner', content: 'inner' });
    const mid = makeBlock('toggle', { id: 'mid', content: 'mid', children: [inner] });
    const outer = makeBlock('toggle', { id: 'outer', content: 'outer', children: [mid] });
    const next = outdentSelectedBlocks([outer], ['inner', 'mid']);
    expect(next).not.toBeNull();
    expect(flattenBlockIds(next!)).toEqual(['outer', 'mid', 'inner']);
  });
});
