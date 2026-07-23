import {
  decodeCanonicalProtocolValue,
  encodeCanonicalProtocolValue,
  type CanonicalProtocolValue,
} from './canonicalProtocolValue';
import {
  buildCanonicalProtocolPreimage,
  digestCanonicalProtocolRecord,
  type ProtocolPreimageDomain,
} from './canonicalProtocolPreimage';
import { protocolFail, protocolOk, type ProtocolResult } from './protocolResult';
import {
  decodeDigest,
  decodeEnum,
  decodeExactObject,
  decodeIdentifier,
  decodeLiteral,
  decodePositiveSafeInteger,
  type StrictObject,
} from './strictProtocolDecode';

/**
 * K-334D is deliberately inert: these codecs neither open IndexedDB nor make
 * an authority/compatibility/eligibility decision. They only make canonical
 * evidence bytes and identities available to a later authorized repository.
 */
export const K334_CANONICAL_RECORD_VERSION = 1 as const;

type K334PreimageDomain = Extract<ProtocolPreimageDomain, `absinthe:k334:${string}`>;

interface K334RecordDefinition {
  readonly recordType: string;
  readonly idPrefix: string;
  readonly recordIdDomain: K334PreimageDomain;
  readonly canonicalDigestDomain: K334PreimageDomain;
  readonly fields: readonly string[];
}

const boundaryFields = Object.freeze([
  'boundary.effectiveSequence', 'boundary.effectiveAfterRecordId', 'boundary.prospectiveOnly',
] as const);
const provenanceFields = Object.freeze([
  'provenance.sourceKind', 'provenance.sourceRecordId', 'provenance.sourceDigest', 'provenance.recorderId',
] as const);

const definitions = Object.freeze({
  authority_evidence: {
    recordType: 'authority_evidence_v1', idPrefix: 'dar:v1:authority-evidence:',
    recordIdDomain: 'absinthe:k334:authority-evidence:v1:record-id',
    canonicalDigestDomain: 'absinthe:k334:authority-evidence:v1:canonical-digest',
    fields: Object.freeze([
      'recordType', 'recordSchemaVersion', 'repositoryNamespace', 'namespaceKey', 'subjectId', 'issuerId',
      'lineageId', 'predecessorRecordId', 'supersedesRecordId', 'action', 'lifecycleStatus', ...boundaryFields,
      'compatibilityTupleId', ...provenanceFields,
    ]),
  },
  issuer_policy: {
    recordType: 'issuer_policy_v1', idPrefix: 'dar:v1:issuer-policy:',
    recordIdDomain: 'absinthe:k334:issuer-policy:v1:record-id',
    canonicalDigestDomain: 'absinthe:k334:issuer-policy:v1:canonical-digest',
    fields: Object.freeze([
      'recordType', 'recordSchemaVersion', 'repositoryNamespace', 'namespaceKey', 'issuerId', 'subjectId',
      'action', 'compatibilityTupleId', 'lifecycleStatus', 'predecessorRecordId', 'supersedesRecordId',
      'terminationRecordId', ...boundaryFields, ...provenanceFields,
    ]),
  },
  rollback_permission: {
    recordType: 'rollback_permission_v1', idPrefix: 'dar:v1:rollback-permission:',
    recordIdDomain: 'absinthe:k334:rollback-permission:v1:record-id',
    canonicalDigestDomain: 'absinthe:k334:rollback-permission:v1:canonical-digest',
    fields: Object.freeze([
      'recordType', 'recordSchemaVersion', 'repositoryNamespace', 'namespaceKey', 'issuerId', 'subjectId',
      'rollbackTargetRecordId', 'compatibilityTupleId', 'predecessorRecordId', 'supersedesRecordId',
      'terminationRecordId', ...boundaryFields, ...provenanceFields,
    ]),
  },
  termination: {
    recordType: 'termination_v1', idPrefix: 'dar:v1:termination:',
    recordIdDomain: 'absinthe:k334:termination:v1:record-id',
    canonicalDigestDomain: 'absinthe:k334:termination:v1:canonical-digest',
    fields: Object.freeze([
      'recordType', 'recordSchemaVersion', 'repositoryNamespace', 'namespaceKey', 'subjectId', 'issuerId',
      'targetKind', 'targetRecordId', 'issuerAuthorityRecordId', 'predecessorRecordId', 'supersedesRecordId',
      ...boundaryFields, ...provenanceFields,
    ]),
  },
  compatibility_tuple: {
    recordType: 'authority_compatibility_tuple_v1', idPrefix: 'dat:v1:',
    recordIdDomain: 'absinthe:k334:compatibility-tuple:v1:tuple-id',
    canonicalDigestDomain: 'absinthe:k334:compatibility-tuple:v1:canonical-digest',
    fields: Object.freeze([
      'recordType', 'recordSchemaVersion', 'repositoryNamespace', 'namespaceKey', 'authorityProtocolVersion',
      'authorityRecordSchemaVersion', 'manifestEvidenceVersion', 'subjectNamespace', 'issuerNamespace',
      'compatibilityPolicyVersion', 'installationNamespace', 'action', 'sourceClass', 'migrationEpoch',
      ...boundaryFields, ...provenanceFields,
    ]),
  },
  external_subject_mapping: {
    recordType: 'external_subject_mapping_v1', idPrefix: 'dar:v1:external-subject-mapping:',
    recordIdDomain: 'absinthe:k334:external-subject-mapping:v1:record-id',
    canonicalDigestDomain: 'absinthe:k334:external-subject-mapping:v1:canonical-digest',
    fields: Object.freeze([
      'recordType', 'recordSchemaVersion', 'repositoryNamespace', 'namespaceKey', 'mappingKind', 'provider',
      'externalNamespace', 'externalIdentifier', 'internalId', 'predecessorRecordId', 'supersedesRecordId',
      ...boundaryFields, ...provenanceFields,
    ]),
  },
  external_issuer_mapping: {
    recordType: 'external_issuer_mapping_v1', idPrefix: 'dar:v1:external-issuer-mapping:',
    recordIdDomain: 'absinthe:k334:external-issuer-mapping:v1:record-id',
    canonicalDigestDomain: 'absinthe:k334:external-issuer-mapping:v1:canonical-digest',
    fields: Object.freeze([
      'recordType', 'recordSchemaVersion', 'repositoryNamespace', 'namespaceKey', 'mappingKind', 'provider',
      'externalNamespace', 'externalIdentifier', 'internalId', 'predecessorRecordId', 'supersedesRecordId',
      ...boundaryFields, ...provenanceFields,
    ]),
  },
  conflict_observation: {
    recordType: 'conflict_observation_v1', idPrefix: 'dar:v1:conflict-observation:',
    recordIdDomain: 'absinthe:k334:conflict-observation:v1:record-id',
    canonicalDigestDomain: 'absinthe:k334:conflict-observation:v1:canonical-digest',
    fields: Object.freeze([
      'recordType', 'recordSchemaVersion', 'repositoryNamespace', 'namespaceKey', 'subjectId', 'lineageId',
      'effectiveSequence', 'predecessorRecordId', 'candidateCollectionBytes', 'reasonCode', ...provenanceFields,
    ]),
  },
  fork_observation: {
    recordType: 'fork_observation_v1', idPrefix: 'dar:v1:fork-observation:',
    recordIdDomain: 'absinthe:k334:fork-observation:v1:record-id',
    canonicalDigestDomain: 'absinthe:k334:fork-observation:v1:canonical-digest',
    fields: Object.freeze([
      'recordType', 'recordSchemaVersion', 'repositoryNamespace', 'namespaceKey', 'subjectId', 'lineageId',
      'effectiveSequence', 'predecessorRecordId', 'candidateCollectionBytes', 'reasonCode', ...provenanceFields,
    ]),
  },
  subject_quarantine: {
    recordType: 'subject_quarantine_v1', idPrefix: 'dar:v1:subject-quarantine:',
    recordIdDomain: 'absinthe:k334:subject-quarantine:v1:record-id',
    canonicalDigestDomain: 'absinthe:k334:subject-quarantine:v1:canonical-digest',
    fields: Object.freeze([
      'recordType', 'recordSchemaVersion', 'repositoryNamespace', 'namespaceKey', 'subjectId', 'quarantineState',
      'reasonCode', 'quarantineBasisCollectionBytes', 'permanent', ...boundaryFields, ...provenanceFields,
    ]),
  },
  migration_classification: {
    recordType: 'migration_classification_v1', idPrefix: 'dar:v1:migration-classification:',
    recordIdDomain: 'absinthe:k334:migration-classification:v1:record-id',
    canonicalDigestDomain: 'absinthe:k334:migration-classification:v1:canonical-digest',
    fields: Object.freeze([
      'recordType', 'recordSchemaVersion', 'repositoryNamespace', 'namespaceKey', 'batchId', 'sourceKind',
      'sourceDigest', 'classification', 'supersedesClassificationId', ...provenanceFields,
    ]),
  },
} as const satisfies Readonly<Record<string, K334RecordDefinition>>);

const AUTHORITY_ACTIONS = Object.freeze(['grant', 'revoke', 'supersede', 'terminate'] as const);
const LIFECYCLE_STATUSES = Object.freeze([
  'proposed', 'recorded', 'accepted', 'superseded', 'terminated', 'rollback_applied', 'unsupported', 'malformed',
] as const);
const SOURCE_CLASSES = Object.freeze(['k333_codec', 'owner_evidence', 'legacy', 'migration'] as const);
const REASON_CODES = Object.freeze([
  'ambiguous_mapping', 'competing_successor', 'conflicting_candidate', 'confirmed_fork', 'incompatible_tuple',
  'incomplete_source', 'invalid_canonical_bytes', 'invalid_semantic_field', 'missing_required_evidence',
  'unavailable_source', 'unsupported_record',
] as const);
const MIGRATION_CLASSIFICATIONS = Object.freeze(['A', 'B', 'C', 'D', 'E', 'F'] as const);
const K334_RECORD_PREFIXES = Object.freeze([
  'dar:v1:authority-evidence:',
  'dar:v1:issuer-policy:',
  'dar:v1:rollback-permission:',
  'dar:v1:termination:',
  'dat:v1:',
  'dar:v1:external-subject-mapping:',
  'dar:v1:external-issuer-mapping:',
  'dar:v1:conflict-observation:',
  'dar:v1:fork-observation:',
  'dar:v1:subject-quarantine:',
  'dar:v1:migration-classification:',
] as const);
const TARGET_PREFIXES = Object.freeze({
  authority_evidence: 'dar:v1:authority-evidence:',
  issuer_policy: 'dar:v1:issuer-policy:',
  rollback_permission: 'dar:v1:rollback-permission:',
  compatibility_tuple: 'dat:v1:',
  external_subject_mapping: 'dar:v1:external-subject-mapping:',
  external_issuer_mapping: 'dar:v1:external-issuer-mapping:',
} as const);
const TERMINATION_RECORD_PREFIX = 'dar:v1:termination:';
const IDENTIFIER_SEGMENT = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/;
const EXTERNAL_IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:@~-]{0,255}$/;
const NAMESPACE_KEY = /^[a-f0-9]{64}$/;
const RECORD_DIGEST_SUFFIX = /^[a-f0-9]{64}$/;

export const K334_CONTENT_ADDRESSED_KINDS = Object.freeze(Object.keys(definitions)) as readonly (keyof typeof definitions)[];
export type K334ContentAddressedRecordKind = typeof K334_CONTENT_ADDRESSED_KINDS[number];

export interface K334CanonicalRecord {
  readonly kind: K334ContentAddressedRecordKind;
  readonly version: 1;
  readonly recordId: string;
  readonly canonicalDigest: string;
  readonly payload: Readonly<Record<string, CanonicalProtocolValue>>;
}

export interface K334ReferencePair {
  readonly recordId: string;
  readonly canonicalDigest: string;
}

export interface K334ReferenceCollection {
  readonly kind: 'candidate' | 'quarantine_basis';
  readonly bytes: Uint8Array;
  readonly references: readonly K334ReferencePair[];
}

const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', { fatal: true });
const HEX = /^(?:[a-f0-9]{2})+$/;

function equalBytes(left: Uint8Array, right: Uint8Array): boolean {
  if (left.byteLength !== right.byteLength) return false;
  for (let index = 0; index < left.byteLength; index += 1) if (left[index] !== right[index]) return false;
  return true;
}

function compareUnsignedBytes(left: Uint8Array, right: Uint8Array): number {
  const length = Math.min(left.byteLength, right.byteLength);
  for (let index = 0; index < length; index += 1) if (left[index] !== right[index]) return left[index] - right[index];
  return left.byteLength - right.byteLength;
}

function bytesToHex(value: Uint8Array): string {
  return Array.from(value, byte => byte.toString(16).padStart(2, '0')).join('');
}

function hexToBytes(value: unknown, field: string): ProtocolResult<Uint8Array> {
  if (typeof value !== 'string' || !HEX.test(value)) return protocolFail('NON_CANONICAL_VALUE', 'k334_hex', field);
  const bytes = new Uint8Array(value.length / 2);
  for (let index = 0; index < bytes.length; index += 1) bytes[index] = Number.parseInt(value.slice(index * 2, index * 2 + 2), 16);
  return protocolOk(bytes);
}

function definitionFor(value: unknown): ProtocolResult<readonly [K334ContentAddressedRecordKind, K334RecordDefinition]> {
  const kind = decodeEnum(value, K334_CONTENT_ADDRESSED_KINDS, 'kind');
  if (!kind.ok) return kind;
  return protocolOk(Object.freeze([kind.value, definitions[kind.value]]));
}

function decodeAsciiPattern(
  value: unknown,
  field: string,
  pattern: RegExp,
  minimumBytes: number,
  maximumBytes: number,
): ProtocolResult<string> {
  if (typeof value !== 'string') return protocolFail('INVALID_FIELD_TYPE', 'k334_semantic', field);
  const bytes = encoder.encode(value).byteLength;
  return bytes >= minimumBytes && bytes <= maximumBytes && pattern.test(value)
    ? protocolOk(value)
    : protocolFail('INVALID_IDENTIFIER', 'k334_semantic', field);
}

function decodeNullableIdentifier(value: unknown, field: string): ProtocolResult<string | null> {
  if (value === null) return protocolOk(null);
  return decodeIdentifier(value, field);
}

function decodeRecordReference(
  value: unknown,
  field: string,
  prefixes: readonly string[] = K334_RECORD_PREFIXES,
): ProtocolResult<string> {
  const identifier = decodeIdentifier(value, field);
  if (!identifier.ok) return identifier;
  const prefix = prefixes.find(candidate => identifier.value.startsWith(candidate));
  if (!prefix || !RECORD_DIGEST_SUFFIX.test(identifier.value.slice(prefix.length))) {
    return protocolFail('INVALID_IDENTIFIER', 'k334_semantic', field);
  }
  return identifier;
}

function decodeNullableRecordReference(
  value: unknown,
  field: string,
  prefixes: readonly string[] = K334_RECORD_PREFIXES,
): ProtocolResult<string | null> {
  if (value === null) return protocolOk(null);
  return decodeRecordReference(value, field, prefixes);
}

function decodeRepositoryNamespace(value: unknown): ProtocolResult<string> {
  if (typeof value !== 'string' || !value.startsWith('absinthe.installation.')) {
    return protocolFail('INVALID_IDENTIFIER', 'k334_semantic', 'repositoryNamespace');
  }
  const suffix = value.slice('absinthe.installation.'.length);
  return decodeAsciiPattern(value, 'repositoryNamespace', /^absinthe\.installation\.[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/, 24, 128).ok
    && IDENTIFIER_SEGMENT.test(suffix)
    ? protocolOk(value)
    : protocolFail('INVALID_IDENTIFIER', 'k334_semantic', 'repositoryNamespace');
}

function decodeNamespaceKey(value: unknown): ProtocolResult<string> {
  return decodeAsciiPattern(value, 'namespaceKey', NAMESPACE_KEY, 64, 64);
}

function decodeTupleNamespace(value: unknown, field: 'subjectNamespace' | 'issuerNamespace'): ProtocolResult<string> {
  const prefix = field === 'subjectNamespace' ? 'subject.' : 'issuer.';
  const pattern = field === 'subjectNamespace'
    ? /^subject\.[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/
    : /^issuer\.[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/;
  if (typeof value !== 'string' || !value.startsWith(prefix)) {
    return protocolFail('INVALID_IDENTIFIER', 'k334_semantic', field);
  }
  const suffix = value.slice(prefix.length);
  return decodeAsciiPattern(value, field, pattern, 8, 128).ok
    && IDENTIFIER_SEGMENT.test(suffix)
    ? protocolOk(value)
    : protocolFail('INVALID_IDENTIFIER', 'k334_semantic', field);
}

function decodeMigrationEpoch(value: unknown): ProtocolResult<number> {
  if (typeof value !== 'number') return protocolFail('INVALID_FIELD_TYPE', 'k334_semantic', 'migrationEpoch');
  return Number.isSafeInteger(value) && value > 0 && !Object.is(value, -0)
    ? protocolOk(value)
    : protocolFail('INVALID_INTEGER', 'k334_semantic', 'migrationEpoch');
}

function decodeProvider(value: unknown, field: 'provider' | 'externalNamespace', maximumBytes: number): ProtocolResult<string> {
  return decodeAsciiPattern(value, field, IDENTIFIER_SEGMENT, 1, maximumBytes);
}

function decodeExternalIdentifier(value: unknown): ProtocolResult<string> {
  return decodeAsciiPattern(value, 'externalIdentifier', EXTERNAL_IDENTIFIER, 1, 256);
}

function decodeAuthorityBoundary(payload: StrictObject): ProtocolResult<void> {
  const sequence = decodePositiveSafeInteger(payload['boundary.effectiveSequence'], 'boundary.effectiveSequence');
  if (!sequence.ok) return sequence;
  const after = decodeNullableRecordReference(payload['boundary.effectiveAfterRecordId'], 'boundary.effectiveAfterRecordId');
  if (!after.ok) return after;
  return payload['boundary.prospectiveOnly'] === true
    ? protocolOk(undefined)
    : protocolFail('INVALID_FIELD_TYPE', 'k334_semantic', 'boundary.prospectiveOnly');
}

function decodeProvenance(payload: StrictObject): ProtocolResult<void> {
  const kind = decodeEnum(payload['provenance.sourceKind'], SOURCE_CLASSES, 'provenance.sourceKind');
  if (!kind.ok) return kind;
  const record = decodeNullableIdentifier(payload['provenance.sourceRecordId'], 'provenance.sourceRecordId');
  if (!record.ok) return record;
  const digest = decodeDigest(payload['provenance.sourceDigest'], 'provenance.sourceDigest');
  if (!digest.ok) return digest;
  const recorder = decodeIdentifier(payload['provenance.recorderId'], 'provenance.recorderId');
  return recorder.ok ? protocolOk(undefined) : recorder;
}

function decodeReferenceCollectionField(
  value: unknown,
  field: 'candidateCollectionBytes' | 'quarantineBasisCollectionBytes',
): ProtocolResult<void> {
  const bytes = hexToBytes(value, field);
  if (!bytes.ok) return bytes;
  const collection = decodeReferenceCollection(field === 'candidateCollectionBytes' ? 'candidate' : 'quarantine_basis', bytes.value);
  return collection.ok ? protocolOk(undefined) : collection;
}

function decodePayloadEnvelope(definition: K334RecordDefinition, value: unknown): ProtocolResult<StrictObject> {
  const decoded = decodeExactObject(value, definition.fields, [], 'k334_payload');
  if (!decoded.ok) return decoded;
  const type = decodeLiteral(decoded.value.recordType, definition.recordType, 'recordType');
  if (!type.ok) return type;
  const version = decodeLiteral(decoded.value.recordSchemaVersion, K334_CANONICAL_RECORD_VERSION, 'recordSchemaVersion', 'version');
  return version.ok ? decoded : version;
}

function validateCommonPayload(payload: StrictObject): ProtocolResult<void> {
  const repository = decodeRepositoryNamespace(payload.repositoryNamespace);
  if (!repository.ok) return repository;
  const namespace = decodeNamespaceKey(payload.namespaceKey);
  return namespace.ok ? protocolOk(undefined) : namespace;
}

function validateRecordReferences(payload: StrictObject, fields: readonly string[]): ProtocolResult<void> {
  for (const field of fields) {
    const reference = decodeNullableRecordReference(payload[field], field);
    if (!reference.ok) return reference;
  }
  return protocolOk(undefined);
}

function preserveValidatedPayload(payload: StrictObject, validation: ProtocolResult<void>): ProtocolResult<StrictObject> {
  return validation.ok ? protocolOk(payload) : validation;
}

function validateSemanticPayload(
  kind: K334ContentAddressedRecordKind,
  definition: K334RecordDefinition,
  value: unknown,
): ProtocolResult<StrictObject> {
  const payload = decodePayloadEnvelope(definition, value);
  if (!payload.ok) return payload;
  const common = validateCommonPayload(payload.value);
  if (!common.ok) return common;
  const provenance = decodeProvenance(payload.value);
  if (!provenance.ok) return provenance;

  switch (kind) {
    case 'authority_evidence': {
      for (const field of ['subjectId', 'issuerId', 'lineageId', 'compatibilityTupleId'] as const) {
        const identifier = field === 'compatibilityTupleId'
          ? decodeRecordReference(payload.value[field], field, [TARGET_PREFIXES.compatibility_tuple])
          : decodeIdentifier(payload.value[field], field);
        if (!identifier.ok) return identifier;
      }
      const references = validateRecordReferences(payload.value, ['predecessorRecordId', 'supersedesRecordId']);
      if (!references.ok) return references;
      const action = decodeLiteral(payload.value.action, 'grant', 'action');
      if (!action.ok) return action;
      const status = decodeEnum(payload.value.lifecycleStatus, LIFECYCLE_STATUSES, 'lifecycleStatus');
      if (!status.ok) return status;
      return preserveValidatedPayload(payload.value, decodeAuthorityBoundary(payload.value));
    }
    case 'issuer_policy': {
      for (const field of ['issuerId', 'subjectId'] as const) {
        const identifier = decodeIdentifier(payload.value[field], field); if (!identifier.ok) return identifier;
      }
      const action = decodeEnum(payload.value.action, AUTHORITY_ACTIONS, 'action'); if (!action.ok) return action;
      const tuple = decodeRecordReference(payload.value.compatibilityTupleId, 'compatibilityTupleId', [TARGET_PREFIXES.compatibility_tuple]);
      if (!tuple.ok) return tuple;
      const status = decodeEnum(payload.value.lifecycleStatus, LIFECYCLE_STATUSES, 'lifecycleStatus'); if (!status.ok) return status;
      const references = validateRecordReferences(payload.value, ['predecessorRecordId', 'supersedesRecordId']);
      if (!references.ok) return references;
      const termination = decodeNullableRecordReference(payload.value.terminationRecordId, 'terminationRecordId', [TERMINATION_RECORD_PREFIX]);
      if (!termination.ok) return termination;
      return preserveValidatedPayload(payload.value, references.ok ? decodeAuthorityBoundary(payload.value) : references);
    }
    case 'rollback_permission': {
      for (const field of ['issuerId', 'subjectId'] as const) {
        const identifier = decodeIdentifier(payload.value[field], field); if (!identifier.ok) return identifier;
      }
      const target = decodeRecordReference(payload.value.rollbackTargetRecordId, 'rollbackTargetRecordId'); if (!target.ok) return target;
      const tuple = decodeRecordReference(payload.value.compatibilityTupleId, 'compatibilityTupleId', [TARGET_PREFIXES.compatibility_tuple]);
      if (!tuple.ok) return tuple;
      const references = validateRecordReferences(payload.value, ['predecessorRecordId', 'supersedesRecordId']);
      if (!references.ok) return references;
      const termination = decodeNullableRecordReference(payload.value.terminationRecordId, 'terminationRecordId', [TERMINATION_RECORD_PREFIX]);
      if (!termination.ok) return termination;
      return preserveValidatedPayload(payload.value, references.ok ? decodeAuthorityBoundary(payload.value) : references);
    }
    case 'termination': {
      for (const field of ['subjectId', 'issuerId'] as const) {
        const identifier = decodeIdentifier(payload.value[field], field); if (!identifier.ok) return identifier;
      }
      const targetKind = decodeEnum(payload.value.targetKind, Object.keys(TARGET_PREFIXES) as (keyof typeof TARGET_PREFIXES)[], 'targetKind');
      if (!targetKind.ok) return targetKind;
      const target = decodeRecordReference(payload.value.targetRecordId, 'targetRecordId', [TARGET_PREFIXES[targetKind.value]]);
      if (!target.ok) return target;
      const issuerAuthority = decodeRecordReference(payload.value.issuerAuthorityRecordId, 'issuerAuthorityRecordId', [TARGET_PREFIXES.authority_evidence]);
      if (!issuerAuthority.ok) return issuerAuthority;
      const references = validateRecordReferences(payload.value, ['predecessorRecordId', 'supersedesRecordId']);
      return preserveValidatedPayload(payload.value, references.ok ? decodeAuthorityBoundary(payload.value) : references);
    }
    case 'compatibility_tuple': {
      for (const field of ['authorityProtocolVersion', 'authorityRecordSchemaVersion', 'manifestEvidenceVersion', 'compatibilityPolicyVersion'] as const) {
        const version = decodeLiteral(payload.value[field], 1, field, 'version'); if (!version.ok) return version;
      }
      const subjectNamespace = decodeTupleNamespace(payload.value.subjectNamespace, 'subjectNamespace'); if (!subjectNamespace.ok) return subjectNamespace;
      const issuerNamespace = decodeTupleNamespace(payload.value.issuerNamespace, 'issuerNamespace'); if (!issuerNamespace.ok) return issuerNamespace;
      if (payload.value.installationNamespace !== payload.value.repositoryNamespace) {
        return protocolFail('RELATIONSHIP_MISMATCH', 'k334_semantic', 'installationNamespace');
      }
      const installation = decodeRepositoryNamespace(payload.value.installationNamespace); if (!installation.ok) return installation;
      const action = decodeEnum(payload.value.action, AUTHORITY_ACTIONS, 'action'); if (!action.ok) return action;
      const sourceClass = decodeEnum(payload.value.sourceClass, SOURCE_CLASSES, 'sourceClass'); if (!sourceClass.ok) return sourceClass;
      const epoch = decodeMigrationEpoch(payload.value.migrationEpoch); if (!epoch.ok) return epoch;
      return preserveValidatedPayload(payload.value, decodeAuthorityBoundary(payload.value));
    }
    case 'external_subject_mapping':
    case 'external_issuer_mapping': {
      const expected = kind === 'external_subject_mapping' ? 'subject' : 'issuer';
      const mapping = decodeLiteral(payload.value.mappingKind, expected, 'mappingKind'); if (!mapping.ok) return mapping;
      const provider = decodeProvider(payload.value.provider, 'provider', 64); if (!provider.ok) return provider;
      const externalNamespace = decodeProvider(payload.value.externalNamespace, 'externalNamespace', 96); if (!externalNamespace.ok) return externalNamespace;
      const externalIdentifier = decodeExternalIdentifier(payload.value.externalIdentifier); if (!externalIdentifier.ok) return externalIdentifier;
      const internal = decodeIdentifier(payload.value.internalId, 'internalId'); if (!internal.ok) return internal;
      const references = validateRecordReferences(payload.value, ['predecessorRecordId', 'supersedesRecordId']);
      return preserveValidatedPayload(payload.value, references.ok ? decodeAuthorityBoundary(payload.value) : references);
    }
    case 'conflict_observation':
    case 'fork_observation': {
      const subject = decodeIdentifier(payload.value.subjectId, 'subjectId'); if (!subject.ok) return subject;
      const lineage = decodeNullableIdentifier(payload.value.lineageId, 'lineageId'); if (!lineage.ok) return lineage;
      const sequence = decodePositiveSafeInteger(payload.value.effectiveSequence, 'effectiveSequence'); if (!sequence.ok) return sequence;
      const predecessor = decodeNullableRecordReference(payload.value.predecessorRecordId, 'predecessorRecordId'); if (!predecessor.ok) return predecessor;
      const collection = decodeReferenceCollectionField(payload.value.candidateCollectionBytes, 'candidateCollectionBytes'); if (!collection.ok) return collection;
      const reason = decodeEnum(payload.value.reasonCode, REASON_CODES, 'reasonCode');
      return reason.ok ? protocolOk(payload.value) : reason;
    }
    case 'subject_quarantine': {
      const subject = decodeIdentifier(payload.value.subjectId, 'subjectId'); if (!subject.ok) return subject;
      const state = decodeLiteral(payload.value.quarantineState, 'forked', 'quarantineState'); if (!state.ok) return state;
      const reason = decodeEnum(payload.value.reasonCode, REASON_CODES, 'reasonCode'); if (!reason.ok) return reason;
      const collection = decodeReferenceCollectionField(payload.value.quarantineBasisCollectionBytes, 'quarantineBasisCollectionBytes'); if (!collection.ok) return collection;
      if (payload.value.permanent !== true) return protocolFail('INVALID_FIELD_TYPE', 'k334_semantic', 'permanent');
      return preserveValidatedPayload(payload.value, decodeAuthorityBoundary(payload.value));
    }
    case 'migration_classification': {
      const batch = decodeIdentifier(payload.value.batchId, 'batchId'); if (!batch.ok) return batch;
      const sourceKind = decodeEnum(payload.value.sourceKind, SOURCE_CLASSES, 'sourceKind'); if (!sourceKind.ok) return sourceKind;
      const sourceDigest = decodeDigest(payload.value.sourceDigest, 'sourceDigest'); if (!sourceDigest.ok) return sourceDigest;
      const classification = decodeEnum(payload.value.classification, MIGRATION_CLASSIFICATIONS, 'classification'); if (!classification.ok) return classification;
      const supersedes = decodeNullableRecordReference(payload.value.supersedesClassificationId, 'supersedesClassificationId', ['dar:v1:migration-classification:']);
      return supersedes.ok ? protocolOk(payload.value) : supersedes;
    }
  }
}

function orderedPayload(
  definition: K334RecordDefinition,
  value: StrictObject,
): ProtocolResult<readonly [readonly (readonly [string, CanonicalProtocolValue])[], Readonly<Record<string, CanonicalProtocolValue>>]> {
  const candidate = definition.fields.map(field => Object.freeze([field, value[field]] as const));
  const encoded = encodeCanonicalProtocolValue(candidate);
  if (!encoded.ok) return encoded;
  const snapshot = decodeCanonicalProtocolValue(encoded.value);
  if (!snapshot.ok || !Array.isArray(snapshot.value) || snapshot.value.length !== definition.fields.length) {
    return protocolFail('NON_CANONICAL_VALUE', 'k334_payload', 'payload');
  }
  const fields: [string, CanonicalProtocolValue][] = [];
  const payload: Record<string, CanonicalProtocolValue> = Object.create(null) as Record<string, CanonicalProtocolValue>;
  for (let index = 0; index < definition.fields.length; index += 1) {
    const pair = snapshot.value[index];
    if (!Array.isArray(pair) || pair.length !== 2 || pair[0] !== definition.fields[index]) {
      return protocolFail('NON_CANONICAL_VALUE', 'k334_payload', 'fieldOrder');
    }
    fields.push([definition.fields[index], pair[1]]);
    payload[definition.fields[index]] = pair[1];
  }
  return protocolOk(Object.freeze([Object.freeze(fields.map(pair => Object.freeze(pair))), Object.freeze(payload)]));
}

function createRecord(kind: K334ContentAddressedRecordKind, payload: unknown): ProtocolResult<K334CanonicalRecord> {
  const definition = definitions[kind];
  const semanticPayload = validateSemanticPayload(kind, definition, payload);
  if (!semanticPayload.ok) return semanticPayload;
  const fields = orderedPayload(definition, semanticPayload.value);
  if (!fields.ok) return fields;
  const recordIdDigest = digestCanonicalProtocolRecord(definition.recordIdDomain, K334_CANONICAL_RECORD_VERSION, fields.value[0]);
  if (!recordIdDigest.ok) return recordIdDigest;
  const canonicalDigest = digestCanonicalProtocolRecord(definition.canonicalDigestDomain, K334_CANONICAL_RECORD_VERSION, fields.value[0]);
  if (!canonicalDigest.ok) return canonicalDigest;
  return protocolOk(Object.freeze({
    kind,
    version: K334_CANONICAL_RECORD_VERSION,
    recordId: `${definition.idPrefix}${recordIdDigest.value}`,
    canonicalDigest: canonicalDigest.value,
    payload: fields.value[1],
  }));
}

export function createK334CanonicalRecord(value: unknown): ProtocolResult<K334CanonicalRecord> {
  const envelope = decodeExactObject(value, ['kind', 'payload'], [], 'create_k334_record');
  if (!envelope.ok) return envelope;
  const definition = definitionFor(envelope.value.kind);
  return definition.ok ? createRecord(definition.value[0], envelope.value.payload) : definition;
}

export function encodeK334CanonicalRecord(value: unknown): ProtocolResult<Uint8Array> {
  const record = decodeK334CanonicalRecord(value);
  return record.ok ? encodeCanonicalProtocolValue(record.value) : record;
}

export function decodeK334CanonicalRecord(value: unknown): ProtocolResult<K334CanonicalRecord> {
  const envelope = decodeExactObject(value, ['kind', 'version', 'recordId', 'canonicalDigest', 'payload'], [], 'decode_k334_record');
  if (!envelope.ok) return envelope;
  const definition = definitionFor(envelope.value.kind);
  if (!definition.ok) return definition;
  const version = decodeLiteral(envelope.value.version, K334_CANONICAL_RECORD_VERSION, 'version', 'version');
  if (!version.ok) return version;
  const recordId = decodeIdentifier(envelope.value.recordId, 'recordId');
  if (!recordId.ok) return recordId;
  const digest = decodeDigest(envelope.value.canonicalDigest, 'canonicalDigest');
  if (!digest.ok) return digest;
  const recreated = createRecord(definition.value[0], envelope.value.payload);
  if (!recreated.ok) return recreated;
  return recreated.value.recordId === recordId.value && recreated.value.canonicalDigest === digest.value
    ? recreated
    : protocolFail('CANONICAL_DIGEST_MISMATCH', 'decode_k334_record', 'identity');
}

export function decodeK334CanonicalRecordBytes(value: unknown): ProtocolResult<K334CanonicalRecord> {
  const decoded = decodeCanonicalProtocolValue(value);
  return decoded.ok ? decodeK334CanonicalRecord(decoded.value) : decoded;
}

type ReferenceKind = K334ReferenceCollection['kind'];

const referenceDomains = Object.freeze({
  candidate: Object.freeze({
    pair: 'absinthe:k334:candidate-reference:v1:pair',
    collection: 'absinthe:k334:candidate-reference:v1:collection',
    idField: 'candidateRecordId', digestField: 'candidateCanonicalDigest',
  }),
  quarantine_basis: Object.freeze({
    pair: 'absinthe:k334:quarantine-basis-reference:v1:pair',
    collection: 'absinthe:k334:quarantine-basis-reference:v1:collection',
    idField: 'observationRecordId', digestField: 'observationCanonicalDigest',
  }),
} as const satisfies Readonly<Record<ReferenceKind, Readonly<{
  pair: K334PreimageDomain;
  collection: K334PreimageDomain;
  idField: string;
  digestField: string;
}>>>);

function referenceInput(kind: ReferenceKind, value: unknown): ProtocolResult<K334ReferencePair> {
  const schema = referenceDomains[kind];
  const input = decodeExactObject(value, [schema.idField, schema.digestField], [], 'k334_reference');
  if (!input.ok) return input;
  const id = decodeRecordReference(input.value[schema.idField], schema.idField);
  if (!id.ok) return id;
  const digest = decodeDigest(input.value[schema.digestField], schema.digestField);
  return digest.ok ? protocolOk(Object.freeze({ recordId: id.value, canonicalDigest: digest.value })) : digest;
}

function referencePayload(kind: ReferenceKind, reference: K334ReferencePair): readonly (readonly [string, string])[] {
  const schema = referenceDomains[kind];
  return Object.freeze([
    Object.freeze([schema.idField, reference.recordId] as const),
    Object.freeze([schema.digestField, reference.canonicalDigest] as const),
  ]);
}

function copyBytes(value: unknown): ProtocolResult<Uint8Array> {
  try {
    if (!(value instanceof Uint8Array)) return protocolFail('INVALID_ENCODED_INPUT', 'k334_frame');
    return protocolOk(new Uint8Array(value));
  } catch {
    return protocolFail('INVALID_ENCODED_INPUT', 'k334_frame');
  }
}

function decodeFramedPayload(value: unknown, domain: K334PreimageDomain): ProtocolResult<CanonicalProtocolValue> {
  const copied = copyBytes(value);
  if (!copied.ok) return copied;
  try {
    const text = decoder.decode(copied.value);
    const prefix = `absinthe-protocol-preimage-v1\nD:${encoder.encode(domain).byteLength}:${domain}\nV:1\nP:`;
    if (!text.startsWith(prefix)) return protocolFail('INVALID_ENCODED_INPUT', 'k334_frame', 'domain');
    const remainder = text.slice(prefix.length);
    const separator = remainder.indexOf(':');
    if (separator < 1 || !/^(0|[1-9][0-9]*)$/.test(remainder.slice(0, separator))) {
      return protocolFail('INVALID_ENCODED_INPUT', 'k334_frame', 'length');
    }
    const byteLength = Number(remainder.slice(0, separator));
    const payloadText = remainder.slice(separator + 1);
    if (!Number.isSafeInteger(byteLength) || encoder.encode(payloadText).byteLength !== byteLength) {
      return protocolFail('INVALID_ENCODED_INPUT', 'k334_frame', 'length');
    }
    const payload = decodeCanonicalProtocolValue(encoder.encode(payloadText));
    if (!payload.ok) return payload;
    const rebuilt = buildCanonicalProtocolPreimage(domain, K334_CANONICAL_RECORD_VERSION, payload.value);
    return rebuilt.ok && equalBytes(rebuilt.value, copied.value)
      ? payload
      : protocolFail('NON_CANONICAL_VALUE', 'k334_frame', 'bytes');
  } catch {
    return protocolFail('INVALID_ENCODED_INPUT', 'k334_frame');
  }
}

function decodeReferencePayload(kind: ReferenceKind, payload: CanonicalProtocolValue): ProtocolResult<K334ReferencePair> {
  const schema = referenceDomains[kind];
  if (!Array.isArray(payload) || payload.length !== 2) return protocolFail('INVALID_ARRAY', 'k334_reference', 'payload');
  const values: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
  for (const [index, field] of [schema.idField, schema.digestField].entries()) {
    const pair = payload[index];
    if (!Array.isArray(pair) || pair.length !== 2 || pair[0] !== field) {
      return protocolFail('NON_CANONICAL_VALUE', 'k334_reference', 'fieldOrder');
    }
    values[field] = pair[1];
  }
  return referenceInput(kind, values);
}

function encodeReferenceValue(kind: ReferenceKind, reference: K334ReferencePair): ProtocolResult<Uint8Array> {
  return buildCanonicalProtocolPreimage(
    referenceDomains[kind].pair,
    K334_CANONICAL_RECORD_VERSION,
    referencePayload(kind, reference),
  );
}

function encodeReference(kind: ReferenceKind, value: unknown): ProtocolResult<Uint8Array> {
  const reference = referenceInput(kind, value);
  return reference.ok ? encodeReferenceValue(kind, reference.value) : reference;
}

function decodeReference(kind: ReferenceKind, value: unknown): ProtocolResult<K334ReferencePair> {
  const payload = decodeFramedPayload(value, referenceDomains[kind].pair);
  return payload.ok ? decodeReferencePayload(kind, payload.value) : payload;
}

export const encodeCandidateReference = (value: unknown): ProtocolResult<Uint8Array> => encodeReference('candidate', value);
export const decodeCandidateReference = (value: unknown): ProtocolResult<K334ReferencePair> => decodeReference('candidate', value);
export const encodeQuarantineBasisReference = (value: unknown): ProtocolResult<Uint8Array> => encodeReference('quarantine_basis', value);
export const decodeQuarantineBasisReference = (value: unknown): ProtocolResult<K334ReferencePair> => decodeReference('quarantine_basis', value);

function createReferenceCollection(kind: ReferenceKind, value: unknown): ProtocolResult<K334ReferenceCollection> {
  try {
    if (!Array.isArray(value) || value.length === 0) return protocolFail('INVALID_ARRAY', 'k334_collection', 'references');
    if (value.length > 128) return protocolFail('RESOURCE_LIMIT_EXCEEDED', 'k334_collection', 'references');
    const encoded: { readonly reference: K334ReferencePair; readonly bytes: Uint8Array }[] = [];
    for (const entry of value) {
      const reference = referenceInput(kind, entry);
      if (!reference.ok) return reference;
      const bytes = encodeReferenceValue(kind, reference.value);
      if (!bytes.ok) return bytes;
      encoded.push(Object.freeze({ reference: reference.value, bytes: bytes.value }));
    }
    encoded.sort((left, right) => compareUnsignedBytes(left.bytes, right.bytes));
    const canonical: typeof encoded = [];
    for (const entry of encoded) {
      const previous = canonical[canonical.length - 1];
      if (previous && previous.reference.recordId === entry.reference.recordId
        && previous.reference.canonicalDigest !== entry.reference.canonicalDigest) {
        return protocolFail('RELATIONSHIP_MISMATCH', 'k334_collection', 'recordId');
      }
      if (!previous || !equalBytes(previous.bytes, entry.bytes)) canonical.push(entry);
    }
    const elements = canonical.map(entry => Object.freeze([
      entry.bytes.byteLength, bytesToHex(entry.bytes),
    ] as const));
    const payload = Object.freeze([
      Object.freeze(['elementCount', canonical.length] as const),
      Object.freeze(['elements', Object.freeze(elements)] as const),
    ]);
    const bytes = buildCanonicalProtocolPreimage(referenceDomains[kind].collection, K334_CANONICAL_RECORD_VERSION, payload);
    return bytes.ok ? protocolOk(Object.freeze({
      kind,
      bytes: bytes.value,
      references: Object.freeze(canonical.map(entry => entry.reference)),
    })) : bytes;
  } catch {
    return protocolFail('INVALID_ARRAY', 'k334_collection', 'references');
  }
}

function decodeReferenceCollection(kind: ReferenceKind, value: unknown): ProtocolResult<K334ReferenceCollection> {
  const payload = decodeFramedPayload(value, referenceDomains[kind].collection);
  if (!payload.ok) return payload;
  if (!Array.isArray(payload.value) || payload.value.length !== 2) {
    return protocolFail('INVALID_ARRAY', 'k334_collection', 'payload');
  }
  const [countPair, elementsPair] = payload.value;
  if (!Array.isArray(countPair) || countPair.length !== 2 || countPair[0] !== 'elementCount'
    || typeof countPair[1] !== 'number' || !Number.isSafeInteger(countPair[1]) || countPair[1] <= 0) {
    return protocolFail('NON_CANONICAL_VALUE', 'k334_collection', 'elementCount');
  }
  if (!Array.isArray(elementsPair) || elementsPair.length !== 2 || elementsPair[0] !== 'elements' || !Array.isArray(elementsPair[1])
    || elementsPair[1].length !== countPair[1]) {
    return protocolFail('NON_CANONICAL_VALUE', 'k334_collection', 'elements');
  }
  const references: K334ReferencePair[] = [];
  for (const element of elementsPair[1]) {
    if (!Array.isArray(element) || element.length !== 2 || typeof element[0] !== 'number'
      || !Number.isSafeInteger(element[0]) || element[0] <= 0) {
      return protocolFail('NON_CANONICAL_VALUE', 'k334_collection', 'element');
    }
    const bytes = hexToBytes(element[1], 'elementHex');
    if (!bytes.ok || bytes.value.byteLength !== element[0]) return protocolFail('NON_CANONICAL_VALUE', 'k334_collection', 'elementLength');
    const reference = decodeReference(kind, bytes.value);
    if (!reference.ok) return reference;
    references.push(reference.value);
  }
  const schema = referenceDomains[kind];
  const rebuilt = createReferenceCollection(kind, references.map(reference => Object.freeze({
    [schema.idField]: reference.recordId,
    [schema.digestField]: reference.canonicalDigest,
  })));
  const copied = copyBytes(value);
  return rebuilt.ok && copied.ok && equalBytes(rebuilt.value.bytes, copied.value)
    ? rebuilt
    : protocolFail('NON_CANONICAL_VALUE', 'k334_collection', 'ordering');
}

export const createCandidateReferenceCollection = (value: unknown): ProtocolResult<K334ReferenceCollection> =>
  createReferenceCollection('candidate', value);
export const decodeCandidateReferenceCollection = (value: unknown): ProtocolResult<K334ReferenceCollection> =>
  decodeReferenceCollection('candidate', value);
export const createQuarantineBasisReferenceCollection = (value: unknown): ProtocolResult<K334ReferenceCollection> =>
  createReferenceCollection('quarantine_basis', value);
export const decodeQuarantineBasisReferenceCollection = (value: unknown): ProtocolResult<K334ReferenceCollection> =>
  decodeReferenceCollection('quarantine_basis', value);
