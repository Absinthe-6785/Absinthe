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
  identifierBytes: 192,
  writerTypes: 128,
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
] as const;
export type WriterEligibilityErrorCode = typeof WRITER_ELIGIBILITY_ERROR_CODES[number];

type RegistrationState = 'registered' | 'drain_acknowledged' | 'disabled';
type OperationState = 'admitted' | 'committed' | 'aborted' | 'failed';
type AuthoritativeSource = 'indexeddb';

export interface CoordinationAuthorityRecord {
  kind: 'absinthe_writer_coordination_authority';
  schemaVersion: 1;
  byteFormatVersion: 1;
  physicalSourceDigest: string;
  coordinationEpoch: number;
  state: CoordinationState;
  coordinatorSessionId: string;
  expectedWriterSetDigest: string;
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
  capabilities: readonly ('admission' | 'drain_ack' | 'source_write')[];
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

export interface WriterCoordinationEligibilityInput {
  authority: CoordinationAuthorityRecord;
  expectedWriterTypeIds: readonly string[];
  inventoryComplete: boolean;
  writerSetDigestBefore: string;
  writerSetDigestAfter: string;
  registrations: readonly WriterRegistrationRecord[];
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
  writerSetDigest: string;
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
      writerSetDigest: string;
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
const WRITER_ID = /^writer-v1:(window|dedicated_worker|shared_worker|service_worker|restore_job|sync_hydration_job|migration_job|test_fixture):[a-z0-9][a-z0-9._-]{0,79}:[a-f0-9]{32}$/;
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

function validStringArray(value: unknown, allowed: readonly string[]): value is readonly string[] {
  return Array.isArray(value) && Object.getPrototypeOf(value) === Array.prototype
    && value.length > 0 && value.length <= allowed.length
    && value.every(item => typeof item === 'string' && allowed.includes(item))
    && new Set(value).size === value.length
    && value.every((item, index) => index === 0 || value[index - 1] < item);
}

export function deriveWriterSetDigest(writerTypeIds: readonly string[]): string {
  if (!Array.isArray(writerTypeIds) || writerTypeIds.length > WRITER_COORDINATION_LIMITS.writerTypes
    || writerTypeIds.some(id => !validBoundedId(id)) || new Set(writerTypeIds).size !== writerTypeIds.length) {
    throw new Error('WRITER_INVENTORY_INCOMPLETE');
  }
  const sorted = [...writerTypeIds].sort();
  return sha256Hex(JSON.stringify(['absinthe_writer_set_v1', sorted]));
}

export function validateCoordinationAuthority(value: unknown): value is CoordinationAuthorityRecord {
  const keys = ['kind', 'schemaVersion', 'byteFormatVersion', 'physicalSourceDigest', 'coordinationEpoch',
    'state', 'coordinatorSessionId', 'expectedWriterSetDigest', 'admissionOpen', 'unresolvedOperationCount',
    'sourceRevisionBefore', 'sourceRevisionAfter', 'sourceDigestBefore', 'sourceDigestAfter',
    'transitionRevision', 'createdSequence', 'updatedSequence', 'failureCode'];
  if (!exactRecord(value, keys)) return false;
  const record = value as unknown as CoordinationAuthorityRecord;
  const admissionOpen = record.state === 'OPEN';
  return record.kind === 'absinthe_writer_coordination_authority'
    && record.schemaVersion === 1 && record.byteFormatVersion === 1
    && HASH.test(record.physicalSourceDigest) && validSafeInteger(record.coordinationEpoch, 1)
    && COORDINATION_STATES.includes(record.state) && SESSION_ID.test(record.coordinatorSessionId)
    && HASH.test(record.expectedWriterSetDigest) && record.admissionOpen === admissionOpen
    && validSafeInteger(record.unresolvedOperationCount) && validSafeInteger(record.transitionRevision)
    && validSafeInteger(record.createdSequence) && validSafeInteger(record.updatedSequence)
    && record.updatedSequence >= record.createdSequence
    && [record.sourceRevisionBefore, record.sourceRevisionAfter].every(item => item === null || SOURCE_REVISION.test(item))
    && [record.sourceDigestBefore, record.sourceDigestAfter].every(item => item === null || HASH.test(item))
    && (record.failureCode === null || WRITER_ELIGIBILITY_ERROR_CODES.includes(record.failureCode));
}

export function validateWriterRegistration(value: unknown): value is WriterRegistrationRecord {
  const keys = ['kind', 'schemaVersion', 'byteFormatVersion', 'physicalSourceDigest', 'writerTypeId', 'writerId',
    'sessionId', 'contextType', 'coordinationEpoch', 'capabilities', 'registrationState', 'coordinated',
    'acknowledgedTransitionRevision', 'latestOperationId', 'lastSeenSequence'];
  if (!exactRecord(value, keys)) return false;
  const record = value as unknown as WriterRegistrationRecord;
  const writerContext = WRITER_ID.exec(record.writerId)?.[1];
  return record.kind === 'absinthe_writer_registration' && record.schemaVersion === 1
    && record.byteFormatVersion === 1 && HASH.test(record.physicalSourceDigest)
    && validBoundedId(record.writerTypeId) && WRITER_ID.test(record.writerId)
    && SESSION_ID.test(record.sessionId) && WRITER_CONTEXT_TYPES.includes(record.contextType)
    && writerContext === record.contextType && validSafeInteger(record.coordinationEpoch, 1)
    && validStringArray(record.capabilities, ['admission', 'drain_ack', 'source_write'])
    && ['registered', 'drain_acknowledged', 'disabled'].includes(record.registrationState)
    && typeof record.coordinated === 'boolean'
    && (record.acknowledgedTransitionRevision === null || validSafeInteger(record.acknowledgedTransitionRevision))
    && (record.latestOperationId === null || OPERATION_ID.test(record.latestOperationId))
    && validSafeInteger(record.lastSeenSequence);
}

export function validateAdmissionOperation(value: unknown): value is AdmissionOperationRecord {
  const keys = ['kind', 'schemaVersion', 'byteFormatVersion', 'physicalSourceDigest', 'operationId',
    'idempotencyKey', 'writerTypeId', 'writerId', 'sessionId', 'coordinationEpoch',
    'admissionTransitionRevision', 'mutationType', 'expectedSourceRevision', 'state',
    'committedSourceRevision', 'terminalResult'];
  if (!exactRecord(value, keys)) return false;
  const record = value as unknown as AdmissionOperationRecord;
  const terminal = record.state === 'admitted' ? record.terminalResult === null && record.committedSourceRevision === null
    : record.state === 'committed' ? record.terminalResult === 'committed' && record.committedSourceRevision !== null
      : record.terminalResult === record.state && record.committedSourceRevision === null;
  return record.kind === 'absinthe_writer_admission_operation' && record.schemaVersion === 1
    && record.byteFormatVersion === 1 && HASH.test(record.physicalSourceDigest)
    && OPERATION_ID.test(record.operationId) && IDEMPOTENCY_KEY.test(record.idempotencyKey)
    && validBoundedId(record.writerTypeId) && WRITER_ID.test(record.writerId)
    && SESSION_ID.test(record.sessionId) && validSafeInteger(record.coordinationEpoch, 1)
    && validSafeInteger(record.admissionTransitionRevision)
    && ['snapshot_replace', 'entity_put', 'entity_delete', 'metadata_write'].includes(record.mutationType)
    && SOURCE_REVISION.test(record.expectedSourceRevision)
    && ['admitted', 'committed', 'aborted', 'failed'].includes(record.state)
    && (record.committedSourceRevision === null || SOURCE_REVISION.test(record.committedSourceRevision))
    && terminal;
}

function validateSourceAssessment(source: AuthoritativeSourceAssessment): WriterEligibilityErrorCode | null {
  if (source.rejectionCode) return source.rejectionCode;
  if (source.unknownContainerPresent) return 'UNKNOWN_CONTEXT_PRESENT';
  if (source.mixedOrDivergent) return 'MIXED_SOURCE_DIVERGENCE';
  if (source.source !== 'indexeddb' || !source.exactSupportedSource) return 'AUTHORITATIVE_SOURCE_AMBIGUOUS';
  if (!source.ownershipProven) return 'SOURCE_OWNERSHIP_UNPROVEN';
  if (!source.canonical) return 'SOURCE_MALFORMED';
  if (!source.withinBounds) return 'SOURCE_RESOURCE_BOUND_EXCEEDED';
  if (!HASH.test(source.physicalSourceDigest)) return 'SOURCE_MALFORMED';
  if (!source.revisionBefore || !source.revisionAfter
    || !SOURCE_REVISION.test(source.revisionBefore) || !SOURCE_REVISION.test(source.revisionAfter)) {
    return 'SOURCE_REVISION_UNSTABLE';
  }
  if (!source.digestBefore || !source.digestAfter || !HASH.test(source.digestBefore) || !HASH.test(source.digestAfter)) {
    return 'SOURCE_MALFORMED';
  }
  if (source.revisionBefore !== source.revisionAfter) return 'SOURCE_REVISION_UNSTABLE';
  if (source.digestBefore !== source.digestAfter) return 'SOURCE_CHANGED_DURING_VERIFICATION';
  return null;
}

function canonicalEvidence(evidence: EligibilityEvidenceRecord): string {
  return JSON.stringify(evidence);
}

export function encodeEligibilityEvidence(evidence: EligibilityEvidenceRecord): Uint8Array {
  return encoder.encode(canonicalEvidence(evidence));
}

function validateEligibilityEvidence(value: unknown): value is EligibilityEvidenceRecord {
  const keys = ['kind', 'schemaVersion', 'byteFormatVersion', 'strategy', 'physicalSourceDigest',
    'coordinationEpoch', 'authoritativeSource', 'writerSetDigest', 'stableRevision', 'stableSourceDigest',
    'authorityTransitionRevision', 'result'];
  if (!exactRecord(value, keys)) return false;
  const record = value as unknown as EligibilityEvidenceRecord;
  return record.kind === 'absinthe_writer_eligibility_evidence' && record.schemaVersion === 1
    && record.byteFormatVersion === 1 && record.strategy === WRITER_COORDINATION_STRATEGY
    && HASH.test(record.physicalSourceDigest) && validSafeInteger(record.coordinationEpoch, 1)
    && record.authoritativeSource === 'indexeddb' && HASH.test(record.writerSetDigest)
    && SOURCE_REVISION.test(record.stableRevision) && HASH.test(record.stableSourceDigest)
    && validSafeInteger(record.authorityTransitionRevision) && record.result === 'eligible';
}

export function decodeEligibilityEvidence(bytes: Uint8Array):
  | { ok: true; evidence: EligibilityEvidenceRecord }
  | { ok: false; code: 'ELIGIBILITY_EVIDENCE_CORRUPT' | 'ELIGIBILITY_PROTOCOL_VERSION_UNSUPPORTED' } {
  if (!(bytes instanceof Uint8Array) || bytes.byteLength > WRITER_COORDINATION_LIMITS.eligibilityEvidenceBytes) {
    return { ok: false, code: 'ELIGIBILITY_EVIDENCE_CORRUPT' };
  }
  let raw: string;
  try { raw = new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
  catch { return { ok: false, code: 'ELIGIBILITY_EVIDENCE_CORRUPT' }; }
  let value: unknown;
  try { value = JSON.parse(raw); }
  catch { return { ok: false, code: 'ELIGIBILITY_EVIDENCE_CORRUPT' }; }
  if (value && typeof value === 'object' && 'schemaVersion' in value
    && (value as { schemaVersion?: unknown }).schemaVersion !== 1) {
    return { ok: false, code: 'ELIGIBILITY_PROTOCOL_VERSION_UNSUPPORTED' };
  }
  if (!validateEligibilityEvidence(value)) return { ok: false, code: 'ELIGIBILITY_EVIDENCE_CORRUPT' };
  const canonical = encodeEligibilityEvidence(value);
  if (canonical.byteLength !== bytes.byteLength || canonical.some((byte, index) => byte !== bytes[index])) {
    return { ok: false, code: 'ELIGIBILITY_EVIDENCE_CORRUPT' };
  }
  return { ok: true, evidence: Object.freeze({ ...value }) };
}

export function evaluateWriterCoordinationEligibility(
  input: WriterCoordinationEligibilityInput,
): WriterCoordinationEligibility {
  if (!validateCoordinationAuthority(input.authority)) {
    const version = (input.authority as { schemaVersion?: unknown } | null)?.schemaVersion;
    return ineligible(version !== undefined && version !== 1
      ? 'ELIGIBILITY_PROTOCOL_VERSION_UNSUPPORTED' : 'ELIGIBILITY_EVIDENCE_CORRUPT');
  }
  const { authority } = input;
  if (!input.coordinationSupported) return ineligible('COORDINATION_UNSUPPORTED');
  if (!input.lockAvailable) return ineligible('COORDINATION_LOCK_UNAVAILABLE');
  if (!input.inventoryComplete) return ineligible('WRITER_INVENTORY_INCOMPLETE');
  let expectedDigest: string;
  try { expectedDigest = deriveWriterSetDigest(input.expectedWriterTypeIds); }
  catch { return ineligible('WRITER_INVENTORY_INCOMPLETE'); }
  if (authority.expectedWriterSetDigest !== expectedDigest) return ineligible('WRITER_SET_CHANGED');
  if (input.writerSetDigestBefore !== expectedDigest || input.writerSetDigestAfter !== expectedDigest) {
    return ineligible('WRITER_SET_CHANGED');
  }
  if (input.registrations.length > WRITER_COORDINATION_LIMITS.registrations
    || input.registrations.some(record => !validateWriterRegistration(record))) {
    return ineligible('WRITER_REGISTRATION_MALFORMED');
  }
  const expected = new Set(input.expectedWriterTypeIds);
  if (input.registrations.some(record => !expected.has(record.writerTypeId))) {
    return ineligible('UNKNOWN_WRITER_PRESENT');
  }
  const registrationsByType = new Map<string, WriterRegistrationRecord[]>();
  for (const record of input.registrations) {
    if (record.physicalSourceDigest !== authority.physicalSourceDigest) return ineligible('WRITER_REGISTRATION_MALFORMED');
    const existing = registrationsByType.get(record.writerTypeId) ?? [];
    existing.push(record);
    registrationsByType.set(record.writerTypeId, existing);
  }
  if ([...expected].some(type => !registrationsByType.has(type))) return ineligible('WRITER_INVENTORY_INCOMPLETE');
  if (input.registrations.some(record => !record.coordinated)) return ineligible('WRITER_NOT_COORDINATED');
  if (input.registrations.some(record => record.registrationState !== 'disabled'
    && record.coordinationEpoch !== authority.coordinationEpoch)) {
    return ineligible('COORDINATION_EPOCH_STALE');
  }
  if (input.registrations.some(record => record.registrationState !== 'disabled'
    && record.registrationState !== 'drain_acknowledged')) return ineligible('DRAIN_TIMEOUT_UNPROVEN');
  if (input.registrations.some(record => record.registrationState === 'drain_acknowledged'
    && record.acknowledgedTransitionRevision !== authority.transitionRevision)) {
    return ineligible('DRAIN_TIMEOUT_UNPROVEN');
  }
  if (input.restoreOrImportActive) return ineligible('RESTORE_OR_IMPORT_ACTIVE');
  if (input.syncWriterActive) return ineligible('SYNC_WRITER_ACTIVE');
  if (authority.admissionOpen || ['OPEN', 'DRAIN_REQUESTED'].includes(authority.state)) {
    return ineligible('ADMISSION_NOT_CLOSED');
  }
  if (authority.state !== 'VERIFYING_SOURCE') return ineligible('SOURCE_REVISION_UNSTABLE');
  if (input.operations.length > WRITER_COORDINATION_LIMITS.operations
    || input.operations.some(operation => !validateAdmissionOperation(operation))) {
    return ineligible('IN_FLIGHT_STATE_AMBIGUOUS');
  }
  if (new Set(input.operations.map(operation => operation.operationId)).size !== input.operations.length) {
    return ineligible('IN_FLIGHT_STATE_AMBIGUOUS');
  }
  if (input.operations.some(operation => operation.physicalSourceDigest !== authority.physicalSourceDigest)) {
    return ineligible('IN_FLIGHT_STATE_AMBIGUOUS');
  }
  if (input.operations.some(operation => !input.registrations.some(registration =>
    registration.writerTypeId === operation.writerTypeId
      && registration.writerId === operation.writerId
      && registration.sessionId === operation.sessionId))) {
    return ineligible('IN_FLIGHT_STATE_AMBIGUOUS');
  }
  const activeOperations = input.operations.filter(operation => operation.state === 'admitted');
  if (activeOperations.some(operation => operation.admissionTransitionRevision >= authority.transitionRevision)) {
    return ineligible('IN_FLIGHT_STATE_AMBIGUOUS');
  }
  if (activeOperations.some(operation => operation.coordinationEpoch !== authority.coordinationEpoch)) {
    return ineligible('COORDINATION_EPOCH_STALE');
  }
  if (activeOperations.length > 0 || authority.unresolvedOperationCount > 0) {
    return ineligible('IN_FLIGHT_WRITE_PRESENT');
  }
  const sourceError = validateSourceAssessment(input.source);
  if (sourceError) return ineligible(sourceError);
  if (input.source.physicalSourceDigest !== authority.physicalSourceDigest) {
    return ineligible('K328_PHYSICAL_IDENTITY_MISMATCH');
  }
  if (!input.k328AdapterAvailable) return ineligible('K328_ADAPTER_UNAVAILABLE');
  if (input.k328PhysicalSourceDigest !== authority.physicalSourceDigest) {
    return ineligible('K328_PHYSICAL_IDENTITY_MISMATCH');
  }
  if (authority.sourceRevisionBefore !== input.source.revisionBefore
    || authority.sourceRevisionAfter !== input.source.revisionAfter) return ineligible('SOURCE_REVISION_UNSTABLE');
  if (authority.sourceDigestBefore !== input.source.digestBefore
    || authority.sourceDigestAfter !== input.source.digestAfter) return ineligible('SOURCE_CHANGED_DURING_VERIFICATION');

  const evidence: EligibilityEvidenceRecord = Object.freeze({
    kind: 'absinthe_writer_eligibility_evidence',
    schemaVersion: 1,
    byteFormatVersion: 1,
    strategy: WRITER_COORDINATION_STRATEGY,
    physicalSourceDigest: authority.physicalSourceDigest,
    coordinationEpoch: authority.coordinationEpoch,
    authoritativeSource: 'indexeddb',
    writerSetDigest: expectedDigest,
    stableRevision: input.source.revisionAfter!,
    stableSourceDigest: input.source.digestAfter!,
    authorityTransitionRevision: authority.transitionRevision,
    result: 'eligible',
  });
  return {
    eligible: true,
    strategy: WRITER_COORDINATION_STRATEGY,
    physicalSourceDigest: authority.physicalSourceDigest,
    coordinationEpoch: authority.coordinationEpoch,
    authoritativeSource: 'indexeddb',
    writerSetDigest: expectedDigest,
    stableRevision: input.source.revisionAfter!,
    evidenceDigest: sha256Hex(canonicalEvidence(evidence)),
    evidence,
  };
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
  return !input.authority.admissionOpen
    && input.authority.unresolvedOperationCount === 0
    && input.operations.every(operation => operation.state !== 'admitted')
    && input.registrations.every(record => record.coordinated
      && (record.registrationState === 'disabled' || record.registrationState === 'drain_acknowledged'))
    && input.writerSetDigestBefore === input.writerSetDigestAfter
    && input.source.revisionBefore === input.source.revisionAfter
    && input.source.digestBefore === input.source.digestAfter
    && input.source.source === 'indexeddb'
    && input.k328AdapterAvailable
    && input.k328PhysicalSourceDigest === result.physicalSourceDigest;
}
