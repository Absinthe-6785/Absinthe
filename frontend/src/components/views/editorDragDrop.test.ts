import { describe, expect, it } from 'vitest';
import { makeBlock } from './blockUtils';
import { applyDragDrop } from './blockTree';

/** Smoke tests for drag-drop module contract (logic lives in blockTree). */
describe('editorDragDrop contract', () => {
  it('applyDragDrop after reorder is stable', () => {
    const a = makeBlock('paragraph', { id: 'a', content: 'A' });
    const b = makeBlock('paragraph', { id: 'b', content: 'B' });
    const next = applyDragDrop([a, b], 'a', 'b', 'after');
    expect(next!.map(x => x.id)).toEqual(['b', 'a']);
  });
});
