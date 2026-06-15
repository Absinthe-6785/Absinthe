import { extractTags } from '@/components/views/noteUtils';

/** Plain-text note search against raw body (indexes LaTeX source, not rendered HTML). */
export function noteMatchesPlainSearch(body: string, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return body.toLowerCase().includes(q);
}

/** Search notes by body → title → tags in body (priority order for checks). */
export function noteMatchesSearch(
  note: { title?: string; body?: string },
  query: string,
): boolean {
  const q = query.trim();
  if (!q) return true;
  const lower = q.toLowerCase();
  const body = note.body ?? '';

  if (noteMatchesPlainSearch(body, q)) return true;
  if ((note.title ?? '').toLowerCase().includes(lower)) return true;
  if (extractTags(body).some(tag => tag.toLowerCase().includes(lower))) return true;

  return false;
}
