// @vitest-environment happy-dom
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { VirtualRowShell, type VirtualRowMemoState } from './VirtualRowShell';
import type { Block } from '../../../blockUtils';

const BLOCK: Block = { id: 'b1', type: 'paragraph', content: 'hello' };

function baseMemoState(overrides: Partial<VirtualRowMemoState> = {}): VirtualRowMemoState {
  return {
    isSelected: false,
    isMenuOpen: false,
    controlsVisible: false,
    activeBlockId: null,
    headingIndex: undefined,
    blockSearchQuery: '',
    showPersistentPlaceholder: false,
    readOnly: false,
    searchQuery: '',
    ...overrides,
  };
}

describe('VirtualRowShell', () => {
  let root: Root | null = null;
  let host: HTMLDivElement;

  afterEach(() => {
    act(() => { root?.unmount(); });
    host?.remove();
  });

  it('skips renderBlock when memo state is unchanged across parent rerenders', () => {
    const renderBlock = vi.fn((block: Block) => createElement('div', { 'data-id': block.id }));
    host = document.createElement('div');
    document.body.appendChild(host);

    act(() => {
      root = createRoot(host);
      root.render(createElement(VirtualRowShell, {
        block: BLOCK,
        memoState: baseMemoState(),
        renderBlock,
      }));
    });
    expect(renderBlock).toHaveBeenCalledTimes(1);

    act(() => {
      root!.render(createElement(VirtualRowShell, {
        block: BLOCK,
        memoState: baseMemoState(),
        renderBlock,
      }));
    });
    expect(renderBlock).toHaveBeenCalledTimes(1);
  });

  it('re-invokes renderBlock when selection state changes', () => {
    const renderBlock = vi.fn((block: Block) => createElement('div', { 'data-id': block.id }));
    host = document.createElement('div');
    document.body.appendChild(host);

    act(() => {
      root = createRoot(host);
      root.render(createElement(VirtualRowShell, {
        block: BLOCK,
        memoState: baseMemoState({ isSelected: false }),
        renderBlock,
      }));
    });

    act(() => {
      root!.render(createElement(VirtualRowShell, {
        block: BLOCK,
        memoState: baseMemoState({ isSelected: true }),
        renderBlock,
      }));
    });
    expect(renderBlock).toHaveBeenCalledTimes(2);
  });

  it('re-invokes renderBlock when block reference changes', () => {
    const renderBlock = vi.fn((block: Block) => createElement('div', { 'data-id': block.id }));
    const block2: Block = { id: 'b1', type: 'paragraph', content: 'updated' };
    host = document.createElement('div');
    document.body.appendChild(host);

    act(() => {
      root = createRoot(host);
      root.render(createElement(VirtualRowShell, {
        block: BLOCK,
        memoState: baseMemoState(),
        renderBlock,
      }));
    });

    act(() => {
      root!.render(createElement(VirtualRowShell, {
        block: block2,
        memoState: baseMemoState(),
        renderBlock,
      }));
    });
    expect(renderBlock).toHaveBeenCalledTimes(2);
  });
});
