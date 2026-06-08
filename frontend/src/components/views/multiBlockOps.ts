/**
 * multiBlockOps.ts — Delete / duplicate multiple blocks
 */
import {
  cloneBlockTree,
  deleteBlockById,
  findBlockById,
  flattenBlockIds,
  insertBlockAfter,
  makeBlock,
  type Block,
} from './blockUtils';

function orderedIds(blocks: Block[], ids: Iterable<string>): string[] {
  const want = new Set(ids);
  return flattenBlockIds(blocks).filter(id => want.has(id));
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
