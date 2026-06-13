import { describe, expect, it } from 'vitest';
import { buildFocusUniverseDepthMap, focusUniverseEdgeOpacity, focusUniverseNodeOpacityByDepth } from './focusUniverse';

describe('focusUniverse depth (K-33.1)', () => {
  const edges = [
    { from: 'a', to: 'b' },
    { from: 'b', to: 'c' },
    { from: 'c', to: 'd' },
  ];

  it('maps depth 0/1/2 from selected node', () => {
    const map = buildFocusUniverseDepthMap('a', edges, 2);
    expect(map.get('a')).toBe(0);
    expect(map.get('b')).toBe(1);
    expect(map.get('c')).toBe(2);
    expect(map.has('d')).toBe(false);
  });

  it('fades distant nodes more aggressively', () => {
    expect(focusUniverseNodeOpacityByDepth(0, true)).toBe(1);
    expect(focusUniverseNodeOpacityByDepth(2, true)).toBeLessThan(focusUniverseNodeOpacityByDepth(1, true));
    expect(focusUniverseNodeOpacityByDepth(undefined, true)).toBe(0.06);
  });

  it('dims edges outside focus shell', () => {
    expect(focusUniverseEdgeOpacity(0, 1, true)).toBeGreaterThan(
      focusUniverseEdgeOpacity(undefined, 1, true),
    );
  });
});
