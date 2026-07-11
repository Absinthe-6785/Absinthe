/**
 * K-96D — Persistence cleanup, metrics, and orphan/legacy key reclamation.
 */
import {
  ACTIVE_KEY,
  FOLDERS_KEY,
  NOTES_KEY,
} from '@/components/views/noteUtils';
import {
  NOTES_IDB_MIGRATION_FLAG,
  NOTES_IDB_REV_KEY,
  countIndexedDbNotes,
  isIndexedDbMigrationComplete,
} from '@/lib/noteIndexedDb';
import {
  SNAPSHOT_CHUNK_PREFIX,
  SNAPSHOT_INDEX_KEY,
  SNAPSHOT_META_PREFIX,
  SNAPSHOT_PAYLOAD_PREFIX,
} from '@/lib/vaultSnapshotConstants';
import {
  loadSnapshotIndex,
  loadSnapshotPayload,
  saveSnapshotIndex,
  type SnapshotStorageAdapter,
} from '@/lib/vaultSnapshotStore';
import { mayDeleteLegacyStorage, recordRecoveryBlock } from '@/lib/recoverySafetyPolicy';

/** Pre-v2 note/planner keys — safe to remove after unified migration. */
export const LEGACY_NOTE_STORAGE_KEYS = [
  'noteview-notes-v1',
  'noteview-folders-v1',
  'noteview-active-v1',
  'planner-notes-v2',
  'planner-note-folders',
  'planner-active-note',
  'planner-notes',
] as const;

/** Obsolete markers superseded by K-96B IndexedDB migration. */
export const OBSOLETE_MIGRATION_MARKERS = [
  'notes-storage-migrated-v2',
] as const;

/** Keys that must never be removed by legacy cleanup. */
export const PROTECTED_LOCAL_STORAGE_KEYS = new Set([
  NOTES_KEY,
  FOLDERS_KEY,
  ACTIVE_KEY,
  NOTES_IDB_MIGRATION_FLAG,
  NOTES_IDB_REV_KEY,
  SNAPSHOT_INDEX_KEY,
  'planner-storage',
  'note-workspace-session-v1',
  'workspace-prefs-v1',
  'focus-presets-v1',
  'note-saved-views-v1',
  'note-rule-collections-v1',
  'note-database-views-v1',
]);

export type StorageKeyCategory =
  | 'notes'
  | 'folders'
  | 'active'
  | 'snapshot'
  | 'migration'
  | 'revision'
  | 'workspace'
  | 'legacy'
  | 'orphan'
  | 'other';

export interface StorageKeyAuditEntry {
  key: string;
  category: StorageKeyCategory;
  bytes: number;
}

export interface PersistenceMetrics {
  localStorageBytes: number;
  indexedDbRecordCount: number;
  snapshotBytes: number;
  snapshotCount: number;
  orphanKeys: number;
  legacyKeys: number;
}

export interface CleanupResult {
  removedKeys: string[];
  bytesReclaimed: number;
}

function defaultStorage(): SnapshotStorageAdapter {
  if (typeof localStorage === 'undefined') {
    throw new Error('localStorage unavailable');
  }
  return localStorage;
}

function keyBytes(storage: SnapshotStorageAdapter, key: string): number {
  return storage.getItem(key)?.length ?? 0;
}

function removeKey(storage: SnapshotStorageAdapter, key: string): number {
  const bytes = keyBytes(storage, key);
  if (bytes > 0) storage.removeItem(key);
  return bytes;
}

function isSnapshotStorageKey(key: string): boolean {
  return key.startsWith(SNAPSHOT_PAYLOAD_PREFIX)
    || key.startsWith(SNAPSHOT_META_PREFIX)
    || key.startsWith(SNAPSHOT_CHUNK_PREFIX);
}

function parseSnapshotStorageKey(key: string): {
  snapshotId: string;
  kind: 'payload' | 'meta' | 'chunk';
  chunkIndex?: number;
} | null {
  if (key.startsWith(SNAPSHOT_PAYLOAD_PREFIX) && key.endsWith(':v1')) {
    const snapshotId = key.slice(SNAPSHOT_PAYLOAD_PREFIX.length, -3);
    return snapshotId ? { snapshotId, kind: 'payload' } : null;
  }
  if (key.startsWith(SNAPSHOT_META_PREFIX) && key.endsWith(':v1')) {
    const snapshotId = key.slice(SNAPSHOT_META_PREFIX.length, -3);
    return snapshotId ? { snapshotId, kind: 'meta' } : null;
  }
  if (key.startsWith(SNAPSHOT_CHUNK_PREFIX) && key.endsWith(':v1')) {
    const rest = key.slice(SNAPSHOT_CHUNK_PREFIX.length, -3);
    const colon = rest.lastIndexOf(':');
    if (colon <= 0) return null;
    const snapshotId = rest.slice(0, colon);
    const chunkIndex = Number.parseInt(rest.slice(colon + 1), 10);
    if (!snapshotId || !Number.isFinite(chunkIndex)) return null;
    return { snapshotId, kind: 'chunk', chunkIndex };
  }
  return null;
}

function categorizeLocalStorageKey(key: string): StorageKeyCategory {
  if (key === NOTES_KEY) return 'notes';
  if (key === FOLDERS_KEY) return 'folders';
  if (key === ACTIVE_KEY) return 'active';
  if (key === NOTES_IDB_MIGRATION_FLAG || OBSOLETE_MIGRATION_MARKERS.includes(key as typeof OBSOLETE_MIGRATION_MARKERS[number])) {
    return 'migration';
  }
  if (key === NOTES_IDB_REV_KEY) return 'revision';
  if (isSnapshotStorageKey(key) || key === SNAPSHOT_INDEX_KEY) return 'snapshot';
  if ((LEGACY_NOTE_STORAGE_KEYS as readonly string[]).includes(key)) return 'legacy';
  if (
    key.startsWith('note-')
    || key.startsWith('workspace-')
    || key.startsWith('focus-')
    || key.startsWith('absinthe:')
    || key === 'planner-storage'
  ) {
    return 'workspace';
  }
  return 'other';
}

function collectSnapshotKeysForId(
  snapshotId: string,
  storage: SnapshotStorageAdapter,
): string[] {
  const keys: string[] = [];
  for (let i = 0; i < storage.length; i += 1) {
    const key = storage.key(i);
    if (!key) continue;
    const parsed = parseSnapshotStorageKey(key);
    if (parsed?.snapshotId === snapshotId) keys.push(key);
  }
  return keys;
}

function removeSnapshotKeysForId(
  snapshotId: string,
  storage: SnapshotStorageAdapter,
): CleanupResult {
  const removedKeys: string[] = [];
  let bytesReclaimed = 0;
  for (const key of collectSnapshotKeysForId(snapshotId, storage)) {
    bytesReclaimed += removeKey(storage, key);
    removedKeys.push(key);
  }
  return { removedKeys, bytesReclaimed };
}

function payloadKey(snapshotId: string): string {
  return `${SNAPSHOT_PAYLOAD_PREFIX}${snapshotId}:v1`;
}

function metaKey(snapshotId: string): string {
  return `${SNAPSHOT_META_PREFIX}${snapshotId}:v1`;
}

function chunkKey(snapshotId: string, index: number): string {
  return `${SNAPSHOT_CHUNK_PREFIX}${snapshotId}:${index}:v1`;
}

/** Inventory localStorage keys with byte estimates by category. */
export function auditLocalStorageKeys(
  storage: SnapshotStorageAdapter = defaultStorage(),
): StorageKeyAuditEntry[] {
  const entries: StorageKeyAuditEntry[] = [];
  for (let i = 0; i < storage.length; i += 1) {
    const key = storage.key(i);
    if (!key) continue;
    entries.push({
      key,
      category: categorizeLocalStorageKey(key),
      bytes: keyBytes(storage, key),
    });
  }
  return entries.sort((a, b) => b.bytes - a.bytes);
}

export function summarizeStorageAudit(entries: readonly StorageKeyAuditEntry[]): {
  totalBytes: number;
  byCategory: Record<StorageKeyCategory, number>;
  legacyKeyCount: number;
  snapshotKeyCount: number;
} {
  const byCategory: Record<StorageKeyCategory, number> = {
    notes: 0,
    folders: 0,
    active: 0,
    snapshot: 0,
    migration: 0,
    revision: 0,
    workspace: 0,
    legacy: 0,
    orphan: 0,
    other: 0,
  };
  let totalBytes = 0;
  for (const entry of entries) {
    totalBytes += entry.bytes;
    byCategory[entry.category] += entry.bytes;
  }
  return {
    totalBytes,
    byCategory,
    legacyKeyCount: entries.filter(e => e.category === 'legacy').length,
    snapshotKeyCount: entries.filter(e => e.category === 'snapshot').length,
  };
}

/** Remove legacy note keys after successful K-96B migration. Idempotent. */
export function cleanupLegacyStorageKeys(
  storage: SnapshotStorageAdapter = defaultStorage(),
): CleanupResult {
  if (!mayDeleteLegacyStorage()) {
    recordRecoveryBlock('delete_legacy_storage');
    return { removedKeys: [], bytesReclaimed: 0 };
  }
  const removedKeys: string[] = [];
  let bytesReclaimed = 0;

  const idbMigrated = isIndexedDbMigrationComplete();

  if (idbMigrated && storage.getItem(NOTES_KEY)) {
    bytesReclaimed += removeKey(storage, NOTES_KEY);
    removedKeys.push(NOTES_KEY);
  }

  if (idbMigrated || storage.getItem('notes-storage-migrated-v2')) {
    for (const key of LEGACY_NOTE_STORAGE_KEYS) {
      if (storage.getItem(key)) {
        bytesReclaimed += removeKey(storage, key);
        removedKeys.push(key);
      }
    }
  }

  if (idbMigrated) {
    for (const key of OBSOLETE_MIGRATION_MARKERS) {
      if (storage.getItem(key)) {
        bytesReclaimed += removeKey(storage, key);
        removedKeys.push(key);
      }
    }
  }

  return { removedKeys, bytesReclaimed };
}

/** Remove orphaned snapshot keys and invalid index entries. Idempotent. */
export function cleanupPersistenceOrphans(
  storage: SnapshotStorageAdapter = defaultStorage(),
): CleanupResult {
  if (!mayDeleteLegacyStorage()) {
    recordRecoveryBlock('delete_legacy_storage');
    return { removedKeys: [], bytesReclaimed: 0 };
  }
  const removedKeys: string[] = [];
  let bytesReclaimed = 0;

  const index = loadSnapshotIndex(storage);
  const validEntries = index.entries.filter(entry => {
    const payload = loadSnapshotPayload(entry.snapshotId, storage);
    if (payload) return true;
    const removed = removeSnapshotKeysForId(entry.snapshotId, storage);
    removedKeys.push(...removed.removedKeys);
    bytesReclaimed += removed.bytesReclaimed;
    removeKey(storage, payloadKey(entry.snapshotId));
    return false;
  });

  if (validEntries.length !== index.entries.length) {
    saveSnapshotIndex({ schemaVersion: 1, entries: validEntries }, storage);
  }

  const indexedIds = new Set(validEntries.map(e => e.snapshotId));

  for (const snapshotId of indexedIds) {
    const metaRaw = storage.getItem(metaKey(snapshotId));
    if (!metaRaw) continue;
    try {
      const meta = JSON.parse(metaRaw) as { chunkCount?: number };
      const expected = meta.chunkCount ?? 0;
      let complete = expected > 0;
      for (let i = 0; i < expected; i += 1) {
        if (storage.getItem(chunkKey(snapshotId, i)) === null) {
          complete = false;
          break;
        }
      }
      if (!complete) {
        const removed = removeSnapshotKeysForId(snapshotId, storage);
        removedKeys.push(...removed.removedKeys);
        bytesReclaimed += removed.bytesReclaimed;
        indexedIds.delete(snapshotId);
      }
    } catch {
      bytesReclaimed += removeKey(storage, metaKey(snapshotId));
      removedKeys.push(metaKey(snapshotId));
    }
  }

  const orphanIds = new Set<string>();
  for (let i = 0; i < storage.length; i += 1) {
    const key = storage.key(i);
    if (!key) continue;
    const parsed = parseSnapshotStorageKey(key);
    if (!parsed) continue;
    if (!indexedIds.has(parsed.snapshotId)) {
      orphanIds.add(parsed.snapshotId);
    }
  }

  for (const snapshotId of orphanIds) {
    const removed = removeSnapshotKeysForId(snapshotId, storage);
    removedKeys.push(...removed.removedKeys);
    bytesReclaimed += removed.bytesReclaimed;
  }

  for (let i = 0; i < storage.length; i += 1) {
    const key = storage.key(i);
    if (!key) continue;
    const parsed = parseSnapshotStorageKey(key);
    if (parsed?.kind === 'chunk' && !storage.getItem(metaKey(parsed.snapshotId))) {
      bytesReclaimed += removeKey(storage, key);
      removedKeys.push(key);
    }
    if (parsed?.kind === 'meta') {
      const metaRaw = storage.getItem(key);
      if (!metaRaw) continue;
      try {
        const meta = JSON.parse(metaRaw) as { chunkCount?: number };
        const expected = meta.chunkCount ?? 0;
        for (let c = 0; c < expected; c += 1) {
          if (storage.getItem(chunkKey(parsed.snapshotId, c)) === null) {
            const removed = removeSnapshotKeysForId(parsed.snapshotId, storage);
            removedKeys.push(...removed.removedKeys);
            bytesReclaimed += removed.bytesReclaimed;
            break;
          }
        }
      } catch {
        bytesReclaimed += removeKey(storage, key);
        removedKeys.push(key);
      }
    }
  }

  return { removedKeys, bytesReclaimed };
}

/** Run legacy + orphan cleanup — safe to call on every startup. */
export function runPersistenceCleanup(
  storage: SnapshotStorageAdapter = defaultStorage(),
): {
  legacy: CleanupResult;
  orphans: CleanupResult;
  totalBytesReclaimed: number;
} {
  const legacy = cleanupLegacyStorageKeys(storage);
  const orphans = cleanupPersistenceOrphans(storage);
  return {
    legacy,
    orphans,
    totalBytesReclaimed: legacy.bytesReclaimed + orphans.bytesReclaimed,
  };
}

export function countLegacyStorageKeys(
  storage: SnapshotStorageAdapter = defaultStorage(),
): number {
  let count = 0;
  for (const key of LEGACY_NOTE_STORAGE_KEYS) {
    if (storage.getItem(key)) count += 1;
  }
  if (
    isIndexedDbMigrationComplete()
    && storage.getItem(NOTES_KEY)
  ) {
    count += 1;
  }
  for (const key of OBSOLETE_MIGRATION_MARKERS) {
    if (storage.getItem(key)) count += 1;
  }
  return count;
}

export async function getPersistenceMetrics(
  storage: SnapshotStorageAdapter = defaultStorage(),
): Promise<PersistenceMetrics> {
  const audit = auditLocalStorageKeys(storage);
  const summary = summarizeStorageAudit(audit);
  const index = loadSnapshotIndex(storage);

  let indexedDbRecordCount = 0;
  if (typeof indexedDB !== 'undefined') {
    try {
      indexedDbRecordCount = await countIndexedDbNotes();
    } catch {
      indexedDbRecordCount = 0;
    }
  }

  const orphanKeys = countOrphanSnapshotKeys(storage);

  return {
    localStorageBytes: summary.totalBytes,
    indexedDbRecordCount,
    snapshotBytes: index.entries.reduce((sum, e) => sum + e.payloadBytes, 0),
    snapshotCount: index.entries.length,
    orphanKeys,
    legacyKeys: countLegacyStorageKeys(storage),
  };
}

/** Count orphan snapshot keys without mutating storage (for metrics). */
export function countOrphanSnapshotKeys(
  storage: SnapshotStorageAdapter = defaultStorage(),
): number {
  const index = loadSnapshotIndex(storage);
  const indexedIds = new Set(index.entries.map(e => e.snapshotId));
  let count = 0;
  for (let i = 0; i < storage.length; i += 1) {
    const key = storage.key(i);
    if (!key) continue;
    const parsed = parseSnapshotStorageKey(key);
    if (parsed && !indexedIds.has(parsed.snapshotId)) count += 1;
  }
  return count;
}
