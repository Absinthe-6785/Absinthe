import { decodeCanonicalProtocolValue, encodeCanonicalProtocolValue } from './canonicalProtocolValue';
import { digestCanonicalProtocolRecord, type ProtocolPreimageDomain } from './canonicalProtocolPreimage';
import {
  decodeCanonicalRevision,
  decodeDigest,
  decodeExactObject,
  decodeIdentifier,
  decodeLiteral,
  decodePositiveSafeInteger,
  type StrictDecoder,
  type StrictObject,
} from './strictProtocolDecode';
import { protocolFail, protocolOk, type ProtocolResult } from './protocolResult';

export const REPRESENTATIVE_PROTOCOL_VERSION = 1 as const;

export const REPRESENTATIVE_RECORD_KINDS = Object.freeze([
  'absinthe_writer_identity',
  'absinthe_writer_session',
  'absinthe_source_transaction_reference',
  'absinthe_source_authority',
] as const);

export type RepresentativeRecordKind = typeof REPRESENTATIVE_RECORD_KINDS[number];

export interface WriterIdentityRecord {
  readonly kind: 'absinthe_writer_identity';
  readonly version: 1;
  readonly id: string;
  readonly namespaceId: string;
  readonly physicalSourceDigest: string;
  readonly writerTypeId: string;
  readonly manifestDigest: string;
  readonly writerDigest: string;
}

export interface WriterSessionRecord {
  readonly kind: 'absinthe_writer_session';
  readonly version: 1;
  readonly id: string;
  readonly namespaceId: string;
  readonly generationId: string;
  readonly physicalSourceDigest: string;
  readonly writerId: string;
  readonly writerDigest: string;
  readonly epoch: number;
  readonly capabilityDigest: string;
  readonly sessionDigest: string;
}

export interface SourceAuthorityRecord {
  readonly kind: 'absinthe_source_authority';
  readonly version: 1;
  readonly id: string;
  readonly namespaceId: string;
  readonly generationId: string;
  readonly physicalSourceDigest: string;
  readonly sourceRevision: string;
  readonly operationRegistryRoot: string;
  readonly terminalRoot: string;
  readonly outboxRoot: string;
  readonly mmrStateId: string;
  readonly mmrStateDigest: string;
  readonly lifecycleHeadId: string | null;
  readonly lifecycleHeadDigest: string | null;
  readonly authorityDigest: string;
}

export interface SourceTransactionReferenceRecord {
  readonly kind: 'absinthe_source_transaction_reference';
  readonly version: 1;
  readonly id: string;
  readonly namespaceId: string;
  readonly generationId: string;
  readonly physicalSourceDigest: string;
  readonly committedSourceRevision: string;
  readonly sourceAuthorityId: string;
  readonly sourceAuthorityDigest: string;
  readonly operationId: string;
  readonly operationDigest: string;
  readonly admissionId: string;
  readonly admissionDigest: string;
  readonly writerId: string;
  readonly writerDigest: string;
  readonly sessionId: string;
  readonly sessionDigest: string;
  readonly terminalId: string;
  readonly terminalDigest: string;
  readonly outboxId: string;
  readonly outboxDigest: string;
  readonly mmrStateId: string;
  readonly mmrStateDigest: string;
  readonly checkpointId: string;
  readonly checkpointDigest: string;
  readonly graphVersion: 1;
  readonly referenceDigest: string;
}

export type RepresentativeProtocolRecord =
  | WriterIdentityRecord
  | WriterSessionRecord
  | SourceTransactionReferenceRecord
  | SourceAuthorityRecord;

export type WriterIdentityInput = Omit<WriterIdentityRecord, 'kind' | 'version' | 'writerDigest'>;
export type WriterSessionInput = Omit<WriterSessionRecord, 'kind' | 'version' | 'sessionDigest'>;
export type SourceAuthorityInput = Omit<SourceAuthorityRecord, 'kind' | 'version' | 'authorityDigest'>;
export type SourceTransactionReferenceInput = Omit<SourceTransactionReferenceRecord, 'kind' | 'version' | 'referenceDigest'>;

const writerFields = Object.freeze([
  'kind', 'version', 'id', 'namespaceId', 'physicalSourceDigest', 'writerTypeId', 'manifestDigest', 'writerDigest',
]);
const sessionFields = Object.freeze([
  'kind', 'version', 'id', 'namespaceId', 'generationId', 'physicalSourceDigest', 'writerId', 'writerDigest',
  'epoch', 'capabilityDigest', 'sessionDigest',
]);
const authorityFields = Object.freeze([
  'kind', 'version', 'id', 'namespaceId', 'generationId', 'physicalSourceDigest', 'sourceRevision',
  'operationRegistryRoot', 'terminalRoot', 'outboxRoot', 'mmrStateId', 'mmrStateDigest',
  'lifecycleHeadId', 'lifecycleHeadDigest', 'authorityDigest',
]);
const referenceFields = Object.freeze([
  'kind', 'version', 'id', 'namespaceId', 'generationId', 'physicalSourceDigest', 'committedSourceRevision',
  'sourceAuthorityId', 'sourceAuthorityDigest', 'operationId', 'operationDigest', 'admissionId', 'admissionDigest',
  'writerId', 'writerDigest', 'sessionId', 'sessionDigest', 'terminalId', 'terminalDigest', 'outboxId',
  'outboxDigest', 'mmrStateId', 'mmrStateDigest', 'checkpointId', 'checkpointDigest', 'graphVersion', 'referenceDigest',
]);
const envelopeOptionalFields = Object.freeze([...new Set([
  ...writerFields, ...sessionFields, ...authorityFields, ...referenceFields,
].filter(field => field !== 'kind' && field !== 'version'))]);

interface FieldSpec {
  readonly field: string;
  readonly decoder: StrictDecoder<unknown>;
}

function prepareCreatePayload(
  value: unknown,
  fields: readonly string[],
  specs: readonly FieldSpec[],
  kind: RepresentativeRecordKind,
  operation: string,
): ProtocolResult<StrictObject> {
  const object = decodeExactObject(value, fields, [], operation);
  if (!object.ok) return object;
  const decoded = decodeFields(object.value, specs);
  if (!decoded.ok) return decoded;
  const payload: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
  payload.kind = kind;
  payload.version = REPRESENTATIVE_PROTOCOL_VERSION;
  for (const field of fields) payload[field] = object.value[field];
  return protocolOk(Object.freeze(payload));
}

function decodeFields(object: StrictObject, specs: readonly FieldSpec[]): ProtocolResult<StrictObject> {
  for (const { field, decoder } of specs) {
    const result = decoder(object[field], field);
    if (!result.ok) return result;
  }
  return protocolOk(object);
}

const identifier = (value: unknown, field: string) => decodeIdentifier(value, field);
const digest = (value: unknown, field: string) => decodeDigest(value, field);
const positive = (value: unknown, field: string) => decodePositiveSafeInteger(value, field);
const revision = (value: unknown, field: string) => decodeCanonicalRevision(value, field);

function nullableIdentifier(value: unknown, field: string): ProtocolResult<string | null> {
  return value === null ? protocolOk(null) : decodeIdentifier(value, field);
}

function nullableDigest(value: unknown, field: string): ProtocolResult<string | null> {
  return value === null ? protocolOk(null) : decodeDigest(value, field);
}

function digestPayload(
  domain: ProtocolPreimageDomain,
  payload: StrictObject,
): ProtocolResult<string> {
  return digestCanonicalProtocolRecord(domain, REPRESENTATIVE_PROTOCOL_VERSION, payload);
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

const writerInputFields = Object.freeze(['id', 'namespaceId', 'physicalSourceDigest', 'writerTypeId', 'manifestDigest']);
const sessionInputFields = Object.freeze([
  'id', 'namespaceId', 'generationId', 'physicalSourceDigest', 'writerId', 'writerDigest', 'epoch', 'capabilityDigest',
]);
const authorityInputFields = Object.freeze([
  'id', 'namespaceId', 'generationId', 'physicalSourceDigest', 'sourceRevision', 'operationRegistryRoot',
  'terminalRoot', 'outboxRoot', 'mmrStateId', 'mmrStateDigest', 'lifecycleHeadId', 'lifecycleHeadDigest',
]);
const referenceInputFields = Object.freeze([
  'id', 'namespaceId', 'generationId', 'physicalSourceDigest', 'committedSourceRevision', 'sourceAuthorityId',
  'sourceAuthorityDigest', 'operationId', 'operationDigest', 'admissionId', 'admissionDigest', 'writerId',
  'writerDigest', 'sessionId', 'sessionDigest', 'terminalId', 'terminalDigest', 'outboxId', 'outboxDigest',
  'mmrStateId', 'mmrStateDigest', 'checkpointId', 'checkpointDigest', 'graphVersion',
]);

export function createWriterIdentityRecord(input: unknown): ProtocolResult<WriterIdentityRecord> {
  const payload = prepareCreatePayload(input, writerInputFields, [
    ...['id', 'namespaceId', 'writerTypeId'].map(field => ({ field, decoder: identifier })),
    ...['physicalSourceDigest', 'manifestDigest'].map(field => ({ field, decoder: digest })),
  ], 'absinthe_writer_identity', 'create_writer_identity');
  if (!payload.ok) return payload;
  const writerDigest = digestPayload('absinthe.writer_identity.v1', payload.value);
  if (!writerDigest.ok) return writerDigest;
  return decodeWriterIdentityRecord(Object.freeze({ ...payload.value, writerDigest: writerDigest.value }));
}

export function createWriterSessionRecord(input: unknown): ProtocolResult<WriterSessionRecord> {
  const payload = prepareCreatePayload(input, sessionInputFields, [
    ...['id', 'namespaceId', 'generationId', 'writerId'].map(field => ({ field, decoder: identifier })),
    ...['physicalSourceDigest', 'writerDigest', 'capabilityDigest'].map(field => ({ field, decoder: digest })),
    { field: 'epoch', decoder: positive },
  ], 'absinthe_writer_session', 'create_writer_session');
  if (!payload.ok) return payload;
  const sessionDigest = digestPayload('absinthe.writer_session.v1', payload.value);
  if (!sessionDigest.ok) return sessionDigest;
  return decodeWriterSessionRecord(Object.freeze({ ...payload.value, sessionDigest: sessionDigest.value }));
}

export function createSourceAuthorityRecord(input: unknown): ProtocolResult<SourceAuthorityRecord> {
  const payload = prepareCreatePayload(input, authorityInputFields, [
    ...['id', 'namespaceId', 'generationId', 'mmrStateId'].map(field => ({ field, decoder: identifier })),
    ...['physicalSourceDigest', 'operationRegistryRoot', 'terminalRoot', 'outboxRoot', 'mmrStateDigest']
      .map(field => ({ field, decoder: digest })),
    { field: 'sourceRevision', decoder: revision },
    { field: 'lifecycleHeadId', decoder: nullableIdentifier },
    { field: 'lifecycleHeadDigest', decoder: nullableDigest },
  ], 'absinthe_source_authority', 'create_source_authority');
  if (!payload.ok) return payload;
  if ((payload.value.lifecycleHeadId === null) !== (payload.value.lifecycleHeadDigest === null)) {
    return protocolFail('RELATIONSHIP_MISMATCH', 'create_source_authority', 'lifecycleHead');
  }
  const authorityDigest = digestPayload('absinthe.source_authority.v1', payload.value);
  if (!authorityDigest.ok) return authorityDigest;
  return decodeSourceAuthorityRecord(Object.freeze({ ...payload.value, authorityDigest: authorityDigest.value }));
}

export function createSourceTransactionReferenceRecord(
  input: unknown,
): ProtocolResult<SourceTransactionReferenceRecord> {
  const payload = prepareCreatePayload(input, referenceInputFields, [
    ...['id', 'namespaceId', 'generationId', 'sourceAuthorityId', 'operationId', 'admissionId', 'writerId', 'sessionId',
      'terminalId', 'outboxId', 'mmrStateId', 'checkpointId'].map(field => ({ field, decoder: identifier })),
    ...['physicalSourceDigest', 'sourceAuthorityDigest', 'operationDigest', 'admissionDigest', 'writerDigest',
      'sessionDigest', 'terminalDigest', 'outboxDigest', 'mmrStateDigest', 'checkpointDigest']
      .map(field => ({ field, decoder: digest })),
    { field: 'committedSourceRevision', decoder: revision },
    { field: 'graphVersion', decoder: (entry, field) => decodeLiteral(entry, 1, field, 'version') },
  ], 'absinthe_source_transaction_reference', 'create_source_reference');
  if (!payload.ok) return payload;
  const referenceDigest = digestPayload('absinthe.source_transaction_reference.v1', payload.value);
  if (!referenceDigest.ok) return referenceDigest;
  return decodeSourceTransactionReferenceRecord(Object.freeze({ ...payload.value, referenceDigest: referenceDigest.value }));
}

export function decodeWriterIdentityRecord(value: unknown): ProtocolResult<WriterIdentityRecord> {
  const object = decodeExactObject(value, writerFields);
  if (!object.ok) return object;
  const fields = decodeFields(object.value, [
    { field: 'kind', decoder: (entry, field) => decodeLiteral(entry, 'absinthe_writer_identity', field) },
    { field: 'version', decoder: (entry, field) => decodeLiteral(entry, 1, field, 'version') },
    ...['id', 'namespaceId', 'writerTypeId'].map(field => ({ field, decoder: identifier })),
    ...['physicalSourceDigest', 'manifestDigest', 'writerDigest'].map(field => ({ field, decoder: digest })),
  ]);
  if (!fields.ok) return fields;
  const record = Object.freeze({ ...object.value }) as unknown as WriterIdentityRecord;
  const { writerDigest, ...payload } = record;
  const verified = verifyDigest('absinthe.writer_identity.v1', payload, writerDigest, 'writerDigest');
  return verified.ok ? protocolOk(record) : verified;
}

export function decodeWriterSessionRecord(value: unknown): ProtocolResult<WriterSessionRecord> {
  const object = decodeExactObject(value, sessionFields);
  if (!object.ok) return object;
  const fields = decodeFields(object.value, [
    { field: 'kind', decoder: (entry, field) => decodeLiteral(entry, 'absinthe_writer_session', field) },
    { field: 'version', decoder: (entry, field) => decodeLiteral(entry, 1, field, 'version') },
    ...['id', 'namespaceId', 'generationId', 'writerId'].map(field => ({ field, decoder: identifier })),
    ...['physicalSourceDigest', 'writerDigest', 'capabilityDigest', 'sessionDigest'].map(field => ({ field, decoder: digest })),
    { field: 'epoch', decoder: positive },
  ]);
  if (!fields.ok) return fields;
  const record = Object.freeze({ ...object.value }) as unknown as WriterSessionRecord;
  const { sessionDigest, ...payload } = record;
  const verified = verifyDigest('absinthe.writer_session.v1', payload, sessionDigest, 'sessionDigest');
  return verified.ok ? protocolOk(record) : verified;
}

export function decodeSourceAuthorityRecord(value: unknown): ProtocolResult<SourceAuthorityRecord> {
  const object = decodeExactObject(value, authorityFields);
  if (!object.ok) return object;
  const fields = decodeFields(object.value, [
    { field: 'kind', decoder: (entry, field) => decodeLiteral(entry, 'absinthe_source_authority', field) },
    { field: 'version', decoder: (entry, field) => decodeLiteral(entry, 1, field, 'version') },
    ...['id', 'namespaceId', 'generationId', 'mmrStateId'].map(field => ({ field, decoder: identifier })),
    ...['physicalSourceDigest', 'operationRegistryRoot', 'terminalRoot', 'outboxRoot', 'mmrStateDigest', 'authorityDigest']
      .map(field => ({ field, decoder: digest })),
    { field: 'sourceRevision', decoder: revision },
    { field: 'lifecycleHeadId', decoder: nullableIdentifier },
    { field: 'lifecycleHeadDigest', decoder: nullableDigest },
  ]);
  if (!fields.ok) return fields;
  if ((object.value.lifecycleHeadId === null) !== (object.value.lifecycleHeadDigest === null)) {
    return protocolFail('RELATIONSHIP_MISMATCH', 'decode_record', 'lifecycleHead');
  }
  const record = Object.freeze({ ...object.value }) as unknown as SourceAuthorityRecord;
  const { authorityDigest, ...payload } = record;
  const verified = verifyDigest('absinthe.source_authority.v1', payload, authorityDigest, 'authorityDigest');
  return verified.ok ? protocolOk(record) : verified;
}

export function decodeSourceTransactionReferenceRecord(
  value: unknown,
): ProtocolResult<SourceTransactionReferenceRecord> {
  const object = decodeExactObject(value, referenceFields);
  if (!object.ok) return object;
  const fields = decodeFields(object.value, [
    { field: 'kind', decoder: (entry, field) => decodeLiteral(entry, 'absinthe_source_transaction_reference', field) },
    { field: 'version', decoder: (entry, field) => decodeLiteral(entry, 1, field, 'version') },
    ...['id', 'namespaceId', 'generationId', 'sourceAuthorityId', 'operationId', 'admissionId', 'writerId', 'sessionId',
      'terminalId', 'outboxId', 'mmrStateId', 'checkpointId'].map(field => ({ field, decoder: identifier })),
    ...['physicalSourceDigest', 'sourceAuthorityDigest', 'operationDigest', 'admissionDigest', 'writerDigest',
      'sessionDigest', 'terminalDigest', 'outboxDigest', 'mmrStateDigest', 'checkpointDigest', 'referenceDigest']
      .map(field => ({ field, decoder: digest })),
    { field: 'committedSourceRevision', decoder: revision },
    { field: 'graphVersion', decoder: (entry, field) => decodeLiteral(entry, 1, field, 'version') },
  ]);
  if (!fields.ok) return fields;
  const record = Object.freeze({ ...object.value }) as unknown as SourceTransactionReferenceRecord;
  const { referenceDigest, ...payload } = record;
  const verified = verifyDigest('absinthe.source_transaction_reference.v1', payload, referenceDigest, 'referenceDigest');
  return verified.ok ? protocolOk(record) : verified;
}

export function encodeRepresentativeProtocolRecord(record: unknown): ProtocolResult<Uint8Array> {
  const decoded = decodeRepresentativeProtocolRecord(record);
  return decoded.ok ? encodeCanonicalProtocolValue(decoded.value) : decoded;
}

export function decodeRepresentativeProtocolRecord(value: unknown): ProtocolResult<RepresentativeProtocolRecord> {
  const envelope = decodeExactObject(value, ['kind', 'version'], envelopeOptionalFields);
  if (!envelope.ok) return envelope;
  if (envelope.value.version !== REPRESENTATIVE_PROTOCOL_VERSION) {
    return protocolFail('UNSUPPORTED_RECORD_VERSION', 'decode_envelope', 'version');
  }
  switch (envelope.value.kind) {
    case 'absinthe_writer_identity': return decodeWriterIdentityRecord(envelope.value);
    case 'absinthe_writer_session': return decodeWriterSessionRecord(envelope.value);
    case 'absinthe_source_transaction_reference': return decodeSourceTransactionReferenceRecord(envelope.value);
    case 'absinthe_source_authority': return decodeSourceAuthorityRecord(envelope.value);
    default: return protocolFail('RECORD_KIND_MISMATCH', 'decode_envelope', 'kind');
  }
}

export function decodeRepresentativeProtocolRecordBytes(bytes: unknown): ProtocolResult<RepresentativeProtocolRecord> {
  const decoded = decodeCanonicalProtocolValue(bytes);
  return decoded.ok ? decodeRepresentativeProtocolRecord(decoded.value) : decoded;
}

export function validateRepresentativeAuthorityGraph(input: unknown): ProtocolResult<void> {
  const graph = decodeExactObject(input, ['writer', 'session', 'authority', 'reference'], [], 'validate_authority_graph');
  if (!graph.ok) return graph;
  const writerResult = decodeWriterIdentityRecord(graph.value.writer);
  if (!writerResult.ok) return writerResult;
  const sessionResult = decodeWriterSessionRecord(graph.value.session);
  if (!sessionResult.ok) return sessionResult;
  const authorityResult = decodeSourceAuthorityRecord(graph.value.authority);
  if (!authorityResult.ok) return authorityResult;
  const referenceResult = decodeSourceTransactionReferenceRecord(graph.value.reference);
  if (!referenceResult.ok) return referenceResult;
  const writer = writerResult.value;
  const session = sessionResult.value;
  const authority = authorityResult.value;
  const reference = referenceResult.value;
  const records: readonly RepresentativeProtocolRecord[] = [writer, session, authority, reference];
  const scopeMatches = records.every(record => record.namespaceId === writer.namespaceId
    && record.physicalSourceDigest === writer.physicalSourceDigest)
    && session.generationId === authority.generationId
    && reference.generationId === authority.generationId;
  const graphMatches = session.writerId === writer.id
    && session.writerDigest === writer.writerDigest
    && reference.writerId === writer.id
    && reference.writerDigest === writer.writerDigest
    && reference.sessionId === session.id
    && reference.sessionDigest === session.sessionDigest
    && reference.sourceAuthorityId === authority.id
    && reference.sourceAuthorityDigest === authority.authorityDigest
    && reference.committedSourceRevision === authority.sourceRevision
    && reference.mmrStateId === authority.mmrStateId
    && reference.mmrStateDigest === authority.mmrStateDigest;
  return scopeMatches && graphMatches
    ? protocolOk(undefined)
    : protocolFail('RELATIONSHIP_MISMATCH', 'validate_authority_graph');
}
