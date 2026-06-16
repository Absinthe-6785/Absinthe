import {
  SNAPSHOT_INDEX_KEY,
  SNAPSHOT_PAYLOAD_PREFIX,
  SNAPSHOT_RETENTION,
  type VaultSnapshotSlot,
} from './vaultSnapshotConstants';
import {
  parseVaultSnapshotJson,
  serializeVaultSnapshot,
  type VaultSnapshot,
} from './vaultSnapshotBuild';

export interface SnapshotStorageAdapter {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  readonly length: number;
  key(index: number): string | null;
}

export interface VaultSnapshotIndexEntry {
  snapshotId: string;
  slot: VaultSnapshotSlot;
  slotKey: string;
  createdAt: string;
  contentFingerprint: string;
  payloadBytes: number;
}

export interface VaultSnapshotIndex {
  schemaVersion: 1;
  entries: VaultSnapshotIndexEntry[];
}

export interface VaultSnapshotSummary {
  snapshotId: string;
  slot: VaultSnapshotSlot;
  slotKey: string;
  createdAt: string;
  payloadBytes: number;
  noteCount: number;
  folderCount: number;
}

function payloadKey(snapshotId: string): string {
  return `${SNAPSHOT_PAYLOAD_PREFIX}${snapshotId}:v1`;
}

function defaultStorage(): SnapshotStorageAdapter {
  if (typeof localStorage === 'undefined') {
    throw new Error('localStorage unavailable');
  }
  return localStorage;
}

export function loadSnapshotIndex(storage: SnapshotStorageAdapter = defaultStorage()): VaultSnapshotIndex {
  try {
    const raw = storage.getItem(SNAPSHOT_INDEX_KEY);
    if (!raw) return { schemaVersion: 1, entries: [] };
    const parsed = JSON.parse(raw) as VaultSnapshotIndex;
    if (parsed.schemaVersion !== 1 || !Array.isArray(parsed.entries)) {
      return { schemaVersion: 1, entries: [] };
    }
    return parsed;
  } catch {
    return { schemaVersion: 1, entries: [] };
  }
}

function saveSnapshotIndex(index: VaultSnapshotIndex, storage: SnapshotStorageAdapter): void {
  storage.setItem(SNAPSHOT_INDEX_KEY, JSON.stringify(index));
}

export function loadSnapshotPayload(
  snapshotId: string,
  storage: SnapshotStorageAdapter = defaultStorage(),
): VaultSnapshot | null {
  const raw = storage.getItem(payloadKey(snapshotId));
  if (!raw) return null;
  return parseVaultSnapshotJson(raw);
}

export function enumerateVaultSnapshots(
  storage: SnapshotStorageAdapter = defaultStorage(),
): VaultSnapshotSummary[] {
  const index = loadSnapshotIndex(storage);
  return index.entries
    .map(entry => {
      const payload = loadSnapshotPayload(entry.snapshotId, storage);
      return {
        snapshotId: entry.snapshotId,
        slot: entry.slot,
        slotKey: entry.slotKey,
        createdAt: entry.createdAt,
        payloadBytes: entry.payloadBytes,
        noteCount: payload?.vault.noteCount ?? 0,
        folderCount: payload?.vault.folderCount ?? 0,
      };
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getLatestSnapshotSummary(
  storage: SnapshotStorageAdapter = defaultStorage(),
): VaultSnapshotSummary | null {
  const all = enumerateVaultSnapshots(storage);
  return all[0] ?? null;
}

function removeSnapshotEntry(
  entry: VaultSnapshotIndexEntry,
  storage: SnapshotStorageAdapter,
): void {
  storage.removeItem(payloadKey(entry.snapshotId));
}

function pruneIndex(index: VaultSnapshotIndex, storage: SnapshotStorageAdapter): VaultSnapshotIndex {
  let entries = [...index.entries];

  const bySlot = (slot: VaultSnapshotSlot) =>
    entries.filter(e => e.slot === slot).sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const keepLast = bySlot('last').slice(0, 1);
  const keepDaily = bySlot('daily').slice(0, SNAPSHOT_RETENTION.maxDaily);
  const keepWeekly = bySlot('weekly').slice(0, SNAPSHOT_RETENTION.maxWeekly);

  const keepIds = new Set([
    ...keepLast.map(e => e.snapshotId),
    ...keepDaily.map(e => e.snapshotId),
    ...keepWeekly.map(e => e.snapshotId),
  ]);

  for (const entry of entries) {
    if (!keepIds.has(entry.snapshotId)) {
      removeSnapshotEntry(entry, storage);
    }
  }

  entries = entries.filter(e => keepIds.has(e.snapshotId));

  let totalBytes = entries.reduce((sum, e) => sum + e.payloadBytes, 0);
  if (totalBytes > SNAPSHOT_RETENTION.maxTotalBytes) {
    const droppable = entries
      .filter(e => e.slot !== 'last')
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    for (const entry of droppable) {
      if (totalBytes <= SNAPSHOT_RETENTION.maxTotalBytes) break;
      removeSnapshotEntry(entry, storage);
      entries = entries.filter(e => e.snapshotId !== entry.snapshotId);
      totalBytes -= entry.payloadBytes;
    }
  }

  return { schemaVersion: 1, entries };
}

export interface SaveSnapshotResult {
  saved: boolean;
  skipped: boolean;
  reason?: 'unchanged' | 'quota';
  snapshotId?: string;
}

export function saveVaultSnapshot(
  snapshot: VaultSnapshot,
  storage: SnapshotStorageAdapter = defaultStorage(),
): SaveSnapshotResult {
  const serialized = serializeVaultSnapshot(snapshot);
  const payloadBytes = new TextEncoder().encode(serialized).length;
  const index = loadSnapshotIndex(storage);

  const sameSlot = index.entries.find(e => e.slotKey === snapshot.slotKey);
  if (sameSlot?.contentFingerprint === snapshot.contentFingerprint) {
    return { saved: false, skipped: true, reason: 'unchanged' };
  }

  if (sameSlot) {
    removeSnapshotEntry(sameSlot, storage);
    index.entries = index.entries.filter(e => e.snapshotId !== sameSlot.snapshotId);
  }

  const entry: VaultSnapshotIndexEntry = {
    snapshotId: snapshot.snapshotId,
    slot: snapshot.slot,
    slotKey: snapshot.slotKey,
    createdAt: snapshot.createdAt,
    contentFingerprint: snapshot.contentFingerprint,
    payloadBytes,
  };

  try {
    storage.setItem(payloadKey(snapshot.snapshotId), serialized);
    index.entries.push(entry);
    const pruned = pruneIndex(index, storage);
    saveSnapshotIndex(pruned, storage);
    return { saved: true, skipped: false, snapshotId: snapshot.snapshotId };
  } catch {
    return { saved: false, skipped: false, reason: 'quota' };
  }
}

export function getSnapshotTotalBytes(
  storage: SnapshotStorageAdapter = defaultStorage(),
): number {
  return loadSnapshotIndex(storage).entries.reduce((sum, e) => sum + e.payloadBytes, 0);
}

/** Test helper — wipe all snapshot keys. */
export function clearAllVaultSnapshots(storage: SnapshotStorageAdapter = defaultStorage()): void {
  const index = loadSnapshotIndex(storage);
  for (const entry of index.entries) {
    storage.removeItem(payloadKey(entry.snapshotId));
  }
  storage.removeItem(SNAPSHOT_INDEX_KEY);
}
