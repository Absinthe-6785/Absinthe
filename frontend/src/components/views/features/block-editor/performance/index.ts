export {
  getVirtualBlocksPocOverride,
  isVirtualBlocksPocEnabled,
  setVirtualBlocksPocOverride,
} from './virtualBlocksFlag';
export { estimateBlockHeight, getEstimatedHeightForType } from './blockHeightEstimates';
export { BlockHeightCache } from './blockHeightCache';
export { DISABLED_DRAG_API } from './disabledDragApi';
export { scrollToBlockId, type BlockVirtualizer } from './scrollToBlockId';
export { useVirtualBlockList, type UseVirtualBlockListResult } from './useVirtualBlockList';
export { VirtualBlockList } from './VirtualBlockList';

import type { MutableRefObject } from 'react';

export type VirtualScrollApiRef = MutableRefObject<{
  scrollToBlockId: (blockId: string) => boolean;
} | null>;
