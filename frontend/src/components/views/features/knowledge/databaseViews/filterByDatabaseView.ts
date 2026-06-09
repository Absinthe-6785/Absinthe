import type { NoteBase } from '../../../noteUtils';
import type { KnowledgeIndexService } from '../KnowledgeIndexService';
import { filterNotes, type FilterNotesResult } from '../query/filterNotes';
import type { DatabaseView } from './databaseViewModels';

/**
 * Filter notes for a database view using the existing query engine.
 * Flow: view.query → parseQuery → evaluateQuery → filterNotes
 */
export function filterByDatabaseView(
  notes: readonly NoteBase[],
  service: KnowledgeIndexService,
  view: DatabaseView,
): FilterNotesResult {
  return filterNotes(notes, service, view.query);
}
