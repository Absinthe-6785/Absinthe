/**
 * blockSelection.ts — Multi-block selection helpers (document-order range, K-82)
 *
 * Selection uses tree preorder via flattenBlockIds — same ordering as navigation,
 * drag, and multi-block ops. This allows shift+click and gutter drag across toggle
 * boundaries without schema changes.
 */
import type { Block } from '../../../../../blockUtils';
import { flattenBlockIds } from '../../../../../blockUtils';
import { findParentId } from '../../../../../blockTree';

export function selectSingle(id: string): Set<string> {
  return new Set([id]);
}

export function toggleInSelection(current: Set<string>, id: string): Set<string> {
  const next = new Set(current);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

export function clearSelection(): Set<string> {
  return new Set();
}

export function haveSameParent(blocks: Block[], idA: string, idB: string): boolean {
  const parentA = findParentId(blocks, idA);
  const parentB = findParentId(blocks, idB);
  if (parentA === undefined || parentB === undefined) return false;
  return parentA === parentB;
}

/** Document-order block ids (depth-first preorder). */
export function getDocumentOrderedIds(blocks: Block[]): string[] {
  return flattenBlockIds(blocks);
}

/** @deprecated Use getDocumentOrderedIds — kept for legacy callers/tests. */
export function getSiblingOrderedIds(blocks: Block[], blockId: string): string[] | null {
  const parentId = findParentId(blocks, blockId);
  if (parentId === undefined) return null;
  const siblings = parentId === null
    ? blocks
    : blocks.find(b => b.id === parentId)?.children ?? null;
  if (!siblings) return null;
  return siblings.map(b => b.id);
}

export function selectRange(
  anchorId: string | null,
  targetId: string,
  orderedIds: string[],
): Set<string> {
  if (!anchorId || !orderedIds.includes(anchorId) || !orderedIds.includes(targetId)) {
    return selectSingle(targetId);
  }
  const a = orderedIds.indexOf(anchorId);
  const b = orderedIds.indexOf(targetId);
  const [start, end] = a <= b ? [a, b] : [b, a];
  return new Set(orderedIds.slice(start, end + 1));
}

export function applyPointerSelection(
  blocks: Block[],
  current: Set<string>,
  anchorId: string | null,
  targetId: string,
  opts: { shiftKey: boolean; additiveKey: boolean },
): { selected: Set<string>; anchorId: string } {
  if (opts.shiftKey) {
    const ordered = getDocumentOrderedIds(blocks);
    if (!anchorId || !ordered.includes(anchorId) || !ordered.includes(targetId)) {
      return { selected: selectSingle(targetId), anchorId: targetId };
    }
    return {
      selected: selectRange(anchorId, targetId, ordered),
      anchorId: anchorId,
    };
  }
  if (opts.additiveKey) {
    const next = toggleInSelection(current, targetId);
    return { selected: next.size > 0 ? next : selectSingle(targetId), anchorId: anchorId ?? targetId };
  }
  return { selected: selectSingle(targetId), anchorId: targetId };
}

/** Shift+Arrow — extend selection to adjacent block in document order. */
export function extendSelectionByArrow(
  blocks: Block[],
  anchorId: string | null,
  focusId: string,
  direction: 'up' | 'down',
): { selected: Set<string>; anchorId: string } | null {
  const ordered = getDocumentOrderedIds(blocks);
  const idx = ordered.indexOf(focusId);
  if (idx < 0) return null;
  const nextIdx = direction === 'up' ? idx - 1 : idx + 1;
  if (nextIdx < 0 || nextIdx >= ordered.length) return null;
  const targetId = ordered[nextIdx]!;
  const anchor = anchorId && ordered.includes(anchorId) ? anchorId : focusId;
  return { selected: selectRange(anchor, targetId, ordered), anchorId: anchor };
}
