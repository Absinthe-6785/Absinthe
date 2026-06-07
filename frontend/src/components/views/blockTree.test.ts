import { describe, expect, it } from 'vitest';
import { makeBlock } from './blockUtils';
import {
  applyDragDrop,
  indentBlock,
  moveBlockIntoToggle,
  moveBlockOutOfToggle,
  outdentBlock,
} from './blockTree';

describe('moveBlockIntoToggle', () => {
  it('moves a sibling paragraph into toggle children', () => {
    const toggle = makeBlock('toggle', { id: 't1', content: 'Toggle', children: [] });
    const para = makeBlock('paragraph', { id: 'p1', content: 'Para' });
    const blocks = [toggle, para];

    const next = moveBlockIntoToggle(blocks, 'p1', 't1');
    expect(next).not.toBeNull();
    expect(next![0].children).toHaveLength(1);
    expect(next![0].children[0].id).toBe('p1');
    expect(next).toHaveLength(1);
    expect(next![0].collapsed).toBe(false);
  });

  it('rejects nesting into self or descendants', () => {
    const inner = makeBlock('paragraph', { id: 'inner', content: 'inner' });
    const toggle = makeBlock('toggle', { id: 't1', content: 'T', children: [inner] });
    const blocks = [toggle];

    expect(moveBlockIntoToggle(blocks, 't1', 't1')).toBeNull();
    expect(moveBlockIntoToggle(blocks, 't1', 'inner')).toBeNull();
  });
});

describe('moveBlockOutOfToggle', () => {
  it('moves child out after parent toggle', () => {
    const child = makeBlock('paragraph', { id: 'c1', content: 'child' });
    const toggle = makeBlock('toggle', { id: 't1', content: 'Toggle', children: [child] });
    const after = makeBlock('paragraph', { id: 'p2', content: 'after' });
    const blocks = [toggle, after];

    const next = moveBlockOutOfToggle(blocks, 'c1');
    expect(next).not.toBeNull();
    expect(next![0].children).toHaveLength(0);
    expect(next!.map(b => b.id)).toEqual(['t1', 'c1', 'p2']);
  });
});

describe('indentBlock / outdentBlock', () => {
  it('Tab nests into previous sibling toggle', () => {
    const toggle = makeBlock('toggle', { id: 't1', content: 'T', children: [] });
    const para = makeBlock('paragraph', { id: 'p1', content: 'P' });
    const blocks = [toggle, para];

    const next = indentBlock(blocks, 'p1');
    expect(next).not.toBeNull();
    expect(next![0].children[0].id).toBe('p1');
  });

  it('Tab increases list indent when no toggle above', () => {
    const bullet = makeBlock('bullet', { id: 'b1', content: 'item', indent: 0 });
    const next = indentBlock([bullet], 'b1');
    expect(next![0].indent).toBe(1);
  });

  it('Shift+Tab exits toggle child', () => {
    const child = makeBlock('paragraph', { id: 'c1', content: 'c' });
    const toggle = makeBlock('toggle', { id: 't1', content: 'T', children: [child] });
    const next = outdentBlock([toggle], 'c1');
    expect(next!.map(b => b.id)).toEqual(['t1', 'c1']);
  });

  it('Shift+Tab decreases list indent', () => {
    const bullet = makeBlock('bullet', { id: 'b1', content: 'item', indent: 2 });
    const next = outdentBlock([bullet], 'b1');
    expect(next![0].indent).toBe(1);
  });
});

describe('applyDragDrop', () => {
  it('reorders siblings with before/after', () => {
    const a = makeBlock('paragraph', { id: 'a', content: 'A' });
    const b = makeBlock('paragraph', { id: 'b', content: 'B' });
    const c = makeBlock('paragraph', { id: 'c', content: 'C' });
    const blocks = [a, b, c];

    const next = applyDragDrop(blocks, 'a', 'c', 'after');
    expect(next!.map(x => x.id)).toEqual(['b', 'c', 'a']);
  });

  it('nests into toggle on inside drop', () => {
    const toggle = makeBlock('toggle', { id: 't1', content: 'T', children: [] });
    const para = makeBlock('paragraph', { id: 'p1', content: 'P' });
    const blocks = [toggle, para];

    const next = applyDragDrop(blocks, 'p1', 't1', 'inside');
    expect(next![0].children[0].id).toBe('p1');
    expect(next).toHaveLength(1);
  });
});
