import { LocalDatabaseError, localDatabaseError, type LocalDatabaseErrorCode } from './errors';
import { deriveOutboxIdempotencyKey } from './outboxIdentity';
import { LOCAL_DATABASE_STORES } from './schema';
import type {
  DatabaseMetaRecord, GenerationRecord, LocalDatabaseNamespace, LocalEntityEnvelope, OutboxRecord,
  ResurrectionProvenance, RestoreClassification, RestoreProvenance, RestoreSessionRecord, RestoreSummary,
} from './types';
import {
  validTimestamp, validateDatabaseMeta, validateEntityEnvelope, validateGenerationRecord,
  validateOutboxRecord, validateRestoreSession, validateRestoreSessionGraph,
} from './validation';

export const RESTORE_PACKAGE_PROTOCOL = 1 as const;
export const MAX_RESTORE_ENTITIES = 5_000;
export const MAX_RESTORE_PACKAGE_BYTES = 2 * 1024 * 1024;
export const MAX_RESTORE_ENTITY_BYTES = 128 * 1024;

const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HASH = /^[a-f0-9]{64}$/;
const ZONED_TIME = /^\d{4}-\d{2}-\d{2}T.+(?:Z|[+-]\d{2}:\d{2})$/;

export type RestoreSource = 'recovery_export' | 'user_backup' | 'migration_fixture';
export interface RestoreNotePayload {
  id: string; title: string; body: string; createdAt?: number; lastOpenedAt?: number;
  updatedAt: number; folderId: string | null; deletedAt: number | null; starred?: boolean;
  properties?: Record<string, string>; relations?: Record<string, string[]>;
}
export interface RestoreEntityV1 {
  domain: 'notes'; entityId: string; sourceRevision: number | null;
  sourceUpdatedAt: string | null; sourceDeletedAt: string | null; payload: RestoreNotePayload;
}
export interface RestorePackageV1 {
  protocolVersion: 1; packageId: string; exportedAt: string; source: RestoreSource;
  namespaceFingerprint: string; projectFingerprint: string | null; entities: RestoreEntityV1[];
  manifest: { entityCount: number; contentDigest: string };
}
export type RestoreFailurePoint =
  | 'session_creation' | 'validation_completion' | 'staging_first_entity' | 'staging_middle_entity'
  | 'staging_final_entity' | 'active_generation_reread' | 'entity_materialization'
  | 'outbox_creation' | 'generation_activation' | 'session_committed_update' | 'transaction_completion';
export interface RestoreOptions {
  sessionId: string;
  conflictPolicy?: 'fail' | 'replace' | 'preserve_local';
  allowResurrection?: boolean;
  now?: string;
  testOnlyFailAt?: RestoreFailurePoint;
}
export interface RestoreResult { sessionId: string; targetGenerationId: string; summary: RestoreSummary }
export function restoreErrorRetryable(code: LocalDatabaseErrorCode): boolean {
  return code === 'RESTORE_TRANSACTION_FAILED' || code === 'TRANSACTION_ABORTED' || code === 'TRANSACTION_FAILED';
}

export interface RestoreRuntime {
  db: IDBDatabase; namespace: LocalDatabaseNamespace; namespaceKey: string;
  mutationIdFactory: () => string; clock: () => string; assertOpen: (operation: string) => void;
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
    transaction.onerror = () => undefined;
  });
}
function abortQuietly(transaction: IDBTransaction): void { try { transaction.abort(); } catch { /* inactive */ } }
function fail(code: LocalDatabaseErrorCode, operation = 'restore'): never { throw new LocalDatabaseError(code, operation); }
function exactKeys(value: object, keys: readonly string[], code: LocalDatabaseErrorCode): void {
  if (Object.keys(value).sort().join(',') !== [...keys].sort().join(',')) fail(code, 'restore_package');
}
function timestamp(value: unknown): value is string {
  return validTimestamp(value) && ZONED_TIME.test(value);
}
function safeInteger(value: unknown, nullable = false): boolean {
  return nullable && value === null || Number.isSafeInteger(value) && (value as number) >= 1;
}
function canonical(value: unknown): string {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value)) fail('INVALID_RESTORE_PACKAGE', 'canonical_restore');
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (typeof value === 'object') {
    return `{${Object.keys(value as object).sort().map(key => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`).join(',')}}`;
  }
  fail('INVALID_RESTORE_PACKAGE', 'canonical_restore');
}
async function sha256(value: string): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(bytes)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}
function packageDigestInput(value: RestorePackageV1): unknown {
  return [value.protocolVersion, value.packageId, value.exportedAt, value.source,
    value.namespaceFingerprint, value.projectFingerprint, value.entities];
}
export async function computeRestorePackageDigest(value: Omit<RestorePackageV1, 'manifest'>): Promise<string> {
  return sha256(canonical([value.protocolVersion, value.packageId, value.exportedAt, value.source,
    value.namespaceFingerprint, value.projectFingerprint, value.entities]));
}
export async function computeRestoreProjectFingerprint(projectRef: string): Promise<string> {
  if (!SAFE_ID.test(projectRef)) fail('RESTORE_PROJECT_MISMATCH', 'project_fingerprint');
  return sha256(canonical(['absinthe-project-v1', projectRef]));
}

function validateNotePayload(payload: unknown, entityId: string): asserts payload is RestoreNotePayload {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) fail('INVALID_RESTORE_PACKAGE');
  const record = payload as Record<string, unknown>;
  const allowed = ['id', 'title', 'body', 'createdAt', 'lastOpenedAt', 'updatedAt', 'folderId', 'deletedAt', 'starred', 'properties', 'relations'];
  if (Object.keys(record).some(key => !allowed.includes(key))) fail('INVALID_RESTORE_PACKAGE');
  if (record.id !== entityId || !UUID.test(entityId) || typeof record.title !== 'string' || record.title.length > 1_000
    || typeof record.body !== 'string' || record.body.length > 120_000
    || !Number.isSafeInteger(record.updatedAt) || (record.updatedAt as number) < 0
    || (record.createdAt !== undefined && (!Number.isSafeInteger(record.createdAt) || (record.createdAt as number) < 0))
    || (record.lastOpenedAt !== undefined && (!Number.isSafeInteger(record.lastOpenedAt) || (record.lastOpenedAt as number) < 0))
    || (record.folderId !== null && (typeof record.folderId !== 'string' || !UUID.test(record.folderId)))
    || (record.deletedAt !== null && (!Number.isSafeInteger(record.deletedAt) || (record.deletedAt as number) < 0))
    || (record.starred !== undefined && typeof record.starred !== 'boolean')) fail('INVALID_RESTORE_PACKAGE');
  if (record.properties !== undefined && (!record.properties || typeof record.properties !== 'object' || Array.isArray(record.properties)
    || !Object.entries(record.properties).every(([key, item]) => key.length <= 128 && typeof item === 'string' && item.length <= 4_096))) {
    fail('INVALID_RESTORE_PACKAGE');
  }
  if (record.relations !== undefined && (!record.relations || typeof record.relations !== 'object' || Array.isArray(record.relations)
    || !Object.values(record.relations).every(item => Array.isArray(item) && item.length <= 1_000
      && item.every(id => typeof id === 'string' && UUID.test(id))))) fail('INVALID_RESTORE_PACKAGE');
  if (new TextEncoder().encode(canonical(record)).length > MAX_RESTORE_ENTITY_BYTES) fail('RESTORE_PAYLOAD_TOO_LARGE');
}

export async function validateRestorePackage(
  value: unknown, authoritativeNamespaceFingerprint: string, authoritativeProjectFingerprint: string,
): Promise<RestorePackageV1> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('INVALID_RESTORE_PACKAGE');
  const packageValue = value as RestorePackageV1;
  exactKeys(packageValue, ['protocolVersion', 'packageId', 'exportedAt', 'source', 'namespaceFingerprint', 'projectFingerprint', 'entities', 'manifest'], 'INVALID_RESTORE_PACKAGE');
  if (packageValue.protocolVersion !== 1) fail('INVALID_RESTORE_PROTOCOL');
  if (!SAFE_ID.test(packageValue.packageId) || !timestamp(packageValue.exportedAt)
    || !['recovery_export', 'user_backup', 'migration_fixture'].includes(packageValue.source)
    || !HASH.test(packageValue.namespaceFingerprint) || !Array.isArray(packageValue.entities)
    || !packageValue.manifest || typeof packageValue.manifest !== 'object') fail('INVALID_RESTORE_PACKAGE');
  exactKeys(packageValue.manifest, ['entityCount', 'contentDigest'], 'INVALID_RESTORE_PACKAGE');
  if (packageValue.namespaceFingerprint !== authoritativeNamespaceFingerprint) fail('RESTORE_NAMESPACE_MISMATCH');
  if (packageValue.projectFingerprint !== authoritativeProjectFingerprint) fail('RESTORE_PROJECT_MISMATCH');
  if (packageValue.entities.length > MAX_RESTORE_ENTITIES) fail('RESTORE_PAYLOAD_TOO_LARGE');
  if (!Number.isSafeInteger(packageValue.manifest.entityCount) || packageValue.manifest.entityCount !== packageValue.entities.length) {
    fail('PACKAGE_ENTITY_COUNT_MISMATCH');
  }
  if (!HASH.test(packageValue.manifest.contentDigest)) fail('INVALID_RESTORE_PACKAGE');
  const seen = new Set<string>();
  for (const entity of packageValue.entities) {
    if (!entity || typeof entity !== 'object' || Array.isArray(entity)) fail('INVALID_RESTORE_PACKAGE');
    exactKeys(entity, ['domain', 'entityId', 'sourceRevision', 'sourceUpdatedAt', 'sourceDeletedAt', 'payload'], 'INVALID_RESTORE_PACKAGE');
    if (entity.domain !== 'notes') fail('UNSUPPORTED_RESTORE_DOMAIN');
    if (seen.has(entity.entityId)) fail('DUPLICATE_RESTORE_ENTITY'); seen.add(entity.entityId);
    if (!safeInteger(entity.sourceRevision, true)
      || entity.sourceUpdatedAt !== null && !timestamp(entity.sourceUpdatedAt)
      || entity.sourceDeletedAt !== null && !timestamp(entity.sourceDeletedAt)) fail('INVALID_RESTORE_PACKAGE');
    validateNotePayload(entity.payload, entity.entityId);
    if ((entity.sourceDeletedAt === null) !== (entity.payload.deletedAt === null)) fail('INVALID_RESTORE_PACKAGE');
  }
  if (new TextEncoder().encode(canonical(packageValue)).length > MAX_RESTORE_PACKAGE_BYTES) fail('RESTORE_PAYLOAD_TOO_LARGE');
  const digest = await sha256(canonical(packageDigestInput(packageValue)));
  if (digest !== packageValue.manifest.contentDigest) fail('PACKAGE_DIGEST_MISMATCH');
  return packageValue;
}

function preflightRestorePackage(value: unknown, namespaceFingerprint: string, projectFingerprint: string): RestorePackageV1 {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('INVALID_RESTORE_PACKAGE');
  const candidate = value as RestorePackageV1;
  exactKeys(candidate, ['protocolVersion', 'packageId', 'exportedAt', 'source', 'namespaceFingerprint', 'projectFingerprint', 'entities', 'manifest'], 'INVALID_RESTORE_PACKAGE');
  if (candidate.protocolVersion !== 1) fail('INVALID_RESTORE_PROTOCOL');
  if (!SAFE_ID.test(candidate.packageId) || !timestamp(candidate.exportedAt)
    || !['recovery_export', 'user_backup', 'migration_fixture'].includes(candidate.source)
    || candidate.namespaceFingerprint !== namespaceFingerprint || candidate.projectFingerprint !== projectFingerprint
    || !Array.isArray(candidate.entities) || candidate.entities.length > MAX_RESTORE_ENTITIES
    || !candidate.manifest || typeof candidate.manifest !== 'object' || Array.isArray(candidate.manifest)) {
    if (candidate.namespaceFingerprint !== namespaceFingerprint) fail('RESTORE_NAMESPACE_MISMATCH');
    if (candidate.projectFingerprint !== projectFingerprint) fail('RESTORE_PROJECT_MISMATCH');
    fail('INVALID_RESTORE_PACKAGE');
  }
  exactKeys(candidate.manifest, ['entityCount', 'contentDigest'], 'INVALID_RESTORE_PACKAGE');
  if (!HASH.test(candidate.manifest.contentDigest)) fail('INVALID_RESTORE_PACKAGE');
  if (new TextEncoder().encode(canonical(candidate)).length > MAX_RESTORE_PACKAGE_BYTES) fail('RESTORE_PAYLOAD_TOO_LARGE');
  return candidate;
}

const emptySummary = (): RestoreSummary => ({ inserted: 0, replaced: 0, skipped: 0, resurrected: 0, conflicts: 0 });
function generationKey(namespaceKey: string, generationId: string): [string, string] { return [namespaceKey, generationId]; }
function sessionKey(namespaceKey: string, sessionId: string): [string, string] { return [namespaceKey, sessionId]; }
function entityRange(namespaceKey: string, generationId: string): IDBKeyRange {
  return IDBKeyRange.bound([namespaceKey, generationId, '', ''], [namespaceKey, generationId, '\uffff', '\uffff']);
}
function outboxRange(namespaceKey: string, generationId: string): IDBKeyRange {
  return IDBKeyRange.bound([namespaceKey, generationId, ''], [namespaceKey, generationId, '\uffff']);
}
function persistedSession(value: unknown, namespaceKey: string): RestoreSessionRecord {
  try {
    validateRestoreSession(value as RestoreSessionRecord);
    if ((value as RestoreSessionRecord).namespaceKey !== namespaceKey) throw new Error('scope');
    return value as RestoreSessionRecord;
  } catch { fail('CORRUPT_PERSISTED_RECORD', 'get_restore_session'); }
}

async function readSession(runtime: RestoreRuntime, sessionId: string): Promise<RestoreSessionRecord | null> {
  const tx = runtime.db.transaction([
    LOCAL_DATABASE_STORES.databaseMeta, LOCAL_DATABASE_STORES.generations, LOCAL_DATABASE_STORES.restoreSessions,
  ], 'readonly');
  const done = transactionCompletion(tx, 'get_restore_session');
  const value = await requestResult(tx.objectStore(LOCAL_DATABASE_STORES.restoreSessions).get(sessionKey(runtime.namespaceKey, sessionId)));
  if (value === undefined) { await done; return null; }
  const session = persistedSession(value, runtime.namespaceKey);
  const meta = await requestResult(tx.objectStore(LOCAL_DATABASE_STORES.databaseMeta).get(runtime.namespaceKey)) as DatabaseMetaRecord | undefined;
  const generations = tx.objectStore(LOCAL_DATABASE_STORES.generations);
  const source = session.sourceGenerationId === null ? null
    : await requestResult(generations.get(generationKey(runtime.namespaceKey, session.sourceGenerationId))) as GenerationRecord | undefined;
  const staging = await requestResult(generations.get(generationKey(runtime.namespaceKey, session.stagingGenerationId))) as GenerationRecord | undefined;
  const target = session.targetGenerationId === null ? null
    : await requestResult(generations.get(generationKey(runtime.namespaceKey, session.targetGenerationId))) as GenerationRecord | undefined;
  await done;
  if (!meta) fail('CORRUPT_PERSISTED_RECORD', 'get_restore_session');
  validateRestoreSessionGraph({
    session, databaseMeta: meta, sourceGeneration: source ?? null, stagingGeneration: staging ?? null,
    targetGeneration: target ?? null, namespaceKey: runtime.namespaceKey, schemaVersion: runtime.namespace.schemaVersion,
  });
  return session;
}

const settledRestoreOutboxStatuses = new Set(['acknowledged', 'superseded']);
function assertNoUnsettledRestoreOutbox(records: OutboxRecord[]): void {
  try { records.forEach(validateOutboxRecord); }
  catch { fail('CORRUPT_PERSISTED_RECORD', 'validate_restore_outbox'); }
  if (records.some(record => !settledRestoreOutboxStatuses.has(record.status))) {
    fail('RESTORE_UNSETTLED_OUTBOX_CONFLICT', 'validate_restore_outbox');
  }
}

async function createSession(runtime: RestoreRuntime, packageValue: RestorePackageV1, options: RestoreOptions, digest: string, at: string): Promise<RestoreSessionRecord> {
  if (!SAFE_ID.test(options.sessionId)) fail('INVALID_RESTORE_PACKAGE', 'create_restore_session');
  const stagingGenerationId = `restore-${options.sessionId}`;
  if (!SAFE_ID.test(stagingGenerationId)) fail('INVALID_RESTORE_PACKAGE', 'create_restore_session');
  const tx = runtime.db.transaction([LOCAL_DATABASE_STORES.databaseMeta, LOCAL_DATABASE_STORES.generations, LOCAL_DATABASE_STORES.restoreSessions], 'readwrite');
  const done = transactionCompletion(tx, 'create_restore_session');
  try {
    const meta = await requestResult(tx.objectStore(LOCAL_DATABASE_STORES.databaseMeta).get(runtime.namespaceKey)) as DatabaseMetaRecord | undefined;
    if (!meta) fail('MALFORMED_METADATA'); validateDatabaseMeta(meta, runtime.namespaceKey, runtime.namespace.schemaVersion);
    if (meta.activeGenerationId !== runtime.namespace.generationId) fail('RESTORE_ACTIVE_GENERATION_CHANGED');
    const session: RestoreSessionRecord = {
      namespaceKey: runtime.namespaceKey, sessionId: options.sessionId, packageId: packageValue.packageId, protocolVersion: 1,
      expectedActiveGenerationId: meta.activeGenerationId, sourceGenerationId: meta.activeGenerationId,
      stagingGenerationId, targetGenerationId: null, status: 'created', packageDigest: digest,
      entityCount: packageValue.entities.length, createdAt: at, updatedAt: at, committedAt: null, failedAt: null,
      failureCode: null, summary: emptySummary(),
    };
    const generation: GenerationRecord = {
      namespaceKey: runtime.namespaceKey, generationId: stagingGenerationId, status: 'preparing', createdAt: at,
      activatedAt: null, predecessorGenerationId: meta.activeGenerationId, creationReason: 'restore',
      schemaVersion: runtime.namespace.schemaVersion, validationState: 'pending',
      safeSourceReference: { kind: 'recovery_package', reference: packageValue.packageId },
    };
    validateRestoreSession(session); validateGenerationRecord(generation, runtime.namespaceKey, runtime.namespace.schemaVersion);
    if (options.testOnlyFailAt === 'session_creation') fail('RESTORE_TRANSACTION_FAILED');
    tx.objectStore(LOCAL_DATABASE_STORES.generations).add(generation);
    tx.objectStore(LOCAL_DATABASE_STORES.restoreSessions).add(session);
    await done; return session;
  } catch (error) { abortQuietly(tx); await done.catch(() => undefined); throw localDatabaseError(error, 'create_restore_session'); }
}

async function updateSession(runtime: RestoreRuntime, sessionId: string, allowed: string[], transform: (value: RestoreSessionRecord) => RestoreSessionRecord): Promise<RestoreSessionRecord> {
  const tx = runtime.db.transaction(LOCAL_DATABASE_STORES.restoreSessions, 'readwrite'); const done = transactionCompletion(tx, 'transition_restore_session');
  try {
    const store = tx.objectStore(LOCAL_DATABASE_STORES.restoreSessions);
    const raw = await requestResult(store.get(sessionKey(runtime.namespaceKey, sessionId)));
    if (raw === undefined) fail('RESTORE_SESSION_CONFLICT');
    const current = persistedSession(raw, runtime.namespaceKey);
    if (!allowed.includes(current.status)) fail(current.status === 'committed' ? 'RESTORE_ALREADY_COMMITTED' : 'RESTORE_SESSION_CONFLICT');
    const next = transform(current);
    for (const key of ['namespaceKey', 'sessionId', 'packageId', 'protocolVersion', 'expectedActiveGenerationId',
      'sourceGenerationId', 'stagingGenerationId', 'packageDigest', 'entityCount', 'createdAt'] as const) {
      if (next[key] !== current[key]) fail('RESTORE_SESSION_CONFLICT', 'transition_restore_session');
    }
    validateRestoreSession(next); store.put(next); await done; return next;
  } catch (error) { abortQuietly(tx); await done.catch(() => undefined); throw localDatabaseError(error, 'transition_restore_session'); }
}

function sameRecord(left: unknown, right: unknown): boolean { return canonical(left) === canonical(right); }

async function stage(runtime: RestoreRuntime, packageValue: RestorePackageV1, options: RestoreOptions, at: string): Promise<RestoreSessionRecord> {
  const tx = runtime.db.transaction([LOCAL_DATABASE_STORES.databaseMeta, LOCAL_DATABASE_STORES.generations,
    LOCAL_DATABASE_STORES.entities, LOCAL_DATABASE_STORES.outbox, LOCAL_DATABASE_STORES.restoreSessions], 'readwrite');
  const done = transactionCompletion(tx, 'stage_restore');
  try {
    const metaStore = tx.objectStore(LOCAL_DATABASE_STORES.databaseMeta); const generationStore = tx.objectStore(LOCAL_DATABASE_STORES.generations);
    const entityStore = tx.objectStore(LOCAL_DATABASE_STORES.entities); const sessionStore = tx.objectStore(LOCAL_DATABASE_STORES.restoreSessions);
    const meta = await requestResult(metaStore.get(runtime.namespaceKey)) as DatabaseMetaRecord | undefined;
    const rawSession = await requestResult(sessionStore.get(sessionKey(runtime.namespaceKey, options.sessionId)));
    if (!meta || rawSession === undefined) fail('RESTORE_SESSION_CONFLICT');
    validateDatabaseMeta(meta, runtime.namespaceKey, runtime.namespace.schemaVersion);
    const session = persistedSession(rawSession, runtime.namespaceKey);
    if (session.status !== 'validating' || session.packageDigest !== packageValue.manifest.contentDigest) fail('RESTORE_SESSION_CONFLICT');
    if (meta.activeGenerationId !== session.expectedActiveGenerationId) fail('RESTORE_ACTIVE_GENERATION_CHANGED');
    const generation = await requestResult(generationStore.get(generationKey(runtime.namespaceKey, session.stagingGenerationId))) as GenerationRecord | undefined;
    if (!generation || generation.status !== 'preparing') fail('RESTORE_SESSION_CONFLICT');
    const sourceOutbox = await requestResult(tx.objectStore(LOCAL_DATABASE_STORES.outbox)
      .getAll(outboxRange(runtime.namespaceKey, session.sourceGenerationId!))) as OutboxRecord[];
    assertNoUnsettledRestoreOutbox(sourceOutbox);
    const current = await requestResult(entityStore.getAll(entityRange(runtime.namespaceKey, meta.activeGenerationId))) as LocalEntityEnvelope[];
    current.forEach(validateEntityEnvelope);
    const target = new Map(current.map(entity => [entity.entityId, { ...entity, generationId: session.stagingGenerationId }]));
    const summary = emptySummary();
    const entities = [...packageValue.entities].sort((a, b) => a.entityId.localeCompare(b.entityId));
    for (let index = 0; index < entities.length; index += 1) {
      const incoming = entities[index]; const local = current.find(item => item.domain === incoming.domain && item.entityId === incoming.entityId);
      let classification: RestoreClassification; let next: LocalEntityEnvelope;
      if (incoming.sourceDeletedAt !== null) {
        if (local?.isDeleted && sameRecord(local.record, incoming.payload)) { classification = 'skip_identical'; summary.skipped += 1; continue; }
        summary.conflicts += 1; fail('RESTORE_TOMBSTONE_CONFLICT');
      }
      if (!local) { classification = 'insert'; summary.inserted += 1; }
      else if (!local.isDeleted && sameRecord(local.record, incoming.payload)) { summary.skipped += 1; continue; }
      else if (local.isDeleted) {
        if (!options.allowResurrection || !Number.isSafeInteger(local.revision)) { summary.conflicts += 1; fail('RESTORE_TOMBSTONE_CONFLICT'); }
        classification = 'resurrect'; summary.resurrected += 1;
      } else if ((options.conflictPolicy ?? 'fail') === 'replace') { classification = 'replace'; summary.replaced += 1; }
      else if (options.conflictPolicy === 'preserve_local') { summary.skipped += 1; continue; }
      else { summary.conflicts += 1; fail('RESTORE_ENTITY_REVISION_CONFLICT'); }
      const mutationId = runtime.mutationIdFactory();
      const resurrection: ResurrectionProvenance | null = classification === 'resurrect' ? {
        restoresEntityId: incoming.entityId, sourcePackageId: packageValue.packageId,
        sourceRestoreSessionId: options.sessionId, supersedesTombstoneRevision: local!.revision, restoredAt: at,
      } : null;
      const provenance: RestoreProvenance = {
        packageId: packageValue.packageId, restoreSessionId: options.sessionId, classification,
        sourceRevision: incoming.sourceRevision, sourceUpdatedAt: incoming.sourceUpdatedAt,
        sourceDeletedAt: incoming.sourceDeletedAt, expectedLocalRevision: local?.revision ?? null,
        restoredAt: at, mutationId, resurrection,
      };
      next = {
        namespaceKey: runtime.namespaceKey, generationId: session.stagingGenerationId, domain: incoming.domain,
        entityId: incoming.entityId, record: incoming.payload, revision: local ? local.revision + 1 : 1,
        createdAt: local?.createdAt ?? at, updatedAt: at, deletedAt: null, isDeleted: false, deletionState: 'active',
        ownerId: runtime.namespace.userId, contentHash: null,
        source: { kind: 'recovery_package', reference: packageValue.packageId }, restoreProvenance: provenance,
      };
      validateEntityEnvelope(next); target.set(incoming.entityId, next);
    }
    const stagedEntities = [...target.values()].sort((a, b) => a.entityId.localeCompare(b.entityId));
    for (let index = 0; index < stagedEntities.length; index += 1) {
      entityStore.put(stagedEntities[index]);
      if (options.testOnlyFailAt === 'staging_first_entity' && index === 0
        || options.testOnlyFailAt === 'staging_middle_entity' && index === Math.floor(stagedEntities.length / 2)
        || options.testOnlyFailAt === 'staging_final_entity' && index === stagedEntities.length - 1) fail('RESTORE_TRANSACTION_FAILED');
    }
    generationStore.put({ ...generation, validationState: 'valid' });
    const staged: RestoreSessionRecord = { ...session, status: 'staged', targetGenerationId: session.stagingGenerationId, updatedAt: at, summary };
    validateRestoreSession(staged); sessionStore.put(staged);
    if (options.testOnlyFailAt === 'validation_completion') fail('RESTORE_TRANSACTION_FAILED');
    await done; return staged;
  } catch (error) { abortQuietly(tx); await done.catch(() => undefined); throw localDatabaseError(error, 'stage_restore'); }
}

function currentMatchesPlan(current: LocalEntityEnvelope[], staged: LocalEntityEnvelope[], restoreSessionId: string): boolean {
  const stagedMap = new Map(staged.map(item => [item.entityId, item]));
  for (const local of current) {
    const planned = stagedMap.get(local.entityId); if (!planned) return false;
    const provenance = planned.restoreProvenance;
    if (provenance?.restoreSessionId === restoreSessionId && ['replace', 'resurrect'].includes(provenance.classification)) {
      if (provenance.expectedLocalRevision !== local.revision) return false;
    } else if (planned.revision !== local.revision || planned.isDeleted !== local.isDeleted || !sameRecord(planned.record, local.record)) return false;
  }
  for (const planned of staged) {
    if (planned.restoreProvenance?.restoreSessionId === restoreSessionId
      && planned.restoreProvenance.classification === 'insert'
      && current.some(item => item.entityId === planned.entityId)) return false;
  }
  return true;
}

async function commit(runtime: RestoreRuntime, options: RestoreOptions, at: string): Promise<RestoreResult> {
  const stores = [LOCAL_DATABASE_STORES.databaseMeta, LOCAL_DATABASE_STORES.generations, LOCAL_DATABASE_STORES.entities,
    LOCAL_DATABASE_STORES.outbox, LOCAL_DATABASE_STORES.restoreSessions];
  const tx = runtime.db.transaction(stores, 'readwrite'); const done = transactionCompletion(tx, 'commit_restore');
  try {
    const metaStore = tx.objectStore(LOCAL_DATABASE_STORES.databaseMeta); const generationStore = tx.objectStore(LOCAL_DATABASE_STORES.generations);
    const entityStore = tx.objectStore(LOCAL_DATABASE_STORES.entities); const outboxStore = tx.objectStore(LOCAL_DATABASE_STORES.outbox);
    const sessionStore = tx.objectStore(LOCAL_DATABASE_STORES.restoreSessions);
    const meta = await requestResult(metaStore.get(runtime.namespaceKey)) as DatabaseMetaRecord | undefined;
    const rawSession = await requestResult(sessionStore.get(sessionKey(runtime.namespaceKey, options.sessionId)));
    if (!meta || rawSession === undefined) fail('RESTORE_SESSION_CONFLICT'); validateDatabaseMeta(meta, runtime.namespaceKey, runtime.namespace.schemaVersion);
    const session = persistedSession(rawSession, runtime.namespaceKey);
    if (session.status !== 'committing' || !session.sourceGenerationId || !session.targetGenerationId) fail('RESTORE_SESSION_CONFLICT');
    if (options.testOnlyFailAt === 'active_generation_reread') fail('RESTORE_TRANSACTION_FAILED');
    if (meta.activeGenerationId !== session.expectedActiveGenerationId) fail('RESTORE_ACTIVE_GENERATION_CHANGED');
    const source = await requestResult(generationStore.get(generationKey(runtime.namespaceKey, session.sourceGenerationId))) as GenerationRecord | undefined;
    const target = await requestResult(generationStore.get(generationKey(runtime.namespaceKey, session.targetGenerationId))) as GenerationRecord | undefined;
    if (!source || source.status !== 'active' || !target || target.status !== 'preparing' || target.validationState !== 'valid') fail('RESTORE_ACTIVE_GENERATION_CHANGED');
    const current = await requestResult(entityStore.getAll(entityRange(runtime.namespaceKey, session.sourceGenerationId))) as LocalEntityEnvelope[];
    const staged = await requestResult(entityStore.getAll(entityRange(runtime.namespaceKey, session.targetGenerationId))) as LocalEntityEnvelope[];
    current.forEach(validateEntityEnvelope); staged.forEach(validateEntityEnvelope);
    if (!currentMatchesPlan(current, staged, session.sessionId)) fail('RESTORE_ENTITY_REVISION_CONFLICT');
    if (options.testOnlyFailAt === 'entity_materialization') fail('RESTORE_TRANSACTION_FAILED');
    const inherited = await requestResult(outboxStore.getAll(outboxRange(runtime.namespaceKey, session.sourceGenerationId))) as OutboxRecord[];
    assertNoUnsettledRestoreOutbox(inherited);
    for (const entity of staged) {
      const provenance = entity.restoreProvenance;
      if (provenance?.restoreSessionId !== session.sessionId || !provenance.mutationId
        || !['insert', 'replace', 'resurrect'].includes(provenance.classification)) continue;
      const outbox: OutboxRecord = {
        namespaceKey: runtime.namespaceKey, generationId: session.targetGenerationId, mutationId: provenance.mutationId,
        domain: entity.domain, entityId: entity.entityId, operation: 'upsert', baseRevision: provenance.expectedLocalRevision,
        localRevision: entity.revision, payloadMode: 'inline', payload: { kind: 'entity_snapshot', record: entity.record }, payloadHash: null,
        createdAt: at, updatedAt: at, availableAt: at, attemptCount: 0, status: 'pending',
        idempotencyKey: deriveOutboxIdempotencyKey({ namespaceKey: runtime.namespaceKey, generationId: session.targetGenerationId,
          domain: entity.domain, entityId: entity.entityId, localRevision: entity.revision, operation: 'upsert' }),
        lastAttemptAt: null, lastErrorCode: null, leaseOwner: null, leaseExpiresAt: null,
        acknowledgedAt: null, acknowledgedBy: null, remoteMutationRef: null, supersededByMutationId: null,
        resurrection: provenance.resurrection,
        deliveryBlockCode: provenance.resurrection ? 'REMOTE_RESURRECTION_UNSUPPORTED' : null,
        generationBoundary: provenance.expectedLocalRevision === null ? null : {
          kind: 'restore', sourceGenerationId: session.sourceGenerationId,
          sourceRevision: provenance.expectedLocalRevision, restoreSessionId: session.sessionId,
        },
      };
      validateOutboxRecord(outbox); outboxStore.add(outbox);
    }
    if (options.testOnlyFailAt === 'outbox_creation') fail('RESTORE_TRANSACTION_FAILED');
    generationStore.put({ ...source, status: 'sealed', activeNamespaceKey: undefined });
    generationStore.put({ ...target, status: 'active', activatedAt: at, activeNamespaceKey: runtime.namespaceKey });
    metaStore.put({ ...meta, activeGenerationId: session.targetGenerationId });
    if (options.testOnlyFailAt === 'generation_activation') fail('RESTORE_TRANSACTION_FAILED');
    const committed: RestoreSessionRecord = { ...session, status: 'committed', updatedAt: at, committedAt: at, summary: session.summary };
    validateRestoreSession(committed); sessionStore.put(committed);
    if (options.testOnlyFailAt === 'session_committed_update') fail('RESTORE_TRANSACTION_FAILED');
    if (options.testOnlyFailAt === 'transaction_completion') { tx.abort(); fail('RESTORE_TRANSACTION_FAILED'); }
    await done; return { sessionId: committed.sessionId, targetGenerationId: committed.targetGenerationId!, summary: committed.summary };
  } catch (error) { abortQuietly(tx); await done.catch(() => undefined); throw localDatabaseError(error, 'commit_restore'); }
}

export async function restorePackageAtomically(runtime: RestoreRuntime, untrusted: unknown, options: RestoreOptions): Promise<RestoreResult> {
  runtime.assertOpen('restore_package');
  const at = options.now ?? runtime.clock(); if (!timestamp(at)) fail('INVALID_RESTORE_PACKAGE');
  const namespaceFingerprint = runtime.namespaceKey;
  const projectFingerprint = await computeRestoreProjectFingerprint(runtime.namespace.projectRef);
  const candidate = preflightRestorePackage(untrusted, namespaceFingerprint, projectFingerprint);
  const digest = candidate.manifest.contentDigest;
  let session = await readSession(runtime, options.sessionId);
  if (session) {
    if (session.packageId !== candidate.packageId || session.packageDigest !== digest) fail('RESTORE_SESSION_CONFLICT');
    if (session.status === 'failed') fail((session.failureCode as LocalDatabaseErrorCode) ?? 'RESTORE_SESSION_CONFLICT');
    if (session.status === 'cancelled') fail('RESTORE_CANCELLED');
  } else {
    try { session = await createSession(runtime, candidate, options, digest, at); }
    catch (error) {
      if (options.testOnlyFailAt === 'session_creation') fail('RESTORE_TRANSACTION_FAILED');
      if (error instanceof LocalDatabaseError && ['TRANSACTION_FAILED', 'TRANSACTION_ABORTED'].includes(error.code)) fail('RESTORE_SESSION_CONFLICT');
      throw error;
    }
  }
  if (session.status === 'created') session = await updateSession(runtime, options.sessionId, ['created'], value => ({ ...value, status: 'validating', updatedAt: at }));
  let packageValue: RestorePackageV1;
  try { packageValue = await validateRestorePackage(candidate, namespaceFingerprint, projectFingerprint); }
  catch (error) {
    if (session.status === 'validating') {
      const code = error instanceof LocalDatabaseError ? error.code : 'INVALID_RESTORE_PACKAGE';
      await updateSession(runtime, options.sessionId, ['validating'], value => ({
        ...value, status: 'failed', updatedAt: at, failedAt: at, failureCode: code,
      })).catch(() => undefined);
    }
    throw error;
  }
  if (session.status === 'committed') return { sessionId: session.sessionId, targetGenerationId: session.targetGenerationId!, summary: session.summary };
  if (session.status === 'validating') {
    try { session = await stage(runtime, packageValue, options, at); }
    catch (error) {
      if (error instanceof LocalDatabaseError && [
        'RESTORE_ENTITY_REVISION_CONFLICT', 'RESTORE_TOMBSTONE_CONFLICT', 'RESTORE_ACTIVE_GENERATION_CHANGED',
        'RESTORE_UNSETTLED_OUTBOX_CONFLICT',
      ].includes(error.code)) {
        await updateSession(runtime, options.sessionId, ['validating'], value => ({
          ...value, status: 'failed', updatedAt: at, failedAt: at, failureCode: error.code,
        })).catch(() => undefined);
      }
      throw error;
    }
  }
  if (session.status === 'staged') session = await updateSession(runtime, options.sessionId, ['staged'], value => ({ ...value, status: 'committing', updatedAt: at }));
  if (session.status === 'committing') {
    try { return await commit(runtime, options, at); }
    catch (error) {
      if (error instanceof LocalDatabaseError && [
        'RESTORE_ENTITY_REVISION_CONFLICT', 'RESTORE_ACTIVE_GENERATION_CHANGED', 'RESTORE_UNSETTLED_OUTBOX_CONFLICT',
      ].includes(error.code)) {
        await updateSession(runtime, options.sessionId, ['committing'], value => ({
          ...value, status: 'failed', updatedAt: at, failedAt: at, failureCode: error.code,
        })).catch(() => undefined);
      }
      throw error;
    }
  }
  fail('RESTORE_SESSION_CONFLICT');
}

export async function getRestoreSession(runtime: RestoreRuntime, sessionId: string): Promise<RestoreSessionRecord | null> {
  runtime.assertOpen('get_restore_session'); if (!SAFE_ID.test(sessionId)) fail('INVALID_RESTORE_PACKAGE'); return readSession(runtime, sessionId);
}

export async function cancelRestoreSession(runtime: RestoreRuntime, sessionId: string, at?: string): Promise<RestoreSessionRecord> {
  runtime.assertOpen('cancel_restore_session'); const timestampValue = at ?? runtime.clock(); if (!timestamp(timestampValue)) fail('INVALID_RESTORE_PACKAGE');
  await readSession(runtime, sessionId);
  return updateSession(runtime, sessionId, ['created', 'validating', 'staged'], value => ({
    ...value, status: 'cancelled', updatedAt: timestampValue, failureCode: 'RESTORE_CANCELLED', failedAt: timestampValue,
  }));
}
