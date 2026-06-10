import type { NoteBase } from '../../../noteUtils';
import type { KnowledgeIndexService } from '../KnowledgeIndexService';
import { filterByDatabaseView } from './filterByDatabaseView';
import type { DatabaseView } from './databaseViewModels';

/** Evaluate database view rows via the query engine — never stores note ids */
export function evaluateDatabaseView(
  view: DatabaseView,
  service: KnowledgeIndexService,
  notes: readonly NoteBase[],
): string[] {
  return filterByDatabaseView(
    notes.filter(note => !note.deletedAt),
    service,
    view,
  ).notes.map(note => note.id);
}
