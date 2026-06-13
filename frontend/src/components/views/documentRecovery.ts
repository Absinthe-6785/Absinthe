/**
 * documentRecovery.ts — Repair block trees on load (F-5E)
 */
import { genBlockId, makeBlock, type Block, type BlockType } from './blockUtils';
import { sanitizeBlockType } from './blockTypeGuards';
import { isToggleBlockType } from './toggleBlockTypes';
import { assertValidBlockTree } from './features/block-editor/validation/assertValidBlockTree';

function asString(val: unknown, fallback = ''): string {
  return typeof val === 'string' ? val : fallback;
}

function repairChildren(raw: unknown): Block[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(repairBlock).filter((b): b is Block => b !== null);
}

function tableFallbackContent(headers: unknown, rows: unknown, content: string): string {
  if (content.trim()) return content;
  if (!Array.isArray(headers) || headers.length === 0) return '';
  const headerLine = `| ${headers.map(h => String(h ?? '')).join(' | ')} |`;
  const divider = `| ${headers.map(() => '---').join(' | ')} |`;
  const body = Array.isArray(rows)
    ? rows
      .filter(Array.isArray)
      .map(row => `| ${(row as unknown[]).map(c => String(c ?? '')).join(' | ')} |`)
    : [];
  return [headerLine, divider, ...body].join('\n');
}

function repairTableFields(
  raw: Record<string, unknown>,
  id: string,
  content: string,
): Block {
  const headersRaw = raw.tableHeaders;
  if (!Array.isArray(headersRaw) || headersRaw.length === 0) {
    return makeBlock('paragraph', {
      id,
      content: tableFallbackContent(headersRaw, raw.tableRows, content) || 'Invalid table',
    });
  }
  const headers = headersRaw.map(h => String(h ?? ''));
  const colCount = headers.length;
  let rows: string[][] = [];
  if (Array.isArray(raw.tableRows)) {
    rows = raw.tableRows.map(row => {
      if (!Array.isArray(row)) return Array(colCount).fill('');
      const cells = row.map(c => String(c ?? ''));
      while (cells.length < colCount) cells.push('');
      return cells.slice(0, colCount);
    });
  }
  if (rows.length === 0) rows = [Array(colCount).fill('')];
  return makeBlock('table', { id, content: '', tableHeaders: headers, tableRows: rows });
}

/** Repair a single block node from loose JSON */
export function repairBlock(raw: unknown): Block | null {
  if (!raw || typeof raw !== 'object') {
    return makeBlock('paragraph');
  }
  const o = raw as Record<string, unknown>;
  const id = asString(o.id).trim() || genBlockId();
  const content = asString(o.content);
  const type = sanitizeBlockType(o.type);
  const children = repairChildren(o.children);
  const indent = typeof o.indent === 'number' && o.indent >= 0 ? o.indent : 0;

  if (type === 'table') {
    return repairTableFields(o, id, content);
  }

  const partial: Partial<Block> = { id, content, children, indent };

  if (type === 'todo') partial.checked = Boolean(o.checked);
  if (isToggleBlockType(type)) partial.collapsed = Boolean(o.collapsed);
  if (type === 'code') {
    partial.language = asString(o.language);
    partial.code = asString(o.code);
  }
  if (type === 'image') {
    partial.src = asString(o.src);
    partial.alt = asString(o.alt);
    if (typeof o.caption === 'string') partial.caption = o.caption;
    if (typeof o.width === 'number') partial.width = o.width;
  }
  if (type === 'math') {
    partial.math = asString(o.math);
    if (typeof o.mathBlock === 'boolean') partial.mathBlock = o.mathBlock;
  }
  if (type === 'callout' && typeof o.calloutIcon === 'string') {
    partial.calloutIcon = o.calloutIcon;
  }
  if (type === 'footnote' && typeof o.footnoteId === 'string') {
    partial.footnoteId = o.footnoteId;
  }
  if (type === 'mermaid') partial.mermaid = asString(o.mermaid);
  if (type === 'audio') {
    partial.src = asString(o.src);
    if (typeof o.caption === 'string') partial.caption = o.caption;
  }
  if (type === 'citation') {
    partial.citationTitle = asString(o.citationTitle);
    partial.citationAuthor = asString(o.citationAuthor);
    partial.citationYear = asString(o.citationYear);
    if (typeof o.citationPage === 'string') partial.citationPage = o.citationPage;
    if (typeof o.citationUrl === 'string') partial.citationUrl = o.citationUrl;
  }
  if (typeof o.listIndex === 'number') partial.listIndex = o.listIndex;

  return makeBlock(type as BlockType, partial);
}

/** Validate and repair a block forest — always returns at least one paragraph */
export function validateDocument(input: unknown): Block[] {
  if (!Array.isArray(input)) {
    const blocks = [makeBlock('paragraph')];
    assertValidBlockTree(blocks, 'validateDocument');
    return blocks;
  }
  const blocks = input.map(repairBlock).filter((b): b is Block => b !== null);
  const result = blocks.length > 0 ? blocks : [makeBlock('paragraph')];
  assertValidBlockTree(result, 'validateDocument');
  return result;
}

/** Parse markdown then validate — entry point for useBlockEditor */
export function loadValidatedBlocks(
  md: string,
  parse: (markdown: string) => Block[],
): Block[] {
  return validateDocument(parse(md));
}
