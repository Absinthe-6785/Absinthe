import React, { useCallback, useEffect, useRef } from 'react';
import type { MutableRefObject } from 'react';
import type { Block } from '../../../blockUtils';
import { useRenderDiagnostic } from '../../../noteview/renderDiagnostics';
import { estimateBlockHeight } from './blockHeightEstimates';
import { collectVirtualizationStats, setVirtualizationStatsSource } from './virtualizationStats';
import { VIRTUAL_BLOCK_OVERSCAN } from './useVirtualBlockList';
import { useVirtualBlockList } from './useVirtualBlockList';
import { VirtualBlockList } from './VirtualBlockList';
import { setVirtualScrollSnapshot, resetVirtualScrollStore } from './virtualScrollStore';

type VirtualScrollApiRef = MutableRefObject<{
  scrollToBlockId: (blockId: string) => boolean;
  getBlockScrollTop?: (blockId: string) => number | null;
} | null>;

export interface VirtualBlockScrollHostProps {
  blocks: Block[];
  getScrollElement: () => HTMLElement | null;
  renderBlock: (block: Block) => React.ReactNode;
  virtualScrollApiRef?: VirtualScrollApiRef;
}

/**
 * Owns TanStack virtualizer state so scroll commits do not rerender BlockEditorInner.
 */
export function VirtualBlockScrollHost({
  blocks,
  getScrollElement,
  renderBlock,
  virtualScrollApiRef,
}: VirtualBlockScrollHostProps) {
  useRenderDiagnostic('VirtualBlockScrollHost');

  const blocksRef = useRef(blocks);
  blocksRef.current = blocks;

  const virtualList = useVirtualBlockList({
    blocks,
    enabled: true,
    getScrollElement,
  });

  const getBlockScrollTop = useCallback((blockId: string): number | null => {
    const rootBlocks = blocksRef.current;
    const index = rootBlocks.findIndex(b => b.id === blockId);
    if (index < 0) return null;
    const block = rootBlocks[index];
    const measurement = virtualList.virtualizer.measurementsCache[index];
    const offsetInfo = virtualList.virtualizer.getOffsetForIndex(index, 'start');
    const start = measurement?.start
      ?? (Array.isArray(offsetInfo) ? offsetInfo[0] : undefined)
      ?? index * estimateBlockHeight(block);
    return start;
  }, [virtualList.virtualizer]);

  useEffect(() => {
    setVirtualScrollSnapshot({
      virtualizer: virtualList.virtualizer,
      heightCache: virtualList.heightCache,
      scrollToBlockId: virtualList.scrollToBlockId,
      getBlockScrollTop,
    });
    return () => {
      resetVirtualScrollStore();
    };
  }, [
    virtualList.virtualizer,
    virtualList.heightCache,
    virtualList.scrollToBlockId,
    getBlockScrollTop,
  ]);

  useEffect(() => {
    if (!virtualScrollApiRef) return;
    virtualScrollApiRef.current = {
      scrollToBlockId: virtualList.scrollToBlockId,
      getBlockScrollTop,
    };
    return () => {
      virtualScrollApiRef.current = null;
    };
  }, [virtualScrollApiRef, virtualList.scrollToBlockId, getBlockScrollTop]);

  useEffect(() => {
    setVirtualizationStatsSource(() => collectVirtualizationStats(
      true,
      blocksRef.current,
      virtualList.virtualizer,
      virtualList.heightCache,
      VIRTUAL_BLOCK_OVERSCAN,
    ));
    return () => { setVirtualizationStatsSource(null); };
  }, [virtualList.virtualizer, virtualList.heightCache, blocks.length]);

  return (
    <VirtualBlockList blocks={blocks} virtualList={virtualList}>
      {renderBlock}
    </VirtualBlockList>
  );
}
