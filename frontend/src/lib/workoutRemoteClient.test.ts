import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  closeLocalDatabase, createDormantLocalDatabaseCapability, openLocalDatabase,
  type LocalDatabaseRepository, type LocalDatabaseNamespace,
} from './localDatabase';
import { createWorkoutRemoteControlClient, WorkoutRemoteDiscoveryError } from './workoutRemoteClient';
import { WorkoutSessionRepository } from './workoutSessionRepository';

const OWNER = '11111111-1111-4111-8111-111111111111';
const BINDING = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const EPOCH = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const scope: LocalDatabaseNamespace = {
  userId: OWNER, projectRef: 'client-local-ref', deviceId: 'device-desktop',
  generationId: 'generation-desktop', schemaVersion: 1,
};
const opened: LocalDatabaseRepository[] = [];

async function repository(factory = new IDBFactory()) {
  const repo = await openLocalDatabase(scope, {
    capability: createDormantLocalDatabaseCapability('test'), indexedDBFactory: factory,
  });
  opened.push(repo);
  await repo.initializeNamespace();
  return repo;
}

async function firstMutation(repo: LocalDatabaseRepository) {
  const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  return new WorkoutSessionRepository(repo).createWorkoutSession({
    version: 1, id, localDate: '2026-09-27', entries: [{
      id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      exercise: { id: null, name: 'Push-up', type: 'bodyweight', tags: [], cardioMode: null },
      sets: [{ id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', ordinal: 1, kind: 'bodyweight',
        loadKind: 'bodyweight', reps: 8, assistedReps: null, dropset: false, done: true }],
    }],
  });
}

function harness(repo: LocalDatabaseRepository, override: {
  projectScope?: string; generationProjectScope?: string; capability?: string;
  authorityStatus?: number; generationStatus?: number; throwNetwork?: boolean;
  onAuthority?: () => void | Promise<void>;
} = {}) {
  let account = OWNER;
  let device = scope.deviceId;
  const calls: { url: string; body?: unknown }[] = [];
  const projectScope = override.projectScope ?? 'nondefault-workout-project';
  const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const path = new URL(String(url)).pathname;
    calls.push({ url: String(url), body: init?.body ? JSON.parse(String(init.body)) : undefined });
    if (override.throwNetwork) throw new Error('offline');
    if (path === '/api/sync/v2/generations') return Response.json({
      protocolVersion: 2, status: 'active', namespaceKey: repo.namespaceKey,
      generationId: scope.generationId, deviceId: scope.deviceId, serverEpoch: EPOCH,
    });
    if (path === '/api/sync/v2/workouts/authority') {
      await override.onAuthority?.();
      if (override.authorityStatus === 401) return Response.json({ detail: 'unauthorized' }, { status: 401 });
      if (override.authorityStatus === 423 && override.capability === undefined) return Response.json({
        detail: 'WORKOUT_REMOTE_FOUNDATION_DISABLED', projectScope,
      }, { status: 423 });
      if (override.capability === 'DISABLED') return Response.json({
        projectScope, errorCode: 'CAPABILITY_DISABLED', capability: 'DISABLED', protocolVersion: 2,
        domain: 'health_workout_session', authorityEpoch: null, authorityState: null,
        bindingState: 'registration_required', bindingId: null, serverEpoch: null,
      }, { status: 423 });
      return Response.json({
        projectScope, protocolVersion: 2, domain: 'health_workout_session',
        capability: override.capability ?? 'FOUNDATION_READY', authorityState: 'OPEN', authorityEpoch: 1,
        bindingState: 'registration_required', bindingId: null, serverEpoch: null, errorCode: null,
      });
    }
    if (path === '/api/sync/v2/workouts/generations') return Response.json({
      projectScope: override.generationProjectScope ?? projectScope,
      protocolVersion: 2, status: 'bound', domain: 'health_workout_session',
      namespaceKey: repo.namespaceKey, generationId: scope.generationId, deviceId: scope.deviceId,
      bindingId: BINDING, authorityEpoch: 1, serverEpoch: EPOCH, errorCode: null,
    }, { status: override.generationStatus ?? 200 });
    throw new Error('unexpected_route');
  });
  const diagnostics: string[] = [];
  const client = createWorkoutRemoteControlClient({
    baseUrl: 'https://api.example.test', getSession: async () => ({ accountId: account, accessToken: 'test-token' }),
    currentAccountId: () => account, currentDeviceId: () => device,
    fetchImpl: fetchImpl as typeof fetch,
    onDiagnostic: event => diagnostics.push(event),
  });
  return { client, calls, diagnostics, setAccount: (value: string) => { account = value; },
    setDevice: (value: string) => { device = value; } };
}

afterEach(() => { for (const repo of opened.splice(0)) closeLocalDatabase(repo); });

describe('REL-05G4B1 dormant authenticated authority discovery', () => {
  it('reuses shared generation then persists matching non-default server scope', async () => {
    const repo = await repository();
    const { client, calls, diagnostics } = harness(repo);
    const row = await client.discoverAndPersist(repo);
    expect(row).toMatchObject({ projectScope: 'nondefault-workout-project', generationBindingId: BINDING,
      authorityEpoch: 1, serverEpoch: EPOCH });
    expect(await repo.getWorkoutRemoteAuthority()).toEqual(row);
    expect(calls.map(call => new URL(call.url).pathname)).toEqual([
      '/api/sync/v2/generations', '/api/sync/v2/workouts/authority', '/api/sync/v2/workouts/generations',
    ]);
    expect(calls[0]?.body).toMatchObject({ accountId: OWNER, namespaceKey: repo.namespaceKey,
      generationId: scope.generationId, deviceId: scope.deviceId });
    expect(calls[2]?.body).not.toHaveProperty('projectScope');
    expect(diagnostics).toContain('authority_discovery_success');
  });

  it('orchestrates a new binding through fresh authenticated discovery', async () => {
    const repo = await repository();
    const mutation = await firstMutation(repo);
    const { client } = harness(repo);
    const bound = await client.discoverAndBind(repo, mutation.outbox.mutationId);
    expect(bound.deliveryBinding).toMatchObject({ state: 'bound',
      projectScope: 'nondefault-workout-project', remoteCasBaseRevision: null });
    expect((await repo.getWorkoutRemoteAuthority())?.verificationId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('fails closed on project-scope mismatch, disabled capability, feature flag, auth and network failure', async () => {
    for (const [options, expected] of [
      [{ generationProjectScope: 'different-project' }, 'PROJECT_SCOPE_MISMATCH'],
      [{ capability: 'DISABLED' }, 'CAPABILITY_DISABLED'],
      [{ capability: 'ADOPTION_READY' }, 'MALFORMED_RESPONSE'],
      [{ authorityStatus: 423 }, 'FEATURE_DISABLED'],
      [{ authorityStatus: 401 }, 'AUTH_REQUIRED'],
      [{ throwNetwork: true }, 'NETWORK_RETRYABLE'],
    ] as const) {
      const repo = await repository();
      const { client } = harness(repo, options);
      await expect(client.discoverAndPersist(repo)).rejects.toMatchObject({ code: expected });
      expect(await repo.getWorkoutRemoteAuthority()).toBeNull();
    }
  });

  it('discards network responses after account, device or generation changes', async () => {
    const accountRepo = await repository();
    let switchAccount = () => {};
    const accountHarness = harness(accountRepo, { onAuthority: () => switchAccount() });
    switchAccount = () => accountHarness.setAccount('22222222-2222-4222-8222-222222222222');
    await expect(accountHarness.client.discoverAndPersist(accountRepo)).rejects.toMatchObject({ code: 'AUTH_REQUIRED' });
    expect(await accountRepo.getWorkoutRemoteAuthority()).toBeNull();

    const deviceRepo = await repository();
    let switchDevice = () => {};
    const deviceHarness = harness(deviceRepo, { onAuthority: () => switchDevice() });
    switchDevice = () => deviceHarness.setDevice('different-durable-device');
    await expect(deviceHarness.client.discoverAndPersist(deviceRepo)).rejects.toMatchObject({ code: 'IDENTITY_CHANGED' });
    expect(await deviceRepo.getWorkoutRemoteAuthority()).toBeNull();

    const generationRepo = await repository();
    const generationHarness = harness(generationRepo, { onAuthority: async () => {
      await generationRepo.createGeneration('next-generation', 'test');
      await generationRepo.activateGeneration('next-generation');
    } });
    await expect(generationHarness.client.discoverAndPersist(generationRepo)).rejects.toHaveProperty('code', 'STALE_GENERATION');
    expect(await generationRepo.getWorkoutRemoteAuthority()).toBeNull();
  });

  it('retries exact generation registration after local persistence abort', async () => {
    const repo = await repository();
    const { client, calls } = harness(repo);
    await expect(client.discoverAndPersist(repo, true)).rejects.toHaveProperty('code', 'TRANSACTION_ABORTED');
    expect(await repo.getWorkoutRemoteAuthority()).toBeNull();
    const accepted = await client.discoverAndPersist(repo);
    expect(accepted.generationBindingId).toBe(BINDING);
    expect(calls.filter(call => new URL(call.url).pathname === '/api/sync/v2/workouts/generations')).toHaveLength(2);
    expect(await repo.getWorkoutRemoteAuthority()).toEqual(accepted);
  });

  it('classifies malformed responses without local permission', async () => {
    const repo = await repository();
    const { client } = harness(repo, { capability: 'FOUNDATION_READY', generationProjectScope: '' });
    try {
      await client.discoverAndPersist(repo);
      throw new Error('expected_failure');
    } catch (error) {
      expect(error).toBeInstanceOf(WorkoutRemoteDiscoveryError);
      expect(error).toMatchObject({ code: 'PROJECT_SCOPE_MISMATCH' });
    }
    expect(await repo.getWorkoutRemoteAuthority()).toBeNull();
  });

  it('invalidates an older verification when a fresh discovery is capability-disabled', async () => {
    const repo = await repository();
    const mutation = await firstMutation(repo);
    const valid = await harness(repo).client.discoverAndPersist(repo);
    await expect(harness(repo, { capability: 'DISABLED' }).client.discoverAndPersist(repo))
      .rejects.toMatchObject({ code: 'CAPABILITY_DISABLED' });
    expect(await repo.getWorkoutRemoteAuthority()).toEqual(valid);
    await expect(repo.bindWorkoutMutation({ mutationId: mutation.outbox.mutationId,
      expectedVerificationId: valid.verificationId, currentAuthenticatedAccount: () => OWNER,
      currentDeviceId: () => scope.deviceId })).rejects.toHaveProperty('code', 'INVALID_RESERVED_RECORD');
  });

  it('serializes overlapping discovery across two repository tabs without wall-clock ordering', async () => {
    const factory = new IDBFactory();
    const first = await repository(factory);
    const second = await repository(factory);
    const mutation = await firstMutation(first);
    const old = await harness(first).client.discoverAndPersist(first);
    let release!: () => void;
    let started!: () => void;
    const blocked = new Promise<void>(resolve => { release = resolve; });
    const reached = new Promise<void>(resolve => { started = resolve; });
    const a = harness(first, { onAuthority: async () => { started(); await blocked; } });
    const aPending = a.client.discoverAndPersist(first);
    await reached;
    const current = await harness(second).client.discoverAndPersist(second);
    release();
    await expect(aPending).rejects.toHaveProperty('code', 'INVALID_RESERVED_RECORD');
    expect(current.discoverySequence).toBeGreaterThan(old.discoverySequence);
    expect(await first.getWorkoutRemoteAuthority()).toEqual(current);
    await expect(first.bindWorkoutMutation({ mutationId: mutation.outbox.mutationId,
      expectedVerificationId: old.verificationId, currentAuthenticatedAccount: () => OWNER,
      currentDeviceId: () => scope.deviceId })).rejects.toHaveProperty('code', 'INVALID_RESERVED_RECORD');
    const bound = await second.bindWorkoutMutation({ mutationId: mutation.outbox.mutationId,
      expectedVerificationId: current.verificationId, currentAuthenticatedAccount: () => OWNER,
      currentDeviceId: () => scope.deviceId });
    expect(bound.deliveryBinding).toMatchObject({ state: 'bound' });
  });
});
