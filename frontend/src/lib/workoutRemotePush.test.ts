import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { afterEach, describe, expect, it } from 'vitest';
import { hashCanonicalPayload } from './localDatabase/canonicalPayload';
import {
  closeLocalDatabase, createDormantLocalDatabaseCapability, openLocalDatabase,
  type LocalDatabaseRepository, type LocalDatabaseNamespace,
} from './localDatabase';
import { WorkoutSessionRepository } from './workoutSessionRepository';
import type { WorkoutSessionV1 } from './workoutSessionV1';
import { runWorkoutPushIteration, type WorkoutPushOptions } from './workoutRemotePush';

const OWNER = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const ID = 'abcdefab-cdef-4abc-8def-abcdefabcdef';
const BINDING = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const REF = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const EPOCH = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const T0 = '2026-09-27T00:00:00.000Z';
const T1 = '2026-09-27T00:01:00.000Z';
const T2 = '2026-09-27T00:02:00.000Z';
const T3 = '2026-09-27T00:03:00.000Z';
const namespace: LocalDatabaseNamespace = {
  userId: OWNER, projectRef: 'client-project-is-not-server-project',
  deviceId: 'device-desktop', generationId: 'generation-desktop', schemaVersion: 1,
};
const opened: LocalDatabaseRepository[] = [];

function session(reps = 8, id = ID): WorkoutSessionV1 {
  return { version: 1, id, localDate: '2026-09-27', entries: [{
    id: '2aaaaaaa-2222-4222-8222-222222222222',
    exercise: { id: null, name: 'Push-up', type: 'bodyweight', tags: [], cardioMode: null },
    sets: [{ id: '3bbbbbbb-3333-4333-8333-333333333333', ordinal: 1,
      kind: 'bodyweight', loadKind: 'bodyweight', reps, assistedReps: null,
      dropset: false, done: true }],
  }] };
}

async function setup(id = ID, bindInitially = true) {
  const factory = new IDBFactory();
  const repo = await openLocalDatabase(namespace, {
    capability: createDormantLocalDatabaseCapability('test'), indexedDBFactory: factory, clock: () => T0,
  });
  opened.push(repo);
  await repo.initializeNamespace();
  const workouts = new WorkoutSessionRepository(repo, () => T0);
  const created = await workouts.createWorkoutSession(session(8, id), { now: T0 });
  await freshAuthority(repo);
  if (bindInitially) await bind(repo, created.outbox.mutationId);
  return { repo, workouts, created, factory };
}

async function freshAuthority(repo: LocalDatabaseRepository) {
  const sequence = await repo.reserveWorkoutRemoteDiscovery();
  const verificationId = `dddddddd-dddd-4ddd-8ddd-${sequence.toString(16).padStart(12, '0')}`;
  await repo.persistWorkoutRemoteAuthority({
    accountId: OWNER, namespaceKey: repo.namespaceKey, generationId: namespace.generationId,
    domain: 'health_workout_session', deviceId: namespace.deviceId, protocolVersion: 2,
    projectScope: 'nondefault-workout-project', capability: 'FOUNDATION_READY', authorityState: 'OPEN',
    authorityEpoch: 1, bindingState: 'bound', generationBindingId: BINDING, serverEpoch: EPOCH,
    verifiedAt: T0, discoverySequence: sequence, verificationId,
  }, () => OWNER, () => namespace.deviceId);
  return verificationId;
}

async function bind(repo: LocalDatabaseRepository, mutationId: string, verificationId?: string) {
  return repo.bindWorkoutMutation({ mutationId,
    expectedVerificationId: verificationId ?? 'dddddddd-dddd-4ddd-8ddd-000000000001',
    currentAuthenticatedAccount: () => OWNER, currentDeviceId: () => namespace.deviceId });
}

function receipt(request: Record<string, any>, outcome: 'success' | 'exact_replay' = 'success') {
  return {
    protocolVersion: 2, outcome, errorCode: null, domain: 'health_workout_session',
    entityId: request.entityId, mutationId: request.mutationId,
    idempotencyKey: request.idempotencyKey, operation: request.operation,
    payloadHash: request.payloadHash,
    contentHash: request.payload.kind === 'entity_snapshot'
      ? hashCanonicalPayload(request.payload.record) : 'a'.repeat(64),
    authorityEpoch: request.authorityEpoch, bindingId: request.bindingId,
    remoteMutationRef: REF, serverRevision: (request.remoteCasBaseRevision ?? 0) + 1,
    changeSequence: 1, serverCommittedAt: T1,
  };
}

function options(fetchImpl: typeof fetch, now = () => T1): WorkoutPushOptions {
  return { baseUrl: 'https://example.invalid', getSession: async () => ({ accountId: OWNER, accessToken: 'test-token' }),
    currentAccountId: () => OWNER, currentDeviceId: () => namespace.deviceId,
    fetchImpl, now, retryBaseDelayMs: 1_000, retryMaxDelayMs: 8_000 };
}

function server(handler: (request: Record<string, any>) => Response | Promise<Response>): typeof fetch {
  return (async (_url: RequestInfo | URL, init?: RequestInit) => {
    const request = JSON.parse(String(init?.body)) as Record<string, any>;
    return handler(request);
  }) as typeof fetch;
}

afterEach(() => { for (const repo of opened.splice(0)) closeLocalDatabase(repo); });

describe('REL-05G4B2 dormant bound workout push', () => {
  it('never claims an unbound Workout row', async () => {
    const { repo, created } = await setup(ID, false);
    let sent = 0;
    const result = await runWorkoutPushIteration(repo, options(server(request => {
      sent += 1; return Response.json(receipt(request));
    })));
    expect(result.claimed).toBe(0);
    expect(sent).toBe(0);
    expect((await repo.getOutboxRecord(created.outbox.mutationId))?.deliveryBinding)
      .toEqual({ version: 1, state: 'unbound' });
  });

  it('sends only a frozen bound first create and durably settles remote revision/ref', async () => {
    const { repo, created } = await setup();
    let wire: Record<string, any> | null = null;
    const result = await runWorkoutPushIteration(repo, options(server(request => {
      wire = request;
      return Response.json(receipt(request));
    })));
    expect(result).toMatchObject({ claimed: 1, success: 1, blocked: 0 });
    expect(wire).toMatchObject({ protocolVersion: 2, domain: 'health_workout_session',
      entityId: ID, remoteCasBaseRevision: null, payload: created.outbox.payload });
    expect(wire).not.toHaveProperty('projectScope');
    const stored = await repo.getOutboxRecord(created.outbox.mutationId);
    expect(stored).toMatchObject({ status: 'acknowledged', acknowledgedRevision: 1,
      remoteMutationRef: REF, serverCommittedAt: T1, deliveryBinding: {
        requestDigest: (wire as Record<string, any>).requestDigest, remoteCasBaseRevision: null,
      } });
    expect(await repo.getSyncCheckpoint('workout-v2', 'health_workout_session')).toBeNull();
    expect(await repo.claimNextMutations({ workerId: 'generic', now: T2,
      leaseDurationMs: 30_000, limit: 10 })).toEqual([]);
  });

  it('retries an uncertain commit as an identical request and settles exact replay', async () => {
    const { repo, created } = await setup();
    const original = await repo.getOutboxRecord(created.outbox.mutationId);
    let at = T1;
    const sent: string[] = [];
    let count = 0;
    const fetchImpl = (async (_url: RequestInfo | URL, init?: RequestInit) => {
      const body = String(init?.body); sent.push(body); count += 1;
      if (count === 1) throw new Error('response_lost_after_server_commit');
      return Response.json(receipt(JSON.parse(body), 'exact_replay'));
    }) as typeof fetch;
    expect(await runWorkoutPushIteration(repo, options(fetchImpl, () => at)))
      .toMatchObject({ retryable: 1, success: 0 });
    const afterLoss = await repo.getOutboxRecord(created.outbox.mutationId);
    expect(afterLoss?.status).toBe('retry_wait');
    expect(afterLoss?.deliveryBinding).toEqual(original?.deliveryBinding);
    at = T2;
    expect(await runWorkoutPushIteration(repo, options(fetchImpl, () => at)))
      .toMatchObject({ exactReplay: 1, success: 0 });
    expect(sent).toHaveLength(2);
    expect(sent[1]).toBe(sent[0]);
    expect(await repo.getOutboxRecord(created.outbox.mutationId)).toMatchObject({
      status: 'acknowledged', acknowledgedRevision: 1, remoteMutationRef: REF,
    });
  });

  it.each([
    ['CAS_CONFLICT', 'conflict'], ['ENTITY_ALREADY_EXISTS', 'conflict'],
    ['ENTITY_NOT_TOMBSTONED', 'conflict'], ['ENTITY_TOMBSTONED', 'conflict'],
    ['STALE_AUTHORITY_EPOCH', 'permanent_failure'], ['STALE_GENERATION_BINDING', 'permanent_failure'],
    ['AUTHORITY_EVIDENCE_MISSING', 'permanent_failure'], ['REQUEST_DIGEST_MISMATCH', 'permanent_failure'],
    ['MUTATION_ID_CONFLICT', 'permanent_failure'], ['IDEMPOTENCY_CONFLICT', 'permanent_failure'],
    ['CAPABILITY_DISABLED', 'permanent_failure'],
  ])('durably classifies %s without rebinding', async (code, status) => {
    const { repo, created } = await setup();
    const initial = await repo.getOutboxRecord(created.outbox.mutationId);
    const result = await runWorkoutPushIteration(repo, options(server(() => new Response(JSON.stringify({
      outcome: 'rejected', errorCode: code, currentServerRevision: 4,
      currentContentHash: 'a'.repeat(64), currentIsDeleted: false, currentRemoteMutationRef: REF,
    }), { status: code === 'REQUEST_DIGEST_MISMATCH' ? 400 : 409 }))));
    expect(result.blocked).toBe(0);
    const stored = await repo.getOutboxRecord(created.outbox.mutationId);
    expect(stored?.status).toBe(status);
    expect(stored?.lastErrorCode).toBe(code);
    expect(stored?.deliveryBinding).toEqual(initial?.deliveryBinding);
    expect(stored?.payload).toEqual(initial?.payload);
    expect(await repo.claimNextBoundWorkoutMutations({ workerId: 'later', now: T2,
      leaseDurationMs: 30_000, limit: 10, recoverExpiredClaims: true,
      currentAccountId: () => OWNER, currentDeviceId: () => namespace.deviceId })).toEqual([]);
  });

  it('does not acknowledge a malformed success, then replays the same bound row', async () => {
    const { repo, created } = await setup();
    let at = T1;
    let attempts = 0;
    const fetchImpl = server(request => {
      attempts += 1;
      return Response.json(attempts === 1
        ? { ...receipt(request), mutationId: 'mut.00000000-0000-4000-8000-000000000000' }
        : receipt(request, 'exact_replay'));
    });
    expect(await runWorkoutPushIteration(repo, options(fetchImpl, () => at))).toMatchObject({ retryable: 1 });
    expect((await repo.getOutboxRecord(created.outbox.mutationId))?.status).toBe('retry_wait');
    at = T2;
    expect(await runWorkoutPushIteration(repo, options(fetchImpl, () => at))).toMatchObject({ exactReplay: 1 });
  });

  it('preserves M2 while settling M1 and later binds M2 to M1 remote revision', async () => {
    const { repo, workouts, created } = await setup();
    let m2Id = '';
    const result = await runWorkoutPushIteration(repo, options(server(async request => {
      const m2 = await workouts.updateWorkoutSession(ID, 1, session(9), { now: T1 });
      m2Id = m2.outbox.mutationId;
      return Response.json(receipt(request));
    })));
    expect(result.success).toBe(1);
    expect(await repo.getOutboxRecord(created.outbox.mutationId)).toMatchObject({
      status: 'acknowledged', acknowledgedRevision: 1,
    });
    const entity = await repo.getEntity<WorkoutSessionV1>('health_workout_session', ID);
    expect(entity?.localRevision).toBe(2);
    expect(entity?.pendingMutationId).toBe(m2Id);
    expect(entity?.record.entries[0].sets[0].reps).toBe(9);
    expect((await repo.getOutboxRecord(m2Id))?.deliveryBinding).toEqual({ version: 1, state: 'unbound' });
    const verificationId = await freshAuthority(repo);
    const boundM2 = await bind(repo, m2Id, verificationId);
    expect(boundM2.deliveryBinding).toMatchObject({ remoteCasBaseRevision: 1 });
  });

  it('sends update, mixed-case tombstone, and restore against exact predecessor revisions', async () => {
    const mixed = ID.toUpperCase();
    const { repo, workouts, created } = await setup(mixed);
    let at = T1;
    const sent: Record<string, any>[] = [];
    const fetchImpl = server(request => { sent.push(request); return Response.json(receipt(request)); });
    expect((await runWorkoutPushIteration(repo, options(fetchImpl, () => at))).success).toBe(1);
    const updated = await workouts.updateWorkoutSession(mixed, 1, session(9, mixed), { now: T2 });
    await bind(repo, updated.outbox.mutationId, await freshAuthority(repo));
    at = T3;
    expect((await runWorkoutPushIteration(repo, options(fetchImpl, () => at))).success).toBe(1);
    expect(sent[1]).toMatchObject({ remoteCasBaseRevision: 1, entityId: ID });
    expect(await repo.getOutboxRecord(updated.outbox.mutationId)).toMatchObject({
      status: 'acknowledged', acknowledgedRevision: 2,
      deliveryBinding: { remoteCasBaseRevision: 1 },
    });
    const deleted = await workouts.deleteWorkoutSession(mixed, 2, {
      now: '2026-09-27T00:04:00.000Z',
    });
    await bind(repo, deleted.outbox.mutationId, await freshAuthority(repo));
    at = '2026-09-27T00:05:00.000Z';
    expect((await runWorkoutPushIteration(repo, options(fetchImpl, () => at))).success).toBe(1);
    expect(sent[2]).toMatchObject({ operation: 'tombstone', entityId: ID,
      remoteCasBaseRevision: 2, payload: { entityId: mixed } });
    expect(await repo.getOutboxRecord(deleted.outbox.mutationId)).toMatchObject({
      status: 'acknowledged', acknowledgedRevision: 3,
    });
    const restored = await workouts.restoreWorkoutSession(mixed, 3, session(10, mixed), {
      now: '2026-09-27T00:06:00.000Z',
    });
    await bind(repo, restored.outbox.mutationId, await freshAuthority(repo));
    at = '2026-09-27T00:07:00.000Z';
    expect((await runWorkoutPushIteration(repo, options(fetchImpl, () => at))).success).toBe(1);
    expect(sent[3]).toMatchObject({ operation: 'restore', remoteCasBaseRevision: 3,
      entityId: ID });
    expect(await repo.getOutboxRecord(restored.outbox.mutationId)).toMatchObject({
      status: 'acknowledged', acknowledgedRevision: 4,
    });
    expect((await repo.getOutboxRecord(created.outbox.mutationId))?.deliveryBinding?.state).toBe('bound');
  });

  it('preserves M2 through M1 exact replay after a lost response', async () => {
    const { repo, workouts, created } = await setup();
    let at = T1;
    let attempts = 0;
    let m2Id = '';
    const fetchImpl = server(async request => {
      attempts += 1;
      if (attempts === 1) {
        const m2 = await workouts.updateWorkoutSession(ID, 1, session(11), { now: T1 });
        m2Id = m2.outbox.mutationId;
        throw new Error('response_lost');
      }
      return Response.json(receipt(request, 'exact_replay'));
    });
    expect((await runWorkoutPushIteration(repo, options(fetchImpl, () => at))).retryable).toBe(1);
    at = T2;
    expect((await runWorkoutPushIteration(repo, options(fetchImpl, () => at))).exactReplay).toBe(1);
    expect(await repo.getOutboxRecord(created.outbox.mutationId)).toMatchObject({
      status: 'acknowledged', acknowledgedRevision: 1,
    });
    expect(await repo.getEntity<WorkoutSessionV1>('health_workout_session', ID)).toMatchObject({
      pendingMutationId: m2Id, record: { entries: [{ sets: [{ reps: 11 }] }] },
    });
    expect((await bind(repo, m2Id, await freshAuthority(repo))).deliveryBinding)
      .toMatchObject({ remoteCasBaseRevision: 1 });
  });

  it.each(['CAS_CONFLICT', 'STALE_AUTHORITY_EPOCH'])
  ('preserves M2 and blocks successor binding after M1 %s', async code => {
    const { repo, workouts, created } = await setup();
    let m2Id = '';
    const result = await runWorkoutPushIteration(repo, options(server(async () => {
      const m2 = await workouts.updateWorkoutSession(ID, 1, session(12), { now: T1 });
      m2Id = m2.outbox.mutationId;
      return new Response(JSON.stringify({ outcome: 'rejected', errorCode: code,
        currentServerRevision: 7, currentContentHash: 'a'.repeat(64),
        currentIsDeleted: false, currentRemoteMutationRef: REF }), { status: 409 });
    })));
    expect(result.blocked).toBe(0);
    expect(await repo.getOutboxRecord(created.outbox.mutationId)).toMatchObject({
      status: code === 'CAS_CONFLICT' ? 'conflict' : 'permanent_failure', lastErrorCode: code,
    });
    expect(await repo.getEntity<WorkoutSessionV1>('health_workout_session', ID)).toMatchObject({
      pendingMutationId: m2Id, record: { entries: [{ sets: [{ reps: 12 }] }] },
    });
    expect((await repo.getOutboxRecord(m2Id))?.deliveryBinding?.state).toBe('unbound');
    await expect(bind(repo, m2Id, await freshAuthority(repo))).rejects.toMatchObject({
      code: 'INVALID_OUTBOX_TRANSITION',
    });
  });

  it('uses retry_wait for 503 and keeps foundation-disabled rows durably blocked', async () => {
    const { repo, created } = await setup();
    let at = T1;
    let calls = 0;
    const fetchImpl = server(request => {
      calls += 1;
      return calls === 1
        ? new Response(JSON.stringify({ detail: 'TRANSIENT_SERVER_FAILURE' }), { status: 503 })
        : Response.json(receipt(request, 'exact_replay'));
    });
    expect((await runWorkoutPushIteration(repo, options(fetchImpl, () => at))).retryable).toBe(1);
    expect((await repo.getOutboxRecord(created.outbox.mutationId))?.status).toBe('retry_wait');
    at = T2;
    expect((await runWorkoutPushIteration(repo, options(fetchImpl, () => at))).exactReplay).toBe(1);
    const second = await setup('fedcbafe-dcba-4fed-8cba-fedcbafedcba');
    const disabled = await runWorkoutPushIteration(second.repo, options(server(() =>
      new Response(JSON.stringify({ detail: 'WORKOUT_REMOTE_FOUNDATION_DISABLED' }), { status: 423 }))));
    expect(disabled.permanent).toBe(1);
    expect(await second.repo.getOutboxRecord(second.created.outbox.mutationId))
      .toMatchObject({ status: 'permanent_failure', lastErrorCode: 'FEATURE_DISABLED' });
  });

  it.each(['mutationId', 'bindingId', 'entityId', 'serverRevision', 'remoteMutationRef'])
  ('rejects a malformed success with wrong %s', async field => {
    const { repo, created } = await setup();
    const result = await runWorkoutPushIteration(repo, options(server(request => {
      const broken: Record<string, unknown> = { ...receipt(request) };
      broken[field] = field === 'serverRevision' ? 0 : 'wrong';
      return Response.json(broken);
    })));
    expect(result).toMatchObject({ success: 0, retryable: 1 });
    expect(await repo.getOutboxRecord(created.outbox.mutationId)).toMatchObject({
      status: 'retry_wait', lastErrorCode: 'MALFORMED_RESPONSE',
    });
  });

  it('fences a late worker after reclaim and accepts only identical idempotent settlement', async () => {
    const { repo, created } = await setup();
    const identity = { currentAccountId: () => OWNER, currentDeviceId: () => namespace.deviceId };
    const [a] = await repo.claimNextBoundWorkoutMutations({ workerId: 'worker-a', now: T1,
      leaseDurationMs: 30_000, limit: 1, ...identity });
    const [b] = await repo.claimNextBoundWorkoutMutations({ workerId: 'worker-b', now: T2,
      leaseDurationMs: 30_000, limit: 1, recoverExpiredClaims: true, ...identity });
    expect(b.attemptCount).toBe(a.attemptCount + 1);
    await expect(repo.settleBoundWorkoutMutation({ claimed: a, workerId: 'worker-a', ...identity,
      now: T2, settlement: { kind: 'success', serverRevision: 1,
        remoteMutationRef: REF, serverCommittedAt: T1 } })).rejects.toHaveProperty('code', 'LEASE_FENCE_MISMATCH');
    expect(await repo.settleBoundWorkoutMutation({ claimed: b, workerId: 'worker-b', ...identity,
      now: T2, settlement: { kind: 'success', serverRevision: 1,
        remoteMutationRef: REF, serverCommittedAt: T1 } })).toMatchObject({ idempotent: false });
    expect(await repo.settleBoundWorkoutMutation({ claimed: a, workerId: 'worker-a', ...identity,
      now: T3, settlement: { kind: 'success', serverRevision: 1,
        remoteMutationRef: REF, serverCommittedAt: T1 } })).toMatchObject({ idempotent: true });
    await expect(repo.settleBoundWorkoutMutation({ claimed: a, workerId: 'worker-a', ...identity,
      now: T3, settlement: { kind: 'success', serverRevision: 2,
        remoteMutationRef: REF, serverCommittedAt: T1 } })).rejects.toHaveProperty('code', 'INVALID_OUTBOX_TRANSITION');
    expect(await repo.getOutboxRecord(created.outbox.mutationId)).toMatchObject({
      status: 'acknowledged', acknowledgedRevision: 1,
    });
  });

  it('never sends an account A mutation under account B after claim', async () => {
    const { repo, created } = await setup();
    let current = OWNER;
    let sent = 0;
    const result = await runWorkoutPushIteration(repo, {
      ...options(server(request => { sent += 1; return Response.json(receipt(request)); })),
      currentAccountId: () => current,
      getSession: async () => { current = OTHER; return { accountId: OTHER, accessToken: 'other-token' }; },
    });
    expect(sent).toBe(0);
    expect(result).toMatchObject({ success: 0, blocked: 1 });
    expect((await repo.getOutboxRecord(created.outbox.mutationId))?.status).toBe('claimed');
  });

  it('pauses a missing-session claim as auth-required retry without sending', async () => {
    const { repo, created } = await setup();
    let sent = 0;
    const result = await runWorkoutPushIteration(repo, {
      ...options(server(request => { sent += 1; return Response.json(receipt(request)); })),
      getSession: async () => null,
    });
    expect(sent).toBe(0);
    expect(result.retryable).toBe(1);
    expect(await repo.getOutboxRecord(created.outbox.mutationId)).toMatchObject({
      status: 'retry_wait', lastErrorCode: 'AUTH_REQUIRED',
    });
  });

  it.each([401, 403])('classifies HTTP %i as auth-required retry', async status => {
    const { repo, created } = await setup();
    const result = await runWorkoutPushIteration(repo, options(server(() =>
      new Response(JSON.stringify({ detail: 'NOT_AUTHORIZED' }), { status }))));
    expect(result).toMatchObject({ success: 0, retryable: 1 });
    expect(await repo.getOutboxRecord(created.outbox.mutationId)).toMatchObject({
      status: 'retry_wait', lastErrorCode: 'AUTH_REQUIRED',
    });
  });

  it('does not settle an A response after the active account switches to B', async () => {
    const { repo, created } = await setup();
    let current = OWNER;
    const result = await runWorkoutPushIteration(repo, {
      ...options(server(request => { current = OTHER; return Response.json(receipt(request)); })),
      currentAccountId: () => current,
    });
    expect(result).toMatchObject({ success: 0, blocked: 1 });
    expect(await repo.getOutboxRecord(created.outbox.mutationId)).toMatchObject({
      status: 'claimed', acknowledgedRevision: null,
    });
  });
});
