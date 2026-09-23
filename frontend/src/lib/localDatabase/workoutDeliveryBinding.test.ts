import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { afterEach, describe, expect, it } from 'vitest';
import {
  LOCAL_DATABASE_NAME,
  closeLocalDatabase,
  createDormantLocalDatabaseCapability,
  openLocalDatabase,
  type LocalDatabaseNamespace,
  type LocalDatabaseRepository,
} from './index';
import { WorkoutSessionRepository } from '../workoutSessionRepository';
import type { WorkoutSessionV1 } from '../workoutSessionV1';

const T0 = '2026-09-23T00:00:00.000Z';
const T1 = '2026-09-23T00:01:00.000Z';
const scope: LocalDatabaseNamespace = {
  userId: 'account-binding', projectRef: 'project-binding', deviceId: 'device-binding', generationId: 'generation-binding', schemaVersion: 1,
};
const capability = createDormantLocalDatabaseCapability('test');
const repositories: LocalDatabaseRepository[] = [];

async function open(factory: IDBFactory) {
  const database = await openLocalDatabase(scope, { capability, indexedDBFactory: factory, clock: () => T0 });
  repositories.push(database);
  await database.initializeNamespace();
  return database;
}

function workout(id = '11111111-1111-4111-8111-111111111111'): WorkoutSessionV1 {
  return {
    version: 1, id, localDate: '2026-09-23', entries: [{
      id: '22222222-2222-4222-8222-222222222222',
      exercise: { id: null, name: 'Squat', type: 'strength', tags: [], cardioMode: null },
      sets: [{
        id: '33333333-3333-4333-8333-333333333333', ordinal: 1, kind: 'strength', loadKind: 'external_weight',
        weightKg: '0', sourceValue: '0', sourceUnit: 'kg', reps: null, assistedReps: null, dropset: false, done: false,
      }],
    }],
  };
}

function rawOpen(factory: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = factory.open(LOCAL_DATABASE_NAME);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

afterEach(() => {
  for (const repository of repositories.splice(0)) closeLocalDatabase(repository);
});

describe('REL-05G2 dormant workout delivery binding', () => {
  it('never claims an explicit-unbound workout and preserves legacy claim behavior', async () => {
    const factory = new IDBFactory();
    const database = await open(factory);
    const workoutRepository = new WorkoutSessionRepository(database, () => T0);
    const workoutCommit = await workoutRepository.createWorkoutSession(workout(), { now: T0 });
    const legacyCommit = await database.commitLocalMutation({
      mutation: { mode: 'create', domain: 'health_routine_profile', entityId: 'routine-1', record: { label: 'legacy path' } },
      now: T0,
    });
    expect(workoutCommit.outbox.deliveryBinding).toEqual({ version: 1, state: 'unbound' });
    expect(legacyCommit.outbox).not.toHaveProperty('deliveryBinding');

    const claimed = await database.claimNextMutations({
      workerId: 'worker-g2', now: T1, leaseDurationMs: 30_000, limit: 10,
    });
    expect(claimed.map(value => value.mutationId)).toEqual([legacyCommit.outbox.mutationId]);
    const dormant = await database.getOutboxRecord(workoutCommit.outbox.mutationId);
    expect(dormant).toMatchObject({ status: 'pending', attemptCount: 0, lastAttemptAt: null,
      deliveryBinding: { version: 1, state: 'unbound' } });
  });

  it('durably quarantines attempted-but-unbound rows without changing identity or payload', async () => {
    const factory = new IDBFactory();
    const database = await open(factory);
    const workoutRepository = new WorkoutSessionRepository(database, () => T0);
    const created = await workoutRepository.createWorkoutSession(workout(), { now: T0 });
    const db = await rawOpen(factory);
    const transaction = db.transaction('outbox', 'readwrite');
    const store = transaction.objectStore('outbox');
    const request = store.get([database.namespaceKey, scope.generationId, created.outbox.mutationId]);
    request.onsuccess = () => {
      const record = request.result;
      record.status = 'permanent_failure';
      record.attemptCount = 1;
      record.lastAttemptAt = T1;
      record.updatedAt = T1;
      record.lastErrorCode = 'NETWORK_ERROR';
      store.put(record);
    };
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onabort = () => reject(transaction.error);
    });
    db.close();

    await expect(database.resetPermanentFailure({ mutationId: created.outbox.mutationId, now: T1 }))
      .rejects.toMatchObject({ code: 'INVALID_OUTBOX_TRANSITION' });
    expect(await database.listNextDeliverableMutations({ now: T1, limit: 10 })).toEqual([]);
    const quarantined = await database.getOutboxRecord(created.outbox.mutationId);
    expect(quarantined).toMatchObject({
      status: 'permanent_failure', attemptCount: 1, lastAttemptAt: T1,
      deliveryBlockCode: 'UNBOUND_ATTEMPT_QUARANTINED',
      deliveryBinding: { version: 1, state: 'unbound' },
      payload: created.outbox.payload,
      mutationId: created.outbox.mutationId,
      idempotencyKey: created.outbox.idempotencyKey,
    });
    expect(await database.claimNextMutations({ workerId: 'worker-g2', now: T1, leaseDurationMs: 30_000, limit: 10 }))
      .toEqual([]);
    await expect(database.claimNextMutations({ workerId: 'worker-g2', now: T1, leaseDurationMs: 30_000, limit: 10 }))
      .resolves.toEqual([]);
    expect(await database.getOutboxRecord(created.outbox.mutationId)).toEqual(quarantined);
  });
});
