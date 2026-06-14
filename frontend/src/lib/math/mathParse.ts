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

export function tokenizeMathInText(text: string): MathToken[] {
  const tokens: MathToken[] = [];
  let buf = '';
  let i = 0;

  const flushText = () => {
    if (buf) {
      tokens.push({ kind: 'text', value: buf });
      buf = '';
    }
  };

  while (i < text.length) {
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
  const tokens = tokenizeMathInText(md);
  const text = tokens.map(tok => {
    if (tok.kind === 'text') return tok.value;
    mathBlocks.push(tok.raw);
    return `%%M${mathBlocks.length - 1}%%`;
  }).join('');
  return { text, mathBlocks };
}
