// @vitest-environment happy-dom
/**
 * UX-5E.1E — virtual drag enablement integration tests.
 */
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BlockEditor } from './BlockEditor';
import { EDITOR_CHROME_STYLES } from './editorChromeStyles';
import { flattenBlockIds, makeBlock, type Block } from './blockUtils';
import type { BlockEditorColors } from './editorTypes';
import { resetDragStateStore, setDragStateStore } from './features/block-editor/performance/dragStateStore';
import { DragOverlay } from './features/block-editor/performance/DragOverlay';
import {
  getRowMetrics,
  resolveDropTargetFromRows,
  type BlockRowHit,
} from './features/block-editor/performance/rowMetrics';

const colors: BlockEditorColors = {
  bg: '#fff', text: '#111', textMuted: '#666', textFaint: '#999',
  accent: '#8B5CF6', accentBg: '#eee', border: '#ddd', card: '#fff',
  cardHov: '#f5f5f5', input: '#fff', inputBdr: '#ccc', toolbar: '#f9f9f9',
  danger: '#f00', green: '#0f0', codeBg: '#f1f5f9', calloutBg: '#fafafa',
  toggleBg: 'transparent', quoteBdr: '#ccc', selection: '#eef',
};

const ROW_H = 48;
const GRIP_X = 58;

function rect(left: number, top: number, w: number, h: number): DOMRect {
  return {
    left, top, width: w, height: h, right: left + w, bottom: top + h, x: left, y: top,
    toJSON: () => ({}),
  } as DOMRect;
}

function mountVirtualEditor(
  blocks: Block[],
  onChange: (b: Block[]) => void,
  scrollHeight = 300,
) {
  document.body.innerHTML = '';
  document.head.innerHTML = '';
  const style = document.createElement('style');
  style.textContent = EDITOR_CHROME_STYLES;
  document.head.appendChild(style);

  const scrollZone = document.createElement('div');
  scrollZone.className = 'editor-drop-zone';
  scrollZone.style.height = `${scrollHeight}px`;
  scrollZone.style.overflow = 'auto';
  scrollZone.style.width = '100%';
  document.body.appendChild(scrollZone);

  const host = document.createElement('div');
  scrollZone.appendChild(host);

  const virtualScrollParentRef = { current: scrollZone };

  let root: Root | null = null;
  act(() => {
    root = createRoot(host);
    root.render(createElement(BlockEditor, {
      blocks,
      onChange,
      colors,
      readOnly: false,
      virtualBlocksPoc: true,
      virtualScrollParentRef,
    }));
  });
  act(() => {});
  act(() => {});

  const flatIds = flattenBlockIds(blocks);
  layoutVisibleBlockRects(flatIds);
  stubVirtualRowHitTest(flatIds);
  return { root, flatIds, scrollZone };
}

function layoutVisibleBlockRects(ids: string[]) {
  document.querySelectorAll('[data-drag-id]').forEach((node, i) => {
    const block = node as HTMLElement;
    const top = i * ROW_H;
    block.getBoundingClientRect = () => rect(40, top, 360, ROW_H - 4);
    const grip = block.querySelector('.be-grip') as HTMLElement | null;
    if (grip) grip.getBoundingClientRect = () => rect(40, top + 8, 26, 26);
  });
}

/** When elementsFromPoint misses (unmounted virtual rows), row metrics resolve targets. */
function stubVirtualRowHitTest(ids: string[]) {
  const hitTest = (x: number, y: number): Element[] => {
    const block = document.querySelector('[data-drag-id]') as HTMLElement | null;
    if (!block) return [];
    const mounted = document.querySelectorAll('[data-drag-id]');
    for (const el of mounted) {
      const r = el.getBoundingClientRect();
      if (y >= r.top && y <= r.bottom) return [el];
    }
    return [];
  };
  if (typeof document.elementsFromPoint === 'function') {
    vi.spyOn(document, 'elementsFromPoint').mockImplementation(hitTest);
  } else {
    document.elementsFromPoint = hitTest;
  }
  void ids;
  void hitTest;
}

function gripFor(id: string) {
  return document.querySelector(`[data-drag-id="${id}"] .be-grip`) as HTMLElement;
}

function fireWindowPointer(type: 'pointermove' | 'pointerup', clientY: number) {
  act(() => {
    window.dispatchEvent(new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      clientX: 200,
      clientY,
      pointerId: 1,
      button: 0,
      buttons: type === 'pointerup' ? 0 : 1,
      pointerType: 'mouse',
    }));
  });
}

function fireGripPointer(grip: HTMLElement, clientY: number) {
  act(() => {
    grip.dispatchEvent(new PointerEvent('pointerdown', {
      bubbles: true,
      cancelable: true,
      clientX: GRIP_X,
      clientY,
      pointerId: 1,
      button: 0,
      buttons: 1,
      pointerType: 'mouse',
    }));
  });
}

function startVirtualDrag(fromId: string, flatIds: string[]) {
  const grip = gripFor(fromId);
  const fromIdx = flatIds.indexOf(fromId);
  const startY = fromIdx * ROW_H + 12;
  fireGripPointer(grip, startY);
  fireWindowPointer('pointermove', startY + 12);
  return { grip, startY };
}

describe('virtual drag integration', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    resetDragStateStore();
    document.body.innerHTML = '';
    document.head.innerHTML = '';
  });

  it('reorders a single root block with virtualization enabled', () => {
    const blocks = ['a', 'b', 'c', 'd'].map(id => makeBlock('paragraph', { id, content: id }));
    let latest = blocks;
    const { flatIds } = mountVirtualEditor(blocks, next => { latest = next; });

    const { startY } = startVirtualDrag('d', flatIds);
    fireWindowPointer('pointermove', flatIds.indexOf('a') * ROW_H + 12);
    fireWindowPointer('pointerup', startY + 12);

    expect(latest.map(b => b.id)).toEqual(['d', 'a', 'b', 'c']);
  });

  it('resolves off-screen drop targets via row metrics', () => {
    const rows: BlockRowHit[] = Array.from({ length: 50 }, (_, i) => ({
      blockId: `b${i}`,
      top: i * ROW_H,
      bottom: (i + 1) * ROW_H,
    }));
    const hit = resolveDropTargetFromRows(
      35 * ROW_H + 10,
      rows,
      ['b49'],
      id => makeBlock('paragraph', { id }),
    );
    expect(hit).toEqual({ overId: 'b35', overPos: 'before' });
  });

  it('resolves toggle inside target from virtual rows', () => {
    const rows: BlockRowHit[] = [{ blockId: 'toggle-1', top: 0, bottom: 80 }];
    const toggle = makeBlock('toggle', { id: 'toggle-1', collapsed: false });
    expect(resolveDropTargetFromRows(60, rows, [], () => toggle)).toEqual({
      overId: 'toggle-1',
      overPos: 'inside',
    });
  });

  it('renders drag ghost when source block DOM is unmounted', () => {
    document.body.innerHTML = '';
    document.head.innerHTML = '';
    const style = document.createElement('style');
    style.textContent = EDITOR_CHROME_STYLES;
    document.head.appendChild(style);

    const scrollZone = document.createElement('div');
    scrollZone.className = 'editor-drop-zone';
    scrollZone.getBoundingClientRect = () => rect(0, 0, 400, 600);
    scrollZone.scrollTop = 0;
    document.body.appendChild(scrollZone);

    const blocks = [makeBlock('paragraph', { id: 'ghost-block', content: 'x' })];
    const mockVirtualizer = {
      measurementsCache: [{ start: 100, size: 48 }],
      getOffsetForIndex: () => [100, 'start'] as [number, string],
    };

    const host = document.createElement('div');
    document.body.appendChild(host);

    let root: Root | null = null;
    act(() => {
      root = createRoot(host);
      setDragStateStore({ draggingIds: ['ghost-block'], overId: null, overPos: null });
      root.render(createElement(DragOverlay, {
        colors,
        getBlocks: () => blocks,
        getEditorRoot: () => null,
        getRowMetricsOptions: () => ({
          getEditorRoot: () => null,
          getRootBlockIds: () => ['ghost-block'],
          getBlocks: () => blocks,
          getVirtualizer: () => mockVirtualizer as never,
          getScrollElement: () => scrollZone,
        }),
      }));
    });

    expect(document.querySelector('.be-drag-ghost')).toBeTruthy();
    root?.unmount();
  });

  it('moves paragraph into toggle via virtual row inside-drop', () => {
    const toggle = makeBlock('toggle', {
      id: 'tog',
      content: 'Toggle',
      collapsed: false,
      children: [makeBlock('paragraph', { id: 'inner', content: 'inner' })],
    });
    const blocks = [
      makeBlock('paragraph', { id: 'src', content: 'src' }),
      toggle,
    ];
    let latest = blocks;
    const { flatIds } = mountVirtualEditor(blocks, next => { latest = next; });

    const { startY } = startVirtualDrag('src', flatIds);
    fireWindowPointer('pointermove', ROW_H + 35);
    fireWindowPointer('pointerup', startY + 12);

    const moved = latest.find(b => b.id === 'tog');
    expect(moved?.children.some(c => c.id === 'src')).toBe(true);
  });
});
