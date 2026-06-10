import type { NoteBase } from '../../../noteUtils';
import type { KnowledgeIndexService } from '../KnowledgeIndexService';
import { getTableConfig, withPresentationDefaults } from './databasePresentationConfig';
import { filterByDatabaseView } from './filterByDatabaseView';
import type { DatabaseViewFilterOptions } from './resolveDatabaseViewQuery';
import type { DatabaseView } from './databaseViewModels';
import { sortDatabaseViewRows, resolveDatabaseViewSortRules } from './sortDatabaseViewRows';

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
  filterOptions: DatabaseViewFilterOptions = {},
): NoteBase[] {
  const configured = withPresentationDefaults(view);
  const table = getTableConfig(configured);
  const filtered = filterByDatabaseView(
    notes.filter(note => !note.deletedAt),
    service,
    configured,
    filterOptions,
  ).notes;
  return sortDatabaseViewRows(filtered, resolveDatabaseViewSortRules(table), service, table);
}
