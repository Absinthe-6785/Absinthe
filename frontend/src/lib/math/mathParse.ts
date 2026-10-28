/**
 * K-49 — shared LaTeX delimiter parsing for Notes (inline $…$ and display $$…$$).
 */

export function isCurrencyLikeInlineMath(expr: string): boolean {
  const t = expr.trim();
  if (!t) return true;
  return /^[\d.,\s%]+$/.test(t);
}

export function isValidInlineMath(expr: string): boolean {
  const t = expr.trim();
  if (!t) return false;
  if (isCurrencyLikeInlineMath(t)) return false;

  if (/\\|[\^_{}=]/.test(t)) return true;

  if (/^[a-zA-Z][a-zA-Z0-9]*$/.test(t)) return true;

  if (/^[a-zA-Z0-9+\-*/().,\s]+$/.test(t) && /[+\-*/=]/.test(t)) return true;

  if (/\d/.test(t) && /[a-zA-Z]/.test(t) && /\s/.test(t)) return false;

  return false;
}

export interface MathTextToken {
  kind: 'text';
  value: string;
}

export interface MathInlineToken {
  kind: 'inline';
  raw: string;
  expr: string;
}

export interface MathDisplayToken {
  kind: 'display';
  raw: string;
  expr: string;
}

export type MathToken = MathTextToken | MathInlineToken | MathDisplayToken;

function hasEscapedBackslash(text: string, index: number): boolean {
  let precedingBackslashes = 0;
  for (let cursor = index - 1; cursor >= 0 && text[cursor] === '\\'; cursor -= 1) {
    precedingBackslashes += 1;
  }
  return precedingBackslashes % 2 === 1;
}

function findUnescapedBracketClose(text: string, start: number): number {
  let cursor = start;
  let inlineCodeClose = -1;
  while (cursor < text.length) {
    if (cursor === 0 || text[cursor - 1] === '\n') {
      if (markdownFenceAtLine(text, cursor)) return -1;
    }
    if (inlineCodeClose < cursor) inlineCodeClose = -1;
    if (inlineCodeClose < cursor
      && text[cursor] === '`'
      && !hasEscapedBackslash(text, cursor)) {
      const runLength = backtickRunLength(text, cursor);
      const close = findMatchingInlineCodeClose(text, cursor + runLength, runLength);
      if (close !== -1) inlineCodeClose = close + runLength - 1;
    }
    if (inlineCodeClose < cursor
      && text[cursor] === '\\'
      && text[cursor + 1] === ']'
      && !hasEscapedBackslash(text, cursor)) {
      return cursor;
    }
    cursor += 1;
  }
  return -1;
}

function markdownFenceAtLine(text: string, index: number): { marker: string; length: number; tail: string } | null {
  if (index !== 0 && text[index - 1] !== '\n') return null;
  let cursor = index;
  while (cursor < text.length && cursor - index < 4 && text[cursor] === ' ') cursor += 1;
  if (cursor - index > 3 || (text[cursor] !== '`' && text[cursor] !== '~')) return null;
  const marker = text[cursor];
  const markerStart = cursor;
  while (text[cursor] === marker) cursor += 1;
  const length = cursor - markerStart;
  if (length < 3) return null;
  const lineEnd = text.indexOf('\n', cursor);
  return { marker, length, tail: text.slice(cursor, lineEnd === -1 ? text.length : lineEnd) };
}

function backtickRunLength(text: string, index: number): number {
  let cursor = index;
  while (text[cursor] === '`') cursor += 1;
  return cursor - index;
}

function findMatchingInlineCodeClose(text: string, start: number, delimiterLength: number): number {
  let cursor = start;
  let fenceMarker: string | null = null;
  let fenceLength = 0;
  let fenceBoundaryLine = false;
  while (cursor < text.length) {
    if (cursor === 0 || text[cursor - 1] === '\n') {
      fenceBoundaryLine = false;
      const fence = markdownFenceAtLine(text, cursor);
      if (fence) {
        fenceBoundaryLine = true;
        if (fenceMarker !== null) {
          if (fence.marker === fenceMarker && fence.length >= fenceLength && !fence.tail.trim()) {
            fenceMarker = null;
            fenceLength = 0;
          }
        } else if (fence.marker !== '`' || !fence.tail.includes('`')) {
          fenceMarker = fence.marker;
          fenceLength = fence.length;
        }
      }
    }
    if (fenceMarker === null && !fenceBoundaryLine
      && text[cursor] === '`'
      && !hasEscapedBackslash(text, cursor)) {
      const runLength = backtickRunLength(text, cursor);
      if (runLength === delimiterLength) return cursor;
      cursor += runLength;
    } else {
      cursor += 1;
    }
  }
  return -1;
}

export function tokenizeMathInText(
  text: string,
  options: { includeBracketDisplay?: boolean } = {},
): MathToken[] {
  const tokens: MathToken[] = [];
  let buf = '';
  let i = 0;
  let fenceMarker: string | null = null;
  let fenceLength = 0;
  let fenceBoundaryLine = false;
  let inlineCodeClose = -1;

  const flushText = () => {
    if (buf) {
      tokens.push({ kind: 'text', value: buf });
      buf = '';
    }
  };

  while (i < text.length) {
    if (options.includeBracketDisplay && (i === 0 || text[i - 1] === '\n')) {
      fenceBoundaryLine = false;
      const fence = markdownFenceAtLine(text, i);
      if (fence) {
        fenceBoundaryLine = true;
        if (fenceMarker !== null) {
          if (fence.marker === fenceMarker && fence.length >= fenceLength && !fence.tail.trim()) {
            fenceMarker = null;
            fenceLength = 0;
          }
        } else if (fence.marker !== '`' || !fence.tail.includes('`')) {
          fenceMarker = fence.marker;
          fenceLength = fence.length;
        }
      }
    }

    if (options.includeBracketDisplay && inlineCodeClose < i) inlineCodeClose = -1;
    if (options.includeBracketDisplay
      && fenceMarker === null
      && !fenceBoundaryLine
      && inlineCodeClose < i
      && text[i] === '`'
      && !hasEscapedBackslash(text, i)) {
      const runLength = backtickRunLength(text, i);
      const close = findMatchingInlineCodeClose(text, i + runLength, runLength);
      if (close !== -1) inlineCodeClose = close + runLength - 1;
    }

    const bracketMathAllowed = options.includeBracketDisplay === true
      && fenceMarker === null
      && !fenceBoundaryLine
      && inlineCodeClose < i;
    if (bracketMathAllowed
      && text[i] === '\\'
      && text[i + 1] === '['
      && !hasEscapedBackslash(text, i)) {
      const close = findUnescapedBracketClose(text, i + 2);
      if (close !== -1) {
        const raw = text.slice(i, close + 2);
        const expr = text.slice(i + 2, close);
        flushText();
        tokens.push({ kind: 'display', raw, expr });
        i = close + 2;
        continue;
      }
    }

    if (text[i] === '\\' && text[i + 1] === '$') {
      buf += '$';
      i += 2;
      continue;
    }

    if (text[i] === '$' && text[i + 1] === '$') {
      const close = text.indexOf('$$', i + 2);
      if (close !== -1) {
        const raw = text.slice(i, close + 2);
        const expr = text.slice(i + 2, close);
        flushText();
        tokens.push({ kind: 'display', raw, expr });
        i = close + 2;
        continue;
      }
      buf += '$';
      i += 1;
      continue;
    }

    if (text[i] === '$') {
      let matched: { j: number; expr: string; raw: string } | null = null;
      let j = i + 1;
      while (j < text.length) {
        if (text[j] === '\\' && text[j + 1] === '$') {
          j += 2;
          continue;
        }
        if (text[j] === '$') {
          const expr = text.slice(i + 1, j);
          const raw = text.slice(i, j + 1);
          if (isValidInlineMath(expr)) {
            matched = { j, expr, raw };
            break;
          }
        }
        if (text[j] === '\n') break;
        j += 1;
      }
      if (matched) {
        flushText();
        tokens.push({ kind: 'inline', raw: matched.raw, expr: matched.expr });
        i = matched.j + 1;
        continue;
      }
      buf += '$';
      i += 1;
      continue;
    }

    buf += text[i];
    i += 1;
  }

  flushText();
  return tokens;
}

export type MathSlotToken = MathInlineToken | MathDisplayToken;

export function protectMathSegments(
  text: string,
  renderSlot: (token: MathSlotToken) => string,
): { work: string; slots: string[] } {
  const tokens = tokenizeMathInText(text);
  const slots: string[] = [];
  let work = '';
  for (const tok of tokens) {
    if (tok.kind === 'text') {
      work += tok.value;
    } else {
      slots.push(renderSlot(tok));
      work += `\u0000M${slots.length - 1}\u0000`;
    }
  }
  return { work, slots };
}

export function restoreMathPlaceholders(html: string, slots: string[]): string {
  return html.replace(/\u0000M(\d+)\u0000/g, (_m, i: string) => slots[Number(i)] ?? '');
}

/** Protect math in markdown source before line/block parsing. */
export function protectMathInMarkdown(md: string): { text: string; mathBlocks: string[] } {
  const mathBlocks: string[] = [];
  const tokens = tokenizeMathInText(md, { includeBracketDisplay: true });
  const text = tokens.map(tok => {
    if (tok.kind === 'text') return tok.value;
    mathBlocks.push(tok.raw);
    return `%%M${mathBlocks.length - 1}%%`;
  }).join('');
  return { text, mathBlocks };
}
