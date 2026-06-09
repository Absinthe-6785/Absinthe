/**
 * pasteOrchestrator.ts — Clipboard → Block[] (UX-2A)
 *
 * Rule: when text/html exists → try HTML first → on failure fall back to text/plain.
 */
import { markdownToBlocks, type Block } from '../../../../../blockUtils';
import { validateDocument } from '../../../../../documentRecovery';
import { assertValidBlockTree } from '../../../validation/assertValidBlockTree';
import { htmlDocumentToBlocks, htmlHasBlockStructure } from './htmlDocumentToBlocks';
import {
  looksLikeTsv,
  normalizePasteText,
  tsvToMarkdownTable,
} from './pasteStructure';
import { isSingleLineMarkdownBlock, parseSingleLineMarkdown } from './singleLineMarkdown';

function blocksFromPlain(plain: string): Block[] | null {
  const normalized = normalizePasteText(plain);
  if (!normalized) return null;

  if (looksLikeTsv(normalized)) {
    const tableMd = tsvToMarkdownTable(normalized);
    if (tableMd) {
      const blocks = markdownToBlocks(tableMd);
      return blocks.length > 0 ? blocks : null;
    }
  }

  if (!normalized.includes('\n')) {
    return parseSingleLineMarkdown(normalized);
  }

  const blocks = markdownToBlocks(normalized);
  return blocks.length > 0 ? blocks : null;
}

/**
 * Parse clipboard into blocks for document-level paste.
 * Returns null → caller should use inline / single-line paste path.
 */
export function clipboardToBlocks(
  clipboard: Pick<DataTransfer, 'getData'>,
): Block[] | null {
  const html = clipboard.getData('text/html')?.trim() ?? '';
  const plain = clipboard.getData('text/plain')?.trim() ?? '';

  // HTML first when present (AI providers ship rich html + degraded plain)
  if (html) {
    if (htmlHasBlockStructure(html)) {
      const fromHtml = htmlDocumentToBlocks(html);
      if (fromHtml && fromHtml.length > 0) {
        const blocks = validateDocument(fromHtml);
        assertValidBlockTree(blocks, 'clipboardToBlocks');
        return blocks;
      }
    }
    // HTML failed or no structure → fall through to plain
  }

  if (plain) {
    const fromPlain = blocksFromPlain(plain);
    if (fromPlain) {
      const blocks = validateDocument(fromPlain);
      assertValidBlockTree(blocks, 'clipboardToBlocks');
      return blocks;
    }
  }

  return null;
}

/** Whether paste should use block splice (vs inline merge). */
export function isDocumentLevelPaste(
  clipboard: Pick<DataTransfer, 'getData'>,
  blocks: Block[] | null,
): blocks is Block[] {
  if (!blocks || blocks.length === 0) return false;
  if (blocks.length > 1) return true;
  const html = clipboard.getData('text/html')?.trim() ?? '';
  const plain = clipboard.getData('text/plain') ?? '';
  if (html && htmlHasBlockStructure(html)) return true;
  if (plain.includes('\n')) return true;
  if (isSingleLineMarkdownBlock(plain.trim())) return true;
  return false;
}
