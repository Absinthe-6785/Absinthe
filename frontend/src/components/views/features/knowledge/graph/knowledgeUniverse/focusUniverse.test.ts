import { describe, expect, it } from 'vitest';
import { buildFocusUniverse, focusUniverseNodeOpacity } from './focusUniverse';

describe('focusUniverse', () => {
  const edges = [
    { from: 'a', to: 'b' },
    { from: 'b', to: 'c' },
    { from: 'c', to: 'd' },
  ];

  it('expands neighborhood by depth', () => {
    expect(buildFocusUniverse('a', edges, 0)).toEqual(new Set(['a']));
    expect(buildFocusUniverse('a', edges, 1)).toEqual(new Set(['a', 'b']));
    expect(buildFocusUniverse('a', edges, 2)).toEqual(new Set(['a', 'b', 'c']));
  });

  it('fades unrelated nodes more when selection is active', () => {
    expect(focusUniverseNodeOpacity(false, true)).toBeLessThan(
      focusUniverseNodeOpacity(false, false),
    );
    expect(focusUniverseNodeOpacity(true, true)).toBe(1);
  });
});
