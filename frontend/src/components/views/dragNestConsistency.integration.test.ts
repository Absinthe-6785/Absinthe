// @vitest-environment happy-dom
/**
 * UX-4C.1 — drag inside toggle uses same nestability rule as Tab
 */
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BlockEditor } from './BlockEditor';
import { EDITOR_CHROME_STYLES } from './editorChromeStyles';
import { clearPendingDragRejectTimers } from './editorDragDrop';
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

  const host = document.createElement('div');
  document.body.appendChild(host);

  let root: Root | null = null;
  act(() => {
    root = createRoot(host);
    root.render(createElement(BlockEditor, { blocks, onChange, colors, readOnly: false }));
  });

  const flatIds = flattenBlockIds(blocks);
  layoutBlockRects(flatIds);
  stubElementsFromPoint(flatIds);
  return { root, flatIds };
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
    const els: Element[] = [block];
    const toggleDrop = block.querySelector('.be-toggle-drop');
    if (toggleDrop) els.push(toggleDrop);
    return els;
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

function fireWindowPointer(type: 'pointermove' | 'pointerup', clientY: number, clientX = 200) {
  const ev = new PointerEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX,
    clientY,
    pointerId: 1,
    button: 0,
    buttons: type === 'pointerup' ? 0 : 1,
    pointerType: 'mouse',
  });
  act(() => { window.dispatchEvent(ev); });
}

function fireGripPointer(
  grip: HTMLElement,
  type: 'pointerdown' | 'pointermove' | 'pointerup',
  clientY: number,
) {
  const ev = new PointerEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX: GRIP_X,
    clientY,
    pointerId: 1,
    button: 0,
    buttons: type === 'pointerup' ? 0 : 1,
    pointerType: 'mouse',
  });
  act(() => { grip.dispatchEvent(ev); });
}

function dragGripInside(fromId: string, toToggleId: string, flatIds: string[]) {
  const grip = gripFor(fromId);
  const fromIdx = flatIds.indexOf(fromId);
  const startY = (fromIdx >= 0 ? fromIdx : 0) * ROW_H + 12;
  const dropBlock = document.querySelector(`[data-drag-id="${toToggleId}"]`) as HTMLElement;
  const dropRect = dropBlock.getBoundingClientRect();
  const dropY = dropRect.top + dropRect.height * 0.7;

  fireGripPointer(grip, 'pointerdown', startY);
  fireWindowPointer('pointermove', startY + 12);
  fireWindowPointer('pointermove', dropY);
  fireWindowPointer('pointerup', dropY);
}

describe('drag nest consistency integration (UX-4C.1)', () => {
  afterEach(() => {
    clearPendingDragRejectTimers();
    vi.restoreAllMocks();
    document.body.innerHTML = '';
    document.head.innerHTML = '';
  });

  it('rejects drag image into toggle', () => {
    vi.useFakeTimers();
    const toggle = makeBlock('toggle', { id: 't', content: 'T', children: [] });
    const image = makeBlock('image', { id: 'img', src: '/x.png', alt: 'x' });
    const blocks = [toggle, image];

    let latest: Block[] = blocks;
    mountEditor(blocks, next => { latest = next; });

    const flatIds = flattenBlockIds(blocks);
    dragGripInside('img', 't', flatIds);

    expect(flattenBlockIds(latest)).toEqual(['t', 'img']);
    expect(gripFor('img').classList.contains('be-drag-rejected')).toBe(true);
    act(() => { vi.advanceTimersByTime(500); });
    vi.useRealTimers();
  });

  it('rejects drag divider into toggle', () => {
    const toggle = makeBlock('toggle', { id: 't', content: 'T', children: [] });
    const divider = makeBlock('divider', { id: 'div' });
    const blocks = [toggle, divider];

    let latest: Block[] = blocks;
    mountEditor(blocks, next => { latest = next; });

    const flatIds = flattenBlockIds(blocks);
    dragGripInside('div', 't', flatIds);

    expect(flattenBlockIds(latest)).toEqual(['t', 'div']);
  });

  it('rejects drag table into toggle', () => {
    const toggle = makeBlock('toggle', { id: 't', content: 'T', children: [] });
    const table = makeBlock('table', { id: 'tbl', tableHeaders: ['A'], tableRows: [['1']] });
    const blocks = [toggle, table];

    let latest: Block[] = blocks;
    mountEditor(blocks, next => { latest = next; });

    const flatIds = flattenBlockIds(blocks);
    dragGripInside('tbl', 't', flatIds);

    expect(flattenBlockIds(latest)).toEqual(['t', 'tbl']);
  });

  it('allows drag paragraph into toggle', () => {
    const toggle = makeBlock('toggle', { id: 't', content: 'T', children: [] });
    const para = makeBlock('paragraph', { id: 'p', content: 'P' });
    const blocks = [toggle, para];

    let latest: Block[] = blocks;
    mountEditor(blocks, next => { latest = next; });

    const flatIds = flattenBlockIds(blocks);
    dragGripInside('p', 't', flatIds);

    expect(flattenBlockIds(latest)).toEqual(['t', 'p']);
    expect(latest[0].children[0].id).toBe('p');
  });

  it('allows drag toggle into toggle preserving subtree', () => {
    const child = makeBlock('paragraph', { id: 'c', content: 'child' });
    const inner = makeBlock('toggle', { id: 'it', content: 'Inner', children: [child] });
    const outer = makeBlock('toggle', { id: 'ot', content: 'Outer', children: [] });
    const blocks = [outer, inner];

    let latest: Block[] = blocks;
    mountEditor(blocks, next => { latest = next; });

    const flatIds = flattenBlockIds(blocks);
    dragGripInside('it', 'ot', flatIds);

    expect(flattenBlockIds(latest)).toEqual(['ot', 'it', 'c']);
    expect(latest[0].children[0].id).toBe('it');
    expect(latest[0].children[0].children[0].id).toBe('c');
  });
});
