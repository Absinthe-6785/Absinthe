/**
 * Block-scoped content operations — plain block.content only, no document-wide offsets.
 */
import { splitMarkdownAt, toggleMarkdownWrap } from './inlineFormat';
import { makeBlock, updateBlockById, type Block, type BlockType } from './blockUtils';

export function insertNewlineInBlock(content: string, offset: number): { content: string; caret: number } {
  const caret = Math.max(0, Math.min(offset, content.length));
  return {
    content: content.slice(0, caret) + '\n' + content.slice(caret),
    caret: caret + 1,
  };
}

export function splitBlockContent(content: string, offset: number): { before: string; after: string } {
  return splitMarkdownAt(content, offset);
}

export function applyInlineFormatToBlock(
  content: string,
  start: number,
  end: number,
  before: string,
  after: string,
) {
  return toggleMarkdownWrap(content, start, end, before, after);
}

/** Update only one block's content; other blocks unchanged. */
export function applyFormatToBlock(
  blocks: Block[],
  blockId: string,
  start: number,
  end: number,
  before: string,
  after: string,
): Block[] {
  const target = blocks.find(b => b.id === blockId);
  if (!target) return blocks;
  const result = toggleMarkdownWrap(target.content, start, end, before, after);
  return updateBlockById(blocks, blockId, b => ({ ...b, content: result.text }));
}

/** Enter split — only the active block is split; neighbors are untouched. */
export function splitBlocksAt(
  blocks: Block[],
  blockId: string,
  offset: number,
): { blocks: Block[]; newBlockId: string | null } {
  const idx = blocks.findIndex(b => b.id === blockId);
  if (idx < 0) return { blocks, newBlockId: null };

  const cur = blocks[idx];
  const { before, after } = splitBlockContent(cur.content, offset);
  const newType: BlockType = ['heading1', 'heading2', 'heading3'].includes(cur.type)
    ? 'paragraph'
    : cur.type;
  const newBlock = makeBlock(newType, {
    content: after,
    indent: cur.indent,
    checked: false,
  });

  const next = [...blocks];
  next[idx] = { ...cur, content: before };
  next.splice(idx + 1, 0, newBlock);
  return { blocks: next, newBlockId: newBlock.id };
}
