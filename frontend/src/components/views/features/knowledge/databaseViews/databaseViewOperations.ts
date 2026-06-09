import {
  defaultDatabaseViewColumns,
  normalizeDatabaseViewColumns,
} from './databaseViewConfig';
import type {
  DatabaseView,
  DatabaseViewColumnEntry,
  DatabaseViewSort,
} from './databaseViewModels';
import { isBuiltinColumnKey } from './databaseViewModels';

function updateViewColumns(
  view: DatabaseView,
  columns: DatabaseViewColumnEntry[],
): DatabaseView {
  return { ...view, columns: normalizeDatabaseViewColumns(columns) };
}

export function addDatabaseViewColumn(view: DatabaseView, key: string): DatabaseView {
  const trimmed = key.trim();
  if (!trimmed) return view;

  const columns = normalizeDatabaseViewColumns(view.columns ?? defaultDatabaseViewColumns());
  const existing = columns.find(entry => entry.key.toLowerCase() === trimmed.toLowerCase());
  if (existing) {
    return updateViewColumns(view, columns.map(entry =>
      entry.key.toLowerCase() === trimmed.toLowerCase()
        ? { ...entry, visible: true }
        : entry,
    ));
  }

  return updateViewColumns(view, [...columns, { key: trimmed, visible: true }]);
}

export function removeDatabaseViewColumn(view: DatabaseView, key: string): DatabaseView {
  const trimmed = key.trim();
  if (!trimmed || isBuiltinColumnKey(trimmed)) {
    return setDatabaseViewColumnVisibility(view, trimmed, false);
  }

  const columns = normalizeDatabaseViewColumns(view.columns ?? defaultDatabaseViewColumns());
  return updateViewColumns(
    view,
    columns.filter(entry => entry.key.toLowerCase() !== trimmed.toLowerCase()),
  );
}

export function setDatabaseViewColumnVisibility(
  view: DatabaseView,
  key: string,
  visible: boolean,
): DatabaseView {
  const trimmed = key.trim();
  if (!trimmed) return view;

  const columns = normalizeDatabaseViewColumns(view.columns ?? defaultDatabaseViewColumns());
  const exists = columns.some(entry => entry.key.toLowerCase() === trimmed.toLowerCase());
  const next = exists
    ? columns.map(entry =>
      entry.key.toLowerCase() === trimmed.toLowerCase() ? { ...entry, visible } : entry,
    )
    : [...columns, { key: trimmed, visible }];

  return updateViewColumns(view, next);
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
  return { ...view, sort: { key, direction } };
}

export function updateDatabaseViewConfig(
  views: readonly DatabaseView[],
  id: string,
  updater: (view: DatabaseView) => DatabaseView,
): DatabaseView[] {
  return views.map(view => (view.id === id ? updater(view) : view));
}
