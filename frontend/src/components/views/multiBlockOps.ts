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
import { normalizedOpIds } from './dragSelection';

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
