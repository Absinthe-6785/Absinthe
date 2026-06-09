/**
 * blockCopy.ts — Semantic clipboard serialization (UX-3A follow-up)
 *
 * Serializes blocks to HTML/plain for copy so paste reuses UX-3A HTML parsers.
 */
import { classifyClipboardHtml, type CopyTraceReport } from './copyDiagnostics';
import { resolveCopySelection } from './copySelection';
import { blocksToMarkdown, findBlockById, type Block } from '../../../../../blockUtils';
import { readBlockText } from '../../../../../editableDom';
import { getSelectionOffsets } from '../../selection';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function blockBodyHtml(block: Block): string {
  switch (block.type) {
    case 'paragraph':
      return `<p>${escapeHtml(block.content)}</p>`;
    case 'heading1':
      return `<h1>${escapeHtml(block.content)}</h1>`;
    case 'heading2':
      return `<h2>${escapeHtml(block.content)}</h2>`;
    case 'heading3':
      return `<h3>${escapeHtml(block.content)}</h3>`;
    case 'quote':
      return `<blockquote>${escapeHtml(block.content)}</blockquote>`;
    case 'bullet':
      return bulletGroupToHtml([block]);
    case 'numbered':
      return numberedGroupToHtml([block]);
    case 'todo': {
      const mark = block.checked ? 'x' : ' ';
      return `<ul><li>[${mark}] ${escapeHtml(block.content)}</li></ul>`;
    }
    case 'toggle': {
      const openAttr = block.collapsed ? '' : ' open';
      const childHtml = blocksToCopyHtml(block.children);
      const body = childHtml ? `<div class="btbody">${childHtml}</div>` : '';
      return `<details class="btoggle"${openAttr}><summary class="btsummary">${escapeHtml(block.content)}</summary>${body}</details>`;
    }
    case 'code':
      return `<pre><code>${escapeHtml(block.code ?? block.content)}</code></pre>`;
    case 'divider':
      return '<hr>';
    case 'table':
      return tableBlockToHtml(block);
    default:
      if (block.content) return `<p>${escapeHtml(block.content)}</p>`;
      return '';
  }
}

function tableBlockToHtml(block: Block): string {
  const headers = block.tableHeaders ?? [];
  const rows = block.tableRows ?? [];
  if (!headers.length) return '';

  let html = '<table><thead><tr>';
  for (const h of headers) {
    html += `<th>${escapeHtml(h)}</th>`;
  }
  html += '</tr></thead><tbody>';
  for (const row of rows) {
    html += '<tr>';
    for (let i = 0; i < headers.length; i++) {
      html += `<td>${escapeHtml(row[i] ?? '')}</td>`;
    }
    html += '</tr>';
  }
  html += '</tbody></table>';
  return html;
}

/** Serialize blocks to semantic HTML for clipboard (toggle, lists, nested children). */
export function blocksToCopyHtml(blocks: Block[]): string {
  const parts: string[] = [];
  let i = 0;

  while (i < blocks.length) {
    const block = blocks[i];

    if (block.type === 'bullet') {
      const group: Block[] = [];
      while (i < blocks.length && blocks[i].type === 'bullet') {
        group.push(blocks[i]);
        i++;
      }
      parts.push(bulletGroupToHtml(group));
      continue;
    }

    if (block.type === 'numbered') {
      const group: Block[] = [];
      while (i < blocks.length && blocks[i].type === 'numbered') {
        group.push(blocks[i]);
        i++;
      }
      parts.push(numberedGroupToHtml(group));
      continue;
    }

    if (block.type === 'todo') {
      const group: Block[] = [];
      while (i < blocks.length && blocks[i].type === 'todo') {
        group.push(blocks[i]);
        i++;
      }
      parts.push(todoGroupToHtml(group));
      continue;
    }

    parts.push(blockBodyHtml(block));
    i++;
  }

  return parts.join('');
}

function bulletGroupToHtml(blocks: Block[]): string {
  return listGroupToHtml(blocks, false);
}

function numberedGroupToHtml(blocks: Block[]): string {
  return listGroupToHtml(blocks, true);
}

function listGroupToHtml(blocks: Block[], ordered: boolean): string {
  const tag = ordered ? 'ol' : 'ul';
  const lines: string[] = [];

  const render = (items: Block[], depth: number): string => {
    if (!items.length) return '';
    const minIndent = Math.min(...items.map(i => i.indent ?? 0));
    if (minIndent > depth) {
      const inner = render(items, minIndent);
      return `<${tag}><li>${inner}</li></${tag}>`;
    }
    let html = `<${tag}>`;
    let j = 0;
    while (j < items.length) {
      const item = items[j];
      const indent = item.indent ?? 0;
      if (indent < depth) break;
      if (indent > depth) { j++; continue; }

      const nested: Block[] = [];
      let k = j + 1;
      while (k < items.length && (items[k].indent ?? 0) > depth) {
        nested.push(items[k]);
        k++;
      }

      const nestedHtml = nested.length ? render(nested, depth + 1) : '';
      html += `<li>${escapeHtml(item.content)}${nestedHtml}</li>`;
      j = k;
    }
    html += `</${tag}>`;
    return html;
  };

  lines.push(render(blocks, 0));
  return lines.join('');
}

function todoGroupToHtml(blocks: Block[]): string {
  let html = '<ul>';
  for (const block of blocks) {
    const mark = block.checked ? 'x' : ' ';
    html += `<li>[${mark}] ${escapeHtml(block.content)}</li>`;
  }
  html += '</ul>';
  return html;
}

/** Document-order blocks matching selected ids (includes full subtrees). */
export function collectBlocksForCopy(blocks: Block[], ids: Iterable<string>): Block[] {
  const want = new Set(ids);
  const result: Block[] = [];
  const walk = (list: Block[]) => {
    for (const b of list) {
      if (want.has(b.id)) result.push(b);
      else if (b.children.length > 0) walk(b.children);
    }
  };
  walk(blocks);
  return result;
}

export function applySemanticCopy(blocks: Block[], clipboard: Pick<DataTransfer, 'setData'>): void {
  if (!blocks.length) return;
  clipboard.setData('text/html', blocksToCopyHtml(blocks));
  clipboard.setData('text/plain', blocksToMarkdown(blocks));
}

/**
 * Semantic copy for a single editable block.
 * Returns false → caller should allow browser-native copy.
 */
export function trySemanticCopyFromBlock(
  rootBlocks: Block[],
  blockId: string,
  start: number,
  end: number,
  clipboard: Pick<DataTransfer, 'setData'>,
): boolean {
  const block = findBlockById(rootBlocks, blockId);
  if (!block) return false;

  if (block.type === 'toggle') {
    applySemanticCopy([block], clipboard);
    return true;
  }

  const len = (block.content ?? '').length;
  if (start !== 0 || end !== len) return false;

  applySemanticCopy([block], clipboard);
  return true;
}

function expectedSemanticPayload(blocks: Block[]): { html: string; plain: string } {
  return {
    html: blocksToCopyHtml(blocks),
    plain: blocksToMarkdown(blocks),
  };
}

function traceAfter(
  report: Omit<CopyTraceReport, 'clipboardHtmlAfterHandler' | 'clipboardPlainAfterHandler' | 'htmlClassification'>,
  clipboard: DataTransfer | null,
  prevented: boolean,
): CopyTraceReport {
  const html = clipboard?.getData('text/html') ?? '';
  const plain = clipboard?.getData('text/plain') ?? '';
  return {
    ...report,
    preventedDefault: prevented,
    clipboardHtmlAfterHandler: html || null,
    clipboardPlainAfterHandler: plain || null,
    htmlClassification: classifyClipboardHtml(html),
  };
}

/** Root-level copy handler — semantic when possible, else browser default. */
export function handleEditorCopyEvent(
  e: Pick<ClipboardEvent, 'clipboardData' | 'preventDefault'>,
  rootBlocks: Block[],
  selectedIds: Set<string>,
): CopyTraceReport | null {
  const clipboard = e.clipboardData;
  const selectedBlockIds = [...selectedIds];
  const active = document.activeElement as HTMLElement | null;
  const activeBlockId = active?.getAttribute('data-block-id') ?? null;
  const activeBlockType = active?.getAttribute('data-block-type') ?? null;

  if (!clipboard) {
    return traceAfter({
      path: 'skipped-no-clipboard',
      preventedDefault: false,
      selectedBlockIds,
      activeBlockId,
      activeBlockType,
      selectionStart: null,
      selectionEnd: null,
      selectionLength: null,
      blocksCopied: 0,
      expectedHtml: null,
      expectedPlain: null,
    }, null, false);
  }

  if (selectedIds.size > 1) {
    const blocks = collectBlocksForCopy(rootBlocks, selectedIds);
    if (!blocks.length) return null;
    const expected = expectedSemanticPayload(blocks);
    e.preventDefault();
    applySemanticCopy(blocks, clipboard);
    return traceAfter({
      path: 'multi-select',
      preventedDefault: true,
      selectedBlockIds,
      activeBlockId,
      activeBlockType,
      selectionStart: null,
      selectionEnd: null,
      selectionLength: null,
      blocksCopied: blocks.length,
      expectedHtml: expected.html,
      expectedPlain: expected.plain,
    }, clipboard, true);
  }

  if (selectedIds.size === 1) {
    const block = findBlockById(rootBlocks, [...selectedIds][0]);
    if (!block) return null;
    // UX-3A.4: gutter-selected toggle wins over partial text in any active .be-editable
    if (block.type !== 'toggle' && active?.classList.contains('be-editable')) {
      const sel = getSelectionOffsets(active);
      const text = readBlockText(active);
      const start = sel?.start ?? 0;
      const end = sel?.end ?? text.length;
      if (start !== 0 || end !== text.length) {
        return traceAfter({
          path: 'single-gutter-partial-fallback',
          preventedDefault: false,
          selectedBlockIds,
          activeBlockId,
          activeBlockType,
          selectionStart: start,
          selectionEnd: end,
          selectionLength: text.length,
          blocksCopied: 0,
          expectedHtml: null,
          expectedPlain: null,
        }, clipboard, false);
      }
    }
    const expected = expectedSemanticPayload([block]);
    e.preventDefault();
    applySemanticCopy([block], clipboard);
    return traceAfter({
      path: 'single-gutter-full-block',
      preventedDefault: true,
      selectedBlockIds,
      activeBlockId,
      activeBlockType,
      selectionStart: null,
      selectionEnd: null,
      selectionLength: null,
      blocksCopied: 1,
      expectedHtml: expected.html,
      expectedPlain: expected.plain,
    }, clipboard, true);
  }

  const resolved = resolveCopySelection(rootBlocks);

  if (resolved.kind === 'toggle-subtree') {
    const block = findBlockById(rootBlocks, resolved.blockId);
    if (!block) return null;
    const expected = expectedSemanticPayload([block]);
    e.preventDefault();
    applySemanticCopy([block], clipboard);
    return traceAfter({
      path: 'editable-toggle-header',
      preventedDefault: true,
      selectedBlockIds,
      activeBlockId: resolved.blockId,
      activeBlockType: 'toggle',
      selectionStart: null,
      selectionEnd: null,
      selectionLength: null,
      blocksCopied: 1,
      expectedHtml: expected.html,
      expectedPlain: expected.plain,
    }, clipboard, true);
  }

  if (resolved.kind === 'multi-block') {
    const blocks = collectBlocksForCopy(rootBlocks, resolved.blockIds);
    if (!blocks.length) return null;
    const expected = expectedSemanticPayload(blocks);
    e.preventDefault();
    applySemanticCopy(blocks, clipboard);
    return traceAfter({
      path: 'multi-select',
      preventedDefault: true,
      selectedBlockIds,
      activeBlockId,
      activeBlockType,
      selectionStart: null,
      selectionEnd: null,
      selectionLength: null,
      blocksCopied: blocks.length,
      expectedHtml: expected.html,
      expectedPlain: expected.plain,
    }, clipboard, true);
  }

  if (resolved.kind === 'not-focused') {
    return traceAfter({
      path: 'editable-not-focused',
      preventedDefault: false,
      selectedBlockIds,
      activeBlockId,
      activeBlockType,
      selectionStart: null,
      selectionEnd: null,
      selectionLength: null,
      blocksCopied: 0,
      expectedHtml: null,
      expectedPlain: null,
    }, clipboard, false);
  }

  if (resolved.kind === 'partial-fallback') {
    return traceAfter({
      path: 'editable-partial-fallback',
      preventedDefault: false,
      selectedBlockIds,
      activeBlockId,
      activeBlockType,
      selectionStart: null,
      selectionEnd: null,
      selectionLength: null,
      blocksCopied: 0,
      expectedHtml: null,
      expectedPlain: null,
    }, clipboard, false);
  }

  const { ctx } = resolved;
  const { activeBlockId: blockId, activeBlockType: blockType, start, end, textLength } = ctx;
  const block = findBlockById(rootBlocks, blockId);

  if (!trySemanticCopyFromBlock(rootBlocks, blockId, start, end, clipboard)) {
    return traceAfter({
      path: 'editable-partial-fallback',
      preventedDefault: false,
      selectedBlockIds,
      activeBlockId: blockId,
      activeBlockType: blockType,
      selectionStart: start,
      selectionEnd: end,
      selectionLength: textLength,
      blocksCopied: 0,
      expectedHtml: null,
      expectedPlain: null,
    }, clipboard, false);
  }

  e.preventDefault();
  const expected = expectedSemanticPayload(block ? [block] : []);
  return traceAfter({
    path: block?.type === 'toggle' ? 'editable-toggle-header' : 'editable-full-block',
    preventedDefault: true,
    selectedBlockIds,
    activeBlockId: blockId,
    activeBlockType: blockType,
    selectionStart: start,
    selectionEnd: end,
    selectionLength: textLength,
    blocksCopied: 1,
    expectedHtml: expected.html,
    expectedPlain: expected.plain,
  }, clipboard, true);
}
