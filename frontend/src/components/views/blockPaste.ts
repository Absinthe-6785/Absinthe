import { splitBlockContent } from './blockContent';
import { isListType, renumberNumberedListsDeep } from './listBlocks';
import {
  htmlToPlainText,
  normalizePasteText,
  prepareStructuredPasteText,
} from './pasteStructure';
import { makeBlock, markdownToBlocks, updateBlockById, type Block, type BlockType } from './blockUtils';
import { clipboardToBlocks, isDocumentLevelPaste } from './pasteOrchestrator';

export { normalizePasteText, htmlToPlainText } from './pasteStructure';
export { clipboardToBlocks, isDocumentLevelPaste } from './pasteOrchestrator';

const BARE_URL_RE = /^https?:\/\/\S+$/i;

export function isBareUrl(text: string): boolean {
  return BARE_URL_RE.test(text.trim());
}

/** Prefer structured plain/HTML (tables, articles); fall back to stripped HTML. */
export function extractClipboardText(clipboard: Pick<DataTransfer, 'getData'>): string {
  const structured = prepareStructuredPasteText(clipboard);
  if (structured) return structured;
  const html = clipboard.getData('text/html');
  if (html) return htmlToPlainText(html);
  return '';
}

export interface PasteContext {
  blockType: BlockType;
  indent?: number;
}

/** When pasting plain lines into a list item, inherit list type + indent. */
export function adaptPastedBlocks(blocks: Block[], context: PasteContext): Block[] {
  if (!isListType(context.blockType)) return blocks;
  const indent = context.indent ?? 0;
  const structured = blocks.some(b =>
    b.type !== 'paragraph'
    || /^#{1,3}\s/.test(b.content)
    || /^>!?\s/.test(b.content)
    || /^```/.test(b.content),
  );
  if (structured) return blocks;
  return blocks.map(b => makeBlock(context.blockType, {
    content: b.content,
    indent,
    checked: false,
  }));
}

export function smartInlineMerge(
  before: string,
  selected: string,
  pasted: string,
  after: string,
): { content: string; focusOffset: number } {
  const trimmed = pasted.trim();
  if (selected && isBareUrl(trimmed)) {
    const link = `[${selected}](${trimmed})`;
    const content = before + link + after;
    return { content, focusOffset: before.length + link.length };
  }
  const content = before + pasted + after;
  return { content, focusOffset: before.length + pasted.length };
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
  context?: PasteContext,
): PasteResult | null {
  const pasted = normalizePasteText(raw);
  if (!pasted) return null;

  const idx = blocks.findIndex(b => b.id === blockId);
  if (idx < 0) return null;
  const cur = blocks[idx];
  const before = cur.content.slice(0, start);
  const after = cur.content.slice(end);
  const selected = cur.content.slice(start, end);

  if (!pasted.includes('\n')) {
    const { content, focusOffset } = smartInlineMerge(before, selected, pasted, after);
    const next = updateBlockById(blocks, blockId, b => ({ ...b, content }));
    return {
      blocks: next,
      focusBlockId: blockId,
      focusOffset,
    };
  }

  let pastedBlocks = markdownToBlocks(pasted);
  if (pastedBlocks.length === 0) return null;
  if (context) pastedBlocks = adaptPastedBlocks(pastedBlocks, context);

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
    blocks: renumberNumberedListsDeep(next),
    focusBlockId,
    focusOffset,
  };
}

/** Insert pre-parsed blocks at a block offset (UX-2A HTML / document paste). */
export function applyPasteBlocksAt(
  blocks: Block[],
  blockId: string,
  start: number,
  end: number,
  pastedBlocksIn: Block[],
  context?: PasteContext,
): PasteResult | null {
  if (pastedBlocksIn.length === 0) return null;

  const idx = blocks.findIndex(b => b.id === blockId);
  if (idx < 0) return null;
  const cur = blocks[idx];
  const before = cur.content.slice(0, start);
  const after = cur.content.slice(end);

  let pastedBlocks = pastedBlocksIn.map(b => ({ ...b }));
  if (context) pastedBlocks = adaptPastedBlocks(pastedBlocks, context);

  let replacement: Block[];
  let focusBlockId: string;
  let focusOffset: number;

  if (pastedBlocks.length === 1) {
    const pb = pastedBlocks[0];
    const content = before + (pb.content ?? '') + after;
    replacement = [{ ...pb, id: cur.id, content }];
    focusBlockId = cur.id;
    focusOffset = before.length + (pb.content ?? '').length;
  } else {
    const last = pastedBlocks[pastedBlocks.length - 1];
    replacement = [
      { ...pastedBlocks[0], id: cur.id, content: before + (pastedBlocks[0].content ?? '') },
      ...pastedBlocks.slice(1, -1),
      { ...last, content: (last.content ?? '') + after },
    ];
    focusBlockId = last.id;
    focusOffset = (last.content ?? '').length;
  }

  const next = [
    ...blocks.slice(0, idx),
    ...replacement,
    ...blocks.slice(idx + 1),
  ];

  return {
    blocks: renumberNumberedListsDeep(next),
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
