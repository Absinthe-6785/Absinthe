// @vitest-environment happy-dom
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { BlockEditor } from '../../../BlockEditor';
import { EDITOR_CHROME_STYLES } from '../../../editorChromeStyles';
import { generateBenchmarkBlocks } from '../../../editorBenchmark';
import { collectEditorSearchMatches } from '../../../editorSearch';
import { getFocusHandler, registerFocusHandler } from '../features/selection';
import { PendingFocusQueue } from './pendingFocusQueue';
import { createVirtualNavigationApi } from './virtualNavigation';
import { setVirtualBlocksPocOverride } from './virtualBlocksFlag';

const AUDIT_COLORS = {
  bg: '#fff', text: '#111', textMuted: '#666', textFaint: '#999',
  accent: '#8B5CF6', accentBg: '#eee', border: '#ddd', card: '#fff',
  cardHov: '#f5f5f5', input: '#fff', inputBdr: '#ccc', toolbar: '#f9f9f9',
  danger: '#f00', green: '#0f0', codeBg: '#f1f5f9', calloutBg: '#fafafa',
  toggleBg: 'transparent', quoteBdr: '#ccc', selection: '#eef',
};

function mountVirtualEditor(
  blocks: ReturnType<typeof generateBenchmarkBlocks>,
  opts: { searchQuery?: string; searchMatchIndex?: number } = {},
) {
  document.body.innerHTML = '';
  document.head.innerHTML = '';
  const style = document.createElement('style');
  style.textContent = EDITOR_CHROME_STYLES;
  document.head.appendChild(style);

  const scrollZone = document.createElement('div');
  scrollZone.className = 'editor-drop-zone';
  scrollZone.style.height = '480px';
  scrollZone.style.overflow = 'auto';
  scrollZone.style.width = '800px';
  document.body.appendChild(scrollZone);

  const host = document.createElement('div');
  scrollZone.appendChild(host);

  const virtualScrollParentRef = { current: scrollZone };
  const virtualScrollApiRef = { current: null as { scrollToBlockId: (id: string) => boolean } | null };

  let root: Root | null = null;
  const render = (searchMatchIndex = opts.searchMatchIndex ?? 0) => {
    act(() => {
      if (!root) root = createRoot(host);
      root.render(createElement(BlockEditor, {
        blocks,
        onChange: () => {},
        colors: AUDIT_COLORS,
        readOnly: false,
        virtualBlocksPoc: true,
        virtualScrollParentRef,
        virtualScrollApiRef,
        searchQuery: opts.searchQuery ?? '',
        searchScope: 'document',
        searchMatchIndex,
      }));
    });
  };

  render();
  act(() => {});
  act(() => {});

  return { root: root!, scrollZone, virtualScrollApiRef, render };
}

describe('virtual focus & search integration', () => {
  beforeEach(() => setVirtualBlocksPocOverride(null));
  afterEach(() => setVirtualBlocksPocOverride(null));

  it('search navigation focuses visible match when flag on', () => {
    const blocks = generateBenchmarkBlocks(80);
    const matches = collectEditorSearchMatches(blocks, 'paragraph');
    mountVirtualEditor(blocks, { searchQuery: 'paragraph', searchMatchIndex: 0 });

    const first = matches[0]!;
    const handler = getFocusHandler(first.blockId);
    expect(handler).toBeDefined();
  });

  it('search navigation requests off-screen match via scroll API', () => {
    const blocks = generateBenchmarkBlocks(200);
    const matches = collectEditorSearchMatches(blocks, 'paragraph');
    const farIndex = matches.length - 1;
    const { render, virtualScrollApiRef } = mountVirtualEditor(blocks, {
      searchQuery: 'paragraph',
      searchMatchIndex: 0,
    });

    render(farIndex);
    act(() => {});
    act(() => {});

    expect(virtualScrollApiRef.current).not.toBeNull();
    const far = matches[farIndex]!;
    expect(virtualScrollApiRef.current?.scrollToBlockId(far.blockId)).toBe(true);
  });

  it('scrollToBlockId returns true for valid root block id', () => {
    const blocks = generateBenchmarkBlocks(150);
    const { virtualScrollApiRef } = mountVirtualEditor(blocks);
    const target = blocks[120]!;
    expect(virtualScrollApiRef.current?.scrollToBlockId(target.id)).toBe(true);
  });

  it('flag off preserves non-virtual mount path', () => {
    const blocks = generateBenchmarkBlocks(50);
    mountVirtualEditor(blocks);
    expect(document.querySelector('.be-virtual-block-list')).not.toBeNull();

    document.body.innerHTML = '';
    act(() => {
      const host = document.createElement('div');
      document.body.appendChild(host);
      const root = createRoot(host);
      root.render(createElement(BlockEditor, {
        blocks,
        onChange: () => {},
        colors: AUDIT_COLORS,
        readOnly: false,
        virtualBlocksPoc: false,
      }));
    });
    expect(document.querySelector('.be-virtual-block-list')).toBeNull();
    expect(document.querySelectorAll('[data-drag-id]').length).toBeGreaterThan(40);
  });

  it('pending focus replays when handler registers after queue', () => {
    const queue = new PendingFocusQueue();
    const api = createVirtualNavigationApi({
      virtualEnabled: true,
      scrollToBlockId: () => true,
      queue,
    });
    const calls: number[] = [];
    api.requestFocus({ blockId: 'queued', offset: 4 });
    expect(queue.peek()?.blockId).toBe('queued');

    const unregister = registerFocusHandler('queued', (cmd) => {
      calls.push(cmd.offset as number);
    });
    const pending = api.consumePendingFocus('queued');
    expect(pending?.offset).toBe(4);
    if (pending) {
      const handler = getFocusHandler('queued');
      handler?.(pending);
    }
    expect(calls).toEqual([4]);
    unregister();
  });
});
