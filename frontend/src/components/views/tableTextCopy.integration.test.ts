// @vitest-environment happy-dom
import React, { act, createElement, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { BlockEditor } from './BlockEditor';
import { EDITOR_CHROME_STYLES } from './editorChromeStyles';
import { makeBlock, type Block } from './blockUtils';
import type { BlockEditorColors } from './editorTypes';
import { hasTableCellTextSelection } from './features/block-editor/features/clipboard/copy/copySelection';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const colors: BlockEditorColors = {
  bg: '#fff', text: '#111', textMuted: '#666', textFaint: '#999',
  accent: '#8B5CF6', accentBg: '#eee', border: '#ddd', card: '#fff',
  cardHov: '#f5f5f5', input: '#fff', inputBdr: '#ccc', toolbar: '#f9f9f9',
  danger: '#f00', green: '#0f0', codeBg: '#f1f5f9', calloutBg: '#fafafa',
  toggleBg: 'transparent', quoteBdr: '#ccc', selection: '#eef',
};

let mountedRoot: Root | null = null;

function mountEditor(initialBlocks: Block[]) {
  let currentBlocks = initialBlocks;
  document.body.innerHTML = '';
  document.head.innerHTML = '';
  const style = document.createElement('style');
  style.textContent = EDITOR_CHROME_STYLES;
  document.head.appendChild(style);
  const host = document.createElement('div');
  document.body.appendChild(host);

  function StatefulEditor() {
    const [blocks, setBlocks] = useState(initialBlocks);
    const [readOnly, setReadOnly] = useState(false);
    currentBlocks = blocks;
    return createElement('div', null,
      createElement('button', {
        type: 'button',
        'data-mode-switch': true,
        onClick: () => setReadOnly(value => !value),
      }, 'Switch reading/editing mode'),
      createElement(BlockEditor, {
        blocks, onChange: setBlocks, colors, readOnly, virtualBlocksPoc: false,
      }),
    );
  }

  act(() => {
    mountedRoot = createRoot(host);
    mountedRoot.render(createElement(StatefulEditor));
  });
  return { getBlocks: () => currentBlocks };
}

function tableBlock(): Block {
  return makeBlock('table', {
    id: 'notes-table',
    tableHeaders: ['Name', 'Score'],
    tableRows: [['Alice', '95']],
  });
}

function selectCellText(cell: HTMLElement, start = 1, end = 4): void {
  const walker = document.createTreeWalker(cell, NodeFilter.SHOW_TEXT);
  const text = walker.nextNode();
  expect(text).not.toBeNull();
  const range = document.createRange();
  range.setStart(text!, start);
  range.setEnd(text!, end);
  const selection = window.getSelection()!;
  selection.removeAllRanges();
  selection.addRange(range);
}

function dispatchCopy(): { event: ClipboardEvent; clipboard: DataTransfer } {
  const clipboard = new DataTransfer();
  const event = new ClipboardEvent('copy', {
    bubbles: true,
    cancelable: true,
    clipboardData: clipboard,
  });
  act(() => { window.dispatchEvent(event); });
  return { event, clipboard };
}

afterEach(() => {
  if (mountedRoot) act(() => mountedRoot?.unmount());
  mountedRoot = null;
  document.body.innerHTML = '';
  document.head.innerHTML = '';
  window.getSelection()?.removeAllRanges();
});

describe('Notes table text selection and copy', () => {
  it.each([
    ['an unrelated block', 'stale-block'],
    ['the table block itself', 'notes-table'],
  ])('lets a reading-mode cell range win over stale selection of %s', (_label, selectedId) => {
    const original = [
      makeBlock('paragraph', { id: 'stale-block', content: 'Stale selected paragraph' }),
      tableBlock(),
    ];
    const before = JSON.stringify(original);
    const { getBlocks } = mountEditor(original);

    const grip = document.querySelector<HTMLElement>(`[data-drag-id="${selectedId}"] .be-grip`)!;
    act(() => { grip.click(); });
    expect(document.querySelector(`[data-drag-id="${selectedId}"].be-block-selected`)).not.toBeNull();

    act(() => {
      document.querySelector<HTMLButtonElement>('[data-mode-switch]')!.click();
    });
    const cell = document.querySelector<HTMLElement>('.be-editor-root tbody td');
    expect(cell).not.toBeNull();
    selectCellText(cell!);
    expect(window.getSelection()?.toString()).toBe('lic');
    expect(hasTableCellTextSelection()).toBe(true);

    const { event, clipboard } = dispatchCopy();

    expect(event.defaultPrevented).toBe(false);
    expect(clipboard.getData('text/plain')).toBe('');
    expect(document.querySelector(`[data-drag-id="${selectedId}"].be-block-selected`)).not.toBeNull();
    expect(JSON.stringify(getBlocks())).toBe(before);
  });

  it('allows pointer text selection in an editing cell and leaves its copy to the browser', () => {
    const original = [
      makeBlock('paragraph', { id: 'stale-block', content: 'Stale selected paragraph' }),
      tableBlock(),
    ];
    const before = JSON.stringify(original);
    const { getBlocks } = mountEditor(original);
    const grip = document.querySelector<HTMLElement>('[data-drag-id="stale-block"] .be-grip')!;
    act(() => { grip.click(); });
    expect(document.querySelector('[data-drag-id="stale-block"].be-block-selected')).not.toBeNull();

    const cell = document.querySelector<HTMLElement>(
      '.be-editor-root tbody td [contenteditable="true"]',
    );
    expect(cell).not.toBeNull();

    const pointerDown = new PointerEvent('pointerdown', {
      bubbles: true, cancelable: true, pointerId: 1, button: 0, buttons: 1,
    });
    const mouseDown = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
    act(() => {
      cell!.dispatchEvent(pointerDown);
      cell!.dispatchEvent(mouseDown);
    });
    expect(pointerDown.defaultPrevented).toBe(false);
    expect(mouseDown.defaultPrevented).toBe(false);

    act(() => { cell!.focus(); });
    expect(document.querySelector('[data-drag-id="stale-block"].be-block-selected')).toBeNull();
    selectCellText(cell!);
    expect(window.getSelection()?.toString()).toBe('lic');
    const { event, clipboard } = dispatchCopy();

    expect(event.defaultPrevented).toBe(false);
    expect(clipboard.getData('text/plain')).toBe('');
    expect(JSON.stringify(getBlocks())).toBe(before);
  });

  it('leaves a selected header range to the browser when a stale block is selected', () => {
    const original = [
      makeBlock('paragraph', { id: 'stale-block', content: 'Stale selected paragraph' }),
      tableBlock(),
    ];
    const before = JSON.stringify(original);
    const { getBlocks } = mountEditor(original);
    const grip = document.querySelector<HTMLElement>('[data-drag-id="stale-block"] .be-grip')!;
    act(() => { grip.click(); });
    act(() => { document.querySelector<HTMLButtonElement>('[data-mode-switch]')!.click(); });

    const headerCell = document.querySelector<HTMLElement>('.be-editor-root thead th');
    expect(headerCell).not.toBeNull();
    selectCellText(headerCell!, 1, 4);
    expect(window.getSelection()?.toString()).toBe('ame');
    expect(hasTableCellTextSelection()).toBe(true);

    const { event, clipboard } = dispatchCopy();
    expect(event.defaultPrevented).toBe(false);
    expect(clipboard.getData('text/plain')).toBe('');
    expect(JSON.stringify(getBlocks())).toBe(before);
  });

  it('keeps semantic whole-table copy when the table block is intentionally selected', () => {
    const original = [tableBlock()];
    const before = JSON.stringify(original);
    const { getBlocks } = mountEditor(original);
    const grip = document.querySelector<HTMLElement>('[data-drag-id="notes-table"] .be-grip')!;
    act(() => { grip.click(); });

    const { event, clipboard } = dispatchCopy();

    expect(event.defaultPrevented).toBe(true);
    expect(clipboard.getData('text/html')).toContain('<table>');
    expect(clipboard.getData('text/plain')).toContain('| Name | Score |');
    expect(JSON.stringify(getBlocks())).toBe(before);
  });
});
