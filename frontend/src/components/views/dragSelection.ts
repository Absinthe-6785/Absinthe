/**
 * dragSelection.ts — Multi-block drag selection helpers (UX-4B.1, K-83)
 */
import { isDescendantOf } from './blockTree';
import { findBlockById, flattenBlockIds, type Block } from './blockUtils';
import { isToggleBlockType } from './toggleBlockTypes';

/**
 * When a toggle header is selected, include all descendants so partial document-order
 * ranges (header + some children) operate on the full toggle subtree.
 */
export function expandToggleHeadersInSelection(blocks: Block[], selectedIds: Iterable<string>): string[] {
  const selected = new Set(selectedIds);
  const expanded = new Set(selected);
  for (const id of selected) {
    const block = findBlockById(blocks, id);
    if (block && isToggleBlockType(block.type)) {
      for (const descId of flattenBlockIds(block.children)) expanded.add(descId);
    }
  }
  return flattenBlockIds(blocks).filter(id => expanded.has(id));
}

/**
 * When multiple blocks are selected, drop any id whose ancestor is also selected.
 * Prevents silent no-op when e.g. toggle + child are both selected.
 */
export function minimalDragIds(blocks: Block[], selectedIds: string[]): string[] {
  const selected = new Set(selectedIds);
  const ordered = flattenBlockIds(blocks).filter(id => selected.has(id));
  return ordered.filter(id =>
    !ordered.some(other => other !== id && isDescendantOf(blocks, other, id)),
  );
}

/** Normalize selection for delete / duplicate / copy — expand toggles, dedupe ancestors. */
export function normalizedOpIds(blocks: Block[], selectedIds: Iterable<string>): string[] {
  return minimalDragIds(blocks, expandToggleHeadersInSelection(blocks, selectedIds));
}
