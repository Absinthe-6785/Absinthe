import { sha256Hex } from './localDatabase/outboxIdentity';

/** K-319 — fail-closed incident recovery boundary for legacy data paths. */
export const RECOVERY_MODE_MESSAGE = 'Data recovery mode is active. This action is temporarily unavailable.';

export type RecoveryOperation =
  | 'hydrate_remote'
  | 'upload_remote'
  | 'restore'
  | 'undo_restore'
  | 'empty_trash'
  | 'reset'
  | 'cross_tab_mutation'
  | 'replace_persisted_notes'
  | 'delete_legacy_storage'
  | 'k326_cutover_activation'
  | 'post_cutover_legacy_write';

export interface RecoveryBlockDiagnostic {
  operation: RecoveryOperation;
  timestamp: number;
  safetyEpoch: number;
  recoveryMode: true;
  reason: 'recovery_mode_active' | 'stale_operation_epoch' | 'unsafe_replacement';
}

let safetyEpoch = 1;
let recoveryModeActive = true;
const logged = new Set<string>();

/** Unsupported K-326A/B shared slot. Its presence always fails closed. */
export const K326_LEGACY_WRITE_FENCE_KEY = 'absinthe:k326:legacy-write-fence';
export const K326_LEGACY_WRITE_FENCE_PREFIX = 'absinthe:k326:legacy-fence:v3:';
const CUTOVER_CAPABILITY = Symbol('k326-cutover-recovery-authorization');
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const HASH = /^[a-f0-9]{64}$/;

export interface RecoveryCutoverAuthorization {
  readonly marker: symbol;
  readonly namespaceKey: string;
  readonly cutoverSessionId: string;
  readonly targetGenerationId: string;
  readonly purpose: 'test' | 'developer';
}

export interface LegacyCutoverFenceIdentity {
  namespaceKey: string;
  cutoverSessionId: string;
  targetGenerationId: string;
  fenceNonce: string;
  fenceEpoch: number;
}

export interface LegacyNotesCutoverFence {
  kind: 'legacy_notes_cutover_fence_v3';
  version: 3;
  storageDigest: string;
  namespaceKey: string;
  cutoverSessionId: string;
  targetGenerationId: string;
  fenceNonce: string;
  fenceEpoch: number;
  state: 'fenced';
}

export type LegacyFenceScanStatus =
  | 'clear'
  | 'valid'
  | 'multiple'
  | 'malformed'
  | 'unsupported'
  | 'changed'
  | 'unreadable';

export interface LegacyFenceScanResult {
  status: LegacyFenceScanStatus;
  fences: readonly LegacyNotesCutoverFence[];
}

export interface LegacyFenceReleaseResult {
  ownFenceReleased: true;
  vaultState: 'clear' | 'blocked_by_other' | 'indeterminate';
  scanStatus: LegacyFenceScanStatus;
}

export type LegacyCutoverFenceErrorCode =
  | 'FENCE_MALFORMED'
  | 'FENCE_INSTANCE_MISMATCH'
  | 'FENCE_OWNERSHIP_CONFLICT'
  | 'FENCE_READBACK_MISMATCH'
  | 'FENCE_RECOVERY_INCOMPLETE'
  | 'FENCE_SET_CHANGED'
  | 'MULTIPLE_FENCES_PRESENT'
  | 'FOREIGN_FENCE_PRESENT'
  | 'FENCE_ARTIFACT_MALFORMED'
  | 'FENCE_VAULT_NOT_CLEAR'
  | 'UNSUPPORTED_SHARED_FENCE';

export class LegacyCutoverFenceError extends Error {
  constructor(readonly code: LegacyCutoverFenceErrorCode) {
    super(code);
    this.name = 'LegacyCutoverFenceError';
  }
}

const NONCE = /^[a-f0-9]{32}$/;

function exactOwnDataKeys(value: unknown, expected: readonly string[]): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return false;
  const keys = Reflect.ownKeys(value);
  if (keys.some(key => typeof key !== 'string')
    || (keys as string[]).sort().join(',') !== [...expected].sort().join(',')) return false;
  return keys.every(key => {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return Boolean(descriptor && 'value' in descriptor && descriptor.enumerable);
  });
}

export function isLegacyCutoverFenceIdentity(value: unknown): value is LegacyCutoverFenceIdentity {
  const keys = ['namespaceKey', 'cutoverSessionId', 'targetGenerationId', 'fenceNonce', 'fenceEpoch'];
  if (!exactOwnDataKeys(value, keys)) return false;
  const record = value as unknown as LegacyCutoverFenceIdentity;
  return HASH.test(record.namespaceKey) && SAFE_ID.test(record.cutoverSessionId)
    && SAFE_ID.test(record.targetGenerationId) && NONCE.test(record.fenceNonce)
    && Number.isSafeInteger(record.fenceEpoch) && record.fenceEpoch > 0;
}

function canonicalFenceIdentity(identity: LegacyCutoverFenceIdentity): string {
  return JSON.stringify([
    'absinthe-k326-legacy-fence-identity-v3', 3, identity.namespaceKey, identity.cutoverSessionId,
    identity.targetGenerationId, identity.fenceNonce, identity.fenceEpoch,
  ]);
}

export function deriveLegacyNotesCutoverFenceKey(identity: LegacyCutoverFenceIdentity): string {
  if (!isLegacyCutoverFenceIdentity(identity)) throw new LegacyCutoverFenceError('FENCE_MALFORMED');
  return `${K326_LEGACY_WRITE_FENCE_PREFIX}${sha256Hex(canonicalFenceIdentity(identity))}`;
}

function buildFence(identity: LegacyCutoverFenceIdentity): LegacyNotesCutoverFence {
  const key = deriveLegacyNotesCutoverFenceKey(identity);
  return Object.freeze({
    kind: 'legacy_notes_cutover_fence_v3', version: 3,
    storageDigest: key.slice(K326_LEGACY_WRITE_FENCE_PREFIX.length),
    ...identity, state: 'fenced',
  });
}

function validFence(value: unknown, storageKey: string): value is LegacyNotesCutoverFence {
  const keys = ['kind', 'version', 'storageDigest', 'namespaceKey', 'cutoverSessionId', 'targetGenerationId',
    'fenceNonce', 'fenceEpoch', 'state'];
  if (!exactOwnDataKeys(value, keys)) return false;
  const record = value as unknown as LegacyNotesCutoverFence;
  const identity: LegacyCutoverFenceIdentity = {
    namespaceKey: record.namespaceKey,
    cutoverSessionId: record.cutoverSessionId,
    targetGenerationId: record.targetGenerationId,
    fenceNonce: record.fenceNonce,
    fenceEpoch: record.fenceEpoch,
  };
  if (record.kind !== 'legacy_notes_cutover_fence_v3' || record.version !== 3 || record.state !== 'fenced'
    || !HASH.test(record.storageDigest) || !isLegacyCutoverFenceIdentity(identity)) return false;
  const expectedKey = deriveLegacyNotesCutoverFenceKey(identity);
  return storageKey === expectedKey
    && record.storageDigest === expectedKey.slice(K326_LEGACY_WRITE_FENCE_PREFIX.length);
}

interface FenceStorageEntry { key: string; raw: string }

function compareCanonicalStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function captureFenceEntries(): FenceStorageEntry[] {
  if (typeof localStorage === 'undefined') throw new LegacyCutoverFenceError('FENCE_RECOVERY_INCOMPLETE');
  const keys: string[] = [];
  const length = localStorage.length;
  for (let index = 0; index < length; index += 1) {
    const key = localStorage.key(index);
    if (key === null) throw new LegacyCutoverFenceError('FENCE_SET_CHANGED');
    if (key === K326_LEGACY_WRITE_FENCE_KEY || key.startsWith(K326_LEGACY_WRITE_FENCE_PREFIX)) keys.push(key);
  }
  keys.sort(compareCanonicalStrings);
  if (new Set(keys).size !== keys.length) throw new LegacyCutoverFenceError('FENCE_SET_CHANGED');
  return keys.map(key => {
    const raw = localStorage.getItem(key);
    if (raw === null) throw new LegacyCutoverFenceError('FENCE_SET_CHANGED');
    return { key, raw };
  });
}

function sameCapture(left: readonly FenceStorageEntry[], right: readonly FenceStorageEntry[]): boolean {
  return left.length === right.length
    && left.every((entry, index) => entry.key === right[index]?.key && entry.raw === right[index]?.raw);
}

export function scanLegacyNotesCutoverFences(): LegacyFenceScanResult {
  try {
    const first = captureFenceEntries();
    const second = captureFenceEntries();
    if (!sameCapture(first, second)) return { status: 'changed', fences: [] };
    if (second.some(entry => entry.key === K326_LEGACY_WRITE_FENCE_KEY)) {
      return { status: 'unsupported', fences: [] };
    }
    const fences: LegacyNotesCutoverFence[] = [];
    for (const entry of second) {
      if (!new RegExp(`^${K326_LEGACY_WRITE_FENCE_PREFIX}[a-f0-9]{64}$`).test(entry.key)) {
        return { status: 'malformed', fences: [] };
      }
      let value: unknown;
      try { value = JSON.parse(entry.raw); } catch { return { status: 'malformed', fences: [] }; }
      if (!validFence(value, entry.key)) return { status: 'malformed', fences: [] };
      fences.push(value);
    }
    if (fences.length === 0) return { status: 'clear', fences };
    return { status: fences.length === 1 ? 'valid' : 'multiple', fences };
  } catch {
    return { status: 'unreadable', fences: [] };
  }
}

function scanError(status: LegacyFenceScanStatus): LegacyCutoverFenceError {
  const code: LegacyCutoverFenceErrorCode = status === 'changed' ? 'FENCE_SET_CHANGED'
    : status === 'multiple' ? 'MULTIPLE_FENCES_PRESENT'
      : status === 'unsupported' ? 'UNSUPPORTED_SHARED_FENCE'
        : status === 'malformed' ? 'FENCE_ARTIFACT_MALFORMED'
          : status === 'unreadable' ? 'FENCE_RECOVERY_INCOMPLETE'
            : status === 'valid' ? 'FOREIGN_FENCE_PRESENT' : 'FENCE_VAULT_NOT_CLEAR';
  return new LegacyCutoverFenceError(code);
}

function exactFenceFromRaw(storageKey: string, raw: string | null): LegacyNotesCutoverFence | null {
  if (raw === null) return null;
  let value: unknown;
  try { value = JSON.parse(raw); } catch { throw new LegacyCutoverFenceError('FENCE_ARTIFACT_MALFORMED'); }
  if (!validFence(value, storageKey)) throw new LegacyCutoverFenceError('FENCE_ARTIFACT_MALFORMED');
  return value;
}

function soleExpectedFence(scan: LegacyFenceScanResult, identity: LegacyCutoverFenceIdentity): LegacyNotesCutoverFence {
  if (scan.status !== 'valid') throw scanError(scan.status);
  const fence = scan.fences[0];
  if (!sameLegacyCutoverFenceIdentity(fence, identity)) throw new LegacyCutoverFenceError('FOREIGN_FENCE_PRESENT');
  return fence;
}

export function createRecoveryCutoverAuthorization(input: {
  namespaceKey: string;
  cutoverSessionId: string;
  targetGenerationId: string;
  purpose: 'test' | 'developer';
}): RecoveryCutoverAuthorization {
  if (!HASH.test(input.namespaceKey) || !SAFE_ID.test(input.cutoverSessionId) || !SAFE_ID.test(input.targetGenerationId)) {
    throw new RecoveryModeBlockedError('k326_cutover_activation');
  }
  return Object.freeze({ marker: CUTOVER_CAPABILITY, ...input });
}

function assertCutoverAuthorization(
  authorization: RecoveryCutoverAuthorization,
  expected: Pick<LegacyNotesCutoverFence, 'namespaceKey' | 'cutoverSessionId' | 'targetGenerationId'>,
): void {
  if (authorization?.marker !== CUTOVER_CAPABILITY
    || authorization.namespaceKey !== expected.namespaceKey
    || authorization.cutoverSessionId !== expected.cutoverSessionId
    || authorization.targetGenerationId !== expected.targetGenerationId) {
    throw new RecoveryModeBlockedError('k326_cutover_activation');
  }
}

export function validateRecoveryCutoverAuthorization(
  authorization: RecoveryCutoverAuthorization,
  expected: Pick<LegacyNotesCutoverFence, 'namespaceKey' | 'cutoverSessionId' | 'targetGenerationId'>,
): void {
  assertCutoverAuthorization(authorization, expected);
}

function randomFenceNonce(): string {
  try {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('');
  } catch {
    throw new LegacyCutoverFenceError('FENCE_READBACK_MISMATCH');
  }
}

export function createLegacyNotesCutoverFenceIdentity(
  authorization: RecoveryCutoverAuthorization,
): LegacyCutoverFenceIdentity {
  const identity: LegacyCutoverFenceIdentity = {
    namespaceKey: authorization.namespaceKey,
    cutoverSessionId: authorization.cutoverSessionId,
    targetGenerationId: authorization.targetGenerationId,
    fenceNonce: randomFenceNonce(),
    fenceEpoch: activateRecoveryMode(),
  };
  assertCutoverAuthorization(authorization, identity);
  if (!isLegacyCutoverFenceIdentity(identity)) throw new LegacyCutoverFenceError('FENCE_MALFORMED');
  return Object.freeze(identity);
}

export function sameLegacyCutoverFenceIdentity(
  left: LegacyCutoverFenceIdentity,
  right: LegacyCutoverFenceIdentity,
): boolean {
  return left.namespaceKey === right.namespaceKey && left.cutoverSessionId === right.cutoverSessionId
    && left.targetGenerationId === right.targetGenerationId && left.fenceNonce === right.fenceNonce
    && left.fenceEpoch === right.fenceEpoch;
}

export function beginLegacyNotesCutoverFence(
  authorization: RecoveryCutoverAuthorization,
  identity: LegacyCutoverFenceIdentity,
): LegacyNotesCutoverFence {
  if (!isLegacyCutoverFenceIdentity(identity)) throw new LegacyCutoverFenceError('FENCE_MALFORMED');
  const next = buildFence(identity);
  assertCutoverAuthorization(authorization, next);
  const initial = scanLegacyNotesCutoverFences();
  if (initial.status === 'valid') return soleExpectedFence(initial, identity);
  if (initial.status !== 'clear') throw scanError(initial.status);
  const key = deriveLegacyNotesCutoverFenceKey(identity);
  try { localStorage.setItem(key, JSON.stringify(next)); }
  catch { throw new LegacyCutoverFenceError('FENCE_READBACK_MISMATCH'); }
  let readBack: LegacyNotesCutoverFence | null;
  try { readBack = exactFenceFromRaw(key, localStorage.getItem(key)); }
  catch { throw new LegacyCutoverFenceError('FENCE_READBACK_MISMATCH'); }
  if (readBack === null || !sameLegacyCutoverFenceIdentity(readBack, identity)) {
    throw new LegacyCutoverFenceError('FENCE_READBACK_MISMATCH');
  }
  return soleExpectedFence(scanLegacyNotesCutoverFences(), identity);
}

export function advanceLegacyNotesCutoverFence(
  authorization: RecoveryCutoverAuthorization,
  identity: LegacyCutoverFenceIdentity,
  _phase: 'activated' | 'confirmed',
): LegacyNotesCutoverFence {
  const existing = soleExpectedFence(scanLegacyNotesCutoverFences(), identity);
  assertCutoverAuthorization(authorization, existing);
  return existing;
}

export function cancelLegacyNotesCutoverFence(
  authorization: RecoveryCutoverAuthorization,
  identity: LegacyCutoverFenceIdentity,
): LegacyFenceReleaseResult {
  if (!isLegacyCutoverFenceIdentity(identity)) throw new LegacyCutoverFenceError('FENCE_MALFORMED');
  assertCutoverAuthorization(authorization, identity);
  const key = deriveLegacyNotesCutoverFenceKey(identity);
  let existing: LegacyNotesCutoverFence | null;
  try { existing = exactFenceFromRaw(key, localStorage.getItem(key)); }
  catch { throw new LegacyCutoverFenceError('FENCE_ARTIFACT_MALFORMED'); }
  if (existing !== null && !sameLegacyCutoverFenceIdentity(existing, identity)) {
    throw new LegacyCutoverFenceError('FENCE_INSTANCE_MISMATCH');
  }
  if (existing !== null) try { localStorage.removeItem(key); }
  catch { throw new LegacyCutoverFenceError('FENCE_RECOVERY_INCOMPLETE'); }
  try {
    if (localStorage.getItem(key) !== null) throw new LegacyCutoverFenceError('FENCE_RECOVERY_INCOMPLETE');
  } catch (error) {
    if (error instanceof LegacyCutoverFenceError) throw error;
    throw new LegacyCutoverFenceError('FENCE_RECOVERY_INCOMPLETE');
  }
  const scan = scanLegacyNotesCutoverFences();
  if (existing !== null) activateRecoveryMode();
  return {
    ownFenceReleased: true,
    vaultState: scan.status === 'clear' ? 'clear'
      : ['valid', 'multiple'].includes(scan.status) ? 'blocked_by_other' : 'indeterminate',
    scanStatus: scan.status,
  };
}

export function readLegacyNotesCutoverFence(): LegacyNotesCutoverFence | 'corrupt' | null {
  const scan = scanLegacyNotesCutoverFences();
  return scan.status === 'clear' ? null : scan.status === 'valid' ? scan.fences[0] : 'corrupt';
}

export function isLegacyNotesWriteBlockedByCutover(): boolean {
  return scanLegacyNotesCutoverFences().status !== 'clear';
}

export function mayWriteLegacyNotes(): boolean {
  if (!isLegacyNotesWriteBlockedByCutover()) return true;
  recordRecoveryBlock('post_cutover_legacy_write');
  return false;
}

// Incident builds are intentionally fail-closed. Disabling this requires a code change.
export function isRecoveryModeActive(): boolean {
  return recoveryModeActive;
}

export function activateRecoveryMode(): number {
  recoveryModeActive = true;
  safetyEpoch += 1;
  return safetyEpoch;
}

export function captureOperationEpoch(): number {
  return safetyEpoch;
}

export function isOperationEpochCurrent(epoch: number): boolean {
  return epoch === safetyEpoch;
}

export function recordRecoveryBlock(
  operation: RecoveryOperation,
  reason: RecoveryBlockDiagnostic['reason'] = 'recovery_mode_active',
): RecoveryBlockDiagnostic {
  const diagnostic: RecoveryBlockDiagnostic = {
    operation,
    timestamp: Date.now(),
    safetyEpoch,
    recoveryMode: true,
    reason,
  };
  const key = `${operation}:${reason}:${safetyEpoch}`;
  if (!logged.has(key)) {
    logged.add(key);
    console.warn('[recovery-safety]', diagnostic);
  }
  return diagnostic;
}

export class RecoveryModeBlockedError extends Error {
  readonly code = 'RECOVERY_MODE_BLOCKED';
  constructor(readonly operation: RecoveryOperation) {
    super(RECOVERY_MODE_MESSAGE);
    this.name = 'RecoveryModeBlockedError';
  }
}

export type PersistedNotesReplacementFailure =
  | 'unknown_current_state'
  | 'invalid_replacement'
  | 'empty_replacement'
  | 'duplicate_id'
  | 'malformed_note'
  | 'missing_existing_id';

export type PersistedNotesReplacementResult =
  | { ok: true }
  | { ok: false; reason: PersistedNotesReplacementFailure };

const mayUseLegacyMutationPath = () => !recoveryModeActive && !isLegacyNotesWriteBlockedByCutover();
export const mayHydrateRemote = mayUseLegacyMutationPath;
export const mayUploadRemote = mayUseLegacyMutationPath;
export const mayRestore = mayUseLegacyMutationPath;
export const mayUndoRestore = mayUseLegacyMutationPath;
export const mayEmptyTrash = mayUseLegacyMutationPath;
export const mayReset = mayUseLegacyMutationPath;
export const mayApplyCrossTabMutation = mayUseLegacyMutationPath;
export const mayDeleteLegacyStorage = mayUseLegacyMutationPath;

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function isCompletePersistedNote(value: unknown): value is { id: string } {
  if (!value || typeof value !== 'object') return false;
  const note = value as Record<string, unknown>;
  return typeof note.id === 'string'
    && note.id.trim().length > 0
    && typeof note.title === 'string'
    && typeof note.body === 'string'
    && isFiniteNumber(note.updatedAt)
    && (note.folderId === null || typeof note.folderId === 'string')
    && (note.deletedAt === null || isFiniteNumber(note.deletedAt));
}

export function validatePersistedNotesReplacement<T extends { id: string }>(
  current: readonly T[] | null,
  replacement: unknown,
): PersistedNotesReplacementResult {
  if (!Array.isArray(replacement)) return { ok: false, reason: 'invalid_replacement' };
  if (!recoveryModeActive) return { ok: true };
  if (current === null) return { ok: false, reason: 'unknown_current_state' };
  if (replacement.length === 0) return { ok: false, reason: 'empty_replacement' };
  if (!replacement.every(isCompletePersistedNote)) return { ok: false, reason: 'malformed_note' };

  const replacementIds = new Set(replacement.map(item => item.id));
  if (replacementIds.size !== replacement.length) return { ok: false, reason: 'duplicate_id' };
  if (!current.every(item => replacementIds.has(item.id))) {
    return { ok: false, reason: 'missing_existing_id' };
  }
  return { ok: true };
}

export function mayReplacePersistedNotes<T extends { id: string }>(
  current: readonly T[] | null,
  replacement: unknown,
): boolean {
  return validatePersistedNotesReplacement(current, replacement).ok;
}

export function assertCurrentOperationEpoch(epoch: number, operation: RecoveryOperation): void {
  if (isOperationEpochCurrent(epoch)) return;
  recordRecoveryBlock(operation, 'stale_operation_epoch');
  throw new RecoveryModeBlockedError(operation);
}

export function resetRecoverySafetyDiagnosticsForTest(): void {
  logged.clear();
}

export function clearLegacyNotesCutoverFenceForTest(): void {
  if (import.meta.env.MODE !== 'test') throw new Error('Cutover fence can only be cleared by test code');
  try {
    const keys: string[] = [];
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (key === K326_LEGACY_WRITE_FENCE_KEY || key?.startsWith(K326_LEGACY_WRITE_FENCE_PREFIX)) keys.push(key);
    }
    keys.forEach(key => localStorage.removeItem(key));
  } catch { /**/ }
  activateRecoveryMode();
  logged.clear();
}

/** Test-only compatibility hook. Production callers cannot disable the incident boundary. */
export function setRecoveryModeActiveForTest(active: boolean): void {
  if (import.meta.env.MODE !== 'test') {
    throw new Error('Recovery mode can only be changed by test code');
  }
  recoveryModeActive = active;
  safetyEpoch += 1;
  logged.clear();
}
