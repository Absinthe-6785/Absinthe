import { LocalDatabaseError, localDatabaseError, type LocalDatabaseErrorCode } from './errors';
import { transitionActiveGenerationInTransaction } from './activeGenerationTransition';
import { deriveOutboxIdempotencyKey } from './outboxIdentity';
import { LOCAL_DATABASE_STORES } from './schema';
import type {
  DatabaseMetaRecord, GenerationRecord, LocalDatabaseNamespace, LocalEntityEnvelope, OutboxRecord,
  ResurrectionProvenance, RestoreApplicationEntryV1, RestoreApplicationManifestV1,
  RestoreProvenance, RestoreSessionRecord, RestoreSummary,
} from './types';
import {
  validTimestamp, validateDatabaseMeta, validateEntityEnvelope, validateGenerationRecord,
  validateOutboxRecord, validateRestoreApplicationManifest, validateRestoreSequenceBoundaryGraph,
  validateRestoreSession, validateRestoreSessionGraph,
} from './validation';

export const RESTORE_PACKAGE_PROTOCOL = 1 as const;
export const MAX_RESTORE_ENTITIES = 5_000;
export const MAX_RESTORE_PACKAGE_BYTES = 2 * 1024 * 1024;
export const MAX_RESTORE_ENTITY_BYTES = 128 * 1024;
export const MAX_RESTORE_APPLICATION_MANIFEST_BYTES = 4 * 1024 * 1024;

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
  | 'outbox_creation' | 'generation_activation' | 'runtime_mode_update'
  | 'session_committed_update' | 'transaction_completion';
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

type RestoreApplicationManifestCore = Omit<RestoreApplicationManifestV1, 'manifestDigest'>;
function applicationManifestDigestInput(value: RestoreApplicationManifestCore): unknown {
  return ['absinthe-restore-application-v1', value.version, value.restoreSessionId, value.packageId, value.packageDigest,
    value.namespaceKey, value.sourceGenerationId, value.targetGenerationId, value.entryCount, value.entries,
    value.stagedEntityCount, value.stagedSetDigest];
}
async function applicationManifestDigest(value: RestoreApplicationManifestCore): Promise<string> {
  return sha256(canonical(applicationManifestDigestInput(value)));
}
async function entityDigest(value: LocalEntityEnvelope): Promise<string> {
  return sha256(canonical(['absinthe-restore-entity-v1', value]));
}
async function provenanceDigest(value: RestoreProvenance): Promise<string> {
  return sha256(canonical(['absinthe-restore-provenance-v1', value]));
}
function manifestCore(value: RestoreApplicationManifestV1): RestoreApplicationManifestCore {
  const { manifestDigest: _manifestDigest, ...core } = value;
  return core;
}
async function validateManifestIntegrity(session: RestoreSessionRecord, packageValue?: RestorePackageV1): Promise<RestoreApplicationManifestV1 | null> {
  const manifest = session.applicationManifest;
  if (manifest === null) return null;
  if (!validateRestoreApplicationManifest(manifest)
    || manifest.restoreSessionId !== session.sessionId || manifest.packageId !== session.packageId
    || manifest.packageDigest !== session.packageDigest || manifest.namespaceKey !== session.namespaceKey
    || manifest.sourceGenerationId !== session.sourceGenerationId || manifest.targetGenerationId !== session.stagingGenerationId
    || manifest.entryCount !== session.entityCount
    || await applicationManifestDigest(manifestCore(manifest)) !== manifest.manifestDigest
    || new TextEncoder().encode(canonical(manifest)).length > MAX_RESTORE_APPLICATION_MANIFEST_BYTES) {
    fail('CORRUPT_PERSISTED_RECORD', 'validate_restore_application_manifest');
  }
  if (packageValue) {
    const packageKeys = [...packageValue.entities].map(entity => `${entity.domain}\0${entity.entityId}`).sort();
    const manifestKeys = manifest.entries.map(entry => `${entry.domain}\0${entry.entityId}`);
    if (canonical(packageKeys) !== canonical(manifestKeys)) fail('CORRUPT_PERSISTED_RECORD', 'validate_restore_application_manifest');
  }
  return manifest;
}

function summaryFromManifest(manifest: RestoreApplicationManifestV1): RestoreSummary {
  const summary = emptySummary();
  for (const entry of manifest.entries) {
    if (entry.classification === 'insert') summary.inserted += 1;
    else if (entry.classification === 'replace') summary.replaced += 1;
    else if (entry.classification === 'resurrect') summary.resurrected += 1;
    else if (entry.classification === 'skip_identical' || entry.classification === 'preserve_local') summary.skipped += 1;
    else summary.conflicts += 1;
  }
  return summary;
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
    LOCAL_DATABASE_STORES.databaseMeta, LOCAL_DATABASE_STORES.generations, LOCAL_DATABASE_STORES.entities,
    LOCAL_DATABASE_STORES.outbox, LOCAL_DATABASE_STORES.restoreSessions,
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
  const committedSourceEntities = session.status === 'committed' && session.sourceGenerationId !== null
    ? await requestResult(tx.objectStore(LOCAL_DATABASE_STORES.entities)
      .getAll(entityRange(runtime.namespaceKey, session.sourceGenerationId))) as LocalEntityEnvelope[] : [];
  const committedTargetEntities = session.status === 'committed' && session.targetGenerationId !== null
    ? await requestResult(tx.objectStore(LOCAL_DATABASE_STORES.entities)
      .getAll(entityRange(runtime.namespaceKey, session.targetGenerationId))) as LocalEntityEnvelope[] : [];
  const committedTargetOutbox = session.status === 'committed' && session.targetGenerationId !== null
    ? await requestResult(tx.objectStore(LOCAL_DATABASE_STORES.outbox)
      .getAll(outboxRange(runtime.namespaceKey, session.targetGenerationId))) as OutboxRecord[] : [];
  await done;
  if (!meta) fail('CORRUPT_PERSISTED_RECORD', 'get_restore_session');
  validateRestoreSessionGraph({
    session, databaseMeta: meta, sourceGeneration: source ?? null, stagingGeneration: staging ?? null,
    targetGeneration: target ?? null, namespaceKey: runtime.namespaceKey, schemaVersion: runtime.namespace.schemaVersion,
  });
  const manifest = await validateManifestIntegrity(session);
  if (session.status === 'committed') {
    await validateCommittedRestoreApplicationEvidence({
      session, manifest, databaseMeta: meta, sourceGeneration: source ?? null, targetGeneration: target ?? null,
      sourceEntities: committedSourceEntities, targetEntities: committedTargetEntities,
      targetOutbox: committedTargetOutbox, namespaceKey: runtime.namespaceKey, schemaVersion: runtime.namespace.schemaVersion,
    });
  }
  return session;
}

interface CommittedRestoreApplicationEvidence {
  session: RestoreSessionRecord;
  manifest: RestoreApplicationManifestV1 | null;
  databaseMeta: DatabaseMetaRecord;
  sourceGeneration: GenerationRecord | null;
  targetGeneration: GenerationRecord | null;
  sourceEntities: LocalEntityEnvelope[];
  targetEntities: LocalEntityEnvelope[];
  targetOutbox: OutboxRecord[];
  namespaceKey: string;
  schemaVersion: number;
}

async function validateCommittedRestoreApplicationEvidence(evidence: CommittedRestoreApplicationEvidence): Promise<void> {
  try {
    const { session, manifest, databaseMeta, sourceGeneration, targetGeneration, sourceEntities, targetEntities,
      targetOutbox, namespaceKey, schemaVersion } = evidence;
    if (!manifest || session.status !== 'committed' || session.blockingState !== null
      || !sourceGeneration || !targetGeneration || session.sourceGenerationId !== sourceGeneration.generationId
      || session.targetGenerationId !== targetGeneration.generationId) throw new Error('committed_evidence');
    validateRestoreSessionGraph({
      session, databaseMeta, sourceGeneration, stagingGeneration: targetGeneration, targetGeneration,
      namespaceKey, schemaVersion,
    });
    if (canonical(summaryFromManifest(manifest)) !== canonical(session.summary)
      || manifest.entries.some(entry => entry.classification === 'conflict')) throw new Error('committed_evidence');
    sourceEntities.forEach(validateEntityEnvelope); targetEntities.forEach(validateEntityEnvelope);
    targetOutbox.forEach(validateOutboxRecord);
    const targetKeys = targetEntities.map(entity => `${entity.domain}\0${entity.entityId}`).sort();
    if (targetEntities.length !== manifest.stagedEntityCount
      || await sha256(canonical(['absinthe-restore-staged-key-set-v1', targetKeys])) !== manifest.stagedSetDigest) {
      throw new Error('committed_evidence');
    }
    const sourceByKey = new Map(sourceEntities.map(entity => [`${entity.domain}\0${entity.entityId}`, entity]));
    const targetByKey = new Map(targetEntities.map(entity => [`${entity.domain}\0${entity.entityId}`, entity]));
    const outboxByMutation = new Map(targetOutbox.map(record => [record.mutationId, record]));
    const requiredEntries = manifest.entries.filter(entry => entry.requiresOutbox);
    const appliedKeys = new Set(requiredEntries.map(entry => `${entry.domain}\0${entry.entityId}`));
    if (targetOutbox.length !== requiredEntries.length || outboxByMutation.size !== targetOutbox.length) {
      throw new Error('committed_evidence');
    }
    for (const [key, target] of targetByKey) {
      if (appliedKeys.has(key)) continue;
      const source = sourceByKey.get(key);
      if (!source || canonical(target) !== canonical({ ...source, generationId: manifest.targetGenerationId })) {
        throw new Error('committed_evidence');
      }
    }
    for (const entry of manifest.entries) {
      const key = `${entry.domain}\0${entry.entityId}`; const source = sourceByKey.get(key);
      if (!entry.requiresOutbox) {
        if (!source || entry.sourceRevision !== source.revision) throw new Error('committed_evidence');
        continue;
      }
      const target = targetByKey.get(key); const provenance = target?.restoreProvenance;
      const outbox = entry.expectedMutationId === null ? undefined : outboxByMutation.get(entry.expectedMutationId);
      if (!target || !provenance || !outbox || !entry.expectedMutationId || !entry.expectedIdempotencyKey
        || target.namespaceKey !== namespaceKey || target.generationId !== manifest.targetGenerationId
        || target.domain !== entry.domain || target.entityId !== entry.entityId || target.revision !== entry.targetRevision
        || provenance.restoreSessionId !== session.sessionId || provenance.packageId !== session.packageId
        || provenance.classification !== entry.classification || provenance.expectedLocalRevision !== entry.sourceRevision
        || provenance.mutationId !== entry.expectedMutationId
        || target.source?.kind !== 'recovery_package' || target.source.reference !== session.packageId
        || await entityDigest(target) !== entry.expectedEntityDigest
        || await provenanceDigest(provenance) !== entry.expectedProvenanceDigest
        || outbox.namespaceKey !== namespaceKey || outbox.generationId !== manifest.targetGenerationId
        || outbox.domain !== entry.domain || outbox.entityId !== entry.entityId || outbox.operation !== entry.expectedOperation
        || outbox.baseRevision !== entry.sourceRevision || outbox.localRevision !== entry.targetRevision
        || outbox.idempotencyKey !== entry.expectedIdempotencyKey || outbox.payload.kind !== 'entity_snapshot'
        || canonical(outbox.payload.record) !== canonical(target.record)) throw new Error('committed_evidence');
      if (entry.classification === 'insert') {
        if (source || outbox.generationBoundary != null || outbox.resurrection != null || outbox.deliveryBlockCode != null) {
          throw new Error('committed_evidence');
        }
      } else {
        if (!source || source.revision !== entry.sourceRevision || target.revision !== source.revision + 1
          || (entry.classification === 'replace' && (source.isDeleted || outbox.resurrection != null || outbox.deliveryBlockCode != null))
          || (entry.classification === 'resurrect' && (!source.isDeleted
            || canonical(outbox.resurrection) !== canonical(provenance.resurrection)
            || outbox.deliveryBlockCode !== 'REMOTE_RESURRECTION_UNSUPPORTED'))) throw new Error('committed_evidence');
        validateRestoreSequenceBoundaryGraph({
          outbox, session, databaseMeta, sourceGeneration, targetGeneration,
          sourceEntity: source, targetEntity: target, namespaceKey, schemaVersion,
        });
      }
    }
  } catch {
    fail('CORRUPT_PERSISTED_RECORD', 'validate_committed_restore_application_evidence');
  }
}

const settledRestoreOutboxStatuses = new Set(['acknowledged', 'superseded']);
function hasUnsettledRestoreOutbox(records: OutboxRecord[]): boolean {
  try { records.forEach(validateOutboxRecord); }
  catch { fail('CORRUPT_PERSISTED_RECORD', 'validate_restore_outbox'); }
  return records.some(record => !settledRestoreOutboxStatuses.has(record.status));
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
      failureCode: null, blockingState: null, applicationManifest: null, summary: emptySummary(),
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
    if (current.applicationManifest !== null
      && canonical(next.applicationManifest) !== canonical(current.applicationManifest)) {
      fail('CORRUPT_PERSISTED_RECORD', 'transition_restore_session');
    }
    validateRestoreSession(next); store.put(next); await done; return next;
  } catch (error) { abortQuietly(tx); await done.catch(() => undefined); throw localDatabaseError(error, 'transition_restore_session'); }
}

function sameRecord(left: unknown, right: unknown): boolean { return canonical(left) === canonical(right); }
function entitySetCanonical(values: LocalEntityEnvelope[]): string {
  return canonical([...values].sort((left, right) => `${left.domain}\0${left.entityId}`.localeCompare(`${right.domain}\0${right.entityId}`)));
}

interface RestoreStagePlan {
  session: RestoreSessionRecord;
  current: LocalEntityEnvelope[];
  stagedEntities: LocalEntityEnvelope[];
  manifest: RestoreApplicationManifestV1;
  summary: RestoreSummary;
}

async function buildStagePlan(
  runtime: RestoreRuntime, packageValue: RestorePackageV1, options: RestoreOptions, at: string,
): Promise<RestoreStagePlan> {
  const tx = runtime.db.transaction([LOCAL_DATABASE_STORES.databaseMeta, LOCAL_DATABASE_STORES.generations,
    LOCAL_DATABASE_STORES.entities, LOCAL_DATABASE_STORES.restoreSessions], 'readonly');
  const done = transactionCompletion(tx, 'plan_restore');
  const meta = await requestResult(tx.objectStore(LOCAL_DATABASE_STORES.databaseMeta).get(runtime.namespaceKey)) as DatabaseMetaRecord | undefined;
  const rawSession = await requestResult(tx.objectStore(LOCAL_DATABASE_STORES.restoreSessions)
    .get(sessionKey(runtime.namespaceKey, options.sessionId)));
  if (!meta || rawSession === undefined) fail('RESTORE_SESSION_CONFLICT');
  validateDatabaseMeta(meta, runtime.namespaceKey, runtime.namespace.schemaVersion);
  const session = persistedSession(rawSession, runtime.namespaceKey);
  if (session.status !== 'validating' || session.applicationManifest !== null
    || session.packageDigest !== packageValue.manifest.contentDigest || meta.activeGenerationId !== session.expectedActiveGenerationId) {
    fail('RESTORE_SESSION_CONFLICT');
  }
  const generation = await requestResult(tx.objectStore(LOCAL_DATABASE_STORES.generations)
    .get(generationKey(runtime.namespaceKey, session.stagingGenerationId))) as GenerationRecord | undefined;
  if (!generation || generation.status !== 'preparing' || generation.validationState !== 'pending') fail('RESTORE_SESSION_CONFLICT');
  const current = await requestResult(tx.objectStore(LOCAL_DATABASE_STORES.entities)
    .getAll(entityRange(runtime.namespaceKey, meta.activeGenerationId))) as LocalEntityEnvelope[];
  await done;
  try { current.forEach(validateEntityEnvelope); }
  catch { fail('CORRUPT_PERSISTED_RECORD', 'plan_restore'); }

  const target = new Map(current.map(entity => [`${entity.domain}\0${entity.entityId}`, { ...entity, generationId: session.stagingGenerationId }]));
  const summary = emptySummary();
  const entryDrafts: Array<{ entry: RestoreApplicationEntryV1; entity: LocalEntityEnvelope | null; provenance: RestoreProvenance | null }> = [];
  const entities = [...packageValue.entities].sort((a, b) => `${a.domain}\0${a.entityId}`.localeCompare(`${b.domain}\0${b.entityId}`));
  for (const incoming of entities) {
    const local = current.find(item => item.domain === incoming.domain && item.entityId === incoming.entityId);
    let classification: RestoreApplicationEntryV1['classification'];
    if (incoming.sourceDeletedAt !== null) {
      if (local?.isDeleted && sameRecord(local.record, incoming.payload)) classification = 'skip_identical';
      else fail('RESTORE_TOMBSTONE_CONFLICT');
    } else if (!local) classification = 'insert';
    else if (!local.isDeleted && sameRecord(local.record, incoming.payload)) classification = 'skip_identical';
    else if (local.isDeleted) {
      if (!options.allowResurrection || !Number.isSafeInteger(local.revision)) fail('RESTORE_TOMBSTONE_CONFLICT');
      classification = 'resurrect';
    } else if ((options.conflictPolicy ?? 'fail') === 'replace') classification = 'replace';
    else if (options.conflictPolicy === 'preserve_local') classification = 'preserve_local';
    else fail('RESTORE_ENTITY_REVISION_CONFLICT');

    if (classification === 'skip_identical' || classification === 'preserve_local') {
      summary.skipped += 1;
      entryDrafts.push({ entity: null, provenance: null, entry: {
        domain: 'notes', entityId: incoming.entityId, classification, sourceRevision: local!.revision, targetRevision: null,
        expectedEntityDigest: null, expectedProvenanceDigest: null, requiresOutbox: false,
        expectedMutationId: null, expectedIdempotencyKey: null, expectedOperation: null, requiresSequenceBoundary: false,
      } });
      continue;
    }
    if (classification === 'insert') summary.inserted += 1;
    else if (classification === 'replace') summary.replaced += 1;
    else summary.resurrected += 1;
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
    const next: LocalEntityEnvelope = {
      namespaceKey: runtime.namespaceKey, generationId: session.stagingGenerationId, domain: incoming.domain,
      entityId: incoming.entityId, record: incoming.payload, revision: local ? local.revision + 1 : 1,
      createdAt: local?.createdAt ?? at, updatedAt: at, deletedAt: null, isDeleted: false, deletionState: 'active',
      ownerId: runtime.namespace.userId, contentHash: null,
      source: { kind: 'recovery_package', reference: packageValue.packageId }, restoreProvenance: provenance,
    };
    validateEntityEnvelope(next); target.set(`${incoming.domain}\0${incoming.entityId}`, next);
    entryDrafts.push({ entity: next, provenance, entry: {
      domain: 'notes', entityId: incoming.entityId, classification,
      sourceRevision: local?.revision ?? null, targetRevision: next.revision,
      expectedEntityDigest: null, expectedProvenanceDigest: null, requiresOutbox: true,
      expectedMutationId: mutationId,
      expectedIdempotencyKey: deriveOutboxIdempotencyKey({ namespaceKey: runtime.namespaceKey,
        generationId: session.stagingGenerationId, domain: incoming.domain, entityId: incoming.entityId,
        localRevision: next.revision, operation: 'upsert' }),
      expectedOperation: 'upsert', requiresSequenceBoundary: classification !== 'insert',
    } });
  }
  const entries = await Promise.all(entryDrafts.map(async draft => ({
    ...draft.entry,
    expectedEntityDigest: draft.entity ? await entityDigest(draft.entity) : null,
    expectedProvenanceDigest: draft.provenance ? await provenanceDigest(draft.provenance) : null,
  })));
  const stagedEntities = [...target.values()].sort((a, b) =>
    `${a.domain}\0${a.entityId}`.localeCompare(`${b.domain}\0${b.entityId}`));
  const stagedKeys = stagedEntities.map(entity => `${entity.domain}\0${entity.entityId}`);
  const core: RestoreApplicationManifestCore = {
    version: 1, restoreSessionId: session.sessionId, packageId: session.packageId, packageDigest: session.packageDigest,
    namespaceKey: runtime.namespaceKey, sourceGenerationId: session.sourceGenerationId!,
    targetGenerationId: session.stagingGenerationId, entries, entryCount: entries.length,
    stagedEntityCount: stagedEntities.length,
    stagedSetDigest: await sha256(canonical(['absinthe-restore-staged-key-set-v1', stagedKeys])),
  };
  const manifest: RestoreApplicationManifestV1 = { ...core, manifestDigest: await applicationManifestDigest(core) };
  if (!validateRestoreApplicationManifest(manifest)
    || new TextEncoder().encode(canonical(manifest)).length > MAX_RESTORE_APPLICATION_MANIFEST_BYTES) {
    fail('CORRUPT_PERSISTED_RECORD', 'plan_restore');
  }
  return { session, current, stagedEntities, manifest, summary };
}

async function stage(runtime: RestoreRuntime, packageValue: RestorePackageV1, options: RestoreOptions, at: string): Promise<RestoreSessionRecord> {
  const plan = await buildStagePlan(runtime, packageValue, options, at);
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
    if (canonical(session) !== canonical(plan.session) || session.status !== 'validating'
      || session.packageDigest !== packageValue.manifest.contentDigest) fail('RESTORE_SESSION_CONFLICT');
    if (meta.activeGenerationId !== session.expectedActiveGenerationId) fail('RESTORE_ACTIVE_GENERATION_CHANGED');
    const generation = await requestResult(generationStore.get(generationKey(runtime.namespaceKey, session.stagingGenerationId))) as GenerationRecord | undefined;
    if (!generation || generation.status !== 'preparing' || generation.validationState !== 'pending') fail('RESTORE_SESSION_CONFLICT');
    const sourceOutbox = await requestResult(tx.objectStore(LOCAL_DATABASE_STORES.outbox)
      .getAll(outboxRange(runtime.namespaceKey, session.sourceGenerationId!))) as OutboxRecord[];
    const blocked = hasUnsettledRestoreOutbox(sourceOutbox);
    const current = await requestResult(entityStore.getAll(entityRange(runtime.namespaceKey, meta.activeGenerationId))) as LocalEntityEnvelope[];
    if (entitySetCanonical(current) !== entitySetCanonical(plan.current)) fail('RESTORE_ACTIVE_GENERATION_CHANGED');
    const stagedEntities = plan.stagedEntities;
    for (let index = 0; index < stagedEntities.length; index += 1) {
      entityStore.put(stagedEntities[index]);
      if (options.testOnlyFailAt === 'staging_first_entity' && index === 0
        || options.testOnlyFailAt === 'staging_middle_entity' && index === Math.floor(stagedEntities.length / 2)
        || options.testOnlyFailAt === 'staging_final_entity' && index === stagedEntities.length - 1) fail('RESTORE_TRANSACTION_FAILED');
    }
    generationStore.put({ ...generation, validationState: 'valid' });
    const staged: RestoreSessionRecord = {
      ...session, status: 'staged', targetGenerationId: session.stagingGenerationId, updatedAt: at, summary: plan.summary,
      blockingState: blocked ? { code: 'RESTORE_UNSETTLED_OUTBOX_CONFLICT', detectedAt: at, attemptCount: 1 } : null,
      applicationManifest: plan.manifest,
    };
    validateRestoreSession(staged); sessionStore.put(staged);
    if (options.testOnlyFailAt === 'validation_completion') fail('RESTORE_TRANSACTION_FAILED');
    await done;
    if (blocked) fail('RESTORE_UNSETTLED_OUTBOX_CONFLICT', 'validate_restore_outbox');
    return staged;
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

interface RestoreCommitEvidence {
  manifest: RestoreApplicationManifestV1;
  currentCanonical: string;
  stagedCanonical: string;
}

async function prepareCommitEvidence(
  runtime: RestoreRuntime, session: RestoreSessionRecord, packageValue: RestorePackageV1,
): Promise<RestoreCommitEvidence> {
  const manifest = await validateManifestIntegrity(session, packageValue);
  if (!manifest || manifest.entries.some(entry => entry.classification === 'conflict')
    || canonical(summaryFromManifest(manifest)) !== canonical(session.summary)) {
    fail('CORRUPT_PERSISTED_RECORD', 'validate_restore_application_evidence');
  }
  const tx = runtime.db.transaction([LOCAL_DATABASE_STORES.entities, LOCAL_DATABASE_STORES.outbox], 'readonly');
  const done = transactionCompletion(tx, 'validate_restore_application_evidence');
  const current = await requestResult(tx.objectStore(LOCAL_DATABASE_STORES.entities)
    .getAll(entityRange(runtime.namespaceKey, manifest.sourceGenerationId))) as LocalEntityEnvelope[];
  const staged = await requestResult(tx.objectStore(LOCAL_DATABASE_STORES.entities)
    .getAll(entityRange(runtime.namespaceKey, manifest.targetGenerationId))) as LocalEntityEnvelope[];
  const targetOutbox = await requestResult(tx.objectStore(LOCAL_DATABASE_STORES.outbox)
    .getAll(outboxRange(runtime.namespaceKey, manifest.targetGenerationId))) as OutboxRecord[];
  await done;
  if (targetOutbox.length !== 0) fail('CORRUPT_PERSISTED_RECORD', 'validate_restore_application_evidence');
  try { current.forEach(validateEntityEnvelope); staged.forEach(validateEntityEnvelope); }
  catch { fail('CORRUPT_PERSISTED_RECORD', 'validate_restore_application_evidence'); }
  const currentByKey = new Map(current.map(entity => [`${entity.domain}\0${entity.entityId}`, entity]));
  const stagedByKey = new Map(staged.map(entity => [`${entity.domain}\0${entity.entityId}`, entity]));
  const appliedEntries = manifest.entries.filter(entry => entry.requiresOutbox);
  const appliedKeys = new Set(appliedEntries.map(entry => `${entry.domain}\0${entry.entityId}`));
  const stagedKeys = [...stagedByKey.keys()].sort();
  if (stagedByKey.size !== manifest.stagedEntityCount
    || await sha256(canonical(['absinthe-restore-staged-key-set-v1', stagedKeys])) !== manifest.stagedSetDigest) {
    fail('CORRUPT_PERSISTED_RECORD', 'validate_restore_application_evidence');
  }
  const restoreOwned = staged.filter(entity => entity.restoreProvenance?.restoreSessionId === session.sessionId
    || entity.source?.kind === 'recovery_package' && entity.source.reference === session.packageId);
  if (restoreOwned.length !== appliedEntries.length
    || restoreOwned.some(entity => !appliedKeys.has(`${entity.domain}\0${entity.entityId}`))) {
    fail('CORRUPT_PERSISTED_RECORD', 'validate_restore_application_evidence');
  }
  for (const entry of manifest.entries) {
    const key = `${entry.domain}\0${entry.entityId}`;
    const source = currentByKey.get(key);
    if (!entry.requiresOutbox) {
      if (!source || entry.sourceRevision !== source.revision) fail('CORRUPT_PERSISTED_RECORD', 'validate_restore_application_evidence');
      continue;
    }
    const target = stagedByKey.get(key); const provenance = target?.restoreProvenance;
    if (!target || !provenance || target.namespaceKey !== runtime.namespaceKey
      || target.generationId !== manifest.targetGenerationId || target.domain !== entry.domain || target.entityId !== entry.entityId
      || target.revision !== entry.targetRevision || provenance.restoreSessionId !== session.sessionId
      || provenance.packageId !== session.packageId || provenance.classification !== entry.classification
      || provenance.expectedLocalRevision !== entry.sourceRevision || provenance.mutationId !== entry.expectedMutationId
      || target.source?.kind !== 'recovery_package' || target.source.reference !== session.packageId
      || await entityDigest(target) !== entry.expectedEntityDigest
      || await provenanceDigest(provenance) !== entry.expectedProvenanceDigest) {
      fail('CORRUPT_PERSISTED_RECORD', 'validate_restore_application_evidence');
    }
    if (entry.classification === 'insert') {
      if (source || entry.sourceRevision !== null || target.revision !== 1 || entry.requiresSequenceBoundary) {
        fail('CORRUPT_PERSISTED_RECORD', 'validate_restore_application_evidence');
      }
    } else if (!source || source.revision !== entry.sourceRevision || target.revision !== source.revision + 1
      || (entry.classification === 'replace' && source.isDeleted)
      || (entry.classification === 'resurrect' && (!source.isDeleted || provenance.resurrection === null))
      || !entry.requiresSequenceBoundary) {
      fail('CORRUPT_PERSISTED_RECORD', 'validate_restore_application_evidence');
    }
    const expectedIdempotencyKey = deriveOutboxIdempotencyKey({ namespaceKey: runtime.namespaceKey,
      generationId: manifest.targetGenerationId, domain: entry.domain, entityId: entry.entityId,
      localRevision: target.revision, operation: 'upsert' });
    if (entry.expectedOperation !== 'upsert' || entry.expectedIdempotencyKey !== expectedIdempotencyKey) {
      fail('CORRUPT_PERSISTED_RECORD', 'validate_restore_application_evidence');
    }
  }
  return { manifest, currentCanonical: entitySetCanonical(current), stagedCanonical: entitySetCanonical(staged) };
}

async function commit(runtime: RestoreRuntime, options: RestoreOptions, at: string, evidence: RestoreCommitEvidence): Promise<RestoreResult> {
  const stores = [LOCAL_DATABASE_STORES.databaseMeta, LOCAL_DATABASE_STORES.generations, LOCAL_DATABASE_STORES.entities,
    LOCAL_DATABASE_STORES.outbox, LOCAL_DATABASE_STORES.restoreSessions, LOCAL_DATABASE_STORES.migrationState];
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
    if (canonical(session.applicationManifest) !== canonical(evidence.manifest)
      || canonical(summaryFromManifest(evidence.manifest)) !== canonical(session.summary)) {
      fail('CORRUPT_PERSISTED_RECORD', 'validate_restore_application_evidence');
    }
    if (options.testOnlyFailAt === 'active_generation_reread') fail('RESTORE_TRANSACTION_FAILED');
    if (meta.activeGenerationId !== session.expectedActiveGenerationId) fail('RESTORE_ACTIVE_GENERATION_CHANGED');
    const source = await requestResult(generationStore.get(generationKey(runtime.namespaceKey, session.sourceGenerationId))) as GenerationRecord | undefined;
    const target = await requestResult(generationStore.get(generationKey(runtime.namespaceKey, session.targetGenerationId))) as GenerationRecord | undefined;
    if (!source || source.status !== 'active' || !target || target.status !== 'preparing' || target.validationState !== 'valid') fail('RESTORE_ACTIVE_GENERATION_CHANGED');
    const current = await requestResult(entityStore.getAll(entityRange(runtime.namespaceKey, session.sourceGenerationId))) as LocalEntityEnvelope[];
    const staged = await requestResult(entityStore.getAll(entityRange(runtime.namespaceKey, session.targetGenerationId))) as LocalEntityEnvelope[];
    try { current.forEach(validateEntityEnvelope); staged.forEach(validateEntityEnvelope); }
    catch { fail('CORRUPT_PERSISTED_RECORD', 'validate_restore_staging'); }
    if (entitySetCanonical(current) !== evidence.currentCanonical || entitySetCanonical(staged) !== evidence.stagedCanonical) {
      fail('CORRUPT_PERSISTED_RECORD', 'validate_restore_application_evidence');
    }
    if (!currentMatchesPlan(current, staged, session.sessionId)) fail('RESTORE_ENTITY_REVISION_CONFLICT');
    if (options.testOnlyFailAt === 'entity_materialization') fail('RESTORE_TRANSACTION_FAILED');
    const inherited = await requestResult(outboxStore.getAll(outboxRange(runtime.namespaceKey, session.sourceGenerationId))) as OutboxRecord[];
    const existingTargetOutbox = await requestResult(outboxStore.getAll(outboxRange(runtime.namespaceKey, session.targetGenerationId))) as OutboxRecord[];
    if (existingTargetOutbox.length !== 0) fail('CORRUPT_PERSISTED_RECORD', 'validate_restore_application_evidence');
    if (hasUnsettledRestoreOutbox(inherited)) {
      const paused: RestoreSessionRecord = {
        ...session, status: 'staged', updatedAt: at,
        blockingState: {
          code: 'RESTORE_UNSETTLED_OUTBOX_CONFLICT', detectedAt: at,
          attemptCount: (session.blockingState?.attemptCount ?? 0) + 1,
        },
      };
      validateRestoreSession(paused); sessionStore.put(paused);
      await done;
      fail('RESTORE_UNSETTLED_OUTBOX_CONFLICT', 'validate_restore_outbox');
    }
    const stagedByKey = new Map(staged.map(entity => [`${entity.domain}\0${entity.entityId}`, entity]));
    const createdOutbox: OutboxRecord[] = [];
    for (const entry of evidence.manifest.entries.filter(value => value.requiresOutbox)) {
      const entity = stagedByKey.get(`${entry.domain}\0${entry.entityId}`);
      const provenance = entity?.restoreProvenance;
      if (!entity || !provenance || !entry.expectedMutationId || !entry.expectedIdempotencyKey) {
        fail('CORRUPT_PERSISTED_RECORD', 'validate_restore_application_evidence');
      }
      const restoreEventAt = provenance.restoredAt;
      const outbox: OutboxRecord = {
        namespaceKey: runtime.namespaceKey, generationId: session.targetGenerationId, mutationId: entry.expectedMutationId,
        domain: entity.domain, entityId: entity.entityId, operation: 'upsert', baseRevision: provenance.expectedLocalRevision,
        localRevision: entity.revision, payloadMode: 'inline', payload: { kind: 'entity_snapshot', record: entity.record }, payloadHash: null,
        createdAt: restoreEventAt, updatedAt: at, availableAt: at, attemptCount: 0, status: 'pending',
        idempotencyKey: entry.expectedIdempotencyKey,
        lastAttemptAt: null, lastErrorCode: null, leaseOwner: null, leaseExpiresAt: null,
        acknowledgedAt: null, acknowledgedBy: null, remoteMutationRef: null, supersededByMutationId: null,
        resurrection: provenance.resurrection,
        deliveryBlockCode: provenance.resurrection ? 'REMOTE_RESURRECTION_UNSUPPORTED' : null,
        generationBoundary: entry.requiresSequenceBoundary ? {
          kind: 'restore_generation_sequence_boundary', namespaceKey: runtime.namespaceKey,
          sourceGenerationId: session.sourceGenerationId, targetGenerationId: session.targetGenerationId,
          domain: entity.domain, entityId: entity.entityId,
          sourceRevision: entry.sourceRevision!, targetRevision: entity.revision,
          restoreSessionId: session.sessionId, packageId: session.packageId, packageDigest: session.packageDigest,
          classification: entry.classification as 'replace' | 'resurrect', createdAt: restoreEventAt,
        } : null,
      };
      validateOutboxRecord(outbox); createdOutbox.push(outbox); outboxStore.add(outbox);
    }
    if (createdOutbox.length !== evidence.manifest.entries.filter(entry => entry.requiresOutbox).length) {
      fail('CORRUPT_PERSISTED_RECORD', 'validate_restore_application_evidence');
    }
    if (options.testOnlyFailAt === 'outbox_creation') fail('RESTORE_TRANSACTION_FAILED');
    await transitionActiveGenerationInTransaction({
      transaction: tx,
      runtime,
      kind: 'restore',
      expectedActiveGenerationId: session.expectedActiveGenerationId,
      targetGenerationId: session.targetGenerationId,
      activatedAt: at,
      validateRecords: (currentSource, currentTarget) => {
        if (currentSource.generationId !== source.generationId || currentTarget.generationId !== target.generationId
          || currentTarget.creationReason !== 'restore') {
          fail('RESTORE_ACTIVE_GENERATION_CHANGED');
        }
      },
      afterPointerWrite: () => {
        if (options.testOnlyFailAt === 'generation_activation') fail('RESTORE_TRANSACTION_FAILED');
      },
      afterModeWrite: () => {
        if (options.testOnlyFailAt === 'runtime_mode_update') fail('RESTORE_TRANSACTION_FAILED');
      },
    });
    const committed: RestoreSessionRecord = {
      ...session, status: 'committed', updatedAt: at, committedAt: at, blockingState: null, summary: session.summary,
    };
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
    try {
      const evidence = await prepareCommitEvidence(runtime, session, packageValue);
      return await commit(runtime, options, at, evidence);
    }
    catch (error) {
      if (error instanceof LocalDatabaseError && [
        'RESTORE_ENTITY_REVISION_CONFLICT', 'RESTORE_ACTIVE_GENERATION_CHANGED',
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
    blockingState: null,
  }));
}
