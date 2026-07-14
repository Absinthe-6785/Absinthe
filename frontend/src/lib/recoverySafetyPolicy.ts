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
const K326_LEGACY_WRITE_FENCE_V3_PREFIX = 'absinthe:k326:legacy-fence:v3:';
export const K326_LEGACY_WRITE_FENCE_PREFIX = 'absinthe:k326:legacy-fence:v4:';
export const K326_LEGACY_WRITE_FENCE_SETTLEMENT_PREFIX = 'absinthe:k326:legacy-fence-settlement:v4:';
const K326_LEGACY_FENCE_RESERVED_PREFIX = 'absinthe:k326:legacy-fence:';
const K326_LEGACY_SETTLEMENT_RESERVED_PREFIX = 'absinthe:k326:legacy-fence-settlement:';
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
  kind: 'legacy_notes_cutover_fence_v4';
  version: 4;
  storageDigest: string;
  namespaceKey: string;
  cutoverSessionId: string;
  targetGenerationId: string;
  fenceNonce: string;
  fenceEpoch: number;
}

export interface LegacyNotesCutoverFenceSettlement {
  kind: 'legacy_notes_cutover_fence_settlement_v4';
  version: 4;
  storageDigest: string;
  fenceStorageDigest: string;
  namespaceKey: string;
  cutoverSessionId: string;
  targetGenerationId: string;
  fenceNonce: string;
  fenceEpoch: number;
  outcome: 'precommit_settled';
}

export type LegacyFenceScanStatus =
  | 'operationally_clear'
  | 'active'
  | 'multiple_active'
  | 'malformed'
  | 'orphaned'
  | 'conflicting'
  | 'unsupported'
  | 'changed'
  | 'unreadable';

export interface LegacyFenceScanResult {
  status: LegacyFenceScanStatus;
  fences: readonly LegacyNotesCutoverFence[];
  settlements: readonly LegacyNotesCutoverFenceSettlement[];
  activeFences: readonly LegacyNotesCutoverFence[];
  settledFences: readonly LegacyNotesCutoverFence[];
}

export interface LegacyFenceSettlementResult {
  ownFenceSettled: true;
  vaultState: 'operationally_clear' | 'blocked_by_other_active' | 'indeterminate';
  scanStatus: LegacyFenceScanStatus;
}

export interface LegacyNotesCutoverSettlementArtifact {
  readonly key: string;
  readonly raw: string;
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
  | 'FENCE_NOT_SETTLED'
  | 'FENCE_SETTLEMENT_CONFLICT'
  | 'FENCE_SETTLEMENT_ORPHANED'
  | 'FENCE_SETTLEMENT_MALFORMED'
  | 'FENCE_OPERATIONALLY_BLOCKED'
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
    'absinthe-k326-legacy-fence-identity-v4', 4, identity.namespaceKey, identity.cutoverSessionId,
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
    kind: 'legacy_notes_cutover_fence_v4', version: 4,
    storageDigest: key.slice(K326_LEGACY_WRITE_FENCE_PREFIX.length),
    ...identity,
  });
}

export function deriveLegacyNotesCutoverFenceSettlementKey(identity: LegacyCutoverFenceIdentity): string {
  if (!isLegacyCutoverFenceIdentity(identity)) throw new LegacyCutoverFenceError('FENCE_MALFORMED');
  return `${K326_LEGACY_WRITE_FENCE_SETTLEMENT_PREFIX}${sha256Hex(canonicalFenceIdentity(identity))}`;
}

function buildSettlement(identity: LegacyCutoverFenceIdentity): LegacyNotesCutoverFenceSettlement {
  const fenceKey = deriveLegacyNotesCutoverFenceKey(identity);
  const settlementKey = deriveLegacyNotesCutoverFenceSettlementKey(identity);
  return Object.freeze({
    kind: 'legacy_notes_cutover_fence_settlement_v4', version: 4,
    storageDigest: settlementKey.slice(K326_LEGACY_WRITE_FENCE_SETTLEMENT_PREFIX.length),
    fenceStorageDigest: fenceKey.slice(K326_LEGACY_WRITE_FENCE_PREFIX.length),
    ...identity, outcome: 'precommit_settled',
  });
}

/** Pure canonical serialization only. Physical settlement mutation is repository-private. */
export function buildLegacyNotesCutoverSettlementArtifact(
  identity: LegacyCutoverFenceIdentity,
): LegacyNotesCutoverSettlementArtifact {
  return Object.freeze({
    key: deriveLegacyNotesCutoverFenceSettlementKey(identity),
    raw: JSON.stringify(buildSettlement(identity)),
  });
}

function validFence(value: unknown, storageKey: string): value is LegacyNotesCutoverFence {
  const keys = ['kind', 'version', 'storageDigest', 'namespaceKey', 'cutoverSessionId', 'targetGenerationId',
    'fenceNonce', 'fenceEpoch'];
  if (!exactOwnDataKeys(value, keys)) return false;
  const record = value as unknown as LegacyNotesCutoverFence;
  const identity: LegacyCutoverFenceIdentity = {
    namespaceKey: record.namespaceKey,
    cutoverSessionId: record.cutoverSessionId,
    targetGenerationId: record.targetGenerationId,
    fenceNonce: record.fenceNonce,
    fenceEpoch: record.fenceEpoch,
  };
  if (record.kind !== 'legacy_notes_cutover_fence_v4' || record.version !== 4
    || !HASH.test(record.storageDigest) || !isLegacyCutoverFenceIdentity(identity)) return false;
  const expectedKey = deriveLegacyNotesCutoverFenceKey(identity);
  return storageKey === expectedKey
    && record.storageDigest === expectedKey.slice(K326_LEGACY_WRITE_FENCE_PREFIX.length);
}

function fenceIdentity(value: LegacyNotesCutoverFence | LegacyNotesCutoverFenceSettlement): LegacyCutoverFenceIdentity {
  return {
    namespaceKey: value.namespaceKey, cutoverSessionId: value.cutoverSessionId,
    targetGenerationId: value.targetGenerationId, fenceNonce: value.fenceNonce, fenceEpoch: value.fenceEpoch,
  };
}

function validFenceRaw(value: unknown, storageKey: string, raw: string): value is LegacyNotesCutoverFence {
  return validFence(value, storageKey) && raw === JSON.stringify(buildFence(fenceIdentity(value)));
}

function validSettlement(value: unknown, storageKey: string): value is LegacyNotesCutoverFenceSettlement {
  const keys = ['kind', 'version', 'storageDigest', 'fenceStorageDigest', 'namespaceKey', 'cutoverSessionId',
    'targetGenerationId', 'fenceNonce', 'fenceEpoch', 'outcome'];
  if (!exactOwnDataKeys(value, keys)) return false;
  const record = value as unknown as LegacyNotesCutoverFenceSettlement;
  const identity: LegacyCutoverFenceIdentity = {
    namespaceKey: record.namespaceKey, cutoverSessionId: record.cutoverSessionId,
    targetGenerationId: record.targetGenerationId, fenceNonce: record.fenceNonce, fenceEpoch: record.fenceEpoch,
  };
  if (record.kind !== 'legacy_notes_cutover_fence_settlement_v4' || record.version !== 4
    || record.outcome !== 'precommit_settled' || !HASH.test(record.storageDigest)
    || !HASH.test(record.fenceStorageDigest) || !isLegacyCutoverFenceIdentity(identity)) return false;
  const expectedFenceKey = deriveLegacyNotesCutoverFenceKey(identity);
  const expectedSettlementKey = deriveLegacyNotesCutoverFenceSettlementKey(identity);
  return storageKey === expectedSettlementKey
    && record.storageDigest === expectedSettlementKey.slice(K326_LEGACY_WRITE_FENCE_SETTLEMENT_PREFIX.length)
    && record.fenceStorageDigest === expectedFenceKey.slice(K326_LEGACY_WRITE_FENCE_PREFIX.length);
}

function validSettlementRaw(
  value: unknown, storageKey: string, raw: string,
): value is LegacyNotesCutoverFenceSettlement {
  return validSettlement(value, storageKey) && raw === JSON.stringify(buildSettlement(fenceIdentity(value)));
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
    if (key === K326_LEGACY_WRITE_FENCE_KEY || key.startsWith(K326_LEGACY_FENCE_RESERVED_PREFIX)
      || key.startsWith(K326_LEGACY_SETTLEMENT_RESERVED_PREFIX)) keys.push(key);
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
  const empty = { fences: [], settlements: [], activeFences: [], settledFences: [] } as const;
  try {
    const first = captureFenceEntries();
    const second = captureFenceEntries();
    if (!sameCapture(first, second)) return { status: 'changed', ...empty };
    if (second.some(entry => entry.key === K326_LEGACY_WRITE_FENCE_KEY
      || entry.key.startsWith(K326_LEGACY_WRITE_FENCE_V3_PREFIX)
      || entry.key.startsWith(K326_LEGACY_FENCE_RESERVED_PREFIX) && !entry.key.startsWith(K326_LEGACY_WRITE_FENCE_PREFIX)
      || entry.key.startsWith(K326_LEGACY_SETTLEMENT_RESERVED_PREFIX)
        && !entry.key.startsWith(K326_LEGACY_WRITE_FENCE_SETTLEMENT_PREFIX))) {
      return { status: 'unsupported', ...empty };
    }
    const fences: LegacyNotesCutoverFence[] = [];
    const settlements: LegacyNotesCutoverFenceSettlement[] = [];
    for (const entry of second) {
      let value: unknown;
      try { value = JSON.parse(entry.raw); } catch { return { status: 'malformed', ...empty }; }
      if (entry.key.startsWith(K326_LEGACY_WRITE_FENCE_PREFIX)) {
        if (!new RegExp(`^${K326_LEGACY_WRITE_FENCE_PREFIX}[a-f0-9]{64}$`).test(entry.key)
          || !validFenceRaw(value, entry.key, entry.raw)) return { status: 'malformed', ...empty };
        fences.push(value);
      } else if (entry.key.startsWith(K326_LEGACY_WRITE_FENCE_SETTLEMENT_PREFIX)) {
        if (!new RegExp(`^${K326_LEGACY_WRITE_FENCE_SETTLEMENT_PREFIX}[a-f0-9]{64}$`).test(entry.key)
          || !validSettlementRaw(value, entry.key, entry.raw)) return { status: 'malformed', ...empty };
        settlements.push(value);
      } else return { status: 'unsupported', ...empty };
    }
    const fenceByDigest = new Map(fences.map(fence => [fence.storageDigest, fence]));
    if (settlements.some(settlement => !fenceByDigest.has(settlement.fenceStorageDigest))) {
      return { status: 'orphaned', fences, settlements, activeFences: [], settledFences: [] };
    }
    const settlementDigests = new Set(settlements.map(settlement => settlement.fenceStorageDigest));
    if (settlementDigests.size !== settlements.length) {
      return { status: 'conflicting', fences, settlements, activeFences: [], settledFences: [] };
    }
    const settledFences = fences.filter(fence => settlementDigests.has(fence.storageDigest));
    const activeFences = fences.filter(fence => !settlementDigests.has(fence.storageDigest));
    const result = { fences, settlements, activeFences, settledFences };
    if (activeFences.length === 0) return { status: 'operationally_clear', ...result };
    return { status: activeFences.length === 1 ? 'active' : 'multiple_active', ...result };
  } catch {
    return { status: 'unreadable', ...empty };
  }
}

function scanError(status: LegacyFenceScanStatus): LegacyCutoverFenceError {
  const code: LegacyCutoverFenceErrorCode = status === 'changed' ? 'FENCE_SET_CHANGED'
    : status === 'multiple_active' ? 'MULTIPLE_FENCES_PRESENT'
      : status === 'unsupported' ? 'UNSUPPORTED_SHARED_FENCE'
        : status === 'malformed' ? 'FENCE_ARTIFACT_MALFORMED'
          : status === 'orphaned' ? 'FENCE_SETTLEMENT_ORPHANED'
            : status === 'conflicting' ? 'FENCE_SETTLEMENT_CONFLICT'
          : status === 'unreadable' ? 'FENCE_RECOVERY_INCOMPLETE'
            : status === 'active' ? 'FOREIGN_FENCE_PRESENT' : 'FENCE_OPERATIONALLY_BLOCKED';
  return new LegacyCutoverFenceError(code);
}

function exactFenceFromRaw(storageKey: string, raw: string | null): LegacyNotesCutoverFence | null {
  if (raw === null) return null;
  let value: unknown;
  try { value = JSON.parse(raw); } catch { throw new LegacyCutoverFenceError('FENCE_ARTIFACT_MALFORMED'); }
  if (!validFenceRaw(value, storageKey, raw)) throw new LegacyCutoverFenceError('FENCE_ARTIFACT_MALFORMED');
  return value;
}

function soleExpectedActiveFence(scan: LegacyFenceScanResult, identity: LegacyCutoverFenceIdentity): LegacyNotesCutoverFence {
  if (scan.status !== 'active') throw scanError(scan.status);
  const fence = scan.activeFences[0];
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
  if (initial.status === 'active') return soleExpectedActiveFence(initial, identity);
  if (initial.status !== 'operationally_clear') throw scanError(initial.status);
  const key = deriveLegacyNotesCutoverFenceKey(identity);
  let prior: LegacyNotesCutoverFence | null;
  try { prior = exactFenceFromRaw(key, localStorage.getItem(key)); }
  catch { throw new LegacyCutoverFenceError('FENCE_ARTIFACT_MALFORMED'); }
  try { if (prior === null) localStorage.setItem(key, JSON.stringify(next)); }
  catch { throw new LegacyCutoverFenceError('FENCE_READBACK_MISMATCH'); }
  let readBack: LegacyNotesCutoverFence | null;
  try { readBack = exactFenceFromRaw(key, localStorage.getItem(key)); }
  catch { throw new LegacyCutoverFenceError('FENCE_READBACK_MISMATCH'); }
  if (readBack === null || !sameLegacyCutoverFenceIdentity(readBack, identity)) {
    throw new LegacyCutoverFenceError('FENCE_READBACK_MISMATCH');
  }
  return soleExpectedActiveFence(scanLegacyNotesCutoverFences(), identity);
}

export function advanceLegacyNotesCutoverFence(
  authorization: RecoveryCutoverAuthorization,
  identity: LegacyCutoverFenceIdentity,
  _phase: 'activated' | 'confirmed',
): LegacyNotesCutoverFence {
  const existing = soleExpectedActiveFence(scanLegacyNotesCutoverFences(), identity);
  assertCutoverAuthorization(authorization, existing);
  return existing;
}

export function readLegacyNotesCutoverFence(): LegacyNotesCutoverFence | 'corrupt' | null {
  const scan = scanLegacyNotesCutoverFences();
  return scan.status === 'operationally_clear' ? null : scan.status === 'active' ? scan.activeFences[0] : 'corrupt';
}

export function isLegacyNotesWriteBlockedByCutover(): boolean {
  const scan = scanLegacyNotesCutoverFences();
  // Structural settlement is not durable runtime authorization. Once K-326 evidence exists,
  // the synchronous legacy writer remains fail-closed until a later reviewed runtime cutover protocol.
  return scan.status !== 'operationally_clear' || scan.fences.length !== 0 || scan.settlements.length !== 0;
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
      if (key === K326_LEGACY_WRITE_FENCE_KEY || key?.startsWith(K326_LEGACY_FENCE_RESERVED_PREFIX)
        || key?.startsWith(K326_LEGACY_SETTLEMENT_RESERVED_PREFIX)) keys.push(key);
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
