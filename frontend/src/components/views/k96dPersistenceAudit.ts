/**
 * K-96D — Persistence cleanup and storage audit (test/dev only).
 */
import { buildLargeVaultDataset } from '@/dev/realisticUsageFixture';
import { NOTES_KEY, type NoteBase } from '@/components/views/noteUtils';
import {
  NOTES_IDB_MIGRATION_FLAG,
  countIndexedDbNotes,
  saveNotesToIndexedDb,
} from '@/lib/noteIndexedDb';
import {
  getPersistenceMetrics,
  countLegacyStorageKeys,
  countOrphanSnapshotKeys,
  LEGACY_NOTE_STORAGE_KEYS,
  auditLocalStorageKeys,
  summarizeStorageAudit,
} from '@/lib/persistenceCleanup';
import {
  initNotesPersistence,
  resetNotesPersistenceForTests,
} from '@/lib/notePersistence';
import { createLastSnapshot } from '@/lib/vaultSnapshotAuto';
import {
  SNAPSHOT_CHUNK_PREFIX,
  SNAPSHOT_META_PREFIX,
} from '@/lib/vaultSnapshotConstants';
import {
  clearAllVaultSnapshots,
  loadSnapshotPayload,
  type SnapshotStorageAdapter,
} from '@/lib/vaultSnapshotStore';

export const K96D_NOTE_COUNTS = [100, 300, 1000, 3000] as const;
export type K96DNoteCount = (typeof K96D_NOTE_COUNTS)[number];

export interface K96DPersistenceAuditRow {
  noteCount: number;
  localStorageBytes: number;
  snapshotBytes: number;
  indexedDbRecordCount: number;
  orphanCount: number;
  legacyKeyCount: number;
  reclaimedBytes: number;
}

export interface K96DStorageInventory {
  localStorageKeyCount: number;
  snapshotKeyCount: number;
  migrationMarkerCount: number;
  revisionKeyCount: number;
  legacyKeyCount: number;
  orphanKeyCount: number;
  totalBytes: number;
}

function makeMemoryStorage(): SnapshotStorageAdapter {
  const map = new Map<string, string>();
  return {
    get length() { return map.size; },
    key: (index: number) => [...map.keys()][index] ?? null,
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => { map.set(key, value); },
    removeItem: (key: string) => { map.delete(key); },
  };
}

export function inventoryPersistenceStorage(
  storage: SnapshotStorageAdapter = localStorage,
): K96DStorageInventory {
  const audit = auditLocalStorageKeys(storage);
  const summary = summarizeStorageAudit(audit);
  return {
    localStorageKeyCount: audit.length,
    snapshotKeyCount: summary.snapshotKeyCount,
    migrationMarkerCount: audit.filter(e => e.category === 'migration').length,
    revisionKeyCount: audit.filter(e => e.category === 'revision').length,
    legacyKeyCount: countLegacyStorageKeys(storage),
    orphanKeyCount: countOrphanSnapshotKeys(storage),
    totalBytes: summary.totalBytes,
  };
}

export function seedLegacyNoteKeys(storage: SnapshotStorageAdapter): void {
  for (const key of LEGACY_NOTE_STORAGE_KEYS) {
    storage.setItem(key, '[]');
  }
  storage.setItem('notes-storage-migrated-v2', '1');
}

export function seedOrphanSnapshotChunk(
  storage: SnapshotStorageAdapter,
  orphanId = 'orphan-snapshot-id',
): void {
  storage.setItem(
    `${SNAPSHOT_META_PREFIX}${orphanId}:v1`,
    JSON.stringify({ storageFormat: 'chunked-v1', chunkCount: 2, totalBytes: 10 }),
  );
  storage.setItem(`${SNAPSHOT_CHUNK_PREFIX}${orphanId}:0:v1`, '{"partial":');
  // chunk 1 missing — orphan meta/chunk mismatch
}

export function seedUnindexedSnapshotChunk(
  storage: SnapshotStorageAdapter,
  orphanId = 'unindexed-chunk-id',
): void {
  storage.setItem(`${SNAPSHOT_CHUNK_PREFIX}${orphanId}:0:v1`, '{"orphan":true}');
}

export async function measureK96DPersistenceRow(
  noteCount: number,
  storage: SnapshotStorageAdapter = localStorage,
): Promise<K96DPersistenceAuditRow> {
  resetNotesPersistenceForTests();
  clearAllVaultSnapshots(storage);
  storage.removeItem(NOTES_IDB_MIGRATION_FLAG);
  storage.removeItem(NOTES_KEY);
  await saveNotesToIndexedDb([]);

  const { notes } = buildLargeVaultDataset({ noteCount });
  const json = JSON.stringify(notes);
  storage.setItem(NOTES_KEY, json);
  seedLegacyNoteKeys(storage);
  seedOrphanSnapshotChunk(storage);
  seedUnindexedSnapshotChunk(storage);

  const auditBefore = summarizeStorageAudit(auditLocalStorageKeys(storage));
  const before = await getPersistenceMetrics(storage);
  await initNotesPersistence();
  createLastSnapshot(notes, []);

  const auditAfter = summarizeStorageAudit(auditLocalStorageKeys(storage));
  const after = await getPersistenceMetrics(storage);
  const snapshotStorageDelta = auditAfter.byCategory.snapshot - auditBefore.byCategory.snapshot;

  return {
    noteCount,
    localStorageBytes: after.localStorageBytes,
    snapshotBytes: after.snapshotBytes,
    indexedDbRecordCount: after.indexedDbRecordCount,
    orphanCount: before.orphanKeys,
    legacyKeyCount: before.legacyKeys,
    reclaimedBytes: Math.max(0, auditBefore.totalBytes - auditAfter.totalBytes + snapshotStorageDelta),
  };
}

export async function runK96DPersistenceMatrix(): Promise<K96DPersistenceAuditRow[]> {
  const rows: K96DPersistenceAuditRow[] = [];
  for (const noteCount of K96D_NOTE_COUNTS) {
    rows.push(await measureK96DPersistenceRow(noteCount));
  }
  return rows;
}

export function formatK96DPersistenceAuditReport(rows: readonly K96DPersistenceAuditRow[]): string {
  const lines = ['K-96D persistence cleanup audit', ''];
  for (const row of rows) {
    const lsKb = (row.localStorageBytes / 1024).toFixed(1);
    const snapMb = (row.snapshotBytes / (1024 * 1024)).toFixed(2);
    lines.push(
      `${row.noteCount} notes — localStorage ${lsKb} KB | snapshot ${snapMb} MB | `
      + `IDB ${row.indexedDbRecordCount} records | orphans ${row.orphanCount} | `
      + `legacy ${row.legacyKeyCount} | reclaimed ${(row.reclaimedBytes / 1024).toFixed(1)} KB`,
    );
  }
  return lines.join('\n');
}

export { makeMemoryStorage, loadSnapshotPayload };
