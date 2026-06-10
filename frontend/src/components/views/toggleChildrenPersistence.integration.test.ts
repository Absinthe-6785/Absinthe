// @vitest-environment happy-dom
/**
 * Knowledge-19.75 — toggle header must not delete children on backspace merge
 */
import React, { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { BlockEditor } from './BlockEditor';
import { EDITOR_CHROME_STYLES } from './editorChromeStyles';
import { findBlockById, flattenBlockIds, makeBlock, type Block } from './blockUtils';
import type { BlockEditorColors } from './editorTypes';

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
  return { root, getBlocks: () => current };
}

function editableFor(blockId: string) {
  return document.querySelector(`[data-block-id="${blockId}"]`) as HTMLElement;
}

function fireBackspaceAtStart(blockId: string, text: string) {
  const el = editableFor(blockId);
  act(() => {
    el.focus();
    const range = document.createRange();
    const sel = window.getSelection();
    el.textContent = text;
    const node = el.firstChild ?? el;
    range.setStart(node, 0);
    range.setEnd(node, 0);
    sel?.removeAllRanges();
    sel?.addRange(range);
    el.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Backspace', bubbles: true, cancelable: true,
    }));
  });
}

describe('toggle title deletion preserves children (Knowledge-19.75 P0)', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    document.head.innerHTML = '';
  });

  it('backspace on empty toggle title does not delete nested children', () => {
    const child = makeBlock('paragraph', { id: 'child', content: 'persist' });
    const toggle = makeBlock('toggle', { id: 'toggle', content: '', children: [child] });
    const prev = makeBlock('paragraph', { id: 'prev', content: 'above' });
    const { getBlocks } = mountEditor([prev, toggle]);

    fireBackspaceAtStart('toggle', '');
    const blocks = getBlocks();
    const t = findBlockById(blocks, 'toggle');
    expect(t).not.toBeNull();
    expect(t!.children).toHaveLength(1);
    expect(t!.children[0].content).toBe('persist');
    expect(flattenBlockIds(blocks)).toContain('child');
  });
});
