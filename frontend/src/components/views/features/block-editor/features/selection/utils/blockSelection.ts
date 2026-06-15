/**
 * blockSelection.ts — Pure multi-block selection helpers (same-parent range)
 */
import type { Block } from '../../../../../blockUtils';
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

/** Ordered sibling ids under the same parent as blockId */
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
  orderedSiblingIds: string[],
): Set<string> {
  if (!anchorId || !orderedSiblingIds.includes(anchorId) || !orderedSiblingIds.includes(targetId)) {
    return selectSingle(targetId);
  }
  const a = orderedSiblingIds.indexOf(anchorId);
  const b = orderedSiblingIds.indexOf(targetId);
  const [start, end] = a <= b ? [a, b] : [b, a];
  return new Set(orderedSiblingIds.slice(start, end + 1));
}

export function applyPointerSelection(
  blocks: Block[],
  current: Set<string>,
  anchorId: string | null,
  targetId: string,
  opts: { shiftKey: boolean; additiveKey: boolean },
): { selected: Set<string>; anchorId: string } {
  if (opts.shiftKey) {
    const siblings = getSiblingOrderedIds(blocks, targetId);
    if (!anchorId || !siblings || !haveSameParent(blocks, anchorId, targetId)) {
      return { selected: selectSingle(targetId), anchorId: targetId };
    }
    return {
      selected: selectRange(anchorId, targetId, siblings),
      anchorId: anchorId,
    };
  }
  if (opts.additiveKey) {
    const next = toggleInSelection(current, targetId);
    return { selected: next.size > 0 ? next : selectSingle(targetId), anchorId: anchorId ?? targetId };
  }
  return { selected: selectSingle(targetId), anchorId: targetId };
}

/** Shift+Arrow — extend same-parent block selection to adjacent sibling. */
export function extendSelectionByArrow(
  blocks: Block[],
  anchorId: string | null,
  focusId: string,
  direction: 'up' | 'down',
): { selected: Set<string>; anchorId: string } | null {
  const siblings = getSiblingOrderedIds(blocks, focusId);
  if (!siblings) return null;
  const idx = siblings.indexOf(focusId);
  if (idx < 0) return null;
  const nextIdx = direction === 'up' ? idx - 1 : idx + 1;
  if (nextIdx < 0 || nextIdx >= siblings.length) return null;
  const targetId = siblings[nextIdx]!;
  const anchor = anchorId && siblings.includes(anchorId) ? anchorId : focusId;
  return { selected: selectRange(anchor, targetId, siblings), anchorId: anchor };
}
