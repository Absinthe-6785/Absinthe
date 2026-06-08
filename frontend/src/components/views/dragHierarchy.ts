/**
 * dragHierarchy.ts — Cross-level block drag-and-drop on the full tree
 */
import {
  extractBlockFromTree,
  findParentId,
  insertIntoToggleChildren,
  isDescendantOf,
  isNestableInToggle,
} from './blockTree';
import { findBlockById, updateBlockById, type Block } from './blockUtils';

function insertSiblingRelative(
  blocks: Block[],
  overId: string,
  block: Block,
  position: 'before' | 'after',
): Block[] | null {
  const parentId = findParentId(blocks, overId);
  if (parentId === undefined) return null;

  if (parentId === null) {
    const idx = blocks.findIndex(b => b.id === overId);
    if (idx < 0) return null;
    const at = position === 'before' ? idx : idx + 1;
    const next = [...blocks];
    next.splice(at, 0, block);
    return next;
  }

  const parent = findBlockById(blocks, parentId);
  if (!parent) return null;
  const idx = parent.children.findIndex(b => b.id === overId);
  if (idx < 0) return null;
  const at = position === 'before' ? idx : idx + 1;
  const children = [...parent.children];
  children.splice(at, 0, block);
  return updateBlockById(blocks, parentId, p => ({ ...p, children }));
}

/**
 * Move a block anywhere in the tree: before / after / inside (toggle).
 */
export function applyHierarchyDragDrop(
  root: Block[],
  dragId: string,
  overId: string,
  position: 'before' | 'after' | 'inside',
): Block[] | null {
  if (dragId === overId) return null;
  if (isDescendantOf(root, dragId, overId)) return null;

  const { tree, block } = extractBlockFromTree(root, dragId);
  if (!block) return null;

  if (findBlockById([block], overId)) return null;

  if (position === 'inside') {
    const target = findBlockById(tree, overId);
    if (!target || target.type !== 'toggle') return null;
    if (!isNestableInToggle(block.type)) return null;
    return insertIntoToggleChildren(tree, overId, block);
  }

  return insertSiblingRelative(tree, overId, block, position);
}
