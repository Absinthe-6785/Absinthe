// @vitest-environment happy-dom
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { BlockEditor } from './BlockEditor';
import { EDITOR_CHROME_STYLES } from './editorChromeStyles';
import { EDITOR_DOCUMENT_SEARCH_ATTR } from './searchFocusIsolation';

const AUDIT_COLORS = {
  bg: '#fff', text: '#111', textMuted: '#666', textFaint: '#999',
  accent: '#8B5CF6', accentBg: '#eee', border: '#ddd', card: '#fff',
  cardHov: '#f5f5f5', input: '#fff', inputBdr: '#ccc', toolbar: '#f9f9f9',
  danger: '#f00', green: '#0f0', codeBg: '#f1f5f9', calloutBg: '#fafafa',
  toggleBg: 'transparent', quoteBdr: '#ccc', selection: '#eef',
};

const INITIAL_BLOCKS = [
  { id: 'b1', type: 'paragraph' as const, content: 'alpha beta gamma', children: [] },
  { id: 'b2', type: 'paragraph' as const, content: 'second block text', children: [] },
];

describe('find-in-note keyboard integrity', () => {
  let root: Root | null = null;
  let onChange: (blocks: typeof INITIAL_BLOCKS) => void;
  let latestBlocks: typeof INITIAL_BLOCKS;
  let searchInput: HTMLInputElement;

  beforeEach(() => {
    document.body.innerHTML = '';
    document.head.innerHTML = '';
    const style = document.createElement('style');
    style.textContent = EDITOR_CHROME_STYLES;
    document.head.appendChild(style);

    latestBlocks = structuredClone(INITIAL_BLOCKS);
    onChange = blocks => { latestBlocks = blocks as typeof INITIAL_BLOCKS; };

    searchInput = document.createElement('input');
    searchInput.setAttribute(EDITOR_DOCUMENT_SEARCH_ATTR, '');
    document.body.appendChild(searchInput);

    const host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);

    act(() => {
      root!.render(createElement(BlockEditor, {
        blocks: INITIAL_BLOCKS,
        onChange,
        colors: AUDIT_COLORS,
        readOnly: false,
        searchQuery: 'alpha',
        searchScope: 'document',
        searchMatchIndex: 0,
      }));
    });
    act(() => {});
  });

  afterEach(() => {
    act(() => root?.unmount());
    root = null;
    document.body.innerHTML = '';
  });

  it('keeps focus in find-in-note input while query changes', () => {
    searchInput.focus();
    act(() => {
      root!.render(createElement(BlockEditor, {
        blocks: latestBlocks,
        onChange,
        colors: AUDIT_COLORS,
        readOnly: false,
        searchQuery: '',
        searchScope: 'document',
        searchMatchIndex: 0,
      }));
    });
    act(() => {
      root!.render(createElement(BlockEditor, {
        blocks: latestBlocks,
        onChange,
        colors: AUDIT_COLORS,
        readOnly: false,
        searchQuery: 'beta',
        searchScope: 'document',
        searchMatchIndex: 0,
      }));
    });
    act(() => {});

    expect(document.activeElement).toBe(searchInput);
    const editable = document.querySelector('.be-editable[contenteditable="true"]') as HTMLElement | null;
    expect(editable).not.toBe(document.activeElement);
  });

  it('keeps note body unchanged when Backspace is pressed in find-in-note input', () => {
    searchInput.focus();
    searchInput.value = 'alp';
    act(() => {
      searchInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true }));
    });

    expect(latestBlocks[0]!.content).toBe('alpha beta gamma');
    expect(latestBlocks).toHaveLength(2);
  });
});
