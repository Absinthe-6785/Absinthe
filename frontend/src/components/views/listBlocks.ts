import { makeBlock, updateBlockById, type Block, type BlockType } from './blockUtils';

export const LIST_BLOCK_TYPES: BlockType[] = ['bullet', 'numbered', 'todo'];

export function isListType(type: BlockType): boolean {
  return LIST_BLOCK_TYPES.includes(type);
}

/** Empty list item + Enter → exit to paragraph (Notion-style). */
export function exitEmptyListBlock(blocks: Block[], blockId: string): Block[] {
  return renumberNumberedLists(
    updateBlockById(blocks, blockId, b => ({
      ...b,
      type: 'paragraph' as const,
      indent: 0,
      checked: undefined,
      listIndex: undefined,
    })),
  );
}

/** Props for a new list sibling created by Enter split. */
export function listSplitExtras(cur: Block, newType: BlockType): Partial<Block> {
  const base: Partial<Block> = {
    indent: cur.indent ?? 0,
    checked: false,
  };
  if (newType === 'numbered') {
    return { ...base, listIndex: (cur.listIndex ?? 1) + 1 };
  }
  return base;
}

/** Renumber consecutive numbered items per indent level. */
export function renumberNumberedLists(blocks: Block[]): Block[] {
  const result = blocks.map(b => ({ ...b }));
  let i = 0;
  while (i < result.length) {
    if (result[i].type !== 'numbered') {
      i++;
      continue;
    }
    const indent = result[i].indent ?? 0;
    let num = 1;
    while (
      i < result.length
      && result[i].type === 'numbered'
      && (result[i].indent ?? 0) === indent
    ) {
      result[i] = { ...result[i], listIndex: num++ };
      i++;
    }
  }
  return result;
}

/** Display index for a numbered list marker. */
export function numberedMarker(block: Block, fallback = 1): number {
  return block.listIndex ?? fallback;
}

const LIST_INDENT_PX = 24;
const DEPTH_INDENT_PX = 20;

/** Horizontal offset for list indent + nested editor depth. */
export function blockLayoutIndentPx(block: Block, depth: number): number {
  const depthPx = depth > 0 ? depth * DEPTH_INDENT_PX : 0;
  const listPx = isListType(block.type) ? (block.indent ?? 0) * LIST_INDENT_PX : 0;
  return depthPx + listPx;
}
