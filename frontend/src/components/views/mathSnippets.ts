export interface MathSnippet {
  id: string;
  label: string;
  latex: string;
}

export const MATH_SNIPPETS: readonly MathSnippet[] = [
  { id: 'frac', label: '분수', latex: '\\frac{a}{b}' },
  { id: 'power', label: '제곱', latex: 'x^{2}' },
  { id: 'sqrt', label: '√', latex: '\\sqrt{x}' },
  { id: 'integral', label: '적분', latex: '\\int_{0}^{1} x^{2}\\,dx' },
  { id: 'sum', label: '합', latex: '\\sum_{i=1}^{n} i' },
  { id: 'limit', label: '극한', latex: '\\lim_{x \\to 0} f(x)' },
  { id: 'matrix', label: '행렬', latex: '\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}' },
];

/** Insert snippet at textarea caret, or append when no caret context. */
export function insertMathSnippetAt(
  value: string,
  snippet: string,
  selectionStart: number,
  selectionEnd: number,
): { value: string; selectionStart: number; selectionEnd: number } {
  const before = value.slice(0, selectionStart);
  const after = value.slice(selectionEnd);
  const needsSpaceBefore = before.length > 0 && !/\s$/.test(before);
  const needsSpaceAfter = after.length > 0 && !/^\s/.test(after);
  const insert = `${needsSpaceBefore ? ' ' : ''}${snippet}${needsSpaceAfter ? ' ' : ''}`;
  const next = before + insert + after;
  const start = before.length + (needsSpaceBefore ? 1 : 0);
  const end = start + snippet.length;
  return { value: next, selectionStart: start, selectionEnd: end };
}
