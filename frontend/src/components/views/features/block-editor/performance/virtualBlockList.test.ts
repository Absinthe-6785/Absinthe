// @vitest-environment happy-dom
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BlockEditor } from '../../../BlockEditor';
import { EDITOR_CHROME_STYLES } from '../../../editorChromeStyles';
import { generateBenchmarkBlocks } from '../../../editorBenchmark';
import { setVirtualBlocksPocOverride } from './virtualBlocksFlag';
import { estimateBlockHeight } from './blockHeightEstimates';
import { BlockHeightCache } from './blockHeightCache';
import { scrollToBlockId, type BlockVirtualizer } from './scrollToBlockId';

const AUDIT_COLORS = {
  bg: '#fff', text: '#111', textMuted: '#666', textFaint: '#999',
  accent: '#8B5CF6', accentBg: '#eee', border: '#ddd', card: '#fff',
  cardHov: '#f5f5f5', input: '#fff', inputBdr: '#ccc', toolbar: '#f9f9f9',
  danger: '#f00', green: '#0f0', codeBg: '#f1f5f9', calloutBg: '#fafafa',
  toggleBg: 'transparent', quoteBdr: '#ccc', selection: '#eef',
};

function mountEditor(blocks: ReturnType<typeof generateBenchmarkBlocks>, virtualBlocksPoc: boolean) {
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

  let root: Root | null = null;
  act(() => {
    root = createRoot(host);
    root.render(createElement(BlockEditor, {
      blocks,
      onChange: () => {},
      colors: AUDIT_COLORS,
      readOnly: false,
      virtualBlocksPoc,
      virtualScrollParentRef,
    }));
  });
  act(() => {});
  return { root, scrollZone };
}

describe('virtualBlockList POC', () => {
  beforeEach(() => {
    setVirtualBlocksPocOverride(null);
  });

  afterEach(() => {
    setVirtualBlocksPocOverride(null);
  });

  it('feature flag off renders all root blocks', () => {
    mountEditor(generateBenchmarkBlocks(120), false);
    const rootBlocks = document.querySelectorAll('.be-editor-root .be-block[data-drag-id], .be-editor-root .be-toggle-wrap [data-drag-id]');
    expect(rootBlocks.length).toBeGreaterThanOrEqual(100);
    expect(document.querySelector('.be-virtual-block-list')).toBeNull();
  });

  it('feature flag on bounds DOM to viewport window', () => {
    mountEditor(generateBenchmarkBlocks(500), true);
    const list = document.querySelector('.be-virtual-block-list');
    expect(list).not.toBeNull();
    const visible = Number(list?.getAttribute('data-virtual-visible') ?? '0');
    const total = Number(list?.getAttribute('data-virtual-count') ?? '0');
    expect(total).toBe(500);
    expect(visible).toBeGreaterThan(0);
    expect(visible).toBeLessThan(80);
    const domBlocks = document.querySelectorAll('[data-drag-id]').length;
    expect(domBlocks).toBeLessThan(120);
  });

  it('estimate size uses per-type defaults', () => {
    const blocks = generateBenchmarkBlocks(10);
    for (const block of blocks) {
      expect(estimateBlockHeight(block)).toBeGreaterThan(20);
    }
  });

  it('height cache stores measurements', () => {
    const cache = new BlockHeightCache();
    cache.set('a', 48);
    expect(cache.get('a')).toBe(48);
    cache.delete('a');
    expect(cache.get('a')).toBeUndefined();
  });

  it('scrollToBlockId scrolls virtualizer to block index', () => {
    const blocks = generateBenchmarkBlocks(20);
    const scrollToIndex = vi.fn();
    const virtualizer = { scrollToIndex } as unknown as BlockVirtualizer;
    expect(scrollToBlockId(virtualizer, blocks, blocks[15].id)).toBe(true);
    expect(scrollToIndex).toHaveBeenCalledWith(15, { align: 'center' });
    expect(scrollToBlockId(virtualizer, blocks, 'missing-id')).toBe(false);
  });
});
