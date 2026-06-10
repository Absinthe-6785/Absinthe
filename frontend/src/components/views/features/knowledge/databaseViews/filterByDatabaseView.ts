import type { NoteBase } from '../../../noteUtils';
import type { KnowledgeIndexService } from '../KnowledgeIndexService';
import { getTableConfig } from './databasePresentationConfig';
import { filterNotes, type FilterNotesResult } from '../query/filterNotes';
import type { DatabaseView } from './databaseViewModels';

/**
 * Filter notes for a database view using the query engine.
 * Flow: view.query → parseQuery → evaluateQuery → formula post-filter → filterNotes
 */
export function filterByDatabaseView(
  notes: readonly NoteBase[],
  service: KnowledgeIndexService,
  view: DatabaseView,
): FilterNotesResult {
  const table = getTableConfig(view);
  return filterNotes(notes, service, view.query, {
    formulaColumns: table.formulaColumns ?? [],
  });
}
