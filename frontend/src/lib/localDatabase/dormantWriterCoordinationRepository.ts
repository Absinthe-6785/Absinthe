import { LocalDatabaseError } from './errors';
import { namespaceFingerprint, validateNamespace } from './namespace';
import { sha256Hex } from './outboxIdentity';
import { assertLocalDatabaseVersion, createLocalDatabaseSchema, LOCAL_DATABASE_STORES } from './schema';
import {
  LOCAL_DATABASE_NAME,
  LOCAL_DATABASE_VERSION,
  type LocalDatabaseNamespace,
} from './types';
import {
  WRITER_COORDINATION_LIMITS,
  createWriterCoordinationModel,
  decodeWriterCoordinationModelCanonical,
  deriveCoordinationAuthorityDigest,
  encodeWriterCoordinationModelCanonical,
  reduceWriterCoordination,
  validateWriterCoordinationModelRelations,
  validateWriterCoordinationModelState,
  type OperationState,
  type SourceVerificationObservation,
  type WriterCoordinationAction,
  type WriterCoordinationActor,
  type WriterCoordinationModelState,
  type WriterEligibilityErrorCode,
} from './writerCoordinationEligibility';

/** K-330 durable foundation. This module has no production caller or Web Locks implementation. */
export const DORMANT_WRITER_COORDINATION_ENVELOPE_SCHEMA = 1 as const;
export const DORMANT_WRITER_COORDINATION_STORE = LOCAL_DATABASE_STORES.writerCoordinationState;
export const DORMANT_WRITER_COORDINATION_LIMITS = Object.freeze({
  envelopeBytes: WRITER_COORDINATION_LIMITS.modelBytes + 4096,
  namespaceBytes: 64,
  generationBytes: 128,
});

export type DormantWriterCoordinationErrorCode =
  | 'DORMANT_WRITER_COORDINATION_CAPABILITY_REQUIRED'
  | 'DORMANT_WRITER_COORDINATION_OPEN_FAILED'
  | 'DORMANT_WRITER_COORDINATION_OPEN_BLOCKED'
  | 'DORMANT_WRITER_COORDINATION_DATABASE_CLOSED'
  | 'DORMANT_WRITER_COORDINATION_STALE_CONNECTION'
  | 'DORMANT_WRITER_COORDINATION_SCHEMA_UNSUPPORTED'
  | 'DORMANT_WRITER_COORDINATION_NO_STATE'
  | 'DORMANT_WRITER_COORDINATION_ALREADY_INITIALIZED'
  | 'WRITER_COORDINATION_GENERATION_MISMATCH'
  | 'WRITER_COORDINATION_EPOCH_MISMATCH'
  | 'WRITER_COORDINATION_REVISION_MISMATCH'
  | 'WRITER_COORDINATION_AUTHORITY_MISMATCH'
  | 'WRITER_COORDINATION_CHECKPOINT_PREDECESSOR_MISMATCH'
  | 'WRITER_COORDINATION_OPERATION_STATE_MISMATCH'
  | 'WRITER_COORDINATION_SOURCE_REVISION_MISMATCH'
  | 'WRITER_COORDINATION_MODEL_REJECTED'
  | 'CORRUPT_PERSISTED_RECORD'
  | 'DORMANT_WRITER_COORDINATION_TRANSACTION_ABORTED'
  | 'DORMANT_WRITER_COORDINATION_TRANSACTION_FAILED';

export class DormantWriterCoordinationError extends Error {
  readonly code: DormantWriterCoordinationErrorCode;
  readonly operation: string;
  readonly modelCode: WriterEligibilityErrorCode | null;

  constructor(code: DormantWriterCoordinationErrorCode, operation: string,
    modelCode: WriterEligibilityErrorCode | null = null) {
    super(`${code}:${operation}`);
    this.name = 'DormantWriterCoordinationError';
    this.code = code;
    this.operation = operation;
    this.modelCode = modelCode;
  }
}

const capabilityMarker = Symbol('absinthe-k330-dormant-writer-coordination-capability');
export interface DormantWriterCoordinationCapability {
  readonly marker: symbol;
  readonly purpose: 'test' | 'developer';
}

export function createDormantWriterCoordinationCapability(
  purpose: 'test' | 'developer',
): DormantWriterCoordinationCapability {
  return Object.freeze({ marker: capabilityMarker, purpose });
}

export interface PersistedWriterCoordinationEnvelopeV1 {
  kind: 'absinthe_dormant_writer_coordination_envelope';
  schemaVersion: 1;
  databaseNamespace: string;
  databaseGeneration: string;
  coordinationEpoch: number;
  transitionRevision: number;
  authorityDigest: string;
  canonicalModelDigest: string;
  coordinationModel: unknown;
}

export interface DormantWriterCoordinationCas {
  databaseGeneration: string;
  coordinationEpoch: number;
  transitionRevision: number;
  authorityDigest: string;
  previousCheckpointDigest?: string | null;
  expectedOperationState?: OperationState;
  expectedSourceRevision?: string;
}

export type DormantWriterCoordinationSnapshot =
  | { status: 'empty' }
  | {
    status: 'valid';
    state: WriterCoordinationModelState;
    cas: Readonly<DormantWriterCoordinationCas>;
  };

export type DormantWriterCoordinationFailurePoint = 'none' | 'after_write_request';

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const HASH = /^[a-f0-9]{64}$/;
const SOURCE_REVISION = /^(0|[1-9][0-9]{0,15})$/;
const ENVELOPE_KEYS = [
  'kind', 'schemaVersion', 'databaseNamespace', 'databaseGeneration', 'coordinationEpoch',
  'transitionRevision', 'authorityDigest', 'canonicalModelDigest', 'coordinationModel',
] as const;
const CAS_KEYS = new Set([
  'databaseGeneration', 'coordinationEpoch', 'transitionRevision', 'authorityDigest',
  'previousCheckpointDigest', 'expectedOperationState', 'expectedSourceRevision',
]);

function bytesEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.byteLength !== right.byteLength) return false;
  for (let index = 0; index < left.byteLength; index += 1) if (left[index] !== right[index]) return false;
  return true;
}

function exactRecord(value: unknown, expected: readonly string[]): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)) return false;
  const keys = Reflect.ownKeys(value);
  if (keys.some(key => typeof key !== 'string') || keys.length !== expected.length) return false;
  const actual = (keys as string[]).slice().sort();
  const wanted = [...expected].sort();
  if (actual.some((key, index) => key !== wanted[index])) return false;
  return keys.every(key => {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return Boolean(descriptor && 'value' in descriptor && descriptor.enumerable && !descriptor.get && !descriptor.set);
  });
}

function detachedModel(state: WriterCoordinationModelState): WriterCoordinationModelState {
  const decoded = decodeWriterCoordinationModelCanonical(encodeWriterCoordinationModelCanonical(state));
  if (!decoded.ok) throw new DormantWriterCoordinationError('CORRUPT_PERSISTED_RECORD', 'detach_model');
  return decoded.value;
}

function assertPersistableState(state: WriterCoordinationModelState, operation: string): void {
  if (!validateWriterCoordinationModelState(state) || validateWriterCoordinationModelRelations(state) !== null) {
    throw new DormantWriterCoordinationError('WRITER_COORDINATION_MODEL_REJECTED', operation);
  }
  // Checkpoint 6 is a transient reducer state. K-330 persists it only together with final eligibility evidence.
  if (state.checkpointChain.length === 6 && state.eligibilityEvidence === null) {
    throw new DormantWriterCoordinationError('WRITER_COORDINATION_MODEL_REJECTED', operation,
      'ELIGIBILITY_EVIDENCE_RELATION_MISMATCH');
  }
}

export function encodeDormantWriterCoordinationEnvelope(input: {
  databaseNamespace: string;
  databaseGeneration: string;
  state: WriterCoordinationModelState;
}): Uint8Array {
  assertPersistableState(input.state, 'encode_envelope');
  if (!HASH.test(input.databaseNamespace)
    || encoder.encode(input.databaseNamespace).byteLength > DORMANT_WRITER_COORDINATION_LIMITS.namespaceBytes
    || typeof input.databaseGeneration !== 'string' || input.databaseGeneration.length === 0
    || encoder.encode(input.databaseGeneration).byteLength > DORMANT_WRITER_COORDINATION_LIMITS.generationBytes) {
    throw new DormantWriterCoordinationError('CORRUPT_PERSISTED_RECORD', 'encode_envelope_binding');
  }
  const modelBytes = encodeWriterCoordinationModelCanonical(input.state);
  const modelText = decoder.decode(modelBytes);
  const envelope: PersistedWriterCoordinationEnvelopeV1 = {
    kind: 'absinthe_dormant_writer_coordination_envelope',
    schemaVersion: DORMANT_WRITER_COORDINATION_ENVELOPE_SCHEMA,
    databaseNamespace: input.databaseNamespace,
    databaseGeneration: input.databaseGeneration,
    coordinationEpoch: input.state.authority.coordinationEpoch,
    transitionRevision: input.state.authority.transitionRevision,
    authorityDigest: deriveCoordinationAuthorityDigest(input.state.authority),
    canonicalModelDigest: sha256Hex(modelText),
    coordinationModel: JSON.parse(modelText) as unknown,
  };
  const bytes = encoder.encode(JSON.stringify(envelope));
  if (bytes.byteLength > DORMANT_WRITER_COORDINATION_LIMITS.envelopeBytes) {
    throw new DormantWriterCoordinationError('CORRUPT_PERSISTED_RECORD', 'encode_envelope_size');
  }
  return bytes;
}

export function decodeDormantWriterCoordinationEnvelope(
  bytes: Uint8Array,
  expectedNamespace: string,
  expectedGeneration: string,
): WriterCoordinationModelState {
  if (!(bytes instanceof Uint8Array) || bytes.byteLength === 0
    || bytes.byteLength > DORMANT_WRITER_COORDINATION_LIMITS.envelopeBytes) {
    throw new DormantWriterCoordinationError('CORRUPT_PERSISTED_RECORD', 'decode_envelope_size');
  }
  let text: string;
  let value: unknown;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    value = JSON.parse(text) as unknown;
  } catch {
    throw new DormantWriterCoordinationError('CORRUPT_PERSISTED_RECORD', 'decode_envelope_json');
  }
  if (value && typeof value === 'object'
    && (value as { kind?: unknown }).kind === 'absinthe_dormant_writer_coordination_envelope'
    && (value as { schemaVersion?: unknown }).schemaVersion !== DORMANT_WRITER_COORDINATION_ENVELOPE_SCHEMA) {
    throw new DormantWriterCoordinationError('DORMANT_WRITER_COORDINATION_SCHEMA_UNSUPPORTED', 'decode_envelope_schema');
  }
  if (!exactRecord(value, ENVELOPE_KEYS)) {
    throw new DormantWriterCoordinationError('CORRUPT_PERSISTED_RECORD', 'decode_envelope_shape');
  }
  const envelope = value as unknown as PersistedWriterCoordinationEnvelopeV1;
  if (envelope.kind !== 'absinthe_dormant_writer_coordination_envelope'
    || envelope.schemaVersion !== DORMANT_WRITER_COORDINATION_ENVELOPE_SCHEMA
    || !HASH.test(envelope.databaseNamespace) || typeof envelope.databaseGeneration !== 'string'
    || !Number.isSafeInteger(envelope.coordinationEpoch) || envelope.coordinationEpoch < 1
    || !Number.isSafeInteger(envelope.transitionRevision) || envelope.transitionRevision < 0
    || !HASH.test(envelope.authorityDigest) || !HASH.test(envelope.canonicalModelDigest)) {
    throw new DormantWriterCoordinationError('CORRUPT_PERSISTED_RECORD', 'decode_envelope_fields');
  }
  if (envelope.databaseNamespace !== expectedNamespace) {
    throw new DormantWriterCoordinationError('CORRUPT_PERSISTED_RECORD', 'decode_envelope_namespace');
  }
  if (envelope.databaseGeneration !== expectedGeneration) {
    throw new DormantWriterCoordinationError('WRITER_COORDINATION_GENERATION_MISMATCH', 'decode_envelope_generation');
  }
  let modelBytes: Uint8Array;
  try { modelBytes = encoder.encode(JSON.stringify(envelope.coordinationModel)); }
  catch { throw new DormantWriterCoordinationError('CORRUPT_PERSISTED_RECORD', 'decode_model_json'); }
  const decoded = decodeWriterCoordinationModelCanonical(modelBytes);
  if (!decoded.ok) {
    throw new DormantWriterCoordinationError(
      decoded.code === 'ELIGIBILITY_PROTOCOL_VERSION_UNSUPPORTED'
        ? 'DORMANT_WRITER_COORDINATION_SCHEMA_UNSUPPORTED' : 'CORRUPT_PERSISTED_RECORD',
      'decode_model',
    );
  }
  if (sha256Hex(decoder.decode(modelBytes)) !== envelope.canonicalModelDigest
    || decoded.value.authority.coordinationEpoch !== envelope.coordinationEpoch
    || decoded.value.authority.transitionRevision !== envelope.transitionRevision
    || deriveCoordinationAuthorityDigest(decoded.value.authority) !== envelope.authorityDigest) {
    throw new DormantWriterCoordinationError('CORRUPT_PERSISTED_RECORD', 'decode_envelope_digest');
  }
  assertPersistableState(decoded.value, 'decode_envelope_relations');
  const canonical = encodeDormantWriterCoordinationEnvelope({
    databaseNamespace: expectedNamespace,
    databaseGeneration: expectedGeneration,
    state: decoded.value,
  });
  if (!bytesEqual(bytes, canonical)) {
    throw new DormantWriterCoordinationError('CORRUPT_PERSISTED_RECORD', 'decode_envelope_noncanonical');
  }
  return decoded.value;
}

function requestResult<T>(request: IDBRequest<T>, operation: string): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new DormantWriterCoordinationError(
      'DORMANT_WRITER_COORDINATION_TRANSACTION_FAILED', operation,
    ));
  });
}

function transactionCompletion(transaction: IDBTransaction, operation: string): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(new DormantWriterCoordinationError(
      'DORMANT_WRITER_COORDINATION_TRANSACTION_ABORTED', operation,
    ));
    transaction.onerror = () => undefined;
  });
}

function abortQuietly(transaction: IDBTransaction): void {
  try { transaction.abort(); } catch { /* transaction already inactive */ }
}

function mapUnexpected(error: unknown, operation: string): DormantWriterCoordinationError {
  if (error instanceof DormantWriterCoordinationError) return error;
  if (error instanceof LocalDatabaseError && error.code === 'INVALID_NAMESPACE') {
    return new DormantWriterCoordinationError('CORRUPT_PERSISTED_RECORD', operation);
  }
  return new DormantWriterCoordinationError('DORMANT_WRITER_COORDINATION_TRANSACTION_FAILED', operation);
}

function reductionError(code: WriterEligibilityErrorCode, operation: string): DormantWriterCoordinationError {
  if (code === 'COORDINATION_EPOCH_STALE') {
    return new DormantWriterCoordinationError('WRITER_COORDINATION_EPOCH_MISMATCH', operation, code);
  }
  if (code === 'TRANSITION_REVISION_STALE') {
    return new DormantWriterCoordinationError('WRITER_COORDINATION_REVISION_MISMATCH', operation, code);
  }
  if (code === 'CHECKPOINT_CHAIN_INVALID') {
    return new DormantWriterCoordinationError('WRITER_COORDINATION_CHECKPOINT_PREDECESSOR_MISMATCH', operation, code);
  }
  if (code === 'IN_FLIGHT_STATE_AMBIGUOUS') {
    return new DormantWriterCoordinationError('WRITER_COORDINATION_OPERATION_STATE_MISMATCH', operation, code);
  }
  if (code === 'SOURCE_REVISION_UNSTABLE' || code === 'SOURCE_CHANGED_DURING_VERIFICATION') {
    return new DormantWriterCoordinationError('WRITER_COORDINATION_SOURCE_REVISION_MISMATCH', operation, code);
  }
  return new DormantWriterCoordinationError('WRITER_COORDINATION_MODEL_REJECTED', operation, code);
}

function normalizeCas(value: DormantWriterCoordinationCas, operation: string): DormantWriterCoordinationCas {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)
    || Reflect.ownKeys(value).some(key => typeof key !== 'string' || !CAS_KEYS.has(key))) {
    throw new DormantWriterCoordinationError('WRITER_COORDINATION_REVISION_MISMATCH', operation);
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (Object.values(descriptors).some(descriptor => !('value' in descriptor) || !descriptor.enumerable
    || descriptor.get !== undefined || descriptor.set !== undefined)) {
    throw new DormantWriterCoordinationError('WRITER_COORDINATION_REVISION_MISMATCH', operation);
  }
  const detachedEntries = Object.entries(descriptors)
    .map(([key, descriptor]) => [key, (descriptor as PropertyDescriptor & { value: unknown }).value]);
  const detached = Object.fromEntries(detachedEntries) as unknown as DormantWriterCoordinationCas;
  if (typeof detached.databaseGeneration !== 'string' || detached.databaseGeneration.length === 0
    || !Number.isSafeInteger(detached.coordinationEpoch) || detached.coordinationEpoch < 1
    || !Number.isSafeInteger(detached.transitionRevision) || detached.transitionRevision < 0
    || !HASH.test(detached.authorityDigest)
    || (detached.previousCheckpointDigest !== undefined && detached.previousCheckpointDigest !== null
      && !HASH.test(detached.previousCheckpointDigest))
    || (detached.expectedOperationState !== undefined
      && !['admitted', 'committed', 'aborted', 'failed'].includes(detached.expectedOperationState))
    || (detached.expectedSourceRevision !== undefined && !SOURCE_REVISION.test(detached.expectedSourceRevision))) {
    throw new DormantWriterCoordinationError('WRITER_COORDINATION_REVISION_MISMATCH', operation);
  }
  return detached;
}

function snapshotCas(state: WriterCoordinationModelState, generation: string): DormantWriterCoordinationCas {
  const lastCheckpoint = state.checkpointChain[state.checkpointChain.length - 1];
  return Object.freeze({
    databaseGeneration: generation,
    coordinationEpoch: state.authority.coordinationEpoch,
    transitionRevision: state.authority.transitionRevision,
    authorityDigest: deriveCoordinationAuthorityDigest(state.authority),
    previousCheckpointDigest: lastCheckpoint?.checkpointDigest ?? null,
    expectedSourceRevision: state.sourceEvidence?.revisionAfter,
  });
}

interface ConnectionState { closed: boolean; stale: boolean }

export class DormantWriterCoordinationRepository {
  readonly namespace: LocalDatabaseNamespace;
  readonly namespaceKey: string;
  private readonly db: IDBDatabase;
  private readonly connection: ConnectionState;
  private readonly capabilityPurpose: 'test' | 'developer';

  constructor(db: IDBDatabase, namespace: LocalDatabaseNamespace, namespaceKey: string,
    connection: ConnectionState, capabilityPurpose: 'test' | 'developer') {
    this.db = db;
    this.namespace = Object.freeze({ ...namespace });
    this.namespaceKey = namespaceKey;
    this.connection = connection;
    this.capabilityPurpose = capabilityPurpose;
  }

  close(): void {
    if (!this.connection.closed) this.db.close();
    this.connection.closed = true;
  }

  private assertOpen(operation: string): void {
    if (this.connection.stale) {
      throw new DormantWriterCoordinationError('DORMANT_WRITER_COORDINATION_STALE_CONNECTION', operation);
    }
    if (this.connection.closed) {
      throw new DormantWriterCoordinationError('DORMANT_WRITER_COORDINATION_DATABASE_CLOSED', operation);
    }
  }

  private key(): [string, string] { return [this.namespaceKey, this.namespace.generationId]; }

  private assertFailurePoint(point: DormantWriterCoordinationFailurePoint | undefined): void {
    if (point !== undefined && point !== 'none' && this.capabilityPurpose !== 'test') {
      throw new DormantWriterCoordinationError(
        'DORMANT_WRITER_COORDINATION_CAPABILITY_REQUIRED', 'test_failure_point',
      );
    }
  }

  async readSnapshot(): Promise<DormantWriterCoordinationSnapshot> {
    this.assertOpen('read_snapshot');
    const transaction = this.db.transaction(DORMANT_WRITER_COORDINATION_STORE, 'readonly');
    const done = transactionCompletion(transaction, 'read_snapshot');
    try {
      const raw = await requestResult(
        transaction.objectStore(DORMANT_WRITER_COORDINATION_STORE).get(this.key()),
        'read_snapshot_record',
      ) as Uint8Array | undefined;
      await done;
      if (raw === undefined) return Object.freeze({ status: 'empty' });
      const state = decodeDormantWriterCoordinationEnvelope(raw, this.namespaceKey, this.namespace.generationId);
      return Object.freeze({ status: 'valid', state, cas: snapshotCas(state, this.namespace.generationId) });
    } catch (error) {
      abortQuietly(transaction);
      await done.catch(() => undefined);
      throw mapUnexpected(error, 'read_snapshot');
    }
  }

  async readCurrentEpoch(): Promise<number | null> {
    const snapshot = await this.readSnapshot();
    return snapshot.status === 'empty' ? null : snapshot.state.authority.coordinationEpoch;
  }

  async initialize(input: {
    expectedDatabaseGeneration: string;
    physicalSourceDigest: string;
    coordinatorSessionId: string;
    verifierSessionId: string;
    recoverySessionId: string;
    failurePointForTest?: DormantWriterCoordinationFailurePoint;
  }): Promise<WriterCoordinationModelState> {
    this.assertOpen('initialize');
    this.assertFailurePoint(input.failurePointForTest);
    if (input.expectedDatabaseGeneration !== this.namespace.generationId) {
      throw new DormantWriterCoordinationError('WRITER_COORDINATION_GENERATION_MISMATCH', 'initialize');
    }
    let state: WriterCoordinationModelState;
    let bytes: Uint8Array;
    try {
      state = createWriterCoordinationModel(input);
      bytes = encodeDormantWriterCoordinationEnvelope({
        databaseNamespace: this.namespaceKey,
        databaseGeneration: this.namespace.generationId,
        state,
      });
    } catch (error) { throw mapUnexpected(error, 'initialize_model'); }
    const transaction = this.db.transaction(DORMANT_WRITER_COORDINATION_STORE, 'readwrite', { durability: 'strict' });
    const done = transactionCompletion(transaction, 'initialize');
    try {
      const store = transaction.objectStore(DORMANT_WRITER_COORDINATION_STORE);
      const existing = await requestResult(store.get(this.key()), 'initialize_read') as Uint8Array | undefined;
      if (existing !== undefined) {
        throw new DormantWriterCoordinationError('DORMANT_WRITER_COORDINATION_ALREADY_INITIALIZED', 'initialize');
      }
      const request = store.add(bytes, this.key());
      if (input.failurePointForTest === 'after_write_request') {
        throw new DormantWriterCoordinationError('DORMANT_WRITER_COORDINATION_TRANSACTION_ABORTED', 'initialize_injected');
      }
      await requestResult(request, 'initialize_write');
      await done;
      return detachedModel(state);
    } catch (error) {
      abortQuietly(transaction);
      await done.catch(() => undefined);
      throw mapUnexpected(error, 'initialize');
    }
  }

  private assertCas(state: WriterCoordinationModelState, casValue: DormantWriterCoordinationCas,
    operation: string, action?: WriterCoordinationAction): DormantWriterCoordinationCas {
    const cas = normalizeCas(casValue, operation);
    if (cas.databaseGeneration !== this.namespace.generationId) {
      throw new DormantWriterCoordinationError('WRITER_COORDINATION_GENERATION_MISMATCH', operation);
    }
    if (cas.coordinationEpoch !== state.authority.coordinationEpoch) {
      throw new DormantWriterCoordinationError('WRITER_COORDINATION_EPOCH_MISMATCH', operation);
    }
    if (cas.transitionRevision !== state.authority.transitionRevision) {
      throw new DormantWriterCoordinationError('WRITER_COORDINATION_REVISION_MISMATCH', operation);
    }
    if (cas.authorityDigest !== deriveCoordinationAuthorityDigest(state.authority)) {
      throw new DormantWriterCoordinationError('WRITER_COORDINATION_AUTHORITY_MISMATCH', operation);
    }
    if (Object.prototype.hasOwnProperty.call(cas, 'previousCheckpointDigest')
      && cas.previousCheckpointDigest
        !== (state.checkpointChain[state.checkpointChain.length - 1]?.checkpointDigest ?? null)) {
      throw new DormantWriterCoordinationError('WRITER_COORDINATION_CHECKPOINT_PREDECESSOR_MISMATCH', operation);
    }
    if (cas.expectedOperationState !== undefined && action !== undefined) {
      const operationId = action?.type === 'TERMINALIZE_OPERATION' ? action.operationId : null;
      const persisted = operationId ? state.operations.find(value => value.operationId === operationId) : undefined;
      if (!persisted || persisted.state !== cas.expectedOperationState) {
        throw new DormantWriterCoordinationError('WRITER_COORDINATION_OPERATION_STATE_MISMATCH', operation);
      }
    }
    if (cas.expectedSourceRevision !== undefined
      && (state.sourceEvidence !== null || action?.type === 'CAPTURE_SOURCE_EVIDENCE')) {
      const sourceRevision = state.sourceEvidence?.revisionAfter
        ?? (action?.type === 'CAPTURE_SOURCE_EVIDENCE' ? action.observation.revisionBefore : null);
      if (sourceRevision !== cas.expectedSourceRevision) {
        throw new DormantWriterCoordinationError('WRITER_COORDINATION_SOURCE_REVISION_MISMATCH', operation);
      }
    }
    return cas;
  }

  private async mutate(
    operation: string,
    casValue: DormantWriterCoordinationCas,
    transition: (state: WriterCoordinationModelState) => WriterCoordinationModelState,
    failurePointForTest?: DormantWriterCoordinationFailurePoint,
  ): Promise<WriterCoordinationModelState> {
    this.assertOpen(operation);
    this.assertFailurePoint(failurePointForTest);
    const cas = normalizeCas(casValue, operation);
    const transaction = this.db.transaction(DORMANT_WRITER_COORDINATION_STORE, 'readwrite', { durability: 'strict' });
    const done = transactionCompletion(transaction, operation);
    try {
      const store = transaction.objectStore(DORMANT_WRITER_COORDINATION_STORE);
      const raw = await requestResult(store.get(this.key()), `${operation}_read`) as Uint8Array | undefined;
      if (raw === undefined) {
        throw new DormantWriterCoordinationError('DORMANT_WRITER_COORDINATION_NO_STATE', operation);
      }
      const state = decodeDormantWriterCoordinationEnvelope(raw, this.namespaceKey, this.namespace.generationId);
      this.assertCas(state, cas, operation);
      const next = transition(state);
      assertPersistableState(next, operation);
      const bytes = encodeDormantWriterCoordinationEnvelope({
        databaseNamespace: this.namespaceKey,
        databaseGeneration: this.namespace.generationId,
        state: next,
      });
      const request = store.put(bytes, this.key());
      if (failurePointForTest === 'after_write_request') {
        throw new DormantWriterCoordinationError('DORMANT_WRITER_COORDINATION_TRANSACTION_ABORTED', `${operation}_injected`);
      }
      await requestResult(request, `${operation}_write`);
      await done;
      return detachedModel(next);
    } catch (error) {
      abortQuietly(transaction);
      await done.catch(() => undefined);
      throw mapUnexpected(error, operation);
    }
  }

  applyAction(input: {
    action: WriterCoordinationAction;
    cas: DormantWriterCoordinationCas;
    failurePointForTest?: DormantWriterCoordinationFailurePoint;
  }): Promise<WriterCoordinationModelState> {
    let action: WriterCoordinationAction;
    let detachedCas: DormantWriterCoordinationCas;
    try { action = structuredClone(input.action); }
    catch { return Promise.reject(new DormantWriterCoordinationError('WRITER_COORDINATION_MODEL_REJECTED', 'apply_action')); }
    try { detachedCas = normalizeCas(input.cas, 'apply_action'); }
    catch (error) { return Promise.reject(error); }
    const requiresCheckpointPredecessor = [
      'CAPTURE_BEFORE_DRAIN', 'CAPTURE_AFTER_ADMISSION_CLOSED', 'CAPTURE_AFTER_OPERATIONS_TERMINAL',
      'CAPTURE_BEFORE_SOURCE_VERIFICATION', 'CAPTURE_SOURCE_EVIDENCE',
    ].includes(action.type);
    if (requiresCheckpointPredecessor
      && !Object.prototype.hasOwnProperty.call(detachedCas, 'previousCheckpointDigest')) {
      return Promise.reject(new DormantWriterCoordinationError(
        'WRITER_COORDINATION_CHECKPOINT_PREDECESSOR_MISMATCH', 'apply_action',
      ));
    }
    if (action.type === 'CAPTURE_SOURCE_EVIDENCE' && detachedCas.expectedSourceRevision === undefined) {
      return Promise.reject(new DormantWriterCoordinationError(
        'WRITER_COORDINATION_SOURCE_REVISION_MISMATCH', 'apply_action',
      ));
    }
    if (action.type === 'TERMINALIZE_OPERATION' && detachedCas.expectedOperationState === undefined) {
      return Promise.reject(new DormantWriterCoordinationError(
        'WRITER_COORDINATION_OPERATION_STATE_MISMATCH', 'apply_action',
      ));
    }
    if (action.type === 'CAPTURE_BEFORE_ELIGIBILITY_COMMIT' || action.type === 'COMMIT_ELIGIBILITY') {
      return Promise.reject(new DormantWriterCoordinationError(
        'WRITER_COORDINATION_MODEL_REJECTED', 'atomic_eligibility_required',
        'ELIGIBILITY_EVIDENCE_RELATION_MISMATCH',
      ));
    }
    return this.mutate('apply_action', detachedCas, state => {
      this.assertCas(state, detachedCas, 'apply_action', action);
      const result = reduceWriterCoordination(state, action);
      if (!result.ok) throw reductionError(result.code, 'apply_action');
      return result.state;
    }, input.failurePointForTest);
  }

  registerWriter(input: { action: Extract<WriterCoordinationAction, { type: 'REGISTER_WRITER' }>;
    cas: DormantWriterCoordinationCas; failurePointForTest?: DormantWriterCoordinationFailurePoint }) {
    return this.applyAction(input);
  }

  transitionWriterLifecycle(input: { action: Extract<WriterCoordinationAction, { type: 'ACKNOWLEDGE_DRAIN' }>;
    cas: DormantWriterCoordinationCas; failurePointForTest?: DormantWriterCoordinationFailurePoint }) {
    return this.applyAction(input);
  }

  recordDrainAcknowledgement(input: { action: Extract<WriterCoordinationAction, { type: 'ACKNOWLEDGE_DRAIN' }>;
    cas: DormantWriterCoordinationCas; failurePointForTest?: DormantWriterCoordinationFailurePoint }) {
    return this.transitionWriterLifecycle(input);
  }

  admitOperation(input: { action: Extract<WriterCoordinationAction, { type: 'ADMIT_OPERATION' }>;
    cas: DormantWriterCoordinationCas; failurePointForTest?: DormantWriterCoordinationFailurePoint }) {
    return this.applyAction(input);
  }

  transitionOperation(input: { action: Extract<WriterCoordinationAction, { type: 'TERMINALIZE_OPERATION' }>;
    cas: DormantWriterCoordinationCas & { expectedOperationState: OperationState };
    failurePointForTest?: DormantWriterCoordinationFailurePoint }) {
    return this.applyAction(input);
  }

  transitionEpoch(input: { action: Extract<WriterCoordinationAction, { type: 'MARK_QUIESCENT' }>;
    cas: DormantWriterCoordinationCas; failurePointForTest?: DormantWriterCoordinationFailurePoint }) {
    return this.applyAction(input);
  }

  captureCheckpoint(input: {
    action: Extract<WriterCoordinationAction, {
      type: 'CAPTURE_BEFORE_DRAIN' | 'CAPTURE_AFTER_ADMISSION_CLOSED'
        | 'CAPTURE_AFTER_OPERATIONS_TERMINAL' | 'CAPTURE_BEFORE_SOURCE_VERIFICATION';
    }>;
    cas: DormantWriterCoordinationCas & { previousCheckpointDigest: string | null };
    failurePointForTest?: DormantWriterCoordinationFailurePoint;
  }) { return this.applyAction(input); }

  storeSourceEvidence(input: {
    action: Extract<WriterCoordinationAction, { type: 'CAPTURE_SOURCE_EVIDENCE' }>;
    cas: DormantWriterCoordinationCas & {
      previousCheckpointDigest: string | null;
      expectedSourceRevision: string;
    };
    failurePointForTest?: DormantWriterCoordinationFailurePoint;
  }) { return this.applyAction(input); }

  storeEligibilityEvidenceAtomically(input: {
    actor: Extract<WriterCoordinationActor, { kind: 'verifier' }>;
    cas: DormantWriterCoordinationCas & {
      previousCheckpointDigest: string | null;
      expectedSourceRevision: string;
    };
    failurePointForTest?: DormantWriterCoordinationFailurePoint;
  }): Promise<WriterCoordinationModelState> {
    let actor: Extract<WriterCoordinationActor, { kind: 'verifier' }>;
    try { actor = structuredClone(input.actor); }
    catch { return Promise.reject(new DormantWriterCoordinationError('WRITER_COORDINATION_MODEL_REJECTED', 'store_eligibility')); }
    return this.mutate('store_eligibility', input.cas, state => {
      const checkpointAction: WriterCoordinationAction = {
        type: 'CAPTURE_BEFORE_ELIGIBILITY_COMMIT', actor,
        expectedTransitionRevision: state.authority.transitionRevision,
        expectedCoordinationEpoch: state.authority.coordinationEpoch,
        expectedAuthorityDigest: deriveCoordinationAuthorityDigest(state.authority),
      };
      const checkpoint = reduceWriterCoordination(state, checkpointAction);
      if (!checkpoint.ok) throw reductionError(checkpoint.code, 'store_eligibility_checkpoint');
      const finalCheckpoint = checkpoint.state.checkpointChain[5];
      const commitAction: WriterCoordinationAction = {
        type: 'COMMIT_ELIGIBILITY', actor,
        expectedTransitionRevision: checkpoint.state.authority.transitionRevision,
        expectedCoordinationEpoch: checkpoint.state.authority.coordinationEpoch,
        expectedAuthorityDigest: deriveCoordinationAuthorityDigest(checkpoint.state.authority),
        expectedFinalCheckpointDigest: finalCheckpoint.checkpointDigest,
      };
      const committed = reduceWriterCoordination(checkpoint.state, commitAction);
      if (!committed.ok) throw reductionError(committed.code, 'store_eligibility_commit');
      return committed.state;
    }, input.failurePointForTest);
  }

  replaceValidatedSnapshotForTest(input: {
    state: WriterCoordinationModelState;
    cas: DormantWriterCoordinationCas;
    failurePointForTest?: DormantWriterCoordinationFailurePoint;
  }): Promise<WriterCoordinationModelState> {
    if (this.capabilityPurpose !== 'test') {
      return Promise.reject(new DormantWriterCoordinationError(
        'DORMANT_WRITER_COORDINATION_CAPABILITY_REQUIRED', 'replace_snapshot_for_test',
      ));
    }
    let replacement: WriterCoordinationModelState;
    try { replacement = detachedModel(input.state); assertPersistableState(replacement, 'replace_snapshot_for_test'); }
    catch (error) { return Promise.reject(mapUnexpected(error, 'replace_snapshot_for_test')); }
    return this.mutate('replace_snapshot_for_test', input.cas, () => replacement, input.failurePointForTest);
  }
}

function validateDormantStore(db: IDBDatabase): void {
  if (!db.objectStoreNames.contains(DORMANT_WRITER_COORDINATION_STORE)) {
    throw new DormantWriterCoordinationError('DORMANT_WRITER_COORDINATION_SCHEMA_UNSUPPORTED', 'validate_store');
  }
  const transaction = db.transaction(DORMANT_WRITER_COORDINATION_STORE, 'readonly');
  const store = transaction.objectStore(DORMANT_WRITER_COORDINATION_STORE);
  if (store.keyPath !== null || store.autoIncrement || store.indexNames.length !== 0) {
    throw new DormantWriterCoordinationError('DORMANT_WRITER_COORDINATION_SCHEMA_UNSUPPORTED', 'validate_store');
  }
}

export async function openDormantWriterCoordinationDatabase(
  namespace: LocalDatabaseNamespace,
  options: { capability: DormantWriterCoordinationCapability; indexedDBFactory?: IDBFactory },
): Promise<DormantWriterCoordinationRepository> {
  if (options?.capability?.marker !== capabilityMarker) {
    throw new DormantWriterCoordinationError(
      'DORMANT_WRITER_COORDINATION_CAPABILITY_REQUIRED', 'open_database',
    );
  }
  try { validateNamespace(namespace); }
  catch { throw new DormantWriterCoordinationError('CORRUPT_PERSISTED_RECORD', 'open_namespace'); }
  const factory = options.indexedDBFactory ?? globalThis.indexedDB;
  if (!factory) {
    throw new DormantWriterCoordinationError('DORMANT_WRITER_COORDINATION_OPEN_FAILED', 'indexeddb_unavailable');
  }
  const fingerprint = await namespaceFingerprint(namespace);
  return new Promise((resolve, reject) => {
    let settled = false;
    let request: IDBOpenDBRequest;
    try { request = factory.open(LOCAL_DATABASE_NAME, LOCAL_DATABASE_VERSION); }
    catch {
      reject(new DormantWriterCoordinationError('DORMANT_WRITER_COORDINATION_OPEN_FAILED', 'open_database'));
      return;
    }
    request.onupgradeneeded = event => {
      try { createLocalDatabaseSchema(request.result, event.oldVersion, request.transaction!); }
      catch { request.transaction?.abort(); }
    };
    request.onblocked = () => {
      if (!settled) {
        settled = true;
        reject(new DormantWriterCoordinationError('DORMANT_WRITER_COORDINATION_OPEN_BLOCKED', 'open_database'));
      }
    };
    request.onerror = () => {
      if (!settled) {
        settled = true;
        reject(new DormantWriterCoordinationError(
          request.error?.name === 'VersionError'
            ? 'DORMANT_WRITER_COORDINATION_SCHEMA_UNSUPPORTED'
            : 'DORMANT_WRITER_COORDINATION_OPEN_FAILED',
          'open_database',
        ));
      }
    };
    request.onsuccess = () => {
      const db = request.result;
      if (settled) { db.close(); return; }
      try {
        assertLocalDatabaseVersion(db);
        validateDormantStore(db);
        const connection: ConnectionState = { closed: false, stale: false };
        db.onversionchange = () => { connection.stale = true; db.close(); };
        settled = true;
        resolve(new DormantWriterCoordinationRepository(
          db, namespace, fingerprint, connection, options.capability.purpose,
        ));
      } catch (error) {
        settled = true;
        db.close();
        reject(mapUnexpected(error, 'open_database'));
      }
    };
  });
}

export type { SourceVerificationObservation };
