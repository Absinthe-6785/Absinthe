import { describe, expect, it } from 'vitest';
import { generateBenchmarkBlocks } from '../../../editorBenchmark';
import { BlockHeightCache } from './blockHeightCache';
import {
  collectVirtualizationStats,
  getVirtualizationStats,
  setVirtualizationStatsSource,
} from './virtualizationStats';

describe('virtualizationStats', () => {
  it('returns disabled defaults when no source registered', () => {
    setVirtualizationStatsSource(null);
    expect(getVirtualizationStats()).toEqual({
      enabled: false,
      totalRows: 0,
      mountedRows: 0,
      cachedHeights: 0,
      overscan: 0,
    });
  });

  it('reads from registered stats source', () => {
    setVirtualizationStatsSource(() => ({
      enabled: true,
      totalRows: 2000,
      mountedRows: 22,
      cachedHeights: 18,
      overscan: 8,
    }));
    expect(getVirtualizationStats().mountedRows).toBe(22);
    setVirtualizationStatsSource(null);
  });

  it('collectVirtualizationStats reports cache size', () => {
    const blocks = generateBenchmarkBlocks(10);
    const cache = new BlockHeightCache();
    cache.set(blocks[0]!.id, 48);
    const virtualizer = {
      getVirtualItems: () => [{ index: 0 }, { index: 1 }],
    };
    const stats = collectVirtualizationStats(true, blocks, virtualizer as never, cache, 8);
    expect(stats.totalRows).toBe(10);
    expect(stats.mountedRows).toBe(2);
    expect(stats.cachedHeights).toBe(1);
    expect(stats.enabled).toBe(true);
    expect(stats.overscan).toBe(8);
  });
});
