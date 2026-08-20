// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeBlock, type Block } from './blockUtils';
import { applyDragDrop } from './blockTree';
import {
  commitDragDrop,
  clearPendingDragRejectTimers,
  resolveDragOverFromPoint,
} from './editorDragDrop';

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

describe('resolveDragOverFromPoint outer-block geometry', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    Reflect.deleteProperty(document, 'elementsFromPoint');
    document.body.innerHTML = '';
  });

  it.each([
    ['two-line paragraph', 'paragraph', 64, 132, 72],
    ['three-line paragraph', 'paragraph', 64, 156, 72],
    ['wrapped heading', 'heading2', 64, 112, 72],
    ['wrapped list item', 'bullet', 64, 144, 72],
    ['unequal block heights', 'paragraph', 120, 220, 128],
    ['large visual gap', 'paragraph', 200, 280, 208],
    ['consecutive multiline blocks', 'paragraph', 64, 176, 72],
    ['scrolled editor', 'paragraph', -96, -4, -88],
  ])('%s uses an outer sibling boundary for target and commit', (
    _name,
    targetType,
    targetTop,
    targetBottom,
    pointerY,
  ) => {
    const root = document.createElement('div');
    root.className = 'be-editor-root be-blocks-root';
    const rects = [
      { id: 'source', type: 'paragraph', top: -220, bottom: -180 },
      { id: 'a', type: 'paragraph', top: 0, bottom: 40 },
      { id: 'b', type: targetType, top: targetTop, bottom: targetBottom },
      { id: 'c', type: 'paragraph', top: targetBottom + 24, bottom: targetBottom + 64 },
    ];
    const elements = new Map<string, HTMLElement>();
    for (const item of rects) {
      const el = document.createElement('div');
      el.className = 'be-block';
      el.dataset.dragId = item.id;
      el.dataset.blockType = item.type;
      el.getBoundingClientRect = () => ({
        top: item.top,
        bottom: item.bottom,
        left: 0,
        right: 800,
        width: 800,
        height: item.bottom - item.top,
        x: 0,
        y: item.top,
        toJSON: () => ({}),
      } as DOMRect);
      root.appendChild(el);
      elements.set(item.id, el);
    }
    document.body.appendChild(root);
    Object.defineProperty(document, 'elementsFromPoint', {
      configurable: true,
      value: () => [elements.get('b')!],
    });

    const hit = resolveDragOverFromPoint(400, pointerY, ['source']);
    expect(hit).not.toBeNull();
    expect(hit!.overId).toBe('b');
    expect(hit!.overPos).toBe('before');
    const source = makeBlock('paragraph', { id: 'source', content: 'source' });
    const a = makeBlock('paragraph', { id: 'a', content: 'A' });
    const b = makeBlock(targetType as Block['type'], { id: 'b', content: 'B' });
    const c = makeBlock('paragraph', { id: 'c', content: 'C' });
    const committed = commitDragDrop([source, a, b, c], ['source'], hit!.overId, hit!.overPos);
    expect(committed?.map(block => block.id)).toEqual(['a', 'source', 'b', 'c']);
  });
});
