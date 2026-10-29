import { calloutIconForObsidianAlias } from './calloutPresets';

/** Source-boundary rules shared with markdownToBlocks; no AST or data mutation. */
export function markdownCodeLanguage(line: string): string | null {
  return line.match(/^\x60{3}([\w]*)\s*$/)?.[1] ?? null;
}

export function markdownMathBlockEnd(lines: readonly string[], index: number): number {
  const opening = lines[index];
  const closing = opening === '$$' ? '$$' : opening === '\\[' ? '\\]' : null;
  if (!closing) return -1;
  for (let cursor = index + 1; cursor < lines.length; cursor++) {
    if (opening === '\\[' && /^ {0,3}(?:\x60{3,}|~{3,})/.test(lines[cursor])) return -1;
    if (lines[cursor] === closing) return cursor;
  }
  return -1;
}

export const isMarkdownTableRow = (line: string): boolean => /^\|.+\|/.test(line);
export const isMarkdownTableStart = (line: string, next = ''): boolean =>
  isMarkdownTableRow(line) && /^\|[\s\-:|]+\|/.test(next);

/** Deliberately matches the existing literal-pipe codec, not general Markdown. */
export function markdownTableCells(line: string): { start: number; end: number }[] {
  const cells: { start: number; end: number }[] = [];
  let start = line.indexOf('|');
  for (let end = line.indexOf('|', start + 1); start >= 0 && end >= 0; end = line.indexOf('|', start + 1)) {
    cells.push({ start: start + 1, end });
    start = end;
  }
  return cells;
}

export function markdownToggleHeader(line: string, nextLine: string | undefined, heading: boolean) {
  const closed = line.match(heading ? /^(#{1,4})>!\s?(.*)$/ : /^>!\s?(.*)$/);
  const open = !closed && line.match(heading ? /^(#{1,4})>(?!!)\s?(.*)$/ : /^>(?!!)\s?(.*)$/);
  const match = closed || open;
  if (!match) return null;
  // Obsidian callouts are consumed before ordinary toggles by the parser.
  const obsidian = !heading && line.match(/^> \[!(\w+)\]/i);
  if (obsidian && calloutIconForObsidianAlias(obsidian[1])) return null;
  const summary = match[heading ? 2 : 1] ?? '';
  const hasChildren = nextLine !== undefined && (nextLine.startsWith('  ') || nextLine === '');
  if (!closed && !hasChildren && (!heading || !summary)) return null;
  return { summary, collapsed: !!closed, level: heading ? match[1].length as 1 | 2 | 3 | 4 : undefined };
}

export const isMarkdownToggleChildLine = (line: string): boolean => line.startsWith('  ') || line === '';

export function markdownObsidianCallout(lines: readonly string[], index: number) {
  const line = lines[index];
  const match = line.match(/^> \[!(\w+)\]\s*(.*)$/i);
  if (!match) return null;
  const icon = calloutIconForObsidianAlias(match[1]);
  if (!icon) return null;
  let end = index + 1;
  while (end < lines.length && /^> /.test(lines[end]) && !/^> \[!(\w+)\]/i.test(lines[end])) end++;
  return { icon, summary: match[2].trim(),
    summaryStart: line.length - match[2].trimStart().length, end };
}
