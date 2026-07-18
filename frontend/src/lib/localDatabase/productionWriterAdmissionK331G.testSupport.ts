import { createHash } from 'node:crypto';

import type { AttachmentMetadata } from '../attachmentRepository';

export const K331G_LIMITS = Object.freeze({
  maxIdentifierBytes: 256,
  maxArrayEntries: 128,
  maxSegmentPathNodes: 6,
  maxMmrComponentNodes: 92,
  maxCompleteMembershipNodes: 98,
  maxProtocolNodes: 104,
  maxEncodedProofBytes: 32 * 1024,
});

export const K331G_STABLE_ERRORS = Object.freeze({
  CANONICAL_VALUE_INVALID: 'CORRUPTION',
  RECORD_KIND_INVALID: 'CORRUPTION',
  PROTOCOL_VERSION_UNSUPPORTED: 'OWNER_INTERVENTION',
  RECORD_FIELDS_INVALID: 'CORRUPTION',
  IDENTIFIER_INVALID: 'CORRUPTION',
  DIGEST_INVALID: 'CORRUPTION',
  REVISION_INVALID: 'CORRUPTION',
  RELATIONSHIP_VERSION_UNSUPPORTED: 'OWNER_INTERVENTION',
  AUTHORITY_RECORD_MISSING: 'OWNER_INTERVENTION',
  AUTHORITY_BINDING_MISMATCH: 'OWNER_INTERVENTION',
  MMR_STATE_MISMATCH: 'OWNER_INTERVENTION',
  PROOF_NODE_LIMIT_EXCEEDED: 'NON_RETRYABLE',
  PROOF_ENCODED_LIMIT_EXCEEDED: 'NON_RETRYABLE',
  COMPACTED_PROJECTION_INVALID: 'CORRUPTION',
  COMPACTION_BOUNDARY_MISMATCH: 'OWNER_INTERVENTION',
  LIFECYCLE_LINEAGE_INVALID: 'CORRUPTION',
  LATEST_TOMBSTONE_REQUIRED: 'OWNER_INTERVENTION',
  BOOTSTRAP_ACCUMULATOR_INVALID: 'CORRUPTION',
  BOOTSTRAP_SEGMENT_INVALID: 'CORRUPTION',
  BOOTSTRAP_CONTINUATION_INVALID: 'OWNER_INTERVENTION',
  BOOTSTRAP_TERMINAL_INVALID: 'OWNER_INTERVENTION',
  BOOTSTRAP_INCOMPLETE: 'OWNER_INTERVENTION',
  RESTORE_GRAPH_INVALID: 'CORRUPTION',
  RESTORE_COMPONENT_MISMATCH: 'OWNER_INTERVENTION',
  RESTORE_TERMINAL_INCOMPLETE: 'OWNER_INTERVENTION',
  RESTORE_MANIFEST_MISMATCH: 'OWNER_INTERVENTION',
  ATTACHMENT_CLASSIFICATION_MISMATCH: 'OWNER_INTERVENTION',
} as const);

export type StableErrorCode = keyof typeof K331G_STABLE_ERRORS;
export type ProtocolResult<T> = Readonly<{ ok: true; value: T }>
  | Readonly<{ ok: false; code: StableErrorCode }>;

const ok = <T>(value: T): ProtocolResult<T> => Object.freeze({ ok: true, value });
const fail = <T = never>(code: StableErrorCode): ProtocolResult<T> => Object.freeze({ ok: false, code });

interface CanonicalObject { readonly [key: string]: CanonicalValue }
type CanonicalValue = null | boolean | number | string | readonly CanonicalValue[] | CanonicalObject;

function plainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function exactObject(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  if (!plainObject(value)) return false;
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function normalizeCanonical(value: unknown): ProtocolResult<CanonicalValue> {
  if (value === null || typeof value === 'boolean') return ok(value);
  if (typeof value === 'string') return ok(value.normalize('NFC'));
  if (typeof value === 'number') return Number.isSafeInteger(value)
    ? ok(value) : fail('CANONICAL_VALUE_INVALID');
  if (Array.isArray(value)) {
    const normalized: CanonicalValue[] = [];
    for (const entry of value) {
      const result = normalizeCanonical(entry);
      if (!result.ok) return result;
      normalized.push(result.value);
    }
    return ok(Object.freeze(normalized));
  }
  if (!plainObject(value)) return fail('CANONICAL_VALUE_INVALID');
  const normalized: Record<string, CanonicalValue> = {};
  const normalizedKeys = new Set<string>();
  for (const key of Object.keys(value).sort()) {
    const normalizedKey = key.normalize('NFC');
    if (normalizedKeys.has(normalizedKey)) return fail('CANONICAL_VALUE_INVALID');
    const result = normalizeCanonical(value[key]);
    if (!result.ok) return result;
    normalizedKeys.add(normalizedKey);
    normalized[normalizedKey] = result.value;
  }
  return ok(Object.freeze(normalized));
}

export function canonicalDigest(domain: unknown, value: unknown): ProtocolResult<string> {
  if (typeof domain !== 'string' || domain.length === 0) return fail('CANONICAL_VALUE_INVALID');
  const normalized = normalizeCanonical(Object.freeze([domain, 1, value]));
  if (!normalized.ok) return normalized;
  return ok(createHash('sha256').update(JSON.stringify(normalized.value)).digest('hex'));
}

function fixtureDigest(domain: string, value: unknown): string {
  const result = canonicalDigest(domain, value);
  if (!result.ok) throw new Error(`invalid deterministic fixture:${result.code}`);
  return result.value;
}

const DIGEST = /^[0-9a-f]{64}$/;
const IDENTIFIER = /^[a-z][a-z0-9_.:-]{2,255}$/;
const REVISION = /^(0|[1-9][0-9]{0,15})$/;
const encoder = new TextEncoder();

function digest(value: unknown): value is string {
  return typeof value === 'string' && DIGEST.test(value);
}

function identifier(value: unknown): value is string {
  return typeof value === 'string' && IDENTIFIER.test(value)
    && encoder.encode(value).byteLength <= K331G_LIMITS.maxIdentifierBytes;
}

function revision(value: unknown): value is string {
  return typeof value === 'string' && REVISION.test(value);
}

function nonNegativeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

function positiveInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) > 0;
}

function strings(value: unknown, validator: (entry: unknown) => entry is string = identifier): value is string[] {
  return Array.isArray(value) && value.length <= K331G_LIMITS.maxArrayEntries && value.every(validator);
}

function recordDigest(domain: string, value: Record<string, unknown>, digestField: string): ProtocolResult<string> {
  const payload = Object.fromEntries(Object.entries(value).filter(([key]) => key !== digestField));
  return canonicalDigest(domain, payload);
}

function verifyRecordDigest(domain: string, value: Record<string, unknown>, field: string): ProtocolResult<true> {
  if (!digest(value[field])) return fail('DIGEST_INVALID');
  const computed = recordDigest(domain, value, field);
  if (!computed.ok) return computed;
  return computed.value === value[field] ? ok(true) : fail('DIGEST_INVALID');
}

function seal<T extends Record<string, unknown>>(domain: string, value: T, digestField: string): Readonly<T & Record<string, string>> {
  return Object.freeze({ ...value, [digestField]: fixtureDigest(domain, value) }) as Readonly<T & Record<string, string>>;
}

export type PersistedRecord = Readonly<Record<string, unknown>>;

export interface AuthorityReader {
  read(recordId: string): unknown | null;
}

export class InMemoryAuthorityRepository implements AuthorityReader {
  readonly records = new Map<string, unknown>();

  constructor(records: readonly PersistedRecord[] = []) {
    for (const record of records) this.put(record);
  }

  read(recordId: string): unknown | null {
    return this.records.get(recordId) ?? null;
  }

  put(record: PersistedRecord): void {
    if (!identifier(record.id)) throw new Error('fixture record requires canonical id');
    this.records.set(record.id, Object.freeze(structuredClone(record)));
  }

  delete(recordId: string): void { this.records.delete(recordId); }

  copy(): InMemoryAuthorityRepository {
    return new InMemoryAuthorityRepository([...this.records.values()] as PersistedRecord[]);
  }
}

type WriterIdentityRecord = Readonly<{ kind: 'absinthe_writer_identity'; version: 1; id: string;
  writerType: string; manifestDigest: string; writerDigest: string }>;
type WriterSessionRecord = Readonly<{ kind: 'absinthe_writer_session'; version: 1; id: string;
  writerId: string; epoch: number; capabilityDigest: string; sessionDigest: string }>;
type AdmissionRecord = Readonly<{ kind: 'absinthe_k330_admission'; version: 1; id: string;
  operationId: string; writerId: string; sessionId: string; decision: 'admitted'; admissionDigest: string }>;
type OperationRecord = Readonly<{ kind: 'absinthe_k330_operation'; version: 1; id: string;
  namespace: string; generation: string; admissionId: string; admissionDigest: string; writerId: string;
  writerDigest: string; sessionId: string; sessionDigest: string; mutationKind: 'note_upsert' | 'note_tombstone';
  committedRevision: string; affectedIdentityDigest: string; canonicalInputDigest: string; resultDigest: string; outboxId: string;
  outboxIntentDigest: string; operationDigest: string }>;
type TerminalRecord = Readonly<{ kind: 'absinthe_terminal_state'; version: 1; id: string;
  operationId: string; state: 'committed'; resultDigest: string; terminalDigest: string }>;
type OutboxRecord = Readonly<{ kind: 'absinthe_immutable_outbox_intent'; version: 1; id: string;
  operationId: string; intentDigest: string; outboxDigest: string }>;
type CheckpointRecord = Readonly<{ kind: 'absinthe_segment_checkpoint'; version: 1; id: string;
  namespace: string; generation: string; segmentIndex: number; receiptCount: number; firstRevision: string;
  lastRevision: string; segmentRoot: string; previousCheckpointDigest: string | null; checkpointDigest: string }>;
type MmrStateRecord = Readonly<{ kind: 'absinthe_mmr_state'; version: 1; id: string; namespace: string;
  generation: string; checkpointDigests: readonly string[]; leafCount: number; root: string; stateDigest: string }>;
type LifecycleEventRecord = Readonly<{ kind: 'absinthe_lifecycle_event'; version: 1; id: string;
  sourceIdentityDigest: string; sequence: number; eventKind: 'tombstone' | 'resurrection';
  predecessorId: string | null; predecessorDigest: string | null; eventDigest: string }>;
type LifecycleHeadRecord = Readonly<{ kind: 'absinthe_lifecycle_head'; version: 1; id: string;
  sourceIdentityDigest: string; latestEventId: string; latestEventDigest: string; eventCount: number;
  headDigest: string }>;
type SourceAuthorityRecord = Readonly<{ kind: 'absinthe_source_authority'; version: 1; id: string;
  namespace: string; generation: string; sourceRevision: string; operationRegistryRoot: string;
  terminalRoot: string; outboxRoot: string; mmrStateId: string; mmrStateDigest: string;
  lifecycleHeadId: string | null; lifecycleHeadDigest: string | null; authorityDigest: string }>;
type TransactionReferenceRecord = Readonly<{ kind: 'absinthe_source_transaction_reference'; version: 1;
  id: string; sourceAuthorityId: string; sourceAuthorityDigest: string; operationId: string;
  operationDigest: string; admissionId: string; admissionDigest: string; writerId: string; writerDigest: string;
  sessionId: string; sessionDigest: string; terminalId: string; terminalDigest: string; outboxId: string;
  outboxDigest: string; mmrStateId: string; mmrStateDigest: string; checkpointId: string;
  checkpointDigest: string; graphVersion: 1; referenceDigest: string }>;
type RawReceiptRecord = Readonly<{ kind: 'absinthe_raw_source_receipt'; version: 1; id: string;
  transactionReferenceId: string; operationId: string; committedRevision: string; checkpointId: string;
  segmentIndex: number; leafIndex: number; proofEncoded: string; receiptDigest: string }>;

type ProofNode = Readonly<{ side: 'left' | 'right'; digest: string }>;
type BoundedProof = Readonly<{ version: 1; segmentNodes: readonly ProofNode[];
  mmrNodes: readonly ProofNode[]; outerNodes: readonly string[] }>;

type CompactedProjectionRecord = Readonly<{ kind: 'absinthe_compacted_authority_projection'; version: 1;
  id: string; transactionReferenceId: string; originalReceiptDigest: string; checkpointId: string;
  checkpointDigest: string; segmentIndex: number; leafIndex: number; proofEncoded: string;
  compactionBoundaryDigest: string; projectionDigest: string }>;

function decodeWriterIdentity(value: unknown): ProtocolResult<WriterIdentityRecord> {
  if (!exactObject(value, ['kind', 'version', 'id', 'writerType', 'manifestDigest', 'writerDigest'])) return fail('RECORD_FIELDS_INVALID');
  if (value.kind !== 'absinthe_writer_identity') return fail('RECORD_KIND_INVALID');
  if (value.version !== 1) return fail('PROTOCOL_VERSION_UNSUPPORTED');
  if (!identifier(value.id) || !identifier(value.writerType) || !digest(value.manifestDigest)) return fail('IDENTIFIER_INVALID');
  const checked = verifyRecordDigest('ABSINTHE_WRITER_IDENTITY_V1', value, 'writerDigest');
  return checked.ok ? ok(Object.freeze(value as unknown as WriterIdentityRecord)) : checked;
}

function decodeWriterSession(value: unknown): ProtocolResult<WriterSessionRecord> {
  if (!exactObject(value, ['kind', 'version', 'id', 'writerId', 'epoch', 'capabilityDigest', 'sessionDigest'])) return fail('RECORD_FIELDS_INVALID');
  if (value.kind !== 'absinthe_writer_session') return fail('RECORD_KIND_INVALID');
  if (value.version !== 1) return fail('PROTOCOL_VERSION_UNSUPPORTED');
  if (!identifier(value.id) || !identifier(value.writerId) || !positiveInteger(value.epoch)
    || !digest(value.capabilityDigest)) return fail('IDENTIFIER_INVALID');
  const checked = verifyRecordDigest('ABSINTHE_WRITER_SESSION_V1', value, 'sessionDigest');
  return checked.ok ? ok(Object.freeze(value as unknown as WriterSessionRecord)) : checked;
}

function decodeAdmission(value: unknown): ProtocolResult<AdmissionRecord> {
  if (!exactObject(value, ['kind', 'version', 'id', 'operationId', 'writerId', 'sessionId', 'decision', 'admissionDigest'])) return fail('RECORD_FIELDS_INVALID');
  if (value.kind !== 'absinthe_k330_admission') return fail('RECORD_KIND_INVALID');
  if (value.version !== 1) return fail('PROTOCOL_VERSION_UNSUPPORTED');
  if (![value.id, value.operationId, value.writerId, value.sessionId].every(identifier)
    || value.decision !== 'admitted') return fail('IDENTIFIER_INVALID');
  const checked = verifyRecordDigest('ABSINTHE_K330_ADMISSION_V1', value, 'admissionDigest');
  return checked.ok ? ok(Object.freeze(value as unknown as AdmissionRecord)) : checked;
}

function decodeOperation(value: unknown): ProtocolResult<OperationRecord> {
  const keys = ['kind', 'version', 'id', 'namespace', 'generation', 'admissionId', 'admissionDigest',
    'writerId', 'writerDigest', 'sessionId', 'sessionDigest', 'mutationKind', 'affectedIdentityDigest',
    'committedRevision', 'canonicalInputDigest', 'resultDigest', 'outboxId', 'outboxIntentDigest', 'operationDigest'];
  if (!exactObject(value, keys)) return fail('RECORD_FIELDS_INVALID');
  if (value.kind !== 'absinthe_k330_operation') return fail('RECORD_KIND_INVALID');
  if (value.version !== 1) return fail('PROTOCOL_VERSION_UNSUPPORTED');
  if (![value.id, value.namespace, value.generation, value.admissionId, value.writerId, value.sessionId,
    value.outboxId].every(identifier)) return fail('IDENTIFIER_INVALID');
  if (!['note_upsert', 'note_tombstone'].includes(value.mutationKind as string)
    || !revision(value.committedRevision)
    || ![value.admissionDigest, value.writerDigest, value.sessionDigest, value.affectedIdentityDigest,
      value.canonicalInputDigest, value.resultDigest, value.outboxIntentDigest].every(digest)) return fail('DIGEST_INVALID');
  const checked = verifyRecordDigest('ABSINTHE_K330_OPERATION_V1', value, 'operationDigest');
  return checked.ok ? ok(Object.freeze(value as unknown as OperationRecord)) : checked;
}

function decodeTerminal(value: unknown): ProtocolResult<TerminalRecord> {
  if (!exactObject(value, ['kind', 'version', 'id', 'operationId', 'state', 'resultDigest', 'terminalDigest'])) return fail('RECORD_FIELDS_INVALID');
  if (value.kind !== 'absinthe_terminal_state') return fail('RECORD_KIND_INVALID');
  if (value.version !== 1) return fail('PROTOCOL_VERSION_UNSUPPORTED');
  if (!identifier(value.id) || !identifier(value.operationId) || value.state !== 'committed'
    || !digest(value.resultDigest)) return fail('IDENTIFIER_INVALID');
  const checked = verifyRecordDigest('ABSINTHE_TERMINAL_STATE_V1', value, 'terminalDigest');
  return checked.ok ? ok(Object.freeze(value as unknown as TerminalRecord)) : checked;
}

function decodeOutbox(value: unknown): ProtocolResult<OutboxRecord> {
  if (!exactObject(value, ['kind', 'version', 'id', 'operationId', 'intentDigest', 'outboxDigest'])) return fail('RECORD_FIELDS_INVALID');
  if (value.kind !== 'absinthe_immutable_outbox_intent') return fail('RECORD_KIND_INVALID');
  if (value.version !== 1) return fail('PROTOCOL_VERSION_UNSUPPORTED');
  if (!identifier(value.id) || !identifier(value.operationId) || !digest(value.intentDigest)) return fail('IDENTIFIER_INVALID');
  const checked = verifyRecordDigest('ABSINTHE_IMMUTABLE_OUTBOX_V1', value, 'outboxDigest');
  return checked.ok ? ok(Object.freeze(value as unknown as OutboxRecord)) : checked;
}

function decodeCheckpoint(value: unknown): ProtocolResult<CheckpointRecord> {
  const keys = ['kind', 'version', 'id', 'namespace', 'generation', 'segmentIndex', 'receiptCount',
    'firstRevision', 'lastRevision', 'segmentRoot', 'previousCheckpointDigest', 'checkpointDigest'];
  if (!exactObject(value, keys)) return fail('RECORD_FIELDS_INVALID');
  if (value.kind !== 'absinthe_segment_checkpoint') return fail('RECORD_KIND_INVALID');
  if (value.version !== 1) return fail('PROTOCOL_VERSION_UNSUPPORTED');
  if (![value.id, value.namespace, value.generation].every(identifier)) return fail('IDENTIFIER_INVALID');
  if (!nonNegativeInteger(value.segmentIndex) || !positiveInteger(value.receiptCount)
    || !revision(value.firstRevision) || !revision(value.lastRevision)) return fail('REVISION_INVALID');
  if (!digest(value.segmentRoot) || value.previousCheckpointDigest !== null && !digest(value.previousCheckpointDigest)) return fail('DIGEST_INVALID');
  const checked = verifyRecordDigest('ABSINTHE_SEGMENT_CHECKPOINT_V1', value, 'checkpointDigest');
  return checked.ok ? ok(Object.freeze(value as unknown as CheckpointRecord)) : checked;
}

function decodeMmrState(value: unknown): ProtocolResult<MmrStateRecord> {
  const keys = ['kind', 'version', 'id', 'namespace', 'generation', 'checkpointDigests', 'leafCount', 'root', 'stateDigest'];
  if (!exactObject(value, keys)) return fail('RECORD_FIELDS_INVALID');
  if (value.kind !== 'absinthe_mmr_state') return fail('RECORD_KIND_INVALID');
  if (value.version !== 1) return fail('PROTOCOL_VERSION_UNSUPPORTED');
  if (![value.id, value.namespace, value.generation].every(identifier)) return fail('IDENTIFIER_INVALID');
  if (!strings(value.checkpointDigests, digest) || value.checkpointDigests.length !== value.leafCount
    || !digest(value.root)) return fail('MMR_STATE_MISMATCH');
  const expectedRoot = fixtureDigest('ABSINTHE_MMR_ROOT_V1', value.checkpointDigests);
  if (value.root !== expectedRoot) return fail('MMR_STATE_MISMATCH');
  const checked = verifyRecordDigest('ABSINTHE_MMR_STATE_V1', value, 'stateDigest');
  return checked.ok ? ok(Object.freeze(value as unknown as MmrStateRecord)) : checked;
}

function decodeLifecycleEvent(value: unknown): ProtocolResult<LifecycleEventRecord> {
  const keys = ['kind', 'version', 'id', 'sourceIdentityDigest', 'sequence', 'eventKind',
    'predecessorId', 'predecessorDigest', 'eventDigest'];
  if (!exactObject(value, keys)) return fail('RECORD_FIELDS_INVALID');
  if (value.kind !== 'absinthe_lifecycle_event') return fail('RECORD_KIND_INVALID');
  if (value.version !== 1) return fail('PROTOCOL_VERSION_UNSUPPORTED');
  if (!identifier(value.id) || !digest(value.sourceIdentityDigest) || !positiveInteger(value.sequence)
    || !['tombstone', 'resurrection'].includes(value.eventKind as string)
    || value.predecessorId !== null && !identifier(value.predecessorId)
    || value.predecessorDigest !== null && !digest(value.predecessorDigest)) return fail('LIFECYCLE_LINEAGE_INVALID');
  if ((value.sequence === 1) !== (value.predecessorId === null && value.predecessorDigest === null)) {
    return fail('LIFECYCLE_LINEAGE_INVALID');
  }
  const checked = verifyRecordDigest('ABSINTHE_LIFECYCLE_EVENT_V1', value, 'eventDigest');
  return checked.ok ? ok(Object.freeze(value as unknown as LifecycleEventRecord)) : checked;
}

function decodeLifecycleHead(value: unknown): ProtocolResult<LifecycleHeadRecord> {
  const keys = ['kind', 'version', 'id', 'sourceIdentityDigest', 'latestEventId', 'latestEventDigest',
    'eventCount', 'headDigest'];
  if (!exactObject(value, keys)) return fail('RECORD_FIELDS_INVALID');
  if (value.kind !== 'absinthe_lifecycle_head') return fail('RECORD_KIND_INVALID');
  if (value.version !== 1) return fail('PROTOCOL_VERSION_UNSUPPORTED');
  if (!identifier(value.id) || !identifier(value.latestEventId) || !digest(value.sourceIdentityDigest)
    || !digest(value.latestEventDigest) || !positiveInteger(value.eventCount)) return fail('LIFECYCLE_LINEAGE_INVALID');
  const checked = verifyRecordDigest('ABSINTHE_LIFECYCLE_HEAD_V1', value, 'headDigest');
  return checked.ok ? ok(Object.freeze(value as unknown as LifecycleHeadRecord)) : checked;
}

function decodeSourceAuthority(value: unknown): ProtocolResult<SourceAuthorityRecord> {
  const keys = ['kind', 'version', 'id', 'namespace', 'generation', 'sourceRevision',
    'operationRegistryRoot', 'terminalRoot', 'outboxRoot', 'mmrStateId', 'mmrStateDigest',
    'lifecycleHeadId', 'lifecycleHeadDigest', 'authorityDigest'];
  if (!exactObject(value, keys)) return fail('RECORD_FIELDS_INVALID');
  if (value.kind !== 'absinthe_source_authority') return fail('RECORD_KIND_INVALID');
  if (value.version !== 1) return fail('PROTOCOL_VERSION_UNSUPPORTED');
  if (![value.id, value.namespace, value.generation, value.mmrStateId].every(identifier)) return fail('IDENTIFIER_INVALID');
  if (!revision(value.sourceRevision) || ![value.operationRegistryRoot, value.terminalRoot, value.outboxRoot,
    value.mmrStateDigest].every(digest)) return fail('DIGEST_INVALID');
  if ((value.lifecycleHeadId === null) !== (value.lifecycleHeadDigest === null)
    || value.lifecycleHeadId !== null && (!identifier(value.lifecycleHeadId) || !digest(value.lifecycleHeadDigest))) {
    return fail('AUTHORITY_BINDING_MISMATCH');
  }
  const checked = verifyRecordDigest('ABSINTHE_SOURCE_AUTHORITY_V1', value, 'authorityDigest');
  return checked.ok ? ok(Object.freeze(value as unknown as SourceAuthorityRecord)) : checked;
}

function decodeTransactionReference(value: unknown): ProtocolResult<TransactionReferenceRecord> {
  const keys = ['kind', 'version', 'id', 'sourceAuthorityId', 'sourceAuthorityDigest', 'operationId',
    'operationDigest', 'admissionId', 'admissionDigest', 'writerId', 'writerDigest', 'sessionId',
    'sessionDigest', 'terminalId', 'terminalDigest', 'outboxId', 'outboxDigest', 'mmrStateId',
    'mmrStateDigest', 'checkpointId', 'checkpointDigest', 'graphVersion', 'referenceDigest'];
  if (!exactObject(value, keys)) return fail('RECORD_FIELDS_INVALID');
  if (value.kind !== 'absinthe_source_transaction_reference') return fail('RECORD_KIND_INVALID');
  if (value.version !== 1 || value.graphVersion !== 1) return fail('PROTOCOL_VERSION_UNSUPPORTED');
  if (![value.id, value.sourceAuthorityId, value.operationId, value.admissionId, value.writerId,
    value.sessionId, value.terminalId, value.outboxId, value.mmrStateId, value.checkpointId].every(identifier)) {
    return fail('IDENTIFIER_INVALID');
  }
  if (![value.sourceAuthorityDigest, value.operationDigest, value.admissionDigest, value.writerDigest,
    value.sessionDigest, value.terminalDigest, value.outboxDigest, value.mmrStateDigest,
    value.checkpointDigest].every(digest)) return fail('DIGEST_INVALID');
  const checked = verifyRecordDigest('ABSINTHE_TRANSACTION_REFERENCE_V1', value, 'referenceDigest');
  return checked.ok ? ok(Object.freeze(value as unknown as TransactionReferenceRecord)) : checked;
}

function decodeRawReceipt(value: unknown): ProtocolResult<RawReceiptRecord> {
  const keys = ['kind', 'version', 'id', 'transactionReferenceId', 'operationId', 'committedRevision',
    'checkpointId', 'segmentIndex', 'leafIndex', 'proofEncoded', 'receiptDigest'];
  if (!exactObject(value, keys)) return fail('RECORD_FIELDS_INVALID');
  if (value.kind !== 'absinthe_raw_source_receipt') return fail('RECORD_KIND_INVALID');
  if (value.version !== 1) return fail('PROTOCOL_VERSION_UNSUPPORTED');
  if (![value.id, value.transactionReferenceId, value.operationId, value.checkpointId].every(identifier)) return fail('IDENTIFIER_INVALID');
  if (!revision(value.committedRevision) || !nonNegativeInteger(value.segmentIndex)
    || !nonNegativeInteger(value.leafIndex) || typeof value.proofEncoded !== 'string') return fail('REVISION_INVALID');
  const checked = verifyRecordDigest('ABSINTHE_RAW_RECEIPT_V1', value, 'receiptDigest');
  return checked.ok ? ok(Object.freeze(value as unknown as RawReceiptRecord)) : checked;
}

function decodeCompactedProjection(value: unknown): ProtocolResult<CompactedProjectionRecord> {
  const keys = ['kind', 'version', 'id', 'transactionReferenceId', 'originalReceiptDigest',
    'checkpointId', 'checkpointDigest', 'segmentIndex', 'leafIndex', 'proofEncoded',
    'compactionBoundaryDigest', 'projectionDigest'];
  if (!exactObject(value, keys)) return fail('COMPACTED_PROJECTION_INVALID');
  if (value.kind !== 'absinthe_compacted_authority_projection') return fail('RECORD_KIND_INVALID');
  if (value.version !== 1) return fail('PROTOCOL_VERSION_UNSUPPORTED');
  if (![value.id, value.transactionReferenceId, value.checkpointId].every(identifier)
    || ![value.originalReceiptDigest, value.checkpointDigest, value.compactionBoundaryDigest].every(digest)
    || !nonNegativeInteger(value.segmentIndex) || !nonNegativeInteger(value.leafIndex)
    || typeof value.proofEncoded !== 'string') return fail('COMPACTED_PROJECTION_INVALID');
  const checked = verifyRecordDigest('ABSINTHE_COMPACTED_PROJECTION_V1', value, 'projectionDigest');
  return checked.ok ? ok(Object.freeze(value as unknown as CompactedProjectionRecord)) : checked;
}

function decodeProofNode(value: unknown): value is ProofNode {
  return exactObject(value, ['side', 'digest']) && ['left', 'right'].includes(value.side as string)
    && digest(value.digest);
}

export function decodeBoundedProof(encoded: unknown): ProtocolResult<BoundedProof> {
  if (typeof encoded !== 'string') return fail('RECORD_FIELDS_INVALID');
  if (encoder.encode(encoded).byteLength > K331G_LIMITS.maxEncodedProofBytes) {
    return fail('PROOF_ENCODED_LIMIT_EXCEEDED');
  }
  let value: unknown;
  try { value = JSON.parse(encoded); } catch { return fail('RECORD_FIELDS_INVALID'); }
  if (!exactObject(value, ['version', 'segmentNodes', 'mmrNodes', 'outerNodes'])) return fail('RECORD_FIELDS_INVALID');
  if (value.version !== 1) return fail('PROTOCOL_VERSION_UNSUPPORTED');
  if (!Array.isArray(value.segmentNodes) || !value.segmentNodes.every(decodeProofNode)
    || !Array.isArray(value.mmrNodes) || !value.mmrNodes.every(decodeProofNode)
    || !strings(value.outerNodes, digest)) return fail('RECORD_FIELDS_INVALID');
  const complete = value.segmentNodes.length + value.mmrNodes.length;
  const protocol = complete + value.outerNodes.length;
  if (value.segmentNodes.length > K331G_LIMITS.maxSegmentPathNodes
    || value.mmrNodes.length > K331G_LIMITS.maxMmrComponentNodes
    || complete > K331G_LIMITS.maxCompleteMembershipNodes
    || protocol > K331G_LIMITS.maxProtocolNodes) return fail('PROOF_NODE_LIMIT_EXCEEDED');
  return ok(Object.freeze({ version: 1, segmentNodes: Object.freeze(value.segmentNodes as ProofNode[]),
    mmrNodes: Object.freeze(value.mmrNodes as ProofNode[]), outerNodes: Object.freeze(value.outerNodes as string[]) }));
}

function foldProof(domain: string, leaf: string, nodes: readonly ProofNode[]): string {
  return nodes.reduce((current, node) => fixtureDigest(domain,
    node.side === 'left' ? [node.digest, current] : [current, node.digest]), leaf);
}

export type IndependentReconciliationAuthorityGraph = Readonly<{
  reference: TransactionReferenceRecord; sourceAuthority: SourceAuthorityRecord; operation: OperationRecord;
  admission: AdmissionRecord; writer: WriterIdentityRecord; session: WriterSessionRecord;
  terminal: TerminalRecord; outbox: OutboxRecord; mmrState: MmrStateRecord;
  checkpoint: CheckpointRecord; lifecycleHead: LifecycleHeadRecord | null; graphDigest: string;
}>;

function required<T>(value: unknown | null, decoder: (input: unknown) => ProtocolResult<T>): ProtocolResult<T> {
  return value === null ? fail('AUTHORITY_RECORD_MISSING') : decoder(value);
}

export function resolveIndependentReconciliationAuthorityGraph(reader: AuthorityReader,
  transactionReferenceId: string): ProtocolResult<IndependentReconciliationAuthorityGraph> {
  if (!identifier(transactionReferenceId)) return fail('IDENTIFIER_INVALID');
  const reference = required(reader.read(transactionReferenceId), decodeTransactionReference);
  if (!reference.ok) return reference;
  const sourceAuthority = required(reader.read(reference.value.sourceAuthorityId), decodeSourceAuthority);
  const operation = required(reader.read(reference.value.operationId), decodeOperation);
  const admission = required(reader.read(reference.value.admissionId), decodeAdmission);
  const writer = required(reader.read(reference.value.writerId), decodeWriterIdentity);
  const session = required(reader.read(reference.value.sessionId), decodeWriterSession);
  const terminal = required(reader.read(reference.value.terminalId), decodeTerminal);
  const outbox = required(reader.read(reference.value.outboxId), decodeOutbox);
  const mmrState = required(reader.read(reference.value.mmrStateId), decodeMmrState);
  const checkpoint = required(reader.read(reference.value.checkpointId), decodeCheckpoint);
  if (!sourceAuthority.ok) return sourceAuthority;
  if (!operation.ok) return operation;
  if (!admission.ok) return admission;
  if (!writer.ok) return writer;
  if (!session.ok) return session;
  if (!terminal.ok) return terminal;
  if (!outbox.ok) return outbox;
  if (!mmrState.ok) return mmrState;
  if (!checkpoint.ok) return checkpoint;
  const authority = sourceAuthority.value;
  const op = operation.value;
  const admitted = admission.value;
  const writerRecord = writer.value;
  const sessionRecord = session.value;
  const terminalRecord = terminal.value;
  const outboxRecord = outbox.value;
  const mmr = mmrState.value;
  const checkpointRecord = checkpoint.value;
  const ref = reference.value;
  const root = (domain: string, values: readonly string[]) => fixtureDigest(domain, values);
  if (ref.sourceAuthorityDigest !== authority.authorityDigest || ref.operationDigest !== op.operationDigest
    || ref.admissionDigest !== admitted.admissionDigest || ref.writerDigest !== writerRecord.writerDigest
    || ref.sessionDigest !== sessionRecord.sessionDigest || ref.terminalDigest !== terminalRecord.terminalDigest
    || ref.outboxDigest !== outboxRecord.outboxDigest || ref.mmrStateDigest !== mmr.stateDigest
    || ref.checkpointDigest !== checkpointRecord.checkpointDigest
    || op.admissionId !== admitted.id || op.admissionDigest !== admitted.admissionDigest
    || op.writerId !== writerRecord.id || op.writerDigest !== writerRecord.writerDigest
    || op.sessionId !== sessionRecord.id || op.sessionDigest !== sessionRecord.sessionDigest
    || admitted.operationId !== op.id || admitted.writerId !== writerRecord.id || admitted.sessionId !== sessionRecord.id
    || sessionRecord.writerId !== writerRecord.id || terminalRecord.operationId !== op.id
    || terminalRecord.resultDigest !== op.resultDigest || outboxRecord.operationId !== op.id
    || outboxRecord.intentDigest !== op.outboxIntentDigest || op.outboxId !== outboxRecord.id
    || authority.operationRegistryRoot !== root('ABSINTHE_OPERATION_REGISTRY_ROOT_V1', [op.operationDigest])
    || authority.terminalRoot !== root('ABSINTHE_TERMINAL_ROOT_V1', [terminalRecord.terminalDigest])
    || authority.outboxRoot !== root('ABSINTHE_OUTBOX_ROOT_V1', [outboxRecord.outboxDigest])
    || authority.mmrStateId !== mmr.id || authority.mmrStateDigest !== mmr.stateDigest
    || BigInt(authority.sourceRevision) < BigInt(op.committedRevision)
    || mmr.namespace !== authority.namespace || mmr.generation !== authority.generation
    || checkpointRecord.namespace !== authority.namespace || checkpointRecord.generation !== authority.generation
    || !mmr.checkpointDigests.includes(checkpointRecord.checkpointDigest)) return fail('AUTHORITY_BINDING_MISMATCH');
  let lifecycleHead: LifecycleHeadRecord | null = null;
  if (authority.lifecycleHeadId !== null) {
    const decoded = required(reader.read(authority.lifecycleHeadId), decodeLifecycleHead);
    if (!decoded.ok) return decoded;
    if (decoded.value.headDigest !== authority.lifecycleHeadDigest
      || decoded.value.sourceIdentityDigest !== op.affectedIdentityDigest) return fail('AUTHORITY_BINDING_MISMATCH');
    lifecycleHead = decoded.value;
  }
  const graphDigestResult = canonicalDigest('ABSINTHE_INDEPENDENT_AUTHORITY_GRAPH_V1', [ref.referenceDigest,
    authority.authorityDigest, op.operationDigest, admitted.admissionDigest, writerRecord.writerDigest,
    sessionRecord.sessionDigest, terminalRecord.terminalDigest, outboxRecord.outboxDigest,
    mmr.stateDigest, checkpointRecord.checkpointDigest, lifecycleHead?.headDigest ?? null]);
  if (!graphDigestResult.ok) return graphDigestResult;
  return ok(Object.freeze({ reference: ref, sourceAuthority: authority, operation: op, admission: admitted,
    writer: writerRecord, session: sessionRecord, terminal: terminalRecord, outbox: outboxRecord,
    mmrState: mmr, checkpoint: checkpointRecord, lifecycleHead, graphDigest: graphDigestResult.value }));
}

export type ReconciliationVerification = Readonly<{ transactionReferenceId: string; operationId: string;
  committedRevision: string; authorityDigest: string; graphDigest: string; evidenceKind: 'raw' | 'compacted' }>;

function verifyMembership(receiptDigest: string, segmentIndex: number, leafIndex: number,
  proofEncoded: string, graph: IndependentReconciliationAuthorityGraph): ProtocolResult<true> {
  const proof = decodeBoundedProof(proofEncoded);
  if (!proof.ok) return proof;
  if (graph.checkpoint.segmentIndex !== segmentIndex || leafIndex >= graph.checkpoint.receiptCount) {
    return fail('AUTHORITY_BINDING_MISMATCH');
  }
  const leaf = fixtureDigest('ABSINTHE_RECEIPT_LEAF_V1', [receiptDigest, segmentIndex, leafIndex]);
  const segmentRoot = foldProof('ABSINTHE_SEGMENT_NODE_V1', leaf, proof.value.segmentNodes);
  if (segmentRoot !== graph.checkpoint.segmentRoot) return fail('AUTHORITY_BINDING_MISMATCH');
  const mmrLeafRoot = fixtureDigest('ABSINTHE_MMR_ROOT_V1', [graph.checkpoint.checkpointDigest]);
  const mmrRoot = foldProof('ABSINTHE_MMR_NODE_V1', mmrLeafRoot, proof.value.mmrNodes);
  return mmrRoot === graph.mmrState.root ? ok(true) : fail('MMR_STATE_MISMATCH');
}

export function verifyRawReceipt(reader: AuthorityReader, receiptId: string): ProtocolResult<ReconciliationVerification> {
  const receipt = required(reader.read(receiptId), decodeRawReceipt);
  if (!receipt.ok) return receipt;
  const graph = resolveIndependentReconciliationAuthorityGraph(reader, receipt.value.transactionReferenceId);
  if (!graph.ok) return graph;
  if (receipt.value.operationId !== graph.value.operation.id || receipt.value.checkpointId !== graph.value.checkpoint.id
    || receipt.value.committedRevision !== graph.value.operation.committedRevision
    || BigInt(receipt.value.committedRevision) < BigInt(graph.value.checkpoint.firstRevision)
    || BigInt(receipt.value.committedRevision) > BigInt(graph.value.checkpoint.lastRevision)) {
    return fail('AUTHORITY_BINDING_MISMATCH');
  }
  const membership = verifyMembership(receipt.value.receiptDigest, receipt.value.segmentIndex,
    receipt.value.leafIndex, receipt.value.proofEncoded, graph.value);
  return membership.ok ? ok(Object.freeze({ transactionReferenceId: receipt.value.transactionReferenceId,
    operationId: graph.value.operation.id, committedRevision: receipt.value.committedRevision,
    authorityDigest: graph.value.sourceAuthority.authorityDigest, graphDigest: graph.value.graphDigest,
    evidenceKind: 'raw' as const })) : membership;
}

export function verifyCompactedProjection(reader: AuthorityReader,
  projectionId: string): ProtocolResult<ReconciliationVerification> {
  const projection = required(reader.read(projectionId), decodeCompactedProjection);
  if (!projection.ok) return projection;
  const graph = resolveIndependentReconciliationAuthorityGraph(reader, projection.value.transactionReferenceId);
  if (!graph.ok) return graph;
  if (projection.value.checkpointId !== graph.value.checkpoint.id
    || projection.value.checkpointDigest !== graph.value.checkpoint.checkpointDigest) {
    return fail('AUTHORITY_BINDING_MISMATCH');
  }
  const boundary = canonicalDigest('ABSINTHE_COMPACTION_BOUNDARY_V1', [projection.value.transactionReferenceId,
    projection.value.originalReceiptDigest, projection.value.checkpointDigest, graph.value.graphDigest]);
  if (!boundary.ok) return boundary;
  if (boundary.value !== projection.value.compactionBoundaryDigest) return fail('COMPACTION_BOUNDARY_MISMATCH');
  const membership = verifyMembership(projection.value.originalReceiptDigest, projection.value.segmentIndex,
    projection.value.leafIndex, projection.value.proofEncoded, graph.value);
  return membership.ok ? ok(Object.freeze({ transactionReferenceId: projection.value.transactionReferenceId,
    operationId: graph.value.operation.id, committedRevision: graph.value.operation.committedRevision,
    authorityDigest: graph.value.sourceAuthority.authorityDigest, graphDigest: graph.value.graphDigest,
    evidenceKind: 'compacted' as const })) : membership;
}

export type PurgeCertificate = Readonly<{ kind: 'absinthe_purge_certificate'; version: 1;
  transactionReferenceId: string; lifecycleHeadDigest: string; tombstoneEventDigest: string;
  purgeOperationId: string; purgeRevision: string; certificateDigest: string }>;

export function resolveLifecycle(reader: AuthorityReader, headId: string): ProtocolResult<readonly LifecycleEventRecord[]> {
  const head = required(reader.read(headId), decodeLifecycleHead);
  if (!head.ok) return head;
  const reverse: LifecycleEventRecord[] = [];
  let eventId: string | null = head.value.latestEventId;
  let expectedDigest: string | null = head.value.latestEventDigest;
  while (eventId !== null) {
    if (reverse.length >= head.value.eventCount) return fail('LIFECYCLE_LINEAGE_INVALID');
    const eventResult: ProtocolResult<LifecycleEventRecord> = required(reader.read(eventId), decodeLifecycleEvent);
    if (!eventResult.ok) return eventResult;
    if (eventResult.value.eventDigest !== expectedDigest
      || eventResult.value.sourceIdentityDigest !== head.value.sourceIdentityDigest) {
      return fail('LIFECYCLE_LINEAGE_INVALID');
    }
    reverse.push(eventResult.value);
    eventId = eventResult.value.predecessorId;
    expectedDigest = eventResult.value.predecessorDigest;
  }
  const events = reverse.reverse();
  if (events.length !== head.value.eventCount || events.some((event, index) => event.sequence !== index + 1)
    || events.some((event, index) => index > 0 && (event.predecessorId !== events[index - 1].id
      || event.predecessorDigest !== events[index - 1].eventDigest))) return fail('LIFECYCLE_LINEAGE_INVALID');
  return ok(Object.freeze(events));
}

export function authorizeLatestTombstonePurge(reader: AuthorityReader, transactionReferenceId: string,
  candidateEventId: string, purgeOperationId: string): ProtocolResult<PurgeCertificate> {
  const graph = resolveIndependentReconciliationAuthorityGraph(reader, transactionReferenceId);
  if (!graph.ok) return graph;
  if (!graph.value.lifecycleHead) return fail('LATEST_TOMBSTONE_REQUIRED');
  const events = resolveLifecycle(reader, graph.value.lifecycleHead.id);
  if (!events.ok) return events;
  const latest = events.value[events.value.length - 1];
  if (!latest || latest.id !== candidateEventId || latest.eventKind !== 'tombstone'
    || latest.sourceIdentityDigest !== graph.value.operation.affectedIdentityDigest) {
    return fail('LATEST_TOMBSTONE_REQUIRED');
  }
  if (!identifier(purgeOperationId)) return fail('IDENTIFIER_INVALID');
  const purgeRevision = (BigInt(graph.value.sourceAuthority.sourceRevision) + 1n).toString();
  const fields = [transactionReferenceId, graph.value.lifecycleHead.headDigest, latest.eventDigest,
    purgeOperationId, purgeRevision];
  const certificateDigest = canonicalDigest('ABSINTHE_PURGE_CERTIFICATE_V1', fields);
  if (!certificateDigest.ok) return certificateDigest;
  return ok(Object.freeze({ kind: 'absinthe_purge_certificate', version: 1,
    transactionReferenceId, lifecycleHeadDigest: graph.value.lifecycleHead.headDigest,
    tombstoneEventDigest: latest.eventDigest, purgeOperationId, purgeRevision,
    certificateDigest: certificateDigest.value }));
}

// Bootstrap authority records. The finalizer accepts only a session lookup ID.
type BootstrapItem = Readonly<{ kind: 'absinthe_bootstrap_item'; version: 1; id: string; sessionId: string;
  category: string; key: string; valueDigest: string; itemDigest: string }>;
type BootstrapSegment = Readonly<{ kind: 'absinthe_bootstrap_segment'; version: 1; id: string; sessionId: string;
  category: string; index: number; itemIds: readonly string[]; itemDigests: readonly string[];
  firstKey: string; lastKey: string; segmentRoot: string; continuationId: string; segmentDigest: string }>;
type BootstrapContinuation = Readonly<{ kind: 'absinthe_bootstrap_continuation'; version: 1; id: string;
  sessionId: string; category: string; segmentId: string; nextSegmentId: string | null;
  terminalId: string | null; continuationDigest: string }>;
type BootstrapAccumulator = Readonly<{ kind: 'absinthe_bootstrap_accumulator'; version: 1; id: string;
  sessionId: string; category: string; segmentIndex: number; priorAccumulatorId: string | null;
  priorAccumulatorDigest: string | null; segmentId: string; segmentDigest: string; recordCount: number;
  totalBytes: number; lastKey: string; chainRoot: string; accumulatorDigest: string }>;
type BootstrapTerminal = Readonly<{ kind: 'absinthe_bootstrap_terminal'; version: 1; id: string;
  sessionId: string; category: string; finalAccumulatorId: string; finalAccumulatorDigest: string;
  totalSegments: number; totalRecords: number; totalBytes: number; finalKey: string; snapshotDigest: string;
  exhausted: true; terminalDigest: string }>;
type BootstrapSession = Readonly<{ kind: 'absinthe_bootstrap_session'; version: 1; id: string;
  namespace: string; generation: string; baselineAuthorityDigest: string | null; manifestDigest: string;
  schemaVersion: 1; sourceProtocolVersion: 1; attachmentClassificationVersion: 1;
  categoryDefinitionVersion: 1; terminalRefs: readonly Readonly<{ category: string; terminalId: string }>[];
  sessionDigest: string }>;

function decodeBootstrapItem(value: unknown): ProtocolResult<BootstrapItem> {
  if (!exactObject(value, ['kind', 'version', 'id', 'sessionId', 'category', 'key', 'valueDigest', 'itemDigest'])) return fail('RECORD_FIELDS_INVALID');
  if (value.kind !== 'absinthe_bootstrap_item') return fail('RECORD_KIND_INVALID');
  if (value.version !== 1) return fail('PROTOCOL_VERSION_UNSUPPORTED');
  if (![value.id, value.sessionId, value.category].every(identifier) || typeof value.key !== 'string'
    || value.key !== value.key.normalize('NFC') || !digest(value.valueDigest)) return fail('BOOTSTRAP_SEGMENT_INVALID');
  const checked = verifyRecordDigest('ABSINTHE_BOOTSTRAP_ITEM_V1', value, 'itemDigest');
  return checked.ok ? ok(Object.freeze(value as unknown as BootstrapItem)) : checked;
}

function decodeBootstrapSegment(value: unknown): ProtocolResult<BootstrapSegment> {
  const keys = ['kind', 'version', 'id', 'sessionId', 'category', 'index', 'itemIds', 'itemDigests',
    'firstKey', 'lastKey', 'segmentRoot', 'continuationId', 'segmentDigest'];
  if (!exactObject(value, keys)) return fail('RECORD_FIELDS_INVALID');
  if (value.kind !== 'absinthe_bootstrap_segment') return fail('RECORD_KIND_INVALID');
  if (value.version !== 1) return fail('PROTOCOL_VERSION_UNSUPPORTED');
  if (![value.id, value.sessionId, value.category, value.continuationId].every(identifier)
    || !nonNegativeInteger(value.index) || !strings(value.itemIds) || !strings(value.itemDigests, digest)
    || value.itemIds.length === 0 || value.itemIds.length !== value.itemDigests.length
    || new Set(value.itemIds).size !== value.itemIds.length || typeof value.firstKey !== 'string'
    || typeof value.lastKey !== 'string' || !digest(value.segmentRoot)) return fail('BOOTSTRAP_SEGMENT_INVALID');
  const checked = verifyRecordDigest('ABSINTHE_BOOTSTRAP_SEGMENT_V1', value, 'segmentDigest');
  return checked.ok ? ok(Object.freeze(value as unknown as BootstrapSegment)) : checked;
}

function decodeBootstrapContinuation(value: unknown): ProtocolResult<BootstrapContinuation> {
  const keys = ['kind', 'version', 'id', 'sessionId', 'category', 'segmentId', 'nextSegmentId',
    'terminalId', 'continuationDigest'];
  if (!exactObject(value, keys)) return fail('RECORD_FIELDS_INVALID');
  if (value.kind !== 'absinthe_bootstrap_continuation') return fail('RECORD_KIND_INVALID');
  if (value.version !== 1) return fail('PROTOCOL_VERSION_UNSUPPORTED');
  if (![value.id, value.sessionId, value.category, value.segmentId].every(identifier)
    || value.nextSegmentId !== null && !identifier(value.nextSegmentId)
    || value.terminalId !== null && !identifier(value.terminalId)
    || (value.nextSegmentId === null) === (value.terminalId === null)) return fail('BOOTSTRAP_CONTINUATION_INVALID');
  const checked = verifyRecordDigest('ABSINTHE_BOOTSTRAP_CONTINUATION_V1', value, 'continuationDigest');
  return checked.ok ? ok(Object.freeze(value as unknown as BootstrapContinuation)) : checked;
}

function decodeBootstrapAccumulator(value: unknown): ProtocolResult<BootstrapAccumulator> {
  const keys = ['kind', 'version', 'id', 'sessionId', 'category', 'segmentIndex', 'priorAccumulatorId',
    'priorAccumulatorDigest', 'segmentId', 'segmentDigest', 'recordCount', 'totalBytes', 'lastKey',
    'chainRoot', 'accumulatorDigest'];
  if (!exactObject(value, keys)) return fail('RECORD_FIELDS_INVALID');
  if (value.kind !== 'absinthe_bootstrap_accumulator') return fail('RECORD_KIND_INVALID');
  if (value.version !== 1) return fail('PROTOCOL_VERSION_UNSUPPORTED');
  if (![value.id, value.sessionId, value.category, value.segmentId].every(identifier)
    || !nonNegativeInteger(value.segmentIndex) || !positiveInteger(value.recordCount)
    || !nonNegativeInteger(value.totalBytes) || typeof value.lastKey !== 'string'
    || !digest(value.segmentDigest) || !digest(value.chainRoot)
    || value.priorAccumulatorId !== null && !identifier(value.priorAccumulatorId)
    || value.priorAccumulatorDigest !== null && !digest(value.priorAccumulatorDigest)
    || (value.segmentIndex === 0) !== (value.priorAccumulatorId === null && value.priorAccumulatorDigest === null)) {
    return fail('BOOTSTRAP_ACCUMULATOR_INVALID');
  }
  const checked = verifyRecordDigest('ABSINTHE_BOOTSTRAP_ACCUMULATOR_V1', value, 'accumulatorDigest');
  return checked.ok ? ok(Object.freeze(value as unknown as BootstrapAccumulator)) : checked;
}

function decodeBootstrapTerminal(value: unknown): ProtocolResult<BootstrapTerminal> {
  const keys = ['kind', 'version', 'id', 'sessionId', 'category', 'finalAccumulatorId',
    'finalAccumulatorDigest', 'totalSegments', 'totalRecords', 'totalBytes', 'finalKey',
    'snapshotDigest', 'exhausted', 'terminalDigest'];
  if (!exactObject(value, keys)) return fail('RECORD_FIELDS_INVALID');
  if (value.kind !== 'absinthe_bootstrap_terminal') return fail('RECORD_KIND_INVALID');
  if (value.version !== 1) return fail('PROTOCOL_VERSION_UNSUPPORTED');
  if (![value.id, value.sessionId, value.category, value.finalAccumulatorId].every(identifier)
    || !digest(value.finalAccumulatorDigest) || !positiveInteger(value.totalSegments)
    || !positiveInteger(value.totalRecords) || !nonNegativeInteger(value.totalBytes)
    || typeof value.finalKey !== 'string' || !digest(value.snapshotDigest) || value.exhausted !== true) {
    return fail('BOOTSTRAP_TERMINAL_INVALID');
  }
  const checked = verifyRecordDigest('ABSINTHE_BOOTSTRAP_TERMINAL_V1', value, 'terminalDigest');
  return checked.ok ? ok(Object.freeze(value as unknown as BootstrapTerminal)) : checked;
}

function terminalRefs(value: unknown): value is BootstrapSession['terminalRefs'] {
  return Array.isArray(value) && value.length > 0 && value.length <= K331G_LIMITS.maxArrayEntries
    && value.every(entry => exactObject(entry, ['category', 'terminalId'])
      && identifier(entry.category) && identifier(entry.terminalId))
    && new Set(value.map(entry => entry.category)).size === value.length;
}

function decodeBootstrapSession(value: unknown): ProtocolResult<BootstrapSession> {
  const keys = ['kind', 'version', 'id', 'namespace', 'generation', 'baselineAuthorityDigest',
    'manifestDigest', 'schemaVersion', 'sourceProtocolVersion', 'attachmentClassificationVersion',
    'categoryDefinitionVersion', 'terminalRefs', 'sessionDigest'];
  if (!exactObject(value, keys)) return fail('RECORD_FIELDS_INVALID');
  if (value.kind !== 'absinthe_bootstrap_session') return fail('RECORD_KIND_INVALID');
  if (value.version !== 1 || value.schemaVersion !== 1 || value.sourceProtocolVersion !== 1
    || value.attachmentClassificationVersion !== 1 || value.categoryDefinitionVersion !== 1) {
    return fail('PROTOCOL_VERSION_UNSUPPORTED');
  }
  const refs = value.terminalRefs;
  if (![value.id, value.namespace, value.generation].every(identifier)
    || value.baselineAuthorityDigest !== null && !digest(value.baselineAuthorityDigest)
    || !digest(value.manifestDigest) || !terminalRefs(refs)) return fail('BOOTSTRAP_INCOMPLETE');
  const sorted = [...refs].sort((a, b) => compareUtf8(a.category, b.category));
  if (sorted.some((entry, index) => entry !== refs[index])) return fail('BOOTSTRAP_INCOMPLETE');
  const checked = verifyRecordDigest('ABSINTHE_BOOTSTRAP_SESSION_V1', value, 'sessionDigest');
  return checked.ok ? ok(Object.freeze(value as unknown as BootstrapSession)) : checked;
}

export function compareUtf8(left: string, right: string): number {
  const a = encoder.encode(left.normalize('NFC'));
  const b = encoder.encode(right.normalize('NFC'));
  const length = Math.min(a.length, b.length);
  for (let index = 0; index < length; index += 1) if (a[index] !== b[index]) return a[index] - b[index];
  return a.length - b.length;
}

function verifyBootstrapCategory(reader: AuthorityReader, session: BootstrapSession,
  terminalId: string): ProtocolResult<BootstrapTerminal> {
  const terminal = required(reader.read(terminalId), decodeBootstrapTerminal);
  if (!terminal.ok) return terminal;
  if (terminal.value.sessionId !== session.id) return fail('BOOTSTRAP_TERMINAL_INVALID');
  const reverse: BootstrapAccumulator[] = [];
  let accumulatorId: string | null = terminal.value.finalAccumulatorId;
  let accumulatorDigest: string | null = terminal.value.finalAccumulatorDigest;
  while (accumulatorId !== null) {
    const accumulatorResult: ProtocolResult<BootstrapAccumulator> = required(
      reader.read(accumulatorId), decodeBootstrapAccumulator);
    if (!accumulatorResult.ok) return accumulatorResult;
    if (accumulatorResult.value.accumulatorDigest !== accumulatorDigest
      || accumulatorResult.value.sessionId !== session.id
      || accumulatorResult.value.category !== terminal.value.category) {
      return fail('BOOTSTRAP_ACCUMULATOR_INVALID');
    }
    reverse.push(accumulatorResult.value);
    accumulatorId = accumulatorResult.value.priorAccumulatorId;
    accumulatorDigest = accumulatorResult.value.priorAccumulatorDigest;
  }
  const accumulators = reverse.reverse();
  let records = 0;
  let bytes = 0;
  let lastKey: string | null = null;
  let priorChainRoot: string | null = null;
  for (let index = 0; index < accumulators.length; index += 1) {
    const accumulator = accumulators[index];
    if (accumulator.segmentIndex !== index) return fail('BOOTSTRAP_ACCUMULATOR_INVALID');
    const segment = required(reader.read(accumulator.segmentId), decodeBootstrapSegment);
    if (!segment.ok) return segment;
    if (segment.value.segmentDigest !== accumulator.segmentDigest || segment.value.index !== index
      || segment.value.sessionId !== session.id || segment.value.category !== terminal.value.category) {
      return fail('BOOTSTRAP_SEGMENT_INVALID');
    }
    const items: BootstrapItem[] = [];
    for (const itemId of segment.value.itemIds) {
      const item = required(reader.read(itemId), decodeBootstrapItem);
      if (!item.ok) return item;
      if (item.value.sessionId !== session.id || item.value.category !== terminal.value.category) {
        return fail('BOOTSTRAP_SEGMENT_INVALID');
      }
      items.push(item.value);
    }
    if (items.some((item, itemIndex) => item.itemDigest !== segment.value.itemDigests[itemIndex])
      || items.some((item, itemIndex) => itemIndex > 0 && compareUtf8(items[itemIndex - 1].key, item.key) >= 0)
      || new Set(items.map(item => item.key.normalize('NFC'))).size !== items.length
      || segment.value.firstKey !== items[0].key || segment.value.lastKey !== items[items.length - 1].key
      || lastKey !== null && compareUtf8(lastKey, items[0].key) >= 0
      || segment.value.segmentRoot !== fixtureDigest('ABSINTHE_BOOTSTRAP_SEGMENT_ROOT_V1', segment.value.itemDigests)) {
      return fail('BOOTSTRAP_SEGMENT_INVALID');
    }
    const continuation = required(reader.read(segment.value.continuationId), decodeBootstrapContinuation);
    if (!continuation.ok) return continuation;
    const nextSegmentId = index + 1 < accumulators.length ? accumulators[index + 1].segmentId : null;
    if (continuation.value.sessionId !== session.id || continuation.value.segmentId !== segment.value.id
      || continuation.value.category !== terminal.value.category || continuation.value.nextSegmentId !== nextSegmentId
      || continuation.value.terminalId !== (nextSegmentId === null ? terminal.value.id : null)) {
      return fail('BOOTSTRAP_CONTINUATION_INVALID');
    }
    records += items.length;
    bytes += items.reduce((total, item) => total + encoder.encode(item.key).byteLength + 32, 0);
    lastKey = items[items.length - 1].key;
    const chainRoot = fixtureDigest('ABSINTHE_BOOTSTRAP_CHAIN_V1', [priorChainRoot, segment.value.segmentRoot]);
    if (accumulator.recordCount !== records || accumulator.totalBytes !== bytes
      || accumulator.lastKey !== lastKey || accumulator.chainRoot !== chainRoot) {
      return fail('BOOTSTRAP_ACCUMULATOR_INVALID');
    }
    priorChainRoot = chainRoot;
  }
  if (terminal.value.totalSegments !== accumulators.length || terminal.value.totalRecords !== records
    || terminal.value.totalBytes !== bytes || terminal.value.finalKey !== lastKey) return fail('BOOTSTRAP_TERMINAL_INVALID');
  return ok(terminal.value);
}

export function finalizeBootstrap(reader: AuthorityReader, sessionId: string): ProtocolResult<string> {
  const session = required(reader.read(sessionId), decodeBootstrapSession);
  if (!session.ok) return session;
  const terminals: BootstrapTerminal[] = [];
  for (const reference of session.value.terminalRefs) {
    const terminal = verifyBootstrapCategory(reader, session.value, reference.terminalId);
    if (!terminal.ok) return terminal;
    if (terminal.value.category !== reference.category) return fail('BOOTSTRAP_INCOMPLETE');
    terminals.push(terminal.value);
  }
  return canonicalDigest('ABSINTHE_BOOTSTRAP_FINAL_AUTHORITY_V1', [session.value.sessionDigest,
    terminals.map(terminal => terminal.terminalDigest)]);
}

// Strict restore graph. The finalizer reads every record using the session ID only.
type RestoreChunk = Readonly<{ kind: 'absinthe_restore_chunk'; version: 1; id: string; sessionId: string;
  index: number; payloadDigest: string; chunkDigest: string }>;
type RestoreSegment = Readonly<{ kind: 'absinthe_restore_segment'; version: 1; id: string; sessionId: string;
  index: number; chunkIds: readonly string[]; chunkDigests: readonly string[]; firstChunkIndex: number;
  lastChunkIndex: number; segmentRoot: string; segmentDigest: string }>;
type RestoreComponentRoot = Readonly<{ kind: 'absinthe_restore_component_root'; version: 1; id: string;
  sessionId: string; component: string; itemDigests: readonly string[]; count: number; root: string;
  componentDigest: string }>;
type RestoreMmrState = Readonly<{ kind: 'absinthe_restore_mmr_state'; version: 1; id: string;
  sessionId: string; segmentDigests: readonly string[]; leafCount: number; root: string; stateDigest: string }>;
type RestoreTerminal = Readonly<{ kind: 'absinthe_restore_terminal'; version: 1; id: string; sessionId: string;
  chunkCount: number; segmentCount: number; componentCount: number; complete: true; terminalDigest: string }>;
export type RestoreManifest = Readonly<{ kind: 'absinthe_restore_manifest'; version: 1; id: string;
  sessionId: string; planDigest: string; chunkRoot: string; segmentRoot: string; componentRoot: string;
  mmrRoot: string; terminalDigest: string; manifestDigest: string }>;
type RestoreSession = Readonly<{ kind: 'absinthe_restore_session'; version: 1; id: string; namespace: string;
  generation: string; planDigest: string; chunkIds: readonly string[]; segmentIds: readonly string[];
  componentRootIds: readonly string[]; mmrStateId: string; terminalId: string;
  existingManifestId: string | null; sessionDigest: string }>;

function decodeRestoreChunk(value: unknown): ProtocolResult<RestoreChunk> {
  if (!exactObject(value, ['kind', 'version', 'id', 'sessionId', 'index', 'payloadDigest', 'chunkDigest'])) return fail('RECORD_FIELDS_INVALID');
  if (value.kind !== 'absinthe_restore_chunk') return fail('RECORD_KIND_INVALID');
  if (value.version !== 1) return fail('PROTOCOL_VERSION_UNSUPPORTED');
  if (!identifier(value.id) || !identifier(value.sessionId) || !nonNegativeInteger(value.index)
    || !digest(value.payloadDigest)) return fail('RESTORE_GRAPH_INVALID');
  const checked = verifyRecordDigest('ABSINTHE_RESTORE_CHUNK_V1', value, 'chunkDigest');
  return checked.ok ? ok(Object.freeze(value as unknown as RestoreChunk)) : checked;
}

function decodeRestoreSegment(value: unknown): ProtocolResult<RestoreSegment> {
  const keys = ['kind', 'version', 'id', 'sessionId', 'index', 'chunkIds', 'chunkDigests',
    'firstChunkIndex', 'lastChunkIndex', 'segmentRoot', 'segmentDigest'];
  if (!exactObject(value, keys)) return fail('RECORD_FIELDS_INVALID');
  if (value.kind !== 'absinthe_restore_segment') return fail('RECORD_KIND_INVALID');
  if (value.version !== 1) return fail('PROTOCOL_VERSION_UNSUPPORTED');
  if (!identifier(value.id) || !identifier(value.sessionId) || !nonNegativeInteger(value.index)
    || !strings(value.chunkIds) || !strings(value.chunkDigests, digest) || value.chunkIds.length === 0
    || value.chunkIds.length !== value.chunkDigests.length || new Set(value.chunkIds).size !== value.chunkIds.length
    || !nonNegativeInteger(value.firstChunkIndex) || !nonNegativeInteger(value.lastChunkIndex)
    || value.lastChunkIndex - value.firstChunkIndex + 1 !== value.chunkIds.length || !digest(value.segmentRoot)) {
    return fail('RESTORE_GRAPH_INVALID');
  }
  const checked = verifyRecordDigest('ABSINTHE_RESTORE_SEGMENT_V1', value, 'segmentDigest');
  return checked.ok ? ok(Object.freeze(value as unknown as RestoreSegment)) : checked;
}

function decodeRestoreComponentRoot(value: unknown): ProtocolResult<RestoreComponentRoot> {
  const keys = ['kind', 'version', 'id', 'sessionId', 'component', 'itemDigests', 'count', 'root', 'componentDigest'];
  if (!exactObject(value, keys)) return fail('RECORD_FIELDS_INVALID');
  if (value.kind !== 'absinthe_restore_component_root') return fail('RECORD_KIND_INVALID');
  if (value.version !== 1) return fail('PROTOCOL_VERSION_UNSUPPORTED');
  if (![value.id, value.sessionId, value.component].every(identifier) || !strings(value.itemDigests, digest)
    || value.itemDigests.length !== value.count || !digest(value.root)) return fail('RESTORE_COMPONENT_MISMATCH');
  if (value.root !== fixtureDigest('ABSINTHE_RESTORE_COMPONENT_ROOT_V1', value.itemDigests)) return fail('RESTORE_COMPONENT_MISMATCH');
  const checked = verifyRecordDigest('ABSINTHE_RESTORE_COMPONENT_V1', value, 'componentDigest');
  return checked.ok ? ok(Object.freeze(value as unknown as RestoreComponentRoot)) : checked;
}

function decodeRestoreMmrState(value: unknown): ProtocolResult<RestoreMmrState> {
  const keys = ['kind', 'version', 'id', 'sessionId', 'segmentDigests', 'leafCount', 'root', 'stateDigest'];
  if (!exactObject(value, keys)) return fail('RECORD_FIELDS_INVALID');
  if (value.kind !== 'absinthe_restore_mmr_state') return fail('RECORD_KIND_INVALID');
  if (value.version !== 1) return fail('PROTOCOL_VERSION_UNSUPPORTED');
  if (!identifier(value.id) || !identifier(value.sessionId) || !strings(value.segmentDigests, digest)
    || value.segmentDigests.length !== value.leafCount || !digest(value.root)
    || value.root !== fixtureDigest('ABSINTHE_RESTORE_MMR_ROOT_V1', value.segmentDigests)) return fail('MMR_STATE_MISMATCH');
  const checked = verifyRecordDigest('ABSINTHE_RESTORE_MMR_STATE_V1', value, 'stateDigest');
  return checked.ok ? ok(Object.freeze(value as unknown as RestoreMmrState)) : checked;
}

function decodeRestoreTerminal(value: unknown): ProtocolResult<RestoreTerminal> {
  const keys = ['kind', 'version', 'id', 'sessionId', 'chunkCount', 'segmentCount', 'componentCount',
    'complete', 'terminalDigest'];
  if (!exactObject(value, keys)) return fail('RECORD_FIELDS_INVALID');
  if (value.kind !== 'absinthe_restore_terminal') return fail('RECORD_KIND_INVALID');
  if (value.version !== 1) return fail('PROTOCOL_VERSION_UNSUPPORTED');
  if (!identifier(value.id) || !identifier(value.sessionId) || !nonNegativeInteger(value.chunkCount)
    || !nonNegativeInteger(value.segmentCount) || !nonNegativeInteger(value.componentCount)
    || value.complete !== true) return fail('RESTORE_TERMINAL_INCOMPLETE');
  const checked = verifyRecordDigest('ABSINTHE_RESTORE_TERMINAL_V1', value, 'terminalDigest');
  return checked.ok ? ok(Object.freeze(value as unknown as RestoreTerminal)) : checked;
}

function decodeRestoreManifest(value: unknown): ProtocolResult<RestoreManifest> {
  const keys = ['kind', 'version', 'id', 'sessionId', 'planDigest', 'chunkRoot', 'segmentRoot',
    'componentRoot', 'mmrRoot', 'terminalDigest', 'manifestDigest'];
  if (!exactObject(value, keys)) return fail('RECORD_FIELDS_INVALID');
  if (value.kind !== 'absinthe_restore_manifest') return fail('RECORD_KIND_INVALID');
  if (value.version !== 1) return fail('PROTOCOL_VERSION_UNSUPPORTED');
  if (!identifier(value.id) || !identifier(value.sessionId) || ![value.planDigest, value.chunkRoot,
    value.segmentRoot, value.componentRoot, value.mmrRoot, value.terminalDigest].every(digest)) {
    return fail('RESTORE_MANIFEST_MISMATCH');
  }
  const checked = verifyRecordDigest('ABSINTHE_RESTORE_MANIFEST_V1', value, 'manifestDigest');
  return checked.ok ? ok(Object.freeze(value as unknown as RestoreManifest)) : checked;
}

function decodeRestoreSession(value: unknown): ProtocolResult<RestoreSession> {
  const keys = ['kind', 'version', 'id', 'namespace', 'generation', 'planDigest', 'chunkIds',
    'segmentIds', 'componentRootIds', 'mmrStateId', 'terminalId', 'existingManifestId', 'sessionDigest'];
  if (!exactObject(value, keys)) return fail('RECORD_FIELDS_INVALID');
  if (value.kind !== 'absinthe_restore_session') return fail('RECORD_KIND_INVALID');
  if (value.version !== 1) return fail('PROTOCOL_VERSION_UNSUPPORTED');
  if (![value.id, value.namespace, value.generation, value.mmrStateId, value.terminalId].every(identifier)
    || !digest(value.planDigest) || !strings(value.chunkIds) || !strings(value.segmentIds)
    || !strings(value.componentRootIds) || new Set(value.chunkIds).size !== value.chunkIds.length
    || new Set(value.segmentIds).size !== value.segmentIds.length
    || new Set(value.componentRootIds).size !== value.componentRootIds.length
    || value.existingManifestId !== null && !identifier(value.existingManifestId)) return fail('RESTORE_GRAPH_INVALID');
  const checked = verifyRecordDigest('ABSINTHE_RESTORE_SESSION_V1', value, 'sessionDigest');
  return checked.ok ? ok(Object.freeze(value as unknown as RestoreSession)) : checked;
}

export function finalizeRestore(reader: AuthorityReader, sessionId: string): ProtocolResult<RestoreManifest> {
  const session = required(reader.read(sessionId), decodeRestoreSession);
  if (!session.ok) return session;
  const chunks: RestoreChunk[] = [];
  for (let index = 0; index < session.value.chunkIds.length; index += 1) {
    const chunk = required(reader.read(session.value.chunkIds[index]), decodeRestoreChunk);
    if (!chunk.ok) return chunk;
    if (chunk.value.sessionId !== sessionId || chunk.value.index !== index) return fail('RESTORE_GRAPH_INVALID');
    chunks.push(chunk.value);
  }
  const segments: RestoreSegment[] = [];
  const coveredChunkIds: string[] = [];
  for (let index = 0; index < session.value.segmentIds.length; index += 1) {
    const segment = required(reader.read(session.value.segmentIds[index]), decodeRestoreSegment);
    if (!segment.ok) return segment;
    if (segment.value.sessionId !== sessionId || segment.value.index !== index
      || segment.value.firstChunkIndex !== coveredChunkIds.length
      || segment.value.segmentRoot !== fixtureDigest('ABSINTHE_RESTORE_SEGMENT_ROOT_V1', segment.value.chunkDigests)) {
      return fail('RESTORE_GRAPH_INVALID');
    }
    for (let offset = 0; offset < segment.value.chunkIds.length; offset += 1) {
      const expected = chunks[coveredChunkIds.length];
      if (!expected || segment.value.chunkIds[offset] !== expected.id
        || segment.value.chunkDigests[offset] !== expected.chunkDigest) return fail('RESTORE_GRAPH_INVALID');
      coveredChunkIds.push(expected.id);
    }
    segments.push(segment.value);
  }
  if (coveredChunkIds.length !== chunks.length) return fail('RESTORE_GRAPH_INVALID');
  const components: RestoreComponentRoot[] = [];
  for (const componentId of session.value.componentRootIds) {
    const component = required(reader.read(componentId), decodeRestoreComponentRoot);
    if (!component.ok) return component;
    if (component.value.sessionId !== sessionId) return fail('RESTORE_COMPONENT_MISMATCH');
    components.push(component.value);
  }
  if (components.some((component, index) => index > 0
    && compareUtf8(components[index - 1].component, component.component) >= 0)) return fail('RESTORE_COMPONENT_MISMATCH');
  const mmr = required(reader.read(session.value.mmrStateId), decodeRestoreMmrState);
  if (!mmr.ok) return mmr;
  if (mmr.value.sessionId !== sessionId || mmr.value.segmentDigests.length !== segments.length
    || mmr.value.segmentDigests.some((entry, index) => entry !== segments[index].segmentDigest)) {
    return fail('MMR_STATE_MISMATCH');
  }
  const terminal = required(reader.read(session.value.terminalId), decodeRestoreTerminal);
  if (!terminal.ok) return terminal;
  if (terminal.value.sessionId !== sessionId || terminal.value.chunkCount !== chunks.length
    || terminal.value.segmentCount !== segments.length || terminal.value.componentCount !== components.length) {
    return fail('RESTORE_TERMINAL_INCOMPLETE');
  }
  const withoutDigest = Object.freeze({ kind: 'absinthe_restore_manifest' as const, version: 1 as const,
    id: `restore-manifest:${sessionId}`, sessionId, planDigest: session.value.planDigest,
    chunkRoot: fixtureDigest('ABSINTHE_RESTORE_CHUNK_ROOT_V1', chunks.map(chunk => chunk.chunkDigest)),
    segmentRoot: fixtureDigest('ABSINTHE_RESTORE_SEGMENT_AGGREGATE_V1', segments.map(segment => segment.segmentDigest)),
    componentRoot: fixtureDigest('ABSINTHE_RESTORE_COMPONENT_AGGREGATE_V1',
      components.map(component => component.componentDigest)), mmrRoot: mmr.value.root,
    terminalDigest: terminal.value.terminalDigest });
  const derived = seal('ABSINTHE_RESTORE_MANIFEST_V1', withoutDigest, 'manifestDigest') as unknown as RestoreManifest;
  if (session.value.existingManifestId !== null) {
    const existing = required(reader.read(session.value.existingManifestId), decodeRestoreManifest);
    if (!existing.ok) return existing;
    if (JSON.stringify(existing.value) !== JSON.stringify(derived)) return fail('RESTORE_MANIFEST_MISMATCH');
    return ok(existing.value);
  }
  return ok(derived);
}

export function verifyExpectedRestoreManifest(reader: AuthorityReader, sessionId: string,
  expectedManifestDigest: string): ProtocolResult<RestoreManifest> {
  const derived = finalizeRestore(reader, sessionId);
  if (!derived.ok) return derived;
  return digest(expectedManifestDigest) && derived.value.manifestDigest === expectedManifestDigest
    ? derived : fail('RESTORE_MANIFEST_MISMATCH');
}

export const ATTACHMENT_METADATA_FIELDS = Object.freeze([
  'id', 'noteId', 'fileName', 'mimeType', 'size', 'checksum', 'localBlobKey', 'remoteBlobKey',
  'remoteProvider', 'remoteFileId', 'remoteChecksum', 'remoteSize', 'remoteMimeType', 'remoteSyncedAt',
  'remoteUpdatedAt', 'remoteError', 'remoteSyncStatus', 'remoteVerification', 'lastRemoteSyncAttemptAt',
  'remoteSyncAttemptCount', 'lastRemoteRecoveryAt', 'keepOffline', 'lastAccessedAt', 'lastOpenedAt',
  'lastPreviewedAt', 'title', 'alt', 'caption', 'thumbnailKey', 'pageCount', 'source', 'createdAt',
  'updatedAt', 'deletedAt', 'syncStatus',
] as const satisfies readonly (keyof AttachmentMetadata)[]);

type MissingAttachmentField = Exclude<keyof AttachmentMetadata, typeof ATTACHMENT_METADATA_FIELDS[number]>;
const attachmentFieldCoverageIsTotal: [MissingAttachmentField] extends [never] ? true : never = true;
void attachmentFieldCoverageIsTotal;

export type AttachmentFieldClass = 'authority_critical' | 'integrity_relevant'
  | 'mutable_descriptive_metadata' | 'excluded_non_authoritative';

export const ATTACHMENT_FIELD_CLASSIFICATION = Object.freeze({
  id: 'authority_critical', noteId: 'authority_critical', fileName: 'mutable_descriptive_metadata',
  mimeType: 'authority_critical', size: 'authority_critical', checksum: 'integrity_relevant',
  localBlobKey: 'excluded_non_authoritative', remoteBlobKey: 'excluded_non_authoritative',
  remoteProvider: 'excluded_non_authoritative', remoteFileId: 'excluded_non_authoritative',
  remoteChecksum: 'integrity_relevant', remoteSize: 'integrity_relevant', remoteMimeType: 'integrity_relevant',
  remoteSyncedAt: 'excluded_non_authoritative', remoteUpdatedAt: 'excluded_non_authoritative',
  remoteError: 'excluded_non_authoritative', remoteSyncStatus: 'excluded_non_authoritative',
  remoteVerification: 'integrity_relevant', lastRemoteSyncAttemptAt: 'excluded_non_authoritative',
  remoteSyncAttemptCount: 'excluded_non_authoritative', lastRemoteRecoveryAt: 'excluded_non_authoritative',
  keepOffline: 'excluded_non_authoritative', lastAccessedAt: 'excluded_non_authoritative',
  lastOpenedAt: 'excluded_non_authoritative', lastPreviewedAt: 'excluded_non_authoritative',
  title: 'mutable_descriptive_metadata', alt: 'mutable_descriptive_metadata',
  caption: 'mutable_descriptive_metadata', thumbnailKey: 'excluded_non_authoritative',
  pageCount: 'integrity_relevant', source: 'authority_critical', createdAt: 'authority_critical',
  updatedAt: 'excluded_non_authoritative', deletedAt: 'authority_critical',
  syncStatus: 'excluded_non_authoritative',
} as const satisfies Readonly<Record<keyof AttachmentMetadata, AttachmentFieldClass>>);

type AttachmentClassificationEvidence = Readonly<{ kind: 'absinthe_attachment_classification_evidence';
  version: 1; id: string; attachmentContractVersion: 1; fields: readonly string[];
  classificationDigest: string }>;

function decodeAttachmentClassificationEvidence(value: unknown): ProtocolResult<AttachmentClassificationEvidence> {
  const keys = ['kind', 'version', 'id', 'attachmentContractVersion', 'fields', 'classificationDigest'];
  if (!exactObject(value, keys)) return fail('RECORD_FIELDS_INVALID');
  if (value.kind !== 'absinthe_attachment_classification_evidence') return fail('RECORD_KIND_INVALID');
  if (value.version !== 1 || value.attachmentContractVersion !== 1) return fail('PROTOCOL_VERSION_UNSUPPORTED');
  if (!identifier(value.id) || !strings(value.fields, entry => typeof entry === 'string')
    || new Set(value.fields).size !== value.fields.length
    || value.fields.some((field, index) => field !== ATTACHMENT_METADATA_FIELDS[index])) {
    return fail('ATTACHMENT_CLASSIFICATION_MISMATCH');
  }
  const checked = verifyRecordDigest('ABSINTHE_ATTACHMENT_CLASSIFICATION_V1', value, 'classificationDigest');
  return checked.ok ? ok(Object.freeze(value as unknown as AttachmentClassificationEvidence)) : checked;
}

export const RELATIONSHIP_VERSION_MATRICES = Object.freeze({
  reconciliation: Object.freeze({ rawReceipt: 1, compactedProjection: 1, transactionReference: 1,
    sourceAuthority: 1, operation: 1, admission: 1, writerIdentity: 1, writerSession: 1,
    terminal: 1, outbox: 1, checkpoint: 1, mmrState: 1 }),
  lifecycle: Object.freeze({ sourceAuthority: 1, lifecycleEvent: 1, lifecycleHead: 1, purgeCertificate: 1 }),
  bootstrap: Object.freeze({ session: 1, item: 1, segment: 1, accumulator: 1,
    continuation: 1, terminal: 1, attachmentClassification: 1 }),
  restore: Object.freeze({ session: 1, chunk: 1, segment: 1, componentRoot: 1,
    mmrState: 1, terminal: 1, manifest: 1 }),
  attachment: Object.freeze({ metadataContract: 1, classificationEvidence: 1, bootstrapSession: 1 }),
});

export function validateRelationshipVersions(name: keyof typeof RELATIONSHIP_VERSION_MATRICES,
  versions: unknown): ProtocolResult<true> {
  const expected = RELATIONSHIP_VERSION_MATRICES[name];
  if (!exactObject(versions, Object.keys(expected))) return fail('RELATIONSHIP_VERSION_UNSUPPORTED');
  return Object.entries(expected).every(([key, version]) => versions[key] === version)
    ? ok(true) : fail('RELATIONSHIP_VERSION_UNSUPPORTED');
}

export const RECORD_SPECIFIC_CODEC_REGISTRY = Object.freeze({
  writer_identity: decodeWriterIdentity,
  writer_session: decodeWriterSession,
  k330_admission: decodeAdmission,
  k330_operation: decodeOperation,
  terminal_state: decodeTerminal,
  immutable_outbox_intent: decodeOutbox,
  segment_checkpoint: decodeCheckpoint,
  mmr_state: decodeMmrState,
  lifecycle_event: decodeLifecycleEvent,
  lifecycle_head: decodeLifecycleHead,
  source_authority: decodeSourceAuthority,
  source_transaction_reference: decodeTransactionReference,
  raw_source_receipt: decodeRawReceipt,
  compacted_authority_projection: decodeCompactedProjection,
  bootstrap_item: decodeBootstrapItem,
  bootstrap_segment: decodeBootstrapSegment,
  bootstrap_continuation: decodeBootstrapContinuation,
  bootstrap_accumulator: decodeBootstrapAccumulator,
  bootstrap_terminal: decodeBootstrapTerminal,
  bootstrap_session: decodeBootstrapSession,
  restore_chunk: decodeRestoreChunk,
  restore_segment: decodeRestoreSegment,
  restore_component_root: decodeRestoreComponentRoot,
  restore_mmr_state: decodeRestoreMmrState,
  restore_terminal: decodeRestoreTerminal,
  restore_manifest: decodeRestoreManifest,
  restore_session: decodeRestoreSession,
  attachment_classification_evidence: decodeAttachmentClassificationEvidence,
});

export const K331G_EMITTED_ERROR_CODES = Object.freeze(Object.keys(K331G_STABLE_ERRORS) as StableErrorCode[]);
export const K331G_RESERVED_ERROR_CODES = Object.freeze([] as StableErrorCode[]);

export type ReconciliationFixture = Readonly<{ repository: InMemoryAuthorityRepository;
  ids: Readonly<{ receipt: string; projection: string; transactionReference: string; sourceAuthority: string;
    operation: string; admission: string; writer: string; session: string; terminal: string; outbox: string;
    checkpoint: string; mmrState: string; lifecycleHead: string; tombstoneEvent: string }> }>;

export function createReconciliationFixture(): ReconciliationFixture {
  const ids = Object.freeze({ receipt: 'receipt:one', projection: 'projection:one',
    transactionReference: 'transaction-reference:one', sourceAuthority: 'source-authority:one',
    operation: 'operation:one', admission: 'admission:one', writer: 'writer:one', session: 'session:one',
    terminal: 'terminal:one', outbox: 'outbox:one', checkpoint: 'checkpoint:one', mmrState: 'mmr:one',
    lifecycleHead: 'lifecycle-head:one', tombstoneEvent: 'lifecycle-event:one' });
  const sourceIdentityDigest = fixtureDigest('ABSINTHE_SOURCE_IDENTITY_V1', ['note:one']);
  const writer = seal('ABSINTHE_WRITER_IDENTITY_V1', { kind: 'absinthe_writer_identity', version: 1,
    id: ids.writer, writerType: 'interactive-writer', manifestDigest: fixtureDigest('MANIFEST', ['one']) },
  'writerDigest');
  const session = seal('ABSINTHE_WRITER_SESSION_V1', { kind: 'absinthe_writer_session', version: 1,
    id: ids.session, writerId: ids.writer, epoch: 1, capabilityDigest: fixtureDigest('CAPABILITY', ['one']) },
  'sessionDigest');
  const admission = seal('ABSINTHE_K330_ADMISSION_V1', { kind: 'absinthe_k330_admission', version: 1,
    id: ids.admission, operationId: ids.operation, writerId: ids.writer, sessionId: ids.session,
    decision: 'admitted' }, 'admissionDigest');
  const outboxIntentDigest = fixtureDigest('OUTBOX_INTENT', ['one']);
  const resultDigest = fixtureDigest('RESULT', ['one']);
  const outbox = seal('ABSINTHE_IMMUTABLE_OUTBOX_V1', { kind: 'absinthe_immutable_outbox_intent', version: 1,
    id: ids.outbox, operationId: ids.operation, intentDigest: outboxIntentDigest }, 'outboxDigest');
  const terminal = seal('ABSINTHE_TERMINAL_STATE_V1', { kind: 'absinthe_terminal_state', version: 1,
    id: ids.terminal, operationId: ids.operation, state: 'committed', resultDigest }, 'terminalDigest');
  const operation = seal('ABSINTHE_K330_OPERATION_V1', { kind: 'absinthe_k330_operation', version: 1,
    id: ids.operation, namespace: 'namespace:one', generation: 'generation:one', admissionId: ids.admission,
    admissionDigest: admission.admissionDigest, writerId: ids.writer, writerDigest: writer.writerDigest,
    sessionId: ids.session, sessionDigest: session.sessionDigest, mutationKind: 'note_tombstone',
    committedRevision: '1',
    affectedIdentityDigest: sourceIdentityDigest, canonicalInputDigest: fixtureDigest('INPUT', ['one']),
    resultDigest, outboxId: ids.outbox, outboxIntentDigest }, 'operationDigest');
  const lifecycleEvent = seal('ABSINTHE_LIFECYCLE_EVENT_V1', { kind: 'absinthe_lifecycle_event', version: 1,
    id: ids.tombstoneEvent, sourceIdentityDigest, sequence: 1, eventKind: 'tombstone',
    predecessorId: null, predecessorDigest: null }, 'eventDigest');
  const lifecycleHead = seal('ABSINTHE_LIFECYCLE_HEAD_V1', { kind: 'absinthe_lifecycle_head', version: 1,
    id: ids.lifecycleHead, sourceIdentityDigest, latestEventId: lifecycleEvent.id,
    latestEventDigest: lifecycleEvent.eventDigest, eventCount: 1 }, 'headDigest');
  const proofEncoded = JSON.stringify({ version: 1, segmentNodes: [], mmrNodes: [], outerNodes: [] });
  const rawReceipt = seal('ABSINTHE_RAW_RECEIPT_V1', { kind: 'absinthe_raw_source_receipt', version: 1,
    id: ids.receipt, transactionReferenceId: ids.transactionReference, operationId: ids.operation,
    committedRevision: '1', checkpointId: ids.checkpoint, segmentIndex: 0, leafIndex: 0, proofEncoded },
  'receiptDigest');
  const receiptLeaf = fixtureDigest('ABSINTHE_RECEIPT_LEAF_V1', [rawReceipt.receiptDigest, 0, 0]);
  const checkpoint = seal('ABSINTHE_SEGMENT_CHECKPOINT_V1', { kind: 'absinthe_segment_checkpoint', version: 1,
    id: ids.checkpoint, namespace: 'namespace:one', generation: 'generation:one', segmentIndex: 0,
    receiptCount: 1, firstRevision: '1', lastRevision: '1', segmentRoot: receiptLeaf,
    previousCheckpointDigest: null }, 'checkpointDigest');
  const mmrState = seal('ABSINTHE_MMR_STATE_V1', { kind: 'absinthe_mmr_state', version: 1, id: ids.mmrState,
    namespace: 'namespace:one', generation: 'generation:one', checkpointDigests: [checkpoint.checkpointDigest],
    leafCount: 1, root: fixtureDigest('ABSINTHE_MMR_ROOT_V1', [checkpoint.checkpointDigest]) }, 'stateDigest');
  const sourceAuthority = seal('ABSINTHE_SOURCE_AUTHORITY_V1', { kind: 'absinthe_source_authority', version: 1,
    id: ids.sourceAuthority, namespace: 'namespace:one', generation: 'generation:one', sourceRevision: '1',
    operationRegistryRoot: fixtureDigest('ABSINTHE_OPERATION_REGISTRY_ROOT_V1', [operation.operationDigest]),
    terminalRoot: fixtureDigest('ABSINTHE_TERMINAL_ROOT_V1', [terminal.terminalDigest]),
    outboxRoot: fixtureDigest('ABSINTHE_OUTBOX_ROOT_V1', [outbox.outboxDigest]),
    mmrStateId: ids.mmrState, mmrStateDigest: mmrState.stateDigest,
    lifecycleHeadId: ids.lifecycleHead, lifecycleHeadDigest: lifecycleHead.headDigest }, 'authorityDigest');
  const reference = seal('ABSINTHE_TRANSACTION_REFERENCE_V1', { kind: 'absinthe_source_transaction_reference',
    version: 1, id: ids.transactionReference, sourceAuthorityId: ids.sourceAuthority,
    sourceAuthorityDigest: sourceAuthority.authorityDigest, operationId: ids.operation,
    operationDigest: operation.operationDigest, admissionId: ids.admission, admissionDigest: admission.admissionDigest,
    writerId: ids.writer, writerDigest: writer.writerDigest, sessionId: ids.session,
    sessionDigest: session.sessionDigest, terminalId: ids.terminal, terminalDigest: terminal.terminalDigest,
    outboxId: ids.outbox, outboxDigest: outbox.outboxDigest, mmrStateId: ids.mmrState,
    mmrStateDigest: mmrState.stateDigest, checkpointId: ids.checkpoint,
    checkpointDigest: checkpoint.checkpointDigest, graphVersion: 1 }, 'referenceDigest');
  const graphDigest = fixtureDigest('ABSINTHE_INDEPENDENT_AUTHORITY_GRAPH_V1', [reference.referenceDigest,
    sourceAuthority.authorityDigest, operation.operationDigest, admission.admissionDigest, writer.writerDigest,
    session.sessionDigest, terminal.terminalDigest, outbox.outboxDigest, mmrState.stateDigest,
    checkpoint.checkpointDigest, lifecycleHead.headDigest]);
  const boundaryDigest = fixtureDigest('ABSINTHE_COMPACTION_BOUNDARY_V1', [ids.transactionReference,
    rawReceipt.receiptDigest, checkpoint.checkpointDigest, graphDigest]);
  const projection = seal('ABSINTHE_COMPACTED_PROJECTION_V1', {
    kind: 'absinthe_compacted_authority_projection', version: 1, id: ids.projection,
    transactionReferenceId: ids.transactionReference, originalReceiptDigest: rawReceipt.receiptDigest,
    checkpointId: ids.checkpoint, checkpointDigest: checkpoint.checkpointDigest, segmentIndex: 0,
    leafIndex: 0, proofEncoded, compactionBoundaryDigest: boundaryDigest }, 'projectionDigest');
  return Object.freeze({ repository: new InMemoryAuthorityRepository([writer, session, admission, operation,
    terminal, outbox, lifecycleEvent, lifecycleHead, rawReceipt, checkpoint, mmrState, sourceAuthority,
    reference, projection]), ids });
}

export function createLifecycleEvent(input: { id: string; sourceIdentityDigest: string; sequence: number;
  eventKind: 'tombstone' | 'resurrection'; predecessor: LifecycleEventRecord | null }): LifecycleEventRecord {
  return seal('ABSINTHE_LIFECYCLE_EVENT_V1', { kind: 'absinthe_lifecycle_event', version: 1, id: input.id,
    sourceIdentityDigest: input.sourceIdentityDigest, sequence: input.sequence, eventKind: input.eventKind,
    predecessorId: input.predecessor?.id ?? null, predecessorDigest: input.predecessor?.eventDigest ?? null },
  'eventDigest') as unknown as LifecycleEventRecord;
}

export function rebindLifecycleHead(fixture: ReconciliationFixture,
  events: readonly LifecycleEventRecord[]): void {
  for (const event of events) fixture.repository.put(event);
  const previousHead = fixture.repository.read(fixture.ids.lifecycleHead) as LifecycleHeadRecord;
  const latest = events[events.length - 1];
  const head = seal('ABSINTHE_LIFECYCLE_HEAD_V1', { kind: 'absinthe_lifecycle_head', version: 1,
    id: fixture.ids.lifecycleHead, sourceIdentityDigest: previousHead.sourceIdentityDigest,
    latestEventId: latest.id, latestEventDigest: latest.eventDigest, eventCount: events.length }, 'headDigest');
  fixture.repository.put(head);
  const oldAuthority = fixture.repository.read(fixture.ids.sourceAuthority) as SourceAuthorityRecord;
  const authorityPayload: Record<string, unknown> = { ...oldAuthority, lifecycleHeadDigest: head.headDigest };
  delete authorityPayload.authorityDigest;
  const authority = seal('ABSINTHE_SOURCE_AUTHORITY_V1', authorityPayload, 'authorityDigest');
  fixture.repository.put(authority);
  const oldReference = fixture.repository.read(fixture.ids.transactionReference) as TransactionReferenceRecord;
  const referencePayload: Record<string, unknown> = {
    ...oldReference, sourceAuthorityDigest: authority.authorityDigest,
  };
  delete referencePayload.referenceDigest;
  const reference = seal('ABSINTHE_TRANSACTION_REFERENCE_V1', referencePayload, 'referenceDigest');
  fixture.repository.put(reference);
}

export function createBootstrapFixture(): Readonly<{ repository: InMemoryAuthorityRepository; sessionId: string;
  ids: Readonly<{ firstSegment: string; secondSegment: string; firstAccumulator: string;
    secondAccumulator: string; terminal: string }> }> {
  const repository = new InMemoryAuthorityRepository();
  const sessionId = 'bootstrap-session:one';
  const category = 'entities';
  const itemInputs = [['bootstrap-item:one', 'alpha'], ['bootstrap-item:two', 'beta'],
    ['bootstrap-item:three', 'gamma']] as const;
  const items = itemInputs.map(([id, key]) => seal('ABSINTHE_BOOTSTRAP_ITEM_V1', {
    kind: 'absinthe_bootstrap_item', version: 1, id, sessionId, category, key,
    valueDigest: fixtureDigest('BOOTSTRAP_VALUE', [key]) }, 'itemDigest'));
  items.forEach(item => repository.put(item));
  const ids = Object.freeze({ firstSegment: 'bootstrap-segment:one', secondSegment: 'bootstrap-segment:two',
    firstAccumulator: 'bootstrap-accumulator:one', secondAccumulator: 'bootstrap-accumulator:two',
    terminal: 'bootstrap-terminal:one' });
  const firstContinuationId = 'bootstrap-continuation:one';
  const secondContinuationId = 'bootstrap-continuation:two';
  const firstSegment = seal('ABSINTHE_BOOTSTRAP_SEGMENT_V1', { kind: 'absinthe_bootstrap_segment', version: 1,
    id: ids.firstSegment, sessionId, category, index: 0, itemIds: items.slice(0, 2).map(item => item.id),
    itemDigests: items.slice(0, 2).map(item => item.itemDigest), firstKey: 'alpha', lastKey: 'beta',
    segmentRoot: fixtureDigest('ABSINTHE_BOOTSTRAP_SEGMENT_ROOT_V1', items.slice(0, 2).map(item => item.itemDigest)),
    continuationId: firstContinuationId }, 'segmentDigest');
  const secondSegment = seal('ABSINTHE_BOOTSTRAP_SEGMENT_V1', { kind: 'absinthe_bootstrap_segment', version: 1,
    id: ids.secondSegment, sessionId, category, index: 1, itemIds: [items[2].id],
    itemDigests: [items[2].itemDigest], firstKey: 'gamma', lastKey: 'gamma',
    segmentRoot: fixtureDigest('ABSINTHE_BOOTSTRAP_SEGMENT_ROOT_V1', [items[2].itemDigest]),
    continuationId: secondContinuationId }, 'segmentDigest');
  repository.put(firstSegment); repository.put(secondSegment);
  const firstBytes = items.slice(0, 2).reduce((sum, item) => sum + encoder.encode(item.key).byteLength + 32, 0);
  const firstChainRoot = fixtureDigest('ABSINTHE_BOOTSTRAP_CHAIN_V1', [null, firstSegment.segmentRoot]);
  const firstAccumulator = seal('ABSINTHE_BOOTSTRAP_ACCUMULATOR_V1', {
    kind: 'absinthe_bootstrap_accumulator', version: 1, id: ids.firstAccumulator, sessionId, category,
    segmentIndex: 0, priorAccumulatorId: null, priorAccumulatorDigest: null, segmentId: firstSegment.id,
    segmentDigest: firstSegment.segmentDigest, recordCount: 2, totalBytes: firstBytes, lastKey: 'beta',
    chainRoot: firstChainRoot }, 'accumulatorDigest');
  const totalBytes = firstBytes + encoder.encode('gamma').byteLength + 32;
  const secondChainRoot = fixtureDigest('ABSINTHE_BOOTSTRAP_CHAIN_V1', [firstChainRoot, secondSegment.segmentRoot]);
  const secondAccumulator = seal('ABSINTHE_BOOTSTRAP_ACCUMULATOR_V1', {
    kind: 'absinthe_bootstrap_accumulator', version: 1, id: ids.secondAccumulator, sessionId, category,
    segmentIndex: 1, priorAccumulatorId: firstAccumulator.id,
    priorAccumulatorDigest: firstAccumulator.accumulatorDigest, segmentId: secondSegment.id,
    segmentDigest: secondSegment.segmentDigest, recordCount: 3, totalBytes, lastKey: 'gamma',
    chainRoot: secondChainRoot }, 'accumulatorDigest');
  repository.put(firstAccumulator); repository.put(secondAccumulator);
  const terminal = seal('ABSINTHE_BOOTSTRAP_TERMINAL_V1', { kind: 'absinthe_bootstrap_terminal', version: 1,
    id: ids.terminal, sessionId, category, finalAccumulatorId: secondAccumulator.id,
    finalAccumulatorDigest: secondAccumulator.accumulatorDigest, totalSegments: 2, totalRecords: 3,
    totalBytes, finalKey: 'gamma', snapshotDigest: fixtureDigest('BOOTSTRAP_SNAPSHOT', ['one']),
    exhausted: true }, 'terminalDigest');
  repository.put(terminal);
  repository.put(seal('ABSINTHE_BOOTSTRAP_CONTINUATION_V1', { kind: 'absinthe_bootstrap_continuation',
    version: 1, id: firstContinuationId, sessionId, category, segmentId: firstSegment.id,
    nextSegmentId: secondSegment.id, terminalId: null }, 'continuationDigest'));
  repository.put(seal('ABSINTHE_BOOTSTRAP_CONTINUATION_V1', { kind: 'absinthe_bootstrap_continuation',
    version: 1, id: secondContinuationId, sessionId, category, segmentId: secondSegment.id,
    nextSegmentId: null, terminalId: terminal.id }, 'continuationDigest'));
  repository.put(seal('ABSINTHE_BOOTSTRAP_SESSION_V1', { kind: 'absinthe_bootstrap_session', version: 1,
    id: sessionId, namespace: 'namespace:one', generation: 'generation:one', baselineAuthorityDigest: null,
    manifestDigest: fixtureDigest('BOOTSTRAP_MANIFEST', ['one']), schemaVersion: 1,
    sourceProtocolVersion: 1, attachmentClassificationVersion: 1, categoryDefinitionVersion: 1,
    terminalRefs: [{ category, terminalId: terminal.id }] }, 'sessionDigest'));
  return Object.freeze({ repository, sessionId, ids });
}

export function createRestoreFixture(): Readonly<{ repository: InMemoryAuthorityRepository; sessionId: string;
  ids: Readonly<{ chunks: readonly string[]; segments: readonly string[]; mmr: string; terminal: string }> }> {
  const repository = new InMemoryAuthorityRepository();
  const sessionId = 'restore-session:one';
  const chunks = ['restore-chunk:zero', 'restore-chunk:one', 'restore-chunk:two'].map((id, index) =>
    seal('ABSINTHE_RESTORE_CHUNK_V1', { kind: 'absinthe_restore_chunk', version: 1, id, sessionId, index,
      payloadDigest: fixtureDigest('RESTORE_PAYLOAD', [index]) }, 'chunkDigest'));
  chunks.forEach(chunk => repository.put(chunk));
  const segmentInputs = [chunks.slice(0, 2), chunks.slice(2)];
  const segments = segmentInputs.map((entries, index) => seal('ABSINTHE_RESTORE_SEGMENT_V1', {
    kind: 'absinthe_restore_segment', version: 1, id: `restore-segment:${index}`, sessionId, index,
    chunkIds: entries.map(entry => entry.id), chunkDigests: entries.map(entry => entry.chunkDigest),
    firstChunkIndex: entries[0].index, lastChunkIndex: entries[entries.length - 1].index,
    segmentRoot: fixtureDigest('ABSINTHE_RESTORE_SEGMENT_ROOT_V1', entries.map(entry => entry.chunkDigest)) },
  'segmentDigest'));
  segments.forEach(segment => repository.put(segment));
  const componentNames = ['attachments', 'checkpoints', 'entities', 'outbox'];
  const components = componentNames.map(component => {
    const itemDigests = [fixtureDigest(`RESTORE_${component.toUpperCase()}`, ['one'])];
    return seal('ABSINTHE_RESTORE_COMPONENT_V1', { kind: 'absinthe_restore_component_root', version: 1,
      id: `restore-component:${component}`, sessionId, component, itemDigests, count: itemDigests.length,
      root: fixtureDigest('ABSINTHE_RESTORE_COMPONENT_ROOT_V1', itemDigests) }, 'componentDigest');
  });
  components.forEach(component => repository.put(component));
  const mmrId = 'restore-mmr:one';
  const mmr = seal('ABSINTHE_RESTORE_MMR_STATE_V1', { kind: 'absinthe_restore_mmr_state', version: 1,
    id: mmrId, sessionId, segmentDigests: segments.map(segment => segment.segmentDigest),
    leafCount: segments.length, root: fixtureDigest('ABSINTHE_RESTORE_MMR_ROOT_V1',
      segments.map(segment => segment.segmentDigest)) }, 'stateDigest');
  repository.put(mmr);
  const terminalId = 'restore-terminal:one';
  const terminal = seal('ABSINTHE_RESTORE_TERMINAL_V1', { kind: 'absinthe_restore_terminal', version: 1,
    id: terminalId, sessionId, chunkCount: chunks.length, segmentCount: segments.length,
    componentCount: components.length, complete: true }, 'terminalDigest');
  repository.put(terminal);
  repository.put(seal('ABSINTHE_RESTORE_SESSION_V1', { kind: 'absinthe_restore_session', version: 1,
    id: sessionId, namespace: 'namespace:one', generation: 'generation:one',
    planDigest: fixtureDigest('RESTORE_PLAN', ['one']), chunkIds: chunks.map(chunk => chunk.id),
    segmentIds: segments.map(segment => segment.id), componentRootIds: components.map(component => component.id),
    mmrStateId: mmr.id, terminalId: terminal.id, existingManifestId: null }, 'sessionDigest'));
  return Object.freeze({ repository, sessionId, ids: Object.freeze({ chunks: chunks.map(chunk => chunk.id),
    segments: segments.map(segment => segment.id), mmr: mmr.id, terminal: terminal.id }) });
}

export function resignFixtureRecord(record: PersistedRecord): PersistedRecord {
  const mapping: Record<string, readonly [string, string]> = {
    absinthe_source_transaction_reference: ['ABSINTHE_TRANSACTION_REFERENCE_V1', 'referenceDigest'],
    absinthe_source_authority: ['ABSINTHE_SOURCE_AUTHORITY_V1', 'authorityDigest'],
    absinthe_k330_operation: ['ABSINTHE_K330_OPERATION_V1', 'operationDigest'],
    absinthe_k330_admission: ['ABSINTHE_K330_ADMISSION_V1', 'admissionDigest'],
    absinthe_writer_identity: ['ABSINTHE_WRITER_IDENTITY_V1', 'writerDigest'],
    absinthe_writer_session: ['ABSINTHE_WRITER_SESSION_V1', 'sessionDigest'],
    absinthe_terminal_state: ['ABSINTHE_TERMINAL_STATE_V1', 'terminalDigest'],
    absinthe_immutable_outbox_intent: ['ABSINTHE_IMMUTABLE_OUTBOX_V1', 'outboxDigest'],
    absinthe_segment_checkpoint: ['ABSINTHE_SEGMENT_CHECKPOINT_V1', 'checkpointDigest'],
    absinthe_mmr_state: ['ABSINTHE_MMR_STATE_V1', 'stateDigest'],
    absinthe_compacted_authority_projection: ['ABSINTHE_COMPACTED_PROJECTION_V1', 'projectionDigest'],
    absinthe_lifecycle_event: ['ABSINTHE_LIFECYCLE_EVENT_V1', 'eventDigest'],
    absinthe_lifecycle_head: ['ABSINTHE_LIFECYCLE_HEAD_V1', 'headDigest'],
    absinthe_bootstrap_item: ['ABSINTHE_BOOTSTRAP_ITEM_V1', 'itemDigest'],
    absinthe_bootstrap_segment: ['ABSINTHE_BOOTSTRAP_SEGMENT_V1', 'segmentDigest'],
    absinthe_bootstrap_continuation: ['ABSINTHE_BOOTSTRAP_CONTINUATION_V1', 'continuationDigest'],
    absinthe_bootstrap_accumulator: ['ABSINTHE_BOOTSTRAP_ACCUMULATOR_V1', 'accumulatorDigest'],
    absinthe_bootstrap_terminal: ['ABSINTHE_BOOTSTRAP_TERMINAL_V1', 'terminalDigest'],
    absinthe_bootstrap_session: ['ABSINTHE_BOOTSTRAP_SESSION_V1', 'sessionDigest'],
    absinthe_restore_chunk: ['ABSINTHE_RESTORE_CHUNK_V1', 'chunkDigest'],
    absinthe_restore_segment: ['ABSINTHE_RESTORE_SEGMENT_V1', 'segmentDigest'],
    absinthe_restore_component_root: ['ABSINTHE_RESTORE_COMPONENT_V1', 'componentDigest'],
    absinthe_restore_mmr_state: ['ABSINTHE_RESTORE_MMR_STATE_V1', 'stateDigest'],
    absinthe_restore_terminal: ['ABSINTHE_RESTORE_TERMINAL_V1', 'terminalDigest'],
    absinthe_restore_manifest: ['ABSINTHE_RESTORE_MANIFEST_V1', 'manifestDigest'],
    absinthe_restore_session: ['ABSINTHE_RESTORE_SESSION_V1', 'sessionDigest'],
    absinthe_attachment_classification_evidence: ['ABSINTHE_ATTACHMENT_CLASSIFICATION_V1', 'classificationDigest'],
  };
  const entry = mapping[record.kind as string];
  if (!entry) throw new Error('unsupported deterministic fixture record');
  const payload = { ...record };
  delete payload[entry[1]];
  return seal(entry[0], payload, entry[1]);
}

export function validRecordFixtures(): Readonly<Record<keyof typeof RECORD_SPECIFIC_CODEC_REGISTRY, PersistedRecord>> {
  const reconciliation = createReconciliationFixture();
  const bootstrap = createBootstrapFixture();
  const restore = createRestoreFixture();
  const get = (repository: InMemoryAuthorityRepository, id: string) => repository.read(id) as PersistedRecord;
  const attachment = seal('ABSINTHE_ATTACHMENT_CLASSIFICATION_V1', {
    kind: 'absinthe_attachment_classification_evidence', version: 1, id: 'attachment-classification:one',
    attachmentContractVersion: 1, fields: ATTACHMENT_METADATA_FIELDS }, 'classificationDigest');
  return Object.freeze({
    writer_identity: get(reconciliation.repository, reconciliation.ids.writer),
    writer_session: get(reconciliation.repository, reconciliation.ids.session),
    k330_admission: get(reconciliation.repository, reconciliation.ids.admission),
    k330_operation: get(reconciliation.repository, reconciliation.ids.operation),
    terminal_state: get(reconciliation.repository, reconciliation.ids.terminal),
    immutable_outbox_intent: get(reconciliation.repository, reconciliation.ids.outbox),
    segment_checkpoint: get(reconciliation.repository, reconciliation.ids.checkpoint),
    mmr_state: get(reconciliation.repository, reconciliation.ids.mmrState),
    lifecycle_event: get(reconciliation.repository, reconciliation.ids.tombstoneEvent),
    lifecycle_head: get(reconciliation.repository, reconciliation.ids.lifecycleHead),
    source_authority: get(reconciliation.repository, reconciliation.ids.sourceAuthority),
    source_transaction_reference: get(reconciliation.repository, reconciliation.ids.transactionReference),
    raw_source_receipt: get(reconciliation.repository, reconciliation.ids.receipt),
    compacted_authority_projection: get(reconciliation.repository, reconciliation.ids.projection),
    bootstrap_item: get(bootstrap.repository, 'bootstrap-item:one'),
    bootstrap_segment: get(bootstrap.repository, bootstrap.ids.firstSegment),
    bootstrap_continuation: get(bootstrap.repository, 'bootstrap-continuation:one'),
    bootstrap_accumulator: get(bootstrap.repository, bootstrap.ids.firstAccumulator),
    bootstrap_terminal: get(bootstrap.repository, bootstrap.ids.terminal),
    bootstrap_session: get(bootstrap.repository, bootstrap.sessionId),
    restore_chunk: get(restore.repository, restore.ids.chunks[0]),
    restore_segment: get(restore.repository, restore.ids.segments[0]),
    restore_component_root: get(restore.repository, 'restore-component:attachments'),
    restore_mmr_state: get(restore.repository, restore.ids.mmr),
    restore_terminal: get(restore.repository, restore.ids.terminal),
    restore_manifest: (() => {
      const result = finalizeRestore(restore.repository, restore.sessionId);
      if (!result.ok) throw new Error(result.code);
      return result.value;
    })(),
    restore_session: get(restore.repository, restore.sessionId),
    attachment_classification_evidence: attachment,
  });
}
