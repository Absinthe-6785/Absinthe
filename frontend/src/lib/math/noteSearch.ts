import type { NoteBase } from '@/components/views/noteUtils';
import { extractTags } from '@/components/views/noteUtils';
import { listTags } from '@/components/views/features/knowledge/tags/noteTags';

/** Plain-text note search against raw body (indexes LaTeX source, not rendered HTML). */
export function noteMatchesPlainSearch(body: string, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return body.toLowerCase().includes(q);
}

/**
 * Match quality score for sidebar / workspace ranking.
 * Lower = better rank.
 * 0 exact title → 1 title prefix → 2 title contains → 3 body word start → 4 body contains → 5 tag exact → 6 tag partial
 */
export const NOTE_SEARCH_RANKING_DOC = `
Search ranking (lower score = higher rank):
1. Exact title match (0)
2. Title prefix match (1)
3. Title partial match (2)
4. Body match at word boundary (3)
5. Body substring match (4)
6. Exact tag match (5)
7. Tag partial match (6)
`;

export function noteSearchScore(
  note: Pick<NoteBase, 'title' | 'body' | 'properties'>,
  query: string,
): number | null {
  const q = query.trim();
  if (!q) return null;
  const lower = q.toLowerCase();
  const titleLower = (note.title ?? '').trim().toLowerCase();
  const body = note.body ?? '';

  if (titleLower === lower) return 0;
  if (titleLower.startsWith(lower)) return 1;
  if (titleLower.includes(lower)) return 2;

  if (noteMatchesPlainSearch(body, q)) {
    const bodyLower = body.toLowerCase();
    const idx = bodyLower.indexOf(lower);
    if (idx >= 0) {
      const wordStart = idx === 0 || !/\w/.test(bodyLower.charAt(idx - 1));
      return wordStart ? 3 : 4;
    }
  }

  const tags = [...new Set([...extractTags(body), ...listTags(note as NoteBase)])];
  for (const tag of tags) {
    const tagLower = tag.toLowerCase();
    if (tagLower === lower) return 5;
    if (tagLower.includes(lower)) return 6;
  }

  return null;
}

/** Search notes by body, title, or tags — returns true when noteSearchScore finds a match. */
export function noteMatchesSearch(
  note: Pick<NoteBase, 'title' | 'body' | 'properties'>,
  query: string,
): boolean {
  const q = query.trim();
  if (!q) return true;
  return noteSearchScore(note, q) !== null;
}
