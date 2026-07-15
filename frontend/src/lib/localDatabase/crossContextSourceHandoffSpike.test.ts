import { createHash } from 'node:crypto';
import { types as nodeTypes } from 'node:util';
import { describe, expect, it } from 'vitest';

const AUTHORITY_RECORD_TYPE = 'absinthe_handoff_authority' as const;
const CANDIDATE_RECORD_TYPE = 'absinthe_handoff_snapshot_candidate' as const;
const ROOT_RECORD_TYPE = 'absinthe_handoff_test_root' as const;
const SCHEMA_VERSION = 1 as const;
const COORDINATOR_VERSION = 1 as const;
const PERSISTED_BYTE_FORMAT_VERSION = 1 as const;
const MAX_PERSISTED_JSON_DEPTH = 64;
// K-327E byte-format-v1 is one nested budget, not a set of independent maxima.
// The maximum-valid fixture below simultaneously reaches every byte/count limit
// except JSON depth. The root stores the records once in the candidate and once
// as the source image, so both persisted occurrences are included.
const MAX_PERSISTED_ENVELOPE_UTF8_BYTES = 1_036_335;
const MAX_AUTHORITY_UTF8_BYTES = 7_000;
const MAX_CANDIDATE_UTF8_BYTES = 514_998;
const MAX_SOURCE_RECORD_COUNT = 4096;
const MAX_SOURCE_RECORD_UTF8_BYTES = 127_537;
const MAX_TOTAL_SOURCE_RECORD_UTF8_BYTES = 510_024;
const MAX_SOURCE_RECORD_ID_UTF8_BYTES = 256;
const MAX_SOURCE_RECORD_VALUE_UTF8_BYTES = 21_000;
const MAX_IDENTITY_LENGTH = 256;
const MAX_ORIGIN_LENGTH = 2048;
const MAX_RECORD_VALUE_LENGTH = 1_048_576;
const DIGEST = /^[a-f0-9]{64}$/;
const IDENTIFIER = /^[A-Za-z0-9:_-]+$/;
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
  | 'root_schema'
  | 'authority_schema'
  | 'candidate_schema'
  | 'source_schema'
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
  rootSchemaValidated: number;
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
  rootRewriteAttempted: number;
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
}

function restartMetrics(): RestartMetrics {
  return {
    rawInputRead: 0,
    duplicateScanAttempted: 0,
    duplicateScanCompleted: 0,
    jsonValueConstructed: 0,
    rootSchemaValidated: 0,
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
    rootRewriteAttempted: 0,
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

function strictNullableString(value: unknown, code: string): string | null {
  return value === null ? null : strictString(value, code, { identifier: true, max: 128 });
}

function strictNullableDigest(value: unknown, code: string): string | null {
  return value === null ? null : strictDigest(value, code);
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
    const recordBytes = utf8ByteLength(JSON.stringify([id, value]));
    // The canonical tuple is authoritative. Field bounds are subordinate and
    // retain their own unconfounded fixtures below.
    if (recordBytes > MAX_SOURCE_RECORD_UTF8_BYTES) return fail('PERSISTED_SOURCE_RECORD_TOO_LARGE');
    requireUtf8Bound(id, MAX_SOURCE_RECORD_ID_UTF8_BYTES, 'PERSISTED_SOURCE_RECORD_TOO_LARGE');
    requireUtf8Bound(value, MAX_SOURCE_RECORD_VALUE_UTF8_BYTES, 'PERSISTED_SOURCE_RECORD_TOO_LARGE');
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
    handoffSessionId: strictNullableString(record.handoffSessionId, code),
    snapshotCandidateId: strictNullableString(record.snapshotCandidateId, code),
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
  requireUtf8Bound(JSON.stringify(authority), MAX_AUTHORITY_UTF8_BYTES, 'PERSISTED_AUTHORITY_TOO_LARGE');
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
    candidateId: strictString(record.candidateId, code, { identifier: true, max: 128 }),
    handoffSessionId: strictString(record.handoffSessionId, code, { identifier: true, max: 128 }),
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
  requireUtf8Bound(JSON.stringify(candidate), MAX_CANDIDATE_UTF8_BYTES, 'PERSISTED_CANDIDATE_TOO_LARGE');
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

function parseJsonUnknown(bytes: string): unknown {
  if (typeof bytes !== 'string' || bytes.length === 0) return fail('CORRUPT_PERSISTED_RECORD');
  requireUtf8Bound(bytes, MAX_PERSISTED_ENVELOPE_UTF8_BYTES, 'PERSISTED_ENVELOPE_TOO_LARGE');
  return new StrictJsonReader(bytes).read();
}

function parseCanonicalAuthorityBytes(bytes: string): Readonly<PersistedHandoffAuthorityV1> {
  const authority = parsePersistedAuthority(parseJsonUnknown(bytes));
  if (serializeAuthority(authority) !== bytes) return fail('NONCANONICAL_PERSISTED_BYTES');
  return authority;
}

function parseCanonicalCandidateBytes(bytes: string): Readonly<PersistedSnapshotCandidateV1> {
  const candidate = parsePersistedCandidate(parseJsonUnknown(bytes));
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

interface SerializedRootV1 {
  recordType: typeof ROOT_RECORD_TYPE;
  byteFormatVersion: 1;
  schemaVersion: 1;
  physicalSourceDigest: string;
  authority: PersistedHandoffAuthorityV1;
  candidate: PersistedSnapshotCandidateV1 | null;
  sourceRecords: ReadonlyArray<readonly [string, string]>;
}

interface DurableSlot {
  authorityBytes: string;
  candidateBytes: string | null;
  source: Map<string, string>;
}

interface DurableEvidenceObservation {
  rootBytes: string;
  authorityBytes: string | null;
  candidateBytes: string | null;
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
    this.slots.set(digest, { authorityBytes: serializeAuthority(authority), candidateBytes: null, source: new Map() });
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
    const bytes = this.slot(digest).candidateBytes;
    return bytes === null ? null : parseCanonicalCandidateBytes(bytes);
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
    if (serializeAuthority(current) !== serializeAuthority(expected) || slot.candidateBytes !== null) {
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
  ): void {
    const slot = this.slot(digest);
    const current = parseCanonicalAuthorityBytes(slot.authorityBytes);
    if (serializeAuthority(current) !== serializeAuthority(expected) || slot.candidateBytes !== null) {
      return fail('AUTHORITY_CAS_MISMATCH');
    }
    exactCandidateBinding(next, candidate);
    this.observe('persistenceWriteAttempted');
    this.observe('authorityWriteAttempted');
    this.observe('candidateWriteAttempted');
    this.observe('recordCreateAttempted');
    this.observe('candidateCreateAttempted');
    slot.candidateBytes = serializeCandidate(candidate);
    slot.authorityBytes = serializeAuthority(next);
    this.evidence.authorityWrites += 1;
  }

  finalizeCandidate(
    digest: string,
    expected: Readonly<PersistedHandoffAuthorityV1>,
    candidate: Readonly<PersistedSnapshotCandidateV1>,
  ): void {
    const slot = this.slot(digest);
    const current = parseCanonicalAuthorityBytes(slot.authorityBytes);
    const currentCandidate = slot.candidateBytes === null
      ? null
      : parseCanonicalCandidateBytes(slot.candidateBytes);
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

  serializeRoot(identityInput: unknown): string {
    const digest = physicalSourceDigest(identityInput);
    const authority = this.readAuthority(digest);
    const candidate = this.readCandidate(digest);
    const sourceRecords = parseRecords(this.sourceRecords(digest), 'CORRUPT_PERSISTED_RECORD');
    const root: SerializedRootV1 = {
      recordType: ROOT_RECORD_TYPE,
      byteFormatVersion: PERSISTED_BYTE_FORMAT_VERSION,
      schemaVersion: SCHEMA_VERSION,
      physicalSourceDigest: digest,
      authority,
      candidate,
      sourceRecords,
    };
    const bytes = JSON.stringify(root);
    requireUtf8Bound(bytes, MAX_PERSISTED_ENVELOPE_UTF8_BYTES, 'PERSISTED_ENVELOPE_TOO_LARGE');
    return bytes;
  }

  captureSourceRecords(digest: string): ReadonlyArray<readonly [string, string]> {
    this.observe('sourceCaptureAttempted');
    if (this.rehydrated) this.observe('sourceRecaptureAttempted');
    return this.sourceRecords(digest);
  }

  rewriteRoot(identityInput: unknown, bytes: string): void {
    const digest = physicalSourceDigest(identityInput);
    const replacement = DurablePhysicalSourceRegistry.fromSerializedRoot(bytes, metrics());
    const replacementSlot = replacement.slot(digest);
    this.observe('persistenceWriteAttempted');
    this.observe('rootRewriteAttempted');
    this.slots.set(digest, {
      authorityBytes: `${replacementSlot.authorityBytes}`,
      candidateBytes: replacementSlot.candidateBytes === null ? null : `${replacementSlot.candidateBytes}`,
      source: new Map(replacementSlot.source),
    });
  }

  deleteCandidate(identityInput: unknown): boolean {
    const slot = this.slot(physicalSourceDigest(identityInput));
    if (slot.candidateBytes === null) return false;
    this.observe('persistenceWriteAttempted');
    this.observe('recordDeleteAttempted');
    this.observe('candidateDeleteAttempted');
    slot.candidateBytes = null;
    return true;
  }

  inspectDurableState(identityInput: unknown): DurableEvidenceObservation {
    const digest = physicalSourceDigest(identityInput);
    const slot = this.slot(digest);
    const authority = parseCanonicalAuthorityBytes(slot.authorityBytes);
    const candidate = slot.candidateBytes === null ? null : parseCanonicalCandidateBytes(slot.candidateBytes);
    const sourceRecords = Object.freeze([...slot.source.entries()]
      .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
      .map(entry => Object.freeze([entry[0], entry[1]] as const)));
    const root: SerializedRootV1 = {
      recordType: ROOT_RECORD_TYPE,
      byteFormatVersion: PERSISTED_BYTE_FORMAT_VERSION,
      schemaVersion: SCHEMA_VERSION,
      physicalSourceDigest: digest,
      authority,
      candidate,
      sourceRecords,
    };
    return {
      rootBytes: JSON.stringify(root),
      authorityBytes: slot.authorityBytes,
      candidateBytes: slot.candidateBytes,
      authorityRecordCount: 1,
      candidateRecordCount: candidate === null ? 0 : 1,
      sourceRecordCount: sourceRecords.length,
      authorityState: authority.state,
    };
  }

  static fromSerializedRoot(
    bytes: string,
    evidence = metrics(),
    restart = restartMetrics(),
  ): DurablePhysicalSourceRegistry {
    restart.rawInputRead += 1;
    try {
      requireUtf8Bound(bytes, MAX_PERSISTED_ENVELOPE_UTF8_BYTES, 'PERSISTED_ENVELOPE_TOO_LARGE');
    } catch (error) {
      throw new ProtocolError(
        error instanceof ProtocolError ? error.code : 'PERSISTED_ENVELOPE_TOO_LARGE',
        'raw_bounds',
      );
    }
    restart.duplicateScanAttempted += 1;
    let unknownRoot: unknown;
    const reader = new StrictJsonReader(bytes);
    try {
      unknownRoot = reader.read();
      restart.duplicateScanCompleted += 1;
      restart.jsonValueConstructed += 1;
    } catch (error) {
      const code = error instanceof ProtocolError ? error.code : 'CORRUPT_PERSISTED_RECORD';
      throw new ProtocolError(code, code === 'DUPLICATE_PERSISTED_JSON_KEY' ? 'duplicate_scan' : 'raw_input');
    }
    const code = 'CORRUPT_PERSISTED_RECORD';
    let root: Record<string, unknown>;
    try {
      root = strictRecord(unknownRoot, [
        'recordType', 'byteFormatVersion', 'schemaVersion', 'physicalSourceDigest', 'authority',
        'candidate', 'sourceRecords',
      ], code);
      if (root.recordType !== ROOT_RECORD_TYPE
        || root.byteFormatVersion !== PERSISTED_BYTE_FORMAT_VERSION
        || root.schemaVersion !== SCHEMA_VERSION) return fail(code);
      restart.rootSchemaValidated += 1;
    } catch (error) {
      throw new ProtocolError(error instanceof ProtocolError ? error.code : code, 'root_schema');
    }
    const physicalDigest = strictDigest(root.physicalSourceDigest, code);
    try {
      const authorityBytes = reader.topLevelRawValues.get('authority');
      const candidateBytes = reader.topLevelRawValues.get('candidate');
      if (authorityBytes === undefined || candidateBytes === undefined) return fail(code);
      requireUtf8Bound(authorityBytes, MAX_AUTHORITY_UTF8_BYTES, 'PERSISTED_AUTHORITY_TOO_LARGE');
      requireUtf8Bound(candidateBytes, MAX_CANDIDATE_UTF8_BYTES, 'PERSISTED_CANDIDATE_TOO_LARGE');
    } catch (error) {
      throw new ProtocolError(error instanceof ProtocolError ? error.code : code, 'graph_bounds');
    }
    let authority: Readonly<PersistedHandoffAuthorityV1>;
    try {
      restart.authorityParserInvoked += 1;
      authority = parsePersistedAuthority(root.authority);
      restart.authoritySchemaValidated += 1;
    } catch (error) {
      throw new ProtocolError(error instanceof ProtocolError ? error.code : code, 'authority_schema');
    }
    let candidate: Readonly<PersistedSnapshotCandidateV1> | null;
    try {
      restart.candidateFieldInspected += 1;
      if (root.candidate === null) {
        candidate = null;
      } else {
        restart.candidateParserInvoked += 1;
        candidate = parsePersistedCandidate(root.candidate);
      }
      restart.candidateSchemaValidated += 1;
    } catch (error) {
      throw new ProtocolError(error instanceof ProtocolError ? error.code : code, 'candidate_schema');
    }
    let sourceRecords: ReadonlyArray<readonly [string, string]>;
    try {
      sourceRecords = parseRecords(root.sourceRecords, code);
      restart.sourceSchemaValidated += 1;
    } catch (error) {
      const failureCode = error instanceof ProtocolError ? error.code : code;
      throw new ProtocolError(
        failureCode,
        failureCode.startsWith('PERSISTED_SOURCE_') ? 'graph_bounds' : 'source_schema',
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
        if (JSON.stringify(sourceRecords) !== JSON.stringify(candidate.records)) {
          return fail('PERSISTED_EVIDENCE_MISMATCH');
        }
      }
      restart.graphBindingValidated += 1;
    } catch (error) {
      throw new ProtocolError(
        error instanceof ProtocolError ? error.code : 'PERSISTED_EVIDENCE_MISMATCH',
        'graph_binding',
      );
    }
    const canonicalRoot: SerializedRootV1 = {
      recordType: ROOT_RECORD_TYPE,
      byteFormatVersion: PERSISTED_BYTE_FORMAT_VERSION,
      schemaVersion: SCHEMA_VERSION,
      physicalSourceDigest: physicalDigest,
      authority,
      candidate,
      sourceRecords,
    };
    restart.canonicalEqualityChecked += 1;
    if (JSON.stringify(canonicalRoot) !== bytes) {
      throw new ProtocolError('NONCANONICAL_PERSISTED_BYTES', 'canonical_bytes');
    }
    const registry = new DurablePhysicalSourceRegistry(evidence, restart, true);
    registry.slots.set(physicalDigest, {
      authorityBytes: serializeAuthority(authority),
      candidateBytes: candidate ? serializeCandidate(candidate) : null,
      source: new Map(sourceRecords),
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
    return this.slot(physicalSourceDigest(identityInput)).candidateBytes === null ? 0 : 1;
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
          handoffSessionId: `handoff-${digest.slice(0, 16)}-${authority.sourceRevision}`,
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
        const candidateId = `candidate-${snapshotDigest.slice(0, 24)}`;
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
      // HANDOFF_LINEARIZATION_POINT: one exact CAS binds the persisted candidate terminally.
      if (this.observed) this.observed.finalizationAttempted += 1;
      this.sources.finalizeCandidate(digest, authority, candidate);
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
  const handoffSessionId = `handoff-${physicalDigest.slice(0, 16)}-${sourceRevision}`;
  const snapshotDigest = computeSnapshotDigest(records);
  const candidateId = `candidate-${snapshotDigest.slice(0, 24)}`;
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

interface CanonicalBudgetGraph {
  scope: Readonly<LogicalAuthorityScopeV1>;
  authority: Readonly<PersistedHandoffAuthorityV1>;
  candidate: Readonly<PersistedSnapshotCandidateV1>;
  records: ReadonlyArray<readonly [string, string]>;
  authorityBytes: string;
  candidateBytes: string;
  sourceRecordsBytes: string;
  rootBytes: string;
}

interface BudgetGraphOptions {
  scope?: LogicalAuthorityScopeV1;
  candidateId?: string;
  handoffSessionId?: string;
  sourceRevision?: number;
  validate?: boolean;
}

const MAX_BUDGET_SCOPE: LogicalAuthorityScopeV1 = {
  schemaVersion: 1,
  // JSON escaping makes U+0000 six canonical bytes. This precise mixture gives
  // a 7,000-byte bound authority while retaining one schema-valid byte of room
  // for the authority limit+1 pair.
  userId: `${'a'.repeat(26)}${'\u00e9'}${'\0'.repeat(229)}`,
  projectRef: '\0'.repeat(256),
  namespaceId: '\0'.repeat(256),
  deviceId: '\0'.repeat(256),
};

const OVER_AUTHORITY_SCOPE: LogicalAuthorityScopeV1 = {
  ...MAX_BUDGET_SCOPE,
  userId: `${'a'.repeat(25)}${'\u00e9'.repeat(2)}${'\0'.repeat(229)}`,
};

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
  const sourceRevision = options.sourceRevision ?? Number.MAX_SAFE_INTEGER;
  const handoffSessionId = options.handoffSessionId ?? 'h'.repeat(128);
  const candidateId = options.candidateId ?? 'c'.repeat(127);
  const snapshotDigest = computeSnapshotDigest(records);
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
  const root: SerializedRootV1 = {
    recordType: ROOT_RECORD_TYPE,
    byteFormatVersion: PERSISTED_BYTE_FORMAT_VERSION,
    schemaVersion: SCHEMA_VERSION,
    physicalSourceDigest: physicalDigest,
    authority,
    candidate,
    sourceRecords: records,
  };
  return {
    scope,
    authority,
    candidate,
    records,
    authorityBytes: JSON.stringify(authority),
    candidateBytes: JSON.stringify(candidate),
    sourceRecordsBytes: JSON.stringify(records),
    rootBytes: JSON.stringify(root),
  };
}

function maximumNestedRecords(): ReadonlyArray<readonly [string, string]> {
  const records: Array<[string, string]> = [[
    '\0'.repeat(MAX_SOURCE_RECORD_ID_UTF8_BYTES),
    '\0'.repeat(MAX_SOURCE_RECORD_VALUE_UTF8_BYTES - 1),
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
    '\0'.repeat(MAX_SOURCE_RECORD_VALUE_UTF8_BYTES - 1),
  ]);
  // Four maximum records total 510,148 bytes. Twenty U+0000 -> ASCII
  // substitutions remove 100 canonical bytes and removing four more U+0000
  // values removes 24, yielding the exact 510,024-byte aggregate.
  records[0]![1] = `${'a'.repeat(20)}${'\0'.repeat(MAX_SOURCE_RECORD_VALUE_UTF8_BYTES - 25)}`;
  return parseRecords(records, 'CORRUPT_PERSISTED_RECORD');
}

async function expectFullGraphRestart(graph: CanonicalBudgetGraph): Promise<RestartMetrics> {
  const observed = restartMetrics();
  const sources = DurablePhysicalSourceRegistry.fromSerializedRoot(graph.rootBytes, metrics(), observed);
  const context = environment(metrics(), sources).context(rootA, graph.scope);
  await expect(context.handoff()).resolves.toEqual(graph.candidate);
  expect(sources.readAuthority(physicalSourceDigest(rootA)).state).toBe('read_only_handoff');
  return observed;
}

function mutateSerializedRoot(bytes: string, mutate: (root: Record<string, unknown>) => void): string {
  const root = JSON.parse(bytes) as Record<string, unknown>;
  mutate(root);
  return JSON.stringify(root);
}

function nestedRecord(root: Record<string, unknown>, key: string): Record<string, unknown> {
  return root[key] as Record<string, unknown>;
}

async function pendingSerializedRoot(value = 'v1'): Promise<string> {
  const env = environment();
  env.sources.initialize(rootA, userA);
  await env.context().write('note-a', value);
  await expect(env.context().handoff({ crashAfterCandidateCommit: true }))
    .rejects.toMatchObject({ code: 'CONTEXT_CRASHED' });
  return env.sources.serializeRoot(rootA);
}

async function emptyPendingSerializedRoot(): Promise<string> {
  const env = environment();
  env.sources.initialize(rootA, userA);
  await expect(env.context().handoff({ crashAfterCandidateCommit: true }))
    .rejects.toMatchObject({ code: 'CONTEXT_CRASHED' });
  return env.sources.serializeRoot(rootA);
}

interface RestartRejectionResult {
  accepted: false;
  code: string;
  stage: RestartFailureStage;
  inputBytesBefore: string;
  inputBytesAfter: string;
  authorityBytesBefore: string | null;
  authorityBytesAfter: string | null;
  candidateBytesBefore: string | null;
  candidateBytesAfter: string | null;
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

function rawEvidenceSnapshot(bytes: string): DurableEvidenceObservation {
  const absent: DurableEvidenceObservation = {
    rootBytes: bytes,
    authorityBytes: null,
    candidateBytes: null,
    authorityRecordCount: 0,
    candidateRecordCount: 0,
    sourceRecordCount: 0,
    authorityState: null,
  };
  if (utf8ByteLength(bytes, MAX_PERSISTED_ENVELOPE_UTF8_BYTES)
    > MAX_PERSISTED_ENVELOPE_UTF8_BYTES) return absent;
  const reader = new StrictJsonReader(bytes);
  let parsed: unknown;
  try {
    parsed = reader.read();
  } catch {
    // The immutable root bytes remain the authoritative snapshot when a nested value is unreadable.
  }
  const root = typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
    ? parsed as Record<string, unknown>
    : null;
  const authority = root && typeof root.authority === 'object' && root.authority !== null
    ? root.authority as Record<string, unknown>
    : null;
  const authorityState = authority && typeof authority.state === 'string'
    && ['writable', 'handoff_pending', 'snapshot_committed_pending_finalization', 'read_only_handoff']
      .includes(authority.state)
    ? authority.state as AuthorityState
    : null;
  const authorityBytes = reader.topLevelRawValues.get('authority') ?? null;
  const candidateBytes = reader.topLevelRawValues.get('candidate') ?? null;
  return {
    rootBytes: bytes,
    authorityBytes,
    candidateBytes,
    authorityRecordCount: authorityBytes !== null && authorityBytes !== 'null' ? 1 : 0,
    candidateRecordCount: candidateBytes !== null && candidateBytes !== 'null' ? 1 : 0,
    sourceRecordCount: root && Array.isArray(root.sourceRecords) ? root.sourceRecords.length : 0,
    authorityState,
  };
}

async function attemptRejectedRestart(bytes: string): Promise<RestartRejectionResult> {
  const stages = restartMetrics();
  const evidence = metrics();
  const inputBytesBefore = bytes;
  const rawBefore = rawEvidenceSnapshot(bytes);
  let before: DurableEvidenceObservation = rawBefore;
  let sources: DurablePhysicalSourceRegistry | undefined;
  let code = 'RESTART_UNEXPECTEDLY_ACCEPTED';
  let errorMessage = code;
  let stage: RestartFailureStage = 'raw_input';
  try {
    sources = DurablePhysicalSourceRegistry.fromSerializedRoot(bytes, evidence, stages);
    before = sources.inspectDurableState(rootA);
    try {
      await environment(evidence, sources).context().handoff();
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
  const after = sources ? sources.inspectDurableState(rootA) : rawEvidenceSnapshot(bytes);
  const evidenceRewritten = before.rootBytes !== after.rootBytes
    || before.authorityBytes !== after.authorityBytes
    || before.candidateBytes !== after.candidateBytes;
  const beforeRecordCount = before.authorityRecordCount + before.candidateRecordCount;
  const afterRecordCount = after.authorityRecordCount + after.candidateRecordCount;
  return {
    accepted: false,
    code,
    stage,
    inputBytesBefore,
    inputBytesAfter: bytes,
    authorityBytesBefore: rawBefore.authorityBytes,
    authorityBytesAfter: after.authorityBytes,
    candidateBytesBefore: rawBefore.candidateBytes,
    candidateBytesAfter: after.candidateBytes,
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
    payloadExposed: errorMessage !== code || (bytes.length > 0 && errorMessage.includes(bytes)),
  };
}

const CAPABILITY_COUNTERS = [
  'persistenceReadAttempted', 'persistenceWriteAttempted',
  'authorityWriteAttempted', 'candidateWriteAttempted', 'terminalWriteAttempted',
  'rootRewriteAttempted', 'sourceReadAttempted', 'sourceCaptureAttempted',
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
  root_schema: new Set(),
  authority_schema: new Set(),
  candidate_schema: new Set(),
  source_schema: new Set(),
  graph_bounds: new Set(),
  graph_binding: new Set(),
  canonical_bytes: new Set(),
  coordinator: new Set(['persistenceReadAttempted', 'coordinatorConstructed']),
  finalization_cas: new Set([
    'persistenceReadAttempted', 'coordinatorConstructed', 'finalizationAttempted',
  ]),
};

function expectTotalRestartRejection(result: RestartRejectionResult, original: string): void {
  expect(result.accepted).toBe(false);
  expect(result.code).not.toBe('RESTART_UNEXPECTEDLY_ACCEPTED');
  expect(result.inputBytesBefore).toBe(original);
  expect(result.inputBytesAfter).toBe(original);
  expect(result.authorityBytesAfter).toBe(result.authorityBytesBefore);
  expect(result.candidateBytesAfter).toBe(result.candidateBytesBefore);
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

describe('K-327D bounded canonical persisted evidence', () => {
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

  it('accepts an exact-envelope canonical graph and rejects its one-byte pair before parsing', async () => {
    const exact = buildBudgetGraph(maximumNestedRecords(), { scope: MAX_BUDGET_SCOPE });
    expect(utf8ByteLength(exact.rootBytes)).toBe(MAX_PERSISTED_ENVELOPE_UTF8_BYTES);
    await expectFullGraphRestart(exact);

    const over = `${exact.rootBytes} `;
    expect(utf8ByteLength(over)).toBe(MAX_PERSISTED_ENVELOPE_UTF8_BYTES + 1);
    expect(() => JSON.parse(over)).not.toThrow();
    const result = await attemptRejectedRestart(over);
    expectTotalRestartRejection(result, over);
    expect(result).toMatchObject({ code: 'PERSISTED_ENVELOPE_TOO_LARGE', stage: 'raw_bounds' });
    expect(result.metrics.duplicateScanAttempted).toBe(0);
    expect(result.metrics.jsonValueConstructed).toBe(0);
  });

  it('measures multibyte and surrogate-pair input in UTF-8 bytes rather than UTF-16 units', () => {
    const multibyte = JSON.stringify('한'.repeat(Math.floor(MAX_PERSISTED_ENVELOPE_UTF8_BYTES / 3)));
    const emoji = JSON.stringify('😀'.repeat(Math.floor(MAX_PERSISTED_ENVELOPE_UTF8_BYTES / 4) + 1));
    expect(multibyte.length).toBeLessThan(MAX_PERSISTED_ENVELOPE_UTF8_BYTES);
    expect(emoji.length).toBeLessThan(MAX_PERSISTED_ENVELOPE_UTF8_BYTES);
    expect(utf8ByteLength(multibyte)).toBeGreaterThan(MAX_PERSISTED_ENVELOPE_UTF8_BYTES);
    expect(utf8ByteLength(emoji)).toBeGreaterThan(MAX_PERSISTED_ENVELOPE_UTF8_BYTES);
    expect(() => parseJsonUnknown(multibyte)).toThrowError(expect.objectContaining({
      code: 'PERSISTED_ENVELOPE_TOO_LARGE',
    }));
    expect(() => parseJsonUnknown(emoji)).toThrowError(expect.objectContaining({
      code: 'PERSISTED_ENVELOPE_TOO_LARGE',
    }));
  });

  it('rejects oversized malformed and otherwise valid JSON at the raw bound', async () => {
    for (const bytes of [
      `[${'a'.repeat(MAX_PERSISTED_ENVELOPE_UTF8_BYTES)}`,
      JSON.stringify('a'.repeat(MAX_PERSISTED_ENVELOPE_UTF8_BYTES)),
    ]) {
      const result = await attemptRejectedRestart(bytes);
      expectTotalRestartRejection(result, bytes);
      expect(result).toMatchObject({ code: 'PERSISTED_ENVELOPE_TOO_LARGE', stage: 'raw_bounds' });
      expect(result.metrics.duplicateScanAttempted).toBe(0);
    }
  });

  it('uses schema-valid graph-valid authority exact and limit+1 fixtures', async () => {
    const exact = buildBudgetGraph([['note-a', 'v1']], { scope: MAX_BUDGET_SCOPE });
    expect(utf8ByteLength(exact.authorityBytes)).toBe(MAX_AUTHORITY_UTF8_BYTES);
    expect(utf8ByteLength(exact.rootBytes)).toBeLessThan(MAX_PERSISTED_ENVELOPE_UTF8_BYTES);
    await expectFullGraphRestart(exact);

    const over = buildBudgetGraph([['note-a', 'v1']], {
      scope: OVER_AUTHORITY_SCOPE,
      validate: false,
    });
    expect(utf8ByteLength(over.authorityBytes)).toBe(MAX_AUTHORITY_UTF8_BYTES + 1);
    expect(utf8ByteLength(over.candidateBytes)).toBe(utf8ByteLength(exact.candidateBytes));
    const result = await attemptRejectedRestart(over.rootBytes);
    expectTotalRestartRejection(result, over.rootBytes);
    expect(result).toMatchObject({ code: 'PERSISTED_AUTHORITY_TOO_LARGE', stage: 'graph_bounds' });
  });

  it('uses schema-valid graph-valid candidate exact and limit+1 fixtures', async () => {
    const records = maximumNestedRecords();
    const exact = buildBudgetGraph(records);
    expect(utf8ByteLength(exact.candidateBytes)).toBe(MAX_CANDIDATE_UTF8_BYTES);
    expect(utf8ByteLength(exact.rootBytes)).toBeLessThan(MAX_PERSISTED_ENVELOPE_UTF8_BYTES);
    await expectFullGraphRestart(exact);

    const over = buildBudgetGraph(records, { candidateId: 'c'.repeat(128), validate: false });
    expect(utf8ByteLength(over.candidateBytes)).toBe(MAX_CANDIDATE_UTF8_BYTES + 1);
    expect(utf8ByteLength(over.authorityBytes)).toBeLessThan(MAX_AUTHORITY_UTF8_BYTES);
    const result = await attemptRejectedRestart(over.rootBytes);
    expectTotalRestartRejection(result, over.rootBytes);
    expect(result).toMatchObject({ code: 'PERSISTED_CANDIDATE_TOO_LARGE', stage: 'graph_bounds' });
  });

  it('proves one maximum-valid complete graph reaches every nested byte/count maximum', async () => {
    const graph = buildBudgetGraph(maximumNestedRecords(), { scope: MAX_BUDGET_SCOPE });
    const aggregate = graph.records.reduce(
      (sum, record) => sum + utf8ByteLength(JSON.stringify(record)),
      0,
    );
    expect({
      envelope: utf8ByteLength(graph.rootBytes),
      authority: utf8ByteLength(graph.authorityBytes),
      candidate: utf8ByteLength(graph.candidateBytes),
      aggregate,
      count: graph.records.length,
      wholeRecord: utf8ByteLength(JSON.stringify(graph.records[0])),
      id: utf8ByteLength(graph.records[0]![0]),
      value: utf8ByteLength(graph.records[0]![1]),
    }).toEqual({
      envelope: MAX_PERSISTED_ENVELOPE_UTF8_BYTES,
      authority: MAX_AUTHORITY_UTF8_BYTES,
      candidate: MAX_CANDIDATE_UTF8_BYTES,
      aggregate: MAX_TOTAL_SOURCE_RECORD_UTF8_BYTES,
      count: MAX_SOURCE_RECORD_COUNT,
      wholeRecord: MAX_SOURCE_RECORD_UTF8_BYTES,
      id: MAX_SOURCE_RECORD_ID_UTF8_BYTES,
      value: MAX_SOURCE_RECORD_VALUE_UTF8_BYTES - 1,
    });
    await expectFullGraphRestart(graph);
  });

  it('enforces source record count at the exact limit and limit plus one', async () => {
    const atLimit = Array.from({ length: MAX_SOURCE_RECORD_COUNT }, (_, index) => (
      [index.toString().padStart(4, '0'), ''] as const
    ));
    expect(parseRecords(atLimit, 'CORRUPT_PERSISTED_RECORD')).toHaveLength(MAX_SOURCE_RECORD_COUNT);
    await expectFullGraphRestart(buildBudgetGraph(atLimit));
    const over = buildBudgetGraph([...atLimit, ['overflow', '']], { validate: false });
    const result = await attemptRejectedRestart(over.rootBytes);
    expectTotalRestartRejection(result, over.rootBytes);
    expect(result).toMatchObject({
      code: 'PERSISTED_SOURCE_RECORD_COUNT_EXCEEDED',
      stage: 'candidate_schema',
    });
  });

  it('makes the canonical whole record authoritative over subordinate fields', () => {
    const one = ['\0'.repeat(MAX_SOURCE_RECORD_ID_UTF8_BYTES),
      '\0'.repeat(MAX_SOURCE_RECORD_VALUE_UTF8_BYTES - 1)] as const;
    expect(utf8ByteLength(JSON.stringify(one))).toBe(MAX_SOURCE_RECORD_UTF8_BYTES);
    expect(parseRecords([one], 'CORRUPT_PERSISTED_RECORD')).toHaveLength(1);
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

  it('single-counts an exact aggregate that remains embeddable in candidate and envelope', async () => {
    const exactRecords = exactAggregateFourRecords();
    expect(exactRecords.reduce((sum, record) => sum + utf8ByteLength(JSON.stringify(record)), 0))
      .toBe(MAX_TOTAL_SOURCE_RECORD_UTF8_BYTES);
    const exact = buildBudgetGraph(exactRecords);
    expect(utf8ByteLength(exact.candidateBytes)).toBeLessThan(MAX_CANDIDATE_UTF8_BYTES);
    expect(utf8ByteLength(exact.rootBytes)).toBeLessThan(MAX_PERSISTED_ENVELOPE_UTF8_BYTES);
    await expectFullGraphRestart(exact);

    const overRecords = exactRecords.map(([id, value], index) => (
      [id, index === 0 ? `${value}a` : value] as const
    ));
    const over = buildBudgetGraph(overRecords, { validate: false });
    expect(utf8ByteLength(over.candidateBytes)).toBeLessThan(MAX_CANDIDATE_UTF8_BYTES);
    expect(utf8ByteLength(over.rootBytes)).toBeLessThan(MAX_PERSISTED_ENVELOPE_UTF8_BYTES);
    const result = await attemptRejectedRestart(over.rootBytes);
    expectTotalRestartRejection(result, over.rootBytes);
    expect(result).toMatchObject({ code: 'PERSISTED_SOURCE_RECORDS_TOO_LARGE', stage: 'candidate_schema' });
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
    expect(utf8ByteLength(bytes)).toBeLessThan(MAX_PERSISTED_ENVELOPE_UTF8_BYTES);
    const reader = new StrictJsonReader(bytes);
    const parsed = reader.read() as number[];
    expect(parsed).toHaveLength(count);
    expect(reader.numberTokenCount).toBe(count);
    expect(reader.numberSuffixSliceCount).toBe(0);
    expect(reader.numberOffsetsMonotonic).toBe(true);
    expect(JSON.stringify(parsed)).toBe(bytes);
  });
});

describe('K-327D observable restart capabilities', () => {
  it('measures exact first-finalization and idempotent-retry capability profiles', async () => {
    const canonical = await pendingSerializedRoot();
    const observed = restartMetrics();
    const sources = DurablePhysicalSourceRegistry.fromSerializedRoot(canonical, metrics(), observed);
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
      rootRewriteAttempted: 0,
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
      rootRewriteAttempted: 0,
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

  it('routes an identical root rewrite through the real modeled store boundary', async () => {
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
    const bytes = sources.serializeRoot(rootA);
    const before = sources.inspectDurableState(rootA);
    const writesBeforeRewrite = observed.persistenceWriteAttempted;
    sources.rewriteRoot(rootA, bytes);
    const after = sources.inspectDurableState(rootA);
    expect(after).toEqual(before);
    const identicalValueWriteAttempted = observed.persistenceWriteAttempted > writesBeforeRewrite;
    expect(identicalValueWriteAttempted).toBe(true);
    expect(observed.persistenceWriteAttempted - writesBeforeRewrite).toBe(1);
    expect(observed.rootRewriteAttempted).toBe(1);
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
    expect(after.candidateBytes).toBeNull();
    expect(observed.recordDeleteAttempted).toBe(1);
    expect(observed.candidateDeleteAttempted).toBe(1);
    const writesAfterFirstDelete = observed.persistenceWriteAttempted;
    expect(sources.deleteCandidate(rootA)).toBe(false);
    expect(observed.persistenceWriteAttempted).toBe(writesAfterFirstDelete);
  });

  it('detects an explicitly invoked recapture boundary on a restarted registry', async () => {
    const observed = restartMetrics();
    const sources = DurablePhysicalSourceRegistry.fromSerializedRoot(
      await pendingSerializedRoot(),
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
    DurablePhysicalSourceRegistry.fromSerializedRoot(source.serializeRoot(rootA), metrics(), observed);
    expect(observed.candidateFieldInspected).toBe(1);
    expect(observed.candidateParserInvoked).toBe(0);
    expect(observed.candidateSchemaValidated).toBe(1);
  });
});

describe('K-327C canonical serialized pending-snapshot restart and exact finalization', () => {
  it('crosses JSON serialization and unknown-input validation into a new runtime, then finalizes idempotently', async () => {
    const first = environment();
    first.sources.initialize(rootA, userA);
    await first.context().write('note-a', 'v1');
    await expect(first.context().handoff({ crashAfterCandidateCommit: true }))
      .rejects.toMatchObject({ code: 'CONTEXT_CRASHED' });
    const digest = physicalSourceDigest(rootA);
    const originalAuthority = first.sources.readAuthority(digest);
    const originalCandidate = first.sources.readCandidate(digest)!;
    const serialized = first.sources.serializeRoot(rootA);

    const restartEvidence = metrics();
    const restartedSources = DurablePhysicalSourceRegistry.fromSerializedRoot(
      `${serialized}`,
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

  const corruptions: Array<readonly [string, (root: Record<string, unknown>) => void]> = [
    ['candidate id mismatch', root => { nestedRecord(root, 'candidate').candidateId = 'candidate-different'; }],
    ['session mismatch', root => { nestedRecord(root, 'candidate').handoffSessionId = 'handoff-different'; }],
    ['candidate physical root mismatch', root => { nestedRecord(root, 'candidate').physicalSourceDigest = '1'.repeat(64); }],
    ['candidate logical scope mismatch', root => { nestedRecord(root, 'candidate').logicalScopeDigest = '2'.repeat(64); }],
    ['candidate revision lower', root => { nestedRecord(root, 'candidate').sourceRevision = 0; }],
    ['candidate revision higher', root => { nestedRecord(root, 'candidate').sourceRevision = 2; }],
    ['authority revision changed after candidate', root => { nestedRecord(root, 'authority').sourceRevision = 2; }],
    ['internally valid same-session replacement', root => {
      const candidate = nestedRecord(root, 'candidate');
      candidate.candidateId = 'candidate-substitute';
      candidate.manifestDigest = computeManifestDigest(
        candidate.candidateId as string,
        candidate.handoffSessionId as string,
        candidate.entityCount as number,
        candidate.rootDigest as string,
      );
    }],
    ['snapshot digest mismatch', root => { nestedRecord(root, 'candidate').snapshotDigest = '3'.repeat(64); }],
    ['root digest mismatch', root => { nestedRecord(root, 'candidate').rootDigest = '4'.repeat(64); }],
    ['manifest digest mismatch', root => { nestedRecord(root, 'candidate').manifestDigest = '5'.repeat(64); }],
    ['authority version mismatch', root => { nestedRecord(root, 'authority').schemaVersion = 2; }],
    ['candidate version mismatch', root => { nestedRecord(root, 'candidate').schemaVersion = 2; }],
    ['authority coordinator mismatch', root => { nestedRecord(root, 'authority').coordinatorVersion = 2; }],
    ['candidate coordinator mismatch', root => { nestedRecord(root, 'candidate').coordinatorVersion = 2; }],
    ['authority discriminator mismatch', root => { nestedRecord(root, 'authority').recordType = 'wrong'; }],
    ['candidate discriminator mismatch', root => { nestedRecord(root, 'candidate').recordType = 'wrong'; }],
    ['authority scope changed', root => {
      nestedRecord(nestedRecord(root, 'authority'), 'logicalScope').userId = 'user-other';
    }],
    ['authority physical root changed', root => { nestedRecord(root, 'authority').physicalSourceDigest = '6'.repeat(64); }],
    ['numeric-string revision', root => { nestedRecord(root, 'candidate').sourceRevision = '1'; }],
    ['unsafe revision', root => { nestedRecord(root, 'candidate').sourceRevision = Number.MAX_SAFE_INTEGER + 1; }],
    ['negative revision', root => { nestedRecord(root, 'candidate').sourceRevision = -1; }],
    ['malformed digest', root => { nestedRecord(root, 'candidate').snapshotDigest = 'not-a-digest'; }],
    ['empty digest', root => { nestedRecord(root, 'candidate').rootDigest = ''; }],
    ['object digest', root => { nestedRecord(root, 'candidate').manifestDigest = {}; }],
    ['extra root field', root => { root.conflictingCandidate = nestedRecord(root, 'candidate'); }],
    ['extra candidate field', root => { nestedRecord(root, 'candidate').extra = true; }],
    ['missing candidate field', root => { delete nestedRecord(root, 'candidate').candidateId; }],
  ];

  it.each(corruptions)('%s is a total structured restart rejection', async (_label, mutate) => {
    const serialized = await pendingSerializedRoot();
    const corrupted = mutateSerializedRoot(serialized, mutate);
    const result = await attemptRejectedRestart(corrupted);
    expectTotalRestartRejection(result, corrupted);
    expect(result.metrics.coordinatorConstructed).toBe(0);
    expect(result.metrics.finalizationAttempted).toBe(0);
  });

  const malformedRootCases: Array<readonly [string, (canonical: string) => string]> = [
    ['truncated object', canonical => canonical.slice(0, -1)],
    ['invalid token', () => '{malformed'],
    ['empty input', () => ''],
    ['whitespace only', () => ' \t\r\n'],
    ['string primitive', () => '"root"'],
    ['number primitive', () => '1'],
    ['boolean primitive', () => 'true'],
    ['array root', () => '[]'],
    ['null root', () => 'null'],
    ['BOM prefix', canonical => `\uFEFF${canonical}`],
    ['deeply nested malformed input', () => `${'['.repeat(66)}0${']'.repeat(66)}`],
    ['missing authority', canonical => mutateSerializedRoot(canonical, root => { delete root.authority; })],
    ['missing candidate', canonical => mutateSerializedRoot(canonical, root => { delete root.candidate; })],
    ['null authority', canonical => mutateSerializedRoot(canonical, root => { root.authority = null; })],
    ['null candidate', canonical => mutateSerializedRoot(canonical, root => { root.candidate = null; })],
    ['missing byte format', canonical => mutateSerializedRoot(canonical, root => { delete root.byteFormatVersion; })],
    ['wrong root discriminator', canonical => mutateSerializedRoot(canonical, root => { root.recordType = 'wrong'; })],
    ['wrong root schema version', canonical => mutateSerializedRoot(canonical, root => { root.schemaVersion = 2; })],
    ['wrong byte format version', canonical => mutateSerializedRoot(canonical, root => { root.byteFormatVersion = 2; })],
    ['extra __proto__ key', canonical => replaceOnce(canonical, '{', '{"__proto__":{},')],
    ['extra constructor key', canonical => replaceOnce(canonical, '{', '{"constructor":{},')],
    ['extra prototype key', canonical => replaceOnce(canonical, '{', '{"prototype":{},')],
    ['nested authority __proto__ key', canonical => replaceOnce(
      canonical, '"authority":{', '"authority":{"__proto__":{},',
    )],
    ['nested candidate constructor key', canonical => replaceOnce(
      canonical, '"candidate":{', '"candidate":{"constructor":{},',
    )],
    ['nested logical-scope prototype key', canonical => replaceOnce(
      canonical, '"logicalScope":{', '"logicalScope":{"prototype":{},',
    )],
  ];

  it.each(malformedRootCases)('%s fails closed before coordinator construction', async (label, mutate) => {
    const canonical = await pendingSerializedRoot();
    const malformed = mutate(canonical);
    const result = await attemptRejectedRestart(malformed);
    expectTotalRestartRejection(result, malformed);
    expect(result.metrics.coordinatorConstructed).toBe(0);
    expect(result.metrics.finalizationAttempted).toBe(0);
    if (label === 'null candidate') {
      expect(result.metrics.candidateFieldInspected).toBe(1);
      expect(result.metrics.candidateParserInvoked).toBe(0);
    }
    if (label === 'missing candidate') {
      expect(result.metrics.candidateFieldInspected).toBe(0);
      expect(result.metrics.candidateParserInvoked).toBe(0);
    }
  });

  const duplicateRootCases: Array<readonly [string, (canonical: string) => string]> = [
    ['root field', canonical => replaceOnce(
      canonical,
      '"byteFormatVersion":1',
      '"byteFormatVersion":1,"byteFormatVersion":1',
    )],
    ['escaped root equivalent', canonical => replaceOnce(
      canonical,
      '"byteFormatVersion":1',
      '"byteFormatVersion":1,"byteFormat\\u0056ersion":1',
    )],
    ['authority field', canonical => replaceOnce(
      canonical,
      `"recordType":"${AUTHORITY_RECORD_TYPE}"`,
      `"recordType":"${AUTHORITY_RECORD_TYPE}","recordType":"${AUTHORITY_RECORD_TYPE}"`,
    )],
    ['logical scope escaped field', canonical => replaceOnce(
      canonical,
      '"userId":"user-a"',
      '"userId":"user-a","user\\u0049d":"user-a"',
    )],
    ['candidate field', canonical => replaceOnce(
      canonical,
      `"recordType":"${CANDIDATE_RECORD_TYPE}"`,
      `"recordType":"${CANDIDATE_RECORD_TYPE}","recordType":"${CANDIDATE_RECORD_TYPE}"`,
    )],
    ['nested snapshot array element object', canonical => replaceOnce(
      canonical,
      '"records":[["note-a","v1"]]',
      '"records":[{"id":"note-a","id":"note-a","value":"v1"}]',
    )],
  ];

  it.each(duplicateRootCases)('%s duplicate is rejected before schema parsing', async (_label, mutate) => {
    const duplicate = mutate(await pendingSerializedRoot());
    const result = await attemptRejectedRestart(duplicate);
    expectTotalRestartRejection(result, duplicate);
    expect(result).toMatchObject({ code: 'DUPLICATE_PERSISTED_JSON_KEY', stage: 'duplicate_scan' });
    expect(result.metrics.duplicateScanAttempted).toBe(1);
    expect(result.metrics.jsonValueConstructed).toBe(0);
    expect(result.metrics.rootSchemaValidated).toBe(0);
    expect(result.metrics.authorityParserInvoked).toBe(0);
    expect(result.metrics.coordinatorConstructed).toBe(0);
  });

  const noncanonicalCases: Array<readonly [string, (canonical: string) => string]> = [
    ['leading whitespace', canonical => ` ${canonical}`],
    ['trailing whitespace', canonical => `${canonical} `],
    ['trailing newline', canonical => `${canonical}\n`],
    ['trailing CRLF', canonical => `${canonical}\r\n`],
    ['inter-token whitespace', canonical => replaceOnce(canonical, '":"', '": "')],
    ['alternate exponent number', canonical => replaceOnce(canonical, '"byteFormatVersion":1', '"byteFormatVersion":1e0')],
    ['escaped ASCII key', canonical => replaceOnce(canonical, '"recordType"', '"\\u0072ecordType"')],
    ['escaped ASCII value', canonical => replaceOnce(canonical, '"userId":"user-a"', '"userId":"user-\\u0061"')],
    ['reordered root fields', canonical => {
      const root = JSON.parse(canonical) as Record<string, unknown>;
      return JSON.stringify({ schemaVersion: root.schemaVersion, ...root });
    }],
  ];

  it.each(noncanonicalCases)('%s is rejected without normalization or rewrite', async (_label, mutate) => {
    const noncanonical = mutate(await pendingSerializedRoot());
    const result = await attemptRejectedRestart(noncanonical);
    expectTotalRestartRejection(result, noncanonical);
    expect(result).toMatchObject({ code: 'NONCANONICAL_PERSISTED_BYTES', stage: 'canonical_bytes' });
    expect(result.metrics.rootSchemaValidated).toBe(1);
    expect(result.metrics.authoritySchemaValidated).toBe(1);
    expect(result.metrics.candidateSchemaValidated).toBe(1);
    expect(result.metrics.graphBindingValidated).toBe(1);
    expect(result.metrics.canonicalEqualityChecked).toBe(1);
    expect(result.metrics.coordinatorConstructed).toBe(0);
  });

  it('rejects negative-zero encoding of a semantic zero without normalization', async () => {
    const canonical = await emptyPendingSerializedRoot();
    const noncanonical = canonical.replaceAll('"sourceRevision":0', '"sourceRevision":-0');
    const result = await attemptRejectedRestart(noncanonical);
    expectTotalRestartRejection(result, noncanonical);
    expect(result).toMatchObject({ code: 'NONCANONICAL_PERSISTED_BYTES', stage: 'canonical_bytes' });
    expect(result.metrics.graphBindingValidated).toBe(1);
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
    const canonical = await pendingSerializedRoot(value);
    const noncanonical = mutate(canonical);
    expect(noncanonical).not.toBe(canonical);
    const result = await attemptRejectedRestart(noncanonical);
    expectTotalRestartRejection(result, noncanonical);
    expect(result).toMatchObject({ code: 'NONCANONICAL_PERSISTED_BYTES', stage: 'canonical_bytes' });
    expect(result.metrics.graphBindingValidated).toBe(1);
    expect(result.metrics.coordinatorConstructed).toBe(0);
  });

  it('preserves exact canonical bytes across restart without rewriting evidence', async () => {
    const canonical = await pendingSerializedRoot();
    const stages = restartMetrics();
    const restarted = DurablePhysicalSourceRegistry.fromSerializedRoot(canonical, metrics(), stages);
    expect(restarted.serializeRoot(rootA)).toBe(canonical);
    expect(stages).toMatchObject({
      duplicateScanCompleted: 1,
      jsonValueConstructed: 1,
      canonicalEqualityChecked: 1,
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
