import type { Block, BlockType } from '../../../blockUtils';
import { HEADING_BLOCK_TYPES } from '../constants/blockEditorConstants';

export function insertBlockAtIndex(blocks: Block[], index: number, block: Block): Block[] {
  const next = [...blocks];
  next.splice(index, 0, block);
  return next;
}

export function moveBlockInList(
  blocks: Block[],
  id: string,
  dir: 'up' | 'down',
): Block[] | null {
  const idx = blocks.findIndex(b => b.id === id);
  if (idx < 0) return null;
  const newIdx = dir === 'up' ? idx - 1 : idx + 1;
  if (newIdx < 0 || newIdx >= blocks.length) return null;
  const next = [...blocks];
  [next[idx], next[newIdx]] = [next[newIdx], next[idx]];
  return next;
}

export function enterSplitBlockType(currentType: BlockType): BlockType {
  return HEADING_BLOCK_TYPES.includes(currentType) ? 'paragraph' : currentType;
}

export function applySlashMenuTypeChange(block: Block, type: BlockType, query: string): Block {
  const slashIdx = block.content.lastIndexOf('/' + query);
  const cleaned = slashIdx >= 0
    ? block.content.slice(0, slashIdx) + block.content.slice(slashIdx + 1 + query.length)
    : block.content;
  if (type === 'math') {
    return { ...block, type, content: '', math: block.math || cleaned, mathBlock: (block.math || cleaned).includes('\n') };
  }
  if (type === 'code') {
    return { ...block, type, content: '', code: block.code || cleaned };
  }
  if (type === 'image') {
    return { ...block, type, content: '', src: '', alt: '', caption: undefined, width: undefined };
  }
  return { ...block, type, content: cleaned };
}

export function getPasteBlockContext(
  block: Block | null | undefined,
): { blockType: BlockType; indent: number } | undefined {
  return block ? { blockType: block.type, indent: block.indent } : undefined;
}
