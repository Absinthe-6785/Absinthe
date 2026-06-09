import type { NoteBase } from '../../../noteUtils';
import type { KnowledgeIndexService } from '../KnowledgeIndexService';
import { getTableConfig, withPresentationDefaults } from './databasePresentationConfig';
import { filterByDatabaseView } from './filterByDatabaseView';
import type { DatabaseView } from './databaseViewModels';
import { sortDatabaseViewRows } from './sortDatabaseViewRows';

/** Apply defaults to a database view config */
export function withDatabaseViewDefaults(view: DatabaseView): DatabaseView {
  return withPresentationDefaults(view);
}

/**
 * Full database view row pipeline: filter via query engine, then sort.
 * Query semantics are unchanged — sorting is post-filter only.
 */
export function prepareDatabaseViewRows(
  view: DatabaseView,
  notes: readonly NoteBase[],
  service: KnowledgeIndexService,
): NoteBase[] {
  const configured = withPresentationDefaults(view);
  const table = getTableConfig(configured);
  const filtered = filterByDatabaseView(
    notes.filter(note => !note.deletedAt),
    service,
    configured,
  ).notes;
  return sortDatabaseViewRows(filtered, table.sort, service);
}
