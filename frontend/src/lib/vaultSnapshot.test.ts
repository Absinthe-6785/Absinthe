import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NoteBase } from '@/components/views/noteUtils';
import { buildVaultBackupManifest } from './exportVaultBackup';
import { buildVaultRestorePreview } from './importVaultBackup';
import {
  buildVaultSnapshot,
  parseVaultSnapshotJson,
  serializeVaultSnapshot,
  toRestoreReadyManifest,
} from './vaultSnapshotBuild';
import {
  clearAllVaultSnapshots,
  enumerateVaultSnapshots,
  loadSnapshotPayload,
  saveVaultSnapshot,
  type SnapshotStorageAdapter,
} from './vaultSnapshotStore';
import { SNAPSHOT_PAYLOAD_PREFIX } from './vaultSnapshotConstants';
import { validateVaultSnapshot, validateVaultSnapshotJson } from './vaultSnapshotValidate';
import {
  createDailySnapshot,
  createLastSnapshot,
  createWeeklySnapshot,
  flushAutoSnapshotForTests,
  resetAutoSnapshotStateForTests,
  scheduleAutoSnapshot,
  computeSnapshotContentFingerprint,
} from './vaultSnapshotAuto';
import { VAULT_SNAPSHOT_SCHEMA_VERSION } from './vaultSnapshotConstants';

function note(id: string, title = 'Note', body = 'Hello'): NoteBase {
  return {
    id,
    title,
    body,
    folderId: null,
    starred: false,
    deletedAt: null,
    createdAt: 1,
    updatedAt: 1,
    properties: { tags: ['math'] },
    relations: {},
  };
}

function makeStorage(): SnapshotStorageAdapter {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => { store.set(key, value); },
    removeItem: (key: string) => { store.delete(key); },
    get length() { return store.size; },
    key: (index: number) => [...store.keys()][index] ?? null,
  };
}

describe('vaultSnapshot', () => {
  let storage: SnapshotStorageAdapter;

  beforeEach(() => {
    storage = makeStorage();
    vi.stubGlobal('localStorage', storage);
    clearAllVaultSnapshots(storage);
    resetAutoSnapshotStateForTests();
  });

  it('creates snapshot with vault manifest and extensions', () => {
    const snapshot = buildVaultSnapshot([note('n1')], [{ id: 'f1', name: 'Work', createdAt: 1 }], 'last', 'last');
    expect(snapshot.snapshotSchemaVersion).toBe(VAULT_SNAPSHOT_SCHEMA_VERSION);
    expect(snapshot.vault.notes).toHaveLength(1);
    expect(snapshot.extensions.cloudScope.workoutHistory).toBe('cloud-only');
    expect(snapshot.scope.included).toContain('notes');
    expect(snapshot.scope.excluded).toContain('knowledge-index');
  });

  it('saves and enumerates snapshots', () => {
    const snapshot = buildVaultSnapshot([note('n1')], [], 'last', 'last');
    const result = saveVaultSnapshot(snapshot, storage);
    expect(result.saved).toBe(true);
    const listed = enumerateVaultSnapshots(storage);
    expect(listed).toHaveLength(1);
    expect(listed[0]?.noteCount).toBe(1);
  });

  it('skips unchanged last snapshot', () => {
    const notes = [note('n1')];
    createLastSnapshot(notes, []);
    const second = createLastSnapshot(notes, []);
    expect(second.skipped).toBe(true);
    expect(enumerateVaultSnapshots(storage)).toHaveLength(1);
  });

  it('uses stable fingerprint despite changing vault export timestamps', () => {
    vi.useFakeTimers();
    const notes = [note('n1')];
    const first = buildVaultSnapshot(notes, [], 'last', 'last');
    vi.advanceTimersByTime(5_000);
    const second = buildVaultSnapshot(notes, [], 'last', 'last');
    vi.useRealTimers();
    expect(first.vault.exportedAt).not.toBe(second.vault.exportedAt);
    expect(first.contentFingerprint).toBe(second.contentFingerprint);
  });

  it('rotates daily snapshots and prunes beyond retention', () => {
    for (let day = 1; day <= 10; day++) {
      const date = new Date(`2026-06-${String(day).padStart(2, '0')}T12:00:00Z`);
      createDailySnapshot([note(`n${day}`, `Day ${day}`)], [], date);
    }
    const daily = enumerateVaultSnapshots(storage).filter(s => s.slot === 'daily');
    expect(daily.length).toBeLessThanOrEqual(7);
  });

  it('keeps weekly snapshot slot per ISO week', () => {
    createWeeklySnapshot([note('w1')], [], new Date('2026-06-10T12:00:00Z'));
    createWeeklySnapshot([note('w1', 'Updated')], [], new Date('2026-06-12T12:00:00Z'));
    const weekly = enumerateVaultSnapshots(storage).filter(s => s.slot === 'weekly');
    expect(weekly).toHaveLength(1);
    const payload = loadSnapshotPayload(weekly[0]!.snapshotId, storage);
    expect(payload?.vault.notes[0]?.title).toBe('Updated');
  });

  it('validates snapshot integrity and fingerprint', () => {
    const snapshot = buildVaultSnapshot([note('n1')], [], 'last', 'last');
    saveVaultSnapshot(snapshot, storage);
    const loaded = loadSnapshotPayload(snapshot.snapshotId, storage)!;
    const report = validateVaultSnapshot(loaded);
    expect(report.valid).toBe(true);
    expect(report.restoreReady).toBe(true);
    expect(report.fingerprintMatch).toBe(true);
  });

  it('detects fingerprint tampering', () => {
    const snapshot = buildVaultSnapshot([note('n1')], [], 'last', 'last');
    snapshot.contentFingerprint = 'deadbeef';
    const report = validateVaultSnapshot(snapshot);
    expect(report.valid).toBe(false);
    expect(report.errors).toContain('fingerprint_mismatch');
  });

  it('simulates restore via vault manifest preview', () => {
    const snapshot = buildVaultSnapshot([note('n1', 'Backup')], [], 'last', 'last');
    const manifest = toRestoreReadyManifest(snapshot);
    const preview = buildVaultRestorePreview(manifest, [note('n1', 'Local')], []);
    expect(preview.valid).toBe(true);
    expect(preview.conflictCount).toBe(1);
  });

  it('round-trips JSON serialization', () => {
    const snapshot = buildVaultSnapshot([note('n1')], [], 'last', 'last');
    const parsed = parseVaultSnapshotJson(serializeVaultSnapshot(snapshot));
    expect(parsed?.snapshotId).toBe(snapshot.snapshotId);
    expect(validateVaultSnapshotJson(serializeVaultSnapshot(snapshot)).valid).toBe(true);
  });

  it('handles future snapshot schema as unsupported', () => {
    const snapshot = buildVaultSnapshot([note('n1')], [], 'last', 'last');
    (snapshot as { snapshotSchemaVersion: number }).snapshotSchemaVersion = 99;
    const report = validateVaultSnapshot(snapshot);
    expect(report.errors).toContain('unsupported_snapshot_schema');
  });

  it('debounced auto snapshot flushes on demand', () => {
    vi.useFakeTimers();
    scheduleAutoSnapshot([note('n1')], []);
    vi.advanceTimersByTime(30_000);
    flushAutoSnapshotForTests();
    expect(enumerateVaultSnapshots(storage).some(s => s.slot === 'last')).toBe(true);
    vi.useRealTimers();
  });

  it('skips scheduling when content fingerprint unchanged', () => {
    vi.useFakeTimers();
    const notes = [note('n1')];
    scheduleAutoSnapshot(notes, []);
    vi.advanceTimersByTime(30_000);
    flushAutoSnapshotForTests();
    const countAfterFirst = enumerateVaultSnapshots(storage).length;
    scheduleAutoSnapshot(notes, []);
    vi.advanceTimersByTime(30_000);
    flushAutoSnapshotForTests();
    expect(enumerateVaultSnapshots(storage).length).toBe(countAfterFirst);
    vi.useRealTimers();
  });

  it('persists snapshots as chunked payloads', () => {
    const largeBody = 'x'.repeat(500_000);
    const snapshot = buildVaultSnapshot([note('big', 'Big', largeBody)], [], 'last', 'last');
    const result = saveVaultSnapshot(snapshot, storage);
    expect(result.saved).toBe(true);
    expect(result.chunkCount).toBeGreaterThan(1);
    expect(result.writeCount).toBe((result.chunkCount ?? 0) + 1);
    const loaded = loadSnapshotPayload(snapshot.snapshotId, storage);
    expect(loaded?.vault.notes[0]?.markdown).toContain('xxx');
  });

  it('loads legacy single-blob snapshots', () => {
    const snapshot = buildVaultSnapshot([note('legacy')], [], 'last', 'last');
    const serialized = serializeVaultSnapshot(snapshot);
    storage.setItem(`${SNAPSHOT_PAYLOAD_PREFIX}${snapshot.snapshotId}:v1`, serialized);
    const parsed = loadSnapshotPayload(snapshot.snapshotId, storage);
    expect(parsed?.snapshotId).toBe(snapshot.snapshotId);
    expect(validateVaultSnapshot(parsed!).valid).toBe(true);
  });

  it('excludes deleted notes from compacted snapshots', () => {
    const snapshot = buildVaultSnapshot(
      [note('active'), { ...note('trash', 'Trash'), deletedAt: 100 }],
      [],
      'last',
      'last',
    );
    expect(snapshot.vault.notes).toHaveLength(1);
    expect(snapshot.vault.notes[0]?.id).toBe('active');
  });

  it('computeSnapshotContentFingerprint is stable for identical vaults', () => {
    const notes = [note('n1')];
    const a = computeSnapshotContentFingerprint(notes, []);
    const b = computeSnapshotContentFingerprint(notes, []);
    expect(a).toBe(b);
  });

  it('vault manifest schema remains compatible with export', () => {
    const snapshot = buildVaultSnapshot([note('n1')], [], 'last', 'last');
    const exported = buildVaultBackupManifest([note('n1')], []);
    expect(snapshot.vault.schemaVersion).toBe(exported.schemaVersion);
    expect(snapshot.vault.app).toBe('absinthe');
  });
});
