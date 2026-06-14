/** Plain-text note search against raw body (indexes LaTeX source, not rendered HTML). */
export function noteMatchesPlainSearch(body: string, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return body.toLowerCase().includes(q);
}
