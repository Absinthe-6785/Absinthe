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
  | 'delete_legacy_storage';

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

const mayUseLegacyMutationPath = () => !recoveryModeActive;
export const mayHydrateRemote = mayUseLegacyMutationPath;
export const mayUploadRemote = mayUseLegacyMutationPath;
export const mayRestore = mayUseLegacyMutationPath;
export const mayUndoRestore = mayUseLegacyMutationPath;
export const mayEmptyTrash = mayUseLegacyMutationPath;
export const mayReset = mayUseLegacyMutationPath;
export const mayApplyCrossTabMutation = mayUseLegacyMutationPath;
export const mayDeleteLegacyStorage = mayUseLegacyMutationPath;

export function mayReplacePersistedNotes<T extends { id: string }>(
  current: readonly T[] | null,
  replacement: unknown,
): boolean {
  if (!recoveryModeActive) return Array.isArray(replacement);
  if (!Array.isArray(replacement)) return false;
  if (!current || current.length === 0) return replacement.length > 0;
  if (replacement.length === 0) return false;
  const replacementIds = new Set(replacement.map(item => (
    item && typeof item === 'object' && 'id' in item ? String(item.id) : ''
  )));
  return current.every(item => replacementIds.has(item.id));
}

export function assertCurrentOperationEpoch(epoch: number, operation: RecoveryOperation): void {
  if (isOperationEpochCurrent(epoch)) return;
  recordRecoveryBlock(operation, 'stale_operation_epoch');
  throw new RecoveryModeBlockedError(operation);
}

export function resetRecoverySafetyDiagnosticsForTest(): void {
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
