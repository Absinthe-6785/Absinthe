// @vitest-environment happy-dom
/**
 * K-96D — Persistence cleanup, metrics, and cross-version safety tests.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';
import { buildLargeVaultDataset } from '@/dev/realisticUsageFixture';
import { NOTES_KEY, type NoteBase } from '@/components/views/noteUtils';
import {
  NOTES_IDB_MIGRATION_FLAG,
  NOTES_IDB_REV_KEY,
  countIndexedDbNotes,
  markIndexedDbMigrationComplete,
  saveNotesToIndexedDb,
} from '@/lib/noteIndexedDb';
import {
  cleanupLegacyStorageKeys,
  cleanupPersistenceOrphans,
  countLegacyStorageKeys,
  countOrphanSnapshotKeys,
  getPersistenceMetrics,
  runPersistenceCleanup,
  LEGACY_NOTE_STORAGE_KEYS,
} from '@/lib/persistenceCleanup';
import {
  getNotesPersistenceMode,
  initNotesPersistence,
  loadNotesAsync,
  resetNotesPersistenceForTests,
  saveNotesAsync,
} from '@/lib/notePersistence';
import {
  formatK96DPersistenceAuditReport,
  inventoryPersistenceStorage,
  makeMemoryStorage,
  measureK96DPersistenceRow,
  runK96DPersistenceMatrix,
  seedLegacyNoteKeys,
  seedOrphanSnapshotChunk,
  seedUnindexedSnapshotChunk,
} from '@/components/views/k96dPersistenceAudit';
import { buildVaultSnapshot, serializeVaultSnapshot } from '@/lib/vaultSnapshotBuild';
import { createLastSnapshot } from '@/lib/vaultSnapshotAuto';
import {
  SNAPSHOT_CHUNK_PREFIX,
  SNAPSHOT_INDEX_KEY,
  SNAPSHOT_META_PREFIX,
  SNAPSHOT_PAYLOAD_PREFIX,
} from '@/lib/vaultSnapshotConstants';
import {
  clearAllVaultSnapshots,
  enumerateVaultSnapshots,
  loadSnapshotPayload,
  saveVaultSnapshot,
  type SnapshotStorageAdapter,
} from '@/lib/vaultSnapshotStore';
import { validateVaultSnapshot } from '@/lib/vaultSnapshotValidate';
import { buildVaultBackupManifest } from '@/lib/exportVaultBackup';

describe('persistenceCleanup', () => {
  let storage: SnapshotStorageAdapter;

  beforeEach(() => {
    storage = makeMemoryStorage();
    resetNotesPersistenceForTests();
    localStorage.removeItem(NOTES_IDB_MIGRATION_FLAG);
  });

  it('removes legacy note keys after IndexedDB migration', () => {
    markIndexedDbMigrationComplete();
    storage.setItem(NOTES_KEY, '[]');
    seedLegacyNoteKeys(storage);

    const result = cleanupLegacyStorageKeys(storage);
    expect(result.removedKeys).toContain(NOTES_KEY);
    expect(LEGACY_NOTE_STORAGE_KEYS.every(k => storage.getItem(k) === null)).toBe(true);
    expect(storage.getItem('notes-storage-migrated-v2')).toBeNull();
    expect(result.bytesReclaimed).toBeGreaterThan(0);
  });

  it('does not remove notes-v2 when IndexedDB migration is incomplete', () => {
    storage.setItem(NOTES_KEY, '[{"id":"n1"}]');
    cleanupLegacyStorageKeys(storage);
    expect(storage.getItem(NOTES_KEY)).not.toBeNull();
  });

  it('removes orphan snapshot chunks without index entries', () => {
    seedUnindexedSnapshotChunk(storage, 'orphan-a');
    seedOrphanSnapshotChunk(storage, 'orphan-b');

    expect(countOrphanSnapshotKeys(storage)).toBeGreaterThan(0);
    const result = cleanupPersistenceOrphans(storage);
    expect(result.removedKeys.length).toBeGreaterThan(0);
    expect(countOrphanSnapshotKeys(storage)).toBe(0);

    cleanupPersistenceOrphans(storage);
    expect(countOrphanSnapshotKeys(storage)).toBe(0);
  });

  it('removes index entries whose payloads are missing', () => {
    const snapshot = buildVaultSnapshot([{ id: 'n1', title: 'T', body: '', updatedAt: 1 }], [], 'last', 'last');
    saveVaultSnapshot(snapshot, storage);
    storage.removeItem(`${SNAPSHOT_META_PREFIX}${snapshot.snapshotId}:v1`);
    for (let i = 0; i < 10; i += 1) {
      storage.removeItem(`${SNAPSHOT_CHUNK_PREFIX}${snapshot.snapshotId}:${i}:v1`);
    }
    storage.removeItem(`${SNAPSHOT_PAYLOAD_PREFIX}${snapshot.snapshotId}:v1`);

    cleanupPersistenceOrphans(storage);
    expect(enumerateVaultSnapshots(storage)).toHaveLength(0);
  });

  it('getPersistenceMetrics reports snapshot and legacy counts', async () => {
    markIndexedDbMigrationComplete();
    seedLegacyNoteKeys(storage);
    seedUnindexedSnapshotChunk(storage);

    const metrics = await getPersistenceMetrics(storage);
    expect(metrics.legacyKeys).toBeGreaterThan(0);
    expect(metrics.orphanKeys).toBeGreaterThan(0);
    expect(metrics.snapshotCount).toBe(0);
  });
});

describe('k96d cross-version safety', () => {
  beforeEach(async () => {
    localStorage.clear();
    resetNotesPersistenceForTests();
    clearAllVaultSnapshots();
    localStorage.removeItem(NOTES_IDB_MIGRATION_FLAG);
    await saveNotesToIndexedDb([]);
  });

  it('migrates localStorage notes to IndexedDB without data loss', async () => {
    const { notes } = buildLargeVaultDataset({ noteCount: 50 });
    localStorage.setItem(NOTES_KEY, JSON.stringify(notes));

    const init = await initNotesPersistence();
    expect(init.mode).toBe('indexeddb');
    expect(init.notes).toHaveLength(notes.length);
    expect(await countIndexedDbNotes()).toBe(notes.length);
    expect(localStorage.getItem(NOTES_KEY)).toBeNull();
  });

  it('loads K-96C chunked snapshots after cleanup', () => {
    const storage = makeMemoryStorage();
    const largeBody = 'content '.repeat(80_000);
    const snapshot = buildVaultSnapshot(
      [{ id: 'big', title: 'Big', body: largeBody, updatedAt: 1 }],
      [],
      'last',
      'last',
    );
    saveVaultSnapshot(snapshot, storage);
    cleanupPersistenceOrphans(storage);

    const loaded = loadSnapshotPayload(snapshot.snapshotId, storage);
    expect(loaded).not.toBeNull();
    expect(validateVaultSnapshot(loaded!).valid).toBe(true);
    expect(loaded?.vault.notes[0]?.markdown).toContain('content');
  });

  it('loads legacy single-blob snapshots and cleans orphans safely', () => {
    const storage = makeMemoryStorage();
    const snapshot = buildVaultSnapshot([{ id: 'legacy', title: 'L', body: '', updatedAt: 1 }], [], 'last', 'last');
    const serialized = serializeVaultSnapshot(snapshot);
    storage.setItem(`${SNAPSHOT_PAYLOAD_PREFIX}${snapshot.snapshotId}:v1`, serialized);
    storage.setItem(
      SNAPSHOT_INDEX_KEY,
      JSON.stringify({
        schemaVersion: 1,
        entries: [{
          snapshotId: snapshot.snapshotId,
          slot: 'last',
          slotKey: 'last',
          createdAt: snapshot.createdAt,
          contentFingerprint: snapshot.contentFingerprint,
          payloadBytes: serialized.length,
        }],
      }),
    );

    seedUnindexedSnapshotChunk(storage);
    runPersistenceCleanup(storage);

    expect(loadSnapshotPayload(snapshot.snapshotId, storage)?.snapshotId).toBe(snapshot.snapshotId);
    expect(countOrphanSnapshotKeys(storage)).toBe(0);
  });

  it('preserves export/import vault manifest compatibility', () => {
    const notes: NoteBase[] = [{ id: 'n1', title: 'Note', body: 'Body', updatedAt: 1 }];
    const exported = buildVaultBackupManifest(notes, []);
    const snapshot = buildVaultSnapshot(notes, [], 'last', 'last');
    expect(snapshot.vault.schemaVersion).toBe(exported.schemaVersion);
    expect(snapshot.vault.noteCount).toBe(exported.noteCount);
  });

  it('reflects cross-tab IndexedDB revision changes', async () => {
    await initNotesPersistence();
    const before = localStorage.getItem(NOTES_IDB_REV_KEY);
    await saveNotesAsync([{ id: 'x', title: 'X', body: '', updatedAt: Date.now() }]);
    const after = localStorage.getItem(NOTES_IDB_REV_KEY);
    expect(after).not.toBe(before);
    expect(getNotesPersistenceMode()).toBe('indexeddb');
    const reloaded = await loadNotesAsync();
    expect(reloaded.some(n => n.id === 'x')).toBe(true);
  });

  it('startup cleanup is idempotent', async () => {
    markIndexedDbMigrationComplete();
    seedLegacyNoteKeys(localStorage);
    seedOrphanSnapshotChunk(localStorage);

    runPersistenceCleanup();
    const firstLegacy = countLegacyStorageKeys(localStorage);
    const firstOrphans = countOrphanSnapshotKeys(localStorage);

    runPersistenceCleanup();
    expect(countLegacyStorageKeys(localStorage)).toBe(firstLegacy);
    expect(countOrphanSnapshotKeys(localStorage)).toBe(firstOrphans);
  });
});

describe('k96dPersistence audit matrix', () => {
  beforeEach(async () => {
    localStorage.clear();
    resetNotesPersistenceForTests();
    clearAllVaultSnapshots();
    localStorage.removeItem(NOTES_IDB_MIGRATION_FLAG);
    await saveNotesToIndexedDb([]);
  });

  it('measures persistence cleanup at 100 / 300 / 1000 / 3000 notes', async () => {
    const rows = await runK96DPersistenceMatrix();
    expect(rows).toHaveLength(4);
    for (const row of rows) {
      expect(row.indexedDbRecordCount).toBe(row.noteCount);
      expect(row.legacyKeyCount).toBeGreaterThan(0);
      expect(row.orphanCount).toBeGreaterThan(0);
      expect(row.reclaimedBytes).toBeGreaterThan(0);
    }
    // eslint-disable-next-line no-console
    console.log(formatK96DPersistenceAuditReport(rows));
  }, 120_000);

  it('inventory tracks snapshot and migration keys', async () => {
    const row = await measureK96DPersistenceRow(100);
    const inventory = inventoryPersistenceStorage();
    expect(inventory.localStorageKeyCount).toBeGreaterThan(0);
    expect(row.localStorageBytes).toBeGreaterThan(0);
    expect(inventory.revisionKeyCount).toBeGreaterThanOrEqual(1);
    expect(localStorage.getItem(SNAPSHOT_INDEX_KEY)).not.toBeNull();
  }, 30_000);
});
