import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_ROUTINE_PRESET_ID,
  createEmptyRoutinePreset,
  createRoutinePresetState,
  updateRoutinePresetState,
  type RoutinePresetState,
} from '../components/views/features/health/routinePresets';
import {
  HEALTH_ROUTINE_PRESET_DOMAIN,
  HEALTH_ROUTINE_PROFILE_DOMAIN,
  routinePresetStateToAggregates,
  type HealthRoutinePresetAggregate,
} from './healthRoutineAggregate';
import {
  HealthRoutineSyncSession,
  type HealthRoutineSyncSessionOptions,
} from './healthRoutineSync';
import {
  K323V2AmbiguousResponseError,
  type K323V2GenerationRequest,
  type K323V2MutationErrorCode,
  type K323V2MutationReceipt,
  type K323V2MutationRequest,
  type K323V2PullRequest,
  type K323V2PullResponse,
  type K323V2RemoteChange,
  type K323V2TransportClient,
} from './localDatabase/k323V2Transport';
import {
  closeLocalDatabase,
  createHealthRoutineLocalDatabaseCapability,
  openLocalDatabase,
  type LocalDatabaseRepository,
} from './localDatabase';

const ACCOUNT = '11111111-1111-4111-8111-111111111111';
const OTHER_ACCOUNT = '22222222-2222-4222-8222-222222222222';
const BLOCK_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const BLOCK_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const PRESET_A = 'aaaaaaaa-0000-4000-8000-000000000001';
const PRESET_B = 'bbbbbbbb-0000-4000-8000-000000000002';
const SERVER_EPOCH = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';

type ServerEntity = {
  record: Record<string, unknown>;
  revision: number;
  deletedAt: string | null;
  remoteMutationRef: string;
};

function clone<T>(value: T): T {
  return structuredClone(value);
}

class FakeHealthRoutineServer {
  private readonly entities = new Map<string, ServerEntity>();
  private readonly receipts = new Map<string, { request: K323V2MutationRequest; receipt: K323V2MutationReceipt }>();
  private readonly changes: Array<K323V2RemoteChange<Record<string, unknown>> & { accountId: string }> = [];
  private sequence = 0;
  private uuidSequence = 1;
  private clock = Date.parse('2026-09-20T00:00:00.000Z');
  failAfterApplyOnce = false;
  legacyDays = new Map<string, Array<{ dayName: string; blocks: string[] }>>();

  private key(accountId: string, domain: string, entityId: string): string {
    return JSON.stringify([accountId, domain, entityId]);
  }

  private uuid(): string {
    const tail = String(this.uuidSequence++).padStart(12, '0');
    return `00000000-0000-4000-8000-${tail}`;
  }

  private now(): string {
    this.clock += 1_000;
    return new Date(this.clock).toISOString();
  }

  private rejected(request: K323V2MutationRequest, errorCode: K323V2MutationErrorCode): K323V2MutationReceipt {
    return {
      protocolVersion: 2,
      outcome: errorCode === 'REMOTE_REVISION_CONFLICT' ? 'revision_conflict' : 'rejected',
      mutationId: request.mutationId,
      idempotencyKey: request.idempotencyKey,
      domain: request.domain,
      entityId: request.entityId,
      operation: request.operation,
      payloadHash: request.payloadHash,
      remoteMutationRef: null,
      serverRevision: null,
      changeSequence: null,
      serverCommittedAt: null,
      errorCode,
      retryable: false,
    };
  }

  private apply(accountId: string, request: K323V2MutationRequest): K323V2MutationReceipt {
    const replay = this.receipts.get(`${accountId}:${request.idempotencyKey}`);
    if (replay) {
      return replay.request.mutationId === request.mutationId
        && replay.request.payloadHash === request.payloadHash
        ? clone(replay.receipt)
        : this.rejected(request, 'IDEMPOTENCY_CONFLICT');
    }
    const key = this.key(accountId, request.domain, request.entityId);
    const current = this.entities.get(key);
    let error: K323V2MutationErrorCode | null = null;
    if (!current) {
      if (request.baseRevision !== null) error = 'REMOTE_ENTITY_NOT_FOUND';
      else if (request.operation !== 'upsert') error = 'REMOTE_ENTITY_NOT_FOUND';
    } else if (request.baseRevision !== current.revision) {
      error = 'REMOTE_REVISION_CONFLICT';
    } else if (request.operation === 'restore' && current.deletedAt === null) {
      error = 'REMOTE_ENTITY_NOT_TOMBSTONED';
    } else if (request.operation !== 'restore' && current.deletedAt !== null) {
      error = 'REMOTE_ENTITY_TOMBSTONED';
    }
    if (request.domain === HEALTH_ROUTINE_PROFILE_DOMAIN && request.operation !== 'upsert') {
      error = 'INVALID_OPERATION';
    }
    if (request.domain === HEALTH_ROUTINE_PRESET_DOMAIN
      && request.entityId === DEFAULT_ROUTINE_PRESET_ID && request.operation === 'tombstone') {
      error = 'DEFAULT_PRESET_REQUIRED';
    }
    const payloadRecord = request.payload.kind === 'entity_snapshot'
      ? clone(request.payload.record as Record<string, unknown>)
      : current?.record;
    if (!error && request.domain === HEALTH_ROUTINE_PROFILE_DOMAIN) {
      const active = payloadRecord?.activePresetId;
      if (typeof active === 'string') {
        const preset = this.entities.get(this.key(accountId, HEALTH_ROUTINE_PRESET_DOMAIN, active));
        if (!preset || preset.deletedAt !== null) error = 'ACTIVE_PRESET_NOT_FOUND';
      }
    }
    if (!error && request.domain === HEALTH_ROUTINE_PRESET_DOMAIN && request.operation === 'tombstone') {
      const profile = [...this.entities.entries()].find(([entryKey]) => (
        entryKey === this.key(accountId, HEALTH_ROUTINE_PROFILE_DOMAIN, '00000000-0000-5000-8000-000000000002')
      ))?.[1];
      if (profile?.record.activePresetId === request.entityId) error = 'ACTIVE_PRESET_DELETE_REQUIRES_PROFILE_UPDATE';
    }
    if (error) {
      const receipt = this.rejected(request, error);
      this.receipts.set(`${accountId}:${request.idempotencyKey}`, { request: clone(request), receipt: clone(receipt) });
      return receipt;
    }

    const revision = (current?.revision ?? 0) + 1;
    const deletedAt = request.operation === 'tombstone'
      ? (request.payload.kind === 'tombstone' ? request.payload.deletedAt : this.now())
      : null;
    const remoteMutationRef = this.uuid();
    const committedAt = this.now();
    const record = clone(payloadRecord ?? {});
    this.entities.set(key, { record, revision, deletedAt, remoteMutationRef });
    this.sequence += 1;
    this.changes.push({
      accountId,
      sequence: this.sequence,
      domain: request.domain,
      entityId: request.entityId,
      operation: request.operation,
      serverRevision: revision,
      record,
      isDeleted: deletedAt !== null,
      deletedAt,
      remoteMutationRef,
      serverCommittedAt: committedAt,
    });
    if (request.domain === HEALTH_ROUTINE_PRESET_DOMAIN) {
      if (record.isDefault === true && deletedAt === null) {
        const days = record.days as Array<{ dayName: string; blocks: string[] }>;
        this.legacyDays.set(accountId, clone(days.map(day => ({ dayName: day.dayName, blocks: day.blocks }))));
      } else if (record.isDefault === true) {
        this.legacyDays.set(accountId, []);
      }
    }
    const receipt: K323V2MutationReceipt = {
      protocolVersion: 2,
      outcome: 'applied',
      mutationId: request.mutationId,
      idempotencyKey: request.idempotencyKey,
      domain: request.domain,
      entityId: request.entityId,
      operation: request.operation,
      payloadHash: request.payloadHash,
      remoteMutationRef,
      serverRevision: revision,
      changeSequence: this.sequence,
      serverCommittedAt: committedAt,
      errorCode: null,
      retryable: false,
    };
    this.receipts.set(`${accountId}:${request.idempotencyKey}`, { request: clone(request), receipt: clone(receipt) });
    return receipt;
  }

  client(accountId: string): K323V2TransportClient {
    return {
      ensureGeneration: async (request: K323V2GenerationRequest) => {
        if (request.accountId !== accountId) throw new Error('UNAUTHORIZED_SCOPE');
        return {
          protocolVersion: 2,
          status: 'active',
          namespaceKey: request.namespaceKey,
          generationId: request.generationId,
          deviceId: request.deviceId,
          serverEpoch: SERVER_EPOCH,
        };
      },
      push: async request => {
        const receipt = this.apply(accountId, request);
        if (this.failAfterApplyOnce && receipt.outcome === 'applied') {
          this.failAfterApplyOnce = false;
          throw new K323V2AmbiguousResponseError(request);
        }
        return clone(receipt);
      },
      pull: async (request: K323V2PullRequest): Promise<K323V2PullResponse> => {
        const changes = this.changes
          .filter(change => change.accountId === accountId && change.domain === request.domain && change.sequence > request.cursor)
          .slice(0, request.limit)
          .map(({ accountId: _accountId, ...change }) => clone(change));
        return {
          protocolVersion: 2,
          status: 'changes',
          domain: request.domain,
          serverEpoch: SERVER_EPOCH,
          retentionFloor: 0,
          nextCursor: changes.at(-1)?.sequence ?? request.cursor,
          changes,
          errorCode: null,
        };
      },
    };
  }

  revision(accountId: string, domain: string, entityId: string): number | null {
    return this.entities.get(this.key(accountId, domain, entityId))?.revision ?? null;
  }

  domainChanges(accountId: string, domain: string): K323V2RemoteChange[] {
    return this.changes.filter(change => change.accountId === accountId && change.domain === domain);
  }

  livePresetIds(accountId: string): string[] {
    return [...this.entities.entries()]
      .filter(([key, value]) => key.startsWith(`[\"${accountId}\",\"${HEALTH_ROUTINE_PRESET_DOMAIN}\"`)
        && value.deletedAt === null)
      .map(([, value]) => value.record.id as string)
      .sort();
  }
}

type Device = {
  repository: LocalDatabaseRepository;
  session: HealthRoutineSyncSession;
  online: { value: boolean };
  clock: { value: number };
};

const openDevices: Device[] = [];

async function openDevice(
  server: FakeHealthRoutineServer,
  factory: IDBFactory,
  deviceId: string,
  accountId = ACCOUNT,
  online = true,
): Promise<Device> {
  const clock = { value: Date.parse('2026-09-20T02:00:00.000Z') };
  const onlineState = { value: online };
  const now = () => new Date(clock.value).toISOString();
  const repository = await openLocalDatabase({
    userId: accountId,
    projectRef: 'absinthe-health-routines',
    deviceId,
    generationId: 'health-routine-v1',
    schemaVersion: 1,
  }, {
    capability: createHealthRoutineLocalDatabaseCapability(),
    indexedDBFactory: factory,
    clock: now,
  });
  const options: HealthRoutineSyncSessionOptions = {
    repository,
    transport: server.client(accountId),
    now,
    online: () => onlineState.value,
  };
  const device = { repository, session: new HealthRoutineSyncSession(options), online: onlineState, clock };
  openDevices.push(device);
  return device;
}

function fourDayState(): RoutinePresetState {
  return createRoutinePresetState({
    splitCount: 4,
    routines: [
      { id: 'legacy-1', day_name: 'Day 1', blocks: [BLOCK_A] },
      { id: 'legacy-2', day_name: 'Day 2', blocks: [BLOCK_B] },
      { id: 'legacy-3', day_name: 'Day 3', blocks: [] },
      { id: 'legacy-4', day_name: 'Day 4', blocks: [BLOCK_A, BLOCK_B] },
    ],
  });
}

afterEach(() => {
  while (openDevices.length) {
    const device = openDevices.pop();
    if (device) closeLocalDatabase(device.repository);
  }
});

describe('REL-05F Health routine aggregate convergence', () => {
  it('converges four-to-three across devices, restart, legacy projection, and ambiguous exact replay', async () => {
    const server = new FakeHealthRoutineServer();
    const factoryA = new IDBFactory();
    const factoryB = new IDBFactory();
    const a = await openDevice(server, factoryA, 'device-a', ACCOUNT, false);
    const initialA = await a.session.bootstrap({ legacyState: fourDayState(), hasAccountScopedState: true });
    a.online.value = true;
    await a.session.sync();

    const b = await openDevice(server, factoryB, 'device-b');
    const initialB = await b.session.bootstrap({
      legacyState: createRoutinePresetState({ routines: [], splitCount: 3 }),
      hasAccountScopedState: false,
    });
    expect(initialB.presets[0].splitCount).toBe(4);

    const three = updateRoutinePresetState(initialA, {
      type: 'set-split', presetId: DEFAULT_ROUTINE_PRESET_ID, splitCount: 3,
    });
    const beforeReplayChanges = server.domainChanges(ACCOUNT, HEALTH_ROUTINE_PRESET_DOMAIN).length;
    server.failAfterApplyOnce = true;
    await a.session.commitState(initialA, three);
    await a.session.sync();
    expect((await a.repository.listOutboxMutations({ limit: 100, status: 'retry_wait' })).length).toBeGreaterThan(0);
    expect(server.domainChanges(ACCOUNT, HEALTH_ROUTINE_PRESET_DOMAIN)).toHaveLength(beforeReplayChanges + 1);

    a.clock.value += 120_000;
    await a.session.sync();
    expect(server.domainChanges(ACCOUNT, HEALTH_ROUTINE_PRESET_DOMAIN)).toHaveLength(beforeReplayChanges + 1);
    const convergedB = await b.session.sync();
    expect(convergedB?.presets[0].days.map(day => day.dayName)).toEqual(['Day 1', 'Day 2', 'Day 3']);
    expect(server.legacyDays.get(ACCOUNT)?.map(day => day.dayName)).toEqual(['Day 1', 'Day 2', 'Day 3']);

    closeLocalDatabase(b.repository);
    openDevices.splice(openDevices.indexOf(b), 1);
    const restartedB = await openDevice(server, factoryB, 'device-b');
    const afterRestart = await restartedB.session.bootstrap({
      legacyState: fourDayState(),
      hasAccountScopedState: true,
    });
    expect(afterRestart.presets[0].splitCount).toBe(3);
    expect(JSON.stringify(afterRestart)).not.toContain('Day 4');
  });

  it('converges multiple stable-ID presets, rename, active profile, delete, and explicit restore', async () => {
    const server = new FakeHealthRoutineServer();
    const a = await openDevice(server, new IDBFactory(), 'device-a');
    let stateA = await a.session.bootstrap({
      legacyState: createRoutinePresetState({ routines: [], splitCount: 3 }), hasAccountScopedState: true,
    });
    const b = await openDevice(server, new IDBFactory(), 'device-b');
    await b.session.bootstrap({
      legacyState: createRoutinePresetState({ routines: [], splitCount: 1 }), hasAccountScopedState: false,
    });

    stateA = updateRoutinePresetState(stateA, {
      type: 'create', preset: createEmptyRoutinePreset(PRESET_A, 'Same name', 4),
    });
    stateA = updateRoutinePresetState(stateA, {
      type: 'create', preset: createEmptyRoutinePreset(PRESET_B, 'Same name', 3),
    });
    stateA = updateRoutinePresetState(stateA, {
      type: 'set-day', presetId: PRESET_B, dayName: 'Day 1', blocks: [BLOCK_B, BLOCK_A],
      plannedSets: { [BLOCK_A]: 4, [BLOCK_B]: 6 },
    });
    const afterCreate = await a.session.commitState(
      createRoutinePresetState({ routines: [], splitCount: 3 }), stateA,
    );
    await a.session.sync();
    let stateB = await b.session.sync();
    expect(stateB?.presets.map(preset => preset.id).sort()).toEqual([
      DEFAULT_ROUTINE_PRESET_ID, PRESET_A, PRESET_B,
    ].sort());
    expect(stateB?.activePresetId).toBe(PRESET_B);
    expect(stateB?.presets.find(preset => preset.id === PRESET_B)?.days[0].blocks).toEqual([BLOCK_B, BLOCK_A]);

    const renamed = updateRoutinePresetState(afterCreate, { type: 'rename', presetId: PRESET_A, name: 'Renamed A' });
    const afterRename = await a.session.commitState(afterCreate, renamed);
    await a.session.sync();
    stateB = await b.session.sync();
    expect(stateB?.presets.find(preset => preset.id === PRESET_A)?.name).toBe('Renamed A');

    const deleted = updateRoutinePresetState(afterRename, { type: 'delete', presetId: PRESET_A });
    await a.session.commitState(afterRename, deleted);
    await a.session.sync();
    stateB = await b.session.sync();
    expect(stateB?.presets.some(preset => preset.id === PRESET_A)).toBe(false);

    const restoredRecord = routinePresetStateToAggregates(afterRename).presets.find(preset => preset.id === PRESET_A)!;
    await a.session.restorePreset(restoredRecord);
    stateB = await b.session.sync();
    expect(stateB?.presets.find(preset => preset.id === PRESET_A)?.name).toBe('Renamed A');
    expect(server.domainChanges(ACCOUNT, HEALTH_ROUTINE_PRESET_DOMAIN).at(-1)?.operation).toBe('restore');
  });

  it('preserves pending local authority and checkpoint when another device wins the server revision', async () => {
    const server = new FakeHealthRoutineServer();
    const a = await openDevice(server, new IDBFactory(), 'device-a');
    const initialA = await a.session.bootstrap({
      legacyState: createRoutinePresetState({ routines: [], splitCount: 3 }), hasAccountScopedState: true,
    });
    const b = await openDevice(server, new IDBFactory(), 'device-b');
    const initialB = await b.session.bootstrap({
      legacyState: createRoutinePresetState({ routines: [], splitCount: 3 }), hasAccountScopedState: false,
    });
    const checkpointBefore = await a.repository.getSyncCheckpoint('k323-v2', HEALTH_ROUTINE_PRESET_DOMAIN);

    a.online.value = false;
    const localPending = updateRoutinePresetState(initialA, {
      type: 'rename', presetId: DEFAULT_ROUTINE_PRESET_ID, name: 'Local pending',
    });
    await a.session.commitState(initialA, localPending);
    const remoteWinner = updateRoutinePresetState(initialB, {
      type: 'rename', presetId: DEFAULT_ROUTINE_PRESET_ID, name: 'Remote winner',
    });
    await b.session.commitState(initialB, remoteWinner);
    await b.session.sync();
    expect((await b.repository.listOutboxMutations({ limit: 100 })).map(item => ({
      status: item.status, domain: item.domain, error: item.lastErrorCode, base: item.baseRevision,
    }))).toEqual(expect.arrayContaining([
      expect.objectContaining({ domain: HEALTH_ROUTINE_PRESET_DOMAIN, status: 'acknowledged' }),
    ]));
    expect(server.revision(ACCOUNT, HEALTH_ROUTINE_PRESET_DOMAIN, DEFAULT_ROUTINE_PRESET_ID)).toBe(2);

    a.online.value = true;
    a.clock.value += 120_000;
    const preserved = await a.session.sync();
    expect(preserved?.presets[0].name).toBe('Local pending');
    expect(await a.repository.listConflicts(HEALTH_ROUTINE_PRESET_DOMAIN, DEFAULT_ROUTINE_PRESET_ID))
      .toEqual(expect.arrayContaining([expect.objectContaining({ conflictType: 'REMOTE_REVISION_CONFLICT' })]));
    expect(await a.repository.getSyncCheckpoint('k323-v2', HEALTH_ROUTINE_PRESET_DOMAIN)).toEqual(checkpointBefore);
    expect((await a.repository.listOutboxMutations({ limit: 100, status: 'conflict' }))).toHaveLength(1);
  });

  it('adopts explicit local three-day state over stale four-day legacy input and reruns idempotently', async () => {
    const server = new FakeHealthRoutineServer();
    server.legacyDays.set(ACCOUNT, clone(fourDayState().presets[0].days));
    const device = await openDevice(server, new IDBFactory(), 'device-a');
    const localThree = updateRoutinePresetState(fourDayState(), {
      type: 'set-split', presetId: DEFAULT_ROUTINE_PRESET_ID, splitCount: 3,
    });
    const adopted = await device.session.bootstrap({ legacyState: localThree, hasAccountScopedState: true });
    expect(adopted.presets[0].splitCount).toBe(3);
    expect(server.legacyDays.get(ACCOUNT)).toHaveLength(3);
    const changes = server.domainChanges(ACCOUNT, HEALTH_ROUTINE_PRESET_DOMAIN).length;
    const rerun = await device.session.bootstrap({ legacyState: fourDayState(), hasAccountScopedState: true });
    expect(rerun.presets[0].splitCount).toBe(3);
    expect(server.domainChanges(ACCOUNT, HEALTH_ROUTINE_PRESET_DOMAIN)).toHaveLength(changes);

    const conflictingDevice = await openDevice(server, new IDBFactory(), 'device-c');
    const explicitDifferent = updateRoutinePresetState(localThree, {
      type: 'rename', presetId: DEFAULT_ROUTINE_PRESET_ID, name: 'Preserve me',
    });
    const preserved = await conflictingDevice.session.bootstrap({
      legacyState: explicitDifferent, hasAccountScopedState: true,
    });
    expect(preserved.presets[0].name).toBe('Preserve me');
    expect((await conflictingDevice.repository.listConflicts(
      HEALTH_ROUTINE_PRESET_DOMAIN, DEFAULT_ROUTINE_PRESET_ID,
    )).length).toBeGreaterThanOrEqual(1);
  });

  it('keeps accounts isolated and reset/recovery become revisioned aggregate mutations', async () => {
    const server = new FakeHealthRoutineServer();
    const a = await openDevice(server, new IDBFactory(), 'device-a');
    let before = createRoutinePresetState({ routines: [], splitCount: 3 });
    before.presets.push(createEmptyRoutinePreset(PRESET_A, 'Recovered', 2));
    before.activePresetId = PRESET_A;
    await a.session.bootstrap({ legacyState: before, hasAccountScopedState: true });

    const other = await openDevice(server, new IDBFactory(), 'device-other', OTHER_ACCOUNT);
    const otherState = await other.session.bootstrap({
      legacyState: createRoutinePresetState({ routines: [], splitCount: 1 }), hasAccountScopedState: false,
    });
    expect(otherState.presets).toHaveLength(1);
    expect(server.revision(OTHER_ACCOUNT, HEALTH_ROUTINE_PRESET_DOMAIN, PRESET_A)).toBeNull();

    const reset = await a.session.reset();
    expect(reset.presets).toHaveLength(1);
    expect(reset.activePresetId).toBe(DEFAULT_ROUTINE_PRESET_ID);
    expect(reset.presets[0].days.every(day => day.blocks.length === 0)).toBe(true);
    const recovered = await a.session.recover(before);
    expect(recovered.presets.find(preset => preset.id === PRESET_A)?.name).toBe('Recovered');
    expect(recovered.activePresetId).toBe(PRESET_A);
    expect(server.domainChanges(ACCOUNT, HEALTH_ROUTINE_PRESET_DOMAIN).some(change => (
      change.entityId === PRESET_A && change.operation === 'tombstone'
    ))).toBe(true);
    expect(server.domainChanges(ACCOUNT, HEALTH_ROUTINE_PRESET_DOMAIN).at(-1)?.operation).toBe('restore');
  });

  it.each([
    ['before first preset', 'before', 0],
    ['after first preset', 'after', 1],
    ['after middle preset', 'after', 2],
    ['after all presets before profile', 'before', 4],
    ['after profile durable commit', 'after', 5],
  ] as const)('reconciles complete adoption after crash %s', async (_label, phase, boundary) => {
    const server = new FakeHealthRoutineServer();
    const factory = new IDBFactory();
    const source = createRoutinePresetState({ routines: [], splitCount: 3 });
    source.presets.push(
      createEmptyRoutinePreset(PRESET_A, 'A', 2),
      createEmptyRoutinePreset(PRESET_B, 'B', 3),
      createEmptyRoutinePreset('cccccccc-0000-4000-8000-000000000003', 'C', 4),
    );
    source.activePresetId = PRESET_B;
    const first = await openDevice(server, factory, 'device-crash', ACCOUNT, false);
    const originalCreate = first.repository.createEntity.bind(first.repository);
    let committed = 0;
    const createSpy = vi.spyOn(first.repository, 'createEntity').mockImplementation(async input => {
      if (phase === 'before' && committed === boundary) throw new Error('synthetic_adoption_crash');
      const result = await originalCreate(input);
      committed += 1;
      if (phase === 'after' && committed === boundary) throw new Error('synthetic_adoption_crash');
      return result;
    });
    await expect(first.session.bootstrap({ legacyState: source, hasAccountScopedState: true }))
      .rejects.toThrow('synthetic_adoption_crash');
    createSpy.mockRestore();
    closeLocalDatabase(first.repository);
    openDevices.splice(openDevices.indexOf(first), 1);

    const restarted = await openDevice(server, factory, 'device-crash', ACCOUNT, false);
    const recovered = await restarted.session.bootstrap({ legacyState: source, hasAccountScopedState: true });
    expect(recovered.presets.map(preset => preset.id).sort()).toEqual(source.presets.map(preset => preset.id).sort());
    expect(recovered.activePresetId).toBe(PRESET_B);
    const outbox = await restarted.repository.listOutboxMutations({ limit: 100 });
    expect(new Set(outbox.map(item => item.mutationId)).size).toBe(outbox.length);
  });

  it('reruns complete durable adoption before compatibility-cache update without new mutations', async () => {
    const server = new FakeHealthRoutineServer();
    const factory = new IDBFactory();
    const source = createRoutinePresetState({ routines: [], splitCount: 3 });
    source.presets.push(createEmptyRoutinePreset(PRESET_A, 'Named', 2));
    source.activePresetId = PRESET_A;
    const first = await openDevice(server, factory, 'device-cache-crash', ACCOUNT, false);
    await first.session.bootstrap({ legacyState: source, hasAccountScopedState: true });
    const before = await first.repository.listOutboxMutations({ limit: 100 });
    closeLocalDatabase(first.repository);
    openDevices.splice(openDevices.indexOf(first), 1);

    const restarted = await openDevice(server, factory, 'device-cache-crash', ACCOUNT, false);
    const recovered = await restarted.session.bootstrap({ legacyState: source, hasAccountScopedState: true });
    const after = await restarted.repository.listOutboxMutations({ limit: 100 });
    expect(recovered.activePresetId).toBe(PRESET_A);
    expect(after.map(item => item.mutationId)).toEqual(before.map(item => item.mutationId));
  });

  it('resets complete canonical authority from a fresh device and other devices converge', async () => {
    const server = new FakeHealthRoutineServer();
    const seed = await openDevice(server, new IDBFactory(), 'device-seed');
    const initial = await seed.session.bootstrap({
      legacyState: createRoutinePresetState({ routines: [], splitCount: 3 }), hasAccountScopedState: true,
    });
    let populated = updateRoutinePresetState(initial, {
      type: 'create', preset: createEmptyRoutinePreset(PRESET_A, 'A', 2),
    });
    populated = updateRoutinePresetState(populated, {
      type: 'create', preset: createEmptyRoutinePreset(PRESET_B, 'B', 4),
    });
    await seed.session.commitState(initial, populated);
    await seed.session.sync();

    const fresh = await openDevice(server, new IDBFactory(), 'device-fresh');
    const reset = await fresh.session.reset();
    expect(reset.presets).toHaveLength(1);
    expect(reset.activePresetId).toBe(DEFAULT_ROUTINE_PRESET_ID);
    expect(server.livePresetIds(ACCOUNT)).toEqual([DEFAULT_ROUTINE_PRESET_ID]);

    const observer = await openDevice(server, new IDBFactory(), 'device-observer');
    const observed = await observer.session.bootstrap({
      legacyState: createRoutinePresetState({ routines: [], splitCount: 3 }), hasAccountScopedState: false,
    });
    expect(observed.presets.map(preset => preset.id)).toEqual([DEFAULT_ROUTINE_PRESET_ID]);
    expect(observed.activePresetId).toBe(DEFAULT_ROUTINE_PRESET_ID);
  });

  it('keeps profile-before-delete ordering beyond the 100-mutation claim boundary', async () => {
    const server = new FakeHealthRoutineServer();
    const factory = new IDBFactory();
    const device = await openDevice(server, factory, 'device-many');
    const initial = await device.session.bootstrap({
      legacyState: createRoutinePresetState({ routines: [], splitCount: 1 }), hasAccountScopedState: true,
    });
    let populated = initial;
    for (let index = 0; index < 105; index += 1) {
      const suffix = index.toString(16).padStart(12, '0');
      populated = updateRoutinePresetState(populated, {
        type: 'create',
        preset: createEmptyRoutinePreset(`aaaaaaaa-aaaa-4aaa-8aaa-${suffix}`, `Preset ${index}`, 1),
      });
    }
    await device.session.commitState(initial, populated);
    await device.session.sync();
    expect(server.livePresetIds(ACCOUNT)).toHaveLength(106);

    const delegate = server.client(ACCOUNT);
    let interruptFirstTombstone = true;
    device.session = new HealthRoutineSyncSession({
      repository: device.repository,
      now: () => new Date(device.clock.value).toISOString(),
      online: () => true,
      transport: {
        ...delegate,
        push: async request => {
          if (interruptFirstTombstone && request.operation === 'tombstone') {
            interruptFirstTombstone = false;
            throw new TypeError('synthetic_network_interruption_before_tombstone');
          }
          return delegate.push(request);
        },
      },
    });
    await expect(device.session.reset()).rejects.toThrow('HEALTH_ROUTINE_RESET_INCOMPLETE');
    expect(server.domainChanges(ACCOUNT, HEALTH_ROUTINE_PROFILE_DOMAIN).at(-1)?.record.activePresetId)
      .toBe(DEFAULT_ROUTINE_PRESET_ID);
    expect(await device.repository.listOutboxMutations({ limit: 500, status: 'retry_wait' }))
      .toHaveLength(1);

    closeLocalDatabase(device.repository);
    openDevices.splice(openDevices.indexOf(device), 1);
    const restarted = await openDevice(server, factory, 'device-many');
    restarted.clock.value += 120_000;
    const reset = await restarted.session.reset();

    expect(reset.presets).toHaveLength(1);
    expect(server.livePresetIds(ACCOUNT)).toEqual([DEFAULT_ROUTINE_PRESET_ID]);
    expect(await restarted.repository.listOutboxMutations({ limit: 500, status: 'conflict' })).toHaveLength(0);
    expect(server.domainChanges(ACCOUNT, HEALTH_ROUTINE_PRESET_DOMAIN)
      .filter(change => change.operation === 'tombstone')).toHaveLength(105);
  });

  it('keeps later durable commits independent from an in-flight network push', async () => {
    const server = new FakeHealthRoutineServer();
    const device = await openDevice(server, new IDBFactory(), 'device-local-first', ACCOUNT, false);
    const initial = await device.session.bootstrap({
      legacyState: createRoutinePresetState({ routines: [], splitCount: 3 }), hasAccountScopedState: true,
    });
    const first = updateRoutinePresetState(initial, {
      type: 'rename', presetId: DEFAULT_ROUTINE_PRESET_ID, name: 'First local commit',
    });
    await device.session.commitState(initial, first);

    const delegate = server.client(ACCOUNT);
    let releasePush: (() => void) | undefined;
    let blockNextPush = true;
    const pushStarted = new Promise<void>(resolve => {
      device.session = new HealthRoutineSyncSession({
        repository: device.repository,
        now: () => new Date(device.clock.value).toISOString(),
        online: () => true,
        transport: {
          ...delegate,
          push: async request => {
            if (blockNextPush) {
              blockNextPush = false;
              resolve();
              await new Promise<void>(release => { releasePush = release; });
            }
            return delegate.push(request);
          },
        },
      });
    });
    const sync = device.session.sync();
    await pushStarted;

    const second = updateRoutinePresetState(first, {
      type: 'rename', presetId: DEFAULT_ROUTINE_PRESET_ID, name: 'Second local commit',
    });
    const committed = await Promise.race([
      device.session.commitState(first, second),
      new Promise<never>((_resolve, reject) => {
        setTimeout(() => reject(new Error('local_commit_waited_for_network')), 250);
      }),
    ]);
    expect(committed.presets[0].name).toBe('Second local commit');

    releasePush?.();
    await sync;
    expect((await device.session.snapshot())?.presets[0].name).toBe('Second local commit');
  });
});
