import type { NoteBase } from '../../../noteUtils';
import type { KnowledgeIndexService } from '../KnowledgeIndexService';
import { evaluateQuery } from './evaluateQuery';
import { hasKnowledgeQuerySyntax, isKnowledgeQuery, parseQuery } from './parseQuery';
import type { ParsedQuery } from './queryModels';

export interface FilterNotesResult {
  notes: NoteBase[];
  parsed: ParsedQuery;
  matchedIds: Set<string> | null;
  usedKnowledgeQuery: boolean;
}

/** Filter notes using indexed metadata when query uses key:value syntax */
export function filterNotes(
  notes: readonly NoteBase[],
  service: KnowledgeIndexService,
  query: string,
): FilterNotesResult {
  const trimmed = query.trim();
  const parsed = parseQuery(trimmed);

  if (!trimmed) {
    return { notes: [...notes], parsed, matchedIds: null, usedKnowledgeQuery: false };
  }

  if (!hasKnowledgeQuerySyntax(trimmed)) {
    return { notes: [...notes], parsed, matchedIds: null, usedKnowledgeQuery: false };
  }

  if (!isKnowledgeQuery(trimmed)) {
    return { notes: [], parsed, matchedIds: new Set(), usedKnowledgeQuery: true };
  }

  if (parsed.error) {
    return { notes: [], parsed, matchedIds: new Set(), usedKnowledgeQuery: true };
  }

  const matchedIds = evaluateQuery(service, parsed);
  if (!matchedIds) {
    return { notes: [...notes], parsed, matchedIds: null, usedKnowledgeQuery: true };
  }

  const filtered = notes.filter(note => matchedIds.has(note.id));
  return { notes: filtered, parsed, matchedIds, usedKnowledgeQuery: true };
}
