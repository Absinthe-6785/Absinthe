// @vitest-environment happy-dom
/**
 * UX-2B integration — gutter pointerdown → pointermove → selectedBlockIds + visual state
 */
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BlockEditor } from './BlockEditor';
import { EDITOR_CHROME_STYLES } from './editorChromeStyles';
import { makeBlock, type Block } from './blockUtils';
import type { BlockEditorColors } from './editorTypes';

const colors: BlockEditorColors = {
  bg: '#fff', text: '#111', textMuted: '#666', textFaint: '#999',
  accent: '#8B5CF6', accentBg: '#eee', border: '#ddd', card: '#fff',
  cardHov: '#f5f5f5', input: '#fff', inputBdr: '#ccc', toolbar: '#f9f9f9',
  danger: '#f00', green: '#0f0', codeBg: '#f1f5f9', calloutBg: '#fafafa',
  toggleBg: 'transparent', quoteBdr: '#ccc', selection: '#eef',
};

const ROW_H = 40;

function rect(left: number, top: number, w: number, h: number): DOMRect {
  return {
    left, top, width: w, height: h, right: left + w, bottom: top + h, x: left, y: top,
    toJSON: () => ({}),
  } as DOMRect;
}

function mountEditor(blocks: Block[]) {
  const outer = document.createElement('div');
  outer.className = 'be-editor-root be-document-edit';
  outer.style.paddingLeft = '40px';
  document.body.innerHTML = '';
  document.body.appendChild(outer);
  const style = document.createElement('style');
  style.textContent = EDITOR_CHROME_STYLES;
  document.head.appendChild(style);

  let root: Root | null = null;
  act(() => {
    root = createRoot(outer);
    root.render(createElement(BlockEditor, { blocks, onChange: () => {}, colors, readOnly: false }));
  });

  const inner = outer.querySelector('.be-editor-root.be-document-edit + .be-editor-root')
    ?? outer.querySelectorAll('.be-editor-root')[1]
    ?? outer.querySelector('.be-editor-root:not(.be-document)') as HTMLElement;

  // BlockEditor wraps: outer be-document-edit > inner be-editor-root (from BlockEditorInner)
  const editorRoot = document.querySelectorAll('.be-editor-root').length > 1
    ? document.querySelectorAll('.be-editor-root')[1] as HTMLElement
    : document.querySelector('.be-editor-root') as HTMLElement;

  layoutBlockRects(blocks.map(b => b.id));
  stubElementFromPoint(blocks.map(b => b.id));
  return { outer, editorRoot, root };
}

function layoutBlockRects(ids: string[]) {
  ids.forEach((id, i) => {
    const block = document.querySelector(`[data-drag-id="${id}"]`) as HTMLElement | null;
    if (!block) return;
    const top = i * ROW_H;
    block.getBoundingClientRect = () => rect(40, top, 360, ROW_H - 4);
    const strip = block.querySelector('.be-gutter-strip') as HTMLElement | null;
    if (strip) strip.getBoundingClientRect = () => rect(0, top, 44, ROW_H - 4);
  });
}

function stubElementFromPoint(ids: string[]) {
  vi.spyOn(document, 'elementFromPoint').mockImplementation((x: number, y: number) => {
    const idx = Math.floor(y / ROW_H);
    if (idx < 0 || idx >= ids.length) return document.body;
    const id = ids[idx];
    if (x < 44) {
      return document.querySelector(`[data-gutter-block-id="${id}"] .be-gutter-strip`);
    }
    return document.querySelector(`[data-drag-id="${id}"] .be-editable`)
      ?? document.querySelector(`[data-drag-id="${id}"]`);
  });
}

function stripFor(id: string) {
  return document.querySelector(`[data-gutter-block-id="${id}"] .be-gutter-strip`) as HTMLElement;
}

function firePointer(el: Element, type: 'pointerdown' | 'pointermove' | 'pointerup', y: number, x = 22) {
  const r = el.getBoundingClientRect();
  const ev = new PointerEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX: x,
    clientY: y,
    pointerId: 1,
    button: 0,
    buttons: type === 'pointerup' ? 0 : 1,
    pointerType: 'mouse',
  });
  act(() => { el.dispatchEvent(ev); });
}

function selectedIds(): string[] {
  return [...document.querySelectorAll('.be-block-selected')].map(
    el => el.getAttribute('data-drag-id') ?? '',
  ).filter(Boolean);
}

describe('gutter drag integration', () => {
  let blocks: Block[];

  beforeEach(() => {
    blocks = ['a', 'b', 'c', 'd', 'e'].map((label, i) =>
      makeBlock('paragraph', { id: `blk-${label}`, content: label }),
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
    document.head.innerHTML = '';
  });

  it('renders hittable gutter strip per block', () => {
    mountEditor(blocks);
    expect(document.querySelectorAll('.be-gutter-strip').length).toBe(5);
    const strip = stripFor('blk-b');
    expect(getComputedStyle(strip).pointerEvents).toBe('auto');
    expect(getComputedStyle(strip.closest('.be-gutter')!).pointerEvents).toBe('auto');
  });

  it('pointerdown on gutter strip selects anchor block', () => {
    mountEditor(blocks);
    firePointer(stripFor('blk-b'), 'pointerdown', ROW_H * 1 + 10);
    expect(selectedIds()).toEqual(['blk-b']);
    expect(document.querySelector('.be-editor-root.be-gutter-dragging')).toBeTruthy();
  });

  it('pointermove B→D selects B,C,D with visual be-block-selected', () => {
    mountEditor(blocks);
    const stripB = stripFor('blk-b');
    firePointer(stripB, 'pointerdown', ROW_H * 1 + 10);
    firePointer(stripB, 'pointermove', ROW_H * 3 + 10);
    expect(selectedIds().sort()).toEqual(['blk-b', 'blk-c', 'blk-d'].sort());
    expect(document.querySelectorAll('.be-block-selected').length).toBe(3);
  });

  it('reverse drag D→B selects B,C,D', () => {
    mountEditor(blocks);
    const stripD = stripFor('blk-d');
    firePointer(stripD, 'pointerdown', ROW_H * 3 + 10);
    firePointer(stripD, 'pointermove', ROW_H * 1 + 10);
    expect(selectedIds().sort()).toEqual(['blk-b', 'blk-c', 'blk-d'].sort());
  });

  it('pointerup keeps selection and clears gutter-dragging class', () => {
    mountEditor(blocks);
    const stripB = stripFor('blk-b');
    firePointer(stripB, 'pointerdown', ROW_H * 1 + 10);
    firePointer(stripB, 'pointermove', ROW_H * 3 + 10);
    firePointer(stripB, 'pointerup', ROW_H * 3 + 10);
    expect(selectedIds().sort()).toEqual(['blk-b', 'blk-c', 'blk-d'].sort());
    expect(document.querySelector('.be-editor-root.be-gutter-dragging')).toBeFalsy();
  });

  it('text mousedown does not start gutter drag or multi-select', () => {
    mountEditor(blocks);
    const editable = document.querySelector('[data-drag-id="blk-b"] .be-editable') as HTMLElement;
    firePointer(editable, 'pointerdown', ROW_H * 1 + 10, 100);
    expect(document.querySelector('.be-editor-root.be-gutter-dragging')).toBeFalsy();
    expect(selectedIds().length).toBeLessThanOrEqual(1);
  });
});
