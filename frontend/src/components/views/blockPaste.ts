import { splitBlockContent } from './blockContent';
import { renumberNumberedLists } from './listBlocks';
import { makeBlock, markdownToBlocks, updateBlockById, type Block } from './blockUtils';

export function normalizePasteText(raw: string): string {
  return raw
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\u00a0/g, ' ')
    .replace(/\n+$/, '');
}

export interface PasteResult {
  blocks: Block[];
  focusBlockId: string;
  focusOffset: number;
}

/**
 * Insert clipboard plain text at a block offset, splitting into multiple blocks when needed.
 */
export function applyPasteAtBlock(
  blocks: Block[],
  blockId: string,
  start: number,
  end: number,
  raw: string,
): PasteResult | null {
  const pasted = normalizePasteText(raw);
  if (!pasted) return null;

  const idx = blocks.findIndex(b => b.id === blockId);
  if (idx < 0) return null;
  const cur = blocks[idx];
  const before = cur.content.slice(0, start);
  const after = cur.content.slice(end);

  if (!pasted.includes('\n')) {
    const content = before + pasted + after;
    const next = updateBlockById(blocks, blockId, b => ({ ...b, content }));
    return {
      blocks: next,
      focusBlockId: blockId,
      focusOffset: start + pasted.length,
    };
  }

  const pastedBlocks = markdownToBlocks(pasted);
  if (pastedBlocks.length === 0) return null;

  let replacement: Block[];
  let focusBlockId: string;
  let focusOffset: number;

  if (pastedBlocks.length === 1) {
    const content = before + pastedBlocks[0].content + after;
    replacement = [{ ...cur, ...pastedBlocks[0], id: cur.id, content }];
    focusBlockId = cur.id;
    focusOffset = before.length + pastedBlocks[0].content.length;
  } else {
    const last = pastedBlocks[pastedBlocks.length - 1];
    replacement = [
      { ...pastedBlocks[0], id: cur.id, content: before + pastedBlocks[0].content },
      ...pastedBlocks.slice(1, -1),
      { ...last, content: last.content + after },
    ];
    focusBlockId = last.id;
    focusOffset = last.content.length;
  }

  const next = [
    ...blocks.slice(0, idx),
    ...replacement,
    ...blocks.slice(idx + 1),
  ];

  return {
    blocks: renumberNumberedLists(next),
    focusBlockId,
    focusOffset,
  };
}

/** @internal for tests — split at caret then merge pasted markdown blocks */
export function pasteMarkdownIntoContent(
  content: string,
  offset: number,
  raw: string,
): { blocks: Block[]; focusOffset: number } {
  const { before, after } = splitBlockContent(content, offset);
  const pasted = normalizePasteText(raw);
  const parsed = markdownToBlocks(pasted);
  if (parsed.length === 0) {
    return { blocks: [makeBlock('paragraph', { content })], focusOffset: offset };
  }
  if (parsed.length === 1) {
    const merged = before + parsed[0].content + after;
    return { blocks: [makeBlock('paragraph', { content: merged })], focusOffset: before.length + parsed[0].content.length };
  }
  const head = makeBlock(parsed[0].type, { ...parsed[0], content: before + parsed[0].content });
  const tail = makeBlock(parsed[parsed.length - 1].type, {
    ...parsed[parsed.length - 1],
    content: parsed[parsed.length - 1].content + after,
  });
  return {
    blocks: [head, ...parsed.slice(1, -1), tail],
    focusOffset: parsed[parsed.length - 1].content.length,
  };
}
