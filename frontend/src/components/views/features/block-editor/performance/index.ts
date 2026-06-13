export {
  getVirtualBlocksDisableOverride,
  getVirtualBlocksPocOverride,
  isVirtualBlocksEnvOptedOut,
  isVirtualBlocksPocEnabled,
  setVirtualBlocksDisableOverride,
  setVirtualBlocksPocOverride,
} from './virtualBlocksFlag';
export {
  collectVirtualizationStats,
  getVirtualizationStats,
  setVirtualizationStatsSource,
  type VirtualizationStats,
} from './virtualizationStats';
export { VIRTUAL_BLOCK_OVERSCAN } from './useVirtualBlockList';
export { estimateBlockHeight, getEstimatedHeightForType } from './blockHeightEstimates';
export { BlockHeightCache } from './blockHeightCache';
export { DISABLED_DRAG_API } from './disabledDragApi';
export { DragOverlay } from './DragOverlay';
export {
  getRowMetrics,
  getVisibleRowMetrics,
  getVirtualRowMetrics,
  resolveDropTargetFromRows,
  resolveOverlayFrame,
  overlayFrameFromRow,
  rowForBlockId,
  type RowMetricsOptions,
  type DropTargetHit,
  type OverlayFrame,
} from './rowMetrics';
export {
  getDragStateSnapshot,
  subscribeDragState,
  setDragStateStore,
  updateDragStateOver,
} from './dragStateStore';
export { useDragStateSnapshot } from './useDragStateSnapshot';
export { scrollToBlockId, type BlockVirtualizer } from './scrollToBlockId';
export { useVirtualBlockList, type UseVirtualBlockListResult } from './useVirtualBlockList';
export { VirtualBlockList } from './VirtualBlockList';
export { PendingFocusQueue } from './pendingFocusQueue';
export {
  createDirectFocusNavigation,
  createVirtualNavigationApi,
  type VirtualNavigationApi,
} from './virtualNavigation';
export { VirtualNavigationProvider, useVirtualNavigation } from './VirtualNavigationContext';
export { listVirtualBlockRows } from './listVirtualBlockRows';

import type { MutableRefObject } from 'react';

export type VirtualScrollApiRef = MutableRefObject<{
  scrollToBlockId: (blockId: string) => boolean;
  getBlockScrollTop?: (blockId: string) => number | null;
} | null>;
