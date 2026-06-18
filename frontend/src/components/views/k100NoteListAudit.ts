/**
 * K-100 — Note list workflow audit.
 */
import { NOTE_LIST_SECTION_PREFS_KEY } from './noteListSectionPrefs';
import { NOTE_SORT_STORAGE_KEY } from './noteListSortPreference';

export const K100_NOTE_LIST_FEATURES = [
  'sort-persisted',
  'folder-sort',
  'starred-first',
  'pinned-collapse',
  'recent-collapse',
  'density-row-height',
] as const;

export interface K100NoteListRow {
  feature: (typeof K100_NOTE_LIST_FEATURES)[number];
  storageKey?: string;
}

export function auditNoteListFeatures(): K100NoteListRow[] {
  return [
    { feature: 'sort-persisted', storageKey: NOTE_SORT_STORAGE_KEY },
    { feature: 'folder-sort' },
    { feature: 'starred-first', storageKey: NOTE_SORT_STORAGE_KEY },
    { feature: 'pinned-collapse', storageKey: NOTE_LIST_SECTION_PREFS_KEY },
    { feature: 'recent-collapse', storageKey: NOTE_LIST_SECTION_PREFS_KEY },
    { feature: 'density-row-height' },
  ];
}

export function formatK100NoteListReport(rows: readonly K100NoteListRow[]): string {
  const lines = ['K-100 note list audit', ''];
  for (const row of rows) {
    lines.push(`  ${row.feature}${row.storageKey ? ` (${row.storageKey})` : ''}`);
  }
  return lines.join('\n');
}
