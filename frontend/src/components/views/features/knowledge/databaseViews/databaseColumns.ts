import type { DatabaseColumn } from './databaseViewModels';

/** Default Phase 1 table columns */
export const DEFAULT_TABLE_COLUMNS: readonly DatabaseColumn[] = [
  { id: 'title', key: 'title', label: 'Title' },
  { id: 'updatedAt', key: 'updatedAt', label: 'Updated' },
  { id: 'tags', key: 'tags', label: 'Tags' },
];
