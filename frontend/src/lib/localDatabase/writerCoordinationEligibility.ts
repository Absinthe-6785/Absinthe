import { sha256Hex } from './outboxIdentity';

/** K-329C pure architecture model. No storage, browser, timer, network, or K-328 caller. */
export const WRITER_COORDINATION_SCHEMA_VERSION = 1 as const;
export const WRITER_COORDINATION_BYTE_FORMAT_VERSION = 1 as const;
export const WRITER_COORDINATION_STRATEGY =
  'web_locks_durable_registry_epoch_admission_authoritative_revalidation_v1' as const;
export const REVIEWED_MANIFEST_AUTHORITY_ID = 'k329-source-reviewed-manifest' as const;
export const REVIEWED_MANIFEST_VERSION = 'k329b-source-reviewed-v1' as const;

export const WRITER_COORDINATION_LIMITS = Object.freeze({
  authorityBytes: 8192,
  manifestAuthorityBytes: 4096,
  registrationBytes: 4096,
  operationBytes: 4096,
  checkpointBytes: 8192,
  sourceEvidenceBytes: 8192,
  eligibilityEvidenceBytes: 8192,
  reviewedManifestBytes: 32768,
  modelBytes: 1_048_576,
  identifierBytes: 192,
  writerTypes: 256,
  registrations: 512,
  operations: 4096,
});

export const COORDINATION_STATES = [
  'OPEN', 'DRAIN_REQUESTED', 'ADMISSION_CLOSED', 'DRAINING',
  'QUIESCENT_CANDIDATE', 'VERIFYING_SOURCE', 'ELIGIBLE',
  'INELIGIBLE', 'ABORTED', 'FAILED',
] as const;
export type CoordinationState = typeof COORDINATION_STATES[number];

export const WRITER_CONTEXT_TYPES = [
  'window', 'dedicated_worker', 'shared_worker', 'service_worker',
  'restore_job', 'sync_hydration_job', 'migration_job', 'test_fixture',
] as const;
export type WriterContextType = typeof WRITER_CONTEXT_TYPES[number];
export type WriterCapability = 'admission' | 'drain_ack' | 'source_write';
export type RegistrationState = 'registered' | 'drain_acknowledged' | 'disabled';
export type OperationState = 'admitted' | 'committed' | 'aborted' | 'failed';

export const WRITER_AUTHORITY_ROLES = [
  'authoritative_source_writer', 'auxiliary_container_writer', 'metadata_writer',
  'remote_only_writer', 'dormant_or_test_writer',
] as const;
export type WriterAuthorityRole = typeof WRITER_AUTHORITY_ROLES[number];
export const WRITER_COORDINATION_REQUIREMENTS = [
  'must_participate', 'must_be_disabled', 'excluded_with_proof',
] as const;
export type WriterCoordinationRequirement = typeof WRITER_COORDINATION_REQUIREMENTS[number];
export const WRITER_EXCLUSION_PROOF_CODES = [
  'AUXILIARY_CONTAINER_NOT_AUTHORITY', 'METADATA_NOT_SOURCE_AUTHORITY',
  'REMOTE_ONLY_NO_LOCAL_SOURCE_MUTATION', 'DORMANT_NO_PRODUCTION_CALLER',
  'TEST_ONLY_NO_PRODUCTION_REACHABILITY',
] as const;
export type WriterExclusionProofCode = typeof WRITER_EXCLUSION_PROOF_CODES[number];

export const WRITER_ELIGIBILITY_ERROR_CODES = [
  'WRITER_INVENTORY_INCOMPLETE', 'UNKNOWN_WRITER_PRESENT', 'WRITER_NOT_COORDINATED',
  'WRITER_REGISTRATION_MALFORMED', 'DUPLICATE_WRITER_IDENTITY',
  'REGISTRATION_INITIAL_STATE_INVALID', 'DRAIN_ACKNOWLEDGEMENT_INVALID',
  'COORDINATION_UNSUPPORTED', 'COORDINATION_LOCK_UNAVAILABLE', 'COORDINATION_EPOCH_STALE',
  'ADMISSION_NOT_CLOSED', 'IN_FLIGHT_WRITE_PRESENT', 'IN_FLIGHT_STATE_AMBIGUOUS',
  'SOURCE_REVISION_UNSTABLE', 'SOURCE_CHANGED_DURING_VERIFICATION',
  'AUTHORITATIVE_SOURCE_AMBIGUOUS', 'MIXED_SOURCE_DIVERGENCE',
  'SOURCE_OWNERSHIP_UNPROVEN', 'SOURCE_MALFORMED', 'SOURCE_RESOURCE_BOUND_EXCEEDED',
  'RESTORE_OR_IMPORT_ACTIVE', 'SYNC_WRITER_ACTIVE', 'UNKNOWN_CONTEXT_PRESENT',
  'K328_ADAPTER_UNAVAILABLE', 'K328_PHYSICAL_IDENTITY_MISMATCH',
  'ELIGIBILITY_EVIDENCE_CORRUPT', 'ELIGIBILITY_PROTOCOL_VERSION_UNSUPPORTED',
  'REVIEWED_MANIFEST_AUTHORITY_MISMATCH', 'CHECKPOINT_CHAIN_INVALID',
  'SOURCE_EVIDENCE_MISSING', 'SOURCE_EVIDENCE_INVALID',
  'CURRENT_GRAPH_CHECKPOINT_MISMATCH', 'OPERATION_REGISTRATION_RELATION_INVALID',
  'REGISTRATION_OPERATION_RELATION_INVALID', 'SOURCE_EVIDENCE_LIFECYCLE_MISMATCH',
  'SOURCE_EVIDENCE_CHECKPOINT_MISMATCH', 'ELIGIBILITY_EVIDENCE_RELATION_MISMATCH',
  'ACTOR_UNAUTHORIZED', 'TRANSITION_REVISION_STALE',
] as const;
export type WriterEligibilityErrorCode = typeof WRITER_ELIGIBILITY_ERROR_CODES[number];

const ERROR_POLICY: Record<WriterEligibilityErrorCode, { retryable: boolean; requiredAction: string }> = {
  WRITER_INVENTORY_INCOMPLETE: { retryable: false, requiredAction: 'complete the source-reviewed writer inventory' },
  UNKNOWN_WRITER_PRESENT: { retryable: false, requiredAction: 'classify and coordinate the unknown writer' },
  WRITER_NOT_COORDINATED: { retryable: false, requiredAction: 'route the writer through durable admission' },
  WRITER_REGISTRATION_MALFORMED: { retryable: false, requiredAction: 'stop without repairing persisted registration evidence' },
  DUPLICATE_WRITER_IDENTITY: { retryable: false, requiredAction: 'resolve the durable identity collision' },
  REGISTRATION_INITIAL_STATE_INVALID: { retryable: false, requiredAction: 'register from the canonical initial lifecycle state' },
  DRAIN_ACKNOWLEDGEMENT_INVALID: { retryable: true, requiredAction: 'acknowledge the exact drain transition after operations terminate' },
  COORDINATION_UNSUPPORTED: { retryable: false, requiredAction: 'use a supported secure storage environment' },
  COORDINATION_LOCK_UNAVAILABLE: { retryable: true, requiredAction: 'retry without lock stealing' },
  COORDINATION_EPOCH_STALE: { retryable: true, requiredAction: 'discard stale epoch evidence' },
  ADMISSION_NOT_CLOSED: { retryable: true, requiredAction: 'close admission through the durable transition' },
  IN_FLIGHT_WRITE_PRESENT: { retryable: true, requiredAction: 'terminalize every admitted operation durably' },
  IN_FLIGHT_STATE_AMBIGUOUS: { retryable: false, requiredAction: 'resolve operation evidence separately' },
  SOURCE_REVISION_UNSTABLE: { retryable: true, requiredAction: 'repeat verification after quiescence' },
  SOURCE_CHANGED_DURING_VERIFICATION: { retryable: true, requiredAction: 'abort and repeat source verification' },
  AUTHORITATIVE_SOURCE_AMBIGUOUS: { retryable: false, requiredAction: 'run reviewed source resolution' },
  MIXED_SOURCE_DIVERGENCE: { retryable: false, requiredAction: 'preserve and reconcile both sources' },
  SOURCE_OWNERSHIP_UNPROVEN: { retryable: false, requiredAction: 'establish exact ownership binding' },
  SOURCE_MALFORMED: { retryable: false, requiredAction: 'preserve evidence and investigate' },
  SOURCE_RESOURCE_BOUND_EXCEEDED: { retryable: false, requiredAction: 'use a reviewed bounded export path' },
  RESTORE_OR_IMPORT_ACTIVE: { retryable: true, requiredAction: 'finish or abort restore/import durably' },
  SYNC_WRITER_ACTIVE: { retryable: true, requiredAction: 'finish or abort sync hydration durably' },
  UNKNOWN_CONTEXT_PRESENT: { retryable: false, requiredAction: 'classify the context before retrying' },
  K328_ADAPTER_UNAVAILABLE: { retryable: false, requiredAction: 'implement and review an exact K-328 adapter' },
  K328_PHYSICAL_IDENTITY_MISMATCH: { retryable: false, requiredAction: 'bind K-328 to the exact physical source' },
  ELIGIBILITY_EVIDENCE_CORRUPT: { retryable: false, requiredAction: 'stop without repair' },
  ELIGIBILITY_PROTOCOL_VERSION_UNSUPPORTED: { retryable: false, requiredAction: 'use a reviewed protocol migration' },
  REVIEWED_MANIFEST_AUTHORITY_MISMATCH: { retryable: false, requiredAction: 'install only the code-reviewed manifest authority' },
  CHECKPOINT_CHAIN_INVALID: { retryable: false, requiredAction: 'restart from a new reviewed coordination session' },
  SOURCE_EVIDENCE_MISSING: { retryable: true, requiredAction: 'capture source evidence through the verifier action' },
  SOURCE_EVIDENCE_INVALID: { retryable: false, requiredAction: 'reject the source candidate without repair' },
  CURRENT_GRAPH_CHECKPOINT_MISMATCH: { retryable: false, requiredAction: 'reject the current graph without repairing checkpoint evidence' },
  OPERATION_REGISTRATION_RELATION_INVALID: { retryable: false, requiredAction: 'reject the orphaned or mismatched operation graph' },
  REGISTRATION_OPERATION_RELATION_INVALID: { retryable: false, requiredAction: 'reject the inconsistent registration operation reference' },
  SOURCE_EVIDENCE_LIFECYCLE_MISMATCH: { retryable: false, requiredAction: 'reject source evidence outside its exact verifier lifecycle' },
  SOURCE_EVIDENCE_CHECKPOINT_MISMATCH: { retryable: false, requiredAction: 'reject source evidence not bound to the exact checkpoint chain' },
  ELIGIBILITY_EVIDENCE_RELATION_MISMATCH: { retryable: false, requiredAction: 'reject stale or orphaned eligibility evidence' },
  ACTOR_UNAUTHORIZED: { retryable: false, requiredAction: 'use the actor bound to the transition' },
  TRANSITION_REVISION_STALE: { retryable: true, requiredAction: 'reread authority and retry with current CAS' },
};

export interface ReviewedWriterManifestEntry {
  writerTypeId: string;
  contextTypes: readonly WriterContextType[];
  requiredCapabilities: readonly WriterCapability[];
  authorityRole: WriterAuthorityRole;
  coordinationRequirement: WriterCoordinationRequirement;
  exclusionProofCode: WriterExclusionProofCode | null;
}

export interface ReviewedWriterManifest {
  kind: 'absinthe_reviewed_writer_manifest';
  schemaVersion: 1;
  byteFormatVersion: 1;
  physicalSourceDigest: string;
  manifestVersion: typeof REVIEWED_MANIFEST_VERSION;
  entries: readonly ReviewedWriterManifestEntry[];
}

/** Exact source audit: 15 authoritative + 4 auxiliary + 4 metadata + 1 remote + 6 dormant/test = 30. */
const REVIEWED_ENTRY_SOURCE = [
  { writerTypeId: 'handoff.k328_evidence', contextTypes: ['window'], requiredCapabilities: [], authorityRole: 'dormant_or_test_writer', coordinationRequirement: 'excluded_with_proof', exclusionProofCode: 'DORMANT_NO_PRODUCTION_CALLER' },
  { writerTypeId: 'legacy.notes.audit_k96b', contextTypes: ['test_fixture'], requiredCapabilities: [], authorityRole: 'dormant_or_test_writer', coordinationRequirement: 'excluded_with_proof', exclusionProofCode: 'TEST_ONLY_NO_PRODUCTION_REACHABILITY' },
  { writerTypeId: 'legacy.notes.audit_k96d', contextTypes: ['test_fixture'], requiredCapabilities: [], authorityRole: 'dormant_or_test_writer', coordinationRequirement: 'excluded_with_proof', exclusionProofCode: 'TEST_ONLY_NO_PRODUCTION_REACHABILITY' },
  { writerTypeId: 'legacy.notes.audit_k97f', contextTypes: ['test_fixture'], requiredCapabilities: [], authorityRole: 'dormant_or_test_writer', coordinationRequirement: 'excluded_with_proof', exclusionProofCode: 'TEST_ONLY_NO_PRODUCTION_REACHABILITY' },
  { writerTypeId: 'legacy.notes.backup_durability', contextTypes: ['window'], requiredCapabilities: [], authorityRole: 'auxiliary_container_writer', coordinationRequirement: 'excluded_with_proof', exclusionProofCode: 'AUXILIARY_CONTAINER_NOT_AUTHORITY' },
  { writerTypeId: 'legacy.notes.cross_tab_merge', contextTypes: ['window'], requiredCapabilities: ['admission', 'drain_ack', 'source_write'], authorityRole: 'authoritative_source_writer', coordinationRequirement: 'must_participate', exclusionProofCode: null },
  { writerTypeId: 'legacy.notes.embedded_attachment_backup', contextTypes: ['window'], requiredCapabilities: [], authorityRole: 'auxiliary_container_writer', coordinationRequirement: 'excluded_with_proof', exclusionProofCode: 'AUXILIARY_CONTAINER_NOT_AUTHORITY' },
  { writerTypeId: 'legacy.notes.embedded_attachment_migration', contextTypes: ['window'], requiredCapabilities: ['admission', 'drain_ack', 'source_write'], authorityRole: 'authoritative_source_writer', coordinationRequirement: 'must_be_disabled', exclusionProofCode: null },
  { writerTypeId: 'legacy.notes.embedded_attachment_restore', contextTypes: ['restore_job'], requiredCapabilities: ['admission', 'drain_ack', 'source_write'], authorityRole: 'authoritative_source_writer', coordinationRequirement: 'must_be_disabled', exclusionProofCode: null },
  { writerTypeId: 'legacy.notes.folder_metadata', contextTypes: ['window'], requiredCapabilities: [], authorityRole: 'metadata_writer', coordinationRequirement: 'excluded_with_proof', exclusionProofCode: 'METADATA_NOT_SOURCE_AUTHORITY' },
  { writerTypeId: 'legacy.notes.idb_clear', contextTypes: ['window'], requiredCapabilities: ['admission', 'drain_ack', 'source_write'], authorityRole: 'authoritative_source_writer', coordinationRequirement: 'must_be_disabled', exclusionProofCode: null },
  { writerTypeId: 'legacy.notes.idb_delete', contextTypes: ['window'], requiredCapabilities: ['admission', 'drain_ack', 'source_write'], authorityRole: 'authoritative_source_writer', coordinationRequirement: 'must_be_disabled', exclusionProofCode: null },
  { writerTypeId: 'legacy.notes.idb_metadata', contextTypes: ['window'], requiredCapabilities: [], authorityRole: 'metadata_writer', coordinationRequirement: 'excluded_with_proof', exclusionProofCode: 'METADATA_NOT_SOURCE_AUTHORITY' },
  { writerTypeId: 'legacy.notes.idb_snapshot', contextTypes: ['window'], requiredCapabilities: ['admission', 'drain_ack', 'source_write'], authorityRole: 'authoritative_source_writer', coordinationRequirement: 'must_participate', exclusionProofCode: null },
  { writerTypeId: 'legacy.notes.init_rescue_seed', contextTypes: ['window'], requiredCapabilities: ['admission', 'drain_ack', 'source_write'], authorityRole: 'authoritative_source_writer', coordinationRequirement: 'must_participate', exclusionProofCode: null },
  { writerTypeId: 'legacy.notes.lifecycle_remote_flush', contextTypes: ['window'], requiredCapabilities: [], authorityRole: 'remote_only_writer', coordinationRequirement: 'excluded_with_proof', exclusionProofCode: 'REMOTE_ONLY_NO_LOCAL_SOURCE_MUTATION' },
  { writerTypeId: 'legacy.notes.local_snapshot', contextTypes: ['window'], requiredCapabilities: ['admission', 'drain_ack', 'source_write'], authorityRole: 'authoritative_source_writer', coordinationRequirement: 'must_be_disabled', exclusionProofCode: null },
  { writerTypeId: 'legacy.notes.notes_sync_metadata', contextTypes: ['window'], requiredCapabilities: [], authorityRole: 'metadata_writer', coordinationRequirement: 'excluded_with_proof', exclusionProofCode: 'METADATA_NOT_SOURCE_AUTHORITY' },
  { writerTypeId: 'legacy.notes.onboarding_marker', contextTypes: ['window'], requiredCapabilities: [], authorityRole: 'metadata_writer', coordinationRequirement: 'excluded_with_proof', exclusionProofCode: 'METADATA_NOT_SOURCE_AUTHORITY' },
  { writerTypeId: 'legacy.notes.persistence_facade', contextTypes: ['window'], requiredCapabilities: ['admission', 'drain_ack', 'source_write'], authorityRole: 'authoritative_source_writer', coordinationRequirement: 'must_participate', exclusionProofCode: null },
  { writerTypeId: 'legacy.notes.persistence_migration', contextTypes: ['migration_job'], requiredCapabilities: ['admission', 'drain_ack', 'source_write'], authorityRole: 'authoritative_source_writer', coordinationRequirement: 'must_participate', exclusionProofCode: null },
  { writerTypeId: 'legacy.notes.remote_hydration_merge', contextTypes: ['sync_hydration_job'], requiredCapabilities: ['admission', 'drain_ack', 'source_write'], authorityRole: 'authoritative_source_writer', coordinationRequirement: 'must_be_disabled', exclusionProofCode: null },
  { writerTypeId: 'legacy.notes.reset_cleanup', contextTypes: ['window'], requiredCapabilities: ['admission', 'drain_ack', 'source_write'], authorityRole: 'authoritative_source_writer', coordinationRequirement: 'must_be_disabled', exclusionProofCode: null },
  { writerTypeId: 'legacy.notes.restore_import', contextTypes: ['restore_job'], requiredCapabilities: ['admission', 'drain_ack', 'source_write'], authorityRole: 'authoritative_source_writer', coordinationRequirement: 'must_be_disabled', exclusionProofCode: null },
  { writerTypeId: 'legacy.notes.storage_migration', contextTypes: ['migration_job'], requiredCapabilities: ['admission', 'drain_ack', 'source_write'], authorityRole: 'authoritative_source_writer', coordinationRequirement: 'must_participate', exclusionProofCode: null },
  { writerTypeId: 'legacy.notes.store_actions', contextTypes: ['window'], requiredCapabilities: ['admission', 'drain_ack', 'source_write'], authorityRole: 'authoritative_source_writer', coordinationRequirement: 'must_participate', exclusionProofCode: null },
  { writerTypeId: 'legacy.notes.vault_restore_snapshot', contextTypes: ['restore_job'], requiredCapabilities: [], authorityRole: 'auxiliary_container_writer', coordinationRequirement: 'excluded_with_proof', exclusionProofCode: 'AUXILIARY_CONTAINER_NOT_AUTHORITY' },
  { writerTypeId: 'legacy.notes.vault_snapshot_auto', contextTypes: ['window'], requiredCapabilities: [], authorityRole: 'auxiliary_container_writer', coordinationRequirement: 'excluded_with_proof', exclusionProofCode: 'AUXILIARY_CONTAINER_NOT_AUTHORITY' },
  { writerTypeId: 'local_first.k325_migration', contextTypes: ['migration_job'], requiredCapabilities: [], authorityRole: 'dormant_or_test_writer', coordinationRequirement: 'excluded_with_proof', exclusionProofCode: 'DORMANT_NO_PRODUCTION_CALLER' },
  { writerTypeId: 'local_first.k326_cutover', contextTypes: ['migration_job'], requiredCapabilities: [], authorityRole: 'dormant_or_test_writer', coordinationRequirement: 'excluded_with_proof', exclusionProofCode: 'DORMANT_NO_PRODUCTION_CALLER' },
] as const satisfies readonly ReviewedWriterManifestEntry[];

export const K329B_REVIEWED_WRITER_MANIFEST_ENTRIES: readonly ReviewedWriterManifestEntry[] = Object.freeze(
  REVIEWED_ENTRY_SOURCE.map(entry => Object.freeze({ ...entry,
    contextTypes: Object.freeze([...entry.contextTypes]),
    requiredCapabilities: Object.freeze([...entry.requiredCapabilities]),
  })),
);
export const K329B_REVIEWED_WRITER_COUNT = K329B_REVIEWED_WRITER_MANIFEST_ENTRIES.length;

export interface ReviewedManifestAuthority {
  kind: 'absinthe_reviewed_manifest_authority';
  schemaVersion: 1;
  byteFormatVersion: 1;
  authorityId: typeof REVIEWED_MANIFEST_AUTHORITY_ID;
  manifestVersion: typeof REVIEWED_MANIFEST_VERSION;
  physicalSourceDigest: string;
  manifestDigest: string;
  reviewedEntryCount: number;
}

export interface CoordinationAuthorityRecord {
  kind: 'absinthe_writer_coordination_authority';
  schemaVersion: 1;
  byteFormatVersion: 1;
  physicalSourceDigest: string;
  coordinationEpoch: number;
  state: CoordinationState;
  coordinatorSessionId: string;
  verifierSessionId: string;
  recoverySessionId: string;
  reviewedManifestAuthorityDigest: string;
  admissionOpen: boolean;
  unresolvedOperationCount: number;
  drainRequestTransitionRevision: number | null;
  transitionRevision: number;
  createdSequence: number;
  updatedSequence: number;
  failureCode: WriterEligibilityErrorCode | null;
}

export interface WriterRegistrationRecord {
  kind: 'absinthe_writer_registration';
  schemaVersion: 1;
  byteFormatVersion: 1;
  physicalSourceDigest: string;
  writerTypeId: string;
  writerId: string;
  sessionId: string;
  contextType: WriterContextType;
  coordinationEpoch: number;
  capabilities: readonly WriterCapability[];
  registrationState: RegistrationState;
  coordinated: boolean;
  acknowledgedDrainRevision: number | null;
  latestOperationId: string | null;
  lastSeenSequence: number;
}

export interface AdmissionOperationRecord {
  kind: 'absinthe_writer_admission_operation';
  schemaVersion: 1;
  byteFormatVersion: 1;
  physicalSourceDigest: string;
  operationId: string;
  idempotencyKey: string;
  writerTypeId: string;
  writerId: string;
  sessionId: string;
  coordinationEpoch: number;
  admissionTransitionRevision: number;
  mutationType: 'snapshot_replace' | 'entity_put' | 'entity_delete' | 'metadata_write';
  expectedSourceRevision: string;
  state: OperationState;
  committedSourceRevision: string | null;
  terminalResult: 'committed' | 'aborted' | 'failed' | null;
}

export const CHECKPOINT_KINDS = [
  'BEFORE_DRAIN', 'AFTER_ADMISSION_CLOSED', 'AFTER_OPERATIONS_TERMINAL',
  'BEFORE_SOURCE_VERIFICATION', 'AFTER_SOURCE_VERIFICATION', 'BEFORE_ELIGIBILITY_COMMIT',
] as const;
export type CheckpointKind = typeof CHECKPOINT_KINDS[number];

export interface RegistrationCheckpointRecord {
  kind: 'absinthe_writer_registration_checkpoint';
  schemaVersion: 1;
  byteFormatVersion: 1;
  checkpointKind: CheckpointKind;
  physicalSourceDigest: string;
  coordinationEpoch: number;
  transitionRevision: number;
  authorityState: CoordinationState;
  coordinatorSessionId: string;
  actorKind: 'coordinator' | 'verifier';
  actorSessionId: string;
  reviewedManifestAuthorityDigest: string;
  stableIdentityDigest: string;
  liveInstanceDigest: string;
  operationDigest: string;
  unresolvedOperationDigest: string;
  registrationCount: number;
  operationCount: number;
  unresolvedOperationCount: number;
  previousCheckpointDigest: string | null;
  sourceEvidenceDigest: string | null;
  sourceRevision: string | null;
  sourceDigest: string | null;
  checkpointDigest: string;
}

export interface SourceVerificationObservation {
  physicalSourceDigest: string;
  sourceType: 'indexeddb';
  ownershipProven: boolean;
  canonical: boolean;
  withinBounds: boolean;
  revisionBefore: string;
  digestBefore: string;
  revisionAfter: string;
  digestAfter: string;
  authoritativeSourceDecision: 'indexeddb' | 'ambiguous';
  ambiguityCode: WriterEligibilityErrorCode | null;
  k328AdapterAvailable: boolean;
  k328PhysicalSourceDigest: string | null;
}

export interface SourceVerificationEvidence extends SourceVerificationObservation {
  kind: 'absinthe_writer_source_verification_evidence';
  schemaVersion: 1;
  byteFormatVersion: 1;
  captureActorKind: 'verifier';
  captureActorSessionId: string;
  coordinationEpoch: number;
  transitionRevision: number;
  previousCheckpointDigest: string;
  evidenceDigest: string;
}

export interface EligibilityEvidenceRecord {
  kind: 'absinthe_writer_eligibility_evidence';
  schemaVersion: 1;
  byteFormatVersion: 1;
  strategy: typeof WRITER_COORDINATION_STRATEGY;
  physicalSourceDigest: string;
  coordinationEpoch: number;
  authoritativeSource: 'indexeddb';
  reviewedManifestAuthorityDigest: string;
  finalCheckpointDigest: string;
  sourceEvidenceDigest: string;
  k328PhysicalSourceDigest: string;
  stableIdentityDigest: string;
  liveInstanceDigest: string;
  operationDigest: string;
  unresolvedOperationDigest: string;
  registrationCount: number;
  operationCount: number;
  unresolvedOperationCount: number;
  stableRevision: string;
  stableSourceDigest: string;
  authorityTransitionRevision: number;
  result: 'eligible';
}

export interface CurrentCoordinationGraph {
  stableWriterIdentityDigest: string;
  liveWriterInstanceDigest: string;
  operationSetDigest: string;
  unresolvedOperationDigest: string;
  unresolvedOperationCount: number;
  registrationCount: number;
  operationCount: number;
}

export interface WriterCoordinationModelState {
  kind: 'absinthe_writer_coordination_model';
  schemaVersion: 1;
  byteFormatVersion: 1;
  authority: CoordinationAuthorityRecord;
  reviewedManifestAuthority: ReviewedManifestAuthority;
  reviewedManifest: ReviewedWriterManifest;
  registrations: readonly WriterRegistrationRecord[];
  operations: readonly AdmissionOperationRecord[];
  checkpointChain: readonly RegistrationCheckpointRecord[];
  sourceEvidence: SourceVerificationEvidence | null;
  eligibilityEvidence: EligibilityEvidenceRecord | null;
}

export type WriterCoordinationActor =
  | { kind: 'coordinator' | 'verifier' | 'recovery'; sessionId: string }
  | { kind: 'writer'; writerId: string; sessionId: string };

interface TransitionEnvelope {
  actor: WriterCoordinationActor;
  expectedTransitionRevision: number;
  expectedCoordinationEpoch: number;
  expectedAuthorityDigest: string;
}

export type WriterCoordinationAction = TransitionEnvelope & (
  | { type: 'REGISTER_WRITER'; registration: WriterRegistrationRecord }
  | { type: 'CAPTURE_BEFORE_DRAIN' }
  | { type: 'REQUEST_DRAIN' }
  | { type: 'ACKNOWLEDGE_DRAIN'; writerId: string; drainRequestTransitionRevision: number }
  | { type: 'CLOSE_ADMISSION' }
  | { type: 'CAPTURE_AFTER_ADMISSION_CLOSED' }
  | { type: 'BEGIN_DRAIN' }
  | { type: 'ADMIT_OPERATION'; operation: AdmissionOperationRecord }
  | { type: 'TERMINALIZE_OPERATION'; operationId: string; result: 'committed' | 'aborted' | 'failed'; committedSourceRevision: string | null }
  | { type: 'MARK_QUIESCENT' }
  | { type: 'CAPTURE_AFTER_OPERATIONS_TERMINAL' }
  | { type: 'CAPTURE_BEFORE_SOURCE_VERIFICATION' }
  | { type: 'BEGIN_SOURCE_VERIFICATION' }
  | { type: 'CAPTURE_SOURCE_EVIDENCE'; observation: SourceVerificationObservation }
  | { type: 'CAPTURE_AFTER_SOURCE_VERIFICATION' }
  | { type: 'CAPTURE_BEFORE_ELIGIBILITY_COMMIT' }
  | { type: 'COMMIT_ELIGIBILITY'; expectedFinalCheckpointDigest: string }
  | { type: 'ABORT'; failureCode: WriterEligibilityErrorCode | null }
);

export type WriterCoordinationReduction =
  | { ok: true; state: WriterCoordinationModelState }
  | { ok: false; code: WriterEligibilityErrorCode };

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const HASH = /^[a-f0-9]{64}$/;
const SAFE_ID = /^[a-z0-9][a-z0-9._:-]{0,159}$/;
const WRITER_TYPE_ID = /^[a-z0-9][a-z0-9._-]{0,79}$/;
const WRITER_ID = /^writer-v1:(window|dedicated_worker|shared_worker|service_worker|restore_job|sync_hydration_job|migration_job|test_fixture):([a-z0-9][a-z0-9._-]{0,79}):([a-f0-9]{32})$/;
const SESSION_ID = /^writer-session-v1:[a-f0-9]{32}$/;
const OPERATION_ID = /^writer-operation-v1:[a-f0-9]{64}$/;
const IDEMPOTENCY_KEY = /^writer-idempotency-v1:[a-f0-9]{64}$/;
const SOURCE_REVISION = /^(0|[1-9][0-9]{0,15})$/;

function exactRecord(value: unknown, expected: readonly string[]): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return false;
  const keys = Reflect.ownKeys(value);
  if (keys.some(key => typeof key !== 'string') || keys.length !== expected.length) return false;
  const expectedSorted = [...expected].sort();
  if ((keys as string[]).slice().sort().some((key, index) => key !== expectedSorted[index])) return false;
  return keys.every(key => {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return Boolean(descriptor && 'value' in descriptor && descriptor.enumerable);
  });
}

function safeInteger(value: unknown, minimum = 0): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= minimum;
}
function boundedId(value: unknown): value is string {
  return typeof value === 'string' && SAFE_ID.test(value)
    && encoder.encode(value).byteLength <= WRITER_COORDINATION_LIMITS.identifierBytes;
}
function sortedUniqueStrings(value: unknown, allowed: readonly string[], allowEmpty = false): value is readonly string[] {
  return Array.isArray(value) && Object.getPrototypeOf(value) === Array.prototype
    && (allowEmpty || value.length > 0) && value.length <= allowed.length
    && value.every(item => typeof item === 'string' && allowed.includes(item))
    && new Set(value).size === value.length
    && value.every((item, index) => index === 0 || value[index - 1] < item);
}
function bytesEqual(left: Uint8Array, right: Uint8Array): boolean {
  return left.byteLength === right.byteLength && left.every((byte, index) => byte === right[index]);
}
function digestJson(value: unknown): string { return sha256Hex(JSON.stringify(value)); }

const MANIFEST_ENTRY_KEYS = ['writerTypeId', 'contextTypes', 'requiredCapabilities', 'authorityRole',
  'coordinationRequirement', 'exclusionProofCode'] as const;
const MANIFEST_KEYS = ['kind', 'schemaVersion', 'byteFormatVersion', 'physicalSourceDigest', 'manifestVersion', 'entries'] as const;
const MANIFEST_AUTHORITY_KEYS = ['kind', 'schemaVersion', 'byteFormatVersion', 'authorityId', 'manifestVersion',
  'physicalSourceDigest', 'manifestDigest', 'reviewedEntryCount'] as const;
const AUTHORITY_KEYS = ['kind', 'schemaVersion', 'byteFormatVersion', 'physicalSourceDigest', 'coordinationEpoch', 'state',
  'coordinatorSessionId', 'verifierSessionId', 'recoverySessionId', 'reviewedManifestAuthorityDigest', 'admissionOpen',
  'unresolvedOperationCount', 'drainRequestTransitionRevision', 'transitionRevision', 'createdSequence', 'updatedSequence',
  'failureCode'] as const;
const REGISTRATION_KEYS = ['kind', 'schemaVersion', 'byteFormatVersion', 'physicalSourceDigest', 'writerTypeId', 'writerId',
  'sessionId', 'contextType', 'coordinationEpoch', 'capabilities', 'registrationState', 'coordinated',
  'acknowledgedDrainRevision', 'latestOperationId', 'lastSeenSequence'] as const;
const OPERATION_KEYS = ['kind', 'schemaVersion', 'byteFormatVersion', 'physicalSourceDigest', 'operationId', 'idempotencyKey',
  'writerTypeId', 'writerId', 'sessionId', 'coordinationEpoch', 'admissionTransitionRevision', 'mutationType',
  'expectedSourceRevision', 'state', 'committedSourceRevision', 'terminalResult'] as const;
const CHECKPOINT_KEYS = ['kind', 'schemaVersion', 'byteFormatVersion', 'checkpointKind', 'physicalSourceDigest',
  'coordinationEpoch', 'transitionRevision', 'authorityState', 'coordinatorSessionId', 'actorKind', 'actorSessionId',
  'reviewedManifestAuthorityDigest', 'stableIdentityDigest', 'liveInstanceDigest', 'operationDigest',
  'unresolvedOperationDigest', 'registrationCount', 'operationCount',
  'unresolvedOperationCount', 'previousCheckpointDigest', 'sourceEvidenceDigest', 'sourceRevision', 'sourceDigest',
  'checkpointDigest'] as const;
const SOURCE_OBSERVATION_KEYS = ['physicalSourceDigest', 'sourceType', 'ownershipProven', 'canonical', 'withinBounds',
  'revisionBefore', 'digestBefore', 'revisionAfter', 'digestAfter', 'authoritativeSourceDecision', 'ambiguityCode',
  'k328AdapterAvailable', 'k328PhysicalSourceDigest'] as const;
const SOURCE_EVIDENCE_KEYS = ['kind', 'schemaVersion', 'byteFormatVersion', ...SOURCE_OBSERVATION_KEYS,
  'captureActorKind', 'captureActorSessionId', 'coordinationEpoch', 'transitionRevision', 'previousCheckpointDigest',
  'evidenceDigest'] as const;
const ELIGIBILITY_KEYS = ['kind', 'schemaVersion', 'byteFormatVersion', 'strategy', 'physicalSourceDigest',
  'coordinationEpoch', 'authoritativeSource', 'reviewedManifestAuthorityDigest', 'finalCheckpointDigest',
  'sourceEvidenceDigest', 'k328PhysicalSourceDigest', 'stableIdentityDigest', 'liveInstanceDigest', 'operationDigest',
  'unresolvedOperationDigest', 'registrationCount', 'operationCount', 'unresolvedOperationCount',
  'stableRevision', 'stableSourceDigest', 'authorityTransitionRevision', 'result'] as const;
const MODEL_KEYS = ['kind', 'schemaVersion', 'byteFormatVersion', 'authority', 'reviewedManifestAuthority',
  'reviewedManifest', 'registrations', 'operations', 'checkpointChain', 'sourceEvidence', 'eligibilityEvidence'] as const;

export function validateReviewedWriterManifest(value: unknown): value is ReviewedWriterManifest {
  if (!exactRecord(value, MANIFEST_KEYS)) return false;
  const manifest = value as unknown as ReviewedWriterManifest;
  if (manifest.kind !== 'absinthe_reviewed_writer_manifest' || manifest.schemaVersion !== 1
    || manifest.byteFormatVersion !== 1 || !HASH.test(manifest.physicalSourceDigest)
    || manifest.manifestVersion !== REVIEWED_MANIFEST_VERSION || !Array.isArray(manifest.entries)
    || manifest.entries.length === 0 || manifest.entries.length > WRITER_COORDINATION_LIMITS.writerTypes) return false;
  let participating = false;
  for (let index = 0; index < manifest.entries.length; index += 1) {
    const candidate = manifest.entries[index];
    if (!exactRecord(candidate, MANIFEST_ENTRY_KEYS)) return false;
    const entry = candidate as unknown as ReviewedWriterManifestEntry;
    if (!WRITER_TYPE_ID.test(entry.writerTypeId)
      || (index > 0 && manifest.entries[index - 1].writerTypeId >= entry.writerTypeId)
      || !sortedUniqueStrings(entry.contextTypes, WRITER_CONTEXT_TYPES)
      || !sortedUniqueStrings(entry.requiredCapabilities, ['admission', 'drain_ack', 'source_write'],
        entry.coordinationRequirement === 'excluded_with_proof')
      || !WRITER_AUTHORITY_ROLES.includes(entry.authorityRole)
      || !WRITER_COORDINATION_REQUIREMENTS.includes(entry.coordinationRequirement)) return false;
    if (entry.coordinationRequirement === 'excluded_with_proof') {
      const allowed = entry.authorityRole === 'auxiliary_container_writer' ? 'AUXILIARY_CONTAINER_NOT_AUTHORITY'
        : entry.authorityRole === 'metadata_writer' ? 'METADATA_NOT_SOURCE_AUTHORITY'
          : entry.authorityRole === 'remote_only_writer' ? 'REMOTE_ONLY_NO_LOCAL_SOURCE_MUTATION'
            : entry.authorityRole === 'dormant_or_test_writer' ? entry.exclusionProofCode : null;
      if (!entry.exclusionProofCode || !WRITER_EXCLUSION_PROOF_CODES.includes(entry.exclusionProofCode)
        || (entry.authorityRole === 'dormant_or_test_writer'
          ? !['DORMANT_NO_PRODUCTION_CALLER', 'TEST_ONLY_NO_PRODUCTION_REACHABILITY'].includes(entry.exclusionProofCode)
          : entry.exclusionProofCode !== allowed)) return false;
    } else if (entry.authorityRole !== 'authoritative_source_writer' || entry.exclusionProofCode !== null) return false;
    participating ||= entry.coordinationRequirement === 'must_participate';
  }
  return participating;
}

function orderedManifest(value: ReviewedWriterManifest): ReviewedWriterManifest {
  return { kind: value.kind, schemaVersion: value.schemaVersion, byteFormatVersion: value.byteFormatVersion,
    physicalSourceDigest: value.physicalSourceDigest, manifestVersion: value.manifestVersion,
    entries: value.entries.map(entry => ({ writerTypeId: entry.writerTypeId, contextTypes: [...entry.contextTypes],
      requiredCapabilities: [...entry.requiredCapabilities], authorityRole: entry.authorityRole,
      coordinationRequirement: entry.coordinationRequirement, exclusionProofCode: entry.exclusionProofCode })) };
}

export function createK329BReviewedWriterManifest(physicalSourceDigest: string): ReviewedWriterManifest {
  if (!HASH.test(physicalSourceDigest)) throw new Error('REVIEWED_MANIFEST_AUTHORITY_MISMATCH');
  return Object.freeze({ kind: 'absinthe_reviewed_writer_manifest', schemaVersion: 1, byteFormatVersion: 1,
    physicalSourceDigest, manifestVersion: REVIEWED_MANIFEST_VERSION,
    entries: K329B_REVIEWED_WRITER_MANIFEST_ENTRIES });
}

export function validateReviewedManifestAuthority(value: unknown): value is ReviewedManifestAuthority {
  if (!exactRecord(value, MANIFEST_AUTHORITY_KEYS)) return false;
  const record = value as unknown as ReviewedManifestAuthority;
  if (!(record.kind === 'absinthe_reviewed_manifest_authority' && record.schemaVersion === 1
    && record.byteFormatVersion === 1 && record.authorityId === REVIEWED_MANIFEST_AUTHORITY_ID
    && record.manifestVersion === REVIEWED_MANIFEST_VERSION && HASH.test(record.physicalSourceDigest)
    && HASH.test(record.manifestDigest) && record.reviewedEntryCount === K329B_REVIEWED_WRITER_COUNT)) return false;
  return record.manifestDigest === deriveReviewedWriterManifestDigest(
    createK329BReviewedWriterManifest(record.physicalSourceDigest));
}

export function validateCoordinationAuthority(value: unknown): value is CoordinationAuthorityRecord {
  if (!exactRecord(value, AUTHORITY_KEYS)) return false;
  const record = value as unknown as CoordinationAuthorityRecord;
  return record.kind === 'absinthe_writer_coordination_authority' && record.schemaVersion === 1
    && record.byteFormatVersion === 1 && HASH.test(record.physicalSourceDigest)
    && safeInteger(record.coordinationEpoch, 1) && COORDINATION_STATES.includes(record.state)
    && SESSION_ID.test(record.coordinatorSessionId) && SESSION_ID.test(record.verifierSessionId)
    && SESSION_ID.test(record.recoverySessionId) && HASH.test(record.reviewedManifestAuthorityDigest)
    && record.admissionOpen === (record.state === 'OPEN') && safeInteger(record.unresolvedOperationCount)
    && (record.drainRequestTransitionRevision === null || safeInteger(record.drainRequestTransitionRevision))
    && safeInteger(record.transitionRevision) && safeInteger(record.createdSequence)
    && safeInteger(record.updatedSequence) && record.updatedSequence >= record.createdSequence
    && (record.failureCode === null || WRITER_ELIGIBILITY_ERROR_CODES.includes(record.failureCode));
}

export function validateWriterRegistration(value: unknown): value is WriterRegistrationRecord {
  if (!exactRecord(value, REGISTRATION_KEYS)) return false;
  const record = value as unknown as WriterRegistrationRecord;
  const identity = typeof record.writerId === 'string' ? WRITER_ID.exec(record.writerId) : null;
  const lifecycle = record.registrationState === 'registered'
    ? !record.coordinated && record.acknowledgedDrainRevision === null
    : record.registrationState === 'drain_acknowledged'
      ? record.coordinated && safeInteger(record.acknowledgedDrainRevision)
      : record.coordinated && record.acknowledgedDrainRevision === null;
  return record.kind === 'absinthe_writer_registration' && record.schemaVersion === 1
    && record.byteFormatVersion === 1 && HASH.test(record.physicalSourceDigest)
    && WRITER_TYPE_ID.test(record.writerTypeId) && identity !== null
    && identity[1] === record.contextType && identity[2] === record.writerTypeId
    && SESSION_ID.test(record.sessionId) && WRITER_CONTEXT_TYPES.includes(record.contextType)
    && safeInteger(record.coordinationEpoch, 1)
    && sortedUniqueStrings(record.capabilities, ['admission', 'drain_ack', 'source_write'])
    && ['registered', 'drain_acknowledged', 'disabled'].includes(record.registrationState)
    && lifecycle && (record.latestOperationId === null || OPERATION_ID.test(record.latestOperationId))
    && safeInteger(record.lastSeenSequence);
}

export function validateAdmissionOperation(value: unknown): value is AdmissionOperationRecord {
  if (!exactRecord(value, OPERATION_KEYS)) return false;
  const record = value as unknown as AdmissionOperationRecord;
  const identity = typeof record.writerId === 'string' ? WRITER_ID.exec(record.writerId) : null;
  const terminal = record.state === 'admitted' ? record.terminalResult === null && record.committedSourceRevision === null
    : record.state === 'committed' ? record.terminalResult === 'committed' && record.committedSourceRevision !== null
      : record.terminalResult === record.state && record.committedSourceRevision === null;
  return record.kind === 'absinthe_writer_admission_operation' && record.schemaVersion === 1
    && record.byteFormatVersion === 1 && HASH.test(record.physicalSourceDigest)
    && OPERATION_ID.test(record.operationId) && IDEMPOTENCY_KEY.test(record.idempotencyKey)
    && WRITER_TYPE_ID.test(record.writerTypeId) && identity !== null && identity[2] === record.writerTypeId
    && SESSION_ID.test(record.sessionId) && safeInteger(record.coordinationEpoch, 1)
    && safeInteger(record.admissionTransitionRevision)
    && ['snapshot_replace', 'entity_put', 'entity_delete', 'metadata_write'].includes(record.mutationType)
    && SOURCE_REVISION.test(record.expectedSourceRevision)
    && ['admitted', 'committed', 'aborted', 'failed'].includes(record.state)
    && (record.committedSourceRevision === null || SOURCE_REVISION.test(record.committedSourceRevision)) && terminal;
}

function orderedManifestAuthority(value: ReviewedManifestAuthority): ReviewedManifestAuthority {
  return { kind: value.kind, schemaVersion: value.schemaVersion, byteFormatVersion: value.byteFormatVersion,
    authorityId: value.authorityId, manifestVersion: value.manifestVersion, physicalSourceDigest: value.physicalSourceDigest,
    manifestDigest: value.manifestDigest, reviewedEntryCount: value.reviewedEntryCount };
}
function orderedAuthority(value: CoordinationAuthorityRecord): CoordinationAuthorityRecord {
  return { kind: value.kind, schemaVersion: value.schemaVersion, byteFormatVersion: value.byteFormatVersion,
    physicalSourceDigest: value.physicalSourceDigest, coordinationEpoch: value.coordinationEpoch, state: value.state,
    coordinatorSessionId: value.coordinatorSessionId, verifierSessionId: value.verifierSessionId,
    recoverySessionId: value.recoverySessionId, reviewedManifestAuthorityDigest: value.reviewedManifestAuthorityDigest,
    admissionOpen: value.admissionOpen, unresolvedOperationCount: value.unresolvedOperationCount,
    drainRequestTransitionRevision: value.drainRequestTransitionRevision, transitionRevision: value.transitionRevision,
    createdSequence: value.createdSequence, updatedSequence: value.updatedSequence, failureCode: value.failureCode };
}
function orderedRegistration(value: WriterRegistrationRecord): WriterRegistrationRecord {
  return { kind: value.kind, schemaVersion: value.schemaVersion, byteFormatVersion: value.byteFormatVersion,
    physicalSourceDigest: value.physicalSourceDigest, writerTypeId: value.writerTypeId, writerId: value.writerId,
    sessionId: value.sessionId, contextType: value.contextType, coordinationEpoch: value.coordinationEpoch,
    capabilities: [...value.capabilities], registrationState: value.registrationState, coordinated: value.coordinated,
    acknowledgedDrainRevision: value.acknowledgedDrainRevision, latestOperationId: value.latestOperationId,
    lastSeenSequence: value.lastSeenSequence };
}
function orderedOperation(value: AdmissionOperationRecord): AdmissionOperationRecord {
  return { kind: value.kind, schemaVersion: value.schemaVersion, byteFormatVersion: value.byteFormatVersion,
    physicalSourceDigest: value.physicalSourceDigest, operationId: value.operationId, idempotencyKey: value.idempotencyKey,
    writerTypeId: value.writerTypeId, writerId: value.writerId, sessionId: value.sessionId,
    coordinationEpoch: value.coordinationEpoch, admissionTransitionRevision: value.admissionTransitionRevision,
    mutationType: value.mutationType, expectedSourceRevision: value.expectedSourceRevision, state: value.state,
    committedSourceRevision: value.committedSourceRevision, terminalResult: value.terminalResult };
}

class StrictJsonReader {
  #index = 0;
  constructor(private readonly text: string) {}
  parse(): unknown { const value = this.#value(0); if (this.#index !== this.text.length) throw new Error(); return value; }
  #value(depth: number): unknown {
    if (depth > 24 || this.#index >= this.text.length) throw new Error();
    const char = this.text[this.#index];
    if (char === '{') return this.#object(depth + 1);
    if (char === '[') return this.#array(depth + 1);
    if (char === '"') return this.#string();
    for (const [token, value] of [['true', true], ['false', false], ['null', null]] as const) {
      if (this.text.startsWith(token, this.#index)) { this.#index += token.length; return value; }
    }
    const match = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec(this.text.slice(this.#index));
    if (!match) throw new Error();
    this.#index += match[0].length; const result = Number(match[0]); if (!Number.isFinite(result)) throw new Error(); return result;
  }
  #object(depth: number): Record<string, unknown> {
    this.#index += 1; const result = Object.create(null) as Record<string, unknown>; const keys = new Set<string>();
    if (this.text[this.#index] === '}') { this.#index += 1; return result; }
    while (true) {
      if (this.text[this.#index] !== '"') throw new Error(); const key = this.#string();
      if (keys.has(key) || this.text[this.#index] !== ':') throw new Error(); keys.add(key); this.#index += 1;
      result[key] = this.#value(depth); const char = this.text[this.#index++];
      if (char === '}') return result; if (char !== ',') throw new Error();
    }
  }
  #array(depth: number): unknown[] {
    this.#index += 1; const result: unknown[] = [];
    if (this.text[this.#index] === ']') { this.#index += 1; return result; }
    while (true) { result.push(this.#value(depth)); const char = this.text[this.#index++];
      if (char === ']') return result; if (char !== ',') throw new Error(); }
  }
  #string(): string {
    const start = this.#index; this.#index += 1;
    while (this.#index < this.text.length) {
      const char = this.text[this.#index++];
      if (char === '"') return JSON.parse(this.text.slice(start, this.#index)) as string;
      if (char === '\\') { if (this.#index >= this.text.length) throw new Error(); this.#index += 1; }
      else if (char.charCodeAt(0) < 0x20) throw new Error();
    }
    throw new Error();
  }
}

type DecodeCode = 'ELIGIBILITY_EVIDENCE_CORRUPT' | 'ELIGIBILITY_PROTOCOL_VERSION_UNSUPPORTED';
export type CanonicalDecodeResult<T> = { ok: true; value: T } | { ok: false; code: DecodeCode };
function encodeCanonical<T>(value: T, validate: (candidate: unknown) => candidate is T,
  order: (candidate: T) => unknown, limit: number): Uint8Array {
  if (!validate(value)) throw new Error('ELIGIBILITY_EVIDENCE_CORRUPT');
  const bytes = encoder.encode(JSON.stringify(order(value)));
  if (bytes.byteLength > limit) throw new Error('ELIGIBILITY_EVIDENCE_CORRUPT');
  return bytes;
}
function decodeCanonical<T>(bytes: Uint8Array, validate: (candidate: unknown) => candidate is T,
  encode: (candidate: T) => Uint8Array, limit: number): CanonicalDecodeResult<T> {
  if (!(bytes instanceof Uint8Array) || bytes.byteLength === 0 || bytes.byteLength > limit) {
    return { ok: false, code: 'ELIGIBILITY_EVIDENCE_CORRUPT' };
  }
  let text: string; try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
  catch { return { ok: false, code: 'ELIGIBILITY_EVIDENCE_CORRUPT' }; }
  let value: unknown; try { value = new StrictJsonReader(text).parse(); }
  catch { return { ok: false, code: 'ELIGIBILITY_EVIDENCE_CORRUPT' }; }
  if (value && typeof value === 'object' && 'schemaVersion' in value
    && (value as { schemaVersion?: unknown }).schemaVersion !== 1) {
    return { ok: false, code: 'ELIGIBILITY_PROTOCOL_VERSION_UNSUPPORTED' };
  }
  if (!validate(value)) return { ok: false, code: 'ELIGIBILITY_EVIDENCE_CORRUPT' };
  let canonical: Uint8Array; try { canonical = encode(value); }
  catch { return { ok: false, code: 'ELIGIBILITY_EVIDENCE_CORRUPT' }; }
  return bytesEqual(bytes, canonical) ? { ok: true, value } : { ok: false, code: 'ELIGIBILITY_EVIDENCE_CORRUPT' };
}

export const encodeReviewedWriterManifestCanonical = (value: ReviewedWriterManifest): Uint8Array =>
  encodeCanonical(value, validateReviewedWriterManifest, orderedManifest, WRITER_COORDINATION_LIMITS.reviewedManifestBytes);
export const decodeReviewedWriterManifestCanonical = (bytes: Uint8Array): CanonicalDecodeResult<ReviewedWriterManifest> =>
  decodeCanonical(bytes, validateReviewedWriterManifest, encodeReviewedWriterManifestCanonical, WRITER_COORDINATION_LIMITS.reviewedManifestBytes);
export function deriveReviewedWriterManifestDigest(value: ReviewedWriterManifest): string {
  return sha256Hex(decoder.decode(encodeReviewedWriterManifestCanonical(value)));
}

export function createK329BReviewedManifestAuthority(physicalSourceDigest: string): ReviewedManifestAuthority {
  const manifest = createK329BReviewedWriterManifest(physicalSourceDigest);
  return Object.freeze({ kind: 'absinthe_reviewed_manifest_authority', schemaVersion: 1, byteFormatVersion: 1,
    authorityId: REVIEWED_MANIFEST_AUTHORITY_ID, manifestVersion: REVIEWED_MANIFEST_VERSION, physicalSourceDigest,
    manifestDigest: deriveReviewedWriterManifestDigest(manifest), reviewedEntryCount: K329B_REVIEWED_WRITER_COUNT });
}
export const encodeReviewedManifestAuthorityCanonical = (value: ReviewedManifestAuthority): Uint8Array =>
  encodeCanonical(value, validateReviewedManifestAuthority, orderedManifestAuthority, WRITER_COORDINATION_LIMITS.manifestAuthorityBytes);
export const decodeReviewedManifestAuthorityCanonical = (bytes: Uint8Array): CanonicalDecodeResult<ReviewedManifestAuthority> =>
  decodeCanonical(bytes, validateReviewedManifestAuthority, encodeReviewedManifestAuthorityCanonical,
    WRITER_COORDINATION_LIMITS.manifestAuthorityBytes);
export function deriveReviewedManifestAuthorityDigest(value: ReviewedManifestAuthority): string {
  return sha256Hex(decoder.decode(encodeReviewedManifestAuthorityCanonical(value)));
}

function trustedManifestPair(authority: ReviewedManifestAuthority, manifest: ReviewedWriterManifest): boolean {
  if (!validateReviewedManifestAuthority(authority) || !validateReviewedWriterManifest(manifest)
    || authority.physicalSourceDigest !== manifest.physicalSourceDigest) return false;
  const expected = createK329BReviewedWriterManifest(authority.physicalSourceDigest);
  return bytesEqual(encodeReviewedWriterManifestCanonical(manifest), encodeReviewedWriterManifestCanonical(expected))
    && authority.manifestDigest === deriveReviewedWriterManifestDigest(expected)
    && authority.reviewedEntryCount === expected.entries.length;
}

export const encodeCoordinationAuthorityCanonical = (value: CoordinationAuthorityRecord): Uint8Array =>
  encodeCanonical(value, validateCoordinationAuthority, orderedAuthority, WRITER_COORDINATION_LIMITS.authorityBytes);
export const decodeCoordinationAuthorityCanonical = (bytes: Uint8Array): CanonicalDecodeResult<CoordinationAuthorityRecord> =>
  decodeCanonical(bytes, validateCoordinationAuthority, encodeCoordinationAuthorityCanonical, WRITER_COORDINATION_LIMITS.authorityBytes);
export function deriveCoordinationAuthorityDigest(value: CoordinationAuthorityRecord): string {
  return sha256Hex(decoder.decode(encodeCoordinationAuthorityCanonical(value)));
}
export const encodeWriterRegistrationCanonical = (value: WriterRegistrationRecord): Uint8Array =>
  encodeCanonical(value, validateWriterRegistration, orderedRegistration, WRITER_COORDINATION_LIMITS.registrationBytes);
export const decodeWriterRegistrationCanonical = (bytes: Uint8Array): CanonicalDecodeResult<WriterRegistrationRecord> =>
  decodeCanonical(bytes, validateWriterRegistration, encodeWriterRegistrationCanonical, WRITER_COORDINATION_LIMITS.registrationBytes);
export const encodeAdmissionOperationCanonical = (value: AdmissionOperationRecord): Uint8Array =>
  encodeCanonical(value, validateAdmissionOperation, orderedOperation, WRITER_COORDINATION_LIMITS.operationBytes);
export const decodeAdmissionOperationCanonical = (bytes: Uint8Array): CanonicalDecodeResult<AdmissionOperationRecord> =>
  decodeCanonical(bytes, validateAdmissionOperation, encodeAdmissionOperationCanonical, WRITER_COORDINATION_LIMITS.operationBytes);

function registrationIdentity(record: WriterRegistrationRecord): string {
  return [record.writerTypeId, record.writerId, record.sessionId, record.contextType,
    record.physicalSourceDigest, record.coordinationEpoch].join('|');
}
export function deriveStableWriterIdentityDigest(registrations: readonly WriterRegistrationRecord[]): string {
  if (!validRegistrationSet(registrations, true)) throw new Error('WRITER_REGISTRATION_MALFORMED');
  return digestJson(['absinthe_stable_writer_identity_set_v1', [...registrations]
    .sort((a, b) => registrationIdentity(a) < registrationIdentity(b) ? -1 : 1)
    .map(record => [record.physicalSourceDigest, record.coordinationEpoch, record.writerTypeId, record.writerId,
      record.sessionId, record.contextType, record.capabilities])]);
}
export function deriveLiveWriterInstanceSetDigest(registrations: readonly WriterRegistrationRecord[]): string {
  if (!validRegistrationSet(registrations, true)) throw new Error('WRITER_REGISTRATION_MALFORMED');
  return digestJson(['absinthe_live_writer_instance_set_v2', [...registrations]
    .sort((a, b) => registrationIdentity(a) < registrationIdentity(b) ? -1 : 1)
    .map(record => [record.writerTypeId, record.writerId, record.sessionId, record.contextType,
      record.physicalSourceDigest, record.coordinationEpoch, record.capabilities, record.registrationState,
      record.coordinated, record.acknowledgedDrainRevision, record.latestOperationId])]);
}
function validRegistrationSet(value: unknown, allowEmpty: boolean): value is readonly WriterRegistrationRecord[] {
  return Array.isArray(value) && (allowEmpty || value.length > 0) && value.length <= WRITER_COORDINATION_LIMITS.registrations
    && value.every(validateWriterRegistration)
    && new Set(value.map(record => record.writerId)).size === value.length
    && new Set(value.map(record => record.sessionId)).size === value.length;
}
function validOperationSet(value: unknown): value is readonly AdmissionOperationRecord[] {
  return Array.isArray(value) && value.length <= WRITER_COORDINATION_LIMITS.operations
    && value.every(validateAdmissionOperation)
    && new Set(value.map(record => record.operationId)).size === value.length
    && new Set(value.map(record => record.idempotencyKey)).size === value.length;
}
export function deriveOperationSetDigest(operations: readonly AdmissionOperationRecord[]): string {
  if (!validOperationSet(operations)) throw new Error('IN_FLIGHT_STATE_AMBIGUOUS');
  return digestJson(['absinthe_admission_operation_set_v1', operations
    .map(record => decoder.decode(encodeAdmissionOperationCanonical(record))).sort()]);
}

export function deriveUnresolvedOperationDigest(operations: readonly AdmissionOperationRecord[]): string {
  if (!validOperationSet(operations)) throw new Error('IN_FLIGHT_STATE_AMBIGUOUS');
  return digestJson(['absinthe_unresolved_operation_set_v1', operations
    .filter(record => record.state === 'admitted')
    .map(record => decoder.decode(encodeAdmissionOperationCanonical(record))).sort()]);
}

export const ZERO_UNRESOLVED_OPERATION_DIGEST = deriveUnresolvedOperationDigest([]);

function operationRegistrationRelationError(state: WriterCoordinationModelState): WriterEligibilityErrorCode | null {
  for (const operation of state.operations) {
    const matches = state.registrations.filter(registration => registration.writerId === operation.writerId
      && registration.sessionId === operation.sessionId && registration.writerTypeId === operation.writerTypeId
      && registration.physicalSourceDigest === operation.physicalSourceDigest
      && registration.coordinationEpoch === operation.coordinationEpoch);
    if (matches.length !== 1 || !state.reviewedManifest.entries.some(entry => entry.writerTypeId === operation.writerTypeId)) {
      return 'OPERATION_REGISTRATION_RELATION_INVALID';
    }
  }
  return null;
}

function registrationOperationRelationError(state: WriterCoordinationModelState): WriterEligibilityErrorCode | null {
  for (const registration of state.registrations) {
    const owned = state.operations.filter(operation => operation.writerId === registration.writerId
      && operation.sessionId === registration.sessionId);
    if (registration.latestOperationId === null) {
      if (owned.length !== 0) return 'REGISTRATION_OPERATION_RELATION_INVALID';
    } else {
      const latest = state.operations.filter(operation => operation.operationId === registration.latestOperationId
        && operation.writerId === registration.writerId && operation.sessionId === registration.sessionId
        && operation.writerTypeId === registration.writerTypeId
        && operation.physicalSourceDigest === registration.physicalSourceDigest
        && operation.coordinationEpoch === registration.coordinationEpoch);
      if (latest.length !== 1) return 'REGISTRATION_OPERATION_RELATION_INVALID';
    }
    if (owned.some(operation => operation.state === 'admitted')
      && (registration.registrationState !== 'registered' || registration.coordinated
        || registration.acknowledgedDrainRevision !== null)) {
      return 'REGISTRATION_OPERATION_RELATION_INVALID';
    }
  }
  return null;
}

export function deriveCurrentCoordinationGraph(state: WriterCoordinationModelState): CurrentCoordinationGraph {
  if (!validRegistrationSet(state.registrations, true) || !validOperationSet(state.operations)) {
    throw new Error('ELIGIBILITY_EVIDENCE_CORRUPT');
  }
  if (state.registrations.some(record => record.physicalSourceDigest !== state.authority.physicalSourceDigest
    || record.coordinationEpoch !== state.authority.coordinationEpoch)
    || state.operations.some(record => record.physicalSourceDigest !== state.authority.physicalSourceDigest
      || record.coordinationEpoch !== state.authority.coordinationEpoch)) {
    throw new Error('OPERATION_REGISTRATION_RELATION_INVALID');
  }
  const operationError = operationRegistrationRelationError(state); if (operationError) throw new Error(operationError);
  const registrationError = registrationOperationRelationError(state); if (registrationError) throw new Error(registrationError);
  const unresolvedOperationCount = state.operations.filter(operation => operation.state === 'admitted').length;
  return Object.freeze({
    stableWriterIdentityDigest: deriveStableWriterIdentityDigest(state.registrations),
    liveWriterInstanceDigest: deriveLiveWriterInstanceSetDigest(state.registrations),
    operationSetDigest: deriveOperationSetDigest(state.operations),
    unresolvedOperationDigest: deriveUnresolvedOperationDigest(state.operations),
    unresolvedOperationCount,
    registrationCount: state.registrations.length,
    operationCount: state.operations.length,
  });
}

function checkpointContent(record: Omit<RegistrationCheckpointRecord, 'checkpointDigest'>): unknown[] {
  return ['absinthe_writer_checkpoint_v1', record.kind, record.schemaVersion, record.byteFormatVersion,
    record.checkpointKind, record.physicalSourceDigest, record.coordinationEpoch, record.transitionRevision,
    record.authorityState, record.coordinatorSessionId, record.actorKind, record.actorSessionId,
    record.reviewedManifestAuthorityDigest,
    record.stableIdentityDigest, record.liveInstanceDigest, record.operationDigest, record.unresolvedOperationDigest,
    record.registrationCount, record.operationCount,
    record.unresolvedOperationCount, record.previousCheckpointDigest, record.sourceEvidenceDigest,
    record.sourceRevision, record.sourceDigest];
}
function checkpointWithoutDigest(record: RegistrationCheckpointRecord): Omit<RegistrationCheckpointRecord, 'checkpointDigest'> {
  const { checkpointDigest: _ignored, ...content } = record; return content;
}
export function deriveRegistrationCheckpointDigest(
  record: Omit<RegistrationCheckpointRecord, 'checkpointDigest'>,
): string { return digestJson(checkpointContent(record)); }
export function validateRegistrationCheckpoint(value: unknown): value is RegistrationCheckpointRecord {
  if (!exactRecord(value, CHECKPOINT_KEYS)) return false;
  const record = value as unknown as RegistrationCheckpointRecord;
  return record.kind === 'absinthe_writer_registration_checkpoint' && record.schemaVersion === 1
    && record.byteFormatVersion === 1 && CHECKPOINT_KINDS.includes(record.checkpointKind)
    && HASH.test(record.physicalSourceDigest) && safeInteger(record.coordinationEpoch, 1)
    && safeInteger(record.transitionRevision) && COORDINATION_STATES.includes(record.authorityState)
    && SESSION_ID.test(record.coordinatorSessionId)
    && ['coordinator', 'verifier'].includes(record.actorKind) && SESSION_ID.test(record.actorSessionId)
    && HASH.test(record.reviewedManifestAuthorityDigest) && HASH.test(record.stableIdentityDigest)
    && HASH.test(record.liveInstanceDigest) && HASH.test(record.operationDigest)
    && HASH.test(record.unresolvedOperationDigest) && safeInteger(record.registrationCount)
    && safeInteger(record.operationCount) && safeInteger(record.unresolvedOperationCount)
    && (record.previousCheckpointDigest === null || HASH.test(record.previousCheckpointDigest))
    && (record.sourceEvidenceDigest === null || HASH.test(record.sourceEvidenceDigest))
    && (record.sourceRevision === null || SOURCE_REVISION.test(record.sourceRevision))
    && (record.sourceDigest === null || HASH.test(record.sourceDigest))
    && ((record.sourceEvidenceDigest === null && record.sourceRevision === null && record.sourceDigest === null)
      || (record.sourceEvidenceDigest !== null && record.sourceRevision !== null && record.sourceDigest !== null))
    && HASH.test(record.checkpointDigest)
    && record.checkpointDigest === deriveRegistrationCheckpointDigest(checkpointWithoutDigest(record));
}
function orderedCheckpoint(value: RegistrationCheckpointRecord): RegistrationCheckpointRecord {
  return { kind: value.kind, schemaVersion: value.schemaVersion, byteFormatVersion: value.byteFormatVersion,
    checkpointKind: value.checkpointKind, physicalSourceDigest: value.physicalSourceDigest,
    coordinationEpoch: value.coordinationEpoch, transitionRevision: value.transitionRevision,
    authorityState: value.authorityState, coordinatorSessionId: value.coordinatorSessionId,
    actorKind: value.actorKind, actorSessionId: value.actorSessionId,
    reviewedManifestAuthorityDigest: value.reviewedManifestAuthorityDigest,
    stableIdentityDigest: value.stableIdentityDigest, liveInstanceDigest: value.liveInstanceDigest,
    operationDigest: value.operationDigest, unresolvedOperationDigest: value.unresolvedOperationDigest,
    registrationCount: value.registrationCount, operationCount: value.operationCount,
    unresolvedOperationCount: value.unresolvedOperationCount,
    previousCheckpointDigest: value.previousCheckpointDigest, sourceEvidenceDigest: value.sourceEvidenceDigest,
    sourceRevision: value.sourceRevision, sourceDigest: value.sourceDigest,
    checkpointDigest: value.checkpointDigest };
}
export const encodeRegistrationCheckpointCanonical = (value: RegistrationCheckpointRecord): Uint8Array =>
  encodeCanonical(value, validateRegistrationCheckpoint, orderedCheckpoint, WRITER_COORDINATION_LIMITS.checkpointBytes);
export const decodeRegistrationCheckpointCanonical = (bytes: Uint8Array): CanonicalDecodeResult<RegistrationCheckpointRecord> =>
  decodeCanonical(bytes, validateRegistrationCheckpoint, encodeRegistrationCheckpointCanonical,
    WRITER_COORDINATION_LIMITS.checkpointBytes);

function validateSourceObservation(value: unknown): value is SourceVerificationObservation {
  if (!exactRecord(value, SOURCE_OBSERVATION_KEYS)) return false;
  const record = value as unknown as SourceVerificationObservation;
  return HASH.test(record.physicalSourceDigest) && record.sourceType === 'indexeddb'
    && typeof record.ownershipProven === 'boolean' && typeof record.canonical === 'boolean'
    && typeof record.withinBounds === 'boolean' && SOURCE_REVISION.test(record.revisionBefore)
    && HASH.test(record.digestBefore) && SOURCE_REVISION.test(record.revisionAfter) && HASH.test(record.digestAfter)
    && ['indexeddb', 'ambiguous'].includes(record.authoritativeSourceDecision)
    && (record.ambiguityCode === null || WRITER_ELIGIBILITY_ERROR_CODES.includes(record.ambiguityCode))
    && typeof record.k328AdapterAvailable === 'boolean'
    && (record.k328PhysicalSourceDigest === null || HASH.test(record.k328PhysicalSourceDigest));
}
function sourceEvidenceContent(record: Omit<SourceVerificationEvidence, 'evidenceDigest'>): unknown[] {
  return ['absinthe_source_verification_evidence_v1', record.kind, record.schemaVersion, record.byteFormatVersion,
    record.physicalSourceDigest, record.sourceType, record.ownershipProven, record.canonical, record.withinBounds,
    record.revisionBefore, record.digestBefore, record.revisionAfter, record.digestAfter,
    record.authoritativeSourceDecision, record.ambiguityCode, record.k328AdapterAvailable,
    record.k328PhysicalSourceDigest, record.captureActorKind, record.captureActorSessionId,
    record.coordinationEpoch, record.transitionRevision, record.previousCheckpointDigest];
}
function sourceWithoutDigest(record: SourceVerificationEvidence): Omit<SourceVerificationEvidence, 'evidenceDigest'> {
  const { evidenceDigest: _ignored, ...content } = record; return content;
}
export function deriveSourceVerificationEvidenceDigest(
  record: Omit<SourceVerificationEvidence, 'evidenceDigest'>,
): string { return digestJson(sourceEvidenceContent(record)); }
export function validateSourceVerificationEvidence(value: unknown): value is SourceVerificationEvidence {
  if (!exactRecord(value, SOURCE_EVIDENCE_KEYS)) return false;
  const record = value as unknown as SourceVerificationEvidence;
  const observation: SourceVerificationObservation = {
    physicalSourceDigest: record.physicalSourceDigest, sourceType: record.sourceType,
    ownershipProven: record.ownershipProven, canonical: record.canonical, withinBounds: record.withinBounds,
    revisionBefore: record.revisionBefore, digestBefore: record.digestBefore, revisionAfter: record.revisionAfter,
    digestAfter: record.digestAfter, authoritativeSourceDecision: record.authoritativeSourceDecision,
    ambiguityCode: record.ambiguityCode, k328AdapterAvailable: record.k328AdapterAvailable,
    k328PhysicalSourceDigest: record.k328PhysicalSourceDigest,
  };
  return record.kind === 'absinthe_writer_source_verification_evidence' && record.schemaVersion === 1
    && record.byteFormatVersion === 1 && validateSourceObservation(observation)
    && record.captureActorKind === 'verifier' && SESSION_ID.test(record.captureActorSessionId)
    && safeInteger(record.coordinationEpoch, 1) && safeInteger(record.transitionRevision)
    && HASH.test(record.previousCheckpointDigest) && HASH.test(record.evidenceDigest)
    && record.evidenceDigest === deriveSourceVerificationEvidenceDigest(sourceWithoutDigest(record));
}
function orderedSourceEvidence(value: SourceVerificationEvidence): SourceVerificationEvidence {
  return { kind: value.kind, schemaVersion: value.schemaVersion, byteFormatVersion: value.byteFormatVersion,
    physicalSourceDigest: value.physicalSourceDigest, sourceType: value.sourceType,
    ownershipProven: value.ownershipProven, canonical: value.canonical, withinBounds: value.withinBounds,
    revisionBefore: value.revisionBefore, digestBefore: value.digestBefore, revisionAfter: value.revisionAfter,
    digestAfter: value.digestAfter, authoritativeSourceDecision: value.authoritativeSourceDecision,
    ambiguityCode: value.ambiguityCode, k328AdapterAvailable: value.k328AdapterAvailable,
    k328PhysicalSourceDigest: value.k328PhysicalSourceDigest, captureActorKind: value.captureActorKind,
    captureActorSessionId: value.captureActorSessionId, coordinationEpoch: value.coordinationEpoch,
    transitionRevision: value.transitionRevision, previousCheckpointDigest: value.previousCheckpointDigest,
    evidenceDigest: value.evidenceDigest };
}
export const encodeSourceVerificationEvidenceCanonical = (value: SourceVerificationEvidence): Uint8Array =>
  encodeCanonical(value, validateSourceVerificationEvidence, orderedSourceEvidence, WRITER_COORDINATION_LIMITS.sourceEvidenceBytes);
export const decodeSourceVerificationEvidenceCanonical = (bytes: Uint8Array): CanonicalDecodeResult<SourceVerificationEvidence> =>
  decodeCanonical(bytes, validateSourceVerificationEvidence, encodeSourceVerificationEvidenceCanonical,
    WRITER_COORDINATION_LIMITS.sourceEvidenceBytes);

function validateEligibilityEvidence(value: unknown): value is EligibilityEvidenceRecord {
  if (!exactRecord(value, ELIGIBILITY_KEYS)) return false;
  const record = value as unknown as EligibilityEvidenceRecord;
  return record.kind === 'absinthe_writer_eligibility_evidence' && record.schemaVersion === 1
    && record.byteFormatVersion === 1 && record.strategy === WRITER_COORDINATION_STRATEGY
    && HASH.test(record.physicalSourceDigest) && safeInteger(record.coordinationEpoch, 1)
    && record.authoritativeSource === 'indexeddb' && HASH.test(record.reviewedManifestAuthorityDigest)
    && HASH.test(record.finalCheckpointDigest) && HASH.test(record.sourceEvidenceDigest)
    && HASH.test(record.k328PhysicalSourceDigest)
    && HASH.test(record.stableIdentityDigest) && HASH.test(record.liveInstanceDigest)
    && HASH.test(record.operationDigest) && HASH.test(record.unresolvedOperationDigest)
    && safeInteger(record.registrationCount) && safeInteger(record.operationCount)
    && safeInteger(record.unresolvedOperationCount)
    && SOURCE_REVISION.test(record.stableRevision) && HASH.test(record.stableSourceDigest)
    && safeInteger(record.authorityTransitionRevision) && record.result === 'eligible';
}
function orderedEligibility(value: EligibilityEvidenceRecord): EligibilityEvidenceRecord {
  return { kind: value.kind, schemaVersion: value.schemaVersion, byteFormatVersion: value.byteFormatVersion,
    strategy: value.strategy, physicalSourceDigest: value.physicalSourceDigest,
    coordinationEpoch: value.coordinationEpoch, authoritativeSource: value.authoritativeSource,
    reviewedManifestAuthorityDigest: value.reviewedManifestAuthorityDigest,
    finalCheckpointDigest: value.finalCheckpointDigest, sourceEvidenceDigest: value.sourceEvidenceDigest,
    k328PhysicalSourceDigest: value.k328PhysicalSourceDigest,
    stableIdentityDigest: value.stableIdentityDigest, liveInstanceDigest: value.liveInstanceDigest,
    operationDigest: value.operationDigest, unresolvedOperationDigest: value.unresolvedOperationDigest,
    registrationCount: value.registrationCount, operationCount: value.operationCount,
    unresolvedOperationCount: value.unresolvedOperationCount,
    stableRevision: value.stableRevision, stableSourceDigest: value.stableSourceDigest,
    authorityTransitionRevision: value.authorityTransitionRevision, result: value.result };
}
export const encodeEligibilityEvidenceCanonical = (value: EligibilityEvidenceRecord): Uint8Array =>
  encodeCanonical(value, validateEligibilityEvidence, orderedEligibility, WRITER_COORDINATION_LIMITS.eligibilityEvidenceBytes);
export const decodeEligibilityEvidenceCanonical = (bytes: Uint8Array): CanonicalDecodeResult<EligibilityEvidenceRecord> =>
  decodeCanonical(bytes, validateEligibilityEvidence, encodeEligibilityEvidenceCanonical,
    WRITER_COORDINATION_LIMITS.eligibilityEvidenceBytes);

function checkpointChainValid(chain: readonly RegistrationCheckpointRecord[], allowPartial: boolean): boolean {
  if (!Array.isArray(chain) || chain.length > CHECKPOINT_KINDS.length || (!allowPartial && chain.length !== CHECKPOINT_KINDS.length)) return false;
  for (let index = 0; index < chain.length; index += 1) {
    const record = chain[index];
    if (!validateRegistrationCheckpoint(record) || record.checkpointKind !== CHECKPOINT_KINDS[index]
      || record.previousCheckpointDigest !== (index === 0 ? null : chain[index - 1].checkpointDigest)
      || (index > 0 && record.transitionRevision <= chain[index - 1].transitionRevision)) return false;
  }
  return true;
}

function checkpointSemanticsValid(state: WriterCoordinationModelState): boolean {
  const initialEpoch = state.checkpointChain[0]?.coordinationEpoch ?? state.authority.coordinationEpoch;
  if (initialEpoch !== state.authority.coordinationEpoch
    && initialEpoch + 1 !== state.authority.coordinationEpoch) return false;
  const fencedEpoch = initialEpoch + 1 === state.authority.coordinationEpoch;
  for (let index = 0; index < state.checkpointChain.length; index += 1) {
    const checkpoint = state.checkpointChain[index];
    const expectedActor = checkpointActor(checkpoint.checkpointKind);
    const expectedActorSession = expectedActor === 'coordinator'
      ? state.authority.coordinatorSessionId : state.authority.verifierSessionId;
    const expectedEpoch = fencedEpoch && index <= 1 ? initialEpoch : state.authority.coordinationEpoch;
    const source = index >= 4 ? state.sourceEvidence : null;
    if (checkpoint.authorityState !== checkpointState(checkpoint.checkpointKind)
      || checkpoint.coordinatorSessionId !== state.authority.coordinatorSessionId
      || checkpoint.actorKind !== expectedActor || checkpoint.actorSessionId !== expectedActorSession
      || checkpoint.coordinationEpoch !== expectedEpoch
      || checkpoint.reviewedManifestAuthorityDigest !== state.authority.reviewedManifestAuthorityDigest
      || checkpoint.transitionRevision > state.authority.transitionRevision
      || checkpoint.sourceEvidenceDigest !== (source?.evidenceDigest ?? null)
      || checkpoint.sourceRevision !== (source?.revisionAfter ?? null)
      || checkpoint.sourceDigest !== (source?.digestAfter ?? null)) return false;
  }
  return true;
}

function checkpointMatchesGraph(checkpoint: RegistrationCheckpointRecord, graph: CurrentCoordinationGraph): boolean {
  return checkpoint.stableIdentityDigest === graph.stableWriterIdentityDigest
    && checkpoint.liveInstanceDigest === graph.liveWriterInstanceDigest
    && checkpoint.operationDigest === graph.operationSetDigest
    && checkpoint.unresolvedOperationDigest === graph.unresolvedOperationDigest
    && checkpoint.registrationCount === graph.registrationCount
    && checkpoint.operationCount === graph.operationCount
    && checkpoint.unresolvedOperationCount === graph.unresolvedOperationCount;
}

function protectedCheckpointGraphValid(state: WriterCoordinationModelState, graph: CurrentCoordinationGraph): boolean {
  if (state.checkpointChain.length < 3) return true;
  const protectedCheckpoint = state.checkpointChain[2];
  if (protectedCheckpoint.unresolvedOperationCount !== 0
    || protectedCheckpoint.unresolvedOperationDigest !== ZERO_UNRESOLVED_OPERATION_DIGEST) return false;
  for (const checkpoint of state.checkpointChain.slice(3)) {
    if (!checkpointMatchesGraph(checkpoint, {
      stableWriterIdentityDigest: protectedCheckpoint.stableIdentityDigest,
      liveWriterInstanceDigest: protectedCheckpoint.liveInstanceDigest,
      operationSetDigest: protectedCheckpoint.operationDigest,
      unresolvedOperationDigest: protectedCheckpoint.unresolvedOperationDigest,
      unresolvedOperationCount: protectedCheckpoint.unresolvedOperationCount,
      registrationCount: protectedCheckpoint.registrationCount,
      operationCount: protectedCheckpoint.operationCount,
    })) return false;
  }
  return checkpointMatchesGraph(state.checkpointChain[state.checkpointChain.length - 1], graph);
}

function sourceEvidenceRelationError(state: WriterCoordinationModelState): WriterEligibilityErrorCode | null {
  const source = state.sourceEvidence;
  if (!source) {
    return state.checkpointChain.length >= 5 ? 'SOURCE_EVIDENCE_CHECKPOINT_MISMATCH' : null;
  }
  if (!validateSourceVerificationEvidence(source) || state.checkpointChain.length < 5) {
    return 'SOURCE_EVIDENCE_CHECKPOINT_MISMATCH';
  }
  const predecessor = state.checkpointChain[3];
  if (predecessor.checkpointKind !== 'BEFORE_SOURCE_VERIFICATION'
    || source.previousCheckpointDigest !== predecessor.checkpointDigest
    || source.physicalSourceDigest !== state.authority.physicalSourceDigest
    || source.captureActorSessionId !== state.authority.verifierSessionId
    || source.coordinationEpoch !== state.authority.coordinationEpoch) {
    return 'SOURCE_EVIDENCE_CHECKPOINT_MISMATCH';
  }
  if ((source.authoritativeSourceDecision === 'indexeddb') !== (source.ambiguityCode === null)) {
    return 'SOURCE_EVIDENCE_LIFECYCLE_MISMATCH';
  }
  if (source.k328AdapterAvailable && source.k328PhysicalSourceDigest !== state.authority.physicalSourceDigest) {
    return 'SOURCE_EVIDENCE_CHECKPOINT_MISMATCH';
  }
  const postEvidenceCheckpoints = state.checkpointChain.length - 4;
  const expectedRevision = source.transitionRevision + postEvidenceCheckpoints;
  if (state.authority.state === 'VERIFYING_SOURCE') {
    if (state.authority.transitionRevision !== expectedRevision) return 'SOURCE_EVIDENCE_LIFECYCLE_MISMATCH';
  } else if (state.authority.state === 'ELIGIBLE') {
    if (state.checkpointChain.length !== 6 || state.authority.transitionRevision !== source.transitionRevision + 3) {
      return 'SOURCE_EVIDENCE_LIFECYCLE_MISMATCH';
    }
  } else if (state.authority.state === 'ABORTED' || state.authority.state === 'FAILED') {
    if (state.authority.transitionRevision !== expectedRevision + 1) return 'SOURCE_EVIDENCE_LIFECYCLE_MISMATCH';
  } else return 'SOURCE_EVIDENCE_LIFECYCLE_MISMATCH';
  for (const checkpoint of state.checkpointChain.slice(4)) {
    if (checkpoint.sourceEvidenceDigest !== source.evidenceDigest
      || checkpoint.sourceRevision !== source.revisionAfter || checkpoint.sourceDigest !== source.digestAfter) {
      return 'SOURCE_EVIDENCE_CHECKPOINT_MISMATCH';
    }
  }
  return null;
}

function eligibilityEvidenceRelationError(state: WriterCoordinationModelState,
  graph: CurrentCoordinationGraph): WriterEligibilityErrorCode | null {
  const evidence = state.eligibilityEvidence;
  if (!evidence) return state.authority.state === 'ELIGIBLE' ? 'ELIGIBILITY_EVIDENCE_RELATION_MISMATCH' : null;
  const source = state.sourceEvidence; const final = state.checkpointChain[5];
  if (state.authority.state !== 'ELIGIBLE' || !source || !final || state.checkpointChain.length !== 6
    || evidence.physicalSourceDigest !== state.authority.physicalSourceDigest
    || evidence.coordinationEpoch !== state.authority.coordinationEpoch
    || evidence.reviewedManifestAuthorityDigest !== state.authority.reviewedManifestAuthorityDigest
    || evidence.finalCheckpointDigest !== final.checkpointDigest
    || evidence.sourceEvidenceDigest !== source.evidenceDigest
    || evidence.k328PhysicalSourceDigest !== source.k328PhysicalSourceDigest
    || evidence.stableRevision !== source.revisionAfter || evidence.stableSourceDigest !== source.digestAfter
    || evidence.authorityTransitionRevision !== state.authority.transitionRevision
    || evidence.stableIdentityDigest !== graph.stableWriterIdentityDigest
    || evidence.liveInstanceDigest !== graph.liveWriterInstanceDigest
    || evidence.operationDigest !== graph.operationSetDigest
    || evidence.unresolvedOperationDigest !== graph.unresolvedOperationDigest
    || evidence.registrationCount !== graph.registrationCount || evidence.operationCount !== graph.operationCount
    || evidence.unresolvedOperationCount !== graph.unresolvedOperationCount) {
    return 'ELIGIBILITY_EVIDENCE_RELATION_MISMATCH';
  }
  return sourceEvidenceError(source, state) === null ? null : 'ELIGIBILITY_EVIDENCE_RELATION_MISMATCH';
}

/** Deterministic cross-record validation order used by encoding, decoding, reducer entry, and commit. */
export function validateWriterCoordinationModelRelations(state: WriterCoordinationModelState): WriterEligibilityErrorCode | null {
  const operationError = operationRegistrationRelationError(state); if (operationError) return operationError;
  const registrationError = registrationOperationRelationError(state); if (registrationError) return registrationError;
  let graph: CurrentCoordinationGraph;
  try { graph = deriveCurrentCoordinationGraph(state); }
  catch (error) {
    return error instanceof Error && WRITER_ELIGIBILITY_ERROR_CODES.includes(error.message as WriterEligibilityErrorCode)
      ? error.message as WriterEligibilityErrorCode : 'ELIGIBILITY_EVIDENCE_CORRUPT';
  }
  if (state.authority.unresolvedOperationCount !== graph.unresolvedOperationCount) {
    return 'CURRENT_GRAPH_CHECKPOINT_MISMATCH';
  }
  if (!protectedCheckpointGraphValid(state, graph)) return 'CURRENT_GRAPH_CHECKPOINT_MISMATCH';
  const sourceError = sourceEvidenceRelationError(state); if (sourceError) return sourceError;
  return eligibilityEvidenceRelationError(state, graph);
}

function validateManifestCoverage(state: WriterCoordinationModelState, final: boolean): WriterEligibilityErrorCode | null {
  const manifest = new Map(state.reviewedManifest.entries.map(entry => [entry.writerTypeId, entry]));
  for (const record of state.registrations) {
    const entry = manifest.get(record.writerTypeId);
    if (!entry) return 'UNKNOWN_WRITER_PRESENT';
    if (!entry.contextTypes.includes(record.contextType)
      || entry.requiredCapabilities.some(capability => !record.capabilities.includes(capability))) return 'WRITER_NOT_COORDINATED';
  }
  for (const entry of state.reviewedManifest.entries) {
    const records = state.registrations.filter(record => record.writerTypeId === entry.writerTypeId);
    if (entry.coordinationRequirement === 'must_participate' && records.length === 0) return 'WRITER_INVENTORY_INCOMPLETE';
    if (entry.coordinationRequirement !== 'must_participate'
      && records.some(record => record.registrationState !== 'disabled')) return 'WRITER_NOT_COORDINATED';
    if (final && entry.coordinationRequirement === 'must_participate') {
      const drainRevision = state.authority.drainRequestTransitionRevision;
      if (drainRevision === null || records.some(record => record.registrationState !== 'drain_acknowledged'
        || !record.coordinated || record.acknowledgedDrainRevision !== drainRevision)) return 'DRAIN_ACKNOWLEDGEMENT_INVALID';
    }
  }
  return null;
}

export function validateWriterCoordinationModelState(value: unknown): value is WriterCoordinationModelState {
  if (!exactRecord(value, MODEL_KEYS)) return false;
  const state = value as unknown as WriterCoordinationModelState;
  if (state.kind !== 'absinthe_writer_coordination_model' || state.schemaVersion !== 1 || state.byteFormatVersion !== 1
    || !validateCoordinationAuthority(state.authority)
    || !trustedManifestPair(state.reviewedManifestAuthority, state.reviewedManifest)
    || state.authority.physicalSourceDigest !== state.reviewedManifestAuthority.physicalSourceDigest
    || state.authority.reviewedManifestAuthorityDigest !== deriveReviewedManifestAuthorityDigest(state.reviewedManifestAuthority)
    || !validRegistrationSet(state.registrations, true) || !validOperationSet(state.operations)
    || state.registrations.some(record => record.physicalSourceDigest !== state.authority.physicalSourceDigest)
    || state.operations.some(record => record.physicalSourceDigest !== state.authority.physicalSourceDigest)
    || !checkpointChainValid(state.checkpointChain, true)
    || state.checkpointChain.some(record => record.physicalSourceDigest !== state.authority.physicalSourceDigest
      || record.reviewedManifestAuthorityDigest !== state.authority.reviewedManifestAuthorityDigest)
    || !checkpointSemanticsValid(state)
    || (state.sourceEvidence !== null && !validateSourceVerificationEvidence(state.sourceEvidence))
    || (state.eligibilityEvidence !== null && !validateEligibilityEvidence(state.eligibilityEvidence))) return false;
  return validateWriterCoordinationModelRelations(state) === null;
}

function orderedModel(value: WriterCoordinationModelState): WriterCoordinationModelState {
  return { kind: value.kind, schemaVersion: value.schemaVersion, byteFormatVersion: value.byteFormatVersion,
    authority: orderedAuthority(value.authority), reviewedManifestAuthority: orderedManifestAuthority(value.reviewedManifestAuthority),
    reviewedManifest: orderedManifest(value.reviewedManifest),
    registrations: [...value.registrations].sort((a, b) => registrationIdentity(a) < registrationIdentity(b) ? -1 : 1)
      .map(orderedRegistration),
    operations: [...value.operations].sort((a, b) => a.operationId < b.operationId ? -1 : 1).map(orderedOperation),
    checkpointChain: value.checkpointChain.map(orderedCheckpoint),
    sourceEvidence: value.sourceEvidence ? orderedSourceEvidence(value.sourceEvidence) : null,
    eligibilityEvidence: value.eligibilityEvidence ? orderedEligibility(value.eligibilityEvidence) : null };
}
export const encodeWriterCoordinationModelCanonical = (value: WriterCoordinationModelState): Uint8Array =>
  encodeCanonical(value, validateWriterCoordinationModelState, orderedModel, WRITER_COORDINATION_LIMITS.modelBytes);
export const decodeWriterCoordinationModelCanonical = (bytes: Uint8Array): CanonicalDecodeResult<WriterCoordinationModelState> =>
  decodeCanonical(bytes, validateWriterCoordinationModelState, encodeWriterCoordinationModelCanonical,
    WRITER_COORDINATION_LIMITS.modelBytes);

export function createWriterCoordinationModel(input: {
  physicalSourceDigest: string;
  coordinatorSessionId: string;
  verifierSessionId: string;
  recoverySessionId: string;
}): WriterCoordinationModelState {
  if (!HASH.test(input.physicalSourceDigest) || !SESSION_ID.test(input.coordinatorSessionId)
    || !SESSION_ID.test(input.verifierSessionId) || !SESSION_ID.test(input.recoverySessionId)) {
    throw new Error('ELIGIBILITY_EVIDENCE_CORRUPT');
  }
  const reviewedManifest = createK329BReviewedWriterManifest(input.physicalSourceDigest);
  const reviewedManifestAuthority = createK329BReviewedManifestAuthority(input.physicalSourceDigest);
  const authority: CoordinationAuthorityRecord = {
    kind: 'absinthe_writer_coordination_authority', schemaVersion: 1, byteFormatVersion: 1,
    physicalSourceDigest: input.physicalSourceDigest, coordinationEpoch: 1, state: 'OPEN',
    coordinatorSessionId: input.coordinatorSessionId, verifierSessionId: input.verifierSessionId,
    recoverySessionId: input.recoverySessionId,
    reviewedManifestAuthorityDigest: deriveReviewedManifestAuthorityDigest(reviewedManifestAuthority),
    admissionOpen: true, unresolvedOperationCount: 0, drainRequestTransitionRevision: null,
    transitionRevision: 0, createdSequence: 0, updatedSequence: 0, failureCode: null,
  };
  return { kind: 'absinthe_writer_coordination_model', schemaVersion: 1, byteFormatVersion: 1,
    authority, reviewedManifestAuthority, reviewedManifest, registrations: [], operations: [], checkpointChain: [],
    sourceEvidence: null, eligibilityEvidence: null };
}

function nextAuthority(authority: CoordinationAuthorityRecord, patch: Partial<CoordinationAuthorityRecord>): CoordinationAuthorityRecord {
  return { ...authority, ...patch, transitionRevision: authority.transitionRevision + 1,
    updatedSequence: authority.updatedSequence + 1 };
}
function withState(state: WriterCoordinationModelState, patch: Partial<WriterCoordinationModelState>): WriterCoordinationModelState {
  return { ...state, ...patch };
}
function actorMatchesAuthority(state: WriterCoordinationModelState, actor: WriterCoordinationActor): boolean {
  if (actor.kind === 'coordinator') return actor.sessionId === state.authority.coordinatorSessionId;
  if (actor.kind === 'verifier') return actor.sessionId === state.authority.verifierSessionId;
  if (actor.kind === 'recovery') return actor.sessionId === state.authority.recoverySessionId;
  const writer = actor as Extract<WriterCoordinationActor, { kind: 'writer' }>;
  return state.registrations.some(record => record.writerId === writer.writerId && record.sessionId === writer.sessionId);
}
function validActor(value: unknown): value is WriterCoordinationActor {
  if (!value || typeof value !== 'object') return false;
  const kind = (value as { kind?: unknown }).kind;
  if (kind === 'writer') return exactRecord(value, ['kind', 'writerId', 'sessionId'])
    && WRITER_ID.test((value as { writerId: string }).writerId) && SESSION_ID.test((value as { sessionId: string }).sessionId);
  return ['coordinator', 'verifier', 'recovery'].includes(String(kind))
    && exactRecord(value, ['kind', 'sessionId']) && SESSION_ID.test((value as { sessionId: string }).sessionId);
}

const BASE_ACTION_KEYS = ['type', 'actor', 'expectedTransitionRevision', 'expectedCoordinationEpoch', 'expectedAuthorityDigest'];
const ACTION_EXTRA_KEYS: Readonly<Record<WriterCoordinationAction['type'], readonly string[]>> = {
  REGISTER_WRITER: ['registration'], CAPTURE_BEFORE_DRAIN: [], REQUEST_DRAIN: [],
  ACKNOWLEDGE_DRAIN: ['writerId', 'drainRequestTransitionRevision'], CLOSE_ADMISSION: [],
  CAPTURE_AFTER_ADMISSION_CLOSED: [], BEGIN_DRAIN: [], ADMIT_OPERATION: ['operation'],
  TERMINALIZE_OPERATION: ['operationId', 'result', 'committedSourceRevision'], MARK_QUIESCENT: [],
  CAPTURE_AFTER_OPERATIONS_TERMINAL: [], CAPTURE_BEFORE_SOURCE_VERIFICATION: [],
  BEGIN_SOURCE_VERIFICATION: [], CAPTURE_SOURCE_EVIDENCE: ['observation'],
  CAPTURE_AFTER_SOURCE_VERIFICATION: [], CAPTURE_BEFORE_ELIGIBILITY_COMMIT: [],
  COMMIT_ELIGIBILITY: ['expectedFinalCheckpointDigest'], ABORT: ['failureCode'],
};
function validateActionShape(value: unknown): value is WriterCoordinationAction {
  if (!value || typeof value !== 'object') return false;
  const type = (value as { type?: unknown }).type;
  if (typeof type !== 'string' || !(type in ACTION_EXTRA_KEYS)
    || !exactRecord(value, [...BASE_ACTION_KEYS, ...ACTION_EXTRA_KEYS[type as WriterCoordinationAction['type']]])) return false;
  const action = value as unknown as WriterCoordinationAction;
  if (!validActor(action.actor) || !safeInteger(action.expectedTransitionRevision)
    || !safeInteger(action.expectedCoordinationEpoch, 1) || !HASH.test(action.expectedAuthorityDigest)) return false;
  if (action.type === 'REGISTER_WRITER') return validateWriterRegistration(action.registration);
  if (action.type === 'ADMIT_OPERATION') return validateAdmissionOperation(action.operation);
  if (action.type === 'CAPTURE_SOURCE_EVIDENCE') return validateSourceObservation(action.observation);
  if (action.type === 'ACKNOWLEDGE_DRAIN') return WRITER_ID.test(action.writerId)
    && safeInteger(action.drainRequestTransitionRevision);
  if (action.type === 'TERMINALIZE_OPERATION') return OPERATION_ID.test(action.operationId)
    && ['committed', 'aborted', 'failed'].includes(action.result)
    && (action.committedSourceRevision === null || SOURCE_REVISION.test(action.committedSourceRevision));
  if (action.type === 'COMMIT_ELIGIBILITY') return HASH.test(action.expectedFinalCheckpointDigest);
  if (action.type === 'ABORT') return action.failureCode === null || WRITER_ELIGIBILITY_ERROR_CODES.includes(action.failureCode);
  return true;
}

function roleAllowed(action: WriterCoordinationAction): boolean {
  const role = action.actor.kind;
  switch (action.type) {
    case 'REGISTER_WRITER': case 'ACKNOWLEDGE_DRAIN': case 'ADMIT_OPERATION': case 'TERMINALIZE_OPERATION':
      return role === 'writer';
    case 'CAPTURE_BEFORE_DRAIN': case 'REQUEST_DRAIN': case 'CLOSE_ADMISSION':
    case 'CAPTURE_AFTER_ADMISSION_CLOSED': case 'BEGIN_DRAIN': case 'MARK_QUIESCENT':
    case 'CAPTURE_AFTER_OPERATIONS_TERMINAL':
      return role === 'coordinator';
    case 'CAPTURE_BEFORE_SOURCE_VERIFICATION': case 'BEGIN_SOURCE_VERIFICATION':
    case 'CAPTURE_SOURCE_EVIDENCE': case 'CAPTURE_AFTER_SOURCE_VERIFICATION':
    case 'CAPTURE_BEFORE_ELIGIBILITY_COMMIT': case 'COMMIT_ELIGIBILITY':
      return role === 'verifier';
    case 'ABORT': return role === 'coordinator' || role === 'verifier' || role === 'recovery';
  }
}

function checkpointActor(kind: CheckpointKind): 'coordinator' | 'verifier' {
  return CHECKPOINT_KINDS.indexOf(kind) <= 2 ? 'coordinator' : 'verifier';
}
function checkpointState(kind: CheckpointKind): CoordinationState {
  if (kind === 'BEFORE_DRAIN') return 'OPEN';
  if (kind === 'AFTER_ADMISSION_CLOSED') return 'ADMISSION_CLOSED';
  if (kind === 'AFTER_OPERATIONS_TERMINAL' || kind === 'BEFORE_SOURCE_VERIFICATION') return 'QUIESCENT_CANDIDATE';
  return 'VERIFYING_SOURCE';
}
function appendCheckpoint(state: WriterCoordinationModelState, actor: WriterCoordinationActor,
  kind: CheckpointKind): WriterCoordinationReduction {
  const expectedIndex = state.checkpointChain.length;
  if (CHECKPOINT_KINDS[expectedIndex] !== kind || state.authority.state !== checkpointState(kind)
    || actor.kind !== checkpointActor(kind)) return { ok: false, code: 'CHECKPOINT_CHAIN_INVALID' };
  const sourceEvidenceDigest = expectedIndex >= 4 ? state.sourceEvidence?.evidenceDigest ?? null : null;
  if (expectedIndex >= 4 && sourceEvidenceDigest === null) return { ok: false, code: 'SOURCE_EVIDENCE_MISSING' };
  if (expectedIndex >= 4 && state.sourceEvidence
    && state.sourceEvidence.coordinationEpoch !== state.authority.coordinationEpoch) {
    return { ok: false, code: 'COORDINATION_EPOCH_STALE' };
  }
  let graph: CurrentCoordinationGraph;
  try {
    graph = deriveCurrentCoordinationGraph(state);
  } catch { return { ok: false, code: 'WRITER_REGISTRATION_MALFORMED' }; }
  const authority = nextAuthority(state.authority, {});
  const content: Omit<RegistrationCheckpointRecord, 'checkpointDigest'> = {
    kind: 'absinthe_writer_registration_checkpoint', schemaVersion: 1, byteFormatVersion: 1,
    checkpointKind: kind, physicalSourceDigest: authority.physicalSourceDigest,
    coordinationEpoch: authority.coordinationEpoch, transitionRevision: authority.transitionRevision,
    authorityState: authority.state, coordinatorSessionId: authority.coordinatorSessionId,
    actorKind: actor.kind, actorSessionId: actor.sessionId,
    reviewedManifestAuthorityDigest: authority.reviewedManifestAuthorityDigest,
    stableIdentityDigest: graph.stableWriterIdentityDigest, liveInstanceDigest: graph.liveWriterInstanceDigest,
    operationDigest: graph.operationSetDigest, unresolvedOperationDigest: graph.unresolvedOperationDigest,
    registrationCount: graph.registrationCount, operationCount: graph.operationCount,
    unresolvedOperationCount: graph.unresolvedOperationCount,
    previousCheckpointDigest: expectedIndex === 0 ? null : state.checkpointChain[expectedIndex - 1].checkpointDigest,
    sourceEvidenceDigest,
    sourceRevision: expectedIndex >= 4 ? state.sourceEvidence?.revisionAfter ?? null : null,
    sourceDigest: expectedIndex >= 4 ? state.sourceEvidence?.digestAfter ?? null : null,
  };
  const checkpoint: RegistrationCheckpointRecord = { ...content, checkpointDigest: deriveRegistrationCheckpointDigest(content) };
  return { ok: true, state: withState(state, { authority, checkpointChain: [...state.checkpointChain, checkpoint] }) };
}

function sourceEvidenceError(record: SourceVerificationEvidence, state: WriterCoordinationModelState): WriterEligibilityErrorCode | null {
  if (record.captureActorSessionId !== state.authority.verifierSessionId) return 'ACTOR_UNAUTHORIZED';
  if (record.coordinationEpoch !== state.authority.coordinationEpoch) return 'COORDINATION_EPOCH_STALE';
  if (record.transitionRevision > state.authority.transitionRevision
    || record.previousCheckpointDigest !== state.checkpointChain[3]?.checkpointDigest) return 'SOURCE_EVIDENCE_INVALID';
  if (record.physicalSourceDigest !== state.authority.physicalSourceDigest
    || record.k328PhysicalSourceDigest !== state.authority.physicalSourceDigest) return 'K328_PHYSICAL_IDENTITY_MISMATCH';
  if (!record.k328AdapterAvailable) return 'K328_ADAPTER_UNAVAILABLE';
  if (record.authoritativeSourceDecision !== 'indexeddb' || record.ambiguityCode !== null) {
    return record.ambiguityCode ?? 'AUTHORITATIVE_SOURCE_AMBIGUOUS';
  }
  if (!record.ownershipProven) return 'SOURCE_OWNERSHIP_UNPROVEN';
  if (!record.canonical) return 'SOURCE_MALFORMED';
  if (!record.withinBounds) return 'SOURCE_RESOURCE_BOUND_EXCEEDED';
  if (record.revisionBefore !== record.revisionAfter) return 'SOURCE_REVISION_UNSTABLE';
  if (record.digestBefore !== record.digestAfter) return 'SOURCE_CHANGED_DURING_VERIFICATION';
  return null;
}

function eligibilityFromDurableState(state: WriterCoordinationModelState):
  | { ok: true; evidence: EligibilityEvidenceRecord }
  | { ok: false; code: WriterEligibilityErrorCode } {
  if (!trustedManifestPair(state.reviewedManifestAuthority, state.reviewedManifest)
    || state.authority.reviewedManifestAuthorityDigest !== deriveReviewedManifestAuthorityDigest(state.reviewedManifestAuthority)) {
    return { ok: false, code: 'REVIEWED_MANIFEST_AUTHORITY_MISMATCH' };
  }
  if (!checkpointChainValid(state.checkpointChain, false)) return { ok: false, code: 'CHECKPOINT_CHAIN_INVALID' };
  const relationError = validateWriterCoordinationModelRelations(state);
  if (relationError) return { ok: false, code: relationError };
  let currentGraph: CurrentCoordinationGraph;
  try { currentGraph = deriveCurrentCoordinationGraph(state); }
  catch { return { ok: false, code: 'CURRENT_GRAPH_CHECKPOINT_MISMATCH' }; }
  for (let index = 0; index < state.checkpointChain.length; index += 1) {
    const checkpoint = state.checkpointChain[index];
    const expectedActor = checkpointActor(checkpoint.checkpointKind);
    const expectedSession = expectedActor === 'coordinator'
      ? state.authority.coordinatorSessionId : state.authority.verifierSessionId;
    const expectedEpoch = index <= 1 ? state.checkpointChain[0].coordinationEpoch : state.authority.coordinationEpoch;
    if (checkpoint.actorKind !== expectedActor || checkpoint.actorSessionId !== expectedSession
      || checkpoint.authorityState !== checkpointState(checkpoint.checkpointKind)
      || checkpoint.coordinationEpoch !== expectedEpoch
      || checkpoint.reviewedManifestAuthorityDigest !== state.authority.reviewedManifestAuthorityDigest
      || checkpoint.transitionRevision > state.authority.transitionRevision) {
      return { ok: false, code: 'CHECKPOINT_CHAIN_INVALID' };
    }
  }
  if (!protectedCheckpointGraphValid(state, currentGraph)
    || !checkpointMatchesGraph(state.checkpointChain[5], currentGraph)) {
    return { ok: false, code: 'CURRENT_GRAPH_CHECKPOINT_MISMATCH' };
  }
  const source = state.sourceEvidence;
  if (!source) return { ok: false, code: 'SOURCE_EVIDENCE_MISSING' };
  const sourceError = sourceEvidenceError(source, state); if (sourceError) return { ok: false, code: sourceError };
  if (state.checkpointChain[4].sourceEvidenceDigest !== source.evidenceDigest
    || state.checkpointChain[5].sourceEvidenceDigest !== source.evidenceDigest
    || source.previousCheckpointDigest !== state.checkpointChain[3].checkpointDigest) {
    return { ok: false, code: 'CHECKPOINT_CHAIN_INVALID' };
  }
  const coverage = validateManifestCoverage(state, true); if (coverage) return { ok: false, code: coverage };
  if (state.authority.state !== 'VERIFYING_SOURCE' || state.authority.admissionOpen) return { ok: false, code: 'ADMISSION_NOT_CLOSED' };
  if (currentGraph.unresolvedOperationCount !== 0
    || currentGraph.unresolvedOperationDigest !== ZERO_UNRESOLVED_OPERATION_DIGEST
    || state.authority.unresolvedOperationCount !== 0 || state.operations.some(operation => operation.state === 'admitted')) {
    return { ok: false, code: 'IN_FLIGHT_WRITE_PRESENT' };
  }
  const final = state.checkpointChain[5];
  const nextRevision = state.authority.transitionRevision + 1;
  return { ok: true, evidence: {
    kind: 'absinthe_writer_eligibility_evidence', schemaVersion: 1, byteFormatVersion: 1,
    strategy: WRITER_COORDINATION_STRATEGY, physicalSourceDigest: state.authority.physicalSourceDigest,
    coordinationEpoch: state.authority.coordinationEpoch, authoritativeSource: 'indexeddb',
    reviewedManifestAuthorityDigest: state.authority.reviewedManifestAuthorityDigest,
    finalCheckpointDigest: final.checkpointDigest, sourceEvidenceDigest: source.evidenceDigest,
    k328PhysicalSourceDigest: source.k328PhysicalSourceDigest!,
    stableIdentityDigest: currentGraph.stableWriterIdentityDigest,
    liveInstanceDigest: currentGraph.liveWriterInstanceDigest,
    operationDigest: currentGraph.operationSetDigest,
    unresolvedOperationDigest: currentGraph.unresolvedOperationDigest,
    registrationCount: currentGraph.registrationCount, operationCount: currentGraph.operationCount,
    unresolvedOperationCount: currentGraph.unresolvedOperationCount,
    stableRevision: source.revisionAfter, stableSourceDigest: source.digestAfter,
    authorityTransitionRevision: nextRevision, result: 'eligible',
  } };
}

/** Pure reducer. A future storage layer must CAS the canonical model bytes; K-329C does not persist them. */
export function reduceWriterCoordination(state: WriterCoordinationModelState,
  action: WriterCoordinationAction): WriterCoordinationReduction {
  if (state && typeof state === 'object'
    && (!trustedManifestPair(state.reviewedManifestAuthority, state.reviewedManifest)
      || state.authority?.reviewedManifestAuthorityDigest
        !== deriveReviewedManifestAuthorityDigest(state.reviewedManifestAuthority))) {
    return { ok: false, code: 'REVIEWED_MANIFEST_AUTHORITY_MISMATCH' };
  }
  if (state && typeof state === 'object' && Array.isArray(state.checkpointChain)
    && !checkpointChainValid(state.checkpointChain, true)) {
    return { ok: false, code: 'CHECKPOINT_CHAIN_INVALID' };
  }
  if (state && typeof state === 'object' && state.sourceEvidence && state.authority
    && state.sourceEvidence.coordinationEpoch !== state.authority.coordinationEpoch) {
    return { ok: false, code: 'COORDINATION_EPOCH_STALE' };
  }
  if (state && typeof state === 'object' && Array.isArray(state.checkpointChain)
    && state.authority && !checkpointSemanticsValid(state)) {
    return { ok: false, code: 'CHECKPOINT_CHAIN_INVALID' };
  }
  if (state && typeof state === 'object' && state.authority && state.reviewedManifest
    && Array.isArray(state.registrations) && Array.isArray(state.operations) && Array.isArray(state.checkpointChain)) {
    const relationError = validateWriterCoordinationModelRelations(state);
    if (relationError) return { ok: false, code: relationError };
  }
  if (!validateWriterCoordinationModelState(state)) return { ok: false, code: 'ELIGIBILITY_EVIDENCE_CORRUPT' };
  if (!validateActionShape(action)) return { ok: false, code: 'ELIGIBILITY_EVIDENCE_CORRUPT' };
  if (action.expectedTransitionRevision !== state.authority.transitionRevision
    || action.expectedAuthorityDigest !== deriveCoordinationAuthorityDigest(state.authority)) {
    return { ok: false, code: 'TRANSITION_REVISION_STALE' };
  }
  if (action.expectedCoordinationEpoch !== state.authority.coordinationEpoch) {
    return { ok: false, code: 'COORDINATION_EPOCH_STALE' };
  }
  if (!roleAllowed(action) || (action.type !== 'REGISTER_WRITER' && !actorMatchesAuthority(state, action.actor))) {
    return { ok: false, code: 'ACTOR_UNAUTHORIZED' };
  }

  switch (action.type) {
    case 'REGISTER_WRITER': {
      if (state.authority.state !== 'OPEN' || !state.authority.admissionOpen) return { ok: false, code: 'ADMISSION_NOT_CLOSED' };
      if (action.actor.kind !== 'writer' || action.actor.writerId !== action.registration.writerId
        || action.actor.sessionId !== action.registration.sessionId) return { ok: false, code: 'ACTOR_UNAUTHORIZED' };
      const record = action.registration;
      if (record.registrationState !== 'registered' || record.coordinated || record.acknowledgedDrainRevision !== null
        || record.latestOperationId !== null) return { ok: false, code: 'REGISTRATION_INITIAL_STATE_INVALID' };
      if (record.physicalSourceDigest !== state.authority.physicalSourceDigest
        || record.coordinationEpoch !== state.authority.coordinationEpoch) return { ok: false, code: 'COORDINATION_EPOCH_STALE' };
      const manifest = state.reviewedManifest.entries.find(entry => entry.writerTypeId === record.writerTypeId);
      if (!manifest) return { ok: false, code: 'UNKNOWN_WRITER_PRESENT' };
      if (manifest.coordinationRequirement !== 'must_participate'
        || !manifest.contextTypes.includes(record.contextType)
        || manifest.requiredCapabilities.some(capability => !record.capabilities.includes(capability))) {
        return { ok: false, code: 'WRITER_NOT_COORDINATED' };
      }
      if (state.registrations.some(existing => existing.writerId === record.writerId || existing.sessionId === record.sessionId)) {
        return { ok: false, code: 'DUPLICATE_WRITER_IDENTITY' };
      }
      return { ok: true, state: withState(state, { authority: nextAuthority(state.authority, {}),
        registrations: [...state.registrations, record] }) };
    }
    case 'CAPTURE_BEFORE_DRAIN': {
      const coverage = validateManifestCoverage(state, false); if (coverage) return { ok: false, code: coverage };
      return appendCheckpoint(state, action.actor, 'BEFORE_DRAIN');
    }
    case 'REQUEST_DRAIN': {
      if (state.authority.state !== 'OPEN' || state.checkpointChain.length !== 1) return { ok: false, code: 'CHECKPOINT_CHAIN_INVALID' };
      const revision = state.authority.transitionRevision + 1;
      return { ok: true, state: withState(state, { authority: nextAuthority(state.authority,
        { state: 'DRAIN_REQUESTED', admissionOpen: false, drainRequestTransitionRevision: revision }) }) };
    }
    case 'ACKNOWLEDGE_DRAIN': {
      if (state.authority.state !== 'DRAIN_REQUESTED' || state.authority.drainRequestTransitionRevision === null
        || action.drainRequestTransitionRevision !== state.authority.drainRequestTransitionRevision) {
        return { ok: false, code: 'DRAIN_ACKNOWLEDGEMENT_INVALID' };
      }
      if (action.actor.kind !== 'writer' || action.actor.writerId !== action.writerId) return { ok: false, code: 'ACTOR_UNAUTHORIZED' };
      const index = state.registrations.findIndex(record => record.writerId === action.writerId
        && record.sessionId === action.actor.sessionId);
      if (index < 0 || state.registrations[index].registrationState !== 'registered'
        || state.operations.some(operation => operation.writerId === action.writerId && operation.state === 'admitted')) {
        return { ok: false, code: 'DRAIN_ACKNOWLEDGEMENT_INVALID' };
      }
      const registrations = [...state.registrations];
      registrations[index] = { ...registrations[index], registrationState: 'drain_acknowledged', coordinated: true,
        acknowledgedDrainRevision: action.drainRequestTransitionRevision,
        lastSeenSequence: registrations[index].lastSeenSequence + 1 };
      return { ok: true, state: withState(state, { authority: nextAuthority(state.authority, {}), registrations }) };
    }
    case 'CLOSE_ADMISSION': {
      if (state.authority.state !== 'DRAIN_REQUESTED') return { ok: false, code: 'ADMISSION_NOT_CLOSED' };
      const coverage = validateManifestCoverage(state, true); if (coverage) return { ok: false, code: coverage };
      return { ok: true, state: withState(state, { authority: nextAuthority(state.authority,
        { state: 'ADMISSION_CLOSED', admissionOpen: false }) }) };
    }
    case 'CAPTURE_AFTER_ADMISSION_CLOSED':
      return appendCheckpoint(state, action.actor, 'AFTER_ADMISSION_CLOSED');
    case 'BEGIN_DRAIN':
      if (state.authority.state !== 'ADMISSION_CLOSED' || state.checkpointChain.length !== 2) {
        return { ok: false, code: 'CHECKPOINT_CHAIN_INVALID' };
      }
      return { ok: true, state: withState(state, { authority: nextAuthority(state.authority,
        { state: 'DRAINING', admissionOpen: false }) }) };
    case 'ADMIT_OPERATION': {
      const operation = action.operation;
      if (action.actor.kind !== 'writer' || operation.writerId !== action.actor.writerId
        || operation.sessionId !== action.actor.sessionId || operation.physicalSourceDigest !== state.authority.physicalSourceDigest
        || operation.coordinationEpoch !== state.authority.coordinationEpoch
        || operation.state !== 'admitted') return { ok: false, code: 'IN_FLIGHT_STATE_AMBIGUOUS' };
      const existing = state.operations.find(candidate => candidate.operationId === operation.operationId
        || candidate.idempotencyKey === operation.idempotencyKey);
      if (existing) {
        return decoder.decode(encodeAdmissionOperationCanonical(existing))
          === decoder.decode(encodeAdmissionOperationCanonical(operation))
          ? { ok: true, state } : { ok: false, code: 'IN_FLIGHT_STATE_AMBIGUOUS' };
      }
      if (state.authority.state !== 'OPEN' || !state.authority.admissionOpen) return { ok: false, code: 'ADMISSION_NOT_CLOSED' };
      if (operation.admissionTransitionRevision !== state.authority.transitionRevision) {
        return { ok: false, code: 'IN_FLIGHT_STATE_AMBIGUOUS' };
      }
      return { ok: true, state: withState(state, { authority: nextAuthority(state.authority,
        { unresolvedOperationCount: state.authority.unresolvedOperationCount + 1 }), operations: [...state.operations, operation],
        registrations: state.registrations.map(record => record.writerId === operation.writerId
          ? { ...record, latestOperationId: operation.operationId } : record) }) };
    }
    case 'TERMINALIZE_OPERATION': {
      if (action.actor.kind !== 'writer') return { ok: false, code: 'ACTOR_UNAUTHORIZED' };
      const writer = action.actor as Extract<WriterCoordinationActor, { kind: 'writer' }>;
      const anyIndex = state.operations.findIndex(operation => operation.operationId === action.operationId
        && operation.writerId === writer.writerId && operation.sessionId === writer.sessionId);
      if (anyIndex >= 0) {
        const existing = state.operations[anyIndex];
        if (existing.state === action.result && existing.terminalResult === action.result
          && existing.committedSourceRevision === (action.result === 'committed' ? action.committedSourceRevision : null)) {
          return { ok: true, state };
        }
      }
      const index = anyIndex >= 0 && state.operations[anyIndex].state === 'admitted' ? anyIndex : -1;
      if (index < 0 || state.authority.unresolvedOperationCount === 0
        || (action.result === 'committed') !== (action.committedSourceRevision !== null)) {
        return { ok: false, code: 'IN_FLIGHT_STATE_AMBIGUOUS' };
      }
      const operations = [...state.operations];
      operations[index] = { ...operations[index], state: action.result, terminalResult: action.result,
        committedSourceRevision: action.result === 'committed' ? action.committedSourceRevision : null };
      return { ok: true, state: withState(state, { authority: nextAuthority(state.authority,
        { unresolvedOperationCount: state.authority.unresolvedOperationCount - 1 }), operations }) };
    }
    case 'MARK_QUIESCENT':
      if (state.authority.state !== 'DRAINING' || state.authority.unresolvedOperationCount !== 0
        || state.operations.some(operation => operation.state === 'admitted') || state.checkpointChain.length !== 2) {
        return { ok: false, code: 'IN_FLIGHT_WRITE_PRESENT' };
      }
      return { ok: true, state: withState(state, { authority: nextAuthority(state.authority,
        { state: 'QUIESCENT_CANDIDATE', admissionOpen: false,
          coordinationEpoch: state.authority.coordinationEpoch + 1 }),
        registrations: state.registrations.map(record => ({ ...record,
          coordinationEpoch: state.authority.coordinationEpoch + 1 })),
        operations: state.operations.map(record => ({ ...record,
          coordinationEpoch: state.authority.coordinationEpoch + 1 })) }) };
    case 'CAPTURE_AFTER_OPERATIONS_TERMINAL':
      return appendCheckpoint(state, action.actor, 'AFTER_OPERATIONS_TERMINAL');
    case 'CAPTURE_BEFORE_SOURCE_VERIFICATION':
      return appendCheckpoint(state, action.actor, 'BEFORE_SOURCE_VERIFICATION');
    case 'BEGIN_SOURCE_VERIFICATION':
      if (state.authority.state !== 'QUIESCENT_CANDIDATE' || state.checkpointChain.length !== 4) {
        return { ok: false, code: 'CHECKPOINT_CHAIN_INVALID' };
      }
      return { ok: true, state: withState(state, { authority: nextAuthority(state.authority,
        { state: 'VERIFYING_SOURCE', admissionOpen: false }) }) };
    case 'CAPTURE_SOURCE_EVIDENCE': {
      if (state.authority.state !== 'VERIFYING_SOURCE' || state.checkpointChain.length !== 4 || state.sourceEvidence !== null
        || action.actor.kind !== 'verifier') return { ok: false, code: 'SOURCE_EVIDENCE_INVALID' };
      if (action.observation.physicalSourceDigest !== state.authority.physicalSourceDigest) {
        return { ok: false, code: 'K328_PHYSICAL_IDENTITY_MISMATCH' };
      }
      if (action.observation.k328AdapterAvailable
        && action.observation.k328PhysicalSourceDigest !== state.authority.physicalSourceDigest) {
        return { ok: false, code: 'K328_PHYSICAL_IDENTITY_MISMATCH' };
      }
      const authority = nextAuthority(state.authority, {});
      const content: Omit<SourceVerificationEvidence, 'evidenceDigest'> = {
        kind: 'absinthe_writer_source_verification_evidence', schemaVersion: 1, byteFormatVersion: 1,
        ...action.observation, captureActorKind: 'verifier', captureActorSessionId: action.actor.sessionId,
        coordinationEpoch: authority.coordinationEpoch, transitionRevision: authority.transitionRevision,
        previousCheckpointDigest: state.checkpointChain[3].checkpointDigest,
      };
      const sourceEvidence: SourceVerificationEvidence = { ...content,
        evidenceDigest: deriveSourceVerificationEvidenceDigest(content) };
      if (!validateSourceVerificationEvidence(sourceEvidence)) return { ok: false, code: 'SOURCE_EVIDENCE_INVALID' };
      return appendCheckpoint(withState(state, { authority, sourceEvidence }), action.actor,
        'AFTER_SOURCE_VERIFICATION');
    }
    case 'CAPTURE_AFTER_SOURCE_VERIFICATION':
      return appendCheckpoint(state, action.actor, 'AFTER_SOURCE_VERIFICATION');
    case 'CAPTURE_BEFORE_ELIGIBILITY_COMMIT':
      return appendCheckpoint(state, action.actor, 'BEFORE_ELIGIBILITY_COMMIT');
    case 'COMMIT_ELIGIBILITY': {
      const final = state.checkpointChain[5];
      if (!final || action.expectedFinalCheckpointDigest !== final.checkpointDigest) {
        return { ok: false, code: 'CHECKPOINT_CHAIN_INVALID' };
      }
      const result = eligibilityFromDurableState(state); if (!result.ok) return result;
      const authority = nextAuthority(state.authority, { state: 'ELIGIBLE', admissionOpen: false });
      return { ok: true, state: withState(state, { authority, eligibilityEvidence: result.evidence }) };
    }
    case 'ABORT':
      if (['ELIGIBLE', 'INELIGIBLE', 'ABORTED', 'FAILED'].includes(state.authority.state)) {
        return { ok: false, code: 'TRANSITION_REVISION_STALE' };
      }
      return { ok: true, state: withState(state, { authority: nextAuthority(state.authority,
        { state: action.failureCode ? 'FAILED' : 'ABORTED', admissionOpen: false, failureCode: action.failureCode }) }) };
  }
}

export function eligibilityFailure(code: WriterEligibilityErrorCode): {
  eligible: false; code: WriterEligibilityErrorCode; retryable: boolean; requiredAction: string;
} { return { eligible: false, code, ...ERROR_POLICY[code] }; }

export const WRITER_ACTION_ACTOR_MATRIX = Object.freeze({
  REGISTER_WRITER: 'writer:self', CAPTURE_BEFORE_DRAIN: 'coordinator', REQUEST_DRAIN: 'coordinator',
  ACKNOWLEDGE_DRAIN: 'writer:self', CLOSE_ADMISSION: 'coordinator',
  CAPTURE_AFTER_ADMISSION_CLOSED: 'coordinator', BEGIN_DRAIN: 'coordinator',
  ADMIT_OPERATION: 'writer:self', TERMINALIZE_OPERATION: 'writer:self', MARK_QUIESCENT: 'coordinator',
  CAPTURE_AFTER_OPERATIONS_TERMINAL: 'coordinator', CAPTURE_BEFORE_SOURCE_VERIFICATION: 'verifier',
  BEGIN_SOURCE_VERIFICATION: 'verifier', CAPTURE_SOURCE_EVIDENCE: 'verifier',
  CAPTURE_AFTER_SOURCE_VERIFICATION: 'verifier', CAPTURE_BEFORE_ELIGIBILITY_COMMIT: 'verifier',
  COMMIT_ELIGIBILITY: 'verifier', ABORT: 'coordinator|verifier|recovery',
} as const);
