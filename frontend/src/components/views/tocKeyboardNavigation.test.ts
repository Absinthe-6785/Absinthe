import { describe, expect, it } from 'vitest';
import {
  resolveNextTocKeyboardIndex,
  resolveTocOpenIndex,
} from './tocKeyboardNavigation';

const visible = [{ idx: 0 }, { idx: 2 }, { idx: 5 }];

describe('tocKeyboardNavigation', () => {
  it('j moves to next visible heading index', () => {
    expect(resolveNextTocKeyboardIndex(visible, null, 'next')).toBe(0);
    expect(resolveNextTocKeyboardIndex(visible, 0, 'next')).toBe(2);
    expect(resolveNextTocKeyboardIndex(visible, 2, 'next')).toBe(5);
    expect(resolveNextTocKeyboardIndex(visible, 5, 'next')).toBe(5);
  });

  it('k moves to previous visible heading index', () => {
    expect(resolveNextTocKeyboardIndex(visible, 5, 'prev')).toBe(2);
    expect(resolveNextTocKeyboardIndex(visible, 2, 'prev')).toBe(0);
    expect(resolveNextTocKeyboardIndex(visible, 0, 'prev')).toBe(0);
    expect(resolveNextTocKeyboardIndex(visible, null, 'prev')).toBe(5);
  });

  it('skips collapsed headings via visible list only', () => {
    expect(resolveNextTocKeyboardIndex(visible, 1, 'next')).toBe(2);
  });

  it('resolveTocOpenIndex prefers keyboard selection', () => {
    expect(resolveTocOpenIndex(visible, 2, 0)).toBe(2);
    expect(resolveTocOpenIndex(visible, null, 0)).toBe(0);
    expect(resolveTocOpenIndex(visible, null, null)).toBe(0);
  });
});
