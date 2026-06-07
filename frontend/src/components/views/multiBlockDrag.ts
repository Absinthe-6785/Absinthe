/**
 * multiBlockDrag.ts — Move multiple blocks as a group (incl. into toggle)
 */
import {
  extractBlockFromTree,
  findParentId,
  insertIntoToggleChildren,
  isDescendantOf,
} from './blockTree';
import { findBlockById, flattenBlockIds, updateBlockById, type Block } from './blockUtils';

function insertSiblingsRelative(
  blocks: Block[],
  overId: string,
  toInsert: Block[],
  position: 'before' | 'after',
): Block[] | null {
  if (!toInsert.length) return null;
  const parentId = findParentId(blocks, overId);
  if (parentId === undefined) return null;

  if (parentId === null) {
    const idx = blocks.findIndex(b => b.id === overId);
    if (idx < 0) return null;
    const at = position === 'before' ? idx : idx + 1;
    const next = [...blocks];
    next.splice(at, 0, ...toInsert);
    return next;
  }

  const parent = findBlockById(blocks, parentId);
  if (!parent) return null;
  const idx = parent.children.findIndex(b => b.id === overId);
  if (idx < 0) return null;
  const at = position === 'before' ? idx : idx + 1;
  const children = [...parent.children];
  children.splice(at, 0, ...toInsert);
  return updateBlockById(blocks, parentId, p => ({ ...p, children }));
}

export function applyMultiBlockDragDrop(
  root: Block[],
  dragIds: string[],
  overId: string,
  position: 'before' | 'after' | 'inside',
): Block[] | null {
  if (!dragIds.length || !overId) return null;

  const ordered = flattenBlockIds(root).filter(id => dragIds.includes(id));
  if (!ordered.length) return null;

  const dragSet = new Set(ordered);
  if (dragSet.has(overId)) return null;

  for (const id of ordered) {
    if (isDescendantOf(root, id, overId)) return null;
  }

  let tree = root;
  const extracted: Block[] = [];
  for (const id of ordered) {
    const { tree: nextTree, block } = extractBlockFromTree(tree, id);
    if (!block) return null;
    tree = nextTree;
    extracted.push(block);
  }

  if (position === 'inside') {
    const target = findBlockById(tree, overId);
    if (!target || target.type !== 'toggle') return null;
    let result = tree;
    for (const block of extracted) {
      if (findBlockById([block], overId)) return null;
      result = insertIntoToggleChildren(result, overId, block);
    }
    return result;
  }

  return insertSiblingsRelative(tree, overId, extracted, position);
}
