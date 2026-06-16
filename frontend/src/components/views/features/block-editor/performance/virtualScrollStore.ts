/**
 * External virtual scroll snapshot — scroll offset updates stay in VirtualBlockScrollHost.
 */
import type { BlockHeightCache } from './blockHeightCache';
import type { BlockVirtualizer } from './scrollToBlockId';

export interface VirtualScrollSnapshot {
  virtualizer: BlockVirtualizer;
  heightCache: BlockHeightCache;
  scrollToBlockId: (blockId: string) => boolean;
  getBlockScrollTop: (blockId: string) => number | null;
}

let snapshot: VirtualScrollSnapshot | null = null;

export function getVirtualScrollSnapshot(): VirtualScrollSnapshot | null {
  return snapshot;
}

export function setVirtualScrollSnapshot(next: VirtualScrollSnapshot | null): void {
  snapshot = next;
}

export function resetVirtualScrollStore(): void {
  snapshot = null;
}
