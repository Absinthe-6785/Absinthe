import type { NoteBase } from '../../../noteUtils';
import type { KnowledgeIndexService } from '../KnowledgeIndexService';
import { filterNotes } from '../query/filterNotes';
import type { DatabaseView } from './databaseViewModels';

/** Evaluate database view rows via the query engine — never stores note ids */
export function evaluateDatabaseView(
  view: DatabaseView,
  service: KnowledgeIndexService,
  notes: readonly NoteBase[],
): string[] {
  return filterNotes(
    notes.filter(note => !note.deletedAt),
    service,
    view.query,
  ).notes.map(note => note.id);
}
