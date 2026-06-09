/**
 * Row metrics — pointer Y → block row without requiring every block mounted (virtual-drag prep).
 */
import type { Block } from '../../../blockUtils';
import {
  blockIdAtRow,
  listRootBlockRows,
  type BlockRowHit,
} from '../../../documentFocus';
import { listVirtualBlockRows } from './listVirtualBlockRows';
import type { BlockVirtualizer } from './scrollToBlockId';

export type { BlockRowHit };

export interface RowMetricsOptions {
  getEditorRoot: () => HTMLElement | null;
  getRootBlockIds: () => string[];
  getBlocks?: () => Block[];
  getVirtualizer?: () => BlockVirtualizer | null;
  getScrollElement?: () => HTMLElement | null;
}

export interface DropTargetHit {
  overId: string;
  overPos: 'before' | 'after' | 'inside';
}

/** Visible mounted rows from DOM measurements. */
export function getVisibleRowMetrics(options: RowMetricsOptions): BlockRowHit[] {
  const root = options.getEditorRoot();
  if (!root) return [];
  return listRootBlockRows(root, options.getRootBlockIds());
}

/** Estimated rows from virtualizer offsets (no per-block DOM). */
export function getVirtualRowMetrics(
  virtualizer: BlockVirtualizer,
  blocks: Block[],
  scrollElement: HTMLElement,
): BlockRowHit[] {
  return listVirtualBlockRows(virtualizer, blocks, scrollElement);
}

/** Unified row lookup for drag / gutter / virtual navigation consumers. */
export function getRowMetrics(options: RowMetricsOptions): BlockRowHit[] {
  const virtualizer = options.getVirtualizer?.() ?? null;
  const scrollElement = options.getScrollElement?.() ?? null;
  const blocks = options.getBlocks?.() ?? [];
  if (virtualizer && scrollElement && blocks.length > 0) {
    return getVirtualRowMetrics(virtualizer, blocks, scrollElement);
  }
  return getVisibleRowMetrics(options);
}

function rowForBlockId(rows: BlockRowHit[], blockId: string): BlockRowHit | undefined {
  return rows.find(r => r.blockId === blockId);
}

/**
 * Resolve drop target from clientY using row metrics (virtual-safe hit test).
 * Falls back to nearest row when Y is between rows.
 */
export function resolveDropTargetFromRows(
  clientY: number,
  rows: BlockRowHit[],
  draggingIds: string[],
  getBlock?: (id: string) => Block | undefined,
): DropTargetHit | null {
  if (rows.length === 0) return null;

  const eligible = rows.filter(r => !draggingIds.includes(r.blockId));
  if (eligible.length === 0) return null;

  const { blockId, belowAll } = blockIdAtRow(
    clientY,
    document.createElement('div'),
    eligible.map(r => r.blockId),
    eligible,
  );

  if (belowAll) {
    const last = eligible[eligible.length - 1]!;
    return { overId: last.blockId, overPos: 'after' };
  }

  if (!blockId || draggingIds.includes(blockId)) return null;

  const row = rowForBlockId(eligible, blockId);
  if (!row) return null;

  const block = getBlock?.(blockId);
  const blockType = block?.type;
  const collapsedToggle = block?.type === 'toggle' && block.collapsed;

  if (blockType === 'toggle' && (collapsedToggle || clientY > row.top + (row.bottom - row.top) * 0.35)) {
    return { overId: blockId, overPos: 'inside' };
  }

  const overPos = clientY < row.top + (row.bottom - row.top) / 2 ? 'before' : 'after';
  return { overId: blockId, overPos };
}
