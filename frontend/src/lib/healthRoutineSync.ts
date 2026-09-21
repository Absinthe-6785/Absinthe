import {
  createRoutinePresetState,
  writeRoutinePresetState,
  type RoutinePresetState,
} from '../components/views/features/health/routinePresets';
import { API_URL } from './config';
import {
  DEFAULT_HEALTH_ROUTINE_PRESET_ID,
  HEALTH_ROUTINE_PROFILE_ID,
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
]);

export type HealthRoutineDomainSyncResult =
  | { kind: 'complete'; domain: K323V2Domain; pages: number; cursor: number }
  | { kind: 'offline'; domain: K323V2Domain }
  | { kind: 'conflict'; domain: K323V2Domain; reason: string }
  | { kind: 'full_resync_required'; domain: K323V2Domain; reason: string }
  | { kind: 'rejected'; domain: K323V2Domain; reason: string }
  | { kind: 'incomplete'; domain: K323V2Domain; reason: string }
  | { kind: 'ambiguous'; domain: K323V2Domain; reason: string }
  | { kind: 'transient'; domain: K323V2Domain; reason: string };

type HealthRoutineSynchronizationResult = Readonly<{
  preset: HealthRoutineDomainSyncResult;
  profile: HealthRoutineDomainSyncResult;
}>;

export interface HealthRoutinePersistence {
  bootstrap(input: {
    accountId: string;
    legacyState: RoutinePresetState;
    hasAccountScopedState: boolean;
  }): Promise<RoutinePresetState>;
  commitState(accountId: string, previous: RoutinePresetState, next: RoutinePresetState): Promise<RoutinePresetState>;
  sync(accountId: string): Promise<RoutinePresetState | null>;
  snapshot(accountId: string): Promise<RoutinePresetState | null>;
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
  private localCommitOperation: Promise<unknown> = Promise.resolve();

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

  private serializeLocalCommit<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.localCommitOperation.then(operation, operation);
    this.localCommitOperation = result.then(() => undefined, () => undefined);
    return result;
  }

  async initialize(): Promise<void> {
    await this.repository.initializeNamespace();
  }

  private async upsertRecord(
    domain: typeof HEALTH_ROUTINE_PRESET_DOMAIN | typeof HEALTH_ROUTINE_PROFILE_DOMAIN,
    record: HealthRoutineAggregateRecord,
  ): Promise<string | null> {
    const current = await this.repository.getEntity<HealthRoutineAggregateRecord>(domain, record.id);
    if (!current) {
      const created = await this.repository.createEntity({
        domain, entityId: record.id, record, ownerId: this.repository.namespace.userId,
        source: { kind: 'local', reference: 'health-routine-ui' }, timestamp: this.now(),
      });
      return created.pendingMutationId ?? null;
    }
    if (!current.isDeleted && canonicalEqual(current.record, record)) return current.pendingMutationId ?? null;
    if (current.isDeleted) {
      const restored = await this.repository.restoreEntity({
        domain, entityId: record.id, record, expectedRevision: current.revision,
        ownerId: this.repository.namespace.userId,
        source: { kind: 'local', reference: 'health-routine-restore' }, timestamp: this.now(),
      });
      return restored.pendingMutationId ?? null;
    }
    const updated = await this.repository.updateEntity({
      domain, entityId: record.id, record, expectedRevision: current.revision,
      ownerId: this.repository.namespace.userId,
      source: { kind: 'local', reference: 'health-routine-ui' }, timestamp: this.now(),
    });
    return updated.pendingMutationId ?? null;
  }

  private async tombstonePreset(id: string, dependsOnMutationId: string | null): Promise<void> {
    if (id === DEFAULT_HEALTH_ROUTINE_PRESET_ID) throw new Error('DEFAULT_PRESET_REQUIRED');
    const current = await this.repository.getEntity<HealthRoutinePresetAggregate>(HEALTH_ROUTINE_PRESET_DOMAIN, id);
    if (!current || current.isDeleted) return;
    const timestamp = this.now();
    await this.repository.commitLocalMutation({
      mutation: {
        mode: 'tombstone', domain: HEALTH_ROUTINE_PRESET_DOMAIN, entityId: id,
        record: null, expectedRevision: current.revision, timestamp,
      },
      now: timestamp,
      dependsOnMutationId,
    });
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

    // Every deletion planned with a profile change is durably tied to the exact
    // profile mutation that makes the deletion safe.
    const profileMustPrecedeDeletes = profileChanged && removed.length > 0;
    const profileDependency = profileMustPrecedeDeletes
      ? await this.upsertRecord(HEALTH_ROUTINE_PROFILE_DOMAIN, nextDomain.profile)
      : null;
    for (const preset of nextDomain.presets) await this.upsertRecord(HEALTH_ROUTINE_PRESET_DOMAIN, preset);
    if (profileChanged && !profileMustPrecedeDeletes) {
      await this.upsertRecord(HEALTH_ROUTINE_PROFILE_DOMAIN, nextDomain.profile);
    }
    for (const preset of removed) await this.tombstonePreset(preset.id, profileDependency);
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

  private async reconcileAdoptionState(source: RoutinePresetState): Promise<RoutinePresetState> {
    const migrated = migrateRoutinePresetStateIdentity(this.repository.namespace.userId, source);
    const aggregate = routinePresetStateToAggregates(migrated);
    for (const preset of aggregate.presets) {
      const current = await this.repository.getEntity(HEALTH_ROUTINE_PRESET_DOMAIN, preset.id);
      if (!current) await this.upsertRecord(HEALTH_ROUTINE_PRESET_DOMAIN, preset);
    }
    const profile = await this.repository.getEntity(HEALTH_ROUTINE_PROFILE_DOMAIN, aggregate.profile.id);
    if (!profile) await this.upsertRecord(HEALTH_ROUTINE_PROFILE_DOMAIN, aggregate.profile);
    return migrated;
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

  private async chooseReconciledProfile(
    prerequisite: OutboxRecord,
    remoteProfile: HealthRoutineProfileAggregate,
  ): Promise<HealthRoutineProfileAggregate | null> {
    const dependents = await this.repository.listOutboxDependents(prerequisite.mutationId);
    const deletingPresetIds = new Set(dependents
      .filter(item => item.domain === HEALTH_ROUTINE_PRESET_DOMAIN && item.operation === 'tombstone'
        && item.status !== 'acknowledged' && item.status !== 'superseded')
      .map(item => item.entityId));
    if (deletingPresetIds.size === 0) return null;
    const usable = async (profile: HealthRoutineProfileAggregate): Promise<boolean> => {
      if (profile.activePresetId === null) return true;
      if (deletingPresetIds.has(profile.activePresetId)) return false;
      const preset = await this.repository.getEntity(HEALTH_ROUTINE_PRESET_DOMAIN, profile.activePresetId);
      return preset !== null && !preset.isDeleted;
    };
    if (await usable(remoteProfile)) return remoteProfile;
    if (prerequisite.payload.kind === 'entity_snapshot') {
      try {
        const desired = validateHealthRoutineProfileAggregate(prerequisite.payload.record);
        if (await usable(desired)) return desired;
      } catch { /* corrupted/obsolete intent fails over to the fixed preset */ }
    }
    const fallback = validateHealthRoutineProfileAggregate({
      id: HEALTH_ROUTINE_PROFILE_ID,
      activePresetId: DEFAULT_HEALTH_ROUTINE_PRESET_ID,
    });
    return await usable(fallback) ? fallback : null;
  }

  private async reconcileProfilePrerequisite(input: {
    prerequisite: OutboxRecord;
    remoteProfile: HealthRoutineProfileAggregate;
    remoteServerRevision: number;
    remoteMutationRef: string;
  }): Promise<boolean> {
    if (input.prerequisite.domain !== HEALTH_ROUTINE_PROFILE_DOMAIN
      || input.prerequisite.entityId !== HEALTH_ROUTINE_PROFILE_ID
      || input.prerequisite.status !== 'conflict' && input.prerequisite.status !== 'acknowledged') return false;
    const current = await this.repository.getEntity<HealthRoutineProfileAggregate>(
      HEALTH_ROUTINE_PROFILE_DOMAIN, HEALTH_ROUTINE_PROFILE_ID,
    );
    if (!current || current.isDeleted) return false;
    const corrected = await this.chooseReconciledProfile(input.prerequisite, input.remoteProfile);
    if (!corrected) return false;
    await this.repository.reconcileOutboxPrerequisite({
      prerequisiteMutationId: input.prerequisite.mutationId,
      prerequisiteStatus: input.prerequisite.status,
      expectedEntityRevision: current.revision,
      correctedRecord: corrected,
      remoteRecord: input.remoteProfile,
      remoteServerRevision: input.remoteServerRevision,
      remoteMutationRef: input.remoteMutationRef,
      now: this.now(),
    });
    return true;
  }

  private async reconcileDeliverablePresetDelete(nowValue: string): Promise<boolean> {
    const deliverable = await this.repository.listNextDeliverableMutations({ now: nowValue, limit: 100 });
    const profileEntity = await this.repository.getEntity<HealthRoutineProfileAggregate>(
      HEALTH_ROUTINE_PROFILE_DOMAIN, HEALTH_ROUTINE_PROFILE_ID,
    );
    if (!profileEntity || profileEntity.isDeleted || profileEntity.serverRevision == null
      || !profileEntity.lastRemoteMutationRef) return false;
    const profile = validateHealthRoutineProfileAggregate(profileEntity.record);
    const blockedDelete = deliverable.find(item => item.domain === HEALTH_ROUTINE_PRESET_DOMAIN
      && item.operation === 'tombstone' && item.entityId === profile.activePresetId
      && item.dependsOnMutationId != null);
    if (!blockedDelete?.dependsOnMutationId) return false;
    const prerequisite = await this.repository.getOutboxRecord(blockedDelete.dependsOnMutationId);
    if (!prerequisite || prerequisite.status !== 'acknowledged') return false;
    return this.reconcileProfilePrerequisite({
      prerequisite,
      remoteProfile: profile,
      remoteServerRevision: profileEntity.serverRevision,
      remoteMutationRef: profileEntity.lastRemoteMutationRef,
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
        const timestamp = this.now();
        if (await this.reconcileDeliverablePresetDelete(timestamp)) continue;
        const claimed = await this.repository.claimNextMutations({
          workerId: owner, now: timestamp, leaseDurationMs: 30_000, limit: 100, recoverExpiredClaims: true,
          priorityDomains: [HEALTH_ROUTINE_PROFILE_DOMAIN, HEALTH_ROUTINE_PRESET_DOMAIN],
          priorityTriggerOperation: 'tombstone',
        });
        const healthClaims = this.orderedClaims(claimed.filter(item => isHealthDomain(item.domain)));
        if (healthClaims.length === 0) return;
        const batchHasPresetDelete = healthClaims.some(item => (
          item.domain === HEALTH_ROUTINE_PRESET_DOMAIN && item.operation === 'tombstone'
        ));
        for (const outbox of healthClaims) {
          try {
            const current = await this.repository.getEntity(outbox.domain, outbox.entityId);
            if (!current) throw new LocalDatabaseError('ENTITY_NOT_FOUND', 'health_routine_push');
            if (outbox.domain === HEALTH_ROUTINE_PRESET_DOMAIN && outbox.operation === 'tombstone') {
              const profileEntity = await this.repository.getEntity<HealthRoutineProfileAggregate>(
                HEALTH_ROUTINE_PROFILE_DOMAIN,
                HEALTH_ROUTINE_PROFILE_ID,
              );
              const activePresetId = profileEntity && !profileEntity.isDeleted
                ? validateHealthRoutineProfileAggregate(profileEntity.record).activePresetId
                : null;
              if (activePresetId === outbox.entityId) {
                if (outbox.dependsOnMutationId) {
                  await this.repository.releaseClaimForRetry({
                    mutationId: outbox.mutationId, workerId: owner, now: this.now(),
                    errorCode: 'ACTIVE_PRESET_DELETE_REQUIRES_PROFILE_UPDATE',
                    baseDelayMs: 1_000, maxDelayMs: 60_000,
                  });
                } else {
                  await this.repository.preserveMutationConflict({
                    mutationId: outbox.mutationId, workerId: owner, now: this.now(),
                    errorCode: 'ACTIVE_PRESET_DELETE_REQUIRES_PROFILE_UPDATE',
                    conflictId: conflictId([outbox.mutationId, 'ACTIVE_PRESET_DELETE_REQUIRES_PROFILE_UPDATE']),
                    remoteCandidate: profileEntity?.record ?? null,
                    remoteMetadata: { domain: HEALTH_ROUTINE_PROFILE_DOMAIN, activePresetId },
                  });
                }
                return;
              }
            }
            const request = outboxToK323V2Mutation(outbox, {
              ...scope, baseServerRevision: current.serverRevision ?? null,
            });
            const receipt = await this.transport.push(request);
            if (receipt.outcome === 'applied') {
              await this.repository.acknowledgeMutationAndEntity(receiptToOutboxAcknowledgement(
                outbox, receipt, { ...scope, domain: outbox.domain as K323V2Domain }, scope, owner, this.now(),
              ));
            } else if (receipt.errorCode === 'ACTIVE_PRESET_DELETE_REQUIRES_PROFILE_UPDATE') {
              // A concurrent profile change can invalidate a previously
              // acknowledged prerequisite. Pull/reconcile before trying again.
              await this.repository.releaseClaimForRetry({
                mutationId: outbox.mutationId, workerId: owner, now: this.now(),
                errorCode: receipt.errorCode, baseDelayMs: 1_000, maxDelayMs: 60_000,
              });
              return;
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
            if (batchHasPresetDelete && outbox.domain === HEALTH_ROUTINE_PROFILE_DOMAIN
              && receipt.outcome !== 'applied') return;
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

  private async pullDomain(domain: K323V2Domain): Promise<HealthRoutineDomainSyncResult> {
    const scope = this.scope();
    try {
      for (let page = 0; page < 100; page += 1) {
        if (!this.online()) return { kind: 'offline', domain };
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
        if (response.status === 'rejected') {
          return { kind: 'rejected', domain, reason: response.errorCode ?? 'PULL_REJECTED' };
        }
        if (response.status === 'full_resync_required') {
          if (checkpoint) {
            await this.repository.invalidateSyncCheckpoint({
              provider: K323_V2_PROVIDER, stream: domain,
              reason: response.errorCode ?? 'FULL_RESYNC_REQUIRED', now: this.now(),
            });
          }
          return {
            kind: 'full_resync_required', domain,
            reason: response.errorCode ?? 'FULL_RESYNC_REQUIRED',
          };
        }
        const currentEntities = new Map((await this.repository.listEntities({ domain, includeDeleted: true }))
          .map(entity => [entity.entityId, entity]));
        // The transport mapper commits only the latest change per entity. Use
        // that same authority for conflict reconciliation so a page containing
        // multiple profile revisions cannot create a replacement from an
        // already-stale intermediate revision.
        const latestChanges = new Map<string, K323V2RemoteChange>();
        for (const change of response.changes) latestChanges.set(change.entityId, change);
        for (const change of latestChanges.values()) {
          const current = currentEntities.get(change.entityId);
          if (current?.pendingMutationId) {
            if (domain === HEALTH_ROUTINE_PROFILE_DOMAIN && !change.isDeleted
              && change.remoteMutationRef && change.serverRevision > 0) {
              const prerequisite = await this.repository.getOutboxRecord(current.pendingMutationId);
              const remoteProfile = validateHealthRoutineProfileAggregate(change.record);
              if (prerequisite?.status === 'conflict' && await this.reconcileProfilePrerequisite({
                prerequisite,
                remoteProfile,
                remoteServerRevision: change.serverRevision,
                remoteMutationRef: change.remoteMutationRef,
              })) {
                return { kind: 'conflict', domain, reason: 'PROFILE_CONFLICT_RECONCILED' };
              }
            }
            const reason = change.isDeleted ? 'REMOTE_TOMBSTONE_WITH_PENDING_LOCAL' : 'REMOTE_NEWER_WITH_PENDING_LOCAL';
            await this.preservePullConflict(domain, current, change, reason);
            return { kind: 'conflict', domain, reason };
          }
          if (current?.serverRevision === change.serverRevision
            && (current.contentHash !== hashCanonicalPayload(canonicalPayloadSnapshot(change.record))
              || current.isDeleted !== change.isDeleted || !sameTimestamp(current.deletedAt, change.deletedAt))) {
            await this.preservePullConflict(domain, current, change, 'SAME_REVISION_CONTENT_MISMATCH');
            return { kind: 'conflict', domain, reason: 'SAME_REVISION_CONTENT_MISMATCH' };
          }
          if (domain === HEALTH_ROUTINE_PROFILE_DOMAIN && !change.isDeleted) {
            const profile = validateHealthRoutineProfileAggregate(change.record);
            if (profile.activePresetId) {
              const preset = await this.repository.getEntity(HEALTH_ROUTINE_PRESET_DOMAIN, profile.activePresetId);
              if (!preset || preset.isDeleted) {
                if (preset?.isDeleted && preset.pendingMutationId) {
                  const dependent = await this.repository.getOutboxRecord(preset.pendingMutationId);
                  const prerequisite = dependent?.dependsOnMutationId
                    ? await this.repository.getOutboxRecord(dependent.dependsOnMutationId)
                    : null;
                  if (dependent?.operation === 'tombstone'
                    && (dependent.status === 'pending' || dependent.status === 'retry_wait')
                    && prerequisite?.status === 'acknowledged'
                    && await this.reconcileProfilePrerequisite({
                      prerequisite,
                      remoteProfile: profile,
                      remoteServerRevision: change.serverRevision,
                      remoteMutationRef: change.remoteMutationRef,
                    })) {
                    return { kind: 'conflict', domain, reason: 'PROFILE_DELETE_PREREQUISITE_RECONCILED' };
                  }
                }
                if (current) await this.preservePullConflict(domain, current, change, 'PROFILE_PRESET_NOT_AVAILABLE');
                return { kind: 'conflict', domain, reason: 'PROFILE_PRESET_NOT_AVAILABLE' };
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
        if (mapped.kind === 'full_resync_required') {
          return { kind: 'full_resync_required', domain, reason: mapped.reason };
        }
        await this.repository.commitRemoteEntityBatch(mapped.batch);
        if (response.changes.length < 100) {
          return { kind: 'complete', domain, pages: page + 1, cursor: response.nextCursor };
        }
      }
      return { kind: 'incomplete', domain, reason: 'PAGE_LIMIT_EXCEEDED' };
    } catch (error) {
      if (error instanceof K323V2AmbiguousResponseError) {
        return { kind: 'ambiguous', domain, reason: error.message };
      }
      if (error instanceof TypeError) {
        return { kind: 'transient', domain, reason: error.message };
      }
      throw error;
    }
  }

  private async synchronize(): Promise<HealthRoutineSynchronizationResult> {
    if (!this.online()) {
      return {
        preset: { kind: 'offline', domain: HEALTH_ROUTINE_PRESET_DOMAIN },
        profile: { kind: 'offline', domain: HEALTH_ROUTINE_PROFILE_DOMAIN },
      };
    }
    await this.localCommitOperation;
    await this.ensureRemoteGeneration();
    await this.pushPending();
    const preset = await this.pullDomain(HEALTH_ROUTINE_PRESET_DOMAIN);
    const profile = await this.pullDomain(HEALTH_ROUTINE_PROFILE_DOMAIN);
    return { preset, profile };
  }

  private requireCompleteInventory(result: HealthRoutineSynchronizationResult, stage: string): void {
    for (const domain of [result.preset, result.profile]) {
      if (domain.kind !== 'complete') {
        const reason = 'reason' in domain ? domain.reason : domain.kind;
        throw new Error(`HEALTH_ROUTINE_RESET_INVENTORY_INCOMPLETE:${stage}:${domain.domain}:${domain.kind}:${reason}`);
      }
    }
  }

  bootstrap(input: { legacyState: RoutinePresetState; hasAccountScopedState: boolean }): Promise<RoutinePresetState> {
    return this.serialize(async () => {
      await this.initialize();
      let current = await this.readState();
      if (!input.hasAccountScopedState && this.online()) {
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
      const migrated = await this.reconcileAdoptionState(input.legacyState);
      current = (await this.readState()) ?? migrated;
      try { await this.synchronize(); } catch { /* local authority remains usable */ }
      return (await this.readState()) ?? current;
    });
  }

  commitState(previous: RoutinePresetState, next: RoutinePresetState): Promise<RoutinePresetState> {
    return this.serializeLocalCommit(async () => {
      await this.initialize();
      const migratedPrevious = migrateRoutinePresetStateIdentity(this.repository.namespace.userId, previous);
      const migratedNext = migrateRoutinePresetStateIdentity(this.repository.namespace.userId, next);
      await this.writeState(migratedPrevious, migratedNext);
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

  async snapshot(): Promise<RoutinePresetState | null> {
    await this.localCommitOperation;
    await this.initialize();
    return this.readState();
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
      if (!this.online()) throw new Error('HEALTH_ROUTINE_RESET_REQUIRES_ONLINE');
      const inventory = await this.synchronize();
      this.requireCompleteInventory(inventory, 'before_mutation_planning');
      const previous = await this.readState();
      const empty = createRoutinePresetState({ routines: [], splitCount: 3 });
      await this.writeState(previous, empty);
      const completion = await this.synchronize();
      this.requireCompleteInventory(completion, 'after_mutation_delivery');
      const unsettled = await this.repository.countOutboxByStatus();
      if (unsettled.pending || unsettled.claimed || unsettled.retry_wait
        || unsettled.conflict || unsettled.permanent_failure) {
        throw new Error(`HEALTH_ROUTINE_RESET_INCOMPLETE:${JSON.stringify(unsettled)}`);
      }
      const reset = (await this.readState()) ?? empty;
      if (reset.presets.length !== 1 || reset.presets[0].id !== DEFAULT_HEALTH_ROUTINE_PRESET_ID
        || reset.activePresetId !== DEFAULT_HEALTH_ROUTINE_PRESET_ID) {
        throw new Error('HEALTH_ROUTINE_RESET_INCOMPLETE');
      }
      return reset;
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
  async commitState(accountId, previous, next) {
    const session = await productionSession(accountId);
    return session.commitState(previous, next);
  },
  async sync(accountId) {
    const session = await productionSession(accountId);
    return session.sync();
  },
  async snapshot(accountId) {
    const session = await productionSession(accountId);
    return session.snapshot();
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
