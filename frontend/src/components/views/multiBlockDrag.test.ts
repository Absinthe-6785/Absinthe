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

  it('rejects inside drop when any block is non-nestable (UX-4C.1)', () => {
    const toggle = { ...makeBlock('toggle'), id: 't', children: [] };
    const para = { ...makeBlock('paragraph'), id: 'p' };
    const divider = { ...makeBlock('divider'), id: 'd' };
    const blocks = [toggle, para, divider];

    expect(applyMultiBlockDragDrop(blocks, ['p', 'd'], 't', 'inside')).toBeNull();
    expect(applyMultiBlockDragDrop(blocks, ['d'], 't', 'inside')).toBeNull();
  });

  it('extracts toggle child to root before sibling', () => {
    const child = { ...makeBlock('paragraph'), id: 'b' };
    const toggle = { ...makeBlock('toggle'), id: 't', children: [child] };
    const sibling = { ...makeBlock('paragraph'), id: 'c' };
    const root = [toggle, sibling];

    const next = applyMultiBlockDragDrop(root, ['b'], 'c', 'before');
    expect(flattenBlockIds(next!)).toEqual(['t', 'b', 'c']);
    expect(next![0].children).toHaveLength(0);
  });

  it('extracts toggle child to root before toggle', () => {
    const child = { ...makeBlock('paragraph'), id: 'b' };
    const toggle = { ...makeBlock('toggle'), id: 't', children: [child] };
    const root = [toggle];

    const next = applyMultiBlockDragDrop(root, ['b'], 't', 'before');
    expect(flattenBlockIds(next!)).toEqual(['b', 't']);
    expect(next![1].children).toHaveLength(0);
  });
});
