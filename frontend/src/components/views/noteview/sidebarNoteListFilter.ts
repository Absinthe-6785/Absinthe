import type { NoteBase } from '../noteUtils';
import { noteSearchScore } from '../../../lib/math/noteSearch';
import { filterNotes } from '../features/knowledge/query/filterNotes';
import { hasKnowledgeQuerySyntax } from '../features/knowledge/query/parseQuery';
import type { KnowledgeIndexService } from '../features/knowledge/KnowledgeIndexService';
import type { FormulaColumnDefinition } from '../features/knowledge/formulas/formulaModels';

export interface SidebarNoteListFilterOptions {
  formulaColumns?: readonly FormulaColumnDefinition[];
}

/** Plain-text or knowledge-query filter for the sidebar note list (not find-in-note). */
export function filterNotesForSidebarList(
  notes: readonly NoteBase[],
  query: string,
  service: KnowledgeIndexService,
  options: SidebarNoteListFilterOptions = {},
): NoteBase[] {
  const trimmed = query.trim();
  if (!trimmed) return [...notes];

  if (hasKnowledgeQuerySyntax(trimmed)) {
    return filterNotes(notes, service, trimmed, {
      formulaColumns: options.formulaColumns,
    }).notes;
  }

  return notes
    .map(n => ({ n, score: noteSearchScore(n, trimmed) }))
    .filter((x): x is { n: NoteBase; score: number } => x.score !== null)
    .sort((a, b) => a.score - b.score || b.n.updatedAt - a.n.updatedAt)
    .map(x => x.n);
}
