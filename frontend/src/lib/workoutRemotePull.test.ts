import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { afterEach, describe, expect, it } from 'vitest';
import { hashCanonicalPayload } from './localDatabase/canonicalPayload';
import {
  closeLocalDatabase, createDormantLocalDatabaseCapability, openLocalDatabase,
  LOCAL_DATABASE_NAME, LOCAL_DATABASE_VERSION,
  type LocalDatabaseRepository, type LocalDatabaseNamespace,
} from './localDatabase';
import { WorkoutSessionRepository } from './workoutSessionRepository';
import type { WorkoutSessionV1 } from './workoutSessionV1';
import { runWorkoutPullIteration, runWorkoutFullResync, type WorkoutPullOptions } from './workoutRemotePull';
import { runWorkoutPushIteration, type WorkoutPushOptions } from './workoutRemotePush';
import { WORKOUT_PULL_PROVIDER } from './workoutRemotePullProtocol';

const OWNER = '11111111-1111-4111-8111-111111111111';
const ID = 'abcdefab-cdef-4abc-8def-abcdefabcdef';
const OTHER_ID = 'fedcbafe-dcba-4fed-8fed-fedcbafedcba';
const BINDING = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const TOKEN = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const REF1 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const REF2 = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const EPOCH = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const T0 = '2026-09-27T00:00:00.000Z';
const T1 = '2026-09-27T00:01:00.000Z';
const T2 = '2026-09-27T00:02:00.000Z';
const opened: LocalDatabaseRepository[] = [];

function session(id = ID, reps = 8): WorkoutSessionV1 {
  return { version: 1, id, localDate: '2026-09-27', entries: [{
    id: '2aaaaaaa-2222-4222-8222-222222222222',
    exercise: { id: null, name: 'Push-up', type: 'bodyweight', tags: [], cardioMode: null },
    sets: [{ id: '3bbbbbbb-3333-4333-8333-333333333333', ordinal: 1,
      kind: 'bodyweight', loadKind: 'bodyweight', reps, assistedReps: null,
      dropset: false, done: true }],
  }] };
}

function change(sequence: number, id = ID, reps = 8, revision = sequence,
  operation: 'upsert' | 'tombstone' | 'restore' = 'upsert', ref = REF1) {
  const record = session(id, reps);
  return { sequence, domain: 'health_workout_session', entityId: id.toLowerCase(), operation,
    serverRevision: revision, record, contentHash: hashCanonicalPayload(record),
    isDeleted: operation === 'tombstone', deletedAt: operation === 'tombstone' ? T2 : null,
    remoteMutationRef: ref, serverCommittedAt: T1,
    authorityEpoch: 1, serverEpoch: EPOCH };
}

async function setup(deviceId = 'desktop', generationId = 'generation-desktop') {
  const namespace: LocalDatabaseNamespace = {
    userId: OWNER, projectRef: 'client-project-not-server-project', deviceId, generationId, schemaVersion: 1,
  };
  const factory = new IDBFactory();
  const repo = await openLocalDatabase(namespace, { capability: createDormantLocalDatabaseCapability('test'),
    indexedDBFactory: factory, clock: () => T0 });
  opened.push(repo); await repo.initializeNamespace();
  const sequence = await repo.reserveWorkoutRemoteDiscovery();
  await repo.persistWorkoutRemoteAuthority({
    accountId: OWNER, namespaceKey: repo.namespaceKey, generationId, domain: 'health_workout_session',
    deviceId, protocolVersion: 2, projectScope: 'server-project', capability: 'FOUNDATION_READY',
    authorityState: 'OPEN', authorityEpoch: 1, bindingState: 'bound', generationBindingId: BINDING,
    serverEpoch: EPOCH, verifiedAt: T0, discoverySequence: sequence,
    verificationId: '99999999-9999-4999-8999-999999999999',
  }, () => OWNER, () => deviceId);
  return { repo, workouts: new WorkoutSessionRepository(repo, () => T0), namespace, factory };
}

function options(deviceId: string, handler: (url: URL, init?: RequestInit) => Response | Promise<Response>,
  extra: Partial<WorkoutPullOptions> = {}): WorkoutPullOptions {
  return { baseUrl: 'https://example.invalid', getSession: async () => ({ accountId: OWNER, accessToken: 'test-token' }),
    currentAccountId: () => OWNER, currentDeviceId: () => deviceId, now: () => T1,
    fetchImpl: (async (url: RequestInfo | URL, init?: RequestInit) => handler(new URL(String(url)), init)) as typeof fetch,
    ...extra };
}

function pullPage(cursor: number, rows: ReturnType<typeof change>[], serverEpoch = EPOCH) {
  return { protocolVersion: 2, status: 'changes', domain: 'health_workout_session', authorityEpoch: 1,
    serverEpoch, retentionFloor: 0, nextCursor: rows.at(-1)?.sequence ?? cursor,
    changes: rows, errorCode: null };
}

function snapshotRow(row: ReturnType<typeof change>) {
  const { operation: _operation, domain: _domain, authorityEpoch: _authorityEpoch,
    serverEpoch: _serverEpoch, ...rest } = row;
  return rest;
}

function fixedSnapshotWith(row: ReturnType<typeof change>, watermark = 2) {
  return (url: URL) => url.pathname.endsWith('/snapshots')
    ? Response.json({ protocolVersion: 2, status: 'snapshot', domain: 'health_workout_session',
      snapshotToken: TOKEN, authorityEpoch: 1, serverEpoch: EPOCH, watermark, errorCode: null })
    : Response.json({ protocolVersion: 2, status: 'snapshot_page', domain: 'health_workout_session',
      snapshotToken: TOKEN, authorityEpoch: 1, serverEpoch: EPOCH, watermark,
      rows: [snapshotRow(row)], nextEntityId: null, hasMore: false, errorCode: null });
}

async function seedLegacyRemoteBoundary(factory: IDBFactory, repo: LocalDatabaseRepository,
  mutationId: string, omitState = true): Promise<void> {
  const row = await repo.getOutboxRecord(mutationId);
  if (!row?.remoteSequenceBoundary) throw new Error('REMOTE_BOUNDARY_REQUIRED');
  const legacy = { ...row.remoteSequenceBoundary };
  if (omitState) delete legacy.baselineRemoteState;
  delete legacy.baselineDeletedAt;
  const request = factory.open(LOCAL_DATABASE_NAME, LOCAL_DATABASE_VERSION);
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('outbox', 'readwrite');
      tx.objectStore('outbox').put({ ...row, remoteSequenceBoundary: legacy });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally { db.close(); }
}

afterEach(() => { for (const repo of opened.splice(0)) closeLocalDatabase(repo); });

describe('REL-05G4B3 dormant workout pull and fixed-watermark resync', () => {
  it('starts at zero, commits an empty page with serverEpoch, and never creates outbox work', async () => {
    const { repo } = await setup();
    const result = await runWorkoutPullIteration(repo, options('desktop', url => {
      expect(url.searchParams.get('cursor')).toBe('0');
      expect(url.searchParams.has('serverEpoch')).toBe(false);
      return Response.json(pullPage(0, []));
    }));
    expect(result).toEqual({ kind: 'empty', nextCursor: 0 });
    expect(await repo.getSyncCheckpoint(WORKOUT_PULL_PROVIDER, 'health_workout_session'))
      .toMatchObject({ sequence: 0, serverEpoch: EPOCH });
    expect(await repo.listOutboxMutations({ limit: 10 })).toEqual([]);
  });

  it('applies account-wide changes on independent desktop/mobile generations', async () => {
    const desktop = await setup('desktop', 'generation-desktop');
    const mobile = await setup('mobile', 'generation-mobile');
    const rows = [change(1, ID)];
    const server = () => Response.json(pullPage(0, rows));
    await runWorkoutPullIteration(desktop.repo, options('desktop', server));
    await runWorkoutPullIteration(mobile.repo, options('mobile', server));
    expect((await desktop.repo.getEntity('health_workout_session', ID))?.serverRevision).toBe(1);
    expect((await mobile.repo.getEntity('health_workout_session', ID))?.serverRevision).toBe(1);
    expect(await mobile.repo.getWorkoutRemoteIdsByWire(ID)).toHaveLength(1);
  });

  it('validates and applies multiple ordered revisions of the same entity before checkpointing', async () => {
    const { repo } = await setup();
    const rows = [change(1, ID, 8, 1), change(2, ID, 9, 2, 'upsert', REF2),
      change(3, ID, 9, 3, 'tombstone', TOKEN)];
    expect(await runWorkoutPullIteration(repo, options('desktop', () => Response.json(pullPage(0, rows)))))
      .toMatchObject({ kind: 'applied', applied: 3, nextCursor: 3 });
    expect(await repo.getEntity('health_workout_session', ID))
      .toMatchObject({ revision: 3, serverRevision: 3, remoteState: 'deleted', isDeleted: true });
  });

  it('applies a restore after a cross-device tombstone without deriving local revision from server revision', async () => {
    const { repo } = await setup();
    const rows = [change(11, ID, 8, 1), change(12, ID, 8, 2, 'tombstone', REF2),
      change(13, ID, 10, 3, 'restore', TOKEN)];
    await runWorkoutPullIteration(repo, options('desktop', () => Response.json(pullPage(0, rows))));
    expect(await repo.getEntity('health_workout_session', ID)).toMatchObject({
      revision: 3, localRevision: 3, serverRevision: 3, remoteState: 'active', isDeleted: false,
      lastRemoteMutationRef: TOKEN,
    });
  });

  it('fails closed on divergent same-revision evidence and never regresses a newer state', async () => {
    const { repo } = await setup();
    await runWorkoutPullIteration(repo, options('desktop', () =>
      Response.json(pullPage(0, [change(1, ID, 8, 1)]))));
    await expect(runWorkoutPullIteration(repo, options('desktop', () =>
      Response.json(pullPage(1, [change(2, ID, 9, 1, 'upsert', REF2)])))))
      .rejects.toThrow('STALE_REVISION');
    expect((await repo.getSyncCheckpoint(WORKOUT_PULL_PROVIDER, 'health_workout_session'))?.sequence).toBe(1);
    await runWorkoutPullIteration(repo, options('desktop', () =>
      Response.json(pullPage(1, [change(2, ID, 10, 2, 'upsert', REF2)]))));
    expect(await runWorkoutPullIteration(repo, options('desktop', () =>
      Response.json(pullPage(2, [change(3, ID, 8, 1)])))))
      .toMatchObject({ kind: 'applied', applied: 0, nextCursor: 3 });
    expect(await repo.getEntity('health_workout_session', ID)).toMatchObject({ serverRevision: 2 });
  });

  it('preserves original local UUID spelling through wire-side case mapping', async () => {
    const { repo, workouts } = await setup();
    const upper = ID.toUpperCase();
    await workouts.createWorkoutSession(session(upper, 9), { now: T0 });
    await runWorkoutPullIteration(repo, options('desktop', () =>
      Response.json(pullPage(0, [change(1, ID, 8)]))));
    expect(await repo.getEntity('health_workout_session', ID)).toBeNull();
    expect(await repo.getEntity('health_workout_session', upper)).not.toBeNull();
    expect(await repo.getWorkoutRemoteIdsByWire(ID)).toMatchObject([{ localEntityId: upper }]);
  });

  it('keeps a mixed-case local key usable when exact remote payload spelling differs', async () => {
    const { repo, workouts } = await setup();
    const upper = ID.toUpperCase();
    await repo.commitRemoteConvergenceBatch({ namespaceKey: repo.namespaceKey,
      generationId: repo.namespace.generationId, accountId: OWNER,
      domain: 'health_workout_session', provider: 'test_remote_seed',
      checkpointValue: '1', sequence: 1, serverEpoch: EPOCH, now: T0,
      changes: [{ expectedLocalRevision: null, candidate: {
        entityId: upper, record: session(upper, 8), serverRevision: 1,
        remoteMutationRef: REF1, createdAt: T0, updatedAt: T0, deletedAt: null,
        ownerId: OWNER, source: { kind: 'remote', reference: 'test_remote_seed' },
      } }] });
    await runWorkoutPullIteration(repo, options('desktop', () =>
      Response.json(pullPage(0, [change(1, ID, 9, 2, 'upsert', REF2)]))));
    expect(await repo.getEntity('health_workout_session', ID)).toBeNull();
    expect(await repo.getWorkoutRemoteIdsByWire(ID)).toMatchObject([{ localEntityId: upper }]);
    expect((await workouts.getWorkoutSession(upper))?.record.id).toBe(ID);
    expect((await workouts.getWorkoutSession(ID))?.entityId).toBe(upper);
    expect(await workouts.listWorkoutSessions()).toHaveLength(1);
    const updated = await workouts.updateWorkoutSession(ID, 2, session(ID, 10), { now: T2 });
    expect(updated.entity.entityId).toBe(upper);
    expect(updated.outbox.payload).toMatchObject({ record: { id: ID } });
  });

  it('rejects exact and case-variant creates after a remote wire mapping exists', async () => {
    const { repo, workouts } = await setup();
    await runWorkoutPullIteration(repo, options('desktop', () =>
      Response.json(pullPage(0, [change(1)]))));
    for (const id of [ID, ID.toUpperCase()]) {
      await expect(workouts.createWorkoutSession(session(id), { now: T2 }))
        .rejects.toThrow('ENTITY_ALREADY_EXISTS');
    }
    expect(await workouts.listWorkoutSessions()).toHaveLength(1);
    expect(await repo.listOutboxMutations({ limit: 10 })).toEqual([]);
  });

  it('rejects an unmapped case-only twin but still creates a genuinely new UUID', async () => {
    const { repo, workouts } = await setup();
    await workouts.createWorkoutSession(session(ID.toUpperCase()), { now: T0 });
    await expect(workouts.createWorkoutSession(session(ID), { now: T1 }))
      .rejects.toThrow('ENTITY_ALREADY_EXISTS');
    const fresh = await workouts.createWorkoutSession(session(OTHER_ID), { now: T2 });
    expect(fresh.outbox.deliveryBinding?.state).toBe('unbound');
    expect(await workouts.listWorkoutSessions()).toHaveLength(2);
    expect(await repo.listOutboxMutations({ limit: 10 })).toHaveLength(2);
  });

  it('rolls back a guarded create after writes without any entity or outbox', async () => {
    const { repo, workouts } = await setup();
    await expect(workouts.createWorkoutSession(session(ID),
      { now: T0, testOnlyAbortAt: 'after_writes' })).rejects.toThrow();
    expect(await repo.getEntity('health_workout_session', ID)).toBeNull();
    expect(await repo.getWorkoutRemoteIdsByWire(ID)).toEqual([]);
    expect(await repo.listOutboxMutations({ limit: 10 })).toEqual([]);
  });

  it('serializes concurrent case-variant creates to one UUID-value identity', async () => {
    const { repo, workouts } = await setup();
    const outcomes = await Promise.allSettled([
      workouts.createWorkoutSession(session(ID), { now: T0 }),
      workouts.createWorkoutSession(session(ID.toUpperCase()), { now: T0 }),
    ]);
    expect(outcomes.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    expect(outcomes.filter(result => result.status === 'rejected')).toHaveLength(1);
    expect(await workouts.listWorkoutSessions()).toHaveLength(1);
    expect(await repo.listOutboxMutations({ limit: 10 })).toHaveLength(1);
  });

  it('rolls back a malformed last change, mapping, and checkpoint together', async () => {
    const { repo } = await setup();
    const rows = [change(1), { ...change(2, OTHER_ID), contentHash: '0'.repeat(64) }];
    await expect(runWorkoutPullIteration(repo, options('desktop', () => Response.json(pullPage(0, rows)))))
      .rejects.toThrow('MALFORMED_RESPONSE');
    expect(await repo.getEntity('health_workout_session', ID)).toBeNull();
    expect(await repo.getWorkoutRemoteIdsByWire(ID)).toEqual([]);
    expect(await repo.getSyncCheckpoint(WORKOUT_PULL_PROVIDER, 'health_workout_session')).toBeNull();
  });

  it('preserves local pending content and durable remote conflict while advancing the page checkpoint', async () => {
    const { repo, workouts } = await setup();
    const local = await workouts.createWorkoutSession(session(ID, 9), { now: T0 });
    const result = await runWorkoutPullIteration(repo, options('desktop', () =>
      Response.json(pullPage(0, [change(1, ID, 8)]))));
    expect(result).toMatchObject({ kind: 'applied', conflicts: 1, nextCursor: 1 });
    expect((await repo.getEntity<WorkoutSessionV1>('health_workout_session', ID))?.record.entries[0].sets[0])
      .toMatchObject({ reps: 9 });
    expect((await repo.getOutboxRecord(local.outbox.mutationId))?.status).toBe('pending');
    expect(await repo.listConflicts('health_workout_session', ID)).toHaveLength(1);
    expect((await repo.getSyncCheckpoint(WORKOUT_PULL_PROVIDER, 'health_workout_session'))?.sequence).toBe(1);
  });

  it('preserves a pending M2 and its CAS base when another device wins revision N+1', async () => {
    const { repo, workouts } = await setup();
    await runWorkoutPullIteration(repo, options('desktop', () =>
      Response.json(pullPage(0, [change(1, ID, 8, 1)]))));
    const m2 = await workouts.updateWorkoutSession(ID, 1, session(ID, 9), { now: T2 });
    expect(m2.outbox.remoteSequenceBoundary)
      .toMatchObject({ baselineLocalRevision: 1, baselineServerRevision: 1,
        remoteMutationRef: REF1 });
    expect(await runWorkoutPullIteration(repo, options('desktop', () =>
      Response.json(pullPage(1, [change(2, ID, 10, 2, 'upsert', REF2)])))))
      .toMatchObject({ kind: 'applied', applied: 0, conflicts: 1, nextCursor: 2 });
    expect((await repo.getEntity<WorkoutSessionV1>('health_workout_session', ID))?.record.entries[0].sets[0])
      .toMatchObject({ reps: 9 });
    expect((await repo.getOutboxRecord(m2.outbox.mutationId))?.remoteSequenceBoundary?.baselineServerRevision).toBe(1);
    expect(await repo.listConflicts('health_workout_session', ID)).toHaveLength(1);
  });

  it('rejects divergent same-revision content behind pending M2 without advancing checkpoint', async () => {
    const { repo, workouts } = await setup();
    await runWorkoutPullIteration(repo, options('desktop', () =>
      Response.json(pullPage(0, [change(1, ID, 8, 1, 'upsert', REF1)]))));
    const m2 = await workouts.updateWorkoutSession(ID, 1, session(ID, 9), { now: T2 });
    await expect(runWorkoutPullIteration(repo, options('desktop', () =>
      Response.json(pullPage(1, [change(2, ID, 10, 1, 'upsert', REF1)])))))
      .rejects.toThrow('STALE_REVISION');
    expect((await repo.getSyncCheckpoint(WORKOUT_PULL_PROVIDER, 'health_workout_session'))?.sequence).toBe(1);
    expect((await repo.getEntity<WorkoutSessionV1>('health_workout_session', ID))?.record.entries[0].sets[0])
      .toMatchObject({ reps: 9 });
    expect((await repo.getOutboxRecord(m2.outbox.mutationId))?.remoteSequenceBoundary?.baselineServerRevision).toBe(1);
  });

  it('rejects divergent same-revision tombstone deletion evidence behind pending restore', async () => {
    const { repo, workouts } = await setup();
    await runWorkoutPullIteration(repo, options('desktop', () =>
      Response.json(pullPage(0, [change(1, ID, 8, 1, 'tombstone', REF1)]))));
    await workouts.restoreWorkoutSession(ID, 1, session(ID, 9), { now: T2 });
    await expect(runWorkoutPullIteration(repo, options('desktop', () =>
      Response.json(pullPage(1, [{ ...change(2, ID, 8, 1, 'tombstone', REF1), deletedAt: T1 }])))))
      .rejects.toThrow('STALE_REVISION');
    expect((await repo.getSyncCheckpoint(WORKOUT_PULL_PROVIDER, 'health_workout_session'))?.sequence).toBe(1);
  });

  it('consumes an exact repeated tombstone behind a pending local restore', async () => {
    const { repo, workouts } = await setup();
    const tombstone = change(1, ID, 8, 1, 'tombstone', REF1);
    await runWorkoutPullIteration(repo, options('desktop', () =>
      Response.json(pullPage(0, [tombstone]))));
    const restore = await workouts.restoreWorkoutSession(ID, 1, session(ID, 9), { now: T2 });
    expect(restore.outbox.remoteSequenceBoundary).toMatchObject({
      baselineServerRevision: 1, remoteMutationRef: REF1,
      baselineContentHash: tombstone.contentHash,
      baselineRemoteState: 'deleted', baselineDeletedAt: tombstone.deletedAt,
    });
    expect(await runWorkoutPullIteration(repo, options('desktop', () =>
      Response.json(pullPage(1, [{ ...tombstone, sequence: 2 }])))))
      .toMatchObject({ kind: 'applied', applied: 0, conflicts: 0, nextCursor: 2 });
    expect((await repo.getEntity<WorkoutSessionV1>('health_workout_session', ID))?.record.entries[0].sets[0])
      .toMatchObject({ reps: 9 });
    expect((await repo.getEntity('health_workout_session', ID))?.revision).toBe(2);
    expect(await repo.listConflicts('health_workout_session', ID)).toEqual([]);
    expect(await repo.getOutboxRecord(restore.outbox.mutationId)).toEqual(restore.outbox);
    expect((await repo.getSyncCheckpoint(WORKOUT_PULL_PROVIDER, 'health_workout_session'))?.sequence).toBe(2);
  });

  it.each([
    { name: 'active/deleted state', incoming: { operation: 'upsert' as const, isDeleted: false, deletedAt: null } },
    { name: 'remote mutation ref', incoming: { remoteMutationRef: REF2 } },
    { name: 'content hash', incoming: { record: session(ID, 10), contentHash: hashCanonicalPayload(session(ID, 10)) } },
  ])('rejects same-revision tombstone $name divergence behind pending restore', async ({ incoming }) => {
    const { repo, workouts } = await setup();
    const tombstone = change(1, ID, 8, 1, 'tombstone', REF1);
    await runWorkoutPullIteration(repo, options('desktop', () => Response.json(pullPage(0, [tombstone]))));
    const restore = await workouts.restoreWorkoutSession(ID, 1, session(ID, 9), { now: T2 });
    await expect(runWorkoutPullIteration(repo, options('desktop', () =>
      Response.json(pullPage(1, [{ ...tombstone, sequence: 2, ...incoming }])))))
      .rejects.toThrow('STALE_REVISION');
    expect((await repo.getSyncCheckpoint(WORKOUT_PULL_PROVIDER, 'health_workout_session'))?.sequence).toBe(1);
    expect(await repo.getOutboxRecord(restore.outbox.mutationId)).toEqual(restore.outbox);
  });

  it('records a legacy tombstone replay once and advances only with durable evidence', async () => {
    const { repo, workouts, factory } = await setup();
    const tombstone = change(1, ID, 8, 1, 'tombstone', REF1);
    await runWorkoutPullIteration(repo, options('desktop', () => Response.json(pullPage(0, [tombstone]))));
    const restore = await workouts.restoreWorkoutSession(ID, 1, session(ID, 9), { now: T2 });
    await seedLegacyRemoteBoundary(factory, repo, restore.outbox.mutationId);
    const legacy = await repo.getOutboxRecord(restore.outbox.mutationId);
    expect(legacy?.remoteSequenceBoundary?.baselineRemoteState).toBeUndefined();
    await expect(runWorkoutPullIteration(repo, options('desktop', () =>
      Response.json(pullPage(1, [{ ...tombstone, sequence: 2 }])),
    { testOnlyAbortBeforeCheckpoint: true }))).rejects.toThrow('TRANSACTION_ABORTED');
    expect(await repo.listConflicts('health_workout_session', ID)).toEqual([]);
    expect((await repo.getSyncCheckpoint(WORKOUT_PULL_PROVIDER, 'health_workout_session'))?.sequence).toBe(1);
    expect(await runWorkoutPullIteration(repo, options('desktop', () =>
      Response.json(pullPage(1, [{ ...tombstone, sequence: 2 }])))))
      .toMatchObject({ kind: 'applied', applied: 0, conflicts: 1, nextCursor: 2 });
    const conflicts = await repo.listConflicts('health_workout_session', ID);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]).toMatchObject({ mutationId: restore.outbox.mutationId,
      remoteMetadata: { sequence: 2, serverEpoch: EPOCH, serverRevision: 1,
        remoteMutationRef: REF1, contentHash: tombstone.contentHash,
        isDeleted: true, deletedAt: tombstone.deletedAt } });
    expect(await runWorkoutPullIteration(repo, options('desktop', () =>
      Response.json(pullPage(2, [{ ...tombstone, sequence: 3 }])))))
      .toMatchObject({ kind: 'applied', conflicts: 0, nextCursor: 3 });
    expect(await repo.listConflicts('health_workout_session', ID)).toHaveLength(1);
    expect((await repo.getSyncCheckpoint(WORKOUT_PULL_PROVIDER, 'health_workout_session'))?.sequence).toBe(3);
    expect((await repo.getEntity<WorkoutSessionV1>('health_workout_session', ID))?.record.entries[0].sets[0])
      .toMatchObject({ reps: 9 });
    expect(await repo.getOutboxRecord(restore.outbox.mutationId)).toEqual(legacy);
  });

  it('uses the same evidence-preserving fallback for a legacy active baseline', async () => {
    const { repo, workouts, factory } = await setup();
    const active = change(1, ID, 8, 1, 'upsert', REF1);
    await runWorkoutPullIteration(repo, options('desktop', () => Response.json(pullPage(0, [active]))));
    const update = await workouts.updateWorkoutSession(ID, 1, session(ID, 9), { now: T2 });
    await seedLegacyRemoteBoundary(factory, repo, update.outbox.mutationId);
    expect(await runWorkoutPullIteration(repo, options('desktop', () =>
      Response.json(pullPage(1, [{ ...active, sequence: 2 }])))))
      .toMatchObject({ kind: 'applied', applied: 0, conflicts: 1, nextCursor: 2 });
    expect((await repo.getEntity<WorkoutSessionV1>('health_workout_session', ID))?.record.entries[0].sets[0])
      .toMatchObject({ reps: 9 });
    expect((await repo.getOutboxRecord(update.outbox.mutationId))?.status).toBe('pending');
  });

  it('rejects a partially populated remote deletion baseline instead of guessing its meaning', async () => {
    const { repo, workouts, factory } = await setup();
    const tombstone = change(1, ID, 8, 1, 'tombstone', REF1);
    await runWorkoutPullIteration(repo, options('desktop', () => Response.json(pullPage(0, [tombstone]))));
    const restore = await workouts.restoreWorkoutSession(ID, 1, session(ID, 9), { now: T2 });
    await seedLegacyRemoteBoundary(factory, repo, restore.outbox.mutationId, false);
    await expect(repo.getOutboxRecord(restore.outbox.mutationId))
      .rejects.toThrow('CORRUPT_PERSISTED_RECORD');
  });

  it('accepts a provably identical pending remote baseline without changing M2', async () => {
    const { repo, workouts } = await setup();
    await runWorkoutPullIteration(repo, options('desktop', () =>
      Response.json(pullPage(0, [change(1, ID, 8, 1, 'upsert', REF1)]))));
    const m2 = await workouts.updateWorkoutSession(ID, 1, session(ID, 9), { now: T2 });
    expect(m2.outbox.remoteSequenceBoundary).toMatchObject({
      baselineRemoteState: 'active', baselineDeletedAt: null,
    });
    expect(await runWorkoutPullIteration(repo, options('desktop', () =>
      Response.json(pullPage(1, [change(2, ID, 8, 1, 'upsert', REF1)])))))
      .toMatchObject({ kind: 'applied', applied: 0, conflicts: 0, nextCursor: 2 });
    expect((await repo.getEntity<WorkoutSessionV1>('health_workout_session', ID))?.record.entries[0].sets[0])
      .toMatchObject({ reps: 9 });
    expect((await repo.getOutboxRecord(m2.outbox.mutationId))?.status).toBe('pending');
  });

  it('uses the same pending-baseline divergence rule at full-resync commit', async () => {
    const { repo, workouts } = await setup();
    await runWorkoutPullIteration(repo, options('desktop', () =>
      Response.json(pullPage(0, [change(1, ID, 8, 1, 'upsert', REF1)]))));
    await workouts.updateWorkoutSession(ID, 1, session(ID, 9), { now: T2 });
    const handler = (url: URL) => url.pathname.endsWith('/snapshots')
      ? Response.json({ protocolVersion: 2, status: 'snapshot', domain: 'health_workout_session',
        snapshotToken: TOKEN, authorityEpoch: 1, serverEpoch: EPOCH, watermark: 2, errorCode: null })
      : Response.json({ protocolVersion: 2, status: 'snapshot_page', domain: 'health_workout_session',
        snapshotToken: TOKEN, authorityEpoch: 1, serverEpoch: EPOCH, watermark: 2,
        rows: [snapshotRow(change(2, ID, 10, 1, 'upsert', REF1))],
        nextEntityId: null, hasMore: false, errorCode: null });
    await expect(runWorkoutFullResync(repo, options('desktop', handler))).rejects.toThrow('STALE_REVISION');
    expect((await repo.getWorkoutFullResyncSession())?.status).toBe('ready');
    expect((await repo.getSyncCheckpoint(WORKOUT_PULL_PROVIDER, 'health_workout_session'))?.sequence).toBe(1);
  });

  it('commits an exact tombstone snapshot over pending restore and then receives W+1', async () => {
    const { repo, workouts } = await setup();
    const tombstone = change(1, ID, 8, 1, 'tombstone', REF1);
    await runWorkoutPullIteration(repo, options('desktop', () => Response.json(pullPage(0, [tombstone]))));
    const restore = await workouts.restoreWorkoutSession(ID, 1, session(ID, 9), { now: T2 });
    expect(await runWorkoutFullResync(repo, options('desktop', fixedSnapshotWith(tombstone))))
      .toMatchObject({ kind: 'committed', applied: 0, conflicts: 0, watermark: 2 });
    expect(await repo.getWorkoutFullResyncSession()).toBeNull();
    expect((await repo.getSyncCheckpoint(WORKOUT_PULL_PROVIDER, 'health_workout_session'))?.sequence).toBe(2);
    expect(await repo.getOutboxRecord(restore.outbox.mutationId)).toEqual(restore.outbox);
    expect((await repo.getEntity('health_workout_session', ID))?.revision).toBe(2);
    expect((await repo.getEntity<WorkoutSessionV1>('health_workout_session', ID))?.record.entries[0].sets[0])
      .toMatchObject({ reps: 9 });
    expect(await runWorkoutPullIteration(repo, options('desktop', () =>
      Response.json(pullPage(2, [change(3, ID, 10, 2, 'restore', REF2)])))))
      .toMatchObject({ kind: 'applied', conflicts: 1, nextCursor: 3 });
    expect(await repo.getOutboxRecord(restore.outbox.mutationId)).toEqual(restore.outbox);
  });

  it('commits a legacy tombstone snapshot with deterministic evidence instead of a ready-session loop', async () => {
    const { repo, workouts, factory } = await setup();
    const tombstone = change(1, ID, 8, 1, 'tombstone', REF1);
    await runWorkoutPullIteration(repo, options('desktop', () => Response.json(pullPage(0, [tombstone]))));
    const restore = await workouts.restoreWorkoutSession(ID, 1, session(ID, 9), { now: T2 });
    await seedLegacyRemoteBoundary(factory, repo, restore.outbox.mutationId);
    const legacy = await repo.getOutboxRecord(restore.outbox.mutationId);
    expect(await runWorkoutFullResync(repo, options('desktop', fixedSnapshotWith(tombstone))))
      .toMatchObject({ kind: 'committed', applied: 0, conflicts: 1, watermark: 2 });
    expect(await repo.getWorkoutFullResyncSession()).toBeNull();
    expect((await repo.getSyncCheckpoint(WORKOUT_PULL_PROVIDER, 'health_workout_session'))?.sequence).toBe(2);
    expect(await repo.listConflicts('health_workout_session', ID)).toHaveLength(1);
    expect(await repo.getOutboxRecord(restore.outbox.mutationId)).toEqual(legacy);
    expect((await repo.getEntity<WorkoutSessionV1>('health_workout_session', ID))?.record.entries[0].sets[0])
      .toMatchObject({ reps: 9 });
  });

  it('never moves checkpoint or canonical state on transaction abort', async () => {
    const { repo } = await setup();
    await expect(runWorkoutPullIteration(repo, options('desktop', () =>
      Response.json(pullPage(0, [change(1)])), { testOnlyAbortBeforeCheckpoint: true }))).rejects.toThrow();
    expect(await repo.getEntity('health_workout_session', ID)).toBeNull();
    expect(await repo.getSyncCheckpoint(WORKOUT_PULL_PROVIDER, 'health_workout_session')).toBeNull();
  });

  it.each(['CURSOR_INVALID', 'SERVER_EPOCH_MISMATCH'] as const)('%s requires resync without clearing local data', async code => {
    const { repo, workouts } = await setup();
    await workouts.createWorkoutSession(session(ID), { now: T0 });
    const result = await runWorkoutPullIteration(repo, options('desktop', () => Response.json({
      protocolVersion: 2, status: 'full_resync_required', errorCode: code, serverEpoch: EPOCH,
      retentionFloor: 5, nextCursor: 5, changes: [],
    })));
    expect(result).toEqual({ kind: 'full_resync_required', code });
    expect(await repo.getEntity('health_workout_session', ID)).not.toBeNull();
    expect(await repo.getSyncCheckpoint(WORKOUT_PULL_PROVIDER, 'health_workout_session')).toBeNull();
  });

  it('stages across calls, resumes after a simulated restart, commits at W and pulls W+1', async () => {
    let { repo, namespace, factory } = await setup();
    const first = change(1, ID);
    const second = change(2, OTHER_ID);
    let requests = 0;
    const handler = (url: URL) => {
      requests += 1;
      if (url.pathname.endsWith('/snapshots')) return Response.json({ protocolVersion: 2,
        status: 'snapshot', domain: 'health_workout_session', snapshotToken: TOKEN,
        authorityEpoch: 1, serverEpoch: EPOCH, watermark: 2, errorCode: null });
      if (url.pathname.includes('/snapshots/')) {
        const after = url.searchParams.get('afterEntityId');
        return Response.json({ protocolVersion: 2, status: 'snapshot_page', domain: 'health_workout_session',
          snapshotToken: TOKEN, authorityEpoch: 1, serverEpoch: EPOCH, watermark: 2,
          rows: after ? [snapshotRow(second)] : [snapshotRow(first)],
          nextEntityId: after ? null : ID, hasMore: !after, errorCode: null });
      }
      expect(url.searchParams.get('cursor')).toBe('2');
      return Response.json(pullPage(2, [change(3, ID, 10, 2, 'upsert', REF2)]));
    };
    expect(await runWorkoutFullResync(repo, options('desktop', handler)))
      .toEqual({ kind: 'staged', itemCount: 1, watermark: 2 });
    expect(await repo.getEntity('health_workout_session', ID)).toBeNull();
    expect(await repo.getSyncCheckpoint(WORKOUT_PULL_PROVIDER, 'health_workout_session')).toBeNull();
    closeLocalDatabase(repo);
    opened.splice(opened.indexOf(repo), 1);
    repo = await openLocalDatabase(namespace, { capability: createDormantLocalDatabaseCapability('test'),
      indexedDBFactory: factory, clock: () => T0 });
    opened.push(repo);
    expect(await runWorkoutFullResync(repo, options('desktop', handler)))
      .toMatchObject({ kind: 'committed', itemCount: 2, watermark: 2 });
    expect((await repo.getSyncCheckpoint(WORKOUT_PULL_PROVIDER, 'health_workout_session'))?.sequence).toBe(2);
    expect(await runWorkoutPullIteration(repo, options('desktop', handler)))
      .toMatchObject({ kind: 'applied', nextCursor: 3 });
    expect((await repo.getEntity<WorkoutSessionV1>('health_workout_session', ID))?.record.entries[0].sets[0])
      .toMatchObject({ reps: 10 });
    expect(requests).toBe(4);
  });

  it('preserves local-only and pending records absent from a complete empty snapshot', async () => {
    const { repo, workouts } = await setup();
    const local = await workouts.createWorkoutSession(session(ID), { now: T0 });
    const result = await runWorkoutFullResync(repo, options('desktop', url => url.pathname.endsWith('/snapshots')
      ? Response.json({ protocolVersion: 2, status: 'snapshot', domain: 'health_workout_session',
        snapshotToken: TOKEN, authorityEpoch: 1, serverEpoch: EPOCH, watermark: 0, errorCode: null })
      : Response.json({ protocolVersion: 2, status: 'snapshot_page', domain: 'health_workout_session',
        snapshotToken: TOKEN, authorityEpoch: 1, serverEpoch: EPOCH, watermark: 0,
        rows: [], nextEntityId: null, hasMore: false, errorCode: null })));
    expect(result).toMatchObject({ kind: 'committed', itemCount: 0, watermark: 0 });
    expect(await repo.getEntity('health_workout_session', ID)).not.toBeNull();
    expect((await repo.getOutboxRecord(local.outbox.mutationId))?.status).toBe('pending');
  });

  it('preserves pending local content and outbox when the snapshot contains the same entity', async () => {
    const { repo, workouts } = await setup();
    const local = await workouts.createWorkoutSession(session(ID, 9), { now: T0 });
    const result = await runWorkoutFullResync(repo, options('desktop', url => url.pathname.endsWith('/snapshots')
      ? Response.json({ protocolVersion: 2, status: 'snapshot', domain: 'health_workout_session',
        snapshotToken: TOKEN, authorityEpoch: 1, serverEpoch: EPOCH, watermark: 1, errorCode: null })
      : Response.json({ protocolVersion: 2, status: 'snapshot_page', domain: 'health_workout_session',
        snapshotToken: TOKEN, authorityEpoch: 1, serverEpoch: EPOCH, watermark: 1,
        rows: [snapshotRow(change(1, ID, 8))], nextEntityId: null, hasMore: false, errorCode: null })));
    expect(result).toMatchObject({ kind: 'committed', conflicts: 1, watermark: 1 });
    expect((await repo.getEntity<WorkoutSessionV1>('health_workout_session', ID))?.record.entries[0].sets[0])
      .toMatchObject({ reps: 9 });
    expect((await repo.getOutboxRecord(local.outbox.mutationId))?.status).toBe('pending');
    expect(await repo.listConflicts('health_workout_session', ID)).toHaveLength(1);
  });

  it('treats an acknowledged own echo as known evidence without a new outbox or conflict', async () => {
    const { repo, workouts } = await setup();
    const created = await workouts.createWorkoutSession(session(ID), { now: T0 });
    await repo.bindWorkoutMutation({ mutationId: created.outbox.mutationId,
      expectedVerificationId: '99999999-9999-4999-8999-999999999999',
      currentAuthenticatedAccount: () => OWNER, currentDeviceId: () => 'desktop' });
    const push: WorkoutPushOptions = { baseUrl: 'https://example.invalid',
      getSession: async () => ({ accountId: OWNER, accessToken: 'test-token' }),
      currentAccountId: () => OWNER, currentDeviceId: () => 'desktop', now: () => T1,
      fetchImpl: (async (_url, init) => {
        const request = JSON.parse(String(init?.body));
        return Response.json({ protocolVersion: 2, outcome: 'success', errorCode: null,
          domain: 'health_workout_session', entityId: ID, mutationId: request.mutationId,
          idempotencyKey: request.idempotencyKey, operation: 'upsert', payloadHash: request.payloadHash,
          contentHash: hashCanonicalPayload(request.payload.record), authorityEpoch: 1, bindingId: BINDING,
          remoteMutationRef: REF1, serverRevision: 1, changeSequence: 1, serverCommittedAt: T1 });
      }) as typeof fetch };
    expect((await runWorkoutPushIteration(repo, push)).success).toBe(1);
    const original = await repo.getOutboxRecord(created.outbox.mutationId);
    expect(await runWorkoutPullIteration(repo, options('desktop', () =>
      Response.json(pullPage(0, [change(1)])))))
      .toMatchObject({ kind: 'applied', applied: 0, conflicts: 0, ownEchoes: 1 });
    expect(await repo.getOutboxRecord(created.outbox.mutationId)).toEqual(original);
    expect(await repo.listConflicts('health_workout_session', ID)).toEqual([]);
    const m2 = await workouts.updateWorkoutSession(ID, 1, session(ID, 9), { now: T2 });
    expect((await repo.getEntity<WorkoutSessionV1>('health_workout_session', ID))?.record.entries[0].sets[0])
      .toMatchObject({ reps: 9 });
    expect((await repo.getOutboxRecord(m2.outbox.mutationId))?.status).toBe('pending');
  });

  it('does not fabricate a push receipt for a response-lost own change', async () => {
    const { repo, workouts } = await setup();
    const created = await workouts.createWorkoutSession(session(ID), { now: T0 });
    await repo.bindWorkoutMutation({ mutationId: created.outbox.mutationId,
      expectedVerificationId: '99999999-9999-4999-8999-999999999999',
      currentAuthenticatedAccount: () => OWNER, currentDeviceId: () => 'desktop' });
    const push: WorkoutPushOptions = { baseUrl: 'https://example.invalid',
      getSession: async () => ({ accountId: OWNER, accessToken: 'test-token' }),
      currentAccountId: () => OWNER, currentDeviceId: () => 'desktop', now: () => T1,
      fetchImpl: (async () => { throw new Error('response lost'); }) as typeof fetch };
    expect((await runWorkoutPushIteration(repo, push)).retryable).toBe(1);
    expect(await runWorkoutPullIteration(repo, options('desktop', () =>
      Response.json(pullPage(0, [change(1)])))))
      .toMatchObject({ kind: 'applied', applied: 0, conflicts: 1 });
    expect(await repo.getOutboxRecord(created.outbox.mutationId))
      .toMatchObject({ status: 'retry_wait', acknowledgedRevision: null, remoteMutationRef: null });
  });

  it('keeps a newer M2 while consuming an acknowledged M1 echo', async () => {
    const { repo, workouts } = await setup();
    const created = await workouts.createWorkoutSession(session(ID), { now: T0 });
    await repo.bindWorkoutMutation({ mutationId: created.outbox.mutationId,
      expectedVerificationId: '99999999-9999-4999-8999-999999999999',
      currentAuthenticatedAccount: () => OWNER, currentDeviceId: () => 'desktop' });
    const push: WorkoutPushOptions = { baseUrl: 'https://example.invalid',
      getSession: async () => ({ accountId: OWNER, accessToken: 'test-token' }),
      currentAccountId: () => OWNER, currentDeviceId: () => 'desktop', now: () => T1,
      fetchImpl: (async (_url, init) => {
        const request = JSON.parse(String(init?.body));
        return Response.json({ protocolVersion: 2, outcome: 'success', errorCode: null,
          domain: 'health_workout_session', entityId: ID, mutationId: request.mutationId,
          idempotencyKey: request.idempotencyKey, operation: 'upsert', payloadHash: request.payloadHash,
          contentHash: hashCanonicalPayload(request.payload.record), authorityEpoch: 1, bindingId: BINDING,
          remoteMutationRef: REF1, serverRevision: 1, changeSequence: 1, serverCommittedAt: T1 });
      }) as typeof fetch };
    await runWorkoutPushIteration(repo, push);
    const m2 = await workouts.updateWorkoutSession(ID, 1, session(ID, 9), { now: T2 });
    expect(await runWorkoutPullIteration(repo, options('desktop', () =>
      Response.json(pullPage(0, [change(1)])))))
      .toMatchObject({ kind: 'applied', applied: 0, conflicts: 0, ownEchoes: 1 });
    expect((await repo.getEntity<WorkoutSessionV1>('health_workout_session', ID))?.record.entries[0].sets[0])
      .toMatchObject({ reps: 9 });
    expect((await repo.getOutboxRecord(m2.outbox.mutationId))?.status).toBe('pending');
  });

  it('rejects account switch during network I/O before applying a page', async () => {
    const { repo } = await setup();
    let account = OWNER;
    const opt = options('desktop', () => {
      account = '22222222-2222-4222-8222-222222222222';
      return Response.json(pullPage(0, [change(1)]));
    }, { currentAccountId: () => account });
    await expect(runWorkoutPullIteration(repo, opt)).rejects.toThrow('IDENTITY_CHANGED');
    expect(await repo.getEntity('health_workout_session', ID)).toBeNull();
    expect(await repo.getSyncCheckpoint(WORKOUT_PULL_PROVIDER, 'health_workout_session')).toBeNull();
  });

  it('discards an in-flight response after the active generation changes', async () => {
    const { repo } = await setup();
    await expect(runWorkoutPullIteration(repo, options('desktop', async () => {
      await repo.createGeneration('generation-next', 'test');
      await repo.activateGeneration('generation-next');
      return Response.json(pullPage(0, [change(1)]));
    }))).rejects.toThrow('STALE_GENERATION');
    expect(await repo.getEntity('health_workout_session', ID)).toBeNull();
  });

  it('rejects a page commit after the pull lease expires during network I/O', async () => {
    const { repo } = await setup();
    let at = T1;
    await expect(runWorkoutPullIteration(repo, options('desktop', () => {
      at = T2;
      return Response.json(pullPage(0, [change(1)]));
    }, { now: () => at, leaseDurationMs: 1_000 }))).rejects.toThrow('LEASE_FENCE_MISMATCH');
    expect(await repo.getEntity('health_workout_session', ID)).toBeNull();
    expect(await repo.getSyncCheckpoint(WORKOUT_PULL_PROVIDER, 'health_workout_session')).toBeNull();
  });

  it('rejects exact expiry at the incremental commit fence and rolls back writes', async () => {
    const { repo } = await setup();
    let reads = 0;
    await expect(runWorkoutPullIteration(repo, options('desktop', () =>
      Response.json(pullPage(0, [change(1)])), {
      leaseDurationMs: 1_000, currentTime: () => ++reads === 1 ? T1 : '2026-09-27T00:01:01.000Z',
    }))).rejects.toThrow('LEASE_FENCE_MISMATCH');
    expect(reads).toBe(2);
    expect(await repo.getEntity('health_workout_session', ID)).toBeNull();
    expect(await repo.getWorkoutRemoteIdsByWire(ID)).toEqual([]);
    expect(await repo.getSyncCheckpoint(WORKOUT_PULL_PROVIDER, 'health_workout_session')).toBeNull();
    expect(await runWorkoutPullIteration(repo, options('desktop', () =>
      Response.json(pullPage(0, [change(1)])), { now: () => T2 })))
      .toMatchObject({ kind: 'applied', nextCursor: 1 });
  });

  it('commits when the fresh final lease check is one millisecond before expiry', async () => {
    const { repo } = await setup();
    let reads = 0;
    expect(await runWorkoutPullIteration(repo, options('desktop', () =>
      Response.json(pullPage(0, [change(1)])), {
      leaseDurationMs: 1_000,
      currentTime: () => ++reads === 1 ? T1 : '2026-09-27T00:01:00.999Z',
    }))).toMatchObject({ kind: 'applied', nextCursor: 1 });
    expect(reads).toBe(2);
  });

  it('rolls back pending-local conflict and checkpoint when lease expires mid-transaction', async () => {
    const { repo, workouts } = await setup();
    const local = await workouts.createWorkoutSession(session(ID, 9), { now: T0 });
    let reads = 0;
    await expect(runWorkoutPullIteration(repo, options('desktop', () =>
      Response.json(pullPage(0, [change(1, ID, 8)])), {
      leaseDurationMs: 1_000, currentTime: () => ++reads === 1 ? T1 : T2,
    }))).rejects.toThrow('LEASE_FENCE_MISMATCH');
    expect(await repo.getWorkoutRemoteIdsByWire(ID)).toEqual([]);
    expect(await repo.listConflicts('health_workout_session', ID)).toEqual([]);
    expect(await repo.getSyncCheckpoint(WORKOUT_PULL_PROVIDER, 'health_workout_session')).toBeNull();
    expect((await repo.getOutboxRecord(local.outbox.mutationId))?.status).toBe('pending');
  });

  it('rolls back a staged page if lease expires before staging completion', async () => {
    const { repo } = await setup();
    let reads = 0;
    const handler = (url: URL) => url.pathname.endsWith('/snapshots')
      ? Response.json({ protocolVersion: 2, status: 'snapshot', domain: 'health_workout_session',
        snapshotToken: TOKEN, authorityEpoch: 1, serverEpoch: EPOCH, watermark: 1, errorCode: null })
      : Response.json({ protocolVersion: 2, status: 'snapshot_page', domain: 'health_workout_session',
        snapshotToken: TOKEN, authorityEpoch: 1, serverEpoch: EPOCH, watermark: 1,
        rows: [snapshotRow(change(1))], nextEntityId: null, hasMore: false, errorCode: null });
    await expect(runWorkoutFullResync(repo, options('desktop', handler, {
      leaseDurationMs: 1_000, currentTime: () => ++reads === 4 ? T2 : T1,
    }))).rejects.toThrow('LEASE_FENCE_MISMATCH');
    expect((await repo.getWorkoutFullResyncSession())?.status).toBe('staging');
    expect((await repo.getWorkoutFullResyncSession())?.itemCount).toBe(0);
    expect(await repo.getEntity('health_workout_session', ID)).toBeNull();
    expect(await repo.getSyncCheckpoint(WORKOUT_PULL_PROVIDER, 'health_workout_session')).toBeNull();
    expect(await runWorkoutFullResync(repo, options('desktop', handler, { now: () => T2 })))
      .toMatchObject({ kind: 'committed', itemCount: 1 });
  });

  it('does not persist a snapshot-start session after commit-time lease expiry', async () => {
    const { repo } = await setup();
    let reads = 0;
    await expect(runWorkoutFullResync(repo, options('desktop', () => Response.json({
      protocolVersion: 2, status: 'snapshot', domain: 'health_workout_session',
      snapshotToken: TOKEN, authorityEpoch: 1, serverEpoch: EPOCH, watermark: 0, errorCode: null,
    }), { leaseDurationMs: 1_000, currentTime: () => ++reads === 1 ? T1 : T2 })))
      .rejects.toThrow('LEASE_FENCE_MISMATCH');
    expect(await repo.getWorkoutFullResyncSession()).toBeNull();
  });

  it('does not abandon staging after its lease expires mid-transaction', async () => {
    const { repo } = await setup();
    let reads = 0;
    await expect(runWorkoutFullResync(repo, options('desktop', url => url.pathname.endsWith('/snapshots')
      ? Response.json({ protocolVersion: 2, status: 'snapshot', domain: 'health_workout_session',
        snapshotToken: TOKEN, authorityEpoch: 1, serverEpoch: EPOCH, watermark: 1, errorCode: null })
      : new Response(JSON.stringify({ status: 'rejected', errorCode: 'SNAPSHOT_TOKEN_INVALID' }),
        { status: 409 }), {
      leaseDurationMs: 1_000, currentTime: () => ++reads === 4 ? T2 : T1,
    }))).rejects.toThrow('LEASE_FENCE_MISMATCH');
    expect((await repo.getWorkoutFullResyncSession())?.status).toBe('staging');
  });

  it('rolls back canonical resync commit if lease expires before completion', async () => {
    const { repo } = await setup();
    let reads = 0;
    const handler = (url: URL) => url.pathname.endsWith('/snapshots')
      ? Response.json({ protocolVersion: 2, status: 'snapshot', domain: 'health_workout_session',
        snapshotToken: TOKEN, authorityEpoch: 1, serverEpoch: EPOCH, watermark: 1, errorCode: null })
      : Response.json({ protocolVersion: 2, status: 'snapshot_page', domain: 'health_workout_session',
        snapshotToken: TOKEN, authorityEpoch: 1, serverEpoch: EPOCH, watermark: 1,
        rows: [snapshotRow(change(1))], nextEntityId: null, hasMore: false, errorCode: null });
    await expect(runWorkoutFullResync(repo, options('desktop', handler, {
      leaseDurationMs: 1_000, currentTime: () => ++reads === 6 ? T2 : T1,
    }))).rejects.toThrow('LEASE_FENCE_MISMATCH');
    expect((await repo.getWorkoutFullResyncSession())?.status).toBe('ready');
    expect(await repo.getEntity('health_workout_session', ID)).toBeNull();
    expect(await repo.getWorkoutRemoteIdsByWire(ID)).toEqual([]);
    expect(await repo.listConflicts('health_workout_session', ID)).toEqual([]);
    expect(await repo.getSyncCheckpoint(WORKOUT_PULL_PROVIDER, 'health_workout_session')).toBeNull();
    expect(await runWorkoutFullResync(repo, options('desktop', handler, { now: () => T2 })))
      .toMatchObject({ kind: 'committed', itemCount: 1 });
  });

  it('rejects a second tab while the durable Workout pull lease is held', async () => {
    const { repo } = await setup();
    await repo.acquireWorkerLease({ leaseName: 'workout_pull_g4b3', ownerId: 'other-tab',
      now: T1, durationMs: 60_000 });
    await expect(runWorkoutPullIteration(repo, options('desktop', () =>
      Response.json(pullPage(0, []))))).rejects.toThrow('WORKER_LEASE_HELD');
  });

  it('resumes ready staging after an aborted canonical commit without advancing checkpoint', async () => {
    const { repo } = await setup();
    const handler = (url: URL) => url.pathname.endsWith('/snapshots')
      ? Response.json({ protocolVersion: 2, status: 'snapshot', domain: 'health_workout_session',
        snapshotToken: TOKEN, authorityEpoch: 1, serverEpoch: EPOCH, watermark: 1, errorCode: null })
      : Response.json({ protocolVersion: 2, status: 'snapshot_page', domain: 'health_workout_session',
        snapshotToken: TOKEN, authorityEpoch: 1, serverEpoch: EPOCH, watermark: 1,
        rows: [snapshotRow(change(1))], nextEntityId: null, hasMore: false, errorCode: null });
    await expect(runWorkoutFullResync(repo, options('desktop', handler,
      { testOnlyAbortBeforeCheckpoint: true }))).rejects.toThrow();
    expect((await repo.getWorkoutFullResyncSession())?.status).toBe('ready');
    expect(await repo.getEntity('health_workout_session', ID)).toBeNull();
    expect(await repo.getSyncCheckpoint(WORKOUT_PULL_PROVIDER, 'health_workout_session')).toBeNull();
    expect(await runWorkoutFullResync(repo, options('desktop', handler)))
      .toMatchObject({ kind: 'committed', itemCount: 1, watermark: 1 });
  });

  it('refuses a page from a different snapshot watermark before staging or canonical writes', async () => {
    const { repo } = await setup();
    const handler = (url: URL) => url.pathname.endsWith('/snapshots')
      ? Response.json({ protocolVersion: 2, status: 'snapshot', domain: 'health_workout_session',
        snapshotToken: TOKEN, authorityEpoch: 1, serverEpoch: EPOCH, watermark: 1, errorCode: null })
      : Response.json({ protocolVersion: 2, status: 'snapshot_page', domain: 'health_workout_session',
        snapshotToken: TOKEN, authorityEpoch: 1, serverEpoch: EPOCH, watermark: 2,
        rows: [snapshotRow(change(1))], nextEntityId: null, hasMore: false, errorCode: null });
    await expect(runWorkoutFullResync(repo, options('desktop', handler))).rejects.toThrow('MALFORMED_RESPONSE');
    expect((await repo.getWorkoutFullResyncSession())?.itemCount).toBe(0);
    expect(await repo.getEntity('health_workout_session', ID)).toBeNull();
  });

  it.each(['SNAPSHOT_TOKEN_INVALID', 'STALE_AUTHORITY_EPOCH', 'AUTHORITY_RESET_FENCED'] as const)(
    'abandons only staging when the backend invalidates a snapshot with %s', async code => {
    const { repo, workouts } = await setup();
    const local = await workouts.createWorkoutSession(session(ID), { now: T0 });
    const result = await runWorkoutFullResync(repo, options('desktop', url => url.pathname.endsWith('/snapshots')
      ? Response.json({ protocolVersion: 2, status: 'snapshot', domain: 'health_workout_session',
        snapshotToken: TOKEN, authorityEpoch: 1, serverEpoch: EPOCH, watermark: 1, errorCode: null })
      : new Response(JSON.stringify({ status: 'rejected', errorCode: code }),
        { status: code === 'AUTHORITY_RESET_FENCED' ? 423 : 409 })));
    expect(result).toEqual({ kind: 'abandoned', code });
    expect(await repo.getWorkoutFullResyncSession()).toBeNull();
    expect(await repo.getEntity('health_workout_session', ID)).not.toBeNull();
    expect((await repo.getOutboxRecord(local.outbox.mutationId))?.status).toBe('pending');
    expect(await repo.getSyncCheckpoint(WORKOUT_PULL_PROVIDER, 'health_workout_session')).toBeNull();
  });

  it('preserves a remote-established row omitted by snapshot and records blocking absence evidence', async () => {
    const { repo } = await setup();
    await runWorkoutPullIteration(repo, options('desktop', () =>
      Response.json(pullPage(0, [change(1)]))));
    const result = await runWorkoutFullResync(repo, options('desktop', url => url.pathname.endsWith('/snapshots')
      ? Response.json({ protocolVersion: 2, status: 'snapshot', domain: 'health_workout_session',
        snapshotToken: TOKEN, authorityEpoch: 1, serverEpoch: EPOCH, watermark: 1, errorCode: null })
      : Response.json({ protocolVersion: 2, status: 'snapshot_page', domain: 'health_workout_session',
        snapshotToken: TOKEN, authorityEpoch: 1, serverEpoch: EPOCH, watermark: 1,
        rows: [], nextEntityId: null, hasMore: false, errorCode: null })));
    expect(result).toMatchObject({ kind: 'committed', conflicts: 1 });
    expect(await repo.getEntity('health_workout_session', ID)).toMatchObject({ serverRevision: 1 });
    expect(await repo.listConflicts('health_workout_session', ID))
      .toMatchObject([{ conflictType: 'workout_snapshot_absent_remote_established' }]);
  });
});
