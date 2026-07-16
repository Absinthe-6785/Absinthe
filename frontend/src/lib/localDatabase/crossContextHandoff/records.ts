import {
  assertJsonDepth,
  canonicalizeSourceEntries,
  canonicalSourceEntryBytes,
  sha256Hex,
  utf8Bytes,
} from './canonical';
import { deriveLogicalScopeDigest, validateLogicalScope } from './identity';
import {
  CrossContextHandoffError,
  HANDOFF_COORDINATOR_VERSION,
  HANDOFF_LIMITS,
  HANDOFF_SCHEMA_VERSION,
  type LogicalAuthorityScopeV1,
  type PersistedHandoffAuthorityV1,
  type PersistedSnapshotCandidateV1,
} from './types';

const DIGEST = /^[a-f0-9]{64}$/;
const CANDIDATE_ID = /^candidate-[a-f0-9]{24}$/;
const SESSION_ID = /^handoff-([a-f0-9]{16})-(0|[1-9][0-9]{0,15})$/;

function strictRecord(input: unknown, keys: readonly string[], code: 'AUTHORITY_CORRUPT' | 'CANDIDATE_CORRUPT'): Record<string, unknown> {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw new CrossContextHandoffError(code, 'validate_persisted_record');
  }
  const prototype = Object.getPrototypeOf(input);
  const descriptors = Object.getOwnPropertyDescriptors(input);
  const actual = Reflect.ownKeys(input);
  const expected = [...keys].sort();
  const sorted = [...actual as string[]].sort();
  if ((prototype !== Object.prototype && prototype !== null) || actual.some(key => typeof key !== 'string')
    || sorted.length !== expected.length || sorted.some((key, index) => key !== expected[index])) {
    throw new CrossContextHandoffError(code, 'validate_persisted_record');
  }
  const result: Record<string, unknown> = {};
  for (const key of keys) {
    const descriptor = descriptors[key];
    if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, 'value')
      || descriptor.get !== undefined || descriptor.set !== undefined) {
      throw new CrossContextHandoffError(code, 'validate_persisted_record');
    }
    result[key] = descriptor.value;
  }
  return result;
}

function digest(value: unknown, code: 'AUTHORITY_CORRUPT' | 'CANDIDATE_CORRUPT'): string {
  if (typeof value !== 'string' || !DIGEST.test(value)) {
    throw new CrossContextHandoffError(code, 'validate_digest');
  }
  return value;
}

function nullableDigest(value: unknown, code: 'AUTHORITY_CORRUPT'): string | null {
  return value === null ? null : digest(value, code);
}

function revision(value: unknown, code: 'AUTHORITY_CORRUPT' | 'CANDIDATE_CORRUPT'): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new CrossContextHandoffError(code, 'validate_revision');
  }
  return value;
}

export function createCandidateId(snapshotDigest: string): string {
  return `candidate-${digest(snapshotDigest, 'CANDIDATE_CORRUPT').slice(0, 24)}`;
}

export function createHandoffSessionId(physicalDigest: string, sourceRevision: number): string {
  return `handoff-${digest(physicalDigest, 'AUTHORITY_CORRUPT').slice(0, 16)}-${revision(sourceRevision, 'AUTHORITY_CORRUPT')}`;
}

export function assertHandoffWriteBudget(authorityBytes: number, candidateBytes: number): void {
  if (!Number.isSafeInteger(authorityBytes) || !Number.isSafeInteger(candidateBytes)
    || authorityBytes < 0 || candidateBytes < 0
    || authorityBytes > HANDOFF_LIMITS.authorityPayloadBytes
    || candidateBytes > HANDOFF_LIMITS.candidatePayloadBytes
    || authorityBytes + candidateBytes + HANDOFF_LIMITS.applicationReserveBytes
      > HANDOFF_LIMITS.transactionWriteBytes) {
    throw new CrossContextHandoffError('RESOURCE_BOUND_EXCEEDED', 'handoff_write_budget');
  }
}

function candidateId(value: unknown): string {
  if (typeof value !== 'string' || !CANDIDATE_ID.test(value) || utf8Bytes(value).byteLength !== 34) {
    throw new CrossContextHandoffError('CANDIDATE_CORRUPT', 'validate_candidate_id');
  }
  return value;
}

function sessionId(value: unknown, code: 'AUTHORITY_CORRUPT' | 'CANDIDATE_CORRUPT'): string {
  if (typeof value !== 'string') throw new CrossContextHandoffError(code, 'validate_session_id');
  const match = SESSION_ID.exec(value);
  if (!match) throw new CrossContextHandoffError(code, 'validate_session_id');
  const parsed = Number(match[2]);
  if (!Number.isSafeInteger(parsed) || parsed < 0 || parsed > Number.MAX_SAFE_INTEGER
    || utf8Bytes(value).byteLength < 26 || utf8Bytes(value).byteLength > 41) {
    throw new CrossContextHandoffError(code, 'validate_session_id');
  }
  return value;
}

export async function buildTerminalEvidence(input: {
  physicalSourceDigest: string;
  logicalScope: unknown;
  sourceRevision: number;
  records: unknown;
}): Promise<{ authority: PersistedHandoffAuthorityV1; candidate: PersistedSnapshotCandidateV1 }> {
  const physicalDigest = digest(input.physicalSourceDigest, 'AUTHORITY_CORRUPT');
  const { scope, digest: scopeDigest } = await deriveLogicalScopeDigest(input.logicalScope);
  const sourceRevision = revision(input.sourceRevision, 'AUTHORITY_CORRUPT');
  const records = canonicalizeSourceEntries(input.records);
  const snapshotDigest = await sha256Hex(canonicalSourceEntryBytes(records));
  const id = createCandidateId(snapshotDigest);
  const handoffSessionId = createHandoffSessionId(physicalDigest, sourceRevision);
  const rootDigest = await sha256Hex(JSON.stringify([
    'absinthe_handoff_root_v1', physicalDigest, scopeDigest, sourceRevision, snapshotDigest,
  ]));
  const manifestDigest = await sha256Hex(JSON.stringify([
    'absinthe_handoff_manifest_v1', id, handoffSessionId, records.length, rootDigest,
  ]));
  const candidate: PersistedSnapshotCandidateV1 = Object.freeze({
    recordType: 'absinthe_handoff_snapshot_candidate',
    schemaVersion: HANDOFF_SCHEMA_VERSION,
    coordinatorVersion: HANDOFF_COORDINATOR_VERSION,
    candidateId: id,
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
  const authority: PersistedHandoffAuthorityV1 = Object.freeze({
    recordType: 'absinthe_handoff_authority',
    schemaVersion: HANDOFF_SCHEMA_VERSION,
    coordinatorVersion: HANDOFF_COORDINATOR_VERSION,
    physicalSourceDigest: physicalDigest,
    logicalScope: scope,
    logicalScopeDigest: scopeDigest,
    state: 'read_only_handoff',
    sourceRevision,
    handoffSessionId,
    snapshotCandidateId: id,
    snapshotDigest,
    rootDigest,
    manifestDigest,
  });
  await validateEvidenceGraph(authority, candidate);
  const authorityBytes = encodeAuthority(authority);
  const candidateBytes = encodeCandidate(candidate);
  assertHandoffWriteBudget(authorityBytes.byteLength, candidateBytes.byteLength);
  return Object.freeze({ authority, candidate });
}

export async function buildPendingAuthority(input: {
  physicalSourceDigest: string;
  logicalScope: unknown;
  sourceRevision: number;
}): Promise<PersistedHandoffAuthorityV1> {
  const physicalSourceDigest = digest(input.physicalSourceDigest, 'AUTHORITY_CORRUPT');
  const { scope, digest: logicalScopeDigest } = await deriveLogicalScopeDigest(input.logicalScope);
  const sourceRevision = revision(input.sourceRevision, 'AUTHORITY_CORRUPT');
  return validateAuthority({
    recordType: 'absinthe_handoff_authority', schemaVersion: 1, coordinatorVersion: 1,
    physicalSourceDigest, logicalScope: scope, logicalScopeDigest,
    state: 'handoff_pending', sourceRevision,
    handoffSessionId: createHandoffSessionId(physicalSourceDigest, sourceRevision),
    snapshotCandidateId: null, snapshotDigest: null, rootDigest: null, manifestDigest: null,
  });
}

export function withAuthorityState(
  authority: PersistedHandoffAuthorityV1,
  state: 'snapshot_committed_pending_finalization' | 'read_only_handoff',
): PersistedHandoffAuthorityV1 {
  return Object.freeze({ ...authority, state });
}

const AUTHORITY_KEYS = [
  'recordType', 'schemaVersion', 'coordinatorVersion', 'physicalSourceDigest', 'logicalScope',
  'logicalScopeDigest', 'state', 'sourceRevision', 'handoffSessionId', 'snapshotCandidateId',
  'snapshotDigest', 'rootDigest', 'manifestDigest',
] as const;

export async function validateAuthority(input: unknown): Promise<PersistedHandoffAuthorityV1> {
  const value = strictRecord(input, AUTHORITY_KEYS, 'AUTHORITY_CORRUPT');
  if (value.recordType !== 'absinthe_handoff_authority' || value.schemaVersion !== 1
    || value.coordinatorVersion !== 1 || typeof value.state !== 'string'
    || !['writable', 'handoff_pending', 'snapshot_committed_pending_finalization', 'read_only_handoff'].includes(value.state)) {
    throw new CrossContextHandoffError('AUTHORITY_CORRUPT', 'validate_authority');
  }
  const logicalScope = validateLogicalScope(value.logicalScope);
  const logical = await deriveLogicalScopeDigest(logicalScope);
  const logicalScopeDigest = digest(value.logicalScopeDigest, 'AUTHORITY_CORRUPT');
  if (logical.digest !== logicalScopeDigest) {
    throw new CrossContextHandoffError('AUTHORITY_CORRUPT', 'validate_authority_scope');
  }
  const state = value.state as PersistedHandoffAuthorityV1['state'];
  const sourceRevision = revision(value.sourceRevision, 'AUTHORITY_CORRUPT');
  const physicalSourceDigest = digest(value.physicalSourceDigest, 'AUTHORITY_CORRUPT');
  const handoffSessionId = value.handoffSessionId === null ? null : sessionId(value.handoffSessionId, 'AUTHORITY_CORRUPT');
  const snapshotCandidateId = value.snapshotCandidateId === null ? null : candidateId(value.snapshotCandidateId);
  const result: PersistedHandoffAuthorityV1 = Object.freeze({
    recordType: 'absinthe_handoff_authority', schemaVersion: 1, coordinatorVersion: 1,
    physicalSourceDigest, logicalScope, logicalScopeDigest, state, sourceRevision,
    handoffSessionId, snapshotCandidateId,
    snapshotDigest: nullableDigest(value.snapshotDigest, 'AUTHORITY_CORRUPT'),
    rootDigest: nullableDigest(value.rootDigest, 'AUTHORITY_CORRUPT'),
    manifestDigest: nullableDigest(value.manifestDigest, 'AUTHORITY_CORRUPT'),
  });
  const noBinding = result.snapshotCandidateId === null && result.snapshotDigest === null
    && result.rootDigest === null && result.manifestDigest === null;
  const fullBinding = result.snapshotCandidateId !== null && result.snapshotDigest !== null
    && result.rootDigest !== null && result.manifestDigest !== null;
  if ((state === 'writable' && (handoffSessionId !== null || !noBinding))
    || (state === 'handoff_pending' && (handoffSessionId === null || !noBinding))
    || ((state === 'snapshot_committed_pending_finalization' || state === 'read_only_handoff')
      && (handoffSessionId === null || !fullBinding))) {
    throw new CrossContextHandoffError('AUTHORITY_CORRUPT', 'validate_authority_state');
  }
  if (handoffSessionId !== null && handoffSessionId !== createHandoffSessionId(physicalSourceDigest, sourceRevision)) {
    throw new CrossContextHandoffError('AUTHORITY_CORRUPT', 'validate_authority_session');
  }
  if (result.snapshotDigest !== null && snapshotCandidateId !== createCandidateId(result.snapshotDigest)) {
    throw new CrossContextHandoffError('AUTHORITY_CORRUPT', 'validate_authority_candidate');
  }
  return result;
}

const CANDIDATE_KEYS = [
  'recordType', 'schemaVersion', 'coordinatorVersion', 'candidateId', 'handoffSessionId',
  'physicalSourceDigest', 'logicalScopeDigest', 'sourceRevision', 'snapshotDigest', 'rootDigest',
  'manifestDigest', 'entityCount', 'records',
] as const;

export async function validateCandidate(input: unknown): Promise<PersistedSnapshotCandidateV1> {
  const value = strictRecord(input, CANDIDATE_KEYS, 'CANDIDATE_CORRUPT');
  if (value.recordType !== 'absinthe_handoff_snapshot_candidate' || value.schemaVersion !== 1
    || value.coordinatorVersion !== 1 || typeof value.entityCount !== 'number'
    || !Number.isSafeInteger(value.entityCount) || value.entityCount < 0) {
    throw new CrossContextHandoffError('CANDIDATE_CORRUPT', 'validate_candidate');
  }
  const records = canonicalizeSourceEntries(value.records);
  const result: PersistedSnapshotCandidateV1 = Object.freeze({
    recordType: 'absinthe_handoff_snapshot_candidate', schemaVersion: 1, coordinatorVersion: 1,
    candidateId: candidateId(value.candidateId),
    handoffSessionId: sessionId(value.handoffSessionId, 'CANDIDATE_CORRUPT'),
    physicalSourceDigest: digest(value.physicalSourceDigest, 'CANDIDATE_CORRUPT'),
    logicalScopeDigest: digest(value.logicalScopeDigest, 'CANDIDATE_CORRUPT'),
    sourceRevision: revision(value.sourceRevision, 'CANDIDATE_CORRUPT'),
    snapshotDigest: digest(value.snapshotDigest, 'CANDIDATE_CORRUPT'),
    rootDigest: digest(value.rootDigest, 'CANDIDATE_CORRUPT'),
    manifestDigest: digest(value.manifestDigest, 'CANDIDATE_CORRUPT'),
    entityCount: value.entityCount,
    records,
  });
  const expectedSnapshot = await sha256Hex(canonicalSourceEntryBytes(records));
  if (result.entityCount !== records.length || result.snapshotDigest !== expectedSnapshot
    || result.candidateId !== createCandidateId(expectedSnapshot)
    || result.handoffSessionId !== createHandoffSessionId(result.physicalSourceDigest, result.sourceRevision)) {
    throw new CrossContextHandoffError('CANDIDATE_CORRUPT', 'validate_candidate_binding');
  }
  return result;
}

export async function validateEvidenceGraph(
  authorityInput: unknown,
  candidateInput: unknown,
): Promise<{ authority: PersistedHandoffAuthorityV1; candidate: PersistedSnapshotCandidateV1 }> {
  const authority = await validateAuthority(authorityInput);
  const candidate = await validateCandidate(candidateInput);
  const rootDigest = await sha256Hex(JSON.stringify([
    'absinthe_handoff_root_v1', candidate.physicalSourceDigest, candidate.logicalScopeDigest,
    candidate.sourceRevision, candidate.snapshotDigest,
  ]));
  const manifestDigest = await sha256Hex(JSON.stringify([
    'absinthe_handoff_manifest_v1', candidate.candidateId, candidate.handoffSessionId,
    candidate.entityCount, rootDigest,
  ]));
  if (!['snapshot_committed_pending_finalization', 'read_only_handoff'].includes(authority.state)
    || authority.physicalSourceDigest !== candidate.physicalSourceDigest
    || authority.logicalScopeDigest !== candidate.logicalScopeDigest
    || authority.sourceRevision !== candidate.sourceRevision
    || authority.handoffSessionId !== candidate.handoffSessionId
    || authority.snapshotCandidateId !== candidate.candidateId
    || authority.snapshotDigest !== candidate.snapshotDigest
    || authority.rootDigest !== rootDigest || candidate.rootDigest !== rootDigest
    || authority.manifestDigest !== manifestDigest || candidate.manifestDigest !== manifestDigest) {
    throw new CrossContextHandoffError('PERSISTED_EVIDENCE_MISMATCH', 'validate_evidence_graph');
  }
  return Object.freeze({ authority, candidate });
}

export function encodeAuthority(value: PersistedHandoffAuthorityV1): Uint8Array {
  return utf8Bytes(JSON.stringify(value));
}

export function encodeCandidate(value: PersistedSnapshotCandidateV1): Uint8Array {
  return utf8Bytes(JSON.stringify(value));
}

async function decodeCanonical<T>(
  bytes: unknown,
  maximum: number,
  code: 'AUTHORITY_CORRUPT' | 'CANDIDATE_CORRUPT',
  validate: (value: unknown) => Promise<T>,
  encode: (value: T) => Uint8Array,
): Promise<T> {
  if (!(bytes instanceof Uint8Array) || bytes.byteLength > maximum) {
    throw new CrossContextHandoffError(code, 'persisted_byte_bounds');
  }
  let text: string;
  try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch {
    throw new CrossContextHandoffError(code, 'persisted_utf8');
  }
  assertJsonDepth(text);
  let raw: unknown;
  try { raw = JSON.parse(text) as unknown; } catch {
    throw new CrossContextHandoffError(code, 'persisted_json');
  }
  const result = await validate(raw);
  const canonical = encode(result);
  if (canonical.byteLength !== bytes.byteLength
    || canonical.some((value, index) => value !== bytes[index])) {
    throw new CrossContextHandoffError('NONCANONICAL_PERSISTED_BYTES', 'persisted_canonical_bytes');
  }
  return result;
}

export function decodeAuthorityBytes(bytes: unknown): Promise<PersistedHandoffAuthorityV1> {
  return decodeCanonical(bytes, HANDOFF_LIMITS.authorityPayloadBytes, 'AUTHORITY_CORRUPT', validateAuthority, encodeAuthority);
}

export function decodeCandidateBytes(bytes: unknown): Promise<PersistedSnapshotCandidateV1> {
  return decodeCanonical(bytes, HANDOFF_LIMITS.candidatePayloadBytes, 'CANDIDATE_CORRUPT', validateCandidate, encodeCandidate);
}

export function logicalScopeEquals(left: LogicalAuthorityScopeV1, right: LogicalAuthorityScopeV1): boolean {
  return left.schemaVersion === right.schemaVersion && left.userId === right.userId
    && left.projectRef === right.projectRef && left.namespaceId === right.namespaceId
    && left.deviceId === right.deviceId;
}
