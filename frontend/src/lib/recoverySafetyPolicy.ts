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

export const K326_LEGACY_WRITE_FENCE_KEY = 'absinthe:k326:legacy-write-fence';
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

export interface LegacyNotesCutoverFence {
  version: 1;
  namespaceKey: string;
  cutoverSessionId: string;
  targetGenerationId: string;
  phase: 'activating' | 'activated' | 'confirmed';
}

function validFence(value: unknown): value is LegacyNotesCutoverFence {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return Object.keys(record).sort().join(',') === 'cutoverSessionId,namespaceKey,phase,targetGenerationId,version'
    && record.version === 1 && typeof record.namespaceKey === 'string' && HASH.test(record.namespaceKey)
    && typeof record.cutoverSessionId === 'string' && SAFE_ID.test(record.cutoverSessionId)
    && typeof record.targetGenerationId === 'string' && SAFE_ID.test(record.targetGenerationId)
    && ['activating', 'activated', 'confirmed'].includes(record.phase as string);
}

function readFenceRaw(): LegacyNotesCutoverFence | 'corrupt' | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(K326_LEGACY_WRITE_FENCE_KEY);
    if (raw === null) return null;
    const value: unknown = JSON.parse(raw);
    return validFence(value) ? value : 'corrupt';
  } catch {
    return 'corrupt';
  }
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

export function beginLegacyNotesCutoverFence(
  authorization: RecoveryCutoverAuthorization,
): LegacyNotesCutoverFence {
  const next: LegacyNotesCutoverFence = {
    version: 1,
    namespaceKey: authorization.namespaceKey,
    cutoverSessionId: authorization.cutoverSessionId,
    targetGenerationId: authorization.targetGenerationId,
    phase: 'activating',
  };
  assertCutoverAuthorization(authorization, next);
  const existing = readFenceRaw();
  if (existing === 'corrupt' || existing !== null && (
    existing.namespaceKey !== next.namespaceKey
    || existing.cutoverSessionId !== next.cutoverSessionId
    || existing.targetGenerationId !== next.targetGenerationId
  )) throw new RecoveryModeBlockedError('k326_cutover_activation');
  activateRecoveryMode();
  try { localStorage.setItem(K326_LEGACY_WRITE_FENCE_KEY, JSON.stringify(existing ?? next)); }
  catch { throw new RecoveryModeBlockedError('k326_cutover_activation'); }
  return existing ?? next;
}

export function advanceLegacyNotesCutoverFence(
  authorization: RecoveryCutoverAuthorization,
  phase: 'activated' | 'confirmed',
): LegacyNotesCutoverFence {
  const existing = readFenceRaw();
  if (existing === null || existing === 'corrupt') throw new RecoveryModeBlockedError('k326_cutover_activation');
  assertCutoverAuthorization(authorization, existing);
  if (phase === 'activated' && !['activating', 'activated'].includes(existing.phase)
    || phase === 'confirmed' && !['activating', 'activated', 'confirmed'].includes(existing.phase)) {
    throw new RecoveryModeBlockedError('k326_cutover_activation');
  }
  const next = { ...existing, phase } as LegacyNotesCutoverFence;
  try { localStorage.setItem(K326_LEGACY_WRITE_FENCE_KEY, JSON.stringify(next)); }
  catch { throw new RecoveryModeBlockedError('k326_cutover_activation'); }
  return next;
}

export function cancelLegacyNotesCutoverFence(authorization: RecoveryCutoverAuthorization): void {
  const existing = readFenceRaw();
  if (existing === null) return;
  if (existing === 'corrupt') throw new RecoveryModeBlockedError('k326_cutover_activation');
  assertCutoverAuthorization(authorization, existing);
  if (existing.phase !== 'activating') throw new RecoveryModeBlockedError('k326_cutover_activation');
  try { localStorage.removeItem(K326_LEGACY_WRITE_FENCE_KEY); }
  catch { throw new RecoveryModeBlockedError('k326_cutover_activation'); }
  activateRecoveryMode();
}

export function readLegacyNotesCutoverFence(): LegacyNotesCutoverFence | 'corrupt' | null {
  return readFenceRaw();
}

export function isLegacyNotesWriteBlockedByCutover(): boolean {
  return readFenceRaw() !== null;
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
  try { localStorage.removeItem(K326_LEGACY_WRITE_FENCE_KEY); } catch { /**/ }
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
