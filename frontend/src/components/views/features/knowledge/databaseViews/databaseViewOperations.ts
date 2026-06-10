import {
  defaultDatabaseViewColumns,
  normalizeDatabaseViewColumns,
} from './databaseViewConfig';
import {
  getTableConfig,
  setBoardGroupBy,
  setCalendarDateProperty,
  setTimelineEndDateProperty,
  setTimelineStartDateProperty,
  setViewPresentation,
  withPresentationDefaults,
} from './databasePresentationConfig';
import type { DatabaseTableConfig } from './databasePresentationModels';
import type {
  DatabaseView,
  DatabaseViewColumnEntry,
  DatabaseViewPresentation,
  DatabaseViewSort,
} from './databaseViewModels';
import { isBuiltinColumnKey } from './databaseViewModels';
import type { FormulaColumnDefinition } from '../formulas/formulaModels';
import { normalizeFormulaColumns } from '../formulas/formulaModels';
import type { RollupColumnDefinition, RollupDefinition } from '../rollups/rollupModels';
import { normalizeRollupColumns } from '../rollups/rollupModels';

function updateViewTable(
  view: DatabaseView,
  updater: (table: DatabaseTableConfig) => DatabaseTableConfig,
): DatabaseView {
  const table = getTableConfig(view);
  const next = updater(table);
  return withPresentationDefaults({
    ...view,
    presentationConfig: {
      type: 'table',
      columns: normalizeDatabaseViewColumns(next.columns),
      sort: next.sort,
      rollupColumns: normalizeRollupColumns(next.rollupColumns),
      formulaColumns: normalizeFormulaColumns(next.formulaColumns),
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

  return updateViewTable(view, table => ({
    ...table,
    columns: nextColumns,
  }));
}

export function removeDatabaseViewColumn(view: DatabaseView, key: string): DatabaseView {
  const trimmed = key.trim();
  if (!trimmed || isBuiltinColumnKey(trimmed)) {
    return setDatabaseViewColumnVisibility(view, trimmed, false);
  }

  const table = getTableConfig(view);
  const columns = normalizeDatabaseViewColumns(table.columns);
  return updateViewTable(view, current => ({
    ...current,
    columns: columns.filter(entry => entry.key.toLowerCase() !== trimmed.toLowerCase()),
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

  return updateViewTable(view, current => ({
    ...current,
    columns: next,
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
  return updateViewTable(view, table => ({
    ...table,
    sort: { key, direction },
  }));
}

function columnKeyTaken(table: DatabaseTableConfig, key: string): boolean {
  const norm = key.toLowerCase();
  return (
    table.columns.some(entry => entry.key.toLowerCase() === norm)
    || (table.rollupColumns ?? []).some(entry => entry.key.toLowerCase() === norm)
    || (table.formulaColumns ?? []).some(entry => entry.key.toLowerCase() === norm)
  );
}

function rollupColumnKeyTaken(table: DatabaseTableConfig, key: string): boolean {
  return columnKeyTaken(table, key);
}

export function addDatabaseViewRollupColumn(
  view: DatabaseView,
  column: RollupColumnDefinition,
): DatabaseView {
  const key = column.key.trim();
  if (!key) return view;

  const table = getTableConfig(view);
  const rollupColumns = normalizeRollupColumns(table.rollupColumns);
  const existing = rollupColumns.find(entry => entry.key.toLowerCase() === key.toLowerCase());
  const nextColumns = existing
    ? rollupColumns.map(entry =>
      entry.key.toLowerCase() === key.toLowerCase()
        ? { ...column, key, visible: true }
        : entry,
    )
    : rollupColumnKeyTaken(table, key)
      ? rollupColumns
      : [...rollupColumns, { ...column, key, visible: column.visible !== false }];

  return updateViewTable(view, current => ({
    ...current,
    rollupColumns: nextColumns,
  }));
}

export function addDatabaseViewRollupDefinition(
  view: DatabaseView,
  key: string,
  rollup: RollupDefinition,
  label?: string,
): DatabaseView {
  return addDatabaseViewRollupColumn(view, {
    key,
    visible: true,
    rollup,
    ...(label?.trim() ? { label: label.trim() } : {}),
  });
}

export function removeDatabaseViewRollupColumn(view: DatabaseView, key: string): DatabaseView {
  const trimmed = key.trim();
  if (!trimmed) return view;

  const table = getTableConfig(view);
  return updateViewTable(view, current => ({
    ...current,
    rollupColumns: normalizeRollupColumns(table.rollupColumns)
      .filter(entry => entry.key.toLowerCase() !== trimmed.toLowerCase()),
  }));
}

export function setDatabaseViewRollupColumnVisibility(
  view: DatabaseView,
  key: string,
  visible: boolean,
): DatabaseView {
  const trimmed = key.trim();
  if (!trimmed) return view;

  const table = getTableConfig(view);
  const rollupColumns = normalizeRollupColumns(table.rollupColumns);
  const exists = rollupColumns.some(entry => entry.key.toLowerCase() === trimmed.toLowerCase());
  if (!exists) return view;

  return updateViewTable(view, current => ({
    ...current,
    rollupColumns: rollupColumns.map(entry =>
      entry.key.toLowerCase() === trimmed.toLowerCase()
        ? { ...entry, visible }
        : entry,
    ),
  }));
}

export function addDatabaseViewFormulaColumn(
  view: DatabaseView,
  column: FormulaColumnDefinition,
): DatabaseView {
  const key = column.key.trim();
  if (!key) return view;

  const table = getTableConfig(view);
  const formulaColumns = normalizeFormulaColumns(table.formulaColumns);
  const existing = formulaColumns.find(entry => entry.key.toLowerCase() === key.toLowerCase());
  const nextColumns = existing
    ? formulaColumns.map(entry =>
      entry.key.toLowerCase() === key.toLowerCase()
        ? { ...column, key, visible: true }
        : entry,
    )
    : columnKeyTaken(table, key)
      ? formulaColumns
      : [...formulaColumns, { ...column, key, visible: column.visible !== false }];

  return updateViewTable(view, current => ({
    ...current,
    formulaColumns: nextColumns,
  }));
}

export function removeDatabaseViewFormulaColumn(view: DatabaseView, key: string): DatabaseView {
  const trimmed = key.trim();
  if (!trimmed) return view;

  const table = getTableConfig(view);
  return updateViewTable(view, current => ({
    ...current,
    formulaColumns: normalizeFormulaColumns(table.formulaColumns)
      .filter(entry => entry.key.toLowerCase() !== trimmed.toLowerCase()),
  }));
}

export function setDatabaseViewFormulaColumnVisibility(
  view: DatabaseView,
  key: string,
  visible: boolean,
): DatabaseView {
  const trimmed = key.trim();
  if (!trimmed) return view;

  const table = getTableConfig(view);
  const formulaColumns = normalizeFormulaColumns(table.formulaColumns);
  const exists = formulaColumns.some(entry => entry.key.toLowerCase() === trimmed.toLowerCase());
  if (!exists) return view;

  return updateViewTable(view, current => ({
    ...current,
    formulaColumns: formulaColumns.map(entry =>
      entry.key.toLowerCase() === trimmed.toLowerCase()
        ? { ...entry, visible }
        : entry,
    ),
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

export function setDatabaseViewDateProperty(view: DatabaseView, dateProperty: string): DatabaseView {
  return setCalendarDateProperty(view, dateProperty);
}

export function setDatabaseViewTimelineStartProperty(view: DatabaseView, startDateProperty: string): DatabaseView {
  return setTimelineStartDateProperty(view, startDateProperty);
}

export function setDatabaseViewTimelineEndProperty(view: DatabaseView, endDateProperty: string): DatabaseView {
  return setTimelineEndDateProperty(view, endDateProperty);
}

export function updateDatabaseViewConfig(
  views: readonly DatabaseView[],
  id: string,
  updater: (view: DatabaseView) => DatabaseView,
): DatabaseView[] {
  return views.map(view => (view.id === id ? updater(view) : view));
}
