import { useCallback, useEffect, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { Block } from '../../../blockUtils';
import { BlockHeightCache } from './blockHeightCache';
import { estimateBlockHeight } from './blockHeightEstimates';
import { observeScrollRectWithFallback } from './observeScrollRect';
import { scrollToBlockId as scrollToBlockIdImpl, type BlockVirtualizer } from './scrollToBlockId';

const DEFAULT_OVERSCAN = 8;

export interface UseVirtualBlockListOptions {
  blocks: Block[];
  enabled: boolean;
  getScrollElement: () => HTMLElement | null;
  overscan?: number;
}

export interface UseVirtualBlockListResult {
  virtualizer: BlockVirtualizer;
  heightCache: BlockHeightCache;
  scrollToBlockId: (blockId: string) => boolean;
  enabled: boolean;
}

export function useVirtualBlockList({
  blocks,
  enabled,
  getScrollElement,
  overscan = DEFAULT_OVERSCAN,
}: UseVirtualBlockListOptions): UseVirtualBlockListResult {
  const heightCacheRef = useRef<BlockHeightCache | null>(null);
  if (!heightCacheRef.current) heightCacheRef.current = new BlockHeightCache();
  const heightCache = heightCacheRef.current;

  const blocksRef = useRef(blocks);
  blocksRef.current = blocks;

  const virtualizer = useVirtualizer({
    count: enabled ? blocks.length : 0,
    getScrollElement,
    overscan,
    observeElementRect: observeScrollRectWithFallback,
    estimateSize: (index) => {
      const block = blocksRef.current[index];
      if (!block) return 46;
      return heightCache.get(block.id) ?? estimateBlockHeight(block);
    },
    measureElement: (element) => {
      const index = Number(element.getAttribute('data-index'));
      const block = blocksRef.current[index];
      const height = element.getBoundingClientRect().height;
      if (block && height > 0) heightCache.set(block.id, height);
      return height;
    },
  });

  const scrollToBlockId = useCallback((blockId: string) => {
    return scrollToBlockIdImpl(virtualizer, blocksRef.current, blockId);
  }, [virtualizer]);

  useEffect(() => {
    if (!enabled) return;
    if (getScrollElement()) virtualizer.measure();
  }, [enabled, getScrollElement, virtualizer, blocks.length]);

  return {
    virtualizer,
    heightCache,
    scrollToBlockId,
    enabled,
  };
}
