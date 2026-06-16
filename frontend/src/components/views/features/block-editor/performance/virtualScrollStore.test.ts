import { describe, expect, it } from 'vitest';
import {
  getVirtualScrollSnapshot,
  resetVirtualScrollStore,
  setVirtualScrollSnapshot,
} from './virtualScrollStore';
import type { BlockHeightCache } from './blockHeightCache';
import type { BlockVirtualizer } from './scrollToBlockId';

describe('virtualScrollStore', () => {
  it('stores and clears snapshot', () => {
    resetVirtualScrollStore();
    expect(getVirtualScrollSnapshot()).toBeNull();

    const virtualizer = { scrollToIndex: () => {} } as unknown as BlockVirtualizer;
    const heightCache = { size: 0 } as unknown as BlockHeightCache;
    setVirtualScrollSnapshot({
      virtualizer,
      heightCache,
      scrollToBlockId: () => true,
      getBlockScrollTop: () => 12,
    });

    expect(getVirtualScrollSnapshot()?.getBlockScrollTop('x')).toBe(12);
    resetVirtualScrollStore();
    expect(getVirtualScrollSnapshot()).toBeNull();
  });
});
