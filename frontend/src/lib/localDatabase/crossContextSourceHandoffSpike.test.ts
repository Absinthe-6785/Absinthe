import { createHash } from 'node:crypto';
import { types as nodeTypes } from 'node:util';
import { describe, expect, it } from 'vitest';

const AUTHORITY_RECORD_TYPE = 'absinthe_handoff_authority' as const;
const CANDIDATE_RECORD_TYPE = 'absinthe_handoff_snapshot_candidate' as const;
const SCHEMA_VERSION = 1 as const;
const COORDINATOR_VERSION = 1 as const;
const MAX_PERSISTED_JSON_DEPTH = 64;
// K-327G policy ceilings apply to the separate production-shaped IndexedDB
// objects. The legacy source is read under lock; it is not a third persisted
// evidence payload and is never counted again in an authority/candidate budget.
const MAX_AUTHORITY_PAYLOAD_UTF8_BYTES = 4_096;
const MAX_CANDIDATE_PAYLOAD_UTF8_BYTES = 504_000;
const MAX_TRANSACTION_WRITE_UTF8_BYTES = 509_000;
// Deliberately reserved application-controlled transaction headroom for the
// future object-store keys, versioned wrappers, and bounded auxiliary metadata.
// It is counted once and is not an estimate of IndexedDB engine overhead.
const APPLICATION_TRANSACTION_RESERVE_UTF8_BYTES = 3_904;
const MAX_STANDALONE_JSON_TEST_UTF8_BYTES = 1_048_576;
const MAX_SOURCE_RECORD_COUNT = 4096;
const MAX_SOURCE_RECORD_UTF8_BYTES = 131_072;
const MAX_TOTAL_SOURCE_RECORD_UTF8_BYTES = 499_000;
const MAX_SOURCE_RECORD_ID_UTF8_BYTES = 256;
const MAX_SOURCE_RECORD_VALUE_UTF8_BYTES = 20_000;
const MAX_IDENTITY_LENGTH = 256;
const MAX_ORIGIN_LENGTH = 2048;
const MAX_RECORD_VALUE_LENGTH = 1_048_576;
const MAX_SOURCE_REVISION = Number.MAX_SAFE_INTEGER;
const DIGEST = /^[a-f0-9]{64}$/;
const IDENTIFIER = /^[A-Za-z0-9:_-]+$/;
const CANDIDATE_ID = /^candidate-[a-f0-9]{24}$/;
const HANDOFF_SESSION_ID = /^handoff-([a-f0-9]{16})-(0|[1-9][0-9]{0,15})$/;
const SUPPORTED_SOURCE_FAMILIES = ['legacy_notes', 'legacy_notes_fixture_v2'] as const;
const SUPPORTED_BACKENDS = [
  'combined_localstorage_indexeddb',
  'legacy_indexeddb_fixture_v2',
] as const;
const SUPPORTED_PHYSICAL_SOURCE_VERSIONS = [1, 2] as const;

type AuthorityState =
  | 'writable'
  | 'handoff_pending'
  | 'snapshot_committed_pending_finalization'
  | 'read_only_handoff';

interface PhysicalSourceIdentityV1 {
  schemaVersion: 1;
  origin: string;
  sourceFamily: typeof SUPPORTED_SOURCE_FAMILIES[number];
  backend: typeof SUPPORTED_BACKENDS[number];
  databaseName: string;
  objectStoreName: string;
  physicalSourceVersion: typeof SUPPORTED_PHYSICAL_SOURCE_VERSIONS[number];
}

interface LogicalAuthorityScopeV1 {
  schemaVersion: 1;
  userId: string;
  projectRef: string;
  namespaceId: string;
  deviceId: string;
}

interface PersistedHandoffAuthorityV1 {
  recordType: typeof AUTHORITY_RECORD_TYPE;
  schemaVersion: 1;
  coordinatorVersion: 1;
  physicalSourceDigest: string;
  logicalScope: LogicalAuthorityScopeV1;
  logicalScopeDigest: string;
  state: AuthorityState;
  sourceRevision: number;
  handoffSessionId: string | null;
  snapshotCandidateId: string | null;
  snapshotDigest: string | null;
  rootDigest: string | null;
  manifestDigest: string | null;
}

interface PersistedSnapshotCandidateV1 {
  recordType: typeof CANDIDATE_RECORD_TYPE;
  schemaVersion: 1;
  coordinatorVersion: 1;
  candidateId: string;
  handoffSessionId: string;
  physicalSourceDigest: string;
  logicalScopeDigest: string;
  sourceRevision: number;
  snapshotDigest: string;
  rootDigest: string;
  manifestDigest: string;
  entityCount: number;
  records: ReadonlyArray<readonly [string, string]>;
}

interface BoundaryMetrics {
  canonicalizations: number;
  hashes: number;
  lockDerivations: number;
  registryLookups: number;
  authorityReads: number;
  authorityWrites: number;
}

class ProtocolError extends Error {
  constructor(readonly code: string, readonly stage?: RestartFailureStage) {
    super(code);
  }
}

type RestartFailureStage =
  | 'raw_input'
  | 'raw_bounds'
  | 'duplicate_scan'
  | 'artifact_set_schema'
  | 'authority_schema'
  | 'candidate_schema'
  | 'source_schema'
  | 'capture_bounds'
  | 'graph_bounds'
  | 'graph_binding'
  | 'canonical_bytes'
  | 'coordinator'
  | 'finalization_cas';

interface RestartMetrics {
  rawInputRead: number;
  duplicateScanAttempted: number;
  duplicateScanCompleted: number;
  jsonValueConstructed: number;
  artifactSetSchemaValidated: number;
  authorityParserInvoked: number;
  authoritySchemaValidated: number;
  candidateFieldInspected: number;
  candidateParserInvoked: number;
  candidateSchemaValidated: number;
  sourceSchemaValidated: number;
  graphBindingInvoked: number;
  graphBindingValidated: number;
  canonicalEqualityChecked: number;
  coordinatorConstructed: number;
  finalizationAttempted: number;
  persistenceReadAttempted: number;
  persistenceWriteAttempted: number;
  authorityWriteAttempted: number;
  candidateWriteAttempted: number;
  terminalWriteAttempted: number;
  authorityRewriteAttempted: number;
  sourceReadAttempted: number;
  sourceCaptureAttempted: number;
  sourceRecaptureAttempted: number;
  snapshotDigestAttempted: number;
  sourceMutationAttempted: number;
  recordCreateAttempted: number;
  recordDeleteAttempted: number;
  authorityCreateAttempted: number;
  candidateCreateAttempted: number;
  candidateDeleteAttempted: number;
  candidateCreateBoundaryAttempted: number;
  candidateExistingKeyDetected: number;
  candidateCollisionDetected: number;
  candidateFullBindingMismatchDetected: number;
  candidateOverwriteAttempted: number;
}

function restartMetrics(): RestartMetrics {
  return {
    rawInputRead: 0,
    duplicateScanAttempted: 0,
    duplicateScanCompleted: 0,
    jsonValueConstructed: 0,
    artifactSetSchemaValidated: 0,
    authorityParserInvoked: 0,
    authoritySchemaValidated: 0,
    candidateFieldInspected: 0,
    candidateParserInvoked: 0,
    candidateSchemaValidated: 0,
    sourceSchemaValidated: 0,
    graphBindingInvoked: 0,
    graphBindingValidated: 0,
    canonicalEqualityChecked: 0,
    coordinatorConstructed: 0,
    finalizationAttempted: 0,
    persistenceReadAttempted: 0,
    persistenceWriteAttempted: 0,
    authorityWriteAttempted: 0,
    candidateWriteAttempted: 0,
    terminalWriteAttempted: 0,
    authorityRewriteAttempted: 0,
    sourceReadAttempted: 0,
    sourceCaptureAttempted: 0,
    sourceRecaptureAttempted: 0,
    snapshotDigestAttempted: 0,
    sourceMutationAttempted: 0,
    recordCreateAttempted: 0,
    recordDeleteAttempted: 0,
    authorityCreateAttempted: 0,
    candidateCreateAttempted: 0,
    candidateDeleteAttempted: 0,
    candidateCreateBoundaryAttempted: 0,
    candidateExistingKeyDetected: 0,
    candidateCollisionDetected: 0,
    candidateFullBindingMismatchDetected: 0,
    candidateOverwriteAttempted: 0,
  };
}

class Deferred {
  readonly promise: Promise<void>;
  private resolvePromise!: () => void;

  constructor() {
    this.promise = new Promise(resolve => { this.resolvePromise = resolve; });
  }

  resolve(): void {
    this.resolvePromise();
  }
}

function metrics(): BoundaryMetrics {
  return {
    canonicalizations: 0,
    hashes: 0,
    lockDerivations: 0,
    registryLookups: 0,
    authorityReads: 0,
    authorityWrites: 0,
  };
}

function fail(code: string): never {
  throw new ProtocolError(code);
}

function utf8ByteLength(value: string, stopAfter = Number.MAX_SAFE_INTEGER): number {
  let bytes = 0;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code <= 0x7f) {
      bytes += 1;
    } else if (code <= 0x7ff) {
      bytes += 2;
    } else if (code >= 0xd800 && code <= 0xdbff
      && index + 1 < value.length
      && value.charCodeAt(index + 1) >= 0xdc00
      && value.charCodeAt(index + 1) <= 0xdfff) {
      bytes += 4;
      index += 1;
    } else {
      // TextEncoder replaces each unpaired UTF-16 surrogate with U+FFFD (three UTF-8 bytes).
      bytes += 3;
    }
    if (bytes > stopAfter) return bytes;
  }
  return bytes;
}

function requireUtf8Bound(value: string, maximum: number, code: string): void {
  if (utf8ByteLength(value, maximum) > maximum) return fail(code);
}

function strictRecord(
  input: unknown,
  expectedKeys: readonly string[],
  code: string,
): Record<string, unknown> {
  if (typeof input !== 'object' || input === null || Array.isArray(input) || nodeTypes.isProxy(input)) {
    return fail(code);
  }
  let prototype: object | null;
  let descriptors: PropertyDescriptorMap;
  let keys: PropertyKey[];
  try {
    prototype = Object.getPrototypeOf(input);
    descriptors = Object.getOwnPropertyDescriptors(input);
    keys = Reflect.ownKeys(input);
  } catch {
    return fail(code);
  }
  if (prototype !== Object.prototype && prototype !== null) return fail(code);
  if (keys.some(key => typeof key !== 'string')) return fail(code);
  const actual = (keys as string[]).sort();
  const expected = [...expectedKeys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    return fail(code);
  }
  const fresh: Record<string, unknown> = {};
  for (const key of expectedKeys) {
    const descriptor = descriptors[key];
    if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, 'value')
      || descriptor.get !== undefined || descriptor.set !== undefined) {
      return fail(code);
    }
    fresh[key] = descriptor.value;
  }
  return fresh;
}

function strictString(
  value: unknown,
  code: string,
  options: { max?: number; allowEmpty?: boolean; identifier?: boolean } = {},
): string {
  if (typeof value !== 'string') return fail(code);
  const max = options.max ?? MAX_IDENTITY_LENGTH;
  if (value.length > max || (!options.allowEmpty && value.length === 0) || value.trim() !== value
    || (!options.allowEmpty && value.trim().length === 0)
    || (options.identifier && !IDENTIFIER.test(value))) {
    return fail(code);
  }
  return value;
}

function strictSafeInteger(value: unknown, code: string, minimum = 0): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < minimum) return fail(code);
  return value;
}

function strictDigest(value: unknown, code: string): string {
  if (typeof value !== 'string' || !DIGEST.test(value)) return fail(code);
  return value;
}

function strictNullableDigest(value: unknown, code: string): string | null {
  return value === null ? null : strictDigest(value, code);
}

function createCandidateId(snapshotDigestInput: unknown): string {
  const snapshotDigest = strictDigest(snapshotDigestInput, 'CORRUPT_PERSISTED_RECORD');
  return `candidate-${snapshotDigest.slice(0, 24)}`;
}

function strictCandidateId(value: unknown, code: string): string {
  if (typeof value !== 'string' || !CANDIDATE_ID.test(value)) return fail(code);
  return value;
}

function createHandoffSessionId(physicalDigestInput: unknown, revisionInput: unknown): string {
  const physicalDigest = strictDigest(physicalDigestInput, 'CORRUPT_PERSISTED_RECORD');
  const revision = strictSafeInteger(revisionInput, 'CORRUPT_PERSISTED_RECORD');
  return `handoff-${physicalDigest.slice(0, 16)}-${revision.toString(10)}`;
}

function strictHandoffSessionId(value: unknown, code: string): string {
  if (typeof value !== 'string') return fail(code);
  const match = HANDOFF_SESSION_ID.exec(value);
  if (!match) return fail(code);
  const revision = Number(match[2]);
  if (!Number.isSafeInteger(revision) || revision < 0 || revision > MAX_SOURCE_REVISION) {
    return fail(code);
  }
  return value;
}

function strictNullableCandidateId(value: unknown, code: string): string | null {
  return value === null ? null : strictCandidateId(value, code);
}

function strictNullableHandoffSessionId(value: unknown, code: string): string | null {
  return value === null ? null : strictHandoffSessionId(value, code);
}

function strictEnum<T extends string | number>(value: unknown, allowed: readonly T[], code: string): T {
  if (!allowed.includes(value as T)) return fail(code);
  return value as T;
}

function strictCanonicalOrigin(value: unknown): string {
  const origin = strictString(value, 'MALFORMED_PHYSICAL_SOURCE_IDENTITY', { max: MAX_ORIGIN_LENGTH });
  let parsed: URL;
  try {
    parsed = new URL(origin);
  } catch {
    return fail('MALFORMED_PHYSICAL_SOURCE_IDENTITY');
  }
  if ((parsed.protocol !== 'https:' && parsed.protocol !== 'http:')
    || parsed.origin === 'null'
    || parsed.origin !== origin
    || parsed.username !== ''
    || parsed.password !== ''
    || parsed.pathname !== '/'
    || parsed.search !== ''
    || parsed.hash !== '') {
    return fail('MALFORMED_PHYSICAL_SOURCE_IDENTITY');
  }
  return origin;
}

function parsePhysicalSourceIdentity(input: unknown): Readonly<PhysicalSourceIdentityV1> {
  const record = strictRecord(input, [
    'schemaVersion', 'origin', 'sourceFamily', 'backend', 'databaseName', 'objectStoreName',
    'physicalSourceVersion',
  ], 'MALFORMED_PHYSICAL_SOURCE_IDENTITY');
  if (record.schemaVersion !== SCHEMA_VERSION) return fail('UNSUPPORTED_PHYSICAL_IDENTITY_VERSION');
  const value: PhysicalSourceIdentityV1 = {
    schemaVersion: SCHEMA_VERSION,
    origin: strictCanonicalOrigin(record.origin),
    sourceFamily: strictEnum(
      record.sourceFamily,
      SUPPORTED_SOURCE_FAMILIES,
      'MALFORMED_PHYSICAL_SOURCE_IDENTITY',
    ),
    backend: strictEnum(record.backend, SUPPORTED_BACKENDS, 'MALFORMED_PHYSICAL_SOURCE_IDENTITY'),
    databaseName: strictString(record.databaseName, 'MALFORMED_PHYSICAL_SOURCE_IDENTITY'),
    objectStoreName: strictString(record.objectStoreName, 'MALFORMED_PHYSICAL_SOURCE_IDENTITY'),
    physicalSourceVersion: strictEnum(
      record.physicalSourceVersion,
      SUPPORTED_PHYSICAL_SOURCE_VERSIONS,
      'UNSUPPORTED_PHYSICAL_SOURCE_VERSION',
    ),
  };
  return Object.freeze(value);
}

function parseLogicalScope(
  input: unknown,
  code = 'MALFORMED_LOGICAL_SCOPE',
): Readonly<LogicalAuthorityScopeV1> {
  const record = strictRecord(input, [
    'schemaVersion', 'userId', 'projectRef', 'namespaceId', 'deviceId',
  ], code);
  if (record.schemaVersion !== SCHEMA_VERSION) return fail(code);
  return Object.freeze({
    schemaVersion: SCHEMA_VERSION,
    userId: strictString(record.userId, code),
    projectRef: strictString(record.projectRef, code),
    namespaceId: strictString(record.namespaceId, code),
    deviceId: strictString(record.deviceId, code),
  });
}

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function canonicalValidatedPhysical(identity: PhysicalSourceIdentityV1): string {
  return JSON.stringify([
    'absinthe_legacy_physical_source_v1',
    identity.schemaVersion,
    identity.origin,
    identity.sourceFamily,
    identity.backend,
    identity.databaseName,
    identity.objectStoreName,
    identity.physicalSourceVersion,
  ]);
}

function canonicalPhysicalSource(input: unknown, evidence?: BoundaryMetrics): string {
  const identity = parsePhysicalSourceIdentity(input);
  evidence && (evidence.canonicalizations += 1);
  return canonicalValidatedPhysical(identity);
}

function physicalSourceDigest(input: unknown, evidence?: BoundaryMetrics): string {
  const canonical = canonicalPhysicalSource(input, evidence);
  evidence && (evidence.hashes += 1);
  return sha256(canonical);
}

function derivePhysicalLockName(input: unknown, evidence?: BoundaryMetrics): string {
  const digest = physicalSourceDigest(input, evidence);
  evidence && (evidence.lockDerivations += 1);
  return `absinthe:legacy-source-handoff:v1:${digest}`;
}

function logicalScopeDigest(input: unknown): string {
  const scope = parseLogicalScope(input);
  return sha256(JSON.stringify([
    'absinthe_legacy_logical_authority_v1',
    scope.schemaVersion,
    scope.userId,
    scope.projectRef,
    scope.namespaceId,
    scope.deviceId,
  ]));
}

function parseRecords(input: unknown, code: string): ReadonlyArray<readonly [string, string]> {
  const strictArray = (
    value: unknown,
    expectedLength: number | null,
    maximumLength: number | null = null,
  ): unknown[] => {
    if (!Array.isArray(value) || nodeTypes.isProxy(value)
      || Object.getPrototypeOf(value) !== Array.prototype
      || (expectedLength !== null && value.length !== expectedLength)
      || (maximumLength !== null && value.length > maximumLength)) {
      return fail(code);
    }
    let descriptors: PropertyDescriptorMap;
    let keys: PropertyKey[];
    try {
      descriptors = Object.getOwnPropertyDescriptors(value);
      keys = Reflect.ownKeys(value);
    } catch {
      return fail(code);
    }
    const expectedKeys = [...Array(value.length).keys()].map(String).concat('length');
    if (keys.some(key => typeof key !== 'string')) return fail(code);
    const sortedActualKeys = [...keys as string[]].sort();
    const sortedExpectedKeys = [...expectedKeys].sort();
    if (keys.length !== expectedKeys.length
      || sortedActualKeys.some((key, index) => key !== sortedExpectedKeys[index])) {
      return fail(code);
    }
    return Array.from({ length: value.length }, (_, index) => {
      const descriptor = descriptors[String(index)];
      if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, 'value')
        || descriptor.get !== undefined || descriptor.set !== undefined) {
        return fail(code);
      }
      return descriptor.value;
    });
  };
  if (Array.isArray(input) && !nodeTypes.isProxy(input) && input.length > MAX_SOURCE_RECORD_COUNT) {
    return fail('PERSISTED_SOURCE_RECORD_COUNT_EXCEEDED');
  }
  const inputRecords = strictArray(input, null, MAX_SOURCE_RECORD_COUNT);
  const records: Array<readonly [string, string]> = [];
  const seen = new Set<string>();
  let totalBytes = 0;
  for (const entry of inputRecords) {
    const pair = strictArray(entry, 2);
    const id = strictString(pair[0], code, { max: MAX_RECORD_VALUE_LENGTH });
    const value = strictString(pair[1], code, { allowEmpty: true, max: MAX_RECORD_VALUE_LENGTH });
    // Decoded bounds protect string processing. The canonical tuple is the
    // final persisted-byte authority and aggregate accounting follows it.
    requireUtf8Bound(id, MAX_SOURCE_RECORD_ID_UTF8_BYTES, 'PERSISTED_SOURCE_RECORD_TOO_LARGE');
    requireUtf8Bound(value, MAX_SOURCE_RECORD_VALUE_UTF8_BYTES, 'PERSISTED_SOURCE_RECORD_TOO_LARGE');
    const recordBytes = utf8ByteLength(JSON.stringify([id, value]));
    if (recordBytes > MAX_SOURCE_RECORD_UTF8_BYTES) return fail('PERSISTED_SOURCE_RECORD_TOO_LARGE');
    totalBytes += recordBytes;
    if (!Number.isSafeInteger(totalBytes) || totalBytes > MAX_TOTAL_SOURCE_RECORD_UTF8_BYTES) {
      return fail('PERSISTED_SOURCE_RECORDS_TOO_LARGE');
    }
    if (seen.has(id)) return fail(code);
    seen.add(id);
    records.push(Object.freeze([id, value] as const));
  }
  const sorted = [...records].sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0);
  if (records.some((entry, index) => entry[0] !== sorted[index]?.[0])) return fail(code);
  return Object.freeze(records);
}

function canonicalRecords(records: ReadonlyArray<readonly [string, string]>): string {
  return JSON.stringify(['absinthe_handoff_snapshot_records_v1', records]);
}

function computeSnapshotDigest(records: ReadonlyArray<readonly [string, string]>): string {
  return sha256(canonicalRecords(records));
}

function computeRootDigest(
  physicalDigest: string,
  scopeDigest: string,
  revision: number,
  snapshotDigest: string,
): string {
  return sha256(JSON.stringify([
    'absinthe_handoff_root_v1', physicalDigest, scopeDigest, revision, snapshotDigest,
  ]));
}

function computeManifestDigest(
  candidateId: string,
  sessionId: string,
  entityCount: number,
  rootDigest: string,
): string {
  return sha256(JSON.stringify([
    'absinthe_handoff_manifest_v1', candidateId, sessionId, entityCount, rootDigest,
  ]));
}

const AUTHORITY_KEYS = [
  'recordType', 'schemaVersion', 'coordinatorVersion', 'physicalSourceDigest', 'logicalScope',
  'logicalScopeDigest', 'state', 'sourceRevision', 'handoffSessionId', 'snapshotCandidateId',
  'snapshotDigest', 'rootDigest', 'manifestDigest',
] as const;

function parsePersistedAuthority(input: unknown): Readonly<PersistedHandoffAuthorityV1> {
  const code = 'CORRUPT_PERSISTED_RECORD';
  const record = strictRecord(input, AUTHORITY_KEYS, code);
  if (record.recordType !== AUTHORITY_RECORD_TYPE) return fail(code);
  if (record.schemaVersion !== SCHEMA_VERSION || record.coordinatorVersion !== COORDINATOR_VERSION) {
    return fail('UNSUPPORTED_PERSISTED_VERSION');
  }
  const logicalScope = parseLogicalScope(record.logicalScope, code);
  const scopeDigest = strictDigest(record.logicalScopeDigest, code);
  if (logicalScopeDigest(logicalScope) !== scopeDigest) return fail(code);
  const state = strictEnum(record.state, [
    'writable', 'handoff_pending', 'snapshot_committed_pending_finalization', 'read_only_handoff',
  ] as const, code);
  const authority: PersistedHandoffAuthorityV1 = {
    recordType: AUTHORITY_RECORD_TYPE,
    schemaVersion: SCHEMA_VERSION,
    coordinatorVersion: COORDINATOR_VERSION,
    physicalSourceDigest: strictDigest(record.physicalSourceDigest, code),
    logicalScope,
    logicalScopeDigest: scopeDigest,
    state,
    sourceRevision: strictSafeInteger(record.sourceRevision, code),
    handoffSessionId: strictNullableHandoffSessionId(record.handoffSessionId, code),
    snapshotCandidateId: strictNullableCandidateId(record.snapshotCandidateId, code),
    snapshotDigest: strictNullableDigest(record.snapshotDigest, code),
    rootDigest: strictNullableDigest(record.rootDigest, code),
    manifestDigest: strictNullableDigest(record.manifestDigest, code),
  };
  const none = authority.snapshotCandidateId === null && authority.snapshotDigest === null
    && authority.rootDigest === null && authority.manifestDigest === null;
  const all = authority.snapshotCandidateId !== null && authority.snapshotDigest !== null
    && authority.rootDigest !== null && authority.manifestDigest !== null;
  if (state === 'writable' && (authority.handoffSessionId !== null || !none)) return fail(code);
  if (state === 'handoff_pending' && (authority.handoffSessionId === null || !none)) return fail(code);
  if ((state === 'snapshot_committed_pending_finalization' || state === 'read_only_handoff')
    && (authority.handoffSessionId === null || !all)) return fail(code);
  if (authority.handoffSessionId !== null
    && authority.handoffSessionId !== createHandoffSessionId(
      authority.physicalSourceDigest,
      authority.sourceRevision,
    )) return fail(code);
  if (authority.snapshotCandidateId !== null && authority.snapshotDigest !== null
    && authority.snapshotCandidateId !== createCandidateId(authority.snapshotDigest)) return fail(code);
  requireUtf8Bound(
    JSON.stringify(authority),
    MAX_AUTHORITY_PAYLOAD_UTF8_BYTES,
    'PERSISTED_AUTHORITY_TOO_LARGE',
  );
  return Object.freeze(authority);
}

const CANDIDATE_KEYS = [
  'recordType', 'schemaVersion', 'coordinatorVersion', 'candidateId', 'handoffSessionId',
  'physicalSourceDigest', 'logicalScopeDigest', 'sourceRevision', 'snapshotDigest', 'rootDigest',
  'manifestDigest', 'entityCount', 'records',
] as const;

function parsePersistedCandidate(input: unknown): Readonly<PersistedSnapshotCandidateV1> {
  const code = 'CORRUPT_PERSISTED_RECORD';
  const record = strictRecord(input, CANDIDATE_KEYS, code);
  if (record.recordType !== CANDIDATE_RECORD_TYPE) return fail(code);
  if (record.schemaVersion !== SCHEMA_VERSION || record.coordinatorVersion !== COORDINATOR_VERSION) {
    return fail('UNSUPPORTED_PERSISTED_VERSION');
  }
  const records = parseRecords(record.records, code);
  const candidate: PersistedSnapshotCandidateV1 = {
    recordType: CANDIDATE_RECORD_TYPE,
    schemaVersion: SCHEMA_VERSION,
    coordinatorVersion: COORDINATOR_VERSION,
    candidateId: strictCandidateId(record.candidateId, code),
    handoffSessionId: strictHandoffSessionId(record.handoffSessionId, code),
    physicalSourceDigest: strictDigest(record.physicalSourceDigest, code),
    logicalScopeDigest: strictDigest(record.logicalScopeDigest, code),
    sourceRevision: strictSafeInteger(record.sourceRevision, code),
    snapshotDigest: strictDigest(record.snapshotDigest, code),
    rootDigest: strictDigest(record.rootDigest, code),
    manifestDigest: strictDigest(record.manifestDigest, code),
    entityCount: strictSafeInteger(record.entityCount, code),
    records,
  };
  if (candidate.entityCount !== candidate.records.length) return fail(code);
  if (candidate.candidateId !== createCandidateId(candidate.snapshotDigest)
    || candidate.handoffSessionId !== createHandoffSessionId(
      candidate.physicalSourceDigest,
      candidate.sourceRevision,
    )) return fail(code);
  requireUtf8Bound(
    JSON.stringify(candidate),
    MAX_CANDIDATE_PAYLOAD_UTF8_BYTES,
    'PERSISTED_CANDIDATE_TOO_LARGE',
  );
  return Object.freeze(candidate);
}

function serializeAuthority(authority: unknown): string {
  return JSON.stringify(parsePersistedAuthority(authority));
}

function serializeCandidate(candidate: unknown): string {
  return JSON.stringify(parsePersistedCandidate(candidate));
}

/** Duplicate-aware JSON reader. Object keys are compared after JSON escape decoding. */
class StrictJsonReader {
  private offset = 0;
  private previousNumberEnd = -1;
  readonly topLevelRawValues = new Map<string, string>();
  numberTokenCount = 0;
  numberSuffixSliceCount = 0;
  numberOffsetsMonotonic = true;

  constructor(private readonly bytes: string) {}

  read(): unknown {
    const value = this.value(0);
    this.whitespace();
    if (this.offset !== this.bytes.length) return fail('CORRUPT_PERSISTED_RECORD');
    return value;
  }

  private value(depth: number): unknown {
    this.whitespace();
    const token = this.bytes[this.offset];
    if (token === '{' || token === '[') {
      const nextDepth = depth + 1;
      if (nextDepth > MAX_PERSISTED_JSON_DEPTH) return fail('PERSISTED_JSON_DEPTH_EXCEEDED');
      return token === '{' ? this.object(nextDepth) : this.array(nextDepth);
    }
    if (token === '"') return this.string();
    if (this.bytes.startsWith('true', this.offset)) { this.offset += 4; return true; }
    if (this.bytes.startsWith('false', this.offset)) { this.offset += 5; return false; }
    if (this.bytes.startsWith('null', this.offset)) { this.offset += 4; return null; }
    return this.number();
  }

  private object(depth: number): Record<string, unknown> {
    this.offset += 1;
    const output: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
    const keys = new Set<string>();
    this.whitespace();
    if (this.bytes[this.offset] === '}') { this.offset += 1; return output; }
    while (true) {
      this.whitespace();
      if (this.bytes[this.offset] !== '"') return fail('CORRUPT_PERSISTED_RECORD');
      const key = this.string();
      if (keys.has(key)) return fail('DUPLICATE_PERSISTED_JSON_KEY');
      keys.add(key);
      this.whitespace();
      if (this.bytes[this.offset] !== ':') return fail('CORRUPT_PERSISTED_RECORD');
      this.offset += 1;
      this.whitespace();
      const rawValueStart = this.offset;
      const propertyValue = this.value(depth);
      Object.defineProperty(output, key, {
        value: propertyValue, enumerable: true, configurable: true, writable: true,
      });
      if (depth === 1) this.topLevelRawValues.set(key, this.bytes.slice(rawValueStart, this.offset));
      this.whitespace();
      const separator = this.bytes[this.offset];
      if (separator === '}') { this.offset += 1; return output; }
      if (separator !== ',') return fail('CORRUPT_PERSISTED_RECORD');
      this.offset += 1;
    }
  }

  private array(depth: number): unknown[] {
    this.offset += 1;
    const output: unknown[] = [];
    this.whitespace();
    if (this.bytes[this.offset] === ']') { this.offset += 1; return output; }
    while (true) {
      output.push(this.value(depth));
      this.whitespace();
      const separator = this.bytes[this.offset];
      if (separator === ']') { this.offset += 1; return output; }
      if (separator !== ',') return fail('CORRUPT_PERSISTED_RECORD');
      this.offset += 1;
    }
  }

  private string(): string {
    const start = this.offset;
    this.offset += 1;
    let escaped = false;
    while (this.offset < this.bytes.length) {
      const character = this.bytes[this.offset];
      this.offset += 1;
      if (escaped) { escaped = false; continue; }
      if (character === '\\') { escaped = true; continue; }
      if (character === '"') {
        try {
          const decoded = JSON.parse(this.bytes.slice(start, this.offset)) as unknown;
          if (typeof decoded !== 'string') return fail('CORRUPT_PERSISTED_RECORD');
          return decoded;
        } catch {
          return fail('CORRUPT_PERSISTED_RECORD');
        }
      }
      if (character !== undefined && character.charCodeAt(0) < 0x20) {
        return fail('CORRUPT_PERSISTED_RECORD');
      }
    }
    return fail('CORRUPT_PERSISTED_RECORD');
  }

  private number(): number {
    const start = this.offset;
    if (this.bytes[this.offset] === '-') this.offset += 1;
    if (this.bytes[this.offset] === '0') {
      this.offset += 1;
    } else {
      const first = this.bytes.charCodeAt(this.offset);
      if (!(first >= 0x31 && first <= 0x39)) return fail('CORRUPT_PERSISTED_RECORD');
      this.offset += 1;
      while (true) {
        const digit = this.bytes.charCodeAt(this.offset);
        if (!(digit >= 0x30 && digit <= 0x39)) break;
        this.offset += 1;
      }
    }
    if (this.bytes[this.offset] === '.') {
      this.offset += 1;
      const firstFraction = this.bytes.charCodeAt(this.offset);
      if (!(firstFraction >= 0x30 && firstFraction <= 0x39)) return fail('CORRUPT_PERSISTED_RECORD');
      while (true) {
        const digit = this.bytes.charCodeAt(this.offset);
        if (!(digit >= 0x30 && digit <= 0x39)) break;
        this.offset += 1;
      }
    }
    if (this.bytes[this.offset] === 'e' || this.bytes[this.offset] === 'E') {
      this.offset += 1;
      if (this.bytes[this.offset] === '+' || this.bytes[this.offset] === '-') this.offset += 1;
      const firstExponent = this.bytes.charCodeAt(this.offset);
      if (!(firstExponent >= 0x30 && firstExponent <= 0x39)) return fail('CORRUPT_PERSISTED_RECORD');
      while (true) {
        const digit = this.bytes.charCodeAt(this.offset);
        if (!(digit >= 0x30 && digit <= 0x39)) break;
        this.offset += 1;
      }
    }
    this.numberOffsetsMonotonic &&= start >= this.previousNumberEnd && this.offset > start;
    this.previousNumberEnd = this.offset;
    this.numberTokenCount += 1;
    // One bounded token slice is allowed only after monotonic scanning locates
    // both ends. No remaining-input suffix is ever copied.
    const token = this.bytes.slice(start, this.offset);
    const value = Number(token);
    if (!Number.isFinite(value)) return fail('CORRUPT_PERSISTED_RECORD');
    return value;
  }

  private whitespace(): void {
    while (true) {
      const character = this.bytes[this.offset];
      if (character !== ' ' && character !== '\t' && character !== '\n' && character !== '\r') return;
      this.offset += 1;
    }
  }
}

function parseJsonUnknown(
  bytes: string,
  maximum = MAX_STANDALONE_JSON_TEST_UTF8_BYTES,
  oversizeCode = 'PERSISTED_PAYLOAD_TOO_LARGE',
): unknown {
  if (typeof bytes !== 'string' || bytes.length === 0) return fail('CORRUPT_PERSISTED_RECORD');
  requireUtf8Bound(bytes, maximum, oversizeCode);
  return new StrictJsonReader(bytes).read();
}

function parseCanonicalAuthorityBytes(bytes: string): Readonly<PersistedHandoffAuthorityV1> {
  const authority = parsePersistedAuthority(parseJsonUnknown(
    bytes,
    MAX_AUTHORITY_PAYLOAD_UTF8_BYTES,
    'PERSISTED_AUTHORITY_TOO_LARGE',
  ));
  if (serializeAuthority(authority) !== bytes) return fail('NONCANONICAL_PERSISTED_BYTES');
  return authority;
}

function parseCanonicalCandidateBytes(bytes: string): Readonly<PersistedSnapshotCandidateV1> {
  const candidate = parsePersistedCandidate(parseJsonUnknown(
    bytes,
    MAX_CANDIDATE_PAYLOAD_UTF8_BYTES,
    'PERSISTED_CANDIDATE_TOO_LARGE',
  ));
  if (serializeCandidate(candidate) !== bytes) return fail('NONCANONICAL_PERSISTED_BYTES');
  return candidate;
}

function exactCandidateBinding(
  authority: Readonly<PersistedHandoffAuthorityV1>,
  candidate: Readonly<PersistedSnapshotCandidateV1>,
): void {
  if ((authority.state !== 'snapshot_committed_pending_finalization'
      && authority.state !== 'read_only_handoff')
    || authority.physicalSourceDigest !== candidate.physicalSourceDigest
    || authority.logicalScopeDigest !== candidate.logicalScopeDigest
    || authority.handoffSessionId !== candidate.handoffSessionId
    || authority.snapshotCandidateId !== candidate.candidateId
    || authority.sourceRevision !== candidate.sourceRevision
    || authority.snapshotDigest !== candidate.snapshotDigest
    || authority.rootDigest !== candidate.rootDigest
    || authority.manifestDigest !== candidate.manifestDigest
    || authority.coordinatorVersion !== candidate.coordinatorVersion
    || computeSnapshotDigest(candidate.records) !== candidate.snapshotDigest
    || computeRootDigest(
      candidate.physicalSourceDigest,
      candidate.logicalScopeDigest,
      candidate.sourceRevision,
      candidate.snapshotDigest,
    ) !== candidate.rootDigest
    || computeManifestDigest(
      candidate.candidateId,
      candidate.handoffSessionId,
      candidate.entityCount,
      candidate.rootDigest,
    ) !== candidate.manifestDigest) {
    return fail('PERSISTED_EVIDENCE_MISMATCH');
  }
}

/** Deterministic stand-in for one same-origin, same-name exclusive Web Lock queue. */
class ExclusiveLockQueue {
  private tail: Promise<void> = Promise.resolve();

  run<T>(work: () => Promise<T>): Promise<T> {
    const predecessor = this.tail;
    let release!: () => void;
    this.tail = new Promise<void>(resolve => { release = resolve; });
    return predecessor.then(work).finally(release);
  }
}

/** Test-only LockManager analogue. Actors supply derived names, never queue instances. */
class NamedLockRegistry {
  private readonly queues = new Map<string, ExclusiveLockQueue>();

  constructor(private readonly evidence: BoundaryMetrics) {}

  run<T>(lockName: string, work: () => Promise<T>): Promise<T> {
    this.evidence.registryLookups += 1;
    let queue = this.queues.get(lockName);
    if (!queue) {
      queue = new ExclusiveLockQueue();
      this.queues.set(lockName, queue);
    }
    return queue.run(work);
  }

  get size(): number {
    return this.queues.size;
  }
}

interface PersistedArtifactSetV1 {
  physicalSourceDigest: string;
  authorityBytes: string;
  candidateEntries: ReadonlyArray<readonly [string, string]>;
  legacySourceRecords: ReadonlyArray<readonly [string, string]>;
}

interface DurableSlot {
  authorityBytes: string;
  candidateBytesById: Map<string, string>;
  source: Map<string, string>;
}

interface DurableEvidenceObservation {
  authorityBytes: string | null;
  candidateEntriesBytes: string;
  authorityRecordCount: number;
  candidateRecordCount: number;
  sourceRecordCount: number;
  authorityState: AuthorityState | null;
}

class DurablePhysicalSourceRegistry {
  private readonly slots = new Map<string, DurableSlot>();

  constructor(
    private readonly evidence: BoundaryMetrics,
    private readonly observed?: RestartMetrics,
    private readonly rehydrated = false,
  ) {}

  private observe(counter: keyof RestartMetrics): void {
    if (this.observed) this.observed[counter] += 1;
  }

  initialize(identityInput: unknown, scopeInput: unknown): void {
    const identity = parsePhysicalSourceIdentity(identityInput);
    const scope = parseLogicalScope(scopeInput);
    const digest = sha256(canonicalValidatedPhysical(identity));
    if (this.slots.has(digest)) return fail('AUTHORITY_ALREADY_EXISTS');
    const authority: PersistedHandoffAuthorityV1 = {
      recordType: AUTHORITY_RECORD_TYPE,
      schemaVersion: SCHEMA_VERSION,
      coordinatorVersion: COORDINATOR_VERSION,
      physicalSourceDigest: digest,
      logicalScope: scope,
      logicalScopeDigest: logicalScopeDigest(scope),
      state: 'writable',
      sourceRevision: 0,
      handoffSessionId: null,
      snapshotCandidateId: null,
      snapshotDigest: null,
      rootDigest: null,
      manifestDigest: null,
    };
    this.observe('persistenceWriteAttempted');
    this.observe('authorityWriteAttempted');
    this.observe('recordCreateAttempted');
    this.observe('authorityCreateAttempted');
    this.slots.set(digest, {
      authorityBytes: serializeAuthority(authority),
      candidateBytesById: new Map(),
      source: new Map(),
    });
    this.evidence.authorityWrites += 1;
  }

  private slot(digest: string): DurableSlot {
    const slot = this.slots.get(digest);
    if (!slot) return fail('AUTHORITY_NOT_FOUND');
    return slot;
  }

  readAuthority(digest: string): Readonly<PersistedHandoffAuthorityV1> {
    this.observe('persistenceReadAttempted');
    this.evidence.authorityReads += 1;
    return parseCanonicalAuthorityBytes(this.slot(digest).authorityBytes);
  }

  readCandidate(digest: string): Readonly<PersistedSnapshotCandidateV1> | null {
    this.observe('persistenceReadAttempted');
    const slot = this.slot(digest);
    const authority = parseCanonicalAuthorityBytes(slot.authorityBytes);
    if (authority.snapshotCandidateId === null) return null;
    const bytes = slot.candidateBytesById.get(authority.snapshotCandidateId);
    return bytes === undefined ? null : parseCanonicalCandidateBytes(bytes);
  }

  sourceRecords(digest: string): ReadonlyArray<readonly [string, string]> {
    this.observe('persistenceReadAttempted');
    this.observe('sourceReadAttempted');
    return Object.freeze([...this.slot(digest).source.entries()]
      .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
      .map(entry => Object.freeze([entry[0], entry[1]] as const)));
  }

  compareAndSetAuthority(
    digest: string,
    expected: Readonly<PersistedHandoffAuthorityV1>,
    next: Readonly<PersistedHandoffAuthorityV1>,
  ): void {
    const slot = this.slot(digest);
    const current = parseCanonicalAuthorityBytes(slot.authorityBytes);
    if (serializeAuthority(current) !== serializeAuthority(expected)) return fail('AUTHORITY_CAS_MISMATCH');
    this.observe('persistenceWriteAttempted');
    this.observe('authorityWriteAttempted');
    slot.authorityBytes = serializeAuthority(next);
    this.evidence.authorityWrites += 1;
  }

  commitWrite(
    digest: string,
    expected: Readonly<PersistedHandoffAuthorityV1>,
    next: Readonly<PersistedHandoffAuthorityV1>,
    id: string,
    value: string,
  ): void {
    const slot = this.slot(digest);
    const current = parseCanonicalAuthorityBytes(slot.authorityBytes);
    if (serializeAuthority(current) !== serializeAuthority(expected) || slot.candidateBytesById.size !== 0) {
      return fail('AUTHORITY_CAS_MISMATCH');
    }
    const source = new Map(slot.source);
    source.set(id, value);
    this.observe('persistenceWriteAttempted');
    this.observe('authorityWriteAttempted');
    this.observe('sourceMutationAttempted');
    slot.source = source;
    slot.authorityBytes = serializeAuthority(next);
    this.evidence.authorityWrites += 1;
  }

  commitCandidate(
    digest: string,
    expected: Readonly<PersistedHandoffAuthorityV1>,
    next: Readonly<PersistedHandoffAuthorityV1>,
    candidate: Readonly<PersistedSnapshotCandidateV1>,
  ): 'created' | 'existing_identical' {
    return this.commitCandidateAtStoreBoundary(
      digest,
      expected,
      next,
      candidate,
      candidate.candidateId,
    );
  }

  /** Test-only collision injection at the same candidate-store create boundary. */
  probeCandidateCreateAtStoreKey(
    digest: string,
    expected: Readonly<PersistedHandoffAuthorityV1>,
    next: Readonly<PersistedHandoffAuthorityV1>,
    candidate: Readonly<PersistedSnapshotCandidateV1>,
    storeKey: string,
  ): 'created' | 'existing_identical' {
    return this.commitCandidateAtStoreBoundary(digest, expected, next, candidate, storeKey);
  }

  private commitCandidateAtStoreBoundary(
    digest: string,
    expected: Readonly<PersistedHandoffAuthorityV1>,
    next: Readonly<PersistedHandoffAuthorityV1>,
    candidate: Readonly<PersistedSnapshotCandidateV1>,
    storeKey: string,
  ): 'created' | 'existing_identical' {
    const slot = this.slot(digest);
    const current = parseCanonicalAuthorityBytes(slot.authorityBytes);
    if (serializeAuthority(current) !== serializeAuthority(expected)) {
      return fail('AUTHORITY_CAS_MISMATCH');
    }
    exactCandidateBinding(next, candidate);
    const candidateBytes = serializeCandidate(candidate);
    const authorityBytes = serializeAuthority(next);
    if (utf8ByteLength(authorityBytes) + utf8ByteLength(candidateBytes)
      + APPLICATION_TRANSACTION_RESERVE_UTF8_BYTES > MAX_TRANSACTION_WRITE_UTF8_BYTES) {
      return fail('PERSISTED_TRANSACTION_TOO_LARGE');
    }
    requireUtf8Bound(candidateBytes, MAX_CANDIDATE_PAYLOAD_UTF8_BYTES, 'PERSISTED_CANDIDATE_TOO_LARGE');
    this.observe('candidateCreateBoundaryAttempted');
    const existingBytes = slot.candidateBytesById.get(storeKey);
    if (existingBytes !== undefined) {
      this.observe('candidateExistingKeyDetected');
      const existingCandidate = parseCanonicalCandidateBytes(existingBytes);
      exactCandidateBinding(current, existingCandidate);
      if (storeKey === candidate.candidateId
        && existingBytes === candidateBytes
        && authorityBytes === slot.authorityBytes) {
        return 'existing_identical';
      }
      this.observe('candidateCollisionDetected');
      if (storeKey !== candidate.candidateId
        || existingCandidate.snapshotDigest !== candidate.snapshotDigest
        || existingCandidate.rootDigest !== candidate.rootDigest
        || existingCandidate.manifestDigest !== candidate.manifestDigest
        || existingBytes !== candidateBytes
        || authorityBytes !== slot.authorityBytes) {
        this.observe('candidateFullBindingMismatchDetected');
      }
      return fail('CANDIDATE_KEY_COLLISION');
    }
    if (slot.candidateBytesById.size !== 0 || storeKey !== candidate.candidateId) {
      return fail('PERSISTED_EVIDENCE_MISMATCH');
    }
    this.observe('persistenceWriteAttempted');
    this.observe('authorityWriteAttempted');
    this.observe('candidateWriteAttempted');
    this.observe('recordCreateAttempted');
    this.observe('candidateCreateAttempted');
    slot.candidateBytesById.set(candidate.candidateId, candidateBytes);
    slot.authorityBytes = authorityBytes;
    this.evidence.authorityWrites += 1;
    return 'created';
  }

  finalizeCandidate(
    digest: string,
    expected: Readonly<PersistedHandoffAuthorityV1>,
    candidate: Readonly<PersistedSnapshotCandidateV1>,
  ): void {
    const slot = this.slot(digest);
    const current = parseCanonicalAuthorityBytes(slot.authorityBytes);
    const currentCandidateBytes = expected.snapshotCandidateId === null
      ? undefined
      : slot.candidateBytesById.get(expected.snapshotCandidateId);
    const currentCandidate = currentCandidateBytes === undefined
      ? null
      : parseCanonicalCandidateBytes(currentCandidateBytes);
    if (!currentCandidate
      || serializeAuthority(current) !== serializeAuthority(expected)
      || serializeCandidate(currentCandidate) !== serializeCandidate(candidate)) {
      return fail('AUTHORITY_CAS_MISMATCH');
    }
    exactCandidateBinding(current, currentCandidate);
    const terminal = parsePersistedAuthority({ ...current, state: 'read_only_handoff' });
    this.observe('persistenceWriteAttempted');
    this.observe('authorityWriteAttempted');
    this.observe('terminalWriteAttempted');
    slot.authorityBytes = serializeAuthority(terminal);
    this.evidence.authorityWrites += 1;
  }

  exportArtifacts(identityInput: unknown): Readonly<PersistedArtifactSetV1> {
    const digest = physicalSourceDigest(identityInput);
    const slot = this.slot(digest);
    const candidateEntries = Object.freeze([...slot.candidateBytesById.entries()]
      .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
      .map(entry => Object.freeze([`${entry[0]}`, `${entry[1]}`] as const)));
    const legacySourceRecords = Object.freeze([...slot.source.entries()]
      .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
      .map(entry => Object.freeze([`${entry[0]}`, `${entry[1]}`] as const)));
    return Object.freeze({
      physicalSourceDigest: digest,
      authorityBytes: `${slot.authorityBytes}`,
      candidateEntries,
      legacySourceRecords,
    });
  }

  captureSourceRecords(digest: string): ReadonlyArray<readonly [string, string]> {
    this.observe('sourceCaptureAttempted');
    if (this.rehydrated) this.observe('sourceRecaptureAttempted');
    return this.sourceRecords(digest);
  }

  rewriteAuthority(identityInput: unknown, bytes: string): void {
    const digest = physicalSourceDigest(identityInput);
    const replacement = parseCanonicalAuthorityBytes(bytes);
    if (replacement.physicalSourceDigest !== digest) return fail('PERSISTED_EVIDENCE_MISMATCH');
    this.observe('persistenceWriteAttempted');
    this.observe('authorityWriteAttempted');
    this.observe('authorityRewriteAttempted');
    this.slot(digest).authorityBytes = `${bytes}`;
  }

  deleteCandidate(identityInput: unknown): boolean {
    const slot = this.slot(physicalSourceDigest(identityInput));
    const authority = parseCanonicalAuthorityBytes(slot.authorityBytes);
    const candidateId = authority.snapshotCandidateId ?? [...slot.candidateBytesById.keys()][0];
    if (candidateId === undefined || !slot.candidateBytesById.has(candidateId)) return false;
    this.observe('persistenceWriteAttempted');
    this.observe('recordDeleteAttempted');
    this.observe('candidateDeleteAttempted');
    slot.candidateBytesById.delete(candidateId);
    return true;
  }

  inspectDurableState(identityInput: unknown): DurableEvidenceObservation {
    const digest = physicalSourceDigest(identityInput);
    const slot = this.slot(digest);
    const authority = parseCanonicalAuthorityBytes(slot.authorityBytes);
    const sourceRecords = Object.freeze([...slot.source.entries()]
      .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
      .map(entry => Object.freeze([entry[0], entry[1]] as const)));
    const candidateEntries = [...slot.candidateBytesById.entries()]
      .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0);
    return {
      authorityBytes: slot.authorityBytes,
      candidateEntriesBytes: JSON.stringify(candidateEntries),
      authorityRecordCount: 1,
      candidateRecordCount: candidateEntries.length,
      sourceRecordCount: sourceRecords.length,
      authorityState: authority.state,
    };
  }

  static fromPersistedArtifacts(
    input: unknown,
    evidence = metrics(),
    restart = restartMetrics(),
  ): DurablePhysicalSourceRegistry {
    restart.rawInputRead += 1;
    const code = 'CORRUPT_PERSISTED_RECORD';
    let artifacts: Record<string, unknown>;
    try {
      artifacts = strictRecord(input, [
        'physicalSourceDigest', 'authorityBytes', 'candidateEntries', 'legacySourceRecords',
      ], code);
      restart.artifactSetSchemaValidated += 1;
    } catch (error) {
      throw new ProtocolError(error instanceof ProtocolError ? error.code : code, 'artifact_set_schema');
    }
    const physicalDigest = strictDigest(artifacts.physicalSourceDigest, code);
    if (typeof artifacts.authorityBytes !== 'string') {
      throw new ProtocolError(code, 'artifact_set_schema');
    }
    const authorityBytes = artifacts.authorityBytes;
    try {
      requireUtf8Bound(
        authorityBytes,
        MAX_AUTHORITY_PAYLOAD_UTF8_BYTES,
        'PERSISTED_AUTHORITY_TOO_LARGE',
      );
    } catch (error) {
      throw new ProtocolError(error instanceof ProtocolError ? error.code : code, 'raw_bounds');
    }
    let authority: Readonly<PersistedHandoffAuthorityV1>;
    let unknownAuthority: unknown;
    try {
      restart.duplicateScanAttempted += 1;
      const reader = new StrictJsonReader(authorityBytes);
      unknownAuthority = reader.read();
      restart.duplicateScanCompleted += 1;
      restart.jsonValueConstructed += 1;
    } catch (error) {
      const failureCode = error instanceof ProtocolError ? error.code : code;
      throw new ProtocolError(
        failureCode,
        failureCode === 'DUPLICATE_PERSISTED_JSON_KEY' ? 'duplicate_scan' : 'raw_input',
      );
    }
    try {
      restart.authorityParserInvoked += 1;
      authority = parsePersistedAuthority(unknownAuthority);
      restart.authoritySchemaValidated += 1;
    } catch (error) {
      throw new ProtocolError(error instanceof ProtocolError ? error.code : code, 'authority_schema');
    }
    restart.canonicalEqualityChecked += 1;
    if (serializeAuthority(authority) !== authorityBytes) {
      throw new ProtocolError('NONCANONICAL_PERSISTED_BYTES', 'canonical_bytes');
    }
    let candidateEntries: ReadonlyArray<readonly [string, string]>;
    try {
      restart.candidateFieldInspected += 1;
      if (!Array.isArray(artifacts.candidateEntries) || artifacts.candidateEntries.length > 1) {
        return fail(code);
      }
      const seen = new Set<string>();
      candidateEntries = Object.freeze(artifacts.candidateEntries.map(entry => {
        if (!Array.isArray(entry) || entry.length !== 2
          || typeof entry[0] !== 'string' || typeof entry[1] !== 'string') return fail(code);
        const key = strictString(entry[0], code);
        if (seen.has(key)) return fail(code);
        seen.add(key);
        return Object.freeze([key, entry[1]] as const);
      }));
      restart.candidateSchemaValidated += 1;
    } catch (error) {
      throw new ProtocolError(error instanceof ProtocolError ? error.code : code, 'artifact_set_schema');
    }
    let candidate: Readonly<PersistedSnapshotCandidateV1> | null = null;
    if (candidateEntries.length === 1) {
      const candidateBytes = candidateEntries[0]![1];
      try {
        requireUtf8Bound(
          candidateBytes,
          MAX_CANDIDATE_PAYLOAD_UTF8_BYTES,
          'PERSISTED_CANDIDATE_TOO_LARGE',
        );
      } catch (error) {
        throw new ProtocolError(error instanceof ProtocolError ? error.code : code, 'raw_bounds');
      }
      let unknownCandidate: unknown;
      try {
        restart.duplicateScanAttempted += 1;
        const reader = new StrictJsonReader(candidateBytes);
        unknownCandidate = reader.read();
        restart.duplicateScanCompleted += 1;
        restart.jsonValueConstructed += 1;
      } catch (error) {
        const failureCode = error instanceof ProtocolError ? error.code : code;
        throw new ProtocolError(
          failureCode,
          failureCode === 'DUPLICATE_PERSISTED_JSON_KEY' ? 'duplicate_scan' : 'raw_input',
        );
      }
      try {
        restart.candidateParserInvoked += 1;
        candidate = parsePersistedCandidate(unknownCandidate);
      } catch (error) {
        const failureCode = error instanceof ProtocolError ? error.code : code;
        throw new ProtocolError(
          failureCode,
          failureCode.startsWith('PERSISTED_SOURCE_') ? 'capture_bounds' : 'candidate_schema',
        );
      }
      restart.canonicalEqualityChecked += 1;
      if (serializeCandidate(candidate) !== candidateBytes) {
        throw new ProtocolError('NONCANONICAL_PERSISTED_BYTES', 'canonical_bytes');
      }
    }
    let legacySourceRecords: ReadonlyArray<readonly [string, string]>;
    try {
      legacySourceRecords = parseRecords(artifacts.legacySourceRecords, code);
      restart.sourceSchemaValidated += 1;
    } catch (error) {
      const failureCode = error instanceof ProtocolError ? error.code : code;
      throw new ProtocolError(
        failureCode,
        failureCode.startsWith('PERSISTED_SOURCE_') ? 'capture_bounds' : 'source_schema',
      );
    }
    const candidateRequired = authority.state === 'snapshot_committed_pending_finalization'
      || authority.state === 'read_only_handoff';
    try {
      restart.graphBindingInvoked += 1;
      if (authority.physicalSourceDigest !== physicalDigest || candidateRequired !== Boolean(candidate)) {
        return fail('PERSISTED_EVIDENCE_MISMATCH');
      }
      if (candidate) {
        exactCandidateBinding(authority, candidate);
        if (candidateEntries[0]![0] !== candidate.candidateId) return fail('PERSISTED_EVIDENCE_MISMATCH');
      }
      restart.graphBindingValidated += 1;
    } catch (error) {
      throw new ProtocolError(
        error instanceof ProtocolError ? error.code : 'PERSISTED_EVIDENCE_MISMATCH',
        'graph_binding',
      );
    }
    if (candidate) {
      const transactionBytes = utf8ByteLength(authorityBytes)
        + utf8ByteLength(candidateEntries[0]![1])
        + APPLICATION_TRANSACTION_RESERVE_UTF8_BYTES;
      if (transactionBytes > MAX_TRANSACTION_WRITE_UTF8_BYTES) {
        throw new ProtocolError('PERSISTED_TRANSACTION_TOO_LARGE', 'graph_bounds');
      }
    }
    const registry = new DurablePhysicalSourceRegistry(evidence, restart, true);
    registry.slots.set(physicalDigest, {
      authorityBytes: `${authorityBytes}`,
      candidateBytesById: new Map(candidateEntries.map(entry => [`${entry[0]}`, `${entry[1]}`])),
      source: new Map(legacySourceRecords),
    });
    return registry;
  }

  get observableCapabilities(): RestartMetrics | undefined {
    return this.observed;
  }

  get size(): number {
    return this.slots.size;
  }

  candidateCount(identityInput: unknown): number {
    return this.slot(physicalSourceDigest(identityInput)).candidateBytesById.size;
  }
}

interface WriteHooks {
  afterLockAcquired?: () => void | Promise<void>;
  afterAuthorityRead?: () => void | Promise<void>;
  crashBeforeCommit?: boolean;
}

interface HandoffHooks {
  afterLockAcquired?: () => void | Promise<void>;
  afterPendingCommit?: () => void | Promise<void>;
  afterCandidateCommit?: () => void | Promise<void>;
  crashAfterPending?: boolean;
  crashAfterCandidateCommit?: boolean;
  rejectAfterCoordinator?: boolean;
  forceFinalizationCasMismatch?: boolean;
}

class HandoffContext {
  constructor(
    private readonly locks: NamedLockRegistry,
    private readonly sources: DurablePhysicalSourceRegistry,
    private readonly physicalInput: unknown,
    private readonly scopeInput: unknown,
    private readonly evidence: BoundaryMetrics,
    private readonly coordinatorAvailable = true,
    private readonly observed?: RestartMetrics,
  ) {
    if (this.observed) this.observed.coordinatorConstructed += 1;
  }

  get lockName(): string {
    return derivePhysicalLockName(this.physicalInput, this.evidence);
  }

  private assertSupported(): void {
    if (!this.coordinatorAvailable) return fail('COORDINATOR_UNAVAILABLE');
  }

  private assertAuthority(
    authority: Readonly<PersistedHandoffAuthorityV1>,
    physicalDigest: string,
    scope: Readonly<LogicalAuthorityScopeV1>,
  ): void {
    if (authority.physicalSourceDigest !== physicalDigest) return fail('PERSISTED_EVIDENCE_MISMATCH');
    const digest = logicalScopeDigest(scope);
    if (authority.logicalScopeDigest !== digest
      || JSON.stringify(authority.logicalScope) !== JSON.stringify(scope)) {
      return fail('SCOPE_MISMATCH');
    }
  }

  write(idInput: unknown, valueInput: unknown, hooks: WriteHooks = {}): Promise<number> {
    this.assertSupported();
    const physical = parsePhysicalSourceIdentity(this.physicalInput);
    const digest = physicalSourceDigest(physical, this.evidence);
    const lockName = `absinthe:legacy-source-handoff:v1:${digest}`;
    this.evidence.lockDerivations += 1;
    return this.locks.run(lockName, async () => {
      await hooks.afterLockAcquired?.();
      const authority = this.sources.readAuthority(digest);
      const scope = parseLogicalScope(this.scopeInput);
      this.assertAuthority(authority, digest, scope);
      if (authority.state !== 'writable') return fail('SOURCE_READ_ONLY');
      await hooks.afterAuthorityRead?.();
      if (hooks.crashBeforeCommit) return fail('CONTEXT_CRASHED');
      const id = strictString(idInput, 'MALFORMED_SOURCE_MUTATION');
      const value = strictString(valueInput, 'MALFORMED_SOURCE_MUTATION', {
        allowEmpty: true,
        max: MAX_RECORD_VALUE_LENGTH,
      });
      const next = parsePersistedAuthority({ ...authority, sourceRevision: authority.sourceRevision + 1 });
      this.sources.commitWrite(digest, authority, next, id, value);
      return next.sourceRevision;
    });
  }

  handoff(hooks: HandoffHooks = {}): Promise<Readonly<PersistedSnapshotCandidateV1>> {
    this.assertSupported();
    const physical = parsePhysicalSourceIdentity(this.physicalInput);
    const digest = physicalSourceDigest(physical, this.evidence);
    const lockName = `absinthe:legacy-source-handoff:v1:${digest}`;
    this.evidence.lockDerivations += 1;
    return this.locks.run(lockName, async () => {
      await hooks.afterLockAcquired?.();
      let authority = this.sources.readAuthority(digest);
      const scope = parseLogicalScope(this.scopeInput);
      this.assertAuthority(authority, digest, scope);
      if (authority.state === 'read_only_handoff') {
        const candidate = this.sources.readCandidate(digest);
        if (!candidate) return fail('CORRUPT_PERSISTED_RECORD');
        exactCandidateBinding(authority, candidate);
        return candidate;
      }
      if (authority.state === 'writable') {
        const pending = parsePersistedAuthority({
          ...authority,
          state: 'handoff_pending',
          handoffSessionId: createHandoffSessionId(digest, authority.sourceRevision),
        });
        // WRITE_EXCLUSION_POINT: this durable CAS leaves writable under the common physical lock.
        this.sources.compareAndSetAuthority(digest, authority, pending);
        authority = pending;
      }
      if (authority.state === 'handoff_pending') {
        await hooks.afterPendingCommit?.();
        if (hooks.crashAfterPending) return fail('CONTEXT_CRASHED');
        const records = parseRecords(
          this.sources.captureSourceRecords(digest),
          'CORRUPT_PERSISTED_RECORD',
        );
        if (this.observed) this.observed.snapshotDigestAttempted += 1;
        const snapshotDigest = computeSnapshotDigest(records);
        const candidateId = createCandidateId(snapshotDigest);
        const rootDigest = computeRootDigest(
          digest,
          authority.logicalScopeDigest,
          authority.sourceRevision,
          snapshotDigest,
        );
        const manifestDigest = computeManifestDigest(
          candidateId,
          authority.handoffSessionId!,
          records.length,
          rootDigest,
        );
        const candidate = parsePersistedCandidate({
          recordType: CANDIDATE_RECORD_TYPE,
          schemaVersion: SCHEMA_VERSION,
          coordinatorVersion: COORDINATOR_VERSION,
          candidateId,
          handoffSessionId: authority.handoffSessionId,
          physicalSourceDigest: digest,
          logicalScopeDigest: authority.logicalScopeDigest,
          sourceRevision: authority.sourceRevision,
          snapshotDigest,
          rootDigest,
          manifestDigest,
          entityCount: records.length,
          records,
        });
        const pendingCandidate = parsePersistedAuthority({
          ...authority,
          state: 'snapshot_committed_pending_finalization',
          snapshotCandidateId: candidate.candidateId,
          snapshotDigest: candidate.snapshotDigest,
          rootDigest: candidate.rootDigest,
          manifestDigest: candidate.manifestDigest,
        });
        this.sources.commitCandidate(digest, authority, pendingCandidate, candidate);
        authority = pendingCandidate;
        await hooks.afterCandidateCommit?.();
        if (hooks.crashAfterCandidateCommit) return fail('CONTEXT_CRASHED');
      }
      const candidate = this.sources.readCandidate(digest);
      if (!candidate) return fail('CORRUPT_PERSISTED_RECORD');
      exactCandidateBinding(authority, candidate);
      if (hooks.rejectAfterCoordinator) {
        throw new ProtocolError('COORDINATOR_REJECTED', 'coordinator');
      }
      // HANDOFF_LINEARIZATION_POINT: one exact CAS binds the persisted candidate terminally.
      if (this.observed) this.observed.finalizationAttempted += 1;
      const expectedAuthority = hooks.forceFinalizationCasMismatch
        ? parsePersistedAuthority({
          ...authority,
          sourceRevision: authority.sourceRevision + 1,
          handoffSessionId: createHandoffSessionId(digest, authority.sourceRevision + 1),
        })
        : authority;
      this.sources.finalizeCandidate(digest, expectedAuthority, candidate);
      return candidate;
    });
  }

  cancelBeforeSnapshot(): Promise<void> {
    this.assertSupported();
    const physical = parsePhysicalSourceIdentity(this.physicalInput);
    const digest = physicalSourceDigest(physical, this.evidence);
    const lockName = `absinthe:legacy-source-handoff:v1:${digest}`;
    this.evidence.lockDerivations += 1;
    return this.locks.run(lockName, async () => {
      const authority = this.sources.readAuthority(digest);
      const scope = parseLogicalScope(this.scopeInput);
      this.assertAuthority(authority, digest, scope);
      if (authority.state !== 'handoff_pending' || this.sources.readCandidate(digest)) {
        return fail('CANCELLATION_NOT_ALLOWED');
      }
      const writable = parsePersistedAuthority({
        ...authority,
        state: 'writable',
        handoffSessionId: null,
      });
      this.sources.compareAndSetAuthority(digest, authority, writable);
    });
  }
}

const rootA: PhysicalSourceIdentityV1 = {
  schemaVersion: 1,
  origin: 'https://app.example.test',
  sourceFamily: 'legacy_notes',
  backend: 'combined_localstorage_indexeddb',
  databaseName: 'absinthe-notes-v1',
  objectStoreName: 'notes',
  physicalSourceVersion: 1,
};
const userA: LogicalAuthorityScopeV1 = {
  schemaVersion: 1,
  userId: 'user-a',
  projectRef: 'project-a',
  namespaceId: 'namespace-a',
  deviceId: 'device-a',
};
const userB: LogicalAuthorityScopeV1 = { ...userA, userId: 'user-b' };

function environment(
  evidence = metrics(),
  sources?: DurablePhysicalSourceRegistry,
): {
  evidence: BoundaryMetrics;
  locks: NamedLockRegistry;
  sources: DurablePhysicalSourceRegistry;
  context: (physical?: unknown, scope?: unknown, available?: boolean) => HandoffContext;
} {
  const locks = new NamedLockRegistry(evidence);
  const durableSources = sources ?? new DurablePhysicalSourceRegistry(evidence);
  return {
    evidence,
    locks,
    sources: durableSources,
    context: (physical = rootA, scope = userA, available = true) => (
      new HandoffContext(
        locks,
        durableSources,
        physical,
        scope,
        evidence,
        available,
        durableSources.observableCapabilities,
      )
    ),
  };
}

function cloneRecord<T extends object>(value: T): Record<string, unknown> {
  return { ...value } as Record<string, unknown>;
}

function withField(base: object, key: string, value: unknown): Record<string, unknown> {
  const record = cloneRecord(base);
  record[key] = value;
  return record;
}

function withoutField(base: object, key: string): Record<string, unknown> {
  const record = cloneRecord(base);
  delete record[key];
  return record;
}

function withAccessor(base: object, key: string, getter: () => unknown): Record<string, unknown> {
  const record = cloneRecord(base);
  Object.defineProperty(record, key, { enumerable: true, configurable: true, get: getter });
  return record;
}

function withInheritedField(base: object, key: string): object {
  const own = cloneRecord(base);
  const inherited = own[key];
  delete own[key];
  return Object.assign(Object.create({ [key]: inherited }) as object, own);
}

interface MalformedCase {
  label: string;
  value: unknown;
}

function malformedPhysicalCases(): MalformedCase[] {
  const cases: MalformedCase[] = [
    { label: 'null root', value: null },
    { label: 'array root', value: [] },
    { label: 'function root', value: () => rootA },
    { label: 'date root', value: new Date() },
    { label: 'map root', value: new Map() },
    { label: 'set root', value: new Set() },
    { label: 'boxed root', value: new String('root') },
    { label: 'custom class root', value: new (class Identity { schemaVersion = 1; })() },
    { label: 'proxy root', value: new Proxy(cloneRecord(rootA), {}) },
    { label: 'extra field', value: { ...rootA, extra: 'unknown' } },
    { label: 'top-level toJSON', value: { ...rootA, toJSON: () => rootA } },
  ];
  const stringFields = ['origin', 'sourceFamily', 'backend', 'databaseName', 'objectStoreName'] as const;
  const stringInvalid: Array<readonly [string, unknown]> = [
    ['undefined', undefined], ['null', null], ['empty', ''], ['whitespace', '   '], ['number', 1],
    ['boolean', true], ['object', {}], ['array', []], ['function', () => 'value'],
    ['symbol', Symbol('value')], ['boxed string', new String('value')],
    ['toJSON object', { toJSON: () => 'value' }],
  ];
  for (const field of stringFields) {
    cases.push({ label: `${field} missing`, value: withoutField(rootA, field) });
    for (const [label, value] of stringInvalid) {
      cases.push({ label: `${field} ${label}`, value: withField(rootA, field, value) });
    }
    cases.push({ label: `${field} accessor`, value: withAccessor(rootA, field, () => rootA[field]) });
    cases.push({ label: `${field} inherited`, value: withInheritedField(rootA, field) });
  }
  const numberFields = ['schemaVersion', 'physicalSourceVersion'] as const;
  const numberInvalid: Array<readonly [string, unknown]> = [
    ['undefined', undefined], ['null', null], ['zero', 0], ['negative', -1], ['float', 1.5],
    ['nan', Number.NaN], ['infinity', Number.POSITIVE_INFINITY], ['numeric string', '1'],
    ['boolean', true], ['object', {}], ['array', []], ['boxed number', new Number(1)],
    ['toJSON object', { toJSON: () => 1 }], ['bigint', BigInt(1)],
  ];
  for (const field of numberFields) {
    cases.push({ label: `${field} missing`, value: withoutField(rootA, field) });
    for (const [label, value] of numberInvalid) {
      cases.push({ label: `${field} ${label}`, value: withField(rootA, field, value) });
    }
    cases.push({ label: `${field} accessor`, value: withAccessor(rootA, field, () => rootA[field]) });
    cases.push({ label: `${field} inherited`, value: withInheritedField(rootA, field) });
  }
  cases.push({ label: 'origin path', value: { ...rootA, origin: 'https://app.example.test/path' } });
  cases.push({ label: 'origin trailing slash', value: { ...rootA, origin: 'https://app.example.test/' } });
  cases.push({ label: 'origin noncanonical case', value: { ...rootA, origin: 'https://APP.example.test' } });
  cases.push({ label: 'unknown source family', value: { ...rootA, sourceFamily: 'other' } });
  cases.push({ label: 'unknown backend', value: { ...rootA, backend: 'other' } });
  cases.push({ label: 'unknown schema version', value: { ...rootA, schemaVersion: 2 } });
  cases.push({ label: 'unknown physical version', value: { ...rootA, physicalSourceVersion: 99 } });
  return cases;
}

function malformedScopeCases(): MalformedCase[] {
  const cases: MalformedCase[] = [
    { label: 'null scope', value: null },
    { label: 'array scope', value: [] },
    { label: 'proxy scope', value: new Proxy(cloneRecord(userA), {}) },
    { label: 'custom scope', value: new (class Scope { schemaVersion = 1; })() },
    { label: 'extra scope field', value: { ...userA, extra: 'unknown' } },
  ];
  for (const field of ['userId', 'projectRef', 'namespaceId', 'deviceId'] as const) {
    cases.push({ label: `${field} missing`, value: withoutField(userA, field) });
    cases.push({ label: `${field} null`, value: withField(userA, field, null) });
    cases.push({ label: `${field} empty`, value: withField(userA, field, '') });
    cases.push({ label: `${field} object`, value: withField(userA, field, { toJSON: () => userA[field] }) });
    cases.push({ label: `${field} boxed`, value: withField(userA, field, new String(userA[field])) });
    cases.push({ label: `${field} accessor`, value: withAccessor(userA, field, () => userA[field]) });
    cases.push({ label: `${field} inherited`, value: withInheritedField(userA, field) });
  }
  cases.push({ label: 'scope version missing', value: withoutField(userA, 'schemaVersion') });
  cases.push({ label: 'scope version unknown', value: { ...userA, schemaVersion: 2 } });
  return cases;
}

function candidateFixture(): {
  authority: PersistedHandoffAuthorityV1;
  candidate: PersistedSnapshotCandidateV1;
} {
  const physicalDigest = physicalSourceDigest(rootA);
  const scope = parseLogicalScope(userA);
  const scopeDigest = logicalScopeDigest(scope);
  const records = parseRecords([['note-a', 'v1']], 'CORRUPT_PERSISTED_RECORD');
  const sourceRevision = 1;
  const handoffSessionId = createHandoffSessionId(physicalDigest, sourceRevision);
  const snapshotDigest = computeSnapshotDigest(records);
  const candidateId = createCandidateId(snapshotDigest);
  const rootDigest = computeRootDigest(physicalDigest, scopeDigest, sourceRevision, snapshotDigest);
  const manifestDigest = computeManifestDigest(candidateId, handoffSessionId, records.length, rootDigest);
  const candidate = parsePersistedCandidate({
    recordType: CANDIDATE_RECORD_TYPE,
    schemaVersion: 1,
    coordinatorVersion: 1,
    candidateId,
    handoffSessionId,
    physicalSourceDigest: physicalDigest,
    logicalScopeDigest: scopeDigest,
    sourceRevision,
    snapshotDigest,
    rootDigest,
    manifestDigest,
    entityCount: records.length,
    records,
  });
  const authority = parsePersistedAuthority({
    recordType: AUTHORITY_RECORD_TYPE,
    schemaVersion: 1,
    coordinatorVersion: 1,
    physicalSourceDigest: physicalDigest,
    logicalScope: scope,
    logicalScopeDigest: scopeDigest,
    state: 'snapshot_committed_pending_finalization',
    sourceRevision,
    handoffSessionId,
    snapshotCandidateId: candidateId,
    snapshotDigest,
    rootDigest,
    manifestDigest,
  });
  return { authority: authority as PersistedHandoffAuthorityV1, candidate: candidate as PersistedSnapshotCandidateV1 };
}

function bindAuthorityToCandidate(
  authority: Readonly<PersistedHandoffAuthorityV1>,
  candidate: Readonly<PersistedSnapshotCandidateV1>,
): Readonly<PersistedHandoffAuthorityV1> {
  return parsePersistedAuthority({
    ...authority,
    state: 'snapshot_committed_pending_finalization',
    handoffSessionId: candidate.handoffSessionId,
    snapshotCandidateId: candidate.candidateId,
    snapshotDigest: candidate.snapshotDigest,
    rootDigest: candidate.rootDigest,
    manifestDigest: candidate.manifestDigest,
  });
}

interface CanonicalBudgetGraph {
  scope: Readonly<LogicalAuthorityScopeV1>;
  authority: Readonly<PersistedHandoffAuthorityV1>;
  candidate: Readonly<PersistedSnapshotCandidateV1>;
  records: ReadonlyArray<readonly [string, string]>;
  authorityBytes: string;
  candidateBytes: string;
}

interface BudgetGraphOptions {
  scope?: LogicalAuthorityScopeV1;
  sourceRevision?: number;
  validate?: boolean;
}

function buildBudgetGraph(
  inputRecords: ReadonlyArray<readonly [string, string]>,
  options: BudgetGraphOptions = {},
): CanonicalBudgetGraph {
  const validate = options.validate ?? true;
  const records = validate
    ? parseRecords(inputRecords, 'CORRUPT_PERSISTED_RECORD')
    : Object.freeze(inputRecords.map(([id, value]) => Object.freeze([id, value] as const)));
  const scope = validate
    ? parseLogicalScope(options.scope ?? userA)
    : Object.freeze({ ...(options.scope ?? userA) });
  const physicalDigest = physicalSourceDigest(rootA);
  const scopeDigest = logicalScopeDigest(scope);
  const sourceRevision = options.sourceRevision ?? MAX_SOURCE_REVISION;
  const handoffSessionId = createHandoffSessionId(physicalDigest, sourceRevision);
  const snapshotDigest = computeSnapshotDigest(records);
  const candidateId = createCandidateId(snapshotDigest);
  const rootDigest = computeRootDigest(physicalDigest, scopeDigest, sourceRevision, snapshotDigest);
  const manifestDigest = computeManifestDigest(
    candidateId,
    handoffSessionId,
    records.length,
    rootDigest,
  );
  const candidateInput: PersistedSnapshotCandidateV1 = {
    recordType: CANDIDATE_RECORD_TYPE,
    schemaVersion: 1,
    coordinatorVersion: 1,
    candidateId,
    handoffSessionId,
    physicalSourceDigest: physicalDigest,
    logicalScopeDigest: scopeDigest,
    sourceRevision,
    snapshotDigest,
    rootDigest,
    manifestDigest,
    entityCount: records.length,
    records,
  };
  const authorityInput: PersistedHandoffAuthorityV1 = {
    recordType: AUTHORITY_RECORD_TYPE,
    schemaVersion: 1,
    coordinatorVersion: 1,
    physicalSourceDigest: physicalDigest,
    logicalScope: scope,
    logicalScopeDigest: scopeDigest,
    state: 'snapshot_committed_pending_finalization',
    sourceRevision,
    handoffSessionId,
    snapshotCandidateId: candidateId,
    snapshotDigest,
    rootDigest,
    manifestDigest,
  };
  const candidate = validate ? parsePersistedCandidate(candidateInput) : Object.freeze(candidateInput);
  const authority = validate ? parsePersistedAuthority(authorityInput) : Object.freeze(authorityInput);
  return {
    scope,
    authority,
    candidate,
    records,
    authorityBytes: JSON.stringify(authority),
    candidateBytes: JSON.stringify(candidate),
  };
}

function maximumNestedRecords(): ReadonlyArray<readonly [string, string]> {
  const records: Array<[string, string]> = [[
    '\0'.repeat(MAX_SOURCE_RECORD_ID_UTF8_BYTES),
    '\0'.repeat(MAX_SOURCE_RECORD_VALUE_UTF8_BYTES),
  ]];
  for (let index = 0; index < MAX_SOURCE_RECORD_COUNT - 1; index += 1) {
    records.push([`id-${index.toString().padStart(4, '0')}`, '']);
  }
  let remaining = MAX_TOTAL_SOURCE_RECORD_UTF8_BYTES
    - records.reduce((sum, record) => sum + utf8ByteLength(JSON.stringify(record)), 0);
  for (let index = 1; index < records.length && remaining > 0; index += 1) {
    const addition = Math.min(MAX_SOURCE_RECORD_VALUE_UTF8_BYTES, remaining);
    records[index]![1] = 'a'.repeat(addition);
    remaining -= addition;
  }
  if (remaining !== 0) return fail('TEST_FIXTURE_MISMATCH');
  return parseRecords(records, 'CORRUPT_PERSISTED_RECORD');
}

function exactAggregateFourRecords(): ReadonlyArray<readonly [string, string]> {
  const records = Array.from({ length: 4 }, (_, index): [string, string] => [
    `${'\0'.repeat(255)}${String.fromCharCode(index + 1)}`,
    '\0'.repeat(MAX_SOURCE_RECORD_VALUE_UTF8_BYTES),
  ]);
  const remaining = MAX_TOTAL_SOURCE_RECORD_UTF8_BYTES
    - records.reduce((sum, record) => sum + utf8ByteLength(JSON.stringify(record)), 0);
  const fifthBase = utf8ByteLength(JSON.stringify(['zzzz', '']));
  if (remaining < fifthBase || remaining - fifthBase > MAX_SOURCE_RECORD_VALUE_UTF8_BYTES) {
    return fail('TEST_FIXTURE_MISMATCH');
  }
  records.push(['zzzz', 'a'.repeat(remaining - fifthBase)]);
  return parseRecords(records, 'CORRUPT_PERSISTED_RECORD');
}

function logicalScopeWithAsciiPadding(extraBytes: number): LogicalAuthorityScopeV1 {
  if (!Number.isSafeInteger(extraBytes) || extraBytes < 0 || extraBytes > 1_020) {
    return fail('TEST_FIXTURE_MISMATCH');
  }
  let remaining = extraBytes;
  const next = (): string => {
    const addition = Math.min(255, remaining);
    remaining -= addition;
    return `x${'a'.repeat(addition)}`;
  };
  const scope: LogicalAuthorityScopeV1 = {
    schemaVersion: 1,
    userId: next(),
    projectRef: next(),
    namespaceId: next(),
    deviceId: next(),
  };
  if (remaining !== 0) return fail('TEST_FIXTURE_MISMATCH');
  return scope;
}

function artifactsForGraph(
  graph: CanonicalBudgetGraph,
  legacySourceRecords = graph.records,
): Readonly<PersistedArtifactSetV1> {
  return Object.freeze({
    physicalSourceDigest: graph.authority.physicalSourceDigest,
    authorityBytes: `${graph.authorityBytes}`,
    candidateEntries: Object.freeze([
      Object.freeze([graph.candidate.candidateId, `${graph.candidateBytes}`] as const),
    ]),
    legacySourceRecords: Object.freeze(legacySourceRecords.map(record => (
      Object.freeze([`${record[0]}`, `${record[1]}`] as const)
    ))),
  });
}

async function expectFullGraphRestart(graph: CanonicalBudgetGraph): Promise<RestartMetrics> {
  const observed = restartMetrics();
  const sources = DurablePhysicalSourceRegistry.fromPersistedArtifacts(
    artifactsForGraph(graph),
    metrics(),
    observed,
  );
  const context = environment(metrics(), sources).context(rootA, graph.scope);
  await expect(context.handoff()).resolves.toEqual(graph.candidate);
  expect(sources.readAuthority(physicalSourceDigest(rootA)).state).toBe('read_only_handoff');
  return observed;
}

function cloneArtifacts(
  artifacts: Readonly<PersistedArtifactSetV1>,
): PersistedArtifactSetV1 {
  return {
    physicalSourceDigest: `${artifacts.physicalSourceDigest}`,
    authorityBytes: `${artifacts.authorityBytes}`,
    candidateEntries: artifacts.candidateEntries.map(entry => [`${entry[0]}`, `${entry[1]}`] as const),
    legacySourceRecords: artifacts.legacySourceRecords.map(record => (
      [`${record[0]}`, `${record[1]}`] as const
    )),
  };
}

function mutateArtifactPayload(
  input: Readonly<PersistedArtifactSetV1>,
  target: 'authority' | 'candidate',
  mutate: (payload: Record<string, unknown>) => void,
): PersistedArtifactSetV1 {
  const artifacts = cloneArtifacts(input);
  const bytes = target === 'authority'
    ? artifacts.authorityBytes
    : artifacts.candidateEntries[0]?.[1] ?? fail('TEST_FIXTURE_MISMATCH');
  const payload = JSON.parse(bytes) as Record<string, unknown>;
  mutate(payload);
  if (target === 'authority') artifacts.authorityBytes = JSON.stringify(payload);
  else artifacts.candidateEntries = [[artifacts.candidateEntries[0]![0], JSON.stringify(payload)]];
  return artifacts;
}

async function pendingPersistedArtifacts(value = 'v1'): Promise<Readonly<PersistedArtifactSetV1>> {
  const env = environment();
  env.sources.initialize(rootA, userA);
  await env.context().write('note-a', value);
  await expect(env.context().handoff({ crashAfterCandidateCommit: true }))
    .rejects.toMatchObject({ code: 'CONTEXT_CRASHED' });
  return env.sources.exportArtifacts(rootA);
}

async function emptyPendingPersistedArtifacts(): Promise<Readonly<PersistedArtifactSetV1>> {
  const env = environment();
  env.sources.initialize(rootA, userA);
  await expect(env.context().handoff({ crashAfterCandidateCommit: true }))
    .rejects.toMatchObject({ code: 'CONTEXT_CRASHED' });
  return env.sources.exportArtifacts(rootA);
}

interface RestartRejectionResult {
  accepted: false;
  code: string;
  stage: RestartFailureStage;
  inputSnapshotBefore: string;
  inputSnapshotAfter: string;
  authorityBytesBefore: string | null;
  authorityBytesAfter: string | null;
  candidateEntriesBytesBefore: string;
  candidateEntriesBytesAfter: string;
  authorityRecordCountBefore: number;
  authorityRecordCountAfter: number;
  candidateRecordCountBefore: number;
  candidateRecordCountAfter: number;
  sourceRecordCountBefore: number;
  sourceRecordCountAfter: number;
  authorityStateBefore: AuthorityState | null;
  authorityStateAfter: AuthorityState | null;
  metrics: RestartMetrics;
  evidenceRewritten: boolean;
  evidenceWriteAttempted: boolean;
  sourceRecaptured: boolean;
  writableRestored: boolean;
  terminalProduced: boolean;
  authoritySynthesized: boolean;
  candidateSynthesized: boolean;
  recordDeleted: boolean;
  additionalEvidenceCreated: boolean;
  payloadExposed: boolean;
}

function stableInputSnapshot(input: unknown): string {
  try {
    return JSON.stringify(input) ?? '<undefined>';
  } catch {
    return '<unserializable>';
  }
}

function rawEvidenceSnapshot(input: unknown): DurableEvidenceObservation {
  const absent: DurableEvidenceObservation = {
    authorityBytes: null,
    candidateEntriesBytes: '[]',
    authorityRecordCount: 0,
    candidateRecordCount: 0,
    sourceRecordCount: 0,
    authorityState: null,
  };
  if (typeof input !== 'object' || input === null || Array.isArray(input)) return absent;
  const artifacts = input as Record<string, unknown>;
  const authorityBytes = typeof artifacts.authorityBytes === 'string' ? artifacts.authorityBytes : null;
  let authority: Record<string, unknown> | null = null;
  if (authorityBytes !== null && utf8ByteLength(authorityBytes, MAX_AUTHORITY_PAYLOAD_UTF8_BYTES)
    <= MAX_AUTHORITY_PAYLOAD_UTF8_BYTES) {
    try {
      const parsed = new StrictJsonReader(authorityBytes).read();
      authority = typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
        ? parsed as Record<string, unknown>
        : null;
    } catch {
      // Preserve the raw detached bytes when the authority payload is unreadable.
    }
  }
  const authorityState = authority && typeof authority.state === 'string'
    && ['writable', 'handoff_pending', 'snapshot_committed_pending_finalization', 'read_only_handoff']
      .includes(authority.state)
    ? authority.state as AuthorityState
    : null;
  const candidateEntries = Array.isArray(artifacts.candidateEntries)
    ? artifacts.candidateEntries
    : [];
  const legacySourceRecords = Array.isArray(artifacts.legacySourceRecords)
    ? artifacts.legacySourceRecords
    : [];
  return {
    authorityBytes,
    candidateEntriesBytes: stableInputSnapshot(candidateEntries),
    authorityRecordCount: authorityBytes !== null ? 1 : 0,
    candidateRecordCount: candidateEntries.length,
    sourceRecordCount: legacySourceRecords.length,
    authorityState,
  };
}

async function attemptRejectedRestart(
  input: unknown,
  hooks: HandoffHooks = {},
): Promise<RestartRejectionResult> {
  const stages = restartMetrics();
  const evidence = metrics();
  const inputSnapshotBefore = stableInputSnapshot(input);
  const rawBefore = rawEvidenceSnapshot(input);
  let before: DurableEvidenceObservation = rawBefore;
  let sources: DurablePhysicalSourceRegistry | undefined;
  let code = 'RESTART_UNEXPECTEDLY_ACCEPTED';
  let errorMessage = code;
  let stage: RestartFailureStage = 'raw_input';
  try {
    sources = DurablePhysicalSourceRegistry.fromPersistedArtifacts(input, evidence, stages);
    before = sources.inspectDurableState(rootA);
    try {
      await environment(evidence, sources).context().handoff(hooks);
    } catch (error) {
      code = error instanceof ProtocolError ? error.code : 'CORRUPT_PERSISTED_RECORD';
      errorMessage = error instanceof Error ? error.message : code;
      stage = error instanceof ProtocolError && error.stage
        ? error.stage
        : code === 'AUTHORITY_CAS_MISMATCH' ? 'finalization_cas' : 'coordinator';
    }
  } catch (error) {
    code = error instanceof ProtocolError ? error.code : 'CORRUPT_PERSISTED_RECORD';
    errorMessage = error instanceof Error ? error.message : code;
    stage = error instanceof ProtocolError && error.stage ? error.stage : 'raw_input';
  }
  if (code === 'RESTART_UNEXPECTEDLY_ACCEPTED') return fail(code);
  const after = sources ? sources.inspectDurableState(rootA) : rawEvidenceSnapshot(input);
  const evidenceRewritten = before.authorityBytes !== after.authorityBytes
    || before.candidateEntriesBytes !== after.candidateEntriesBytes;
  const beforeRecordCount = before.authorityRecordCount + before.candidateRecordCount;
  const afterRecordCount = after.authorityRecordCount + after.candidateRecordCount;
  return {
    accepted: false,
    code,
    stage,
    inputSnapshotBefore,
    inputSnapshotAfter: stableInputSnapshot(input),
    authorityBytesBefore: rawBefore.authorityBytes,
    authorityBytesAfter: after.authorityBytes,
    candidateEntriesBytesBefore: rawBefore.candidateEntriesBytes,
    candidateEntriesBytesAfter: after.candidateEntriesBytes,
    authorityRecordCountBefore: before.authorityRecordCount,
    authorityRecordCountAfter: after.authorityRecordCount,
    candidateRecordCountBefore: before.candidateRecordCount,
    candidateRecordCountAfter: after.candidateRecordCount,
    sourceRecordCountBefore: before.sourceRecordCount,
    sourceRecordCountAfter: after.sourceRecordCount,
    authorityStateBefore: before.authorityState,
    authorityStateAfter: after.authorityState,
    metrics: stages,
    evidenceRewritten,
    evidenceWriteAttempted: stages.persistenceWriteAttempted > 0,
    sourceRecaptured: stages.sourceRecaptureAttempted > 0,
    writableRestored: before.authorityState !== 'writable' && after.authorityState === 'writable',
    terminalProduced: before.authorityState !== 'read_only_handoff'
      && after.authorityState === 'read_only_handoff',
    authoritySynthesized: before.authorityRecordCount === 0 && after.authorityRecordCount > 0,
    candidateSynthesized: before.candidateRecordCount === 0 && after.candidateRecordCount > 0,
    recordDeleted: afterRecordCount < beforeRecordCount,
    additionalEvidenceCreated: afterRecordCount > beforeRecordCount,
    payloadExposed: errorMessage !== code
      || (rawBefore.authorityBytes !== null && errorMessage.includes(rawBefore.authorityBytes))
      || (rawBefore.candidateEntriesBytes.length > 2
        && errorMessage.includes(rawBefore.candidateEntriesBytes)),
  };
}

const CAPABILITY_COUNTERS = [
  'persistenceReadAttempted', 'persistenceWriteAttempted',
  'authorityWriteAttempted', 'candidateWriteAttempted', 'terminalWriteAttempted',
  'authorityRewriteAttempted', 'sourceReadAttempted', 'sourceCaptureAttempted',
  'sourceRecaptureAttempted', 'snapshotDigestAttempted', 'sourceMutationAttempted',
  'recordCreateAttempted', 'recordDeleteAttempted', 'authorityCreateAttempted',
  'candidateCreateAttempted', 'candidateDeleteAttempted',
  'coordinatorConstructed', 'finalizationAttempted',
] as const satisfies ReadonlyArray<keyof RestartMetrics>;

const ALLOWED_CAPABILITIES_BY_REJECTION_STAGE: Readonly<Record<
  RestartFailureStage,
  ReadonlySet<typeof CAPABILITY_COUNTERS[number]>
>> = {
  raw_input: new Set(),
  raw_bounds: new Set(),
  duplicate_scan: new Set(),
  artifact_set_schema: new Set(),
  authority_schema: new Set(),
  candidate_schema: new Set(),
  source_schema: new Set(),
  capture_bounds: new Set(),
  graph_bounds: new Set(),
  graph_binding: new Set(),
  canonical_bytes: new Set(),
  coordinator: new Set(['persistenceReadAttempted', 'coordinatorConstructed']),
  finalization_cas: new Set([
    'persistenceReadAttempted', 'coordinatorConstructed', 'finalizationAttempted',
  ]),
};

function expectTotalRestartRejection(result: RestartRejectionResult, original: unknown): void {
  expect(result.accepted).toBe(false);
  expect(result.code).not.toBe('RESTART_UNEXPECTEDLY_ACCEPTED');
  expect(result.inputSnapshotBefore).toBe(stableInputSnapshot(original));
  expect(result.inputSnapshotAfter).toBe(stableInputSnapshot(original));
  expect(result.authorityBytesAfter).toBe(result.authorityBytesBefore);
  expect(result.candidateEntriesBytesAfter).toBe(result.candidateEntriesBytesBefore);
  expect(result.authorityRecordCountAfter).toBe(result.authorityRecordCountBefore);
  expect(result.candidateRecordCountAfter).toBe(result.candidateRecordCountBefore);
  expect(result.sourceRecordCountAfter).toBe(result.sourceRecordCountBefore);
  expect(result.authorityStateAfter).toBe(result.authorityStateBefore);
  const allowed = ALLOWED_CAPABILITIES_BY_REJECTION_STAGE[result.stage];
  for (const counter of CAPABILITY_COUNTERS) {
    if (!allowed.has(counter)) expect(result.metrics[counter], counter).toBe(0);
  }
  expect(result.evidenceRewritten).toBe(false);
  expect(result.evidenceWriteAttempted).toBe(false);
  expect(result.sourceRecaptured).toBe(false);
  expect(result.writableRestored).toBe(false);
  expect(result.terminalProduced).toBe(false);
  expect(result.authoritySynthesized).toBe(false);
  expect(result.candidateSynthesized).toBe(false);
  expect(result.recordDeleted).toBe(false);
  expect(result.additionalEvidenceCreated).toBe(false);
  expect(result.payloadExposed).toBe(false);
}

function capabilitySnapshot(metricsValue: RestartMetrics): Record<typeof CAPABILITY_COUNTERS[number], number> {
  return Object.fromEntries(
    CAPABILITY_COUNTERS.map(counter => [counter, metricsValue[counter]]),
  ) as Record<typeof CAPABILITY_COUNTERS[number], number>;
}

function capabilityDelta(
  before: Record<typeof CAPABILITY_COUNTERS[number], number>,
  after: RestartMetrics,
): Record<typeof CAPABILITY_COUNTERS[number], number> {
  return Object.fromEntries(
    CAPABILITY_COUNTERS.map(counter => [counter, after[counter] - before[counter]]),
  ) as Record<typeof CAPABILITY_COUNTERS[number], number>;
}

function replaceOnce(bytes: string, needle: string, replacement: string): string {
  const index = bytes.indexOf(needle);
  if (index < 0) return fail('TEST_FIXTURE_MISMATCH');
  return `${bytes.slice(0, index)}${replacement}${bytes.slice(index + needle.length)}`;
}

describe('K-327B strict physical identity boundary', () => {
  it('returns a fresh canonical identity and stable bytes across property order, delimiters, and Unicode', () => {
    const reordered = {
      objectStoreName: 'notes', physicalSourceVersion: 1, databaseName: 'absinthe-notes-v1',
      backend: 'combined_localstorage_indexeddb', sourceFamily: 'legacy_notes',
      origin: 'https://app.example.test', schemaVersion: 1,
    };
    const validated = parsePhysicalSourceIdentity(reordered);
    expect(validated).not.toBe(reordered);
    expect(canonicalPhysicalSource(reordered)).toBe(canonicalPhysicalSource(rootA));
    const delimiterUnicode = {
      ...rootA,
      databaseName: 'db|][한글',
      objectStoreName: 'notes:日本語',
    };
    expect(canonicalPhysicalSource(delimiterUnicode)).toContain('한글');
    expect(derivePhysicalLockName(delimiterUnicode)).toMatch(/^absinthe:legacy-source-handoff:v1:[a-f0-9]{64}$/);
  });

  it.each(malformedPhysicalCases())('$label rejects before canonicalization, hashing, or lock lookup', ({ value }) => {
    const evidence = metrics();
    const env = environment(evidence);
    const actor = env.context(value, userA);
    expect(() => actor.lockName).toThrowError(ProtocolError);
    expect(() => actor.write('note-a', 'no-write')).toThrowError(ProtocolError);
    expect(evidence).toMatchObject({
      canonicalizations: 0,
      hashes: 0,
      lockDerivations: 0,
      registryLookups: 0,
      authorityReads: 0,
      authorityWrites: 0,
    });
    expect(env.locks.size).toBe(0);
    expect(env.sources.size).toBe(0);
  });

  it('permanently rejects the former toJSON lock alias without executing it', () => {
    let calls = 0;
    const malicious = {
      ...rootA,
      databaseName: { toJSON: () => { calls += 1; return rootA.databaseName; } },
    };
    const unsafeBytes = JSON.stringify([
      'absinthe_legacy_physical_source_v1', rootA.schemaVersion, rootA.origin, rootA.sourceFamily,
      rootA.backend, malicious.databaseName, rootA.objectStoreName, rootA.physicalSourceVersion,
    ]);
    expect(calls).toBe(1);
    expect(unsafeBytes).toBe(canonicalPhysicalSource(rootA));
    calls = 0;
    const evidence = metrics();
    const env = environment(evidence);
    expect(() => env.context(malicious).lockName).toThrowError(ProtocolError);
    expect(calls).toBe(0);
    expect(evidence).toMatchObject({ canonicalizations: 0, hashes: 0, registryLookups: 0 });
    expect(env.locks.size).toBe(0);
  });

  const physicalVariations: Array<readonly [string, PhysicalSourceIdentityV1]> = [
    ['origin', { ...rootA, origin: 'https://other.example.test' }],
    ['source family', { ...rootA, sourceFamily: 'legacy_notes_fixture_v2' }],
    ['backend', { ...rootA, backend: 'legacy_indexeddb_fixture_v2' }],
    ['database', { ...rootA, databaseName: 'absinthe-notes-v1-other' }],
    ['object store', { ...rootA, objectStoreName: 'notes-other' }],
    ['physical version', { ...rootA, physicalSourceVersion: 2 }],
  ];

  it.each(physicalVariations)('%s independently changes canonical bytes, digest, lock, queue, and authority', async (_field, variant) => {
    const env = environment();
    env.sources.initialize(rootA, userA);
    env.sources.initialize(variant, userA);
    expect(canonicalPhysicalSource(variant)).not.toBe(canonicalPhysicalSource(rootA));
    expect(physicalSourceDigest(variant)).not.toBe(physicalSourceDigest(rootA));
    expect(env.context(variant).lockName).not.toBe(env.context(rootA).lockName);
    await Promise.all([
      env.context(rootA).write('note-a', 'root-a'),
      env.context(variant).write('note-b', 'root-b'),
    ]);
    expect(env.locks.size).toBe(2);
    expect(env.sources.size).toBe(2);
  });

  it.each([
    ['user', userB],
    ['project', { ...userA, projectRef: 'project-b' }],
    ['namespace', { ...userA, namespaceId: 'namespace-b' }],
    ['device', { ...userA, deviceId: 'device-b' }],
  ])('%s variation preserves the physical lock and queue', async (_field, scope) => {
    const env = environment();
    env.sources.initialize(rootA, userA);
    expect(env.context(rootA, scope).lockName).toBe(env.context(rootA, userA).lockName);
    await expect(env.context(rootA, scope).write('note-a', 'blocked'))
      .rejects.toMatchObject({ code: 'SCOPE_MISMATCH' });
    expect(env.locks.size).toBe(1);
  });
});
describe('K-327B strict logical scope boundary', () => {
  it.each(malformedScopeCases())('$label rejects under the common physical lock before mutation', async ({ value }) => {
    const env = environment();
    env.sources.initialize(rootA, userA);
    const baselineWrites = env.evidence.authorityWrites;
    await expect(env.context(rootA, value).write('note-a', 'blocked'))
      .rejects.toMatchObject({ code: 'MALFORMED_LOGICAL_SCOPE' });
    expect(env.locks.size).toBe(1);
    expect(env.evidence.registryLookups).toBe(1);
    expect(env.evidence.authorityReads).toBe(1);
    expect(env.evidence.authorityWrites).toBe(baselineWrites);
    expect(env.sources.sourceRecords(physicalSourceDigest(rootA))).toEqual([]);
  });
});

describe('K-327B versioned persisted schemas', () => {
  const authorityMutations: Array<readonly [string, (value: Record<string, unknown>) => unknown]> = [
    ['null', () => null],
    ['array', () => []],
    ['primitive', () => 'authority'],
    ['extra key', value => ({ ...value, extra: true })],
    ['missing key', value => { const next = { ...value }; delete next.state; return next; }],
    ['missing discriminator', value => { const next = { ...value }; delete next.recordType; return next; }],
    ['missing schema version', value => { const next = { ...value }; delete next.schemaVersion; return next; }],
    ['missing coordinator version', value => { const next = { ...value }; delete next.coordinatorVersion; return next; }],
    ['wrong discriminator', value => ({ ...value, recordType: 'wrong' })],
    ['unknown version', value => ({ ...value, schemaVersion: 2 })],
    ['unknown coordinator', value => ({ ...value, coordinatorVersion: 2 })],
    ['invalid state', value => ({ ...value, state: 'unknown' })],
    ['numeric-string revision', value => ({ ...value, sourceRevision: '1' })],
    ['negative revision', value => ({ ...value, sourceRevision: -1 })],
    ['unsafe revision', value => ({ ...value, sourceRevision: Number.MAX_SAFE_INTEGER + 1 })],
    ['boxed candidate id', value => ({ ...value, snapshotCandidateId: new String('candidate') })],
    ['object digest', value => ({ ...value, snapshotDigest: { toJSON: () => '0'.repeat(64) } })],
    ['impossible writable binding', value => ({ ...value, state: 'writable' })],
    ['impossible pending binding', value => ({ ...value, state: 'handoff_pending' })],
    ['impossible terminal binding', value => ({ ...value, state: 'read_only_handoff', snapshotDigest: null })],
  ];

  it.each(authorityMutations)('authority parser rejects %s', (_label, mutate) => {
    const { authority } = candidateFixture();
    expect(() => parsePersistedAuthority(mutate(cloneRecord(authority)))).toThrowError(ProtocolError);
  });

  const candidateMutations: Array<readonly [string, (value: Record<string, unknown>) => unknown]> = [
    ['null', () => null],
    ['array', () => []],
    ['primitive', () => 1],
    ['extra key', value => ({ ...value, extra: true })],
    ['missing key', value => { const next = { ...value }; delete next.candidateId; return next; }],
    ['missing discriminator', value => { const next = { ...value }; delete next.recordType; return next; }],
    ['missing schema version', value => { const next = { ...value }; delete next.schemaVersion; return next; }],
    ['missing coordinator version', value => { const next = { ...value }; delete next.coordinatorVersion; return next; }],
    ['wrong discriminator', value => ({ ...value, recordType: 'wrong' })],
    ['unknown version', value => ({ ...value, schemaVersion: 2 })],
    ['unknown coordinator', value => ({ ...value, coordinatorVersion: 2 })],
    ['empty id', value => ({ ...value, candidateId: '' })],
    ['object id', value => ({ ...value, candidateId: { toJSON: () => 'candidate' } })],
    ['negative revision', value => ({ ...value, sourceRevision: -1 })],
    ['unsafe revision', value => ({ ...value, sourceRevision: Number.MAX_SAFE_INTEGER + 1 })],
    ['invalid entity count', value => ({ ...value, entityCount: '1' })],
    ['negative entity count', value => ({ ...value, entityCount: -1 })],
    ['invalid digest', value => ({ ...value, rootDigest: 'xyz' })],
    ['duplicate records', value => ({ ...value, records: [['a', '1'], ['a', '2']], entityCount: 2 })],
    ['unsorted records', value => ({ ...value, records: [['b', '2'], ['a', '1']], entityCount: 2 })],
    ['proxied records', value => ({ ...value, records: new Proxy([['a', '1']], {}) })],
    ['record accessor', value => {
      const entry: unknown[] = ['a', '1'];
      Object.defineProperty(entry, '0', { configurable: true, enumerable: true, get: () => 'a' });
      return { ...value, records: [entry] };
    }],
    ['record extra key', value => {
      const records = [['a', '1']];
      Object.assign(records, { extra: true });
      return { ...value, records };
    }],
  ];

  it.each(candidateMutations)('candidate parser rejects %s', (_label, mutate) => {
    const { candidate } = candidateFixture();
    expect(() => parsePersistedCandidate(mutate(cloneRecord(candidate)))).toThrowError(ProtocolError);
  });

  it('rejects accessors, inherited fields, custom prototypes, boxed roots, and proxies without getter execution', () => {
    const { authority, candidate } = candidateFixture();
    let getterCalls = 0;
    expect(() => parsePersistedAuthority(withAccessor(authority, 'state', () => {
      getterCalls += 1;
      return authority.state;
    }))).toThrowError(ProtocolError);
    expect(getterCalls).toBe(0);
    expect(() => parsePersistedAuthority(withInheritedField(authority, 'state'))).toThrowError(ProtocolError);
    expect(() => parsePersistedCandidate(Object.assign(Object.create(candidate), {})))
      .toThrowError(ProtocolError);
    expect(() => parsePersistedCandidate(new Proxy(cloneRecord(candidate), {}))).toThrowError(ProtocolError);
    expect(() => parsePersistedAuthority(new String('authority'))).toThrowError(ProtocolError);
  });

  it('rejects candidate toJSON coercion before serialization without executing it', () => {
    const { candidate } = candidateFixture();
    let calls = 0;
    const malformed = {
      ...candidate,
      candidateId: { toJSON: () => { calls += 1; return candidate.candidateId; } },
    };
    expect(() => serializeCandidate(malformed)).toThrowError(ProtocolError);
    expect(calls).toBe(0);
  });
});

describe('K-327G fixed production identifier policies', () => {
  it('constructs and accepts the one fixed candidate ID format', () => {
    const digest = 'a'.repeat(64);
    const candidateId = createCandidateId(digest);
    expect(candidateId).toBe(`candidate-${'a'.repeat(24)}`);
    expect(utf8ByteLength(candidateId)).toBe(34);
    expect(strictCandidateId(candidateId, 'CORRUPT_PERSISTED_RECORD')).toBe(candidateId);
  });

  it.each([
    ['wrong prefix', `snapshot-${'a'.repeat(24)}`],
    ['uppercase digest', `candidate-${'A'.repeat(24)}`],
    ['short digest', `candidate-${'a'.repeat(23)}`],
    ['long digest', `candidate-${'a'.repeat(25)}`],
    ['invalid digest character', `candidate-${'a'.repeat(23)}g`],
    ['former 153-byte fixture', 'c'.repeat(153)],
    ['former 154-byte fixture', 'c'.repeat(154)],
    ['leading whitespace', ` candidate-${'a'.repeat(24)}`],
    ['Unicode lookalike', `candidat\u0435-${'a'.repeat(24)}`],
    ['embedded NUL', `candidate-${'a'.repeat(12)}\0${'a'.repeat(11)}`],
    ['trailing whitespace', `candidate-${'a'.repeat(24)} `],
  ])('rejects candidate ID %s with total schema-stage no-effect evidence', async (_label, value) => {
    expect(() => strictCandidateId(value, 'CORRUPT_PERSISTED_RECORD')).toThrowError(ProtocolError);
    const canonical = await pendingPersistedArtifacts();
    const malformed = mutateArtifactPayload(canonical, 'candidate', candidate => {
      candidate.candidateId = value;
    });
    const result = await attemptRejectedRestart(malformed);
    expectTotalRestartRejection(result, malformed);
    expect(result).toMatchObject({ code: 'CORRUPT_PERSISTED_RECORD', stage: 'candidate_schema' });
  });

  it.each([
    ['minimum revision', 0, 26],
    ['maximum revision', MAX_SOURCE_REVISION, 41],
  ])('constructs and accepts a session ID at %s', (_label, revision, expectedLength) => {
    const digest = 'b'.repeat(64);
    const sessionId = createHandoffSessionId(digest, revision);
    expect(sessionId).toBe(`handoff-${'b'.repeat(16)}-${revision.toString(10)}`);
    expect(utf8ByteLength(sessionId)).toBe(expectedLength);
    expect(strictHandoffSessionId(sessionId, 'CORRUPT_PERSISTED_RECORD')).toBe(sessionId);
  });

  it.each([
    ['revision over maximum', `handoff-${'b'.repeat(16)}-9007199254740992`],
    ['negative revision', `handoff-${'b'.repeat(16)}--1`],
    ['negative zero revision', `handoff-${'b'.repeat(16)}--0`],
    ['leading plus revision', `handoff-${'b'.repeat(16)}-+1`],
    ['decimal revision', `handoff-${'b'.repeat(16)}-1.0`],
    ['exponent revision', `handoff-${'b'.repeat(16)}-1e3`],
    ['Unicode digit revision', `handoff-${'b'.repeat(16)}-\uff11`],
    ['leading-zero revision', `handoff-${'b'.repeat(16)}-01`],
    ['uppercase digest', `handoff-${'B'.repeat(16)}-1`],
    ['short digest', `handoff-${'b'.repeat(15)}-1`],
    ['long digest', `handoff-${'b'.repeat(17)}-1`],
    ['invalid digest character', `handoff-${'b'.repeat(15)}g-1`],
    ['wrong separator', `handoff-${'b'.repeat(16)}_1`],
    ['wrong prefix', `session-${'b'.repeat(16)}-1`],
    ['former 128-byte fixture', 'h'.repeat(128)],
    ['embedded NUL', `handoff-${'b'.repeat(8)}\0${'b'.repeat(7)}-1`],
    ['surrounding whitespace', ` handoff-${'b'.repeat(16)}-1 `],
  ])('rejects session ID %s with total schema-stage no-effect evidence', async (_label, value) => {
    expect(() => strictHandoffSessionId(value, 'CORRUPT_PERSISTED_RECORD')).toThrowError(ProtocolError);
    const canonical = await pendingPersistedArtifacts();
    const malformed = mutateArtifactPayload(canonical, 'candidate', candidate => {
      candidate.handoffSessionId = value;
    });
    const result = await attemptRejectedRestart(malformed);
    expectTotalRestartRejection(result, malformed);
    expect(result).toMatchObject({ code: 'CORRUPT_PERSISTED_RECORD', stage: 'candidate_schema' });
  });

  it.each([
    ['candidate snapshot derivation', 'candidateId', (candidate: PersistedSnapshotCandidateV1) => (
      createCandidateId('f'.repeat(64))
    )],
    ['session physical-digest derivation', 'handoffSessionId', (candidate: PersistedSnapshotCandidateV1) => (
      createHandoffSessionId('f'.repeat(64), candidate.sourceRevision)
    )],
    ['session revision derivation', 'handoffSessionId', (candidate: PersistedSnapshotCandidateV1) => (
      createHandoffSessionId(candidate.physicalSourceDigest, candidate.sourceRevision + 1)
    )],
  ] as const)('rejects valid syntax with wrong %s using total no-effect evidence', async (
    _label,
    field,
    derive,
  ) => {
    const canonical = await pendingPersistedArtifacts();
    const malformed = mutateArtifactPayload(canonical, 'candidate', candidate => {
      candidate[field] = derive(candidate as unknown as PersistedSnapshotCandidateV1);
    });
    const result = await attemptRejectedRestart(malformed);
    expectTotalRestartRejection(result, malformed);
    expect(result).toMatchObject({ code: 'CORRUPT_PERSISTED_RECORD', stage: 'candidate_schema' });
  });

  it.each([
    ['candidate ID', 'candidate', 'candidateId', 'c'.repeat(153), 'candidate_schema'],
    ['candidate session', 'candidate', 'handoffSessionId', 'h'.repeat(128), 'candidate_schema'],
    ['authority candidate ID', 'authority', 'snapshotCandidateId', 'c'.repeat(153), 'authority_schema'],
    ['authority session', 'authority', 'handoffSessionId', 'h'.repeat(128), 'authority_schema'],
  ] as const)('rejects %s as schema, not payload bounds', async (
    _label,
    target,
    field,
    value,
    stage,
  ) => {
    const canonical = await pendingPersistedArtifacts();
    const malformed = mutateArtifactPayload(canonical, target, payload => {
      payload[field] = value;
    });
    const result = await attemptRejectedRestart(malformed);
    expectTotalRestartRejection(result, malformed);
    expect(result).toMatchObject({ code: 'CORRUPT_PERSISTED_RECORD', stage });
    expect(result.metrics.coordinatorConstructed).toBe(0);
    expect(result.metrics.persistenceWriteAttempted).toBe(0);
  });
});

describe('K-327H direct candidate-store collision policy', () => {
  async function committedCandidate(): Promise<{
    digest: string;
    authority: Readonly<PersistedHandoffAuthorityV1>;
    candidate: Readonly<PersistedSnapshotCandidateV1>;
    sources: DurablePhysicalSourceRegistry;
    observed: RestartMetrics;
  }> {
    const observed = restartMetrics();
    const boundary = metrics();
    const sources = new DurablePhysicalSourceRegistry(boundary, observed);
    const env = environment(boundary, sources);
    sources.initialize(rootA, userA);
    await env.context().write('note-a', 'v1');
    await expect(env.context().handoff({ crashAfterPending: true }))
      .rejects.toMatchObject({ code: 'CONTEXT_CRASHED' });
    const digest = physicalSourceDigest(rootA);
    const pending = sources.readAuthority(digest);
    const graph = buildBudgetGraph([['note-a', 'v1']], {
      sourceRevision: pending.sourceRevision,
    });
    const authority = bindAuthorityToCandidate(pending, graph.candidate);
    expect(sources.commitCandidate(digest, pending, authority, graph.candidate)).toBe('created');
    return { digest, authority, candidate: graph.candidate, sources, observed };
  }

  it('treats same-key byte-identical full-bound creation as idempotent zero mutation', async () => {
    const { digest, authority, candidate, sources, observed } = await committedCandidate();
    const before = sources.inspectDurableState(rootA);
    const beforeCapabilities = capabilitySnapshot(observed);
    const beforeBoundaryAttempts = observed.candidateCreateBoundaryAttempted;
    const beforeExisting = observed.candidateExistingKeyDetected;
    const beforeCollisions = observed.candidateCollisionDetected;

    expect(sources.commitCandidate(digest, authority, authority, candidate))
      .toBe('existing_identical');

    expect(sources.inspectDurableState(rootA)).toEqual(before);
    expect(capabilityDelta(beforeCapabilities, observed)).toEqual(Object.fromEntries(
      CAPABILITY_COUNTERS.map(counter => [counter, 0]),
    ));
    expect(observed.candidateCreateBoundaryAttempted - beforeBoundaryAttempts).toBe(1);
    expect(observed.candidateExistingKeyDetected - beforeExisting).toBe(1);
    expect(observed.candidateCollisionDetected - beforeCollisions).toBe(0);
    expect(observed.candidateFullBindingMismatchDetected).toBe(0);
    expect(observed.candidateOverwriteAttempted).toBe(0);
    expect(sources.candidateCount(rootA)).toBe(1);
    const existing = sources.readCandidate(digest)!;
    expect(serializeCandidate(existing)).toBe(serializeCandidate(candidate));
    exactCandidateBinding(authority, existing);
  });

  it('rejects a same-store-key different valid candidate with full-binding zero overwrite', async () => {
    const { digest, authority, candidate, sources, observed } = await committedCandidate();
    const conflictingGraph = buildBudgetGraph([['note-a', 'different-v2']], {
      sourceRevision: authority.sourceRevision,
    });
    const conflictingAuthority = bindAuthorityToCandidate(authority, conflictingGraph.candidate);
    exactCandidateBinding(conflictingAuthority, conflictingGraph.candidate);
    expect(conflictingGraph.candidate.candidateId).not.toBe(candidate.candidateId);
    expect(serializeCandidate(conflictingGraph.candidate)).not.toBe(serializeCandidate(candidate));
    const before = sources.inspectDurableState(rootA);
    const beforeCapabilities = capabilitySnapshot(observed);
    const beforeBoundaryAttempts = observed.candidateCreateBoundaryAttempted;
    const beforeExisting = observed.candidateExistingKeyDetected;
    const beforeCollisions = observed.candidateCollisionDetected;
    const beforeBindingMismatch = observed.candidateFullBindingMismatchDetected;

    expect(() => sources.probeCandidateCreateAtStoreKey(
      digest,
      authority,
      conflictingAuthority,
      conflictingGraph.candidate,
      candidate.candidateId,
    )).toThrowError(expect.objectContaining({ code: 'CANDIDATE_KEY_COLLISION' }));

    expect(sources.inspectDurableState(rootA)).toEqual(before);
    expect(capabilityDelta(beforeCapabilities, observed)).toEqual(Object.fromEntries(
      CAPABILITY_COUNTERS.map(counter => [counter, 0]),
    ));
    expect(observed.candidateCreateBoundaryAttempted - beforeBoundaryAttempts).toBe(1);
    expect(observed.candidateExistingKeyDetected - beforeExisting).toBe(1);
    expect(observed.candidateCollisionDetected - beforeCollisions).toBe(1);
    expect(observed.candidateFullBindingMismatchDetected - beforeBindingMismatch).toBe(1);
    expect(observed.candidateOverwriteAttempted).toBe(0);
    expect(sources.candidateCount(rootA)).toBe(1);
    const existing = sources.readCandidate(digest)!;
    expect(serializeCandidate(existing)).toBe(serializeCandidate(candidate));
    exactCandidateBinding(authority, existing);
  });
});

describe('K-327C null-prototype input normalization', () => {
  const nullRecord = <T extends object>(value: T): T => Object.assign(Object.create(null) as T, value);

  it('accepts a null-prototype physical identity and returns an ordinary record', () => {
    expect(Object.getPrototypeOf(parsePhysicalSourceIdentity(nullRecord(rootA)))).toBe(Object.prototype);
  });

  it('accepts a null-prototype logical scope and returns an ordinary record', () => {
    expect(Object.getPrototypeOf(parseLogicalScope(nullRecord(userA)))).toBe(Object.prototype);
  });

  it('accepts a null-prototype authority and nested scope without preserving either prototype', () => {
    const { authority } = candidateFixture();
    const parsed = parsePersistedAuthority(nullRecord({
      ...authority,
      logicalScope: nullRecord(authority.logicalScope),
    }));
    expect(Object.getPrototypeOf(parsed)).toBe(Object.prototype);
    expect(Object.getPrototypeOf(parsed.logicalScope)).toBe(Object.prototype);
  });

  it('accepts a null-prototype candidate and returns an ordinary record', () => {
    const { candidate } = candidateFixture();
    expect(Object.getPrototypeOf(parsePersistedCandidate(nullRecord(candidate)))).toBe(Object.prototype);
  });

  it.each([
    ['physical extra key', () => parsePhysicalSourceIdentity(nullRecord({ ...rootA, extra: true }))],
    ['scope missing key', () => {
      const value = nullRecord({ ...userA }) as Record<string, unknown>;
      delete value.userId;
      return parseLogicalScope(value);
    }],
    ['authority accessor', () => {
      const { authority } = candidateFixture();
      const value = nullRecord({ ...authority });
      Object.defineProperty(value, 'state', { enumerable: true, get: () => authority.state });
      return parsePersistedAuthority(value);
    }],
    ['candidate malformed value', () => {
      const { candidate } = candidateFixture();
      return parsePersistedCandidate(nullRecord({ ...candidate, sourceRevision: '1' }));
    }],
  ])('still rejects malformed null-prototype %s', (_label, operation) => {
    expect(operation).toThrowError(ProtocolError);
  });
});

describe('K-327C duplicate-aware JSON boundary', () => {
  it.each([
    ['root key', '{"id":1,"id":2}'],
    ['nested key', '{"outer":{"id":1,"id":2}}'],
    ['array element key', '[{"id":1,"id":2}]'],
    ['escaped equivalent key', '{"id":1,"\\u0069d":2}'],
    ['nested escaped equivalent key', '{"outer":{"userId":1,"user\\u0049d":2}}'],
    ['escaped quote key', '{"a\\\"b":1,"a\\u0022b":2}'],
    ['escaped backslash key', '{"a\\\\b":1,"a\\u005cb":2}'],
    ['solidus key', '{"a/b":1,"a\\/b":2}'],
    ['BMP key', '{"한":1,"\\uD55C":2}'],
    ['surrogate-pair key', '{"😀":1,"\\uD83D\\uDE00":2}'],
    ['lone-surrogate key', '{"\\ud800":1,"\\uD800":2}'],
  ])('rejects duplicate decoded %s before returning a value', (_label, bytes) => {
    expect(() => parseJsonUnknown(bytes)).toThrowError(expect.objectContaining({
      code: 'DUPLICATE_PERSISTED_JSON_KEY',
    }));
  });

  it('allows the same decoded key in separate objects', () => {
    expect(parseJsonUnknown('{"left":{"id":1},"right":{"id":2}}')).toEqual({
      left: { id: 1 }, right: { id: 2 },
    });
  });

  it('keeps parent and child duplicate scopes independent', () => {
    expect(parseJsonUnknown('{"id":1,"child":{"id":2}}')).toEqual({ id: 1, child: { id: 2 } });
  });
});

describe('K-327G production-shaped bounded persisted evidence', () => {
  const nestedArrays = (depth: number, terminal = '0'): string => (
    `${'['.repeat(depth)}${terminal}${']'.repeat(depth)}`
  );
  const nestedObjects = (depth: number, terminal = '0'): string => (
    `${'{"value":'.repeat(depth)}${terminal}${'}'.repeat(depth)}`
  );
  const alternating = (depth: number): string => {
    let value = '0';
    for (let index = 0; index < depth; index += 1) {
      value = index % 2 === 0 ? `[${value}]` : `{"value":${value}}`;
    }
    return value;
  };

  it('treats authority size as a production-shaped rejection ceiling, not a padded maximum', async () => {
    const representative = buildBudgetGraph([['note-a', 'v1']]);
    expect(utf8ByteLength(representative.authorityBytes))
      .toBeLessThan(MAX_AUTHORITY_PAYLOAD_UTF8_BYTES);
    await expectFullGraphRestart(representative);

    const oversized = cloneArtifacts(artifactsForGraph(representative));
    oversized.authorityBytes = JSON.stringify('a'.repeat(MAX_AUTHORITY_PAYLOAD_UTF8_BYTES));
    expect(utf8ByteLength(oversized.authorityBytes))
      .toBeGreaterThan(MAX_AUTHORITY_PAYLOAD_UTF8_BYTES);
    const result = await attemptRejectedRestart(oversized);
    expectTotalRestartRejection(result, oversized);
    expect(result).toMatchObject({ code: 'PERSISTED_AUTHORITY_TOO_LARGE', stage: 'raw_bounds' });
    expect(result.metrics.duplicateScanAttempted).toBe(0);
  });

  it('uses generated identifiers for a production high-water candidate and raw rejection ceiling', async () => {
    const records = maximumNestedRecords();
    const highWater = buildBudgetGraph(records);
    const highWaterBytes = utf8ByteLength(highWater.candidateBytes);
    expect(highWater.candidate.candidateId).toBe(createCandidateId(highWater.candidate.snapshotDigest));
    expect(highWater.candidate.candidateId).toHaveLength(34);
    expect(highWater.candidate.handoffSessionId).toBe(createHandoffSessionId(
      highWater.candidate.physicalSourceDigest,
      highWater.candidate.sourceRevision,
    ));
    expect(highWater.candidate.handoffSessionId).toHaveLength(41);
    expect(highWaterBytes).toBe(503_794);
    expect(MAX_CANDIDATE_PAYLOAD_UTF8_BYTES - highWaterBytes).toBe(206);
    const fixedEnvelopeBytes = utf8ByteLength(JSON.stringify({
      ...highWater.candidate,
      candidateId: '',
      handoffSessionId: '',
      records: [],
    }));
    const recordArrayCommaBytes = highWater.records.length - 1;
    expect(fixedEnvelopeBytes).toBe(624);
    expect(recordArrayCommaBytes).toBe(4_095);
    expect(fixedEnvelopeBytes
      + utf8ByteLength(highWater.candidate.candidateId)
      + utf8ByteLength(highWater.candidate.handoffSessionId)
      + MAX_TOTAL_SOURCE_RECORD_UTF8_BYTES
      + recordArrayCommaBytes).toBe(highWaterBytes);
    await expectFullGraphRestart(highWater);

    // Aggregate capture is the production-valid predecessor constraint. A raw
    // canonical candidate can still prove the independent pre-parse ceiling,
    // but it is deliberately not described as a schema-valid limit+1 pair.
    const rawOverRecords = records.map(([id, value], index) => Object.freeze([
      id,
      index === records.length - 1
        ? `${value}${'a'.repeat(MAX_CANDIDATE_PAYLOAD_UTF8_BYTES - highWaterBytes + 1)}`
        : value,
    ] as const));
    const over = buildBudgetGraph(rawOverRecords, { validate: false });
    expect(utf8ByteLength(over.candidateBytes)).toBe(MAX_CANDIDATE_PAYLOAD_UTF8_BYTES + 1);
    expect(utf8ByteLength(over.authorityBytes)).toBeLessThan(MAX_AUTHORITY_PAYLOAD_UTF8_BYTES);
    expect(over.candidate.candidateId).toBe(createCandidateId(over.candidate.snapshotDigest));
    expect(over.candidate.handoffSessionId).toBe(createHandoffSessionId(
      over.candidate.physicalSourceDigest,
      over.candidate.sourceRevision,
    ));
    expect(over.records.length).toBe(MAX_SOURCE_RECORD_COUNT);
    expect(utf8ByteLength(over.records.at(-1)![1])).toBeLessThanOrEqual(
      MAX_SOURCE_RECORD_VALUE_UTF8_BYTES,
    );
    expect(over.records.reduce(
      (sum, record) => sum + utf8ByteLength(JSON.stringify(record)),
      0,
    )).toBe(MAX_TOTAL_SOURCE_RECORD_UTF8_BYTES + 207);
    expect(JSON.stringify(JSON.parse(over.candidateBytes))).toBe(over.candidateBytes);
    const result = await attemptRejectedRestart(artifactsForGraph(over));
    expectTotalRestartRejection(result, artifactsForGraph(over));
    expect(result).toMatchObject({ code: 'PERSISTED_CANDIDATE_TOO_LARGE', stage: 'raw_bounds' });
    expect(result.metrics.duplicateScanAttempted).toBe(1);
  });

  it('proves one production-shaped snapshot reaches capture maxima and candidate high-water', async () => {
    const graph = buildBudgetGraph(maximumNestedRecords());
    const aggregate = graph.records.reduce(
      (sum, record) => sum + utf8ByteLength(JSON.stringify(record)),
      0,
    );
    expect({
      authority: utf8ByteLength(graph.authorityBytes),
      candidate: utf8ByteLength(graph.candidateBytes),
      aggregate,
      count: graph.records.length,
      wholeRecord: utf8ByteLength(JSON.stringify(graph.records[0])),
      id: utf8ByteLength(graph.records[0]![0]),
      value: utf8ByteLength(graph.records[0]![1]),
    }).toEqual({
      authority: expect.any(Number),
      candidate: 503_794,
      aggregate: MAX_TOTAL_SOURCE_RECORD_UTF8_BYTES,
      count: MAX_SOURCE_RECORD_COUNT,
      wholeRecord: 121_543,
      id: MAX_SOURCE_RECORD_ID_UTF8_BYTES,
      value: MAX_SOURCE_RECORD_VALUE_UTF8_BYTES,
    });
    expect(utf8ByteLength(graph.authorityBytes)).toBeLessThan(MAX_AUTHORITY_PAYLOAD_UTF8_BYTES);
    expect(utf8ByteLength(graph.authorityBytes) + utf8ByteLength(graph.candidateBytes)
      + APPLICATION_TRANSACTION_RESERVE_UTF8_BYTES).toBeLessThan(MAX_TRANSACTION_WRITE_UTF8_BYTES);
    await expectFullGraphRestart(graph);
  });

  it('uses exact application-level transaction ceiling and limit+1 evidence', async () => {
    const records = maximumNestedRecords();
    const base = buildBudgetGraph(records, { scope: logicalScopeWithAsciiPadding(0) });
    const requiredAuthorityBytes = MAX_TRANSACTION_WRITE_UTF8_BYTES
      - utf8ByteLength(base.candidateBytes)
      - APPLICATION_TRANSACTION_RESERVE_UTF8_BYTES;
    const requiredPadding = requiredAuthorityBytes - utf8ByteLength(base.authorityBytes);
    const exact = buildBudgetGraph(records, { scope: logicalScopeWithAsciiPadding(requiredPadding) });
    const exactBytes = utf8ByteLength(exact.authorityBytes) + utf8ByteLength(exact.candidateBytes)
      + APPLICATION_TRANSACTION_RESERVE_UTF8_BYTES;
    expect(utf8ByteLength(exact.authorityBytes)).toBe(1_302);
    expect(utf8ByteLength(exact.candidateBytes)).toBe(503_794);
    expect(exactBytes).toBe(MAX_TRANSACTION_WRITE_UTF8_BYTES);
    await expectFullGraphRestart(exact);

    const over = buildBudgetGraph(records, {
      scope: logicalScopeWithAsciiPadding(requiredPadding + 1),
    });
    expect(utf8ByteLength(over.authorityBytes)).toBeLessThan(MAX_AUTHORITY_PAYLOAD_UTF8_BYTES);
    expect(utf8ByteLength(over.authorityBytes)).toBe(1_303);
    expect(utf8ByteLength(over.candidateBytes)).toBe(503_794);
    expect(utf8ByteLength(over.authorityBytes) + utf8ByteLength(over.candidateBytes)
      + APPLICATION_TRANSACTION_RESERVE_UTF8_BYTES).toBe(MAX_TRANSACTION_WRITE_UTF8_BYTES + 1);
    const artifacts = artifactsForGraph(over);
    const result = await attemptRejectedRestart(artifacts);
    expectTotalRestartRejection(result, artifacts);
    expect(result).toMatchObject({ code: 'PERSISTED_TRANSACTION_TOO_LARGE', stage: 'graph_bounds' });
  });

  it('enforces source record count at the exact limit and limit plus one', async () => {
    const atLimit = Array.from({ length: MAX_SOURCE_RECORD_COUNT }, (_, index) => (
      [index.toString().padStart(4, '0'), ''] as const
    ));
    expect(parseRecords(atLimit, 'CORRUPT_PERSISTED_RECORD')).toHaveLength(MAX_SOURCE_RECORD_COUNT);
    await expectFullGraphRestart(buildBudgetGraph(atLimit));
    const over = buildBudgetGraph([...atLimit, ['overflow', '']], { validate: false });
    const artifacts = artifactsForGraph(over);
    const result = await attemptRejectedRestart(artifacts);
    expectTotalRestartRejection(result, artifacts);
    expect(result).toMatchObject({
      code: 'PERSISTED_SOURCE_RECORD_COUNT_EXCEEDED',
      stage: 'capture_bounds',
    });
  });

  it('permanently proves simultaneous worst-case decoded field maxima fit the parent', () => {
    const one = ['\0'.repeat(MAX_SOURCE_RECORD_ID_UTF8_BYTES),
      '\0'.repeat(MAX_SOURCE_RECORD_VALUE_UTF8_BYTES)] as const;
    expect(utf8ByteLength(JSON.stringify(one))).toBe(121_543);
    expect(MAX_SOURCE_RECORD_UTF8_BYTES - utf8ByteLength(JSON.stringify(one))).toBe(9_529);
    expect(parseRecords([one], 'CORRUPT_PERSISTED_RECORD')).toEqual([one]);
    expect(() => parseRecords(
      [[one[0], `${one[1]}a`]],
      'CORRUPT_PERSISTED_RECORD',
    )).toThrowError(expect.objectContaining({ code: 'PERSISTED_SOURCE_RECORD_TOO_LARGE' }));
  });

  it('keeps exact ID and value field pairs valid under the whole-record parent', () => {
    const exactId = ['i'.repeat(MAX_SOURCE_RECORD_ID_UTF8_BYTES), ''] as const;
    const exactValue = ['id', 'v'.repeat(MAX_SOURCE_RECORD_VALUE_UTF8_BYTES)] as const;
    expect(parseRecords([exactId], 'CORRUPT_PERSISTED_RECORD')).toHaveLength(1);
    expect(parseRecords([exactValue], 'CORRUPT_PERSISTED_RECORD')).toHaveLength(1);
    expect(() => parseRecords([[`${exactId[0]}i`, '']], 'CORRUPT_PERSISTED_RECORD'))
      .toThrowError(expect.objectContaining({ code: 'PERSISTED_SOURCE_RECORD_TOO_LARGE' }));
    expect(() => parseRecords([['id', `${exactValue[1]}v`]], 'CORRUPT_PERSISTED_RECORD'))
      .toThrowError(expect.objectContaining({ code: 'PERSISTED_SOURCE_RECORD_TOO_LARGE' }));
  });

  it('single-counts an exact capture aggregate separately from persisted-object budgets', async () => {
    const exactRecords = exactAggregateFourRecords();
    expect(exactRecords.reduce((sum, record) => sum + utf8ByteLength(JSON.stringify(record)), 0))
      .toBe(MAX_TOTAL_SOURCE_RECORD_UTF8_BYTES);
    const exact = buildBudgetGraph(exactRecords);
    expect(utf8ByteLength(exact.candidateBytes)).toBeLessThan(MAX_CANDIDATE_PAYLOAD_UTF8_BYTES);
    await expectFullGraphRestart(exact);

    const overRecords = exactRecords.map(([id, value], index) => (
      [id, index === exactRecords.length - 1 ? `${value}a` : value] as const
    ));
    const over = buildBudgetGraph(overRecords, { validate: false });
    expect(utf8ByteLength(over.candidateBytes)).toBeLessThan(MAX_CANDIDATE_PAYLOAD_UTF8_BYTES);
    const artifacts = artifactsForGraph(over);
    const result = await attemptRejectedRestart(artifacts);
    expectTotalRestartRejection(result, artifacts);
    expect(result).toMatchObject({ code: 'PERSISTED_SOURCE_RECORDS_TOO_LARGE', stage: 'capture_bounds' });
  });

  it('accepts only the four JSON whitespace characters between tokens', () => {
    expect(parseJsonUnknown('[ 1,\t2,\n3,\r4 ]')).toEqual([1, 2, 3, 4]);
    for (const whitespace of ['\u00a0', '\ufeff', '\u000b', '\u000c', '\u2028', '\u2029', '\u202f']) {
      expect(() => parseJsonUnknown(`[1,${whitespace}2]`)).toThrowError(expect.objectContaining({
        code: 'CORRUPT_PERSISTED_RECORD',
      }));
    }
    expect(parseJsonUnknown('"\uFEFF"')).toBe('\uFEFF');
  });

  it('applies the container-entry depth limit equally to arrays, objects, and mixed shapes', () => {
    for (const atLimit of [
      nestedArrays(MAX_PERSISTED_JSON_DEPTH),
      nestedObjects(MAX_PERSISTED_JSON_DEPTH),
      alternating(MAX_PERSISTED_JSON_DEPTH),
      nestedArrays(MAX_PERSISTED_JSON_DEPTH - 1, '[]'),
      nestedObjects(MAX_PERSISTED_JSON_DEPTH - 1, '{}'),
    ]) expect(() => parseJsonUnknown(atLimit)).not.toThrow();

    for (const over of [
      nestedArrays(MAX_PERSISTED_JSON_DEPTH + 1),
      nestedObjects(MAX_PERSISTED_JSON_DEPTH + 1),
      alternating(MAX_PERSISTED_JSON_DEPTH + 1),
      nestedArrays(MAX_PERSISTED_JSON_DEPTH, '[]'),
      nestedObjects(MAX_PERSISTED_JSON_DEPTH, '{}'),
    ]) expect(() => parseJsonUnknown(over)).toThrowError(expect.objectContaining({
      code: 'PERSISTED_JSON_DEPTH_EXCEEDED',
    }));

    expect(parseJsonUnknown(`[${nestedArrays(MAX_PERSISTED_JSON_DEPTH - 1)},${nestedArrays(
      MAX_PERSISTED_JSON_DEPTH - 1,
    )}]`)).toHaveLength(2);
  });

  it('uses the JSON.stringify lone-surrogate policy and TextEncoder-equivalent UTF-8 sizing', () => {
    const loneHigh = parseJsonUnknown('"\\ud800"');
    const loneLow = parseJsonUnknown('"\\udc00"');
    expect(loneHigh).toBe('\ud800');
    expect(loneLow).toBe('\udc00');
    expect(JSON.stringify(loneHigh)).toBe('"\\ud800"');
    expect(JSON.stringify(loneLow)).toBe('"\\udc00"');
    expect(utf8ByteLength(loneHigh as string)).toBe(3);
    expect(utf8ByteLength(loneLow as string)).toBe(3);
  });

  it('permanently differential-tests UTF-8 sizing against TextEncoder', () => {
    const fixed = [
      'ASCII', 'é', '한', '😀', '\ud800', '\udc00', '\ud800\ud800', '\udc00\udc00',
      '\udc00\ud800', `A\ud800B\udc00C`, `😀\ud800한\udc00é`, `${'한'.repeat(8)}😀`,
    ];
    const codeUnits = [0x0000, 0x0041, 0x007f, 0x0080, 0x07ff, 0x0800, 0xd7ff,
      0xd800, 0xdbff, 0xdc00, 0xdfff, 0xe000, 0xffff];
    const generated: string[] = [];
    let state = 0x327e;
    for (let sample = 0; sample < 64; sample += 1) {
      let value = '';
      for (let unit = 0; unit < 12; unit += 1) {
        state = (state * 1103515245 + 12345) >>> 0;
        value += String.fromCharCode(codeUnits[state % codeUnits.length]!);
      }
      generated.push(value);
    }
    const encoder = new TextEncoder();
    for (const value of [...fixed, ...generated]) {
      expect(utf8ByteLength(value)).toBe(encoder.encode(value).byteLength);
    }
  });

  it('permanently differential-tests UTF-8 early-stop behavior around every boundary', () => {
    const values = [
      'ASCII', 'é', '한', '😀', '\ud800', '\udc00', '\ud800\ud800', '\udc00\udc00',
      '\udc00\ud800', `A\ud800B\udc00C`, `😀\ud800한\udc00é`,
    ];
    const encoder = new TextEncoder();
    const expected = (value: string, stopAfter: number): number => {
      let bytes = 0;
      for (const character of value) {
        bytes += encoder.encode(character).byteLength;
        if (bytes > stopAfter) return bytes;
      }
      return bytes;
    };
    for (const value of values) {
      const full = encoder.encode(value).byteLength;
      for (const stopAfter of [Math.max(0, full - 1), full, full + 1]) {
        expect(utf8ByteLength(value, stopAfter)).toBe(expected(value, stopAfter));
      }
    }
  });

  it.each([
    ['0', 0], ['-0', -0], ['17', 17], ['-17', -17], ['1.25', 1.25],
    ['1e2', 100], ['1E+2', 100], ['1e-2', 0.01],
  ])('preserves valid JSON number grammar for %s', (bytes, expected) => {
    expect(Object.is(parseJsonUnknown(bytes), expected)).toBe(true);
  });

  it.each(['01', '1.', '.1', '+1', 'NaN', 'Infinity', '0x10', '1_000', '1e', '1e+'])
    ('rejects invalid JSON number grammar for %s', bytes => {
      expect(() => parseJsonUnknown(bytes)).toThrowError(expect.objectContaining({
        code: 'CORRUPT_PERSISTED_RECORD',
      }));
    });

  it('scans an adversarial numeric array monotonically without suffix copies', () => {
    const count = 400_000;
    const bytes = `[${'0,'.repeat(count - 1)}0]`;
    expect(utf8ByteLength(bytes)).toBeLessThan(MAX_STANDALONE_JSON_TEST_UTF8_BYTES);
    const reader = new StrictJsonReader(bytes);
    const parsed = reader.read() as number[];
    expect(parsed).toHaveLength(count);
    expect(reader.numberTokenCount).toBe(count);
    expect(reader.numberSuffixSliceCount).toBe(0);
    expect(reader.numberOffsetsMonotonic).toBe(true);
    expect(JSON.stringify(parsed)).toBe(bytes);
  });
});

describe('K-327G observable production-shaped restart capabilities', () => {
  it('measures exact first-finalization and idempotent-retry capability profiles', async () => {
    const canonical = await pendingPersistedArtifacts();
    const observed = restartMetrics();
    const sources = DurablePhysicalSourceRegistry.fromPersistedArtifacts(canonical, metrics(), observed);
    const restarted = environment(metrics(), sources);
    const context = restarted.context();
    const beforeFirst = capabilitySnapshot(observed);
    await expect(context.handoff()).resolves.toMatchObject({ entityCount: 1 });
    expect(capabilityDelta(beforeFirst, observed)).toEqual({
      persistenceReadAttempted: 2,
      persistenceWriteAttempted: 1,
      authorityWriteAttempted: 1,
      candidateWriteAttempted: 0,
      terminalWriteAttempted: 1,
      authorityRewriteAttempted: 0,
      sourceReadAttempted: 0,
      sourceCaptureAttempted: 0,
      sourceRecaptureAttempted: 0,
      snapshotDigestAttempted: 0,
      sourceMutationAttempted: 0,
      recordCreateAttempted: 0,
      recordDeleteAttempted: 0,
      authorityCreateAttempted: 0,
      candidateCreateAttempted: 0,
      candidateDeleteAttempted: 0,
      coordinatorConstructed: 0,
      finalizationAttempted: 1,
    });

    const beforeRetryState = sources.inspectDurableState(rootA);
    const beforeRetry = capabilitySnapshot(observed);
    await expect(context.handoff()).resolves.toMatchObject({ entityCount: 1 });
    expect(capabilityDelta(beforeRetry, observed)).toEqual({
      persistenceReadAttempted: 2,
      persistenceWriteAttempted: 0,
      authorityWriteAttempted: 0,
      candidateWriteAttempted: 0,
      terminalWriteAttempted: 0,
      authorityRewriteAttempted: 0,
      sourceReadAttempted: 0,
      sourceCaptureAttempted: 0,
      sourceRecaptureAttempted: 0,
      snapshotDigestAttempted: 0,
      sourceMutationAttempted: 0,
      recordCreateAttempted: 0,
      recordDeleteAttempted: 0,
      authorityCreateAttempted: 0,
      candidateCreateAttempted: 0,
      candidateDeleteAttempted: 0,
      coordinatorConstructed: 0,
      finalizationAttempted: 0,
    });
    expect(sources.inspectDurableState(rootA)).toEqual(beforeRetryState);
  });

  it('directly rejects after coordinator construction with the exact zero-write profile', async () => {
    const artifacts = await pendingPersistedArtifacts();
    const result = await attemptRejectedRestart(artifacts, { rejectAfterCoordinator: true });
    expectTotalRestartRejection(result, artifacts);
    expect(result).toMatchObject({ code: 'COORDINATOR_REJECTED', stage: 'coordinator' });
    expect(result.metrics).toMatchObject({
      persistenceReadAttempted: 2,
      coordinatorConstructed: 1,
      finalizationAttempted: 0,
      persistenceWriteAttempted: 0,
      authorityWriteAttempted: 0,
      terminalWriteAttempted: 0,
      sourceCaptureAttempted: 0,
      sourceMutationAttempted: 0,
    });
  });

  it('directly injects a finalization CAS mismatch with the exact zero-write profile', async () => {
    const artifacts = await pendingPersistedArtifacts();
    const result = await attemptRejectedRestart(artifacts, { forceFinalizationCasMismatch: true });
    expectTotalRestartRejection(result, artifacts);
    expect(result).toMatchObject({ code: 'AUTHORITY_CAS_MISMATCH', stage: 'finalization_cas' });
    expect(result.metrics).toMatchObject({
      persistenceReadAttempted: 2,
      coordinatorConstructed: 1,
      finalizationAttempted: 1,
      persistenceWriteAttempted: 0,
      authorityWriteAttempted: 0,
      terminalWriteAttempted: 0,
      sourceCaptureAttempted: 0,
      sourceMutationAttempted: 0,
    });
  });

  it('directly exercises every pre-coordinator rejection stage with zero effects', async () => {
    const canonical = await pendingPersistedArtifacts();
    const rawInput = cloneArtifacts(canonical);
    rawInput.authorityBytes = '{';
    const rawBounds = cloneArtifacts(canonical);
    rawBounds.authorityBytes = JSON.stringify('a'.repeat(MAX_AUTHORITY_PAYLOAD_UTF8_BYTES));
    const duplicate = cloneArtifacts(canonical);
    duplicate.authorityBytes = replaceOnce(
      duplicate.authorityBytes,
      `"recordType":"${AUTHORITY_RECORD_TYPE}"`,
      `"recordType":"${AUTHORITY_RECORD_TYPE}","recordType":"${AUTHORITY_RECORD_TYPE}"`,
    );
    const artifactSetSchema = { ...cloneArtifacts(canonical), extra: true };
    const authoritySchema = mutateArtifactPayload(canonical, 'authority', authority => {
      authority.recordType = 'wrong';
    });
    const candidateSchema = mutateArtifactPayload(canonical, 'candidate', candidate => {
      candidate.recordType = 'wrong';
    });
    const sourceSchema = {
      ...cloneArtifacts(canonical),
      legacySourceRecords: [['note-a', 1]],
    };
    const captureBounds = {
      ...cloneArtifacts(canonical),
      legacySourceRecords: [['note-a', 'a'.repeat(MAX_SOURCE_RECORD_VALUE_UTF8_BYTES + 1)]],
    };
    const maximumSemanticScope: LogicalAuthorityScopeV1 = {
      schemaVersion: 1,
      userId: `user-${'a'.repeat(251)}`,
      projectRef: `project-${'b'.repeat(248)}`,
      namespaceId: `namespace-${'c'.repeat(246)}`,
      deviceId: `device-${'d'.repeat(249)}`,
    };
    const graphBounds = artifactsForGraph(buildBudgetGraph(maximumNestedRecords(), {
      scope: maximumSemanticScope,
    }));
    const graphBinding = mutateArtifactPayload(canonical, 'candidate', candidate => {
      candidate.manifestDigest = '3'.repeat(64);
    });
    const canonicalBytes = cloneArtifacts(canonical);
    canonicalBytes.candidateEntries = [[
      canonicalBytes.candidateEntries[0]![0], `${canonicalBytes.candidateEntries[0]![1]} `,
    ]];
    const cases: ReadonlyArray<readonly [RestartFailureStage, unknown]> = [
      ['raw_input', rawInput],
      ['raw_bounds', rawBounds],
      ['duplicate_scan', duplicate],
      ['artifact_set_schema', artifactSetSchema],
      ['authority_schema', authoritySchema],
      ['candidate_schema', candidateSchema],
      ['source_schema', sourceSchema],
      ['capture_bounds', captureBounds],
      ['graph_bounds', graphBounds],
      ['graph_binding', graphBinding],
      ['canonical_bytes', canonicalBytes],
    ];
    for (const [stage, input] of cases) {
      const result = await attemptRejectedRestart(input);
      expectTotalRestartRejection(result, input);
      expect(result.stage).toBe(stage);
      expect(result.metrics.coordinatorConstructed).toBe(0);
      expect(result.metrics.finalizationAttempted).toBe(0);
    }
  });

  it('routes an identical authority rewrite through the real modeled object-store boundary', async () => {
    const observed = restartMetrics();
    const sources = new DurablePhysicalSourceRegistry(metrics(), observed);
    const env = environment(metrics(), sources);
    sources.initialize(rootA, userA);
    await env.context().write('note-a', 'v1');
    await expect(env.context().handoff({ crashAfterCandidateCommit: true }))
      .rejects.toMatchObject({ code: 'CONTEXT_CRASHED' });
    expect(observed).toMatchObject({
      persistenceWriteAttempted: 4,
      authorityWriteAttempted: 4,
      candidateWriteAttempted: 1,
      sourceMutationAttempted: 1,
      sourceCaptureAttempted: 1,
      sourceRecaptureAttempted: 0,
      snapshotDigestAttempted: 1,
      recordCreateAttempted: 2,
      authorityCreateAttempted: 1,
      candidateCreateAttempted: 1,
    });
    const bytes = sources.exportArtifacts(rootA).authorityBytes;
    const before = sources.inspectDurableState(rootA);
    const writesBeforeRewrite = observed.persistenceWriteAttempted;
    sources.rewriteAuthority(rootA, bytes);
    const after = sources.inspectDurableState(rootA);
    expect(after).toEqual(before);
    const identicalValueWriteAttempted = observed.persistenceWriteAttempted > writesBeforeRewrite;
    expect(identicalValueWriteAttempted).toBe(true);
    expect(observed.persistenceWriteAttempted - writesBeforeRewrite).toBe(1);
    expect(observed.authorityRewriteAttempted).toBe(1);
  });

  it('routes candidate deletion through the real modeled store boundary', async () => {
    const observed = restartMetrics();
    const sources = new DurablePhysicalSourceRegistry(metrics(), observed);
    const env = environment(metrics(), sources);
    sources.initialize(rootA, userA);
    await expect(env.context().handoff({ crashAfterCandidateCommit: true }))
      .rejects.toMatchObject({ code: 'CONTEXT_CRASHED' });
    const before = sources.inspectDurableState(rootA);
    expect(sources.deleteCandidate(rootA)).toBe(true);
    const after = sources.inspectDurableState(rootA);
    expect(after.candidateRecordCount).toBe(before.candidateRecordCount - 1);
    expect(after.candidateEntriesBytes).toBe('[]');
    expect(observed.recordDeleteAttempted).toBe(1);
    expect(observed.candidateDeleteAttempted).toBe(1);
    const writesAfterFirstDelete = observed.persistenceWriteAttempted;
    expect(sources.deleteCandidate(rootA)).toBe(false);
    expect(observed.persistenceWriteAttempted).toBe(writesAfterFirstDelete);
  });

  it('detects an explicitly invoked recapture boundary on a restarted registry', async () => {
    const observed = restartMetrics();
    const sources = DurablePhysicalSourceRegistry.fromPersistedArtifacts(
      await pendingPersistedArtifacts(),
      metrics(),
      observed,
    );
    expect(observed.sourceRecaptureAttempted).toBe(0);
    sources.captureSourceRecords(physicalSourceDigest(rootA));
    expect(observed.sourceCaptureAttempted).toBe(1);
    expect(observed.sourceRecaptureAttempted).toBe(1);
  });

  it('rejects an oversized captured record before snapshot hashing or candidate persistence', async () => {
    const observed = restartMetrics();
    const sources = new DurablePhysicalSourceRegistry(metrics(), observed);
    const env = environment(metrics(), sources);
    sources.initialize(rootA, userA);
    await env.context().write('note-a', 'a'.repeat(MAX_SOURCE_RECORD_VALUE_UTF8_BYTES + 1));
    await expect(env.context().handoff()).rejects.toMatchObject({
      code: 'PERSISTED_SOURCE_RECORD_TOO_LARGE',
    });
    expect(observed.sourceCaptureAttempted).toBe(1);
    expect(observed.snapshotDigestAttempted).toBe(0);
    expect(observed.candidateWriteAttempted).toBe(0);
  });

  it('inspects a null candidate field without claiming the candidate parser ran', () => {
    const source = new DurablePhysicalSourceRegistry(metrics());
    source.initialize(rootA, userA);
    const observed = restartMetrics();
    DurablePhysicalSourceRegistry.fromPersistedArtifacts(source.exportArtifacts(rootA), metrics(), observed);
    expect(observed.candidateFieldInspected).toBe(1);
    expect(observed.candidateParserInvoked).toBe(0);
    expect(observed.candidateSchemaValidated).toBe(1);
  });
});

describe('K-327G separate-payload restart and exact finalization', () => {
  it('rehydrates separate authority/candidate payloads and finalizes idempotently', async () => {
    const first = environment();
    first.sources.initialize(rootA, userA);
    await first.context().write('note-a', 'v1');
    await expect(first.context().handoff({ crashAfterCandidateCommit: true }))
      .rejects.toMatchObject({ code: 'CONTEXT_CRASHED' });
    const digest = physicalSourceDigest(rootA);
    const originalAuthority = first.sources.readAuthority(digest);
    const originalCandidate = first.sources.readCandidate(digest)!;
    const artifacts = first.sources.exportArtifacts(rootA);

    const restartEvidence = metrics();
    const restartedSources = DurablePhysicalSourceRegistry.fromPersistedArtifacts(
      cloneArtifacts(artifacts),
      restartEvidence,
    );
    const restarted = environment(restartEvidence, restartedSources);
    const rehydratedAuthority = restarted.sources.readAuthority(digest);
    const rehydratedCandidate = restarted.sources.readCandidate(digest)!;
    expect(rehydratedAuthority).not.toBe(originalAuthority);
    expect(rehydratedAuthority.logicalScope).not.toBe(originalAuthority.logicalScope);
    expect(rehydratedCandidate).not.toBe(originalCandidate);
    expect(rehydratedCandidate.records).not.toBe(originalCandidate.records);
    expect(rehydratedAuthority.state).toBe('snapshot_committed_pending_finalization');
    expect(rehydratedCandidate).toEqual(originalCandidate);

    const finalized = await restarted.context().handoff();
    expect(finalized).toEqual(originalCandidate);
    expect(restarted.sources.readAuthority(digest).state).toBe('read_only_handoff');
    await expect(restarted.context().handoff()).resolves.toEqual(finalized);
    expect(restarted.sources.candidateCount(rootA)).toBe(1);
  });

  const corruptions: Array<readonly [
    string,
    'authority' | 'candidate',
    (payload: Record<string, unknown>) => void,
  ]> = [
    ['candidate id mismatch', 'candidate', candidate => {
      candidate.candidateId = createCandidateId('f'.repeat(64));
    }],
    ['session mismatch', 'candidate', candidate => {
      candidate.handoffSessionId = createHandoffSessionId('f'.repeat(64), candidate.sourceRevision);
    }],
    ['candidate physical root mismatch', 'candidate', candidate => {
      candidate.physicalSourceDigest = '1'.repeat(64);
      candidate.handoffSessionId = createHandoffSessionId(
        candidate.physicalSourceDigest,
        candidate.sourceRevision,
      );
      candidate.rootDigest = computeRootDigest(
        candidate.physicalSourceDigest as string,
        candidate.logicalScopeDigest as string,
        candidate.sourceRevision as number,
        candidate.snapshotDigest as string,
      );
      candidate.manifestDigest = computeManifestDigest(
        candidate.candidateId as string,
        candidate.handoffSessionId as string,
        candidate.entityCount as number,
        candidate.rootDigest as string,
      );
    }],
    ['candidate logical scope mismatch', 'candidate', candidate => {
      candidate.logicalScopeDigest = '2'.repeat(64);
      candidate.rootDigest = computeRootDigest(
        candidate.physicalSourceDigest as string,
        candidate.logicalScopeDigest as string,
        candidate.sourceRevision as number,
        candidate.snapshotDigest as string,
      );
      candidate.manifestDigest = computeManifestDigest(
        candidate.candidateId as string,
        candidate.handoffSessionId as string,
        candidate.entityCount as number,
        candidate.rootDigest as string,
      );
    }],
    ['candidate revision lower', 'candidate', candidate => {
      candidate.sourceRevision = 0;
      candidate.handoffSessionId = createHandoffSessionId(
        candidate.physicalSourceDigest,
        candidate.sourceRevision,
      );
      candidate.rootDigest = computeRootDigest(
        candidate.physicalSourceDigest as string,
        candidate.logicalScopeDigest as string,
        candidate.sourceRevision as number,
        candidate.snapshotDigest as string,
      );
      candidate.manifestDigest = computeManifestDigest(
        candidate.candidateId as string,
        candidate.handoffSessionId as string,
        candidate.entityCount as number,
        candidate.rootDigest as string,
      );
    }],
    ['candidate revision higher', 'candidate', candidate => {
      candidate.sourceRevision = 2;
      candidate.handoffSessionId = createHandoffSessionId(
        candidate.physicalSourceDigest,
        candidate.sourceRevision,
      );
      candidate.rootDigest = computeRootDigest(
        candidate.physicalSourceDigest as string,
        candidate.logicalScopeDigest as string,
        candidate.sourceRevision as number,
        candidate.snapshotDigest as string,
      );
      candidate.manifestDigest = computeManifestDigest(
        candidate.candidateId as string,
        candidate.handoffSessionId as string,
        candidate.entityCount as number,
        candidate.rootDigest as string,
      );
    }],
    ['authority revision changed after candidate', 'authority', authority => {
      authority.sourceRevision = 2;
      authority.handoffSessionId = createHandoffSessionId(
        authority.physicalSourceDigest,
        authority.sourceRevision,
      );
    }],
    ['internally valid same-session replacement', 'candidate', candidate => {
      const records = parseRecords([['note-a', 'substitute']], 'CORRUPT_PERSISTED_RECORD');
      candidate.records = records;
      candidate.entityCount = records.length;
      candidate.snapshotDigest = computeSnapshotDigest(records);
      candidate.candidateId = createCandidateId(candidate.snapshotDigest);
      candidate.rootDigest = computeRootDigest(
        candidate.physicalSourceDigest as string,
        candidate.logicalScopeDigest as string,
        candidate.sourceRevision as number,
        candidate.snapshotDigest as string,
      );
      candidate.manifestDigest = computeManifestDigest(
        candidate.candidateId as string,
        candidate.handoffSessionId as string,
        candidate.entityCount as number,
        candidate.rootDigest as string,
      );
    }],
    ['snapshot digest mismatch', 'candidate', candidate => {
      candidate.snapshotDigest = '3'.repeat(64);
      candidate.candidateId = createCandidateId(candidate.snapshotDigest);
      candidate.rootDigest = computeRootDigest(
        candidate.physicalSourceDigest as string,
        candidate.logicalScopeDigest as string,
        candidate.sourceRevision as number,
        candidate.snapshotDigest as string,
      );
      candidate.manifestDigest = computeManifestDigest(
        candidate.candidateId as string,
        candidate.handoffSessionId as string,
        candidate.entityCount as number,
        candidate.rootDigest as string,
      );
    }],
    ['root digest mismatch', 'candidate', candidate => { candidate.rootDigest = '4'.repeat(64); }],
    ['manifest digest mismatch', 'candidate', candidate => { candidate.manifestDigest = '5'.repeat(64); }],
    ['authority version mismatch', 'authority', authority => { authority.schemaVersion = 2; }],
    ['candidate version mismatch', 'candidate', candidate => { candidate.schemaVersion = 2; }],
    ['authority coordinator mismatch', 'authority', authority => { authority.coordinatorVersion = 2; }],
    ['candidate coordinator mismatch', 'candidate', candidate => { candidate.coordinatorVersion = 2; }],
    ['authority discriminator mismatch', 'authority', authority => { authority.recordType = 'wrong'; }],
    ['candidate discriminator mismatch', 'candidate', candidate => { candidate.recordType = 'wrong'; }],
    ['authority scope changed', 'authority', authority => {
      (authority.logicalScope as Record<string, unknown>).userId = 'user-other';
      authority.logicalScopeDigest = logicalScopeDigest(authority.logicalScope);
    }],
    ['authority physical root changed', 'authority', authority => {
      authority.physicalSourceDigest = '6'.repeat(64);
      authority.handoffSessionId = createHandoffSessionId(
        authority.physicalSourceDigest,
        authority.sourceRevision,
      );
    }],
    ['numeric-string revision', 'candidate', candidate => { candidate.sourceRevision = '1'; }],
    ['unsafe revision', 'candidate', candidate => { candidate.sourceRevision = Number.MAX_SAFE_INTEGER + 1; }],
    ['negative revision', 'candidate', candidate => { candidate.sourceRevision = -1; }],
    ['malformed digest', 'candidate', candidate => { candidate.snapshotDigest = 'not-a-digest'; }],
    ['empty digest', 'candidate', candidate => { candidate.rootDigest = ''; }],
    ['object digest', 'candidate', candidate => { candidate.manifestDigest = {}; }],
    ['extra authority field', 'authority', authority => { authority.extra = true; }],
    ['extra candidate field', 'candidate', candidate => { candidate.extra = true; }],
    ['missing candidate field', 'candidate', candidate => { delete candidate.candidateId; }],
  ];

  it.each(corruptions)('%s is a total structured restart rejection', async (label, target, mutate) => {
    const corrupted = mutateArtifactPayload(await pendingPersistedArtifacts(), target, mutate);
    const result = await attemptRejectedRestart(corrupted);
    expectTotalRestartRejection(result, corrupted);
    expect(result.metrics.coordinatorConstructed).toBe(0);
    expect(result.metrics.finalizationAttempted).toBe(0);
    if (label === 'internally valid same-session replacement') {
      expect(result).toMatchObject({ code: 'PERSISTED_EVIDENCE_MISMATCH', stage: 'graph_binding' });
    }
  });

  const malformedArtifactCases: Array<readonly [string, (canonical: PersistedArtifactSetV1) => unknown]> = [
    ['null artifact set', () => null],
    ['array artifact set', () => []],
    ['primitive artifact set', () => 'artifacts'],
    ['missing authority bytes', canonical => { delete (canonical as Partial<PersistedArtifactSetV1>).authorityBytes; return canonical; }],
    ['null authority bytes', canonical => ({ ...canonical, authorityBytes: null })],
    ['missing candidate entries', canonical => { delete (canonical as Partial<PersistedArtifactSetV1>).candidateEntries; return canonical; }],
    ['null candidate entries', canonical => ({ ...canonical, candidateEntries: null })],
    ['two candidate entries', canonical => ({
      ...canonical,
      candidateEntries: [...canonical.candidateEntries, ['candidate-extra', canonical.candidateEntries[0]![1]]],
    })],
    ['missing candidate object', canonical => ({ ...canonical, candidateEntries: [] })],
    ['null candidate bytes', canonical => ({
      ...canonical,
      candidateEntries: [[canonical.candidateEntries[0]![0], null]],
    })],
    ['missing legacy source', canonical => { delete (canonical as Partial<PersistedArtifactSetV1>).legacySourceRecords; return canonical; }],
    ['extra artifact field', canonical => ({ ...canonical, extra: true })],
  ];

  it.each(malformedArtifactCases)('%s fails closed before coordinator construction', async (label, mutate) => {
    const malformed = mutate(cloneArtifacts(await pendingPersistedArtifacts()));
    const result = await attemptRejectedRestart(malformed);
    expectTotalRestartRejection(result, malformed);
    expect(result.metrics.coordinatorConstructed).toBe(0);
    expect(result.metrics.finalizationAttempted).toBe(0);
    if (label === 'null candidate bytes') {
      expect(result.metrics.candidateFieldInspected).toBe(1);
      expect(result.metrics.candidateParserInvoked).toBe(0);
    }
  });

  const duplicatePayloadCases: Array<readonly [
    string,
    'authority' | 'candidate',
    (canonical: string) => string,
  ]> = [
    ['authority field', 'authority', canonical => replaceOnce(
      canonical,
      `"recordType":"${AUTHORITY_RECORD_TYPE}"`,
      `"recordType":"${AUTHORITY_RECORD_TYPE}","recordType":"${AUTHORITY_RECORD_TYPE}"`,
    )],
    ['logical scope escaped field', 'authority', canonical => replaceOnce(
      canonical,
      '"userId":"user-a"',
      '"userId":"user-a","user\\u0049d":"user-a"',
    )],
    ['candidate field', 'candidate', canonical => replaceOnce(
      canonical,
      `"recordType":"${CANDIDATE_RECORD_TYPE}"`,
      `"recordType":"${CANDIDATE_RECORD_TYPE}","recordType":"${CANDIDATE_RECORD_TYPE}"`,
    )],
    ['nested snapshot array element object', 'candidate', canonical => replaceOnce(
      canonical,
      '"records":[["note-a","v1"]]',
      '"records":[{"id":"note-a","id":"note-a","value":"v1"}]',
    )],
  ];

  it.each(duplicatePayloadCases)('%s duplicate is rejected before schema parsing', async (_label, target, mutate) => {
    const duplicate = cloneArtifacts(await pendingPersistedArtifacts());
    if (target === 'authority') duplicate.authorityBytes = mutate(duplicate.authorityBytes);
    else duplicate.candidateEntries = [[duplicate.candidateEntries[0]![0], mutate(duplicate.candidateEntries[0]![1])]];
    const result = await attemptRejectedRestart(duplicate);
    expectTotalRestartRejection(result, duplicate);
    expect(result).toMatchObject({ code: 'DUPLICATE_PERSISTED_JSON_KEY', stage: 'duplicate_scan' });
    expect(result.metrics.duplicateScanAttempted).toBeGreaterThan(0);
    expect(result.metrics.coordinatorConstructed).toBe(0);
  });

  const noncanonicalCases: Array<readonly [string, 'authority' | 'candidate', (canonical: string) => string]> = [
    ['leading whitespace', 'authority', canonical => ` ${canonical}`],
    ['trailing whitespace', 'candidate', canonical => `${canonical} `],
    ['trailing newline', 'authority', canonical => `${canonical}\n`],
    ['trailing CRLF', 'candidate', canonical => `${canonical}\r\n`],
    ['inter-token whitespace', 'candidate', canonical => replaceOnce(canonical, '":"', '": "')],
    ['alternate exponent number', 'authority', canonical => replaceOnce(canonical, '"schemaVersion":1', '"schemaVersion":1e0')],
    ['escaped ASCII key', 'candidate', canonical => replaceOnce(canonical, '"recordType"', '"\\u0072ecordType"')],
    ['escaped ASCII value', 'authority', canonical => replaceOnce(canonical, '"userId":"user-a"', '"userId":"user-\\u0061"')],
    ['reordered authority fields', 'authority', canonical => {
      const payload = JSON.parse(canonical) as Record<string, unknown>;
      return JSON.stringify({ schemaVersion: payload.schemaVersion, ...payload });
    }],
  ];

  it.each(noncanonicalCases)('%s is rejected without normalization or rewrite', async (_label, target, mutate) => {
    const noncanonical = cloneArtifacts(await pendingPersistedArtifacts());
    if (target === 'authority') noncanonical.authorityBytes = mutate(noncanonical.authorityBytes);
    else noncanonical.candidateEntries = [[
      noncanonical.candidateEntries[0]![0], mutate(noncanonical.candidateEntries[0]![1]),
    ]];
    const result = await attemptRejectedRestart(noncanonical);
    expectTotalRestartRejection(result, noncanonical);
    expect(result).toMatchObject({ code: 'NONCANONICAL_PERSISTED_BYTES', stage: 'canonical_bytes' });
    expect(result.metrics.artifactSetSchemaValidated).toBe(1);
    expect(result.metrics.authoritySchemaValidated).toBe(1);
    expect(result.metrics.canonicalEqualityChecked).toBeGreaterThan(0);
    expect(result.metrics.coordinatorConstructed).toBe(0);
  });

  it('rejects negative-zero encoding of a semantic zero without normalization', async () => {
    const noncanonical = cloneArtifacts(await emptyPendingPersistedArtifacts());
    noncanonical.authorityBytes = noncanonical.authorityBytes
      .replaceAll('"sourceRevision":0', '"sourceRevision":-0');
    const result = await attemptRejectedRestart(noncanonical);
    expectTotalRestartRejection(result, noncanonical);
    expect(result).toMatchObject({ code: 'NONCANONICAL_PERSISTED_BYTES', stage: 'canonical_bytes' });
    expect(result.metrics.canonicalEqualityChecked).toBe(1);
    expect(result.metrics.coordinatorConstructed).toBe(0);
  });

  it.each([
    ['forward-slash escape', 'v/1', (bytes: string) => bytes.replaceAll('v/1', 'v\\/1')],
    ['Unicode escape instead of literal Unicode', '한', (bytes: string) => bytes.replaceAll('한', '\\uD55C')],
    ['surrogate-pair escapes instead of literal Unicode', '😀', (bytes: string) => (
      bytes.replaceAll('😀', '\\uD83D\\uDE00')
    )],
    ['alternate control-character escape', 'line\nfeed', (bytes: string) => (
      bytes.replaceAll('line\\nfeed', 'line\\u000Afeed')
    )],
  ])('rejects noncanonical %s without changing the decoded value', async (_label, value, mutate) => {
    const canonical = await pendingPersistedArtifacts(value);
    const noncanonical = cloneArtifacts(canonical);
    noncanonical.candidateEntries = [[
      noncanonical.candidateEntries[0]![0], mutate(noncanonical.candidateEntries[0]![1]),
    ]];
    expect(noncanonical.candidateEntries[0]![1]).not.toBe(canonical.candidateEntries[0]![1]);
    const result = await attemptRejectedRestart(noncanonical);
    expectTotalRestartRejection(result, noncanonical);
    expect(result).toMatchObject({ code: 'NONCANONICAL_PERSISTED_BYTES', stage: 'canonical_bytes' });
    expect(result.metrics.canonicalEqualityChecked).toBeGreaterThan(0);
    expect(result.metrics.coordinatorConstructed).toBe(0);
  });

  it('preserves exact canonical bytes across restart without rewriting evidence', async () => {
    const canonical = await pendingPersistedArtifacts();
    const stages = restartMetrics();
    const restarted = DurablePhysicalSourceRegistry.fromPersistedArtifacts(canonical, metrics(), stages);
    expect(restarted.exportArtifacts(rootA)).toEqual(canonical);
    expect(stages).toMatchObject({
      duplicateScanCompleted: 2,
      jsonValueConstructed: 2,
      canonicalEqualityChecked: 2,
      coordinatorConstructed: 0,
      persistenceWriteAttempted: 0,
    });
  });
});

describe('K-327B deterministic named-lock ordering', () => {
  it('drains an authorized writer that acquired first and captures its exact revision', async () => {
    const env = environment();
    env.sources.initialize(rootA, userA);
    const release = new Deferred();
    const writer = env.context().write('note-a', 'v1', { afterAuthorityRead: () => release.promise });
    const handoff = env.context().handoff();
    release.resolve();
    await expect(writer).resolves.toBe(1);
    await expect(handoff).resolves.toMatchObject({ sourceRevision: 1, records: [['note-a', 'v1']] });
  });

  it('makes a stale writer acquire first, reject under current authority, and lets handoff capture no stale write', async () => {
    const env = environment();
    env.sources.initialize(rootA, userB);
    const release = new Deferred();
    let handoffAcquired = false;
    const staleWrite = env.context(rootA, userA).write('note-stale', 'blocked', {
      afterLockAcquired: () => release.promise,
    });
    const handoff = env.context(rootA, userB).handoff({
      afterLockAcquired: () => { handoffAcquired = true; },
    });
    await Promise.resolve();
    expect(handoffAcquired).toBe(false);
    release.resolve();
    await expect(staleWrite).rejects.toMatchObject({ code: 'SCOPE_MISMATCH' });
    await expect(handoff).resolves.toMatchObject({ sourceRevision: 0, records: [] });
    expect(env.sources.size).toBe(1);
  });

  it('gives a handoff-first stale-account write zero source, revision, authority, session, or candidate effect', async () => {
    const env = environment();
    env.sources.initialize(rootA, userB);
    await env.context(rootA, userB).write('note-current', 'v1');
    const release = new Deferred();
    const candidateCommitted = new Deferred();
    const handoff = env.context(rootA, userB).handoff({
      afterCandidateCommit: () => { candidateCommitted.resolve(); return release.promise; },
    });
    await candidateCommitted.promise;
    const staleWrite = env.context(rootA, userA).write('note-stale', 'blocked');
    release.resolve();
    await expect(handoff).resolves.toMatchObject({ sourceRevision: 1 });
    const digest = physicalSourceDigest(rootA);
    const terminalAuthority = env.sources.readAuthority(digest);
    const terminalCandidate = env.sources.readCandidate(digest);
    const terminalSource = env.sources.sourceRecords(digest);
    await expect(staleWrite).rejects.toMatchObject({ code: 'SCOPE_MISMATCH' });
    expect(env.sources.readAuthority(digest)).toEqual(terminalAuthority);
    expect(env.sources.readCandidate(digest)).toEqual(terminalCandidate);
    expect(env.sources.sourceRecords(digest)).toEqual(terminalSource);
    expect(env.sources.candidateCount(rootA)).toBe(1);
    expect(env.sources.size).toBe(1);
  });

  it('rejects a writer queued after the write-exclusion point', async () => {
    const env = environment();
    env.sources.initialize(rootA, userA);
    const release = new Deferred();
    const handoff = env.context().handoff({ afterPendingCommit: () => release.promise });
    await Promise.resolve();
    const lateWriter = env.context().write('note-late', 'blocked');
    release.resolve();
    await handoff;
    await expect(lateWriter).rejects.toMatchObject({ code: 'SOURCE_READ_ONLY' });
    expect(env.sources.sourceRecords(physicalSourceDigest(rootA))).toEqual([]);
  });

  it('releases coordination after a writer crash without a partial mutation', async () => {
    const env = environment();
    env.sources.initialize(rootA, userA);
    await expect(env.context().write('note-a', 'partial', { crashBeforeCommit: true }))
      .rejects.toMatchObject({ code: 'CONTEXT_CRASHED' });
    await expect(env.context().handoff()).resolves.toMatchObject({ sourceRevision: 0, records: [] });
  });

  it('keeps crash-after-pending fail-closed, resumable, and cancellable only before a candidate', async () => {
    const env = environment();
    env.sources.initialize(rootA, userA);
    await expect(env.context().handoff({ crashAfterPending: true }))
      .rejects.toMatchObject({ code: 'CONTEXT_CRASHED' });
    await expect(env.context().write('note-late', 'blocked'))
      .rejects.toMatchObject({ code: 'SOURCE_READ_ONLY' });
    await env.context().cancelBeforeSnapshot();
    await expect(env.context().write('note-a', 'after-cancel')).resolves.toBe(1);
    await expect(env.context().handoff({ crashAfterCandidateCommit: true }))
      .rejects.toMatchObject({ code: 'CONTEXT_CRASHED' });
    await expect(env.context().cancelBeforeSnapshot())
      .rejects.toMatchObject({ code: 'CANCELLATION_NOT_ALLOWED' });
  });

  it('rejects absent, duplicate, malformed, and unsupported authority paths', async () => {
    const env = environment();
    await expect(env.context().write('note-a', 'absent')).rejects.toMatchObject({ code: 'AUTHORITY_NOT_FOUND' });
    env.sources.initialize(rootA, userA);
    expect(() => env.sources.initialize(rootA, userB))
      .toThrowError(expect.objectContaining({ code: 'AUTHORITY_ALREADY_EXISTS' }));
    expect(() => env.context(rootA, userA, false).handoff())
      .toThrowError(expect.objectContaining({ code: 'COORDINATOR_UNAVAILABLE' }));
  });
});
