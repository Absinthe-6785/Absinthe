import { sha256Hex } from '../outboxIdentity';
import { decodeCanonicalProtocolValue, encodeCanonicalProtocolValue } from './canonicalProtocolValue';
import { digestCanonicalProtocolRecord, type ProtocolPreimageDomain } from './canonicalProtocolPreimage';
import { protocolFail, protocolOk, type ProtocolResult } from './protocolResult';
import {
  decodeCanonicalRevision,
  decodeDigest,
  decodeEnum,
  decodeExactObject,
  decodeIdentifier,
  decodeLiteral,
  type StrictDecoder,
  type StrictObject,
} from './strictProtocolDecode';
import {
  decodeSourceAuthorityRecord,
  decodeSourceTransactionReferenceRecord,
  decodeWriterIdentityRecord,
  decodeWriterSessionRecord,
  validateRepresentativeAuthorityGraph,
  type SourceAuthorityRecord,
  type SourceTransactionReferenceRecord,
  type WriterIdentityRecord,
  type WriterSessionRecord,
} from './writerAuthorityProtocol';

export const TRANSACTION_EVIDENCE_VERSION = 1 as const;

export const TRANSACTION_EVIDENCE_RECORD_KINDS = Object.freeze([
  'absinthe_k330_operation',
  'absinthe_k330_admission',
  'absinthe_immutable_outbox_intent',
  'absinthe_terminal_state',
] as const);

export type TransactionEvidenceRecordKind = typeof TRANSACTION_EVIDENCE_RECORD_KINDS[number];
export type TransactionMutationKind = 'note_upsert' | 'note_tombstone';

export interface OperationRecord {
  readonly kind: 'absinthe_k330_operation';
  readonly version: 1;
  readonly id: string;
  readonly namespace: string;
  readonly generation: string;
  readonly admissionId: string;
  readonly admissionDigest: string;
  readonly writerId: string;
  readonly writerDigest: string;
  readonly sessionId: string;
  readonly sessionDigest: string;
  readonly mutationKind: TransactionMutationKind;
  readonly committedRevision: string;
  readonly affectedIdentityDigest: string;
  readonly canonicalInputDigest: string;
  readonly resultDigest: string;
  readonly outboxId: string;
  readonly outboxIntentDigest: string;
  readonly exactOperationDigest: string;
  readonly operationDigest: string;
}

export interface AdmissionRecord {
  readonly kind: 'absinthe_k330_admission';
  readonly version: 1;
  readonly id: string;
  readonly operationId: string;
  readonly writerId: string;
  readonly sessionId: string;
  readonly exactOperationDigest: string;
  readonly decision: 'admitted';
  readonly admissionDigest: string;
}

export interface ImmutableOutboxIntentRecord {
  readonly kind: 'absinthe_immutable_outbox_intent';
  readonly version: 1;
  readonly id: string;
  readonly operationId: string;
  readonly intentDigest: string;
  readonly exactOperationDigest: string;
  readonly outboxDigest: string;
}

export interface TerminalStateRecord {
  readonly kind: 'absinthe_terminal_state';
  readonly version: 1;
  readonly id: string;
  readonly operationId: string;
  readonly state: 'committed';
  readonly resultDigest: string;
  readonly exactOperationDigest: string;
  readonly terminalDigest: string;
}

export type TransactionEvidenceRecord =
  | OperationRecord
  | AdmissionRecord
  | ImmutableOutboxIntentRecord
  | TerminalStateRecord;

export type OperationInput = Omit<OperationRecord, 'kind' | 'version' | 'operationDigest'>;
export type AdmissionInput = Omit<AdmissionRecord, 'kind' | 'version' | 'admissionDigest'>;
export type ImmutableOutboxIntentInput = Omit<ImmutableOutboxIntentRecord, 'kind' | 'version' | 'outboxDigest'>;
export type TerminalStateInput = Omit<TerminalStateRecord, 'kind' | 'version' | 'terminalDigest'>;

const operationFields = Object.freeze([
  'kind', 'version', 'id', 'namespace', 'generation', 'admissionId', 'admissionDigest', 'writerId', 'writerDigest',
  'sessionId', 'sessionDigest', 'mutationKind', 'committedRevision', 'affectedIdentityDigest', 'canonicalInputDigest',
  'resultDigest', 'outboxId', 'outboxIntentDigest', 'exactOperationDigest', 'operationDigest',
]);
const admissionFields = Object.freeze([
  'kind', 'version', 'id', 'operationId', 'writerId', 'sessionId', 'exactOperationDigest', 'decision', 'admissionDigest',
]);
const outboxFields = Object.freeze([
  'kind', 'version', 'id', 'operationId', 'intentDigest', 'exactOperationDigest', 'outboxDigest',
]);
const terminalFields = Object.freeze([
  'kind', 'version', 'id', 'operationId', 'state', 'resultDigest', 'exactOperationDigest', 'terminalDigest',
]);
const envelopeOptionalFields = Object.freeze([...new Set([
  ...operationFields, ...admissionFields, ...outboxFields, ...terminalFields,
].filter(field => field !== 'kind' && field !== 'version'))]);

interface FieldSpec {
  readonly field: string;
  readonly decoder: StrictDecoder<unknown>;
}

const identifier = (value: unknown, field: string) => decodeIdentifier(value, field);
const digest = (value: unknown, field: string) => decodeDigest(value, field);
const revision = (value: unknown, field: string) => decodeCanonicalRevision(value, field);

function decodeFields(object: StrictObject, specs: readonly FieldSpec[]): ProtocolResult<StrictObject> {
  for (const { field, decoder } of specs) {
    const result = decoder(object[field], field);
    if (!result.ok) return result;
  }
  return protocolOk(object);
}

function prepareCreatePayload(
  value: unknown,
  fields: readonly string[],
  specs: readonly FieldSpec[],
  kind: TransactionEvidenceRecordKind,
  operation: string,
): ProtocolResult<StrictObject> {
  const object = decodeExactObject(value, fields, [], operation);
  if (!object.ok) return object;
  const decoded = decodeFields(object.value, specs);
  if (!decoded.ok) return decoded;
  const payload: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
  payload.kind = kind;
  payload.version = TRANSACTION_EVIDENCE_VERSION;
  for (const field of fields) payload[field] = object.value[field];
  return protocolOk(Object.freeze(payload));
}

function digestPayload(domain: ProtocolPreimageDomain, payload: StrictObject): ProtocolResult<string> {
  return digestCanonicalProtocolRecord(domain, TRANSACTION_EVIDENCE_VERSION, payload);
}

function verifyDigest(
  domain: ProtocolPreimageDomain,
  payload: StrictObject,
  actual: string,
  field: string,
): ProtocolResult<void> {
  const expected = digestPayload(domain, payload);
  if (!expected.ok) return expected;
  return expected.value === actual
    ? protocolOk(undefined)
    : protocolFail('CANONICAL_DIGEST_MISMATCH', 'decode_record', field);
}

const operationInputFields = Object.freeze([
  'id', 'namespace', 'generation', 'admissionId', 'admissionDigest', 'writerId', 'writerDigest', 'sessionId',
  'sessionDigest', 'mutationKind', 'committedRevision', 'affectedIdentityDigest', 'canonicalInputDigest', 'resultDigest',
  'outboxId', 'outboxIntentDigest', 'exactOperationDigest',
]);
const exactOperationInputFields = Object.freeze([
  'id', 'namespace', 'generation', 'admissionId', 'writerId', 'writerDigest', 'sessionId', 'sessionDigest',
  'mutationKind', 'committedRevision', 'affectedIdentityDigest', 'canonicalInputDigest', 'resultDigest', 'outboxId',
  'outboxIntentDigest',
]);
const admissionInputFields = Object.freeze([
  'id', 'operationId', 'writerId', 'sessionId', 'exactOperationDigest', 'decision',
]);
const outboxInputFields = Object.freeze(['id', 'operationId', 'intentDigest', 'exactOperationDigest']);
const terminalInputFields = Object.freeze(['id', 'operationId', 'state', 'resultDigest', 'exactOperationDigest']);

export function deriveExactOperationDigest(input: unknown): ProtocolResult<string> {
  const payload = prepareCreatePayload(input, exactOperationInputFields, [
    ...['id', 'namespace', 'generation', 'admissionId', 'writerId', 'sessionId', 'outboxId']
      .map(field => ({ field, decoder: identifier })),
    ...['writerDigest', 'sessionDigest', 'affectedIdentityDigest', 'canonicalInputDigest', 'resultDigest',
      'outboxIntentDigest'].map(field => ({ field, decoder: digest })),
    { field: 'mutationKind', decoder: (entry, field) => decodeEnum(entry, ['note_upsert', 'note_tombstone'], field) },
    { field: 'committedRevision', decoder: revision },
  ], 'absinthe_k330_operation', 'derive_exact_operation');
  return payload.ok ? digestPayload('absinthe.exact_operation.v1', payload.value) : payload;
}

function exactOperationInput(value: StrictObject): StrictObject {
  const input: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
  for (const field of exactOperationInputFields) input[field] = value[field];
  return Object.freeze(input);
}

export function createOperationRecord(input: unknown): ProtocolResult<OperationRecord> {
  const payload = prepareCreatePayload(input, operationInputFields, [
    ...['id', 'namespace', 'generation', 'admissionId', 'writerId', 'sessionId', 'outboxId']
      .map(field => ({ field, decoder: identifier })),
    ...['admissionDigest', 'writerDigest', 'sessionDigest', 'affectedIdentityDigest', 'canonicalInputDigest',
      'resultDigest', 'outboxIntentDigest', 'exactOperationDigest'].map(field => ({ field, decoder: digest })),
    { field: 'mutationKind', decoder: (entry, field) => decodeEnum(entry, ['note_upsert', 'note_tombstone'], field) },
    { field: 'committedRevision', decoder: revision },
  ], 'absinthe_k330_operation', 'create_operation');
  if (!payload.ok) return payload;
  const exactOperationDigest = deriveExactOperationDigest(exactOperationInput(payload.value));
  if (!exactOperationDigest.ok) return exactOperationDigest;
  if (exactOperationDigest.value !== payload.value.exactOperationDigest) {
    return protocolFail('RELATIONSHIP_MISMATCH', 'create_operation', 'exactOperationDigest');
  }
  const operationDigest = digestPayload('absinthe.operation.v1', payload.value);
  if (!operationDigest.ok) return operationDigest;
  return decodeOperationRecord(Object.freeze({ ...payload.value, operationDigest: operationDigest.value }));
}

export function createAdmissionRecord(input: unknown): ProtocolResult<AdmissionRecord> {
  const payload = prepareCreatePayload(input, admissionInputFields, [
    ...['id', 'operationId', 'writerId', 'sessionId'].map(field => ({ field, decoder: identifier })),
    { field: 'exactOperationDigest', decoder: digest },
    { field: 'decision', decoder: (entry, field) => decodeEnum(entry, ['admitted'], field) },
  ], 'absinthe_k330_admission', 'create_admission');
  if (!payload.ok) return payload;
  const admissionDigest = digestPayload('absinthe.admission.v1', payload.value);
  if (!admissionDigest.ok) return admissionDigest;
  return decodeAdmissionRecord(Object.freeze({ ...payload.value, admissionDigest: admissionDigest.value }));
}

export function createImmutableOutboxIntentRecord(input: unknown): ProtocolResult<ImmutableOutboxIntentRecord> {
  const payload = prepareCreatePayload(input, outboxInputFields, [
    ...['id', 'operationId'].map(field => ({ field, decoder: identifier })),
    ...['intentDigest', 'exactOperationDigest'].map(field => ({ field, decoder: digest })),
  ], 'absinthe_immutable_outbox_intent', 'create_outbox_intent');
  if (!payload.ok) return payload;
  const outboxDigest = digestPayload('absinthe.immutable_outbox_intent.v1', payload.value);
  if (!outboxDigest.ok) return outboxDigest;
  return decodeImmutableOutboxIntentRecord(Object.freeze({ ...payload.value, outboxDigest: outboxDigest.value }));
}

export function createTerminalStateRecord(input: unknown): ProtocolResult<TerminalStateRecord> {
  const payload = prepareCreatePayload(input, terminalInputFields, [
    ...['id', 'operationId'].map(field => ({ field, decoder: identifier })),
    { field: 'state', decoder: (entry, field) => decodeEnum(entry, ['committed'], field) },
    ...['resultDigest', 'exactOperationDigest'].map(field => ({ field, decoder: digest })),
  ], 'absinthe_terminal_state', 'create_terminal_state');
  if (!payload.ok) return payload;
  const terminalDigest = digestPayload('absinthe.terminal_state.v1', payload.value);
  if (!terminalDigest.ok) return terminalDigest;
  return decodeTerminalStateRecord(Object.freeze({ ...payload.value, terminalDigest: terminalDigest.value }));
}

export function decodeOperationRecord(value: unknown): ProtocolResult<OperationRecord> {
  const object = decodeExactObject(value, operationFields);
  if (!object.ok) return object;
  const fields = decodeFields(object.value, [
    { field: 'kind', decoder: (entry, field) => decodeLiteral(entry, 'absinthe_k330_operation', field) },
    { field: 'version', decoder: (entry, field) => decodeLiteral(entry, 1, field, 'version') },
    ...['id', 'namespace', 'generation', 'admissionId', 'writerId', 'sessionId', 'outboxId']
      .map(field => ({ field, decoder: identifier })),
    ...['admissionDigest', 'writerDigest', 'sessionDigest', 'affectedIdentityDigest', 'canonicalInputDigest',
      'resultDigest', 'outboxIntentDigest', 'exactOperationDigest', 'operationDigest'].map(field => ({ field, decoder: digest })),
    { field: 'mutationKind', decoder: (entry, field) => decodeEnum(entry, ['note_upsert', 'note_tombstone'], field) },
    { field: 'committedRevision', decoder: revision },
  ]);
  if (!fields.ok) return fields;
  const record = Object.freeze({ ...object.value }) as unknown as OperationRecord;
  const { operationDigest, ...payload } = record;
  const verified = verifyDigest('absinthe.operation.v1', payload, operationDigest, 'operationDigest');
  if (!verified.ok) return verified;
  const exact = deriveExactOperationDigest(exactOperationInput(record as unknown as StrictObject));
  if (!exact.ok) return exact;
  return exact.value === record.exactOperationDigest
    ? protocolOk(record)
    : protocolFail('RELATIONSHIP_MISMATCH', 'decode_record', 'exactOperationDigest');
}

export function decodeAdmissionRecord(value: unknown): ProtocolResult<AdmissionRecord> {
  const object = decodeExactObject(value, admissionFields);
  if (!object.ok) return object;
  const fields = decodeFields(object.value, [
    { field: 'kind', decoder: (entry, field) => decodeLiteral(entry, 'absinthe_k330_admission', field) },
    { field: 'version', decoder: (entry, field) => decodeLiteral(entry, 1, field, 'version') },
    ...['id', 'operationId', 'writerId', 'sessionId'].map(field => ({ field, decoder: identifier })),
    { field: 'exactOperationDigest', decoder: digest },
    { field: 'decision', decoder: (entry, field) => decodeEnum(entry, ['admitted'], field) },
    { field: 'admissionDigest', decoder: digest },
  ]);
  if (!fields.ok) return fields;
  const record = Object.freeze({ ...object.value }) as unknown as AdmissionRecord;
  const { admissionDigest, ...payload } = record;
  const verified = verifyDigest('absinthe.admission.v1', payload, admissionDigest, 'admissionDigest');
  return verified.ok ? protocolOk(record) : verified;
}

export function decodeImmutableOutboxIntentRecord(value: unknown): ProtocolResult<ImmutableOutboxIntentRecord> {
  const object = decodeExactObject(value, outboxFields);
  if (!object.ok) return object;
  const fields = decodeFields(object.value, [
    { field: 'kind', decoder: (entry, field) => decodeLiteral(entry, 'absinthe_immutable_outbox_intent', field) },
    { field: 'version', decoder: (entry, field) => decodeLiteral(entry, 1, field, 'version') },
    ...['id', 'operationId'].map(field => ({ field, decoder: identifier })),
    ...['intentDigest', 'exactOperationDigest'].map(field => ({ field, decoder: digest })),
    { field: 'outboxDigest', decoder: digest },
  ]);
  if (!fields.ok) return fields;
  const record = Object.freeze({ ...object.value }) as unknown as ImmutableOutboxIntentRecord;
  const { outboxDigest, ...payload } = record;
  const verified = verifyDigest('absinthe.immutable_outbox_intent.v1', payload, outboxDigest, 'outboxDigest');
  return verified.ok ? protocolOk(record) : verified;
}

export function decodeTerminalStateRecord(value: unknown): ProtocolResult<TerminalStateRecord> {
  const object = decodeExactObject(value, terminalFields);
  if (!object.ok) return object;
  const fields = decodeFields(object.value, [
    { field: 'kind', decoder: (entry, field) => decodeLiteral(entry, 'absinthe_terminal_state', field) },
    { field: 'version', decoder: (entry, field) => decodeLiteral(entry, 1, field, 'version') },
    ...['id', 'operationId'].map(field => ({ field, decoder: identifier })),
    { field: 'state', decoder: (entry, field) => decodeEnum(entry, ['committed'], field) },
    ...['resultDigest', 'exactOperationDigest'].map(field => ({ field, decoder: digest })),
    { field: 'terminalDigest', decoder: digest },
  ]);
  if (!fields.ok) return fields;
  const record = Object.freeze({ ...object.value }) as unknown as TerminalStateRecord;
  const { terminalDigest, ...payload } = record;
  const verified = verifyDigest('absinthe.terminal_state.v1', payload, terminalDigest, 'terminalDigest');
  return verified.ok ? protocolOk(record) : verified;
}

export function decodeTransactionEvidenceRecord(value: unknown): ProtocolResult<TransactionEvidenceRecord> {
  const envelope = decodeExactObject(value, ['kind', 'version'], envelopeOptionalFields);
  if (!envelope.ok) return envelope;
  if (envelope.value.version !== TRANSACTION_EVIDENCE_VERSION) {
    return protocolFail('UNSUPPORTED_RECORD_VERSION', 'decode_envelope', 'version');
  }
  switch (envelope.value.kind) {
    case 'absinthe_k330_operation': return decodeOperationRecord(envelope.value);
    case 'absinthe_k330_admission': return decodeAdmissionRecord(envelope.value);
    case 'absinthe_immutable_outbox_intent': return decodeImmutableOutboxIntentRecord(envelope.value);
    case 'absinthe_terminal_state': return decodeTerminalStateRecord(envelope.value);
    default: return protocolFail('RECORD_KIND_MISMATCH', 'decode_envelope', 'kind');
  }
}

export function encodeTransactionEvidenceRecord(record: unknown): ProtocolResult<Uint8Array> {
  const decoded = decodeTransactionEvidenceRecord(record);
  return decoded.ok ? encodeCanonicalProtocolValue(decoded.value) : decoded;
}

export function decodeTransactionEvidenceRecordBytes(bytes: unknown): ProtocolResult<TransactionEvidenceRecord> {
  const decoded = decodeCanonicalProtocolValue(bytes);
  return decoded.ok ? decodeTransactionEvidenceRecord(decoded.value) : decoded;
}

type TransactionGraphRecordKey = 'writer' | 'session' | 'operation' | 'admission' | 'outbox' | 'terminal' | 'reference';

export const TRANSACTION_EVIDENCE_GRAPH_COMPATIBILITY_EDGES = Object.freeze([
  Object.freeze({ predecessor: 'writer', successor: 'operation',
    tuple: Object.freeze(['absinthe_writer_identity', 1, 'absinthe_k330_operation', 1] as const) }),
  Object.freeze({ predecessor: 'session', successor: 'operation',
    tuple: Object.freeze(['absinthe_writer_session', 1, 'absinthe_k330_operation', 1] as const) }),
  Object.freeze({ predecessor: 'operation', successor: 'admission',
    tuple: Object.freeze(['absinthe_k330_operation', 1, 'absinthe_k330_admission', 1] as const) }),
  Object.freeze({ predecessor: 'operation', successor: 'outbox',
    tuple: Object.freeze(['absinthe_k330_operation', 1, 'absinthe_immutable_outbox_intent', 1] as const) }),
  Object.freeze({ predecessor: 'operation', successor: 'terminal',
    tuple: Object.freeze(['absinthe_k330_operation', 1, 'absinthe_terminal_state', 1] as const) }),
  Object.freeze({ predecessor: 'operation', successor: 'reference',
    tuple: Object.freeze(['absinthe_k330_operation', 1, 'absinthe_source_transaction_reference', 1] as const) }),
  Object.freeze({ predecessor: 'admission', successor: 'reference',
    tuple: Object.freeze(['absinthe_k330_admission', 1, 'absinthe_source_transaction_reference', 1] as const) }),
  Object.freeze({ predecessor: 'outbox', successor: 'reference',
    tuple: Object.freeze(['absinthe_immutable_outbox_intent', 1, 'absinthe_source_transaction_reference', 1] as const) }),
  Object.freeze({ predecessor: 'terminal', successor: 'reference',
    tuple: Object.freeze(['absinthe_terminal_state', 1, 'absinthe_source_transaction_reference', 1] as const) }),
] as const satisfies readonly Readonly<{
  predecessor: TransactionGraphRecordKey;
  successor: TransactionGraphRecordKey;
  tuple: readonly [string, 1, string, 1];
}>[]);

export const TRANSACTION_EVIDENCE_COMPATIBILITY = Object.freeze(
  TRANSACTION_EVIDENCE_GRAPH_COMPATIBILITY_EDGES.map(edge => edge.tuple),
);

export function validateTransactionEvidenceCompatibility(input: unknown): ProtocolResult<void> {
  const object = decodeExactObject(input, ['predecessorKind', 'predecessorVersion', 'successorKind', 'successorVersion'], [],
    'validate_compatibility');
  if (!object.ok) return object;
  const predecessorKind = decodeIdentifier(object.value.predecessorKind, 'predecessorKind');
  if (!predecessorKind.ok) return predecessorKind;
  const successorKind = decodeIdentifier(object.value.successorKind, 'successorKind');
  if (!successorKind.ok) return successorKind;
  const predecessorVersion = decodeLiteral(object.value.predecessorVersion, 1, 'predecessorVersion', 'version');
  if (!predecessorVersion.ok) return predecessorVersion;
  const successorVersion = decodeLiteral(object.value.successorVersion, 1, 'successorVersion', 'version');
  if (!successorVersion.ok) return successorVersion;
  const supported = TRANSACTION_EVIDENCE_COMPATIBILITY.some(tuple => tuple[0] === predecessorKind.value
    && tuple[1] === predecessorVersion.value && tuple[2] === successorKind.value && tuple[3] === successorVersion.value);
  return supported ? protocolOk(undefined) : protocolFail('RELATIONSHIP_MISMATCH', 'validate_compatibility');
}

type AuthorityRootDomain =
  | 'ABSINTHE_OPERATION_REGISTRY_ROOT_V1'
  | 'ABSINTHE_TERMINAL_ROOT_V1'
  | 'ABSINTHE_OUTBOX_ROOT_V1';

function deriveOneRecordAuthorityRoot(domain: AuthorityRootDomain, recordDigest: unknown): ProtocolResult<string> {
  const decoded = decodeDigest(recordDigest, 'recordDigest');
  return decoded.ok
    ? protocolOk(sha256Hex(JSON.stringify([domain, 1, [decoded.value]])))
    : decoded;
}

export const deriveOperationRegistryRoot = (recordDigest: unknown): ProtocolResult<string> =>
  deriveOneRecordAuthorityRoot('ABSINTHE_OPERATION_REGISTRY_ROOT_V1', recordDigest);

export const deriveTerminalRoot = (recordDigest: unknown): ProtocolResult<string> =>
  deriveOneRecordAuthorityRoot('ABSINTHE_TERMINAL_ROOT_V1', recordDigest);

export const deriveOutboxRoot = (recordDigest: unknown): ProtocolResult<string> =>
  deriveOneRecordAuthorityRoot('ABSINTHE_OUTBOX_ROOT_V1', recordDigest);

export interface ProductionTransactionEvidenceGraph {
  readonly writer: WriterIdentityRecord;
  readonly session: WriterSessionRecord;
  readonly authority: SourceAuthorityRecord;
  readonly reference: SourceTransactionReferenceRecord;
  readonly operation: OperationRecord;
  readonly admission: AdmissionRecord;
  readonly outbox: ImmutableOutboxIntentRecord;
  readonly terminal: TerminalStateRecord;
}

export function validateProductionTransactionEvidenceGraph(input: unknown): ProtocolResult<void> {
  const graph = decodeExactObject(input,
    ['writer', 'session', 'authority', 'reference', 'operation', 'admission', 'outbox', 'terminal'], [],
    'validate_transaction_graph');
  if (!graph.ok) return graph;
  const writer = decodeWriterIdentityRecord(graph.value.writer);
  if (!writer.ok) return writer;
  const session = decodeWriterSessionRecord(graph.value.session);
  if (!session.ok) return session;
  const authority = decodeSourceAuthorityRecord(graph.value.authority);
  if (!authority.ok) return authority;
  const reference = decodeSourceTransactionReferenceRecord(graph.value.reference);
  if (!reference.ok) return reference;
  const operation = decodeOperationRecord(graph.value.operation);
  if (!operation.ok) return operation;
  const admission = decodeAdmissionRecord(graph.value.admission);
  if (!admission.ok) return admission;
  const outbox = decodeImmutableOutboxIntentRecord(graph.value.outbox);
  if (!outbox.ok) return outbox;
  const terminal = decodeTerminalStateRecord(graph.value.terminal);
  if (!terminal.ok) return terminal;
  const compatibleRecords = Object.freeze({
    writer: writer.value,
    session: session.value,
    operation: operation.value,
    admission: admission.value,
    outbox: outbox.value,
    terminal: terminal.value,
    reference: reference.value,
  });
  for (const edge of TRANSACTION_EVIDENCE_GRAPH_COMPATIBILITY_EDGES) {
    const predecessor = compatibleRecords[edge.predecessor];
    const successor = compatibleRecords[edge.successor];
    const compatible = validateTransactionEvidenceCompatibility({
      predecessorKind: predecessor.kind,
      predecessorVersion: predecessor.version,
      successorKind: successor.kind,
      successorVersion: successor.version,
    });
    if (!compatible.ok) return compatible;
  }
  const representative = validateRepresentativeAuthorityGraph({
    writer: writer.value, session: session.value, authority: authority.value, reference: reference.value,
  });
  if (!representative.ok) return representative;
  const op = operation.value;
  const adm = admission.value;
  const intent = outbox.value;
  const term = terminal.value;
  const ref = reference.value;
  const operationRoot = deriveOperationRegistryRoot(op.operationDigest);
  if (!operationRoot.ok) return operationRoot;
  const terminalRoot = deriveTerminalRoot(term.terminalDigest);
  if (!terminalRoot.ok) return terminalRoot;
  const outboxRoot = deriveOutboxRoot(intent.outboxDigest);
  if (!outboxRoot.ok) return outboxRoot;
  const relationsMatch = op.namespace === writer.value.namespaceId
    && op.generation === session.value.generationId
    && op.generation === authority.value.generationId
    && op.writerId === writer.value.id
    && op.writerDigest === writer.value.writerDigest
    && op.sessionId === session.value.id
    && op.sessionDigest === session.value.sessionDigest
    && adm.id === op.admissionId
    && adm.admissionDigest === op.admissionDigest
    && adm.operationId === op.id
    && adm.writerId === op.writerId
    && adm.sessionId === op.sessionId
    && adm.exactOperationDigest === op.exactOperationDigest
    && intent.id === op.outboxId
    && intent.operationId === op.id
    && intent.intentDigest === op.outboxIntentDigest
    && intent.exactOperationDigest === op.exactOperationDigest
    && term.operationId === op.id
    && term.resultDigest === op.resultDigest
    && term.exactOperationDigest === op.exactOperationDigest
    && authority.value.operationRegistryRoot === operationRoot.value
    && authority.value.terminalRoot === terminalRoot.value
    && authority.value.outboxRoot === outboxRoot.value
    && ref.operationId === op.id
    && ref.operationDigest === op.operationDigest
    && ref.admissionId === adm.id
    && ref.admissionDigest === adm.admissionDigest
    && ref.outboxId === intent.id
    && ref.outboxDigest === intent.outboxDigest
    && ref.terminalId === term.id
    && ref.terminalDigest === term.terminalDigest
    && ref.committedSourceRevision === op.committedRevision;
  return relationsMatch
    ? protocolOk(undefined)
    : protocolFail('RELATIONSHIP_MISMATCH', 'validate_transaction_graph');
}
