/**
 * K-96B — IndexedDB migration storage audit (test/dev only).
 */
import { buildLargeVaultDataset } from '@/dev/realisticUsageFixture';
import { NOTES_KEY, type NoteBase } from '@/components/views/noteUtils';
import {
  NOTES_IDB_MIGRATION_FLAG,
  countIndexedDbNotes,
  saveNotesToIndexedDb,
} from '@/lib/noteIndexedDb';
import {
  initNotesPersistence,
  resetNotesPersistenceForTests,
} from '@/lib/notePersistence';

export const K96B_NOTE_COUNTS = [100, 300, 1000, 3000] as const;
export type K96BNoteCount = (typeof K96B_NOTE_COUNTS)[number];

export interface K96BStorageAuditRow {
  noteCount: number;
  localStorageBeforeBytes: number;
  localStorageAfterBytes: number;
  indexedDbRecordCount: number;
  migrationMs: number;
  loadMs: number;
  startupMs: number;
}

export function measureLocalStorageBytes(key: string): number {
  try {
    return localStorage.getItem(key)?.length ?? 0;
  } catch {
    return 0;
  }
}

export function seedLegacyLocalStorageNotes(notes: readonly NoteBase[]): number {
  const json = JSON.stringify(notes);
  localStorage.setItem(NOTES_KEY, json);
  localStorage.removeItem(NOTES_IDB_MIGRATION_FLAG);
  return json.length;
}

export async function runK96BStorageAuditRow(noteCount: number): Promise<K96BStorageAuditRow> {
  resetNotesPersistenceForTests();
  localStorage.removeItem(NOTES_IDB_MIGRATION_FLAG);
  await saveNotesToIndexedDb([]);

  const { notes } = buildLargeVaultDataset({ noteCount });
  const localStorageBeforeBytes = seedLegacyLocalStorageNotes(notes);

  const startupStarted = performance.now();
  const init = await initNotesPersistence();
  const startupMs = performance.now() - startupStarted;

  const localStorageAfterBytes = measureLocalStorageBytes(NOTES_KEY);
  const indexedDbRecordCount = await countIndexedDbNotes();

  return {
    noteCount,
    localStorageBeforeBytes,
    localStorageAfterBytes,
    indexedDbRecordCount,
    migrationMs: init.migrationMs,
    loadMs: init.loadMs,
    startupMs,
  };
}

export async function runK96BStorageMatrix(): Promise<K96BStorageAuditRow[]> {
  const rows: K96BStorageAuditRow[] = [];
  for (const noteCount of K96B_NOTE_COUNTS) {
    rows.push(await runK96BStorageAuditRow(noteCount));
  }
  return rows;
}

export function formatK96BStorageAuditReport(rows: readonly K96BStorageAuditRow[]): string {
  const lines = ['K-96B IndexedDB storage audit', ''];
  for (const row of rows) {
    const beforeMb = (row.localStorageBeforeBytes / (1024 * 1024)).toFixed(2);
    const afterKb = (row.localStorageAfterBytes / 1024).toFixed(1);
    lines.push(
      `${row.noteCount} notes — localStorage ${beforeMb} MB → ${afterKb} KB | `
      + `IDB ${row.indexedDbRecordCount} records | migration ${row.migrationMs.toFixed(1)}ms | `
      + `load ${row.loadMs.toFixed(1)}ms | startup ${row.startupMs.toFixed(1)}ms`,
    );
  }
  return lines.join('\n');
}
