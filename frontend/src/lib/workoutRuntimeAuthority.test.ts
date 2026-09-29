import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { supabase } from './supabase';
import { setRuntimeAccountSyncAccount } from './remoteBoundary';
import { HEALTH_ROUTINE_DEVICE_ID_KEY } from './healthRoutineSync';
import {
  closeLocalDatabase, createDormantLocalDatabaseCapability, openLocalDatabase,
  type LocalDatabaseRepository,
} from './localDatabase';
import { createWorkoutRemoteControlClient } from './workoutRemoteClient';
import {
  createProductionWorkoutRuntimeAuthorityController, createWorkoutRuntimeAuthorityController,
} from './workoutRuntimeAuthority';

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const BINDING = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const EPOCH = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const repos: LocalDatabaseRepository[] = [];

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(r => { resolve = r; });
  return { promise, resolve };
}

function harness(override: {
  binding?: 'bound' | 'registration_required';
  authority?: 'ready' | 'disabled' | 'feature_disabled' | 'reset_fenced';
  onAuthority?: () => void | Promise<void>;
  networkFailure?: boolean;
} = {}) {
  const factory = new IDBFactory();
  const opened: LocalDatabaseRepository[] = [];
  let account = A;
  let device = 'device-desktop';
  const calls: string[] = [];
  const diagnostics: string[] = [];
  const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const path = new URL(String(url)).pathname;
    calls.push(path);
    if (override.networkFailure) throw new Error('offline');
    if (path === '/api/sync/v2/generations') {
      const request = JSON.parse(String(init?.body));
      return Response.json({ protocolVersion: 2, status: 'active',
        namespaceKey: request.namespaceKey, generationId: request.generationId,
        deviceId: request.deviceId, serverEpoch: EPOCH });
    }
    if (path === '/api/sync/v2/workouts/authority') {
      await override.onAuthority?.();
      if (override.authority === 'feature_disabled') {
        return Response.json({ detail: 'WORKOUT_REMOTE_FOUNDATION_DISABLED' }, { status: 423 });
      }
      if (override.authority === 'disabled' || override.authority === 'reset_fenced') {
        return Response.json({ errorCode: override.authority === 'disabled'
          ? 'CAPABILITY_DISABLED' : 'AUTHORITY_RESET_FENCED' }, { status: 423 });
      }
      return Response.json({ protocolVersion: 2, domain: 'health_workout_session',
        projectScope: 'trusted-server-scope', capability: 'FOUNDATION_READY', authorityState: 'OPEN',
        authorityEpoch: 1, bindingState: override.binding ?? 'registration_required',
        bindingId: override.binding === 'bound' ? BINDING : null,
        serverEpoch: override.binding === 'bound' ? EPOCH : null, errorCode: null });
    }
    if (path === '/api/sync/v2/workouts/generations') {
      const request = JSON.parse(String(init?.body));
      return Response.json({ protocolVersion: 2, status: 'bound', domain: 'health_workout_session',
        namespaceKey: request.namespaceKey, generationId: request.generationId,
        deviceId: request.deviceId, projectScope: 'trusted-server-scope',
        bindingId: BINDING, authorityEpoch: 1, serverEpoch: EPOCH, errorCode: null });
    }
    throw new Error('unexpected endpoint');
  });
  const controller = createWorkoutRuntimeAuthorityController({
    currentAccountId: () => account,
    readOrCreateDeviceId: () => device,
    currentDeviceId: () => device,
    online: () => true,
    openRepository: async (owner, currentDevice) => {
      const repository = await openLocalDatabase({ userId: owner, projectRef: 'absinthe-health-routines',
        deviceId: currentDevice, generationId: 'health-routine-v1', schemaVersion: 1 }, {
        capability: createDormantLocalDatabaseCapability('test'), indexedDBFactory: factory,
      });
      repos.push(repository);
      opened.push(repository);
      await repository.initializeNamespace();
      return repository;
    },
    closeRepository: () => undefined,
    createClient: current => createWorkoutRemoteControlClient({
      baseUrl: 'https://api.example.test', fetchImpl: fetchImpl as typeof fetch,
      getSession: async () => ({ accountId: account, accessToken: 'test-token' }),
      currentAccountId: () => current() ? account : null,
      currentDeviceId: () => current() ? device : null,
    }),
    onDiagnostic: event => diagnostics.push(event),
  });
  return { controller, calls, diagnostics, repos: opened, setAccount: (value: string) => { account = value; },
    setDevice: (value: string) => { device = value; } };
}

afterEach(() => {
  for (const repo of repos.splice(0)) closeLocalDatabase(repo);
  setRuntimeAccountSyncAccount(null);
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('REL-05G5A Workout authority-only runtime', () => {
  it('uses the production shared device ID and v7 namespace, then persists only control evidence', async () => {
    const storage = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => { storage.set(key, value); },
    });
    vi.stubGlobal('navigator', { onLine: true });
    vi.stubGlobal('indexedDB', new IDBFactory());
    setRuntimeAccountSyncAccount(A);
    vi.spyOn(supabase.auth, 'getSession').mockResolvedValue({
      data: { session: { user: { id: A }, access_token: 'test-token' } }, error: null,
    } as never);
    const routes: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      const path = new URL(url).pathname;
      routes.push(path);
      if (path === '/api/sync/v2/generations') {
        const request = JSON.parse(String(init?.body));
        return Response.json({ protocolVersion: 2, status: 'active', namespaceKey: request.namespaceKey,
          generationId: request.generationId, deviceId: request.deviceId, serverEpoch: EPOCH });
      }
      if (path === '/api/sync/v2/workouts/authority') return Response.json({
        protocolVersion: 2, domain: 'health_workout_session', projectScope: 'trusted-server-scope',
        capability: 'FOUNDATION_READY', authorityState: 'OPEN', authorityEpoch: 1,
        bindingState: 'bound', bindingId: BINDING, serverEpoch: EPOCH, errorCode: null,
      });
      throw new Error('unexpected route');
    }));
    const controller = createProductionWorkoutRuntimeAuthorityController();
    expect((await controller.start(A)).kind).toBe('ready');
    const deviceId = storage.get(HEALTH_ROUTINE_DEVICE_ID_KEY);
    expect(deviceId).toMatch(/^[0-9a-f-]{36}$/);
    expect(routes).toEqual(['/api/sync/v2/generations', '/api/sync/v2/workouts/authority']);
    const repository = await openLocalDatabase({ userId: A, projectRef: 'absinthe-health-routines',
      deviceId: deviceId!, generationId: 'health-routine-v1', schemaVersion: 1 }, {
      capability: createDormantLocalDatabaseCapability('test'),
    });
    repos.push(repository);
    expect((await repository.getWorkoutRemoteAuthority())?.capability).toBe('FOUNDATION_READY');
  });

  it.each(['registration_required', 'bound'] as const)('persists positive %s authority without data-plane work', async binding => {
    const h = harness({ binding });
    expect(await h.controller.start(A)).toMatchObject({ kind: 'ready', accountId: A, authorityEpoch: 1 });
    expect((await h.repos[0]!.getWorkoutRemoteAuthority())).toMatchObject({
      accountId: A, deviceId: 'device-desktop', projectScope: 'trusted-server-scope',
      capability: 'FOUNDATION_READY', authorityState: 'OPEN', generationBindingId: BINDING,
    });
    expect(h.calls).toEqual(binding === 'bound'
      ? ['/api/sync/v2/generations', '/api/sync/v2/workouts/authority']
      : ['/api/sync/v2/generations', '/api/sync/v2/workouts/authority', '/api/sync/v2/workouts/generations']);
    expect(h.calls).not.toContain('/api/sync/v2/workouts/mutations');
    expect(h.diagnostics).toContain('workout_authority_bootstrap_ready');
  });

  it.each([
    ['disabled', 'disabled'], ['feature_disabled', 'disabled'], ['reset_fenced', 'reset_fenced'],
  ] as const)('classifies %s without granting authority', async (authority, kind) => {
    const h = harness({ authority });
    expect(await h.controller.start(A)).toMatchObject({ kind });
    expect(await h.repos[0]!.getWorkoutRemoteAuthority()).toBeNull();
    expect(h.calls).not.toContain('/api/sync/v2/workouts/generations');
  });

  it('classifies network failure once without retrying or blocking another product startup', async () => {
    const h = harness({ networkFailure: true });
    expect(await h.controller.start(A)).toMatchObject({ kind: 'retry_later' });
    expect(h.calls).toHaveLength(1);
  });

  it('coalesces concurrent same-account starts and does not trust a cached authority as live proof', async () => {
    const gate = deferred<void>();
    const h = harness({ onAuthority: () => gate.promise });
    const first = h.controller.start(A);
    expect(h.controller.start(A)).toBe(first);
    await vi.waitFor(() => expect(h.calls).toContain('/api/sync/v2/workouts/authority'));
    gate.resolve();
    expect((await first).kind).toBe('ready');
    expect((await h.controller.start(A)).kind).toBe('ready');
    expect(h.calls.filter(path => path === '/api/sync/v2/workouts/authority')).toHaveLength(2);
  });

  it('fences A→B and logout before durable settlement', async () => {
    const gate = deferred<void>();
    const h = harness({ onAuthority: () => gate.promise });
    const first = h.controller.start(A);
    await vi.waitFor(() => expect(h.calls).toContain('/api/sync/v2/workouts/authority'));
    h.setAccount(B);
    h.controller.cancel();
    const next = h.controller.start(B);
    gate.resolve();
    expect((await first).kind).toBe('stale');
    expect((await next).kind).toBe('ready');
    expect(h.controller.snapshot()).toMatchObject({ kind: 'ready', accountId: B });
    expect(await h.repos[0]!.getWorkoutRemoteAuthority()).toBeNull();
    expect((await h.repos[1]!.getWorkoutRemoteAuthority())?.accountId).toBe(B);

    const later = h.controller.start(B);
    h.setAccount('');
    h.controller.cancel();
    expect((await later).kind).toBe('stale');
    expect(h.controller.snapshot().kind).toBe('idle');
  });

  it('does not persist an in-flight authority response after logout', async () => {
    const gate = deferred<void>();
    const h = harness({ onAuthority: () => gate.promise });
    const pending = h.controller.start(A);
    await vi.waitFor(() => expect(h.calls).toContain('/api/sync/v2/workouts/authority'));
    h.setAccount('');
    h.controller.cancel();
    gate.resolve();
    expect((await pending).kind).toBe('stale');
    expect(await h.repos[0]!.getWorkoutRemoteAuthority()).toBeNull();
    expect(h.controller.snapshot().kind).toBe('idle');
  });

  it('fences rapid A1→B→A2 even when the final account ID equals A1', async () => {
    const firstGate = deferred<void>();
    let authorityCount = 0;
    const h = harness({ onAuthority: () => ++authorityCount === 1 ? firstGate.promise : undefined });
    const a1 = h.controller.start(A);
    await vi.waitFor(() => expect(authorityCount).toBe(1));
    h.setAccount(B); h.controller.cancel();
    const b = h.controller.start(B);
    h.setAccount(A); h.controller.cancel();
    const a2 = h.controller.start(A);
    firstGate.resolve();
    expect((await a1).kind).toBe('stale');
    expect((await b).kind).toBe('stale');
    expect((await a2).kind).toBe('ready');
    expect(h.controller.snapshot()).toMatchObject({ kind: 'ready', accountId: A });
    expect((await h.repos[0]!.getWorkoutRemoteAuthority())?.discoverySequence).toBe(2);
  });

  it('rejects changed device and changed active generation before persistence', async () => {
    const device = harness({ onAuthority: () => device.setDevice('device-mobile') });
    expect((await device.controller.start(A)).kind).toBe('stale');
    expect(device.controller.snapshot().kind).toBe('stale');
    expect(await device.repos[0]!.getWorkoutRemoteAuthority()).toBeNull();

    const generation = harness({ onAuthority: async () => {
      const repo = generation.repos[0]!;
      await repo.createGeneration('next-generation', 'test');
      await repo.activateGeneration('next-generation');
    } });
    expect((await generation.controller.start(A)).kind).toBe('stale');
    expect(await generation.repos[0]!.getWorkoutRemoteAuthority()).toBeNull();
  });
});
