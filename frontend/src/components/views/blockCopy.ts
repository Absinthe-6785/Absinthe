/**
 * blockCopy.ts — Semantic clipboard serialization (UX-3A follow-up)
 *
 * Serializes blocks to HTML/plain for copy so paste reuses UX-3A HTML parsers.
 */
import { blocksToMarkdown, findBlockById, type Block } from './blockUtils';
import { readBlockText } from './editableDom';
import { getSelectionOffsets } from './selectionOffsets';

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
    default:
      if (block.content) return `<p>${escapeHtml(block.content)}</p>`;
      return '';
  }
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

/** Root-level copy handler — semantic when possible, else browser default. */
export function handleEditorCopyEvent(
  e: Pick<ClipboardEvent, 'clipboardData' | 'preventDefault'>,
  rootBlocks: Block[],
  selectedIds: Set<string>,
): void {
  const clipboard = e.clipboardData;
  if (!clipboard) return;

  if (selectedIds.size > 1) {
    const blocks = collectBlocksForCopy(rootBlocks, selectedIds);
    if (!blocks.length) return;
    e.preventDefault();
    applySemanticCopy(blocks, clipboard);
    return;
  }

  if (selectedIds.size === 1) {
    const block = findBlockById(rootBlocks, [...selectedIds][0]);
    if (!block) return;
    const active = document.activeElement as HTMLElement | null;
    if (active?.classList.contains('be-editable')) {
      const sel = getSelectionOffsets(active);
      const text = readBlockText(active);
      const start = sel?.start ?? 0;
      const end = sel?.end ?? text.length;
      if (start !== 0 || end !== text.length) return;
    }
    e.preventDefault();
    applySemanticCopy([block], clipboard);
    return;
  }

  const active = document.activeElement as HTMLElement | null;
  if (!active?.classList.contains('be-editable')) return;

  const blockId = active.getAttribute('data-block-id');
  if (!blockId) return;

  const sel = getSelectionOffsets(active);
  const text = readBlockText(active);
  const start = sel?.start ?? 0;
  const end = sel?.end ?? text.length;

  if (!trySemanticCopyFromBlock(rootBlocks, blockId, start, end, clipboard)) return;
  e.preventDefault();
}
