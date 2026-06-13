// @vitest-environment happy-dom
/**
 * K-31.1 — Outline navigation integration (live block ids + virtualized editor).
 */
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BlockEditor } from './BlockEditor';
import { EDITOR_CHROME_STYLES } from './editorChromeStyles';
import { makeBlock, type Block } from './blockUtils';
import type { BlockEditorColors } from './editorTypes';
import { navigateToHeading } from './outlineNavigation';
import { setVirtualBlocksPocOverride } from './features/block-editor/performance/virtualBlocksFlag';

const colors: BlockEditorColors = {
  bg: '#fff', text: '#111', textMuted: '#666', textFaint: '#999',
  accent: '#8B5CF6', accentBg: '#eee', border: '#ddd', card: '#fff',
  cardHov: '#f5f5f5', input: '#fff', inputBdr: '#ccc', toolbar: '#f9f9f9',
  danger: '#f00', green: '#0f0', codeBg: '#f1f5f9', calloutBg: '#fafafa',
  toggleBg: 'transparent', quoteBdr: '#ccc', selection: '#eef',
};

function block(id: string, type: Block['type'], content: string, extra?: Partial<Block>): Block {
  return { ...makeBlock(type, { content, ...extra }), id };
}

function buildOutlineFixture() {
  const headingTop = block('toc-heading-top', 'heading1', 'Introduction');
  const fillers = Array.from({ length: 48 }, (_, i) =>
    block(`toc-fill-${i}`, 'paragraph', `Paragraph ${i}`),
  );
  const headingFar = block('toc-heading-far', 'heading2', 'Deep section');
  const toggleHeading = block('toc-toggle-h2', 'toggleHeading2', 'Toggle section', {
    children: [block('toc-nested-h3', 'heading3', 'Nested inside toggle')],
  });
  return [headingTop, ...fillers, headingFar, toggleHeading];
}

interface MountResult {
  scrollZone: HTMLDivElement;
  blocks: Block[];
  virtualScrollApiRef: { current: { scrollToBlockId: (id: string) => boolean } | null };
}

function mountOutlineEditor(
  blocks: Block[],
  opts: { readOnly?: boolean; virtual?: boolean } = {},
): MountResult {
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
  act(() => {
    root = createRoot(host);
    root.render(createElement(BlockEditor, {
      blocks,
      onChange: () => {},
      colors,
      readOnly: opts.readOnly ?? false,
      virtualBlocksPoc: opts.virtual ?? true,
      virtualScrollParentRef,
      virtualScrollApiRef,
    }));
  });
  act(() => {});
  act(() => {});

  return { scrollZone, blocks, virtualScrollApiRef };
}

describe('outlineNavigation integration', () => {
  beforeEach(() => setVirtualBlocksPocOverride(null));
  afterEach(() => setVirtualBlocksPocOverride(null));

  it('TOC click path scrolls to a mounted heading using live block id', () => {
    const blocks = [
      block('toc-h1', 'heading1', 'Visible'),
      block('toc-h2', 'heading2', 'Target'),
    ];
    const { scrollZone, virtualScrollApiRef } = mountOutlineEditor(blocks, { virtual: false });

    const scrollTo = vi.spyOn(scrollZone, 'scrollTo');
    const ok = navigateToHeading({
      scrollRoot: scrollZone,
      blocks,
      headingIdx: 1,
      scrollToBlockId: id => virtualScrollApiRef.current?.scrollToBlockId(id) ?? false,
      onFlash: () => {},
    });

    expect(ok).toBe(true);
    expect(scrollTo).toHaveBeenCalled();
    expect(document.querySelector('[data-block-id="toc-h2"]')).not.toBeNull();
  });

  it('virtualized heading scroll uses live id via scrollToBlockId', () => {
    const blocks = buildOutlineFixture();
    const { scrollZone, virtualScrollApiRef } = mountOutlineEditor(blocks, { virtual: true });

    expect(virtualScrollApiRef.current).not.toBeNull();
    expect(document.querySelector('[data-block-id="toc-heading-far"]')).toBeNull();

    const scrollToBlockId = vi.spyOn(virtualScrollApiRef.current!, 'scrollToBlockId');
    const ok = navigateToHeading({
      scrollRoot: scrollZone,
      blocks,
      headingIdx: 1,
      scrollToBlockId: id => virtualScrollApiRef.current!.scrollToBlockId(id),
    });

    expect(ok).toBe(true);
    expect(scrollToBlockId).toHaveBeenCalledWith('toc-heading-far');
  });

  it('reading mode navigates to headings with live block ids', () => {
    const fillers = Array.from({ length: 40 }, (_, i) =>
      block(`read-fill-${i}`, 'paragraph', `Fill ${i}`),
    );
    const blocks = [
      block('read-h1', 'heading1', 'Reading intro'),
      ...fillers,
      block('read-h2', 'heading2', 'Reading section'),
    ];
    const { scrollZone, virtualScrollApiRef } = mountOutlineEditor(blocks, {
      readOnly: true,
      virtual: true,
    });

    expect(document.querySelector('[data-block-id="read-h2"]')).toBeNull();
    const scrollToBlockId = vi.spyOn(virtualScrollApiRef.current!, 'scrollToBlockId');
    expect(navigateToHeading({
      scrollRoot: scrollZone,
      blocks,
      headingIdx: 1,
      scrollToBlockId: id => virtualScrollApiRef.current!.scrollToBlockId(id),
    })).toBe(true);
    expect(scrollToBlockId).toHaveBeenCalledWith('read-h2');
  });

  it('toggle heading navigation uses live toggle block id', () => {
    const fillers = Array.from({ length: 40 }, (_, i) =>
      block(`toggle-fill-${i}`, 'paragraph', `Fill ${i}`),
    );
    const blocks = [
      block('toggle-root', 'heading1', 'Root'),
      ...fillers,
      block('toggle-h', 'toggleHeading2', 'Collapsible', {
        collapsed: false,
        children: [block('toggle-child', 'paragraph', 'Inside toggle')],
      }),
    ];
    const { scrollZone, virtualScrollApiRef } = mountOutlineEditor(blocks, { virtual: true });

    expect(document.querySelector('[data-block-id="toggle-h"]')).toBeNull();
    const scrollToBlockId = vi.spyOn(virtualScrollApiRef.current!, 'scrollToBlockId');
    expect(navigateToHeading({
      scrollRoot: scrollZone,
      blocks,
      headingIdx: 1,
      scrollToBlockId: id => virtualScrollApiRef.current!.scrollToBlockId(id),
    })).toBe(true);
    expect(scrollToBlockId).toHaveBeenCalledWith('toggle-h');
  });

  it('nested heading inside toggle resolves via includeNested and DOM scroll', () => {
    const blocks = [
      block('toggle-wrap', 'toggleHeading1', 'Wrapper', {
        collapsed: false,
        children: [block('nested-target', 'heading2', 'Nested heading')],
      }),
    ];
    const { scrollZone } = mountOutlineEditor(blocks, { virtual: false });

    expect(document.querySelector('[data-block-id="nested-target"]')).not.toBeNull();

    const scrollTo = vi.spyOn(scrollZone, 'scrollTo');
    expect(navigateToHeading({
      scrollRoot: scrollZone,
      blocks,
      headingIdx: 1,
      includeNested: true,
    })).toBe(true);
    expect(scrollTo).toHaveBeenCalled();
  });
});
