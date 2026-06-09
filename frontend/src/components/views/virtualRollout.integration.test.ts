// @vitest-environment happy-dom
/**
 * UX-5E.1F — production virtualization rollout regression tests.
 */
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { BlockEditor } from './BlockEditor';
import { EDITOR_CHROME_STYLES } from './editorChromeStyles';
import { generateBenchmarkBlocks } from './editorBenchmark';
import { collectEditorSearchMatches } from './editorSearch';
import { flattenBlockIds, makeBlock, type Block } from './blockUtils';
import {
  getVirtualizationStats,
  isVirtualBlocksPocEnabled,
  setVirtualBlocksDisableOverride,
  setVirtualBlocksPocOverride,
} from './features/block-editor/performance';

const colors = {
  bg: '#fff', text: '#111', textMuted: '#666', textFaint: '#999',
  accent: '#8B5CF6', accentBg: '#eee', border: '#ddd', card: '#fff',
  cardHov: '#f5f5f5', input: '#fff', inputBdr: '#ccc', toolbar: '#f9f9f9',
  danger: '#f00', green: '#0f0', codeBg: '#f1f5f9', calloutBg: '#fafafa',
  toggleBg: 'transparent', quoteBdr: '#ccc', selection: '#eef',
};

function mountEditor(
  blocks: Block[],
  opts: { virtualBlocksPoc?: boolean } = {},
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

  let root: Root | null = null;
  act(() => {
    root = createRoot(host);
    root.render(createElement(BlockEditor, {
      blocks,
      onChange: () => {},
      colors,
      readOnly: false,
      virtualScrollParentRef,
      ...(opts.virtualBlocksPoc !== undefined ? { virtualBlocksPoc: opts.virtualBlocksPoc } : {}),
    }));
  });
  act(() => {});
  act(() => {});

  return { root: root!, scrollZone };
}

describe('virtualization rollout', () => {
  beforeEach(() => {
    setVirtualBlocksPocOverride(null);
    setVirtualBlocksDisableOverride(null);
  });
  afterEach(() => {
    setVirtualBlocksPocOverride(null);
    setVirtualBlocksDisableOverride(null);
    document.body.innerHTML = '';
    document.head.innerHTML = '';
  });

  it('enables virtualization by default', () => {
    expect(isVirtualBlocksPocEnabled()).toBe(true);
    const blocks = generateBenchmarkBlocks(120);
    mountEditor(blocks);
    expect(document.querySelector('.be-virtual-block-list')).toBeTruthy();
    expect(document.querySelectorAll('[data-drag-id]').length).toBeLessThan(80);
  });

  it('opt-out via disable override renders full block list', () => {
    setVirtualBlocksDisableOverride(true);
    const blocks = generateBenchmarkBlocks(40);
    mountEditor(blocks);
    expect(document.querySelector('.be-virtual-block-list')).toBeFalsy();
    expect(document.querySelectorAll('[data-drag-id]').length).toBeGreaterThanOrEqual(40);
  });

  it('opt-out via prop renders full block list', () => {
    const blocks = generateBenchmarkBlocks(40);
    mountEditor(blocks, { virtualBlocksPoc: false });
    expect(document.querySelector('.be-virtual-block-list')).toBeFalsy();
    expect(document.querySelectorAll('[data-drag-id]').length).toBeGreaterThanOrEqual(40);
  });

  it('exposes virtualization stats when virtual list is active', () => {
    const blocks = generateBenchmarkBlocks(100);
    mountEditor(blocks);
    const stats = getVirtualizationStats();
    expect(stats.enabled).toBe(true);
    expect(stats.totalRows).toBe(100);
    expect(stats.mountedRows).toBeGreaterThan(0);
    expect(stats.mountedRows).toBeLessThan(100);
    expect(stats.cachedHeights).toBeGreaterThanOrEqual(0);
    expect(stats.overscan).toBeGreaterThan(0);
  });

  it('search matches remain discoverable under default virtualization', () => {
    const blocks = generateBenchmarkBlocks(80);
    const matches = collectEditorSearchMatches(blocks, 'paragraph');
    mountEditor(blocks);
    expect(matches.length).toBeGreaterThan(0);
    expect(document.querySelector('.be-virtual-block-list')?.getAttribute('data-virtual-count'))
      .toBe('80');
  });

  it('mounts mixed block types under virtualization', () => {
    const blocks: Block[] = [
      makeBlock('heading1', { id: 'h1', content: 'Title' }),
      makeBlock('paragraph', { id: 'p1', content: 'Text' }),
      makeBlock('code', { id: 'c1', content: 'const x = 1;' }),
      makeBlock('math', { id: 'm1', content: 'E=mc^2' }),
      makeBlock('callout', { id: 'ca1', content: 'Note' }),
      makeBlock('toggle', {
        id: 't1',
        content: 'Toggle',
        children: [makeBlock('paragraph', { id: 't1c', content: 'nested' })],
      }),
    ];
    mountEditor(blocks);
    const ids = flattenBlockIds(blocks);
    const mounted = [...document.querySelectorAll('[data-drag-id]')].map(
      el => el.getAttribute('data-drag-id'),
    );
    expect(mounted.length).toBeGreaterThan(0);
    expect(mounted.some(id => ids.includes(id!))).toBe(true);
  });
});
