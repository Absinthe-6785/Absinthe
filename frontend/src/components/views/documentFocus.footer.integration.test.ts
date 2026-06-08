// @vitest-environment happy-dom
/**
 * UX-3D — toggle footer insertion integration
 */
import React, { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BlockEditor } from './BlockEditor';
import { resolveDocumentFocus } from './documentFocus';
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

const ROW_H = 48;

function rect(left: number, top: number, w: number, h: number): DOMRect {
  return {
    left, top, width: w, height: h, right: left + w, bottom: top + h, x: left, y: top,
    toJSON: () => ({}),
  } as DOMRect;
}

function layoutToggle(id: string, top: number, expanded: boolean, childCount = 2) {
  const header = document.querySelector(`[data-drag-id="${id}"]`) as HTMLElement | null;
  if (!header) return;
  header.getBoundingClientRect = () => rect(40, top, 400, ROW_H - 4);
  const wrap = header.closest('.be-toggle-wrap') as HTMLElement | null;
  if (!wrap) return;
  if (expanded) {
    const children = wrap.querySelector('.be-toggle-children') as HTMLElement | null;
    const childHeight = childCount * ROW_H;
    if (children) {
      children.getBoundingClientRect = () => rect(40, top + ROW_H, 400, childHeight);
    }
    wrap.getBoundingClientRect = () => rect(40, top, 400, ROW_H + childHeight + 8);
  } else {
    wrap.getBoundingClientRect = () => rect(40, top, 400, ROW_H - 4);
  }
}

function layoutParagraph(id: string, top: number) {
  const el = document.querySelector(`[data-drag-id="${id}"]`) as HTMLElement | null;
  if (el) el.getBoundingClientRect = () => rect(40, top, 400, ROW_H - 4);
}

interface MountResult {
  root: Root;
  getBlocks: () => Block[];
  editorRoot: HTMLElement;
}

function mountEditor(initialBlocks: Block[]): MountResult {
  let current = initialBlocks;
  document.body.innerHTML = '';
  document.head.innerHTML = '';
  const style = document.createElement('style');
  style.textContent = EDITOR_CHROME_STYLES;
  document.head.appendChild(style);
  const outer = document.createElement('div');
  document.body.appendChild(outer);

  function StatefulEditor() {
    const [blocks, setBlocks] = React.useState(initialBlocks);
    current = blocks;
    return createElement(BlockEditor, { blocks, onChange: setBlocks, colors, readOnly: false });
  }

  let root: Root | null = null;
  act(() => {
    root = createRoot(outer);
    root.render(createElement(StatefulEditor));
  });

  const editorRoot = document.querySelectorAll('.be-editor-root')[1] as HTMLElement
    ?? document.querySelector('.be-editor-root') as HTMLElement;

  return { root: root!, getBlocks: () => current, editorRoot };
}

function fireChromePointer(el: Element, clientY: number) {
  act(() => {
    el.dispatchEvent(new PointerEvent('pointerdown', {
      bubbles: true, cancelable: true, clientX: 200, clientY,
      pointerId: 1, button: 0, buttons: 1, pointerType: 'mouse',
    }));
  });
}

function activeEditableId(): string | null {
  const el = document.activeElement as HTMLElement | null;
  if (el?.getAttribute('data-block-id')) return el.getAttribute('data-block-id');
  const active = document.querySelector('.be-block-active .be-editable') as HTMLElement | null;
  return active?.getAttribute('data-block-id') ?? null;
}

describe('document focus — toggle footer insertion (UX-3D)', () => {
  let mounted: MountResult | null = null;

  afterEach(() => {
    act(() => { mounted?.root.unmount(); });
    document.body.innerHTML = '';
    document.head.innerHTML = '';
    vi.restoreAllMocks();
    mounted = null;
  });

  it('expanded toggle footer click inserts child paragraph', async () => {
    const toggle = makeBlock('toggle', {
      id: 'econ',
      content: 'Economics',
      collapsed: false,
      children: [
        makeBlock('paragraph', { id: 'a', content: 'Child A' }),
        makeBlock('paragraph', { id: 'b', content: 'Child B' }),
      ],
    });
    mounted = mountEditor([toggle]);
    layoutToggle('econ', 0, true, 2);

    const footerY = ROW_H * 3 + 10;
    fireChromePointer(mounted.editorRoot, footerY);

    await vi.waitFor(() => {
      expect(mounted!.getBlocks()[0].children).toHaveLength(3);
    });
    const third = mounted.getBlocks()[0].children[2];
    expect(third.type).toBe('paragraph');
    expect(third.content).toBe('');
    await vi.waitFor(() => {
      expect(activeEditableId()).toBe(third.id);
    });
    expect(mounted.getBlocks()).toHaveLength(1);
    expect(document.querySelectorAll('.be-block-selected')).toHaveLength(0);
  });

  it('existing empty trailing child is focused not duplicated', async () => {
    const empty = makeBlock('paragraph', { id: 'empty', content: '' });
    const toggle = makeBlock('toggle', {
      id: 'econ',
      content: 'Economics',
      collapsed: false,
      children: [
        makeBlock('paragraph', { id: 'a', content: 'Child A' }),
        makeBlock('paragraph', { id: 'b', content: 'Child B' }),
        empty,
      ],
    });
    mounted = mountEditor([toggle]);
    layoutToggle('econ', 0, true, 3);

    const footerY = ROW_H * 4 + 10;
    fireChromePointer(mounted.editorRoot, footerY);

    await vi.waitFor(() => {
      expect(activeEditableId()).toBe('empty');
    });
    expect(mounted!.getBlocks()[0].children).toHaveLength(3);
  });

  it('outside footer zone preserves root append', async () => {
    const toggle = makeBlock('toggle', {
      id: 'econ',
      content: 'Economics',
      collapsed: false,
      children: [makeBlock('paragraph', { id: 'a', content: 'Child A' })],
    });
    const para = makeBlock('paragraph', { id: 'root-p', content: 'After toggle' });
    mounted = mountEditor([toggle, para]);
    layoutToggle('econ', 0, true, 1);
    layoutParagraph('root-p', ROW_H * 2);

    const farBelowY = ROW_H * 5 + 40;
    const action = resolveDocumentFocus(farBelowY, mounted.getBlocks(), mounted.editorRoot);
    expect(action.kind).toBe('append');

    const strip = mounted.editorRoot.querySelector('.be-document-bottom-strip') as HTMLElement;
    fireChromePointer(strip, farBelowY);

    await vi.waitFor(() => {
      expect(mounted!.getBlocks()).toHaveLength(3);
    });
    expect(mounted.getBlocks()[2].type).toBe('paragraph');
    expect(mounted.getBlocks()[0].children).toHaveLength(1);
  });

  it('nested expanded toggle receives footer child', async () => {
    const inner = makeBlock('toggle', {
      id: 'nested',
      content: 'Nested',
      collapsed: false,
      children: [makeBlock('paragraph', { id: 'nc', content: 'nested child' })],
    });
    const outer = makeBlock('toggle', {
      id: 'outer',
      content: 'Outer',
      collapsed: false,
      children: [inner],
    });
    mounted = mountEditor([outer]);
    layoutToggle('outer', 0, true, 2);
    layoutToggle('nested', ROW_H, true, 1);

    const footerY = ROW_H * 2 + ROW_H + 10;
    fireChromePointer(mounted.editorRoot, footerY);

    await vi.waitFor(() => {
      expect(mounted!.getBlocks()[0].children[0].children).toHaveLength(2);
    });
    const newChild = mounted.getBlocks()[0].children[0].children[1];
    expect(newChild.type).toBe('paragraph');
    expect(newChild.content).toBe('');
  });
});
