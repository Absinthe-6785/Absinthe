import type { DatabaseColumn, DatabaseViewColumnEntry, DatabaseViewSort } from './databaseViewModels';
import { BUILTIN_COLUMN_KEYS, isBuiltinColumnKey } from './databaseViewModels';

/** Default Phase 1 table columns (all visible) */
export const DEFAULT_TABLE_COLUMNS: readonly DatabaseColumn[] = [
  { id: 'title', key: 'title', label: 'Title' },
  { id: 'updatedAt', key: 'updatedAt', label: 'Updated' },
  { id: 'tags', key: 'tags', label: 'Tags' },
];

export const DEFAULT_DATABASE_VIEW_SORT: DatabaseViewSort = {
  key: 'updatedAt',
  direction: 'desc',
};

export function defaultDatabaseViewColumns(): DatabaseViewColumnEntry[] {
  return BUILTIN_COLUMN_KEYS.map(key => ({ key, visible: true }));
}

export function columnLabelForKey(key: string): string {
  switch (key) {
    case 'title': return 'Title';
    case 'updatedAt': return 'Updated';
    case 'tags': return 'Tags';
    default: {
      const trimmed = key.trim();
      if (!trimmed) return key;
      return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
    }
  }
}

export function toDatabaseColumn(key: string): DatabaseColumn {
  return { id: key, key, label: columnLabelForKey(key) };
}

/** Normalize column config — ensures built-ins exist, drops invalid keys */
export function normalizeDatabaseViewColumns(raw: unknown): DatabaseViewColumnEntry[] {
  const entries: DatabaseViewColumnEntry[] = [];
  const seen = new Set<string>();

  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (!item || typeof item !== 'object') continue;
      const record = item as Partial<DatabaseViewColumnEntry>;
      if (typeof record.key !== 'string') continue;
      const key = record.key.trim();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      entries.push({ key, visible: record.visible !== false });
    }
  }

  for (const key of BUILTIN_COLUMN_KEYS) {
    if (!seen.has(key)) {
      entries.unshift({ key, visible: true });
      seen.add(key);
    }
  }

  return entries;
}

export function normalizeDatabaseViewSort(raw: unknown): DatabaseViewSort {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_DATABASE_VIEW_SORT };
  const record = raw as Partial<DatabaseViewSort>;
  const key = typeof record.key === 'string' && record.key.trim() ? record.key.trim() : DEFAULT_DATABASE_VIEW_SORT.key;
  const direction = record.direction === 'asc' || record.direction === 'desc'
    ? record.direction
    : DEFAULT_DATABASE_VIEW_SORT.direction;
  return { key, direction };
}

/** Visible columns in configured order */
export function resolveVisibleColumns(
  columns: readonly DatabaseViewColumnEntry[] | undefined,
): DatabaseColumn[] {
  const config = columns ?? defaultDatabaseViewColumns();
  return config
    .filter(entry => entry.visible)
    .map(entry => toDatabaseColumn(entry.key));
}

/** All configured columns regardless of visibility */
export function resolveAllColumnKeys(
  columns: readonly DatabaseViewColumnEntry[] | undefined,
): string[] {
  return (columns ?? defaultDatabaseViewColumns()).map(entry => entry.key);
}

export function isPropertyColumnKey(key: string): boolean {
  return !isBuiltinColumnKey(key);
}
