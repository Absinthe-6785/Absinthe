import { LocalDatabaseError, localDatabaseError } from './errors';
import { namespaceFingerprint, validateNamespace, validateSafeIdentifier } from './namespace';
import { assertLocalDatabaseVersion, createLocalDatabaseSchema, LOCAL_DATABASE_STORES } from './schema';
import {
  LOCAL_DATABASE_NAME, LOCAL_DATABASE_VERSION, LOCAL_SCHEMA_VERSION,
  type AttachmentStateRecord, type DatabaseMetaRecord, type EntityListOptions,
  type EntityMutationInput, type EntityMutationTransactionInput, type GenerationReason,
  type GenerationRecord, type GenerationStatus, type LocalDatabaseNamespace,
  type LocalEntityEnvelope, type MigrationStateRecord, type OutboxRecord,
  type RestoreSessionRecord, type SafeSourceReference, type SyncCheckpointRecord,
} from './types';
import {
  validTimestamp, validateAttachmentState, validateCheckpoint, validateDatabaseMeta, validateEntityEnvelope,
  validateGenerationRecord, validateMigrationState, validateOutboxRecord, validateRestoreSession, validateSafeSource,
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

export class LocalDatabaseRepository {
  readonly namespace: LocalDatabaseNamespace;
  readonly namespaceKey: string;
  private readonly db: IDBDatabase;
  private readonly state: ConnectionState;

  constructor(db: IDBDatabase, namespace: LocalDatabaseNamespace, namespaceKey: string, state: ConnectionState) {
    this.db = db; this.namespace = Object.freeze({ ...namespace }); this.namespaceKey = namespaceKey; this.state = state;
  }

  private assertOpen(operation: string): void {
    if (this.state.stale) throw new LocalDatabaseError('STALE_CONNECTION', operation);
    if (this.state.closed) throw new LocalDatabaseError('DATABASE_CLOSED', operation);
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

  async runEntityMutationTransaction<T>(input: EntityMutationTransactionInput<T>): Promise<LocalEntityEnvelope<T>> {
    this.assertOpen('entity_mutation');
    const { mutation } = input;
    validateSafeIdentifier(mutation.domain, 'entity_mutation');
    if (typeof mutation.entityId !== 'string' || mutation.entityId.length === 0 || mutation.entityId.length > 512) {
      throw new LocalDatabaseError('INVALID_ENTITY', 'entity_mutation');
    }
    validateSafeSource(mutation.source);
    const stores: string[] = [LOCAL_DATABASE_STORES.databaseMeta, LOCAL_DATABASE_STORES.generations, LOCAL_DATABASE_STORES.entities];
    if (input.outbox) stores.push(LOCAL_DATABASE_STORES.outbox);
    const transaction = this.db.transaction(stores, 'readwrite');
    const done = transactionCompletion(transaction, 'entity_mutation');
    try {
      await this.ensureActive(transaction);
      if (input.testOnlyAbortAt === 'before_entity') throw new LocalDatabaseError('INVALID_ENTITY', 'entity_mutation');
      const entityStore = transaction.objectStore(LOCAL_DATABASE_STORES.entities);
      const key = entityKey(this.namespaceKey, this.namespace.generationId, mutation.domain, mutation.entityId);
      const current = await requestResult(entityStore.get(key)) as LocalEntityEnvelope<T> | undefined;
      const actualRevision = current?.revision ?? 0;
      if (mutation.expectedRevision !== undefined && mutation.expectedRevision !== actualRevision) {
        throw new LocalDatabaseError('STALE_REVISION', 'entity_mutation');
      }
      const operation = mutation.operation ?? 'upsert';
      if (operation === 'tombstone' && !current) throw new LocalDatabaseError('ENTITY_NOT_FOUND', 'entity_mutation');
      if (operation === 'upsert' && current?.deletedAt) throw new LocalDatabaseError('TOMBSTONE_REACTIVATION_BLOCKED', 'entity_mutation');
      const timestamp = now(mutation.timestamp);
      const envelope: LocalEntityEnvelope<T> = {
        namespaceKey: this.namespaceKey, generationId: this.namespace.generationId,
        domain: mutation.domain, entityId: mutation.entityId,
        record: operation === 'tombstone' ? current!.record : mutation.record,
        revision: actualRevision + 1, createdAt: current?.createdAt ?? timestamp, updatedAt: timestamp,
        deletedAt: operation === 'tombstone' ? timestamp : null, isDeleted: operation === 'tombstone',
        deletionState: operation === 'tombstone' ? 'deleted' : 'active',
        ownerId: mutation.ownerId === undefined ? current?.ownerId ?? null : mutation.ownerId,
        contentHash: mutation.contentHash === undefined ? current?.contentHash ?? null : mutation.contentHash,
        source: mutation.source === undefined ? current?.source ?? null : mutation.source,
      };
      validateEntityEnvelope(envelope);
      entityStore.put(envelope);
      if (input.testOnlyAbortAt === 'before_outbox') throw new LocalDatabaseError('INVALID_OUTBOX', 'entity_mutation');
      if (input.outbox) {
        const outbox: OutboxRecord = {
          ...input.outbox, namespaceKey: this.namespaceKey, generationId: this.namespace.generationId,
          baseRevision: actualRevision || null, localRevision: envelope.revision,
        };
        validateOutboxRecord(outbox);
        transaction.objectStore(LOCAL_DATABASE_STORES.outbox).add(outbox);
      }
      if (input.testOnlyAbortAt === 'after_writes') {
        transaction.abort(); throw new LocalDatabaseError('TRANSACTION_ABORTED', 'entity_mutation');
      }
      await done;
      return envelope;
    } catch (error) {
      abortQuietly(transaction); await done.catch(() => undefined); throw localDatabaseError(error, 'entity_mutation');
    }
  }

  putEntity<T>(mutation: EntityMutationInput<T>): Promise<LocalEntityEnvelope<T>> {
    return this.runEntityMutationTransaction({ mutation: { ...mutation, operation: 'upsert' } });
  }

  async tombstoneEntity(domain: string, entityId: string, expectedRevision: number, timestamp?: string): Promise<LocalEntityEnvelope> {
    return this.runEntityMutationTransaction({ mutation: { domain, entityId, record: null, operation: 'tombstone', expectedRevision, timestamp } });
  }

  async getEntity<T>(domain: string, entityId: string): Promise<LocalEntityEnvelope<T> | null> {
    this.assertOpen('get_entity'); validateSafeIdentifier(domain, 'get_entity');
    const transaction = this.db.transaction(LOCAL_DATABASE_STORES.entities, 'readonly');
    const done = transactionCompletion(transaction, 'get_entity');
    const value = await requestResult(transaction.objectStore(LOCAL_DATABASE_STORES.entities)
      .get(entityKey(this.namespaceKey, this.namespace.generationId, domain, entityId))) as LocalEntityEnvelope<T> | undefined;
    await done; return value ?? null;
  }

  async listEntities<T>(options: EntityListOptions): Promise<LocalEntityEnvelope<T>[]> {
    this.assertOpen('list_entities'); validateSafeIdentifier(options.domain, 'list_entities');
    const transaction = this.db.transaction(LOCAL_DATABASE_STORES.entities, 'readonly');
    const done = transactionCompletion(transaction, 'list_entities');
    const index = transaction.objectStore(LOCAL_DATABASE_STORES.entities).index('by_namespace_generation_domain');
    const values = await requestResult(index.getAll(IDBKeyRange.only([this.namespaceKey, this.namespace.generationId, options.domain]))) as LocalEntityEnvelope<T>[];
    await done;
    return values.filter(value => options.includeDeleted || !value.isDeleted)
      .sort((a, b) => a.entityId.localeCompare(b.entityId));
  }

  async listEntitiesByOwner<T>(ownerId: string): Promise<LocalEntityEnvelope<T>[]> {
    this.assertOpen('list_entities_by_owner'); validateSafeIdentifier(ownerId, 'list_entities_by_owner');
    const transaction = this.db.transaction(LOCAL_DATABASE_STORES.entities, 'readonly');
    const done = transactionCompletion(transaction, 'list_entities_by_owner');
    const index = transaction.objectStore(LOCAL_DATABASE_STORES.entities).index('by_namespace_generation_owner');
    const values = await requestResult(index.getAll(IDBKeyRange.only([this.namespaceKey, this.namespace.generationId, ownerId]))) as LocalEntityEnvelope<T>[];
    await done; return values.sort((a, b) => `${a.domain}\0${a.entityId}`.localeCompare(`${b.domain}\0${b.entityId}`));
  }

  async getOutboxRecord(mutationId: string): Promise<OutboxRecord | null> {
    this.assertOpen('get_outbox'); validateSafeIdentifier(mutationId, 'get_outbox');
    const transaction = this.db.transaction(LOCAL_DATABASE_STORES.outbox, 'readonly');
    const done = transactionCompletion(transaction, 'get_outbox');
    const value = await requestResult(transaction.objectStore(LOCAL_DATABASE_STORES.outbox)
      .get([this.namespaceKey, this.namespace.generationId, mutationId])) as OutboxRecord | undefined;
    await done; return value ?? null;
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

  async putRestoreSession(value: RestoreSessionRecord): Promise<void> {
    this.assertOpen('put_restore_session'); validateRestoreSession(value);
    if (value.namespaceKey !== this.namespaceKey) throw new LocalDatabaseError('NAMESPACE_MISMATCH', 'put_restore_session');
    const transaction = this.db.transaction(LOCAL_DATABASE_STORES.restoreSessions, 'readwrite');
    const done = transactionCompletion(transaction, 'put_restore_session');
    try { transaction.objectStore(LOCAL_DATABASE_STORES.restoreSessions).put(value); await done; }
    catch (error) { abortQuietly(transaction); await done.catch(() => undefined); throw localDatabaseError(error, 'put_restore_session'); }
  }

  async putMigrationState(value: MigrationStateRecord): Promise<void> {
    this.assertOpen('put_migration_state'); validateMigrationState(value);
    if (value.namespaceKey !== this.namespaceKey) throw new LocalDatabaseError('NAMESPACE_MISMATCH', 'put_migration_state');
    const transaction = this.db.transaction(LOCAL_DATABASE_STORES.migrationState, 'readwrite');
    const done = transactionCompletion(transaction, 'put_migration_state');
    try { transaction.objectStore(LOCAL_DATABASE_STORES.migrationState).put(value); await done; }
    catch (error) { abortQuietly(transaction); await done.catch(() => undefined); throw localDatabaseError(error, 'put_migration_state'); }
  }
}

export async function openLocalDatabase(
  namespace: LocalDatabaseNamespace,
  options: { capability: LocalDatabaseCapability; indexedDBFactory?: IDBFactory },
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
      try { createLocalDatabaseSchema(request.result, event.oldVersion); }
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
        settled = true; resolve(new LocalDatabaseRepository(request.result, namespace, fingerprint, state));
      } catch (error) { request.result.close(); settled = true; reject(localDatabaseError(error, 'open_database')); }
    };
  });
}

export function closeLocalDatabase(repository: LocalDatabaseRepository): void {
  repository.close();
}
