import { sha256Hex } from './outboxIdentity';

/**
 * K-329 deterministic architecture model only.
 *
 * This module has no storage, browser, timer, network, or K-328 dependency. It
 * defines the records and pure eligibility decision that a later dormant
 * implementation must satisfy before it may call the K-328 handoff foundation.
 */

export const WRITER_COORDINATION_SCHEMA_VERSION = 1 as const;
export const WRITER_COORDINATION_BYTE_FORMAT_VERSION = 1 as const;
export const WRITER_COORDINATION_STRATEGY =
  'web_locks_durable_registry_epoch_admission_authoritative_revalidation_v1' as const;

export const WRITER_COORDINATION_LIMITS = Object.freeze({
  authorityBytes: 4096,
  registrationBytes: 4096,
  operationBytes: 4096,
  eligibilityEvidenceBytes: 8192,
  reviewedManifestBytes: 16384,
  identifierBytes: 192,
  writerTypes: 256,
  registrations: 512,
  operations: 4096,
});

export const COORDINATION_STATES = [
  'OPEN',
  'DRAIN_REQUESTED',
  'ADMISSION_CLOSED',
  'DRAINING',
  'QUIESCENT_CANDIDATE',
  'VERIFYING_SOURCE',
  'ELIGIBLE',
  'INELIGIBLE',
  'ABORTED',
  'FAILED',
] as const;
export type CoordinationState = typeof COORDINATION_STATES[number];

export const WRITER_CONTEXT_TYPES = [
  'window',
  'dedicated_worker',
  'shared_worker',
  'service_worker',
  'restore_job',
  'sync_hydration_job',
  'migration_job',
  'test_fixture',
] as const;
export type WriterContextType = typeof WRITER_CONTEXT_TYPES[number];

export const WRITER_ELIGIBILITY_ERROR_CODES = [
  'WRITER_INVENTORY_INCOMPLETE',
  'UNKNOWN_WRITER_PRESENT',
  'WRITER_NOT_COORDINATED',
  'WRITER_REGISTRATION_MALFORMED',
  'WRITER_SET_CHANGED',
  'COORDINATION_UNSUPPORTED',
  'COORDINATION_LOCK_UNAVAILABLE',
  'COORDINATION_EPOCH_STALE',
  'ADMISSION_NOT_CLOSED',
  'IN_FLIGHT_WRITE_PRESENT',
  'IN_FLIGHT_STATE_AMBIGUOUS',
  'DRAIN_TIMEOUT_UNPROVEN',
  'SOURCE_REVISION_UNSTABLE',
  'SOURCE_CHANGED_DURING_VERIFICATION',
  'AUTHORITATIVE_SOURCE_AMBIGUOUS',
  'MIXED_SOURCE_DIVERGENCE',
  'SOURCE_OWNERSHIP_UNPROVEN',
  'SOURCE_MALFORMED',
  'SOURCE_RESOURCE_BOUND_EXCEEDED',
  'RESTORE_OR_IMPORT_ACTIVE',
  'SYNC_WRITER_ACTIVE',
  'UNKNOWN_CONTEXT_PRESENT',
  'K328_ADAPTER_UNAVAILABLE',
  'K328_PHYSICAL_IDENTITY_MISMATCH',
  'ELIGIBILITY_EVIDENCE_CORRUPT',
  'ELIGIBILITY_PROTOCOL_VERSION_UNSUPPORTED',
  'REVIEWED_MANIFEST_INVALID',
  'REVIEWED_MANIFEST_DIGEST_MISMATCH',
  'LIVE_INSTANCE_SET_EMPTY',
  'LIVE_INSTANCE_SET_CHANGED',
  'ACTOR_UNAUTHORIZED',
  'TRANSITION_REVISION_STALE',
] as const;
export type WriterEligibilityErrorCode = typeof WRITER_ELIGIBILITY_ERROR_CODES[number];

export type WriterCapability = 'admission' | 'drain_ack' | 'source_write';
export type RegistrationState = 'registered' | 'drain_acknowledged' | 'disabled';
type OperationState = 'admitted' | 'committed' | 'aborted' | 'failed';
type AuthoritativeSource = 'indexeddb';

export const WRITER_AUTHORITY_ROLES = [
  'authoritative_source_writer',
  'auxiliary_container_writer',
  'metadata_writer',
  'remote_only_writer',
  'dormant_or_test_writer',
] as const;
export type WriterAuthorityRole = typeof WRITER_AUTHORITY_ROLES[number];

export const WRITER_COORDINATION_REQUIREMENTS = [
  'must_participate',
  'must_be_disabled',
  'excluded_with_proof',
] as const;
export type WriterCoordinationRequirement = typeof WRITER_COORDINATION_REQUIREMENTS[number];

export const WRITER_EXCLUSION_PROOF_CODES = [
  'AUXILIARY_CONTAINER_NOT_AUTHORITY',
  'METADATA_NOT_SOURCE_AUTHORITY',
  'REMOTE_ONLY_NO_LOCAL_SOURCE_MUTATION',
  'DORMANT_NO_PRODUCTION_CALLER',
  'TEST_ONLY_NO_PRODUCTION_REACHABILITY',
] as const;
export type WriterExclusionProofCode = typeof WRITER_EXCLUSION_PROOF_CODES[number];

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
  manifestVersion: string;
  entries: readonly ReviewedWriterManifestEntry[];
}

/** Source-reviewed K-329A writer types. Runtime instance/session IDs are separate. */
const K329A_REVIEWED_WRITER_MANIFEST_ENTRY_SOURCE = [
  { writerTypeId: 'handoff.k328_evidence', contextTypes: ['window'], requiredCapabilities: [], authorityRole: 'dormant_or_test_writer', coordinationRequirement: 'excluded_with_proof', exclusionProofCode: 'DORMANT_NO_PRODUCTION_CALLER' },
  { writerTypeId: 'legacy.notes.audit_k96b', contextTypes: ['test_fixture'], requiredCapabilities: [], authorityRole: 'dormant_or_test_writer', coordinationRequirement: 'excluded_with_proof', exclusionProofCode: 'TEST_ONLY_NO_PRODUCTION_REACHABILITY' },
  { writerTypeId: 'legacy.notes.audit_k96d', contextTypes: ['test_fixture'], requiredCapabilities: [], authorityRole: 'dormant_or_test_writer', coordinationRequirement: 'excluded_with_proof', exclusionProofCode: 'TEST_ONLY_NO_PRODUCTION_REACHABILITY' },
  { writerTypeId: 'legacy.notes.audit_k97f', contextTypes: ['test_fixture'], requiredCapabilities: [], authorityRole: 'dormant_or_test_writer', coordinationRequirement: 'excluded_with_proof', exclusionProofCode: 'TEST_ONLY_NO_PRODUCTION_REACHABILITY' },
  { writerTypeId: 'legacy.notes.backup_durability', contextTypes: ['window'], requiredCapabilities: [], authorityRole: 'auxiliary_container_writer', coordinationRequirement: 'excluded_with_proof', exclusionProofCode: 'AUXILIARY_CONTAINER_NOT_AUTHORITY' },
  { writerTypeId: 'legacy.notes.cross_tab_merge', contextTypes: ['window'], requiredCapabilities: ['admission', 'drain_ack', 'source_write'], authorityRole: 'authoritative_source_writer', coordinationRequirement: 'must_participate', exclusionProofCode: null },
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

export const K329A_REVIEWED_WRITER_MANIFEST_ENTRIES: readonly ReviewedWriterManifestEntry[] = Object.freeze(
  K329A_REVIEWED_WRITER_MANIFEST_ENTRY_SOURCE.map(entry => Object.freeze({ ...entry,
    contextTypes: Object.freeze([...entry.contextTypes]),
    requiredCapabilities: Object.freeze([...entry.requiredCapabilities]),
  })),
);

export function createK329AReviewedWriterManifest(physicalSourceDigest: string): ReviewedWriterManifest {
  return { kind: 'absinthe_reviewed_writer_manifest', schemaVersion: 1, byteFormatVersion: 1,
    physicalSourceDigest, manifestVersion: 'k329a-source-reviewed-v1', entries: K329A_REVIEWED_WRITER_MANIFEST_ENTRIES };
}

export interface CoordinationAuthorityRecord {
  kind: 'absinthe_writer_coordination_authority';
  schemaVersion: 1;
  byteFormatVersion: 1;
  physicalSourceDigest: string;
  coordinationEpoch: number;
  state: CoordinationState;
  coordinatorSessionId: string;
  reviewedManifestDigest: string;
  admissionOpen: boolean;
  unresolvedOperationCount: number;
  sourceRevisionBefore: string | null;
  sourceRevisionAfter: string | null;
  sourceDigestBefore: string | null;
  sourceDigestAfter: string | null;
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
  acknowledgedTransitionRevision: number | null;
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

export interface AuthoritativeSourceAssessment {
  source: AuthoritativeSource | null;
  physicalSourceDigest: string;
  exactSupportedSource: boolean;
  ownershipProven: boolean;
  canonical: boolean;
  withinBounds: boolean;
  mixedOrDivergent: boolean;
  unknownContainerPresent: boolean;
  revisionBefore: string | null;
  revisionAfter: string | null;
  digestBefore: string | null;
  digestAfter: string | null;
  rejectionCode: WriterEligibilityErrorCode | null;
}

export interface LiveRegistrationCheckpoints {
  beforeDrain: readonly WriterRegistrationRecord[];
  afterAdmissionClosed: readonly WriterRegistrationRecord[];
  afterOperationsTerminal: readonly WriterRegistrationRecord[];
  beforeSourceVerification: readonly WriterRegistrationRecord[];
  afterSourceVerification: readonly WriterRegistrationRecord[];
  beforeEvidenceCommit: readonly WriterRegistrationRecord[];
}

export interface WriterCoordinationEligibilityInput {
  authority: CoordinationAuthorityRecord;
  reviewedManifest: ReviewedWriterManifest;
  reviewedManifestDigest: string;
  registrationCheckpoints: LiveRegistrationCheckpoints;
  operations: readonly AdmissionOperationRecord[];
  source: AuthoritativeSourceAssessment;
  coordinationSupported: boolean;
  lockAvailable: boolean;
  restoreOrImportActive: boolean;
  syncWriterActive: boolean;
  k328AdapterAvailable: boolean;
  k328PhysicalSourceDigest: string | null;
}

export interface EligibilityEvidenceRecord {
  kind: 'absinthe_writer_eligibility_evidence';
  schemaVersion: 1;
  byteFormatVersion: 1;
  strategy: typeof WRITER_COORDINATION_STRATEGY;
  physicalSourceDigest: string;
  coordinationEpoch: number;
  authoritativeSource: AuthoritativeSource;
  reviewedManifestDigest: string;
  liveWriterInstanceSetDigest: string;
  stableRevision: string;
  stableSourceDigest: string;
  authorityTransitionRevision: number;
  result: 'eligible';
}

export type WriterCoordinationEligibility =
  | {
      eligible: true;
      strategy: typeof WRITER_COORDINATION_STRATEGY;
      physicalSourceDigest: string;
      coordinationEpoch: number;
      authoritativeSource: AuthoritativeSource;
      reviewedManifestDigest: string;
      liveWriterInstanceSetDigest: string;
      stableRevision: string;
      evidenceDigest: string;
      evidence: EligibilityEvidenceRecord;
    }
  | {
      eligible: false;
      code: WriterEligibilityErrorCode;
      retryable: boolean;
      requiredAction: string;
    };

const encoder = new TextEncoder();
const HASH = /^[a-f0-9]{64}$/;
const SAFE_ID = /^[a-z0-9][a-z0-9._:-]{0,159}$/;
const WRITER_TYPE_ID = /^[a-z0-9][a-z0-9._-]{0,79}$/;
const WRITER_ID = /^writer-v1:(window|dedicated_worker|shared_worker|service_worker|restore_job|sync_hydration_job|migration_job|test_fixture):([a-z0-9][a-z0-9._-]{0,79}):([a-f0-9]{32})$/;
const SESSION_ID = /^writer-session-v1:[a-f0-9]{32}$/;
const OPERATION_ID = /^writer-operation-v1:[a-f0-9]{64}$/;
const IDEMPOTENCY_KEY = /^writer-idempotency-v1:[a-f0-9]{64}$/;
const SOURCE_REVISION = /^(0|[1-9][0-9]{0,15})$/;

const ERROR_POLICY: Record<WriterEligibilityErrorCode, { retryable: boolean; requiredAction: string }> = {
  WRITER_INVENTORY_INCOMPLETE: { retryable: false, requiredAction: 'complete and review the production writer inventory' },
  UNKNOWN_WRITER_PRESENT: { retryable: false, requiredAction: 'classify and coordinate or disable the unknown writer' },
  WRITER_NOT_COORDINATED: { retryable: false, requiredAction: 'route the writer through durable epoch admission' },
  WRITER_REGISTRATION_MALFORMED: { retryable: false, requiredAction: 'repair the implementation; do not repair persisted evidence' },
  WRITER_SET_CHANGED: { retryable: true, requiredAction: 'restart drain with a stable reviewed writer set' },
  COORDINATION_UNSUPPORTED: { retryable: false, requiredAction: 'use a supported secure browser/storage environment' },
  COORDINATION_LOCK_UNAVAILABLE: { retryable: true, requiredAction: 'retry without lock stealing or lease fallback' },
  COORDINATION_EPOCH_STALE: { retryable: true, requiredAction: 'discard the stale token and obtain admission in a new open epoch' },
  ADMISSION_NOT_CLOSED: { retryable: true, requiredAction: 'durably close admission before verification' },
  IN_FLIGHT_WRITE_PRESENT: { retryable: true, requiredAction: 'wait for a durable terminal operation result' },
  IN_FLIGHT_STATE_AMBIGUOUS: { retryable: false, requiredAction: 'resolve the operation with separately reviewed evidence' },
  DRAIN_TIMEOUT_UNPROVEN: { retryable: true, requiredAction: 'collect durable acknowledgements; timeout is not proof' },
  SOURCE_REVISION_UNSTABLE: { retryable: true, requiredAction: 'restart verification after the source is durably quiescent' },
  SOURCE_CHANGED_DURING_VERIFICATION: { retryable: true, requiredAction: 'abort eligibility and repeat authoritative verification' },
  AUTHORITATIVE_SOURCE_AMBIGUOUS: { retryable: false, requiredAction: 'run a separately reviewed source-resolution protocol' },
  MIXED_SOURCE_DIVERGENCE: { retryable: false, requiredAction: 'preserve both sources and perform reviewed reconciliation' },
  SOURCE_OWNERSHIP_UNPROVEN: { retryable: false, requiredAction: 'establish exact namespace and ownership binding' },
  SOURCE_MALFORMED: { retryable: false, requiredAction: 'preserve source evidence and investigate corruption' },
  SOURCE_RESOURCE_BOUND_EXCEEDED: { retryable: false, requiredAction: 'use a separately reviewed bounded export path' },
  RESTORE_OR_IMPORT_ACTIVE: { retryable: true, requiredAction: 'allow the restore/import writer to finish or abort durably' },
  SYNC_WRITER_ACTIVE: { retryable: true, requiredAction: 'allow sync hydration to finish or abort durably' },
  UNKNOWN_CONTEXT_PRESENT: { retryable: false, requiredAction: 'classify and coordinate the context before retrying' },
  K328_ADAPTER_UNAVAILABLE: { retryable: false, requiredAction: 'implement and review an exact read-only K-328 source adapter' },
  K328_PHYSICAL_IDENTITY_MISMATCH: { retryable: false, requiredAction: 'bind K-328 to the exact eligible physical source' },
  ELIGIBILITY_EVIDENCE_CORRUPT: { retryable: false, requiredAction: 'stop without repair and inspect bounded durable evidence' },
  ELIGIBILITY_PROTOCOL_VERSION_UNSUPPORTED: { retryable: false, requiredAction: 'use a reviewed protocol migration' },
  REVIEWED_MANIFEST_INVALID: { retryable: false, requiredAction: 'replace the manifest only through reviewed source inventory work' },
  REVIEWED_MANIFEST_DIGEST_MISMATCH: { retryable: false, requiredAction: 'recompute the exact reviewed manifest evidence' },
  LIVE_INSTANCE_SET_EMPTY: { retryable: false, requiredAction: 'register every required production writer instance durably' },
  LIVE_INSTANCE_SET_CHANGED: { retryable: true, requiredAction: 'restart drain after the exact live instance set becomes stable' },
  ACTOR_UNAUTHORIZED: { retryable: false, requiredAction: 'use the actor bound to the durable protocol transition' },
  TRANSITION_REVISION_STALE: { retryable: true, requiredAction: 'reread durable authority and retry with the current CAS revision' },
};

function ineligible(code: WriterEligibilityErrorCode): WriterCoordinationEligibility {
  return { eligible: false, code, ...ERROR_POLICY[code] };
}

function exactRecord(value: unknown, expected: readonly string[]): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return false;
  const keys = Reflect.ownKeys(value);
  if (keys.some(key => typeof key !== 'string') || keys.length !== expected.length) return false;
  const sorted = (keys as string[]).slice().sort();
  if (sorted.some((key, index) => key !== [...expected].sort()[index])) return false;
  return keys.every(key => {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return Boolean(descriptor && 'value' in descriptor && descriptor.enumerable);
  });
}

function validSafeInteger(value: unknown, minimum = 0): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= minimum;
}

function validBoundedId(value: unknown): value is string {
  return typeof value === 'string' && SAFE_ID.test(value)
    && encoder.encode(value).byteLength <= WRITER_COORDINATION_LIMITS.identifierBytes;
}

function validStringArray(value: unknown, allowed: readonly string[], allowEmpty = false): value is readonly string[] {
  return Array.isArray(value) && Object.getPrototypeOf(value) === Array.prototype
    && (allowEmpty || value.length > 0) && value.length <= allowed.length
    && value.every(item => typeof item === 'string' && allowed.includes(item))
    && new Set(value).size === value.length
    && value.every((item, index) => index === 0 || value[index - 1] < item);
}

export function deriveWriterSetDigest(writerTypeIds: readonly string[]): string {
  if (!Array.isArray(writerTypeIds) || writerTypeIds.length === 0
    || writerTypeIds.length > WRITER_COORDINATION_LIMITS.writerTypes
    || writerTypeIds.some(id => typeof id !== 'string' || !WRITER_TYPE_ID.test(id))
    || new Set(writerTypeIds).size !== writerTypeIds.length) throw new Error('WRITER_INVENTORY_INCOMPLETE');
  return sha256Hex(JSON.stringify(['absinthe_writer_set_v1', [...writerTypeIds].sort()]));
}

const AUTHORITY_KEYS = ['kind', 'schemaVersion', 'byteFormatVersion', 'physicalSourceDigest', 'coordinationEpoch',
  'state', 'coordinatorSessionId', 'reviewedManifestDigest', 'admissionOpen', 'unresolvedOperationCount',
  'sourceRevisionBefore', 'sourceRevisionAfter', 'sourceDigestBefore', 'sourceDigestAfter',
  'transitionRevision', 'createdSequence', 'updatedSequence', 'failureCode'] as const;
const REGISTRATION_KEYS = ['kind', 'schemaVersion', 'byteFormatVersion', 'physicalSourceDigest', 'writerTypeId', 'writerId',
  'sessionId', 'contextType', 'coordinationEpoch', 'capabilities', 'registrationState', 'coordinated',
  'acknowledgedTransitionRevision', 'latestOperationId', 'lastSeenSequence'] as const;
const OPERATION_KEYS = ['kind', 'schemaVersion', 'byteFormatVersion', 'physicalSourceDigest', 'operationId',
  'idempotencyKey', 'writerTypeId', 'writerId', 'sessionId', 'coordinationEpoch',
  'admissionTransitionRevision', 'mutationType', 'expectedSourceRevision', 'state',
  'committedSourceRevision', 'terminalResult'] as const;
const MANIFEST_KEYS = ['kind', 'schemaVersion', 'byteFormatVersion', 'physicalSourceDigest', 'manifestVersion', 'entries'] as const;
const MANIFEST_ENTRY_KEYS = ['writerTypeId', 'contextTypes', 'requiredCapabilities', 'authorityRole',
  'coordinationRequirement', 'exclusionProofCode'] as const;
const EVIDENCE_KEYS = ['kind', 'schemaVersion', 'byteFormatVersion', 'strategy', 'physicalSourceDigest',
  'coordinationEpoch', 'authoritativeSource', 'reviewedManifestDigest', 'liveWriterInstanceSetDigest',
  'stableRevision', 'stableSourceDigest', 'authorityTransitionRevision', 'result'] as const;

export function validateCoordinationAuthority(value: unknown): value is CoordinationAuthorityRecord {
  if (!exactRecord(value, AUTHORITY_KEYS)) return false;
  const record = value as unknown as CoordinationAuthorityRecord;
  return record.kind === 'absinthe_writer_coordination_authority' && record.schemaVersion === 1
    && record.byteFormatVersion === 1 && HASH.test(record.physicalSourceDigest)
    && validSafeInteger(record.coordinationEpoch, 1) && COORDINATION_STATES.includes(record.state)
    && SESSION_ID.test(record.coordinatorSessionId) && HASH.test(record.reviewedManifestDigest)
    && record.admissionOpen === (record.state === 'OPEN')
    && validSafeInteger(record.unresolvedOperationCount) && validSafeInteger(record.transitionRevision)
    && validSafeInteger(record.createdSequence) && validSafeInteger(record.updatedSequence)
    && record.updatedSequence >= record.createdSequence
    && [record.sourceRevisionBefore, record.sourceRevisionAfter].every(item => item === null || SOURCE_REVISION.test(item))
    && [record.sourceDigestBefore, record.sourceDigestAfter].every(item => item === null || HASH.test(item))
    && (record.failureCode === null || WRITER_ELIGIBILITY_ERROR_CODES.includes(record.failureCode));
}

export function validateWriterRegistration(value: unknown): value is WriterRegistrationRecord {
  if (!exactRecord(value, REGISTRATION_KEYS)) return false;
  const record = value as unknown as WriterRegistrationRecord;
  const identity = typeof record.writerId === 'string' ? WRITER_ID.exec(record.writerId) : null;
  return record.kind === 'absinthe_writer_registration' && record.schemaVersion === 1
    && record.byteFormatVersion === 1 && HASH.test(record.physicalSourceDigest)
    && WRITER_TYPE_ID.test(record.writerTypeId) && identity !== null && identity[1] === record.contextType
    && identity[2] === record.writerTypeId && SESSION_ID.test(record.sessionId)
    && WRITER_CONTEXT_TYPES.includes(record.contextType) && validSafeInteger(record.coordinationEpoch, 1)
    && validStringArray(record.capabilities, ['admission', 'drain_ack', 'source_write'])
    && ['registered', 'drain_acknowledged', 'disabled'].includes(record.registrationState)
    && typeof record.coordinated === 'boolean'
    && (record.acknowledgedTransitionRevision === null || validSafeInteger(record.acknowledgedTransitionRevision))
    && (record.latestOperationId === null || OPERATION_ID.test(record.latestOperationId))
    && validSafeInteger(record.lastSeenSequence);
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
    && SESSION_ID.test(record.sessionId) && validSafeInteger(record.coordinationEpoch, 1)
    && validSafeInteger(record.admissionTransitionRevision)
    && ['snapshot_replace', 'entity_put', 'entity_delete', 'metadata_write'].includes(record.mutationType)
    && SOURCE_REVISION.test(record.expectedSourceRevision)
    && ['admitted', 'committed', 'aborted', 'failed'].includes(record.state)
    && (record.committedSourceRevision === null || SOURCE_REVISION.test(record.committedSourceRevision)) && terminal;
}

export function validateReviewedWriterManifest(value: unknown): value is ReviewedWriterManifest {
  if (!exactRecord(value, MANIFEST_KEYS)) return false;
  const manifest = value as unknown as ReviewedWriterManifest;
  if (manifest.kind !== 'absinthe_reviewed_writer_manifest' || manifest.schemaVersion !== 1
    || manifest.byteFormatVersion !== 1 || !HASH.test(manifest.physicalSourceDigest)
    || !validBoundedId(manifest.manifestVersion) || !Array.isArray(manifest.entries)
    || manifest.entries.length === 0 || manifest.entries.length > WRITER_COORDINATION_LIMITS.writerTypes) return false;
  let participates = false;
  for (let index = 0; index < manifest.entries.length; index += 1) {
    const candidate = manifest.entries[index];
    if (!exactRecord(candidate, MANIFEST_ENTRY_KEYS)) return false;
    const entry = candidate as unknown as ReviewedWriterManifestEntry;
    if (!WRITER_TYPE_ID.test(entry.writerTypeId)
      || (index > 0 && manifest.entries[index - 1].writerTypeId >= entry.writerTypeId)
      || !validStringArray(entry.contextTypes, WRITER_CONTEXT_TYPES)
      || !validStringArray(entry.requiredCapabilities, ['admission', 'drain_ack', 'source_write'],
        entry.coordinationRequirement === 'excluded_with_proof')
      || !WRITER_AUTHORITY_ROLES.includes(entry.authorityRole)
      || !WRITER_COORDINATION_REQUIREMENTS.includes(entry.coordinationRequirement)) return false;
    if (entry.coordinationRequirement === 'excluded_with_proof') {
      if (!entry.exclusionProofCode || !WRITER_EXCLUSION_PROOF_CODES.includes(entry.exclusionProofCode)) return false;
      const proofMatchesRole = entry.authorityRole === 'auxiliary_container_writer'
        ? entry.exclusionProofCode === 'AUXILIARY_CONTAINER_NOT_AUTHORITY'
        : entry.authorityRole === 'metadata_writer'
          ? entry.exclusionProofCode === 'METADATA_NOT_SOURCE_AUTHORITY'
          : entry.authorityRole === 'remote_only_writer'
            ? entry.exclusionProofCode === 'REMOTE_ONLY_NO_LOCAL_SOURCE_MUTATION'
            : entry.authorityRole === 'dormant_or_test_writer'
              ? ['DORMANT_NO_PRODUCTION_CALLER', 'TEST_ONLY_NO_PRODUCTION_REACHABILITY'].includes(entry.exclusionProofCode)
              : false;
      if (!proofMatchesRole) return false;
    } else if (entry.exclusionProofCode !== null || entry.authorityRole !== 'authoritative_source_writer') return false;
    participates ||= entry.coordinationRequirement === 'must_participate';
  }
  return participates;
}

function orderedAuthority(value: CoordinationAuthorityRecord): CoordinationAuthorityRecord {
  return { kind: value.kind, schemaVersion: value.schemaVersion, byteFormatVersion: value.byteFormatVersion,
    physicalSourceDigest: value.physicalSourceDigest, coordinationEpoch: value.coordinationEpoch, state: value.state,
    coordinatorSessionId: value.coordinatorSessionId, reviewedManifestDigest: value.reviewedManifestDigest,
    admissionOpen: value.admissionOpen, unresolvedOperationCount: value.unresolvedOperationCount,
    sourceRevisionBefore: value.sourceRevisionBefore, sourceRevisionAfter: value.sourceRevisionAfter,
    sourceDigestBefore: value.sourceDigestBefore, sourceDigestAfter: value.sourceDigestAfter,
    transitionRevision: value.transitionRevision, createdSequence: value.createdSequence,
    updatedSequence: value.updatedSequence, failureCode: value.failureCode };
}
function orderedRegistration(value: WriterRegistrationRecord): WriterRegistrationRecord {
  return { kind: value.kind, schemaVersion: value.schemaVersion, byteFormatVersion: value.byteFormatVersion,
    physicalSourceDigest: value.physicalSourceDigest, writerTypeId: value.writerTypeId, writerId: value.writerId,
    sessionId: value.sessionId, contextType: value.contextType, coordinationEpoch: value.coordinationEpoch,
    capabilities: [...value.capabilities], registrationState: value.registrationState, coordinated: value.coordinated,
    acknowledgedTransitionRevision: value.acknowledgedTransitionRevision, latestOperationId: value.latestOperationId,
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
function orderedManifest(value: ReviewedWriterManifest): ReviewedWriterManifest {
  return { kind: value.kind, schemaVersion: value.schemaVersion, byteFormatVersion: value.byteFormatVersion,
    physicalSourceDigest: value.physicalSourceDigest, manifestVersion: value.manifestVersion,
    entries: value.entries.map(entry => ({ writerTypeId: entry.writerTypeId, contextTypes: [...entry.contextTypes],
      requiredCapabilities: [...entry.requiredCapabilities], authorityRole: entry.authorityRole,
      coordinationRequirement: entry.coordinationRequirement, exclusionProofCode: entry.exclusionProofCode })) };
}
function orderedEvidence(value: EligibilityEvidenceRecord): EligibilityEvidenceRecord {
  return { kind: value.kind, schemaVersion: value.schemaVersion, byteFormatVersion: value.byteFormatVersion,
    strategy: value.strategy, physicalSourceDigest: value.physicalSourceDigest, coordinationEpoch: value.coordinationEpoch,
    authoritativeSource: value.authoritativeSource, reviewedManifestDigest: value.reviewedManifestDigest,
    liveWriterInstanceSetDigest: value.liveWriterInstanceSetDigest, stableRevision: value.stableRevision,
    stableSourceDigest: value.stableSourceDigest, authorityTransitionRevision: value.authorityTransitionRevision,
    result: value.result };
}

type CanonicalDecodeCode = 'ELIGIBILITY_EVIDENCE_CORRUPT' | 'ELIGIBILITY_PROTOCOL_VERSION_UNSUPPORTED';
type CanonicalDecodeResult<T> = { ok: true; value: T } | { ok: false; code: CanonicalDecodeCode };

class StrictJsonReader {
  #index = 0;
  constructor(private readonly text: string) {}
  parse(): unknown { const value = this.#value(0); if (this.#index !== this.text.length) throw new Error(); return value; }
  #value(depth: number): unknown {
    if (depth > 16 || this.#index >= this.text.length) throw new Error();
    const char = this.text[this.#index];
    if (char === '{') return this.#object(depth + 1);
    if (char === '[') return this.#array(depth + 1);
    if (char === '"') return this.#string();
    for (const [token, value] of [['true', true], ['false', false], ['null', null]] as const) {
      if (this.text.startsWith(token, this.#index)) { this.#index += token.length; return value; }
    }
    const match = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec(this.text.slice(this.#index));
    if (!match) throw new Error(); this.#index += match[0].length; const number = Number(match[0]);
    if (!Number.isFinite(number)) throw new Error(); return number;
  }
  #object(depth: number): Record<string, unknown> {
    this.#index += 1; const result = Object.create(null) as Record<string, unknown>; const keys = new Set<string>();
    if (this.text[this.#index] === '}') { this.#index += 1; return result; }
    while (true) {
      if (this.text[this.#index] !== '"') throw new Error(); const key = this.#string();
      if (keys.has(key) || this.text[this.#index] !== ':') throw new Error(); keys.add(key); this.#index += 1;
      result[key] = this.#value(depth);
      const char = this.text[this.#index++]; if (char === '}') return result; if (char !== ',') throw new Error();
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

function bytesEqual(left: Uint8Array, right: Uint8Array): boolean {
  return left.byteLength === right.byteLength && left.every((byte, index) => byte === right[index]);
}
function encodeCanonical<T>(value: T, validate: (candidate: unknown) => candidate is T,
  order: (candidate: T) => T, limit: number): Uint8Array {
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

export const encodeCoordinationAuthorityCanonical = (value: CoordinationAuthorityRecord): Uint8Array =>
  encodeCanonical(value, validateCoordinationAuthority, orderedAuthority, WRITER_COORDINATION_LIMITS.authorityBytes);
export const decodeCoordinationAuthorityCanonical = (bytes: Uint8Array): CanonicalDecodeResult<CoordinationAuthorityRecord> =>
  decodeCanonical(bytes, validateCoordinationAuthority, encodeCoordinationAuthorityCanonical, WRITER_COORDINATION_LIMITS.authorityBytes);
export const encodeWriterRegistrationCanonical = (value: WriterRegistrationRecord): Uint8Array =>
  encodeCanonical(value, validateWriterRegistration, orderedRegistration, WRITER_COORDINATION_LIMITS.registrationBytes);
export const decodeWriterRegistrationCanonical = (bytes: Uint8Array): CanonicalDecodeResult<WriterRegistrationRecord> =>
  decodeCanonical(bytes, validateWriterRegistration, encodeWriterRegistrationCanonical, WRITER_COORDINATION_LIMITS.registrationBytes);
export const encodeAdmissionOperationCanonical = (value: AdmissionOperationRecord): Uint8Array =>
  encodeCanonical(value, validateAdmissionOperation, orderedOperation, WRITER_COORDINATION_LIMITS.operationBytes);
export const decodeAdmissionOperationCanonical = (bytes: Uint8Array): CanonicalDecodeResult<AdmissionOperationRecord> =>
  decodeCanonical(bytes, validateAdmissionOperation, encodeAdmissionOperationCanonical, WRITER_COORDINATION_LIMITS.operationBytes);
export const encodeReviewedWriterManifestCanonical = (value: ReviewedWriterManifest): Uint8Array =>
  encodeCanonical(value, validateReviewedWriterManifest, orderedManifest, WRITER_COORDINATION_LIMITS.reviewedManifestBytes);
export const decodeReviewedWriterManifestCanonical = (bytes: Uint8Array): CanonicalDecodeResult<ReviewedWriterManifest> =>
  decodeCanonical(bytes, validateReviewedWriterManifest, encodeReviewedWriterManifestCanonical, WRITER_COORDINATION_LIMITS.reviewedManifestBytes);

function validateEligibilityEvidence(value: unknown): value is EligibilityEvidenceRecord {
  if (!exactRecord(value, EVIDENCE_KEYS)) return false;
  const record = value as unknown as EligibilityEvidenceRecord;
  return record.kind === 'absinthe_writer_eligibility_evidence' && record.schemaVersion === 1
    && record.byteFormatVersion === 1 && record.strategy === WRITER_COORDINATION_STRATEGY
    && HASH.test(record.physicalSourceDigest) && validSafeInteger(record.coordinationEpoch, 1)
    && record.authoritativeSource === 'indexeddb' && HASH.test(record.reviewedManifestDigest)
    && HASH.test(record.liveWriterInstanceSetDigest) && SOURCE_REVISION.test(record.stableRevision)
    && HASH.test(record.stableSourceDigest) && validSafeInteger(record.authorityTransitionRevision)
    && record.result === 'eligible';
}
export const encodeEligibilityEvidence = (value: EligibilityEvidenceRecord): Uint8Array =>
  encodeCanonical(value, validateEligibilityEvidence, orderedEvidence, WRITER_COORDINATION_LIMITS.eligibilityEvidenceBytes);
export function decodeEligibilityEvidence(bytes: Uint8Array):
  | { ok: true; evidence: EligibilityEvidenceRecord }
  | { ok: false; code: CanonicalDecodeCode } {
  const result = decodeCanonical(bytes, validateEligibilityEvidence, encodeEligibilityEvidence,
    WRITER_COORDINATION_LIMITS.eligibilityEvidenceBytes);
  return result.ok ? { ok: true, evidence: result.value } : result;
}
export const encodeEligibilityEvidenceCanonical = encodeEligibilityEvidence;
export const decodeEligibilityEvidenceCanonical = decodeEligibilityEvidence;

export function deriveReviewedWriterManifestDigest(manifest: ReviewedWriterManifest): string {
  return sha256Hex(new TextDecoder().decode(encodeReviewedWriterManifestCanonical(manifest)));
}

function registrationIdentity(record: WriterRegistrationRecord): string {
  return [record.writerTypeId, record.writerId, record.sessionId, record.contextType,
    record.physicalSourceDigest, record.coordinationEpoch].join('|');
}
function stableRegistrationIdentity(record: WriterRegistrationRecord): string {
  return [record.writerTypeId, record.writerId, record.sessionId, record.contextType,
    record.physicalSourceDigest].join('|');
}
export function deriveLiveWriterInstanceSetDigest(registrations: readonly WriterRegistrationRecord[]): string {
  if (!Array.isArray(registrations) || registrations.length === 0
    || registrations.length > WRITER_COORDINATION_LIMITS.registrations
    || registrations.some(record => !validateWriterRegistration(record))
    || new Set(registrations.map(record => record.writerId)).size !== registrations.length
    || new Set(registrations.map(record => record.sessionId)).size !== registrations.length) {
    throw new Error('WRITER_REGISTRATION_MALFORMED');
  }
  const ordered = [...registrations].sort((a, b) => registrationIdentity(a) < registrationIdentity(b) ? -1 : 1)
    .map(record => [record.writerTypeId, record.writerId, record.sessionId, record.contextType,
      record.physicalSourceDigest, record.coordinationEpoch, record.capabilities, record.registrationState,
      record.coordinated, record.acknowledgedTransitionRevision, record.latestOperationId]);
  return sha256Hex(JSON.stringify(['absinthe_live_writer_instance_set_v1', ordered]));
}

function validateRegistrationCheckpoints(input: WriterCoordinationEligibilityInput):
  { error: WriterEligibilityErrorCode | null; final: readonly WriterRegistrationRecord[]; digest: string | null } {
  const { authority, registrationCheckpoints: checkpoints, reviewedManifest: manifest } = input;
  const snapshots = [checkpoints.beforeDrain, checkpoints.afterAdmissionClosed, checkpoints.afterOperationsTerminal,
    checkpoints.beforeSourceVerification, checkpoints.afterSourceVerification, checkpoints.beforeEvidenceCommit];
  if (snapshots.some(records => !Array.isArray(records) || records.length > WRITER_COORDINATION_LIMITS.registrations
    || records.some(record => !validateWriterRegistration(record)))) {
    return { error: 'WRITER_REGISTRATION_MALFORMED', final: [], digest: null };
  }
  if (snapshots.some(records => records.length === 0)) return { error: 'LIVE_INSTANCE_SET_EMPTY', final: [], digest: null };
  for (const records of snapshots) {
    if (new Set(records.map(record => record.writerId)).size !== records.length
      || new Set(records.map(record => record.sessionId)).size !== records.length) {
      return { error: 'WRITER_REGISTRATION_MALFORMED', final: [], digest: null };
    }
    if (records.some(record => record.physicalSourceDigest !== authority.physicalSourceDigest)) {
      return { error: 'WRITER_REGISTRATION_MALFORMED', final: [], digest: null };
    }
  }
  const early = [checkpoints.beforeDrain, checkpoints.afterAdmissionClosed];
  if (early.some(records => records.some(record => record.coordinationEpoch !== authority.coordinationEpoch
    && record.coordinationEpoch !== authority.coordinationEpoch - 1))) {
    return { error: 'COORDINATION_EPOCH_STALE', final: [], digest: null };
  }
  const protectedSnapshots = [checkpoints.afterOperationsTerminal, checkpoints.beforeSourceVerification,
    checkpoints.afterSourceVerification, checkpoints.beforeEvidenceCommit];
  if (protectedSnapshots.some(records => records.some(record => record.coordinationEpoch !== authority.coordinationEpoch))) {
    return { error: 'COORDINATION_EPOCH_STALE', final: [], digest: null };
  }
  const baseline = snapshots[0].map(stableRegistrationIdentity).sort().join('\n');
  if (snapshots.slice(1).some(records => records.map(stableRegistrationIdentity).sort().join('\n') !== baseline)) {
    return { error: 'LIVE_INSTANCE_SET_CHANGED', final: [], digest: null };
  }
  const capabilities = new Map(snapshots[0].map(record => [stableRegistrationIdentity(record), record.capabilities.join('|')]));
  if (snapshots.slice(1).some(records => records.some(record =>
    capabilities.get(stableRegistrationIdentity(record)) !== record.capabilities.join('|')))) {
    return { error: 'LIVE_INSTANCE_SET_CHANGED', final: [], digest: null };
  }
  const final = checkpoints.beforeEvidenceCommit;
  const manifestByType = new Map(manifest.entries.map(entry => [entry.writerTypeId, entry]));
  if (final.some(record => !manifestByType.has(record.writerTypeId))) {
    return { error: 'UNKNOWN_WRITER_PRESENT', final, digest: null };
  }
  for (const entry of manifest.entries) {
    const records = final.filter(record => record.writerTypeId === entry.writerTypeId);
    if (entry.coordinationRequirement === 'excluded_with_proof') {
      if (records.some(record => record.registrationState !== 'disabled')) {
        return { error: 'WRITER_NOT_COORDINATED', final, digest: null };
      }
      continue;
    }
    if (records.length === 0) return { error: 'WRITER_INVENTORY_INCOMPLETE', final, digest: null };
    if (entry.coordinationRequirement === 'must_be_disabled') {
      if (records.some(record => record.registrationState !== 'disabled')) {
        return { error: 'WRITER_NOT_COORDINATED', final, digest: null };
      }
      continue;
    }
    if (records.some(record => !record.coordinated || record.registrationState !== 'drain_acknowledged'
      || record.acknowledgedTransitionRevision === null
      || record.acknowledgedTransitionRevision > authority.transitionRevision
      || !entry.contextTypes.includes(record.contextType)
      || entry.requiredCapabilities.some(capability => !record.capabilities.includes(capability)))) {
      return { error: 'DRAIN_TIMEOUT_UNPROVEN', final, digest: null };
    }
  }
  let protectedDigest: string;
  try { protectedDigest = deriveLiveWriterInstanceSetDigest(checkpoints.afterOperationsTerminal); }
  catch { return { error: 'WRITER_REGISTRATION_MALFORMED', final, digest: null }; }
  for (const records of [checkpoints.beforeSourceVerification, checkpoints.afterSourceVerification, final]) {
    try { if (deriveLiveWriterInstanceSetDigest(records) !== protectedDigest) {
      return { error: 'LIVE_INSTANCE_SET_CHANGED', final, digest: null };
    } } catch { return { error: 'WRITER_REGISTRATION_MALFORMED', final, digest: null }; }
  }
  return { error: null, final, digest: protectedDigest };
}

function validateSourceAssessment(source: AuthoritativeSourceAssessment): WriterEligibilityErrorCode | null {
  if (!source || typeof source !== 'object') return 'ELIGIBILITY_EVIDENCE_CORRUPT';
  if (source.rejectionCode !== null) return WRITER_ELIGIBILITY_ERROR_CODES.includes(source.rejectionCode)
    ? source.rejectionCode : 'ELIGIBILITY_EVIDENCE_CORRUPT';
  if (source.unknownContainerPresent) return 'UNKNOWN_CONTEXT_PRESENT';
  if (source.mixedOrDivergent) return 'MIXED_SOURCE_DIVERGENCE';
  if (source.source !== 'indexeddb' || !source.exactSupportedSource) return 'AUTHORITATIVE_SOURCE_AMBIGUOUS';
  if (!source.ownershipProven) return 'SOURCE_OWNERSHIP_UNPROVEN';
  if (!source.canonical) return 'SOURCE_MALFORMED';
  if (!source.withinBounds) return 'SOURCE_RESOURCE_BOUND_EXCEEDED';
  if (!HASH.test(source.physicalSourceDigest)) return 'SOURCE_MALFORMED';
  if (!source.revisionBefore || !source.revisionAfter
    || !SOURCE_REVISION.test(source.revisionBefore) || !SOURCE_REVISION.test(source.revisionAfter)) return 'SOURCE_REVISION_UNSTABLE';
  if (!source.digestBefore || !source.digestAfter || !HASH.test(source.digestBefore) || !HASH.test(source.digestAfter)) return 'SOURCE_MALFORMED';
  if (source.revisionBefore !== source.revisionAfter) return 'SOURCE_REVISION_UNSTABLE';
  if (source.digestBefore !== source.digestAfter) return 'SOURCE_CHANGED_DURING_VERIFICATION';
  return null;
}

export function evaluateWriterCoordinationEligibility(input: WriterCoordinationEligibilityInput): WriterCoordinationEligibility {
  if (!validateCoordinationAuthority(input.authority)) {
    const version = (input.authority as { schemaVersion?: unknown } | null)?.schemaVersion;
    return ineligible(version !== undefined && version !== 1
      ? 'ELIGIBILITY_PROTOCOL_VERSION_UNSUPPORTED' : 'ELIGIBILITY_EVIDENCE_CORRUPT');
  }
  const { authority } = input;
  if (!input.coordinationSupported) return ineligible('COORDINATION_UNSUPPORTED');
  if (!input.lockAvailable) return ineligible('COORDINATION_LOCK_UNAVAILABLE');
  if (Array.isArray(input.reviewedManifest?.entries) && input.reviewedManifest.entries.length === 0) {
    return ineligible('WRITER_INVENTORY_INCOMPLETE');
  }
  if (!validateReviewedWriterManifest(input.reviewedManifest)
    || input.reviewedManifest.physicalSourceDigest !== authority.physicalSourceDigest) return ineligible('REVIEWED_MANIFEST_INVALID');
  let reviewedManifestDigest: string;
  try { reviewedManifestDigest = deriveReviewedWriterManifestDigest(input.reviewedManifest); }
  catch { return ineligible('REVIEWED_MANIFEST_INVALID'); }
  if (input.reviewedManifestDigest !== reviewedManifestDigest
    || authority.reviewedManifestDigest !== reviewedManifestDigest) return ineligible('REVIEWED_MANIFEST_DIGEST_MISMATCH');
  const registrationCheck = validateRegistrationCheckpoints(input);
  if (registrationCheck.error) return ineligible(registrationCheck.error);
  if (input.restoreOrImportActive) return ineligible('RESTORE_OR_IMPORT_ACTIVE');
  if (input.syncWriterActive) return ineligible('SYNC_WRITER_ACTIVE');
  if (authority.admissionOpen || ['OPEN', 'DRAIN_REQUESTED'].includes(authority.state)) return ineligible('ADMISSION_NOT_CLOSED');
  if (authority.state !== 'VERIFYING_SOURCE') return ineligible('SOURCE_REVISION_UNSTABLE');
  if (input.operations.length > WRITER_COORDINATION_LIMITS.operations
    || input.operations.some(operation => !validateAdmissionOperation(operation))
    || new Set(input.operations.map(operation => operation.operationId)).size !== input.operations.length
    || input.operations.some(operation => operation.physicalSourceDigest !== authority.physicalSourceDigest)
    || input.operations.some(operation => !registrationCheck.final.some(registration =>
      registration.writerTypeId === operation.writerTypeId && registration.writerId === operation.writerId
      && registration.sessionId === operation.sessionId))) return ineligible('IN_FLIGHT_STATE_AMBIGUOUS');
  const activeOperations = input.operations.filter(operation => operation.state === 'admitted');
  if (activeOperations.some(operation => operation.admissionTransitionRevision >= authority.transitionRevision)) {
    return ineligible('IN_FLIGHT_STATE_AMBIGUOUS');
  }
  if (activeOperations.some(operation => operation.coordinationEpoch !== authority.coordinationEpoch)) {
    return ineligible('COORDINATION_EPOCH_STALE');
  }
  if (activeOperations.length > 0 || authority.unresolvedOperationCount > 0) return ineligible('IN_FLIGHT_WRITE_PRESENT');
  const sourceError = validateSourceAssessment(input.source); if (sourceError) return ineligible(sourceError);
  if (input.source.physicalSourceDigest !== authority.physicalSourceDigest) return ineligible('K328_PHYSICAL_IDENTITY_MISMATCH');
  if (!input.k328AdapterAvailable) return ineligible('K328_ADAPTER_UNAVAILABLE');
  if (input.k328PhysicalSourceDigest !== authority.physicalSourceDigest) return ineligible('K328_PHYSICAL_IDENTITY_MISMATCH');
  if (authority.sourceRevisionBefore !== input.source.revisionBefore
    || authority.sourceRevisionAfter !== input.source.revisionAfter) return ineligible('SOURCE_REVISION_UNSTABLE');
  if (authority.sourceDigestBefore !== input.source.digestBefore
    || authority.sourceDigestAfter !== input.source.digestAfter) return ineligible('SOURCE_CHANGED_DURING_VERIFICATION');
  const evidence: EligibilityEvidenceRecord = Object.freeze({ kind: 'absinthe_writer_eligibility_evidence', schemaVersion: 1,
    byteFormatVersion: 1, strategy: WRITER_COORDINATION_STRATEGY, physicalSourceDigest: authority.physicalSourceDigest,
    coordinationEpoch: authority.coordinationEpoch, authoritativeSource: 'indexeddb', reviewedManifestDigest,
    liveWriterInstanceSetDigest: registrationCheck.digest!, stableRevision: input.source.revisionAfter!,
    stableSourceDigest: input.source.digestAfter!, authorityTransitionRevision: authority.transitionRevision, result: 'eligible' });
  return { eligible: true, strategy: WRITER_COORDINATION_STRATEGY, physicalSourceDigest: authority.physicalSourceDigest,
    coordinationEpoch: authority.coordinationEpoch, authoritativeSource: 'indexeddb', reviewedManifestDigest,
    liveWriterInstanceSetDigest: registrationCheck.digest!, stableRevision: input.source.revisionAfter!,
    evidenceDigest: sha256Hex(new TextDecoder().decode(encodeEligibilityEvidence(evidence))), evidence };
}

export type WriterCoordinationActor =
  | { kind: 'coordinator' | 'verifier' | 'recovery'; sessionId: string }
  | { kind: 'writer'; writerId: string; sessionId: string };

interface TransitionEnvelope {
  actor: WriterCoordinationActor;
  expectedTransitionRevision: number;
  expectedCoordinationEpoch: number;
}

export type WriterCoordinationAction = TransitionEnvelope & (
  | { type: 'REGISTER_WRITER'; registration: WriterRegistrationRecord }
  | { type: 'REQUEST_DRAIN' }
  | { type: 'ACKNOWLEDGE_DRAIN'; writerId: string }
  | { type: 'CLOSE_ADMISSION' }
  | { type: 'BEGIN_DRAIN' }
  | { type: 'ADMIT_OPERATION'; operation: AdmissionOperationRecord }
  | { type: 'TERMINALIZE_OPERATION'; operationId: string; result: 'committed' | 'aborted' | 'failed'; committedSourceRevision: string | null }
  | { type: 'MARK_QUIESCENT' }
  | { type: 'BEGIN_SOURCE_VERIFICATION' }
  | { type: 'CAPTURE_SOURCE_CHECKPOINT'; revisionBefore: string; revisionAfter: string; digestBefore: string; digestAfter: string }
  | { type: 'COMMIT_ELIGIBILITY'; input: WriterCoordinationEligibilityInput }
  | { type: 'ABORT'; failureCode: WriterEligibilityErrorCode | null }
);

export interface WriterCoordinationModelState {
  authority: CoordinationAuthorityRecord;
  reviewedManifest: ReviewedWriterManifest;
  registrations: readonly WriterRegistrationRecord[];
  operations: readonly AdmissionOperationRecord[];
  eligibilityEvidence: EligibilityEvidenceRecord | null;
}

export type WriterCoordinationReduction =
  | { ok: true; state: WriterCoordinationModelState }
  | { ok: false; code: WriterEligibilityErrorCode };

function authorizedActor(state: WriterCoordinationModelState, action: WriterCoordinationAction): boolean {
  if (action.actor.kind === 'writer') {
    if (!['REGISTER_WRITER', 'ACKNOWLEDGE_DRAIN', 'ADMIT_OPERATION', 'TERMINALIZE_OPERATION'].includes(action.type)) return false;
    if (action.type === 'REGISTER_WRITER') {
      return action.actor.writerId === action.registration.writerId && action.actor.sessionId === action.registration.sessionId;
    }
    const { writerId, sessionId } = action.actor;
    return state.registrations.some(record => record.writerId === writerId && record.sessionId === sessionId);
  }
  if (action.actor.sessionId !== state.authority.coordinatorSessionId) return false;
  if (action.actor.kind === 'verifier') return ['BEGIN_SOURCE_VERIFICATION', 'CAPTURE_SOURCE_CHECKPOINT', 'COMMIT_ELIGIBILITY'].includes(action.type);
  if (action.actor.kind === 'recovery') return action.type === 'ABORT';
  return !['ACKNOWLEDGE_DRAIN', 'ADMIT_OPERATION', 'TERMINALIZE_OPERATION',
    'BEGIN_SOURCE_VERIFICATION', 'COMMIT_ELIGIBILITY'].includes(action.type);
}

function nextAuthority(authority: CoordinationAuthorityRecord, patch: Partial<CoordinationAuthorityRecord>): CoordinationAuthorityRecord {
  return { ...authority, ...patch, transitionRevision: authority.transitionRevision + 1,
    updatedSequence: authority.updatedSequence + 1 };
}

/**
 * Pure executable protocol model. A storage implementation must apply each
 * successful reduction with compare-and-swap on both epoch and transitionRevision.
 */
export function reduceWriterCoordination(
  state: WriterCoordinationModelState,
  action: WriterCoordinationAction,
): WriterCoordinationReduction {
  if (!validateCoordinationAuthority(state.authority) || !validateReviewedWriterManifest(state.reviewedManifest)
    || state.registrations.some(record => !validateWriterRegistration(record))
    || state.operations.some(record => !validateAdmissionOperation(record))) {
    return { ok: false, code: 'ELIGIBILITY_EVIDENCE_CORRUPT' };
  }
  if (action.expectedTransitionRevision !== state.authority.transitionRevision) {
    return { ok: false, code: 'TRANSITION_REVISION_STALE' };
  }
  if (action.expectedCoordinationEpoch !== state.authority.coordinationEpoch) {
    return { ok: false, code: 'COORDINATION_EPOCH_STALE' };
  }
  if (!authorizedActor(state, action)) return { ok: false, code: 'ACTOR_UNAUTHORIZED' };
  const unchanged = { reviewedManifest: state.reviewedManifest, eligibilityEvidence: state.eligibilityEvidence };

  switch (action.type) {
    case 'REGISTER_WRITER': {
      if (state.authority.state !== 'OPEN' || !state.authority.admissionOpen) return { ok: false, code: 'ADMISSION_NOT_CLOSED' };
      const record = action.registration;
      const manifest = state.reviewedManifest.entries.find(entry => entry.writerTypeId === record.writerTypeId);
      if (!validateWriterRegistration(record) || !manifest
        || record.physicalSourceDigest !== state.authority.physicalSourceDigest
        || record.coordinationEpoch !== state.authority.coordinationEpoch
        || !manifest.contextTypes.includes(record.contextType)
        || state.registrations.some(existing => existing.writerId === record.writerId || existing.sessionId === record.sessionId)) {
        return { ok: false, code: manifest ? 'WRITER_REGISTRATION_MALFORMED' : 'UNKNOWN_WRITER_PRESENT' };
      }
      return { ok: true, state: { ...unchanged, authority: nextAuthority(state.authority, {}),
        registrations: [...state.registrations, record], operations: state.operations } };
    }
    case 'REQUEST_DRAIN':
      if (!canTransitionCoordinationState(state.authority.state, 'DRAIN_REQUESTED')) return { ok: false, code: 'ADMISSION_NOT_CLOSED' };
      return { ok: true, state: { ...unchanged, authority: nextAuthority(state.authority,
        { state: 'DRAIN_REQUESTED', admissionOpen: false }), registrations: state.registrations, operations: state.operations } };
    case 'ACKNOWLEDGE_DRAIN': {
      if (!['DRAIN_REQUESTED', 'ADMISSION_CLOSED', 'DRAINING'].includes(state.authority.state)) {
        return { ok: false, code: 'DRAIN_TIMEOUT_UNPROVEN' };
      }
      if (action.actor.kind !== 'writer' || action.actor.writerId !== action.writerId) return { ok: false, code: 'ACTOR_UNAUTHORIZED' };
      const revision = state.authority.transitionRevision + 1;
      let found = false;
      const registrations = state.registrations.map(record => {
        if (record.writerId !== action.writerId || record.sessionId !== action.actor.sessionId) return record;
        found = true;
        return { ...record, registrationState: 'drain_acknowledged' as const, coordinated: true,
          acknowledgedTransitionRevision: revision, lastSeenSequence: record.lastSeenSequence + 1 };
      });
      if (!found) return { ok: false, code: 'ACTOR_UNAUTHORIZED' };
      return { ok: true, state: { ...unchanged, authority: nextAuthority(state.authority, {}), registrations,
        operations: state.operations } };
    }
    case 'CLOSE_ADMISSION':
      if (!canTransitionCoordinationState(state.authority.state, 'ADMISSION_CLOSED')) return { ok: false, code: 'ADMISSION_NOT_CLOSED' };
      return { ok: true, state: { ...unchanged, authority: nextAuthority(state.authority,
        { state: 'ADMISSION_CLOSED', admissionOpen: false }), registrations: state.registrations, operations: state.operations } };
    case 'BEGIN_DRAIN':
      if (!canTransitionCoordinationState(state.authority.state, 'DRAINING')) return { ok: false, code: 'DRAIN_TIMEOUT_UNPROVEN' };
      return { ok: true, state: { ...unchanged, authority: nextAuthority(state.authority,
        { state: 'DRAINING', admissionOpen: false }), registrations: state.registrations, operations: state.operations } };
    case 'ADMIT_OPERATION': {
      const operation = action.operation;
      if (state.authority.state !== 'OPEN' || !state.authority.admissionOpen) return { ok: false, code: 'ADMISSION_NOT_CLOSED' };
      if (action.actor.kind !== 'writer' || !validateAdmissionOperation(operation)
        || operation.state !== 'admitted' || operation.writerId !== action.actor.writerId
        || operation.sessionId !== action.actor.sessionId || operation.physicalSourceDigest !== state.authority.physicalSourceDigest
        || operation.coordinationEpoch !== state.authority.coordinationEpoch
        || operation.admissionTransitionRevision !== state.authority.transitionRevision
        || state.operations.some(existing => existing.operationId === operation.operationId
          || existing.idempotencyKey === operation.idempotencyKey)) return { ok: false, code: 'IN_FLIGHT_STATE_AMBIGUOUS' };
      return { ok: true, state: { ...unchanged, authority: nextAuthority(state.authority,
        { unresolvedOperationCount: state.authority.unresolvedOperationCount + 1 }), registrations: state.registrations,
        operations: [...state.operations, operation] } };
    }
    case 'TERMINALIZE_OPERATION': {
      if (action.actor.kind !== 'writer') return { ok: false, code: 'ACTOR_UNAUTHORIZED' };
      const { writerId, sessionId } = action.actor;
      let found = false;
      const operations = state.operations.map(operation => {
        if (operation.operationId !== action.operationId || operation.writerId !== writerId
          || operation.sessionId !== sessionId || operation.state !== 'admitted') return operation;
        found = true;
        return { ...operation, state: action.result, terminalResult: action.result,
          committedSourceRevision: action.result === 'committed' ? action.committedSourceRevision : null } as AdmissionOperationRecord;
      });
      if (!found || state.authority.unresolvedOperationCount === 0
        || operations.some(operation => !validateAdmissionOperation(operation))) return { ok: false, code: 'IN_FLIGHT_STATE_AMBIGUOUS' };
      return { ok: true, state: { ...unchanged, authority: nextAuthority(state.authority,
        { unresolvedOperationCount: state.authority.unresolvedOperationCount - 1 }), registrations: state.registrations, operations } };
    }
    case 'MARK_QUIESCENT':
      if (state.authority.state !== 'DRAINING' || state.authority.unresolvedOperationCount !== 0
        || state.operations.some(operation => operation.state === 'admitted')
        || state.registrations.some(record => record.registrationState === 'registered')) {
        return { ok: false, code: 'IN_FLIGHT_WRITE_PRESENT' };
      }
      return { ok: true, state: { ...unchanged, authority: nextAuthority(state.authority,
        { state: 'QUIESCENT_CANDIDATE', admissionOpen: false,
          coordinationEpoch: state.authority.coordinationEpoch + 1 }),
        registrations: state.registrations.map(record => ({ ...record,
          coordinationEpoch: state.authority.coordinationEpoch + 1 })), operations: state.operations } };
    case 'BEGIN_SOURCE_VERIFICATION':
      if (!canTransitionCoordinationState(state.authority.state, 'VERIFYING_SOURCE')) return { ok: false, code: 'SOURCE_REVISION_UNSTABLE' };
      return { ok: true, state: { ...unchanged, authority: nextAuthority(state.authority,
        { state: 'VERIFYING_SOURCE', admissionOpen: false }), registrations: state.registrations, operations: state.operations } };
    case 'CAPTURE_SOURCE_CHECKPOINT':
      if (state.authority.state !== 'VERIFYING_SOURCE' || !SOURCE_REVISION.test(action.revisionBefore)
        || !SOURCE_REVISION.test(action.revisionAfter) || !HASH.test(action.digestBefore) || !HASH.test(action.digestAfter)) {
        return { ok: false, code: 'SOURCE_REVISION_UNSTABLE' };
      }
      return { ok: true, state: { ...unchanged, authority: nextAuthority(state.authority,
        { sourceRevisionBefore: action.revisionBefore, sourceRevisionAfter: action.revisionAfter,
          sourceDigestBefore: action.digestBefore, sourceDigestAfter: action.digestAfter }),
        registrations: state.registrations, operations: state.operations } };
    case 'COMMIT_ELIGIBILITY': {
      if (state.authority.state !== 'VERIFYING_SOURCE'
        || JSON.stringify(orderedAuthority(action.input.authority)) !== JSON.stringify(orderedAuthority(state.authority))) {
        return { ok: false, code: 'TRANSITION_REVISION_STALE' };
      }
      let stateRegistrationDigest: string; let inputRegistrationDigest: string;
      try {
        stateRegistrationDigest = deriveLiveWriterInstanceSetDigest(state.registrations);
        inputRegistrationDigest = deriveLiveWriterInstanceSetDigest(
          action.input.registrationCheckpoints.beforeEvidenceCommit,
        );
      } catch { return { ok: false, code: 'WRITER_REGISTRATION_MALFORMED' }; }
      if (stateRegistrationDigest !== inputRegistrationDigest) return { ok: false, code: 'LIVE_INSTANCE_SET_CHANGED' };
      const operationBytes = (records: readonly AdmissionOperationRecord[]): string => records
        .map(record => new TextDecoder().decode(encodeAdmissionOperationCanonical(record))).sort().join('\n');
      if (operationBytes(state.operations) !== operationBytes(action.input.operations)) {
        return { ok: false, code: 'IN_FLIGHT_STATE_AMBIGUOUS' };
      }
      if (deriveReviewedWriterManifestDigest(state.reviewedManifest) !== action.input.reviewedManifestDigest) {
        return { ok: false, code: 'REVIEWED_MANIFEST_DIGEST_MISMATCH' };
      }
      const result = evaluateWriterCoordinationEligibility(action.input);
      if (!result.eligible) return { ok: false, code: result.code };
      return { ok: true, state: { reviewedManifest: state.reviewedManifest, registrations: state.registrations,
        operations: state.operations, eligibilityEvidence: result.evidence,
        authority: nextAuthority(state.authority, { state: 'ELIGIBLE', admissionOpen: false }) } };
    }
    case 'ABORT':
      if (['ELIGIBLE', 'INELIGIBLE', 'ABORTED', 'FAILED'].includes(state.authority.state)) {
        return { ok: false, code: 'TRANSITION_REVISION_STALE' };
      }
      return { ok: true, state: { ...unchanged, authority: nextAuthority(state.authority,
        { state: action.failureCode ? 'FAILED' : 'ABORTED', admissionOpen: false, failureCode: action.failureCode }),
        registrations: state.registrations, operations: state.operations } };
  }
}

const TRANSITIONS: Readonly<Record<CoordinationState, readonly CoordinationState[]>> = Object.freeze({
  OPEN: ['DRAIN_REQUESTED'],
  DRAIN_REQUESTED: ['ADMISSION_CLOSED', 'ABORTED', 'FAILED'],
  ADMISSION_CLOSED: ['DRAINING', 'ABORTED', 'FAILED'],
  DRAINING: ['QUIESCENT_CANDIDATE', 'INELIGIBLE', 'FAILED'],
  QUIESCENT_CANDIDATE: ['VERIFYING_SOURCE', 'INELIGIBLE', 'FAILED'],
  VERIFYING_SOURCE: ['ELIGIBLE', 'INELIGIBLE', 'FAILED'],
  ELIGIBLE: [],
  INELIGIBLE: [],
  ABORTED: [],
  FAILED: [],
});

export function canTransitionCoordinationState(from: CoordinationState, to: CoordinationState): boolean {
  return TRANSITIONS[from].includes(to);
}

/** Explicit, zero-time scheduler for architecture race traces. */
export class DeterministicCoordinationScheduler {
  readonly #steps = new Map<string, () => void>();
  readonly #history: string[] = [];

  schedule(stepId: string, effect: () => void): void {
    if (!validBoundedId(stepId) || typeof effect !== 'function' || this.#steps.has(stepId)
      || this.#steps.size >= WRITER_COORDINATION_LIMITS.operations) {
      throw new Error('ELIGIBILITY_EVIDENCE_CORRUPT');
    }
    this.#steps.set(stepId, effect);
  }

  run(stepId: string): void {
    const effect = this.#steps.get(stepId);
    if (!effect) throw new Error('ELIGIBILITY_EVIDENCE_CORRUPT');
    this.#steps.delete(stepId);
    effect();
    this.#history.push(stepId);
  }

  pending(): readonly string[] {
    return Object.freeze([...this.#steps.keys()].sort());
  }

  history(): readonly string[] {
    return Object.freeze([...this.#history]);
  }
}

export function assertCoordinationInvariant(input: WriterCoordinationEligibilityInput): boolean {
  const result = evaluateWriterCoordinationEligibility(input);
  if (!result.eligible) return true;
  const final = input.registrationCheckpoints.beforeEvidenceCommit;
  return !input.authority.admissionOpen
    && input.authority.unresolvedOperationCount === 0
    && input.operations.every(operation => operation.state !== 'admitted')
    && final.every(record => record.coordinated
      && (record.registrationState === 'disabled' || record.registrationState === 'drain_acknowledged'))
    && deriveReviewedWriterManifestDigest(input.reviewedManifest) === result.reviewedManifestDigest
    && deriveLiveWriterInstanceSetDigest(final) === result.liveWriterInstanceSetDigest
    && input.source.revisionBefore === input.source.revisionAfter
    && input.source.digestBefore === input.source.digestAfter
    && input.source.source === 'indexeddb'
    && input.k328AdapterAvailable
    && input.k328PhysicalSourceDigest === result.physicalSourceDigest;
}
