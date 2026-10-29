// @vitest-environment happy-dom
/**
 * UX-2B integration — gutter pointerdown → pointermove → selectedBlockIds + visual state
 */
import { createElement, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BlockEditor } from './BlockEditor';
import { EDITOR_CHROME_STYLES } from './editorChromeStyles';
import { alignHandleToFirstVisualLine } from './EditorChrome';
import { resolveDragOverFromPoint, commitDragDrop } from './editorDragDrop';
import { makeBlock, type Block } from './blockUtils';
import type { BlockEditorColors } from './editorTypes';
import { resolveDropPositionFromRect } from './features/block-editor/performance/rowMetrics';

const colors: BlockEditorColors = {
  bg: '#fff', text: '#111', textMuted: '#666', textFaint: '#999',
  accent: '#8B5CF6', accentBg: '#eee', border: '#ddd', card: '#fff',
  cardHov: '#f5f5f5', input: '#fff', inputBdr: '#ccc', toolbar: '#f9f9f9',
  danger: '#f00', green: '#0f0', codeBg: '#f1f5f9', calloutBg: '#fafafa',
  toggleBg: 'transparent', quoteBdr: '#ccc', selection: '#eef',
};

const ROW_H = 40;
const mountedRoots: Root[] = [];

function ControlledEditor({
  initialBlocks,
  onChange,
}: {
  initialBlocks: Block[];
  onChange: (blocks: Block[]) => void;
}) {
  const [currentBlocks, setCurrentBlocks] = useState(initialBlocks);
  return createElement(BlockEditor, {
    blocks: currentBlocks,
    onChange: next => {
      onChange(next);
      setCurrentBlocks(next);
    },
    colors,
    readOnly: false,
  });
}

function rect(left: number, top: number, w: number, h: number): DOMRect {
  return {
    left, top, width: w, height: h, right: left + w, bottom: top + h, x: left, y: top,
    toJSON: () => ({}),
  } as DOMRect;
}

function mountEditor(
  blocks: Block[],
  onChange: (blocks: Block[]) => void = () => {},
  controlled = false,
) {
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
    root.render(controlled
      ? createElement(ControlledEditor, { initialBlocks: blocks, onChange })
      : createElement(BlockEditor, { blocks, onChange, colors, readOnly: false }));
  });
  if (root) mountedRoots.push(root);

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

function firePointer(
  el: Element,
  type: 'pointerdown' | 'pointermove' | 'pointerup',
  y: number,
  x = 22,
  modifiers: Pick<PointerEventInit, 'shiftKey' | 'ctrlKey' | 'metaKey'> = {},
) {
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
    ...modifiers,
  });
  act(() => { el.dispatchEvent(ev); });
}

function fireKey(key: string, target: EventTarget = document.body): KeyboardEvent {
  const event = new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    cancelable: true,
  });
  act(() => target.dispatchEvent(event));
  return event;
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
    act(() => {
      mountedRoots.splice(0).forEach(root => root.unmount());
    });
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

  it('keeps the document clean at rest and reveals only the hovered block handle', () => {
    mountEditor(blocks);
    const block = document.querySelector('[data-drag-id="blk-b"]') as HTMLElement | null;
    const innerRoot = document.querySelector('.be-editor-root.be-blocks-root') as HTMLElement | null;
    const gutter = block?.querySelector(':scope > .be-gutter') as HTMLElement | null;
    const handles = gutter?.querySelector(':scope > .be-handles') as HTMLElement | null;
    const otherHandles = document.querySelector('[data-drag-id="blk-c"] .be-handles') as HTMLElement | null;

    expect(block).not.toBeNull();
    expect(innerRoot).not.toBeNull();
    expect(innerRoot?.classList.contains('be-document-edit')).toBe(false);
    expect(innerRoot?.classList.contains('be-blocks-root')).toBe(true);
    expect(getComputedStyle(innerRoot!).overflowX).toBe('visible');
    expect(document.querySelectorAll('.be-block-marker')).toHaveLength(0);
    expect(gutter).not.toBeNull();
    expect(handles).not.toBeNull();
    expect(handles?.querySelectorAll('.be-grip-dot')).toHaveLength(6);
    expect(getComputedStyle(handles!).opacity).toBe('0');
    expect(getComputedStyle(handles!).visibility).toBe('hidden');
    expect(getComputedStyle(handles!).pointerEvents).toBe('none');

    act(() => {
      block?.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, relatedTarget: document.body }));
    });
    expect(block?.classList.contains('be-controls-visible')).toBe(true);
    expect(getComputedStyle(handles!).visibility).toBe('visible');
    expect(getComputedStyle(handles!).pointerEvents).toBe('auto');
    expect(getComputedStyle(otherHandles!).opacity).toBe('0');
    expect(getComputedStyle(otherHandles!).visibility).toBe('hidden');
    expect(getComputedStyle(otherHandles!).pointerEvents).toBe('none');
  });

  it('pointerdown on gutter strip selects anchor block', () => {
    mountEditor(blocks);
    firePointer(stripFor('blk-b'), 'pointerdown', ROW_H * 1 + 10);
    expect(selectedIds()).toEqual(['blk-b']);
    expect(document.querySelector('.be-editor-root.be-gutter-dragging')).toBeTruthy();
  });

  it('a short grip click selects the block without opening its action menu', () => {
    const onChange = vi.fn();
    mountEditor(blocks, onChange);
    const grip = document.querySelector('[data-drag-id="blk-b"] .be-grip') as HTMLElement;
    firePointer(grip, 'pointerdown', ROW_H + 10);
    firePointer(grip, 'pointerup', ROW_H + 10);

    expect(selectedIds()).toEqual(['blk-b']);
    expect(document.querySelector('[data-k120-editor-context-menu]')).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('supports synthesized grip clicks without applying pointer selection twice', () => {
    const onChange = vi.fn();
    mountEditor(blocks, onChange);
    const editable = document.querySelector<HTMLElement>(
      '[data-drag-id="blk-a"] .be-editable',
    )!;
    editable.focus();
    const grip = document.querySelector<HTMLButtonElement>(
      '[data-drag-id="blk-b"] .be-grip',
    )!;

    expect(grip.getAttribute('aria-pressed')).toBe('false');
    expect(grip.getAttribute('aria-label')).toContain('paragraph: b');
    expect(document.querySelector<HTMLButtonElement>(
      '[data-drag-id="blk-b"] .be-handle-menu-btn',
    )?.getAttribute('aria-label')).toContain('paragraph: b');
    act(() => grip.click());
    expect(selectedIds()).toEqual(['blk-b']);
    expect(grip.getAttribute('aria-pressed')).toBe('true');
    expect(document.activeElement).not.toBe(editable);

    const gripC = document.querySelector<HTMLButtonElement>(
      '[data-drag-id="blk-c"] .be-grip',
    )!;
    firePointer(gripC, 'pointerdown', ROW_H * 2 + 10, 22, { ctrlKey: true });
    firePointer(gripC, 'pointerup', ROW_H * 2 + 10, 22, { ctrlKey: true });
    expect(selectedIds().sort()).toEqual(['blk-b', 'blk-c']);

    firePointer(gripC, 'pointerdown', ROW_H * 2 + 10, 22, { ctrlKey: true });
    firePointer(gripC, 'pointerup', ROW_H * 2 + 10, 22, { ctrlKey: true });
    act(() => {
      gripC.dispatchEvent(new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        detail: 1,
        ctrlKey: true,
      }));
    });

    expect(selectedIds()).toEqual(['blk-b']);
    expect(gripC.getAttribute('aria-pressed')).toBe('false');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('ignores repeated Enter activation so additive selection cannot toggle twice', () => {
    mountEditor(blocks);
    const select = (id: string, y: number, ctrlKey = false) => {
      const grip = document.querySelector(`[data-drag-id="${id}"] .be-grip`) as HTMLElement;
      firePointer(grip, 'pointerdown', y, 22, { ctrlKey });
      firePointer(grip, 'pointerup', y, 22, { ctrlKey });
    };
    select('blk-b', ROW_H + 10);
    select('blk-c', ROW_H * 2 + 10, true);
    expect(selectedIds().sort()).toEqual(['blk-b', 'blk-c']);

    const gripC = document.querySelector<HTMLButtonElement>(
      '[data-drag-id="blk-c"] .be-grip',
    )!;
    const activate = (repeat: boolean) => {
      const event = new KeyboardEvent('keydown', {
        key: 'Enter', bubbles: true, cancelable: true, ctrlKey: true, repeat,
      });
      act(() => gripC.dispatchEvent(event));
      return event;
    };

    expect(activate(false).defaultPrevented).toBe(true);
    expect(selectedIds()).toEqual(['blk-b']);
    expect(activate(true).defaultPrevented).toBe(true);
    expect(selectedIds()).toEqual(['blk-b']);
  });

  it('Delete after synthesized grip activation uses the existing block deletion command', () => {
    const onChange = vi.fn();
    mountEditor(blocks, onChange);
    const editable = document.querySelector<HTMLElement>(
      '[data-drag-id="blk-a"] .be-editable',
    )!;
    editable.focus();
    const grip = document.querySelector<HTMLButtonElement>(
      '[data-drag-id="blk-b"] .be-grip',
    )!;

    act(() => grip.click());
    expect(selectedIds()).toEqual(['blk-b']);
    expect(document.activeElement).not.toBe(editable);
    fireKey('Delete', document.activeElement ?? document.body);

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.lastCall?.[0].map((block: Block) => block.id))
      .toEqual(['blk-a', 'blk-c', 'blk-d', 'blk-e']);
  });

  it('grip Shift+click selects a contiguous range and Ctrl/Cmd+click toggles blocks', () => {
    mountEditor(blocks);
    const clickGrip = (id: string, modifiers: Pick<PointerEventInit, 'shiftKey' | 'ctrlKey' | 'metaKey'> = {}) => {
      const grip = document.querySelector(`[data-drag-id="${id}"] .be-grip`) as HTMLElement;
      const y = (['blk-a', 'blk-b', 'blk-c', 'blk-d', 'blk-e'].indexOf(id) * ROW_H) + 10;
      firePointer(grip, 'pointerdown', y, 22, modifiers);
      firePointer(grip, 'pointerup', y, 22, modifiers);
    };

    clickGrip('blk-b');
    clickGrip('blk-d', { shiftKey: true });
    expect(selectedIds().sort()).toEqual(['blk-b', 'blk-c', 'blk-d']);

    clickGrip('blk-a', { ctrlKey: true });
    expect(selectedIds().sort()).toEqual(['blk-a', 'blk-b', 'blk-c', 'blk-d']);
    clickGrip('blk-a', { metaKey: true });
    expect(selectedIds().sort()).toEqual(['blk-b', 'blk-c', 'blk-d']);
  });

  it('Delete after a grip selection uses the existing single-block deletion command', () => {
    const onChange = vi.fn();
    mountEditor(blocks, onChange);
    const editableA = document.querySelector('[data-drag-id="blk-a"] .be-editable') as HTMLElement;
    editableA.focus();
    const gripB = document.querySelector('[data-drag-id="blk-b"] .be-grip') as HTMLElement;
    firePointer(gripB, 'pointerdown', ROW_H + 10);
    firePointer(gripB, 'pointerup', ROW_H + 10);

    expect(document.activeElement).not.toBe(editableA);
    expect(selectedIds()).toEqual(['blk-b']);
    fireKey('Delete');

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.lastCall?.[0].map((block: Block) => block.id))
      .toEqual(['blk-a', 'blk-c', 'blk-d', 'blk-e']);
  });

  it('uses Escape from text editing to focus the selected block grip for keyboard deletion', () => {
    const onChange = vi.fn();
    mountEditor(blocks, onChange);
    const editable = document.querySelector<HTMLElement>(
      '[data-drag-id="blk-b"] .be-editable',
    )!;
    const grip = document.querySelector<HTMLButtonElement>(
      '[data-drag-id="blk-b"] .be-grip',
    )!;
    act(() => editable.focus());

    const escape = fireKey('Escape', editable);

    expect(escape.defaultPrevented).toBe(true);
    expect(selectedIds()).toEqual(['blk-b']);
    expect(document.activeElement).toBe(grip);
    fireKey('Delete', grip);
    expect(onChange.mock.lastCall?.[0].map((block: Block) => block.id))
      .toEqual(['blk-a', 'blk-c', 'blk-d', 'blk-e']);
  });

  it('Delete batch-removes a selected range through the existing command', () => {
    const onChange = vi.fn();
    mountEditor(blocks, onChange);
    const clickGrip = (id: string, y: number, modifiers: Pick<PointerEventInit, 'shiftKey'> = {}) => {
      const grip = document.querySelector(`[data-drag-id="${id}"] .be-grip`) as HTMLElement;
      firePointer(grip, 'pointerdown', y, 22, modifiers);
      firePointer(grip, 'pointerup', y, 22, modifiers);
    };

    clickGrip('blk-b', ROW_H + 10);
    clickGrip('blk-d', ROW_H * 3 + 10, { shiftKey: true });
    fireKey('Delete');

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.lastCall?.[0].map((block: Block) => block.id))
      .toEqual(['blk-a', 'blk-e']);
  });

  it('Escape clears selection made from the grip', () => {
    mountEditor(blocks);
    const grip = document.querySelector('[data-drag-id="blk-c"] .be-grip') as HTMLElement;
    firePointer(grip, 'pointerdown', ROW_H * 2 + 10);
    firePointer(grip, 'pointerup', ROW_H * 2 + 10);

    fireKey('Escape');

    expect(selectedIds()).toEqual([]);
  });

  it('grip selection supports a nested toggle child', () => {
    const child = makeBlock('paragraph', { id: 'nested-child', content: 'child' });
    const toggle = makeBlock('toggle', {
      id: 'toggle-parent', content: 'toggle', collapsed: false, children: [child],
    });
    mountEditor([toggle]);
    const grip = document.querySelector('[data-drag-id="nested-child"] .be-grip') as HTMLElement;
    firePointer(grip, 'pointerdown', 10);
    firePointer(grip, 'pointerup', 10);

    expect(selectedIds()).toEqual(['nested-child']);
  });

  it('keeps nested block handles within the nested gutter at coarse and desktop sizes', () => {
    const child = makeBlock('paragraph', { id: 'nested-handle-layout', content: 'child' });
    const toggle = makeBlock('toggle', {
      id: 'toggle-handle-layout', content: 'toggle', collapsed: false, children: [child],
    });
    mountEditor([toggle]);

    const handles = document.querySelector<HTMLElement>(
      '[data-drag-id="nested-handle-layout"] .be-handles',
    );
    alignHandleToFirstVisualLine(handles!);
    const gutter = handles?.parentElement;
    expect(gutter && getComputedStyle(gutter).width).toBe('56px');
    expect(handles?.style.left).toBe('0px');
    expect(handles?.style.width).toBe('100%');
    expect(handles?.style.transform).toBe('translateY(-50%)');
    expect(getComputedStyle(handles!).gridTemplateColumns).toBe('repeat(2, minmax(0, 1fr))');
    expect(handles?.querySelectorAll('.be-handle-btn')).toHaveLength(2);
    expect(EDITOR_CHROME_STYLES).toMatch(
      /@media \(pointer: coarse\) \{[\s\S]*?\.be-document-edit\s*\{[^}]*padding-left: 88px;/,
    );
    expect(EDITOR_CHROME_STYLES).toMatch(
      /\.be-gutter,\s*\.be-editor-nested \.be-gutter\s*\{[^}]*flex-basis: 88px;[^}]*width: 88px;[^}]*margin-left: -88px;/,
    );
    expect(EDITOR_CHROME_STYLES).toContain(
      'grid-template-columns: repeat(2, minmax(44px, 1fr)) !important;',
    );
    expect(EDITOR_CHROME_STYLES).toContain('min-height: 44px;');
    expect(EDITOR_CHROME_STYLES).toContain('height: 44px;');
  });

  it('blurs an ancestor toggle heading when selecting a nested child', () => {
    const child = makeBlock('paragraph', { id: 'nested-child-focus', content: 'child' });
    const toggle = makeBlock('toggle', {
      id: 'toggle-parent-focus', content: 'toggle', collapsed: false, children: [child],
    });
    mountEditor([toggle]);
    const header = document.querySelector<HTMLElement>(
      '[data-drag-id="toggle-parent-focus"] .be-editable',
    );
    header?.focus();
    expect(document.activeElement).toBe(header);

    const grip = document.querySelector<HTMLElement>(
      '[data-drag-id="nested-child-focus"] .be-grip',
    ) as HTMLElement;
    firePointer(grip, 'pointerdown', 10);
    firePointer(grip, 'pointerup', 10);

    expect(selectedIds()).toContain('nested-child-focus');
    expect(document.activeElement).not.toBe(header);
  });

  it('uses shared selection and root batch deletion for nested toggle actions', () => {
    const childA = makeBlock('paragraph', { id: 'nested-a', content: 'A' });
    const childB = makeBlock('paragraph', { id: 'nested-b', content: 'B' });
    const childC = makeBlock('paragraph', { id: 'nested-c', content: 'C' });
    const toggle = makeBlock('toggle', {
      id: 'toggle-parent', content: 'toggle', collapsed: false, children: [childA, childB, childC],
    });
    const onChange = vi.fn();
    mountEditor([toggle], onChange);
    const clickGrip = (id: string, modifiers: Pick<PointerEventInit, 'ctrlKey' | 'metaKey'> = {}) => {
      const grip = document.querySelector(`[data-drag-id="${id}"] .be-grip`) as HTMLElement;
      firePointer(grip, 'pointerdown', 10, 22, modifiers);
      firePointer(grip, 'pointerup', 10, 22, modifiers);
    };

    clickGrip('nested-a');
    clickGrip('nested-c', { ctrlKey: true });
    const actions = document.querySelector<HTMLButtonElement>(
      '[data-drag-id="nested-c"] .be-handle-menu-btn',
    );
    act(() => actions?.click());

    const menu = document.querySelector('[data-k120-editor-context-menu]');
    expect(menu?.textContent).toContain('2 blocks selected');
    const deleteAction = [...(menu?.querySelectorAll('button') ?? [])]
      .find(button => button.textContent?.trim() === 'Delete');
    act(() => deleteAction?.click());

    expect(onChange).toHaveBeenCalledTimes(1);
    const updatedToggle = onChange.mock.lastCall?.[0].find((block: Block) => block.id === 'toggle-parent');
    expect(updatedToggle?.children.map((block: Block) => block.id)).toEqual(['nested-b']);
  });

  it('clears stale block selection before a table control action', () => {
    const table = makeBlock('table', {
      id: 'table-selection-guard', tableHeaders: ['A'], tableRows: [['1']],
    });
    const initial = [blocks[0]!, table, blocks[1]!];
    const onChange = vi.fn();
    mountEditor(initial, onChange);
    const selectWithGrip = (id: string, y: number, modifiers: Pick<PointerEventInit, 'ctrlKey'> = {}) => {
      const grip = document.querySelector(`[data-drag-id="${id}"] .be-grip`) as HTMLElement;
      firePointer(grip, 'pointerdown', y, 22, modifiers);
      firePointer(grip, 'pointerup', y, 22, modifiers);
    };
    selectWithGrip('blk-a', 10);
    selectWithGrip('blk-b', ROW_H * 2 + 10, { ctrlKey: true });
    expect(selectedIds().sort()).toEqual(['blk-a', 'blk-b']);

    const tableControls = document.querySelectorAll<HTMLButtonElement>(
      '[data-drag-id="table-selection-guard"] .be-table-control',
    );
    const addRow = tableControls[tableControls.length - 1];
    expect(addRow).not.toBeNull();
    act(() => addRow?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true })));
    expect(selectedIds()).toEqual([]);
    expect(onChange).not.toHaveBeenCalled();
    act(() => addRow?.click());
    expect(onChange).toHaveBeenCalledTimes(1);

    fireKey('Delete', document.body);
    fireKey('Backspace', document.body);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.lastCall?.[0].map((block: Block) => block.id))
      .toEqual(['blk-a', 'table-selection-guard', 'blk-b']);
  });

  it('clears stale block selection when entering a table cell before editing keys', () => {
    const table = makeBlock('table', {
      id: 'table-cell-selection-guard', tableHeaders: ['A'], tableRows: [['cell']],
    });
    const onChange = vi.fn();
    mountEditor([blocks[0]!, table, blocks[1]!], onChange);
    const grip = document.querySelector<HTMLButtonElement>('[data-drag-id="blk-a"] .be-grip')!;
    firePointer(grip, 'pointerdown', 10);
    firePointer(grip, 'pointerup', 10);
    expect(selectedIds()).toEqual(['blk-a']);

    const cell = document.querySelector<HTMLElement>(
      '[data-drag-id="table-cell-selection-guard"] tbody [contenteditable="true"]',
    )!;
    act(() => cell.focus());
    expect(selectedIds()).toEqual([]);

    const deleteKey = fireKey('Delete', cell);
    const backspaceKey = fireKey('Backspace', cell);
    expect(deleteKey.defaultPrevented).toBe(false);
    expect(backspaceKey.defaultPrevented).toBe(false);
    expect(onChange).not.toHaveBeenCalled();

    const tabKey = fireKey('Tab', cell);
    expect(tabKey.defaultPrevented).toBe(true);
    const result = onChange.mock.lastCall?.[0] as Block[];
    expect(result.map(block => [block.id, block.indent])).toEqual([
      ['blk-a', 0], ['table-cell-selection-guard', 0], ['blk-b', 0],
    ]);
    expect(result[1]?.tableRows).toHaveLength(2);
  });

  it('clears stale block selection when entering a table header', () => {
    const table = makeBlock('table', {
      id: 'table-header-selection-guard', tableHeaders: ['A'], tableRows: [['1']],
    });
    mountEditor([blocks[0]!, table]);
    const grip = document.querySelector<HTMLButtonElement>('[data-drag-id="blk-a"] .be-grip')!;
    firePointer(grip, 'pointerdown', 10);
    firePointer(grip, 'pointerup', 10);
    expect(selectedIds()).toEqual(['blk-a']);

    const header = document.querySelector<HTMLElement>(
      '[data-drag-id="table-header-selection-guard"] thead [contenteditable="true"]',
    )!;
    act(() => header.focus());

    expect(selectedIds()).toEqual([]);
  });

  it('leaves Shift+Arrow in a table cell to native text selection instead of block navigation', () => {
    const table = makeBlock('table', {
      id: 'table-shift-arrow', tableHeaders: ['A'], tableRows: [['cell']],
    });
    const onChange = vi.fn();
    mountEditor([blocks[0]!, table, blocks[1]!], onChange);

    const cell = document.querySelector<HTMLElement>(
      '[data-drag-id="table-shift-arrow"] tbody [contenteditable="true"]',
    )!;
    act(() => cell.focus());
    const event = new KeyboardEvent('keydown', {
      key: 'ArrowDown', shiftKey: true, bubbles: true, cancelable: true,
    });
    act(() => cell.dispatchEvent(event));

    expect(event.defaultPrevented).toBe(false);
    expect(document.activeElement).toBe(cell);
    expect(selectedIds()).toEqual([]);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('activates table controls from the keyboard-synthesized click event', () => {
    const table = makeBlock('table', {
      id: 'table-keyboard-control', tableHeaders: ['A'], tableRows: [['1']],
    });
    const onChange = vi.fn();
    mountEditor([blocks[0]!, table], onChange);
    const grip = document.querySelector<HTMLButtonElement>(
      '[data-drag-id="blk-a"] .be-grip',
    )!;
    firePointer(grip, 'pointerdown', 10);
    firePointer(grip, 'pointerup', 10);
    expect(selectedIds()).toEqual(['blk-a']);

    const addRow = document.querySelector<HTMLButtonElement>(
      '[data-drag-id="table-keyboard-control"] tfoot .be-table-control',
    );
    expect(addRow).not.toBeNull();

    act(() => addRow?.focus());
    // Focusing a descendant control clears the old block selection without
    // selecting the containing table shell again.
    expect(selectedIds()).toEqual([]);
    fireKey('Delete', addRow ?? document.body);
    expect(onChange).not.toHaveBeenCalled();
    act(() => {
      addRow?.dispatchEvent(new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        detail: 0,
      }));
    });

    expect(selectedIds()).toEqual([]);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.lastCall?.[0].find((block: Block) => block.id === 'table-keyboard-control')?.tableRows)
      .toEqual([['1'], ['']]);
  });

  it('reveals row and column actions to keyboard navigation and leaves their Tab boundaries native', () => {
    const table = makeBlock('table', {
      id: 'table-keyboard-actions',
      tableHeaders: ['A'],
      tableRows: [['1'], ['2']],
    });
    const onChange = vi.fn();
    mountEditor([table], onChange, true);
    const header = document.querySelector<HTMLElement>(
      '[data-drag-id="table-keyboard-actions"] thead [contenteditable="true"]',
    )!;

    act(() => header.focus());
    const headerCell = header.closest('th')!;
    expect(headerCell.querySelectorAll('.be-table-control')).toHaveLength(2);
    const shiftTabFromHeader = new KeyboardEvent('keydown', {
      key: 'Tab', shiftKey: true, bubbles: true, cancelable: true,
    });
    act(() => header.dispatchEvent(shiftTabFromHeader));
    expect(shiftTabFromHeader.defaultPrevented).toBe(false);

    const tabFromLastHeader = new KeyboardEvent('keydown', {
      key: 'Tab', bubbles: true, cancelable: true,
    });
    act(() => header.dispatchEvent(tabFromLastHeader));
    expect(tabFromLastHeader.defaultPrevented).toBe(false);

    const addColumn = headerCell.querySelector<HTMLButtonElement>('.be-table-control')!;
    act(() => addColumn.click());
    expect(onChange.mock.lastCall?.[0].find((block: Block) => block.id === 'table-keyboard-actions')?.tableHeaders)
      .toEqual(['A', 'Col 2']);

    const firstCell = document.querySelector<HTMLElement>(
      '[data-drag-id="table-keyboard-actions"] tbody [contenteditable="true"]',
    )!;
    act(() => firstCell.focus());
    const row = firstCell.closest('tr')!;
    expect(row.querySelector('.be-table-control')).not.toBeNull();
    const shiftTabFromFirstCell = new KeyboardEvent('keydown', {
      key: 'Tab', shiftKey: true, bubbles: true, cancelable: true,
    });
    act(() => firstCell.dispatchEvent(shiftTabFromFirstCell));
    expect(shiftTabFromFirstCell.defaultPrevented).toBe(false);

    const deleteRow = row.querySelector<HTMLButtonElement>('.be-table-control')!;
    act(() => deleteRow.click());
    expect(onChange.mock.lastCall?.[0].find((block: Block) => block.id === 'table-keyboard-actions')?.tableRows)
      .toEqual([['2', '']]);
  });

  it('provides a keyboard path to Add row and preserves Tab-to-append', () => {
    const table = makeBlock('table', {
      id: 'table-add-row-keyboard', tableHeaders: ['A'], tableRows: [['1'], ['2']],
    });
    const onChange = vi.fn();
    mountEditor([table], onChange, true);

    let cells = document.querySelectorAll<HTMLElement>(
      '[data-drag-id="table-add-row-keyboard"] tbody [contenteditable="true"]',
    );
    const finalCell = cells[cells.length - 1]!;
    act(() => finalCell.focus());
    const shortcut = new KeyboardEvent('keydown', {
      key: 'Enter', ctrlKey: true, shiftKey: true, bubbles: true, cancelable: true,
    });
    act(() => finalCell.dispatchEvent(shortcut));

    const addRow = document.querySelector<HTMLButtonElement>(
      '[data-drag-id="table-add-row-keyboard"] tfoot .be-table-control',
    )!;
    expect(shortcut.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(addRow);
    expect(addRow.getAttribute('aria-keyshortcuts')).toBe('Control+Shift+Enter Meta+Shift+Enter');
    expect(onChange.mock.lastCall?.[0].find((block: Block) => block.id === 'table-add-row-keyboard')?.tableRows)
      .toEqual([['1'], ['2']]);

    act(() => addRow.click());
    expect(onChange.mock.lastCall?.[0].find((block: Block) => block.id === 'table-add-row-keyboard')?.tableRows)
      .toEqual([['1'], ['2'], ['']]);

    cells = document.querySelectorAll<HTMLElement>(
      '[data-drag-id="table-add-row-keyboard"] tbody [contenteditable="true"]',
    );
    const appendedLastCell = cells[cells.length - 1]!;
    act(() => appendedLastCell.focus());
    const tab = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    act(() => appendedLastCell.dispatchEvent(tab));
    expect(tab.defaultPrevented).toBe(true);
    expect(onChange.mock.lastCall?.[0].find((block: Block) => block.id === 'table-add-row-keyboard')?.tableRows)
      .toEqual([['1'], ['2'], [''], ['']]);
  });

  it('leaves multi-column header Tab traversal native so column controls remain reachable', () => {
    const table = makeBlock('table', {
      id: 'table-multi-column-keyboard',
      tableHeaders: ['A', 'B'],
      tableRows: [['1', '2']],
    });
    mountEditor([table]);
    const headers = document.querySelectorAll<HTMLElement>(
      '[data-drag-id="table-multi-column-keyboard"] thead th [contenteditable="true"]',
    );
    const firstHeader = headers[0]!;
    const nextHeader = headers[1]!;

    act(() => firstHeader.focus());
    const tabToNextHeader = new KeyboardEvent('keydown', {
      key: 'Tab', bubbles: true, cancelable: true,
    });
    act(() => firstHeader.dispatchEvent(tabToNextHeader));
    expect(tabToNextHeader.defaultPrevented).toBe(false);

    act(() => nextHeader.focus());
    const nextHeaderCell = nextHeader.closest('th')!;
    expect(nextHeaderCell.querySelectorAll('.be-table-control')).toHaveLength(2);
    const shiftTabToColumnActions = new KeyboardEvent('keydown', {
      key: 'Tab', shiftKey: true, bubbles: true, cancelable: true,
    });
    act(() => nextHeader.dispatchEvent(shiftTabToColumnActions));
    expect(shiftTabToColumnActions.defaultPrevented).toBe(false);
  });

  it('clears the shared root selection before a nested table action', () => {
    const nestedTable = makeBlock('table', {
      id: 'nested-selection-table', tableHeaders: ['A'], tableRows: [['1']],
    });
    const toggle = makeBlock('toggle', {
      id: 'nested-selection-toggle', content: 'toggle', collapsed: false, children: [nestedTable],
    });
    const before = makeBlock('paragraph', { id: 'root-before-table', content: 'before' });
    const after = makeBlock('paragraph', { id: 'root-after-table', content: 'after' });
    const onChange = vi.fn();
    mountEditor([before, toggle, after], onChange);
    const select = (id: string, y: number, ctrlKey = false) => {
      const grip = document.querySelector(`[data-drag-id="${id}"] .be-grip`) as HTMLElement;
      firePointer(grip, 'pointerdown', y, 22, { ctrlKey });
      firePointer(grip, 'pointerup', y, 22, { ctrlKey });
    };
    select('root-before-table', 10);
    select('root-after-table', ROW_H * 2 + 10, true);
    expect(selectedIds().sort()).toEqual(['root-after-table', 'root-before-table']);

    const addRow = document.querySelector<HTMLButtonElement>(
      '[data-drag-id="nested-selection-table"] tfoot .be-table-control',
    )!;
    act(() => addRow.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true })));
    expect(selectedIds()).toEqual([]);
    expect(onChange).not.toHaveBeenCalled();
    act(() => addRow.click());
    expect(onChange).toHaveBeenCalledTimes(1);
    fireKey('Delete', document.body);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('leaves Shift+Arrow at editable block boundaries to native text selection', () => {
    mountEditor(blocks);
    const grip = document.querySelector<HTMLButtonElement>('[data-drag-id="blk-a"] .be-grip')!;
    grip.focus();
    fireKey('Enter', grip);
    expect(selectedIds()).toEqual(['blk-a']);

    const editable = document.querySelector<HTMLElement>(
      '[data-drag-id="blk-a"] .be-editable[contenteditable="true"]',
    )!;
    editable.focus();
    const textNode = editable.firstChild!;
    const selection = window.getSelection()!;
    const dispatchShiftArrow = (key: 'ArrowUp' | 'ArrowDown', offset: number) => {
      const range = document.createRange();
      range.setStart(textNode, offset);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
      const event = new KeyboardEvent('keydown', {
        key, shiftKey: true, bubbles: true, cancelable: true,
      });
      act(() => editable.dispatchEvent(event));
      return event;
    };

    const shiftUpAtStart = dispatchShiftArrow('ArrowUp', 0);
    const shiftDownAtEnd = dispatchShiftArrow('ArrowDown', textNode.textContent?.length ?? 0);

    expect(shiftUpAtStart.defaultPrevented).toBe(false);
    expect(shiftDownAtEnd.defaultPrevented).toBe(false);
    expect(selectedIds()).toEqual(['blk-a']);
    expect(document.activeElement).toBe(editable);
  });

  it('keeps block actions available from a labeled keyboard-accessible button', () => {
    mountEditor(blocks);
    const grip = document.querySelector<HTMLButtonElement>(
      '[data-drag-id="blk-b"] .be-grip',
    )!;
    grip.focus();
    fireKey('Enter', grip);
    expect(selectedIds()).toEqual(['blk-b']);
    expect(fireKey('Tab', grip).defaultPrevented).toBe(false);

    const actions = document.querySelector<HTMLButtonElement>(
      '[data-drag-id="blk-b"] .be-handle-menu-btn',
    );
    expect(actions?.getAttribute('aria-label')).toBeTruthy();
    expect(actions?.title).toBeTruthy();
    expect(actions?.getAttribute('aria-haspopup')).toBeNull();
    expect(actions?.getAttribute('aria-expanded')).toBe('false');
    expect(actions?.getAttribute('aria-controls')).toBeNull();
    actions?.focus();
    expect(fireKey('Enter', actions).defaultPrevented).toBe(false);
    act(() => actions?.click());
    const menu = document.querySelector('[data-k120-editor-context-menu]');
    expect(menu).not.toBeNull();
    expect(actions?.getAttribute('aria-controls')).toBe(menu?.id);
    expect(actions?.getAttribute('aria-expanded')).toBe('true');
    const firstAction = menu?.querySelector('button');
    expect(document.activeElement).toBe(firstAction);
    // happy-dom does not perform native activation or Tab traversal. Verify the editor leaves defaults available.
    expect(fireKey('Tab', firstAction ?? document.body).defaultPrevented).toBe(false);
    expect(fireKey('Enter', firstAction ?? document.body).defaultPrevented).toBe(false);
    expect(document.querySelector('[data-k120-editor-context-menu]')).not.toBeNull();

    const transformAction = [...(menu?.querySelectorAll('button') ?? [])]
      .find(button => button.textContent?.includes('Transform'));
    act(() => transformAction?.click());
    const submenuFirstAction = menu?.querySelector('[data-be-menu-action]');
    expect(document.activeElement).toBe(submenuFirstAction);

    fireKey('Escape', submenuFirstAction ?? document.body);

    expect(document.querySelector('[data-k120-editor-context-menu]')).toBeNull();
    expect(selectedIds()).toEqual(['blk-b']);
    expect(actions?.getAttribute('aria-expanded')).toBe('false');
    expect(actions?.getAttribute('aria-controls')).toBeNull();
    expect(document.activeElement).toBe(actions);
  });

  it('leaves Enter available to activate a Transform action and converts the selected block', () => {
    const onChange = vi.fn();
    mountEditor(blocks, onChange);
    const actions = document.querySelector<HTMLButtonElement>(
      '[data-drag-id="blk-b"] .be-handle-menu-btn',
    )!;
    act(() => actions.click());
    const menu = document.querySelector('[data-k120-editor-context-menu]')!;
    const transform = [...menu.querySelectorAll('button')]
      .find(button => button.textContent?.includes('Transform'))!;
    act(() => transform.click());

    const firstSubmenuAction = menu.querySelector<HTMLButtonElement>('[data-be-menu-action]')!;
    expect(document.activeElement).toBe(firstSubmenuAction);
    const headingChoice = menu.querySelector<HTMLButtonElement>(
      '[data-be-menu-action][data-be-block-type="heading1"]',
    )!;
    headingChoice.focus();
    expect(document.activeElement).toBe(headingChoice);
    expect(fireKey('Enter', headingChoice).defaultPrevented).toBe(false);
    // happy-dom does not synthesize native button activation from Enter; invoke its click default explicitly.
    act(() => headingChoice.click());

    expect(onChange.mock.lastCall?.[0].find((block: Block) => block.id === 'blk-b')?.type)
      .toBe('heading1');
    expect(document.querySelector('[data-k120-editor-context-menu]')).toBeNull();
  });

  it('does not delete the selected blocks when Delete or Backspace is pressed inside the menu', () => {
    const onChange = vi.fn();
    mountEditor(blocks, onChange);
    const clickGrip = (id: string, y: number, shiftKey = false) => {
      const grip = document.querySelector(`[data-drag-id="${id}"] .be-grip`) as HTMLElement;
      firePointer(grip, 'pointerdown', y, 22, { shiftKey });
      firePointer(grip, 'pointerup', y, 22, { shiftKey });
    };
    clickGrip('blk-b', ROW_H + 10);
    clickGrip('blk-d', ROW_H * 3 + 10, true);
    const actions = document.querySelector<HTMLButtonElement>(
      '[data-drag-id="blk-d"] .be-handle-menu-btn',
    )!;
    act(() => actions.click());
    const menu = document.querySelector('[data-k120-editor-context-menu]')!;
    const focusedAction = menu.querySelector('button')!;
    expect(document.activeElement).toBe(focusedAction);

    expect(fireKey('Delete', focusedAction).defaultPrevented).toBe(false);
    expect(fireKey('Backspace', focusedAction).defaultPrevented).toBe(false);
    expect(onChange).not.toHaveBeenCalled();
    expect(selectedIds().sort()).toEqual(['blk-b', 'blk-c', 'blk-d']);
    expect(document.querySelector('[data-k120-editor-context-menu]')).not.toBeNull();

    fireKey('Escape', focusedAction);
    expect(document.querySelector('[data-k120-editor-context-menu]')).toBeNull();
    expect(document.activeElement).toBe(actions);
    expect(fireKey('Delete', actions).defaultPrevented).toBe(false);
    expect(fireKey('Backspace', actions).defaultPrevented).toBe(false);
    expect(onChange).not.toHaveBeenCalled();
    expect(selectedIds().sort()).toEqual(['blk-b', 'blk-c', 'blk-d']);
  });

  it('moves focus to a surviving block after single-block menu deletion', async () => {
    const onChange = vi.fn();
    mountEditor(blocks, onChange);
    const actions = document.querySelector<HTMLButtonElement>(
      '[data-drag-id="blk-b"] .be-handle-menu-btn',
    )!;
    act(() => actions.click());
    const menu = document.querySelector('[data-k120-editor-context-menu]')!;
    const deleteAction = [...menu.querySelectorAll('button')]
      .find(button => button.textContent?.trim() === 'Delete')!;

    await act(async () => {
      deleteAction.click();
      await new Promise<void>(resolve => window.requestAnimationFrame(() => resolve()));
    });

    expect(onChange.mock.lastCall?.[0].map((block: Block) => block.id))
      .toEqual(['blk-a', 'blk-c', 'blk-d', 'blk-e']);
    expect(document.activeElement?.closest('[data-drag-id]')?.getAttribute('data-drag-id'))
      .toBe('blk-a');
  });

  it('replaces the shared root selection after deleting a single nested block from its menu', () => {
    const childA = makeBlock('paragraph', { id: 'nested-delete-a', content: 'A' });
    const childB = makeBlock('paragraph', { id: 'nested-delete-b', content: 'B' });
    const toggle = makeBlock('toggle', {
      id: 'nested-delete-parent', content: 'toggle', collapsed: false, children: [childA, childB],
    });
    const onChange = vi.fn();
    mountEditor([toggle], onChange);

    const grip = document.querySelector<HTMLElement>(
      '[data-drag-id="nested-delete-a"] .be-grip',
    )!;
    firePointer(grip, 'pointerdown', 10);
    firePointer(grip, 'pointerup', 10);
    const actions = document.querySelector<HTMLButtonElement>(
      '[data-drag-id="nested-delete-a"] .be-handle-menu-btn',
    )!;
    act(() => actions.click());
    const menu = document.querySelector('[data-k120-editor-context-menu]')!;
    const deleteAction = [...menu.querySelectorAll('button')]
      .find(button => button.textContent?.trim() === 'Delete')!;
    act(() => deleteAction.click());

    const updatedToggle = onChange.mock.lastCall?.[0].find((block: Block) => block.id === 'nested-delete-parent');
    expect(updatedToggle?.children.map((block: Block) => block.id)).toEqual(['nested-delete-b']);
    expect(selectedIds()).toEqual(['nested-delete-b']);
  });

  it('restores focus to a block after Outdent reparents it out of a toggle', async () => {
    const child = makeBlock('paragraph', { id: 'nested-outdent-focus', content: 'child' });
    const toggle = makeBlock('toggle', {
      id: 'outdent-parent', content: 'toggle', collapsed: false, children: [child],
    });
    const onChange = vi.fn();
    mountEditor([toggle], onChange, true);
    const actions = document.querySelector<HTMLButtonElement>(
      '[data-drag-id="nested-outdent-focus"] .be-handle-menu-btn',
    )!;
    act(() => actions.click());
    const menu = document.querySelector('[data-k120-editor-context-menu]')!;
    const outdent = [...menu.querySelectorAll('button')]
      .find(button => button.textContent?.trim() === 'Outdent')!;

    await act(async () => {
      outdent.click();
      await new Promise<void>(resolve => window.requestAnimationFrame(() => resolve()));
    });

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(document.querySelector('[data-drag-id="nested-outdent-focus"]')?.parentElement?.closest('[data-drag-id]'))
      .toBeNull();
    expect(document.activeElement?.closest('[data-drag-id]')?.getAttribute('data-drag-id'))
      .toBe('nested-outdent-focus');
    expect((document.activeElement as HTMLElement).classList.contains('be-editable')).toBe(true);
  });

  it('keeps the action trigger visible while restoring focus after reopening its menu', async () => {
    mountEditor(blocks);
    const block = document.querySelector<HTMLElement>('[data-drag-id="blk-b"]')!;
    const handles = block.querySelector<HTMLElement>('.be-handles')!;
    const actions = block.querySelector<HTMLButtonElement>(
      '[data-drag-id="blk-b"] .be-handle-menu-btn',
    )!;

    act(() => actions.click());
    const firstMenu = document.querySelector('[data-k120-editor-context-menu]')!;
    const firstAction = firstMenu.querySelector<HTMLButtonElement>('[data-be-menu-action]')!;
    fireKey('Escape', firstAction);
    expect(document.activeElement).toBe(actions);

    act(() => actions.click());
    const menu = document.querySelector('[data-k120-editor-context-menu]');
    const indent = [...(menu?.querySelectorAll('button') ?? [])]
      .find(button => button.textContent?.trim() === 'Indent')!;
    const focusIfVisible = actions.focus.bind(actions);
    const triggerFocusVisibility = vi.fn(() => getComputedStyle(handles).visibility);
    actions.focus = () => {
      if (triggerFocusVisibility() === 'visible') focusIfVisible();
    };

    await act(async () => {
      indent.click();
      await new Promise<void>(resolve => window.requestAnimationFrame(() => resolve()));
    });

    expect(document.querySelector('[data-k120-editor-context-menu]')).toBeNull();
    expect(document.activeElement).toBe(actions);
    expect(triggerFocusVisibility).toHaveBeenCalled();
    expect(triggerFocusVisibility.mock.results.at(-1)?.value).toBe('visible');
    expect(block.classList.contains('be-controls-visible')).toBe(false);
  });

  it('closes an open actions menu when its trigger is clicked again', () => {
    mountEditor(blocks);
    const actions = document.querySelector<HTMLButtonElement>(
      '[data-drag-id="blk-b"] .be-handle-menu-btn',
    )!;
    act(() => actions.click());
    expect(document.querySelector('[data-k120-editor-context-menu]')).not.toBeNull();
    expect(actions.getAttribute('aria-expanded')).toBe('true');

    act(() => {
      actions.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    });
    expect(document.querySelector('[data-k120-editor-context-menu]')).not.toBeNull();
    act(() => actions.click());

    expect(document.querySelector('[data-k120-editor-context-menu]')).toBeNull();
    expect(actions.getAttribute('aria-expanded')).toBe('false');
  });

  it('switches to another block action menu and resets the previous submenu', () => {
    mountEditor(blocks);
    const actionsA = document.querySelector<HTMLButtonElement>(
      '[data-drag-id="blk-b"] .be-handle-menu-btn',
    )!;
    act(() => actionsA.click());
    const menuA = document.querySelector('[data-k120-editor-context-menu]')!;
    const transform = [...menuA.querySelectorAll('button')]
      .find(button => button.textContent?.includes('Transform'))!;
    act(() => transform.click());
    expect(menuA.querySelector('[data-be-block-type]')).not.toBeNull();

    const actionsB = document.querySelector<HTMLButtonElement>(
      '[data-drag-id="blk-c"] .be-handle-menu-btn',
    )!;
    act(() => {
      actionsB.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
      actionsB.click();
    });

    const menuB = document.querySelector<HTMLElement>('[data-k120-editor-context-menu]');
    expect(document.querySelectorAll('[data-k120-editor-context-menu]')).toHaveLength(1);
    expect(menuB?.id).toBe('be-block-actions-blk-c');
    expect(menuB?.querySelector('[data-be-block-type]')).toBeNull();
    expect(menuB?.textContent).toContain('Transform');
  });

  it('closes a root block menu when opening actions on a nested toggle child', () => {
    const child = makeBlock('paragraph', { id: 'nested-menu-target', content: 'child' });
    const toggle = makeBlock('toggle', {
      id: 'root-menu-toggle', content: 'toggle', collapsed: false, children: [child],
    });
    mountEditor([toggle]);
    const rootActions = document.querySelector<HTMLButtonElement>(
      '[data-drag-id="root-menu-toggle"] > .be-gutter .be-handle-menu-btn',
    )!;
    act(() => rootActions.click());
    expect(document.querySelector('[data-k120-editor-context-menu]')?.id)
      .toBe('be-block-actions-root-menu-toggle');

    const childActions = document.querySelector<HTMLButtonElement>(
      '[data-drag-id="nested-menu-target"] .be-handle-menu-btn',
    )!;
    act(() => {
      childActions.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
      childActions.click();
    });

    expect(document.querySelectorAll('[data-k120-editor-context-menu]')).toHaveLength(1);
    expect(document.querySelector('[data-k120-editor-context-menu]')?.id)
      .toBe('be-block-actions-nested-menu-target');
  });

  it('preserves multi-block selection when opening block actions and batch-deletes from the menu', () => {
    const onChange = vi.fn();
    mountEditor(blocks, onChange);
    const clickGrip = (id: string, y: number, modifiers: Pick<PointerEventInit, 'shiftKey'> = {}) => {
      const grip = document.querySelector(`[data-drag-id="${id}"] .be-grip`) as HTMLElement;
      firePointer(grip, 'pointerdown', y, 22, modifiers);
      firePointer(grip, 'pointerup', y, 22, modifiers);
    };

    clickGrip('blk-b', ROW_H + 10);
    clickGrip('blk-d', ROW_H * 3 + 10, { shiftKey: true });
    const actions = document.querySelector<HTMLButtonElement>(
      '[data-drag-id="blk-b"] .be-handle-menu-btn',
    );
    act(() => actions?.click());

    expect(selectedIds().sort()).toEqual(['blk-b', 'blk-c', 'blk-d']);
    const menu = document.querySelector('[data-k120-editor-context-menu]');
    expect(menu?.textContent).toContain('3 blocks selected');
    expect(menu?.textContent).toContain('Indent');
    expect(menu?.textContent).toContain('Outdent');
    const deleteAction = [...(menu?.querySelectorAll('button') ?? [])]
      .find(button => button.textContent?.trim() === 'Delete');
    act(() => deleteAction?.click());

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.lastCall?.[0].map((block: Block) => block.id))
      .toEqual(['blk-a', 'blk-e']);
  });

  it('keeps the existing block context menu on right-click', () => {
    mountEditor(blocks);
    const block = document.querySelector('[data-drag-id="blk-b"]') as HTMLElement;
    act(() => {
      block.dispatchEvent(new MouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
        clientX: 120,
        clientY: ROW_H + 10,
      }));
    });
    const menu = document.querySelector('[data-k120-editor-context-menu]');
    expect(menu).not.toBeNull();
    expect(menu?.classList.contains('be-block-handle-menu')).toBe(true);
    expect(menu?.querySelectorAll('button').length).toBeGreaterThan(10);
  });

  it('returns focus to the block action handle after opening the menu from editable content', () => {
    mountEditor(blocks);
    const block = document.querySelector<HTMLElement>('[data-drag-id="blk-b"]')!;
    const editable = block.querySelector<HTMLElement>('.be-editable')!;
    const actions = block.querySelector<HTMLButtonElement>('.be-handle-menu-btn')!;
    editable.focus();

    act(() => {
      editable.dispatchEvent(new MouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
        clientX: 0,
        clientY: 0,
      }));
    });
    const menu = document.querySelector('[data-k120-editor-context-menu]');
    const firstAction = menu?.querySelector<HTMLElement>('[data-be-menu-action]');
    expect(document.activeElement).toBe(firstAction);

    fireKey('Escape', firstAction ?? document.body);
    expect(document.activeElement).toBe(actions);
  });

  it('keeps keyboard-focused block handles visible after the menu closes', () => {
    mountEditor(blocks);
    const actions = document.querySelector<HTMLButtonElement>(
      '[data-drag-id="blk-b"] .be-handle-menu-btn',
    )!;
    act(() => actions.click());
    const menu = document.querySelector('[data-k120-editor-context-menu]')!;
    const firstAction = menu.querySelector<HTMLButtonElement>('[data-be-menu-action]')!;
    fireKey('Escape', firstAction);

    expect(document.activeElement).toBe(actions);
    expect(EDITOR_CHROME_STYLES).toMatch(/\.be-handles:focus-within[\s\S]*?visibility:\s*visible/);
  });

  it('falls back to block focus when the menu trigger is no longer connected on Escape', () => {
    mountEditor(blocks);
    const block = document.querySelector<HTMLElement>('[data-drag-id="blk-b"]')!;
    const editable = block.querySelector<HTMLElement>('.be-editable')!;
    const actions = block.querySelector<HTMLButtonElement>('.be-handle-menu-btn')!;
    act(() => actions.click());
    const menu = document.querySelector('[data-k120-editor-context-menu]')!;
    const firstAction = menu.querySelector<HTMLButtonElement>('[data-be-menu-action]')!;
    expect(document.activeElement).toBe(firstAction);

    actions.remove();
    fireKey('Escape', firstAction);

    expect(document.querySelector('[data-k120-editor-context-menu]')).toBeNull();
    expect(document.activeElement).toBe(editable);
  });

  it('anchors a handle to the first visual line instead of the block center', () => {
    mountEditor(blocks);
    const block = document.querySelector('[data-drag-id="blk-b"]') as HTMLElement;
    const handles = block.querySelector('.be-handles') as HTMLElement;
    const editable = block.querySelector('.be-editable') as HTMLElement;
    block.getBoundingClientRect = () => rect(40, 100, 360, 200);
    editable.getBoundingClientRect = () => rect(96, 112, 320, 120);

    alignHandleToFirstVisualLine(handles);

    expect(handles.style.top).not.toBe('50%');
    expect(parseFloat(handles.style.top)).toBeGreaterThan(0);
    expect(parseFloat(handles.style.top)).toBeLessThan(200);
    expect(handles.style.transform).toBe('translateY(-50%)');
  });

  it('uses the same block-rect midpoint for mounted drops and the commit destination', () => {
    const target = document.createElement('div');
    target.className = 'be-block';
    target.setAttribute('data-drag-id', 'target');
    target.getBoundingClientRect = () => rect(40, 100, 360, 100);
    document.body.appendChild(target);
    Object.defineProperty(document, 'elementsFromPoint', {
      configurable: true,
      value: () => [target],
    });

    const targetRect = target.getBoundingClientRect();
    expect(resolveDropPositionFromRect(124, targetRect)).toBe('before');
    expect(resolveDragOverFromPoint(120, 124, [])).toEqual({ overId: 'target', overPos: 'before' });
    expect(resolveDropPositionFromRect(176, targetRect)).toBe('after');
    const afterHit = resolveDragOverFromPoint(120, 176, []);
    expect(afterHit).toEqual({ overId: 'target', overPos: 'after' });

    const source = makeBlock('paragraph', { id: 'source', content: 'source' });
    const destination = makeBlock('paragraph', { id: 'target', content: 'target' });
    expect(commitDragDrop([source, destination], ['source'], 'target', afterHit!.overPos)?.map(b => b.id))
      .toEqual(['target', 'source']);
    delete (document as Document & { elementsFromPoint?: unknown }).elementsFromPoint;
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
