/**
 * htmlDocumentToBlocks.ts — DOM-order HTML → Block[] (UX-2A)
 *
 * Walks the full document; never returns only the first table.
 * Unknown elements → paragraph fallback (no callout detection).
 */
import { makeBlock, type Block } from './blockUtils';

const HEADING_MAP: Record<string, 'heading1' | 'heading2' | 'heading3'> = {
  H1: 'heading1',
  H2: 'heading2',
  H3: 'heading3',
  H4: 'heading3', // app has no heading4 type; H4 maps to smallest heading
};

function inlineText(el: Element): string {
  return (el.textContent ?? '').replace(/\s+/g, ' ').trim();
}

function tableFromElement(table: HTMLTableElement): Block | null {
  const rows: string[][] = [];
  table.querySelectorAll('tr').forEach(tr => {
    const cells = Array.from(tr.querySelectorAll('th, td')).map(
      c => (c.textContent ?? '').trim().replace(/\|/g, '\\|'),
    );
    if (cells.length > 0) rows.push(cells);
  });
  if (rows.length === 0) return null;

  const colCount = Math.max(...rows.map(r => r.length));
  const pad = (cells: string[]) => {
    while (cells.length < colCount) cells.push('');
    return cells.slice(0, colCount);
  };

  const headers = pad(rows[0]);
  const body = rows.slice(1).map(pad);
  if (body.length === 0) body.push(Array(colCount).fill(''));

  return makeBlock('table', { tableHeaders: headers, tableRows: body });
}

function listBlocksFromElement(el: HTMLElement, ordered: boolean, indent: number): Block[] {
  const blocks: Block[] = [];
  for (const child of el.children) {
    if (child.tagName.toUpperCase() !== 'LI') continue;
    const li = child as HTMLLIElement;

    const clone = li.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('ul, ol').forEach(n => n.remove());
    const content = inlineText(clone);

    const todoUnchecked = /^\[ \]\s/i.test(content);
    const todoChecked = /^\[x\]\s/i.test(content);
    if (todoUnchecked || todoChecked) {
      blocks.push(makeBlock('todo', {
        content: content.replace(/^\[[ x]\]\s/i, ''),
        indent,
        checked: todoChecked,
      }));
    } else if (content) {
      blocks.push(makeBlock(ordered ? 'numbered' : 'bullet', { content, indent }));
    }

    li.querySelectorAll(':scope > ul, :scope > ol').forEach(nested => {
      blocks.push(...listBlocksFromElement(
        nested as HTMLElement,
        nested.tagName.toUpperCase() === 'OL',
        indent + 1,
      ));
    });
  }
  return blocks;
}

function isWrapperTag(tag: string): boolean {
  return tag === 'DIV' || tag === 'SECTION' || tag === 'ARTICLE' || tag === 'MAIN' || tag === 'BODY';
}

function hasElementChildren(el: Element): boolean {
  return Array.from(el.childNodes).some(n => n.nodeType === Node.ELEMENT_NODE);
}

function appendBlocks(target: Block[], next: Block[]) {
  for (const b of next) {
    if (b.type === 'paragraph' && !b.content.trim() && target.length > 0) continue;
    target.push(b);
  }
}

function walkNode(node: Node, out: Block[]): void {
  if (node.nodeType === Node.TEXT_NODE) {
    const t = (node.textContent ?? '').replace(/\s+/g, ' ').trim();
    if (t) out.push(makeBlock('paragraph', { content: t }));
    return;
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return;

  const el = node as HTMLElement;
  const tag = el.tagName.toUpperCase();

  if (tag in HEADING_MAP) {
    const content = inlineText(el);
    if (content) out.push(makeBlock(HEADING_MAP[tag], { content }));
    return;
  }

  if (tag === 'H5' || tag === 'H6') {
    const content = inlineText(el);
    if (content) out.push(makeBlock('heading3', { content }));
    return;
  }

  if (tag === 'P') {
    const content = inlineText(el);
    out.push(makeBlock('paragraph', { content }));
    return;
  }

  if (tag === 'TABLE') {
    const tbl = tableFromElement(el as HTMLTableElement);
    if (tbl) out.push(tbl);
    return;
  }

  if (tag === 'UL') {
    appendBlocks(out, listBlocksFromElement(el, false, 0));
    return;
  }

  if (tag === 'OL') {
    appendBlocks(out, listBlocksFromElement(el, true, 0));
    return;
  }

  if (tag === 'BLOCKQUOTE') {
    const content = inlineText(el);
    if (content) out.push(makeBlock('quote', { content }));
    return;
  }

  if (tag === 'PRE') {
    const code = el.textContent ?? '';
    out.push(makeBlock('code', { code, language: '' }));
    return;
  }

  if (tag === 'HR') {
    out.push(makeBlock('divider'));
    return;
  }

  if (tag === 'IMG') {
    const img = el as HTMLImageElement;
    out.push(makeBlock('image', {
      src: img.getAttribute('src') ?? '',
      alt: img.getAttribute('alt') ?? '',
    }));
    return;
  }

  if (tag === 'BR') {
    out.push(makeBlock('paragraph', { content: '' }));
    return;
  }

  if (isWrapperTag(tag) && hasElementChildren(el)) {
    el.childNodes.forEach(c => walkNode(c, out));
    return;
  }

  // Unknown / details / callout divs → paragraph fallback
  const fallback = inlineText(el);
  if (fallback) out.push(makeBlock('paragraph', { content: fallback }));
}

/** Returns null when DOMParser unavailable or document is empty. */
export function htmlDocumentToBlocks(html: string): Block[] | null {
  if (!html.trim()) return null;
  if (typeof DOMParser === 'undefined') return null;

  const doc = new DOMParser().parseFromString(html, 'text/html');
  const blocks: Block[] = [];
  doc.body.childNodes.forEach(n => walkNode(n, blocks));

  const filtered = blocks.filter(b => b.type !== 'paragraph' || b.content.trim() !== '' || blocks.length === 1);
  return filtered.length > 0 ? filtered : null;
}

/** True when HTML likely contains block-level document structure. */
export function htmlHasBlockStructure(html: string): boolean {
  if (!/<[a-z]/i.test(html)) return false;
  return /<(h[1-6]|p|table|ul|ol|blockquote|pre|hr|div|li)\b/i.test(html);
}
