import type { NoteBase } from '@/components/views/noteUtils';
import { buildVaultBackupManifest, type VaultBackupManifest } from '../exportVaultBackup';
import { fingerprintJson } from '../vaultSnapshotFingerprint';
import { serializeVaultSnapshot, buildVaultSnapshot, type VaultSnapshot } from '../vaultSnapshotBuild';
import type { VaultRestoreSnapshotSourceStorage } from '../vaultRestoreSourceRead';
import {
  SNAPSHOT_CHUNK_PREFIX,
  SNAPSHOT_CHUNK_STORAGE_FORMAT,
  SNAPSHOT_INDEX_KEY,
  SNAPSHOT_META_PREFIX,
  SNAPSHOT_PAYLOAD_PREFIX,
} from '../vaultSnapshotConstants';
import { SNAPSHOT_CHUNK_TARGET_BYTES, splitSnapshotIntoChunks } from '../snapshotCompaction';

export function fixtureNote(id = 'source-admission-note'): NoteBase {
  return {
    id,
    title: 'Admission fixture',
    body: 'Synthetic body for source admission.',
    folderId: null,
    starred: false,
    deletedAt: null,
    createdAt: 1_700_000_000_000,
    updatedAt: 1_700_000_000_000,
    properties: {},
    relations: {},
  };
}

export class MemorySnapshotSourceStorage implements VaultRestoreSnapshotSourceStorage {
  readonly values = new Map<string, string>();
  readonly reads: string[] = [];

  getItem(key: string): string | null {
    this.reads.push(key);
    return this.values.get(key) ?? null;
  }
}

export function makeCurrentSnapshot(id = 'snapshot-admission-1'): VaultSnapshot {
  const snapshot = buildVaultSnapshot([fixtureNote()], [], 'last', 'last');
  snapshot.snapshotId = id;
  snapshot.createdAt = '2026-10-01T12:00:00.000Z';
  return snapshot;
}

export function persistSnapshotFixture(
  storage: MemorySnapshotSourceStorage,
  snapshot: VaultSnapshot,
  layout: 'legacy' | 'chunked' = 'legacy',
): string {
  const raw = serializeVaultSnapshot(snapshot);
  const chunks = splitSnapshotIntoChunks(raw);
  const entries = [{
    snapshotId: snapshot.snapshotId,
    slot: snapshot.slot,
    slotKey: snapshot.slotKey,
    createdAt: snapshot.createdAt,
    contentFingerprint: snapshot.contentFingerprint,
    payloadBytes: new TextEncoder().encode(raw).length,
    ...(layout === 'chunked' ? { chunkCount: chunks.length, writeCount: chunks.length + 1 } : {}),
  }];
  storage.values.set(SNAPSHOT_INDEX_KEY, JSON.stringify({ schemaVersion: 1, entries }));
  if (layout === 'legacy') {
    storage.values.set(`${SNAPSHOT_PAYLOAD_PREFIX}${snapshot.snapshotId}:v1`, raw);
  } else {
    storage.values.set(`${SNAPSHOT_META_PREFIX}${snapshot.snapshotId}:v1`, JSON.stringify({
      storageFormat: SNAPSHOT_CHUNK_STORAGE_FORMAT,
      chunkCount: chunks.length,
      totalBytes: new TextEncoder().encode(raw).length,
    }));
    chunks.forEach((chunk, index) => {
      storage.values.set(`${SNAPSHOT_CHUNK_PREFIX}${snapshot.snapshotId}:${index}:v1`, chunk);
    });
  }
  return raw;
}

export function putLegacyShadowChunks(storage: MemorySnapshotSourceStorage, snapshot: VaultSnapshot): void {
  const raw = serializeVaultSnapshot(snapshot);
  splitSnapshotIntoChunks(raw).forEach((chunk, index) => {
    storage.values.set(`${SNAPSHOT_CHUNK_PREFIX}${snapshot.snapshotId}:${index}:v1`, chunk);
  });
  storage.values.set(`${SNAPSHOT_META_PREFIX}${snapshot.snapshotId}:v1`, JSON.stringify({
    storageFormat: SNAPSHOT_CHUNK_STORAGE_FORMAT,
    chunkCount: Math.max(1, Math.ceil(raw.length / SNAPSHOT_CHUNK_TARGET_BYTES)),
    totalBytes: new TextEncoder().encode(raw).length,
  }));
}

export function makeDirectManifest(schemaVersion = 3): VaultBackupManifest {
  const manifest = buildVaultBackupManifest([fixtureNote()], []);
  manifest.schemaVersion = schemaVersion;
  if (schemaVersion < 3) {
    delete manifest.extensions;
    delete manifest.contentFingerprint;
  }
  return manifest;
}

export function makeH01HistoricalSnapshot(snapshot: VaultSnapshot): VaultSnapshot {
  const copy = JSON.parse(serializeVaultSnapshot(snapshot)) as VaultSnapshot;
  copy.contentFingerprint = fingerprintJson({ vault: copy.vault, extensions: copy.extensions });
  return copy;
}
