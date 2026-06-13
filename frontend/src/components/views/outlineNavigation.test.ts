// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  flashHeadingElement,
  headingScrollSelector,
  navigateToHeading,
  clearOutlineBodyCache,
  resolveHeadingBlockIdAtIndex,
  resolveHeadingScrollTarget,
  scrollToHeadingTarget,
} from './outlineNavigation';

describe('outlineNavigation', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    clearOutlineBodyCache();
    vi.useRealTimers();
  });

  it('resolveHeadingBlockIdAtIndex maps TOC order to root heading ids', () => {
    const body = [
      '# First',
      'intro',
      '## Second',
      '### Third',
    ].join('\n');

    const ids = [0, 1, 2].map(i => resolveHeadingBlockIdAtIndex(body, i));
    expect(ids.every(Boolean)).toBe(true);
    expect(new Set(ids).size).toBe(3);
    expect(headingScrollSelector(body, 1)).toMatch(/^\[data-block-id="blk-/);
  });

  it('maps toggle headings H1–H4 in TOC order', () => {
    const body = [
      '#>! Toggle H1',
      'child',
      '##> Toggle H2',
      '###>! Toggle H3',
      '####> Toggle H4',
    ].join('\n');

    const ids = [0, 1, 2, 3].map(i => resolveHeadingBlockIdAtIndex(body, i));
    expect(ids.every(Boolean)).toBe(true);
    expect(new Set(ids).size).toBe(4);
  });

  it('scrollToHeadingTarget scrolls within editor pane', () => {
    const root = document.createElement('div');
    root.style.height = '200px';
    root.style.overflow = 'auto';
    const target = document.createElement('div');
    target.className = 'be-block';
    target.dataset.blockId = 'h-2';
    target.style.height = '400px';
    root.appendChild(target);
    document.body.appendChild(root);

    const scrollTo = vi.fn();
    root.scrollTo = scrollTo as typeof root.scrollTo;

    expect(scrollToHeadingTarget(root, '[data-block-id="h-2"]')).toBe(true);
    expect(scrollTo).toHaveBeenCalled();
  });

  it('navigateToHeading uses virtual scroll when target is off-screen', () => {
    const body = ['# One', '## Two'].join('\n');
    const { blockId } = resolveHeadingScrollTarget(body, 1);
    expect(blockId).toBeTruthy();

    const scrollToBlockId = vi.fn(() => true);
    const root = document.createElement('div');
    root.style.height = '200px';
    root.style.overflow = 'auto';
    document.body.appendChild(root);

    expect(navigateToHeading({
      scrollRoot: root,
      body,
      headingIdx: 1,
      scrollToBlockId,
    })).toBe(true);
    expect(scrollToBlockId).toHaveBeenCalledWith(blockId);
  });

  it('navigateToHeading scrolls immediately when target is mounted', () => {
    const body = '# Hello';
    const { blockId, selector } = resolveHeadingScrollTarget(body, 0);
    expect(blockId).toBeTruthy();

    const root = document.createElement('div');
    root.style.height = '200px';
    root.style.overflow = 'auto';
    const target = document.createElement('div');
    target.className = 'be-block';
    target.setAttribute('data-block-id', blockId!);
    root.appendChild(target);
    document.body.appendChild(root);

    const scrollTo = vi.fn();
    root.scrollTo = scrollTo as typeof root.scrollTo;
    const scrollToBlockId = vi.fn(() => true);

    expect(navigateToHeading({
      scrollRoot: root,
      body,
      headingIdx: 0,
      scrollToBlockId,
      onFlash: flashHeadingElement,
    })).toBe(true);
    expect(scrollTo).toHaveBeenCalled();
    expect(scrollToBlockId).not.toHaveBeenCalled();
    expect(selector).toContain(blockId!);
  });

  it('flashHeadingElement adds temporary highlight class', () => {
    vi.useFakeTimers();
    const block = document.createElement('div');
    block.className = 'be-block';
    document.body.appendChild(block);

    flashHeadingElement(block);
    expect(block.classList.contains('be-heading-flash')).toBe(true);

    vi.advanceTimersByTime(1200);
    expect(block.classList.contains('be-heading-flash')).toBe(false);
  });
});
