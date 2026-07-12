import { LOCAL_DATABASE_VERSION } from './types';

export const LOCAL_DATABASE_STORES = {
  databaseMeta: 'database_meta', generations: 'generations', entities: 'entities', outbox: 'outbox',
  syncCheckpoints: 'sync_checkpoints', restoreSessions: 'restore_sessions', migrationState: 'migration_state',
  attachmentState: 'attachment_state',
} as const;

function index(store: IDBObjectStore, name: string, keyPath: string | string[], options?: IDBIndexParameters): void {
  store.createIndex(name, keyPath, options);
}

export function createLocalDatabaseSchema(db: IDBDatabase, oldVersion: number, transaction: IDBTransaction): void {
  if (![0, 1, 2].includes(oldVersion)) throw new DOMException('Unsupported schema upgrade', 'VersionError');

  if (oldVersion === 0) {
  const meta = db.createObjectStore(LOCAL_DATABASE_STORES.databaseMeta, { keyPath: 'namespaceKey' });
  index(meta, 'by_schema_version', 'schemaVersion');

  const generations = db.createObjectStore(LOCAL_DATABASE_STORES.generations, { keyPath: ['namespaceKey', 'generationId'] });
  index(generations, 'by_namespace_status', ['namespaceKey', 'status']);
  index(generations, 'by_namespace_created', ['namespaceKey', 'createdAt']);
  index(generations, 'one_active_per_namespace', 'activeNamespaceKey', { unique: true });

  const entities = db.createObjectStore(LOCAL_DATABASE_STORES.entities, { keyPath: ['namespaceKey', 'generationId', 'domain', 'entityId'] });
  index(entities, 'by_namespace_generation_domain', ['namespaceKey', 'generationId', 'domain']);
  index(entities, 'by_namespace_generation_owner', ['namespaceKey', 'generationId', 'ownerId']);
  index(entities, 'by_namespace_generation_deleted', ['namespaceKey', 'generationId', 'deletionState']);
  index(entities, 'by_namespace_generation_updated', ['namespaceKey', 'generationId', 'updatedAt']);

  const outbox = db.createObjectStore(LOCAL_DATABASE_STORES.outbox, { keyPath: ['namespaceKey', 'generationId', 'mutationId'] });
  index(outbox, 'by_namespace_generation_status', ['namespaceKey', 'generationId', 'status']);
  index(outbox, 'by_namespace_generation_entity', ['namespaceKey', 'generationId', 'domain', 'entityId']);
  index(outbox, 'by_idempotency_key', ['namespaceKey', 'generationId', 'idempotencyKey'], { unique: true });

  const checkpoints = db.createObjectStore(LOCAL_DATABASE_STORES.syncCheckpoints, { keyPath: ['namespaceKey', 'generationId', 'provider', 'stream'] });
  index(checkpoints, 'by_namespace_generation_provider', ['namespaceKey', 'generationId', 'provider']);

  const restore = db.createObjectStore(LOCAL_DATABASE_STORES.restoreSessions, { keyPath: ['namespaceKey', 'sessionId'] });
  index(restore, 'by_namespace_status', ['namespaceKey', 'status']);

  const migration = db.createObjectStore(LOCAL_DATABASE_STORES.migrationState, { keyPath: ['namespaceKey', 'migrationId'] });
  index(migration, 'by_namespace_phase', ['namespaceKey', 'phase']);

  const attachments = db.createObjectStore(LOCAL_DATABASE_STORES.attachmentState, { keyPath: ['namespaceKey', 'generationId', 'attachmentId'] });
  index(attachments, 'by_namespace_generation_sync', ['namespaceKey', 'generationId', 'syncState']);
  index(attachments, 'by_namespace_generation_updated', ['namespaceKey', 'generationId', 'updatedAt']);
  }

  if (oldVersion < 2) {
    const outbox = transaction.objectStore(LOCAL_DATABASE_STORES.outbox);
    index(outbox, 'by_namespace_generation_status_available', ['namespaceKey', 'generationId', 'status', 'availableAt']);
    index(outbox, 'by_namespace_generation_status_lease', ['namespaceKey', 'generationId', 'status', 'leaseExpiresAt']);
    index(outbox, 'by_namespace_generation_entity_revision', ['namespaceKey', 'generationId', 'domain', 'entityId', 'localRevision'], { unique: true });
  }

  if (oldVersion < 3) {
    const restore = transaction.objectStore(LOCAL_DATABASE_STORES.restoreSessions);
    index(restore, 'by_namespace_package_id', ['namespaceKey', 'packageId'], { unique: true });
    index(restore, 'by_namespace_package_digest', ['namespaceKey', 'packageDigest'], { unique: true });
    index(restore, 'by_namespace_staging_generation', ['namespaceKey', 'stagingGenerationId'], { unique: true });
  }

  if (oldVersion === 1 || oldVersion === 2) {
    const metadata = transaction.objectStore(LOCAL_DATABASE_STORES.databaseMeta);
    const request = metadata.openCursor();
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) return;
      cursor.update({ ...cursor.value, databaseFormatVersion: LOCAL_DATABASE_VERSION });
      cursor.continue();
    };
  }
}

export function assertLocalDatabaseVersion(db: IDBDatabase): void {
  if (db.version !== LOCAL_DATABASE_VERSION) throw new DOMException('Unsupported database version', 'VersionError');
}
