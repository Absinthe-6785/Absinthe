import type { VaultBackupManifest } from './exportVaultBackup';
import {
  ABSINTHE_APP_VERSION,
  VAULT_BACKUP_SCHEMA_VERSION,
  VAULT_EXPORT_KIND,
  VAULT_EXTENSIONS_SCHEMA_VERSION,
} from './vaultBackupConstants';
import { canonicalizeVaultRestoreManifest, parseVaultBackupJson, validateVaultBackupManifest } from './importVaultBackup';
import { parseVaultBackupZipWithRawManifest } from './vaultBackupZip';
import { SNAPSHOT_CHUNK_TARGET_BYTES } from './snapshotCompaction';
import {
  SNAPSHOT_CHUNK_PREFIX,
  SNAPSHOT_CHUNK_STORAGE_FORMAT,
  SNAPSHOT_INDEX_KEY,
  SNAPSHOT_META_PREFIX,
  SNAPSHOT_PAYLOAD_PREFIX,
  VAULT_SNAPSHOT_KIND,
  VAULT_SNAPSHOT_SCHEMA_VERSION,
  type VaultSnapshotSlot,
} from './vaultSnapshotConstants';
import { parseVaultSnapshotJson, type VaultSnapshot } from './vaultSnapshotBuild';
import { validateVaultSnapshot } from './vaultSnapshotValidate';

/** Read-only subset. Deliberately has no storage write, delete, or enumeration methods. */
export interface VaultRestoreSnapshotSourceStorage {
  getItem(key: string): string | null;
}
export type RestoreSourceOrigin = 'snapshot' | 'direct-json' | 'direct-zip';

export type RestoreSourceDenialCode =
  | 'INVALID_SOURCE_INTEGRITY'
  | 'UNKNOWN_SOURCE_GENERATION'
  | 'SOURCE_UNAVAILABLE'
  | 'INVALID_MANIFEST';

export interface ValidatedRestoreSource {
  readonly origin: RestoreSourceOrigin;
  /** Display and diagnostics only; it does not authenticate a producer. */
  readonly sourceId: string;
  /** Detached canonical copy. This value is never accepted back as source authority. */
  readonly manifest: Readonly<VaultBackupManifest>;
}

export type RestoreSourceReadResult =
  | { readonly ok: true; readonly source: ValidatedRestoreSource }
  | { readonly ok: false; readonly code: RestoreSourceDenialCode };

interface SourceProof {
  readonly origin: RestoreSourceOrigin;
  readonly identity: string | Uint8Array;
}

const sourceProofs = new WeakMap<object, SourceProof>();

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hasOwn(value: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

type DirectOriginClassification =
  | 'VALID_DIRECT_MANIFEST'
  | 'SNAPSHOT_ENVELOPE'
  | 'AMBIGUOUS_DUAL_SHAPE'
  | 'INVALID_INPUT';

/** Classify provenance from the unnormalized envelope; normalization drops unknown fields. */
function classifyDirectOrigin(raw: unknown): DirectOriginClassification {
  if (!isRecord(raw)) return 'INVALID_INPUT';
  const directShape = raw.app === 'absinthe'
    && typeof raw.schemaVersion === 'number'
    && typeof raw.exportedAt === 'string'
    && Array.isArray(raw.folders)
    && Array.isArray(raw.notes);
  const snapshotMarker = raw.kind === VAULT_SNAPSHOT_KIND
    || hasOwn(raw, 'snapshotSchemaVersion')
    || hasOwn(raw, 'snapshotId')
    || hasOwn(raw, 'vault');
  if (snapshotMarker) return directShape ? 'AMBIGUOUS_DUAL_SHAPE' : 'SNAPSHOT_ENVELOPE';
  if (hasOwn(raw, 'kind') && raw.kind !== VAULT_EXPORT_KIND) {
    return directShape ? 'AMBIGUOUS_DUAL_SHAPE' : 'INVALID_INPUT';
  }
  return directShape ? 'VALID_DIRECT_MANIFEST' : 'INVALID_INPUT';
}

function nonempty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function safeNonnegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function safePositiveInteger(value: unknown): value is number {
  return safeNonnegativeInteger(value) && value > 0;
}

function validSlot(value: unknown): value is VaultSnapshotSlot {
  return value === 'last' || value === 'daily' || value === 'weekly' || value === 'monthly';
}

function freezeDeep<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) freezeDeep(child);
  }
  return value;
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function createSource(
  origin: RestoreSourceOrigin,
  sourceId: string,
  manifest: VaultBackupManifest,
  identity: string | Uint8Array,
): ValidatedRestoreSource {
  const source = Object.freeze({
    origin,
    sourceId,
    manifest: freezeDeep(cloneJson(manifest)),
  });
  sourceProofs.set(source, {
    origin,
    identity: typeof identity === 'string' ? identity : identity.slice(),
  });
  return source;
}

/** Exact proof equality for two values minted by this reader; never grants authority. */
export function sameValidatedRestoreSource(
  left: ValidatedRestoreSource,
  right: ValidatedRestoreSource,
): boolean {
  const a = sourceProofs.get(left as object);
  const b = sourceProofs.get(right as object);
  if (!a || !b || a.origin !== b.origin || typeof a.identity !== typeof b.identity) return false;
  if (typeof a.identity === 'string' && typeof b.identity === 'string') return a.identity === b.identity;
  if (!(a.identity instanceof Uint8Array) || !(b.identity instanceof Uint8Array)
    || a.identity.length !== b.identity.length) return false;
  for (let i = 0; i < a.identity.length; i += 1) {
    if (a.identity[i] !== b.identity[i]) return false;
  }
  return true;
}

interface SnapshotIndexEntry {
  readonly snapshotId: string;
  readonly slot: VaultSnapshotSlot;
  readonly slotKey: string;
  readonly createdAt: string;
  readonly contentFingerprint: string;
  readonly payloadBytes: number;
  readonly chunkCount?: number;
  readonly writeCount?: number;
}

interface SnapshotPayloadRead {
  readonly raw: string;
  readonly storageEvidence: readonly string[];
}

function parseTrustedSnapshotIndex(raw: string | null): readonly SnapshotIndexEntry[] | null {
  if (raw === null) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(parsed) || parsed.schemaVersion !== 1 || !Array.isArray(parsed.entries)) return null;
  const ids = new Set<string>();
  const slots = new Set<string>();
  const entries: SnapshotIndexEntry[] = [];
  for (const candidate of parsed.entries) {
    if (!isRecord(candidate)
      || !nonempty(candidate.snapshotId)
      || !validSlot(candidate.slot)
      || !nonempty(candidate.slotKey)
      || !nonempty(candidate.createdAt)
      || !Number.isFinite(Date.parse(candidate.createdAt))
      || !nonempty(candidate.contentFingerprint)
      || !safeNonnegativeInteger(candidate.payloadBytes)
      || (candidate.chunkCount !== undefined && !safePositiveInteger(candidate.chunkCount))
      || (candidate.writeCount !== undefined && !safePositiveInteger(candidate.writeCount))
      || ids.has(candidate.snapshotId)
      || slots.has(candidate.slotKey)) return null;
    ids.add(candidate.snapshotId);
    slots.add(candidate.slotKey);
    entries.push(candidate as unknown as SnapshotIndexEntry);
  }
  return entries;
}

function readIndexedSnapshotPayload(
  snapshotId: string,
  entry: SnapshotIndexEntry,
  storage: VaultRestoreSnapshotSourceStorage,
): SnapshotPayloadRead | null {
  const legacyKey = `${SNAPSHOT_PAYLOAD_PREFIX}${snapshotId}:v1`;
  const legacy = storage.getItem(legacyKey);
  // Match the established read precedence: any present legacy value shadows chunks.
  if (legacy !== null) return { raw: legacy, storageEvidence: ['legacy', legacy] };

  const metaKey = `${SNAPSHOT_META_PREFIX}${snapshotId}:v1`;
  const metaRaw = storage.getItem(metaKey);
  if (metaRaw === null) return null;
  let meta: unknown;
  try {
    meta = JSON.parse(metaRaw);
  } catch {
    return null;
  }
  if (!isRecord(meta)
    || meta.storageFormat !== SNAPSHOT_CHUNK_STORAGE_FORMAT
    || !safePositiveInteger(meta.chunkCount)
    || !safePositiveInteger(meta.totalBytes)
    || meta.totalBytes !== entry.payloadBytes
    || meta.chunkCount > Math.ceil(meta.totalBytes / SNAPSHOT_CHUNK_TARGET_BYTES)
    || (entry.chunkCount !== undefined && entry.chunkCount !== meta.chunkCount)
    || (entry.writeCount !== undefined && entry.writeCount !== meta.chunkCount + 1)) return null;

  const chunks: string[] = [];
  for (let index = 0; index < meta.chunkCount; index += 1) {
    const chunk = storage.getItem(`${SNAPSHOT_CHUNK_PREFIX}${snapshotId}:${index}:v1`);
    if (chunk === null || chunk.length === 0 || chunk.length > SNAPSHOT_CHUNK_TARGET_BYTES
      || (index < meta.chunkCount - 1 && chunk.length !== SNAPSHOT_CHUNK_TARGET_BYTES)) return null;
    chunks.push(chunk);
  }
  const raw = chunks.join('');
  if (new TextEncoder().encode(raw).length !== meta.totalBytes) return null;
  return { raw, storageEvidence: ['chunked', metaRaw, ...chunks] };
}

function isCurrentSnapshotProfile(snapshot: VaultSnapshot): boolean {
  return snapshot.kind === VAULT_SNAPSHOT_KIND
    && snapshot.snapshotSchemaVersion === VAULT_SNAPSHOT_SCHEMA_VERSION
    && snapshot.appVersion === ABSINTHE_APP_VERSION
    && snapshot.vault?.app === 'absinthe'
    && snapshot.vault?.schemaVersion === VAULT_BACKUP_SCHEMA_VERSION
    && snapshot.vault?.kind === VAULT_EXPORT_KIND
    && snapshot.extensions?.schemaVersion === VAULT_EXTENSIONS_SCHEMA_VERSION
    // Snapshot admission in this slice has no cloud restore authority.
    && (snapshot.vault?.cloud === undefined || snapshot.vault.cloud === null);
}

function canonicalManifest(manifest: VaultBackupManifest): VaultBackupManifest | null {
  const canonical = canonicalizeVaultRestoreManifest(cloneJson(manifest));
  if (!canonical || !validateVaultBackupManifest(canonical, [], []).valid) return null;
  return canonical;
}

/** Read and validate an indexed local snapshot without changing storage. */
export function readVaultRestoreSnapshotSource(
  requestedSnapshotId: string,
  storage: VaultRestoreSnapshotSourceStorage,
): RestoreSourceReadResult {
  if (!nonempty(requestedSnapshotId)) return { ok: false, code: 'INVALID_SOURCE_INTEGRITY' };
  try {
    const indexRaw = storage.getItem(SNAPSHOT_INDEX_KEY);
    const entries = parseTrustedSnapshotIndex(indexRaw);
    if (!entries) return { ok: false, code: 'INVALID_SOURCE_INTEGRITY' };
    const matches = entries.filter(entry => entry.snapshotId === requestedSnapshotId);
    if (matches.length !== 1) return { ok: false, code: 'INVALID_SOURCE_INTEGRITY' };
    const entry = matches[0]!;
    const payload = readIndexedSnapshotPayload(requestedSnapshotId, entry, storage);
    if (!payload || new TextEncoder().encode(payload.raw).length !== entry.payloadBytes) {
      return { ok: false, code: 'INVALID_SOURCE_INTEGRITY' };
    }
    const snapshot = parseVaultSnapshotJson(payload.raw);
    if (!snapshot
      || snapshot.snapshotId !== requestedSnapshotId
      || snapshot.snapshotId !== entry.snapshotId
      || snapshot.slot !== entry.slot
      || snapshot.slotKey !== entry.slotKey
      || snapshot.createdAt !== entry.createdAt
      || snapshot.contentFingerprint !== entry.contentFingerprint) {
      return { ok: false, code: 'INVALID_SOURCE_INTEGRITY' };
    }
    if (!isCurrentSnapshotProfile(snapshot)) {
      return { ok: false, code: 'UNKNOWN_SOURCE_GENERATION' };
    }
    const report = validateVaultSnapshot(snapshot);
    if (!report.valid || !report.fingerprintMatch || !report.restoreReady) {
      return { ok: false, code: 'INVALID_SOURCE_INTEGRITY' };
    }
    const manifest = canonicalManifest(snapshot.vault);
    if (!manifest) return { ok: false, code: 'INVALID_MANIFEST' };
    const evidence = JSON.stringify([
      JSON.stringify(entry),
      payload.storageEvidence,
      payload.raw,
    ]);
    return {
      ok: true,
      source: createSource('snapshot', requestedSnapshotId, manifest, evidence),
    };
  } catch {
    return { ok: false, code: 'SOURCE_UNAVAILABLE' };
  }
}
async function readDirectBytes(file: Blob): Promise<Uint8Array> {
  return new Uint8Array(await file.arrayBuffer());
}

/** Parse direct JSON from the selected file's exact bytes; no snapshot fallback. */
export async function readVaultRestoreDirectJsonSource(file: Blob): Promise<RestoreSourceReadResult> {
  try {
    const bytes = await readDirectBytes(file);
    const rawText = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    const raw: unknown = JSON.parse(rawText);
    if (classifyDirectOrigin(raw) !== 'VALID_DIRECT_MANIFEST') {
      return { ok: false, code: 'INVALID_MANIFEST' };
    }
    const manifest = parseVaultBackupJson(rawText);
    if (!manifest) return { ok: false, code: 'INVALID_MANIFEST' };
    const canonical = canonicalManifest(manifest);
    if (!canonical) return { ok: false, code: 'INVALID_MANIFEST' };
    return {
      ok: true,
      source: createSource('direct-json', `direct-json:${bytes.length}`, canonical, bytes),
    };
  } catch {
    return { ok: false, code: 'SOURCE_UNAVAILABLE' };
  }
}

/** Parse direct ZIP from the selected file's exact bytes; no snapshot fallback. */
export async function readVaultRestoreDirectZipSource(file: Blob): Promise<RestoreSourceReadResult> {
  try {
    const bytes = await readDirectBytes(file);
    const parsed = await parseVaultBackupZipWithRawManifest(new Blob([bytes.buffer.slice(
      bytes.byteOffset,
      bytes.byteOffset + bytes.byteLength,
    ) as ArrayBuffer]));
    if (!parsed || classifyDirectOrigin(parsed.rawManifest) !== 'VALID_DIRECT_MANIFEST') {
      return { ok: false, code: 'INVALID_MANIFEST' };
    }
    const canonical = canonicalManifest(parsed.manifest);
    if (!canonical) return { ok: false, code: 'INVALID_MANIFEST' };
    return {
      ok: true,
      source: createSource('direct-zip', `direct-zip:${bytes.length}`, canonical, bytes),
    };
  } catch {
    return { ok: false, code: 'SOURCE_UNAVAILABLE' };
  }
}
