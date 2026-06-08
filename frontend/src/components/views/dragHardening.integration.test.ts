// @vitest-environment happy-dom
/**
 * UX-4B.1 — drag correctness hardening integration tests
 */
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

function dragGrip(
  fromId: string,
  toId: string,
  flatIds: string[],
  overPos: 'before' | 'after' | 'inside' = 'before',
) {
  const grip = gripFor(fromId);
  const fromIdx = flatIds.indexOf(fromId);
  const startY = (fromIdx >= 0 ? fromIdx : 0) * ROW_H + 12;
  const dropBlock = document.querySelector(`[data-drag-id="${toId}"]`) as HTMLElement;
  const dropRect = dropBlock.getBoundingClientRect();
  let dropY = dropRect.top + dropRect.height * 0.25;
  if (overPos === 'after') dropY = dropRect.bottom - 4;
  if (overPos === 'inside') dropY = dropRect.top + dropRect.height * 0.7;

  fireGripPointer(grip, 'pointerdown', startY);
  fireWindowPointer('pointermove', startY + 12);
  fireWindowPointer('pointermove', dropY);
  fireWindowPointer('pointerup', dropY);
}

function selectBlock(id: string, additive = false) {
  const shell = document.querySelector(`[data-drag-id="${id}"]`) as HTMLElement;
  const target = shell.querySelector('.be-content') ?? shell;
  act(() => {
    target.dispatchEvent(new MouseEvent('mousedown', {
      bubbles: true,
      metaKey: additive,
      ctrlKey: additive,
    }));
  });
}

describe('drag hardening integration', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
    document.head.innerHTML = '';
  });

  it('case 1 — numbered list reorder renumbers via commit path', () => {
    const blocks = [
      makeBlock('numbered', { id: 'a', content: 'A', listIndex: 1 }),
      makeBlock('numbered', { id: 'b', content: 'B', listIndex: 2 }),
      makeBlock('numbered', { id: 'c', content: 'C', listIndex: 3 }),
    ];
    let latest: Block[] = blocks;
    mountEditor(blocks, next => { latest = next; });

    const flatIds = flattenBlockIds(blocks);
    dragGrip('c', 'a', flatIds, 'before');

    expect(latest.map(b => b.id)).toEqual(['c', 'a', 'b']);
    expect(latest.map(b => b.listIndex)).toEqual([1, 2, 3]);
  });

  it('case 2 — ancestor + descendant selection moves toggle subtree', () => {
    const child = makeBlock('paragraph', { id: 'child', content: 'in' });
    const toggle = makeBlock('toggle', { id: 't', content: 'T', children: [child] });
    const after = makeBlock('paragraph', { id: 'after', content: 'after' });
    const blocks = [toggle, after];

    let latest: Block[] = blocks;
    mountEditor(blocks, next => { latest = next; });

    selectBlock('t');
    selectBlock('child', true);

    const flatIds = flattenBlockIds(blocks);
    dragGrip('t', 'after', flatIds, 'after');

    expect(latest.map(b => b.id)).toEqual(['after', 't']);
    expect(latest.find(b => b.id === 't')?.children[0].id).toBe('child');
  });

  it('case 3 — drop onto descendant rejects with grip feedback', () => {
    vi.useFakeTimers();
    const child = makeBlock('paragraph', { id: 'child', content: 'c' });
    const toggle = makeBlock('toggle', { id: 't', content: 'T', children: [child] });
    const blocks = [toggle];

    let latest: Block[] = blocks;
    mountEditor(blocks, next => { latest = next; });

    const flatIds = flattenBlockIds(blocks);
    layoutBlockRects(flatIds);
    stubElementsFromPoint(flatIds);

    const grip = gripFor('t');
    const startY = 12;
    const childY = ROW_H + 12;
    fireGripPointer(grip, 'pointerdown', startY);
    fireWindowPointer('pointermove', startY + 12);
    fireWindowPointer('pointermove', childY);
    fireWindowPointer('pointerup', childY);

    expect(latest.map(b => b.id)).toEqual(['t']);
    expect(grip.classList.contains('be-drag-rejected')).toBe(true);

    act(() => { vi.advanceTimersByTime(500); });
    expect(grip.classList.contains('be-drag-rejected')).toBe(false);
    vi.useRealTimers();
  });

  it('case 4 — normal sibling paragraph reorder unchanged', () => {
    const blocks = ['a', 'b', 'c'].map(id => makeBlock('paragraph', { id, content: id }));
    let latest: Block[] = blocks;
    mountEditor(blocks, next => { latest = next; });

    const flatIds = flattenBlockIds(blocks);
    dragGrip('c', 'a', flatIds, 'before');

    expect(latest.map(b => b.id)).toEqual(['c', 'a', 'b']);
  });
});
