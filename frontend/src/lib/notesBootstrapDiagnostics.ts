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

export const NOTES_AUTHORITY_DIAGNOSTIC_PHASES = [
  'INITIAL_MERGE',
  'ATOMIC_REVALIDATION',
] as const;

export type NotesAuthorityDiagnosticPhase = typeof NOTES_AUTHORITY_DIAGNOSTIC_PHASES[number];

export const NOTES_AUTHORITY_DIAGNOSTIC_OUTCOMES = [
  'LOCAL_NEWER',
  'REMOTE_NEWER',
  'EQUAL',
  'INCOMPARABLE',
] as const;

export type NotesAuthorityDiagnosticOutcome = typeof NOTES_AUTHORITY_DIAGNOSTIC_OUTCOMES[number];

export const NOTES_AUTHORITY_CONFLICT_SUBTYPES = [
  'EQUAL_PAYLOAD_MISMATCH',
  'INCOMPARABLE',
] as const;

export type NotesAuthorityConflictSubtype = typeof NOTES_AUTHORITY_CONFLICT_SUBTYPES[number];

export const NOTES_AUTHORITY_INCOMPARABLE_REASONS = [
  'PERMANENT_DELETE_PROTECTED',
  'PENDING_LOCAL_MUTATION',
  'NOTE_ID_MISMATCH',
  'LOCAL_REVISION_SHAPE_INVALID',
  'REMOTE_REVISION_SHAPE_INVALID',
  'LOCAL_TOMBSTONE_CHRONOLOGY_INVALID',
  'REMOTE_TOMBSTONE_CHRONOLOGY_INVALID',
  'LOCAL_AUTHORITY_SHAPE_INVALID',
  'REMOTE_LEGACY_FIELDS_ABSENT',
  'REMOTE_AUTHORITY_SHAPE_INVALID',
] as const;

export type NotesAuthorityIncomparableReason = typeof NOTES_AUTHORITY_INCOMPARABLE_REASONS[number];

export const NOTES_AUTHORITY_LIVE_STATE_PAIRS = [
  'LIVE_LIVE',
  'LIVE_TOMBSTONE',
  'TOMBSTONE_LIVE',
  'TOMBSTONE_TOMBSTONE',
] as const;

export type NotesAuthorityLiveStatePair = typeof NOTES_AUTHORITY_LIVE_STATE_PAIRS[number];

export type NotesAuthorityOutcomeCounts = Readonly<Record<NotesAuthorityDiagnosticOutcome, number>>;
export type NotesAuthorityConflictSubtypeCounts = Readonly<Record<NotesAuthorityConflictSubtype, number>>;
export type NotesAuthorityIncomparableReasonCounts = Readonly<Record<NotesAuthorityIncomparableReason, number>>;
export type NotesAuthorityLiveStatePairCounts = Readonly<Record<NotesAuthorityLiveStatePair, number>>;

export interface NotesAuthorityPhaseAggregate {
  readonly conflictCount: number;
  readonly authorityOutcomeCounts: NotesAuthorityOutcomeCounts;
  readonly conflictSubtypeCounts: NotesAuthorityConflictSubtypeCounts;
  readonly incomparableReasonCounts: NotesAuthorityIncomparableReasonCounts;
  readonly liveStatePairCounts: NotesAuthorityLiveStatePairCounts;
}

export interface NotesBootstrapAuthorityAggregate {
  readonly conflictPhaseCounts: Readonly<Record<NotesAuthorityDiagnosticPhase, number>>;
  readonly authorityOutcomeCounts: Readonly<Record<NotesAuthorityDiagnosticPhase, NotesAuthorityOutcomeCounts>>;
  readonly conflictSubtypeCounts: Readonly<Record<NotesAuthorityDiagnosticPhase, NotesAuthorityConflictSubtypeCounts>>;
  readonly incomparableReasonCounts: Readonly<Record<NotesAuthorityDiagnosticPhase, NotesAuthorityIncomparableReasonCounts>>;
  readonly liveStatePairCounts: Readonly<Record<NotesAuthorityDiagnosticPhase, NotesAuthorityLiveStatePairCounts>>;
  readonly localOnlyCount: number | null;
  readonly remoteOnlyCount: number | null;
}

export interface NotesBootstrapFailureSignal {
  readonly stage: NotesBootstrapDiagnosticStage;
  readonly reasonCode: NotesBootstrapDiagnosticReason;
  readonly rollbackVerified?: boolean;
}

export interface NotesBootstrapDiagnostic extends NotesBootstrapFailureSignal, NotesBootstrapAuthorityAggregate {
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
  const aggregate = details;
  const freezeOutcomeCounts = (counts: NotesAuthorityOutcomeCounts): NotesAuthorityOutcomeCounts => Object.freeze({
    LOCAL_NEWER: counts.LOCAL_NEWER,
    REMOTE_NEWER: counts.REMOTE_NEWER,
    EQUAL: counts.EQUAL,
    INCOMPARABLE: counts.INCOMPARABLE,
  });
  const freezeSubtypeCounts = (
    counts: NotesAuthorityConflictSubtypeCounts,
  ): NotesAuthorityConflictSubtypeCounts => Object.freeze({
    EQUAL_PAYLOAD_MISMATCH: counts.EQUAL_PAYLOAD_MISMATCH,
    INCOMPARABLE: counts.INCOMPARABLE,
  });
  const freezeReasonCounts = (
    counts: NotesAuthorityIncomparableReasonCounts,
  ): NotesAuthorityIncomparableReasonCounts => Object.freeze({
    PERMANENT_DELETE_PROTECTED: counts.PERMANENT_DELETE_PROTECTED,
    PENDING_LOCAL_MUTATION: counts.PENDING_LOCAL_MUTATION,
    NOTE_ID_MISMATCH: counts.NOTE_ID_MISMATCH,
    LOCAL_REVISION_SHAPE_INVALID: counts.LOCAL_REVISION_SHAPE_INVALID,
    REMOTE_REVISION_SHAPE_INVALID: counts.REMOTE_REVISION_SHAPE_INVALID,
    LOCAL_TOMBSTONE_CHRONOLOGY_INVALID: counts.LOCAL_TOMBSTONE_CHRONOLOGY_INVALID,
    REMOTE_TOMBSTONE_CHRONOLOGY_INVALID: counts.REMOTE_TOMBSTONE_CHRONOLOGY_INVALID,
    LOCAL_AUTHORITY_SHAPE_INVALID: counts.LOCAL_AUTHORITY_SHAPE_INVALID,
    REMOTE_LEGACY_FIELDS_ABSENT: counts.REMOTE_LEGACY_FIELDS_ABSENT,
    REMOTE_AUTHORITY_SHAPE_INVALID: counts.REMOTE_AUTHORITY_SHAPE_INVALID,
  });
  const freezeLiveStatePairCounts = (
    counts: NotesAuthorityLiveStatePairCounts,
  ): NotesAuthorityLiveStatePairCounts => Object.freeze({
    LIVE_LIVE: counts.LIVE_LIVE,
    LIVE_TOMBSTONE: counts.LIVE_TOMBSTONE,
    TOMBSTONE_LIVE: counts.TOMBSTONE_LIVE,
    TOMBSTONE_TOMBSTONE: counts.TOMBSTONE_TOMBSTONE,
  });
  const frozenAuthorityAggregate: NotesBootstrapAuthorityAggregate = Object.freeze({
    conflictPhaseCounts: Object.freeze({
      INITIAL_MERGE: aggregate.conflictPhaseCounts.INITIAL_MERGE,
      ATOMIC_REVALIDATION: aggregate.conflictPhaseCounts.ATOMIC_REVALIDATION,
    }),
    authorityOutcomeCounts: Object.freeze({
      INITIAL_MERGE: freezeOutcomeCounts(aggregate.authorityOutcomeCounts.INITIAL_MERGE),
      ATOMIC_REVALIDATION: freezeOutcomeCounts(aggregate.authorityOutcomeCounts.ATOMIC_REVALIDATION),
    }),
    conflictSubtypeCounts: Object.freeze({
      INITIAL_MERGE: freezeSubtypeCounts(aggregate.conflictSubtypeCounts.INITIAL_MERGE),
      ATOMIC_REVALIDATION: freezeSubtypeCounts(aggregate.conflictSubtypeCounts.ATOMIC_REVALIDATION),
    }),
    incomparableReasonCounts: Object.freeze({
      INITIAL_MERGE: freezeReasonCounts(aggregate.incomparableReasonCounts.INITIAL_MERGE),
      ATOMIC_REVALIDATION: freezeReasonCounts(aggregate.incomparableReasonCounts.ATOMIC_REVALIDATION),
    }),
    liveStatePairCounts: Object.freeze({
      INITIAL_MERGE: freezeLiveStatePairCounts(aggregate.liveStatePairCounts.INITIAL_MERGE),
      ATOMIC_REVALIDATION: freezeLiveStatePairCounts(aggregate.liveStatePairCounts.ATOMIC_REVALIDATION),
    }),
    localOnlyCount: aggregate.localOnlyCount,
    remoteOnlyCount: aggregate.remoteOnlyCount,
  });
  return Object.freeze({
    ...details,
    ...failure,
    pendingFolderOperations: Object.freeze([...new Set(details.pendingFolderOperations)].sort()),
    pendingFolderPhases: Object.freeze([...new Set(details.pendingFolderPhases)].sort()),
    ...frozenAuthorityAggregate,
  });
}
