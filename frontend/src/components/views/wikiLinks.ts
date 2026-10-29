import { tokenizeMathInText } from '../../lib/math/mathParse';
import { markdownCodeLanguage, markdownMathBlockEnd, isMarkdownTableStart, isMarkdownTableRow,
  markdownTableCells, markdownToggleHeader, isMarkdownToggleChildLine, markdownObsidianCallout } from './markdownBlockBoundaries';

export interface IdWikiLink {
  kind: 'note-id';
  noteId: string;
  label: string;
  raw: string;
  start: number;
  end: number;
}

/** Objects are supplied only by the current authorized Notes publication. */
export interface WikiNoteTarget {
  id: string;
  title: string;
  /** Last-modified time from the current authorized Notes publication. */
  updatedAt?: number;
  isCurrent: () => boolean;
}
export type WikiTarget = string | WikiNoteTarget;
export type WikiNavigationTarget = string | IdWikiLink;
export const wikiTargetTitle = (target: WikiTarget): string => typeof target === 'string' ? target : target.title;
export const isCurrentWikiTarget = (target: WikiTarget): boolean => typeof target === 'string' || target.isCurrent();

/** Delegated keyboard activation for focusable Wiki spans in reading-mode output. */
export function handleReadingWikiKeyDown(
  event: KeyboardEvent,
  root: HTMLElement,
  navigate: (target: WikiNavigationTarget, options?: { preferReading?: boolean }) => void,
): boolean {
  if (event.key !== 'Enter' || event.repeat || event.isComposing || event.keyCode === 229
    || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return false;
  const source = event.target;
  if (!(source instanceof Element)) return false;
  const link = source.closest<HTMLElement>('.be-wikilink[role="link"][tabindex="0"]');
  if (!link || !root.contains(link)) return false;

  const idLink = parseIdWikiLink(link.dataset.noteLink ?? '');
  const title = link.dataset.wiki;
  if (!idLink && title === undefined) return false;
  event.preventDefault();
  event.stopPropagation();
  navigate(idLink ?? title!, { preferReading: true });
  return true;
}

export function serializeIdWikiLink(noteId: string, label = ''): string {
  if (!noteId || /[\r\n\u0000]/.test(noteId) || /[\r\n]/.test(label)) throw new Error('Invalid Wiki link');
  const id = encodeURIComponent(noteId).replace(/[!'()*]/g, c => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  const escaped = label.replace(/[\\\[\]*_`|]/g, '\\$&');
  return `[${escaped}](absinthe-note:${id})`;
}

interface SourceLine { text: string; start: number }

/** Consume structural regions in the same order as markdownToBlocks, retaining
 * original source coordinates even through recursive toggle deindentation. */
function bodyLinkScanText(text: string): string {
  const output = text.replace(/[^\n]/g, ' ').split('');
  let offset = 0;
  const lines = text.split('\n').map(value => {
    const line = { text: value, start: offset };
    offset += value.length + 1;
    return line;
  });
  const inline = (line: SourceLine, start = 0, end = line.text.length) => {
    const scan = inlineLinkScanText(line.text.slice(start, end));
    for (let i = 0; i < scan.length; i++) output[line.start + start + i] = scan[i];
  };
  const cells = (line: SourceLine) => {
    for (const cell of markdownTableCells(line.text)) inline(line, cell.start, cell.end);
  };
  const inlineFragments = (fragments: SourceLine[]) => {
    const scan = inlineLinkScanText(fragments.map(fragment => fragment.text).join('\n'));
    let cursor = 0;
    for (const fragment of fragments) {
      for (let j = 0; j < fragment.text.length; j++) output[fragment.start + j] = scan[cursor + j];
      cursor += fragment.text.length + 1;
    }
  };
  const walk = (source: SourceLine[]) => {
    const values = source.map(line => line.text);
    for (let i = 0; i < source.length;) {
      const line = source[i];
      if (markdownCodeLanguage(line.text) !== null) {
        i++;
        while (i < source.length && source[i].text !== String.fromCharCode(96).repeat(3)) i++;
        i++;
        continue;
      }
      const mathEnd = markdownMathBlockEnd(values, i);
      if (mathEnd !== -1) { i = mathEnd + 1; continue; }
      if (isMarkdownTableStart(line.text, source[i + 1]?.text)) {
        cells(line);
        i += 2;
        while (i < source.length && isMarkdownTableRow(source[i].text)) cells(source[i++]);
        continue;
      }
      const callout = markdownObsidianCallout(values, i);
      if (callout) {
        const fragments: SourceLine[] = callout.summary
          ? [{ text: callout.summary, start: line.start + callout.summaryStart }] : [];
        for (let row = i + 1; row < callout.end; row++) {
          fragments.push({ text: source[row].text.slice(2), start: source[row].start + 2 });
        }
        inlineFragments(fragments);
        i = callout.end;
        continue;
      }
      const toggle = markdownToggleHeader(line.text, source[i + 1]?.text, true)
        ?? markdownToggleHeader(line.text, source[i + 1]?.text, false);
      inline(line);
      i++;
      if (toggle) {
        const children: SourceLine[] = [];
        while (i < source.length && isMarkdownToggleChildLine(source[i].text)) {
          const child = source[i++];
          const trim = child.text.startsWith('  ') ? 2 : 0;
          children.push({ text: child.text.slice(trim), start: child.start + trim });
        }
        walk(children);
      }
    }
  };
  walk(lines);
  // A legacy token retains its meaning even if a table splits its visible cells.
  for (const match of text.matchAll(/\[\[(.+?)\]\]/g)) {
    for (let i = match.index!; i < match.index! + match[0].length; i++) output[i] = ' ';
  }
  return output.join('');
}

/** Offset-preserving scan of one actual live block or one persisted cell/line. */
function inlineLinkScanText(text: string): string {
  // Match inline rendering's math protection before considering fence-like text.
  // Keep positions stable: the tokenizer otherwise unescapes currency dollars.
  const mathInput = text.replace(/\\\$/g, '  ')
    .replace(/\[\[(.+?)\]\]/g, match => ' '.repeat(match.length));
  const mathMasked = tokenizeMathInText(mathInput, { includeBracketDisplay: true })
    .map(token => token.kind === 'text' ? token.value : token.raw.replace(/[^\n]/g, ' ')).join('');
  const originalLines = text.split('\n');
  let inCodeBlock = false;
  const fenced = mathMasked.split('\n').map((masked, index) => {
    const line = originalLines[index];
    // Same supported fence grammar as markdownToBlocks.tryCodeBlock.
    if (inCodeBlock) {
      if (line === String.fromCharCode(96).repeat(3)) inCodeBlock = false;
      return ' '.repeat(line.length);
    }
    if (/^\x60{3}[\w]*\s*$/.test(line) && masked[0] === line[0]) {
      inCodeBlock = true;
      return ' '.repeat(line.length);
    }
    return masked;
  }).join('\n');
  const chars = fenced.split('');
  const tick = String.fromCharCode(96);
  for (let i = 0; i < fenced.length; i++) {
    if (fenced[i] !== tick) continue;
    let preceding = 0;
    for (let j = i - 1; j >= 0 && fenced[j] === '\\'; j--) preceding++;
    let length = 1;
    while (fenced[i + length] === tick) length++;
    if (preceding % 2) { i += length - 1; continue; }
    let close = i + length;
    while (close < fenced.length) {
      if (fenced[close] !== tick) { close++; continue; }
      let closingLength = 1;
      while (fenced[close + closingLength] === tick) closingLength++;
      if (closingLength === length) break;
      close += closingLength;
    }
    if (close < fenced.length) {
      for (let j = i; j < close + length; j++) if (chars[j] !== '\n') chars[j] = ' ';
      i = close + length - 1;
    } else i += length - 1;
  }
  return chars.join('');
}

/** body follows persisted Markdown block boundaries; inline is one live block. */
export function parseIdWikiLinks(text: string, context: 'body' | 'inline' = 'body'): IdWikiLink[] {
  const scan = context === 'body' ? bodyLinkScanText(text) : inlineLinkScanText(text);
  const re = /\[((?:\\[^\r\n]|[^\]\\\r\n])*)\]\(absinthe-note:([A-Za-z0-9._~%\-]+)\)/g;
  const links: IdWikiLink[] = [];
  for (const match of text.matchAll(re)) {
    const start = match.index!;
    // Not an image, an escaped link, or a token nested inside legacy [[title]].
    let slashes = 0;
    for (let i = start - 1; i >= 0 && text[i] === '\\'; i--) slashes++;
    if (scan[start] !== '[' || slashes % 2 || (start > 0 && /[!\[]/.test(text[start - 1]))) continue;
    try {
      const noteId = decodeURIComponent(match[2]);
      if (!noteId || /[\r\n\u0000]/.test(noteId)) continue;
      const label = match[1].replace(/\\([\s\S])/g, (escaped, char: string) =>
        /[\u0021-\u002F\u003A-\u0040\u005B-\u0060\u007B-\u007E]/.test(char) ? char : escaped);
      links.push({ kind: 'note-id', noteId, label,
        raw: text.slice(start, start + match[0].length), start, end: start + match[0].length });
    } catch { /* Malformed URI remains authored text. */ }
  }
  return links;
}

export function parseIdWikiLink(raw: string): IdWikiLink | null {
  const link = parseIdWikiLinks(raw, 'inline')[0];
  return link?.raw === raw ? link : null;
}

export function resolveIdWikiTarget(link: IdWikiLink, targets: readonly WikiTarget[]): WikiNoteTarget | undefined {
  return targets.find((target): target is WikiNoteTarget => typeof target !== 'string'
    && target.id === link.noteId && target.isCurrent());
}
