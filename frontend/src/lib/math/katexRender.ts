import katex from 'katex';
import type { MathSlotToken } from './mathParse';

export function renderKatexHtml(expr: string, displayMode = true): string | null {
  const trimmed = expr.trim();
  if (!trimmed) return null;
  try {
    return katex.renderToString(trimmed, { displayMode, throwOnError: false });
  } catch {
    return null;
  }
}

export function renderInlineMathHtml(expr: string): string | null {
  return renderKatexHtml(expr, false);
}

export function renderDisplayMathHtml(expr: string): string | null {
  return renderKatexHtml(expr, true);
}

export function renderMathTokenHtml(token: MathSlotToken): string | null {
  return token.kind === 'display'
    ? renderDisplayMathHtml(token.expr)
    : renderInlineMathHtml(token.expr);
}

export function extractMathExpression(raw: string): { expr: string; displayMode: boolean } {
  const displayMode = raw.startsWith('$$');
  const expr = raw.replace(/^\$\$?/, '').replace(/\$\$?$/, '').trim();
  return { expr, displayMode };
}

export function renderProtectedMathBlock(raw: string): string {
  const { expr, displayMode } = extractMathExpression(raw);
  const html = renderKatexHtml(expr, displayMode);
  if (!html) return `<code class="bmerr">${raw}</code>`;
  return displayMode
    ? `<div class="bmathb">${html}</div>`
    : `<span class="bmathi">${html}</span>`;
}
