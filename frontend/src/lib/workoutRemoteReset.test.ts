import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  closeLocalDatabase, createDormantLocalDatabaseCapability, openLocalDatabase,
  type LocalDatabaseRepository, type LocalDatabaseNamespace,
} from './localDatabase';
import { createWorkoutRemoteResetClient } from './workoutRemoteReset';
import { workoutResetRequestDigest } from './workoutRemoteContract';
import { WorkoutSessionRepository } from './workoutSessionRepository';

const OWNER = '11111111-1111-4111-8111-111111111111';
const BINDING = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const SERVER_EPOCH = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const T0 = '2026-09-28T00:00:00.000Z';
const namespace: LocalDatabaseNamespace = {
  userId: OWNER, projectRef: 'local-project-only', deviceId: 'device-desktop',
  generationId: 'generation-desktop', schemaVersion: 1,
};
const opened: LocalDatabaseRepository[] = [];

async function repository(factory = new IDBFactory()) {
  const repo = await openLocalDatabase(namespace, {
    capability: createDormantLocalDatabaseCapability('test'), indexedDBFactory: factory,
  });
  opened.push(repo);
  await repo.initializeNamespace();
  const sequence = await repo.reserveWorkoutRemoteDiscovery();
  await repo.persistWorkoutRemoteAuthority({
    accountId: OWNER, namespaceKey: repo.namespaceKey, generationId: namespace.generationId,
    domain: 'health_workout_session', deviceId: namespace.deviceId, protocolVersion: 2,
    projectScope: 'trusted-server-project', capability: 'FOUNDATION_READY', authorityState: 'OPEN',
    authorityEpoch: 1, bindingState: 'bound', generationBindingId: BINDING,
    serverEpoch: SERVER_EPOCH, verifiedAt: T0, discoverySequence: sequence,
    verificationId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  }, () => OWNER, () => namespace.deviceId);
  return repo;
}

afterEach(() => { for (const repo of opened.splice(0)) closeLocalDatabase(repo); });

function harness(options: { loseFirstContinue?: boolean; malformedCompletion?: boolean } = {}) {
  const requests: { path: string; body: Record<string, unknown> }[] = [];
  let lost = false;
  const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const path = new URL(String(url)).pathname;
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    requests.push({ path, body });
    if (path.endsWith('/continue') && options.loseFirstContinue && !lost) {
      lost = true;
      throw new Error('response-lost');
    }
    const completed = path.endsWith('/continue');
    return Response.json({
      protocolVersion: 2, status: completed ? 'completed' : 'applying',
      resetId: body.resetId, sourceEpoch: 1, targetEpoch: 2,
      inventoryCount: 2, activeCount: 1, appliedCount: completed ? 1 : 0,
      inventoryDigest: 'a'.repeat(64),
      completionDigest: completed ? options.malformedCompletion ? null : 'b'.repeat(64) : null,
      errorCode: null, projectScope: 'trusted-server-project',
    });
  });
  const client = createWorkoutRemoteResetClient({
    baseUrl: 'https://api.example.test',
    getSession: async () => ({ accountId: OWNER, accessToken: 'test-token' }),
    currentAccountId: () => OWNER, currentDeviceId: () => namespace.deviceId,
    fetchImpl: fetchImpl as typeof fetch,
  });
  return { client, requests };
}

describe('REL-05G4C dormant local reset continuation', () => {
  it('matches the Python/SQL reset-intent digest tuple', () => {
    expect(workoutResetRequestDigest({
      authenticatedOwnerId: OWNER, projectScope: 'trusted-server-project',
      namespaceKey: 'a'.repeat(64), generationId: namespace.generationId,
      deviceId: namespace.deviceId, generationBindingId: BINDING,
      authorityEpoch: 1, resetId: '99999999-9999-4999-8999-999999999999',
    })).toBe('17fb7057b78fd40ed26d488d77f5caa537ec96c7a573fac99c5dda3c8da3868b');
  });

  it('persists the intent before network and resumes the exact ID after response loss', async () => {
    const repo = await repository();
    const { client, requests } = harness({ loseFirstContinue: true });
    await expect(client.runStep(repo)).rejects.toThrow('NETWORK_RETRYABLE');
    const durable = await repo.getWorkoutRemoteResetIntent();
    expect(durable?.status).toBe('applying');
    expect(durable?.resetId).toBe(requests[0].body.resetId);
    expect(durable?.requestDigest).toBe(requests[0].body.requestDigest);
    const completed = await client.runStep(repo);
    expect(completed.status).toBe('completed');
    expect(completed.appliedCount).toBe(1);
    expect(requests.every(row => row.body.resetId === durable?.resetId)).toBe(true);
    expect(await repo.getWorkoutRemoteAuthority()).toMatchObject({
      authorityEpoch: 1, generationBindingId: BINDING,
    });
    expect((await client.runStep(repo)).resetId).toBe(durable?.resetId);
    expect(requests).toHaveLength(4);
  });

  it('does not mark a malformed completion durable', async () => {
    const repo = await repository();
    const { client } = harness({ malformedCompletion: true });
    await expect(client.runStep(repo)).rejects.toThrow('MALFORMED_RESPONSE');
    expect((await repo.getWorkoutRemoteResetIntent())?.status).toBe('applying');
  });

  it('serializes two tabs on one durable intent without a second reset ID', async () => {
    const repo = await repository();
    const { client, requests } = harness();
    const [first, second] = await Promise.all([client.runStep(repo), client.runStep(repo)]);
    expect(first.resetId).toBe(second.resetId);
    expect(requests.every(row => row.body.resetId === first.resetId)).toBe(true);
    expect((await repo.getWorkoutRemoteResetIntent())?.status).toBe('completed');
  });

  it('never clears or rewrites pending local Workout content during remote reset', async () => {
    const repo = await repository();
    const workouts = new WorkoutSessionRepository(repo, () => T0);
    const created = await workouts.createWorkoutSession({
      version: 1, id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', localDate: '2026-09-28',
      entries: [{ id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        exercise: { id: null, name: 'Push-up', type: 'bodyweight', tags: [], cardioMode: null },
        sets: [{ id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', ordinal: 1,
          kind: 'bodyweight', loadKind: 'bodyweight', reps: 8, assistedReps: null,
          dropset: false, done: true }],
      }],
    }, { now: T0 });
    const before = await repo.getOutboxRecord(created.outbox.mutationId);
    const { client } = harness();
    expect((await client.runStep(repo)).status).toBe('completed');
    expect(await repo.getOutboxRecord(created.outbox.mutationId)).toEqual(before);
    expect((await workouts.getWorkoutSession(created.entity.entityId))?.record.entries[0].sets[0])
      .toMatchObject({ reps: 8 });
  });
});
