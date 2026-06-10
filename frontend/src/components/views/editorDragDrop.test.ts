import { afterEach, describe, expect, it } from 'vitest';
import { makeBlock } from './blockUtils';
import { applyDragDrop } from './blockTree';
import { commitDragDrop, clearPendingDragRejectTimers } from './editorDragDrop';

/** Smoke tests for drag-drop module contract (logic lives in blockTree). */
describe('editorDragDrop contract', () => {
  it('applyDragDrop after reorder is stable', () => {
    const a = makeBlock('paragraph', { id: 'a', content: 'A' });
    const b = makeBlock('paragraph', { id: 'b', content: 'B' });
    const next = applyDragDrop([a, b], 'a', 'b', 'after');
    expect(next!.map(x => x.id)).toEqual(['b', 'a']);
  });
});

describe('commitDragDrop', () => {
  afterEach(() => {
    clearPendingDragRejectTimers();
  });

  it('renumbers numbered lists after sibling reorder', () => {
    const blocks = [
      makeBlock('numbered', { id: 'a', content: 'A', listIndex: 1 }),
      makeBlock('numbered', { id: 'b', content: 'B', listIndex: 2 }),
      makeBlock('numbered', { id: 'c', content: 'C', listIndex: 3 }),
    ];
    const next = commitDragDrop(blocks, ['c'], 'a', 'before');
    expect(next!.map(b => b.id)).toEqual(['c', 'a', 'b']);
    expect(next!.map(b => b.listIndex)).toEqual([1, 2, 3]);
  });

  it('returns null for invalid descendant drop', () => {
    const child = makeBlock('paragraph', { id: 'c' });
    const toggle = makeBlock('toggle', { id: 't', children: [child] });
    expect(commitDragDrop([toggle], ['t'], 'c', 'inside')).toBeNull();
  });
});

describe('clearPendingDragRejectTimers', () => {
  it('is safe to call when no timers are pending', () => {
    expect(() => clearPendingDragRejectTimers()).not.toThrow();
  });
});
