// @vitest-environment happy-dom
/**
 * UX-3C — toggle-aware document focus integration
 */
import React, { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BlockEditor } from './BlockEditor';
import {
  classifyToggleFooterZone,
  COLLAPSED_TOGGLE_ROW_EXTENSION_PX,
} from './toggleFocusZones';
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

function selectedBlockId(): string | null {
  const selected = document.querySelector('.be-block-selected[data-drag-id]') as HTMLElement | null;
  if (selected) return selected.getAttribute('data-drag-id');
  const active = document.querySelector('.be-block-active[data-drag-id]') as HTMLElement | null;
  return active?.getAttribute('data-drag-id') ?? null;
}

function activeToggleHeaderId(): string | null {
  const el = document.activeElement as HTMLElement | null;
  if (el?.getAttribute('data-block-type') === 'toggle') return el.getAttribute('data-block-id');
  const active = document.querySelector('.be-block-active .be-editable[data-block-type="toggle"]') as HTMLElement | null;
  return active?.getAttribute('data-block-id') ?? null;
}

describe('document focus — toggle-aware (UX-3C)', () => {
  let mounted: MountResult | null = null;

  afterEach(() => {
    act(() => { mounted?.root.unmount(); });
    document.body.innerHTML = '';
    document.head.innerHTML = '';
    vi.restoreAllMocks();
    mounted = null;
  });

  it('Case 1 — collapsed toggle: click below row focuses toggle (no append)', async () => {
    const toggle = makeBlock('toggle', {
      id: 'grammar',
      content: 'Grammar Module',
      collapsed: true,
      children: [makeBlock('paragraph', { id: 'c1', content: 'hidden child' })],
    });
    mounted = mountEditor([toggle]);
    layoutToggle('grammar', 0, false);

    const clickY = ROW_H - 4 + COLLAPSED_TOGGLE_ROW_EXTENSION_PX - 5;
    fireChromePointer(mounted.editorRoot, clickY);

    await vi.waitFor(() => {
      expect(selectedBlockId() ?? activeToggleHeaderId()).toBe('grammar');
    });
    expect(mounted.getBlocks()).toHaveLength(1);
    const action = resolveDocumentFocus(clickY, mounted.getBlocks(), mounted.editorRoot);
    expect(action.kind).toBe('focus');
    if (action.kind === 'focus') expect(action.blockId).toBe('grammar');
  });

  it('Case 2 — expanded toggle: click below children preserves outside append', async () => {
    const toggle = makeBlock('toggle', {
      id: 'grammar',
      content: 'Grammar Module',
      collapsed: false,
      children: [
        makeBlock('paragraph', { id: 'c1', content: 'child one' }),
        makeBlock('paragraph', { id: 'c2', content: 'child two' }),
      ],
    });
    mounted = mountEditor([toggle]);
    layoutToggle('grammar', 0, true, 2);

    const belowChildrenY = ROW_H * 3 + 20;
    const footer = classifyToggleFooterZone(belowChildrenY, mounted.editorRoot);
    expect(footer.kind).toBe('footer-candidate');

    const strip = mounted.editorRoot.querySelector('.be-document-bottom-strip') as HTMLElement;
    fireChromePointer(strip, belowChildrenY);

    await vi.waitFor(() => {
      expect(mounted!.getBlocks()).toHaveLength(2);
    });
    expect(mounted.getBlocks()[1].type).toBe('paragraph');
    expect(mounted.getBlocks()[1].id).not.toBe('grammar');
  });

  it('Case 3 — nested collapsed toggle: correct inner toggle focused', async () => {
    const inner = makeBlock('toggle', { id: 'vocab', content: 'Vocab nest', collapsed: true });
    const outer = makeBlock('toggle', {
      id: 'grammar',
      content: 'Grammar Module',
      collapsed: false,
      children: [inner],
    });
    mounted = mountEditor([outer]);
    layoutToggle('grammar', 0, true, 1);
    layoutToggle('vocab', ROW_H, false);

    const clickY = ROW_H + ROW_H - 4 + 20;
    fireChromePointer(mounted.editorRoot, clickY);

    await vi.waitFor(() => {
      expect(selectedBlockId() ?? activeToggleHeaderId()).toBe('vocab');
    });
  });

  it('Case 4 — root paragraph behavior unchanged', async () => {
    const blocks = [makeBlock('paragraph', { id: 'a', content: 'Hello' })];
    mounted = mountEditor(blocks);
    layoutParagraph('a', 0);

    const strip = mounted.editorRoot.querySelector('.be-document-bottom-strip') as HTMLElement;
    fireChromePointer(strip, ROW_H + 20);

    await vi.waitFor(() => {
      expect(mounted!.getBlocks()).toHaveLength(2);
    });
    expect(mounted.getBlocks()[1].type).toBe('paragraph');
  });

  it('visual consistency — collapsed toggle focus matches selected block id', async () => {
    const toggle = makeBlock('toggle', {
      id: 'grammar',
      content: 'Grammar Module',
      collapsed: true,
    });
    mounted = mountEditor([toggle]);
    layoutToggle('grammar', 0, false);

    fireChromePointer(mounted.editorRoot, ROW_H);

    await vi.waitFor(() => {
      const selected = selectedBlockId();
      const active = activeToggleHeaderId();
      expect(selected).toBe('grammar');
      expect(active).toBe('grammar');
    });
  });
});
