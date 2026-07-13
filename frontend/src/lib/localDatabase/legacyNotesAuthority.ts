import { LocalDatabaseError, localDatabaseError } from './errors';
import { sha256Hex } from './outboxIdentity';
import { LOCAL_DATABASE_STORES } from './schema';
import type { LocalDatabaseNamespace } from './types';
import { validTimestamp } from './validation';

export const LEGACY_NOTES_AUTHORITY_VERSION = 1 as const;
export const LEGACY_NOTES_AUTHORITY_NAMESPACE = 'k325:legacy-source-authority:v1';
const AUTHORITY_KEY_PREFIX = 'source:';
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const HASH = /^[a-f0-9]{64}$/;
const MAX_AUTHORITY_RECORDS = 1_024;

export type LegacyNotesSourceType = 'indexeddb' | 'localstorage';

export interface LegacyNotesSourceAuthorityRecordV1 {
  kind: 'legacy_notes_source_authority_v1';
  version: 1;
  namespaceKey: typeof LEGACY_NOTES_AUTHORITY_NAMESPACE;
  migrationId: string;
  authorityId: string;
  sourceType: LegacyNotesSourceType;
  sourceInstanceId: string;
  sourceIdentityDigest: string;
  boundNamespaceKey: string;
  userId: string;
  projectRef: string;
  deviceId: string;
  schemaVersion: number;
  ownershipMode: 'authenticated' | 'local_only';
  authorityMethod: 'explicit_operator_binding';
  createdAt: string;
  revokedAt: string | null;
  authorityDigest: string;
}

export interface RegisterLegacyNotesSourceAuthorityInput {
  authorityId: string;
  sourceType: LegacyNotesSourceType;
  sourceInstanceId: string;
  sourceIdentityId: string;
  ownershipMode: 'authenticated' | 'local_only';
  now?: string;
}

export interface LegacyNotesAuthorityReference {
  authorityId: string;
  authorityVersion: 1;
  authorityDigest: string;
  sourceType: LegacyNotesSourceType;
  sourceInstanceId: string;
  sourceIdentityDigest: string;
  namespaceKey: string;
  ownershipMode: 'authenticated' | 'local_only';
}

export interface LegacyNotesAuthorityRuntime {
  db: IDBDatabase;
  namespace: LocalDatabaseNamespace;
  namespaceKey: string;
  clock: () => string;
  assertOpen: (operation: string) => void;
}

function fail(code: 'CORRUPT_PERSISTED_RECORD' | 'INVALID_LEGACY_MIGRATION'
  | 'LEGACY_SOURCE_AUTHORITY_REQUIRED' | 'LEGACY_SOURCE_AUTHORITY_CONFLICT'
  | 'LEGACY_SOURCE_AUTHORITY_REVOKED' | 'LEGACY_SOURCE_IDENTITY_MISMATCH', operation: string): never {
  throw new LocalDatabaseError(code, operation);
}

function compareStrings(left: string, right: string): number { return left < right ? -1 : left > right ? 1 : 0; }
function exactKeys(value: object, expected: readonly string[]): boolean {
  return Object.keys(value).sort(compareStrings).join(',') === [...expected].sort(compareStrings).join(',');
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
function authorityRange(): IDBKeyRange {
  return IDBKeyRange.bound(
    [LEGACY_NOTES_AUTHORITY_NAMESPACE, ''],
    [LEGACY_NOTES_AUTHORITY_NAMESPACE, '\uffff'],
  );
}
function authorityKey(sourceIdentityDigest: string): [string, string] {
  return [LEGACY_NOTES_AUTHORITY_NAMESPACE, `${AUTHORITY_KEY_PREFIX}${sourceIdentityDigest}`];
}
function timestamp(value: string | undefined, operation: string): string {
  const result = value ?? new Date().toISOString();
  if (!validTimestamp(result)) fail('INVALID_LEGACY_MIGRATION', operation);
  return result;
}
function validateId(value: unknown, operation: string): asserts value is string {
  if (typeof value !== 'string' || !SAFE_ID.test(value)) fail('INVALID_LEGACY_MIGRATION', operation);
}
function sourceIdentityDigest(input: RegisterLegacyNotesSourceAuthorityInput): string {
  validateId(input.sourceIdentityId, 'legacy_source_identity');
  return sha256Hex(JSON.stringify([
    'absinthe-legacy-source-identity-v1', input.sourceType, input.sourceInstanceId, input.sourceIdentityId,
  ]));
}
function authorityCore(record: LegacyNotesSourceAuthorityRecordV1): unknown[] {
  return [
    'absinthe-legacy-source-authority-v1', record.authorityId, record.sourceType, record.sourceInstanceId,
    record.sourceIdentityDigest, record.boundNamespaceKey, record.userId, record.projectRef, record.deviceId,
    record.schemaVersion, record.ownershipMode, record.authorityMethod, record.createdAt, record.revokedAt,
  ];
}
function digestAuthority(record: LegacyNotesSourceAuthorityRecordV1): string {
  return sha256Hex(JSON.stringify(authorityCore(record)));
}

export function validateLegacyNotesSourceAuthorityRecord(value: unknown): LegacyNotesSourceAuthorityRecordV1 {
  const record = value as LegacyNotesSourceAuthorityRecordV1;
  const keys = [
    'kind', 'version', 'namespaceKey', 'migrationId', 'authorityId', 'sourceType', 'sourceInstanceId',
    'sourceIdentityDigest', 'boundNamespaceKey', 'userId', 'projectRef', 'deviceId', 'schemaVersion',
    'ownershipMode', 'authorityMethod', 'createdAt', 'revokedAt', 'authorityDigest',
  ];
  if (!record || typeof record !== 'object' || !exactKeys(record, keys)
    || record.kind !== 'legacy_notes_source_authority_v1' || record.version !== 1
    || record.namespaceKey !== LEGACY_NOTES_AUTHORITY_NAMESPACE || !SAFE_ID.test(record.authorityId)
    || !['indexeddb', 'localstorage'].includes(record.sourceType) || !SAFE_ID.test(record.sourceInstanceId)
    || !HASH.test(record.sourceIdentityDigest)
    || record.migrationId !== `${AUTHORITY_KEY_PREFIX}${record.sourceIdentityDigest}`
    || !HASH.test(record.boundNamespaceKey) || !SAFE_ID.test(record.userId) || !SAFE_ID.test(record.projectRef)
    || !SAFE_ID.test(record.deviceId) || !Number.isSafeInteger(record.schemaVersion) || record.schemaVersion < 1
    || !['authenticated', 'local_only'].includes(record.ownershipMode)
    || record.authorityMethod !== 'explicit_operator_binding' || !validTimestamp(record.createdAt)
    || record.revokedAt !== null && (!validTimestamp(record.revokedAt)
      || Date.parse(record.revokedAt) < Date.parse(record.createdAt))
    || !HASH.test(record.authorityDigest) || digestAuthority(record) !== record.authorityDigest) {
    fail('CORRUPT_PERSISTED_RECORD', 'validate_legacy_source_authority');
  }
  return record;
}

function matchesRuntime(record: LegacyNotesSourceAuthorityRecordV1, runtime: LegacyNotesAuthorityRuntime): boolean {
  return record.boundNamespaceKey === runtime.namespaceKey && record.userId === runtime.namespace.userId
    && record.projectRef === runtime.namespace.projectRef && record.deviceId === runtime.namespace.deviceId
    && record.schemaVersion === runtime.namespace.schemaVersion;
}
function sameAuthorityBinding(
  left: LegacyNotesSourceAuthorityRecordV1, right: LegacyNotesSourceAuthorityRecordV1,
): boolean {
  return left.authorityId === right.authorityId && left.sourceType === right.sourceType
    && left.sourceInstanceId === right.sourceInstanceId && left.sourceIdentityDigest === right.sourceIdentityDigest
    && left.boundNamespaceKey === right.boundNamespaceKey && left.userId === right.userId
    && left.projectRef === right.projectRef && left.deviceId === right.deviceId
    && left.schemaVersion === right.schemaVersion && left.ownershipMode === right.ownershipMode
    && left.authorityMethod === right.authorityMethod;
}
function reference(record: LegacyNotesSourceAuthorityRecordV1): LegacyNotesAuthorityReference {
  return {
    authorityId: record.authorityId, authorityVersion: 1, authorityDigest: record.authorityDigest,
    sourceType: record.sourceType, sourceInstanceId: record.sourceInstanceId,
    sourceIdentityDigest: record.sourceIdentityDigest, namespaceKey: record.boundNamespaceKey,
    ownershipMode: record.ownershipMode,
  };
}

async function readAllAuthorities(store: IDBObjectStore): Promise<LegacyNotesSourceAuthorityRecordV1[]> {
  const values = await requestResult(store.getAll(authorityRange())) as unknown[];
  if (values.length > MAX_AUTHORITY_RECORDS) fail('CORRUPT_PERSISTED_RECORD', 'read_legacy_source_authorities');
  return values.map(validateLegacyNotesSourceAuthorityRecord);
}

export async function registerLegacyNotesSourceAuthority(
  runtime: LegacyNotesAuthorityRuntime, input: RegisterLegacyNotesSourceAuthorityInput,
): Promise<LegacyNotesSourceAuthorityRecordV1> {
  runtime.assertOpen('register_legacy_source_authority');
  validateId(input.authorityId, 'legacy_authority_id');
  validateId(input.sourceInstanceId, 'legacy_source_instance');
  if (!['indexeddb', 'localstorage'].includes(input.sourceType)
    || !['authenticated', 'local_only'].includes(input.ownershipMode)) {
    fail('INVALID_LEGACY_MIGRATION', 'register_legacy_source_authority');
  }
  const identityDigest = sourceIdentityDigest(input);
  const createdAt = timestamp(input.now ?? runtime.clock(), 'register_legacy_source_authority');
  const draft: LegacyNotesSourceAuthorityRecordV1 = {
    kind: 'legacy_notes_source_authority_v1', version: 1, namespaceKey: LEGACY_NOTES_AUTHORITY_NAMESPACE,
    migrationId: `${AUTHORITY_KEY_PREFIX}${identityDigest}`, authorityId: input.authorityId,
    sourceType: input.sourceType, sourceInstanceId: input.sourceInstanceId, sourceIdentityDigest: identityDigest,
    boundNamespaceKey: runtime.namespaceKey, userId: runtime.namespace.userId, projectRef: runtime.namespace.projectRef,
    deviceId: runtime.namespace.deviceId, schemaVersion: runtime.namespace.schemaVersion,
    ownershipMode: input.ownershipMode, authorityMethod: 'explicit_operator_binding', createdAt, revokedAt: null,
    authorityDigest: '',
  };
  draft.authorityDigest = digestAuthority(draft);
  const tx = runtime.db.transaction(LOCAL_DATABASE_STORES.migrationState, 'readwrite');
  const done = transactionCompletion(tx, 'register_legacy_source_authority');
  try {
    const store = tx.objectStore(LOCAL_DATABASE_STORES.migrationState);
    const all = await readAllAuthorities(store);
    const sameIdentity = all.find(record => record.sourceIdentityDigest === identityDigest);
    const sameAuthorityId = all.find(record => record.authorityId === input.authorityId);
    if (sameAuthorityId && sameAuthorityId.sourceIdentityDigest !== identityDigest) {
      fail('CORRUPT_PERSISTED_RECORD', 'register_legacy_source_authority');
    }
    if (sameIdentity) {
      if (sameIdentity.revokedAt !== null) fail('LEGACY_SOURCE_AUTHORITY_REVOKED', 'register_legacy_source_authority');
      if (!sameAuthorityBinding(sameIdentity, draft)) {
        fail('LEGACY_SOURCE_AUTHORITY_CONFLICT', 'register_legacy_source_authority');
      }
      await done; return sameIdentity;
    }
    store.add(draft); await done; return draft;
  } catch (error) {
    abortQuietly(tx); await done.catch(() => undefined); throw localDatabaseError(error, 'register_legacy_source_authority');
  }
}

export async function getLegacyNotesSourceAuthority(
  runtime: LegacyNotesAuthorityRuntime, authorityId: string,
): Promise<LegacyNotesSourceAuthorityRecordV1 | null> {
  runtime.assertOpen('get_legacy_source_authority'); validateId(authorityId, 'legacy_authority_id');
  const tx = runtime.db.transaction(LOCAL_DATABASE_STORES.migrationState, 'readonly');
  const done = transactionCompletion(tx, 'get_legacy_source_authority');
  const all = await readAllAuthorities(tx.objectStore(LOCAL_DATABASE_STORES.migrationState)); await done;
  const matches = all.filter(record => record.authorityId === authorityId);
  if (matches.length > 1) fail('CORRUPT_PERSISTED_RECORD', 'get_legacy_source_authority');
  if (matches[0] && !matchesRuntime(matches[0], runtime)) {
    fail('LEGACY_SOURCE_AUTHORITY_CONFLICT', 'get_legacy_source_authority');
  }
  return matches[0] ?? null;
}

export async function revokeLegacyNotesSourceAuthority(
  runtime: LegacyNotesAuthorityRuntime, authorityId: string, at?: string,
): Promise<LegacyNotesSourceAuthorityRecordV1> {
  runtime.assertOpen('revoke_legacy_source_authority'); validateId(authorityId, 'legacy_authority_id');
  const revokedAt = timestamp(at ?? runtime.clock(), 'revoke_legacy_source_authority');
  const tx = runtime.db.transaction(LOCAL_DATABASE_STORES.migrationState, 'readwrite');
  const done = transactionCompletion(tx, 'revoke_legacy_source_authority');
  try {
    const store = tx.objectStore(LOCAL_DATABASE_STORES.migrationState); const all = await readAllAuthorities(store);
    const matches = all.filter(record => record.authorityId === authorityId);
    if (matches.length !== 1) fail(matches.length === 0 ? 'LEGACY_SOURCE_AUTHORITY_REQUIRED' : 'CORRUPT_PERSISTED_RECORD', 'revoke_legacy_source_authority');
    const current = matches[0];
    if (!matchesRuntime(current, runtime)) fail('LEGACY_SOURCE_AUTHORITY_CONFLICT', 'revoke_legacy_source_authority');
    if (current.revokedAt !== null) { await done; return current; }
    const revoked = { ...current, revokedAt } as LegacyNotesSourceAuthorityRecordV1;
    revoked.authorityDigest = digestAuthority(revoked); validateLegacyNotesSourceAuthorityRecord(revoked);
    store.put(revoked); await done; return revoked;
  } catch (error) {
    abortQuietly(tx); await done.catch(() => undefined); throw localDatabaseError(error, 'revoke_legacy_source_authority');
  }
}

export async function resolveLegacyNotesSourceAuthority(
  runtime: LegacyNotesAuthorityRuntime, candidate: LegacyNotesAuthorityReference,
): Promise<LegacyNotesSourceAuthorityRecordV1> {
  runtime.assertOpen('resolve_legacy_source_authority');
  if (!candidate || candidate.authorityVersion !== 1 || !SAFE_ID.test(candidate.authorityId)
    || !HASH.test(candidate.authorityDigest) || !['indexeddb', 'localstorage'].includes(candidate.sourceType)
    || !SAFE_ID.test(candidate.sourceInstanceId) || !HASH.test(candidate.sourceIdentityDigest)
    || !HASH.test(candidate.namespaceKey) || !['authenticated', 'local_only'].includes(candidate.ownershipMode)) {
    fail('LEGACY_SOURCE_AUTHORITY_REQUIRED', 'resolve_legacy_source_authority');
  }
  const tx = runtime.db.transaction(LOCAL_DATABASE_STORES.migrationState, 'readonly');
  const done = transactionCompletion(tx, 'resolve_legacy_source_authority');
  const record = await validateLegacyNotesSourceAuthorityInStore(
    runtime, tx.objectStore(LOCAL_DATABASE_STORES.migrationState), candidate,
  );
  await done; return record;
}

export async function validateLegacyNotesSourceAuthorityInStore(
  runtime: LegacyNotesAuthorityRuntime, store: IDBObjectStore, candidate: LegacyNotesAuthorityReference,
): Promise<LegacyNotesSourceAuthorityRecordV1> {
  if (!candidate || candidate.authorityVersion !== 1 || !SAFE_ID.test(candidate.authorityId)
    || !HASH.test(candidate.authorityDigest) || !['indexeddb', 'localstorage'].includes(candidate.sourceType)
    || !SAFE_ID.test(candidate.sourceInstanceId) || !HASH.test(candidate.sourceIdentityDigest)
    || !HASH.test(candidate.namespaceKey) || !['authenticated', 'local_only'].includes(candidate.ownershipMode)) {
    fail('LEGACY_SOURCE_AUTHORITY_REQUIRED', 'resolve_legacy_source_authority');
  }
  const raw = await requestResult(store.get(authorityKey(candidate.sourceIdentityDigest)));
  const all = await readAllAuthorities(store);
  if (raw === undefined) fail('LEGACY_SOURCE_AUTHORITY_REQUIRED', 'resolve_legacy_source_authority');
  const record = validateLegacyNotesSourceAuthorityRecord(raw);
  if (all.filter(item => item.authorityId === record.authorityId).length !== 1) {
    fail('CORRUPT_PERSISTED_RECORD', 'resolve_legacy_source_authority');
  }
  if (record.revokedAt !== null) fail('LEGACY_SOURCE_AUTHORITY_REVOKED', 'resolve_legacy_source_authority');
  if (!matchesRuntime(record, runtime)) fail('LEGACY_SOURCE_AUTHORITY_CONFLICT', 'resolve_legacy_source_authority');
  const expected = reference(record);
  const actual: LegacyNotesAuthorityReference = {
    authorityId: candidate.authorityId, authorityVersion: candidate.authorityVersion,
    authorityDigest: candidate.authorityDigest, sourceType: candidate.sourceType,
    sourceInstanceId: candidate.sourceInstanceId, sourceIdentityDigest: candidate.sourceIdentityDigest,
    namespaceKey: candidate.namespaceKey, ownershipMode: candidate.ownershipMode,
  };
  if (JSON.stringify(expected) !== JSON.stringify(actual)) {
    fail(record.sourceIdentityDigest !== candidate.sourceIdentityDigest
      ? 'LEGACY_SOURCE_IDENTITY_MISMATCH' : 'LEGACY_SOURCE_AUTHORITY_CONFLICT', 'resolve_legacy_source_authority');
  }
  return record;
}

export function legacyNotesAuthorityReference(
  record: LegacyNotesSourceAuthorityRecordV1,
): LegacyNotesAuthorityReference {
  validateLegacyNotesSourceAuthorityRecord(record); return Object.freeze(reference(record));
}
