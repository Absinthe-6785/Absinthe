// @vitest-environment happy-dom
/**
 * K-31 — Backspace empty-block navigation regression tests.
 */
import React, { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { BlockEditor } from './BlockEditor';
import { EDITOR_CHROME_STYLES } from './editorChromeStyles';
import { flattenBlockIds, makeBlock, type Block } from './blockUtils';
import type { BlockEditorColors } from './editorTypes';
import { setVirtualBlocksPocOverride } from './features/block-editor/performance/virtualBlocksFlag';

const colors: BlockEditorColors = {
  bg: '#fff', text: '#111', textMuted: '#666', textFaint: '#999',
  accent: '#8B5CF6', accentBg: '#eee', border: '#ddd', card: '#fff',
  cardHov: '#f5f5f5', input: '#fff', inputBdr: '#ccc', toolbar: '#f9f9f9',
  danger: '#f00', green: '#0f0', codeBg: '#f1f5f9', calloutBg: '#fafafa',
  toggleBg: 'transparent', quoteBdr: '#ccc', selection: '#eef',
};

function mountEditor(initialBlocks: Block[]) {
  let current = initialBlocks;
  document.body.innerHTML = '';
  document.head.innerHTML = '';
  const style = document.createElement('style');
  style.textContent = EDITOR_CHROME_STYLES;
  document.head.appendChild(style);
  const host = document.createElement('div');
  document.body.appendChild(host);

  let root: Root | null = null;
  function StatefulEditor() {
    const [blocks, setBlocks] = React.useState(initialBlocks);
    current = blocks;
    return createElement(BlockEditor, {
      blocks, onChange: setBlocks, colors, readOnly: false, virtualBlocksPoc: false,
    });
  }
  act(() => {
    root = createRoot(host);
    root.render(createElement(StatefulEditor));
  });
  return {
    getBlocks: () => current,
    unmount: () => {
      act(() => { root?.unmount(); });
      root = null;
    },
  };
}

function editableFor(blockId: string) {
  return document.querySelector(`[data-block-id="${blockId}"]`) as HTMLElement;
}

function setTextAndCaret(el: HTMLElement, text: string, offset: number) {
  el.textContent = text;
  const range = document.createRange();
  const sel = window.getSelection();
  if (el.childNodes.length === 0) {
    range.setStart(el, 0);
    range.setEnd(el, 0);
  } else {
    const textNode = el.firstChild!;
    const len = (textNode.textContent ?? '').length;
    const pos = Math.min(offset, len);
    range.setStart(textNode, pos);
    range.setEnd(textNode, pos);
  }
  sel?.removeAllRanges();
  sel?.addRange(range);
}

function fireBackspaceAtStart(blockId: string, text: string) {
  act(() => {
    const el = editableFor(blockId);
    el.focus();
    setTextAndCaret(el, text, 0);
    el.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Backspace', bubbles: true, cancelable: true,
    }));
  });
}

describe('backspace empty-block navigation (K-31)', () => {
  let unmount: (() => void) | undefined;

  afterEach(() => {
    unmount?.();
    unmount = undefined;
    setVirtualBlocksPocOverride(null);
    document.body.innerHTML = '';
    document.head.innerHTML = '';
  });

  it('removes empty middle block and focuses previous block at end', () => {
    const a = { ...makeBlock('paragraph'), id: 'blk-a', content: 'Hello' };
    const b = { ...makeBlock('paragraph'), id: 'blk-b', content: '' };
    const c = { ...makeBlock('paragraph'), id: 'blk-c', content: 'Tail' };
    const editor = mountEditor([a, b, c]);
    unmount = editor.unmount;

    fireBackspaceAtStart('blk-b', '');
    expect(flattenBlockIds(editor.getBlocks())).toEqual(['blk-a', 'blk-c']);

    act(() => {});
    const active = document.activeElement as HTMLElement | null;
    expect(active?.getAttribute('data-block-id')).toBe('blk-a');
  });

  it('focus stays on previous block; subsequent backspace does not jump to document start', () => {
    const a = { ...makeBlock('paragraph'), id: 'blk-a', content: 'First' };
    const b = { ...makeBlock('paragraph'), id: 'blk-b', content: '' };
    const c = { ...makeBlock('paragraph'), id: 'blk-c', content: 'Third' };
    const editor = mountEditor([a, b, c]);
    unmount = editor.unmount;

    fireBackspaceAtStart('blk-b', '');
    expect(flattenBlockIds(editor.getBlocks())).toEqual(['blk-a', 'blk-c']);

    act(() => {});
    expect(document.activeElement?.getAttribute('data-block-id')).toBe('blk-a');

    const el = editableFor('blk-a');
    act(() => {
      el.focus();
      setTextAndCaret(el, 'First', 5);
      el.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'Backspace', bubbles: true, cancelable: true,
      }));
    });
    act(() => {});

    expect(document.activeElement?.getAttribute('data-block-id')).toBe('blk-a');
  });

  it('handles empty heading block backspace via merge path', () => {
    const h1 = { ...makeBlock('heading1'), id: 'h1', content: 'Title' };
    const h2 = { ...makeBlock('heading2'), id: 'h2', content: '' };
    const editor = mountEditor([h1, h2]);
    unmount = editor.unmount;

    fireBackspaceAtStart('h2', '');
    expect(flattenBlockIds(editor.getBlocks())).toEqual(['h1']);

    act(() => {});
    expect(document.activeElement?.getAttribute('data-block-id')).toBe('h1');
  });
});
