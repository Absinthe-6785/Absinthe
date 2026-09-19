import { canonicalPayloadSnapshot, hashCanonicalPayload } from './canonicalPayload';
import { LocalDatabaseError } from './errors';
import { deriveOutboxIdempotencyKey, deriveOutboxMutationId } from './outboxIdentity';
import { validTimestamp } from './validation';
import type {
  AcknowledgeOutboxInput, CommitRemoteEntityBatchInput, LocalEntityEnvelope, OutboxOperation, OutboxRecord,
} from './types';

export const K323_V2_PROTOCOL_VERSION = 2 as const;
export const K323_V2_PROVIDER = 'k323-v2';
export const K323_V2_DOMAINS = ['reference_alpha', 'reference_beta'] as const;
export type K323V2Domain = typeof K323_V2_DOMAINS[number];
export type K323V2Operation = Extract<OutboxOperation, 'upsert' | 'tombstone' | 'restore'>;

const SAFE_INTEGER = Number.MAX_SAFE_INTEGER;
const SAFE_IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DIGEST = /^[a-f0-9]{64}$/;

export interface K323V2ActiveScope {
  accountId: string;
  namespaceKey: string;
  generationId: string;
  deviceId: string;
}

export interface K323V2MutationContext extends K323V2ActiveScope {
  /** Server-authoritative revision. Never substitute the local outbox base revision. */
  baseServerRevision: number | null;
}

export interface K323V2MutationRequest {
  protocolVersion: 2;
  mutationId: string;
  idempotencyKey: string;
  namespaceKey: string;
  generationId: string;
  deviceId: string;
  domain: K323V2Domain;
  entityId: string;
  operation: K323V2Operation;
  baseRevision: number | null;
  localRevision: number;
  payload: OutboxRecord['payload'];
  payloadHash: string;
  createdAt: string;
}

export type K323V2MutationErrorCode =
  | 'UNAUTHORIZED_SCOPE' | 'INVALID_PROTOCOL_VERSION' | 'UNKNOWN_DOMAIN' | 'INVALID_OPERATION'
  | 'INVALID_MUTATION' | 'MALFORMED_PAYLOAD' | 'PAYLOAD_HASH_MISMATCH'
  | 'IDEMPOTENCY_KEY_MISMATCH' | 'MUTATION_ID_MISMATCH' | 'IDEMPOTENCY_CONFLICT'
  | 'MUTATION_ID_CONFLICT' | 'UNKNOWN_GENERATION' | 'STALE_GENERATION'
  | 'REMOTE_ENTITY_ALREADY_EXISTS' | 'REMOTE_ENTITY_NOT_FOUND' | 'REMOTE_ENTITY_TOMBSTONED'
  | 'REMOTE_ENTITY_NOT_TOMBSTONED' | 'REMOTE_REVISION_CONFLICT'
  | 'TRANSIENT_SERVER_FAILURE' | 'INVALID_SERVER_RESPONSE';

export interface K323V2MutationReceipt {
  protocolVersion: 2;
  outcome: 'applied' | 'revision_conflict' | 'rejected';
  mutationId: string;
  idempotencyKey: string;
  domain: K323V2Domain;
  entityId: string;
  operation: K323V2Operation;
  payloadHash: string;
  remoteMutationRef: string | null;
  serverRevision: number | null;
  changeSequence: number | null;
  serverCommittedAt: string | null;
  errorCode: K323V2MutationErrorCode | null;
  retryable: boolean;
}

export interface K323V2PullRequest {
  protocolVersion: 2;
  namespaceKey: string;
  generationId: string;
  domain: K323V2Domain;
  cursor: number;
  serverEpoch: string | null;
  limit: number;
}

export interface K323V2RemoteChange<T = unknown> {
  sequence: number;
  domain: K323V2Domain;
  entityId: string;
  operation: K323V2Operation;
  serverRevision: number;
  record: T;
  isDeleted: boolean;
  deletedAt: string | null;
  remoteMutationRef: string;
  serverCommittedAt: string;
}

export interface K323V2PullResponse<T = unknown> {
  protocolVersion: 2;
  status: 'changes' | 'full_resync_required' | 'rejected';
  domain: K323V2Domain;
  serverEpoch: string;
  retentionFloor: number;
  nextCursor: number;
  changes: K323V2RemoteChange<T>[];
  errorCode: 'CURSOR_INVALID' | 'SERVER_EPOCH_MISMATCH' | 'UNKNOWN_GENERATION' | 'STALE_GENERATION' | null;
}

export interface K323V2ResponseContext extends K323V2ActiveScope {
  domain: K323V2Domain;
}

export interface K323V2PullResponseContext extends K323V2ResponseContext {
  cursor: number;
  serverEpoch: string | null;
}

export interface K323V2PullMappingState<T> {
  context: K323V2PullResponseContext;
  activeScope: K323V2ActiveScope;
  currentEntities: ReadonlyMap<string, LocalEntityEnvelope<T>>;
  now: string;
}

export type K323V2PullMappingResult<T> =
  | { kind: 'batch'; batch: CommitRemoteEntityBatchInput<T> }
  | { kind: 'full_resync_required'; domain: K323V2Domain; serverEpoch: string; retentionFloor: number; reason: string };

function fail(operation: string): never {
  throw new LocalDatabaseError('INVALID_RESERVED_RECORD', operation);
}

function isV2Domain(value: unknown): value is K323V2Domain {
  return typeof value === 'string' && (K323_V2_DOMAINS as readonly string[]).includes(value);
}

function assertSafeInteger(value: unknown, operation: string, allowZero = false): asserts value is number {
  if (!Number.isSafeInteger(value) || (value as number) < (allowZero ? 0 : 1) || (value as number) > SAFE_INTEGER) fail(operation);
}

function assertWireValue(value: unknown, operation: string, depth = 0): void {
  if (depth > 64) fail(operation);
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value)) fail(operation);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach(item => assertWireValue(item, operation, depth + 1));
    return;
  }
  if (typeof value !== 'object') fail(operation);
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) fail(operation);
  for (const key of Object.keys(value as Record<string, unknown>)) {
    assertWireValue((value as Record<string, unknown>)[key], operation, depth + 1);
  }
}

function assertScope(expected: K323V2ActiveScope, active: K323V2ActiveScope, operation: string): void {
  if (expected.accountId !== active.accountId || expected.namespaceKey !== active.namespaceKey
    || expected.generationId !== active.generationId || expected.deviceId !== active.deviceId) fail(operation);
}

function assertReferenceRecord(domain: K323V2Domain, entityId: string, payload: OutboxRecord['payload'], operation: string): void {
  if (payload.kind !== 'entity_snapshot' || typeof payload.record !== 'object' || payload.record === null) fail(operation);
  const record = payload.record as Record<string, unknown>;
  if (record.id !== entityId) fail(operation);
  const keys = Object.keys(record).sort();
  if (domain === 'reference_alpha') {
    if (JSON.stringify(keys) !== JSON.stringify(['id', 'label', 'ordinal'])
      || typeof record.label !== 'string' || record.label.length > 1_024 || !Number.isSafeInteger(record.ordinal)) fail(operation);
  } else if (JSON.stringify(keys) !== JSON.stringify(['id', 'metric', 'observedAt', 'value'])
    || typeof record.metric !== 'string' || !SAFE_IDENTIFIER.test(record.metric)
    || typeof record.observedAt !== 'string' || Number.isNaN(Date.parse(record.observedAt))
    || !Number.isSafeInteger(record.value)) fail(operation);
}

export function outboxToK323V2Mutation(
  outbox: OutboxRecord,
  context: K323V2MutationContext,
): K323V2MutationRequest {
  const operation = 'k323_v2_outbox_request';
  if (outbox.accountId !== context.accountId || outbox.namespaceKey !== context.namespaceKey
    || outbox.generationId !== context.generationId || outbox.deviceId !== context.deviceId
    || !isV2Domain(outbox.domain) || !UUID.test(outbox.entityId)
    || !SAFE_IDENTIFIER.test(context.generationId) || !SAFE_IDENTIFIER.test(context.deviceId)
    || !DIGEST.test(context.namespaceKey) || !validTimestamp(outbox.createdAt)
    || outbox.payloadHash === null || !DIGEST.test(outbox.payloadHash)) fail(operation);
  if (context.baseServerRevision !== null) assertSafeInteger(context.baseServerRevision, operation);
  assertSafeInteger(outbox.localRevision, operation);
  assertWireValue(outbox.payload, operation);
  const payload = canonicalPayloadSnapshot(outbox.payload);
  if (hashCanonicalPayload(payload) !== outbox.payloadHash) fail(operation);
  if (outbox.operation === 'tombstone') {
    if (payload.kind !== 'tombstone' || payload.entityId !== outbox.entityId || payload.revision !== outbox.localRevision) fail(operation);
  } else {
    assertReferenceRecord(outbox.domain, outbox.entityId, payload, operation);
  }
  const identity = {
    namespaceKey: outbox.namespaceKey, generationId: outbox.generationId, domain: outbox.domain,
    entityId: outbox.entityId, localRevision: outbox.localRevision, operation: outbox.operation,
    payloadHash: outbox.payloadHash,
  };
  if (deriveOutboxIdempotencyKey(identity) !== outbox.idempotencyKey
    || deriveOutboxMutationId(identity) !== outbox.mutationId) fail(operation);
  return {
    protocolVersion: K323_V2_PROTOCOL_VERSION,
    mutationId: outbox.mutationId,
    idempotencyKey: outbox.idempotencyKey,
    namespaceKey: outbox.namespaceKey,
    generationId: outbox.generationId,
    deviceId: context.deviceId,
    domain: outbox.domain,
    entityId: outbox.entityId,
    operation: outbox.operation,
    baseRevision: context.baseServerRevision,
    localRevision: outbox.localRevision,
    payload,
    payloadHash: outbox.payloadHash,
    createdAt: outbox.createdAt,
  };
}

export function receiptToOutboxAcknowledgement(
  outbox: OutboxRecord,
  receipt: K323V2MutationReceipt,
  requestContext: K323V2ResponseContext,
  activeScope: K323V2ActiveScope,
  workerId: string,
  now: string,
): AcknowledgeOutboxInput {
  const operation = 'k323_v2_receipt_ack';
  assertScope(requestContext, activeScope, operation);
  if (requestContext.accountId !== outbox.accountId || requestContext.namespaceKey !== outbox.namespaceKey
    || requestContext.generationId !== outbox.generationId || requestContext.deviceId !== outbox.deviceId
    || requestContext.domain !== outbox.domain || receipt.protocolVersion !== 2 || receipt.outcome !== 'applied'
    || receipt.mutationId !== outbox.mutationId || receipt.idempotencyKey !== outbox.idempotencyKey
    || receipt.domain !== outbox.domain || receipt.entityId !== outbox.entityId
    || receipt.operation !== outbox.operation || receipt.payloadHash !== outbox.payloadHash
    || receipt.remoteMutationRef === null || receipt.serverRevision === null || receipt.serverCommittedAt === null
    || receipt.changeSequence === null || !UUID.test(receipt.remoteMutationRef)
    || !validTimestamp(receipt.serverCommittedAt) || receipt.errorCode !== null || receipt.retryable) fail(operation);
  assertSafeInteger(receipt.serverRevision, operation);
  assertSafeInteger(receipt.changeSequence, operation);
  return {
    mutationId: outbox.mutationId,
    workerId,
    now,
    remoteMutationRef: receipt.remoteMutationRef,
    acknowledgedRevision: receipt.serverRevision,
    serverCommittedAt: receipt.serverCommittedAt,
  };
}

export function pullResponseToRemoteBatch<T>(
  response: K323V2PullResponse<T>,
  state: K323V2PullMappingState<T>,
): K323V2PullMappingResult<T> {
  const operation = 'k323_v2_pull_batch';
  assertScope(state.context, state.activeScope, operation);
  if (response.protocolVersion !== 2 || response.domain !== state.context.domain
    || !UUID.test(response.serverEpoch) || !validTimestamp(state.now)) fail(operation);
  assertSafeInteger(state.context.cursor, operation, true);
  assertSafeInteger(response.retentionFloor, operation, true);
  assertSafeInteger(response.nextCursor, operation, true);
  if (response.status === 'full_resync_required') {
    if (response.changes.length !== 0 || response.nextCursor !== response.retentionFloor
      || response.errorCode !== 'CURSOR_INVALID' && response.errorCode !== 'SERVER_EPOCH_MISMATCH'
      || response.errorCode === 'SERVER_EPOCH_MISMATCH'
        && (state.context.serverEpoch === null || response.serverEpoch === state.context.serverEpoch)
      || response.errorCode === 'CURSOR_INVALID'
        && (state.context.cursor >= response.retentionFloor || state.context.serverEpoch !== null
          && response.serverEpoch !== state.context.serverEpoch)) fail(operation);
    return {
      kind: 'full_resync_required', domain: response.domain, serverEpoch: response.serverEpoch,
      retentionFloor: response.retentionFloor, reason: response.errorCode,
    };
  }
  if (response.status !== 'changes' || response.errorCode !== null || response.nextCursor < state.context.cursor
    || state.context.serverEpoch !== null && response.serverEpoch !== state.context.serverEpoch) fail(operation);
  const latest = new Map<string, K323V2RemoteChange<T>>();
  let previousSequence = -1;
  for (const change of response.changes) {
    assertSafeInteger(change.sequence, operation);
    assertSafeInteger(change.serverRevision, operation);
    if (change.sequence <= state.context.cursor || change.sequence <= previousSequence || change.sequence > response.nextCursor
      || change.domain !== response.domain || !UUID.test(change.entityId)
      || !UUID.test(change.remoteMutationRef) || !validTimestamp(change.serverCommittedAt)
      || change.deletedAt !== null && !validTimestamp(change.deletedAt)
      || change.isDeleted !== (change.deletedAt !== null)
      || (change.operation === 'tombstone') !== change.isDeleted) fail(operation);
    previousSequence = change.sequence;
    assertWireValue(change.record, operation);
    assertReferenceRecord(change.domain, change.entityId, {
      kind: 'entity_snapshot', record: change.record,
    } as OutboxRecord['payload'], operation);
    const priorChange = latest.get(change.entityId);
    if (priorChange && change.serverRevision <= priorChange.serverRevision) fail(operation);
    latest.set(change.entityId, change);
  }
  if (response.changes.length === 0
    ? response.nextCursor !== state.context.cursor
    : previousSequence !== response.nextCursor) fail(operation);
  const entities = [...latest.values()].map(change => {
    const current = state.currentEntities.get(change.entityId);
    if (current && (current.accountId !== state.activeScope.accountId
      || current.namespaceKey !== state.activeScope.namespaceKey
      || current.generationId !== state.activeScope.generationId
      || current.domain !== response.domain || current.entityId !== change.entityId
      || current.serverRevision != null && change.serverRevision <= current.serverRevision)) fail(operation);
    const expectedLocalRevision = current?.revision ?? null;
    const localRevision = (expectedLocalRevision ?? 0) + 1;
    const record = canonicalPayloadSnapshot(change.record);
    const entity: LocalEntityEnvelope<T> = {
      namespaceKey: state.activeScope.namespaceKey,
      generationId: state.activeScope.generationId,
      accountId: state.activeScope.accountId,
      domain: response.domain,
      entityId: change.entityId,
      record,
      revision: localRevision,
      localRevision,
      serverRevision: change.serverRevision,
      createdAt: current?.createdAt ?? change.serverCommittedAt,
      updatedAt: change.serverCommittedAt,
      deletedAt: change.deletedAt,
      isDeleted: change.isDeleted,
      deletionState: change.isDeleted ? 'deleted' : 'active',
      ownerId: state.activeScope.accountId,
      contentHash: hashCanonicalPayload(record),
      pendingMutationId: null,
      lastRemoteMutationRef: change.remoteMutationRef,
      source: { kind: 'remote', reference: K323_V2_PROVIDER },
      restoreProvenance: null,
      migrationProvenance: null,
    };
    return { expectedLocalRevision, entity };
  });
  return {
    kind: 'batch',
    batch: {
      namespaceKey: state.activeScope.namespaceKey,
      generationId: state.activeScope.generationId,
      accountId: state.activeScope.accountId,
      domain: response.domain,
      provider: K323_V2_PROVIDER,
      checkpointValue: String(response.nextCursor),
      sequence: response.nextCursor,
      serverEpoch: response.serverEpoch,
      now: state.now,
      entities,
    },
  };
}

export class K323V2AmbiguousResponseError extends Error {
  readonly code = 'AMBIGUOUS_NETWORK_RESPONSE';
  constructor(readonly request: K323V2MutationRequest, readonly transportCause?: unknown) {
    super('K-323 v2 mutation response is unknown; exact replay is required');
  }
}

export interface K323V2TransportClient {
  push(request: K323V2MutationRequest): Promise<K323V2MutationReceipt>;
  pull(request: K323V2PullRequest): Promise<K323V2PullResponse>;
}

export interface K323V2HttpClientOptions {
  baseUrl: string;
  getAccessToken: () => Promise<string>;
  fetchImpl?: typeof fetch;
}

export function createK323V2HttpClient(options: K323V2HttpClientOptions): K323V2TransportClient {
  const request = options.fetchImpl ?? fetch;
  const baseUrl = options.baseUrl.replace(/\/$/, '');
  return {
    async push(mutation) {
      const token = await options.getAccessToken();
      let response: Response;
      try {
        response = await request(`${baseUrl}/api/sync/v2/mutations`, {
          method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
          body: JSON.stringify(mutation),
        });
      } catch (error) {
        throw new K323V2AmbiguousResponseError(mutation, error);
      }
      try {
        const body = await response.json() as K323V2MutationReceipt;
        if (body.protocolVersion !== 2 || body.mutationId !== mutation.mutationId
          || body.idempotencyKey !== mutation.idempotencyKey || body.domain !== mutation.domain
          || body.entityId !== mutation.entityId || body.operation !== mutation.operation
          || body.payloadHash !== mutation.payloadHash) throw new Error('untrusted_response');
        return body;
      } catch (error) {
        throw new K323V2AmbiguousResponseError(mutation, error);
      }
    },
    async pull(pullRequest) {
      const token = await options.getAccessToken();
      const query = new URLSearchParams({
        namespaceKey: pullRequest.namespaceKey,
        generationId: pullRequest.generationId,
        domain: pullRequest.domain,
        cursor: String(pullRequest.cursor),
        limit: String(pullRequest.limit),
      });
      if (pullRequest.serverEpoch !== null) query.set('serverEpoch', pullRequest.serverEpoch);
      const response = await request(`${baseUrl}/api/sync/v2/changes?${query}`, {
        headers: { authorization: `Bearer ${token}` },
      });
      const body = await response.json() as K323V2PullResponse;
      if (body.protocolVersion !== 2 || body.domain !== pullRequest.domain) fail('k323_v2_pull_response');
      return body;
    },
  };
}
