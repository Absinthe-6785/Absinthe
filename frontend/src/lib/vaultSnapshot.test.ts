import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NoteBase } from '@/components/views/noteUtils';
import { buildVaultBackupManifest } from './exportVaultBackup';
import { buildVaultRestorePreview } from './importVaultBackup';
import {
  buildVaultSnapshot,
  parseVaultSnapshotJson,
  serializeVaultSnapshot,
  toRestoreReadyManifest,
  type VaultSnapshot,
} from './vaultSnapshotBuild';
import {
  clearAllVaultSnapshots,
  enumerateVaultSnapshots,
  loadSnapshotPayload,
  loadSnapshotIndex,
  saveVaultSnapshot,
  type SnapshotStorageAdapter,
} from './vaultSnapshotStore';
import {
  SNAPSHOT_PAYLOAD_PREFIX, SNAPSHOT_META_PREFIX, SNAPSHOT_CHUNK_PREFIX, SNAPSHOT_INDEX_KEY,
} from './vaultSnapshotConstants';
import { splitSnapshotIntoChunks } from './snapshotCompaction';
import { validateVaultSnapshot, validateVaultSnapshotJson } from './vaultSnapshotValidate';
import {
  createDailySnapshot,
  createLastSnapshot,
  createMonthlySnapshot,
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
    for (let day = 0; day < 35; day += 1) {
      const date = new Date(Date.UTC(2026, 0, 1 + day));
      createDailySnapshot([note(`n${day}`, `Day ${day}`)], [], date);
    }
    const daily = enumerateVaultSnapshots(storage).filter(s => s.slot === 'daily');
    expect(daily.length).toBeLessThanOrEqual(30);
  });

  it('rotates monthly snapshots and prunes beyond retention', () => {
    for (let month = 0; month < 15; month += 1) {
      const date = new Date(Date.UTC(2024, month, 15));
      createMonthlySnapshot([note(`m${month}`, `Month ${month}`)], [], date);
    }
    const monthly = enumerateVaultSnapshots(storage).filter(s => s.slot === 'monthly');
    expect(monthly.length).toBeLessThanOrEqual(12);
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

// ACTUAL_BROWSER_CONTRACT: a semantic Map simulation, NOT an executed browser
// qualification. Hooks throw BEFORE mutation; successful operations replace an
// entire key. Stronger adversaries are explicitly separated below.
function faultStorage() {
  const values = new Map<string, string>();
  const trace: { op: 'get' | 'set' | 'remove'; key: string }[] = [];
  const faults = {
    get: (_key: string): void => {},
    set: (_key: string, _value: string): void => {},
    remove: (_key: string): void => {},
    observed: (_op: 'set' | 'remove', _key: string): void => {},
  };
  const storage: SnapshotStorageAdapter = {
    getItem(key) { trace.push({ op: 'get', key }); faults.get(key); return values.get(key) ?? null; },
    setItem(key, value) {
      trace.push({ op: 'set', key }); faults.set(key, value); values.set(key, value);
      faults.observed('set', key);
    },
    removeItem(key) {
      trace.push({ op: 'remove', key }); faults.remove(key); values.delete(key);
      faults.observed('remove', key);
    },
    get length() { throw new Error('save must not enumerate the storage root'); },
    key() { throw new Error('save must not enumerate the storage root'); },
  };
  return { storage, values, trace, faults };
}

const legacyKey = (id: string) => `${SNAPSHOT_PAYLOAD_PREFIX}${id}:v1`;
const metadataKey = (id: string) => `${SNAPSHOT_META_PREFIX}${id}:v1`;
const partKey = (id: string, part: number) => `${SNAPSHOT_CHUNK_PREFIX}${id}:${part}:v1`;

function syntheticSnapshot(id: string, body = id, slot: VaultSnapshot['slot'] = 'last', slotKey: string = slot): VaultSnapshot {
  // Builders legitimately enumerate extension keys; the save adapter itself must
  // not. Keep all builder input reads in a separate empty synthetic namespace.
  vi.stubGlobal('localStorage', makeStorage());
  return {
    ...buildVaultSnapshot([note('synthetic-note', 'Synthetic', body)], [], slot, slotKey),
    snapshotId: id,
    createdAt: '2026-01-01T00:00:00.000Z',
  };
}

function expectUsable(snapshot: VaultSnapshot, storage: SnapshotStorageAdapter) {
  const loaded = loadSnapshotPayload(snapshot.snapshotId, storage);
  expect(loaded !== null, 'payload is readable, not merely an enumerated ID').toBe(true);
  expect(serializeVaultSnapshot(loaded!) === serializeVaultSnapshot(snapshot), 'exact payload bytes').toBe(true);
  const report = validateVaultSnapshot(loaded!);
  expect(report.valid && report.fingerprintMatch && report.restoreReady, 'usable recovery content').toBe(true);
}

function expectBytesPreserved(before: Map<string, string>, after: Map<string, string>) {
  for (const [key, value] of before) {
    expect(after.get(key) === value, `preserved bytes: ${key}`).toBe(true);
  }
}

function replacementFixture(legacy = false, oldSize = 500_000) {
  const f = faultStorage();
  vi.stubGlobal('localStorage', f.storage);
  const unrelated = syntheticSnapshot('m1-unrelated', 'unrelated', 'daily', 'daily-unrelated');
  const old = syntheticSnapshot('m1-old', 'o'.repeat(oldSize));
  const incoming = syntheticSnapshot('m1-new', 'n'.repeat(900_000));
  expect(saveVaultSnapshot(unrelated, f.storage).saved).toBe(true);
  expect(saveVaultSnapshot(old, f.storage).saved).toBe(true);
  if (legacy) {
    const index = loadSnapshotIndex(f.storage);
    const entry = index.entries.find(e => e.snapshotId === old.snapshotId)!;
    delete entry.chunkCount;
    delete entry.writeCount;
    f.values.set(SNAPSHOT_INDEX_KEY, JSON.stringify(index));
    f.values.set(legacyKey(old.snapshotId), serializeVaultSnapshot(old));
    const chunks = splitSnapshotIntoChunks(serializeVaultSnapshot(old));
    f.values.delete(metadataKey(old.snapshotId));
    chunks.forEach((_, i) => f.values.delete(partKey(old.snapshotId, i)));
  }
  expectUsable(old, f.storage);
  expectUsable(unrelated, f.storage);
  expect(loadSnapshotIndex(f.storage).entries.some(e => e.snapshotId === old.snapshotId)).toBe(true);
  const before = new Map(f.values);
  f.trace.length = 0;
  return { ...f, old, incoming, unrelated, before };
}

describe('M1 snapshot publication contract', () => {
  it.each(['metadata', 'first', 'middle', 'final', 'index'])('T01/T02/T03 preserves old and unrelated recovery copies when %s write rejects', point => {
    const f = replacementFixture();
    const target = point === 'metadata' ? metadataKey(f.incoming.snapshotId)
      : point === 'index' ? SNAPSHOT_INDEX_KEY
        : partKey(f.incoming.snapshotId, { first: 0, middle: 1, final: 2 }[point as 'first' | 'middle' | 'final']);
    f.faults.set = key => { if (key === target) throw new Error('write refused before mutation'); };
    const result = saveVaultSnapshot(f.incoming, f.storage);
    // In-memory trace records key order only; no note bodies or raw payloads logged.
    if (!f.values.has(metadataKey(f.old.snapshotId))) {
      process.stdout.write(`BASELINE_${point} ${JSON.stringify({
        mutations: f.trace.filter(e => e.op !== 'get'),
        indexUnchanged: f.values.get(SNAPSHOT_INDEX_KEY) === f.before.get(SNAPSHOT_INDEX_KEY),
        oldKeysRemaining: [...f.values.keys()].filter(k => k.includes(f.old.snapshotId)).length,
        newKeysRemaining: [...f.values.keys()].filter(k => k.includes(f.incoming.snapshotId)).length,
      })}\n`);
    }
    expect(result.saved, 'rejected replacement is not published').toBe(false);
    expect(result.skipped).toBe(false);
    expectBytesPreserved(f.before, f.values);
    expectUsable(f.old, f.storage);
    expectUsable(f.unrelated, f.storage);
    const listed = enumerateVaultSnapshots(f.storage);
    expect(listed.some(e => e.snapshotId === f.old.snapshotId && e.noteCount === 1)).toBe(true);
    expect(listed.some(e => e.snapshotId === f.incoming.snapshotId)).toBe(false);
  });

  it.each(['metadata', 'first', 'middle', 'final', 'index'])('T11 preserves a historical legacy base when %s rejects', point => {
    const f = replacementFixture(true);
    const target = point === 'metadata' ? metadataKey(f.incoming.snapshotId)
      : point === 'index' ? SNAPSHOT_INDEX_KEY
        : partKey(f.incoming.snapshotId, { first: 0, middle: 1, final: 2 }[point as 'first' | 'middle' | 'final']);
    f.faults.set = key => { if (key === target) throw new DOMException('capacity', 'QuotaExceededError'); };
    expect(saveVaultSnapshot(f.incoming, f.storage)).toEqual({ saved: false, skipped: false, reason: 'quota' });
    expectBytesPreserved(f.before, f.values);
    expectUsable(f.old, f.storage);
    expectUsable(f.unrelated, f.storage);
  });

  it('T03/T08/T13 supports permanent set/remove refusal without rollback writes', () => {
    const f = replacementFixture();
    let refused = false;
    f.faults.set = key => {
      if (key === SNAPSHOT_INDEX_KEY) refused = true;
      if (refused) throw new Error('permanent write refusal');
    };
    f.faults.remove = () => { throw new Error('permanent cleanup refusal'); };
    expect(saveVaultSnapshot(f.incoming, f.storage)).toEqual({ saved: false, skipped: false });
    expectBytesPreserved(f.before, f.values);
    expectUsable(f.old, f.storage);
    expect(loadSnapshotIndex(f.storage).entries.some(e => e.snapshotId === f.incoming.snapshotId)).toBe(false);
    // Retry with the same ID cannot overwrite residue, even when writes recover.
    f.faults.set = () => {};
    f.faults.remove = () => {};
    f.trace.length = 0;
    expect(saveVaultSnapshot(f.incoming, f.storage)).toEqual({ saved: false, skipped: false });
    expect(f.trace.filter(e => e.op !== 'get')).toEqual([]);
    const retry = { ...f.incoming, snapshotId: 'm1-fresh-retry' };
    expect(saveVaultSnapshot(retry, f.storage).saved).toBe(true);
    expectUsable(retry, f.storage);
    expectUsable(f.unrelated, f.storage);
    expect(f.values.has(metadataKey(f.incoming.snapshotId)), 'unknown residue is not swept').toBe(true);
  });

  it('T04 rejects each precommit read independently without altering the committed view', () => {
    const control = replacementFixture();
    expect(saveVaultSnapshot(control.incoming, control.storage).saved).toBe(true);
    const commit = control.trace.findIndex(e => e.op === 'set' && e.key === SNAPSHOT_INDEX_KEY);
    const requiredReads = control.trace.slice(0, commit).filter(e => e.op === 'get').length;
    expect(requiredReads).toBeGreaterThan(10);
    for (let rejectAt = 1; rejectAt <= requiredReads; rejectAt += 1) {
      const f = replacementFixture();
      let reads = 0;
      f.faults.get = () => { if (++reads === rejectAt) throw new Error('access denied'); };
      expect(saveVaultSnapshot(f.incoming, f.storage), `read rejection ${rejectAt}`).toEqual({ saved: false, skipped: false });
      f.faults.get = () => {};
      expectBytesPreserved(f.before, f.values);
      expectUsable(f.old, f.storage);
      expectUsable(f.unrelated, f.storage);
      expect(f.trace.some(e => e.op === 'set' && e.key === SNAPSHOT_INDEX_KEY)).toBe(false);
    }
  });

  it.each(['final', 'middle', 'legacy-json', 'read', 'identity', 'slot', 'slotKey', 'fingerprint', 'integrity'])(
    'T04-OLD/T06/T17-SKIP invalid unchanged rejection: %s', invalidity => {
      const f = replacementFixture(invalidity === 'legacy-json', 900_000);
      const index = loadSnapshotIndex(f.storage);
      const indexed = index.entries.find(e => e.snapshotId === f.old.snapshotId)!;
      const incoming = { ...f.old, snapshotId: 'm1-same-content-new-id' };
      if (invalidity === 'final') f.values.delete(partKey(f.old.snapshotId, 2));
      else if (invalidity === 'middle') f.values.delete(partKey(f.old.snapshotId, 1));
      else if (invalidity === 'legacy-json') f.values.set(legacyKey(f.old.snapshotId), '{broken');
      else if (invalidity === 'read') {
        f.faults.get = key => { if (key === metadataKey(f.old.snapshotId)) throw new Error('old read denied'); };
      } else {
        const corrupt = structuredClone(f.old);
        if (invalidity === 'identity') corrupt.snapshotId = 'wrong-id';
        if (invalidity === 'slot') corrupt.slot = 'weekly';
        if (invalidity === 'slotKey') corrupt.slotKey = 'wrong-key';
        if (invalidity === 'fingerprint') corrupt.contentFingerprint = '00000000';
        if (invalidity === 'integrity') corrupt.vault.notes[0]!.markdown += 'tampered';
        // A valid JSON envelope and exact indexed byte size, but invalid identity
        // or integrity. Do not let a mere size mismatch be the only oracle.
        const raw = serializeVaultSnapshot(corrupt);
        const parts = splitSnapshotIntoChunks(raw);
        f.values.set(metadataKey(f.old.snapshotId), JSON.stringify({ storageFormat: 'chunked-v1', chunkCount: parts.length, totalBytes: new TextEncoder().encode(raw).length }));
        parts.forEach((part, i) => f.values.set(partKey(f.old.snapshotId, i), part));
        indexed.payloadBytes = new TextEncoder().encode(raw).length;
        f.values.set(SNAPSHOT_INDEX_KEY, JSON.stringify(index));
        expect(serializeVaultSnapshot(loadSnapshotPayload(f.old.snapshotId, f.storage)!) === raw).toBe(true);
        if (invalidity === 'fingerprint' || invalidity === 'integrity') {
          expect(validateVaultSnapshot(corrupt).valid).toBe(false);
        }
      }
      if (invalidity === 'final' || invalidity === 'middle' || invalidity === 'legacy-json') {
        expect(loadSnapshotPayload(f.old.snapshotId, f.storage)).toBe(null);
      }
      if (invalidity === 'read') expect(() => loadSnapshotPayload(f.old.snapshotId, f.storage)).toThrow();
      const before = new Map(f.values);
      f.trace.length = 0;
      expect(incoming.contentFingerprint).toBe(indexed.contentFingerprint);
      expect(saveVaultSnapshot(incoming, f.storage)).toEqual({ saved: false, skipped: false });
      expect(f.trace.filter(e => e.op !== 'get')).toEqual([]);
      expectBytesPreserved(before, f.values);
      expect(f.values.size).toBe(before.size);
    },
  );

  it.each([false, true])('T06/T11/T12 valid unchanged skip validates the base, zero mutations (legacy=%s)', legacy => {
    const f = replacementFixture(legacy);
    expect(saveVaultSnapshot({ ...f.old, snapshotId: 'unused-new-id' }, f.storage)).toEqual({ saved: false, skipped: true, reason: 'unchanged' });
    expect(f.trace.filter(e => e.op !== 'get')).toEqual([]);
    expectBytesPreserved(f.before, f.values);
    expectUsable(f.old, f.storage);
  });

  it('T05 absent index is distinct from every malformed/untrusted index, including valid JSON wrong shapes', () => {
    const f = replacementFixture();
    const good = loadSnapshotIndex(f.storage);
    const e = good.entries[0]!;
    const wrapped = (entries: unknown) => JSON.stringify({ schemaVersion: 1, entries });
    const badFields = [
      { snapshotId: '' }, { snapshotId: null }, { slot: 'yearly' }, { slot: 1 },
      { slotKey: '  ' }, { contentFingerprint: '' }, { contentFingerprint: 1 },
      { createdAt: 'not-a-date' }, { createdAt: null }, { payloadBytes: -1 },
      { payloadBytes: null }, { payloadBytes: '5' }, { payloadBytes: 1.5 },
      { chunkCount: 0 }, { chunkCount: 1.5 }, { chunkCount: null }, { writeCount: -1 },
      { writeCount: '2' }, { writeCount: null },
    ];
    const bad = ['', '{', 'null', '[]', '"index"', JSON.stringify({ schemaVersion: 2, entries: [] }),
      wrapped(null), wrapped({}), wrapped([null]), wrapped([[]]), wrapped([{}]),
      ...badFields.map(patch => wrapped([{ ...e, ...patch }])),
      wrapped([e, { ...e, slotKey: 'other-key' }]), wrapped([e, { ...e, snapshotId: 'other-id' }]),
    ];
    for (const raw of bad) {
      f.values.set(SNAPSHOT_INDEX_KEY, raw);
      const before = new Map(f.values);
      f.trace.length = 0;
      expect(saveVaultSnapshot(f.incoming, f.storage)).toEqual({ saved: false, skipped: false });
      expect(f.trace.filter(e => e.op !== 'get')).toEqual([]);
      expectBytesPreserved(before, f.values);
      expect(f.values.size).toBe(before.size);
    }
    const absent = faultStorage();
    expect(saveVaultSnapshot(f.incoming, absent.storage).saved).toBe(true);
    expectUsable(f.incoming, absent.storage);
    // Save-private gate does not change public tolerant reader compatibility.
    f.values.set(SNAPSHOT_INDEX_KEY, '{');
    expect(loadSnapshotIndex(f.storage)).toEqual({ schemaVersion: 1, entries: [] });
  });

  it.each(['old-id', 'unrelated-id', 'legacy', 'metadata', 'chunk-0', 'chunk-1', 'chunk-2'])(
    'T06 rejects all planned key/ID collisions before any mutation: %s', collision => {
      const f = replacementFixture();
      if (collision === 'old-id') f.incoming.snapshotId = f.old.snapshotId;
      else if (collision === 'unrelated-id') f.incoming.snapshotId = f.unrelated.snapshotId;
      else {
        const key = collision === 'legacy' ? legacyKey(f.incoming.snapshotId)
          : collision === 'metadata' ? metadataKey(f.incoming.snapshotId)
            : partKey(f.incoming.snapshotId, Number(collision.slice(-1)));
        f.values.set(key, ''); // Empty string is occupied, not absent.
      }
      const before = new Map(f.values);
      expect(saveVaultSnapshot(f.incoming, f.storage)).toEqual({ saved: false, skipped: false });
      expect(f.trace.filter(e => e.op !== 'get')).toEqual([]);
      expectBytesPreserved(before, f.values);
      expect(f.values.size).toBe(before.size);
    },
  );

  it('T07/T14 verifies payload and index at every logical cut point; cleanup is strictly postcommit', () => {
    const f = replacementFixture();
    const oldKeys = [...f.before.keys()].filter(k => k.includes(f.old.snapshotId));
    const unrelatedKeys = [...f.before.keys()].filter(k => k.includes(f.unrelated.snapshotId));
    const cutPoints: { op: string; key: string; published: boolean; safe: boolean }[] = [];
    let committed = false;
    f.faults.observed = (op, key) => {
      if (op === 'set' && key === SNAPSHOT_INDEX_KEY) committed = true;
      const mapReader: SnapshotStorageAdapter = {
        getItem: k => f.values.get(k) ?? null,
        setItem: () => { throw new Error('read-only cut point'); },
        removeItem: () => { throw new Error('read-only cut point'); },
        length: 0, key: () => null,
      };
      const visible = committed ? f.incoming : f.old;
      const payload = loadSnapshotPayload(visible.snapshotId, mapReader);
      const exact = payload !== null && serializeVaultSnapshot(payload) === serializeVaultSnapshot(visible);
      const preserved = unrelatedKeys.every(k => f.values.get(k) === f.before.get(k))
        && (committed || oldKeys.every(k => f.values.get(k) === f.before.get(k)));
      const indexed = loadSnapshotIndex(mapReader).entries.some(e => e.snapshotId === visible.snapshotId);
      cutPoints.push({ op, key, published: committed, safe: exact && indexed && preserved });
    };
    expect(saveVaultSnapshot(f.incoming, f.storage)).toMatchObject({ saved: true, skipped: false, snapshotId: f.incoming.snapshotId, chunkCount: 3, writeCount: 4 });
    expect(cutPoints.length).toBeGreaterThan(6);
    expect(cutPoints.every(p => p.safe), 'all logical-map interruption snapshots retain the appropriate view').toBe(true);
    expect(cutPoints.filter(p => p.op === 'remove').every(p => p.published)).toBe(true);
    expect(oldKeys.every(k => !f.values.has(k))).toBe(true);
    expectUsable(f.incoming, f.storage);
    expectUsable(f.unrelated, f.storage);
    // Readback must precede the index write, even if the payload is intact later.
    const commit = f.trace.findIndex(e => e.op === 'set' && e.key === SNAPSHOT_INDEX_KEY);
    for (const key of [metadataKey(f.incoming.snapshotId), ...[0, 1, 2].map(i => partKey(f.incoming.snapshotId, i))]) {
      const write = f.trace.findIndex(e => e.op === 'set' && e.key === key);
      expect(f.trace.slice(write + 1, commit).some(e => e.op === 'get' && e.key === key), `readback before publication: ${key}`).toBe(true);
    }
  });

  it.each(['remove-first', 'remove-later', 'read'])('T09 cleanup %s refusal cannot falsify confirmed publication', refusal => {
    const f = replacementFixture();
    let committed = false;
    let removes = 0;
    f.faults.observed = (op, key) => { if (op === 'set' && key === SNAPSHOT_INDEX_KEY) committed = true; };
    if (refusal === 'read') f.faults.get = () => { if (committed) throw new Error('postcommit denied read'); };
    else f.faults.remove = () => { if (++removes === (refusal === 'remove-first' ? 1 : 2)) throw new Error('cleanup denied'); };
    const result = saveVaultSnapshot(f.incoming, f.storage);
    expect(result).toMatchObject({ saved: true, skipped: false, snapshotId: f.incoming.snapshotId });
    expect(f.trace.filter(e => e.op === 'set' && e.key === SNAPSHOT_INDEX_KEY)).toHaveLength(1);
    f.faults.get = () => {};
    expectUsable(f.incoming, f.storage);
    expectUsable(f.unrelated, f.storage);
    expect(loadSnapshotIndex(f.storage).entries.map(e => e.snapshotId)).toEqual([f.unrelated.snapshotId, f.incoming.snapshotId]);
    expect(f.values.has(partKey(f.old.snapshotId, 1)), 'cleanup stops and permits old nonindexed residue').toBe(true);
  });

  it.each(['metadata', 'middle', 'index'])('T10/T13 quota at %s preserves old; capacity-dependent fresh retry succeeds', point => {
    const f = replacementFixture();
    const target = point === 'metadata' ? metadataKey(f.incoming.snapshotId) : point === 'middle' ? partKey(f.incoming.snapshotId, 1) : SNAPSHOT_INDEX_KEY;
    f.faults.set = key => { if (key === target) throw new DOMException('quota', 'QuotaExceededError'); };
    expect(saveVaultSnapshot(f.incoming, f.storage)).toEqual({ saved: false, skipped: false, reason: 'quota' });
    expectBytesPreserved(f.before, f.values);
    f.faults.set = () => {};
    expect(saveVaultSnapshot(f.incoming, f.storage).saved).toBe(true);
    expectUsable(f.incoming, f.storage);
    expectUsable(f.unrelated, f.storage);
  });

  it('T08 failed staging cleanup owns only attempted fresh keys, never an unplanned orphan', () => {
    const f = replacementFixture();
    const unknown = partKey(f.incoming.snapshotId, 99);
    f.values.set(unknown, 'unknown orphan');
    f.faults.set = key => { if (key === partKey(f.incoming.snapshotId, 1)) throw new Error('stage denied'); };
    f.faults.remove = () => { throw new Error('cleanup denied'); };
    expect(saveVaultSnapshot(f.incoming, f.storage)).toEqual({ saved: false, skipped: false });
    expectBytesPreserved(f.before, f.values);
    expect(f.values.get(unknown)).toBe('unknown orphan');
    const attempted = f.trace.filter(e => e.op === 'set').map(e => e.key);
    expect(f.trace.filter(e => e.op === 'remove').every(e => attempted.includes(e.key))).toBe(true);
    expectUsable(f.old, f.storage);
  });

  it('T11 successful legacy replacement retains the current public read format and optional index compatibility', () => {
    const f = replacementFixture(true);
    expect(saveVaultSnapshot(f.incoming, f.storage).saved).toBe(true);
    expectUsable(f.incoming, f.storage);
    expectUsable(f.unrelated, f.storage);
    expect(f.values.has(legacyKey(f.old.snapshotId))).toBe(false);
  });

  it.each([['daily', 30], ['weekly', 12], ['monthly', 12], ['last', 1]] as const)(
    'T12 pure count retention preserves exact order and usable retained %s payloads (%s)', (slot, limit) => {
      const f = faultStorage();
      const snapshots: VaultSnapshot[] = [];
      for (let i = 0; i < limit + 3; i += 1) {
        const next = syntheticSnapshot(`retention-${slot}-${i}`, `body-${i}`, slot, `${slot}-${i}`);
        next.createdAt = new Date(Date.UTC(2026, 0, i + 1)).toISOString();
        snapshots.push(next);
        expect(saveVaultSnapshot(next, f.storage).saved).toBe(true);
      }
      expect(loadSnapshotIndex(f.storage).entries.map(e => e.snapshotId)).toEqual(snapshots.slice(-limit).map(s => s.snapshotId));
      snapshots.slice(-limit).forEach(s => expectUsable(s, f.storage));
      snapshots.slice(0, -limit).forEach(s => expect(f.values.has(metadataKey(s.snapshotId))).toBe(false));
    },
  );

  it('T12 count ties retain original entry order; a pruned candidate is an uncommitted failure', () => {
    const f = faultStorage();
    const first = syntheticSnapshot('tied-first');
    expect(saveVaultSnapshot(first, f.storage).saved).toBe(true);
    const tied = syntheticSnapshot('tied-second', 'changed', 'last', 'last-other-key');
    const before = new Map(f.values);
    f.trace.length = 0;
    expect(saveVaultSnapshot(tied, f.storage)).toEqual({ saved: false, skipped: false });
    expectBytesPreserved(before, f.values);
    expect(f.values.size).toBe(before.size);
    expect(f.trace.some(e => e.op === 'set' && e.key === SNAPSHOT_INDEX_KEY)).toBe(false);
  });

  it('T12 actual UTF-8 payload byte cap drops oldest non-last entries, not a retained recovery copy', () => {
    const f = faultStorage();
    const snapshots = [0, 1, 2].map(i => {
      const s = syntheticSnapshot(`byte-${i}`, '한'.repeat(470_000), 'daily', `daily-${i}`);
      s.createdAt = new Date(Date.UTC(2026, 0, i + 1)).toISOString();
      expect(saveVaultSnapshot(s, f.storage).saved).toBe(true);
      return s;
    });
    const index = loadSnapshotIndex(f.storage);
    expect(index.entries.map(e => e.snapshotId)).toEqual(['byte-1', 'byte-2']);
    expect(index.entries.reduce((sum, e) => sum + e.payloadBytes, 0)).toBeLessThanOrEqual(4_000_000);
    expect(f.values.has(metadataKey('byte-0'))).toBe(false);
    snapshots.slice(1).forEach(s => expectUsable(s, f.storage));
  });

  it('T12 oversized last survives the soft cap, but an oversized droppable candidate cannot report saved', () => {
    const f = replacementFixture();
    const tooBig = syntheticSnapshot('pruned-candidate', 'x'.repeat(4_100_000), 'daily', 'daily-huge');
    const before = new Map(f.values);
    expect(saveVaultSnapshot(tooBig, f.storage)).toEqual({ saved: false, skipped: false });
    expectBytesPreserved(before, f.values);
    expect(f.values.size).toBe(before.size);
    const oversizedLast = { ...tooBig, snapshotId: 'oversized-last', slot: 'last' as const, slotKey: 'last' };
    expect(saveVaultSnapshot(oversizedLast, f.storage).saved).toBe(true);
    expect(loadSnapshotIndex(f.storage).entries.map(e => e.snapshotId)).toEqual([oversizedLast.snapshotId]);
    expect(loadSnapshotIndex(f.storage).entries[0]!.payloadBytes).toBeGreaterThan(4_000_000);
    expectUsable(oversizedLast, f.storage);
  });

  it('T09 corrupt/unreadable retention victim grants no cleanup authority; committed index stays truthful', () => {
    const f = faultStorage();
    const victim = syntheticSnapshot('unverified-victim', 'victim', 'weekly', 'weekly-old');
    expect(saveVaultSnapshot(victim, f.storage).saved).toBe(true);
    // This is unrelated preexisting corruption, not the same-slot replacement
    // base. It is not repaired/certified and cannot grant arbitrary delete keys.
    f.values.set(metadataKey(victim.snapshotId), JSON.stringify({ storageFormat: 'chunked-v1', chunkCount: 999_999_999, totalBytes: 1 }));
    const retained = syntheticSnapshot('retained-before-victim', 'retained');
    expect(saveVaultSnapshot(retained, f.storage).saved).toBe(true);
    const before = new Map(f.values);
    f.trace.length = 0;
    const oversized = syntheticSnapshot('new-last-removes-weekly', 'z'.repeat(4_100_000));
    expect(saveVaultSnapshot(oversized, f.storage).saved).toBe(true);
    expect(loadSnapshotIndex(f.storage).entries.map(e => e.snapshotId)).toEqual([oversized.snapshotId]);
    expect(f.trace.filter(e => e.op === 'remove')).toEqual([]);
    // Both victims remain as nonindexed residue after the first unsafe cleanup.
    for (const [key, value] of before) if (key !== SNAPSHOT_INDEX_KEY) expect(f.values.get(key) === value).toBe(true);
    expectUsable(oversized, f.storage);
  });

  it('T15 sequential same-agent replacements reread index and keep the newest committed view', () => {
    const f = replacementFixture();
    expect(saveVaultSnapshot(f.incoming, f.storage).saved).toBe(true);
    const next = syntheticSnapshot('sequential-next', 'next');
    expect(saveVaultSnapshot(next, f.storage).saved).toBe(true);
    expect(loadSnapshotIndex(f.storage).entries.map(e => e.snapshotId)).toEqual([f.unrelated.snapshotId, next.snapshotId]);
    expectUsable(next, f.storage);
    expectUsable(f.unrelated, f.storage);
  });

  it('T12 automation keeps saved/skip fingerprint semantics, including cleanup refusal', () => {
    vi.useFakeTimers();
    try {
      const f = faultStorage();
      // Build notes before arming storage; only synthetic input is used.
      const notes = [note('auto-synthetic')];
      vi.stubGlobal('localStorage', f.storage);
      // The builder legitimately enumerates for extensions; allow it here.
      Object.defineProperty(f.storage, 'length', { get: () => f.values.size });
      f.storage.key = i => [...f.values.keys()][i] ?? null;
      resetAutoSnapshotStateForTests();
      scheduleAutoSnapshot(notes, []);
      flushAutoSnapshotForTests();
      const before = new Map(f.values);
      f.trace.length = 0;
      scheduleAutoSnapshot(notes, []);
      flushAutoSnapshotForTests();
      expect(f.trace.filter(e => e.op !== 'get')).toEqual([]);
      expectBytesPreserved(before, f.values);
      // Re-arm the same content after reset: valid store-side skip also advances
      // the scheduler fingerprint, without a storage mutation.
      resetAutoSnapshotStateForTests();
      scheduleAutoSnapshot(notes, []);
      flushAutoSnapshotForTests();
      expect(f.trace.filter(e => e.op !== 'get')).toEqual([]);
      f.faults.remove = () => { throw new Error('cleanup denied'); };
      const changed = [note('auto-synthetic', 'changed')];
      scheduleAutoSnapshot(changed, []);
      flushAutoSnapshotForTests();
      expect(loadSnapshotIndex(f.storage).entries).toHaveLength(1);
      expect(loadSnapshotPayload(loadSnapshotIndex(f.storage).entries[0]!.snapshotId, f.storage)?.vault.notes[0]?.title).toBe('changed');
      f.trace.length = 0;
      scheduleAutoSnapshot(changed, []);
      flushAutoSnapshotForTests();
      expect(f.trace.filter(e => e.op !== 'get')).toEqual([]);
    } finally {
      resetAutoSnapshotStateForTests();
      vi.useRealTimers();
    }
  });

  it('T04 invalid incoming envelope/integrity and unavailable native storage reject before mutation', () => {
    const f = replacementFixture();
    f.incoming.contentFingerprint = 'not-the-content-fingerprint';
    expect(saveVaultSnapshot(f.incoming, f.storage)).toEqual({ saved: false, skipped: false });
    expect(f.trace.filter(e => e.op !== 'get')).toEqual([]);
    expectBytesPreserved(f.before, f.values);
    vi.stubGlobal('localStorage', undefined);
    expect(saveVaultSnapshot(f.incoming)).toEqual({ saved: false, skipped: false });
  });

  it.each(['metadata', 'first', 'middle', 'final', 'count', 'bytes', 'order', 'legacy-shadow'])(
    'T04/T16 defensive exact readback rejects staged %s corruption (dishonest writer is OUT_OF_M1)', corruption => {
      const f = replacementFixture();
      const set = f.storage.setItem;
      f.storage.setItem = (key, value) => {
        const omitted = corruption === 'metadata' ? metadataKey(f.incoming.snapshotId)
          : ['first', 'middle', 'final'].includes(corruption)
            ? partKey(f.incoming.snapshotId, { first: 0, middle: 1, final: 2 }[corruption as 'first' | 'middle' | 'final']) : null;
        if (key === omitted) return; // Deliberate silent success, outside M1.
        if (key === metadataKey(f.incoming.snapshotId) && (corruption === 'count' || corruption === 'bytes')) {
          const meta = JSON.parse(value);
          if (corruption === 'count') meta.chunkCount -= 1;
          else meta.totalBytes -= 1;
          set(key, JSON.stringify(meta));
        } else if (corruption === 'order' && key === partKey(f.incoming.snapshotId, 0)) {
          set(key, value.slice(1) + value[0]);
        } else set(key, value);
        if (corruption === 'legacy-shadow' && key === metadataKey(f.incoming.snapshotId)) {
          f.values.set(legacyKey(f.incoming.snapshotId), 'shadow');
        }
      };
      expect(saveVaultSnapshot(f.incoming, f.storage)).toEqual({ saved: false, skipped: false });
      expectBytesPreserved(f.before, f.values);
      expect(f.trace.some(e => e.op === 'set' && e.key === SNAPSHOT_INDEX_KEY)).toBe(false);
      expectUsable(f.old, f.storage);
    },
  );

  it('T10 index growth alone can exhaust a finite synthetic quota after complete staging', () => {
    const f = replacementFixture();
    f.incoming.snapshotId = 'm1-new-with-a-longer-index-entry-id';
    const raw = serializeVaultSnapshot(f.incoming);
    const parts = splitSnapshotIntoChunks(raw);
    const bytes = (value: string) => new TextEncoder().encode(value).length;
    const meta = JSON.stringify({ storageFormat: 'chunked-v1', chunkCount: parts.length, totalBytes: bytes(raw) });
    // Synthetic value-byte budget, NOT a claim about browser quota accounting.
    const initialBytes = [...f.values.values()].reduce((sum, v) => sum + bytes(v), 0);
    let budget = initialBytes + bytes(meta) + parts.reduce((sum, p) => sum + bytes(p), 0);
    f.faults.set = (key, value) => {
      const used = [...f.values.values()].reduce((sum, v) => sum + bytes(v), 0);
      if (used - bytes(f.values.get(key) ?? '') + bytes(value) > budget) throw new DOMException('synthetic capacity', 'QuotaExceededError');
    };
    expect(saveVaultSnapshot(f.incoming, f.storage)).toEqual({ saved: false, skipped: false, reason: 'quota' });
    expect(f.trace.filter(e => e.op === 'set').at(-1)?.key).toBe(SNAPSHOT_INDEX_KEY);
    expectBytesPreserved(f.before, f.values);
    expectUsable(f.old, f.storage);
    budget += 10_000;
    expect(saveVaultSnapshot(f.incoming, f.storage).saved).toBe(true);
    expectUsable(f.incoming, f.storage);
  });

  it('T08 precommit cleanup may stop after partial removal without touching old/unknown keys', () => {
    const f = replacementFixture();
    f.faults.set = key => { if (key === SNAPSHOT_INDEX_KEY) throw new Error('publish denied'); };
    let removes = 0;
    f.faults.remove = () => { if (++removes === 2) throw new Error('second remove denied'); };
    expect(saveVaultSnapshot(f.incoming, f.storage)).toEqual({ saved: false, skipped: false });
    expect(f.values.has(metadataKey(f.incoming.snapshotId))).toBe(false);
    expect(f.values.has(partKey(f.incoming.snapshotId, 0))).toBe(true);
    expect(f.trace.filter(e => e.op === 'remove')).toHaveLength(2);
    expectBytesPreserved(f.before, f.values);
    expectUsable(f.old, f.storage);
  });
});

describe('STRONGER_SYNTHETIC_ADVERSARY — OUT_OF_M1, not supported-model guarantees', () => {
  it('T16 mutate-then-throw publication is a counterexample, NOT a clean-abort guarantee', () => {
    const f = replacementFixture();
    f.faults.set = (key, value) => {
      if (key === SNAPSHOT_INDEX_KEY) {
        f.values.set(key, value); // Deliberate method-contract violation.
        throw new Error('mutated then threw');
      }
    };
    expect(saveVaultSnapshot(f.incoming, f.storage).saved).toBe(false);
    expect(f.values.get(SNAPSHOT_INDEX_KEY) === f.before.get(SNAPSHOT_INDEX_KEY)).toBe(false);
    expect(loadSnapshotIndex(f.storage).entries.some(e => e.snapshotId === f.incoming.snapshotId)).toBe(true);
    expect(loadSnapshotPayload(f.incoming.snapshotId, f.storage)).toBe(null);
    expectUsable(f.old, f.storage); // Bytes are not the same as discoverability.
  });

  it('T16 ambiguous publication plus denied readback/rollback cannot establish the prior view', () => {
    const f = replacementFixture();
    let ambiguous = false;
    f.faults.set = (key, value) => {
      if (ambiguous) throw new Error('permanent writes denied');
      if (key === SNAPSHOT_INDEX_KEY) {
        ambiguous = true;
        f.values.set(key, value);
        throw new Error('unknown outcome');
      }
    };
    f.faults.get = () => { if (ambiguous) throw new Error('read denied'); };
    f.faults.remove = () => { throw new Error('remove denied'); };
    expect(saveVaultSnapshot(f.incoming, f.storage).saved).toBe(false);
    expect(f.values.get(SNAPSHOT_INDEX_KEY) === f.before.get(SNAPSHOT_INDEX_KEY)).toBe(false);
    f.faults.get = () => {};
    expectUsable(f.old, f.storage);
    expectUsable(f.incoming, f.storage);
  });

  it('T16 remove-then-throw violates M1; exact nonreferenced cleanup can leave partial residue', () => {
    const f = replacementFixture();
    f.faults.remove = key => { f.values.delete(key); throw new Error('removed then threw'); };
    expect(saveVaultSnapshot(f.incoming, f.storage).saved).toBe(true);
    expect(f.values.has(metadataKey(f.old.snapshotId))).toBe(false);
    expect(f.values.has(partKey(f.old.snapshotId, 0))).toBe(true);
    expectUsable(f.incoming, f.storage);
  });

  it('T16 wrong-key side effects defeat unrelated-byte preservation (outside M1)', () => {
    const f = replacementFixture();
    f.faults.set = key => { if (key === metadataKey(f.incoming.snapshotId)) f.values.delete(metadataKey(f.unrelated.snapshotId)); };
    expect(saveVaultSnapshot(f.incoming, f.storage).saved).toBe(true);
    expect(loadSnapshotPayload(f.unrelated.snapshotId, f.storage)).toBe(null);
  });

  it('T16 silently truncated successful write violates M1, and exact readback detects this particular adversary', () => {
    const f = replacementFixture();
    const set = f.storage.setItem;
    f.storage.setItem = (key, value) => set(key, key === partKey(f.incoming.snapshotId, 1) ? value.slice(1) : value);
    expect(saveVaultSnapshot(f.incoming, f.storage)).toEqual({ saved: false, skipped: false });
    expectBytesPreserved(f.before, f.values);
    // A defensive detection is not a general dishonest-adapter certification.
    expect(f.trace.some(e => e.op === 'set' && e.key === SNAPSHOT_INDEX_KEY)).toBe(false);
  });

  it.each(['cross-agent stale-index interleaving', 'callback reentry'])(
    'T15/T16 %s has no serializability guarantee', boundary => {
      const f = replacementFixture();
      const other = syntheticSnapshot(`outside-${boundary}`, 'other writer', 'monthly', 'monthly-other');
      let interleaved = false;
      // Deterministic callback models the same stale-read/overwrite schedule as
      // a second tab; this is NOT a real multi-tab or physical-browser test.
      f.faults.set = key => {
        if (key === SNAPSHOT_INDEX_KEY && !interleaved) {
          interleaved = true;
          expect(saveVaultSnapshot(other, f.storage).saved).toBe(true);
        }
      };
      expect(saveVaultSnapshot(f.incoming, f.storage).saved).toBe(true);
      expect(loadSnapshotIndex(f.storage).entries.some(e => e.snapshotId === other.snapshotId)).toBe(false);
      expectUsable(other, f.storage); // Complete, but lost from the stale index.
    },
  );
});
