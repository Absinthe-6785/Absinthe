import type { NoteBase } from '../../../noteUtils';
import type { KnowledgeIndexService } from '../KnowledgeIndexService';
import { getTableConfig } from './databasePresentationConfig';
import { filterNotes, type FilterNotesResult } from '../query/filterNotes';
import type { DatabaseView } from './databaseViewModels';
import {
  resolveDatabaseViewEffectiveQuery,
  type DatabaseViewFilterOptions,
} from './resolveDatabaseViewQuery';

/**
 * Filter notes for a database view using the query engine.
 * Flow: effectiveQuery → parseQuery → evaluateQuery → formula/post-filter → filterNotes
 */
export function filterByDatabaseView(
  notes: readonly NoteBase[],
  service: KnowledgeIndexService,
  view: DatabaseView,
  options: DatabaseViewFilterOptions = {},
): FilterNotesResult {
  const table = getTableConfig(view);
  const query = resolveDatabaseViewEffectiveQuery(view, options);
  return filterNotes(notes, service, query, {
    formulaColumns: table.formulaColumns ?? [],
  });
}
