// @vitest-environment happy-dom
import { createElement, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useEditorKeyboard } from './useEditorKeyboard';
import { EDITOR_DOCUMENT_SEARCH_ATTR } from '../../../searchFocusIsolation';
import { makeBlock } from '../../../blockUtils';

function KeyboardHarness(props: Parameters<typeof useEditorKeyboard>[0]) {
  const ref = useRef<HTMLDivElement>(null);
  useEditorKeyboard({ ...props, documentRootRef: ref });
  return createElement('div', { ref, className: 'be-editor-root' });
}

function mountHarness(opts: Parameters<typeof useEditorKeyboard>[0]) {
  const host = document.createElement('div');
  document.body.innerHTML = '';
  document.body.appendChild(host);
  act(() => {
    createRoot(host).render(createElement(KeyboardHarness, opts));
  });
  return host;
}

function fireKey(key: string, target: EventTarget, opts: Partial<KeyboardEventInit> = {}) {
  act(() => {
    target.dispatchEvent(new KeyboardEvent('keydown', {
      key,
      bubbles: true,
      cancelable: true,
      ...opts,
    }));
  });
}

describe('useEditorKeyboard (K-90)', () => {
  const blocks = [
    makeBlock('paragraph', { id: 'a', content: 'A' }),
    makeBlock('paragraph', { id: 'b', content: 'B' }),
  ];

  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('Escape in contenteditable transitions to block select before suppression', () => {
    const selected = new Set<string>();
    const onSelectBlock = vi.fn((id: string) => { selected.add(id); });
    const onClearSelection = vi.fn();
    mountHarness({
      readOnly: false,
      depth: 0,
      getSelectedIds: () => selected,
      getRootBlocks: () => blocks,
      onClearSelection,
      onDeleteSelected: vi.fn(),
      onSelectBlock,
    });

    const block = document.createElement('div');
    block.className = 'be-block';
    block.setAttribute('data-drag-id', 'a');
    const editable = document.createElement('div');
    editable.className = 'be-editable';
    editable.contentEditable = 'true';
    editable.textContent = 'A';
    block.appendChild(editable);
    document.querySelector('.be-editor-root')!.appendChild(block);
    editable.focus();

    fireKey('Escape', editable);
    expect(onSelectBlock).toHaveBeenCalledWith('a');
    expect(onClearSelection).not.toHaveBeenCalled();
  });

  it('Escape does not steal from find-in-note search input', () => {
    const onClearSelection = vi.fn();
    mountHarness({
      readOnly: false,
      depth: 0,
      getSelectedIds: () => new Set(['a']),
      onClearSelection,
      onDeleteSelected: vi.fn(),
    });

    const search = document.createElement('input');
    search.setAttribute(EDITOR_DOCUMENT_SEARCH_ATTR, '');
    document.body.appendChild(search);
    search.focus();

    fireKey('Escape', search);
    expect(onClearSelection).not.toHaveBeenCalled();
  });

  it('stale multi-block selection does not capture Delete or Backspace from other editing controls', () => {
    const onDeleteSelected = vi.fn();
    const onEnterEditBlock = vi.fn();
    const onIndentSelected = vi.fn();
    const onOutdentSelected = vi.fn();
    mountHarness({
      readOnly: false,
      depth: 0,
      getSelectedIds: () => new Set(['a', 'b']),
      getRootBlocks: () => blocks,
      onClearSelection: vi.fn(),
      onDeleteSelected,
      onEnterEditBlock,
      onIndentSelected,
      onOutdentSelected,
    });

    const search = document.createElement('input');
    search.setAttribute(EDITOR_DOCUMENT_SEARCH_ATTR, '');
    document.body.appendChild(search);
    search.focus();
    fireKey('Delete', search);
    fireKey('Backspace', search);

    const tagInput = document.createElement('input');
    tagInput.className = 'be-tag-input';
    document.body.appendChild(tagInput);
    tagInput.focus();
    fireKey('Delete', tagInput);
    fireKey('Backspace', tagInput);

    const table = document.createElement('table');
    const cell = document.createElement('td');
    const cellInput = document.createElement('input');
    cell.appendChild(cellInput);
    table.appendChild(cell);
    document.body.appendChild(table);
    cellInput.focus();
    fireKey('Delete', cellInput);
    fireKey('Backspace', cellInput);

    const tableControl = document.createElement('button');
    tableControl.className = 'be-table-control';
    document.body.appendChild(tableControl);
    tableControl.focus();
    fireKey('Delete', tableControl);
    fireKey('Backspace', tableControl);

    const todoButton = document.createElement('button');
    todoButton.className = 'be-todo-control';
    document.querySelector('.be-editor-root')?.appendChild(todoButton);
    todoButton.focus();
    const todoEnter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    act(() => todoButton.dispatchEvent(todoEnter));
    const todoTab = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    act(() => todoButton.dispatchEvent(todoTab));
    expect(todoEnter.defaultPrevented).toBe(false);
    expect(todoTab.defaultPrevented).toBe(false);
    fireKey('Delete', todoButton);
    fireKey('Backspace', todoButton);

    const unrelatedEditor = document.createElement('div');
    unrelatedEditor.setAttribute('contenteditable', 'true');
    unrelatedEditor.tabIndex = 0;
    document.body.appendChild(unrelatedEditor);
    unrelatedEditor.focus();
    fireKey('Delete', unrelatedEditor);
    fireKey('Backspace', unrelatedEditor);

    const editorText = document.createElement('div');
    editorText.className = 'be-editable';
    editorText.setAttribute('contenteditable', 'true');
    document.querySelector('.be-editor-root')?.appendChild(editorText);
    editorText.tabIndex = 0;
    editorText.focus();
    fireKey('Delete', editorText);
    fireKey('Backspace', editorText);

    expect(onDeleteSelected).not.toHaveBeenCalled();
    expect(onEnterEditBlock).not.toHaveBeenCalled();
    expect(onIndentSelected).not.toHaveBeenCalled();
    expect(onOutdentSelected).not.toHaveBeenCalled();
  });

  it('keeps Delete available when the selection grip itself has focus', () => {
    const onDeleteSelected = vi.fn();
    mountHarness({
      readOnly: false,
      depth: 0,
      getSelectedIds: () => new Set(['a', 'b']),
      onClearSelection: vi.fn(),
      onDeleteSelected,
    });

    const grip = document.createElement('button');
    grip.className = 'be-grip';
    document.body.appendChild(grip);
    grip.focus();
    fireKey('Delete', grip);

    expect(onDeleteSelected).toHaveBeenCalledTimes(1);
  });

  it('Tab with multi-select calls onIndentSelected', () => {
    const onIndentSelected = vi.fn();
    mountHarness({
      readOnly: false,
      depth: 0,
      getSelectedIds: () => new Set(['a', 'b']),
      getRootBlocks: () => blocks,
      onClearSelection: vi.fn(),
      onDeleteSelected: vi.fn(),
      onIndentSelected,
    });

    fireKey('Tab', document.body);
    expect(onIndentSelected).toHaveBeenCalled();
  });

  it('Tab while editing single block is left to EditableBlock', () => {
    const onIndentSelected = vi.fn();
    mountHarness({
      readOnly: false,
      depth: 0,
      getSelectedIds: () => new Set(['a']),
      getRootBlocks: () => blocks,
      onClearSelection: vi.fn(),
      onDeleteSelected: vi.fn(),
      onIndentSelected,
    });

    const editable = document.createElement('div');
    editable.className = 'be-editable';
    editable.contentEditable = 'true';
    document.querySelector('.be-editor-root')!.appendChild(editable);
    editable.focus();

    fireKey('Tab', editable);
    expect(onIndentSelected).not.toHaveBeenCalled();
  });

  it('leaves Shift+Arrow available for native text selection in an editable with block selection', () => {
    const onExtendSelection = vi.fn();
    mountHarness({
      readOnly: false,
      depth: 0,
      getSelectedIds: () => new Set(['a']),
      getRootBlocks: () => blocks,
      anchorBlockId: 'a',
      activeBlockId: 'a',
      onClearSelection: vi.fn(),
      onDeleteSelected: vi.fn(),
      onExtendSelection,
    });

    const editable = document.createElement('div');
    editable.className = 'be-editable';
    editable.setAttribute('contenteditable', 'true');
    editable.setAttribute('data-drag-id', 'a');
    editable.textContent = 'editable text';
    document.querySelector('.be-editor-root')!.appendChild(editable);
    editable.focus();

    const event = new KeyboardEvent('keydown', {
      key: 'ArrowDown', shiftKey: true, bubbles: true, cancelable: true,
    });
    act(() => editable.dispatchEvent(event));

    expect(event.defaultPrevented).toBe(false);
    expect(onExtendSelection).not.toHaveBeenCalled();
  });

  it('does not extend block selection from a focused block action menu', () => {
    const selected = new Set(['a']);
    const onExtendSelection = vi.fn((next: Set<string>) => {
      selected.clear();
      next.forEach(id => selected.add(id));
    });
    mountHarness({
      readOnly: false,
      depth: 0,
      getSelectedIds: () => selected,
      getRootBlocks: () => blocks,
      anchorBlockId: 'a',
      activeBlockId: 'a',
      onClearSelection: vi.fn(),
      onDeleteSelected: vi.fn(),
      onExtendSelection,
    });

    const menu = document.createElement('div');
    menu.className = 'be-block-handle-menu';
    const action = document.createElement('button');
    menu.appendChild(action);
    document.querySelector('.be-editor-root')!.appendChild(menu);
    action.focus();

    const event = new KeyboardEvent('keydown', {
      key: 'ArrowDown', shiftKey: true, bubbles: true, cancelable: true,
    });
    act(() => action.dispatchEvent(event));

    expect(event.defaultPrevented).toBe(false);
    expect(onExtendSelection).not.toHaveBeenCalled();
    expect([...selected]).toEqual(['a']);
  });
});
