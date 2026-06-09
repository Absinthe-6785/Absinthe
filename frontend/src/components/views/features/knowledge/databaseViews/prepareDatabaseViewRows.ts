import type { NoteBase } from '../../../noteUtils';
import type { KnowledgeIndexService } from '../KnowledgeIndexService';
import {
  defaultDatabaseViewColumns,
  DEFAULT_DATABASE_VIEW_SORT,
  normalizeDatabaseViewColumns,
  normalizeDatabaseViewSort,
} from './databaseViewConfig';
import { filterByDatabaseView } from './filterByDatabaseView';
import type { DatabaseView } from './databaseViewModels';
import { sortDatabaseViewRows } from './sortDatabaseViewRows';

/** Apply defaults to a database view config */
export function withDatabaseViewDefaults(view: DatabaseView): DatabaseView {
  return {
    ...view,
    columns: normalizeDatabaseViewColumns(view.columns ?? defaultDatabaseViewColumns()),
    sort: normalizeDatabaseViewSort(view.sort ?? DEFAULT_DATABASE_VIEW_SORT),
  };
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
  const configured = withDatabaseViewDefaults(view);
  const filtered = filterByDatabaseView(
    notes.filter(note => !note.deletedAt),
    service,
    configured,
  ).notes;
  return sortDatabaseViewRows(filtered, configured.sort!, service);
}
