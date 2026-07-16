import { bytesEqual } from './canonical';
import { observe } from './observability';
import {
  decodeAuthorityBytes,
  decodeCandidateBytes,
  encodeAuthority,
  encodeCandidate,
  assertHandoffWriteBudget,
  validateEvidenceGraph,
} from './records';
import {
  CrossContextHandoffError,
  type HandoffObserver,
  type PersistedHandoffAuthorityV1,
  type PersistedSnapshotCandidateV1,
  type ValidatedHandoffEvidence,
} from './types';

export const HANDOFF_DATABASE_NAME = 'absinthe-cross-context-handoff-v1';
export const HANDOFF_DATABASE_VERSION = 1;
export const HANDOFF_AUTHORITY_STORE = 'handoff_authority';
export const HANDOFF_CANDIDATE_STORE = 'handoff_candidates';

export interface HandoffDatabaseOptions {
  indexedDB?: IDBFactory;
  databaseName?: string;
  observer?: HandoffObserver;
}

function factory(options?: HandoffDatabaseOptions): IDBFactory {
  const value = options?.indexedDB ?? globalThis.indexedDB;
  if (!value) throw new CrossContextHandoffError('DATABASE_OPEN_FAILED', 'indexeddb_unavailable');
  return value;
}

export function openHandoffDatabase(options: HandoffDatabaseOptions = {}): Promise<IDBDatabase> {
  observe(options.observer, 'database_open');
  return new Promise((resolve, reject) => {
    let settled = false;
    let upgraded = false;
    let request: IDBOpenDBRequest;
    try {
      request = factory(options).open(options.databaseName ?? HANDOFF_DATABASE_NAME, HANDOFF_DATABASE_VERSION);
    } catch {
      reject(new CrossContextHandoffError('DATABASE_OPEN_FAILED', 'open_handoff_database'));
      return;
    }
    request.onupgradeneeded = event => {
      upgraded = true;
      const db = request.result;
      const oldVersion = (event as IDBVersionChangeEvent).oldVersion;
      if (oldVersion !== 0) {
        request.transaction?.abort();
        return;
      }
      db.createObjectStore(HANDOFF_AUTHORITY_STORE);
      db.createObjectStore(HANDOFF_CANDIDATE_STORE);
    };
    request.onblocked = () => {
      if (settled) return;
      settled = true;
      reject(new CrossContextHandoffError('DATABASE_OPEN_BLOCKED', 'open_handoff_database'));
    };
    request.onerror = () => {
      if (settled) return;
      settled = true;
      reject(new CrossContextHandoffError(
        upgraded ? 'DATABASE_UPGRADE_FAILED' : 'DATABASE_OPEN_FAILED',
        'open_handoff_database',
      ));
    };
    request.onsuccess = () => {
      const db = request.result;
      if (settled) {
        db.close();
        return;
      }
      if (!db.objectStoreNames.contains(HANDOFF_AUTHORITY_STORE)
        || !db.objectStoreNames.contains(HANDOFF_CANDIDATE_STORE)) {
        settled = true;
        db.close();
        reject(new CrossContextHandoffError('DATABASE_UPGRADE_FAILED', 'validate_handoff_schema'));
        return;
      }
      settled = true;
      db.onversionchange = () => db.close();
      resolve(db);
    };
  });
}

function requestResult<T>(request: IDBRequest<T>, operation: string): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new CrossContextHandoffError('TRANSACTION_FAILED', operation));
  });
}

function transactionCompletion(transaction: IDBTransaction, operation: string): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(new CrossContextHandoffError('TRANSACTION_ABORTED', operation));
    transaction.onerror = () => undefined;
  });
}

function abort(transaction: IDBTransaction): void {
  try { transaction.abort(); } catch { /* already inactive */ }
}

export type TransactionFailurePoint = 'none' | 'after_candidate_request' | 'after_both_requests';

export interface PersistEvidenceInput {
  db: IDBDatabase;
  authority: PersistedHandoffAuthorityV1;
  candidate: PersistedSnapshotCandidateV1;
  expectedAuthorityBytes: Uint8Array | null;
  observer?: HandoffObserver;
  failurePointForTest?: TransactionFailurePoint;
}

export async function readHandoffAuthority(
  db: IDBDatabase,
  physicalSourceDigest: string,
  observer?: HandoffObserver,
): Promise<{ authority: PersistedHandoffAuthorityV1; bytes: Uint8Array } | null> {
  const transaction = db.transaction(HANDOFF_AUTHORITY_STORE, 'readonly');
  const done = transactionCompletion(transaction, 'read_handoff_authority');
  observe(observer, 'persistence_read');
  const raw = await requestResult(
    transaction.objectStore(HANDOFF_AUTHORITY_STORE).get(physicalSourceDigest),
    'read_authority',
  ) as Uint8Array | undefined;
  await done;
  if (raw === undefined) return null;
  const authority = await decodeAuthorityBytes(raw);
  if (authority.physicalSourceDigest !== physicalSourceDigest) {
    throw new CrossContextHandoffError('PERSISTED_EVIDENCE_MISMATCH', 'authority_store_key');
  }
  return Object.freeze({ authority, bytes: new Uint8Array(raw) });
}

export async function persistAuthorityCas(input: {
  db: IDBDatabase;
  authority: PersistedHandoffAuthorityV1;
  expectedAuthorityBytes: Uint8Array | null;
  observer?: HandoffObserver;
}): Promise<void> {
  const authority = await decodeAuthorityBytes(encodeAuthority(input.authority));
  const authorityBytes = encodeAuthority(authority);
  assertHandoffWriteBudget(authorityBytes.byteLength, 0);
  observe(input.observer, 'transaction_start');
  const transaction = input.db.transaction(HANDOFF_AUTHORITY_STORE, 'readwrite', { durability: 'strict' });
  const done = transactionCompletion(transaction, 'persist_authority_cas');
  try {
    const store = transaction.objectStore(HANDOFF_AUTHORITY_STORE);
    observe(input.observer, 'persistence_read');
    const existing = await requestResult(
      store.get(authority.physicalSourceDigest),
      'read_authority_cas',
    ) as Uint8Array | undefined;
    if (input.expectedAuthorityBytes === null) {
      if (existing !== undefined) {
        throw new CrossContextHandoffError('AUTHORITY_CAS_CONFLICT', 'authority_expected_absent');
      }
      await requestResult(store.add(authorityBytes, authority.physicalSourceDigest), 'authority_add');
    } else {
      if (existing === undefined || !bytesEqual(existing, input.expectedAuthorityBytes)) {
        throw new CrossContextHandoffError('AUTHORITY_CAS_CONFLICT', 'authority_compare_and_set');
      }
      await requestResult(store.put(authorityBytes, authority.physicalSourceDigest), 'authority_put');
    }
    await done;
    observe(input.observer, 'authority_committed_write');
  } catch (error) {
    abort(transaction);
    observe(input.observer, 'transaction_abort');
    await done.catch(() => undefined);
    if (error instanceof CrossContextHandoffError) throw error;
    throw new CrossContextHandoffError('TRANSACTION_FAILED', 'persist_authority_cas');
  }
}

async function persistEvidenceAtCandidateStoreKey(
  input: PersistEvidenceInput,
  candidateStoreKey: string,
  collisionTestBoundary: boolean,
): Promise<'created' | 'existing_identical'> {
  await validateEvidenceGraph(input.authority, input.candidate);
  const authorityBytes = encodeAuthority(input.authority);
  const candidateBytes = encodeCandidate(input.candidate);
  assertHandoffWriteBudget(authorityBytes.byteLength, candidateBytes.byteLength);
  if (!collisionTestBoundary && candidateStoreKey !== input.candidate.candidateId) {
    throw new CrossContextHandoffError('PERSISTED_EVIDENCE_MISMATCH', 'candidate_store_key');
  }
  observe(input.observer, 'transaction_start');
  const transaction = input.db.transaction(
    [HANDOFF_AUTHORITY_STORE, HANDOFF_CANDIDATE_STORE],
    'readwrite',
    { durability: 'strict' },
  );
  const done = transactionCompletion(transaction, 'persist_handoff_evidence');
  try {
    const authorityStore = transaction.objectStore(HANDOFF_AUTHORITY_STORE);
    const candidateStore = transaction.objectStore(HANDOFF_CANDIDATE_STORE);
    observe(input.observer, 'persistence_read');
    const [existingAuthorityRaw, existingCandidateRaw] = await Promise.all([
      requestResult(authorityStore.get(input.authority.physicalSourceDigest), 'read_authority'),
      requestResult(candidateStore.get(candidateStoreKey), 'read_candidate'),
    ]);
    const existingAuthority = existingAuthorityRaw as Uint8Array | undefined;
    const existingCandidate = existingCandidateRaw as Uint8Array | undefined;

    if (existingCandidate !== undefined) {
      const parsed = await decodeCandidateBytes(existingCandidate);
      if (parsed.candidateId !== candidateStoreKey) {
        throw new CrossContextHandoffError('PERSISTED_EVIDENCE_MISMATCH', 'candidate_key_payload');
      }
      if (!bytesEqual(existingCandidate, candidateBytes)) {
        throw new CrossContextHandoffError('CANDIDATE_KEY_COLLISION', 'candidate_add_boundary');
      }
      if (existingAuthority === undefined || !bytesEqual(existingAuthority, authorityBytes)) {
        throw new CrossContextHandoffError('PERSISTED_EVIDENCE_MISMATCH', 'existing_authority_binding');
      }
      const authority = await decodeAuthorityBytes(existingAuthority);
      await validateEvidenceGraph(authority, parsed);
      await done;
      return 'existing_identical';
    }

    if (input.expectedAuthorityBytes === null) {
      if (existingAuthority !== undefined) {
        throw new CrossContextHandoffError('AUTHORITY_CAS_CONFLICT', 'authority_expected_absent');
      }
    } else if (existingAuthority === undefined || !bytesEqual(existingAuthority, input.expectedAuthorityBytes)) {
      throw new CrossContextHandoffError('AUTHORITY_CAS_CONFLICT', 'authority_compare_and_set');
    }

    observe(input.observer, 'candidate_create_request');
    const candidateRequest = candidateStore.add(candidateBytes, candidateStoreKey);
    if ((input.failurePointForTest ?? 'none') === 'after_candidate_request') {
      throw new CrossContextHandoffError('TRANSACTION_ABORTED', 'injected_after_candidate_request');
    }
    const authorityRequest = existingAuthority === undefined
      ? authorityStore.add(authorityBytes, input.authority.physicalSourceDigest)
      : authorityStore.put(authorityBytes, input.authority.physicalSourceDigest);
    if ((input.failurePointForTest ?? 'none') === 'after_both_requests') {
      throw new CrossContextHandoffError('TRANSACTION_ABORTED', 'injected_after_both_requests');
    }
    await Promise.all([
      requestResult(candidateRequest, 'candidate_add'),
      requestResult(authorityRequest, 'authority_write'),
    ]);
    await done;
    observe(input.observer, 'candidate_committed_write');
    observe(input.observer, 'authority_committed_write');
    return 'created';
  } catch (error) {
    abort(transaction);
    observe(input.observer, 'transaction_abort');
    await done.catch(() => undefined);
    if (error instanceof CrossContextHandoffError) throw error;
    throw new CrossContextHandoffError('TRANSACTION_FAILED', 'persist_handoff_evidence');
  }
}

export function persistEvidenceAtomic(input: PersistEvidenceInput): Promise<'created' | 'existing_identical'> {
  return persistEvidenceAtCandidateStoreKey(input, input.candidate.candidateId, false);
}

/**
 * Test-only storage-boundary collision injection. This is intentionally absent
 * from the directory's public index and never relaxes candidate payload parsing.
 */
export function persistEvidenceAtCandidateStoreKeyForTest(
  input: PersistEvidenceInput,
  candidateStoreKey: string,
): Promise<'created' | 'existing_identical'> {
  return persistEvidenceAtCandidateStoreKey(input, candidateStoreKey, true);
}

export async function readValidatedHandoffEvidence(
  db: IDBDatabase,
  physicalSourceDigest: string,
  observer?: HandoffObserver,
): Promise<ValidatedHandoffEvidence | null> {
  const authorityTransaction = db.transaction(HANDOFF_AUTHORITY_STORE, 'readonly');
  const authorityDone = transactionCompletion(authorityTransaction, 'read_handoff_authority');
  observe(observer, 'persistence_read');
  const authorityRaw = await requestResult(
    authorityTransaction.objectStore(HANDOFF_AUTHORITY_STORE).get(physicalSourceDigest),
    'read_authority',
  ) as Uint8Array | undefined;
  await authorityDone;
  if (authorityRaw === undefined) {
    return null;
  }
  const authority = await decodeAuthorityBytes(authorityRaw);
  if (authority.physicalSourceDigest !== physicalSourceDigest || authority.snapshotCandidateId === null) {
    throw new CrossContextHandoffError('RESTART_VALIDATION_FAILED', 'authority_lookup_binding');
  }
  // Re-read authority with its referenced candidate in one transaction. The
  // first bounded read is needed to learn the immutable candidate key; the
  // second read prevents an authority change between those observations.
  const evidenceTransaction = db.transaction(
    [HANDOFF_AUTHORITY_STORE, HANDOFF_CANDIDATE_STORE],
    'readonly',
  );
  const evidenceDone = transactionCompletion(evidenceTransaction, 'read_handoff_evidence');
  const [currentAuthorityRaw, candidateRaw] = await Promise.all([
    requestResult(
      evidenceTransaction.objectStore(HANDOFF_AUTHORITY_STORE).get(physicalSourceDigest),
      'reread_authority',
    ) as Promise<Uint8Array | undefined>,
    requestResult(
      evidenceTransaction.objectStore(HANDOFF_CANDIDATE_STORE).get(authority.snapshotCandidateId),
      'read_candidate',
    ) as Promise<Uint8Array | undefined>,
  ]);
  await evidenceDone;
  if (currentAuthorityRaw === undefined || !bytesEqual(authorityRaw, currentAuthorityRaw)) {
    throw new CrossContextHandoffError('AUTHORITY_CAS_CONFLICT', 'authority_changed_during_restart');
  }
  if (candidateRaw === undefined) {
    throw new CrossContextHandoffError('RESTART_VALIDATION_FAILED', 'missing_candidate');
  }
  const candidate = await decodeCandidateBytes(candidateRaw);
  if (candidate.candidateId !== authority.snapshotCandidateId) {
    throw new CrossContextHandoffError('PERSISTED_EVIDENCE_MISMATCH', 'candidate_key_payload');
  }
  await validateEvidenceGraph(authority, candidate);
  return Object.freeze({
    authority,
    candidate,
    authorityBytes: new Uint8Array(authorityRaw),
    candidateBytes: new Uint8Array(candidateRaw),
  });
}

export async function inspectHandoffObjectCounts(db: IDBDatabase): Promise<{ authority: number; candidate: number }> {
  const transaction = db.transaction([HANDOFF_AUTHORITY_STORE, HANDOFF_CANDIDATE_STORE], 'readonly');
  const done = transactionCompletion(transaction, 'inspect_handoff_counts');
  const [authority, candidate] = await Promise.all([
    requestResult(transaction.objectStore(HANDOFF_AUTHORITY_STORE).count(), 'count_authority'),
    requestResult(transaction.objectStore(HANDOFF_CANDIDATE_STORE).count(), 'count_candidate'),
  ]);
  await done;
  return Object.freeze({ authority, candidate });
}
