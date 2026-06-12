// @vitest-environment happy-dom
/**
 * UX-4C.2 — toggle child list Enter parity integration
 */
import React, { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { BlockEditor } from './BlockEditor';
import { EDITOR_CHROME_STYLES } from './editorChromeStyles';
import { findBlockById, makeBlock, updateBlockById, type Block } from './blockUtils';
import { applyToggleChildEnter } from './toggleNesting';
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
    return createElement(BlockEditor, { blocks, onChange: setBlocks, colors, readOnly: false });
  }
  act(() => {
    root = createRoot(host);
    root.render(createElement(StatefulEditor));
  });
  return { root, getBlocks: () => current };
}

/** Mirror BlockEditor handleSplitBlock toggle-child path. */
function applyToggleChildSplit(
  root: Block[],
  toggleId: string,
  blockId: string,
  before: string,
  after: string,
): Block[] {
  const toggle = findBlockById(root, toggleId);
  if (!toggle) throw new Error('toggle not found');
  const result = applyToggleChildEnter(toggle.children, blockId, before, after, true);
  if (result.action === 'escape_below') {
    return updateBlockById(root, toggleId, t => ({ ...t, children: result.children }));
  }
  return updateBlockById(root, toggleId, t => ({ ...t, children: result.children }));
}

function setCaret(el: HTMLElement, offset: number) {
  const range = document.createRange();
  const sel = window.getSelection();
  if (el.childNodes.length === 0) {
    range.setStart(el, 0);
    range.setEnd(el, 0);
  } else {
    range.selectNodeContents(el);
    range.collapse(offset > 0);
  }
  sel?.removeAllRanges();
  sel?.addRange(range);
}

function fireEnter(blockId: string) {
  act(() => {
    let el = document.querySelector(`[data-block-id="${blockId}"]`) as HTMLElement | null;
    if (!el) throw new Error(`block not found: ${blockId}`);
    el.focus();
    el = document.querySelector(`[data-block-id="${blockId}"]`) as HTMLElement;
    setCaret(el, (el.textContent ?? '').length);
    el.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Enter', bubbles: true, cancelable: true,
    }));
  });
}

describe('toggle list Enter integration (UX-4C.2)', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    document.head.innerHTML = '';
  });

  it('toggle child numbered list — empty exit and split renumber', () => {
    const toggle = makeBlock('toggle', {
      id: 't',
      content: 'Toggle',
      children: [
        makeBlock('numbered', { id: 'n1', content: 'A', listIndex: 1 }),
        makeBlock('numbered', { id: 'n2', content: 'B', listIndex: 2 }),
      ],
    });
    let blocks = [toggle];

    blocks = applyToggleChildSplit(blocks, 't', 'n2', 'B', '');
    const afterSplit = findBlockById(blocks, 't')!;
    expect(afterSplit.children).toHaveLength(3);
    expect(afterSplit.children.map(c => c.listIndex)).toEqual([1, 2, 3]);

    const emptyId = afterSplit.children[2].id;
    blocks = applyToggleChildSplit(blocks, 't', emptyId, '', '');
    const afterExit = findBlockById(blocks, 't')!;
    expect(afterExit.children).toHaveLength(3);
    expect(afterExit.children[2].type).toBe('paragraph');
    expect(afterExit.children.filter(c => c.type === 'numbered').map(c => c.listIndex)).toEqual([1, 2]);
  });

  it('nested toggle numbered list — Enter stays scoped to inner toggle', () => {
    const inner = makeBlock('toggle', {
      id: 'inner',
      content: 'Inner',
      children: [
        makeBlock('numbered', { id: 'n1', content: 'A', listIndex: 1 }),
        makeBlock('numbered', { id: 'n2', content: 'B', listIndex: 2 }),
      ],
    });
    const outer = makeBlock('toggle', {
      id: 'outer',
      content: 'Outer',
      children: [inner],
    });
    let blocks = [outer];

    blocks = applyToggleChildSplit(blocks, 'inner', 'n2', 'B', '');
    const nested = findBlockById(blocks, 'inner')!;
    expect(nested.children).toHaveLength(3);
    expect(nested.children.map(c => c.listIndex)).toEqual([1, 2, 3]);

    const outerToggle = findBlockById(blocks, 'outer')!;
    expect(outerToggle.children).toHaveLength(1);
    expect(outerToggle.children[0].id).toBe('inner');
  });

  it('repeated split sequence via mounted editor', () => {
    const toggle = makeBlock('toggle', {
      id: 't',
      content: 'Toggle',
      children: [
        makeBlock('numbered', { id: 'n1', content: 'A', listIndex: 1 }),
        makeBlock('numbered', { id: 'n2', content: 'B', listIndex: 2 }),
      ],
    });
    const { getBlocks } = mountEditor([toggle]);

    fireEnter('n2');
    let blocks = getBlocks();
    let children = findBlockById(blocks, 't')!.children;
    expect(children).toHaveLength(3);
    expect(children.map(c => c.listIndex)).toEqual([1, 2, 3]);

    const thirdId = children[2].id;
    fireEnter(thirdId);
    blocks = getBlocks();
    children = findBlockById(blocks, 't')!.children;
    expect(children).toHaveLength(4);
    expect(children.map(c => c.listIndex)).toEqual([1, 2, 3, 4]);
  });
});
