/**
 * Row metrics — pointer Y → block row without requiring every block mounted (virtual-drag prep).
 */
import type { Block } from '../../../blockUtils';
import { isToggleBlockType } from '../../../toggleBlockTypes';
import {
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

/** Preserve the canonical destination contract used by drag commit. */
export function createDropTargetHit(
  overId: string,
  overPos: DropTargetHit['overPos'],
): DropTargetHit {
  return { overId, overPos };
}

/**
 * Resolve the vertical destination from one block's actual geometry.
 * Mounted DOM hit-testing and virtual-row fallback both use this function so
 * target resolution and the eventual commit cannot disagree on before/after.
 */
export function resolveDropPositionFromRect(
  clientY: number,
  rect: Pick<DOMRect, 'top' | 'bottom'>,
  options: { isToggle?: boolean; collapsed?: boolean } = {},
): DropTargetHit['overPos'] {
  const height = Math.max(0, rect.bottom - rect.top);
  if (options.isToggle && (options.collapsed || clientY > rect.top + height * 0.35)) {
    return 'inside';
  }
  return clientY < rect.top + height / 2 ? 'before' : 'after';
}

/** Mounted root rows, measured from the draggable block wrappers themselves. */
export function getMountedRootBlockRows(editorRoot: HTMLElement): BlockRowHit[] {
  const rows: BlockRowHit[] = [];
  const virtualList = Array.from(editorRoot.children)
    .find(child => child.classList.contains('be-virtual-block-list')) as HTMLElement | undefined;

  if (virtualList) {
    for (const rowEl of Array.from(virtualList.children)) {
      const blockEl = Array.from(rowEl.children)
        .find(child => child.classList.contains('be-block')) as HTMLElement | undefined;
      if (!blockEl) continue;
      const rect = blockEl.getBoundingClientRect();
      rows.push({ blockId: blockEl.getAttribute('data-drag-id') ?? '', top: rect.top, bottom: rect.bottom });
    }
    return rows.filter(row => row.blockId);
  }

  for (const child of Array.from(editorRoot.children)) {
    if (!child.classList.contains('be-block')) continue;
    const blockEl = child as HTMLElement;
    const rect = blockEl.getBoundingClientRect();
    rows.push({ blockId: blockEl.getAttribute('data-drag-id') ?? '', top: rect.top, bottom: rect.bottom });
  }
  return rows.filter(row => row.blockId);
}

/**
 * Resolve a mounted gap using the same sibling zones as the virtual fallback.
 * The root filter keeps nested toggle editors out of the root sibling scope.
 */
export function resolveDropTargetFromMountedRows(
  clientX: number,
  clientY: number,
  draggingIds: string[],
): DropTargetHit | null {
  const sourceRoot = draggingIds[0]
    ? (document.querySelector(`[data-drag-id="${draggingIds[0]}"]`)
      ?.closest('.be-editor-root.be-blocks-root') as HTMLElement | null)
    : null;
  const roots = sourceRoot
    ? [sourceRoot]
    : Array.from(document.querySelectorAll<HTMLElement>('.be-editor-root.be-blocks-root'))
      .sort((a, b) => Number(a.classList.contains('be-editor-nested')) - Number(b.classList.contains('be-editor-nested')));

  for (const root of roots) {
    const rows = getMountedRootBlockRows(root);
    if (rows.length === 0) continue;
    const rootRect = root.getBoundingClientRect();
    const hasRootRect = rootRect.width > 0 || rootRect.height > 0;
    const horizontalMatch = !hasRootRect || (clientX >= rootRect.left - 64 && clientX <= rootRect.right + 16);
    const verticalMatch = !hasRootRect
      || (clientY >= Math.min(rootRect.top, rows[0]!.top) - 2
        && clientY <= Math.max(rootRect.bottom, rows[rows.length - 1]!.bottom) + 2);
    if (!horizontalMatch || !verticalMatch) continue;
    return resolveDropTargetFromRows(clientY, rows, draggingIds);
  }
  return null;
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

export function rowForBlockId(rows: BlockRowHit[], blockId: string): BlockRowHit | undefined {
  return rows.find(r => r.blockId === blockId);
}

export interface OverlayFrame {
  top: number;
  left: number;
  width: number;
  height: number;
  indentLeft: number;
}

/** Map a row hit to fixed overlay coordinates (virtual-safe). */
export function overlayFrameFromRow(
  row: BlockRowHit,
  scrollRect: { left: number; width: number },
  indentLeft = 0,
): OverlayFrame {
  return {
    top: row.top,
    left: scrollRect.left,
    width: scrollRect.width,
    height: row.bottom - row.top,
    indentLeft,
  };
}

/** Resolve overlay frame: DOM measurement first, then row metrics. */
export function resolveOverlayFrame(
  blockId: string,
  options: RowMetricsOptions,
): OverlayFrame | null {
  const el = document.querySelector(`[data-drag-id="${blockId}"]`) as HTMLElement | null;
  if (el) {
    const rect = el.getBoundingClientRect();
    const marginLeft = parseFloat(getComputedStyle(el).marginLeft) || 0;
    return {
      top: rect.top,
      left: rect.left,
      width: rect.width,
      height: rect.height,
      indentLeft: marginLeft,
    };
  }

  const rows = getRowMetrics(options);
  const row = rowForBlockId(rows, blockId);
  if (!row) return null;

  const scrollEl = options.getScrollElement?.();
  const scrollRect = scrollEl?.getBoundingClientRect()
    ?? { left: 0, width: typeof window !== 'undefined' ? window.innerWidth : 800 };
  return overlayFrameFromRow(row, scrollRect);
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

  const eligible = rows
    .filter(r => !draggingIds.includes(r.blockId))
    .sort((a, b) => a.top - b.top || a.bottom - b.bottom);
  if (eligible.length === 0) return null;

  const boundaries = eligible.slice(0, -1).map((row, index) => {
    const next = eligible[index + 1]!;
    return (row.bottom + next.top) / 2;
  });

  for (let index = 0; index < eligible.length; index += 1) {
    const row = eligible[index]!;
    const height = Math.max(0, row.bottom - row.top);
    const midpoint = row.top + height / 2;
    const zoneTop = index === 0 ? Number.NEGATIVE_INFINITY : boundaries[index - 1]!;
    const zoneBottom = index === eligible.length - 1 ? Number.POSITIVE_INFINITY : boundaries[index]!;

    const block = getBlock?.(row.blockId);
    if (block != null && isToggleBlockType(block.type)
      && clientY >= row.top && clientY <= row.bottom
      && (block.collapsed || clientY > row.top + height * 0.35)) {
      return { overId: row.blockId, overPos: 'inside' };
    }

    if (clientY >= zoneTop && clientY < midpoint) {
      return createDropTargetHit(
        row.blockId,
        'before',
      );
    }
    if (clientY >= midpoint && clientY < zoneBottom) {
      return createDropTargetHit(
        row.blockId,
        'after',
      );
    }
  }

  // Defensive fallback for malformed/overlapping measurements: keep the
  // destination deterministic without introducing a dead drop region.
  const last = eligible[eligible.length - 1]!;
  return createDropTargetHit(last.blockId, 'after');
}
