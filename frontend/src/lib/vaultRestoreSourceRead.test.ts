import { describe, expect, it } from 'vitest';
import { buildVaultBackupZip } from './vaultBackupZip';
import { fingerprintPortableVaultContent } from './vaultSnapshotFingerprint';
import { serializeVaultSnapshot, type VaultSnapshot } from './vaultSnapshotBuild';
import { readVaultRestoreDirectJsonSource, readVaultRestoreDirectZipSource, readVaultRestoreSnapshotSource } from './vaultRestoreSourceRead';
import {
  makeCurrentSnapshot,
  makeDirectManifest,
  makeH01HistoricalSnapshot,
  MemorySnapshotSourceStorage,
  persistSnapshotFixture,
  putLegacyShadowChunks,
} from './__fixtures__/vaultRestoreAdmissionFixtures';
import { SNAPSHOT_INDEX_KEY, SNAPSHOT_PAYLOAD_PREFIX, SNAPSHOT_META_PREFIX, SNAPSHOT_CHUNK_PREFIX } from './vaultSnapshotConstants';

function indexed(snapshot = makeCurrentSnapshot(), layout: 'legacy' | 'chunked' = 'legacy') {
  const storage = new MemorySnapshotSourceStorage();
  const raw = persistSnapshotFixture(storage, snapshot, layout);
  return { storage, snapshot, raw };
}

describe('vault restore source reader', () => {
  it('A01 admits a current-valid legacy snapshot and preserves its exact serialized bytes', () => {
    const { storage, snapshot, raw } = indexed();
    const result = readVaultRestoreSnapshotSource(snapshot.snapshotId, storage);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.source.origin).toBe('snapshot');
      expect(result.source.manifest.schemaVersion).toBe(3);
      expect(result.source.manifest.notes[0]?.id).toBe('source-admission-note');
    }
    expect(storage.values.get(`${SNAPSHOT_PAYLOAD_PREFIX}${snapshot.snapshotId}:v1`)).toBe(raw);
  });

  it('A02 admits a current-valid chunked snapshot', () => {
    const { storage, snapshot } = indexed(makeCurrentSnapshot(), 'chunked');
    const result = readVaultRestoreSnapshotSource(snapshot.snapshotId, storage);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.source.origin).toBe('snapshot');
  });

  it.each([1, 2, 3])('A03 accepts direct JSON schema %i through its own validator', async schema => {
    const manifest = makeDirectManifest(schema);
    const result = await readVaultRestoreDirectJsonSource(new Blob([JSON.stringify(manifest)]));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.source.origin).toBe('direct-json');
  });

  it('A04 accepts a valid direct ZIP through its manifest.json parser', async () => {
    const zip = await buildVaultBackupZip(makeDirectManifest(3));
    const result = await readVaultRestoreDirectZipSource(zip);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.source.origin).toBe('direct-zip');
  });

  it('A05 rejects a genuine H01 historical fingerprint under the current-only profile', () => {
    const historical = makeH01HistoricalSnapshot(makeCurrentSnapshot('h01'));
    const { storage } = indexed(historical);
    const result = readVaultRestoreSnapshotSource(historical.snapshotId, storage);
    expect(result).toEqual({ ok: false, code: 'INVALID_SOURCE_INTEGRITY' });
  });

  it('A06 rejects H06 content corruption with the original fingerprint retained', () => {
    const corrupted = makeCurrentSnapshot('h06');
    corrupted.vault.notes[0]!.markdown += '\nchanged after export';
    const { storage } = indexed(corrupted);
    expect(readVaultRestoreSnapshotSource(corrupted.snapshotId, storage)).toEqual({
      ok: false,
      code: 'INVALID_SOURCE_INTEGRITY',
    });
  });

  it('A07 fails closed for an unsupported producer version even when the content fingerprint still validates', () => {
    const unknown = makeCurrentSnapshot('unknown');
    unknown.appVersion = 'unknown-producer';
    const { storage } = indexed(unknown);
    expect(readVaultRestoreSnapshotSource(unknown.snapshotId, storage)).toEqual({
      ok: false,
      code: 'UNKNOWN_SOURCE_GENERATION',
    });
  });

  it('A08 rejects requested, index, and payload identity mismatches', () => {
    const requestedMismatch = indexed();
    expect(readVaultRestoreSnapshotSource('another-id', requestedMismatch.storage).ok).toBe(false);

    const indexMismatch = indexed();
    const index = JSON.parse(indexMismatch.storage.values.get(SNAPSHOT_INDEX_KEY)!);
    index.entries[0].slotKey = 'other-slot';
    indexMismatch.storage.values.set(SNAPSHOT_INDEX_KEY, JSON.stringify(index));
    expect(readVaultRestoreSnapshotSource(indexMismatch.snapshot.snapshotId, indexMismatch.storage).ok).toBe(false);

    const payloadMismatch = indexed();
    const wrongPayload = makeCurrentSnapshot('different-payload-id');
    payloadMismatch.storage.values.set(
      `${SNAPSHOT_PAYLOAD_PREFIX}${payloadMismatch.snapshot.snapshotId}:v1`,
      serializeVaultSnapshot(wrongPayload),
    );
    expect(readVaultRestoreSnapshotSource(payloadMismatch.snapshot.snapshotId, payloadMismatch.storage).ok).toBe(false);
  });

  it('A09 rejects malformed index data and duplicate ID or slot entries', () => {
    const malformed = indexed();
    malformed.storage.values.set(SNAPSHOT_INDEX_KEY, '{not json');
    expect(readVaultRestoreSnapshotSource(malformed.snapshot.snapshotId, malformed.storage).ok).toBe(false);

    const duplicate = indexed();
    const index = JSON.parse(duplicate.storage.values.get(SNAPSHOT_INDEX_KEY)!);
    index.entries.push({ ...index.entries[0] });
    duplicate.storage.values.set(SNAPSHOT_INDEX_KEY, JSON.stringify(index));
    expect(readVaultRestoreSnapshotSource(duplicate.snapshot.snapshotId, duplicate.storage).ok).toBe(false);

    const duplicateSlot = indexed();
    const other = makeCurrentSnapshot('another-id');
    const { raw } = indexed(other);
    const slotIndex = JSON.parse(duplicateSlot.storage.values.get(SNAPSHOT_INDEX_KEY)!);
    slotIndex.entries.push({ ...slotIndex.entries[0], snapshotId: other.snapshotId });
    duplicateSlot.storage.values.set(SNAPSHOT_INDEX_KEY, JSON.stringify(slotIndex));
    duplicateSlot.storage.values.set(`${SNAPSHOT_PAYLOAD_PREFIX}${other.snapshotId}:v1`, raw);
    expect(readVaultRestoreSnapshotSource(duplicateSlot.snapshot.snapshotId, duplicateSlot.storage).ok).toBe(false);
  });

  it('A10 rejects missing, truncated, and reordered chunks', () => {
    const makeLarge = () => {
      const snapshot = makeCurrentSnapshot('large-chunked');
      snapshot.vault.notes[0]!.markdown += 'x'.repeat(1_200_000);
      // Preserve the production fingerprint contract over the altered fixture.
      snapshot.contentFingerprint = fingerprintPortableVaultContent({
        notes: snapshot.vault.notes,
        folders: snapshot.vault.folders,
        extensions: snapshot.extensions,
      });
      return snapshot;
    };
    const missing = indexed(makeLarge(), 'chunked');
    const meta = JSON.parse(missing.storage.values.get(`${SNAPSHOT_META_PREFIX}large-chunked:v1`)!);
    expect(meta.chunkCount).toBeGreaterThanOrEqual(3);
    missing.storage.values.delete(`${SNAPSHOT_CHUNK_PREFIX}large-chunked:${meta.chunkCount - 1}:v1`);
    expect(readVaultRestoreSnapshotSource('large-chunked', missing.storage).ok).toBe(false);

    const truncated = indexed(makeLarge(), 'chunked');
    const firstKey = `${SNAPSHOT_CHUNK_PREFIX}large-chunked:0:v1`;
    truncated.storage.values.set(firstKey, truncated.storage.values.get(firstKey)!.slice(1));
    expect(readVaultRestoreSnapshotSource('large-chunked', truncated.storage).ok).toBe(false);

    const reordered = indexed(makeLarge(), 'chunked');
    const a = `${SNAPSHOT_CHUNK_PREFIX}large-chunked:0:v1`;
    const b = `${SNAPSHOT_CHUNK_PREFIX}large-chunked:1:v1`;
    const aValue = reordered.storage.values.get(a)!;
    reordered.storage.values.set(a, reordered.storage.values.get(b)!);
    reordered.storage.values.set(b, aValue);
    expect(readVaultRestoreSnapshotSource('large-chunked', reordered.storage).ok).toBe(false);
  });

  it('A11 legacy payload precedence leaves same-ID shadow chunks outside the read proof', () => {
    const { storage, snapshot } = indexed();
    putLegacyShadowChunks(storage, snapshot);
    const result = readVaultRestoreSnapshotSource(snapshot.snapshotId, storage);
    expect(result.ok).toBe(true);
  });

  it('does not expose any storage mutation or root enumeration method', () => {
    const { storage, snapshot } = indexed();
    const before = new Map(storage.values);
    const result = readVaultRestoreSnapshotSource(snapshot.snapshotId, storage);
    expect(result.ok).toBe(true);
    expect([...storage.values]).toEqual([...before]);
    expect(storage).not.toHaveProperty('setItem');
    expect(storage).not.toHaveProperty('removeItem');
    expect(storage).not.toHaveProperty('length');
    expect(storage).not.toHaveProperty('key');
  });

  it('does not accept an indexed snapshot envelope as direct JSON', async () => {
    const snapshot = makeCurrentSnapshot('not-a-direct-manifest');
    const direct = await readVaultRestoreDirectJsonSource(new Blob([serializeVaultSnapshot(snapshot)]));
    expect(direct.ok).toBe(false);
  });

  it('keeps current profile independent of legacy/chunked storage representation', () => {
    const legacy = indexed();
    const chunked = indexed(makeCurrentSnapshot('chunked-profile'), 'chunked');
    expect(readVaultRestoreSnapshotSource(legacy.snapshot.snapshotId, legacy.storage).ok).toBe(true);
    expect(readVaultRestoreSnapshotSource(chunked.snapshot.snapshotId, chunked.storage).ok).toBe(true);
  });
});
