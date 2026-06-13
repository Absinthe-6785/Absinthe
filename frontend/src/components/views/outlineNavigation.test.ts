// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeBlock, markdownToBlocks, type Block } from './blockUtils';
import {
  collectRootOutlineHeadingBlocks,
  flashHeadingElement,
  navigateToHeading,
  resolveHeadingBlockIdFromBlocks,
  resolveHeadingScrollTargetFromBlocks,
  scrollToHeadingTarget,
} from './outlineNavigation';

function block(id: string, type: Block['type'], content: string, extra?: Partial<Block>): Block {
  return { ...makeBlock(type, { content, ...extra }), id };
}

describe('outlineNavigation', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    vi.useRealTimers();
  });

  it('resolveHeadingBlockIdFromBlocks maps TOC order to live block ids', () => {
    const blocks = [
      block('live-h1', 'heading1', 'First'),
      block('live-p', 'paragraph', 'intro'),
      block('live-h2', 'heading2', 'Second'),
      block('live-h3', 'heading3', 'Third'),
    ];

    expect(resolveHeadingBlockIdFromBlocks(blocks, 0)).toBe('live-h1');
    expect(resolveHeadingBlockIdFromBlocks(blocks, 1)).toBe('live-h2');
    expect(resolveHeadingBlockIdFromBlocks(blocks, 2)).toBe('live-h3');
    expect(collectRootOutlineHeadingBlocks(blocks).map(b => b.id)).toEqual([
      'live-h1', 'live-h2', 'live-h3',
    ]);
  });

  it('maps toggle headings H1–H4 in live block order', () => {
    const blocks = [
      block('th1', 'toggleHeading1', 'Toggle H1'),
      block('th2', 'toggleHeading2', 'Toggle H2', { collapsed: true }),
      block('th3', 'toggleHeading3', 'Toggle H3'),
      block('th4', 'toggleHeading4', 'Toggle H4'),
    ];

    const ids = [0, 1, 2, 3].map(i => resolveHeadingBlockIdFromBlocks(blocks, i));
    expect(ids).toEqual(['th1', 'th2', 'th3', 'th4']);
  });

  it('live block ids differ from a fresh markdown re-parse', () => {
    const blocks = [
      block('editor-id-1', 'heading1', 'One'),
      block('editor-id-2', 'heading2', 'Two'),
    ];
    const reparsed = markdownToBlocks('# One\n## Two');
    const reparsedIds = collectRootOutlineHeadingBlocks(reparsed).map(b => b.id);
    expect(reparsedIds).not.toEqual(['editor-id-1', 'editor-id-2']);
    expect(resolveHeadingBlockIdFromBlocks(blocks, 1)).toBe('editor-id-2');
  });

  it('scrollToHeadingTarget scrolls within editor pane using live block id', () => {
    const root = document.createElement('div');
    root.style.height = '200px';
    root.style.overflow = 'auto';
    const target = document.createElement('div');
    target.className = 'be-block';
    target.dataset.blockId = 'live-h2';
    target.style.height = '400px';
    root.appendChild(target);
    document.body.appendChild(root);

    const scrollTo = vi.fn();
    root.scrollTo = scrollTo as typeof root.scrollTo;

    expect(scrollToHeadingTarget(root, '[data-block-id="live-h2"]')).toBe(true);
    expect(scrollTo).toHaveBeenCalled();
  });

  it('navigateToHeading uses virtual scroll with live block id when target is off-screen', () => {
    const blocks = [
      block('live-h1', 'heading1', 'One'),
      block('live-h2', 'heading2', 'Two'),
    ];
    const scrollToBlockId = vi.fn(() => true);
    const root = document.createElement('div');
    root.style.height = '200px';
    root.style.overflow = 'auto';
    document.body.appendChild(root);

    expect(navigateToHeading({
      scrollRoot: root,
      blocks,
      headingIdx: 1,
      scrollToBlockId,
    })).toBe(true);
    expect(scrollToBlockId).toHaveBeenCalledWith('live-h2');
  });

  it('navigateToHeading scrolls immediately when live target is mounted', () => {
    const blocks = [block('live-h1', 'heading1', 'Hello')];
    const { blockId, selector } = resolveHeadingScrollTargetFromBlocks(blocks, 0);
    expect(blockId).toBe('live-h1');

    const root = document.createElement('div');
    root.style.height = '200px';
    root.style.overflow = 'auto';
    const target = document.createElement('div');
    target.className = 'be-block';
    target.setAttribute('data-block-id', 'live-h1');
    root.appendChild(target);
    document.body.appendChild(root);

    const scrollTo = vi.fn();
    root.scrollTo = scrollTo as typeof root.scrollTo;
    const scrollToBlockId = vi.fn(() => true);

    expect(navigateToHeading({
      scrollRoot: root,
      blocks,
      headingIdx: 0,
      scrollToBlockId,
      onFlash: flashHeadingElement,
    })).toBe(true);
    expect(scrollTo).toHaveBeenCalled();
    expect(scrollToBlockId).not.toHaveBeenCalled();
    expect(selector).toContain('live-h1');
  });

  it('flashHeadingElement adds temporary highlight class', () => {
    vi.useFakeTimers();
    const blockEl = document.createElement('div');
    blockEl.className = 'be-block';
    document.body.appendChild(blockEl);

    flashHeadingElement(blockEl);
    expect(blockEl.classList.contains('be-heading-flash')).toBe(true);

    vi.advanceTimersByTime(1200);
    expect(blockEl.classList.contains('be-heading-flash')).toBe(false);
  });
});
