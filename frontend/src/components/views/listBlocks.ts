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

/** Renumber numbered items per indent — bullets/todos do not reset (Notion-style). */
export function renumberNumberedLists(blocks: Block[]): Block[] {
  const result = blocks.map(b => ({ ...b }));
  const counters = new Map<number, number>();

  for (let i = 0; i < result.length; i++) {
    const block = result[i];
    if (block.type === 'numbered') {
      const indent = block.indent ?? 0;
      const next = (counters.get(indent) ?? 0) + 1;
      counters.set(indent, next);
      result[i] = { ...block, listIndex: next };
    } else if (!isListType(block.type)) {
      counters.clear();
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

/** Renumber numbered lists at every nesting level in the tree. */
export function renumberNumberedListsDeep(blocks: Block[]): Block[] {
  return renumberNumberedLists(blocks).map(b =>
  b.children.length > 0
    ? { ...b, children: renumberNumberedListsDeep(b.children) }
    : b,
  );
}
