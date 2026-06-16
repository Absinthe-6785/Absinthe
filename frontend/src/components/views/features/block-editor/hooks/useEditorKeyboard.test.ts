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
});
