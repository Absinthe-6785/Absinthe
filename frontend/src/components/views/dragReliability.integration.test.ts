// @vitest-environment happy-dom
/**
 * UX-4B.2 — grip drag reliability (capture, ESC cancel, autoscroll wiring)
 */
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BlockEditor } from './BlockEditor';
import { EDITOR_CHROME_STYLES } from './editorChromeStyles';
import { flattenBlockIds, makeBlock, type Block } from './blockUtils';
import type { BlockEditorColors } from './editorTypes';

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

function mountEditor(blocks: Block[], onChange: (b: Block[]) => void) {
  document.body.innerHTML = '';
  const style = document.createElement('style');
  style.textContent = EDITOR_CHROME_STYLES;
  document.head.appendChild(style);

  const scrollZone = document.createElement('div');
  scrollZone.className = 'editor-drop-zone';
  scrollZone.style.height = '300px';
  scrollZone.style.overflow = 'auto';
  document.body.appendChild(scrollZone);

  const host = document.createElement('div');
  scrollZone.appendChild(host);

  let root: Root | null = null;
  act(() => {
    root = createRoot(host);
    root.render(createElement(BlockEditor, { blocks, onChange, colors, readOnly: false }));
  });

  const flatIds = flattenBlockIds(blocks);
  layoutBlockRects(flatIds);
  stubElementsFromPoint(flatIds);
  return { root, flatIds, scrollZone };
}

function layoutBlockRects(ids: string[]) {
  ids.forEach((id, i) => {
    const block = document.querySelector(`[data-drag-id="${id}"]`) as HTMLElement | null;
    if (!block) return;
    const top = i * ROW_H;
    block.getBoundingClientRect = () => rect(40, top, 360, ROW_H - 4);
    const grip = block.querySelector('.be-grip') as HTMLElement | null;
    if (grip) grip.getBoundingClientRect = () => rect(40, top + 8, 26, 26);
  });
}

function stubElementsFromPoint(ids: string[]) {
  const hitTest = (x: number, y: number): Element[] => {
    const idx = Math.floor(y / ROW_H);
    if (idx < 0 || idx >= ids.length) return [];
    const id = ids[idx];
    const block = document.querySelector(`[data-drag-id="${id}"]`) as HTMLElement | null;
    if (!block) return [];
    return [block];
  };
  if (typeof document.elementsFromPoint === 'function') {
    vi.spyOn(document, 'elementsFromPoint').mockImplementation(hitTest);
  } else {
    document.elementsFromPoint = hitTest;
  }
}

function gripFor(id: string) {
  return document.querySelector(`[data-drag-id="${id}"] .be-grip`) as HTMLElement;
}

function fireWindowPointer(type: 'pointermove' | 'pointerup' | 'pointercancel', clientY: number) {
  act(() => {
    window.dispatchEvent(new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      clientX: 200,
      clientY,
      pointerId: 1,
      button: 0,
      buttons: type === 'pointerup' || type === 'pointercancel' ? 0 : 1,
      pointerType: 'mouse',
    }));
  });
}

function fireGripPointer(grip: HTMLElement, type: 'pointerdown', clientY: number) {
  act(() => {
    grip.dispatchEvent(new PointerEvent(type, {
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

function startDrag(fromId: string, flatIds: string[]) {
  const grip = gripFor(fromId);
  const fromIdx = flatIds.indexOf(fromId);
  const startY = fromIdx * ROW_H + 12;
  fireGripPointer(grip, 'pointerdown', startY);
  fireWindowPointer('pointermove', startY + 12);
  return { grip, startY };
}

describe('drag reliability integration', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
    document.head.innerHTML = '';
  });

  it('Escape during drag cancels without commit or stuck UI', () => {
    const blocks = ['a', 'b', 'c'].map(id => makeBlock('paragraph', { id, content: id }));
    let latest = blocks;
    mountEditor(blocks, next => { latest = next; });

    const flatIds = flattenBlockIds(blocks);
    const { startY } = startDrag('c', flatIds);
    fireWindowPointer('pointermove', 12);

    expect(document.querySelector('.be-block.be-dragging')).toBeTruthy();

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });

    expect(document.querySelector('.be-block.be-dragging')).toBeFalsy();
    expect(latest.map(b => b.id)).toEqual(['a', 'b', 'c']);

    fireWindowPointer('pointerup', startY + 12);
    expect(latest.map(b => b.id)).toEqual(['a', 'b', 'c']);
  });

  it('pointercancel ends drag without commit', () => {
    const blocks = ['a', 'b'].map(id => makeBlock('paragraph', { id }));
    let latest = blocks;
    mountEditor(blocks, next => { latest = next; });

    const flatIds = flattenBlockIds(blocks);
    const { startY } = startDrag('b', flatIds);
    fireWindowPointer('pointermove', flatIds.indexOf('a') * ROW_H + 12);

    fireWindowPointer('pointercancel', startY + 12);

    expect(document.querySelector('.be-block.be-dragging')).toBeFalsy();
    expect(latest.map(b => b.id)).toEqual(['a', 'b']);
  });

  it('autoscrolls editor-drop-zone when pointer is in bottom edge band', () => {
    const blocks = Array.from({ length: 30 }, (_, i) =>
      makeBlock('paragraph', { id: `b${i}`, content: `${i}` }),
    );
    let latest = blocks;
    const { scrollZone, flatIds } = mountEditor(blocks, next => { latest = next; });

    Object.defineProperty(scrollZone, 'getBoundingClientRect', {
      value: () => rect(0, 0, 800, 300),
    });
    Object.defineProperty(scrollZone, 'clientHeight', { value: 300, configurable: true });
    Object.defineProperty(scrollZone, 'scrollHeight', { value: 3000, configurable: true });
    scrollZone.scrollTop = 100;

    const { startY } = startDrag('b0', flatIds);
    fireWindowPointer('pointermove', 295);

    expect(scrollZone.scrollTop).toBeGreaterThan(100);
    expect(latest).toBe(blocks);

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
  });
});
