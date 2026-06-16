/**
 * multiBlockOps.ts — Delete / duplicate multiple blocks
 */
import {
  cloneBlockTree,
  deleteBlockById,
  findBlockById,
  flattenBlockIds,
  insertBlockAfter,
  isTextBlockType,
  makeBlock,
  type Block,
} from './blockUtils';
import { isToggleBlockType } from './toggleBlockTypes';
import { minimalDragIds, normalizedOpIds } from './dragSelection';
import { indentBlock, outdentBlock } from './blockTree';

export type BlockFocusOffset = 'start' | 'end' | number;

function focusOffsetAfterDelete(block: Block): BlockFocusOffset {
  if (isTextBlockType(block.type) || isToggleBlockType(block.type)) {
    return block.content.length;
  }
  return 'end';
}

/** Nearest editable block to focus after deleting one or more blocks. */
export function resolveFocusAfterBlockDelete(
  blocksBefore: Block[],
  deletedIds: Iterable<string>,
  blocksAfter: Block[],
): { blockId: string; offset: BlockFocusOffset } | null {
  const deleted = new Set(deletedIds);
  const flatBefore = flattenBlockIds(blocksBefore);
  const flatAfter = flattenBlockIds(blocksAfter);
  if (flatAfter.length === 0) return null;

  const firstDeletedIdx = flatBefore.findIndex(id => deleted.has(id));
  if (firstDeletedIdx < 0) return null;

  for (let i = firstDeletedIdx - 1; i >= 0; i--) {
    const id = flatBefore[i];
    if (deleted.has(id)) continue;
    const block = findBlockById(blocksAfter, id);
    if (block) {
      return { blockId: id, offset: focusOffsetAfterDelete(block) };
    }
  }

  const firstId = flatAfter[0];
  return { blockId: firstId, offset: 'start' };
}

function orderedIds(blocks: Block[], ids: Iterable<string>): string[] {
  return normalizedOpIds(blocks, ids);
}

export function deleteSelectedBlocks(blocks: Block[], ids: Iterable<string>): Block[] {
  const toDelete = orderedIds(blocks, ids);
  if (!toDelete.length) return blocks;
  let next = blocks;
  for (let i = toDelete.length - 1; i >= 0; i--) {
    next = deleteBlockById(next, toDelete[i]);
  }
  return next.length > 0 ? next : [makeBlock('paragraph')];
}

/** Tab on multiple blocks — indent each in document order (K-90). */
export function indentSelectedBlocks(blocks: Block[], ids: Iterable<string>): Block[] | null {
  const toIndent = minimalDragIds(blocks, [...ids]);
  if (!toIndent.length) return null;
  let tree = blocks;
  let changed = false;
  for (const id of toIndent) {
    const next = indentBlock(tree, id);
    if (next) {
      tree = next;
      changed = true;
    }
  }
  return changed ? tree : null;
}

/** Shift+Tab on multiple blocks — outdent in reverse document order (K-90). */
export function outdentSelectedBlocks(blocks: Block[], ids: Iterable<string>): Block[] | null {
  const toOutdent = minimalDragIds(blocks, [...ids]);
  if (!toOutdent.length) return null;
  let tree = blocks;
  let changed = false;
  for (const id of [...toOutdent].reverse()) {
    const next = outdentBlock(tree, id);
    if (next) {
      tree = next;
      changed = true;
    }
  }
  return changed ? tree : null;
}

export function duplicateSelectedBlocks(blocks: Block[], ids: Iterable<string>): Block[] {
  const toCopy = orderedIds(blocks, ids);
  if (!toCopy.length) return blocks;
  let next = blocks;
  const lastOriginalId = toCopy[toCopy.length - 1];
  let anchorId = lastOriginalId;
  for (const id of toCopy) {
    const block = findBlockById(next, id);
    if (!block) continue;
    const copy = cloneBlockTree(block);
    next = insertBlockAfter(next, anchorId, copy);
    anchorId = copy.id;
  }
  return next;
}
