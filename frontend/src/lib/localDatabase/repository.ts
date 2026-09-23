import { LocalDatabaseError, localDatabaseError } from './errors';
import { transitionActiveGenerationInTransaction } from './activeGenerationTransition';
import {
  getLegacyNotesSourceAuthority as readLegacySourceAuthority,
  registerLegacyNotesSourceAuthority as registerLegacySourceAuthority,
  revokeLegacyNotesSourceAuthority as revokeLegacySourceAuthority,
  type LegacyNotesSourceAuthorityRecordV1, type RegisterLegacyNotesSourceAuthorityInput,
} from './legacyNotesAuthority';
import { namespaceFingerprint, validateNamespace, validateSafeIdentifier } from './namespace';
import { canonicalPayloadJson, canonicalPayloadSnapshot, hashCanonicalPayload } from './canonicalPayload';
import { deriveOutboxIdempotencyKey, deriveOutboxMutationId, generateOutboxMutationId, sha256Hex } from './outboxIdentity';
import {
  acknowledgeOutboxRecord, adoptConflictedOutboxSuccessor, claimOutboxRecord, conflictOutboxRecord, permanentlyFailOutboxRecord,
  replaceConflictedOutboxRecord, replaceRejectedDependentOutboxRecord,
  scheduleOutboxRetry, supersedeOutboxRecord,
} from './outboxStateMachine';
import { assertLocalDatabaseVersion, createLocalDatabaseSchema, LOCAL_DATABASE_STORES } from './schema';
import {
  cancelLegacyNotesMigration as cancelLegacyMigration,
  captureLegacyNotesMigration as captureLegacyMigration,
  getLegacyNotesMigrationSessionForAdministration as readLegacyMigrationForAdministration,
  getLegacyNotesMigrationSession as readLegacyMigration,
  resumeLegacyNotesMigration as resumeLegacyMigration,
  verifyLegacyNotesMigration as verifyLegacyMigration,
  type LegacyMigrationResultV1, type LegacyNotesMigrationAdministrativeView,
  type LegacyNotesMigrationOptions, type LegacyNotesMigrationSessionV1,
  type LegacyNotesMigrationRuntime, type LegacyNotesSourceAdapter,
} from './legacyNotesMigration';
import {
  activateLocalFirstCutover as activateCutover,
  cancelLocalFirstCutover as cancelCutover,
  confirmLocalFirstCutover as confirmCutover,
  createLocalFirstCutoverAuthorization as createCutoverAuthorization,
  getLocalFirstCutoverSession as readCutoverSession,
  getLocalFirstRuntimeMode as readCutoverRuntimeMode,
  planLocalFirstCutover as planCutover,
  preflightLocalFirstCutover as preflightCutover,
  recoverFailedPrecommitCutoverFence as recoverCutoverFence,
  resumeLocalFirstCutover as resumeCutover,
  type ActivateLocalFirstCutoverOptions, type LocalFirstCutoverResult,
  type LocalFirstCutoverSessionV1, type LocalFirstRuntimeModeRecordV1,
  type FailedPrecommitFenceRecoveryFailurePoint, type PlanLocalFirstCutoverOptions,
} from './localFirstCutover';
import type { RecoveryCutoverAuthorization } from '../recoverySafetyPolicy';
import { assessWorkoutAdoptionItem, compareWorkoutAdoptionKeys, historicalExerciseEvidence } from '../workoutAdoption/source';
import {
  WORKOUT_ADOPTION_ADAPTER, WORKOUT_ADOPTION_CONVERSION_VERSION,
  type WorkoutAdoptionClassification, type WorkoutAdoptionItem, type WorkoutAdoptionSession,
  type WorkoutAdoptionSnapshot,
} from '../workoutAdoption/types';
import { validateWorkoutSessionV1, type WorkoutSessionV1 } from '../workoutSessionV1';
import {
  cancelRestoreSession as cancelRestore, getRestoreSession as readRestoreSession,
  restorePackageAtomically as executeRestore, type RestoreOptions, type RestoreResult,
} from './restore';
import {
  LOCAL_DATABASE_NAME, LOCAL_DATABASE_VERSION, LOCAL_SCHEMA_VERSION,
  type AcknowledgeOutboxInput, type AdvanceCheckpointInput, type AttachmentStateRecord, type ClaimOutboxInput,
  type CommitRemoteConvergenceBatchInput, type CommittedRemoteConvergenceBatch,
  type CommitRemoteEntityBatchInput, type CommittedRemoteEntityBatch,
  type CommitLocalMutationInput, type CommittedLocalMutation, type DatabaseMetaRecord, type EntityListOptions,
  type EntityCreateInput, type EntityRestoreInput, type EntityUpdateInput, type FailOutboxInput, type GenerationReason,
  type InvalidateCheckpointInput,
  type GenerationRecord, type GenerationStatus, type LocalDatabaseNamespace,
  type LocalEntityEnvelope, type MigrationStateRecord, type OutboxRecord,
  type ReconcileOutboxPrerequisiteInput, type ReconciledOutboxPrerequisite,
  type RecordConflictInput, type ResolveConflictInput, type OutboxOperation,
  type OutboxListInput, type OutboxStatus, type OutboxStatusCounts, type ResetOutboxInput,
  type RestoreSessionRecord, type RetryOutboxInput, type SafeSourceReference, type SyncCheckpointRecord,
  type ReleaseWorkerLeaseInput, type RenewWorkerLeaseInput,
  type SyncConflictRecord, type SyncWorkerLeaseRecord, type WorkerLeaseInput,
} from './types';
import {
  validTimestamp, validateAttachmentState, validateCheckpoint, validateDatabaseMeta, validateEntityEnvelope,
  validateConflictRecord, validateGenerationRecord, validateMigrationState, validateOutboxRecord,
  validateRestoreSequenceBoundaryGraph, validateRestoreSession, validateSafeSource, validateWorkerLease,
} from './validation';

const capabilityMarker = Symbol('absinthe-local-v2-capability');
const HEALTH_PROFILE_RECONCILIATION_DOMAIN = 'health_routine_profile';
const HEALTH_PROFILE_RECONCILIATION_ENTITY_ID = '00000000-0000-5000-8000-000000000002';
export interface LocalDatabaseCapability { readonly marker: symbol; readonly purpose: 'test' | 'developer' | 'health_routine' }

export function createDormantLocalDatabaseCapability(purpose: 'test' | 'developer'): LocalDatabaseCapability {
  return Object.freeze({ marker: capabilityMarker, purpose });
}

/** The only production activation capability introduced by REL-05F. */
export function createHealthRoutineLocalDatabaseCapability(): LocalDatabaseCapability {
  return Object.freeze({ marker: capabilityMarker, purpose: 'health_routine' });
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new DOMException('Request failed', 'UnknownError'));
  });
}

function transactionCompletion(transaction: IDBTransaction, operation: string): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(new LocalDatabaseError('TRANSACTION_ABORTED', operation));
    transaction.onerror = () => { /* onabort supplies the stable error */ };
  });
}

function abortQuietly(transaction: IDBTransaction): void {
  try { transaction.abort(); } catch { /* already inactive */ }
}

function now(value?: string): string {
  const timestamp = value ?? new Date().toISOString();
  if (!validTimestamp(timestamp)) throw new LocalDatabaseError('INVALID_ENTITY', 'timestamp');
  return timestamp;
}

function generationKey(namespaceKey: string, generationId: string): [string, string] {
  return [namespaceKey, generationId];
}

function entityKey(namespaceKey: string, generationId: string, domain: string, entityId: string): [string, string, string, string] {
  return [namespaceKey, generationId, domain, entityId];
}

function checkpointKey(namespaceKey: string, generationId: string, provider: string, stream: string): [string, string, string, string] {
  return [namespaceKey, generationId, provider, stream];
}

function conflictKey(namespaceKey: string, generationId: string, conflictId: string): [string, string, string] {
  return [namespaceKey, generationId, conflictId];
}

function workerLeaseKey(namespaceKey: string, generationId: string, leaseName: string): [string, string, string] {
  return [namespaceKey, generationId, leaseName];
}

function snapshotRemoteEntityEnvelope<T>(source: LocalEntityEnvelope<T>): LocalEntityEnvelope<T> {
  const restore = source.restoreProvenance;
  const migration = source.migrationProvenance;
  return {
    namespaceKey: source.namespaceKey,
    generationId: source.generationId,
    accountId: source.accountId,
    domain: source.domain,
    entityId: source.entityId,
    record: canonicalPayloadSnapshot(source.record),
    revision: source.revision,
    localRevision: source.localRevision,
    serverRevision: source.serverRevision,
    createdAt: source.createdAt,
    updatedAt: source.updatedAt,
    deletedAt: source.deletedAt,
    isDeleted: source.isDeleted,
    deletionState: source.deletionState,
    ownerId: source.ownerId,
    contentHash: source.contentHash,
    pendingMutationId: source.pendingMutationId,
    lastRemoteMutationRef: source.lastRemoteMutationRef,
    source: source.source == null ? source.source : { kind: source.source.kind, reference: source.source.reference },
    restoreProvenance: restore == null ? restore : {
      packageId: restore.packageId,
      restoreSessionId: restore.restoreSessionId,
      classification: restore.classification,
      sourceRevision: restore.sourceRevision,
      sourceUpdatedAt: restore.sourceUpdatedAt,
      sourceDeletedAt: restore.sourceDeletedAt,
      expectedLocalRevision: restore.expectedLocalRevision,
      restoredAt: restore.restoredAt,
      mutationId: restore.mutationId,
      resurrection: restore.resurrection == null ? restore.resurrection : {
        restoresEntityId: restore.resurrection.restoresEntityId,
        sourcePackageId: restore.resurrection.sourcePackageId,
        sourceRestoreSessionId: restore.resurrection.sourceRestoreSessionId,
        supersedesTombstoneRevision: restore.resurrection.supersedesTombstoneRevision,
        restoredAt: restore.resurrection.restoredAt,
      },
    },
    migrationProvenance: migration == null ? migration : {
      conversionVersion: migration.conversionVersion,
      sourceAdapter: migration.sourceAdapter,
      sourceSchemaVersion: migration.sourceSchemaVersion,
      migrationSessionId: migration.migrationSessionId,
      sourceSnapshotDigest: migration.sourceSnapshotDigest,
      migratedAt: migration.migratedAt,
      legacyKeyDigest: migration.legacyKeyDigest,
    },
  };
}

function snapshotRemoteEntityBatchInput<T>(input: CommitRemoteEntityBatchInput<T>): CommitRemoteEntityBatchInput<T> {
  if (!Array.isArray(input.entities)) throw new LocalDatabaseError('INVALID_RESERVED_RECORD', 'commit_remote_entity_batch');
  return {
    namespaceKey: input.namespaceKey,
    generationId: input.generationId,
    accountId: input.accountId,
    domain: input.domain,
    provider: input.provider,
    checkpointValue: input.checkpointValue,
    sequence: input.sequence,
    serverEpoch: input.serverEpoch,
    now: input.now,
    entities: input.entities.map(item => ({
      expectedLocalRevision: item.expectedLocalRevision,
      entity: snapshotRemoteEntityEnvelope(item.entity),
    })),
    testOnlyAbortAt: input.testOnlyAbortAt,
  };
}

function snapshotRemoteConvergenceBatchInput<T>(
  input: CommitRemoteConvergenceBatchInput<T>,
): CommitRemoteConvergenceBatchInput<T> {
  if (!Array.isArray(input.changes)) {
    throw new LocalDatabaseError('INVALID_RESERVED_RECORD', 'commit_remote_convergence_batch');
  }
  return {
    namespaceKey: input.namespaceKey,
    generationId: input.generationId,
    accountId: input.accountId,
    domain: input.domain,
    provider: input.provider,
    checkpointValue: input.checkpointValue,
    sequence: input.sequence,
    serverEpoch: input.serverEpoch,
    now: input.now,
    changes: input.changes.map(item => ({
      expectedLocalRevision: item.expectedLocalRevision,
      candidate: {
        entityId: item.candidate.entityId,
        record: canonicalPayloadSnapshot(item.candidate.record),
        serverRevision: item.candidate.serverRevision,
        remoteMutationRef: item.candidate.remoteMutationRef,
        createdAt: item.candidate.createdAt,
        updatedAt: item.candidate.updatedAt,
        deletedAt: item.candidate.deletedAt,
        ...(item.candidate.ownerId === undefined ? {} : { ownerId: item.candidate.ownerId }),
        ...(item.candidate.source === undefined ? {} : {
          source: item.candidate.source === null ? null : { ...item.candidate.source },
        }),
      },
    })),
    testOnlyAbortAt: input.testOnlyAbortAt,
  };
}

interface ConnectionState { closed: boolean; stale: boolean }
const MAX_OUTBOX_SCAN = 10_000;
const MAX_REMOTE_ENTITY_BATCH = 1_000;

export class LocalDatabaseRepository {
  readonly namespace: LocalDatabaseNamespace;
  readonly namespaceKey: string;
  private readonly db: IDBDatabase;
  private readonly state: ConnectionState;
  private readonly mutationIdFactory: () => string;
  private readonly clock: () => string;

  constructor(db: IDBDatabase, namespace: LocalDatabaseNamespace, namespaceKey: string, state: ConnectionState,
    mutationIdFactory: () => string, clock: () => string) {
    this.db = db; this.namespace = Object.freeze({ ...namespace }); this.namespaceKey = namespaceKey; this.state = state;
    this.mutationIdFactory = mutationIdFactory; this.clock = clock;
  }

  private assertOpen(operation: string): void {
    if (this.state.stale) throw new LocalDatabaseError('STALE_CONNECTION', operation);
    if (this.state.closed) throw new LocalDatabaseError('DATABASE_CLOSED', operation);
  }

  private legacyMigrationRuntime(): LegacyNotesMigrationRuntime {
    return {
      db: this.db, namespace: this.namespace, namespaceKey: this.namespaceKey, clock: this.clock,
      assertOpen: operation => this.assertOpen(operation),
    };
  }

  close(): void {
    if (!this.state.closed) this.db.close();
    this.state.closed = true;
  }

  async initializeNamespace(): Promise<DatabaseMetaRecord> {
    this.assertOpen('initialize_namespace');
    const transaction = this.db.transaction([LOCAL_DATABASE_STORES.databaseMeta, LOCAL_DATABASE_STORES.generations], 'readwrite');
    const done = transactionCompletion(transaction, 'initialize_namespace');
    try {
      const metaStore = transaction.objectStore(LOCAL_DATABASE_STORES.databaseMeta);
      const generationStore = transaction.objectStore(LOCAL_DATABASE_STORES.generations);
      const existing = await requestResult(metaStore.get(this.namespaceKey)) as DatabaseMetaRecord | undefined;
      if (existing) {
        validateDatabaseMeta(existing, this.namespaceKey, this.namespace.schemaVersion);
        if (existing.activeGenerationId !== this.namespace.generationId) {
          throw new LocalDatabaseError('STALE_GENERATION', 'initialize_namespace');
        }
        await done;
        return existing;
      }
      const timestamp = now();
      const meta: DatabaseMetaRecord = {
        namespaceKey: this.namespaceKey, databaseFormatVersion: LOCAL_DATABASE_VERSION,
        namespaceFingerprint: this.namespaceKey, activeGenerationId: this.namespace.generationId,
        createdAt: timestamp, minimumCompatibleSchemaVersion: LOCAL_SCHEMA_VERSION,
        recoveryCompatible: true, migrationStatePointer: null, schemaVersion: this.namespace.schemaVersion,
      };
      const generation: GenerationRecord = {
        namespaceKey: this.namespaceKey, generationId: this.namespace.generationId, status: 'active',
        createdAt: timestamp, activatedAt: timestamp, predecessorGenerationId: null,
        creationReason: 'initial', schemaVersion: this.namespace.schemaVersion,
        validationState: 'valid', safeSourceReference: null, activeNamespaceKey: this.namespaceKey,
      };
      metaStore.add(meta); generationStore.add(generation);
      await done;
      return meta;
    } catch (error) {
      abortQuietly(transaction); await done.catch(() => undefined); throw localDatabaseError(error, 'initialize_namespace');
    }
  }

  async readDatabaseMetadata(): Promise<DatabaseMetaRecord> {
    this.assertOpen('read_metadata');
    const transaction = this.db.transaction(LOCAL_DATABASE_STORES.databaseMeta, 'readonly');
    const done = transactionCompletion(transaction, 'read_metadata');
    const value = await requestResult(transaction.objectStore(LOCAL_DATABASE_STORES.databaseMeta).get(this.namespaceKey)) as DatabaseMetaRecord | undefined;
    await done;
    if (!value) throw new LocalDatabaseError('MALFORMED_METADATA', 'read_metadata');
    validateDatabaseMeta(value, this.namespaceKey, this.namespace.schemaVersion);
    return value;
  }

  async createGeneration(generationId: string, creationReason: GenerationReason, source: SafeSourceReference | null = null): Promise<GenerationRecord> {
    this.assertOpen('create_generation'); validateSafeIdentifier(generationId, 'create_generation'); validateSafeSource(source);
    const transaction = this.db.transaction([LOCAL_DATABASE_STORES.databaseMeta, LOCAL_DATABASE_STORES.generations], 'readwrite');
    const done = transactionCompletion(transaction, 'create_generation');
    const record: GenerationRecord = {
      namespaceKey: this.namespaceKey, generationId, status: 'preparing', createdAt: now(), activatedAt: null,
      predecessorGenerationId: this.namespace.generationId, creationReason,
      schemaVersion: this.namespace.schemaVersion, validationState: 'pending', safeSourceReference: source,
    };
    try {
      await this.ensureActive(transaction);
      transaction.objectStore(LOCAL_DATABASE_STORES.generations).add(record); await done; return record;
    }
    catch (error) { abortQuietly(transaction); await done.catch(() => undefined); throw localDatabaseError(error, 'create_generation'); }
  }

  async getGeneration(generationId: string): Promise<GenerationRecord | null> {
    this.assertOpen('get_generation'); validateSafeIdentifier(generationId, 'get_generation');
    const transaction = this.db.transaction(LOCAL_DATABASE_STORES.generations, 'readonly');
    const done = transactionCompletion(transaction, 'get_generation');
    const value = await requestResult(transaction.objectStore(LOCAL_DATABASE_STORES.generations).get(generationKey(this.namespaceKey, generationId))) as GenerationRecord | undefined;
    await done;
    if (value) validateGenerationRecord(value, this.namespaceKey, this.namespace.schemaVersion);
    return value ?? null;
  }

  async getActiveGeneration(): Promise<GenerationRecord> {
    const meta = await this.readDatabaseMetadata();
    const generation = await this.getGeneration(meta.activeGenerationId);
    if (!generation || generation.status !== 'active') throw new LocalDatabaseError('MALFORMED_METADATA', 'get_active_generation');
    return generation;
  }

  async setGenerationStatus(generationId: string, status: Exclude<GenerationStatus, 'active'>): Promise<GenerationRecord> {
    this.assertOpen('set_generation_status'); validateSafeIdentifier(generationId, 'set_generation_status');
    const transaction = this.db.transaction([LOCAL_DATABASE_STORES.databaseMeta, LOCAL_DATABASE_STORES.generations], 'readwrite');
    const done = transactionCompletion(transaction, 'set_generation_status');
    try {
      const meta = await requestResult(transaction.objectStore(LOCAL_DATABASE_STORES.databaseMeta).get(this.namespaceKey)) as DatabaseMetaRecord | undefined;
      if (!meta) throw new LocalDatabaseError('MALFORMED_METADATA', 'set_generation_status');
      validateDatabaseMeta(meta, this.namespaceKey, this.namespace.schemaVersion);
      if (meta.activeGenerationId === generationId) throw new LocalDatabaseError('INVALID_GENERATION_TRANSITION', 'set_generation_status');
      const store = transaction.objectStore(LOCAL_DATABASE_STORES.generations);
      const generation = await requestResult(store.get(generationKey(this.namespaceKey, generationId))) as GenerationRecord | undefined;
      if (!generation) throw new LocalDatabaseError('GENERATION_NOT_FOUND', 'set_generation_status');
      validateGenerationRecord(generation, this.namespaceKey, this.namespace.schemaVersion);
      const updated = { ...generation, status, activeNamespaceKey: undefined };
      store.put(updated); await done; return updated;
    } catch (error) { abortQuietly(transaction); await done.catch(() => undefined); throw localDatabaseError(error, 'set_generation_status'); }
  }

  async activateGeneration(generationId: string): Promise<GenerationRecord> {
    this.assertOpen('activate_generation'); validateSafeIdentifier(generationId, 'activate_generation');
    const transaction = this.db.transaction([
      LOCAL_DATABASE_STORES.databaseMeta, LOCAL_DATABASE_STORES.generations, LOCAL_DATABASE_STORES.migrationState,
    ], 'readwrite');
    const done = transactionCompletion(transaction, 'activate_generation');
    try {
      const timestamp = now();
      const result = await transitionActiveGenerationInTransaction({
        transaction,
        runtime: { namespaceKey: this.namespaceKey, namespace: this.namespace },
        kind: 'generic',
        expectedActiveGenerationId: this.namespace.generationId,
        targetGenerationId: generationId,
        activatedAt: timestamp,
      });
      await done; return result.active;
    } catch (error) { abortQuietly(transaction); await done.catch(() => undefined); throw localDatabaseError(error, 'activate_generation'); }
  }

  private async ensureActive(transaction: IDBTransaction): Promise<{ meta: DatabaseMetaRecord; generation: GenerationRecord }> {
    const meta = await requestResult(transaction.objectStore(LOCAL_DATABASE_STORES.databaseMeta).get(this.namespaceKey)) as DatabaseMetaRecord | undefined;
    if (!meta || meta.namespaceFingerprint !== this.namespaceKey) throw new LocalDatabaseError('NAMESPACE_MISMATCH', 'generation_fence');
    validateDatabaseMeta(meta, this.namespaceKey, this.namespace.schemaVersion);
    if (meta.activeGenerationId !== this.namespace.generationId) throw new LocalDatabaseError('STALE_GENERATION', 'generation_fence');
    const generation = await requestResult(transaction.objectStore(LOCAL_DATABASE_STORES.generations).get(generationKey(this.namespaceKey, this.namespace.generationId))) as GenerationRecord | undefined;
    if (!generation || generation.status !== 'active') throw new LocalDatabaseError('GENERATION_NOT_ACTIVE', 'generation_fence');
    validateGenerationRecord(generation, this.namespaceKey, this.namespace.schemaVersion);
    return { meta, generation };
  }

  private validatePersistedEntity<T>(value: LocalEntityEnvelope<T>, operation: string): void {
    try {
      validateEntityEnvelope(value);
      if (value.namespaceKey !== this.namespaceKey || value.generationId !== this.namespace.generationId
        || value.accountId !== undefined && value.accountId !== this.namespace.userId) throw new Error('scope');
    } catch {
      throw new LocalDatabaseError('CORRUPT_PERSISTED_RECORD', operation);
    }
  }

  private validatePersistedOutbox(value: OutboxRecord, operation: string): void {
    try {
      validateOutboxRecord(value);
      if (value.namespaceKey !== this.namespaceKey || value.generationId !== this.namespace.generationId
        || value.accountId !== undefined && value.accountId !== this.namespace.userId
        || value.deviceId !== undefined && value.deviceId !== this.namespace.deviceId) throw new Error('scope');
    } catch {
      throw new LocalDatabaseError('CORRUPT_PERSISTED_RECORD', operation);
    }
  }

  async commitLocalMutation<T>(input: CommitLocalMutationInput<T>): Promise<CommittedLocalMutation<T>> {
    this.assertOpen('commit_local_mutation');
    const { mutation } = input;
    if (!['create', 'update', 'tombstone', 'restore'].includes(mutation.mode)) {
      throw new LocalDatabaseError('INVALID_ENTITY', 'commit_local_mutation');
    }
    validateSafeIdentifier(mutation.domain, 'commit_local_mutation');
    if (mutation.domain === 'health_workout_session'
      ? input.deliveryBinding?.version !== 1 || input.deliveryBinding.state !== 'unbound'
      : input.deliveryBinding !== undefined) {
      throw new LocalDatabaseError('INVALID_OUTBOX', 'commit_local_mutation');
    }
    if (typeof mutation.entityId !== 'string' || mutation.entityId.length === 0 || mutation.entityId.length > 512) {
      throw new LocalDatabaseError('INVALID_ENTITY', 'commit_local_mutation');
    }
    if (mutation.mode !== 'tombstone') validateSafeSource(mutation.source);
    if (input.dependsOnMutationId != null) {
      validateSafeIdentifier(input.dependsOnMutationId, 'commit_local_mutation');
      if (mutation.mode !== 'tombstone') throw new LocalDatabaseError('INVALID_OUTBOX', 'commit_local_mutation');
    }
    const timestamp = now(input.now);
    const operation: OutboxOperation = mutation.mode === 'tombstone' ? 'tombstone' : mutation.mode === 'restore' ? 'restore' : 'upsert';
    if (mutation.mode !== 'create' && mutation.expectedRevision === undefined) {
      throw new LocalDatabaseError('EXPECTED_REVISION_REQUIRED', 'commit_local_mutation');
    }
    const proposedRevision = mutation.mode === 'create' ? 1 : mutation.expectedRevision + 1;
    if (!Number.isSafeInteger(proposedRevision) || proposedRevision < 1) {
      throw new LocalDatabaseError('INVALID_ENTITY', 'commit_local_mutation');
    }
    const inputSnapshot = mutation.mode === 'tombstone' ? null : canonicalPayloadSnapshot(mutation.record);
    const stores: string[] = [LOCAL_DATABASE_STORES.databaseMeta, LOCAL_DATABASE_STORES.generations,
      LOCAL_DATABASE_STORES.entities, LOCAL_DATABASE_STORES.outbox, LOCAL_DATABASE_STORES.restoreSessions];
    const transaction = this.db.transaction(stores, 'readwrite');
    const done = transactionCompletion(transaction, 'commit_local_mutation');
    try {
      await this.ensureActive(transaction);
      if (input.testOnlyAbortAt === 'before_entity') throw new LocalDatabaseError('INVALID_ENTITY', 'commit_local_mutation');
      const entityStore = transaction.objectStore(LOCAL_DATABASE_STORES.entities);
      const key = entityKey(this.namespaceKey, this.namespace.generationId, mutation.domain, mutation.entityId);
      const current = await requestResult(entityStore.get(key)) as LocalEntityEnvelope<T> | undefined;
      if (current) this.validatePersistedEntity(current, 'commit_local_mutation');
      const actualRevision = current?.revision ?? 0;
      const outboxStore = transaction.objectStore(LOCAL_DATABASE_STORES.outbox);
      const priorOutbox = current ? await requestResult(
        outboxStore
          .index('by_namespace_generation_entity')
          .getAll(IDBKeyRange.only([
            this.namespaceKey, this.namespace.generationId, mutation.domain, mutation.entityId,
          ])),
      ) as OutboxRecord[] : [];
      await this.validateRestoreBoundaryGraphs(transaction, priorOutbox);
      if (mutation.mode === 'create') {
        if (current?.deletedAt) throw new LocalDatabaseError('TOMBSTONE_REACTIVATION_BLOCKED', 'commit_local_mutation');
        if (current) throw new LocalDatabaseError('ENTITY_ALREADY_EXISTS', 'commit_local_mutation');
      } else if (mutation.mode === 'restore') {
        if (mutation.expectedRevision === undefined) throw new LocalDatabaseError('EXPECTED_REVISION_REQUIRED', 'commit_local_mutation');
        if (!current) throw new LocalDatabaseError('ENTITY_NOT_FOUND', 'commit_local_mutation');
        if (!current.deletedAt) throw new LocalDatabaseError('INVALID_ENTITY', 'commit_local_mutation');
        if (mutation.expectedRevision !== actualRevision) throw new LocalDatabaseError('STALE_REVISION', 'commit_local_mutation');
      } else {
        if (mutation.expectedRevision === undefined) throw new LocalDatabaseError('EXPECTED_REVISION_REQUIRED', 'commit_local_mutation');
        if (!current) throw new LocalDatabaseError('ENTITY_NOT_FOUND', 'commit_local_mutation');
        if (current.deletedAt) throw new LocalDatabaseError('TOMBSTONE_REACTIVATION_BLOCKED', 'commit_local_mutation');
        if (mutation.expectedRevision !== actualRevision) throw new LocalDatabaseError('STALE_REVISION', 'commit_local_mutation');
      }
      const isTombstone = mutation.mode === 'tombstone';
      const envelope: LocalEntityEnvelope<T> = {
        namespaceKey: this.namespaceKey, generationId: this.namespace.generationId,
        domain: mutation.domain, entityId: mutation.entityId,
        accountId: this.namespace.userId,
        record: isTombstone ? current!.record : inputSnapshot as T,
        revision: actualRevision + 1, localRevision: actualRevision + 1,
        serverRevision: current?.serverRevision ?? null,
        createdAt: current?.createdAt ?? timestamp, updatedAt: timestamp,
        deletedAt: isTombstone ? timestamp : null, isDeleted: isTombstone,
        deletionState: isTombstone ? 'deleted' : 'active',
        ownerId: mutation.mode === 'tombstone' || mutation.ownerId === undefined ? current?.ownerId ?? null : mutation.ownerId,
        contentHash: hashCanonicalPayload(isTombstone ? current!.record : inputSnapshot),
        pendingMutationId: null,
        lastRemoteMutationRef: current?.lastRemoteMutationRef ?? null,
        source: mutation.mode === 'tombstone' || mutation.source === undefined ? current?.source ?? null : mutation.source,
        restoreProvenance: current?.restoreProvenance ?? null,
      };
      validateEntityEnvelope(envelope);
      if (envelope.revision !== proposedRevision) throw new LocalDatabaseError('STALE_REVISION', 'commit_local_mutation');
      if (input.testOnlyAbortAt === 'before_outbox') throw new LocalDatabaseError('INVALID_OUTBOX', 'commit_local_mutation');
      const payload = isTombstone
        ? { kind: 'tombstone' as const, entityId: mutation.entityId, deletedAt: envelope.deletedAt!, revision: envelope.revision }
        : { kind: 'entity_snapshot' as const, record: canonicalPayloadSnapshot(envelope.record) };
      const payloadHash = hashCanonicalPayload(payload);
      const identity = {
        namespaceKey: this.namespaceKey, generationId: this.namespace.generationId,
        domain: mutation.domain, entityId: mutation.entityId, localRevision: proposedRevision, operation, payloadHash,
      };
      const mutationId = deriveOutboxMutationId(identity);
      const idempotencyKey = deriveOutboxIdempotencyKey(identity);
      if (input.dependsOnMutationId != null) {
        const prerequisite = await requestResult(outboxStore.get([
          this.namespaceKey, this.namespace.generationId, input.dependsOnMutationId,
        ])) as OutboxRecord | undefined;
        if (!prerequisite) throw new LocalDatabaseError('OUTBOX_NOT_FOUND', 'commit_local_mutation');
        this.validatePersistedOutbox(prerequisite, 'commit_local_mutation');
        if (prerequisite.mutationId === mutationId) {
          throw new LocalDatabaseError('INVALID_OUTBOX', 'commit_local_mutation');
        }
      }
      envelope.pendingMutationId = mutationId;
      validateEntityEnvelope(envelope);
      entityStore.put(envelope);
      const outbox: OutboxRecord = {
        namespaceKey: this.namespaceKey, generationId: this.namespace.generationId,
        accountId: this.namespace.userId, deviceId: this.namespace.deviceId,
        domain: mutation.domain, entityId: mutation.entityId, mutationId, idempotencyKey, operation,
        baseRevision: actualRevision || null, localRevision: envelope.revision,
        payloadMode: 'inline', payloadHash, payload,
        createdAt: timestamp, updatedAt: timestamp, availableAt: timestamp,
        attemptCount: 0, status: 'pending', lastAttemptAt: null, lastErrorCode: null,
        leaseOwner: null, leaseExpiresAt: null, acknowledgedAt: null, acknowledgedBy: null, remoteMutationRef: null,
        acknowledgedRevision: null, serverCommittedAt: null,
        supersededByMutationId: null,
        ...(input.dependsOnMutationId == null ? {} : { dependsOnMutationId: input.dependsOnMutationId }),
        ...(input.deliveryBinding === undefined ? {} : { deliveryBinding: { ...input.deliveryBinding } }),
        ...(current?.serverRevision != null && current.pendingMutationId == null && current.contentHash
          && priorOutbox.every(value => value.localRevision < actualRevision)
          ? { remoteSequenceBoundary: {
            kind: 'remote_entity_sequence_boundary' as const,
            namespaceKey: this.namespaceKey,
            generationId: this.namespace.generationId,
            domain: mutation.domain,
            entityId: mutation.entityId,
            baselineLocalRevision: actualRevision,
            baselineServerRevision: current.serverRevision,
            remoteMutationRef: current.lastRemoteMutationRef ?? null,
            baselineContentHash: current.contentHash,
            createdAt: timestamp,
          } }
          : {}),
      };
      validateOutboxRecord(outbox);
      outboxStore.add(outbox);
      if (input.testOnlyAbortAt === 'after_writes') {
        transaction.abort(); throw new LocalDatabaseError('TRANSACTION_ABORTED', 'entity_mutation');
      }
      await done;
      return { entity: envelope, outbox };
    } catch (error) {
      abortQuietly(transaction); await done.catch(() => undefined); throw localDatabaseError(error, 'commit_local_mutation');
    }
  }

  private validateWorkoutAdoptionEvidence(session: WorkoutAdoptionSession, item: WorkoutAdoptionItem): void {
    const expectedManifestId = hashCanonicalPayload([
      'workout-adoption-session-v1', this.namespaceKey, this.namespace.generationId,
      WORKOUT_ADOPTION_ADAPTER, session.sourceSchemaVersion,
      WORKOUT_ADOPTION_CONVERSION_VERSION, session.sourceSnapshotDigest,
    ]);
    if (session.manifestId !== expectedManifestId || item.manifestId !== expectedManifestId
      || session.namespaceKey !== this.namespaceKey || item.namespaceKey !== this.namespaceKey
      || session.generationId !== this.namespace.generationId || item.generationId !== this.namespace.generationId
      || session.accountId !== this.namespace.userId || session.deviceId !== this.namespace.deviceId
      || item.sourceKeyDigest !== hashCanonicalPayload([
        'workout-source-key-v1', hashCanonicalPayload([
          'workout-health-source-instance-v1', this.namespaceKey, 'absinthe.health.local',
        ]), item.sourceReference,
      ]) || item.sourceItemDigest !== hashCanonicalPayload([
        'workout-source-item-v1', WORKOUT_ADOPTION_ADAPTER, session.sourceSchemaVersion,
        item.sourceReference, item.sourceRow, item.referenceBlock, item.ownership,
      ])) throw new LocalDatabaseError('CORRUPT_PERSISTED_RECORD', 'validate_workout_adoption_evidence');
  }

  /** Dormant G3 entry point: seal one copied Health source snapshot before any target write. */
  async sealWorkoutAdoptionSnapshot(snapshot: WorkoutAdoptionSnapshot, capturedAt: string): Promise<WorkoutAdoptionSession> {
    this.assertOpen('seal_workout_adoption');
    const expectedInstance = hashCanonicalPayload([
      'workout-health-source-instance-v1', this.namespaceKey, 'absinthe.health.local',
    ]);
    if (snapshot.accountId !== this.namespace.userId || snapshot.sourceInstanceId !== expectedInstance
      || snapshot.sourceSchemaVersion !== 1
      || new Set(snapshot.items.map(item => item.sourceKeyDigest)).size !== snapshot.items.length) {
      throw new LocalDatabaseError('NAMESPACE_MISMATCH', 'seal_workout_adoption');
    }
    for (const item of snapshot.items) {
      if (item.sourceKeyDigest !== hashCanonicalPayload([
        'workout-source-key-v1', expectedInstance, item.sourceReference,
      ]) || item.sourceItemDigest !== hashCanonicalPayload([
        'workout-source-item-v1', WORKOUT_ADOPTION_ADAPTER, snapshot.sourceSchemaVersion,
        item.sourceReference, item.sourceRow, item.referenceBlock, item.ownership,
      ])) throw new LocalDatabaseError('CORRUPT_PERSISTED_RECORD', 'seal_workout_adoption');
    }
    const ordered = [...snapshot.items].sort((a, b) => compareWorkoutAdoptionKeys(a.sourceReference, b.sourceReference));
    if (snapshot.sourceSnapshotDigest !== hashCanonicalPayload([
      'workout-source-snapshot-v1', WORKOUT_ADOPTION_ADAPTER, snapshot.sourceSchemaVersion,
      snapshot.accountId, expectedInstance, snapshot.sourceImportStateDigest,
      ordered.map(item => [item.sourceKeyDigest, item.sourceItemDigest]),
    ])) throw new LocalDatabaseError('CORRUPT_PERSISTED_RECORD', 'seal_workout_adoption');
    const timestamp = now(capturedAt);
    const manifestId = hashCanonicalPayload([
      'workout-adoption-session-v1', this.namespaceKey, this.namespace.generationId,
      WORKOUT_ADOPTION_ADAPTER, snapshot.sourceSchemaVersion,
      WORKOUT_ADOPTION_CONVERSION_VERSION, snapshot.sourceSnapshotDigest,
    ]);
    const tx = this.db.transaction([
      LOCAL_DATABASE_STORES.databaseMeta, LOCAL_DATABASE_STORES.generations,
      LOCAL_DATABASE_STORES.entities, LOCAL_DATABASE_STORES.outbox,
      LOCAL_DATABASE_STORES.workoutAdoptionSessions, LOCAL_DATABASE_STORES.workoutAdoptionItems,
    ], 'readwrite');
    const done = transactionCompletion(tx, 'seal_workout_adoption');
    try {
      await this.ensureActive(tx);
      const sessions = tx.objectStore(LOCAL_DATABASE_STORES.workoutAdoptionSessions);
      const itemsStore = tx.objectStore(LOCAL_DATABASE_STORES.workoutAdoptionItems);
      const key = [this.namespaceKey, this.namespace.generationId, manifestId];
      const existing = await requestResult(sessions.get(key)) as WorkoutAdoptionSession | undefined;
      if (existing) {
        if (existing.sourceSnapshotDigest !== snapshot.sourceSnapshotDigest
          || existing.sourceRowCount !== snapshot.items.length
          || existing.accountId !== this.namespace.userId) throw new LocalDatabaseError('CORRUPT_PERSISTED_RECORD', 'seal_workout_adoption');
        await done;
        return existing;
      }
      const items: WorkoutAdoptionItem[] = [];
      for (const captured of snapshot.items) {
        const prior = await requestResult(itemsStore.index('by_source_key').getAll(
          IDBKeyRange.only([this.namespaceKey, captured.sourceKeyDigest]),
        )) as WorkoutAdoptionItem[];
        const same = prior.find(item => item.sourceItemDigest === captured.sourceItemDigest
          && item.classification !== 'CARRIED_FORWARD');
        const changed = prior.find(item => item.sourceItemDigest !== captured.sourceItemDigest);
        const assessment = assessWorkoutAdoptionItem(captured);
        let classification: WorkoutAdoptionClassification = assessment.classification;
        let reason = assessment.classification === 'ADOPTABLE' ? 'source_exact' : assessment.reason;
        let priorManifestId: string | null = null;
        if (changed) {
          classification = 'CHANGED_SOURCE_REVIEW'; reason = 'source_key_content_changed';
          priorManifestId = changed.manifestId;
        } else if (same) {
          const previous = same.generationId === this.namespace.generationId
            ? await requestResult(sessions.get([this.namespaceKey, same.generationId, same.manifestId])) as WorkoutAdoptionSession | undefined
            : undefined;
          let priorTargetIntact = true;
          if (same.classification === 'ADOPTABLE') {
            const priorEntity = await requestResult(tx.objectStore(LOCAL_DATABASE_STORES.entities).get(entityKey(
              this.namespaceKey, same.generationId, 'health_workout_session', same.sessionId!,
            ))) as LocalEntityEnvelope<WorkoutSessionV1> | undefined;
            const priorOutbox = await requestResult(tx.objectStore(LOCAL_DATABASE_STORES.outbox).get([
              this.namespaceKey, same.generationId, same.outboxMutationId!,
            ])) as OutboxRecord | undefined;
            priorTargetIntact = !!priorEntity && !!priorOutbox
              && priorEntity.contentHash === same.targetEntityHash && priorEntity.revision === 1
              && hashCanonicalPayload(priorEntity.record) === same.targetEntityHash
              && priorEntity.migrationProvenance?.migrationSessionId === same.manifestId
              && priorEntity.migrationProvenance.legacyKeyDigest === same.sourceKeyDigest
              && priorOutbox.entityId === same.sessionId && priorOutbox.deliveryBinding?.state === 'unbound'
              && priorOutbox.payload.kind === 'entity_snapshot'
              && hashCanonicalPayload(priorOutbox.payload.record) === same.targetEntityHash;
          }
          const completeAndFinal = previous?.status === 'COMPLETED'
            && (same.state === 'VERIFIED' || same.state === 'REVIEW_REQUIRED' || same.state === 'INVALID_ACCOUNTED');
          classification = completeAndFinal && priorTargetIntact ? 'CARRIED_FORWARD' : 'CHANGED_SOURCE_REVIEW';
          reason = classification === 'CARRIED_FORWARD' ? 'same_source_evidence'
            : same.generationId !== this.namespace.generationId ? 'prior_generation_adoption_review'
              : priorTargetIntact ? 'prior_snapshot_unfinished' : 'prior_target_changed';
          priorManifestId = same.manifestId;
        }
        let candidate: WorkoutSessionV1 | null = null;
        let sessionId: string | null = null;
        let entryIds: string[] = [];
        let setIds: string[] = [];
        if (classification === 'ADOPTABLE' && assessment.classification === 'ADOPTABLE') {
          sessionId = crypto.randomUUID(); entryIds = [crypto.randomUUID()];
          setIds = (captured.sourceRow.sets as unknown[]).map(() => crypto.randomUUID());
          try {
            candidate = assessment.build(sessionId, entryIds[0]!, setIds);
          } catch {
            classification = 'INVALID_ACCOUNTED'; reason = 'canonical_candidate_invalid';
            sessionId = null; entryIds = []; setIds = [];
          }
        }
        items.push({
          namespaceKey: this.namespaceKey, generationId: this.namespace.generationId, manifestId,
          sourceKeyDigest: captured.sourceKeyDigest, sourceItemDigest: captured.sourceItemDigest,
          sourceReference: captured.sourceReference, sourceRow: structuredClone(captured.sourceRow),
          referenceBlock: captured.referenceBlock === null ? null : structuredClone(captured.referenceBlock),
          historicalExerciseEvidence: historicalExerciseEvidence(captured),
          ownership: captured.ownership, classification, reason, priorManifestId,
          state: classification === 'ADOPTABLE' ? 'ALLOCATED'
            : classification === 'INVALID_ACCOUNTED' ? 'INVALID_ACCOUNTED'
              : classification === 'CARRIED_FORWARD' ? 'CARRIED_FORWARD' : 'REVIEW_REQUIRED',
          sessionId, entryIds, setIds, candidate,
          conversionResultDigest: candidate === null ? null : hashCanonicalPayload(candidate),
          targetEntityHash: null, outboxMutationId: null, verifiedAt: null,
        });
      }
      items.sort((a, b) => compareWorkoutAdoptionKeys(a.sourceKeyDigest, b.sourceKeyDigest));
      const counts = {
        ADOPTABLE: 0, AMBIGUOUS_REVIEW: 0, INVALID_ACCOUNTED: 0,
        CARRIED_FORWARD: 0, CHANGED_SOURCE_REVIEW: 0,
      } satisfies Record<WorkoutAdoptionClassification, number>;
      for (const item of items) counts[item.classification] += 1;
      const session: WorkoutAdoptionSession = {
        version: 1, manifestId, namespaceKey: this.namespaceKey,
        accountId: this.namespace.userId, projectRef: this.namespace.projectRef,
        deviceId: this.namespace.deviceId, generationId: this.namespace.generationId,
        sourceAdapter: WORKOUT_ADOPTION_ADAPTER, sourceSchemaVersion: snapshot.sourceSchemaVersion,
        conversionVersion: WORKOUT_ADOPTION_CONVERSION_VERSION,
        sourceSnapshotDigest: snapshot.sourceSnapshotDigest, sourceRowCount: items.length,
        sourceCapturedAt: timestamp, sourceImportStateDigest: snapshot.sourceImportStateDigest,
        status: 'SEALED', counts,
        itemManifestDigest: hashCanonicalPayload(items.map(item => [
          item.sourceKeyDigest, item.sourceItemDigest, item.classification, item.reason,
          item.priorManifestId, item.conversionResultDigest, item.historicalExerciseEvidence,
        ])),
        targetStateDigest: null, createdAt: timestamp, updatedAt: timestamp,
        verifiedAt: null, failureCode: null,
        requiresReview: counts.AMBIGUOUS_REVIEW + counts.INVALID_ACCOUNTED + counts.CHANGED_SOURCE_REVIEW > 0,
      };
      sessions.add(session);
      for (const item of items) itemsStore.add(item);
      await done;
      return session;
    } catch (error) {
      abortQuietly(tx); await done.catch(() => undefined);
      throw localDatabaseError(error, 'seal_workout_adoption');
    }
  }

  async getWorkoutAdoptionSession(manifestId: string): Promise<WorkoutAdoptionSession | null> {
    this.assertOpen('get_workout_adoption');
    const tx = this.db.transaction(LOCAL_DATABASE_STORES.workoutAdoptionSessions, 'readonly');
    const value = await requestResult(tx.objectStore(LOCAL_DATABASE_STORES.workoutAdoptionSessions)
      .get([this.namespaceKey, this.namespace.generationId, manifestId])) as WorkoutAdoptionSession | undefined;
    await transactionCompletion(tx, 'get_workout_adoption');
    return value ?? null;
  }

  async listWorkoutAdoptionItems(manifestId: string): Promise<WorkoutAdoptionItem[]> {
    this.assertOpen('list_workout_adoption_items');
    const tx = this.db.transaction(LOCAL_DATABASE_STORES.workoutAdoptionItems, 'readonly');
    const values = await requestResult(tx.objectStore(LOCAL_DATABASE_STORES.workoutAdoptionItems)
      .index('by_manifest').getAll(IDBKeyRange.only([
        this.namespaceKey, this.namespace.generationId, manifestId,
      ]))) as WorkoutAdoptionItem[];
    await transactionCompletion(tx, 'list_workout_adoption_items');
    return values.sort((a, b) => compareWorkoutAdoptionKeys(a.sourceKeyDigest, b.sourceKeyDigest));
  }

  /** Entity, explicit-unbound outbox, and adoption progress share this transaction. */
  async commitWorkoutAdoptionItem(manifestId: string, sourceKeyDigest: string,
    testOnlyAbortAt?: 'after_entity' | 'after_outbox' | 'after_item'): Promise<WorkoutAdoptionItem> {
    this.assertOpen('commit_workout_adoption_item');
    const tx = this.db.transaction([
      LOCAL_DATABASE_STORES.databaseMeta, LOCAL_DATABASE_STORES.generations,
      LOCAL_DATABASE_STORES.entities, LOCAL_DATABASE_STORES.outbox,
      LOCAL_DATABASE_STORES.restoreSessions,
      LOCAL_DATABASE_STORES.workoutAdoptionSessions, LOCAL_DATABASE_STORES.workoutAdoptionItems,
    ], 'readwrite');
    const done = transactionCompletion(tx, 'commit_workout_adoption_item');
    try {
      await this.ensureActive(tx);
      const sessions = tx.objectStore(LOCAL_DATABASE_STORES.workoutAdoptionSessions);
      const items = tx.objectStore(LOCAL_DATABASE_STORES.workoutAdoptionItems);
      const sessionKey = [this.namespaceKey, this.namespace.generationId, manifestId];
      const itemKey = [...sessionKey, sourceKeyDigest];
      const session = await requestResult(sessions.get(sessionKey)) as WorkoutAdoptionSession | undefined;
      const item = await requestResult(items.get(itemKey)) as WorkoutAdoptionItem | undefined;
      if (!session || !item || session.accountId !== this.namespace.userId
        || session.deviceId !== this.namespace.deviceId || session.generationId !== this.namespace.generationId
        || item.ownership !== 'BOUND') throw new LocalDatabaseError('NAMESPACE_MISMATCH', 'commit_workout_adoption_item');
      this.validateWorkoutAdoptionEvidence(session, item);
      if (item.state === 'COMMITTED' || item.state === 'VERIFIED') {
        const target = await requestResult(tx.objectStore(LOCAL_DATABASE_STORES.entities).get(
          entityKey(this.namespaceKey, this.namespace.generationId, 'health_workout_session', item.sessionId!),
        )) as LocalEntityEnvelope<WorkoutSessionV1> | undefined;
        const outbox = await requestResult(tx.objectStore(LOCAL_DATABASE_STORES.outbox).get([
          this.namespaceKey, this.namespace.generationId, item.outboxMutationId!,
        ])) as OutboxRecord | undefined;
        if (!target || !outbox || target.contentHash !== item.targetEntityHash
          || hashCanonicalPayload(target.record) !== item.targetEntityHash
          || target.migrationProvenance?.migrationSessionId !== manifestId
          || target.migrationProvenance.legacyKeyDigest !== item.sourceKeyDigest
          || outbox.entityId !== item.sessionId || outbox.mutationId !== item.outboxMutationId
          || outbox.deliveryBinding?.state !== 'unbound'
          || outbox.payload.kind !== 'entity_snapshot'
          || hashCanonicalPayload(outbox.payload.record) !== item.targetEntityHash) {
          throw new LocalDatabaseError('CORRUPT_PERSISTED_RECORD', 'commit_workout_adoption_item');
        }
        await done; return item;
      }
      if ((session.status !== 'SEALED' && session.status !== 'APPLYING')
        || item.state !== 'ALLOCATED' || item.classification !== 'ADOPTABLE'
        || !item.candidate || !item.sessionId || item.candidate.id !== item.sessionId
        || item.conversionResultDigest !== hashCanonicalPayload(item.candidate)) {
        throw new LocalDatabaseError('INVALID_ENTITY', 'commit_workout_adoption_item');
      }
      validateWorkoutSessionV1(item.candidate);
      const assessment = assessWorkoutAdoptionItem({
        sourceReference: item.sourceReference, sourceKeyDigest: item.sourceKeyDigest,
        sourceItemDigest: item.sourceItemDigest, sourceRow: item.sourceRow,
        referenceBlock: item.referenceBlock, ownership: item.ownership,
      });
      if (assessment.classification !== 'ADOPTABLE' || item.entryIds.length !== 1
        || item.setIds.length !== item.candidate.entries[0]?.sets.length
        || hashCanonicalPayload(assessment.build(item.sessionId, item.entryIds[0]!, item.setIds))
          !== item.conversionResultDigest) {
        throw new LocalDatabaseError('INVALID_ENTITY', 'commit_workout_adoption_item');
      }
      const entityStore = tx.objectStore(LOCAL_DATABASE_STORES.entities);
      const existing = await requestResult(entityStore.get(entityKey(
        this.namespaceKey, this.namespace.generationId, 'health_workout_session', item.sessionId,
      )));
      if (existing) throw new LocalDatabaseError('ENTITY_ALREADY_EXISTS', 'commit_workout_adoption_item');
      const payloadRecord = canonicalPayloadSnapshot(item.candidate);
      const payload = { kind: 'entity_snapshot' as const, record: payloadRecord };
      const payloadHash = hashCanonicalPayload(payload);
      const identity = {
        namespaceKey: this.namespaceKey, generationId: this.namespace.generationId,
        domain: 'health_workout_session', entityId: item.sessionId,
        localRevision: 1, operation: 'upsert' as const, payloadHash,
      };
      const mutationId = deriveOutboxMutationId(identity);
      const timestamp = now();
      const entity: LocalEntityEnvelope<WorkoutSessionV1> = {
        namespaceKey: this.namespaceKey, generationId: this.namespace.generationId,
        accountId: this.namespace.userId, domain: 'health_workout_session', entityId: item.sessionId,
        record: payloadRecord, revision: 1, localRevision: 1, serverRevision: null,
        createdAt: timestamp, updatedAt: timestamp, deletedAt: null, isDeleted: false,
        deletionState: 'active', ownerId: this.namespace.userId,
        contentHash: hashCanonicalPayload(payloadRecord), pendingMutationId: mutationId,
        lastRemoteMutationRef: null, source: { kind: 'legacy_migration', reference: manifestId },
        restoreProvenance: null,
        migrationProvenance: {
          conversionVersion: 1, sourceAdapter: WORKOUT_ADOPTION_ADAPTER,
          sourceSchemaVersion: session.sourceSchemaVersion, migrationSessionId: manifestId,
          sourceSnapshotDigest: session.sourceSnapshotDigest, migratedAt: timestamp,
          legacyKeyDigest: item.sourceKeyDigest,
        },
      };
      validateEntityEnvelope(entity);
      entityStore.add(entity);
      if (testOnlyAbortAt === 'after_entity') throw new Error('workout_adoption_injected_abort');
      const outbox: OutboxRecord = {
        namespaceKey: this.namespaceKey, generationId: this.namespace.generationId,
        accountId: this.namespace.userId, deviceId: this.namespace.deviceId,
        mutationId, domain: 'health_workout_session', entityId: item.sessionId,
        operation: 'upsert', baseRevision: null, localRevision: 1,
        payloadMode: 'inline', payload, payloadHash,
        createdAt: timestamp, updatedAt: timestamp, availableAt: timestamp,
        attemptCount: 0, status: 'pending', lastAttemptAt: null, lastErrorCode: null,
        leaseOwner: null, leaseExpiresAt: null, acknowledgedAt: null, acknowledgedBy: null,
        remoteMutationRef: null, acknowledgedRevision: null, serverCommittedAt: null,
        supersededByMutationId: null, idempotencyKey: deriveOutboxIdempotencyKey(identity),
        deliveryBinding: { version: 1, state: 'unbound' },
      };
      validateOutboxRecord(outbox);
      tx.objectStore(LOCAL_DATABASE_STORES.outbox).add(outbox);
      if (testOnlyAbortAt === 'after_outbox') throw new Error('workout_adoption_injected_abort');
      const committed: WorkoutAdoptionItem = {
        ...item, state: 'COMMITTED', targetEntityHash: entity.contentHash,
        outboxMutationId: mutationId,
      };
      items.put(committed);
      sessions.put({ ...session, status: 'APPLYING', updatedAt: timestamp });
      if (testOnlyAbortAt === 'after_item') throw new Error('workout_adoption_injected_abort');
      await done;
      return committed;
    } catch (error) {
      abortQuietly(tx); await done.catch(() => undefined);
      throw localDatabaseError(error, 'commit_workout_adoption_item');
    }
  }

  async completeWorkoutAdoption(manifestId: string, testOnlyAbort = false): Promise<WorkoutAdoptionSession> {
    this.assertOpen('complete_workout_adoption');
    const tx = this.db.transaction([
      LOCAL_DATABASE_STORES.databaseMeta, LOCAL_DATABASE_STORES.generations,
      LOCAL_DATABASE_STORES.entities, LOCAL_DATABASE_STORES.outbox,
      LOCAL_DATABASE_STORES.workoutAdoptionSessions, LOCAL_DATABASE_STORES.workoutAdoptionItems,
    ], 'readwrite');
    const done = transactionCompletion(tx, 'complete_workout_adoption');
    try {
      await this.ensureActive(tx);
      const sessions = tx.objectStore(LOCAL_DATABASE_STORES.workoutAdoptionSessions);
      const itemStore = tx.objectStore(LOCAL_DATABASE_STORES.workoutAdoptionItems);
      const key = [this.namespaceKey, this.namespace.generationId, manifestId];
      const session = await requestResult(sessions.get(key)) as WorkoutAdoptionSession | undefined;
      if (!session || session.accountId !== this.namespace.userId || session.deviceId !== this.namespace.deviceId) {
        throw new LocalDatabaseError('NAMESPACE_MISMATCH', 'complete_workout_adoption');
      }
      const alreadyCompleted = session.status === 'COMPLETED';
      const items = await requestResult(itemStore.index('by_manifest').getAll(
        IDBKeyRange.only(key),
      )) as WorkoutAdoptionItem[];
      items.sort((a, b) => compareWorkoutAdoptionKeys(a.sourceKeyDigest, b.sourceKeyDigest));
      if (items.length !== session.sourceRowCount || hashCanonicalPayload(items.map(item => [
        item.sourceKeyDigest, item.sourceItemDigest, item.classification, item.reason,
        item.priorManifestId, item.conversionResultDigest, item.historicalExerciseEvidence,
      ])) !== session.itemManifestDigest) throw new LocalDatabaseError('CORRUPT_PERSISTED_RECORD', 'complete_workout_adoption');
      const counts = {
        ADOPTABLE: 0, AMBIGUOUS_REVIEW: 0, INVALID_ACCOUNTED: 0,
        CARRIED_FORWARD: 0, CHANGED_SOURCE_REVIEW: 0,
      } satisfies Record<WorkoutAdoptionClassification, number>;
      for (const item of items) counts[item.classification] += 1;
      if (hashCanonicalPayload(counts) !== hashCanonicalPayload(session.counts)
        || session.requiresReview !== (counts.AMBIGUOUS_REVIEW + counts.INVALID_ACCOUNTED + counts.CHANGED_SOURCE_REVIEW > 0)) {
        throw new LocalDatabaseError('CORRUPT_PERSISTED_RECORD', 'complete_workout_adoption');
      }
      const targetEvidence: unknown[] = [];
      const timestamp = now();
      for (const item of items) {
        this.validateWorkoutAdoptionEvidence(session, item);
        if (item.classification !== 'ADOPTABLE') {
          if (!['REVIEW_REQUIRED', 'INVALID_ACCOUNTED', 'CARRIED_FORWARD'].includes(item.state)) {
            throw new LocalDatabaseError('INVALID_ENTITY', 'complete_workout_adoption');
          }
          continue;
        }
        if (item.state !== 'COMMITTED' && item.state !== 'VERIFIED') {
          throw new LocalDatabaseError('INVALID_ENTITY', 'complete_workout_adoption');
        }
        const entity = await requestResult(tx.objectStore(LOCAL_DATABASE_STORES.entities).get(entityKey(
          this.namespaceKey, this.namespace.generationId, 'health_workout_session', item.sessionId!,
        ))) as LocalEntityEnvelope<WorkoutSessionV1> | undefined;
        const outbox = await requestResult(tx.objectStore(LOCAL_DATABASE_STORES.outbox).get([
          this.namespaceKey, this.namespace.generationId, item.outboxMutationId!,
        ])) as OutboxRecord | undefined;
        if (!entity || !outbox || entity.revision !== 1 || entity.isDeleted
          || entity.contentHash !== item.targetEntityHash
          || hashCanonicalPayload(entity.record) !== item.targetEntityHash
          || entity.contentHash !== item.conversionResultDigest
          || entity.migrationProvenance?.migrationSessionId !== manifestId
          || entity.migrationProvenance.legacyKeyDigest !== item.sourceKeyDigest
          || outbox.entityId !== item.sessionId || outbox.mutationId !== item.outboxMutationId
          || outbox.deliveryBinding?.state !== 'unbound'
          || outbox.payloadHash !== hashCanonicalPayload(outbox.payload)
          || outbox.payload.kind !== 'entity_snapshot'
          || hashCanonicalPayload(outbox.payload.record) !== entity.contentHash) {
          throw new LocalDatabaseError('CORRUPT_PERSISTED_RECORD', 'complete_workout_adoption');
        }
        targetEvidence.push([item.sourceKeyDigest, entity.contentHash, outbox.mutationId]);
        if (item.state !== 'VERIFIED' && !alreadyCompleted) itemStore.put({ ...item, state: 'VERIFIED', verifiedAt: timestamp });
      }
      if (alreadyCompleted) {
        if (session.targetStateDigest !== hashCanonicalPayload(targetEvidence)) {
          throw new LocalDatabaseError('CORRUPT_PERSISTED_RECORD', 'complete_workout_adoption');
        }
        await done;
        return session;
      }
      const completed: WorkoutAdoptionSession = {
        ...session, status: 'COMPLETED', targetStateDigest: hashCanonicalPayload(targetEvidence),
        verifiedAt: timestamp, updatedAt: timestamp,
      };
      sessions.put(completed);
      if (testOnlyAbort) throw new Error('workout_adoption_injected_abort');
      await done;
      return completed;
    } catch (error) {
      abortQuietly(tx); await done.catch(() => undefined);
      throw localDatabaseError(error, 'complete_workout_adoption');
    }
  }

  async createEntity<T>(mutation: Omit<EntityCreateInput<T>, 'mode'>): Promise<LocalEntityEnvelope<T>> {
    return (await this.commitLocalMutation({ mutation: { ...mutation, mode: 'create' }, now: mutation.timestamp ?? this.clock() })).entity;
  }

  async updateEntity<T>(mutation: Omit<EntityUpdateInput<T>, 'mode'>): Promise<LocalEntityEnvelope<T>> {
    return (await this.commitLocalMutation({ mutation: { ...mutation, mode: 'update' }, now: mutation.timestamp ?? this.clock() })).entity;
  }

  async tombstoneEntity(domain: string, entityId: string, expectedRevision: number, timestamp?: string): Promise<LocalEntityEnvelope> {
    return (await this.commitLocalMutation({
      mutation: { domain, entityId, record: null, mode: 'tombstone', expectedRevision, timestamp }, now: timestamp ?? this.clock(),
    })).entity;
  }

  async getEntity<T>(domain: string, entityId: string): Promise<LocalEntityEnvelope<T> | null> {
    this.assertOpen('get_entity'); validateSafeIdentifier(domain, 'get_entity');
    const transaction = this.db.transaction(LOCAL_DATABASE_STORES.entities, 'readonly');
    const done = transactionCompletion(transaction, 'get_entity');
    const value = await requestResult(transaction.objectStore(LOCAL_DATABASE_STORES.entities)
      .get(entityKey(this.namespaceKey, this.namespace.generationId, domain, entityId))) as LocalEntityEnvelope<T> | undefined;
    await done;
    if (value) this.validatePersistedEntity(value, 'get_entity');
    return value ?? null;
  }

  async listEntities<T>(options: EntityListOptions): Promise<LocalEntityEnvelope<T>[]> {
    this.assertOpen('list_entities'); validateSafeIdentifier(options.domain, 'list_entities');
    const transaction = this.db.transaction(LOCAL_DATABASE_STORES.entities, 'readonly');
    const done = transactionCompletion(transaction, 'list_entities');
    const index = transaction.objectStore(LOCAL_DATABASE_STORES.entities).index('by_namespace_generation_domain');
    const values = await requestResult(index.getAll(IDBKeyRange.only([this.namespaceKey, this.namespace.generationId, options.domain]))) as LocalEntityEnvelope<T>[];
    await done;
    values.forEach(value => this.validatePersistedEntity(value, 'list_entities'));
    return values.filter(value => options.includeDeleted || !value.isDeleted)
      .sort((a, b) => a.entityId.localeCompare(b.entityId));
  }

  async listEntitiesByOwner<T>(ownerId: string): Promise<LocalEntityEnvelope<T>[]> {
    this.assertOpen('list_entities_by_owner'); validateSafeIdentifier(ownerId, 'list_entities_by_owner');
    const transaction = this.db.transaction(LOCAL_DATABASE_STORES.entities, 'readonly');
    const done = transactionCompletion(transaction, 'list_entities_by_owner');
    const index = transaction.objectStore(LOCAL_DATABASE_STORES.entities).index('by_namespace_generation_owner');
    const values = await requestResult(index.getAll(IDBKeyRange.only([this.namespaceKey, this.namespace.generationId, ownerId]))) as LocalEntityEnvelope<T>[];
    await done;
    values.forEach(value => this.validatePersistedEntity(value, 'list_entities_by_owner'));
    return values.sort((a, b) => `${a.domain}\0${a.entityId}`.localeCompare(`${b.domain}\0${b.entityId}`));
  }

  async getOutboxRecord(mutationId: string): Promise<OutboxRecord | null> {
    this.assertOpen('get_outbox'); validateSafeIdentifier(mutationId, 'get_outbox');
    const transaction = this.db.transaction(
      [LOCAL_DATABASE_STORES.databaseMeta, LOCAL_DATABASE_STORES.generations, LOCAL_DATABASE_STORES.entities,
        LOCAL_DATABASE_STORES.outbox, LOCAL_DATABASE_STORES.restoreSessions], 'readonly',
    );
    const done = transactionCompletion(transaction, 'get_outbox');
    const value = await requestResult(transaction.objectStore(LOCAL_DATABASE_STORES.outbox)
      .get([this.namespaceKey, this.namespace.generationId, mutationId])) as OutboxRecord | undefined;
    if (value) this.validatePersistedOutbox(value, 'get_outbox');
    if (value) await this.validateRestoreBoundaryGraphs(transaction, [value]);
    await this.ensureActive(transaction);
    await done;
    return value ?? null;
  }

  private async validateRestoreBoundaryGraphs(transaction: IDBTransaction, values: OutboxRecord[]): Promise<void> {
    const bounded = values.filter(value => value.generationBoundary != null);
    if (bounded.length === 0) return;
    const metaRequest = transaction.objectStore(LOCAL_DATABASE_STORES.databaseMeta).get(this.namespaceKey);
    const sessions = transaction.objectStore(LOCAL_DATABASE_STORES.restoreSessions);
    const generations = transaction.objectStore(LOCAL_DATABASE_STORES.generations);
    const entities = transaction.objectStore(LOCAL_DATABASE_STORES.entities);
    const sessionRequests = new Map<string, Promise<RestoreSessionRecord | undefined>>();
    const generationRequests = new Map<string, Promise<GenerationRecord | undefined>>();
    const entityRequests = new Map<string, Promise<LocalEntityEnvelope | undefined>>();
    const sessionFor = (sessionId: string): Promise<RestoreSessionRecord | undefined> => {
      let request = sessionRequests.get(sessionId);
      if (!request) {
        request = requestResult(sessions.get([this.namespaceKey, sessionId])) as Promise<RestoreSessionRecord | undefined>;
        sessionRequests.set(sessionId, request);
      }
      return request;
    };
    const generationFor = (generationId: string): Promise<GenerationRecord | undefined> => {
      let request = generationRequests.get(generationId);
      if (!request) {
        request = requestResult(generations.get(generationKey(this.namespaceKey, generationId))) as Promise<GenerationRecord | undefined>;
        generationRequests.set(generationId, request);
      }
      return request;
    };
    const entityFor = (generationId: string, domain: string, entityId: string): Promise<LocalEntityEnvelope | undefined> => {
      const cacheKey = JSON.stringify([generationId, domain, entityId]);
      let request = entityRequests.get(cacheKey);
      if (!request) {
        request = requestResult(entities.get(entityKey(this.namespaceKey, generationId, domain, entityId))) as Promise<LocalEntityEnvelope | undefined>;
        entityRequests.set(cacheKey, request);
      }
      return request;
    };
    const lookups = bounded.map(value => {
      const boundary = value.generationBoundary!;
      return {
        value,
        session: sessionFor(boundary.restoreSessionId),
        sourceGeneration: generationFor(boundary.sourceGenerationId),
        targetGeneration: generationFor(boundary.targetGenerationId),
        sourceEntity: entityFor(boundary.sourceGenerationId, boundary.domain, boundary.entityId),
        targetEntity: entityFor(boundary.targetGenerationId, boundary.domain, boundary.entityId),
      };
    });
    const meta = await requestResult(metaRequest) as DatabaseMetaRecord | undefined;
    if (!meta) throw new LocalDatabaseError('CORRUPT_PERSISTED_RECORD', 'validate_restore_sequence_boundary_graph');
    for (const lookup of lookups) {
      const [session, sourceGeneration, targetGeneration, sourceEntity, targetEntity] = await Promise.all([
        lookup.session, lookup.sourceGeneration, lookup.targetGeneration, lookup.sourceEntity, lookup.targetEntity,
      ]);
      validateRestoreSequenceBoundaryGraph({
        outbox: lookup.value, session: session as RestoreSessionRecord,
        databaseMeta: meta, sourceGeneration: sourceGeneration ?? null, targetGeneration: targetGeneration ?? null,
        sourceEntity: sourceEntity ?? null, targetEntity: targetEntity ?? null,
        namespaceKey: this.namespaceKey, schemaVersion: this.namespace.schemaVersion,
      });
    }
  }

  private async readScopedOutbox(transaction: IDBTransaction, operation: string): Promise<OutboxRecord[]> {
    const store = transaction.objectStore(LOCAL_DATABASE_STORES.outbox);
    const range = IDBKeyRange.bound(
      [this.namespaceKey, this.namespace.generationId, ''],
      [this.namespaceKey, this.namespace.generationId, '\uffff'],
    );
    const values = await requestResult(store.getAll(range, MAX_OUTBOX_SCAN + 1)) as OutboxRecord[];
    if (values.length > MAX_OUTBOX_SCAN) throw new LocalDatabaseError('INVALID_OUTBOX_QUERY', operation);
    values.forEach(value => this.validatePersistedOutbox(value, operation));
    await this.validateRestoreBoundaryGraphs(transaction, values);
    this.validateOutboxSequences(values, operation);
    this.validateOutboxDependencies(values, operation);
    return values;
  }

  private validateOutboxSequences(values: OutboxRecord[], operation: string): void {
    const groups = new Map<string, OutboxRecord[]>();
    for (const value of values) {
      const key = JSON.stringify([value.domain, value.entityId]);
      const group = groups.get(key) ?? []; group.push(value); groups.set(key, group);
    }
    for (const group of groups.values()) {
      group.sort((left, right) => left.localRevision - right.localRevision);
      const first = group[0];
      const validRestoreBoundary = first?.baseRevision !== null
        && first?.generationBoundary?.kind === 'restore_generation_sequence_boundary'
        && first.generationBoundary.sourceRevision === first.baseRevision
        && first.localRevision === first.baseRevision + 1;
      const validRemoteBoundary = first?.baseRevision !== null
        && first?.remoteSequenceBoundary?.kind === 'remote_entity_sequence_boundary'
        && first.remoteSequenceBoundary.baselineLocalRevision === first.baseRevision
        && first.localRevision === first.baseRevision + 1;
      const validSequenceStart = first !== undefined
        && (first.baseRevision === null ? first.localRevision === 1 : validRestoreBoundary || validRemoteBoundary);
      if (!validSequenceStart) {
        throw new LocalDatabaseError('OUTBOX_SEQUENCE_GAP', operation);
      }
      for (let index = 1; index < group.length; index += 1) {
        const previous = group[index - 1];
        const current = group[index];
        const validReconciliationBoundary = current.remoteSequenceBoundary?.kind === 'remote_entity_sequence_boundary'
          && current.baseRevision === current.remoteSequenceBoundary.baselineLocalRevision
          && (previous.status === 'acknowledged'
            || previous.status === 'superseded' && previous.supersededByMutationId === current.mutationId);
        if (current.generationBoundary != null
          || !validReconciliationBoundary && current.remoteSequenceBoundary != null
          || !validReconciliationBoundary && current.baseRevision !== previous.localRevision) {
          throw new LocalDatabaseError('OUTBOX_SEQUENCE_GAP', operation);
        }
      }
    }
  }

  private validateOutboxDependencies(values: OutboxRecord[], operation: string): void {
    const byId = new Map(values.map(value => [value.mutationId, value]));
    for (const value of values) {
      const dependencyId = value.dependsOnMutationId ?? null;
      if (dependencyId === null) continue;
      const dependency = byId.get(dependencyId);
      if (!dependency || dependency.namespaceKey !== value.namespaceKey
        || dependency.generationId !== value.generationId || dependency.mutationId === value.mutationId) {
        throw new LocalDatabaseError('OUTBOX_SEQUENCE_GAP', operation);
      }
      const visited = new Set<string>([value.mutationId]);
      let cursor: OutboxRecord | undefined = dependency;
      while (cursor?.dependsOnMutationId) {
        if (visited.has(cursor.mutationId)) throw new LocalDatabaseError('OUTBOX_SEQUENCE_GAP', operation);
        visited.add(cursor.mutationId);
        cursor = byId.get(cursor.dependsOnMutationId);
        if (!cursor) throw new LocalDatabaseError('OUTBOX_SEQUENCE_GAP', operation);
      }
    }
  }

  private nextDeliverable(values: OutboxRecord[], timestamp: string, recoverExpiredClaims: boolean): OutboxRecord[] {
    const at = Date.parse(now(timestamp));
    const byId = new Map(values.map(value => [value.mutationId, value]));
    const groups = new Map<string, OutboxRecord[]>();
    for (const value of values) {
      const key = JSON.stringify([value.domain, value.entityId]);
      const group = groups.get(key) ?? []; group.push(value); groups.set(key, group);
    }
    const candidates: OutboxRecord[] = [];
    for (const group of groups.values()) {
      group.sort((left, right) => left.localRevision - right.localRevision);
      const firstUnsettled = group.find(value => value.status !== 'acknowledged' && value.status !== 'superseded');
      if (!firstUnsettled) continue;
      if (firstUnsettled.deliveryBlockCode || firstUnsettled.deliveryBinding !== undefined) continue;
      const prerequisite = firstUnsettled.dependsOnMutationId
        ? byId.get(firstUnsettled.dependsOnMutationId)
        : null;
      if (firstUnsettled.dependsOnMutationId && prerequisite?.status !== 'acknowledged') continue;
      if ((firstUnsettled.status === 'pending' || firstUnsettled.status === 'retry_wait')
        && Date.parse(firstUnsettled.availableAt) <= at) candidates.push(firstUnsettled);
      if (recoverExpiredClaims && firstUnsettled.status === 'claimed'
        && firstUnsettled.leaseExpiresAt !== null && Date.parse(firstUnsettled.leaseExpiresAt) <= at) candidates.push(firstUnsettled);
    }
    return candidates.sort((left, right) =>
      left.domain.localeCompare(right.domain) || left.entityId.localeCompare(right.entityId)
      || left.localRevision - right.localRevision);
  }

  async listOutboxMutations(input: OutboxListInput): Promise<OutboxRecord[]> {
    this.assertOpen('list_outbox');
    if (!Number.isSafeInteger(input.limit) || input.limit < 1 || input.limit > 500
      || (input.domain === undefined) !== (input.entityId === undefined)) {
      throw new LocalDatabaseError('INVALID_OUTBOX_QUERY', 'list_outbox');
    }
    if (input.status !== undefined && !['pending', 'claimed', 'retry_wait', 'acknowledged', 'conflict', 'permanent_failure', 'superseded'].includes(input.status)) {
      throw new LocalDatabaseError('INVALID_OUTBOX_QUERY', 'list_outbox');
    }
    if (input.domain !== undefined) {
      validateSafeIdentifier(input.domain, 'list_outbox');
      if (!input.entityId) throw new LocalDatabaseError('INVALID_OUTBOX_QUERY', 'list_outbox');
    }
    const transaction = this.db.transaction(
      [LOCAL_DATABASE_STORES.databaseMeta, LOCAL_DATABASE_STORES.generations, LOCAL_DATABASE_STORES.entities,
        LOCAL_DATABASE_STORES.outbox, LOCAL_DATABASE_STORES.restoreSessions], 'readonly',
    );
    const done = transactionCompletion(transaction, 'list_outbox');
    const values = await this.readScopedOutbox(transaction, 'list_outbox');
    await this.ensureActive(transaction);
    await done;
    return values.filter(value => (input.status === undefined || value.status === input.status)
      && (input.domain === undefined || value.domain === input.domain && value.entityId === input.entityId))
      .sort((left, right) => left.domain.localeCompare(right.domain) || left.entityId.localeCompare(right.entityId)
        || left.localRevision - right.localRevision || left.mutationId.localeCompare(right.mutationId))
      .slice(0, input.limit);
  }

  async listOutboxDependents(prerequisiteMutationId: string): Promise<OutboxRecord[]> {
    this.assertOpen('list_outbox_dependents');
    validateSafeIdentifier(prerequisiteMutationId, 'list_outbox_dependents');
    const transaction = this.db.transaction(
      [LOCAL_DATABASE_STORES.databaseMeta, LOCAL_DATABASE_STORES.generations, LOCAL_DATABASE_STORES.entities,
        LOCAL_DATABASE_STORES.outbox, LOCAL_DATABASE_STORES.restoreSessions], 'readonly',
    );
    const done = transactionCompletion(transaction, 'list_outbox_dependents');
    const values = await this.readScopedOutbox(transaction, 'list_outbox_dependents');
    await this.ensureActive(transaction);
    await done;
    return values.filter(value => value.dependsOnMutationId === prerequisiteMutationId)
      .sort((left, right) => left.domain.localeCompare(right.domain)
        || left.entityId.localeCompare(right.entityId) || left.localRevision - right.localRevision);
  }

  /**
   * Return the oldest conflicted Health profile mutation that still has a live
   * dependent. Historical conflicts without queue impact are deliberately
   * ignored. The reconciliation transaction revalidates this result.
   */
  async findHealthProfileReconciliationPrerequisite(): Promise<OutboxRecord | null> {
    const operation = 'find_health_profile_reconciliation_prerequisite';
    this.assertOpen(operation);
    const transaction = this.db.transaction(
      [LOCAL_DATABASE_STORES.databaseMeta, LOCAL_DATABASE_STORES.generations, LOCAL_DATABASE_STORES.entities,
        LOCAL_DATABASE_STORES.outbox, LOCAL_DATABASE_STORES.restoreSessions], 'readonly',
    );
    const done = transactionCompletion(transaction, operation);
    const values = await this.readScopedOutbox(transaction, operation);
    await this.ensureActive(transaction);
    await done;
    const relevantPrerequisites = new Set(values
      .filter(value => value.operation === 'tombstone'
        && (value.status === 'pending' || value.status === 'retry_wait')
        && value.dependsOnMutationId != null)
      .map(value => value.dependsOnMutationId as string));
    return values.filter(value => value.domain === HEALTH_PROFILE_RECONCILIATION_DOMAIN
      && value.entityId === HEALTH_PROFILE_RECONCILIATION_ENTITY_ID
      && value.status === 'conflict'
      && relevantPrerequisites.has(value.mutationId))
      .sort((left, right) => left.localRevision - right.localRevision)[0] ?? null;
  }

  async countOutboxByStatus(): Promise<OutboxStatusCounts> {
    this.assertOpen('count_outbox');
    const transaction = this.db.transaction(
      [LOCAL_DATABASE_STORES.databaseMeta, LOCAL_DATABASE_STORES.generations, LOCAL_DATABASE_STORES.entities,
        LOCAL_DATABASE_STORES.outbox, LOCAL_DATABASE_STORES.restoreSessions], 'readonly',
    );
    const done = transactionCompletion(transaction, 'count_outbox');
    const values = await this.readScopedOutbox(transaction, 'count_outbox');
    await this.ensureActive(transaction);
    await done;
    const counts: Record<OutboxStatus, number> = {
      pending: 0, claimed: 0, retry_wait: 0, acknowledged: 0, conflict: 0, permanent_failure: 0, superseded: 0,
    };
    for (const value of values) counts[value.status] += 1;
    return Object.freeze(counts);
  }

  async listNextDeliverableMutations(input: { now: string; limit: number }): Promise<OutboxRecord[]> {
    this.assertOpen('next_deliverable');
    if (!Number.isSafeInteger(input.limit) || input.limit < 1 || input.limit > 100) {
      throw new LocalDatabaseError('INVALID_OUTBOX_QUERY', 'next_deliverable');
    }
    const transaction = this.db.transaction(
      [LOCAL_DATABASE_STORES.databaseMeta, LOCAL_DATABASE_STORES.generations, LOCAL_DATABASE_STORES.entities,
        LOCAL_DATABASE_STORES.outbox, LOCAL_DATABASE_STORES.restoreSessions], 'readwrite',
    );
    const done = transactionCompletion(transaction, 'next_deliverable');
    try {
      const values = await this.readScopedOutbox(transaction, 'next_deliverable');
      await this.ensureActive(transaction);
      const safeValues = this.quarantineAttemptedUnbound(transaction, values);
      const result = this.nextDeliverable(safeValues, input.now, false).slice(0, input.limit);
      await done;
      return result;
    } catch (error) {
      abortQuietly(transaction);
      await done.catch(() => undefined);
      throw localDatabaseError(error, 'next_deliverable');
    }
  }

  async claimNextMutations(input: ClaimOutboxInput): Promise<OutboxRecord[]> {
    this.assertOpen('claim_outbox'); validateSafeIdentifier(input.workerId, 'claim_outbox');
    const timestamp = now(input.now);
    if (!Number.isSafeInteger(input.limit) || input.limit < 1 || input.limit > 100
      || !Number.isSafeInteger(input.leaseDurationMs) || input.leaseDurationMs < 1 || input.leaseDurationMs > 86_400_000
      || input.priorityDomains && (input.priorityDomains.length > 16
        || new Set(input.priorityDomains).size !== input.priorityDomains.length)) {
      throw new LocalDatabaseError('INVALID_OUTBOX_QUERY', 'claim_outbox');
    }
    input.priorityDomains?.forEach(domain => validateSafeIdentifier(domain, 'claim_outbox'));
    const transaction = this.db.transaction(
      [LOCAL_DATABASE_STORES.databaseMeta, LOCAL_DATABASE_STORES.generations, LOCAL_DATABASE_STORES.entities,
        LOCAL_DATABASE_STORES.outbox, LOCAL_DATABASE_STORES.restoreSessions], 'readwrite',
    );
    const done = transactionCompletion(transaction, 'claim_outbox');
    try {
      const values = await this.readScopedOutbox(transaction, 'claim_outbox');
      await this.ensureActive(transaction);
      const store = transaction.objectStore(LOCAL_DATABASE_STORES.outbox);
      const quarantined = this.quarantineAttemptedUnbound(transaction, values);
      const deliverable = this.nextDeliverable(quarantined, timestamp, input.recoverExpiredClaims === true);
      const usePriority = !input.priorityTriggerOperation
        || deliverable.some(item => item.operation === input.priorityTriggerOperation);
      const priority = new Map((usePriority ? input.priorityDomains : [])?.map((domain, index) => [domain, index]) ?? []);
      const candidates = deliverable
        .sort((left, right) => (priority.get(left.domain) ?? Number.MAX_SAFE_INTEGER)
          - (priority.get(right.domain) ?? Number.MAX_SAFE_INTEGER)
          || left.domain.localeCompare(right.domain) || left.entityId.localeCompare(right.entityId)
          || left.localRevision - right.localRevision)
        .slice(0, input.limit);
      const claimed = candidates.map(value => {
        if (!Number.isSafeInteger(value.attemptCount + 1)) throw new LocalDatabaseError('INVALID_OUTBOX_TRANSITION', 'claim_outbox');
        const updated = claimOutboxRecord(value, {
          ownerId: input.workerId, now: timestamp, leaseDurationMs: input.leaseDurationMs,
          allowExpiredClaim: input.recoverExpiredClaims,
        });
        validateOutboxRecord(updated); store.put(updated); return updated;
      });
      await done; return claimed;
    } catch (error) {
      abortQuietly(transaction); await done.catch(() => undefined); throw localDatabaseError(error, 'claim_outbox');
    }
  }

  private async transitionOutbox(
    mutationId: string, operation: string, transform: (value: OutboxRecord) => OutboxRecord,
  ): Promise<OutboxRecord> {
    this.assertOpen(operation); validateSafeIdentifier(mutationId, operation);
    const transaction = this.db.transaction(
      [LOCAL_DATABASE_STORES.databaseMeta, LOCAL_DATABASE_STORES.generations, LOCAL_DATABASE_STORES.entities,
        LOCAL_DATABASE_STORES.outbox, LOCAL_DATABASE_STORES.restoreSessions], 'readwrite',
    );
    const done = transactionCompletion(transaction, operation);
    try {
      const store = transaction.objectStore(LOCAL_DATABASE_STORES.outbox);
      const value = await requestResult(store.get([this.namespaceKey, this.namespace.generationId, mutationId])) as OutboxRecord | undefined;
      if (!value) throw new LocalDatabaseError('OUTBOX_NOT_FOUND', operation);
      this.validatePersistedOutbox(value, operation);
      await this.validateRestoreBoundaryGraphs(transaction, [value]);
      await this.ensureActive(transaction);
      const updated = transform(value); validateOutboxRecord(updated); store.put(updated);
      await done; return updated;
    } catch (error) {
      abortQuietly(transaction); await done.catch(() => undefined); throw localDatabaseError(error, operation);
    }
  }

  releaseClaimForRetry(input: RetryOutboxInput): Promise<OutboxRecord> {
    validateSafeIdentifier(input.workerId, 'retry_outbox'); validateSafeIdentifier(input.errorCode, 'retry_outbox');
    const timestamp = now(input.now);
    if (!Number.isSafeInteger(input.baseDelayMs) || !Number.isSafeInteger(input.maxDelayMs)
      || input.baseDelayMs < 1 || input.maxDelayMs < input.baseDelayMs || input.maxDelayMs > 2_592_000_000) {
      return Promise.reject(new LocalDatabaseError('INVALID_OUTBOX_TRANSITION', 'retry_outbox'));
    }
    return this.transitionOutbox(input.mutationId, 'retry_outbox', value => {
      if (value.status !== 'claimed') throw new LocalDatabaseError('INVALID_OUTBOX_TRANSITION', 'retry_outbox');
      if (value.leaseOwner !== input.workerId) throw new LocalDatabaseError('LEASE_OWNER_MISMATCH', 'retry_outbox');
      return scheduleOutboxRetry(value, {
        ownerId: input.workerId, now: timestamp, errorCode: input.errorCode,
        baseDelayMs: input.baseDelayMs, maxDelayMs: input.maxDelayMs,
      });
    });
  }

  acknowledgeMutation(input: AcknowledgeOutboxInput): Promise<OutboxRecord> {
    validateSafeIdentifier(input.workerId, 'acknowledge_outbox'); const timestamp = now(input.now);
    if (input.remoteMutationRef !== undefined && input.remoteMutationRef !== null) {
      validateSafeIdentifier(input.remoteMutationRef, 'acknowledge_outbox');
    }
    const remoteMutationRef = input.remoteMutationRef ?? null;
    const acknowledgedRevision = input.acknowledgedRevision ?? null;
    const serverCommittedAt = input.serverCommittedAt ?? null;
    if (acknowledgedRevision !== null && (!Number.isSafeInteger(acknowledgedRevision) || acknowledgedRevision < 1)) {
      return Promise.reject(new LocalDatabaseError('INVALID_OUTBOX_TRANSITION', 'acknowledge_outbox'));
    }
    if (serverCommittedAt !== null) now(serverCommittedAt);
    return this.transitionOutbox(input.mutationId, 'acknowledge_outbox', value => {
      if (value.status === 'acknowledged') {
        if (value.acknowledgedAt === timestamp && value.acknowledgedBy === input.workerId
          && value.remoteMutationRef === remoteMutationRef
          && (value.acknowledgedRevision ?? null) === acknowledgedRevision
          && (value.serverCommittedAt ?? null) === serverCommittedAt) return value;
        throw new LocalDatabaseError('INVALID_OUTBOX_TRANSITION', 'acknowledge_outbox');
      }
      if (value.status !== 'claimed') throw new LocalDatabaseError('INVALID_OUTBOX_TRANSITION', 'acknowledge_outbox');
      if (value.leaseOwner !== input.workerId) throw new LocalDatabaseError('LEASE_OWNER_MISMATCH', 'acknowledge_outbox');
      return acknowledgeOutboxRecord(value, {
        ownerId: input.workerId, now: timestamp, remoteMutationRef, acknowledgedRevision, serverCommittedAt,
      });
    });
  }

  /**
   * Acknowledge a pushed mutation and advance the entity's server revision in
   * the same transaction. Older queued local revisions may be acknowledged
   * while a newer mutation remains the entity's pending authority.
   */
  async acknowledgeMutationAndEntity(input: AcknowledgeOutboxInput): Promise<{
    outbox: OutboxRecord;
    entity: LocalEntityEnvelope;
  }> {
    validateSafeIdentifier(input.workerId, 'acknowledge_outbox_entity');
    const timestamp = now(input.now);
    if (!input.remoteMutationRef || input.acknowledgedRevision === undefined
      || input.acknowledgedRevision === null || !input.serverCommittedAt) {
      throw new LocalDatabaseError('INVALID_OUTBOX_TRANSITION', 'acknowledge_outbox_entity');
    }
    validateSafeIdentifier(input.remoteMutationRef, 'acknowledge_outbox_entity');
    if (!Number.isSafeInteger(input.acknowledgedRevision) || input.acknowledgedRevision < 1) {
      throw new LocalDatabaseError('INVALID_OUTBOX_TRANSITION', 'acknowledge_outbox_entity');
    }
    now(input.serverCommittedAt);
    const transaction = this.db.transaction([
      LOCAL_DATABASE_STORES.databaseMeta, LOCAL_DATABASE_STORES.generations,
      LOCAL_DATABASE_STORES.entities, LOCAL_DATABASE_STORES.outbox, LOCAL_DATABASE_STORES.restoreSessions,
      LOCAL_DATABASE_STORES.conflicts,
    ], 'readwrite');
    const done = transactionCompletion(transaction, 'acknowledge_outbox_entity');
    try {
      await this.ensureActive(transaction);
      const outboxStore = transaction.objectStore(LOCAL_DATABASE_STORES.outbox);
      const outbox = await requestResult(outboxStore.get([
        this.namespaceKey, this.namespace.generationId, input.mutationId,
      ])) as OutboxRecord | undefined;
      if (!outbox) throw new LocalDatabaseError('OUTBOX_NOT_FOUND', 'acknowledge_outbox_entity');
      this.validatePersistedOutbox(outbox, 'acknowledge_outbox_entity');
      await this.validateRestoreBoundaryGraphs(transaction, [outbox]);
      if (outbox.status !== 'claimed' || outbox.leaseOwner !== input.workerId) {
        throw new LocalDatabaseError('LEASE_OWNER_MISMATCH', 'acknowledge_outbox_entity');
      }
      const entityStore = transaction.objectStore(LOCAL_DATABASE_STORES.entities);
      const entity = await requestResult(entityStore.get(entityKey(
        this.namespaceKey, this.namespace.generationId, outbox.domain, outbox.entityId,
      ))) as LocalEntityEnvelope | undefined;
      if (!entity) throw new LocalDatabaseError('ENTITY_NOT_FOUND', 'acknowledge_outbox_entity');
      this.validatePersistedEntity(entity, 'acknowledge_outbox_entity');
      if (entity.serverRevision !== null && entity.serverRevision !== undefined
        && input.acknowledgedRevision <= entity.serverRevision) {
        throw new LocalDatabaseError('STALE_REVISION', 'acknowledge_outbox_entity');
      }
      const acknowledged = acknowledgeOutboxRecord(outbox, {
        ownerId: input.workerId,
        now: timestamp,
        remoteMutationRef: input.remoteMutationRef,
        acknowledgedRevision: input.acknowledgedRevision,
        serverCommittedAt: input.serverCommittedAt,
      });
      const nextEntity: LocalEntityEnvelope = {
        ...entity,
        serverRevision: input.acknowledgedRevision,
        lastRemoteMutationRef: input.remoteMutationRef,
        pendingMutationId: entity.pendingMutationId === outbox.mutationId ? null : entity.pendingMutationId ?? null,
      };
      validateOutboxRecord(acknowledged);
      validateEntityEnvelope(nextEntity);
      outboxStore.put(acknowledged);
      entityStore.put(nextEntity);
      const conflictStore = transaction.objectStore(LOCAL_DATABASE_STORES.conflicts);
      const conflicts = await requestResult(conflictStore.index('by_namespace_generation_entity').getAll(
        IDBKeyRange.only([this.namespaceKey, this.namespace.generationId, outbox.domain, outbox.entityId]),
      )) as SyncConflictRecord[];
      for (const conflict of conflicts) {
        validateConflictRecord(conflict);
        if (conflict.accountId !== this.namespace.userId) {
          throw new LocalDatabaseError('NAMESPACE_MISMATCH', 'acknowledge_outbox_entity');
        }
        if (conflict.resolutionState === 'unresolved'
          && conflict.mutationId === outbox.mutationId
          && conflict.serverRevision === input.acknowledgedRevision
          && conflict.remoteMetadata?.remoteMutationRef === input.remoteMutationRef) {
          const resolved: SyncConflictRecord = {
            ...conflict, resolutionState: 'resolved_merged', resolvedAt: timestamp,
          };
          validateConflictRecord(resolved);
          conflictStore.put(resolved);
        }
      }
      await done;
      return { outbox: acknowledged, entity: nextEntity };
    } catch (error) {
      abortQuietly(transaction); await done.catch(() => undefined);
      throw localDatabaseError(error, 'acknowledge_outbox_entity');
    }
  }

  /** Persist transport conflict evidence and block the claimed mutation atomically. */
  async preserveMutationConflict(input: {
    mutationId: string;
    workerId: string;
    now: string;
    errorCode: string;
    conflictId: string;
    remoteCandidate: unknown;
    remoteMetadata?: Readonly<Record<string, unknown>>;
    serverRevision?: number | null;
  }): Promise<{ outbox: OutboxRecord; conflict: SyncConflictRecord }> {
    for (const value of [input.mutationId, input.workerId, input.errorCode, input.conflictId]) {
      validateSafeIdentifier(value, 'preserve_mutation_conflict');
    }
    const timestamp = now(input.now);
    const transaction = this.db.transaction([
      LOCAL_DATABASE_STORES.databaseMeta, LOCAL_DATABASE_STORES.generations,
      LOCAL_DATABASE_STORES.entities, LOCAL_DATABASE_STORES.outbox,
      LOCAL_DATABASE_STORES.restoreSessions, LOCAL_DATABASE_STORES.conflicts,
    ], 'readwrite');
    const done = transactionCompletion(transaction, 'preserve_mutation_conflict');
    try {
      await this.ensureActive(transaction);
      const outboxStore = transaction.objectStore(LOCAL_DATABASE_STORES.outbox);
      const outbox = await requestResult(outboxStore.get([
        this.namespaceKey, this.namespace.generationId, input.mutationId,
      ])) as OutboxRecord | undefined;
      if (!outbox) throw new LocalDatabaseError('OUTBOX_NOT_FOUND', 'preserve_mutation_conflict');
      this.validatePersistedOutbox(outbox, 'preserve_mutation_conflict');
      await this.validateRestoreBoundaryGraphs(transaction, [outbox]);
      if (outbox.status !== 'claimed' || outbox.leaseOwner !== input.workerId) {
        throw new LocalDatabaseError('LEASE_OWNER_MISMATCH', 'preserve_mutation_conflict');
      }
      const localCandidate = canonicalPayloadSnapshot(outbox.payload);
      const remoteCandidate = canonicalPayloadSnapshot(input.remoteCandidate);
      const remoteMetadata = input.remoteMetadata == null ? null : canonicalPayloadSnapshot(input.remoteMetadata);
      const conflict: SyncConflictRecord = {
        namespaceKey: this.namespaceKey,
        generationId: this.namespace.generationId,
        accountId: this.namespace.userId,
        conflictId: input.conflictId,
        domain: outbox.domain,
        entityId: outbox.entityId,
        mutationId: outbox.mutationId,
        localCandidate,
        remoteCandidate,
        remoteMetadata,
        localRevision: outbox.localRevision,
        serverRevision: input.serverRevision ?? null,
        localContentHash: hashCanonicalPayload(localCandidate),
        remoteContentHash: hashCanonicalPayload(remoteCandidate),
        conflictType: input.errorCode,
        createdAt: timestamp,
        resolutionState: 'unresolved',
        resolvedAt: null,
      };
      validateConflictRecord(conflict);
      const blocked = conflictOutboxRecord(outbox, {
        ownerId: input.workerId, now: timestamp, errorCode: input.errorCode,
      });
      validateOutboxRecord(blocked);
      outboxStore.put(blocked);
      transaction.objectStore(LOCAL_DATABASE_STORES.conflicts).add(conflict);
      await done;
      return { outbox: blocked, conflict };
    } catch (error) {
      abortQuietly(transaction); await done.catch(() => undefined);
      throw localDatabaseError(error, 'preserve_mutation_conflict');
    }
  }

  markPermanentFailure(input: FailOutboxInput): Promise<OutboxRecord> {
    validateSafeIdentifier(input.workerId, 'fail_outbox'); validateSafeIdentifier(input.errorCode, 'fail_outbox');
    const timestamp = now(input.now);
    return this.transitionOutbox(input.mutationId, 'fail_outbox', value => {
      if (value.status !== 'claimed') throw new LocalDatabaseError('INVALID_OUTBOX_TRANSITION', 'fail_outbox');
      if (value.leaseOwner !== input.workerId) throw new LocalDatabaseError('LEASE_OWNER_MISMATCH', 'fail_outbox');
      return permanentlyFailOutboxRecord(value, {
        ownerId: input.workerId, now: timestamp, errorCode: input.errorCode,
      });
    });
  }

  resetPermanentFailure(input: ResetOutboxInput): Promise<OutboxRecord> {
    const timestamp = now(input.now);
    return this.transitionOutbox(input.mutationId, 'reset_outbox', value => {
      if (value.deliveryBinding !== undefined) {
        throw new LocalDatabaseError('INVALID_OUTBOX_TRANSITION', 'reset_outbox');
      }
      if (value.status !== 'permanent_failure') throw new LocalDatabaseError('INVALID_OUTBOX_TRANSITION', 'reset_outbox');
      return { ...value, status: 'pending', updatedAt: timestamp, availableAt: timestamp, lastErrorCode: null };
    });
  }

  async restoreEntity<T>(mutation: Omit<EntityRestoreInput<T>, 'mode'>): Promise<LocalEntityEnvelope<T>> {
    return (await this.commitLocalMutation({ mutation: { ...mutation, mode: 'restore' }, now: mutation.timestamp ?? this.clock() })).entity;
  }

  markMutationConflict(input: FailOutboxInput): Promise<OutboxRecord> {
    validateSafeIdentifier(input.workerId, 'conflict_outbox'); validateSafeIdentifier(input.errorCode, 'conflict_outbox');
    const timestamp = now(input.now);
    return this.transitionOutbox(input.mutationId, 'conflict_outbox', value => conflictOutboxRecord(value, {
      ownerId: input.workerId, now: timestamp, errorCode: input.errorCode,
    }));
  }

  async supersedePendingMutation(olderMutationId: string, newerMutationId: string, at: string): Promise<OutboxRecord> {
    this.assertOpen('supersede_outbox'); validateSafeIdentifier(olderMutationId, 'supersede_outbox');
    validateSafeIdentifier(newerMutationId, 'supersede_outbox'); const timestamp = now(at);
    const stores = [LOCAL_DATABASE_STORES.databaseMeta, LOCAL_DATABASE_STORES.generations,
      LOCAL_DATABASE_STORES.entities, LOCAL_DATABASE_STORES.outbox, LOCAL_DATABASE_STORES.restoreSessions];
    const transaction = this.db.transaction(stores, 'readwrite');
    const done = transactionCompletion(transaction, 'supersede_outbox');
    try {
      await this.ensureActive(transaction);
      const store = transaction.objectStore(LOCAL_DATABASE_STORES.outbox);
      const [older, newer] = await Promise.all([
        requestResult(store.get([this.namespaceKey, this.namespace.generationId, olderMutationId])),
        requestResult(store.get([this.namespaceKey, this.namespace.generationId, newerMutationId])),
      ]) as [OutboxRecord | undefined, OutboxRecord | undefined];
      if (!older || !newer) throw new LocalDatabaseError('OUTBOX_NOT_FOUND', 'supersede_outbox');
      this.validatePersistedOutbox(older, 'supersede_outbox'); this.validatePersistedOutbox(newer, 'supersede_outbox');
      const updated = supersedeOutboxRecord(older, newer, timestamp);
      validateOutboxRecord(updated);
      store.put(updated);
      const range = IDBKeyRange.bound(
        [this.namespaceKey, this.namespace.generationId, ''],
        [this.namespaceKey, this.namespace.generationId, '\uffff'],
      );
      const scoped = await requestResult(store.getAll(range, MAX_OUTBOX_SCAN + 1)) as OutboxRecord[];
      if (scoped.length > MAX_OUTBOX_SCAN) throw new LocalDatabaseError('INVALID_OUTBOX_QUERY', 'supersede_outbox');
      for (const value of scoped) {
        if (value.dependsOnMutationId !== olderMutationId) continue;
        if (value.status !== 'pending') throw new LocalDatabaseError('INVALID_OUTBOX_TRANSITION', 'supersede_outbox');
        const rebound = {
          ...value,
          dependsOnMutationId: newerMutationId,
          updatedAt: timestamp,
          availableAt: timestamp,
        };
        validateOutboxRecord(rebound);
        store.put(rebound);
      }
      await done; return updated;
    } catch (error) {
      abortQuietly(transaction); await done.catch(() => undefined); throw localDatabaseError(error, 'supersede_outbox');
    }
  }

  /**
   * Replace a stale profile prerequisite and atomically move every live
   * tombstone dependency to the corrected request. This is intentionally not
   * part of normal supersede semantics.
   */
  async reconcileOutboxPrerequisite<T>(
    input: ReconcileOutboxPrerequisiteInput<T>,
  ): Promise<ReconciledOutboxPrerequisite<T>> {
    const operation = 'reconcile_outbox_prerequisite';
    this.assertOpen(operation);
    validateSafeIdentifier(input.prerequisiteMutationId, operation);
    validateSafeIdentifier(input.remoteMutationRef, operation);
    const timestamp = now(input.now);
    if (!Number.isSafeInteger(input.expectedEntityRevision) || input.expectedEntityRevision < 1
      || !Number.isSafeInteger(input.remoteServerRevision) || input.remoteServerRevision < 1) {
      throw new LocalDatabaseError('INVALID_OUTBOX_TRANSITION', operation);
    }
    const correctedRecord = canonicalPayloadSnapshot(input.correctedRecord);
    const remoteRecord = canonicalPayloadSnapshot(input.remoteRecord);
    const stores = [
      LOCAL_DATABASE_STORES.databaseMeta, LOCAL_DATABASE_STORES.generations,
      LOCAL_DATABASE_STORES.entities, LOCAL_DATABASE_STORES.outbox,
      LOCAL_DATABASE_STORES.restoreSessions, LOCAL_DATABASE_STORES.conflicts,
    ];
    const transaction = this.db.transaction(stores, 'readwrite');
    const done = transactionCompletion(transaction, operation);
    try {
      await this.ensureActive(transaction);
      const outboxStore = transaction.objectStore(LOCAL_DATABASE_STORES.outbox);
      const entityStore = transaction.objectStore(LOCAL_DATABASE_STORES.entities);
      const old = await requestResult(outboxStore.get([
        this.namespaceKey, this.namespace.generationId, input.prerequisiteMutationId,
      ])) as OutboxRecord | undefined;
      if (!old) throw new LocalDatabaseError('OUTBOX_NOT_FOUND', operation);
      this.validatePersistedOutbox(old, operation);
      if (old.domain !== HEALTH_PROFILE_RECONCILIATION_DOMAIN
        || old.entityId !== HEALTH_PROFILE_RECONCILIATION_ENTITY_ID
        || old.status !== input.prerequisiteStatus || old.operation !== 'upsert'
        || old.dependsOnMutationId != null || old.payload.kind !== 'entity_snapshot') {
        throw new LocalDatabaseError('INVALID_OUTBOX_TRANSITION', operation);
      }
      const entity = await requestResult(entityStore.get(entityKey(
        this.namespaceKey, this.namespace.generationId, old.domain, old.entityId,
      ))) as LocalEntityEnvelope<T> | undefined;
      if (!entity) throw new LocalDatabaseError('ENTITY_NOT_FOUND', operation);
      this.validatePersistedEntity(entity, operation);
      if (entity.revision !== input.expectedEntityRevision || entity.isDeleted
        || (input.prerequisiteStatus === 'acknowledged' && entity.pendingMutationId !== null)
        || entity.serverRevision == null
        || entity.serverRevision != null && input.remoteServerRevision < entity.serverRevision
        || input.prerequisiteStatus === 'conflict' && entity.serverRevision === input.remoteServerRevision
        || input.prerequisiteStatus === 'acknowledged'
          && entity.serverRevision === input.remoteServerRevision
          && entity.lastRemoteMutationRef !== input.remoteMutationRef) {
        throw new LocalDatabaseError('STALE_REVISION', operation);
      }

      const scoped = await this.readScopedOutbox(transaction, operation);
      const entityHistory = scoped.filter(value => value.domain === old.domain && value.entityId === old.entityId)
        .sort((left, right) => left.localRevision - right.localRevision);
      const oldIndex = entityHistory.findIndex(value => value.mutationId === old.mutationId);
      if (oldIndex < 0 || (input.prerequisiteStatus === 'acknowledged'
        && entityHistory[entityHistory.length - 1]?.mutationId !== old.mutationId)) {
        throw new LocalDatabaseError('INVALID_OUTBOX_TRANSITION', operation);
      }
      const byMutationId = new Map(scoped.map(value => [value.mutationId, value]));
      const liveStatuses = new Set<OutboxStatus>(['pending', 'retry_wait']);
      const oldDependents = scoped.filter(value => value.dependsOnMutationId === old.mutationId
        && liveStatuses.has(value.status));
      if (oldDependents.length === 0) {
        throw new LocalDatabaseError('INVALID_OUTBOX_TRANSITION', operation);
      }

      const payload = { kind: 'entity_snapshot' as const, record: correctedRecord };
      const payloadHash = hashCanonicalPayload(payload);
      let existingSuccessor: OutboxRecord | null = null;
      if (input.prerequisiteStatus === 'conflict' && entity.pendingMutationId !== old.mutationId) {
        const pendingMutationId = entity.pendingMutationId;
        if (!pendingMutationId) throw new LocalDatabaseError('STALE_REVISION', operation);
        const visited = new Set<string>();
        let candidate = byMutationId.get(pendingMutationId);
        while (candidate?.status === 'superseded') {
          if (visited.has(candidate.mutationId) || !candidate.supersededByMutationId) {
            throw new LocalDatabaseError('OUTBOX_SEQUENCE_GAP', operation);
          }
          visited.add(candidate.mutationId);
          const successor = byMutationId.get(candidate.supersededByMutationId);
          if (!successor || successor.namespaceKey !== candidate.namespaceKey
            || successor.generationId !== candidate.generationId
            || successor.domain !== candidate.domain || successor.entityId !== candidate.entityId
            || successor.localRevision <= candidate.localRevision) {
            throw new LocalDatabaseError('OUTBOX_SEQUENCE_GAP', operation);
          }
          candidate = successor;
        }
        if (!candidate || candidate.domain !== old.domain || candidate.entityId !== old.entityId
          || candidate.localRevision <= old.localRevision || candidate.localRevision !== entity.revision
          || candidate.operation !== 'upsert' || candidate.payload.kind !== 'entity_snapshot') {
          throw new LocalDatabaseError('INVALID_OUTBOX_TRANSITION', operation);
        }
        existingSuccessor = candidate;
      }

      // A successor blocked behind the conflicted head has never been sent.
      // Its immutable request identity can therefore be retained while the
      // entity's server boundary is advanced atomically below.
      const canAdoptExisting = existingSuccessor?.status === 'pending'
        && existingSuccessor.attemptCount === 0
        && hashCanonicalPayload(existingSuccessor.payload) === payloadHash
        && hashCanonicalPayload(entity.record) === hashCanonicalPayload(correctedRecord)
        && entityHistory[entityHistory.length - 1]?.mutationId === existingSuccessor.mutationId;
      let replacement: OutboxRecord;
      let createdReplacement = false;
      if (canAdoptExisting && existingSuccessor) {
        replacement = existingSuccessor;
      } else {
        const localRevision = entity.revision + 1;
        if (!Number.isSafeInteger(localRevision)) throw new LocalDatabaseError('INVALID_ENTITY', operation);
        const identity = {
          namespaceKey: this.namespaceKey, generationId: this.namespace.generationId,
          domain: old.domain, entityId: old.entityId, localRevision, operation: 'upsert' as const, payloadHash,
        };
        replacement = {
          namespaceKey: this.namespaceKey, generationId: this.namespace.generationId,
          accountId: this.namespace.userId, deviceId: this.namespace.deviceId,
          mutationId: deriveOutboxMutationId(identity), domain: old.domain, entityId: old.entityId, operation: 'upsert',
          baseRevision: entity.revision, localRevision, payloadMode: 'inline', payload, payloadHash,
          createdAt: timestamp, updatedAt: timestamp, availableAt: timestamp,
          attemptCount: 0, status: 'pending', idempotencyKey: deriveOutboxIdempotencyKey(identity),
          lastAttemptAt: null, lastErrorCode: null, leaseOwner: null, leaseExpiresAt: null,
          acknowledgedAt: null, acknowledgedBy: null, remoteMutationRef: null,
          acknowledgedRevision: null, serverCommittedAt: null, supersededByMutationId: null,
          remoteSequenceBoundary: {
            kind: 'remote_entity_sequence_boundary', namespaceKey: this.namespaceKey,
            generationId: this.namespace.generationId, domain: old.domain, entityId: old.entityId,
            baselineLocalRevision: entity.revision, baselineServerRevision: input.remoteServerRevision,
            remoteMutationRef: input.remoteMutationRef,
            baselineContentHash: hashCanonicalPayload(remoteRecord), createdAt: timestamp,
          },
        };
        createdReplacement = true;
      }
      validateOutboxRecord(replacement);

      const obsoleteProfileRecords = input.prerequisiteStatus === 'conflict'
        ? entityHistory.slice(oldIndex).filter(value => value.mutationId !== replacement.mutationId)
        : [];
      const profileUpdates = new Map<string, OutboxRecord>();
      for (const value of obsoleteProfileRecords) {
        let updated: OutboxRecord;
        if (value.status === 'conflict') {
          updated = replacement.baseRevision === value.localRevision
            && replacement.localRevision === value.localRevision + 1
            ? replaceConflictedOutboxRecord(value, replacement, timestamp)
            : adoptConflictedOutboxSuccessor(value, replacement, timestamp);
        } else if (value.status === 'pending' && value.attemptCount === 0) {
          updated = supersedeOutboxRecord(value, replacement, timestamp);
        } else if (value.status === 'superseded') {
          updated = value;
        } else {
          throw new LocalDatabaseError('INVALID_OUTBOX_TRANSITION', operation);
        }
        validateOutboxRecord(updated);
        profileUpdates.set(updated.mutationId, updated);
      }
      const prerequisite = profileUpdates.get(old.mutationId) ?? old;
      const supersededProfileIds = new Set(obsoleteProfileRecords.map(value => value.mutationId));
      if (input.prerequisiteStatus === 'acknowledged') supersededProfileIds.add(old.mutationId);
      const dependents = scoped.filter(value => value.dependsOnMutationId != null
        && supersededProfileIds.has(value.dependsOnMutationId)
        && liveStatuses.has(value.status));
      if (dependents.length === 0 || dependents.some(value => value.operation !== 'tombstone'
        || value.status === 'pending' && value.attemptCount !== 0)) {
        throw new LocalDatabaseError('INVALID_OUTBOX_TRANSITION', operation);
      }
      const rebound: OutboxRecord[] = [];
      const replacedDependents: OutboxRecord[] = [];
      const dependentEntities: LocalEntityEnvelope[] = [];
      for (const value of dependents) {
        if (value.status === 'retry_wait') {
          if (value.lastErrorCode !== 'ACTIVE_PRESET_DELETE_REQUIRES_PROFILE_UPDATE'
            || value.payload.kind !== 'tombstone') {
            throw new LocalDatabaseError('INVALID_OUTBOX_TRANSITION', operation);
          }
          const dependentEntity = await requestResult(entityStore.get(entityKey(
            this.namespaceKey, this.namespace.generationId, value.domain, value.entityId,
          ))) as LocalEntityEnvelope | undefined;
          if (!dependentEntity) throw new LocalDatabaseError('ENTITY_NOT_FOUND', operation);
          this.validatePersistedEntity(dependentEntity, operation);
          if (dependentEntity.pendingMutationId !== value.mutationId
            || dependentEntity.revision !== value.localRevision || !dependentEntity.isDeleted) {
            throw new LocalDatabaseError('STALE_REVISION', operation);
          }
          const dependentLocalRevision = value.localRevision + 1;
          const dependentPayload = {
            kind: 'tombstone' as const,
            entityId: value.entityId,
            deletedAt: value.payload.deletedAt,
            revision: dependentLocalRevision,
          };
          const dependentPayloadHash = hashCanonicalPayload(dependentPayload);
          const dependentIdentity = {
            namespaceKey: this.namespaceKey, generationId: this.namespace.generationId,
            domain: value.domain, entityId: value.entityId, localRevision: dependentLocalRevision,
            operation: 'tombstone' as const, payloadHash: dependentPayloadHash,
          };
          const retried: OutboxRecord = {
            namespaceKey: this.namespaceKey, generationId: this.namespace.generationId,
            accountId: this.namespace.userId, deviceId: this.namespace.deviceId,
            mutationId: deriveOutboxMutationId(dependentIdentity),
            domain: value.domain, entityId: value.entityId, operation: 'tombstone',
            baseRevision: value.localRevision, localRevision: dependentLocalRevision,
            payloadMode: 'inline', payload: dependentPayload, payloadHash: dependentPayloadHash,
            createdAt: timestamp, updatedAt: timestamp, availableAt: timestamp,
            attemptCount: 0, status: 'pending', idempotencyKey: deriveOutboxIdempotencyKey(dependentIdentity),
            lastAttemptAt: null, lastErrorCode: null, leaseOwner: null, leaseExpiresAt: null,
            acknowledgedAt: null, acknowledgedBy: null, remoteMutationRef: null,
            acknowledgedRevision: null, serverCommittedAt: null, supersededByMutationId: null,
            dependsOnMutationId: replacement.mutationId,
          };
          validateOutboxRecord(retried);
          const superseded = replaceRejectedDependentOutboxRecord(value, retried, timestamp);
          validateOutboxRecord(superseded);
          replacedDependents.push(superseded);
          rebound.push(retried);
          const nextDependentEntity: LocalEntityEnvelope = {
            ...dependentEntity,
            revision: dependentLocalRevision,
            localRevision: dependentLocalRevision,
            updatedAt: timestamp,
            pendingMutationId: retried.mutationId,
          };
          validateEntityEnvelope(nextDependentEntity);
          dependentEntities.push(nextDependentEntity);
          continue;
        }
        const next: OutboxRecord = {
          ...value,
          status: 'pending',
          dependsOnMutationId: replacement.mutationId,
          updatedAt: timestamp,
          availableAt: timestamp,
          lastErrorCode: null,
          leaseOwner: null,
          leaseExpiresAt: null,
        };
        validateOutboxRecord(next);
        rebound.push(next);
      }
      const reboundById = new Map(rebound.map(value => [value.mutationId, value]));
      const supersededDependentById = new Map(replacedDependents.map(value => [value.mutationId, value]));
      const nextScoped = scoped.map(value => profileUpdates.get(value.mutationId)
        ?? supersededDependentById.get(value.mutationId) ?? reboundById.get(value.mutationId) ?? value);
      if (createdReplacement) nextScoped.push(replacement);
      nextScoped.push(...rebound.filter(value => !scoped.some(oldValue => oldValue.mutationId === value.mutationId)));
      this.validateOutboxSequences(nextScoped, operation);
      this.validateOutboxDependencies(nextScoped, operation);

      const nextRevision = createdReplacement ? replacement.localRevision : entity.revision;
      const nextEntity: LocalEntityEnvelope<T> = {
        ...entity,
        record: correctedRecord as T,
        revision: nextRevision,
        localRevision: nextRevision,
        serverRevision: input.remoteServerRevision,
        updatedAt: timestamp,
        contentHash: hashCanonicalPayload(correctedRecord),
        pendingMutationId: replacement.mutationId,
        lastRemoteMutationRef: input.remoteMutationRef,
        source: { kind: 'local', reference: 'conflict-reconciliation' },
      };
      validateEntityEnvelope(nextEntity);
      profileUpdates.forEach(value => outboxStore.put(value));
      if (createdReplacement) outboxStore.add(replacement);
      replacedDependents.forEach(value => outboxStore.put(value));
      rebound.forEach(value => {
        if (scoped.some(oldValue => oldValue.mutationId === value.mutationId)) outboxStore.put(value);
        else outboxStore.add(value);
      });
      entityStore.put(nextEntity);
      dependentEntities.forEach(value => entityStore.put(value));

      const conflictStore = transaction.objectStore(LOCAL_DATABASE_STORES.conflicts);
      const conflicts = await requestResult(conflictStore.index('by_namespace_generation_entity').getAll(
        IDBKeyRange.only([this.namespaceKey, this.namespace.generationId, old.domain, old.entityId]),
      )) as SyncConflictRecord[];
      for (const conflict of conflicts) {
        validateConflictRecord(conflict);
        if (conflict.accountId !== this.namespace.userId) throw new LocalDatabaseError('NAMESPACE_MISMATCH', operation);
        if (conflict.mutationId != null && supersededProfileIds.has(conflict.mutationId)
          && conflict.resolutionState === 'unresolved') {
          const resolved: SyncConflictRecord = {
            ...conflict, resolutionState: 'resolved_merged', resolvedAt: timestamp,
          };
          validateConflictRecord(resolved);
          conflictStore.put(resolved);
        }
      }
      await done;
      return { prerequisite, replacement, entity: nextEntity, dependents: rebound };
    } catch (error) {
      abortQuietly(transaction); await done.catch(() => undefined);
      throw localDatabaseError(error, operation);
    }
  }

  private async putGenerationReserved<T>(storeName: string, value: T, validate: (record: T) => void): Promise<void> {
    this.assertOpen('put_reserved_record');
    const scoped = value as { namespaceKey?: unknown; generationId?: unknown };
    if (scoped.namespaceKey !== this.namespaceKey || scoped.generationId !== this.namespace.generationId) {
      throw new LocalDatabaseError('NAMESPACE_MISMATCH', 'put_reserved_record');
    }
    const transaction = this.db.transaction([LOCAL_DATABASE_STORES.databaseMeta, LOCAL_DATABASE_STORES.generations, storeName], 'readwrite');
    const done = transactionCompletion(transaction, 'put_reserved_record');
    try { await this.ensureActive(transaction); validate(value); transaction.objectStore(storeName).put(value); await done; }
    catch (error) { abortQuietly(transaction); await done.catch(() => undefined); throw localDatabaseError(error, 'put_reserved_record'); }
  }

  putSyncCheckpoint(value: SyncCheckpointRecord): Promise<void> {
    if (value.accountId !== this.namespace.userId) {
      return Promise.reject(new LocalDatabaseError('NAMESPACE_MISMATCH', 'put_checkpoint'));
    }
    return this.putGenerationReserved(LOCAL_DATABASE_STORES.syncCheckpoints, value, validateCheckpoint);
  }
  putAttachmentState(value: AttachmentStateRecord): Promise<void> { return this.putGenerationReserved(LOCAL_DATABASE_STORES.attachmentState, value, validateAttachmentState); }

  async getSyncCheckpoint(provider: string, stream: string): Promise<SyncCheckpointRecord | null> {
    this.assertOpen('get_checkpoint'); validateSafeIdentifier(provider, 'get_checkpoint'); validateSafeIdentifier(stream, 'get_checkpoint');
    const transaction = this.db.transaction(LOCAL_DATABASE_STORES.syncCheckpoints, 'readonly');
    const done = transactionCompletion(transaction, 'get_checkpoint');
    const value = await requestResult(transaction.objectStore(LOCAL_DATABASE_STORES.syncCheckpoints)
      .get(checkpointKey(this.namespaceKey, this.namespace.generationId, provider, stream))) as SyncCheckpointRecord | undefined;
    await done;
    if (value) {
      validateCheckpoint(value);
      if (value.namespaceKey !== this.namespaceKey || value.generationId !== this.namespace.generationId
        || value.accountId !== undefined && value.accountId !== this.namespace.userId) {
        throw new LocalDatabaseError('NAMESPACE_MISMATCH', 'get_checkpoint');
      }
    }
    return value ?? null;
  }

  async advanceSyncCheckpoint(input: AdvanceCheckpointInput): Promise<SyncCheckpointRecord> {
    this.assertOpen('advance_checkpoint'); validateSafeIdentifier(input.provider, 'advance_checkpoint');
    validateSafeIdentifier(input.stream, 'advance_checkpoint'); validateSafeIdentifier(input.checkpointValue, 'advance_checkpoint');
    if (input.serverEpoch !== null) validateSafeIdentifier(input.serverEpoch, 'advance_checkpoint');
    if (!Number.isSafeInteger(input.sequence) || input.sequence < 0) {
      throw new LocalDatabaseError('CHECKPOINT_REGRESSION', 'advance_checkpoint');
    }
    const timestamp = now(input.now);
    const transaction = this.db.transaction([
      LOCAL_DATABASE_STORES.databaseMeta, LOCAL_DATABASE_STORES.generations, LOCAL_DATABASE_STORES.syncCheckpoints,
    ], 'readwrite');
    const done = transactionCompletion(transaction, 'advance_checkpoint');
    try {
      await this.ensureActive(transaction);
      const record = await this.advanceCheckpointInTransaction(transaction, input, timestamp, true, 'advance_checkpoint');
      if (input.testOnlyAbort) { transaction.abort(); throw new LocalDatabaseError('TRANSACTION_ABORTED', 'advance_checkpoint'); }
      await done; return record;
    } catch (error) {
      abortQuietly(transaction); await done.catch(() => undefined); throw localDatabaseError(error, 'advance_checkpoint');
    }
  }

  private async advanceCheckpointInTransaction(
    transaction: IDBTransaction,
    input: Omit<AdvanceCheckpointInput, 'testOnlyAbort'>,
    timestamp: string,
    allowIdempotent: boolean,
    operation: string,
  ): Promise<SyncCheckpointRecord> {
    const store = transaction.objectStore(LOCAL_DATABASE_STORES.syncCheckpoints);
    const key = checkpointKey(this.namespaceKey, this.namespace.generationId, input.provider, input.stream);
    const current = await requestResult(store.get(key)) as SyncCheckpointRecord | undefined;
    if (current) {
      validateCheckpoint(current);
      if (current.accountId !== undefined && current.accountId !== this.namespace.userId) {
        throw new LocalDatabaseError('NAMESPACE_MISMATCH', operation);
      }
      const currentSequence = current.sequence ?? 0;
      const invalidated = current.invalidatedAt != null;
      if (!invalidated && current.serverEpoch !== input.serverEpoch) {
        throw new LocalDatabaseError('SERVER_EPOCH_MISMATCH', operation);
      }
      if (!invalidated && input.sequence < currentSequence) {
        throw new LocalDatabaseError('CHECKPOINT_REGRESSION', operation);
      }
      if (!invalidated && input.sequence === currentSequence) {
        if (allowIdempotent && current.checkpointValue === input.checkpointValue) return current;
        throw new LocalDatabaseError('CHECKPOINT_REGRESSION', operation);
      }
    }
    const record: SyncCheckpointRecord = {
      namespaceKey: this.namespaceKey, generationId: this.namespace.generationId, accountId: this.namespace.userId,
      provider: input.provider, stream: input.stream, checkpointValue: input.checkpointValue,
      sequence: input.sequence, serverEpoch: input.serverEpoch, updatedAt: timestamp,
      invalidatedAt: null, invalidationReason: null,
    };
    validateCheckpoint(record); store.put(record); return record;
  }

  async commitRemoteEntityBatch<T>(input: CommitRemoteEntityBatchInput<T>): Promise<CommittedRemoteEntityBatch<T>> {
    const operation = 'commit_remote_entity_batch';
    this.assertOpen(operation);
    const batch = snapshotRemoteEntityBatchInput(input);
    if (batch.namespaceKey !== this.namespaceKey || batch.accountId !== this.namespace.userId) {
      throw new LocalDatabaseError('NAMESPACE_MISMATCH', operation);
    }
    if (batch.generationId !== this.namespace.generationId) throw new LocalDatabaseError('STALE_GENERATION', operation);
    validateSafeIdentifier(batch.domain, operation); validateSafeIdentifier(batch.provider, operation);
    validateSafeIdentifier(batch.checkpointValue, operation);
    if (batch.serverEpoch !== null) validateSafeIdentifier(batch.serverEpoch, operation);
    if (!Number.isSafeInteger(batch.sequence) || batch.sequence < 0 || batch.entities.length > MAX_REMOTE_ENTITY_BATCH) {
      throw new LocalDatabaseError('INVALID_RESERVED_RECORD', operation);
    }
    const timestamp = now(batch.now);
    const seen = new Set<string>();
    const entities = batch.entities.map(item => {
      const entity = item.entity;
      validateEntityEnvelope(entity);
      if (entity.namespaceKey !== batch.namespaceKey || entity.generationId !== batch.generationId
        || entity.accountId !== batch.accountId || entity.domain !== batch.domain) {
        throw new LocalDatabaseError('NAMESPACE_MISMATCH', operation);
      }
      if (seen.has(entity.entityId)) throw new LocalDatabaseError('INVALID_ENTITY', operation);
      seen.add(entity.entityId);
      if (item.expectedLocalRevision !== null
        && (!Number.isSafeInteger(item.expectedLocalRevision) || item.expectedLocalRevision < 1)) {
        throw new LocalDatabaseError('STALE_REVISION', operation);
      }
      const expectedRevision = (item.expectedLocalRevision ?? 0) + 1;
      if (entity.revision !== expectedRevision || entity.localRevision !== expectedRevision
        || entity.serverRevision === null || entity.pendingMutationId !== null
        || Date.parse(entity.updatedAt) < Date.parse(entity.createdAt)) {
        throw new LocalDatabaseError('INVALID_ENTITY', operation);
      }
      return { expectedLocalRevision: item.expectedLocalRevision, entity };
    });
    const transaction = this.db.transaction([
      LOCAL_DATABASE_STORES.databaseMeta, LOCAL_DATABASE_STORES.generations,
      LOCAL_DATABASE_STORES.entities, LOCAL_DATABASE_STORES.syncCheckpoints,
    ], 'readwrite');
    const done = transactionCompletion(transaction, operation);
    try {
      await this.ensureActive(transaction);
      const store = transaction.objectStore(LOCAL_DATABASE_STORES.entities);
      for (const item of entities) {
        const key = entityKey(this.namespaceKey, this.namespace.generationId, batch.domain, item.entity.entityId);
        const current = await requestResult(store.get(key)) as LocalEntityEnvelope<T> | undefined;
        if (current) this.validatePersistedEntity(current, operation);
        if ((current?.revision ?? null) !== item.expectedLocalRevision
          || current && current.createdAt !== item.entity.createdAt) {
          throw new LocalDatabaseError('STALE_REVISION', operation);
        }
        store.put(item.entity);
      }
      if (batch.testOnlyAbortAt === 'before_checkpoint') {
        transaction.abort(); throw new LocalDatabaseError('TRANSACTION_ABORTED', operation);
      }
      const checkpoint = await this.advanceCheckpointInTransaction(transaction, {
        provider: batch.provider, stream: batch.domain, checkpointValue: batch.checkpointValue,
        sequence: batch.sequence, serverEpoch: batch.serverEpoch, now: batch.now,
      }, timestamp, entities.length === 0, operation);
      if (batch.testOnlyAbortAt === 'after_checkpoint') {
        transaction.abort(); throw new LocalDatabaseError('TRANSACTION_ABORTED', operation);
      }
      await done; return { entities: entities.map(item => item.entity), checkpoint };
    } catch (error) {
      abortQuietly(transaction); await done.catch(() => undefined); throw localDatabaseError(error, operation);
    }
  }

  private quarantineAttemptedUnbound(transaction: IDBTransaction, values: OutboxRecord[]): OutboxRecord[] {
    const store = transaction.objectStore(LOCAL_DATABASE_STORES.outbox);
    return values.map(value => {
      if (value.deliveryBinding?.state !== 'unbound'
        || value.attemptCount === 0 && value.lastAttemptAt === null
        || value.deliveryBlockCode === 'UNBOUND_ATTEMPT_QUARANTINED') return value;
      const updated: OutboxRecord = { ...value, deliveryBlockCode: 'UNBOUND_ATTEMPT_QUARANTINED' };
      validateOutboxRecord(updated);
      store.put(updated);
      return updated;
    });
  }

  async commitRemoteConvergenceBatch<T>(
    input: CommitRemoteConvergenceBatchInput<T>,
  ): Promise<CommittedRemoteConvergenceBatch<T>> {
    const operation = 'commit_remote_convergence_batch';
    this.assertOpen(operation);
    const batch = snapshotRemoteConvergenceBatchInput(input);
    if (batch.namespaceKey !== this.namespaceKey || batch.accountId !== this.namespace.userId) {
      throw new LocalDatabaseError('NAMESPACE_MISMATCH', operation);
    }
    if (batch.generationId !== this.namespace.generationId) throw new LocalDatabaseError('STALE_GENERATION', operation);
    validateSafeIdentifier(batch.domain, operation);
    validateSafeIdentifier(batch.provider, operation);
    validateSafeIdentifier(batch.checkpointValue, operation);
    if (batch.serverEpoch !== null) validateSafeIdentifier(batch.serverEpoch, operation);
    if (!Number.isSafeInteger(batch.sequence) || batch.sequence < 0
      || batch.changes.length === 0 || batch.changes.length > MAX_REMOTE_ENTITY_BATCH) {
      throw new LocalDatabaseError('INVALID_RESERVED_RECORD', operation);
    }
    const timestamp = now(batch.now);
    const seen = new Set<string>();
    for (const change of batch.changes) {
      const candidate = change.candidate;
      if (typeof candidate.entityId !== 'string' || candidate.entityId.length === 0 || candidate.entityId.length > 512
        || !Number.isSafeInteger(candidate.serverRevision) || candidate.serverRevision < 1
        || candidate.remoteMutationRef !== null && typeof candidate.remoteMutationRef !== 'string'
        || !validTimestamp(candidate.createdAt) || !validTimestamp(candidate.updatedAt)
        || candidate.deletedAt !== null && !validTimestamp(candidate.deletedAt)
        || Date.parse(candidate.updatedAt) < Date.parse(candidate.createdAt)
        || candidate.deletedAt !== null && (Date.parse(candidate.deletedAt) < Date.parse(candidate.createdAt)
          || Date.parse(candidate.updatedAt) < Date.parse(candidate.deletedAt))) {
        throw new LocalDatabaseError('INVALID_ENTITY', operation);
      }
      if (candidate.remoteMutationRef !== null) validateSafeIdentifier(candidate.remoteMutationRef, operation);
      if (candidate.ownerId != null) validateSafeIdentifier(candidate.ownerId, operation);
      validateSafeSource(candidate.source);
      if (change.expectedLocalRevision !== null
        && (!Number.isSafeInteger(change.expectedLocalRevision) || change.expectedLocalRevision < 1)) {
        throw new LocalDatabaseError('STALE_REVISION', operation);
      }
      if (seen.has(candidate.entityId)) throw new LocalDatabaseError('INVALID_ENTITY', operation);
      seen.add(candidate.entityId);
    }

    const transaction = this.db.transaction([
      LOCAL_DATABASE_STORES.databaseMeta,
      LOCAL_DATABASE_STORES.generations,
      LOCAL_DATABASE_STORES.entities,
      LOCAL_DATABASE_STORES.outbox,
      LOCAL_DATABASE_STORES.conflicts,
      LOCAL_DATABASE_STORES.syncCheckpoints,
      LOCAL_DATABASE_STORES.restoreSessions,
    ], 'readwrite');
    const done = transactionCompletion(transaction, operation);
    try {
      await this.ensureActive(transaction);
      const outboxRecords = await this.readScopedOutbox(transaction, operation);
      const entitiesStore = transaction.objectStore(LOCAL_DATABASE_STORES.entities);
      const conflictsStore = transaction.objectStore(LOCAL_DATABASE_STORES.conflicts);
      const appliedEntities: LocalEntityEnvelope<T>[] = [];
      const conflicts: SyncConflictRecord[] = [];

      for (const change of batch.changes) {
        const candidate = change.candidate;
        const key = entityKey(this.namespaceKey, this.namespace.generationId, batch.domain, candidate.entityId);
        const current = await requestResult(entitiesStore.get(key)) as LocalEntityEnvelope<T> | undefined;
        if (current) this.validatePersistedEntity(current, operation);
        if ((current?.revision ?? null) !== change.expectedLocalRevision) {
          throw new LocalDatabaseError('STALE_REVISION', operation);
        }
        if (candidate.serverRevision <= (current?.serverRevision ?? 0)) {
          throw new LocalDatabaseError('STALE_REVISION', operation);
        }

        const unsettled = outboxRecords.filter(record => record.domain === batch.domain
          && record.entityId === candidate.entityId
          && record.status !== 'acknowledged' && record.status !== 'superseded')
          .sort((left, right) => left.localRevision - right.localRevision);
        if (current?.pendingMutationId !== null && current?.pendingMutationId !== undefined
          && !unsettled.some(record => record.mutationId === current.pendingMutationId)) {
          throw new LocalDatabaseError('CORRUPT_PERSISTED_RECORD', operation);
        }

        const hasPendingLocal = current?.pendingMutationId != null || unsettled.length > 0;
        if (hasPendingLocal) {
          if (!current) throw new LocalDatabaseError('CORRUPT_PERSISTED_RECORD', operation);
          const localCandidate = canonicalPayloadSnapshot({ entity: current, outbox: unsettled });
          const remoteCandidate = canonicalPayloadSnapshot({
            kind: 'remote_entity_candidate',
            entityId: candidate.entityId,
            record: candidate.record,
            serverRevision: candidate.serverRevision,
            remoteMutationRef: candidate.remoteMutationRef,
            createdAt: candidate.createdAt,
            updatedAt: candidate.updatedAt,
            deletedAt: candidate.deletedAt,
            isDeleted: candidate.deletedAt !== null,
            contentHash: hashCanonicalPayload(candidate.record),
            ownerId: candidate.ownerId ?? null,
            source: candidate.source ?? null,
          });
          const conflictId = `conflict.${sha256Hex(canonicalPayloadJson({
            namespaceKey: this.namespaceKey,
            generationId: this.namespace.generationId,
            domain: batch.domain,
            provider: batch.provider,
            serverEpoch: batch.serverEpoch,
            entityId: candidate.entityId,
            sequence: batch.sequence,
            serverRevision: candidate.serverRevision,
            remoteMutationRef: candidate.remoteMutationRef,
            remoteContentHash: hashCanonicalPayload(remoteCandidate),
          }))}`;
          const conflict: SyncConflictRecord = {
            namespaceKey: this.namespaceKey,
            generationId: this.namespace.generationId,
            accountId: this.namespace.userId,
            conflictId,
            domain: batch.domain,
            entityId: candidate.entityId,
            mutationId: current.pendingMutationId ?? unsettled[unsettled.length - 1]?.mutationId ?? null,
            localCandidate,
            remoteCandidate,
            remoteMetadata: canonicalPayloadSnapshot({
              provider: batch.provider,
              stream: batch.domain,
              sequence: batch.sequence,
              serverEpoch: batch.serverEpoch,
              serverRevision: candidate.serverRevision,
              remoteMutationRef: candidate.remoteMutationRef,
              contentHash: hashCanonicalPayload(candidate.record),
              isDeleted: candidate.deletedAt !== null,
              deletedAt: candidate.deletedAt,
              ownerId: candidate.ownerId ?? null,
              source: candidate.source ?? null,
            }),
            localRevision: current.revision,
            serverRevision: candidate.serverRevision,
            localContentHash: hashCanonicalPayload(localCandidate),
            remoteContentHash: hashCanonicalPayload(remoteCandidate),
            conflictType: candidate.deletedAt === null ? 'remote_change_with_pending_local' : 'remote_delete_with_pending_local',
            createdAt: timestamp,
            resolutionState: 'unresolved',
            resolvedAt: null,
          };
          validateConflictRecord(conflict);
          conflictsStore.add(conflict);
          conflicts.push(conflict);
          continue;
        }

        const record = canonicalPayloadSnapshot(candidate.record);
        const envelope: LocalEntityEnvelope<T> = {
          namespaceKey: this.namespaceKey,
          generationId: this.namespace.generationId,
          accountId: this.namespace.userId,
          domain: batch.domain,
          entityId: candidate.entityId,
          record,
          revision: (current?.revision ?? 0) + 1,
          localRevision: (current?.revision ?? 0) + 1,
          serverRevision: candidate.serverRevision,
          createdAt: current?.createdAt ?? candidate.createdAt,
          updatedAt: candidate.updatedAt,
          deletedAt: candidate.deletedAt,
          isDeleted: candidate.deletedAt !== null,
          deletionState: candidate.deletedAt === null ? 'active' : 'deleted',
          ownerId: current ? current.ownerId : candidate.ownerId ?? null,
          contentHash: hashCanonicalPayload(record),
          pendingMutationId: null,
          lastRemoteMutationRef: candidate.remoteMutationRef,
          source: candidate.source === undefined
            ? current?.source ?? { kind: 'remote', reference: batch.provider }
            : candidate.source,
          restoreProvenance: current?.restoreProvenance ?? null,
          migrationProvenance: current?.migrationProvenance ?? null,
        };
        validateEntityEnvelope(envelope);
        entitiesStore.put(envelope);
        appliedEntities.push(envelope);
      }

      if (batch.testOnlyAbortAt === 'before_checkpoint') {
        transaction.abort();
        throw new LocalDatabaseError('TRANSACTION_ABORTED', operation);
      }
      const checkpoint = await this.advanceCheckpointInTransaction(transaction, {
        provider: batch.provider,
        stream: batch.domain,
        checkpointValue: batch.checkpointValue,
        sequence: batch.sequence,
        serverEpoch: batch.serverEpoch,
        now: batch.now,
      }, timestamp, false, operation);
      if (batch.testOnlyAbortAt === 'after_checkpoint') {
        transaction.abort();
        throw new LocalDatabaseError('TRANSACTION_ABORTED', operation);
      }
      await done;
      return { entities: appliedEntities, conflicts, checkpoint };
    } catch (error) {
      abortQuietly(transaction);
      await done.catch(() => undefined);
      throw localDatabaseError(error, operation);
    }
  }

  async invalidateSyncCheckpoint(input: InvalidateCheckpointInput): Promise<SyncCheckpointRecord> {
    this.assertOpen('invalidate_checkpoint'); validateSafeIdentifier(input.provider, 'invalidate_checkpoint');
    validateSafeIdentifier(input.stream, 'invalidate_checkpoint'); validateSafeIdentifier(input.reason, 'invalidate_checkpoint');
    const timestamp = now(input.now);
    const transaction = this.db.transaction([
      LOCAL_DATABASE_STORES.databaseMeta, LOCAL_DATABASE_STORES.generations, LOCAL_DATABASE_STORES.syncCheckpoints,
    ], 'readwrite');
    const done = transactionCompletion(transaction, 'invalidate_checkpoint');
    try {
      await this.ensureActive(transaction);
      const store = transaction.objectStore(LOCAL_DATABASE_STORES.syncCheckpoints);
      const key = checkpointKey(this.namespaceKey, this.namespace.generationId, input.provider, input.stream);
      const current = await requestResult(store.get(key)) as SyncCheckpointRecord | undefined;
      if (!current) throw new LocalDatabaseError('CHECKPOINT_NOT_FOUND', 'invalidate_checkpoint');
      validateCheckpoint(current);
      if (current.accountId !== undefined && current.accountId !== this.namespace.userId) {
        throw new LocalDatabaseError('NAMESPACE_MISMATCH', 'invalidate_checkpoint');
      }
      const record: SyncCheckpointRecord = {
        ...current, accountId: this.namespace.userId, updatedAt: timestamp,
        invalidatedAt: timestamp, invalidationReason: input.reason,
      };
      validateCheckpoint(record); store.put(record); await done; return record;
    } catch (error) {
      abortQuietly(transaction); await done.catch(() => undefined); throw localDatabaseError(error, 'invalidate_checkpoint');
    }
  }

  async recordConflict(input: RecordConflictInput): Promise<SyncConflictRecord> {
    this.assertOpen('record_conflict');
    for (const value of [input.conflictId, input.domain, input.entityId, input.conflictType]) {
      validateSafeIdentifier(value, 'record_conflict');
    }
    if (input.mutationId != null) validateSafeIdentifier(input.mutationId, 'record_conflict');
    if (!Number.isSafeInteger(input.localRevision) || input.localRevision < 1
      || input.serverRevision != null && (!Number.isSafeInteger(input.serverRevision) || input.serverRevision < 1)) {
      throw new LocalDatabaseError('INVALID_RESERVED_RECORD', 'record_conflict');
    }
    const localCandidate = canonicalPayloadSnapshot(input.localCandidate);
    const remoteCandidate = canonicalPayloadSnapshot(input.remoteCandidate);
    const remoteMetadata = input.remoteMetadata == null ? null : canonicalPayloadSnapshot(input.remoteMetadata);
    const record: SyncConflictRecord = {
      namespaceKey: this.namespaceKey, generationId: this.namespace.generationId, accountId: this.namespace.userId,
      conflictId: input.conflictId, domain: input.domain, entityId: input.entityId,
      mutationId: input.mutationId ?? null, localCandidate, remoteCandidate, remoteMetadata,
      localRevision: input.localRevision, serverRevision: input.serverRevision ?? null,
      localContentHash: hashCanonicalPayload(localCandidate), remoteContentHash: hashCanonicalPayload(remoteCandidate),
      conflictType: input.conflictType, createdAt: now(input.now), resolutionState: 'unresolved', resolvedAt: null,
    };
    validateConflictRecord(record);
    const transaction = this.db.transaction([
      LOCAL_DATABASE_STORES.databaseMeta, LOCAL_DATABASE_STORES.generations, LOCAL_DATABASE_STORES.conflicts,
    ], 'readwrite');
    const done = transactionCompletion(transaction, 'record_conflict');
    try {
      await this.ensureActive(transaction); transaction.objectStore(LOCAL_DATABASE_STORES.conflicts).add(record); await done; return record;
    } catch (error) {
      abortQuietly(transaction); await done.catch(() => undefined); throw localDatabaseError(error, 'record_conflict');
    }
  }

  async listConflicts(domain?: string, entityId?: string): Promise<SyncConflictRecord[]> {
    this.assertOpen('list_conflicts');
    if ((domain === undefined) !== (entityId === undefined)) throw new LocalDatabaseError('INVALID_RESERVED_RECORD', 'list_conflicts');
    if (domain !== undefined) { validateSafeIdentifier(domain, 'list_conflicts'); validateSafeIdentifier(entityId, 'list_conflicts'); }
    const transaction = this.db.transaction(LOCAL_DATABASE_STORES.conflicts, 'readonly');
    const done = transactionCompletion(transaction, 'list_conflicts');
    const store = transaction.objectStore(LOCAL_DATABASE_STORES.conflicts);
    const values = domain === undefined
      ? await requestResult(store.getAll(IDBKeyRange.bound(
        [this.namespaceKey, this.namespace.generationId, ''], [this.namespaceKey, this.namespace.generationId, '\uffff'],
      ))) as SyncConflictRecord[]
      : await requestResult(store.index('by_namespace_generation_entity').getAll(
        IDBKeyRange.only([this.namespaceKey, this.namespace.generationId, domain, entityId]),
      )) as SyncConflictRecord[];
    await done;
    for (const value of values) {
      validateConflictRecord(value);
      if (value.accountId !== this.namespace.userId) throw new LocalDatabaseError('NAMESPACE_MISMATCH', 'list_conflicts');
    }
    return values.sort((left, right) => left.createdAt.localeCompare(right.createdAt) || left.conflictId.localeCompare(right.conflictId));
  }

  async resolveConflict(input: ResolveConflictInput): Promise<SyncConflictRecord> {
    this.assertOpen('resolve_conflict'); validateSafeIdentifier(input.conflictId, 'resolve_conflict');
    if (!['resolved_local', 'resolved_remote', 'resolved_merged', 'dismissed'].includes(input.resolutionState)) {
      throw new LocalDatabaseError('INVALID_RESERVED_RECORD', 'resolve_conflict');
    }
    const timestamp = now(input.now);
    const transaction = this.db.transaction([
      LOCAL_DATABASE_STORES.databaseMeta, LOCAL_DATABASE_STORES.generations, LOCAL_DATABASE_STORES.conflicts,
    ], 'readwrite');
    const done = transactionCompletion(transaction, 'resolve_conflict');
    try {
      await this.ensureActive(transaction); const store = transaction.objectStore(LOCAL_DATABASE_STORES.conflicts);
      const key = conflictKey(this.namespaceKey, this.namespace.generationId, input.conflictId);
      const current = await requestResult(store.get(key)) as SyncConflictRecord | undefined;
      if (!current) throw new LocalDatabaseError('CONFLICT_NOT_FOUND', 'resolve_conflict');
      validateConflictRecord(current);
      if (current.accountId !== this.namespace.userId) throw new LocalDatabaseError('NAMESPACE_MISMATCH', 'resolve_conflict');
      if (current.resolutionState !== 'unresolved') throw new LocalDatabaseError('INVALID_RESERVED_RECORD', 'resolve_conflict');
      const record: SyncConflictRecord = {
        ...current, resolutionState: input.resolutionState, resolvedAt: timestamp,
      };
      validateConflictRecord(record); store.put(record); await done; return record;
    } catch (error) {
      abortQuietly(transaction); await done.catch(() => undefined); throw localDatabaseError(error, 'resolve_conflict');
    }
  }

  async acquireWorkerLease(input: WorkerLeaseInput): Promise<SyncWorkerLeaseRecord> {
    return this.writeWorkerLease('acquire_worker_lease', input, (current, timestamp, expiresAt) => {
      if (current && current.releasedAt === null && Date.parse(current.expiresAt) > Date.parse(timestamp)) {
        throw new LocalDatabaseError('WORKER_LEASE_HELD', 'acquire_worker_lease');
      }
      const leaseEpoch = (current?.leaseEpoch ?? 0) + 1;
      if (!Number.isSafeInteger(leaseEpoch)) throw new LocalDatabaseError('INVALID_RESERVED_RECORD', 'acquire_worker_lease');
      const leaseToken = `lease.${sha256Hex(JSON.stringify([
        'absinthe-worker-lease-v1', this.namespaceKey, this.namespace.generationId,
        input.leaseName, input.ownerId, leaseEpoch, timestamp,
      ]))}`;
      return {
        namespaceKey: this.namespaceKey, generationId: this.namespace.generationId, accountId: this.namespace.userId,
        leaseName: input.leaseName, ownerId: input.ownerId, leaseToken, leaseEpoch,
        acquiredAt: timestamp, renewedAt: timestamp, expiresAt, releasedAt: null,
      };
    });
  }

  async renewWorkerLease(input: RenewWorkerLeaseInput): Promise<SyncWorkerLeaseRecord> {
    return this.writeWorkerLease('renew_worker_lease', input, (current, timestamp, expiresAt) => {
      if (!current || current.releasedAt !== null) throw new LocalDatabaseError('WORKER_LEASE_NOT_FOUND', 'renew_worker_lease');
      if (current.ownerId !== input.ownerId) throw new LocalDatabaseError('LEASE_OWNER_MISMATCH', 'renew_worker_lease');
      if (current.leaseToken !== input.leaseToken) throw new LocalDatabaseError('LEASE_FENCE_MISMATCH', 'renew_worker_lease');
      if (Date.parse(current.expiresAt) <= Date.parse(timestamp)) throw new LocalDatabaseError('WORKER_LEASE_HELD', 'renew_worker_lease');
      return { ...current, renewedAt: timestamp, expiresAt };
    });
  }

  private async writeWorkerLease(
    operation: string,
    input: WorkerLeaseInput,
    transform: (current: SyncWorkerLeaseRecord | null, timestamp: string, expiresAt: string) => SyncWorkerLeaseRecord,
  ): Promise<SyncWorkerLeaseRecord> {
    this.assertOpen(operation); validateSafeIdentifier(input.leaseName, operation); validateSafeIdentifier(input.ownerId, operation);
    if (!Number.isSafeInteger(input.durationMs) || input.durationMs < 1 || input.durationMs > 86_400_000) {
      throw new LocalDatabaseError('INVALID_RESERVED_RECORD', operation);
    }
    const timestamp = now(input.now); const expiresAt = new Date(Date.parse(timestamp) + input.durationMs).toISOString();
    const transaction = this.db.transaction([
      LOCAL_DATABASE_STORES.databaseMeta, LOCAL_DATABASE_STORES.generations, LOCAL_DATABASE_STORES.workerLeases,
    ], 'readwrite');
    const done = transactionCompletion(transaction, operation);
    try {
      await this.ensureActive(transaction); const store = transaction.objectStore(LOCAL_DATABASE_STORES.workerLeases);
      const current = await requestResult(store.get(workerLeaseKey(
        this.namespaceKey, this.namespace.generationId, input.leaseName,
      ))) as SyncWorkerLeaseRecord | undefined;
      if (current) { validateWorkerLease(current); if (current.accountId !== this.namespace.userId) throw new LocalDatabaseError('NAMESPACE_MISMATCH', operation); }
      const record = transform(current ?? null, timestamp, expiresAt); validateWorkerLease(record); store.put(record); await done; return record;
    } catch (error) {
      abortQuietly(transaction); await done.catch(() => undefined); throw localDatabaseError(error, operation);
    }
  }

  async releaseWorkerLease(input: ReleaseWorkerLeaseInput): Promise<void> {
    this.assertOpen('release_worker_lease'); validateSafeIdentifier(input.leaseName, 'release_worker_lease');
    validateSafeIdentifier(input.ownerId, 'release_worker_lease');
    const timestamp = now(input.now);
    const transaction = this.db.transaction([
      LOCAL_DATABASE_STORES.databaseMeta, LOCAL_DATABASE_STORES.generations, LOCAL_DATABASE_STORES.workerLeases,
    ], 'readwrite');
    const done = transactionCompletion(transaction, 'release_worker_lease');
    try {
      await this.ensureActive(transaction); const store = transaction.objectStore(LOCAL_DATABASE_STORES.workerLeases);
      const key = workerLeaseKey(this.namespaceKey, this.namespace.generationId, input.leaseName);
      const current = await requestResult(store.get(key)) as SyncWorkerLeaseRecord | undefined;
      if (!current || current.releasedAt !== null) throw new LocalDatabaseError('WORKER_LEASE_NOT_FOUND', 'release_worker_lease');
      validateWorkerLease(current);
      if (current.accountId !== this.namespace.userId) throw new LocalDatabaseError('NAMESPACE_MISMATCH', 'release_worker_lease');
      if (current.ownerId !== input.ownerId) throw new LocalDatabaseError('LEASE_OWNER_MISMATCH', 'release_worker_lease');
      if (current.leaseToken !== input.leaseToken) throw new LocalDatabaseError('LEASE_FENCE_MISMATCH', 'release_worker_lease');
      const released = { ...current, releasedAt: timestamp };
      validateWorkerLease(released); store.put(released); await done;
    } catch (error) {
      abortQuietly(transaction); await done.catch(() => undefined); throw localDatabaseError(error, 'release_worker_lease');
    }
  }

  async getWorkerLease(leaseName: string): Promise<SyncWorkerLeaseRecord | null> {
    this.assertOpen('get_worker_lease'); validateSafeIdentifier(leaseName, 'get_worker_lease');
    const transaction = this.db.transaction(LOCAL_DATABASE_STORES.workerLeases, 'readonly');
    const done = transactionCompletion(transaction, 'get_worker_lease');
    const record = await requestResult(transaction.objectStore(LOCAL_DATABASE_STORES.workerLeases).get(
      workerLeaseKey(this.namespaceKey, this.namespace.generationId, leaseName),
    )) as SyncWorkerLeaseRecord | undefined;
    await done;
    if (record) { validateWorkerLease(record); if (record.accountId !== this.namespace.userId) throw new LocalDatabaseError('NAMESPACE_MISMATCH', 'get_worker_lease'); }
    return record?.releasedAt === null ? record : null;
  }

  private async putStagedMetadata<T extends {
    namespaceKey: string; expectedActiveGenerationId: string; sourceGenerationId: string; targetGenerationId: string;
  }>(storeName: string, value: T, validate: (record: T) => void, operation: string): Promise<void> {
    this.assertOpen(operation); validate(value);
    if (value.namespaceKey !== this.namespaceKey) throw new LocalDatabaseError('NAMESPACE_MISMATCH', operation);
    const transaction = this.db.transaction(
      [LOCAL_DATABASE_STORES.databaseMeta, LOCAL_DATABASE_STORES.generations, storeName], 'readwrite',
    );
    const done = transactionCompletion(transaction, operation);
    try {
      const metaStore = transaction.objectStore(LOCAL_DATABASE_STORES.databaseMeta);
      const generations = transaction.objectStore(LOCAL_DATABASE_STORES.generations);
      const meta = await requestResult(metaStore.get(this.namespaceKey)) as DatabaseMetaRecord | undefined;
      if (!meta) throw new LocalDatabaseError('MALFORMED_METADATA', operation);
      validateDatabaseMeta(meta, this.namespaceKey, this.namespace.schemaVersion);
      if (meta.activeGenerationId !== this.namespace.generationId
        || value.expectedActiveGenerationId !== meta.activeGenerationId
        || value.sourceGenerationId !== meta.activeGenerationId) {
        throw new LocalDatabaseError('STALE_GENERATION', operation);
      }
      if (value.targetGenerationId === value.sourceGenerationId) {
        throw new LocalDatabaseError('INVALID_GENERATION_TRANSITION', operation);
      }
      const source = await requestResult(generations.get(generationKey(this.namespaceKey, value.sourceGenerationId))) as GenerationRecord | undefined;
      const target = await requestResult(generations.get(generationKey(this.namespaceKey, value.targetGenerationId))) as GenerationRecord | undefined;
      if (!source || !target) throw new LocalDatabaseError('GENERATION_NOT_FOUND', operation);
      validateGenerationRecord(source, this.namespaceKey, this.namespace.schemaVersion);
      validateGenerationRecord(target, this.namespaceKey, this.namespace.schemaVersion);
      if (source.status !== 'active' || target.status !== 'preparing' || target.schemaVersion !== this.namespace.schemaVersion) {
        throw new LocalDatabaseError('INVALID_GENERATION_TRANSITION', operation);
      }
      transaction.objectStore(storeName).put(value);
      await done;
    } catch (error) {
      abortQuietly(transaction); await done.catch(() => undefined); throw localDatabaseError(error, operation);
    }
  }

  restorePackageAtomically(value: unknown, options: RestoreOptions): Promise<RestoreResult> {
    return executeRestore({
      db: this.db, namespace: this.namespace, namespaceKey: this.namespaceKey,
      mutationIdFactory: this.mutationIdFactory, clock: this.clock,
      assertOpen: operation => this.assertOpen(operation),
    }, value, options);
  }

  resumeRestoreSession(value: unknown, options: RestoreOptions): Promise<RestoreResult> {
    return this.restorePackageAtomically(value, options);
  }

  getRestoreSession(sessionId: string): Promise<RestoreSessionRecord | null> {
    return readRestoreSession({
      db: this.db, namespace: this.namespace, namespaceKey: this.namespaceKey,
      mutationIdFactory: this.mutationIdFactory, clock: this.clock,
      assertOpen: operation => this.assertOpen(operation),
    }, sessionId);
  }

  cancelRestoreSession(sessionId: string, at?: string): Promise<RestoreSessionRecord> {
    return cancelRestore({
      db: this.db, namespace: this.namespace, namespaceKey: this.namespaceKey,
      mutationIdFactory: this.mutationIdFactory, clock: this.clock,
      assertOpen: operation => this.assertOpen(operation),
    }, sessionId, at);
  }

  captureLegacyNotesMigration(
    adapter: LegacyNotesSourceAdapter, options: LegacyNotesMigrationOptions,
  ): Promise<LegacyNotesMigrationSessionV1> {
    return captureLegacyMigration(this.legacyMigrationRuntime(), adapter, options);
  }

  resumeLegacyNotesMigration(
    adapter: LegacyNotesSourceAdapter, migrationId: string, at?: string,
  ): Promise<LegacyNotesMigrationSessionV1 | LegacyMigrationResultV1> {
    return resumeLegacyMigration(this.legacyMigrationRuntime(), adapter, migrationId, at);
  }

  verifyLegacyNotesMigration(
    adapter: LegacyNotesSourceAdapter, migrationId: string, at?: string,
  ): Promise<LegacyMigrationResultV1> {
    return verifyLegacyMigration(this.legacyMigrationRuntime(), adapter, migrationId, at);
  }

  getLegacyNotesMigrationSession(migrationId: string): Promise<LegacyNotesMigrationSessionV1 | null> {
    return readLegacyMigration(this.legacyMigrationRuntime(), migrationId);
  }

  getLegacyNotesMigrationSessionForAdministration(
    migrationId: string,
  ): Promise<LegacyNotesMigrationAdministrativeView> {
    return readLegacyMigrationForAdministration(this.legacyMigrationRuntime(), migrationId);
  }

  cancelLegacyNotesMigration(migrationId: string, at?: string): Promise<LegacyNotesMigrationSessionV1> {
    return cancelLegacyMigration(this.legacyMigrationRuntime(), migrationId, at);
  }

  registerLegacyNotesSourceAuthority(
    input: RegisterLegacyNotesSourceAuthorityInput,
  ): Promise<LegacyNotesSourceAuthorityRecordV1> {
    return registerLegacySourceAuthority(this.legacyMigrationRuntime(), input);
  }

  getLegacyNotesSourceAuthority(authorityId: string): Promise<LegacyNotesSourceAuthorityRecordV1 | null> {
    return readLegacySourceAuthority(this.legacyMigrationRuntime(), authorityId);
  }

  revokeLegacyNotesSourceAuthority(
    authorityId: string, at?: string,
  ): Promise<LegacyNotesSourceAuthorityRecordV1> {
    return revokeLegacySourceAuthority(this.legacyMigrationRuntime(), authorityId, at);
  }

  createLocalFirstCutoverAuthorization(
    cutoverSessionId: string, migrationSessionId: string, purpose: 'test' | 'developer',
  ): RecoveryCutoverAuthorization {
    return createCutoverAuthorization(this.legacyMigrationRuntime(), cutoverSessionId, migrationSessionId, purpose);
  }

  planLocalFirstCutover(
    adapter: LegacyNotesSourceAdapter, options: PlanLocalFirstCutoverOptions,
  ): Promise<LocalFirstCutoverSessionV1> {
    return planCutover(this.legacyMigrationRuntime(), adapter, options);
  }

  preflightLocalFirstCutover(
    adapter: LegacyNotesSourceAdapter, cutoverSessionId: string,
    authorization: RecoveryCutoverAuthorization, at?: string,
  ): Promise<LocalFirstCutoverSessionV1> {
    return preflightCutover(this.legacyMigrationRuntime(), adapter, cutoverSessionId, authorization, at);
  }

  activateLocalFirstCutover(
    adapter: LegacyNotesSourceAdapter, cutoverSessionId: string, options: ActivateLocalFirstCutoverOptions,
  ): Promise<LocalFirstCutoverResult> {
    return activateCutover(this.legacyMigrationRuntime(), adapter, cutoverSessionId, options);
  }

  resumeLocalFirstCutover(
    adapter: LegacyNotesSourceAdapter, cutoverSessionId: string, options: ActivateLocalFirstCutoverOptions,
  ): Promise<LocalFirstCutoverResult> {
    return resumeCutover(this.legacyMigrationRuntime(), adapter, cutoverSessionId, options);
  }

  confirmLocalFirstCutover(
    adapter: LegacyNotesSourceAdapter, cutoverSessionId: string,
    authorization: RecoveryCutoverAuthorization, at?: string,
  ): Promise<LocalFirstCutoverResult> {
    return confirmCutover(this.legacyMigrationRuntime(), adapter, cutoverSessionId, authorization, at);
  }

  cancelLocalFirstCutover(
    cutoverSessionId: string, authorization: RecoveryCutoverAuthorization, at?: string,
  ): Promise<LocalFirstCutoverSessionV1> {
    return cancelCutover(this.legacyMigrationRuntime(), cutoverSessionId, authorization, at);
  }

  recoverFailedPrecommitCutoverFence(
    cutoverSessionId: string, authorization: RecoveryCutoverAuthorization, at?: string,
    testOnlyFailAt?: FailedPrecommitFenceRecoveryFailurePoint,
  ): Promise<LocalFirstCutoverSessionV1> {
    return recoverCutoverFence(this.legacyMigrationRuntime(), cutoverSessionId, authorization, at, testOnlyFailAt);
  }

  getLocalFirstCutoverSession(cutoverSessionId: string): Promise<LocalFirstCutoverSessionV1 | null> {
    return readCutoverSession(this.legacyMigrationRuntime(), cutoverSessionId);
  }

  getLocalFirstRuntimeMode(): Promise<LocalFirstRuntimeModeRecordV1 | null> {
    return readCutoverRuntimeMode(this.legacyMigrationRuntime());
  }

  putMigrationState(value: MigrationStateRecord): Promise<void> {
    if (value.targetSchemaVersion !== this.namespace.schemaVersion) {
      return Promise.reject(new LocalDatabaseError('INVALID_RESERVED_RECORD', 'put_migration_state'));
    }
    return this.putStagedMetadata(LOCAL_DATABASE_STORES.migrationState, value, validateMigrationState, 'put_migration_state');
  }
}

export async function openLocalDatabase(
  namespace: LocalDatabaseNamespace,
  options: {
    capability: LocalDatabaseCapability;
    indexedDBFactory?: IDBFactory;
    mutationIdFactory?: () => string;
    clock?: () => string;
  },
): Promise<LocalDatabaseRepository> {
  if (options?.capability?.marker !== capabilityMarker) throw new LocalDatabaseError('CAPABILITY_REQUIRED', 'open_database');
  validateNamespace(namespace);
  const factory = options.indexedDBFactory ?? globalThis.indexedDB;
  if (!factory) throw new LocalDatabaseError('OPEN_FAILED', 'open_database');
  const fingerprint = await namespaceFingerprint(namespace);
  return new Promise((resolve, reject) => {
    const request = factory.open(LOCAL_DATABASE_NAME, LOCAL_DATABASE_VERSION);
    let settled = false;
    request.onupgradeneeded = event => {
      try { createLocalDatabaseSchema(request.result, event.oldVersion, request.transaction!); }
      catch { request.transaction?.abort(); }
    };
    request.onblocked = () => {
      if (!settled) { settled = true; reject(new LocalDatabaseError('OPEN_BLOCKED', 'open_database')); }
    };
    request.onerror = () => {
      if (!settled) { settled = true; reject(localDatabaseError(request.error, 'open_database')); }
    };
    request.onsuccess = () => {
      if (settled) { request.result.close(); return; }
      try {
        assertLocalDatabaseVersion(request.result);
        const state: ConnectionState = { closed: false, stale: false };
        request.result.onversionchange = () => { state.stale = true; request.result.close(); };
        settled = true; resolve(new LocalDatabaseRepository(
          request.result, namespace, fingerprint, state,
          options.mutationIdFactory ?? generateOutboxMutationId,
          options.clock ?? (() => new Date().toISOString()),
        ));
      } catch (error) { request.result.close(); settled = true; reject(localDatabaseError(error, 'open_database')); }
    };
  });
}

export function closeLocalDatabase(repository: LocalDatabaseRepository): void {
  repository.close();
}
