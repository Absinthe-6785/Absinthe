/**
 * listIndent.ts — Tab / Shift+Tab list hierarchy via block.indent
 */
import { findBlockById, updateBlockById, type Block } from './blockUtils';
import { isListType, renumberNumberedListsDeep } from './listBlocks';

export function indentListBlock(blocks: Block[], blockId: string): Block[] | null {
  const block = findBlockById(blocks, blockId);
  if (!block || !isListType(block.type)) return null;
  const next = updateBlockById(blocks, blockId, b => ({
    ...b,
    indent: (b.indent ?? 0) + 1,
  }));
  return renumberNumberedListsDeep(next);
}

export function outdentListBlock(blocks: Block[], blockId: string): Block[] | null {
  const block = findBlockById(blocks, blockId);
  if (!block || !isListType(block.type)) return null;
  if ((block.indent ?? 0) <= 0) return null;
  const next = updateBlockById(blocks, blockId, b => ({
    ...b,
    indent: Math.max(0, (b.indent ?? 0) - 1),
  }));
  return renumberNumberedListsDeep(next);
}
