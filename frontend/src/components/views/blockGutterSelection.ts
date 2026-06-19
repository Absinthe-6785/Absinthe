/**
 * blockGutterSelection.ts — Notion-style gutter drag selection (UX-2B fix)
 */
import type { Block } from './blockUtils';
import {
  getDocumentOrderedIds,
  selectRange,
  selectSingle,
} from './features/block-editor/features/selection';

/** Left-edge pointer zone (px) for gutter drag / block select — K-106 widened hitbox. */
export const BLOCK_LEFT_SELECT_ZONE_PX = 72;

export interface GutterSelectionState {
  anchorId: string;
  pointerId: number;
}

export function beginGutterSelection(anchorId: string, pointerId: number): GutterSelectionState {
  return { anchorId, pointerId };
}

/** Range select between anchor and hover in document order (K-82 cross-toggle). */
export function updateGutterSelection(
  blocks: Block[],
  anchorId: string,
  hoverId: string,
): Set<string> {
  const ordered = getDocumentOrderedIds(blocks);
  if (!ordered.includes(anchorId) || !ordered.includes(hoverId)) {
    return selectSingle(anchorId);
  }
  return selectRange(anchorId, hoverId, ordered);
}

export function finishGutterSelection(
  blocks: Block[],
  anchorId: string,
  hoverId: string,
): { selected: Set<string>; anchorId: string } {
  return {
    selected: updateGutterSelection(blocks, anchorId, hoverId),
    anchorId,
  };
}

/** Block id under pointer (uses data-drag-id on block shells). */
export function hitTestBlockIdFromPoint(
  x: number,
  y: number,
  root: Element | null,
): string | null {
  if (!root || typeof document === 'undefined') return null;
  const el = document.elementFromPoint(x, y);
  if (!el || !root.contains(el)) return null;
  const block = (el as HTMLElement).closest('[data-drag-id]');
  if (!block || (root && !root.contains(block))) return null;
  return block.getAttribute('data-drag-id') ?? null;
}

/** True when pointer starts on the dedicated drag strip (not grip). */
export function isGutterDragStart(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.classList.contains('be-gutter-strip')
    || !!target.closest('.be-gutter-strip');
}
