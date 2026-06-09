import {
  defaultDatabaseViewColumns,
  normalizeDatabaseViewColumns,
} from './databaseViewConfig';
import {
  getTableConfig,
  setBoardGroupBy,
  setViewPresentation,
  withPresentationDefaults,
} from './databasePresentationConfig';
import type {
  DatabaseView,
  DatabaseViewColumnEntry,
  DatabaseViewPresentation,
  DatabaseViewSort,
} from './databaseViewModels';
import { isBuiltinColumnKey } from './databaseViewModels';

function updateViewTable(
  view: DatabaseView,
  updater: (columns: DatabaseViewColumnEntry[], sort: DatabaseViewSort) => {
    columns: DatabaseViewColumnEntry[];
    sort: DatabaseViewSort;
  },
): DatabaseView {
  const table = getTableConfig(view);
  const next = updater(table.columns, table.sort);
  return withPresentationDefaults({
    ...view,
    presentationConfig: {
      type: 'table',
      columns: normalizeDatabaseViewColumns(next.columns),
      sort: next.sort,
    },
  });
}

export function addDatabaseViewColumn(view: DatabaseView, key: string): DatabaseView {
  const trimmed = key.trim();
  if (!trimmed) return view;

  const table = getTableConfig(view);
  const columns = normalizeDatabaseViewColumns(table.columns);
  const existing = columns.find(entry => entry.key.toLowerCase() === trimmed.toLowerCase());
  const nextColumns = existing
    ? columns.map(entry =>
      entry.key.toLowerCase() === trimmed.toLowerCase()
        ? { ...entry, visible: true }
        : entry,
    )
    : [...columns, { key: trimmed, visible: true }];

  return updateViewTable(view, () => ({
    columns: nextColumns,
    sort: table.sort,
  }));
}

export function removeDatabaseViewColumn(view: DatabaseView, key: string): DatabaseView {
  const trimmed = key.trim();
  if (!trimmed || isBuiltinColumnKey(trimmed)) {
    return setDatabaseViewColumnVisibility(view, trimmed, false);
  }

  const table = getTableConfig(view);
  const columns = normalizeDatabaseViewColumns(table.columns);
  return updateViewTable(view, () => ({
    columns: columns.filter(entry => entry.key.toLowerCase() !== trimmed.toLowerCase()),
    sort: table.sort,
  }));
}

export function setDatabaseViewColumnVisibility(
  view: DatabaseView,
  key: string,
  visible: boolean,
): DatabaseView {
  const trimmed = key.trim();
  if (!trimmed) return view;

  const table = getTableConfig(view);
  const columns = normalizeDatabaseViewColumns(table.columns);
  const exists = columns.some(entry => entry.key.toLowerCase() === trimmed.toLowerCase());
  const next = exists
    ? columns.map(entry =>
      entry.key.toLowerCase() === trimmed.toLowerCase() ? { ...entry, visible } : entry,
    )
    : [...columns, { key: trimmed, visible }];

  return updateViewTable(view, () => ({
    columns: next,
    sort: table.sort,
  }));
}

export function showDatabaseViewColumn(view: DatabaseView, key: string): DatabaseView {
  return setDatabaseViewColumnVisibility(view, key, true);
}

export function hideDatabaseViewColumn(view: DatabaseView, key: string): DatabaseView {
  return setDatabaseViewColumnVisibility(view, key, false);
}

export function setDatabaseViewSort(
  view: DatabaseView,
  sort: DatabaseViewSort,
): DatabaseView {
  const key = sort.key.trim();
  if (!key) return view;
  const direction = sort.direction === 'asc' ? 'asc' : 'desc';
  const table = getTableConfig(view);
  return updateViewTable(view, () => ({
    columns: table.columns,
    sort: { key, direction },
  }));
}

export function setDatabaseViewPresentation(
  view: DatabaseView,
  presentation: DatabaseViewPresentation,
): DatabaseView {
  return setViewPresentation(view, presentation);
}

export function setDatabaseViewGroupBy(view: DatabaseView, groupBy: string): DatabaseView {
  return setBoardGroupBy(view, groupBy);
}

export function updateDatabaseViewConfig(
  views: readonly DatabaseView[],
  id: string,
  updater: (view: DatabaseView) => DatabaseView,
): DatabaseView[] {
  return views.map(view => (view.id === id ? updater(view) : view));
}
