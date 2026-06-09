// @vitest-environment happy-dom
/**
 * UX-3B — document focus integration with BlockEditor
 */
import React, { createElement } from 'react';
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

const ROW_H = 48;

function rect(left: number, top: number, w: number, h: number): DOMRect {
  return {
    left, top, width: w, height: h, right: left + w, bottom: top + h, x: left, y: top,
    toJSON: () => ({}),
  } as DOMRect;
}

function layoutBlockRects(ids: string[]) {
  ids.forEach((id, i) => {
    const block = document.querySelector(`[data-drag-id="${id}"]`) as HTMLElement | null;
    if (!block) return;
    const top = i * ROW_H;
    block.getBoundingClientRect = () => rect(40, top, 400, ROW_H - 4);
  });
}

interface MountResult {
  root: Root;
  getBlocks: () => Block[];
  editorRoot: HTMLElement;
  relayout: () => void;
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
    return createElement(BlockEditor, {
      blocks,
      onChange: setBlocks,
      colors,
      readOnly: false,
      virtualBlocksPoc: false,
    });
  }

  let root: Root | null = null;
  act(() => {
    root = createRoot(outer);
    root.render(createElement(StatefulEditor));
  });

  const editorRoot = document.querySelectorAll('.be-editor-root')[1] as HTMLElement
    ?? document.querySelector('.be-editor-root') as HTMLElement;

  layoutBlockRects(current.map(b => b.id));
  return {
    root: root!,
    getBlocks: () => current,
    editorRoot,
    relayout: () => layoutBlockRects(current.map(b => b.id)),
  };
}

function fireChromePointer(el: Element, clientY: number) {
  act(() => {
    el.dispatchEvent(new PointerEvent('pointerdown', {
      bubbles: true,
      cancelable: true,
      clientX: 200,
      clientY,
      pointerId: 1,
      button: 0,
      buttons: 1,
      pointerType: 'mouse',
    }));
  });
}

function activeEditableId(): string | null {
  const el = document.activeElement as HTMLElement | null;
  if (el?.getAttribute('data-block-id')) return el.getAttribute('data-block-id');
  const activeBlock = document.querySelector('.be-block-active .be-editable') as HTMLElement | null;
  return activeBlock?.getAttribute('data-block-id') ?? null;
}

describe('document focus integration', () => {
  let mounted: MountResult | null = null;

  afterEach(() => {
    act(() => { mounted?.root.unmount(); });
    document.body.innerHTML = '';
    document.head.innerHTML = '';
    vi.restoreAllMocks();
    mounted = null;
  });

  it('empty document — click root focuses existing empty paragraph', async () => {
    const empty = makeBlock('paragraph', { id: 'only', content: '' });
    mounted = mountEditor([empty]);

    const strip = mounted.editorRoot.querySelector('.be-document-bottom-strip') as HTMLElement;
    fireChromePointer(strip, ROW_H + 40);

    await vi.waitFor(() => {
      expect(activeEditableId()).toBe('only');
    });
    expect(mounted.getBlocks()).toHaveLength(1);
    expect(mounted.getBlocks()[0].content).toBe('');
  });

  it('last block empty — click below document focuses existing paragraph', async () => {
    const blocks = [
      makeBlock('paragraph', { id: 'a', content: 'Hello' }),
      makeBlock('paragraph', { id: 'b', content: '' }),
    ];
    mounted = mountEditor(blocks);
    layoutBlockRects(['a', 'b']);

    const strip = mounted.editorRoot.querySelector('.be-document-bottom-strip') as HTMLElement;
    fireChromePointer(strip, ROW_H * 2 + 20);

    await vi.waitFor(() => {
      expect(activeEditableId()).toBe('b');
    });
    expect(mounted.getBlocks()).toHaveLength(2);
  });

  it('last block non-empty — click below document appends paragraph', async () => {
    const blocks = [makeBlock('paragraph', { id: 'a', content: 'Hello' })];
    mounted = mountEditor(blocks);
    layoutBlockRects(['a']);

    const strip = mounted.editorRoot.querySelector('.be-document-bottom-strip') as HTMLElement;
    fireChromePointer(strip, ROW_H + 30);

    await vi.waitFor(() => {
      expect(mounted!.getBlocks()).toHaveLength(2);
    });
    const appended = mounted.getBlocks()[1];
    expect(appended.type).toBe('paragraph');
    expect(appended.content).toBe('');
    mounted.relayout();
    await vi.waitFor(() => {
      expect(activeEditableId()).toBe(appended.id);
    });
  });

  it('click near block row focuses nearest editable', async () => {
    const blocks = [
      makeBlock('paragraph', { id: 'a', content: 'One' }),
      makeBlock('paragraph', { id: 'b', content: 'Two' }),
    ];
    mounted = mountEditor(blocks);
    layoutBlockRects(['a', 'b']);

    fireChromePointer(mounted.editorRoot, ROW_H + 10);

    await vi.waitFor(() => {
      expect(activeEditableId()).toBe('b');
    });
  });

  it('first empty paragraph shows persistent placeholder class', () => {
    const empty = makeBlock('paragraph', { id: 'only', content: '' });
    mounted = mountEditor([empty]);

    const editable = document.querySelector('.be-editable') as HTMLElement;
    expect(editable.classList.contains('be-persistent-placeholder')).toBe(true);
  });
});
