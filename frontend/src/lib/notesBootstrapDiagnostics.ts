import type { NotesAuthorityLoadState } from './notesAccountAuthority';

export const NOTES_BOOTSTRAP_FAILURE_MESSAGE = 'Notes bootstrap needs attention.';

export const NOTES_BOOTSTRAP_DIAGNOSTIC_STAGES = [
  'ACCOUNT_AUTHORITY',
  'LOAD_LOCAL_AUTHORITY',
  'RECONCILE_FOLDER_LIFECYCLE',
  'FETCH_NOTES',
  'VALIDATE_NOTES_SNAPSHOT',
  'FETCH_FOLDERS',
  'VALIDATE_FOLDERS_SNAPSHOT',
  'RECONCILE_SINGLE_DELETE_LIFECYCLE',
  'MERGE_NOTES',
  'MERGE_FOLDERS',
  'PERSIST_LOCAL',
  'REVALIDATE_LOCAL',
  'FINALIZE_BOOTSTRAP',
] as const;

export type NotesBootstrapDiagnosticStage = typeof NOTES_BOOTSTRAP_DIAGNOSTIC_STAGES[number];

export const NOTES_BOOTSTRAP_DIAGNOSTIC_REASONS = [
  'ACCOUNT_REQUIRED',
  'ACCOUNT_CONTEXT_STALE',
  'LOCAL_MUTATION_PENDING',
  'LOCAL_AUTHORITY_INVALID',
  'FOLDER_MARKER_MALFORMED',
  'FOLDER_RECONCILIATION_INVALID',
  'FOLDER_PHASE_ADVANCE_FAILED',
  'FOLDER_MARKER_CANCEL_FAILED',
  'REMOTE_FETCH_REJECTED',
  'SNAPSHOT_MALFORMED',
  'SNAPSHOT_CONTRACT_INVALID',
  'SNAPSHOT_INCOMPLETE',
  'SNAPSHOT_DUPLICATE_ID',
  'REMOTE_NOTE_INCOMPLETE',
  'NOTES_AUTHORITY_CONFLICT',
  'EQUAL_REVISION_PAYLOAD_MISMATCH',
  'PENDING_MARKER_PERSIST_FAILED',
  'PENDING_MARKER_CLEAR_FAILED',
  'NOTES_PERSIST_FAILED',
  'FOLDERS_PERSIST_FAILED',
  'LOCAL_READBACK_MISMATCH',
  'ATOMIC_APPLY_FAILED',
  'ROLLBACK_UNVERIFIED',
  'ATOMIC_REVALIDATION_MISSING',
  'AUTHORITY_STATE_PERSIST_FAILED',
  'SINGLE_DELETE_ACCOUNT_INACTIVE',
  'SINGLE_DELETE_REMOTE_PENDING',
  'SINGLE_DELETE_MARKER_CHANGED',
  'SINGLE_DELETE_MARKER_MALFORMED',
  'SINGLE_DELETE_MARKER_CONFLICT_PERSIST_FAILED',
  'SINGLE_DELETE_FINALIZATION_FAILED',
  'UNKNOWN_FAILURE',
] as const;

export type NotesBootstrapDiagnosticReason = typeof NOTES_BOOTSTRAP_DIAGNOSTIC_REASONS[number];

export type NotesBootstrapFolderOperation = 'FOLDER_DELETE' | 'FOLDER_RESTORE';
export type NotesBootstrapFolderPhase = 'PREPARED' | 'LOCAL_COMMITTED';

export interface NotesBootstrapFailureSignal {
  readonly stage: NotesBootstrapDiagnosticStage;
  readonly reasonCode: NotesBootstrapDiagnosticReason;
  readonly rollbackVerified?: boolean;
}

export interface NotesBootstrapDiagnostic extends NotesBootstrapFailureSignal {
  readonly localNoteCount: number;
  readonly localFolderCount: number;
  readonly remoteNoteCount: number | null;
  readonly remoteFolderCount: number | null;
  readonly pendingFolderMarkerCount: number | null;
  readonly pendingFolderOperations: readonly NotesBootstrapFolderOperation[];
  readonly pendingFolderPhases: readonly NotesBootstrapFolderPhase[];
  readonly notesAuthorityState: NotesAuthorityLoadState;
  readonly foldersAuthorityState: NotesAuthorityLoadState;
}

/** Carries only a bounded stage/reason pair across bootstrap module boundaries. */
export class NotesBootstrapDiagnosticError extends Error {
  readonly stage: NotesBootstrapDiagnosticStage;
  readonly reasonCode: NotesBootstrapDiagnosticReason;
  readonly rollbackVerified?: boolean;

  constructor(
    stage: NotesBootstrapDiagnosticStage,
    reasonCode: NotesBootstrapDiagnosticReason,
    safeLegacyMessage: string = reasonCode,
    rollbackVerified?: boolean,
  ) {
    super(safeLegacyMessage);
    this.name = 'NotesBootstrapDiagnosticError';
    this.stage = stage;
    this.reasonCode = reasonCode;
    this.rollbackVerified = rollbackVerified;
  }
}

function legacyErrorCode(error: unknown): string {
  return error instanceof Error ? error.message : '';
}

/** Maps historical internal codes without retaining arbitrary exception text. */
export function diagnoseNotesBootstrapFailure(
  error: unknown,
  fallbackStage: NotesBootstrapDiagnosticStage,
): NotesBootstrapFailureSignal {
  if (error instanceof NotesBootstrapDiagnosticError) {
    return {
      stage: error.stage,
      reasonCode: error.reasonCode,
      rollbackVerified: error.rollbackVerified,
    };
  }

  const code = legacyErrorCode(error);
  if (code === 'notes_bootstrap_account_missing' || code === 'complete_snapshot_account_required') {
    return { stage: 'ACCOUNT_AUTHORITY', reasonCode: 'ACCOUNT_REQUIRED' };
  }
  if (code === 'notes_bootstrap_stale' || code.includes('account_scope')) {
    return { stage: 'ACCOUNT_AUTHORITY', reasonCode: 'ACCOUNT_CONTEXT_STALE' };
  }
  if (code === 'notes_bootstrap_local_mutation_pending') {
    return { stage: fallbackStage, reasonCode: 'LOCAL_MUTATION_PENDING' };
  }
  if (code === 'notes_bootstrap_local_authority_duplicate_id'
    || code.includes('account_authority_notes_malformed')
    || code.includes('account_authority_folders_malformed')) {
    return { stage: 'LOAD_LOCAL_AUTHORITY', reasonCode: 'LOCAL_AUTHORITY_INVALID' };
  }
  if (code === 'notes_folder_remote_mutation_malformed'
    || code === 'notes_folder_remote_mutation_changed') {
    return { stage: 'RECONCILE_FOLDER_LIFECYCLE', reasonCode: 'FOLDER_MARKER_MALFORMED' };
  }
  if (code === 'notes_folder_remote_mutation_local_folders_invalid') {
    return { stage: 'RECONCILE_FOLDER_LIFECYCLE', reasonCode: 'FOLDER_RECONCILIATION_INVALID' };
  }
  if (code === 'notes_folder_remote_mutation_phase_advance_failed') {
    return { stage: 'RECONCILE_FOLDER_LIFECYCLE', reasonCode: 'FOLDER_PHASE_ADVANCE_FAILED' };
  }
  if (code === 'notes_folder_remote_mutation_cancel_failed') {
    return { stage: 'RECONCILE_FOLDER_LIFECYCLE', reasonCode: 'FOLDER_MARKER_CANCEL_FAILED' };
  }
  if (code === 'notes_bootstrap_remote_note_incomplete') {
    return { stage: 'MERGE_NOTES', reasonCode: 'REMOTE_NOTE_INCOMPLETE' };
  }
  if (code === 'notes_bootstrap_atomic_revalidation_missing') {
    return { stage: 'REVALIDATE_LOCAL', reasonCode: 'ATOMIC_REVALIDATION_MISSING' };
  }
  if (code === 'notes_single_delete_account_inactive') {
    return {
      stage: 'RECONCILE_SINGLE_DELETE_LIFECYCLE',
      reasonCode: 'SINGLE_DELETE_ACCOUNT_INACTIVE',
    };
  }
  if (code === 'notes_single_delete_remote_pending') {
    return {
      stage: 'RECONCILE_SINGLE_DELETE_LIFECYCLE',
      reasonCode: 'SINGLE_DELETE_REMOTE_PENDING',
    };
  }
  if (code === 'notes_single_delete_marker_changed') {
    return {
      stage: 'RECONCILE_SINGLE_DELETE_LIFECYCLE',
      reasonCode: 'SINGLE_DELETE_MARKER_CHANGED',
    };
  }
  if (code === 'notes_single_delete_marker_malformed') {
    return {
      stage: 'RECONCILE_SINGLE_DELETE_LIFECYCLE',
      reasonCode: 'SINGLE_DELETE_MARKER_MALFORMED',
    };
  }
  if (code === 'notes_single_delete_marker_conflict_persist_failed') {
    return {
      stage: 'RECONCILE_SINGLE_DELETE_LIFECYCLE',
      reasonCode: 'SINGLE_DELETE_MARKER_CONFLICT_PERSIST_FAILED',
    };
  }
  if (code === 'notes_single_delete_marker_clear_failed') {
    return { stage: 'FINALIZE_BOOTSTRAP', reasonCode: 'SINGLE_DELETE_FINALIZATION_FAILED' };
  }
  if (code === 'notes_bootstrap_apply_failed') {
    return { stage: 'PERSIST_LOCAL', reasonCode: 'ATOMIC_APPLY_FAILED', rollbackVerified: true };
  }
  if (code === 'notes_bootstrap_recovery_required') {
    return { stage: 'PERSIST_LOCAL', reasonCode: 'ROLLBACK_UNVERIFIED', rollbackVerified: false };
  }
  return { stage: fallbackStage, reasonCode: 'UNKNOWN_FAILURE' };
}

export function buildNotesBootstrapDiagnostic(
  failure: NotesBootstrapFailureSignal,
  details: Omit<NotesBootstrapDiagnostic, keyof NotesBootstrapFailureSignal>,
): NotesBootstrapDiagnostic {
  return Object.freeze({
    ...details,
    ...failure,
    pendingFolderOperations: Object.freeze([...new Set(details.pendingFolderOperations)].sort()),
    pendingFolderPhases: Object.freeze([...new Set(details.pendingFolderPhases)].sort()),
  });
}
