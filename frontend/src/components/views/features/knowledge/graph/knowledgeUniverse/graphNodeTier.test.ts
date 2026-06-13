import { describe, expect, it } from 'vitest';
import { classifyGraphNodeTier, isStarTier } from './graphNodeTier';

describe('graphNodeTier', () => {
  it('classifies stars by backlink count, area notes, or pinned hubs', () => {
    expect(classifyGraphNodeTier({ backlinkCount: 10, isAreaNote: false, isPinnedHub: false })).toBe('star');
    expect(classifyGraphNodeTier({ backlinkCount: 2, isAreaNote: true, isPinnedHub: false })).toBe('star');
    expect(classifyGraphNodeTier({ backlinkCount: 0, isAreaNote: false, isPinnedHub: true })).toBe('star');
  });

  it('classifies planets for mid-range backlink counts', () => {
    expect(classifyGraphNodeTier({ backlinkCount: 3, isAreaNote: false, isPinnedHub: false })).toBe('planet');
    expect(classifyGraphNodeTier({ backlinkCount: 9, isAreaNote: false, isPinnedHub: false })).toBe('planet');
  });

  it('classifies moons for low backlink counts', () => {
    expect(classifyGraphNodeTier({ backlinkCount: 0, isAreaNote: false, isPinnedHub: false })).toBe('moon');
    expect(classifyGraphNodeTier({ backlinkCount: 2, isAreaNote: false, isPinnedHub: false })).toBe('moon');
  });

  it('identifies star tier', () => {
    expect(isStarTier('star')).toBe(true);
    expect(isStarTier('planet')).toBe(false);
  });
});
