import { LocalDatabaseError, localDatabaseError } from './errors';
import { sha256Hex } from './outboxIdentity';
import { LOCAL_DATABASE_STORES } from './schema';
import type { LocalDatabaseNamespace } from './types';
import { validTimestamp } from './validation';

export const LEGACY_NOTES_AUTHORITY_VERSION = 1 as const;
export const LEGACY_NOTES_ROOT_BINDING_VERSION = 1 as const;
export const LEGACY_NOTES_AUTHORITY_NAMESPACE = 'k325:legacy-source-authority:v1';
const AUTHORITY_KEY_PREFIX = 'authority:';
const ROOT_BINDING_KEY_PREFIX = 'root:';
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const HASH = /^[a-f0-9]{64}$/;
const MAX_GLOBAL_RECORDS = 2_048;

export type LegacyNotesSourceType = 'indexeddb' | 'localstorage';
export type LegacyNotesAuthorityStatus = 'valid' | 'revoked' | 'missing' | 'corrupt' | 'mismatched';

export interface LegacyNotesSourceRootBindingRecordV1 {
  kind: 'legacy_notes_source_root_binding_v1';
  version: 1;
  namespaceKey: typeof LEGACY_NOTES_AUTHORITY_NAMESPACE;
  migrationId: string;
  externalRootDigest: string;
  authorityId: string;
  sourceType: LegacyNotesSourceType;
  sourceInstanceId: string;
  sourceBindingDigest: string;
  boundNamespaceKey: string;
  userId: string;
  projectRef: string;
  deviceId: string;
  schemaVersion: number;
  ownershipMode: 'authenticated' | 'local_only';
  createdAt: string;
  rootBindingDigest: string;
}

export interface LegacyNotesSourceAuthorityRecordV1 {
  kind: 'legacy_notes_source_authority_v1';
  version: 1;
  namespaceKey: typeof LEGACY_NOTES_AUTHORITY_NAMESPACE;
  migrationId: string;
  authorityId: string;
  sourceType: LegacyNotesSourceType;
  sourceInstanceId: string;
  externalRootDigest: string;
  sourceIdentityDigest: string;
  sourceBindingDigest: string;
  rootBindingVersion: 1;
  rootBindingDigest: string;
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
  externalRootDigest: string;
  sourceIdentityDigest: string;
  sourceBindingDigest: string;
  rootBindingVersion: 1;
  rootBindingDigest: string;
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
function globalRange(): IDBKeyRange {
  return IDBKeyRange.bound([LEGACY_NOTES_AUTHORITY_NAMESPACE, ''], [LEGACY_NOTES_AUTHORITY_NAMESPACE, '\uffff']);
}
function authorityKey(authorityId: string): [string, string] {
  return [LEGACY_NOTES_AUTHORITY_NAMESPACE, `${AUTHORITY_KEY_PREFIX}${authorityId}`];
}
function rootBindingKey(externalRootDigest: string): [string, string] {
  return [LEGACY_NOTES_AUTHORITY_NAMESPACE, `${ROOT_BINDING_KEY_PREFIX}${externalRootDigest}`];
}
function timestamp(value: string | undefined, operation: string): string {
  const result = value ?? new Date().toISOString();
  if (!validTimestamp(result)) fail('INVALID_LEGACY_MIGRATION', operation);
  return result;
}
function validateId(value: unknown, operation: string): asserts value is string {
  if (typeof value !== 'string' || !SAFE_ID.test(value)) fail('INVALID_LEGACY_MIGRATION', operation);
}
function externalRootDigest(sourceIdentityId: string): string {
  validateId(sourceIdentityId, 'legacy_source_identity');
  return sha256Hex(JSON.stringify(['legacy_notes_external_source_root_v1', sourceIdentityId]));
}
function sourceBindingDigest(rootDigest: string, sourceType: LegacyNotesSourceType, sourceInstanceId: string): string {
  return sha256Hex(JSON.stringify(['legacy_notes_source_binding_v1', rootDigest, sourceType, sourceInstanceId]));
}
function rootBindingCore(record: LegacyNotesSourceRootBindingRecordV1): unknown[] {
  return [
    'legacy_notes_source_root_binding_v1', record.externalRootDigest, record.authorityId, record.sourceType,
    record.sourceInstanceId, record.sourceBindingDigest, record.boundNamespaceKey, record.userId,
    record.projectRef, record.deviceId, record.schemaVersion, record.ownershipMode, record.createdAt,
  ];
}
function digestRootBinding(record: LegacyNotesSourceRootBindingRecordV1): string {
  return sha256Hex(JSON.stringify(rootBindingCore(record)));
}
function authorityCore(record: LegacyNotesSourceAuthorityRecordV1): unknown[] {
  return [
    'absinthe-legacy-source-authority-v1', record.authorityId, record.sourceType, record.sourceInstanceId,
    record.externalRootDigest, record.sourceIdentityDigest, record.sourceBindingDigest,
    record.rootBindingVersion, record.rootBindingDigest, record.boundNamespaceKey, record.userId,
    record.projectRef, record.deviceId, record.schemaVersion, record.ownershipMode, record.authorityMethod,
    record.createdAt, record.revokedAt,
  ];
}
function digestAuthority(record: LegacyNotesSourceAuthorityRecordV1): string {
  return sha256Hex(JSON.stringify(authorityCore(record)));
}

export function validateLegacyNotesSourceRootBindingRecord(value: unknown): LegacyNotesSourceRootBindingRecordV1 {
  const record = value as LegacyNotesSourceRootBindingRecordV1;
  const keys = [
    'kind', 'version', 'namespaceKey', 'migrationId', 'externalRootDigest', 'authorityId', 'sourceType',
    'sourceInstanceId', 'sourceBindingDigest', 'boundNamespaceKey', 'userId', 'projectRef', 'deviceId',
    'schemaVersion', 'ownershipMode', 'createdAt', 'rootBindingDigest',
  ];
  if (!record || typeof record !== 'object' || !exactKeys(record, keys)
    || record.kind !== 'legacy_notes_source_root_binding_v1' || record.version !== 1
    || record.namespaceKey !== LEGACY_NOTES_AUTHORITY_NAMESPACE || !HASH.test(record.externalRootDigest)
    || record.migrationId !== `${ROOT_BINDING_KEY_PREFIX}${record.externalRootDigest}`
    || !SAFE_ID.test(record.authorityId) || !['indexeddb', 'localstorage'].includes(record.sourceType)
    || !SAFE_ID.test(record.sourceInstanceId) || !HASH.test(record.sourceBindingDigest)
    || !HASH.test(record.boundNamespaceKey) || !SAFE_ID.test(record.userId) || !SAFE_ID.test(record.projectRef)
    || !SAFE_ID.test(record.deviceId) || !Number.isSafeInteger(record.schemaVersion) || record.schemaVersion < 1
    || !['authenticated', 'local_only'].includes(record.ownershipMode) || !validTimestamp(record.createdAt)
    || !HASH.test(record.rootBindingDigest) || digestRootBinding(record) !== record.rootBindingDigest) {
    fail('CORRUPT_PERSISTED_RECORD', 'validate_legacy_source_root_binding');
  }
  return record;
}

export function validateLegacyNotesSourceAuthorityRecord(value: unknown): LegacyNotesSourceAuthorityRecordV1 {
  const record = value as LegacyNotesSourceAuthorityRecordV1;
  const keys = [
    'kind', 'version', 'namespaceKey', 'migrationId', 'authorityId', 'sourceType', 'sourceInstanceId',
    'externalRootDigest', 'sourceIdentityDigest', 'sourceBindingDigest', 'rootBindingVersion', 'rootBindingDigest',
    'boundNamespaceKey', 'userId', 'projectRef', 'deviceId', 'schemaVersion', 'ownershipMode',
    'authorityMethod', 'createdAt', 'revokedAt', 'authorityDigest',
  ];
  if (!record || typeof record !== 'object' || !exactKeys(record, keys)
    || record.kind !== 'legacy_notes_source_authority_v1' || record.version !== 1
    || record.namespaceKey !== LEGACY_NOTES_AUTHORITY_NAMESPACE || !SAFE_ID.test(record.authorityId)
    || record.migrationId !== `${AUTHORITY_KEY_PREFIX}${record.authorityId}`
    || !['indexeddb', 'localstorage'].includes(record.sourceType) || !SAFE_ID.test(record.sourceInstanceId)
    || !HASH.test(record.externalRootDigest) || !HASH.test(record.sourceIdentityDigest)
    || !HASH.test(record.sourceBindingDigest) || record.sourceIdentityDigest !== record.sourceBindingDigest
    || record.rootBindingVersion !== 1 || !HASH.test(record.rootBindingDigest)
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

function matchesRuntime(record: Pick<LegacyNotesSourceAuthorityRecordV1, 'boundNamespaceKey' | 'userId' | 'projectRef' | 'deviceId' | 'schemaVersion'>, runtime: LegacyNotesAuthorityRuntime): boolean {
  return record.boundNamespaceKey === runtime.namespaceKey && record.userId === runtime.namespace.userId
    && record.projectRef === runtime.namespace.projectRef && record.deviceId === runtime.namespace.deviceId
    && record.schemaVersion === runtime.namespace.schemaVersion;
}
function sameCanonicalBinding(left: LegacyNotesSourceAuthorityRecordV1, right: LegacyNotesSourceAuthorityRecordV1): boolean {
  return left.authorityId === right.authorityId && left.sourceType === right.sourceType
    && left.sourceInstanceId === right.sourceInstanceId && left.externalRootDigest === right.externalRootDigest
    && left.sourceBindingDigest === right.sourceBindingDigest && left.rootBindingVersion === right.rootBindingVersion
    && left.boundNamespaceKey === right.boundNamespaceKey
    && left.userId === right.userId && left.projectRef === right.projectRef && left.deviceId === right.deviceId
    && left.schemaVersion === right.schemaVersion && left.ownershipMode === right.ownershipMode
    && left.authorityMethod === right.authorityMethod;
}
function rootMatchesAuthority(root: LegacyNotesSourceRootBindingRecordV1, authority: LegacyNotesSourceAuthorityRecordV1): boolean {
  return root.externalRootDigest === authority.externalRootDigest && root.authorityId === authority.authorityId
    && root.sourceType === authority.sourceType && root.sourceInstanceId === authority.sourceInstanceId
    && root.sourceBindingDigest === authority.sourceBindingDigest && root.rootBindingDigest === authority.rootBindingDigest
    && root.boundNamespaceKey === authority.boundNamespaceKey && root.userId === authority.userId
    && root.projectRef === authority.projectRef && root.deviceId === authority.deviceId
    && root.schemaVersion === authority.schemaVersion && root.ownershipMode === authority.ownershipMode
    && root.createdAt === authority.createdAt;
}
function reference(record: LegacyNotesSourceAuthorityRecordV1): LegacyNotesAuthorityReference {
  return {
    authorityId: record.authorityId, authorityVersion: 1, authorityDigest: record.authorityDigest,
    sourceType: record.sourceType, sourceInstanceId: record.sourceInstanceId,
    externalRootDigest: record.externalRootDigest, sourceIdentityDigest: record.sourceIdentityDigest,
    sourceBindingDigest: record.sourceBindingDigest, rootBindingVersion: 1,
    rootBindingDigest: record.rootBindingDigest, namespaceKey: record.boundNamespaceKey,
    ownershipMode: record.ownershipMode,
  };
}

async function readGlobalRecords(store: IDBObjectStore): Promise<{
  authorities: LegacyNotesSourceAuthorityRecordV1[]; roots: LegacyNotesSourceRootBindingRecordV1[];
}> {
  const values = await requestResult(store.getAll(globalRange())) as unknown[];
  if (values.length > MAX_GLOBAL_RECORDS) fail('CORRUPT_PERSISTED_RECORD', 'read_legacy_source_authorities');
  const authorities: LegacyNotesSourceAuthorityRecordV1[] = [];
  const roots: LegacyNotesSourceRootBindingRecordV1[] = [];
  for (const value of values) {
    const kind = (value as { kind?: unknown })?.kind;
    if (kind === 'legacy_notes_source_authority_v1') authorities.push(validateLegacyNotesSourceAuthorityRecord(value));
    else if (kind === 'legacy_notes_source_root_binding_v1') roots.push(validateLegacyNotesSourceRootBindingRecord(value));
    else fail('CORRUPT_PERSISTED_RECORD', 'read_legacy_source_authorities');
  }
  return { authorities, roots };
}

function validateGlobalPairs(records: {
  authorities: LegacyNotesSourceAuthorityRecordV1[]; roots: LegacyNotesSourceRootBindingRecordV1[];
}): void {
  if (new Set(records.authorities.map(item => item.authorityId)).size !== records.authorities.length
    || new Set(records.roots.map(item => item.externalRootDigest)).size !== records.roots.length) {
    fail('CORRUPT_PERSISTED_RECORD', 'validate_legacy_source_root_pairs');
  }
  for (const root of records.roots) {
    const authority = records.authorities.find(item => item.authorityId === root.authorityId);
    if (!authority || !rootMatchesAuthority(root, authority)) {
      fail('CORRUPT_PERSISTED_RECORD', 'validate_legacy_source_root_pairs');
    }
  }
  for (const authority of records.authorities) {
    const root = records.roots.find(item => item.externalRootDigest === authority.externalRootDigest);
    if (!root || !rootMatchesAuthority(root, authority)) {
      fail('CORRUPT_PERSISTED_RECORD', 'validate_legacy_source_root_pairs');
    }
  }
}

export async function registerLegacyNotesSourceAuthority(
  runtime: LegacyNotesAuthorityRuntime, input: RegisterLegacyNotesSourceAuthorityInput,
): Promise<LegacyNotesSourceAuthorityRecordV1> {
  runtime.assertOpen('register_legacy_source_authority');
  validateId(input.authorityId, 'legacy_authority_id'); validateId(input.sourceInstanceId, 'legacy_source_instance');
  if (!['indexeddb', 'localstorage'].includes(input.sourceType)
    || !['authenticated', 'local_only'].includes(input.ownershipMode)) {
    fail('INVALID_LEGACY_MIGRATION', 'register_legacy_source_authority');
  }
  const rootDigest = externalRootDigest(input.sourceIdentityId);
  const bindingDigest = sourceBindingDigest(rootDigest, input.sourceType, input.sourceInstanceId);
  const createdAt = timestamp(input.now ?? runtime.clock(), 'register_legacy_source_authority');
  const root: LegacyNotesSourceRootBindingRecordV1 = {
    kind: 'legacy_notes_source_root_binding_v1', version: 1, namespaceKey: LEGACY_NOTES_AUTHORITY_NAMESPACE,
    migrationId: `${ROOT_BINDING_KEY_PREFIX}${rootDigest}`, externalRootDigest: rootDigest,
    authorityId: input.authorityId, sourceType: input.sourceType, sourceInstanceId: input.sourceInstanceId,
    sourceBindingDigest: bindingDigest, boundNamespaceKey: runtime.namespaceKey,
    userId: runtime.namespace.userId, projectRef: runtime.namespace.projectRef, deviceId: runtime.namespace.deviceId,
    schemaVersion: runtime.namespace.schemaVersion, ownershipMode: input.ownershipMode, createdAt, rootBindingDigest: '',
  };
  root.rootBindingDigest = digestRootBinding(root);
  const authority: LegacyNotesSourceAuthorityRecordV1 = {
    kind: 'legacy_notes_source_authority_v1', version: 1, namespaceKey: LEGACY_NOTES_AUTHORITY_NAMESPACE,
    migrationId: `${AUTHORITY_KEY_PREFIX}${input.authorityId}`, authorityId: input.authorityId,
    sourceType: input.sourceType, sourceInstanceId: input.sourceInstanceId, externalRootDigest: rootDigest,
    sourceIdentityDigest: bindingDigest, sourceBindingDigest: bindingDigest,
    rootBindingVersion: 1, rootBindingDigest: root.rootBindingDigest,
    boundNamespaceKey: runtime.namespaceKey, userId: runtime.namespace.userId, projectRef: runtime.namespace.projectRef,
    deviceId: runtime.namespace.deviceId, schemaVersion: runtime.namespace.schemaVersion,
    ownershipMode: input.ownershipMode, authorityMethod: 'explicit_operator_binding', createdAt, revokedAt: null,
    authorityDigest: '',
  };
  authority.authorityDigest = digestAuthority(authority);
  validateLegacyNotesSourceRootBindingRecord(root); validateLegacyNotesSourceAuthorityRecord(authority);
  const tx = runtime.db.transaction(LOCAL_DATABASE_STORES.migrationState, 'readwrite');
  const done = transactionCompletion(tx, 'register_legacy_source_authority');
  try {
    const store = tx.objectStore(LOCAL_DATABASE_STORES.migrationState);
    const all = await readGlobalRecords(store);
    validateGlobalPairs(all);
    const existingRoot = all.roots.find(item => item.externalRootDigest === rootDigest);
    const existingAuthority = all.authorities.find(item => item.authorityId === input.authorityId);
    if (existingRoot) {
      const canonical = all.authorities.find(item => item.authorityId === existingRoot.authorityId);
      if (!canonical || !rootMatchesAuthority(existingRoot, canonical)) fail('CORRUPT_PERSISTED_RECORD', 'register_legacy_source_authority');
      if (canonical.revokedAt !== null) fail('LEGACY_SOURCE_AUTHORITY_REVOKED', 'register_legacy_source_authority');
      if (canonical.authorityId !== input.authorityId || !sameCanonicalBinding(canonical, authority)) {
        fail('LEGACY_SOURCE_AUTHORITY_CONFLICT', 'register_legacy_source_authority');
      }
      await done; return canonical;
    }
    if (existingAuthority) {
      fail('LEGACY_SOURCE_AUTHORITY_CONFLICT', 'register_legacy_source_authority');
    }
    store.add(root); store.add(authority); await done; return authority;
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
  const store = tx.objectStore(LOCAL_DATABASE_STORES.migrationState);
  const raw = await requestResult(store.get(authorityKey(authorityId)));
  if (raw === undefined) { await done; return null; }
  const record = validateLegacyNotesSourceAuthorityRecord(raw);
  await validateLegacyNotesSourceAuthorityInStore(runtime, store, reference(record), true);
  await done; return record;
}

export async function revokeLegacyNotesSourceAuthority(
  runtime: LegacyNotesAuthorityRuntime, authorityId: string, at?: string,
): Promise<LegacyNotesSourceAuthorityRecordV1> {
  runtime.assertOpen('revoke_legacy_source_authority'); validateId(authorityId, 'legacy_authority_id');
  const revokedAt = timestamp(at ?? runtime.clock(), 'revoke_legacy_source_authority');
  const tx = runtime.db.transaction(LOCAL_DATABASE_STORES.migrationState, 'readwrite');
  const done = transactionCompletion(tx, 'revoke_legacy_source_authority');
  try {
    const store = tx.objectStore(LOCAL_DATABASE_STORES.migrationState);
    const raw = await requestResult(store.get(authorityKey(authorityId)));
    if (raw === undefined) fail('LEGACY_SOURCE_AUTHORITY_REQUIRED', 'revoke_legacy_source_authority');
    const current = validateLegacyNotesSourceAuthorityRecord(raw);
    await validateLegacyNotesSourceAuthorityInStore(runtime, store, reference(current), true);
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
  const tx = runtime.db.transaction(LOCAL_DATABASE_STORES.migrationState, 'readonly');
  const done = transactionCompletion(tx, 'resolve_legacy_source_authority');
  const record = await validateLegacyNotesSourceAuthorityInStore(
    runtime, tx.objectStore(LOCAL_DATABASE_STORES.migrationState), candidate,
  );
  await done; return record;
}

function validateReference(candidate: LegacyNotesAuthorityReference): void {
  if (!candidate || candidate.authorityVersion !== 1 || !SAFE_ID.test(candidate.authorityId)
    || !HASH.test(candidate.authorityDigest) || !['indexeddb', 'localstorage'].includes(candidate.sourceType)
    || !SAFE_ID.test(candidate.sourceInstanceId) || !HASH.test(candidate.externalRootDigest)
    || !HASH.test(candidate.sourceIdentityDigest) || !HASH.test(candidate.sourceBindingDigest)
    || candidate.sourceIdentityDigest !== candidate.sourceBindingDigest || candidate.rootBindingVersion !== 1
    || !HASH.test(candidate.rootBindingDigest) || !HASH.test(candidate.namespaceKey)
    || !['authenticated', 'local_only'].includes(candidate.ownershipMode)) {
    fail('LEGACY_SOURCE_AUTHORITY_REQUIRED', 'resolve_legacy_source_authority');
  }
}

export async function validateLegacyNotesSourceAuthorityInStore(
  runtime: LegacyNotesAuthorityRuntime, store: IDBObjectStore, candidate: LegacyNotesAuthorityReference,
  allowRevoked = false,
): Promise<LegacyNotesSourceAuthorityRecordV1> {
  validateReference(candidate);
  const [rawAuthority, rawRoot, all] = await Promise.all([
    requestResult(store.get(authorityKey(candidate.authorityId))),
    requestResult(store.get(rootBindingKey(candidate.externalRootDigest))),
    readGlobalRecords(store),
  ]);
  if (rawAuthority === undefined && rawRoot === undefined) fail('LEGACY_SOURCE_AUTHORITY_REQUIRED', 'resolve_legacy_source_authority');
  if (rawAuthority === undefined || rawRoot === undefined) fail('CORRUPT_PERSISTED_RECORD', 'resolve_legacy_source_authority');
  const record = validateLegacyNotesSourceAuthorityRecord(rawAuthority);
  const root = validateLegacyNotesSourceRootBindingRecord(rawRoot);
  if (all.authorities.filter(item => item.authorityId === record.authorityId).length !== 1
    || all.roots.filter(item => item.externalRootDigest === root.externalRootDigest).length !== 1
    || !rootMatchesAuthority(root, record)) fail('CORRUPT_PERSISTED_RECORD', 'resolve_legacy_source_authority');
  if (record.revokedAt !== null && !allowRevoked) fail('LEGACY_SOURCE_AUTHORITY_REVOKED', 'resolve_legacy_source_authority');
  if (!matchesRuntime(record, runtime)) fail('LEGACY_SOURCE_AUTHORITY_CONFLICT', 'resolve_legacy_source_authority');
  const expected = reference(record);
  const actual: LegacyNotesAuthorityReference = {
    authorityId: candidate.authorityId, authorityVersion: candidate.authorityVersion,
    authorityDigest: candidate.authorityDigest, sourceType: candidate.sourceType,
    sourceInstanceId: candidate.sourceInstanceId, externalRootDigest: candidate.externalRootDigest,
    sourceIdentityDigest: candidate.sourceIdentityDigest, sourceBindingDigest: candidate.sourceBindingDigest,
    rootBindingVersion: candidate.rootBindingVersion, rootBindingDigest: candidate.rootBindingDigest,
    namespaceKey: candidate.namespaceKey, ownershipMode: candidate.ownershipMode,
  };
  const currentMatches = JSON.stringify(expected) === JSON.stringify(actual);
  let capturedBeforeRevocationMatches = false;
  if (!currentMatches && allowRevoked && record.revokedAt !== null) {
    const beforeRevocation = { ...record, revokedAt: null } as LegacyNotesSourceAuthorityRecordV1;
    beforeRevocation.authorityDigest = digestAuthority(beforeRevocation);
    capturedBeforeRevocationMatches = JSON.stringify(reference(beforeRevocation)) === JSON.stringify(actual);
  }
  if (!currentMatches && !capturedBeforeRevocationMatches) {
    fail(record.externalRootDigest !== candidate.externalRootDigest
      || record.sourceBindingDigest !== candidate.sourceBindingDigest
      ? 'LEGACY_SOURCE_IDENTITY_MISMATCH' : 'LEGACY_SOURCE_AUTHORITY_CONFLICT', 'resolve_legacy_source_authority');
  }
  return record;
}

export async function inspectLegacyNotesSourceAuthorityInStore(
  runtime: LegacyNotesAuthorityRuntime, store: IDBObjectStore, candidate: LegacyNotesAuthorityReference,
): Promise<LegacyNotesAuthorityStatus> {
  try {
    validateReference(candidate);
    const [rawAuthority, rawRoot] = await Promise.all([
      requestResult(store.get(authorityKey(candidate.authorityId))),
      requestResult(store.get(rootBindingKey(candidate.externalRootDigest))),
    ]);
    if (rawAuthority === undefined) return 'missing';
    if (rawRoot === undefined) return 'corrupt';
    const record = await validateLegacyNotesSourceAuthorityInStore(runtime, store, candidate, true);
    return record.revokedAt === null ? 'valid' : 'revoked';
  } catch (error) {
    if (!(error instanceof LocalDatabaseError)) return 'corrupt';
    if (error.code === 'LEGACY_SOURCE_AUTHORITY_REQUIRED') return 'missing';
    if (error.code === 'LEGACY_SOURCE_AUTHORITY_CONFLICT' || error.code === 'LEGACY_SOURCE_IDENTITY_MISMATCH') return 'mismatched';
    return 'corrupt';
  }
}

export function legacyNotesAuthorityReference(record: LegacyNotesSourceAuthorityRecordV1): LegacyNotesAuthorityReference {
  validateLegacyNotesSourceAuthorityRecord(record); return Object.freeze(reference(record));
}
