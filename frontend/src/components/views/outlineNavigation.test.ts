// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  flashHeadingElement,
  headingScrollSelector,
  resolveHeadingBlockIdAtIndex,
  scrollToHeadingTarget,
} from './outlineNavigation';

describe('outlineNavigation', () => {
  afterEach(() => {
    document.body.innerHTML = '';
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
