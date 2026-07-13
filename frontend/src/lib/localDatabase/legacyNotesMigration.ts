import { findAttachmentReferencesInText } from '../attachmentRepository';
import { LocalDatabaseError, localDatabaseError, type LocalDatabaseErrorCode } from './errors';
import {
  inspectLegacyNotesSourceAuthorityInStore, resolveLegacyNotesSourceAuthority,
  validateLegacyNotesSourceAuthorityInStore, type LegacyNotesAuthorityReference, type LegacyNotesAuthorityStatus,
  type LegacyNotesSourceAuthorityRecordV1, type LegacyNotesSourceType,
} from './legacyNotesAuthority';
import { LOCAL_DATABASE_STORES } from './schema';
import { sha256Hex } from './outboxIdentity';
import {
  LOCAL_DATABASE_VERSION, type DatabaseMetaRecord, type GenerationRecord, type LegacyMigrationProvenance,
  type LocalDatabaseNamespace, type LocalEntityEnvelope, type OutboxRecord, type SyncCheckpointRecord,
} from './types';
import { validTimestamp, validateDatabaseMeta, validateEntityEnvelope, validateGenerationRecord } from './validation';

export const LEGACY_NOTES_MIGRATION_VERSION = 1 as const;
export const LEGACY_NOTES_CONVERSION_VERSION = 1 as const;
export const MAX_LEGACY_MIGRATION_ENTRIES = 5_000;
export const MAX_LEGACY_MIGRATION_MANIFEST_BYTES = 4 * 1024 * 1024;
const MAX_LEGACY_NOTE_BYTES = 128 * 1024;
const MAX_LEGACY_MIGRATION_SESSIONS_PER_NAMESPACE = 256;
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const HASH = /^[a-f0-9]{64}$/;
const ACTIVE_STATUSES = new Set(['capturing', 'staged', 'verifying']);
const LEGACY_NOTES_MIGRATION_STORAGE_PREFIX = 'k325:legacy-notes:';

export type LegacyNotesOwnershipEvidence =
  | { kind: 'bound'; namespaceKey: string }
  | { kind: 'foreign' }
  | { kind: 'ambiguous' };

export interface LegacyNotesSourceRecord {
  legacyKey: string;
  value: unknown;
  ownership: LegacyNotesOwnershipEvidence;
}

export interface LegacyNotesSourceCapture {
  capturedAt: string;
  records: LegacyNotesSourceRecord[];
}

export interface LegacyNotesSourceAdapter extends LegacyNotesAuthorityReference {
  readonly adapter: string;
  readonly schemaVersion: number | null;
  capture(): Promise<LegacyNotesSourceCapture>;
}

export interface LegacyMigrationManifestEntryV1 {
  domain: 'notes';
  legacyKeyDigest: string;
  entityId: string;
  classification: 'live' | 'tombstone';
  sourceRevision: null;
  targetRevision: 1;
  sourceRecordDigest: string;
  targetEntityDigest: string;
  attachmentReferenceDigest: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface LegacyMigrationManifestV1 {
  version: 1;
  conversionVersion: 1;
  migrationSessionId: string;
  namespaceKey: string;
  sourceAdapter: string;
  sourceSchemaVersion: number | null;
  sourceInstanceId: string;
  sourceType: LegacyNotesSourceType;
  externalRootDigest: string;
  sourceIdentityDigest: string;
  sourceBindingDigest: string;
  rootBindingVersion: 1;
  rootBindingDigest: string;
  authorityId: string;
  authorityVersion: 1;
  authorityDigest: string;
  sourceSnapshotDigest: string;
  targetGenerationId: string;
  entryCount: number;
  entries: LegacyMigrationManifestEntryV1[];
  targetStateDigest: string;
  manifestDigest: string;
}

export interface LegacyMigrationResultV1 {
  entryCount: number;
  liveCount: number;
  tombstoneCount: number;
  sourceSnapshotDigest: string;
  manifestDigest: string;
  targetStateDigest: string;
  verifiedAt: string;
}

export interface LegacyNotesMigrationSessionV1 {
  kind: 'legacy_notes_migration_v1';
  version: 1;
  migrationId: string;
  namespaceKey: string;
  expectedActiveGenerationId: string;
  source: {
    adapter: string;
    schemaVersion: number | null;
    sourceInstanceId: string;
    sourceType: LegacyNotesSourceType;
    externalRootDigest: string;
    sourceIdentityDigest: string;
    sourceBindingDigest: string;
    rootBindingVersion: 1;
    rootBindingDigest: string;
    authorityId: string;
    authorityVersion: 1;
    authorityDigest: string;
    ownershipMode: 'authenticated' | 'local_only';
    capturedAt: string;
    snapshotDigest: string;
    entryCount: number;
  };
  target: { generationId: string; databaseVersion: number };
  status: 'capturing' | 'staged' | 'verifying' | 'verified' | 'cancelled' | 'failed';
  manifest: LegacyMigrationManifestV1;
  result: LegacyMigrationResultV1 | null;
  failure: { code: 'MIGRATION_SOURCE_CHANGED' | 'MIGRATION_CANCELLED' | 'CORRUPT_PERSISTED_RECORD' } | null;
  createdAt: string;
  updatedAt: string;
  verifiedAt: string | null;
}

interface PersistedLegacyNotesMigrationSessionV1 extends Omit<LegacyNotesMigrationSessionV1, 'migrationId'> {
  migrationId: string;
  migrationSessionId: string;
}

export interface LegacyNotesMigrationOptions { migrationSessionId: string; now?: string }
export interface LegacyNotesMigrationAdministrativeView {
  migrationSessionId: string;
  lifecycleState: LegacyNotesMigrationSessionV1['status'];
  namespaceKey: string;
  authorityId: string;
  authorityStatus: LegacyNotesAuthorityStatus;
  targetGenerationId: string;
  createdAt: string;
  updatedAt: string;
  failureCode: 'MIGRATION_SOURCE_CHANGED' | 'MIGRATION_CANCELLED' | 'CORRUPT_PERSISTED_RECORD' | null;
  continuationAllowed: boolean;
}
export interface LegacyNotesMigrationRuntime {
  db: IDBDatabase;
  namespace: LocalDatabaseNamespace;
  namespaceKey: string;
  clock: () => string;
  assertOpen: (operation: string) => void;
}

interface SupportedLegacyNote {
  id: string; title: string; body: string; createdAt: number; lastOpenedAt?: number;
  updatedAt: number; folderId: string | null; deletedAt: number | null; starred: boolean;
  properties?: Record<string, string>; relations?: Record<string, string[]>;
}

interface MigrationPlan {
  capturedAt: string;
  authority: LegacyNotesSourceAuthorityRecordV1;
  snapshotDigest: string;
  manifest: LegacyMigrationManifestV1;
  entities: LocalEntityEnvelope<SupportedLegacyNote>[];
}

type OwnDataFieldResult =
  | { kind: 'absent' }
  | { kind: 'data'; value: unknown };

function fail(code: LocalDatabaseErrorCode, operation = 'legacy_notes_migration'): never {
  throw new LocalDatabaseError(code, operation);
}
function compareCanonicalStrings(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}
function compareManifestEntries(
  left: Pick<LegacyMigrationManifestEntryV1, 'domain' | 'entityId'>,
  right: Pick<LegacyMigrationManifestEntryV1, 'domain' | 'entityId'>,
): number {
  const domainOrder = compareCanonicalStrings(left.domain, right.domain);
  return domainOrder !== 0 ? domainOrder : compareCanonicalStrings(left.entityId, right.entityId);
}
function exactKeys(value: object, expected: readonly string[]): boolean {
  return Object.keys(value).sort(compareCanonicalStrings).join(',')
    === [...expected].sort(compareCanonicalStrings).join(',');
}
function invalidLegacySource(): never {
  fail('INVALID_LEGACY_MIGRATION', 'validate_legacy_source');
}
function sourceValidationBoundary<T>(action: () => T): T {
  try { return action(); }
  catch (error) {
    if (error instanceof LocalDatabaseError) throw error;
    return invalidLegacySource();
  }
}
function safeOwnKeys(value: object): PropertyKey[] {
  try { return Reflect.ownKeys(value); }
  catch { return invalidLegacySource(); }
}
function readOwnDataField(record: object, key: PropertyKey): OwnDataFieldResult {
  let descriptor: PropertyDescriptor | undefined;
  try { descriptor = Object.getOwnPropertyDescriptor(record, key); }
  catch { return invalidLegacySource(); }
  if (descriptor === undefined) return { kind: 'absent' };
  if (!Object.prototype.hasOwnProperty.call(descriptor, 'value')) return invalidLegacySource();
  return { kind: 'data', value: descriptor.value };
}
function ownDataFields(value: unknown, allowed: ReadonlySet<string>): Map<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return invalidLegacySource();
  const fields = new Map<string, unknown>();
  for (const key of safeOwnKeys(value)) {
    if (typeof key !== 'string' || !allowed.has(key)) return invalidLegacySource();
    const field = readOwnDataField(value, key);
    if (field.kind !== 'data') return invalidLegacySource();
    fields.set(key, field.value);
  }
  return fields;
}
function requiredOwnField(fields: ReadonlyMap<string, unknown>, key: string): unknown {
  if (!fields.has(key)) return invalidLegacySource();
  return fields.get(key);
}
function safeSourceArray(value: unknown): unknown[] {
  if (!Array.isArray(value)) return invalidLegacySource();
  const lengthField = readOwnDataField(value, 'length');
  if (lengthField.kind !== 'data' || !Number.isSafeInteger(lengthField.value)
    || (lengthField.value as number) < 0 || (lengthField.value as number) > MAX_LEGACY_NOTE_BYTES) {
    return invalidLegacySource();
  }
  const length = lengthField.value as number;
  const expectedKeys = new Set<string>(['length']);
  for (let index = 0; index < length; index += 1) expectedKeys.add(String(index));
  const keys = safeOwnKeys(value);
  if (keys.length !== expectedKeys.size
    || keys.some(key => typeof key !== 'string' || !expectedKeys.has(key))) return invalidLegacySource();
  const result: unknown[] = [];
  for (let index = 0; index < length; index += 1) {
    const field = readOwnDataField(value, String(index));
    if (field.kind !== 'data') return invalidLegacySource();
    result.push(field.value);
  }
  return result;
}
function canonical(value: unknown): string {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value)) fail('INVALID_LEGACY_MIGRATION', 'canonical_legacy_note');
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value as object).sort(compareCanonicalStrings).map(key => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`).join(',')}}`;
  }
  fail('INVALID_LEGACY_MIGRATION', 'canonical_legacy_note');
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
function validateLegacyMigrationLogicalId(value: unknown): string {
  if (typeof value !== 'string' || !SAFE_ID.test(value) || value.startsWith(LEGACY_NOTES_MIGRATION_STORAGE_PREFIX)) {
    fail('INVALID_LEGACY_MIGRATION', 'migration_session_id');
  }
  return value;
}
function toLegacyNotesMigrationStorageId(migrationSessionId: string): string {
  return `${LEGACY_NOTES_MIGRATION_STORAGE_PREFIX}${validateLegacyMigrationLogicalId(migrationSessionId)}`;
}
function sessionKey(namespaceKey: string, migrationSessionId: string): [string, string] {
  return [namespaceKey, toLegacyNotesMigrationStorageId(migrationSessionId)];
}
function generationKey(namespaceKey: string, generationId: string): [string, string] { return [namespaceKey, generationId]; }
function namespaceMigrationRange(namespaceKey: string): IDBKeyRange {
  return IDBKeyRange.bound([namespaceKey, ''], [namespaceKey, '\uffff']);
}
function entityRange(namespaceKey: string, generationId: string): IDBKeyRange {
  return IDBKeyRange.bound([namespaceKey, generationId, '', ''], [namespaceKey, generationId, '\uffff', '\uffff']);
}
function outboxRange(namespaceKey: string, generationId: string): IDBKeyRange {
  return IDBKeyRange.bound([namespaceKey, generationId, ''], [namespaceKey, generationId, '\uffff']);
}
function checkpointRange(namespaceKey: string, generationId: string): IDBKeyRange {
  return IDBKeyRange.bound([namespaceKey, generationId, '', ''], [namespaceKey, generationId, '\uffff', '\uffff']);
}
function timestamp(value: string | undefined, operation: string): string {
  const result = value ?? new Date().toISOString();
  if (!validTimestamp(result)) fail('INVALID_LEGACY_MIGRATION', operation);
  return result;
}
function millisToIso(value: number, operation: string): string {
  if (!Number.isSafeInteger(value) || value < 0) fail('INVALID_LEGACY_MIGRATION', operation);
  try { return new Date(value).toISOString(); } catch { fail('INVALID_LEGACY_MIGRATION', operation); }
}
function validateAdapter(runtime: LegacyNotesMigrationRuntime, adapter: LegacyNotesSourceAdapter): void {
  if (!adapter || !SAFE_ID.test(adapter.adapter) || !SAFE_ID.test(adapter.sourceInstanceId)
    || adapter.namespaceKey !== runtime.namespaceKey || !['authenticated', 'local_only'].includes(adapter.ownershipMode)
    || !['indexeddb', 'localstorage'].includes(adapter.sourceType) || !HASH.test(adapter.externalRootDigest)
    || !HASH.test(adapter.sourceIdentityDigest) || !HASH.test(adapter.sourceBindingDigest)
    || adapter.sourceIdentityDigest !== adapter.sourceBindingDigest || adapter.rootBindingVersion !== 1
    || !HASH.test(adapter.rootBindingDigest) || !SAFE_ID.test(adapter.authorityId)
    || adapter.authorityVersion !== 1 || !HASH.test(adapter.authorityDigest)
    || adapter.schemaVersion !== null && (!Number.isSafeInteger(adapter.schemaVersion) || adapter.schemaVersion < 0)) {
    fail('LEGACY_SOURCE_AUTHORITY_REQUIRED', 'validate_legacy_adapter');
  }
}

function sessionAuthorityReference(session: LegacyNotesMigrationSessionV1): LegacyNotesAuthorityReference {
  return {
    authorityId: session.source.authorityId, authorityVersion: session.source.authorityVersion,
    authorityDigest: session.source.authorityDigest, sourceType: session.source.sourceType,
    sourceInstanceId: session.source.sourceInstanceId, externalRootDigest: session.source.externalRootDigest,
    sourceIdentityDigest: session.source.sourceIdentityDigest, sourceBindingDigest: session.source.sourceBindingDigest,
    rootBindingVersion: session.source.rootBindingVersion, rootBindingDigest: session.source.rootBindingDigest,
    namespaceKey: session.namespaceKey, ownershipMode: session.source.ownershipMode,
  };
}

function stringRecord(value: unknown): Record<string, string> | undefined {
  if (value === undefined) return undefined;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return invalidLegacySource();
  const entries: Array<[string, string]> = [];
  for (const key of safeOwnKeys(value)) {
    if (typeof key !== 'string' || !key.trim()) return invalidLegacySource();
    const field = readOwnDataField(value, key);
    if (field.kind !== 'data' || typeof field.value !== 'string') return invalidLegacySource();
    entries.push([key, field.value]);
  }
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}
function relationsRecord(value: unknown): Record<string, string[]> | undefined {
  if (value === undefined) return undefined;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return invalidLegacySource();
  const entries: Array<[string, string[]]> = [];
  for (const key of safeOwnKeys(value)) {
    if (typeof key !== 'string' || !key.trim()) return invalidLegacySource();
    const field = readOwnDataField(value, key);
    if (field.kind !== 'data') return invalidLegacySource();
    const items = safeSourceArray(field.value);
    if (items.some(candidate => typeof candidate !== 'string')) return invalidLegacySource();
    entries.push([key, items as string[]]);
  }
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}
function supportedLegacyNote(value: unknown): SupportedLegacyNote {
  const allowed = new Set(['id', 'title', 'body', 'createdAt', 'lastOpenedAt', 'updatedAt', 'folderId', 'deletedAt', 'starred', 'properties', 'relations']);
  const fields = ownDataFields(value, allowed);
  const id = requiredOwnField(fields, 'id');
  const title = requiredOwnField(fields, 'title');
  const body = requiredOwnField(fields, 'body');
  const updatedAt = requiredOwnField(fields, 'updatedAt');
  const folderId = requiredOwnField(fields, 'folderId');
  const deletedAt = requiredOwnField(fields, 'deletedAt');
  const createdAt = fields.get('createdAt');
  const lastOpenedAt = fields.get('lastOpenedAt');
  const starred = fields.get('starred');
  if (typeof id !== 'string' || id.length < 1 || !/\S/u.test(id) || id.length > 512
    || typeof title !== 'string' || typeof body !== 'string'
    || !Number.isSafeInteger(updatedAt) || (updatedAt as number) < 0
    || createdAt !== undefined && (!Number.isSafeInteger(createdAt) || (createdAt as number) < 0)
    || lastOpenedAt !== undefined && (!Number.isSafeInteger(lastOpenedAt) || (lastOpenedAt as number) < 0)
    || folderId !== null && typeof folderId !== 'string'
    || deletedAt !== null && (!Number.isSafeInteger(deletedAt) || (deletedAt as number) < 0)
    || starred !== undefined && typeof starred !== 'boolean') {
    return invalidLegacySource();
  }
  const note: SupportedLegacyNote = {
    id, title, body,
    createdAt: (createdAt as number | undefined) ?? updatedAt as number,
    updatedAt: updatedAt as number, folderId: folderId as string | null,
    deletedAt: deletedAt as number | null, starred: (starred as boolean | undefined) ?? false,
  };
  if (note.createdAt > note.updatedAt) fail('INVALID_LEGACY_MIGRATION', 'legacy_note_chronology');
  if (lastOpenedAt !== undefined) note.lastOpenedAt = lastOpenedAt as number;
  const properties = stringRecord(fields.get('properties')); if (properties) note.properties = properties;
  const relations = relationsRecord(fields.get('relations')); if (relations) note.relations = relations;
  if (new TextEncoder().encode(canonical(note)).length > MAX_LEGACY_NOTE_BYTES) {
    fail('INVALID_LEGACY_MIGRATION', 'legacy_note_size');
  }
  return note;
}
function attachmentReferences(body: string): string[] {
  return findAttachmentReferencesInText(body).sort(compareCanonicalStrings);
}
function entityDigest(entity: LocalEntityEnvelope): string {
  return sha256Hex(canonical(['absinthe-legacy-target-entity-v1', entity]));
}
function manifestCore(manifest: LegacyMigrationManifestV1): Omit<LegacyMigrationManifestV1, 'manifestDigest'> {
  const { manifestDigest: _digest, ...core } = manifest; return core;
}

async function buildPlan(
  runtime: LegacyNotesMigrationRuntime, adapter: LegacyNotesSourceAdapter, migrationId: string,
  targetGenerationId: string, migratedAt: string,
): Promise<MigrationPlan> {
  validateAdapter(runtime, adapter);
  const authority = await resolveLegacyNotesSourceAuthority(runtime, adapter);
  let capture: LegacyNotesSourceCapture;
  try { capture = await adapter.capture(); }
  catch (error) {
    if (error instanceof LocalDatabaseError) throw error;
    fail('LEGACY_SOURCE_UNAVAILABLE', 'capture_legacy_notes');
  }
  return sourceValidationBoundary(() => {
  const captureFields = ownDataFields(capture, new Set(['capturedAt', 'records']));
  const captureTime = requiredOwnField(captureFields, 'capturedAt');
  const records = safeSourceArray(requiredOwnField(captureFields, 'records'));
  if (typeof captureTime !== 'string' || !validTimestamp(captureTime)
    || records.length > MAX_LEGACY_MIGRATION_ENTRIES) return invalidLegacySource();
  const keys = new Set<string>(); const entityIds = new Set<string>();
  const sourceDrafts: Array<{
    legacyKeyDigest: string; entityId: string; classification: 'live' | 'tombstone'; note: SupportedLegacyNote;
    sourceRecordDigest: string; attachmentReferenceDigest: string | null; createdAt: string; updatedAt: string; deletedAt: string | null;
  }> = [];
  for (const raw of records) {
    const recordFields = ownDataFields(raw, new Set(['legacyKey', 'value', 'ownership']));
    const legacyKey = requiredOwnField(recordFields, 'legacyKey');
    const ownership = requiredOwnField(recordFields, 'ownership');
    if (typeof legacyKey !== 'string' || legacyKey.length < 1 || legacyKey.length > 512
      || keys.has(legacyKey)) return invalidLegacySource();
    keys.add(legacyKey);
    const ownershipFields = ownDataFields(ownership, new Set(['kind', 'namespaceKey']));
    const ownershipKind = requiredOwnField(ownershipFields, 'kind');
    if (ownershipKind !== 'bound' || requiredOwnField(ownershipFields, 'namespaceKey') !== runtime.namespaceKey) {
      fail('NAMESPACE_MISMATCH', 'legacy_ownership');
    }
    const note = supportedLegacyNote(requiredOwnField(recordFields, 'value'));
    if (entityIds.has(note.id)) fail('INVALID_LEGACY_MIGRATION', 'duplicate_legacy_entity');
    entityIds.add(note.id);
    const legacyKeyDigest = sha256Hex(canonical(['absinthe-legacy-key-v1', legacyKey]));
    const refs = attachmentReferences(note.body);
    sourceDrafts.push({
      legacyKeyDigest, entityId: note.id, classification: note.deletedAt === null ? 'live' : 'tombstone', note,
      sourceRecordDigest: sha256Hex(canonical(['absinthe-legacy-note-v1', legacyKeyDigest, note])),
      attachmentReferenceDigest: refs.length === 0 ? null : sha256Hex(canonical(['absinthe-attachment-references-v1', refs])),
      createdAt: millisToIso(note.createdAt, 'legacy_created_at'), updatedAt: millisToIso(note.updatedAt, 'legacy_updated_at'),
      deletedAt: note.deletedAt === null ? null : millisToIso(note.deletedAt, 'legacy_deleted_at'),
    });
  }
  sourceDrafts.sort((left, right) => compareManifestEntries(
    { domain: 'notes', entityId: left.entityId },
    { domain: 'notes', entityId: right.entityId },
  ));
  const snapshotDigest = sha256Hex(canonical(['absinthe-legacy-notes-snapshot-v1', runtime.namespaceKey,
    adapter.adapter, adapter.schemaVersion, adapter.sourceInstanceId, adapter.sourceType,
    adapter.externalRootDigest, adapter.sourceBindingDigest, adapter.rootBindingDigest,
    adapter.authorityId, adapter.authorityDigest,
    sourceDrafts.map(item => [item.legacyKeyDigest, item.entityId, item.classification, item.sourceRecordDigest, item.attachmentReferenceDigest]) ]));
  const entities: LocalEntityEnvelope<SupportedLegacyNote>[] = sourceDrafts.map(item => ({
    namespaceKey: runtime.namespaceKey, generationId: targetGenerationId, domain: 'notes', entityId: item.entityId,
    record: item.note, revision: 1, createdAt: item.createdAt, updatedAt: item.updatedAt, deletedAt: item.deletedAt,
    isDeleted: item.deletedAt !== null, deletionState: item.deletedAt === null ? 'active' : 'deleted',
    ownerId: authority.userId, contentHash: item.sourceRecordDigest,
    source: { kind: 'legacy_migration', reference: migrationId }, restoreProvenance: null,
    migrationProvenance: {
      conversionVersion: 1, sourceAdapter: adapter.adapter, sourceSchemaVersion: adapter.schemaVersion,
      migrationSessionId: migrationId, sourceSnapshotDigest: snapshotDigest, migratedAt,
      legacyKeyDigest: item.legacyKeyDigest,
    },
  }));
  entities.forEach(validateEntityEnvelope);
  const entries: LegacyMigrationManifestEntryV1[] = [];
  for (let index = 0; index < sourceDrafts.length; index += 1) {
    const source = sourceDrafts[index]; const entity = entities[index];
    entries.push({
      domain: 'notes', legacyKeyDigest: source.legacyKeyDigest, entityId: source.entityId,
      classification: source.classification, sourceRevision: null, targetRevision: 1,
      sourceRecordDigest: source.sourceRecordDigest, targetEntityDigest: entityDigest(entity),
      attachmentReferenceDigest: source.attachmentReferenceDigest, createdAt: source.createdAt,
      updatedAt: source.updatedAt, deletedAt: source.deletedAt,
    });
  }
  const targetStateDigest = sha256Hex(canonical(['absinthe-legacy-target-state-v1',
    entries.map(entry => [entry.entityId, entry.targetEntityDigest])]));
  const core = {
    version: 1 as const, conversionVersion: 1 as const, migrationSessionId: migrationId,
    namespaceKey: runtime.namespaceKey, sourceAdapter: adapter.adapter, sourceSchemaVersion: adapter.schemaVersion,
    sourceInstanceId: adapter.sourceInstanceId, sourceType: adapter.sourceType,
    externalRootDigest: adapter.externalRootDigest, sourceIdentityDigest: adapter.sourceIdentityDigest,
    sourceBindingDigest: adapter.sourceBindingDigest, rootBindingVersion: adapter.rootBindingVersion,
    rootBindingDigest: adapter.rootBindingDigest, authorityId: adapter.authorityId,
    authorityVersion: adapter.authorityVersion, authorityDigest: adapter.authorityDigest,
    sourceSnapshotDigest: snapshotDigest, targetGenerationId,
    entryCount: entries.length, entries, targetStateDigest,
  };
  const manifest: LegacyMigrationManifestV1 = { ...core, manifestDigest: sha256Hex(canonical(['absinthe-legacy-manifest-v1', core])) };
  if (new TextEncoder().encode(canonical(manifest)).length > MAX_LEGACY_MIGRATION_MANIFEST_BYTES) {
    fail('INVALID_LEGACY_MIGRATION', 'legacy_manifest_size');
  }
  return { capturedAt: captureTime, authority, snapshotDigest, manifest, entities };
  });
}

function validateManifestShape(value: LegacyMigrationManifestV1): void {
  const keys = ['version', 'conversionVersion', 'migrationSessionId', 'namespaceKey', 'sourceAdapter', 'sourceSchemaVersion',
    'sourceInstanceId', 'sourceType', 'externalRootDigest', 'sourceIdentityDigest', 'sourceBindingDigest',
    'rootBindingVersion', 'rootBindingDigest', 'authorityId', 'authorityVersion', 'authorityDigest',
    'sourceSnapshotDigest', 'targetGenerationId', 'entryCount', 'entries', 'targetStateDigest', 'manifestDigest'];
  if (!value || !exactKeys(value, keys) || value.version !== 1 || value.conversionVersion !== 1
    || !SAFE_ID.test(value.migrationSessionId) || !SAFE_ID.test(value.sourceAdapter) || !SAFE_ID.test(value.sourceInstanceId)
    || !['indexeddb', 'localstorage'].includes(value.sourceType) || !HASH.test(value.externalRootDigest)
    || !HASH.test(value.sourceIdentityDigest) || !HASH.test(value.sourceBindingDigest)
    || value.sourceIdentityDigest !== value.sourceBindingDigest || value.rootBindingVersion !== 1
    || !HASH.test(value.rootBindingDigest)
    || !SAFE_ID.test(value.authorityId) || value.authorityVersion !== 1 || !HASH.test(value.authorityDigest)
    || !HASH.test(value.namespaceKey) || !HASH.test(value.sourceSnapshotDigest) || !SAFE_ID.test(value.targetGenerationId)
    || !HASH.test(value.targetStateDigest) || !HASH.test(value.manifestDigest)
    || value.sourceSchemaVersion !== null && (!Number.isSafeInteger(value.sourceSchemaVersion) || value.sourceSchemaVersion < 0)
    || !Number.isSafeInteger(value.entryCount) || value.entryCount < 0 || value.entryCount > MAX_LEGACY_MIGRATION_ENTRIES
    || !Array.isArray(value.entries) || value.entries.length !== value.entryCount) fail('CORRUPT_PERSISTED_RECORD', 'legacy_manifest');
  let previous: LegacyMigrationManifestEntryV1 | undefined;
  const legacyKeys = new Set<string>();
  for (const entry of value.entries) {
    const entryKeys = ['domain', 'legacyKeyDigest', 'entityId', 'classification', 'sourceRevision', 'targetRevision',
      'sourceRecordDigest', 'targetEntityDigest', 'attachmentReferenceDigest', 'createdAt', 'updatedAt', 'deletedAt'];
    if (!entry || !exactKeys(entry, entryKeys) || entry.domain !== 'notes' || typeof entry.entityId !== 'string'
      || entry.entityId.length < 1 || entry.entityId.length > 512
      || previous !== undefined && compareManifestEntries(previous, entry) >= 0 || legacyKeys.has(entry.legacyKeyDigest)
      || !HASH.test(entry.legacyKeyDigest) || !['live', 'tombstone'].includes(entry.classification)
      || entry.sourceRevision !== null || entry.targetRevision !== 1 || !HASH.test(entry.sourceRecordDigest)
      || !HASH.test(entry.targetEntityDigest) || entry.attachmentReferenceDigest !== null && !HASH.test(entry.attachmentReferenceDigest)
      || !validTimestamp(entry.createdAt) || !validTimestamp(entry.updatedAt)
      || entry.deletedAt !== null && !validTimestamp(entry.deletedAt)
      || (entry.classification === 'live') !== (entry.deletedAt === null)) fail('CORRUPT_PERSISTED_RECORD', 'legacy_manifest_entry');
    previous = entry; legacyKeys.add(entry.legacyKeyDigest);
  }
}
function validateManifestIntegrity(manifest: LegacyMigrationManifestV1): void {
  validateManifestShape(manifest);
  if (sha256Hex(canonical(['absinthe-legacy-manifest-v1', manifestCore(manifest)])) !== manifest.manifestDigest
    || new TextEncoder().encode(canonical(manifest)).length > MAX_LEGACY_MIGRATION_MANIFEST_BYTES) {
    fail('CORRUPT_PERSISTED_RECORD', 'legacy_manifest_digest');
  }
}
function validateResult(result: LegacyMigrationResultV1, session: LegacyNotesMigrationSessionV1): void {
  if (!result || !exactKeys(result, ['entryCount', 'liveCount', 'tombstoneCount', 'sourceSnapshotDigest', 'manifestDigest', 'targetStateDigest', 'verifiedAt'])
    || !Number.isSafeInteger(result.entryCount) || !Number.isSafeInteger(result.liveCount) || !Number.isSafeInteger(result.tombstoneCount)
    || result.entryCount < 0 || result.liveCount < 0 || result.tombstoneCount < 0
    || result.entryCount !== result.liveCount + result.tombstoneCount || result.entryCount !== session.source.entryCount
    || result.sourceSnapshotDigest !== session.source.snapshotDigest || result.manifestDigest !== session.manifest.manifestDigest
    || result.targetStateDigest !== session.manifest.targetStateDigest || !validTimestamp(result.verifiedAt)
    || session.verifiedAt !== null && session.verifiedAt !== result.verifiedAt) {
    fail('CORRUPT_PERSISTED_RECORD', 'legacy_migration_result');
  }
}
function persistedSession(value: unknown, namespaceKey: string): LegacyNotesMigrationSessionV1 {
  try {
  const session = value as PersistedLegacyNotesMigrationSessionV1;
  const keys = ['kind', 'version', 'migrationId', 'migrationSessionId', 'namespaceKey', 'expectedActiveGenerationId', 'source', 'target',
    'status', 'manifest', 'result', 'failure', 'createdAt', 'updatedAt', 'verifiedAt'];
  const sourceKeys = ['adapter', 'schemaVersion', 'sourceInstanceId', 'sourceType', 'externalRootDigest',
    'sourceIdentityDigest', 'sourceBindingDigest', 'rootBindingVersion', 'rootBindingDigest',
    'authorityId', 'authorityVersion', 'authorityDigest', 'ownershipMode', 'capturedAt', 'snapshotDigest', 'entryCount'];
  const targetKeys = ['generationId', 'databaseVersion'];
  const failureValid = session?.failure === null || session?.failure && exactKeys(session.failure, ['code'])
    && ['MIGRATION_SOURCE_CHANGED', 'MIGRATION_CANCELLED', 'CORRUPT_PERSISTED_RECORD'].includes(session.failure.code);
  if (!session || !exactKeys(session, keys) || session.kind !== 'legacy_notes_migration_v1' || session.version !== 1
    || !SAFE_ID.test(session.migrationSessionId)
    || session.migrationId !== toLegacyNotesMigrationStorageId(session.migrationSessionId)
    || session.namespaceKey !== namespaceKey || !SAFE_ID.test(session.expectedActiveGenerationId)
    || !session.source || !exactKeys(session.source, sourceKeys) || !SAFE_ID.test(session.source.adapter)
    || !SAFE_ID.test(session.source.sourceInstanceId) || !['authenticated', 'local_only'].includes(session.source.ownershipMode)
    || !['indexeddb', 'localstorage'].includes(session.source.sourceType) || !HASH.test(session.source.externalRootDigest)
    || !HASH.test(session.source.sourceIdentityDigest) || !HASH.test(session.source.sourceBindingDigest)
    || session.source.sourceIdentityDigest !== session.source.sourceBindingDigest
    || session.source.rootBindingVersion !== 1 || !HASH.test(session.source.rootBindingDigest)
    || !SAFE_ID.test(session.source.authorityId) || session.source.authorityVersion !== 1 || !HASH.test(session.source.authorityDigest)
    || session.source.schemaVersion !== null && (!Number.isSafeInteger(session.source.schemaVersion) || session.source.schemaVersion < 0)
    || !validTimestamp(session.source.capturedAt) || !HASH.test(session.source.snapshotDigest)
    || !Number.isSafeInteger(session.source.entryCount) || session.source.entryCount < 0
    || !session.target || !exactKeys(session.target, targetKeys) || !SAFE_ID.test(session.target.generationId)
    || session.target.generationId !== `migration-${session.migrationSessionId}`
    || session.target.databaseVersion !== LOCAL_DATABASE_VERSION
    || !['capturing', 'staged', 'verifying', 'verified', 'cancelled', 'failed'].includes(session.status)
    || !failureValid || !validTimestamp(session.createdAt) || !validTimestamp(session.updatedAt)
    || Date.parse(session.updatedAt) < Date.parse(session.createdAt)
    || session.manifest.migrationSessionId !== session.migrationSessionId || session.manifest.namespaceKey !== namespaceKey
    || session.manifest.sourceAdapter !== session.source.adapter || session.manifest.sourceSchemaVersion !== session.source.schemaVersion
    || session.manifest.sourceInstanceId !== session.source.sourceInstanceId
    || session.manifest.sourceType !== session.source.sourceType
    || session.manifest.externalRootDigest !== session.source.externalRootDigest
    || session.manifest.sourceIdentityDigest !== session.source.sourceIdentityDigest
    || session.manifest.sourceBindingDigest !== session.source.sourceBindingDigest
    || session.manifest.rootBindingVersion !== session.source.rootBindingVersion
    || session.manifest.rootBindingDigest !== session.source.rootBindingDigest
    || session.manifest.authorityId !== session.source.authorityId
    || session.manifest.authorityVersion !== session.source.authorityVersion
    || session.manifest.authorityDigest !== session.source.authorityDigest
    || session.manifest.sourceSnapshotDigest !== session.source.snapshotDigest
    || session.manifest.targetGenerationId !== session.target.generationId || session.manifest.entryCount !== session.source.entryCount
    || (session.status === 'verified') !== (session.result !== null)
    || (session.status === 'verified') !== (session.verifiedAt !== null)
    || (session.status === 'cancelled') !== (session.failure?.code === 'MIGRATION_CANCELLED')
    || (session.status === 'failed') !== (session.failure !== null && session.failure.code !== 'MIGRATION_CANCELLED')
    || (!['failed', 'cancelled'].includes(session.status) && session.failure !== null)) {
    fail('CORRUPT_PERSISTED_RECORD', 'legacy_migration_session');
  }
  validateManifestIntegrity(session.manifest);
  if (session.result) validateResult(session.result, session);
  const { migrationId: _storageId, migrationSessionId, ...rest } = session;
  return { ...rest, migrationId: migrationSessionId };
  } catch {
    fail('CORRUPT_PERSISTED_RECORD', 'legacy_migration_session');
  }
}

function toPersistedSession(session: LegacyNotesMigrationSessionV1): PersistedLegacyNotesMigrationSessionV1 {
  return {
    ...session,
    migrationId: toLegacyNotesMigrationStorageId(session.migrationId),
    migrationSessionId: session.migrationId,
  };
}

async function readSessionRecord(runtime: LegacyNotesMigrationRuntime, migrationId: string): Promise<LegacyNotesMigrationSessionV1 | null> {
  const tx = runtime.db.transaction(LOCAL_DATABASE_STORES.migrationState, 'readonly');
  const done = transactionCompletion(tx, 'read_legacy_migration');
  const value = await requestResult(tx.objectStore(LOCAL_DATABASE_STORES.migrationState).get(sessionKey(runtime.namespaceKey, migrationId)));
  await done;
  return value === undefined ? null : persistedSession(value, runtime.namespaceKey);
}

async function validateDurableTarget(
  runtime: LegacyNotesMigrationRuntime, session: LegacyNotesMigrationSessionV1,
): Promise<{ targetStateDigest: string; liveCount: number; tombstoneCount: number }> {
  const tx = runtime.db.transaction([
    LOCAL_DATABASE_STORES.databaseMeta, LOCAL_DATABASE_STORES.generations, LOCAL_DATABASE_STORES.entities,
    LOCAL_DATABASE_STORES.outbox, LOCAL_DATABASE_STORES.syncCheckpoints, LOCAL_DATABASE_STORES.migrationState,
  ], 'readonly');
  const done = transactionCompletion(tx, 'verify_legacy_migration_target');
  const authority = await validateLegacyNotesSourceAuthorityInStore(
    runtime, tx.objectStore(LOCAL_DATABASE_STORES.migrationState), sessionAuthorityReference(session),
  );
  const meta = await requestResult(tx.objectStore(LOCAL_DATABASE_STORES.databaseMeta).get(runtime.namespaceKey)) as DatabaseMetaRecord | undefined;
  const generation = await requestResult(tx.objectStore(LOCAL_DATABASE_STORES.generations)
    .get(generationKey(runtime.namespaceKey, session.target.generationId))) as GenerationRecord | undefined;
  const entities = await requestResult(tx.objectStore(LOCAL_DATABASE_STORES.entities)
    .getAll(entityRange(runtime.namespaceKey, session.target.generationId))) as LocalEntityEnvelope[];
  const outbox = await requestResult(tx.objectStore(LOCAL_DATABASE_STORES.outbox)
    .getAll(outboxRange(runtime.namespaceKey, session.target.generationId))) as OutboxRecord[];
  const checkpoints = await requestResult(tx.objectStore(LOCAL_DATABASE_STORES.syncCheckpoints)
    .getAll(checkpointRange(runtime.namespaceKey, session.target.generationId))) as SyncCheckpointRecord[];
  const rawSession = await requestResult(tx.objectStore(LOCAL_DATABASE_STORES.migrationState)
    .get(sessionKey(runtime.namespaceKey, session.migrationId)));
  await done;
  if (!meta || !generation || rawSession === undefined) fail('CORRUPT_PERSISTED_RECORD', 'legacy_target_graph');
  const current = persistedSession(rawSession, runtime.namespaceKey);
  if (canonical(current) !== canonical(session)) fail('CORRUPT_PERSISTED_RECORD', 'legacy_session_changed');
  try {
    validateDatabaseMeta(meta, runtime.namespaceKey, runtime.namespace.schemaVersion);
    validateGenerationRecord(generation, runtime.namespaceKey, runtime.namespace.schemaVersion);
    entities.forEach(validateEntityEnvelope);
  } catch {
    fail('CORRUPT_PERSISTED_RECORD', 'validate_persisted_legacy_target');
  }
  if (meta.activeGenerationId !== session.expectedActiveGenerationId || meta.activeGenerationId === session.target.generationId
    || generation.status !== 'preparing' || generation.validationState !== 'valid' || generation.activeNamespaceKey !== undefined
    || generation.predecessorGenerationId !== null || generation.creationReason !== 'migration'
    || generation.createdAt !== session.createdAt || generation.activatedAt !== null
    || generation.safeSourceReference?.kind !== 'legacy_migration'
    || generation.safeSourceReference.reference !== session.migrationId || outbox.length !== 0 || checkpoints.length !== 0) {
    fail('CORRUPT_PERSISTED_RECORD', 'legacy_target_graph');
  }
  const byId = new Map(entities.map(entity => [entity.entityId, entity]));
  if (entities.length !== session.manifest.entryCount || byId.size !== entities.length) {
    fail('CORRUPT_PERSISTED_RECORD', 'legacy_target_set');
  }
  let liveCount = 0; let tombstoneCount = 0;
  const targetDigests: Array<[string, string]> = [];
  for (const entry of session.manifest.entries) {
    const entity = byId.get(entry.entityId); const provenance = entity?.migrationProvenance;
    if (!entity || entity.namespaceKey !== runtime.namespaceKey || entity.generationId !== session.target.generationId
      || entity.domain !== 'notes' || entity.revision !== 1 || entity.createdAt !== entry.createdAt
      || entity.updatedAt !== entry.updatedAt || entity.deletedAt !== entry.deletedAt
      || entity.isDeleted !== (entry.classification === 'tombstone')
      || entity.deletionState !== (entry.classification === 'tombstone' ? 'deleted' : 'active')
      || entity.ownerId !== authority.userId || entity.contentHash !== entry.sourceRecordDigest
      || entity.source?.kind !== 'legacy_migration' || entity.source.reference !== session.migrationId
      || !provenance || provenance.conversionVersion !== 1 || provenance.sourceAdapter !== session.source.adapter
      || provenance.sourceSchemaVersion !== session.source.schemaVersion || provenance.migrationSessionId !== session.migrationId
      || provenance.sourceSnapshotDigest !== session.source.snapshotDigest || provenance.migratedAt !== session.createdAt
      || provenance.legacyKeyDigest !== entry.legacyKeyDigest || entityDigest(entity) !== entry.targetEntityDigest) {
      fail('CORRUPT_PERSISTED_RECORD', 'legacy_target_entity');
    }
    targetDigests.push([entry.entityId, entry.targetEntityDigest]);
    if (entry.classification === 'live') liveCount += 1; else tombstoneCount += 1;
  }
  const targetStateDigest = sha256Hex(canonical(['absinthe-legacy-target-state-v1', targetDigests]));
  if (targetStateDigest !== session.manifest.targetStateDigest) fail('CORRUPT_PERSISTED_RECORD', 'legacy_target_digest');
  return { targetStateDigest, liveCount, tombstoneCount };
}

export async function captureLegacyNotesMigration(
  runtime: LegacyNotesMigrationRuntime, adapter: LegacyNotesSourceAdapter, options: LegacyNotesMigrationOptions,
): Promise<LegacyNotesMigrationSessionV1> {
  runtime.assertOpen('capture_legacy_notes_migration'); validateAdapter(runtime, adapter);
  validateLegacyMigrationLogicalId(options.migrationSessionId);
  const at = timestamp(options.now ?? runtime.clock(), 'capture_legacy_notes_migration');
  const targetGenerationId = `migration-${options.migrationSessionId}`;
  if (!SAFE_ID.test(targetGenerationId)) fail('INVALID_LEGACY_MIGRATION', 'migration_generation_id');
  const plan = await buildPlan(runtime, adapter, options.migrationSessionId, targetGenerationId, at);
  const tx = runtime.db.transaction([LOCAL_DATABASE_STORES.databaseMeta, LOCAL_DATABASE_STORES.migrationState], 'readwrite');
  const done = transactionCompletion(tx, 'capture_legacy_notes_migration');
  try {
    const meta = await requestResult(tx.objectStore(LOCAL_DATABASE_STORES.databaseMeta).get(runtime.namespaceKey)) as DatabaseMetaRecord | undefined;
    if (!meta) fail('MALFORMED_METADATA', 'capture_legacy_notes_migration');
    validateDatabaseMeta(meta, runtime.namespaceKey, runtime.namespace.schemaVersion);
    const store = tx.objectStore(LOCAL_DATABASE_STORES.migrationState);
    await validateLegacyNotesSourceAuthorityInStore(runtime, store, adapter);
    const all = await requestResult(store.getAll(namespaceMigrationRange(runtime.namespaceKey))) as unknown[];
    const sessions: LegacyNotesMigrationSessionV1[] = [];
    for (const value of all) {
      if ((value as { kind?: unknown })?.kind === 'legacy_notes_migration_v1') sessions.push(persistedSession(value, runtime.namespaceKey));
    }
    const persistedId = toLegacyNotesMigrationStorageId(options.migrationSessionId);
    const occupiedStorageKey = all.find(value => (value as { migrationId?: unknown })?.migrationId === persistedId);
    if (occupiedStorageKey && (occupiedStorageKey as { kind?: unknown }).kind !== 'legacy_notes_migration_v1') {
      fail('CORRUPT_PERSISTED_RECORD', 'capture_legacy_notes_migration');
    }
    const sameId = sessions.find(session => session.migrationId === options.migrationSessionId);
    if (sameId) {
      if (sameId.source.sourceInstanceId !== adapter.sourceInstanceId || sameId.source.snapshotDigest !== plan.snapshotDigest) {
        fail('MIGRATION_SOURCE_CHANGED', 'capture_legacy_notes_migration');
      }
      await done; return sameId;
    }
    const identical = sessions.find(session => session.source.sourceInstanceId === adapter.sourceInstanceId
      && session.source.snapshotDigest === plan.snapshotDigest && session.manifest.conversionVersion === 1
      && session.status !== 'cancelled' && session.status !== 'failed');
    if (identical) { await done; return identical; }
    if (sessions.some(session => ACTIVE_STATUSES.has(session.status))) fail('MIGRATION_SESSION_CONFLICT', 'capture_legacy_notes_migration');
    if (sessions.length >= MAX_LEGACY_MIGRATION_SESSIONS_PER_NAMESPACE) {
      fail('MIGRATION_SESSION_CONFLICT', 'capture_legacy_notes_migration');
    }
    const session: LegacyNotesMigrationSessionV1 = {
      kind: 'legacy_notes_migration_v1', version: 1, migrationId: options.migrationSessionId,
      namespaceKey: runtime.namespaceKey, expectedActiveGenerationId: meta.activeGenerationId,
      source: {
        adapter: adapter.adapter, schemaVersion: adapter.schemaVersion, sourceInstanceId: adapter.sourceInstanceId,
        sourceType: adapter.sourceType, externalRootDigest: adapter.externalRootDigest,
        sourceIdentityDigest: adapter.sourceIdentityDigest, sourceBindingDigest: adapter.sourceBindingDigest,
        rootBindingVersion: adapter.rootBindingVersion, rootBindingDigest: adapter.rootBindingDigest,
        authorityId: adapter.authorityId, authorityVersion: adapter.authorityVersion,
        authorityDigest: adapter.authorityDigest, ownershipMode: adapter.ownershipMode, capturedAt: plan.capturedAt,
        snapshotDigest: plan.snapshotDigest, entryCount: plan.manifest.entryCount,
      },
      target: { generationId: targetGenerationId, databaseVersion: LOCAL_DATABASE_VERSION },
      status: 'capturing', manifest: plan.manifest, result: null, failure: null,
      createdAt: at, updatedAt: at, verifiedAt: null,
    };
    persistedSession(toPersistedSession(session), runtime.namespaceKey); store.add(toPersistedSession(session)); await done; return session;
  } catch (error) {
    abortQuietly(tx); await done.catch(() => undefined); throw localDatabaseError(error, 'capture_legacy_notes_migration');
  }
}

async function stageLegacyNotesMigration(
  runtime: LegacyNotesMigrationRuntime, adapter: LegacyNotesSourceAdapter, session: LegacyNotesMigrationSessionV1,
): Promise<LegacyNotesMigrationSessionV1> {
  if (adapter.adapter !== session.source.adapter || adapter.schemaVersion !== session.source.schemaVersion
    || adapter.sourceInstanceId !== session.source.sourceInstanceId || adapter.sourceType !== session.source.sourceType
    || adapter.externalRootDigest !== session.source.externalRootDigest
    || adapter.sourceIdentityDigest !== session.source.sourceIdentityDigest
    || adapter.sourceBindingDigest !== session.source.sourceBindingDigest
    || adapter.rootBindingVersion !== session.source.rootBindingVersion
    || adapter.rootBindingDigest !== session.source.rootBindingDigest || adapter.authorityId !== session.source.authorityId
    || adapter.authorityVersion !== session.source.authorityVersion || adapter.authorityDigest !== session.source.authorityDigest
    || adapter.ownershipMode !== session.source.ownershipMode) {
    fail('MIGRATION_SESSION_CONFLICT', 'stage_legacy_notes_migration');
  }
  const plan = await buildPlan(runtime, adapter, session.migrationId, session.target.generationId, session.createdAt);
  if (plan.snapshotDigest !== session.source.snapshotDigest || canonical(plan.manifest) !== canonical(session.manifest)) {
    await markSourceChanged(runtime, session, timestamp(runtime.clock(), 'stage_legacy_notes_migration'));
    fail('MIGRATION_SOURCE_CHANGED', 'stage_legacy_notes_migration');
  }
  const tx = runtime.db.transaction([
    LOCAL_DATABASE_STORES.databaseMeta, LOCAL_DATABASE_STORES.generations, LOCAL_DATABASE_STORES.entities,
    LOCAL_DATABASE_STORES.outbox, LOCAL_DATABASE_STORES.syncCheckpoints, LOCAL_DATABASE_STORES.migrationState,
  ], 'readwrite');
  const done = transactionCompletion(tx, 'stage_legacy_notes_migration');
  try {
    const meta = await requestResult(tx.objectStore(LOCAL_DATABASE_STORES.databaseMeta).get(runtime.namespaceKey)) as DatabaseMetaRecord | undefined;
    const store = tx.objectStore(LOCAL_DATABASE_STORES.migrationState);
    await validateLegacyNotesSourceAuthorityInStore(runtime, store, sessionAuthorityReference(session));
    const raw = await requestResult(store.get(sessionKey(runtime.namespaceKey, session.migrationId)));
    if (!meta || raw === undefined) fail('CORRUPT_PERSISTED_RECORD', 'stage_legacy_notes_migration');
    validateDatabaseMeta(meta, runtime.namespaceKey, runtime.namespace.schemaVersion);
    const current = persistedSession(raw, runtime.namespaceKey);
    if (current.status !== 'capturing' || canonical(current) !== canonical(session)
      || meta.activeGenerationId !== session.expectedActiveGenerationId) fail('MIGRATION_SESSION_CONFLICT', 'stage_legacy_notes_migration');
    const generations = tx.objectStore(LOCAL_DATABASE_STORES.generations);
    if (await requestResult(generations.get(generationKey(runtime.namespaceKey, session.target.generationId))) !== undefined) {
      fail('CORRUPT_PERSISTED_RECORD', 'stage_legacy_notes_migration');
    }
    const [existingEntities, existingOutbox, existingCheckpoints] = await Promise.all([
      requestResult(tx.objectStore(LOCAL_DATABASE_STORES.entities)
        .getAll(entityRange(runtime.namespaceKey, session.target.generationId))),
      requestResult(tx.objectStore(LOCAL_DATABASE_STORES.outbox)
        .getAll(outboxRange(runtime.namespaceKey, session.target.generationId))),
      requestResult(tx.objectStore(LOCAL_DATABASE_STORES.syncCheckpoints)
        .getAll(checkpointRange(runtime.namespaceKey, session.target.generationId))),
    ]);
    if (existingEntities.length !== 0 || existingOutbox.length !== 0 || existingCheckpoints.length !== 0) {
      fail('CORRUPT_PERSISTED_RECORD', 'stage_legacy_notes_migration');
    }
    const generation: GenerationRecord = {
      namespaceKey: runtime.namespaceKey, generationId: session.target.generationId, status: 'preparing',
      createdAt: session.createdAt, activatedAt: null, predecessorGenerationId: null, creationReason: 'migration',
      schemaVersion: runtime.namespace.schemaVersion, validationState: 'valid',
      safeSourceReference: { kind: 'legacy_migration', reference: session.migrationId },
    };
    validateGenerationRecord(generation, runtime.namespaceKey, runtime.namespace.schemaVersion); generations.add(generation);
    const entities = tx.objectStore(LOCAL_DATABASE_STORES.entities);
    for (const entity of plan.entities) entities.add(entity);
    const staged: LegacyNotesMigrationSessionV1 = { ...session, status: 'staged', updatedAt: session.createdAt };
    persistedSession(toPersistedSession(staged), runtime.namespaceKey); store.put(toPersistedSession(staged)); await done; return staged;
  } catch (error) {
    abortQuietly(tx); await done.catch(() => undefined); throw localDatabaseError(error, 'stage_legacy_notes_migration');
  }
}

async function markSourceChanged(runtime: LegacyNotesMigrationRuntime, session: LegacyNotesMigrationSessionV1, at: string): Promise<void> {
  const tx = runtime.db.transaction(LOCAL_DATABASE_STORES.migrationState, 'readwrite'); const done = transactionCompletion(tx, 'fail_legacy_migration');
  try {
    const store = tx.objectStore(LOCAL_DATABASE_STORES.migrationState);
    await validateLegacyNotesSourceAuthorityInStore(runtime, store, sessionAuthorityReference(session));
    const raw = await requestResult(store.get(sessionKey(runtime.namespaceKey, session.migrationId)));
    if (raw === undefined) fail('CORRUPT_PERSISTED_RECORD', 'fail_legacy_migration');
    const current = persistedSession(raw, runtime.namespaceKey);
    if (!['capturing', 'staged', 'verifying'].includes(current.status)) fail('MIGRATION_SESSION_CONFLICT', 'fail_legacy_migration');
    const failed: LegacyNotesMigrationSessionV1 = {
      ...current, status: 'failed', result: null, failure: { code: 'MIGRATION_SOURCE_CHANGED' }, updatedAt: at, verifiedAt: null,
    };
    persistedSession(toPersistedSession(failed), runtime.namespaceKey); store.put(toPersistedSession(failed)); await done;
  } catch (error) { abortQuietly(tx); await done.catch(() => undefined); throw localDatabaseError(error, 'fail_legacy_migration'); }
}

export async function verifyLegacyNotesMigration(
  runtime: LegacyNotesMigrationRuntime, adapter: LegacyNotesSourceAdapter, migrationId: string, at?: string,
): Promise<LegacyMigrationResultV1> {
  runtime.assertOpen('verify_legacy_notes_migration'); validateAdapter(runtime, adapter);
  validateLegacyMigrationLogicalId(migrationId);
  const verifiedAt = timestamp(at ?? runtime.clock(), 'verify_legacy_notes_migration');
  let session = await readSessionRecord(runtime, migrationId);
  if (!session) fail('MIGRATION_SESSION_CONFLICT', 'verify_legacy_notes_migration');
  await resolveLegacyNotesSourceAuthority(runtime, sessionAuthorityReference(session));
  if (session.status === 'cancelled') fail('MIGRATION_CANCELLED', 'verify_legacy_notes_migration');
  if (session.status === 'failed') fail(session.failure?.code === 'MIGRATION_SOURCE_CHANGED'
    ? 'MIGRATION_SOURCE_CHANGED' : 'CORRUPT_PERSISTED_RECORD', 'verify_legacy_notes_migration');
  if (session.status === 'capturing') fail('MIGRATION_SESSION_CONFLICT', 'verify_legacy_notes_migration');
  if (session.source.adapter !== adapter.adapter || session.source.sourceInstanceId !== adapter.sourceInstanceId
    || session.source.sourceType !== adapter.sourceType || session.source.externalRootDigest !== adapter.externalRootDigest
    || session.source.sourceIdentityDigest !== adapter.sourceIdentityDigest
    || session.source.sourceBindingDigest !== adapter.sourceBindingDigest
    || session.source.rootBindingDigest !== adapter.rootBindingDigest
    || session.source.authorityId !== adapter.authorityId || session.source.authorityDigest !== adapter.authorityDigest) {
    fail('MIGRATION_SESSION_CONFLICT', 'verify_legacy_notes_migration');
  }
  if (session.status !== 'verified') {
    // Reject malformed durable target evidence without advancing the lifecycle.
    // The target is validated again inside the double-capture fence below.
    await validateDurableTarget(runtime, session);
    const tx = runtime.db.transaction(LOCAL_DATABASE_STORES.migrationState, 'readwrite'); const done = transactionCompletion(tx, 'begin_legacy_verification');
    try {
      const store = tx.objectStore(LOCAL_DATABASE_STORES.migrationState);
      await validateLegacyNotesSourceAuthorityInStore(runtime, store, sessionAuthorityReference(session));
      const raw = await requestResult(store.get(sessionKey(runtime.namespaceKey, migrationId)));
      if (raw === undefined) fail('CORRUPT_PERSISTED_RECORD', 'begin_legacy_verification');
      const current = persistedSession(raw, runtime.namespaceKey);
      if (!['staged', 'verifying'].includes(current.status)) fail('MIGRATION_SESSION_CONFLICT', 'begin_legacy_verification');
      session = { ...current, status: 'verifying', updatedAt: verifiedAt };
      persistedSession(toPersistedSession(session), runtime.namespaceKey); store.put(toPersistedSession(session)); await done;
    } catch (error) { abortQuietly(tx); await done.catch(() => undefined); throw localDatabaseError(error, 'begin_legacy_verification'); }
  }
  const before = await buildPlan(runtime, adapter, session.migrationId, session.target.generationId, session.createdAt);
  if (before.snapshotDigest !== session.source.snapshotDigest || canonical(before.manifest) !== canonical(session.manifest)) {
    if (session.status !== 'verified') await markSourceChanged(runtime, session, verifiedAt);
    fail('MIGRATION_SOURCE_CHANGED', 'verify_legacy_notes_migration');
  }
  const durable = await validateDurableTarget(runtime, session);
  const after = await buildPlan(runtime, adapter, session.migrationId, session.target.generationId, session.createdAt);
  if (after.snapshotDigest !== session.source.snapshotDigest || canonical(after.manifest) !== canonical(session.manifest)) {
    if (session.status !== 'verified') await markSourceChanged(runtime, session, verifiedAt);
    fail('MIGRATION_SOURCE_CHANGED', 'verify_legacy_notes_migration');
  }
  const result: LegacyMigrationResultV1 = {
    entryCount: session.manifest.entryCount, liveCount: durable.liveCount, tombstoneCount: durable.tombstoneCount,
    sourceSnapshotDigest: session.source.snapshotDigest, manifestDigest: session.manifest.manifestDigest,
    targetStateDigest: durable.targetStateDigest, verifiedAt: session.result?.verifiedAt ?? verifiedAt,
  };
  if (session.status === 'verified') {
    validateResult(result, session);
    if (canonical(result) !== canonical(session.result)) fail('CORRUPT_PERSISTED_RECORD', 'verified_legacy_result');
    return result;
  }
  const tx = runtime.db.transaction(LOCAL_DATABASE_STORES.migrationState, 'readwrite'); const done = transactionCompletion(tx, 'complete_legacy_verification');
  try {
    const store = tx.objectStore(LOCAL_DATABASE_STORES.migrationState);
    await validateLegacyNotesSourceAuthorityInStore(runtime, store, sessionAuthorityReference(session));
    const raw = await requestResult(store.get(sessionKey(runtime.namespaceKey, migrationId)));
    if (raw === undefined) fail('CORRUPT_PERSISTED_RECORD', 'complete_legacy_verification');
    const current = persistedSession(raw, runtime.namespaceKey);
    if (current.status !== 'verifying' || canonical(current.manifest) !== canonical(session.manifest)) {
      fail('MIGRATION_SESSION_CONFLICT', 'complete_legacy_verification');
    }
    const completed: LegacyNotesMigrationSessionV1 = {
      ...current, status: 'verified', result, failure: null, updatedAt: verifiedAt, verifiedAt: result.verifiedAt,
    };
    persistedSession(toPersistedSession(completed), runtime.namespaceKey); store.put(toPersistedSession(completed)); await done; return result;
  } catch (error) { abortQuietly(tx); await done.catch(() => undefined); throw localDatabaseError(error, 'complete_legacy_verification'); }
}

export async function resumeLegacyNotesMigration(
  runtime: LegacyNotesMigrationRuntime, adapter: LegacyNotesSourceAdapter, migrationId: string, at?: string,
): Promise<LegacyNotesMigrationSessionV1 | LegacyMigrationResultV1> {
  runtime.assertOpen('resume_legacy_notes_migration'); validateLegacyMigrationLogicalId(migrationId);
  let session = await readSessionRecord(runtime, migrationId);
  if (!session) fail('MIGRATION_SESSION_CONFLICT', 'resume_legacy_notes_migration');
  if (session.status === 'capturing') return stageLegacyNotesMigration(runtime, adapter, session);
  return verifyLegacyNotesMigration(runtime, adapter, session.migrationId, at);
}

export async function getLegacyNotesMigrationSession(
  runtime: LegacyNotesMigrationRuntime, migrationId: string,
): Promise<LegacyNotesMigrationSessionV1 | null> {
  runtime.assertOpen('get_legacy_notes_migration');
  validateLegacyMigrationLogicalId(migrationId);
  const session = await readSessionRecord(runtime, migrationId);
  if (session) await resolveLegacyNotesSourceAuthority(runtime, sessionAuthorityReference(session));
  if (session && ['staged', 'verifying', 'verified'].includes(session.status)) {
    const durable = await validateDurableTarget(runtime, session);
    if (session.result && (session.result.liveCount !== durable.liveCount
      || session.result.tombstoneCount !== durable.tombstoneCount
      || session.result.targetStateDigest !== durable.targetStateDigest)) {
      fail('CORRUPT_PERSISTED_RECORD', 'legacy_migration_result_evidence');
    }
  }
  return session;
}

export async function getLegacyNotesMigrationSessionForAdministration(
  runtime: LegacyNotesMigrationRuntime, migrationId: string,
): Promise<LegacyNotesMigrationAdministrativeView> {
  runtime.assertOpen('get_legacy_notes_migration_for_administration');
  validateLegacyMigrationLogicalId(migrationId);
  const tx = runtime.db.transaction(LOCAL_DATABASE_STORES.migrationState, 'readonly');
  const done = transactionCompletion(tx, 'get_legacy_notes_migration_for_administration');
  const store = tx.objectStore(LOCAL_DATABASE_STORES.migrationState);
  const raw = await requestResult(store.get(sessionKey(runtime.namespaceKey, migrationId)));
  if (raw === undefined) {
    await done; fail('MIGRATION_SESSION_CONFLICT', 'get_legacy_notes_migration_for_administration');
  }
  const session = persistedSession(raw, runtime.namespaceKey);
  const authorityStatus = await inspectLegacyNotesSourceAuthorityInStore(
    runtime, store, sessionAuthorityReference(session),
  );
  await done;
  return Object.freeze({
    migrationSessionId: session.migrationId, lifecycleState: session.status, namespaceKey: session.namespaceKey,
    authorityId: session.source.authorityId, authorityStatus, targetGenerationId: session.target.generationId,
    createdAt: session.createdAt, updatedAt: session.updatedAt, failureCode: session.failure?.code ?? null,
    continuationAllowed: authorityStatus === 'valid' && !['cancelled', 'failed'].includes(session.status),
  });
}

export async function cancelLegacyNotesMigration(
  runtime: LegacyNotesMigrationRuntime, migrationId: string, at?: string,
): Promise<LegacyNotesMigrationSessionV1> {
  runtime.assertOpen('cancel_legacy_notes_migration'); validateLegacyMigrationLogicalId(migrationId);
  const cancelledAt = timestamp(at ?? runtime.clock(), 'cancel_legacy_notes_migration');
  const tx = runtime.db.transaction(LOCAL_DATABASE_STORES.migrationState, 'readwrite'); const done = transactionCompletion(tx, 'cancel_legacy_notes_migration');
  try {
    const store = tx.objectStore(LOCAL_DATABASE_STORES.migrationState);
    const raw = await requestResult(store.get(sessionKey(runtime.namespaceKey, migrationId)));
    if (raw === undefined) fail('MIGRATION_SESSION_CONFLICT', 'cancel_legacy_notes_migration');
    const current = persistedSession(raw, runtime.namespaceKey);
    await inspectLegacyNotesSourceAuthorityInStore(runtime, store, sessionAuthorityReference(current));
    if (current.status === 'cancelled') { await done; return current; }
    if (!['capturing', 'staged', 'verifying'].includes(current.status)) fail('MIGRATION_SESSION_CONFLICT', 'cancel_legacy_notes_migration');
    const cancelled: LegacyNotesMigrationSessionV1 = {
      ...current, status: 'cancelled', result: null, failure: { code: 'MIGRATION_CANCELLED' },
      updatedAt: cancelledAt, verifiedAt: null,
    };
    persistedSession(toPersistedSession(cancelled), runtime.namespaceKey); store.put(toPersistedSession(cancelled)); await done; return cancelled;
  } catch (error) { abortQuietly(tx); await done.catch(() => undefined); throw localDatabaseError(error, 'cancel_legacy_notes_migration'); }
}
