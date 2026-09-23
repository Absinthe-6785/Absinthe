import { readFileSync } from 'node:fs';
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { afterEach, describe, expect, it } from 'vitest';
import {
  closeLocalDatabase,
  createDormantLocalDatabaseCapability,
  openLocalDatabase,
  type LocalDatabaseNamespace,
  type LocalDatabaseRepository,
} from './localDatabase';
import { WorkoutSessionRepository } from './workoutSessionRepository';
import type { WorkoutSessionV1 } from './workoutSessionV1';

const T0 = '2026-09-23T00:00:00.000Z';
const T1 = '2026-09-23T00:01:00.000Z';
const T2 = '2026-09-23T00:02:00.000Z';
const T3 = '2026-09-23T00:03:00.000Z';
const namespace: LocalDatabaseNamespace = {
  userId: 'account-g2', projectRef: 'project-g2', deviceId: 'device-g2', generationId: 'generation-g2', schemaVersion: 1,
};
const capability = createDormantLocalDatabaseCapability('test');
const opened: LocalDatabaseRepository[] = [];

async function makeRepository(factory = new IDBFactory()): Promise<{
  workouts: WorkoutSessionRepository;
  database: LocalDatabaseRepository;
}> {
  const database = await openLocalDatabase(namespace, { capability, indexedDBFactory: factory, clock: () => T0 });
  opened.push(database);
  await database.initializeNamespace();
  return { workouts: new WorkoutSessionRepository(database, () => T0), database };
}

function session(id: string, reps = 8, date = '2026-09-23'): WorkoutSessionV1 {
  return {
    version: 1,
    id,
    localDate: date,
    entries: [{
      id: '22222222-2222-4222-8222-222222222222',
      exercise: { id: 'squat', name: 'Squat', type: 'strength', tags: ['LEGS'], cardioMode: null },
      sets: [{
        id: '33333333-3333-4333-8333-333333333333', ordinal: 1, kind: 'strength', loadKind: 'external_weight',
        weightKg: '10', sourceValue: '10', sourceUnit: 'kg', reps, assistedReps: null, dropset: false, done: true,
      }],
    }],
  };
}

afterEach(() => {
  for (const database of opened.splice(0)) closeLocalDatabase(database);
});

describe('REL-05G2 dormant workout local repository', () => {
  it('commits create, update, tombstone, and restore as distinct local mutations', async () => {
    const { workouts: repository, database } = await makeRepository();
    const id = '11111111-1111-4111-8111-111111111111';
    const created = await repository.createWorkoutSession(session(id), { now: T0 });
    expect(created.entity).toMatchObject({
      domain: 'health_workout_session', entityId: id, revision: 1, localRevision: 1,
      serverRevision: null, pendingMutationId: created.outbox.mutationId, isDeleted: false,
    });
    expect(created.outbox).toMatchObject({
      baseRevision: null, localRevision: 1, operation: 'upsert', attemptCount: 0,
      deliveryBinding: { version: 1, state: 'unbound' },
    });

    const edited = session(id, 10);
    const updated = await repository.updateWorkoutSession(id, 1, edited, { now: T1 });
    expect(updated.entity).toMatchObject({ revision: 2, localRevision: 2, serverRevision: null, record: edited });
    expect(updated.outbox).toMatchObject({ baseRevision: 1, localRevision: 2, operation: 'upsert' });
    expect(updated.outbox.mutationId).not.toBe(created.outbox.mutationId);
    expect(updated.outbox.deliveryBinding).toEqual({ version: 1, state: 'unbound' });

    const beforeStaleOutboxes = await database.listOutboxMutations({ domain: 'health_workout_session', entityId: id, limit: 10 });
    await expect(repository.updateWorkoutSession(id, 1, session(id, 11), { now: T2 }))
      .rejects.toMatchObject({ code: 'STALE_REVISION' });
    expect(await repository.getWorkoutSession(id)).toEqual(updated.entity);
    expect(await database.listOutboxMutations({ domain: 'health_workout_session', entityId: id, limit: 10 }))
      .toEqual(beforeStaleOutboxes);

    const deleted = await repository.deleteWorkoutSession(id, 2, { now: T2 });
    expect(deleted.entity).toMatchObject({ revision: 3, localRevision: 3, isDeleted: true, record: edited });
    expect(deleted.outbox).toMatchObject({
      baseRevision: 2, localRevision: 3, operation: 'tombstone',
      payload: { kind: 'tombstone', entityId: id, revision: 3, deletedAt: T2 },
      deliveryBinding: { version: 1, state: 'unbound' },
    });
    expect(await repository.listWorkoutSessions()).toEqual([]);

    const restoredValue = session(id, 12);
    const restored = await repository.restoreWorkoutSession(id, 3, restoredValue, { now: T3 });
    expect(restored.entity).toMatchObject({ revision: 4, localRevision: 4, serverRevision: null, isDeleted: false, record: restoredValue });
    expect(restored.outbox).toMatchObject({ baseRevision: 3, localRevision: 4, operation: 'restore' });
    expect(new Set([created.outbox.mutationId, updated.outbox.mutationId, deleted.outbox.mutationId, restored.outbox.mutationId]).size)
      .toBe(4);
    expect(await repository.queryWorkoutSessionsByLocalDate('2026-09-23')).toEqual([restored.entity]);
  });

  it('allows multiple same-date sessions and filters from the canonical domain in memory', async () => {
    const { workouts: repository } = await makeRepository();
    const first = session('11111111-1111-4111-8111-111111111111');
    const second = session('77777777-7777-4777-8777-777777777777');
    await repository.createWorkoutSession(first, { now: T0 });
    await repository.createWorkoutSession(second, { now: T1 });
    await repository.createWorkoutSession(session('88888888-8888-4888-8888-888888888888', 5, '2026-09-22'), { now: T2 });
    expect((await repository.queryWorkoutSessionsByLocalDate('2026-09-23')).map(value => value.entityId))
      .toEqual([first.id, second.id]);
    expect(await repository.listWorkoutSessions()).toHaveLength(3);
  });

  it('rolls back entity/outbox writes for create, update, delete, and restore failures', async () => {
    const { workouts: repository, database } = await makeRepository();
    const id = '11111111-1111-4111-8111-111111111111';
    await expect(repository.createWorkoutSession(session(id), { now: T0, testOnlyAbortAt: 'before_outbox' }))
      .rejects.toMatchObject({ code: 'INVALID_OUTBOX' });
    expect(await repository.getWorkoutSession(id)).toBeNull();
    expect(await database.listOutboxMutations({ domain: 'health_workout_session', entityId: id, limit: 10 })).toEqual([]);

    const created = await repository.createWorkoutSession(session(id), { now: T0 });
    const originalOutbox = await database.listOutboxMutations({ domain: 'health_workout_session', entityId: id, limit: 10 });
    await expect(repository.updateWorkoutSession(id, 1, session(id, 9), { now: T1, testOnlyAbortAt: 'after_writes' }))
      .rejects.toMatchObject({ code: 'TRANSACTION_ABORTED' });
    expect(await repository.getWorkoutSession(id)).toEqual(created.entity);
    expect(await database.listOutboxMutations({ domain: 'health_workout_session', entityId: id, limit: 10 })).toEqual(originalOutbox);

    await expect(repository.deleteWorkoutSession(id, 1, { now: T1, testOnlyAbortAt: 'before_entity' }))
      .rejects.toMatchObject({ code: 'INVALID_ENTITY' });
    expect(await repository.getWorkoutSession(id)).toEqual(created.entity);
    expect(await database.listOutboxMutations({ domain: 'health_workout_session', entityId: id, limit: 10 })).toEqual(originalOutbox);

    const tombstone = await repository.deleteWorkoutSession(id, 1, { now: T1 });
    const tombstoneOutbox = await database.listOutboxMutations({ domain: 'health_workout_session', entityId: id, limit: 10 });
    await expect(repository.restoreWorkoutSession(id, 2, session(id, 10), { now: T2, testOnlyAbortAt: 'after_writes' }))
      .rejects.toMatchObject({ code: 'TRANSACTION_ABORTED' });
    expect(await repository.getWorkoutSession(id)).toEqual(tombstone.entity);
    expect(await database.listOutboxMutations({ domain: 'health_workout_session', entityId: id, limit: 10 })).toEqual(tombstoneOutbox);
  });

  it('does not change product workout callers or reuse local_version as identity', () => {
    const healthView = readFileSync(new URL('../components/views/HealthView.tsx', import.meta.url), 'utf8');
    const persistence = readFileSync(new URL('../components/views/features/health/healthWorkoutPersistence.ts', import.meta.url), 'utf8');
    expect(healthView).not.toContain('workoutSessionRepository');
    expect(persistence).not.toContain('workoutSessionRepository');
    expect(healthView).not.toContain('WorkoutSessionV1');
    expect(persistence).not.toContain('WorkoutSessionV1');
  });

  it('keeps new unbound state scoped to workouts while legacy domains remain writable', async () => {
    const { database } = await makeRepository();
    const committed = await database.commitLocalMutation({
      mutation: { mode: 'create', domain: 'notes', entityId: 'note-1', record: { body: 'still works' } }, now: T0,
    });
    expect(committed.outbox).not.toHaveProperty('deliveryBinding');
  });
});
