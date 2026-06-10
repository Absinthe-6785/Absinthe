import { getTableConfig, withPresentationDefaults } from './databasePresentationConfig';
import type { DatabaseView } from './databaseViewModels';
import {
  mergeQueryWithVisualFilter,
  type VisualFilterModel,
} from '../query/visualFilterModels';

export interface DatabaseViewFilterOptions {
  /** Ephemeral session overlay — not persisted on DatabaseView */
  sessionFilter?: VisualFilterModel | null;
}

/** Resolve the effective query string for a database view (persisted + session filters) */
export function resolveDatabaseViewEffectiveQuery(
  view: DatabaseView,
  options: DatabaseViewFilterOptions = {},
): string {
  const configured = withPresentationDefaults(view);
  const table = getTableConfig(configured);
  let query = configured.query.trim();

  if (table.visualFilters) {
    query = mergeQueryWithVisualFilter(query, table.visualFilters);
  }

  if (options.sessionFilter) {
    query = mergeQueryWithVisualFilter(query, options.sessionFilter);
  }

  return query;
}

export function getDatabaseViewVisualFilters(view: DatabaseView) {
  return getTableConfig(withPresentationDefaults(view)).visualFilters ?? null;
}
