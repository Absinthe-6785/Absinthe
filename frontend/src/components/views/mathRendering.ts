/** KaTeX HTML rendering for math blocks */

declare global {
  interface Window {
    katex?: { renderToString: (expr: string, opts?: object) => string };
  }
}

export function renderKatexHtml(expr: string, displayMode = true): string | null {
  const trimmed = expr.trim();
  if (!trimmed) return null;
  if (typeof window === 'undefined' || !window.katex) return null;
  try {
    return window.katex.renderToString(trimmed, { displayMode, throwOnError: false });
  } catch {
    return null;
  }
}
