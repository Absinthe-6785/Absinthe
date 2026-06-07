/**
 * pasteStructure.ts — Structured clipboard → markdown / blocks
 */
import { markdownToBlocks, type Block } from './blockUtils';

export function normalizePasteText(raw: string): string {
  return raw
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\u00a0/g, ' ')
    .replace(/\t/g, '  ')
    .replace(/\n+$/, '');
}

const HTML_BLOCK_TAGS = new Set([
  'P', 'DIV', 'LI', 'UL', 'OL', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'TR', 'BLOCKQUOTE', 'PRE',
]);

/** Convert clipboard HTML to plain text with line breaks preserved. */
export function htmlToPlainText(html: string): string {
  if (typeof DOMParser === 'undefined') {
    return normalizePasteText(
      html
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/(p|div|li|h[1-6]|tr|blockquote|pre)>/gi, '\n')
        .replace(/<[^>]+>/g, ''),
    );
  }
  const doc = new DOMParser().parseFromString(html, 'text/html');

  const walk = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? '';
    const tag = node.nodeName.toUpperCase();
    if (tag === 'BR') return '\n';
    let out = '';
    node.childNodes.forEach(child => { out += walk(child); });
    if (HTML_BLOCK_TAGS.has(tag)) out += '\n';
    return out;
  };

  const root = doc.body;
  root.querySelectorAll('br').forEach(br => {
    br.replaceWith(doc.createTextNode('\n'));
  });
  return normalizePasteText(walk(root));
}

/** Detect tab-separated table clipboard (e.g. from Excel / Sheets). */
export function looksLikeTsv(text: string): boolean {
  const lines = text.trim().split('\n').filter(l => l.trim());
  if (lines.length < 2) return false;
  const colCounts = lines.map(l => l.split('\t').length);
  return colCounts.every(c => c >= 2) && colCounts[0] === colCounts[1];
}

/** Convert TSV plain text to a markdown table string. */
export function tsvToMarkdownTable(text: string): string | null {
  if (!looksLikeTsv(text)) return null;
  const rows = text.trim().split('\n').map(l => l.split('\t').map(c => c.trim()));
  const header = rows[0];
  const divider = header.map(() => '---');
  const body = rows.slice(1);
  const toRow = (cells: string[]) => `| ${cells.join(' | ')} |`;
  return [toRow(header), toRow(divider), ...body.map(toRow)].join('\n');
}

/** Parse HTML table element(s) into markdown table syntax. */
export function htmlTableToMarkdown(html: string): string | null {
  if (typeof DOMParser === 'undefined') {
    return null;
  }
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const table = doc.querySelector('table');
  if (!table) return null;

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
    return cells;
  };
  const header = pad(rows[0]);
  const divider = header.map(() => '---');
  const body = rows.slice(1).map(pad);
  const toRow = (cells: string[]) => `| ${cells.join(' | ')} |`;
  return [toRow(header), toRow(divider), ...body.map(toRow)].join('\n');
}

/** Convert article-like HTML to markdown-oriented plain text. */
export function htmlArticleToMarkdown(html: string): string {
  if (typeof DOMParser === 'undefined') {
    return normalizePasteText(htmlToPlainText(html));
  }
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const lines: string[] = [];

  const walk = (node: Node, listDepth = 0) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const t = (node.textContent ?? '').replace(/\s+/g, ' ');
      if (t.trim()) lines.push(t.trim());
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as HTMLElement;
    const tag = el.tagName.toUpperCase();

    if (tag === 'H1') { lines.push(`# ${el.textContent?.trim() ?? ''}`); return; }
    if (tag === 'H2') { lines.push(`## ${el.textContent?.trim() ?? ''}`); return; }
    if (tag === 'H3') { lines.push(`### ${el.textContent?.trim() ?? ''}`); return; }
    if (tag === 'LI') {
      const indent = '  '.repeat(listDepth);
      const bullet = el.parentElement?.tagName === 'OL' ? '1.' : '-';
      lines.push(`${indent}${bullet} ${el.textContent?.trim() ?? ''}`);
      return;
    }
    if (tag === 'UL' || tag === 'OL') {
      el.childNodes.forEach(c => walk(c, listDepth + 1));
      return;
    }
    if (tag === 'P' || tag === 'DIV' || tag === 'BLOCKQUOTE') {
      const text = el.textContent?.trim();
      if (text) lines.push(text);
      return;
    }
    if (tag === 'BR') {
      lines.push('');
      return;
    }
    el.childNodes.forEach(c => walk(c, listDepth));
  };

  doc.body.childNodes.forEach(c => walk(c));
  return normalizePasteText(lines.join('\n'));
}

/** Best-effort structured text from clipboard for paste pipeline. */
export function prepareStructuredPasteText(clipboard: Pick<DataTransfer, 'getData'>): string {
  const html = clipboard.getData('text/html');
  const plain = clipboard.getData('text/plain');

  if (html && /<table/i.test(html)) {
    const tableMd = htmlTableToMarkdown(html);
    if (tableMd) return tableMd;
  }
  if (plain && looksLikeTsv(plain)) {
    const tableMd = tsvToMarkdownTable(plain);
    if (tableMd) return tableMd;
  }
  if (plain) return plain;
  if (html) return htmlArticleToMarkdown(html);
  return '';
}

/** Parse structured paste text into blocks (markdown pipeline). */
export function parseStructuredPaste(raw: string): Block[] {
  return markdownToBlocks(normalizePasteText(raw));
}
