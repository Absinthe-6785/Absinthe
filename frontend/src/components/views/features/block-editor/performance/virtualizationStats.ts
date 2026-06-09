/**
 * Developer-facing virtualization diagnostics (no remote telemetry).
 */
import type { Block } from '../../../blockUtils';
import type { BlockHeightCache } from './blockHeightCache';
import type { BlockVirtualizer } from './scrollToBlockId';

export interface VirtualizationStats {
  enabled: boolean;
  totalRows: number;
  mountedRows: number;
  cachedHeights: number;
  overscan: number;
}

export type VirtualizationStatsSource = () => VirtualizationStats;

let statsSource: VirtualizationStatsSource | null = null;

/** Register live stats from the editor (cleared on unmount). */
export function setVirtualizationStatsSource(source: VirtualizationStatsSource | null): void {
  statsSource = source;
}

/** Snapshot of current virtualization metrics, or disabled defaults. */
export function getVirtualizationStats(): VirtualizationStats {
  return statsSource?.() ?? {
    enabled: false,
    totalRows: 0,
    mountedRows: 0,
    cachedHeights: 0,
    overscan: 0,
  };
}

export function collectVirtualizationStats(
  enabled: boolean,
  blocks: Block[],
  virtualizer: BlockVirtualizer,
  heightCache: BlockHeightCache,
  overscan: number,
): VirtualizationStats {
  return {
    enabled,
    totalRows: blocks.length,
    mountedRows: enabled ? virtualizer.getVirtualItems().length : blocks.length,
    cachedHeights: heightCache.size,
    overscan,
  };
}
