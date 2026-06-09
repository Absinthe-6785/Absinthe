// @vitest-environment happy-dom
/**
 * UX-4C.3 — toggle header Enter split + first-child Backspace merge integration
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

function setTextAndCaret(el: HTMLElement, text: string, offset: number) {
  el.textContent = text;
  const range = document.createRange();
  const sel = window.getSelection();
  if (el.childNodes.length === 0) {
    range.setStart(el, 0);
    range.setEnd(el, 0);
  } else {
    const textNode = el.firstChild!;
    range.setStart(textNode, Math.min(offset, (textNode.textContent ?? '').length));
    range.setEnd(textNode, Math.min(offset, (textNode.textContent ?? '').length));
  }
  sel?.removeAllRanges();
  sel?.addRange(range);
}

function fireEnter(blockId: string, text: string, caretOffset: number) {
  const el = editableFor(blockId);
  act(() => {
    el.focus();
    setTextAndCaret(el, text, caretOffset);
    el.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Enter', bubbles: true, cancelable: true,
    }));
  });
}

function fireBackspaceAtStart(blockId: string, text: string) {
  const el = editableFor(blockId);
  act(() => {
    el.focus();
    setTextAndCaret(el, text, 0);
    el.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Backspace', bubbles: true, cancelable: true,
    }));
  });
}

describe('toggle header editing integration (UX-4C.3)', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    document.head.innerHTML = '';
  });

  it('realistic split → merge cycle on toggle title and first child', () => {
    const toggle = makeBlock('toggle', { id: 't', content: 'GrammarModule', children: [] });
    const { getBlocks } = mountEditor([toggle]);

    fireEnter('t', 'GrammarModule', 7);
    let blocks = getBlocks();
    let t = findBlockById(blocks, 't')!;
    expect(t.content).toBe('Grammar');
    expect(t.children).toHaveLength(1);
    expect(t.children[0].content).toBe('Module');

    const childId = t.children[0].id;
    fireBackspaceAtStart(childId, 'Module');
    blocks = getBlocks();
    t = findBlockById(blocks, 't')!;
    expect(t.content).toBe('GrammarModule');
    expect(t.children).toHaveLength(0);
    expect(flattenBlockIds(blocks)).toEqual(['t']);
  });

  it('header Enter at end appends empty child', () => {
    const toggle = makeBlock('toggle', { id: 't', content: 'Grammar Module', children: [] });
    const { getBlocks } = mountEditor([toggle]);

    fireEnter('t', 'Grammar Module', 'Grammar Module'.length);
    const t = findBlockById(getBlocks(), 't')!;
    expect(t.content).toBe('Grammar Module');
    expect(t.children).toHaveLength(1);
    expect(t.children[0].content).toBe('');
  });

  it('caret at start moves full title into first child (Case C)', () => {
    const toggle = makeBlock('toggle', { id: 't', content: 'Grammar Module', children: [] });
    const { getBlocks } = mountEditor([toggle]);

    fireEnter('t', 'Grammar Module', 0);
    const t = findBlockById(getBlocks(), 't')!;
    expect(t.content).toBe('');
    expect(t.children).toHaveLength(1);
    expect(t.children[0].content).toBe('Grammar Module');
  });

  it('repeated end Enter appends empty children', () => {
    const toggle = makeBlock('toggle', { id: 't', content: 'one two three', children: [] });
    const { getBlocks } = mountEditor([toggle]);

    fireEnter('t', 'one two three', 3);
    let t = findBlockById(getBlocks(), 't')!;
    expect(t.content).toBe('one');
    expect(t.children[0].content).toBe(' two three');

    fireEnter('t', 'one', 3);
    t = findBlockById(getBlocks(), 't')!;
    expect(t.content).toBe('one');
    expect(t.children).toHaveLength(2);
    expect(t.children[0].content).toBe(' two three');
    expect(t.children[1].content).toBe('');
  });
});
