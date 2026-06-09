/** Phase 1 presentation modes — table only implemented in K-9 */
export type DatabaseViewPresentation = 'table' | 'board' | 'calendar';

export type DatabaseSortDirection = 'asc' | 'desc';

/** Column entry stored on a database view — visibility + key */
export interface DatabaseViewColumnEntry {
  key: string;
  visible: boolean;
}

/** Single active sort rule for table rows */
export interface DatabaseViewSort {
  key: string;
  direction: DatabaseSortDirection;
}

/** User-defined database view — stores query rule and table config, not note ids */
export interface DatabaseView {
  id: string;
  name: string;
  query: string;
  presentation: DatabaseViewPresentation;
  columns?: DatabaseViewColumnEntry[];
  sort?: DatabaseViewSort;
}

/** Resolved column for table rendering */
export interface DatabaseColumn {
  id: string;
  key: string;
  label: string;
}

export const BUILTIN_COLUMN_KEYS = ['title', 'updatedAt', 'tags'] as const;
export type BuiltinColumnKey = (typeof BUILTIN_COLUMN_KEYS)[number];

export function isBuiltinColumnKey(key: string): key is BuiltinColumnKey {
  return (BUILTIN_COLUMN_KEYS as readonly string[]).includes(key);
}
