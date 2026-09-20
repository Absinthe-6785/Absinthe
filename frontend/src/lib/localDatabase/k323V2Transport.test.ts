import { readFileSync } from 'node:fs';
import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it, vi } from 'vitest';
import { canonicalPayloadSnapshot, hashCanonicalPayload } from './canonicalPayload';
import { closeLocalDatabase, createDormantLocalDatabaseCapability, openLocalDatabase } from './index';
import { deriveOutboxIdempotencyKey, deriveOutboxMutationId } from './outboxIdentity';
import {
  createK323V2HttpClient, K323V2AmbiguousResponseError, outboxToK323V2Mutation,
  pullResponseToRemoteBatch, receiptToOutboxAcknowledgement,
  type K323V2ActiveScope, type K323V2Domain, type K323V2MutationReceipt,
  type K323V2PullResponse, type K323V2PullResponseContext, type K323V2ResponseContext,
} from './k323V2Transport';
import type { LocalEntityEnvelope, OutboxOperation, OutboxRecord } from './types';

const ACCOUNT = '11111111-1111-4111-8111-111111111111';
const OTHER_ACCOUNT = '22222222-2222-4222-8222-222222222222';
const ENTITY = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const ENTITY_2 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const NAMESPACE = '1'.repeat(64);
const T0 = '2026-09-18T00:00:00.000Z';
const T1 = '2026-09-18T00:00:01.000Z';
const EPOCH = '33333333-3333-4333-8333-333333333333';

const scope: K323V2ActiveScope = {
  accountId: ACCOUNT, namespaceKey: NAMESPACE, generationId: 'generation-1', deviceId: 'device-a',
};

function recordFor(domain: K323V2Domain, entityId = ENTITY): Record<string, unknown> {
  if (domain === 'reference_alpha') return { id: entityId, label: 'alpha', ordinal: 7 };
  if (domain === 'reference_beta') return { id: entityId, metric: 'score', value: 9, observedAt: T0 };
  if (domain === 'health_routine_profile') {
    return { id: entityId, activePresetId: '00000000-0000-5000-8000-000000000001' };
  }
  return {
    id: entityId,
    name: 'Default',
    splitCount: 1,
    days: [{ dayName: 'Day 1', blocks: [], plannedSets: {} }],
    isDefault: entityId === '00000000-0000-5000-8000-000000000001',
  };
}

function outbox(
  domain: K323V2Domain = 'reference_alpha',
  operation: OutboxOperation = 'upsert',
  localRevision = 1,
  entityId = ENTITY,
): OutboxRecord {
  const payload = operation === 'tombstone'
    ? { kind: 'tombstone' as const, entityId, deletedAt: T1, revision: localRevision }
    : { kind: 'entity_snapshot' as const, record: recordFor(domain, entityId) };
  const payloadHash = hashCanonicalPayload(payload);
  const identity = {
    namespaceKey: NAMESPACE, generationId: 'generation-1', domain, entityId,
    localRevision, operation, payloadHash,
  };
  return {
    namespaceKey: NAMESPACE, generationId: 'generation-1', accountId: ACCOUNT, deviceId: 'device-a',
    mutationId: deriveOutboxMutationId(identity), domain, entityId, operation,
    baseRevision: localRevision === 1 ? null : localRevision - 1, localRevision,
    payloadMode: 'inline', payload: canonicalPayloadSnapshot(payload), payloadHash,
    createdAt: T0, updatedAt: T0, availableAt: T0, attemptCount: 0, status: 'pending',
    idempotencyKey: deriveOutboxIdempotencyKey(identity), lastAttemptAt: null, lastErrorCode: null,
    leaseOwner: null, leaseExpiresAt: null, acknowledgedAt: null, acknowledgedBy: null,
    remoteMutationRef: null, acknowledgedRevision: null, serverCommittedAt: null,
    supersededByMutationId: null, resurrection: null, deliveryBlockCode: null, generationBoundary: null,
  };
}

function receipt(value: OutboxRecord, serverRevision = 1): K323V2MutationReceipt {
  return {
    protocolVersion: 2, outcome: 'applied', mutationId: value.mutationId, idempotencyKey: value.idempotencyKey,
    domain: value.domain as K323V2Domain, entityId: value.entityId, operation: value.operation,
    payloadHash: value.payloadHash!, remoteMutationRef: '44444444-4444-4444-8444-444444444444',
    serverRevision, changeSequence: 1, serverCommittedAt: T1, errorCode: null, retryable: false,
  };
}

function responseContext(domain: K323V2Domain = 'reference_alpha'): K323V2ResponseContext {
  return { ...scope, domain };
}

function pullContext(
  domain: K323V2Domain = 'reference_alpha',
  cursor = 0,
  serverEpoch: string | null = null,
): K323V2PullResponseContext {
  return { ...responseContext(domain), cursor, serverEpoch };
}

describe('REL-05E K-323 v2 dormant transport adapters', () => {
  it('matches the backend v2 canonical payload and replay-identity vectors', () => {
    const fixture = JSON.parse(readFileSync(
      new URL('../../../../protocol/k323-v2-identity-vectors.json', import.meta.url), 'utf8',
    )) as {
      version: number; namespaceKey: string; generationId: string;
      vectors: Array<{
        domain: K323V2Domain; entityId: string; operation: OutboxOperation; localRevision: number;
        payload: OutboxRecord['payload']; payloadHash: string; idempotencyKey: string; mutationId: string;
      }>;
    };
    expect(fixture.version).toBe(2);
    for (const vector of fixture.vectors) {
      expect(hashCanonicalPayload(vector.payload)).toBe(vector.payloadHash);
      const identity = {
        namespaceKey: fixture.namespaceKey, generationId: fixture.generationId, domain: vector.domain,
        entityId: vector.entityId, localRevision: vector.localRevision, operation: vector.operation,
        payloadHash: vector.payloadHash,
      };
      expect(deriveOutboxIdempotencyKey(identity)).toBe(vector.idempotencyKey);
      expect(deriveOutboxMutationId(identity)).toBe(vector.mutationId);
    }
  });

  it.each(['reference_alpha', 'reference_beta'] as const)('maps a %s durable outbox record without losing identity', domain => {
    const value = outbox(domain, 'upsert', 17, domain === 'reference_alpha' ? ENTITY : ENTITY_2);
    const request = outboxToK323V2Mutation(value, { ...scope, baseServerRevision: 4 });
    expect(request).toMatchObject({
      protocolVersion: 2, mutationId: value.mutationId, idempotencyKey: value.idempotencyKey,
      namespaceKey: NAMESPACE, generationId: 'generation-1', deviceId: 'device-a',
      domain, entityId: value.entityId, operation: 'upsert', baseRevision: 4, localRevision: 17,
      payloadHash: value.payloadHash,
    });
    expect(request.baseRevision).not.toBe(value.baseRevision);
  });

  it.each([
    ['health_routine_preset', '00000000-0000-5000-8000-000000000001'],
    ['health_routine_profile', '00000000-0000-5000-8000-000000000002'],
  ] as const)('maps only a closed %s production payload', (domain, entityId) => {
    const value = outbox(domain, 'upsert', 1, entityId);
    expect(outboxToK323V2Mutation(value, { ...scope, baseServerRevision: null })).toMatchObject({
      domain, entityId, payload: { kind: 'entity_snapshot' },
    });
    const malformed = structuredClone(value);
    (malformed.payload as { record: Record<string, unknown> }).record.unexpected = true;
    malformed.payloadHash = hashCanonicalPayload(malformed.payload);
    const identity = {
      namespaceKey: malformed.namespaceKey, generationId: malformed.generationId,
      domain: malformed.domain, entityId: malformed.entityId, localRevision: malformed.localRevision,
      operation: malformed.operation, payloadHash: malformed.payloadHash,
    };
    malformed.idempotencyKey = deriveOutboxIdempotencyKey(identity);
    malformed.mutationId = deriveOutboxMutationId(identity);
    expect(() => outboxToK323V2Mutation(malformed, { ...scope, baseServerRevision: null }))
      .toThrowError(expect.objectContaining({ code: 'INVALID_RESERVED_RECORD' }));
  });

  it('keeps restore explicit while preserving the payload-bound durable identity', () => {
    const value = outbox('reference_alpha', 'restore', 8);
    const request = outboxToK323V2Mutation(value, { ...scope, baseServerRevision: 2 });
    expect(request).toMatchObject({ operation: 'restore', baseRevision: 2, payload: { kind: 'entity_snapshot' } });
    expect(request.mutationId).toBe(deriveOutboxMutationId({
      namespaceKey: value.namespaceKey, generationId: value.generationId, domain: value.domain,
      entityId: value.entityId, localRevision: value.localRevision, operation: value.operation,
      payloadHash: value.payloadHash!,
    }));
  });

  it('fails closed on payload substitution and unsupported production domains', () => {
    const substituted = outbox();
    (substituted.payload as { record: { label: string } }).record.label = 'substituted';
    expect(() => outboxToK323V2Mutation(substituted, { ...scope, baseServerRevision: null }))
      .toThrowError(expect.objectContaining({ code: 'INVALID_RESERVED_RECORD' }));
    const production = { ...outbox(), domain: 'notes' };
    expect(() => outboxToK323V2Mutation(production, { ...scope, baseServerRevision: null }))
      .toThrowError(expect.objectContaining({ code: 'INVALID_RESERVED_RECORD' }));
  });

  it('maps only a fully bound applied receipt into an acknowledgement', () => {
    const value = outbox();
    expect(receiptToOutboxAcknowledgement(value, receipt(value, 6), responseContext(), scope, 'worker-a', T1))
      .toEqual({
        mutationId: value.mutationId, workerId: 'worker-a', now: T1,
        remoteMutationRef: '44444444-4444-4444-8444-444444444444',
        acknowledgedRevision: 6, serverCommittedAt: T1,
      });
    expect(() => receiptToOutboxAcknowledgement(
      value, { ...receipt(value), payloadHash: 'f'.repeat(64) }, responseContext(), scope, 'worker-a', T1,
    )).toThrowError(expect.objectContaining({ code: 'INVALID_RESERVED_RECORD' }));
  });

  it('rejects a receipt captured under a stale account, namespace, generation, or device', () => {
    const value = outbox();
    for (const active of [
      { ...scope, accountId: OTHER_ACCOUNT }, { ...scope, namespaceKey: '2'.repeat(64) },
      { ...scope, generationId: 'generation-2' }, { ...scope, deviceId: 'device-b' },
    ]) {
      expect(() => receiptToOutboxAcknowledgement(
        value, receipt(value), responseContext(), active, 'worker-a', T1,
      )).toThrowError(expect.objectContaining({ code: 'INVALID_RESERVED_RECORD' }));
    }
    const foreignOutbox = { ...value, accountId: OTHER_ACCOUNT };
    expect(() => receiptToOutboxAcknowledgement(
      foreignOutbox, receipt(foreignOutbox), responseContext(), scope, 'worker-a', T1,
    )).toThrowError(expect.objectContaining({ code: 'INVALID_RESERVED_RECORD' }));
  });

  it('maps ordered pull changes into one entity/checkpoint batch with server revisions', () => {
    const response: K323V2PullResponse<{ id: string; label: string; ordinal: number }> = {
      protocolVersion: 2, status: 'changes', domain: 'reference_alpha', serverEpoch: EPOCH,
      retentionFloor: 0, nextCursor: 12, errorCode: null,
      changes: [{
        sequence: 12, domain: 'reference_alpha', entityId: ENTITY, operation: 'upsert', serverRevision: 5,
        record: { id: ENTITY, label: 'remote', ordinal: 12 }, isDeleted: false, deletedAt: null,
        remoteMutationRef: '55555555-5555-4555-8555-555555555555', serverCommittedAt: T1,
      }],
    };
    const result = pullResponseToRemoteBatch(response, {
      context: pullContext(), activeScope: scope, currentEntities: new Map(), now: T1,
    });
    expect(result).toMatchObject({ kind: 'batch', batch: {
      namespaceKey: NAMESPACE, generationId: 'generation-1', accountId: ACCOUNT,
      domain: 'reference_alpha', provider: 'k323-v2', checkpointValue: '12', sequence: 12,
      serverEpoch: EPOCH,
      entities: [{ expectedLocalRevision: null, entity: {
        entityId: ENTITY, revision: 1, localRevision: 1, serverRevision: 5,
        record: { id: ENTITY, label: 'remote', ordinal: 12 },
      } }],
    } });
  });

  it('collapses repeated entities to the latest ordered server change before atomic apply', () => {
    const response: K323V2PullResponse<Record<string, unknown>> = {
      protocolVersion: 2, status: 'changes', domain: 'reference_alpha', serverEpoch: EPOCH,
      retentionFloor: 0, nextCursor: 8, errorCode: null,
      changes: [7, 8].map(sequence => ({
        sequence, domain: 'reference_alpha' as const, entityId: ENTITY, operation: 'upsert' as const,
        serverRevision: sequence - 5, record: { id: ENTITY, label: `v${sequence}`, ordinal: sequence },
        isDeleted: false, deletedAt: null, remoteMutationRef: `${sequence}`.repeat(8).slice(0, 8)
          + '-7777-4777-8777-777777777777', serverCommittedAt: T1,
      })),
    };
    const result = pullResponseToRemoteBatch(response, {
      context: pullContext(), activeScope: scope, currentEntities: new Map(), now: T1,
    });
    expect(result.kind).toBe('batch');
    if (result.kind === 'batch') {
      expect(result.batch.entities).toHaveLength(1);
      expect(result.batch.entities[0].entity).toMatchObject({ serverRevision: 3, record: { label: 'v8' } });
    }
  });

  it('represents full resync without producing a clear-local batch', () => {
    const result = pullResponseToRemoteBatch({
      protocolVersion: 2, status: 'full_resync_required', domain: 'reference_alpha', serverEpoch: EPOCH,
      retentionFloor: 40, nextCursor: 40, changes: [], errorCode: 'CURSOR_INVALID',
    }, { context: pullContext(), activeScope: scope, currentEntities: new Map(), now: T1 });
    expect(result).toEqual({
      kind: 'full_resync_required', domain: 'reference_alpha', serverEpoch: EPOCH,
      retentionFloor: 40, reason: 'CURSOR_INVALID',
    });
    expect(result).not.toHaveProperty('batch');
  });

  it('rejects pull pages that could skip a cursor or disguise tombstone state', () => {
    const base: K323V2PullResponse<Record<string, unknown>> = {
      protocolVersion: 2, status: 'changes', domain: 'reference_alpha', serverEpoch: EPOCH,
      retentionFloor: 0, nextCursor: 12, errorCode: null,
      changes: [{
        sequence: 12, domain: 'reference_alpha', entityId: ENTITY, operation: 'upsert', serverRevision: 5,
        record: recordFor('reference_alpha'), isDeleted: false, deletedAt: null,
        remoteMutationRef: '55555555-5555-4555-8555-555555555555', serverCommittedAt: T1,
      }],
    };
    expect(() => pullResponseToRemoteBatch(base, {
      context: pullContext('reference_alpha', 12, EPOCH), activeScope: scope, currentEntities: new Map(), now: T1,
    })).toThrowError(expect.objectContaining({ code: 'INVALID_RESERVED_RECORD' }));
    expect(() => pullResponseToRemoteBatch({
      ...base, changes: [{ ...base.changes[0], operation: 'tombstone' }],
    }, {
      context: pullContext('reference_alpha', 11, EPOCH), activeScope: scope, currentEntities: new Map(), now: T1,
    })).toThrowError(expect.objectContaining({ code: 'INVALID_RESERVED_RECORD' }));
  });

  it('rejects a foreign scope and skips an older remote server revision', () => {
    const response: K323V2PullResponse<Record<string, unknown>> = {
      protocolVersion: 2, status: 'changes', domain: 'reference_alpha', serverEpoch: EPOCH,
      retentionFloor: 0, nextCursor: 12, errorCode: null,
      changes: [{
        sequence: 12, domain: 'reference_alpha', entityId: ENTITY, operation: 'upsert', serverRevision: 5,
        record: recordFor('reference_alpha'), isDeleted: false, deletedAt: null,
        remoteMutationRef: '55555555-5555-4555-8555-555555555555', serverCommittedAt: T1,
      }],
    };
    const current = {
      namespaceKey: NAMESPACE, generationId: 'generation-1', accountId: OTHER_ACCOUNT,
      domain: 'reference_alpha', entityId: ENTITY, record: recordFor('reference_alpha'),
      revision: 3, localRevision: 3, serverRevision: 6, createdAt: T0, updatedAt: T0,
      deletedAt: null, isDeleted: false, deletionState: 'active', ownerId: OTHER_ACCOUNT,
      contentHash: hashCanonicalPayload(recordFor('reference_alpha')), pendingMutationId: null,
      lastRemoteMutationRef: null, source: { kind: 'remote', reference: 'k323-v2' },
      restoreProvenance: null, migrationProvenance: null,
    } satisfies LocalEntityEnvelope<Record<string, unknown>>;
    expect(() => pullResponseToRemoteBatch(response, {
      context: pullContext(), activeScope: scope, currentEntities: new Map([[ENTITY, current]]), now: T1,
    })).toThrowError(expect.objectContaining({ code: 'INVALID_RESERVED_RECORD' }));
    expect(() => pullResponseToRemoteBatch(response, {
      context: pullContext(), activeScope: { ...scope, accountId: OTHER_ACCOUNT },
      currentEntities: new Map([[ENTITY, current]]), now: T1,
    })).toThrowError(expect.objectContaining({ code: 'INVALID_RESERVED_RECORD' }));
    const newerCurrent = { ...current, accountId: ACCOUNT, ownerId: ACCOUNT };
    const result = pullResponseToRemoteBatch(response, {
      context: pullContext(), activeScope: scope,
      currentEntities: new Map([[ENTITY, newerCurrent]]), now: T1,
    });
    expect(result).toMatchObject({
      kind: 'batch',
      batch: { entities: [], sequence: 12 },
    });
  });

  it.each(['upsert', 'tombstone', 'restore'] as const)(
    'blocks the whole %s pull page when the target has pending local authority', operation => {
      const pendingMutationId = outbox().mutationId;
      const current = {
        namespaceKey: NAMESPACE, generationId: 'generation-1', accountId: ACCOUNT,
        domain: 'reference_alpha', entityId: ENTITY, record: recordFor('reference_alpha'),
        revision: 3, localRevision: 3, serverRevision: 4, createdAt: T0, updatedAt: T0,
        deletedAt: null, isDeleted: false, deletionState: 'active', ownerId: ACCOUNT,
        contentHash: hashCanonicalPayload(recordFor('reference_alpha')), pendingMutationId,
        lastRemoteMutationRef: null, source: { kind: 'local', reference: 'pending' },
        restoreProvenance: null, migrationProvenance: null,
      } satisfies LocalEntityEnvelope<Record<string, unknown>>;
      const isDeleted = operation === 'tombstone';
      const response: K323V2PullResponse<Record<string, unknown>> = {
        protocolVersion: 2, status: 'changes', domain: 'reference_alpha', serverEpoch: EPOCH,
        retentionFloor: 0, nextCursor: 12, errorCode: null,
        changes: [{
          sequence: 12, domain: 'reference_alpha', entityId: ENTITY, operation, serverRevision: 5,
          record: recordFor('reference_alpha'), isDeleted, deletedAt: isDeleted ? T1 : null,
          remoteMutationRef: '55555555-5555-4555-8555-555555555555', serverCommittedAt: T1,
        }],
      };

      expect(() => pullResponseToRemoteBatch(response, {
        context: pullContext(), activeScope: scope, currentEntities: new Map([[ENTITY, current]]), now: T1,
      })).toThrowError(expect.objectContaining({ code: 'INVALID_RESERVED_RECORD' }));
      expect(current).toMatchObject({ pendingMutationId, record: { label: 'alpha' }, revision: 3 });
    },
  );

  it('does not commit any entity or checkpoint when one entity in a page has pending local authority', async () => {
    const repository = await openLocalDatabase({
      userId: ACCOUNT, projectRef: 'project-test', deviceId: 'device-a', generationId: 'generation-1', schemaVersion: 1,
    }, {
      capability: createDormantLocalDatabaseCapability('rel05e-test'),
      indexedDBFactory: new IDBFactory(),
      clock: () => T0,
    });
    await repository.initializeNamespace();
    const pending = await repository.commitLocalMutation({
      mutation: { mode: 'create', domain: 'reference_alpha', entityId: ENTITY, record: recordFor('reference_alpha') },
      now: T0,
    });
    const original = await repository.getEntity<Record<string, unknown>>('reference_alpha', ENTITY);
    const response: K323V2PullResponse<Record<string, unknown>> = {
      protocolVersion: 2, status: 'changes', domain: 'reference_alpha', serverEpoch: EPOCH,
      retentionFloor: 0, nextCursor: 13, errorCode: null,
      changes: [
        {
          sequence: 12, domain: 'reference_alpha', entityId: ENTITY_2, operation: 'upsert', serverRevision: 1,
          record: recordFor('reference_alpha', ENTITY_2), isDeleted: false, deletedAt: null,
          remoteMutationRef: '55555555-5555-4555-8555-555555555555', serverCommittedAt: T1,
        },
        {
          sequence: 13, domain: 'reference_alpha', entityId: ENTITY, operation: 'upsert', serverRevision: 2,
          record: { id: ENTITY, label: 'remote', ordinal: 8 }, isDeleted: false, deletedAt: null,
          remoteMutationRef: '66666666-6666-4666-8666-666666666666', serverCommittedAt: T1,
        },
      ],
    };
    try {
      expect(() => pullResponseToRemoteBatch(response, {
        context: pullContext(), activeScope: scope,
        currentEntities: new Map([[ENTITY, original!]]), now: T1,
      })).toThrowError(expect.objectContaining({ code: 'INVALID_RESERVED_RECORD' }));
      expect(await repository.getEntity('reference_alpha', ENTITY)).toEqual(original);
      expect((await repository.getEntity('reference_alpha', ENTITY))?.pendingMutationId).toBe(pending.outbox.mutationId);
      expect(await repository.getEntity('reference_alpha', ENTITY_2)).toBeNull();
      expect(await repository.getSyncCheckpoint('k323-v2', 'reference_alpha')).toBeNull();
    } finally {
      closeLocalDatabase(repository);
    }
  });

  it('treats a missing mutation response as ambiguous and requires exact replay', async () => {
    const value = outbox();
    const request = outboxToK323V2Mutation(value, { ...scope, baseServerRevision: null });
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError('connection reset'));
    const client = createK323V2HttpClient({
      baseUrl: 'https://example.test', getAccessToken: async () => 'jwt', fetchImpl,
    });
    await expect(client.push(request)).rejects.toBeInstanceOf(K323V2AmbiguousResponseError);
    expect(fetchImpl).toHaveBeenCalledWith('https://example.test/api/sync/v2/mutations', expect.objectContaining({
      method: 'POST', body: JSON.stringify(request), headers: expect.objectContaining({ authorization: 'Bearer jwt' }),
    }));
  });

  it('also treats an untrusted response binding as ambiguous', async () => {
    const value = outbox();
    const request = outboxToK323V2Mutation(value, { ...scope, baseServerRevision: null });
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      ...receipt(value), entityId: ENTITY_2,
    }), { status: 200, headers: { 'content-type': 'application/json' } }));
    const client = createK323V2HttpClient({
      baseUrl: 'https://example.test', getAccessToken: async () => 'jwt', fetchImpl,
    });
    await expect(client.push(request)).rejects.toBeInstanceOf(K323V2AmbiguousResponseError);
  });

  it('treats a bound retryable 503 as ambiguous and preserves the exact replay request', async () => {
    const value = outbox();
    const request = outboxToK323V2Mutation(value, { ...scope, baseServerRevision: null });
    const uncertain: K323V2MutationReceipt = {
      ...receipt(value), outcome: 'rejected', remoteMutationRef: null, serverRevision: null,
      changeSequence: null, serverCommittedAt: null, errorCode: 'TRANSIENT_SERVER_FAILURE', retryable: true,
    };
    const client = createK323V2HttpClient({
      baseUrl: 'https://example.test', getAccessToken: async () => 'jwt',
      fetchImpl: vi.fn().mockResolvedValue(new Response(JSON.stringify(uncertain), { status: 503 })),
    });

    await expect(client.push(request)).rejects.toMatchObject({
      code: 'AMBIGUOUS_NETWORK_RESPONSE', request,
    });
  });

  it.each([
    ['revision_conflict', 'REMOTE_REVISION_CONFLICT'],
    ['rejected', 'IDEMPOTENCY_CONFLICT'],
    ['rejected', 'MUTATION_ID_CONFLICT'],
  ] as const)('keeps deterministic 409 %s/%s responses deterministic', async (outcome, errorCode) => {
    const value = outbox();
    const request = outboxToK323V2Mutation(value, { ...scope, baseServerRevision: null });
    const deterministic: K323V2MutationReceipt = {
      ...receipt(value), outcome, remoteMutationRef: null, serverRevision: null,
      changeSequence: null, serverCommittedAt: null, errorCode, retryable: false,
    };
    const client = createK323V2HttpClient({
      baseUrl: 'https://example.test', getAccessToken: async () => 'jwt',
      fetchImpl: vi.fn().mockResolvedValue(new Response(JSON.stringify(deterministic), { status: 409 })),
    });

    await expect(client.push(request)).resolves.toEqual(deterministic);
  });

  it('has no production caller or automatic lifecycle activation', () => {
    const transport = readFileSync(new URL('k323V2Transport.ts', import.meta.url), 'utf8');
    const production = [
      '../../App.tsx', '../../store/useNotesStore.ts', '../notesSyncClient.ts',
      '../../components/views/HealthView.tsx', '../../components/views/NoteView.tsx',
    ].map(path => readFileSync(new URL(path, import.meta.url), 'utf8')).join('\n');
    expect(production).not.toMatch(/k323V2Transport|createK323V2HttpClient|outboxToK323V2Mutation/);
    expect(transport).not.toMatch(/addEventListener\s*\(|setInterval\s*\(|navigator\.locks|visibilitychange/);
  });
});
