import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { defaultRangeExtractor, useVirtualizer } from '@tanstack/react-virtual';
import type { Block } from '../../../blockUtils';
import { BlockHeightCache } from './blockHeightCache';
import { estimateBlockHeight } from './blockHeightEstimates';
import { observeScrollRectWithFallback } from './observeScrollRect';
import { scrollToBlockId as scrollToBlockIdImpl, type BlockVirtualizer } from './scrollToBlockId';
import { getDragStateSnapshot, subscribeDragState } from './dragStateStore';

export const VIRTUAL_BLOCK_OVERSCAN = 8;
const DEFAULT_OVERSCAN = VIRTUAL_BLOCK_OVERSCAN;

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

/** Keep virtual measurements attached to the block, never to its old index. */
export function virtualBlockItemKey(
  blocks: readonly Pick<Block, 'id'>[],
  index: number,
): string | number {
  return blocks[index]?.id ?? index;
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

  const getItemKey = useCallback(
    (index: number) => virtualBlockItemKey(blocksRef.current, index),
    [],
  );

  const pinnedIndicesRef = useRef<number[]>([]);

  const virtualizer = useVirtualizer({
    count: enabled ? blocks.length : 0,
    getScrollElement,
    getItemKey,
    overscan,
    rangeExtractor: (range) => {
      const base = defaultRangeExtractor(range);
      const pinned = pinnedIndicesRef.current.filter(
        i => i >= 0 && i < blocksRef.current.length,
      );
      if (pinned.length === 0) return base;
      return [...new Set([...base, ...pinned])].sort((a, b) => a - b);
    },
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

  const blockIdsKey = blocks.map(b => b.id).join('\0');

  useLayoutEffect(() => {
    if (!enabled) return;
    if (getScrollElement()) virtualizer.measure();
  }, [enabled, getScrollElement, virtualizer, blockIdsKey]);

  useEffect(() => {
    if (!enabled) return;
    heightCache.pruneStale(new Set(blocksRef.current.map(b => b.id)));
  }, [enabled, blockIdsKey, heightCache]);

  const [, setPinTick] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    const syncPinned = () => {
      const state = getDragStateSnapshot();
      if (!state) {
        pinnedIndicesRef.current = [];
      } else {
        const pinIds = new Set(
          [...state.draggingIds, state.overId].filter((id): id is string => !!id),
        );
        const pinned: number[] = [];
        blocksRef.current.forEach((block, index) => {
          if (pinIds.has(block.id)) pinned.push(index);
        });
        pinnedIndicesRef.current = pinned;
      }
      setPinTick(t => t + 1);
    };
    syncPinned();
    return subscribeDragState(syncPinned);
  }, [enabled]);

  return {
    virtualizer,
    heightCache,
    scrollToBlockId,
    enabled,
  };
}
