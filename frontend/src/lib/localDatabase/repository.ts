import { LocalDatabaseError, localDatabaseError } from './errors';
import { namespaceFingerprint, validateNamespace, validateSafeIdentifier } from './namespace';
import { deriveOutboxIdempotencyKey, generateOutboxMutationId } from './outboxIdentity';
import { assertLocalDatabaseVersion, createLocalDatabaseSchema, LOCAL_DATABASE_STORES } from './schema';
import {
  cancelLegacyNotesMigration as cancelLegacyMigration,
  captureLegacyNotesMigration as captureLegacyMigration,
  getLegacyNotesMigrationSession as readLegacyMigration,
  resumeLegacyNotesMigration as resumeLegacyMigration,
  verifyLegacyNotesMigration as verifyLegacyMigration,
  type LegacyMigrationResultV1, type LegacyNotesMigrationOptions, type LegacyNotesMigrationSessionV1,
  type LegacyNotesMigrationRuntime, type LegacyNotesSourceAdapter,
} from './legacyNotesMigration';
import {
  cancelRestoreSession as cancelRestore, getRestoreSession as readRestoreSession,
  restorePackageAtomically as executeRestore, type RestoreOptions, type RestoreResult,
} from './restore';
import {
  LOCAL_DATABASE_NAME, LOCAL_DATABASE_VERSION, LOCAL_SCHEMA_VERSION,
  type AcknowledgeOutboxInput, type AttachmentStateRecord, type ClaimOutboxInput,
  type CommitLocalMutationInput, type CommittedLocalMutation, type DatabaseMetaRecord, type EntityListOptions,
  type EntityCreateInput, type EntityUpdateInput, type FailOutboxInput, type GenerationReason,
  type GenerationRecord, type GenerationStatus, type LocalDatabaseNamespace,
  type LocalEntityEnvelope, type MigrationStateRecord, type OutboxRecord,
  type OutboxListInput, type OutboxStatus, type OutboxStatusCounts, type ResetOutboxInput,
  type RestoreSessionRecord, type RetryOutboxInput, type SafeSourceReference, type SyncCheckpointRecord,
} from './types';
import {
  validTimestamp, validateAttachmentState, validateCheckpoint, validateDatabaseMeta, validateEntityEnvelope,
  validateGenerationRecord, validateMigrationState, validateOutboxRecord, validateRestoreSequenceBoundaryGraph,
  validateRestoreSession, validateSafeSource,
} from './validation';

const capabilityMarker = Symbol('absinthe-local-v2-capability');
export interface LocalDatabaseCapability { readonly marker: symbol; readonly purpose: 'test' | 'developer' }

export function createDormantLocalDatabaseCapability(purpose: 'test' | 'developer'): LocalDatabaseCapability {
  return Object.freeze({ marker: capabilityMarker, purpose });
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

interface ConnectionState { closed: boolean; stale: boolean }
const MAX_OUTBOX_SCAN = 10_000;

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
    const transaction = this.db.transaction([LOCAL_DATABASE_STORES.databaseMeta, LOCAL_DATABASE_STORES.generations], 'readwrite');
    const done = transactionCompletion(transaction, 'activate_generation');
    try {
      const metaStore = transaction.objectStore(LOCAL_DATABASE_STORES.databaseMeta);
      const generations = transaction.objectStore(LOCAL_DATABASE_STORES.generations);
      const meta = await requestResult(metaStore.get(this.namespaceKey)) as DatabaseMetaRecord | undefined;
      const target = await requestResult(generations.get(generationKey(this.namespaceKey, generationId))) as GenerationRecord | undefined;
      if (!meta) throw new LocalDatabaseError('MALFORMED_METADATA', 'activate_generation');
      validateDatabaseMeta(meta, this.namespaceKey, this.namespace.schemaVersion);
      if (meta.activeGenerationId !== this.namespace.generationId) throw new LocalDatabaseError('STALE_GENERATION', 'activate_generation');
      if (!target) throw new LocalDatabaseError('GENERATION_NOT_FOUND', 'activate_generation');
      validateGenerationRecord(target, this.namespaceKey, this.namespace.schemaVersion);
      if (target.status !== 'preparing' || target.validationState === 'invalid') {
        throw new LocalDatabaseError('INVALID_GENERATION_TRANSITION', 'activate_generation');
      }
      const previous = await requestResult(generations.get(generationKey(this.namespaceKey, meta.activeGenerationId))) as GenerationRecord | undefined;
      if (!previous || previous.status !== 'active') throw new LocalDatabaseError('MALFORMED_METADATA', 'activate_generation');
      validateGenerationRecord(previous, this.namespaceKey, this.namespace.schemaVersion);
      const timestamp = now();
      generations.put({ ...previous, status: 'sealed', activeNamespaceKey: undefined });
      const active: GenerationRecord = {
        ...target, status: 'active', activatedAt: timestamp, predecessorGenerationId: previous.generationId,
        validationState: 'valid', activeNamespaceKey: this.namespaceKey,
      };
      generations.put(active); metaStore.put({ ...meta, activeGenerationId: generationId });
      await done; return active;
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
      if (value.namespaceKey !== this.namespaceKey || value.generationId !== this.namespace.generationId) throw new Error('scope');
    } catch {
      throw new LocalDatabaseError('CORRUPT_PERSISTED_RECORD', operation);
    }
  }

  private validatePersistedOutbox(value: OutboxRecord, operation: string): void {
    try {
      validateOutboxRecord(value);
      if (value.namespaceKey !== this.namespaceKey || value.generationId !== this.namespace.generationId) throw new Error('scope');
    } catch {
      throw new LocalDatabaseError('CORRUPT_PERSISTED_RECORD', operation);
    }
  }

  async commitLocalMutation<T>(input: CommitLocalMutationInput<T>): Promise<CommittedLocalMutation<T>> {
    this.assertOpen('commit_local_mutation');
    const { mutation } = input;
    if (!['create', 'update', 'tombstone'].includes(mutation.mode)) {
      throw new LocalDatabaseError('INVALID_ENTITY', 'commit_local_mutation');
    }
    validateSafeIdentifier(mutation.domain, 'commit_local_mutation');
    if (typeof mutation.entityId !== 'string' || mutation.entityId.length === 0 || mutation.entityId.length > 512) {
      throw new LocalDatabaseError('INVALID_ENTITY', 'commit_local_mutation');
    }
    if (mutation.mode !== 'tombstone') validateSafeSource(mutation.source);
    const timestamp = now(input.now);
    const operation = mutation.mode === 'tombstone' ? 'tombstone' : 'upsert';
    if (mutation.mode !== 'create' && mutation.expectedRevision === undefined) {
      throw new LocalDatabaseError('EXPECTED_REVISION_REQUIRED', 'commit_local_mutation');
    }
    const proposedRevision = mutation.mode === 'create' ? 1 : mutation.expectedRevision + 1;
    if (!Number.isSafeInteger(proposedRevision) || proposedRevision < 1) {
      throw new LocalDatabaseError('INVALID_ENTITY', 'commit_local_mutation');
    }
    const mutationId = this.mutationIdFactory();
    if (!/^mut\.[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(mutationId)) {
      throw new LocalDatabaseError('INVALID_OUTBOX', 'commit_local_mutation');
    }
    const idempotencyKey = deriveOutboxIdempotencyKey({
      namespaceKey: this.namespaceKey, generationId: this.namespace.generationId,
      domain: mutation.domain, entityId: mutation.entityId, localRevision: proposedRevision, operation,
    });
    const stores: string[] = [LOCAL_DATABASE_STORES.databaseMeta, LOCAL_DATABASE_STORES.generations,
      LOCAL_DATABASE_STORES.entities, LOCAL_DATABASE_STORES.outbox];
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
      if (mutation.mode === 'create') {
        if (current?.deletedAt) throw new LocalDatabaseError('TOMBSTONE_REACTIVATION_BLOCKED', 'commit_local_mutation');
        if (current) throw new LocalDatabaseError('ENTITY_ALREADY_EXISTS', 'commit_local_mutation');
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
        record: isTombstone ? current!.record : mutation.record,
        revision: actualRevision + 1, createdAt: current?.createdAt ?? timestamp, updatedAt: timestamp,
        deletedAt: isTombstone ? timestamp : null, isDeleted: isTombstone,
        deletionState: isTombstone ? 'deleted' : 'active',
        ownerId: mutation.mode === 'tombstone' || mutation.ownerId === undefined ? current?.ownerId ?? null : mutation.ownerId,
        contentHash: mutation.mode === 'tombstone' || mutation.contentHash === undefined ? current?.contentHash ?? null : mutation.contentHash,
        source: mutation.mode === 'tombstone' || mutation.source === undefined ? current?.source ?? null : mutation.source,
        restoreProvenance: current?.restoreProvenance ?? null,
      };
      validateEntityEnvelope(envelope);
      entityStore.put(envelope);
      if (envelope.revision !== proposedRevision) throw new LocalDatabaseError('STALE_REVISION', 'commit_local_mutation');
      if (input.testOnlyAbortAt === 'before_outbox') throw new LocalDatabaseError('INVALID_OUTBOX', 'commit_local_mutation');
      const outbox: OutboxRecord = {
        namespaceKey: this.namespaceKey, generationId: this.namespace.generationId,
        domain: mutation.domain, entityId: mutation.entityId, mutationId, idempotencyKey, operation,
        baseRevision: actualRevision || null, localRevision: envelope.revision,
        payloadMode: 'inline', payloadHash: null,
        payload: isTombstone
          ? { kind: 'tombstone', entityId: mutation.entityId, deletedAt: envelope.deletedAt!, revision: envelope.revision }
          : { kind: 'entity_snapshot', record: envelope.record },
        createdAt: timestamp, updatedAt: timestamp, availableAt: timestamp,
        attemptCount: 0, status: 'pending', lastAttemptAt: null, lastErrorCode: null,
        leaseOwner: null, leaseExpiresAt: null, acknowledgedAt: null, acknowledgedBy: null, remoteMutationRef: null,
        supersededByMutationId: null,
      };
      validateOutboxRecord(outbox);
      transaction.objectStore(LOCAL_DATABASE_STORES.outbox).add(outbox);
      if (input.testOnlyAbortAt === 'after_writes') {
        transaction.abort(); throw new LocalDatabaseError('TRANSACTION_ABORTED', 'entity_mutation');
      }
      await done;
      return { entity: envelope, outbox };
    } catch (error) {
      abortQuietly(transaction); await done.catch(() => undefined); throw localDatabaseError(error, 'commit_local_mutation');
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
      const validSequenceStart = first !== undefined
        && (first.baseRevision === null ? first.localRevision === 1 : validRestoreBoundary);
      if (!validSequenceStart) {
        throw new LocalDatabaseError('OUTBOX_SEQUENCE_GAP', operation);
      }
      for (let index = 1; index < group.length; index += 1) {
        if (group[index].generationBoundary != null || group[index].baseRevision !== group[index - 1].localRevision) {
          throw new LocalDatabaseError('OUTBOX_SEQUENCE_GAP', operation);
        }
      }
    }
  }

  private nextDeliverable(values: OutboxRecord[], timestamp: string, recoverExpiredClaims: boolean): OutboxRecord[] {
    const at = Date.parse(now(timestamp));
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
      if (firstUnsettled.deliveryBlockCode) continue;
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
    if (input.status !== undefined && !['pending', 'claimed', 'retry_wait', 'acknowledged', 'permanent_failure', 'superseded'].includes(input.status)) {
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
      pending: 0, claimed: 0, retry_wait: 0, acknowledged: 0, permanent_failure: 0, superseded: 0,
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
        LOCAL_DATABASE_STORES.outbox, LOCAL_DATABASE_STORES.restoreSessions], 'readonly',
    );
    const done = transactionCompletion(transaction, 'next_deliverable');
    const values = await this.readScopedOutbox(transaction, 'next_deliverable');
    await this.ensureActive(transaction);
    await done;
    return this.nextDeliverable(values, input.now, false).slice(0, input.limit);
  }

  async claimNextMutations(input: ClaimOutboxInput): Promise<OutboxRecord[]> {
    this.assertOpen('claim_outbox'); validateSafeIdentifier(input.workerId, 'claim_outbox');
    const timestamp = now(input.now);
    if (!Number.isSafeInteger(input.limit) || input.limit < 1 || input.limit > 100
      || !Number.isSafeInteger(input.leaseDurationMs) || input.leaseDurationMs < 1 || input.leaseDurationMs > 86_400_000) {
      throw new LocalDatabaseError('INVALID_OUTBOX_QUERY', 'claim_outbox');
    }
    const leaseExpiresAt = new Date(Date.parse(timestamp) + input.leaseDurationMs).toISOString();
    const transaction = this.db.transaction(
      [LOCAL_DATABASE_STORES.databaseMeta, LOCAL_DATABASE_STORES.generations, LOCAL_DATABASE_STORES.entities,
        LOCAL_DATABASE_STORES.outbox, LOCAL_DATABASE_STORES.restoreSessions], 'readwrite',
    );
    const done = transactionCompletion(transaction, 'claim_outbox');
    try {
      const values = await this.readScopedOutbox(transaction, 'claim_outbox');
      await this.ensureActive(transaction);
      const candidates = this.nextDeliverable(values, timestamp, input.recoverExpiredClaims === true).slice(0, input.limit);
      const store = transaction.objectStore(LOCAL_DATABASE_STORES.outbox);
      const claimed = candidates.map(value => {
        if (!Number.isSafeInteger(value.attemptCount + 1)) throw new LocalDatabaseError('INVALID_OUTBOX_TRANSITION', 'claim_outbox');
        const updated: OutboxRecord = {
          ...value, status: 'claimed', updatedAt: timestamp, attemptCount: value.attemptCount + 1,
          lastAttemptAt: timestamp, lastErrorCode: null, leaseOwner: input.workerId, leaseExpiresAt,
        };
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
      const exponent = Math.min(value.attemptCount - 1, 52);
      const delay = Math.min(input.maxDelayMs, input.baseDelayMs * (2 ** exponent));
      const availableAt = new Date(Date.parse(timestamp) + delay).toISOString();
      return { ...value, status: 'retry_wait', updatedAt: timestamp, availableAt, lastErrorCode: input.errorCode,
        leaseOwner: null, leaseExpiresAt: null };
    });
  }

  acknowledgeMutation(input: AcknowledgeOutboxInput): Promise<OutboxRecord> {
    validateSafeIdentifier(input.workerId, 'acknowledge_outbox'); const timestamp = now(input.now);
    if (input.remoteMutationRef !== undefined && input.remoteMutationRef !== null) {
      validateSafeIdentifier(input.remoteMutationRef, 'acknowledge_outbox');
    }
    const remoteMutationRef = input.remoteMutationRef ?? null;
    return this.transitionOutbox(input.mutationId, 'acknowledge_outbox', value => {
      if (value.status === 'acknowledged') {
        if (value.acknowledgedAt === timestamp && value.acknowledgedBy === input.workerId
          && value.remoteMutationRef === remoteMutationRef) return value;
        throw new LocalDatabaseError('INVALID_OUTBOX_TRANSITION', 'acknowledge_outbox');
      }
      if (value.status !== 'claimed') throw new LocalDatabaseError('INVALID_OUTBOX_TRANSITION', 'acknowledge_outbox');
      if (value.leaseOwner !== input.workerId) throw new LocalDatabaseError('LEASE_OWNER_MISMATCH', 'acknowledge_outbox');
      return { ...value, status: 'acknowledged', updatedAt: timestamp, acknowledgedAt: timestamp,
        acknowledgedBy: input.workerId, remoteMutationRef, lastErrorCode: null, leaseOwner: null, leaseExpiresAt: null };
    });
  }

  markPermanentFailure(input: FailOutboxInput): Promise<OutboxRecord> {
    validateSafeIdentifier(input.workerId, 'fail_outbox'); validateSafeIdentifier(input.errorCode, 'fail_outbox');
    const timestamp = now(input.now);
    return this.transitionOutbox(input.mutationId, 'fail_outbox', value => {
      if (value.status !== 'claimed') throw new LocalDatabaseError('INVALID_OUTBOX_TRANSITION', 'fail_outbox');
      if (value.leaseOwner !== input.workerId) throw new LocalDatabaseError('LEASE_OWNER_MISMATCH', 'fail_outbox');
      return { ...value, status: 'permanent_failure', updatedAt: timestamp, lastErrorCode: input.errorCode,
        leaseOwner: null, leaseExpiresAt: null };
    });
  }

  resetPermanentFailure(input: ResetOutboxInput): Promise<OutboxRecord> {
    const timestamp = now(input.now);
    return this.transitionOutbox(input.mutationId, 'reset_outbox', value => {
      if (value.status !== 'permanent_failure') throw new LocalDatabaseError('INVALID_OUTBOX_TRANSITION', 'reset_outbox');
      return { ...value, status: 'pending', updatedAt: timestamp, availableAt: timestamp, lastErrorCode: null };
    });
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

  putSyncCheckpoint(value: SyncCheckpointRecord): Promise<void> { return this.putGenerationReserved(LOCAL_DATABASE_STORES.syncCheckpoints, value, validateCheckpoint); }
  putAttachmentState(value: AttachmentStateRecord): Promise<void> { return this.putGenerationReserved(LOCAL_DATABASE_STORES.attachmentState, value, validateAttachmentState); }

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

  cancelLegacyNotesMigration(migrationId: string, at?: string): Promise<LegacyNotesMigrationSessionV1> {
    return cancelLegacyMigration(this.legacyMigrationRuntime(), migrationId, at);
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
