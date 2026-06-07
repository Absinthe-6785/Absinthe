/**
 * Block tree moves — indent/outdent, nest in toggle, drag nest.
 */
import {
  findBlockById,
  insertBlockAfter,
  updateBlockById,
  convertBlock,
  type Block,
  type BlockType,
} from './blockUtils';

const LIST_TYPES: BlockType[] = ['bullet', 'numbered', 'todo'];

export function isListBlockType(type: BlockType): boolean {
  return LIST_TYPES.includes(type);
}

export function isNestableInToggle(type: BlockType): boolean {
  return type !== 'image' && type !== 'divider' && type !== 'table';
}

/** Remove a block anywhere in the tree. */
export function extractBlockFromTree(
  blocks: Block[],
  id: string,
): { tree: Block[]; block: Block | null } {
  const idx = blocks.findIndex(b => b.id === id);
  if (idx >= 0) {
    return {
      tree: [...blocks.slice(0, idx), ...blocks.slice(idx + 1)],
      block: blocks[idx],
    };
  }
  let extracted: Block | null = null;
  const tree = blocks.map(b => {
    if (!b.children.length || extracted) return b;
    const { tree: childTree, block } = extractBlockFromTree(b.children, id);
    if (block) {
      extracted = block;
      return { ...b, children: childTree };
    }
    return b;
  });
  return { tree, block: extracted };
}

export function findParentId(
  blocks: Block[],
  childId: string,
  parentId: string | null = null,
): string | null | undefined {
  for (const b of blocks) {
    if (b.id === childId) return parentId;
    if (b.children.length > 0) {
      const found = findParentId(b.children, childId, b.id);
      if (found !== undefined) return found;
    }
  }
  return undefined;
}

function isDescendantOf(blocks: Block[], ancestorId: string, descendantId: string): boolean {
  const ancestor = findBlockById(blocks, ancestorId);
  if (!ancestor) return false;
  return findBlockById([ancestor], descendantId) !== null && ancestorId !== descendantId;
}

/** Append block to toggle children (opens toggle). */
export function insertIntoToggleChildren(
  blocks: Block[],
  toggleId: string,
  block: Block,
): Block[] {
  return updateBlockById(blocks, toggleId, t => ({
    ...t,
    collapsed: false,
    children: [...t.children, block],
  }));
}

/** Move block into toggle's children (same tree). */
export function moveBlockIntoToggle(
  blocks: Block[],
  blockId: string,
  toggleId: string,
): Block[] | null {
  if (blockId === toggleId) return null;
  const toggle = findBlockById(blocks, toggleId);
  if (!toggle || toggle.type !== 'toggle') return null;
  if (isDescendantOf(blocks, blockId, toggleId)) return null;

  const { tree, block } = extractBlockFromTree(blocks, blockId);
  if (!block || !isNestableInToggle(block.type)) return null;
  return insertIntoToggleChildren(tree, toggleId, block);
}

/** Move block out of parent toggle to after the toggle. */
export function moveBlockOutOfToggle(blocks: Block[], blockId: string): Block[] | null {
  const parentId = findParentId(blocks, blockId);
  if (parentId === undefined || parentId === null) return null;
  const parent = findBlockById(blocks, parentId);
  if (!parent || parent.type !== 'toggle') return null;

  const { tree, block } = extractBlockFromTree(blocks, blockId);
  if (!block) return null;
  return insertBlockAfter(tree, parentId, block);
}

/** Prepare previous sibling to accept a nested child (convert to toggle if needed). */
function ensureParentToggle(blocks: Block[], parentId: string): Block[] {
  const parent = findBlockById(blocks, parentId);
  if (!parent) return blocks;
  if (parent.type === 'toggle') {
    return updateBlockById(blocks, parentId, t => ({ ...t, collapsed: false }));
  }
  if (!isNestableInToggle(parent.type)) return blocks;
  return updateBlockById(blocks, parentId, b => ({
    ...convertBlock(b, 'toggle'),
    collapsed: false,
    children: b.children ?? [],
  }));
}

/** Tab: nest under previous sibling (outliner style), or increase list indent. */
export function indentBlock(blocks: Block[], blockId: string): Block[] | null {
  const parentId = findParentId(blocks, blockId);
  const siblings = parentId === null || parentId === undefined
    ? blocks
    : findBlockById(blocks, parentId)?.children ?? null;
  if (!siblings) return null;

  const idx = siblings.findIndex(b => b.id === blockId);
  if (idx < 0) return null;

  const cur = siblings[idx];

  if (idx > 0) {
    const prev = siblings[idx - 1];
    if (isNestableInToggle(cur.type) && (prev.type === 'toggle' || isNestableInToggle(prev.type))) {
      const prepared = ensureParentToggle(blocks, prev.id);
      return moveBlockIntoToggle(prepared, blockId, prev.id);
    }
  }

  if (isListBlockType(cur.type)) {
    return updateBlockById(blocks, blockId, b => ({ ...b, indent: (b.indent ?? 0) + 1 }));
  }
  return null;
}

/** Shift+Tab: exit toggle or decrease list indent. */
export function outdentBlock(blocks: Block[], blockId: string): Block[] | null {
  const parentId = findParentId(blocks, blockId);
  if (parentId === undefined) return null;

  if (parentId !== null) {
    const parent = findBlockById(blocks, parentId);
    if (parent?.type === 'toggle') {
      return moveBlockOutOfToggle(blocks, blockId);
    }
  }

  const block = findBlockById(blocks, blockId);
  if (block && isListBlockType(block.type) && (block.indent ?? 0) > 0) {
    return updateBlockById(blocks, blockId, b => ({ ...b, indent: Math.max(0, (b.indent ?? 0) - 1) }));
  }
  return null;
}

/** Reorder sibling or nest into toggle when dropping inside. */
export function applyDragDrop(
  blocks: Block[],
  dragId: string,
  overId: string,
  position: 'before' | 'after' | 'inside',
): Block[] | null {
  if (dragId === overId) return null;

  if (position === 'inside') {
    return moveBlockIntoToggle(blocks, dragId, overId);
  }

  const { tree, block } = extractBlockFromTree(blocks, dragId);
  if (!block) return null;

  const flat = tree;
  const toIdx = flat.findIndex(b => b.id === overId);
  if (toIdx < 0) {
    // search in nested for overId at same level only - drag is per-level
    return null;
  }

  const insertAt = position === 'before' ? toIdx : toIdx + 1;
  const next = [...flat];
  next.splice(insertAt, 0, block);
  return next;
}
