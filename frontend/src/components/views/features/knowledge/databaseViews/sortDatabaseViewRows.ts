import type { NoteBase } from '../../../noteUtils';
import {
  getDatabaseFormulaCellValue,
  getDatabaseRollupCellValue,
} from '../components/DatabaseTableView';
import type { KnowledgeIndexService } from '../KnowledgeIndexService';
import {
  computeFormulasForNote,
  createFormulaComputeMemo,
  type FormulaComputeMemo,
} from '../formulas/computeFormulas';
import { getProperty } from '../properties/noteProperties';
import { listTags } from '../tags/noteTags';
import type { DatabaseTableConfig } from './databasePresentationModels';
import type { DatabaseViewSortRule } from './databasePresentationModels';
import type { DatabaseViewSort } from './databaseViewModels';
import { migrateLegacySortToSortRules } from './databaseSortFutureModels';

type SortComparable = string | number;

interface DatabaseSortContext {
  table: DatabaseTableConfig;
  notesById: ReadonlyMap<string, NoteBase>;
}

export function getDatabaseRowSortValue(
  note: NoteBase,
  key: string,
  service: KnowledgeIndexService,
): string | number {
  switch (key) {
    case 'title':
      return (note.title ?? '').toLowerCase();
    case 'updatedAt':
      return note.updatedAt ?? 0;
    case 'tags':
      return listTags(note).join(', ').toLowerCase();
    default: {
      const fromNote = getProperty(note, key);
      if (fromNote !== undefined) return fromNote.toLowerCase();
      const props = service.getProperties(note.id);
      const match = Object.entries(props).find(
        ([propKey]) => propKey.toLowerCase() === key.toLowerCase(),
      );
      return (match?.[1] ?? '').toLowerCase();
    }
  }
}

function resolveDatabaseSortValue(
  note: NoteBase,
  key: string,
  service: KnowledgeIndexService,
  context: DatabaseSortContext,
  formulaMemo: FormulaComputeMemo,
  precomputedFormulas?: ReadonlyMap<string, import('../formulas/formulaModels').FormulaValue>,
): SortComparable {
  if (key === 'title' || key === 'updatedAt' || key === 'tags') {
    return getDatabaseRowSortValue(note, key, service);
  }

  const rollup = context.table.rollupColumns?.find(
    column => column.key.toLowerCase() === key.toLowerCase(),
  );
  if (rollup) {
    return getDatabaseRollupCellValue(note, rollup, service, context.notesById);
  }

  const formula = context.table.formulaColumns?.find(
    column => column.key.toLowerCase() === key.toLowerCase(),
  );
  if (formula && context.table.formulaColumns) {
    return getDatabaseFormulaCellValue(
      note,
      formula,
      service,
      context.notesById,
      context.table.formulaColumns,
      formulaMemo,
      precomputedFormulas,
    );
  }

  return getDatabaseRowSortValue(note, key, service);
}

function compareSortValues(a: SortComparable, b: SortComparable): number {
  if (typeof a === 'number' && typeof b === 'number') {
    return a - b;
  }

  const aNum = typeof a === 'number' ? a : Number(String(a));
  const bNum = typeof b === 'number' ? b : Number(String(b));
  if (Number.isFinite(aNum) && Number.isFinite(bNum)) {
    return aNum - bNum;
  }

  return String(a).localeCompare(String(b));
}

function compareNotesBySortRules(
  a: NoteBase,
  b: NoteBase,
  sortRules: readonly DatabaseViewSortRule[],
  cache: ReadonlyMap<string, ReadonlyMap<string, SortComparable>>,
): number {
  for (const rule of sortRules) {
    const aVal = cache.get(a.id)?.get(rule.key) ?? '';
    const bVal = cache.get(b.id)?.get(rule.key) ?? '';
    const cmp = compareSortValues(aVal, bVal);
    if (cmp !== 0) {
      return cmp * (rule.direction === 'asc' ? 1 : -1);
    }
  }

  return (a.title ?? '').localeCompare(b.title ?? '');
}

function buildSortValueCache(
  notes: readonly NoteBase[],
  sortRules: readonly DatabaseViewSortRule[],
  service: KnowledgeIndexService,
  context: DatabaseSortContext,
): Map<string, Map<string, SortComparable>> {
  const keys = [...new Set(sortRules.map(rule => rule.key))];
  const cache = new Map<string, Map<string, SortComparable>>();
  const formulaMemo = createFormulaComputeMemo();

  for (const note of notes) {
    const precomputed = context.table.formulaColumns?.length
      ? computeFormulasForNote(
        note,
        context.table.formulaColumns,
        service,
        context.notesById,
        formulaMemo,
      )
      : undefined;
    const rowCache = new Map<string, SortComparable>();
    for (const key of keys) {
      rowCache.set(key, resolveDatabaseSortValue(
        note,
        key,
        service,
        context,
        formulaMemo,
        precomputed,
      ));
    }
    cache.set(note.id, rowCache);
  }

  return cache;
}

export function resolveDatabaseViewSortRules(table: DatabaseTableConfig): DatabaseViewSortRule[] {
  return migrateLegacySortToSortRules(table.sort, table.sortRules);
}

export function resolveAllSortableKeys(table: DatabaseTableConfig): string[] {
  const keys = new Set<string>();
  for (const column of table.columns) {
    keys.add(column.key);
  }
  for (const column of table.rollupColumns ?? []) {
    keys.add(column.key);
  }
  for (const column of table.formulaColumns ?? []) {
    keys.add(column.key);
  }
  return [...keys];
}

export function sortDatabaseViewRows(
  notes: readonly NoteBase[],
  sortOrRules: DatabaseViewSort | readonly DatabaseViewSortRule[],
  service: KnowledgeIndexService,
  table?: DatabaseTableConfig,
): NoteBase[] {
  const sortRules = Array.isArray(sortOrRules)
    ? [...sortOrRules]
    : migrateLegacySortToSortRules(sortOrRules);

  if (sortRules.length === 0) return [...notes];

  if (!table) {
    const sort = sortRules[0];
    const direction = sort.direction === 'asc' ? 1 : -1;
    return [...notes].sort((a, b) => {
      const aVal = getDatabaseRowSortValue(a, sort.key, service);
      const bVal = getDatabaseRowSortValue(b, sort.key, service);
      let cmp = compareSortValues(aVal, bVal);
      if (cmp === 0) {
        cmp = (a.title ?? '').localeCompare(b.title ?? '');
      }
      return cmp * direction;
    });
  }

  const notesById = new Map(notes.map(note => [note.id, note]));
  const context: DatabaseSortContext = { table, notesById };
  const cache = buildSortValueCache(notes, sortRules, service, context);
  return [...notes].sort((a, b) => compareNotesBySortRules(a, b, sortRules, cache));
}

export type { DatabaseViewSortRule };
