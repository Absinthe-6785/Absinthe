import {
  createRoutinePresetState,
  writeRoutinePresetState,
  type RoutinePresetState,
} from '../components/views/features/health/routinePresets';
import { API_URL } from './config';
import {
  HEALTH_ROUTINE_DOMAINS,
  HEALTH_ROUTINE_PRESET_DOMAIN,
  HEALTH_ROUTINE_PROFILE_DOMAIN,
  aggregatesToRoutinePresetState,
  migrateRoutinePresetStateIdentity,
  routinePresetStateToAggregates,
  validateHealthRoutinePresetAggregate,
  validateHealthRoutineProfileAggregate,
  type HealthRoutineAggregateRecord,
  type HealthRoutinePresetAggregate,
  type HealthRoutineProfileAggregate,
} from './healthRoutineAggregate';
import { supabase } from './supabase';
import { canonicalPayloadSnapshot, hashCanonicalPayload } from './localDatabase/canonicalPayload';
import { LocalDatabaseError } from './localDatabase/errors';
import {
  K323_V2_PROVIDER,
  K323V2AmbiguousResponseError,
  createK323V2HttpClient,
  outboxToK323V2Mutation,
  pullResponseToRemoteBatch,
  receiptToOutboxAcknowledgement,
  type K323V2ActiveScope,
  type K323V2Domain,
  type K323V2RemoteChange,
  type K323V2TransportClient,
} from './localDatabase/k323V2Transport';
import {
  closeLocalDatabase,
  createHealthRoutineLocalDatabaseCapability,
  openLocalDatabase,
  type LocalDatabaseRepository,
} from './localDatabase';
import { sha256Hex } from './localDatabase/outboxIdentity';
import type { LocalEntityEnvelope, OutboxRecord } from './localDatabase/types';

export const HEALTH_ROUTINE_DEVICE_ID_KEY = 'absinthe-health-routine-device-id:v1';
export const HEALTH_ROUTINE_PROJECT_REF = 'absinthe-health-routines';
export const HEALTH_ROUTINE_GENERATION_ID = 'health-routine-v1';
export const HEALTH_ROUTINE_WORKER_LEASE = 'health-routine-sync';

const CONFLICT_CODES = new Set([
  'IDEMPOTENCY_CONFLICT', 'MUTATION_ID_CONFLICT', 'REMOTE_ENTITY_ALREADY_EXISTS',
  'REMOTE_ENTITY_NOT_FOUND', 'REMOTE_ENTITY_TOMBSTONED', 'REMOTE_ENTITY_NOT_TOMBSTONED',
  'REMOTE_REVISION_CONFLICT', 'ACTIVE_PRESET_NOT_FOUND',
  'ACTIVE_PRESET_DELETE_REQUIRES_PROFILE_UPDATE',
]);

export interface HealthRoutinePersistence {
  bootstrap(input: {
    accountId: string;
    legacyState: RoutinePresetState;
    hasAccountScopedState: boolean;
  }): Promise<RoutinePresetState>;
  replaceState(accountId: string, previous: RoutinePresetState, next: RoutinePresetState): Promise<RoutinePresetState>;
  sync(accountId: string): Promise<RoutinePresetState | null>;
  reset(accountId: string): Promise<RoutinePresetState>;
  recover(accountId: string, recovered: RoutinePresetState): Promise<RoutinePresetState>;
}

export interface HealthRoutineSyncSessionOptions {
  repository: LocalDatabaseRepository;
  transport: K323V2TransportClient;
  now?: () => string;
  online?: () => boolean;
}

function canonicalEqual(left: unknown, right: unknown): boolean {
  return hashCanonicalPayload(canonicalPayloadSnapshot(left)) === hashCanonicalPayload(canonicalPayloadSnapshot(right));
}

function sameTimestamp(left: string | null, right: string | null): boolean {
  if (left === null || right === null) return left === right;
  return Date.parse(left) === Date.parse(right);
}

function conflictId(parts: readonly unknown[]): string {
  return `conflict.${sha256Hex(JSON.stringify(['absinthe-health-routine-conflict-v1', ...parts])).slice(0, 48)}`;
}

function isHealthDomain(value: string): value is K323V2Domain {
  return (HEALTH_ROUTINE_DOMAINS as readonly string[]).includes(value);
}

function workerId(deviceId: string): string {
  return `health-worker-${deviceId}`;
}

export class HealthRoutineSyncSession {
  readonly repository: LocalDatabaseRepository;
  readonly transport: K323V2TransportClient;
  private readonly now: () => string;
  private readonly online: () => boolean;
  private operation: Promise<unknown> = Promise.resolve();

  constructor(options: HealthRoutineSyncSessionOptions) {
    this.repository = options.repository;
    this.transport = options.transport;
    this.now = options.now ?? (() => new Date().toISOString());
    this.online = options.online ?? (() => typeof navigator === 'undefined' || navigator.onLine !== false);
  }

  private scope(): K323V2ActiveScope {
    return {
      accountId: this.repository.namespace.userId,
      namespaceKey: this.repository.namespaceKey,
      generationId: this.repository.namespace.generationId,
      deviceId: this.repository.namespace.deviceId,
    };
  }

  private serialize<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.operation.then(operation, operation);
    this.operation = result.then(() => undefined, () => undefined);
    return result;
  }

  async initialize(): Promise<void> {
    await this.repository.initializeNamespace();
  }

  private async upsertRecord(
    domain: typeof HEALTH_ROUTINE_PRESET_DOMAIN | typeof HEALTH_ROUTINE_PROFILE_DOMAIN,
    record: HealthRoutineAggregateRecord,
  ): Promise<void> {
    const current = await this.repository.getEntity<HealthRoutineAggregateRecord>(domain, record.id);
    if (!current) {
      await this.repository.createEntity({
        domain, entityId: record.id, record, ownerId: this.repository.namespace.userId,
        source: { kind: 'local', reference: 'health-routine-ui' }, timestamp: this.now(),
      });
      return;
    }
    if (!current.isDeleted && canonicalEqual(current.record, record)) return;
    if (current.isDeleted) {
      await this.repository.restoreEntity({
        domain, entityId: record.id, record, expectedRevision: current.revision,
        ownerId: this.repository.namespace.userId,
        source: { kind: 'local', reference: 'health-routine-restore' }, timestamp: this.now(),
      });
      return;
    }
    await this.repository.updateEntity({
      domain, entityId: record.id, record, expectedRevision: current.revision,
      ownerId: this.repository.namespace.userId,
      source: { kind: 'local', reference: 'health-routine-ui' }, timestamp: this.now(),
    });
  }

  private async tombstonePreset(id: string): Promise<void> {
    const current = await this.repository.getEntity<HealthRoutinePresetAggregate>(HEALTH_ROUTINE_PRESET_DOMAIN, id);
    if (!current || current.isDeleted) return;
    await this.repository.tombstoneEntity(
      HEALTH_ROUTINE_PRESET_DOMAIN, id, current.revision, this.now(),
    );
  }

  private async writeState(previous: RoutinePresetState | null, next: RoutinePresetState): Promise<void> {
    const normalized = migrateRoutinePresetStateIdentity(this.repository.namespace.userId, next);
    const nextDomain = routinePresetStateToAggregates(normalized);
    const previousDomain = previous
      ? routinePresetStateToAggregates(migrateRoutinePresetStateIdentity(this.repository.namespace.userId, previous))
      : null;
    const removed = previousDomain?.presets.filter(
      preset => !nextDomain.presets.some(candidate => candidate.id === preset.id),
    ) ?? [];
    const profileChanged = !previousDomain || !canonicalEqual(previousDomain.profile, nextDomain.profile);

    // A profile fallback is durable before an active preset tombstone is queued.
    if (profileChanged && removed.some(preset => preset.id === previousDomain?.profile.activePresetId)) {
      await this.upsertRecord(HEALTH_ROUTINE_PROFILE_DOMAIN, nextDomain.profile);
    }
    for (const preset of nextDomain.presets) await this.upsertRecord(HEALTH_ROUTINE_PRESET_DOMAIN, preset);
    if (profileChanged && !removed.some(preset => preset.id === previousDomain?.profile.activePresetId)) {
      await this.upsertRecord(HEALTH_ROUTINE_PROFILE_DOMAIN, nextDomain.profile);
    }
    for (const preset of removed) await this.tombstonePreset(preset.id);
  }

  private async readState(): Promise<RoutinePresetState | null> {
    const presetEntities = await this.repository.listEntities<HealthRoutinePresetAggregate>({
      domain: HEALTH_ROUTINE_PRESET_DOMAIN, includeDeleted: false,
    });
    if (presetEntities.length === 0) return null;
    const profileEntity = await this.repository.getEntity<HealthRoutineProfileAggregate>(
      HEALTH_ROUTINE_PROFILE_DOMAIN,
      '00000000-0000-5000-8000-000000000002',
    );
    const presets = presetEntities.map(entity => validateHealthRoutinePresetAggregate(entity.record));
    const profile = profileEntity && !profileEntity.isDeleted
      ? validateHealthRoutineProfileAggregate(profileEntity.record)
      : null;
    return aggregatesToRoutinePresetState(presets, profile);
  }

  private async ensureRemoteGeneration(): Promise<void> {
    const scope = this.scope();
    await this.transport.ensureGeneration({
      protocolVersion: 2,
      ...scope,
      domains: ['health_routine_preset', 'health_routine_profile'],
    });
  }

  private orderedClaims(claims: OutboxRecord[]): OutboxRecord[] {
    const hasPresetDelete = claims.some(item => item.domain === HEALTH_ROUTINE_PRESET_DOMAIN && item.operation === 'tombstone');
    return [...claims].sort((left, right) => {
      if (hasPresetDelete && left.domain !== right.domain) {
        if (left.domain === HEALTH_ROUTINE_PROFILE_DOMAIN) return -1;
        if (right.domain === HEALTH_ROUTINE_PROFILE_DOMAIN) return 1;
      }
      return left.domain.localeCompare(right.domain)
        || left.entityId.localeCompare(right.entityId)
        || left.localRevision - right.localRevision;
    });
  }

  private async pushPending(): Promise<void> {
    const scope = this.scope();
    const owner = workerId(scope.deviceId);
    const lease = await this.repository.acquireWorkerLease({
      leaseName: HEALTH_ROUTINE_WORKER_LEASE, ownerId: owner, now: this.now(), durationMs: 30_000,
    });
    try {
      while (true) {
        const claimed = await this.repository.claimNextMutations({
          workerId: owner, now: this.now(), leaseDurationMs: 30_000, limit: 100, recoverExpiredClaims: true,
        });
        const healthClaims = this.orderedClaims(claimed.filter(item => isHealthDomain(item.domain)));
        if (healthClaims.length === 0) return;
        for (const outbox of healthClaims) {
          try {
            const current = await this.repository.getEntity(outbox.domain, outbox.entityId);
            if (!current) throw new LocalDatabaseError('ENTITY_NOT_FOUND', 'health_routine_push');
            const request = outboxToK323V2Mutation(outbox, {
              ...scope, baseServerRevision: current.serverRevision ?? null,
            });
            const receipt = await this.transport.push(request);
            if (receipt.outcome === 'applied') {
              await this.repository.acknowledgeMutationAndEntity(receiptToOutboxAcknowledgement(
                outbox, receipt, { ...scope, domain: outbox.domain as K323V2Domain }, scope, owner, this.now(),
              ));
            } else if (receipt.errorCode && CONFLICT_CODES.has(receipt.errorCode)) {
              await this.repository.preserveMutationConflict({
                mutationId: outbox.mutationId,
                workerId: owner,
                now: this.now(),
                errorCode: receipt.errorCode,
                conflictId: conflictId([outbox.mutationId, receipt.errorCode]),
                remoteCandidate: receipt,
                remoteMetadata: { outcome: receipt.outcome, domain: receipt.domain },
              });
            } else if (receipt.retryable) {
              await this.repository.releaseClaimForRetry({
                mutationId: outbox.mutationId, workerId: owner, now: this.now(),
                errorCode: receipt.errorCode ?? 'TRANSIENT_SERVER_FAILURE', baseDelayMs: 1_000, maxDelayMs: 60_000,
              });
            } else {
              await this.repository.markPermanentFailure({
                mutationId: outbox.mutationId, workerId: owner, now: this.now(),
                errorCode: receipt.errorCode ?? 'INVALID_SERVER_RESPONSE',
              });
            }
          } catch (error) {
            if (error instanceof K323V2AmbiguousResponseError || error instanceof TypeError) {
              await this.repository.releaseClaimForRetry({
                mutationId: outbox.mutationId, workerId: owner, now: this.now(),
                errorCode: 'AMBIGUOUS_NETWORK_RESPONSE', baseDelayMs: 1_000, maxDelayMs: 60_000,
              });
              return;
            }
            throw error;
          }
        }
      }
    } finally {
      await this.repository.releaseWorkerLease({
        leaseName: HEALTH_ROUTINE_WORKER_LEASE,
        ownerId: owner,
        leaseToken: lease.leaseToken,
        now: this.now(),
      }).catch(() => undefined);
    }
  }

  private async preservePullConflict(
    domain: K323V2Domain,
    current: LocalEntityEnvelope,
    change: K323V2RemoteChange,
    type: string,
  ): Promise<void> {
    const id = conflictId([domain, current.entityId, change.sequence, type]);
    const existing = await this.repository.listConflicts(domain, current.entityId);
    if (existing.some(item => item.conflictId === id)) return;
    await this.repository.recordConflict({
      conflictId: id,
      domain,
      entityId: current.entityId,
      mutationId: current.pendingMutationId ?? null,
      localCandidate: current.record,
      remoteCandidate: change.record,
      remoteMetadata: {
        operation: change.operation,
        isDeleted: change.isDeleted,
        sequence: change.sequence,
        remoteMutationRef: change.remoteMutationRef,
      },
      localRevision: current.revision,
      serverRevision: change.serverRevision,
      conflictType: type,
      now: this.now(),
    });
  }

  private async pullDomain(domain: K323V2Domain): Promise<boolean> {
    const scope = this.scope();
    for (let page = 0; page < 100; page += 1) {
      const checkpoint = await this.repository.getSyncCheckpoint(K323_V2_PROVIDER, domain);
      const cursor = checkpoint?.sequence ?? 0;
      const response = await this.transport.pull({
        protocolVersion: 2,
        namespaceKey: scope.namespaceKey,
        generationId: scope.generationId,
        domain,
        cursor,
        serverEpoch: checkpoint?.serverEpoch ?? null,
        limit: 100,
      });
      if (response.status === 'rejected') return false;
      if (response.status === 'full_resync_required') {
        if (checkpoint) {
          await this.repository.invalidateSyncCheckpoint({
            provider: K323_V2_PROVIDER, stream: domain,
            reason: response.errorCode ?? 'FULL_RESYNC_REQUIRED', now: this.now(),
          });
        }
        return false;
      }
      const currentEntities = new Map((await this.repository.listEntities({ domain, includeDeleted: true }))
        .map(entity => [entity.entityId, entity]));
      for (const change of response.changes) {
        const current = currentEntities.get(change.entityId);
        if (current?.pendingMutationId) {
          await this.preservePullConflict(domain, current, change,
            change.isDeleted ? 'REMOTE_TOMBSTONE_WITH_PENDING_LOCAL' : 'REMOTE_NEWER_WITH_PENDING_LOCAL');
          return false;
        }
        if (current?.serverRevision === change.serverRevision
          && (current.contentHash !== hashCanonicalPayload(canonicalPayloadSnapshot(change.record))
            || current.isDeleted !== change.isDeleted || !sameTimestamp(current.deletedAt, change.deletedAt))) {
          await this.preservePullConflict(domain, current, change, 'SAME_REVISION_CONTENT_MISMATCH');
          return false;
        }
        if (domain === HEALTH_ROUTINE_PROFILE_DOMAIN && !change.isDeleted) {
          const profile = validateHealthRoutineProfileAggregate(change.record);
          if (profile.activePresetId) {
            const preset = await this.repository.getEntity(HEALTH_ROUTINE_PRESET_DOMAIN, profile.activePresetId);
            if (!preset || preset.isDeleted) {
              if (current) await this.preservePullConflict(domain, current, change, 'PROFILE_PRESET_NOT_AVAILABLE');
              return false;
            }
          }
        }
      }
      const mapped = pullResponseToRemoteBatch(response, {
        context: { ...scope, domain, cursor, serverEpoch: checkpoint?.serverEpoch ?? null },
        activeScope: scope,
        currentEntities,
        now: this.now(),
      });
      if (mapped.kind === 'full_resync_required') return false;
      await this.repository.commitRemoteEntityBatch(mapped.batch);
      if (response.changes.length < 100) return true;
    }
    return false;
  }

  private async synchronize(): Promise<void> {
    if (!this.online()) return;
    await this.ensureRemoteGeneration();
    await this.pushPending();
    await this.pullDomain(HEALTH_ROUTINE_PRESET_DOMAIN);
    await this.pullDomain(HEALTH_ROUTINE_PROFILE_DOMAIN);
  }

  bootstrap(input: { legacyState: RoutinePresetState; hasAccountScopedState: boolean }): Promise<RoutinePresetState> {
    return this.serialize(async () => {
      await this.initialize();
      let current = await this.readState();
      if (!current && !input.hasAccountScopedState && this.online()) {
        try {
          await this.ensureRemoteGeneration();
          await this.pullDomain(HEALTH_ROUTINE_PRESET_DOMAIN);
          await this.pullDomain(HEALTH_ROUTINE_PROFILE_DOMAIN);
          current = await this.readState();
        } catch {
          // Offline/unavailable first adoption falls back to durable local
          // adoption. A later pre-existing aggregate becomes explicit conflict
          // evidence instead of silently overriding this working copy.
        }
      }
      if (!current) {
        const migrated = migrateRoutinePresetStateIdentity(this.repository.namespace.userId, input.legacyState);
        await this.writeState(null, migrated);
        current = migrated;
      }
      try { await this.synchronize(); } catch { /* local authority remains usable */ }
      return (await this.readState()) ?? current;
    });
  }

  replaceState(previous: RoutinePresetState, next: RoutinePresetState): Promise<RoutinePresetState> {
    return this.serialize(async () => {
      await this.initialize();
      const migratedPrevious = migrateRoutinePresetStateIdentity(this.repository.namespace.userId, previous);
      const migratedNext = migrateRoutinePresetStateIdentity(this.repository.namespace.userId, next);
      await this.writeState(migratedPrevious, migratedNext);
      try { await this.synchronize(); } catch { /* retry remains durable */ }
      return (await this.readState()) ?? migratedNext;
    });
  }

  sync(): Promise<RoutinePresetState | null> {
    return this.serialize(async () => {
      await this.initialize();
      await this.synchronize();
      return this.readState();
    });
  }

  restorePreset(record: HealthRoutinePresetAggregate): Promise<void> {
    return this.serialize(async () => {
      await this.initialize();
      await this.upsertRecord(HEALTH_ROUTINE_PRESET_DOMAIN, validateHealthRoutinePresetAggregate(record));
      await this.synchronize();
    });
  }

  reset(): Promise<RoutinePresetState> {
    return this.serialize(async () => {
      await this.initialize();
      const previous = await this.readState();
      const empty = createRoutinePresetState({ routines: [], splitCount: 3 });
      await this.writeState(previous, empty);
      try { await this.synchronize(); } catch { /* reset remains durable and retryable */ }
      return (await this.readState()) ?? empty;
    });
  }

  recover(recovered: RoutinePresetState): Promise<RoutinePresetState> {
    return this.serialize(async () => {
      await this.initialize();
      const previous = await this.readState();
      const migrated = migrateRoutinePresetStateIdentity(this.repository.namespace.userId, recovered);
      await this.writeState(previous, migrated);
      try { await this.synchronize(); } catch { /* recovered mutations remain durable */ }
      return (await this.readState()) ?? migrated;
    });
  }

  close(): void {
    closeLocalDatabase(this.repository);
  }
}

function readOrCreateDeviceId(storage: Storage): string {
  const existing = storage.getItem(HEALTH_ROUTINE_DEVICE_ID_KEY);
  if (existing && /^[0-9a-f-]{36}$/i.test(existing)) return existing;
  const created = crypto.randomUUID();
  storage.setItem(HEALTH_ROUTINE_DEVICE_ID_KEY, created);
  return created;
}

const productionSessions = new Map<string, Promise<HealthRoutineSyncSession>>();

async function productionSession(accountId: string): Promise<HealthRoutineSyncSession> {
  let session = productionSessions.get(accountId);
  if (!session) {
    session = (async () => {
      const deviceId = readOrCreateDeviceId(localStorage);
      const repository = await openLocalDatabase({
        userId: accountId,
        projectRef: HEALTH_ROUTINE_PROJECT_REF,
        deviceId,
        generationId: HEALTH_ROUTINE_GENERATION_ID,
        schemaVersion: 1,
      }, { capability: createHealthRoutineLocalDatabaseCapability() });
      const transport = createK323V2HttpClient({
        baseUrl: API_URL,
        getAccessToken: async () => {
          const { data: { session: authSession } } = await supabase.auth.getSession();
          if (!authSession || authSession.user.id !== accountId) throw new Error('health_routine_account_fence');
          return authSession.access_token;
        },
      });
      return new HealthRoutineSyncSession({ repository, transport });
    })();
    productionSessions.set(accountId, session);
  }
  return session;
}

export const productionHealthRoutinePersistence: HealthRoutinePersistence = {
  async bootstrap(input) {
    const session = await productionSession(input.accountId);
    return session.bootstrap({
      legacyState: input.legacyState,
      hasAccountScopedState: input.hasAccountScopedState,
    });
  },
  async replaceState(accountId, previous, next) {
    const session = await productionSession(accountId);
    return session.replaceState(previous, next);
  },
  async sync(accountId) {
    const session = await productionSession(accountId);
    return session.sync();
  },
  async reset(accountId) {
    const session = await productionSession(accountId);
    const state = await session.reset();
    writeRoutinePresetState(localStorage, accountId, state);
    return state;
  },
  async recover(accountId, recovered) {
    const session = await productionSession(accountId);
    const state = await session.recover(recovered);
    writeRoutinePresetState(localStorage, accountId, state);
    return state;
  },
};
