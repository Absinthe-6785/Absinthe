import type { LinkContext, NoteBase } from '../../../noteUtils';
import { hasUnlinkedMention, findMentionInText, bodyTextWithoutWikiLinks } from './mentionDetection';

/**
 * Extract contextual excerpts where targetTitle appears as an unlinked mention.
 */
export function extractMentionContexts(
  targetTitle: string,
  allNotes: NoteBase[],
  sourceNoteIds?: Set<string>,
  opts: { maxExcerpts?: number; excerptMax?: number } = {},
): LinkContext[] {
  if (!targetTitle.trim()) return [];

  const MAX_EXCERPTS = opts.maxExcerpts ?? 2;
  const EXCERPT_MAX = opts.excerptMax ?? 140;
  const results: LinkContext[] = [];

  for (const note of allNotes) {
    if (note.deletedAt) continue;
    if (sourceNoteIds && !sourceNoteIds.has(note.id)) continue;

    const body = note.body ?? '';
    if (!hasUnlinkedMention(body, targetTitle)) continue;

    const plainBody = bodyTextWithoutWikiLinks(body);
    const paragraphHasMention = (p: string) =>
      hasUnlinkedMention(p, targetTitle) || findMentionInText(p, targetTitle) !== null;

    const paragraphs = plainBody.split(/\n{2,}/);
    let excerpts = paragraphs
      .filter(paragraphHasMention)
      .slice(0, MAX_EXCERPTS)
      .map(p => {
        const clean = p
          .split('\n')
          .map(l => l.replace(/^#{1,6}\s+/, '').trim())
          .filter(Boolean)
          .join(' ');
        return clean.length > EXCERPT_MAX ? clean.slice(0, EXCERPT_MAX) + '…' : clean;
      });

    if (excerpts.length === 0) {
      excerpts = plainBody
        .split('\n')
        .filter(paragraphHasMention)
        .slice(0, MAX_EXCERPTS)
        .map(l => {
          const clean = l.replace(/^#{1,6}\s+/, '').trim();
          return clean.length > EXCERPT_MAX ? clean.slice(0, EXCERPT_MAX) + '…' : clean;
        });
    }

    if (excerpts.length > 0) {
      results.push({ noteId: note.id, noteTitle: note.title ?? '', excerpts });
    } else {
      results.push({ noteId: note.id, noteTitle: note.title ?? '', excerpts: [] });
    }
  }

  return results;
}
