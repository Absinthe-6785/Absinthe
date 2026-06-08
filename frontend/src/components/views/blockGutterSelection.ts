/**
 * blockGutterSelection.ts — Notion-style gutter drag selection (UX-2B)
 */
import type { Block } from './blockUtils';
import {
  getSiblingOrderedIds,
  haveSameParent,
  selectRange,
  selectSingle,
} from './blockSelection';

export interface GutterSelectionState {
  anchorId: string;
  pointerId: number;
}

export function beginGutterSelection(anchorId: string, pointerId: number): GutterSelectionState {
  return { anchorId, pointerId };
}

/** Range select between anchor and hover; clamps to same-parent siblings. */
export function updateGutterSelection(
  blocks: Block[],
  anchorId: string,
  hoverId: string,
): Set<string> {
  if (!haveSameParent(blocks, anchorId, hoverId)) {
    return selectSingle(anchorId);
  }
  const siblings = getSiblingOrderedIds(blocks, anchorId);
  if (!siblings) return selectSingle(anchorId);
  return selectRange(anchorId, hoverId, siblings);
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
  return block?.getAttribute('data-drag-id') ?? null;
}

/** True when pointer target is gutter zone (not grip / handle button). */
export function isGutterDragStart(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (!target.closest('.be-gutter')) return false;
  if (target.closest('.be-grip, .be-handle-btn, .be-block-handle-menu')) return false;
  return true;
}

/** Content-editable targets must keep native text selection. */
export function isTextSelectionTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || !!target.closest('.be-editable, [contenteditable="true"]');
}
