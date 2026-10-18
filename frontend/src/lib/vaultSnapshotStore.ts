import {
  SNAPSHOT_INDEX_KEY,
  SNAPSHOT_PAYLOAD_PREFIX,
  SNAPSHOT_META_PREFIX,
  SNAPSHOT_CHUNK_PREFIX,
  SNAPSHOT_CHUNK_STORAGE_FORMAT,
  SNAPSHOT_RETENTION,
  type VaultSnapshotSlot,
} from './vaultSnapshotConstants';
import {
  parseVaultSnapshotJson,
  serializeVaultSnapshot,
  type VaultSnapshot,
} from './vaultSnapshotBuild';
import {
  SNAPSHOT_CHUNK_TARGET_BYTES,
  planSnapshotChunks,
  splitSnapshotIntoChunks,
} from './snapshotCompaction';
import { validateVaultSnapshot } from './vaultSnapshotValidate';

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
  chunkCount?: number;
  writeCount?: number;
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

function metaKey(snapshotId: string): string {
  return `${SNAPSHOT_META_PREFIX}${snapshotId}:v1`;
}

function chunkKey(snapshotId: string, index: number): string {
  return `${SNAPSHOT_CHUNK_PREFIX}${snapshotId}:${index}:v1`;
}

interface ChunkedSnapshotMeta {
  storageFormat: typeof SNAPSHOT_CHUNK_STORAGE_FORMAT;
  chunkCount: number;
  totalBytes: number;
}

function removeChunkedPayload(snapshotId: string, storage: SnapshotStorageAdapter): void {
  const metaRaw = storage.getItem(metaKey(snapshotId));
  storage.removeItem(metaKey(snapshotId));
  if (!metaRaw) return;
  try {
    const meta = JSON.parse(metaRaw) as ChunkedSnapshotMeta;
    for (let i = 0; i < meta.chunkCount; i += 1) {
      storage.removeItem(chunkKey(snapshotId, i));
    }
  } catch {
    /** ignore malformed meta */
  }
}

function readChunkedPayload(snapshotId: string, storage: SnapshotStorageAdapter): string | null {
  const metaRaw = storage.getItem(metaKey(snapshotId));
  if (!metaRaw) return null;
  try {
    const meta = JSON.parse(metaRaw) as ChunkedSnapshotMeta;
    if (meta.storageFormat !== SNAPSHOT_CHUNK_STORAGE_FORMAT) return null;
    let assembled = '';
    for (let i = 0; i < meta.chunkCount; i += 1) {
      const chunk = storage.getItem(chunkKey(snapshotId, i));
      if (chunk === null) return null;
      assembled += chunk;
    }
    return assembled;
  } catch {
    return null;
  }
}

/** Test/audit helper — inspect chunk plan without writing storage. */
export function inspectSnapshotChunkPlan(serialized: string) {
  return planSnapshotChunks(serialized, SNAPSHOT_CHUNK_TARGET_BYTES);
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

export { saveSnapshotIndex };

export function loadSnapshotPayload(
  snapshotId: string,
  storage: SnapshotStorageAdapter = defaultStorage(),
): VaultSnapshot | null {
  const legacyRaw = storage.getItem(payloadKey(snapshotId));
  if (legacyRaw) return parseVaultSnapshotJson(legacyRaw);

  const chunkedRaw = readChunkedPayload(snapshotId, storage);
  if (chunkedRaw) return parseVaultSnapshotJson(chunkedRaw);
  return null;
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
  removeChunkedPayload(entry.snapshotId, storage);
}

/** Pure plan: payload deletion is permitted only AFTER index publication. */
function pruneIndex(index: VaultSnapshotIndex): VaultSnapshotIndex {
  let entries = [...index.entries];

  const bySlot = (slot: VaultSnapshotSlot) =>
    entries.filter(e => e.slot === slot).sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const keepLast = bySlot('last').slice(0, 1);
  const keepDaily = bySlot('daily').slice(0, SNAPSHOT_RETENTION.maxDaily);
  const keepWeekly = bySlot('weekly').slice(0, SNAPSHOT_RETENTION.maxWeekly);
  const keepMonthly = bySlot('monthly').slice(0, SNAPSHOT_RETENTION.maxMonthly);

  const keepIds = new Set([
    ...keepLast.map(e => e.snapshotId),
    ...keepDaily.map(e => e.snapshotId),
    ...keepWeekly.map(e => e.snapshotId),
    ...keepMonthly.map(e => e.snapshotId),
  ]);

  entries = entries.filter(e => keepIds.has(e.snapshotId));

  let totalBytes = entries.reduce((sum, e) => sum + e.payloadBytes, 0);
  if (totalBytes > SNAPSHOT_RETENTION.maxTotalBytes) {
    const droppable = entries
      .filter(e => e.slot !== 'last')
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    for (const entry of droppable) {
      if (totalBytes <= SNAPSHOT_RETENTION.maxTotalBytes) break;
      entries = entries.filter(e => e.snapshotId !== entry.snapshotId);
      totalBytes -= entry.payloadBytes;
    }
  }

  return { schemaVersion: 1, entries };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function nonemptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function validSlot(value: unknown): value is VaultSnapshotSlot {
  return value === 'last' || value === 'daily' || value === 'weekly' || value === 'monthly';
}

function nonnegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function positiveInteger(value: unknown): value is number {
  return nonnegativeInteger(value) && value > 0;
}

function validIdentity(value: Record<string, unknown>): boolean {
  return nonemptyString(value.snapshotId) && validSlot(value.slot) && nonemptyString(value.slotKey)
    && nonemptyString(value.contentFingerprint) && nonemptyString(value.createdAt)
    && Number.isFinite(Date.parse(value.createdAt));
}

/** Save-private trust gate. Public tolerant readers deliberately remain unchanged. */
function readTrustedIndex(storage: SnapshotStorageAdapter): VaultSnapshotIndex {
  const raw = storage.getItem(SNAPSHOT_INDEX_KEY);
  if (raw === null) return { schemaVersion: 1, entries: [] };
  const parsed: unknown = JSON.parse(raw);
  if (!isRecord(parsed) || parsed.schemaVersion !== 1 || !Array.isArray(parsed.entries)) {
    throw new Error('Invalid snapshot index');
  }
  const ids = new Set<string>();
  const slots = new Set<string>();
  for (const entry of parsed.entries) {
    if (!isRecord(entry) || !validIdentity(entry) || !nonnegativeInteger(entry.payloadBytes)
      || (entry.chunkCount !== undefined && !positiveInteger(entry.chunkCount))
      || (entry.writeCount !== undefined && !positiveInteger(entry.writeCount))
      || ids.has(entry.snapshotId as string) || slots.has(entry.slotKey as string)) {
      throw new Error('Invalid snapshot index entry');
    }
    ids.add(entry.snapshotId as string);
    slots.add(entry.slotKey as string);
  }
  // Keep historical optional/unknown fields; none confer deletion authority.
  return parsed as unknown as VaultSnapshotIndex;
}

function requireUsablePayload(raw: string, entry: VaultSnapshotIndexEntry): VaultSnapshot {
  const snapshot = parseVaultSnapshotJson(raw);
  if (!snapshot || !validIdentity(snapshot as unknown as Record<string, unknown>)
    || snapshot.snapshotId !== entry.snapshotId || snapshot.slot !== entry.slot
    || snapshot.slotKey !== entry.slotKey || snapshot.createdAt !== entry.createdAt
    || snapshot.contentFingerprint !== entry.contentFingerprint
    || new TextEncoder().encode(raw).length !== entry.payloadBytes) {
    throw new Error('Snapshot identity or bytes mismatch');
  }
  const report = validateVaultSnapshot(snapshot);
  if (!report.valid || !report.fingerprintMatch || !report.restoreReady) {
    throw new Error('Snapshot is not a usable recovery copy');
  }
  return snapshot;
}

/** Read/validate before granting either unchanged-skip or exact cleanup authority. */
function readValidatedPayloadKeys(entry: VaultSnapshotIndexEntry, storage: SnapshotStorageAdapter): string[] {
  const legacy = storage.getItem(payloadKey(entry.snapshotId));
  if (legacy !== null) {
    requireUsablePayload(legacy, entry);
    // A legacy blob proves only its own key, not any shadow/orphan chunk keys.
    return [payloadKey(entry.snapshotId)];
  }
  const raw = storage.getItem(metaKey(entry.snapshotId));
  if (raw === null) throw new Error('Missing snapshot metadata');
  const meta: unknown = JSON.parse(raw);
  if (!isRecord(meta) || meta.storageFormat !== SNAPSHOT_CHUNK_STORAGE_FORMAT
    || !positiveInteger(meta.chunkCount) || !positiveInteger(meta.totalBytes)
    || meta.totalBytes !== entry.payloadBytes
    || meta.chunkCount > Math.ceil(meta.totalBytes / SNAPSHOT_CHUNK_TARGET_BYTES)
    || (entry.chunkCount !== undefined && entry.chunkCount !== meta.chunkCount)
    || (entry.writeCount !== undefined && entry.writeCount !== meta.chunkCount + 1)) {
    throw new Error('Invalid snapshot metadata');
  }
  const keys = [metaKey(entry.snapshotId)];
  const chunks: string[] = [];
  for (let i = 0; i < meta.chunkCount; i += 1) {
    const key = chunkKey(entry.snapshotId, i);
    const chunk = storage.getItem(key);
    if (chunk === null || chunk.length === 0 || chunk.length > SNAPSHOT_CHUNK_TARGET_BYTES
      || (i < meta.chunkCount - 1 && chunk.length !== SNAPSHOT_CHUNK_TARGET_BYTES)) {
      throw new Error('Incomplete snapshot chunks');
    }
    keys.push(key);
    chunks.push(chunk);
  }
  requireUsablePayload(chunks.join(''), entry);
  return keys;
}

/** Best effort, finite, exact keys only. Refusal leaves residue; never retry/scan. */
function cleanupKeys(keys: readonly string[], storage: SnapshotStorageAdapter): boolean {
  try {
    for (const key of keys) storage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

function isQuotaFailure(error: unknown): boolean {
  return error instanceof DOMException
    && (error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED');
}

export interface SaveSnapshotResult {
  saved: boolean;
  skipped: boolean;
  reason?: 'unchanged' | 'quota';
  snapshotId?: string;
  chunkCount?: number;
  writeCount?: number;
}

export function saveVaultSnapshot(
  snapshot: VaultSnapshot,
  storage?: SnapshotStorageAdapter,
): SaveSnapshotResult {
  // M1: native/browser-faithful, synchronous, non-reentrant, no other writer.
  // A throwing set leaves its target unchanged. Not an arbitrary-adapter,
  // cross-tab transaction or disk-durability guarantee. No rollback dependency.
  const ownedKeys: string[] = [];
  let candidate: VaultSnapshotIndex;
  let previous: VaultSnapshotIndex;
  let entry: VaultSnapshotIndexEntry;
  try {
    storage ??= defaultStorage();
    previous = readTrustedIndex(storage);
    const serialized = serializeVaultSnapshot(snapshot);
    const frozen = parseVaultSnapshotJson(serialized);
    if (!frozen) throw new Error('Invalid snapshot envelope');
    const plan = planSnapshotChunks(serialized, SNAPSHOT_CHUNK_TARGET_BYTES);
    entry = {
      snapshotId: frozen.snapshotId,
      slot: frozen.slot,
      slotKey: frozen.slotKey,
      createdAt: frozen.createdAt,
      contentFingerprint: frozen.contentFingerprint,
      payloadBytes: plan.totalBytes,
      chunkCount: plan.chunkCount,
      writeCount: plan.writeCount,
    };
    requireUsablePayload(serialized, entry);
    const sameSlot = previous.entries.find(e => e.slotKey === entry.slotKey);
    if (sameSlot) {
      readValidatedPayloadKeys(sameSlot, storage);
      if (sameSlot.slot !== entry.slot) throw new Error('Snapshot slot mismatch');
      if (sameSlot.contentFingerprint === entry.contentFingerprint) {
        return { saved: false, skipped: true, reason: 'unchanged' };
      }
    }
    if (previous.entries.some(e => e.snapshotId === entry.snapshotId)) {
      throw new Error('Snapshot ID collision');
    }
    const chunks = splitSnapshotIntoChunks(serialized, SNAPSHOT_CHUNK_TARGET_BYTES);
    const meta = JSON.stringify({
      storageFormat: SNAPSHOT_CHUNK_STORAGE_FORMAT,
      chunkCount: chunks.length,
      totalBytes: plan.totalBytes,
    } satisfies ChunkedSnapshotMeta);
    const staged = [
      [metaKey(entry.snapshotId), meta],
      ...chunks.map((chunk, i) => [chunkKey(entry.snapshotId, i), chunk]),
    ];
    // Prove ALL keys fresh before the first write. Even an empty value collides.
    for (const key of [payloadKey(entry.snapshotId), ...staged.map(([key]) => key)]) {
      if (storage.getItem(key) !== null) throw new Error('Occupied snapshot key');
    }
    for (const [key, value] of staged) {
      ownedKeys.push(key); // Include the failing target, already proven absent.
      storage.setItem(key, value);
    }
    for (const [key, value] of staged) {
      if (storage.getItem(key) !== value) throw new Error('Snapshot readback mismatch');
    }
    if (storage.getItem(payloadKey(entry.snapshotId)) !== null) throw new Error('Legacy shadow');
    // Reassemble and validate stored bytes, not just the already-valid input.
    readValidatedPayloadKeys(entry, storage);
    candidate = pruneIndex({
      schemaVersion: 1,
      entries: [...previous.entries.filter(e => e.snapshotId !== sameSlot?.snapshotId), entry],
    });
    if (!candidate.entries.some(e => e.snapshotId === entry.snapshotId)) {
      throw new Error('New snapshot would be pruned');
    }
    // M1 logical commit: successful synchronous return, NOT disk acknowledgement.
    saveSnapshotIndex(candidate, storage);
  } catch (error) {
    if (storage) cleanupKeys(ownedKeys, storage);
    return isQuotaFailure(error)
      ? { saved: false, skipped: false, reason: 'quota' }
      : { saved: false, skipped: false };
  }

  // Commit already confirmed. Cleanup failure must NEVER become save failure.
  const retainedIds = new Set(candidate.entries.map(e => e.snapshotId));
  for (const victim of previous.entries) {
    if (retainedIds.has(victim.snapshotId)) continue;
    try {
      // Capture every validated key before deleting metadata. Unknown/corrupt
      // historical payloads confer no cleanup authority; leave bounded residue.
      const keys = readValidatedPayloadKeys(victim, storage);
      if (!cleanupKeys(keys, storage)) break;
    } catch {
      break;
    }
  }
  return {
    saved: true,
    skipped: false,
    snapshotId: entry.snapshotId,
    chunkCount: entry.chunkCount,
    writeCount: entry.writeCount,
  };
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
    removeSnapshotEntry(entry, storage);
  }
  storage.removeItem(SNAPSHOT_INDEX_KEY);
}
