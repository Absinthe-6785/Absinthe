/**
 * dragSelection.ts — Multi-block drag selection helpers (UX-4B.1)
 */
import { isDescendantOf } from './blockTree';
import { flattenBlockIds, type Block } from './blockUtils';

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
