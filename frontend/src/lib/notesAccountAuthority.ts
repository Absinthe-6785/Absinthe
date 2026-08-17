import type { NoteBase, NoteFolderBase } from '@/components/views/noteUtils';

/**
 * Local authority boundary for the Notes core.  This deliberately does not
 * know about authentication providers, remote tables, or backup formats.
 *
 * The legacy browser-global stores remain unassigned.  They are never claimed
 * merely because an account has signed in.
 */
export const NOTES_AUTHORITY_SCHEMA_VERSION = 1;
export const NOTES_CORE_DOMAIN = 'notes.core' as const;
export const NOTES_FOLDERS_DOMAIN = 'notes.folders' as const;

export type NotesAuthorityDomain = typeof NOTES_CORE_DOMAIN | typeof NOTES_FOLDERS_DOMAIN;
export type NotesAuthorityLoadState =
  | 'NOT_LOADED'
  | 'LOADING'
  | 'LOADED_EMPTY'
  | 'LOADED_POPULATED'
  | 'RECOVERY_REQUIRED';

export interface NotesAuthorityDomainState {
  readonly accountId: string;
  readonly domainId: NotesAuthorityDomain;
  readonly schemaVersion: typeof NOTES_AUTHORITY_SCHEMA_VERSION;
  readonly state: NotesAuthorityLoadState;
  readonly recordCount: number;
  readonly verifiedAt: number;
  readonly legacyGlobalDataPresent: boolean;
}

export interface NotesAuthorityRequest {
  readonly accountId: string;
  readonly generation: number;
}

/** Opaque capability binding a recovery operation to its originating account request. */
export interface NotesAccountRecoveryContext {
  readonly marker: symbol;
}

export interface AccountScopedNotesSnapshot {
  readonly accountId: string;
  readonly requestGeneration: number;
  readonly notes: NoteBase[];
  readonly folders: NoteFolderBase[];
  readonly activeNoteId: string | null;
  readonly notesState: NotesAuthorityDomainState;
  readonly foldersState: NotesAuthorityDomainState;
}

export const NOTES_ACCOUNT_AUTHORITY_DATABASE_NAME = 'absinthe.notes.account-authority.v1';
const DATABASE_VERSION = 1;
const NOTES_STORE = 'notes';
const STATE_KEY_PREFIX = 'absinthe.notes.account-authority.state.v1';
const FOLDERS_KEY_PREFIX = 'absinthe.notes.account-authority.folders.v1';
const BOOTSTRAP_PENDING_KEY_PREFIX = 'absinthe.notes.account-authority.bootstrap-pending.v1';
const ACTIVE_KEY_PREFIX = 'absinthe.notes.account-authority.active.v1';
const LEGACY_NOTES_KEY = 'notes-v2';
const LEGACY_FOLDERS_KEY = 'note-folders-v2';

interface StoredScopedNote {
  readonly key: string;
  readonly accountId: string;
  readonly note: NoteBase;
}

interface StoredFolderEnvelope {
  readonly accountId: string;
  readonly domainId: typeof NOTES_FOLDERS_DOMAIN;
  readonly schemaVersion: typeof NOTES_AUTHORITY_SCHEMA_VERSION;
  readonly folders: NoteFolderBase[];
}

interface PendingBootstrapMarker {
  readonly accountId: string;
  readonly schemaVersion: typeof NOTES_AUTHORITY_SCHEMA_VERSION;
  readonly state: 'BOOTSTRAP_PENDING';
  readonly operationId: string;
  readonly requestGeneration: number;
  readonly startedAt: number;
  readonly affectedDomains: readonly [typeof NOTES_CORE_DOMAIN, typeof NOTES_FOLDERS_DOMAIN];
}

type PendingBootstrapMarkerRead =
  | { readonly kind: 'absent' }
  | { readonly kind: 'valid'; readonly marker: PendingBootstrapMarker }
  | { readonly kind: 'malformed' };

interface NotesRecoveryOperation {
  readonly request: NotesAuthorityRequest;
  readonly operationId: string;
}

let activeRequest: NotesAuthorityRequest | null = null;
let nextRequestGeneration = 0;
let nextRecoveryOperation = 0;
type BootstrapApplyStage =
  | 'after-marker'
  | 'after-notes-write'
  | 'after-folders-write'
  | 'before-readback'
  | 'before-marker-clear';
let testBootstrapStageOverride: ((stage: BootstrapApplyStage) => void | Promise<void>) | null = null;
const NOTES_ACCOUNT_RECOVERY_CONTEXT = Symbol('notes-account-recovery-context');
const recoveryContexts = new WeakMap<object, NotesRecoveryOperation>();

type ScopedReadResult<T> =
  | { readonly kind: 'absent' }
  | { readonly kind: 'valid'; readonly records: T[] }
  | { readonly kind: 'malformed' };

function normalizedAccountId(accountId: string): string {
  const value = accountId.trim();
  if (!value) throw new Error('notes_account_scope_required');
  return value;
}

function accountToken(accountId: string): string {
  return encodeURIComponent(normalizedAccountId(accountId));
}

function storageKey(prefix: string, accountId: string, domain?: NotesAuthorityDomain): string {
  return `${prefix}:${accountToken(accountId)}${domain ? `:${domain}` : ''}`;
}

function noteKey(accountId: string, noteId: string): string {
  return `${accountToken(accountId)}\u0000${noteId}`;
}

function canUseIndexedDb(): boolean {
  try { return typeof indexedDB !== 'undefined'; } catch { return false; }
}

function legacyGlobalDataPresent(): boolean {
  try {
    return localStorage.getItem(LEGACY_NOTES_KEY) !== null || localStorage.getItem(LEGACY_FOLDERS_KEY) !== null;
  } catch {
    return false;
  }
}

function validNote(value: unknown): value is NoteBase {
  if (!value || typeof value !== 'object') return false;
  const note = value as Partial<NoteBase>;
  return typeof note.id === 'string' && Boolean(note.id.trim())
    && typeof note.title === 'string'
    && typeof note.body === 'string'
    && typeof note.updatedAt === 'number' && Number.isFinite(note.updatedAt)
    && (note.folderId === null || typeof note.folderId === 'string')
    && (note.deletedAt === null || (typeof note.deletedAt === 'number' && Number.isFinite(note.deletedAt)));
}

function validFolder(value: unknown): value is NoteFolderBase {
  if (!value || typeof value !== 'object') return false;
  const folder = value as Partial<NoteFolderBase>;
  return typeof folder.id === 'string' && Boolean(folder.id.trim())
    && typeof folder.name === 'string'
    && typeof folder.createdAt === 'number' && Number.isFinite(folder.createdAt);
}

function cloneNotes(notes: readonly NoteBase[]): NoteBase[] {
  return notes.map(note => ({
    ...note,
    properties: note.properties ? { ...note.properties } : undefined,
    relations: note.relations
      ? Object.fromEntries(Object.entries(note.relations).map(([key, targets]) => [key, [...targets]]))
      : undefined,
  })).sort((left, right) => right.updatedAt - left.updatedAt);
}

function cloneFolders(folders: readonly NoteFolderBase[]): NoteFolderBase[] {
  return folders.map(folder => ({ ...folder })).sort((left, right) => left.createdAt - right.createdAt);
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('notes_account_authority_request_failed'));
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('notes_account_authority_transaction_failed'));
    transaction.onabort = () => reject(transaction.error ?? new Error('notes_account_authority_transaction_aborted'));
  });
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!canUseIndexedDb()) {
      reject(new Error('notes_account_authority_indexeddb_unavailable'));
      return;
    }
    const request = indexedDB.open(NOTES_ACCOUNT_AUTHORITY_DATABASE_NAME, DATABASE_VERSION);
    request.onerror = () => reject(request.error ?? new Error('notes_account_authority_open_failed'));
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(NOTES_STORE)) {
        const store = database.createObjectStore(NOTES_STORE, { keyPath: 'key' });
        store.createIndex('accountId', 'accountId', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
  });
}

function stateKey(accountId: string, domainId: NotesAuthorityDomain): string {
  return storageKey(STATE_KEY_PREFIX, accountId, domainId);
}

function bootstrapPendingKey(accountId: string): string {
  return storageKey(BOOTSTRAP_PENDING_KEY_PREFIX, accountId);
}

function readState(accountId: string, domainId: NotesAuthorityDomain): NotesAuthorityDomainState | null {
  try {
    const raw = localStorage.getItem(stateKey(accountId, domainId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<NotesAuthorityDomainState>;
    if (parsed.accountId !== normalizedAccountId(accountId)
      || parsed.domainId !== domainId
      || parsed.schemaVersion !== NOTES_AUTHORITY_SCHEMA_VERSION
      || !Number.isFinite(parsed.recordCount)
      || !Number.isFinite(parsed.verifiedAt)
      || !['NOT_LOADED', 'LOADING', 'LOADED_EMPTY', 'LOADED_POPULATED', 'RECOVERY_REQUIRED'].includes(String(parsed.state))) {
      return null;
    }
    return parsed as NotesAuthorityDomainState;
  } catch {
    return null;
  }
}

function writeState(
  accountId: string,
  domainId: NotesAuthorityDomain,
  state: NotesAuthorityLoadState,
  recordCount: number,
): NotesAuthorityDomainState {
  const next: NotesAuthorityDomainState = {
    accountId: normalizedAccountId(accountId),
    domainId,
    schemaVersion: NOTES_AUTHORITY_SCHEMA_VERSION,
    state,
    recordCount,
    verifiedAt: Date.now(),
    legacyGlobalDataPresent: legacyGlobalDataPresent(),
  };
  localStorage.setItem(stateKey(accountId, domainId), JSON.stringify(next));
  return next;
}

function validPendingBootstrapMarker(value: unknown, accountId: string): value is PendingBootstrapMarker {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const marker = value as Partial<PendingBootstrapMarker>;
  return marker.accountId === normalizedAccountId(accountId)
    && marker.schemaVersion === NOTES_AUTHORITY_SCHEMA_VERSION
    && marker.state === 'BOOTSTRAP_PENDING'
    && typeof marker.operationId === 'string' && marker.operationId.length > 0
    && Number.isSafeInteger(marker.requestGeneration) && (marker.requestGeneration as number) > 0
    && typeof marker.startedAt === 'number' && Number.isFinite(marker.startedAt) && (marker.startedAt as number) > 0
    && Array.isArray(marker.affectedDomains)
    && marker.affectedDomains.length === 2
    && marker.affectedDomains[0] === NOTES_CORE_DOMAIN
    && marker.affectedDomains[1] === NOTES_FOLDERS_DOMAIN;
}

function readPendingBootstrapMarker(accountId: string): PendingBootstrapMarkerRead {
  try {
    const raw = localStorage.getItem(bootstrapPendingKey(accountId));
    if (!raw) return { kind: 'absent' };
    const parsed = JSON.parse(raw) as unknown;
    return validPendingBootstrapMarker(parsed, accountId)
      ? { kind: 'valid', marker: parsed }
      : { kind: 'malformed' };
  } catch {
    return { kind: 'malformed' };
  }
}

function samePendingBootstrapMarker(left: PendingBootstrapMarker, right: PendingBootstrapMarker): boolean {
  return left.accountId === right.accountId
    && left.schemaVersion === right.schemaVersion
    && left.state === right.state
    && left.operationId === right.operationId
    && left.requestGeneration === right.requestGeneration
    && left.startedAt === right.startedAt
    && left.affectedDomains.length === right.affectedDomains.length
    && left.affectedDomains.every((domain, index) => domain === right.affectedDomains[index]);
}

function persistPendingBootstrapMarker(operation: NotesRecoveryOperation): boolean {
  const marker: PendingBootstrapMarker = {
    accountId: operation.request.accountId,
    schemaVersion: NOTES_AUTHORITY_SCHEMA_VERSION,
    state: 'BOOTSTRAP_PENDING',
    operationId: operation.operationId,
    requestGeneration: operation.request.generation,
    startedAt: Date.now(),
    affectedDomains: [NOTES_CORE_DOMAIN, NOTES_FOLDERS_DOMAIN],
  };
  try {
    const existing = readPendingBootstrapMarker(operation.request.accountId);
    if (existing.kind !== 'absent') return false;
    localStorage.setItem(bootstrapPendingKey(operation.request.accountId), JSON.stringify(marker));
    const persisted = readPendingBootstrapMarker(operation.request.accountId);
    return persisted.kind === 'valid' && samePendingBootstrapMarker(persisted.marker, marker);
  } catch {
    return false;
  }
}

function clearPendingBootstrapMarker(operation: NotesRecoveryOperation): boolean {
  // A stale request must never clear a marker belonging to a newer account
  // operation.  Logout/account switch therefore leaves the evidence intact.
  if (!isNotesAuthorityRequestActive(operation.request)) return false;
  const current = readPendingBootstrapMarker(operation.request.accountId);
  if (current.kind !== 'valid'
    || current.marker.operationId !== operation.operationId
    || current.marker.requestGeneration !== operation.request.generation) return false;
  try {
    localStorage.removeItem(bootstrapPendingKey(operation.request.accountId));
    return readPendingBootstrapMarker(operation.request.accountId).kind === 'absent';
  } catch {
    return false;
  }
}

function assertActiveRequest(request: NotesAuthorityRequest): void {
  if (!isNotesAuthorityRequestActive(request)) throw new Error('notes_account_scope_inactive');
}

export function activateNotesAccountAuthority(accountId: string): NotesAuthorityRequest {
  activeRequest = Object.freeze({
    accountId: normalizedAccountId(accountId),
    generation: ++nextRequestGeneration,
  });
  return activeRequest;
}

export function detachNotesAccountAuthority(): void {
  nextRequestGeneration += 1;
  activeRequest = null;
}

export function getActiveNotesAuthorityAccountId(): string | null {
  return activeRequest?.accountId ?? null;
}

export function getActiveNotesAuthorityRequest(): NotesAuthorityRequest | null {
  return activeRequest;
}

export function isNotesAuthorityRequestActive(request: NotesAuthorityRequest): boolean {
  return activeRequest?.accountId === request.accountId && activeRequest.generation === request.generation;
}

export function createNotesAccountRecoveryContext(): NotesAccountRecoveryContext | null {
  const request = getActiveNotesAuthorityRequest();
  if (!request) return null;
  const context = Object.freeze({ marker: NOTES_ACCOUNT_RECOVERY_CONTEXT });
  recoveryContexts.set(context, {
    request,
    operationId: `notes-bootstrap-${request.generation}-${++nextRecoveryOperation}`,
  });
  return context;
}

function recoveryRequest(context: unknown): NotesAuthorityRequest | null {
  if (!context || typeof context !== 'object') return null;
  return recoveryContexts.get(context)?.request ?? null;
}

function recoveryOperation(context: unknown): NotesRecoveryOperation | null {
  if (!context || typeof context !== 'object') return null;
  return recoveryContexts.get(context) ?? null;
}

async function notifyBootstrapApplyStage(stage: BootstrapApplyStage): Promise<void> {
  if (testBootstrapStageOverride) await testBootstrapStageOverride(stage);
}

export function isNotesAccountRecoveryContextActive(context: NotesAccountRecoveryContext): boolean {
  const request = recoveryRequest(context);
  return request !== null && isNotesAuthorityRequestActive(request);
}

export function isNotesAccountAuthorityActive(): boolean {
  return activeRequest !== null;
}

export function getNotesAuthorityState(
  accountId: string,
  domainId: NotesAuthorityDomain,
): NotesAuthorityDomainState {
  return readState(accountId, domainId) ?? {
    accountId: normalizedAccountId(accountId),
    domainId,
    schemaVersion: NOTES_AUTHORITY_SCHEMA_VERSION,
    state: 'NOT_LOADED',
    recordCount: 0,
    verifiedAt: 0,
    legacyGlobalDataPresent: legacyGlobalDataPresent(),
  };
}

let testReadNotesOverride: ((accountId: string) => Promise<ScopedReadResult<NoteBase>>) | null = null;

async function readAccountNotes(accountId: string): Promise<ScopedReadResult<NoteBase>> {
  if (testReadNotesOverride) return testReadNotesOverride(normalizedAccountId(accountId));
  const database = await openDatabase();
  try {
    const transaction = database.transaction(NOTES_STORE, 'readonly');
    const raw = await requestResult(transaction.objectStore(NOTES_STORE).getAll());
    await transactionDone(transaction);
    const records = Array.isArray(raw) ? raw : [];
    const normalizedAccount = normalizedAccountId(accountId);
    const keyPrefix = noteKey(normalizedAccount, '');
    const accountRecords: StoredScopedNote[] = [];
    for (const item of records) {
      if (!item || typeof item !== 'object') continue;
      const stored = item as Partial<StoredScopedNote>;
      const keyBelongsToAccount = typeof stored.key === 'string' && stored.key.startsWith(keyPrefix);
      const ownershipClaimsAccount = stored.accountId === normalizedAccount;
      if (!keyBelongsToAccount && !ownershipClaimsAccount) continue;
      if (!keyBelongsToAccount || stored.accountId !== normalizedAccount
        || !validNote(stored.note) || stored.key !== noteKey(normalizedAccount, stored.note.id)) return { kind: 'malformed' };
      accountRecords.push(stored as StoredScopedNote);
    }
    if (accountRecords.length === 0) return { kind: 'absent' };
    return { kind: 'valid', records: cloneNotes(accountRecords.map(item => item.note)) };
  } finally {
    database.close();
  }
}

async function replaceAccountNotes(accountId: string, notes: readonly NoteBase[]): Promise<void> {
  const normalized = cloneNotes(notes);
  if (!normalized.every(validNote) || new Set(normalized.map(note => note.id)).size !== normalized.length) {
    throw new Error('notes_account_authority_invalid_notes');
  }
  const database = await openDatabase();
  try {
    const transaction = database.transaction(NOTES_STORE, 'readwrite');
    const store = transaction.objectStore(NOTES_STORE);
    const request = store.getAll();
    await new Promise<void>((resolve, reject) => {
      request.onerror = () => reject(request.error ?? new Error('notes_account_authority_read_failed'));
      request.onsuccess = () => {
        for (const item of Array.isArray(request.result) ? request.result : []) {
          if (item && typeof item === 'object' && (item as StoredScopedNote).accountId === normalizedAccountId(accountId)) {
            store.delete((item as StoredScopedNote).key);
          }
        }
        for (const note of normalized) {
          store.put({ key: noteKey(accountId, note.id), accountId: normalizedAccountId(accountId), note } satisfies StoredScopedNote);
        }
        resolve();
      };
    });
    await transactionDone(transaction);
  } finally {
    database.close();
  }
}

function readFolders(accountId: string): ScopedReadResult<NoteFolderBase> {
  try {
    const raw = localStorage.getItem(storageKey(FOLDERS_KEY_PREFIX, accountId, NOTES_FOLDERS_DOMAIN));
    if (!raw) return { kind: 'absent' };
    const parsed = JSON.parse(raw) as Partial<StoredFolderEnvelope>;
    if (parsed.accountId !== normalizedAccountId(accountId)
      || parsed.domainId !== NOTES_FOLDERS_DOMAIN
      || parsed.schemaVersion !== NOTES_AUTHORITY_SCHEMA_VERSION
      || !Array.isArray(parsed.folders)
      || !parsed.folders.every(validFolder)) return { kind: 'malformed' };
    return { kind: 'valid', records: cloneFolders(parsed.folders) };
  } catch {
    return { kind: 'malformed' };
  }
}

function writeFolders(accountId: string, folders: readonly NoteFolderBase[]): boolean {
  const normalized = cloneFolders(folders);
  if (!normalized.every(validFolder) || new Set(normalized.map(folder => folder.id)).size !== normalized.length) return false;
  try {
    const envelope: StoredFolderEnvelope = {
      accountId: normalizedAccountId(accountId),
      domainId: NOTES_FOLDERS_DOMAIN,
      schemaVersion: NOTES_AUTHORITY_SCHEMA_VERSION,
      folders: normalized,
    };
    localStorage.setItem(storageKey(FOLDERS_KEY_PREFIX, accountId, NOTES_FOLDERS_DOMAIN), JSON.stringify(envelope));
    writeState(accountId, NOTES_FOLDERS_DOMAIN, normalized.length === 0 ? 'LOADED_EMPTY' : 'LOADED_POPULATED', normalized.length);
    return true;
  } catch {
    return false;
  }
}

function readActiveNoteId(accountId: string, notes: readonly NoteBase[]): string | null {
  try {
    const active = localStorage.getItem(storageKey(ACTIVE_KEY_PREFIX, accountId));
    return active && notes.some(note => note.id === active) ? active : null;
  } catch {
    return null;
  }
}

export async function initializeAccountScopedNotesAuthority(
  accountId: string,
  request = activateNotesAccountAuthority(accountId),
): Promise<AccountScopedNotesSnapshot> {
  if (request.accountId !== normalizedAccountId(accountId)) throw new Error('notes_account_scope_request_mismatch');
  const normalized = request.accountId;
  try {
    // A surviving marker is durable evidence that the previous cross-store
    // bootstrap did not prove completion.  Never normalize its contents into
    // a normal LOADED_* state on restart.
    const pending = readPendingBootstrapMarker(normalized);
    if (pending.kind !== 'absent') {
      writeState(normalized, NOTES_CORE_DOMAIN, 'RECOVERY_REQUIRED', 0);
      writeState(normalized, NOTES_FOLDERS_DOMAIN, 'RECOVERY_REQUIRED', 0);
      throw new Error('notes_account_authority_bootstrap_pending');
    }
    writeState(normalized, NOTES_CORE_DOMAIN, 'LOADING', 0);
    writeState(normalized, NOTES_FOLDERS_DOMAIN, 'LOADING', 0);
    const notesRead = await readAccountNotes(normalized);
    // A newer authentication transition owns the runtime now.  Do not let an
    // older asynchronous load publish its account snapshot into that runtime.
    assertActiveRequest(request);
    if (notesRead.kind === 'malformed') throw new Error('notes_account_authority_notes_malformed');
    const foldersRead = readFolders(normalized);
    if (foldersRead.kind === 'malformed') throw new Error('notes_account_authority_folders_malformed');
    const notes = notesRead.kind === 'valid' ? notesRead.records : [];
    const folders = foldersRead.kind === 'valid' ? foldersRead.records : [];
    if (foldersRead.kind === 'absent' && !writeFolders(normalized, folders)) {
      throw new Error('notes_account_authority_folders_write_failed');
    }
    const notesState = writeState(
      normalized,
      NOTES_CORE_DOMAIN,
      notes.length === 0 ? 'LOADED_EMPTY' : 'LOADED_POPULATED',
      notes.length,
    );
    const foldersState = writeState(
      normalized,
      NOTES_FOLDERS_DOMAIN,
      folders.length === 0 ? 'LOADED_EMPTY' : 'LOADED_POPULATED',
      folders.length,
    );
    return {
      accountId: normalized,
      requestGeneration: request.generation,
      notes,
      folders,
      activeNoteId: readActiveNoteId(normalized, notes),
      notesState,
      foldersState,
    };
  } catch (error) {
    if (isNotesAuthorityRequestActive(request)) {
      try {
        writeState(normalized, NOTES_CORE_DOMAIN, 'RECOVERY_REQUIRED', 0);
        writeState(normalized, NOTES_FOLDERS_DOMAIN, 'RECOVERY_REQUIRED', 0);
      } catch { /** storage itself is unavailable */ }
    }
    throw error;
  }
}

export async function loadAccountScopedNotes(accountId: string): Promise<NoteBase[]> {
  const request = getActiveNotesAuthorityRequest();
  if (!request || request.accountId !== normalizedAccountId(accountId)) throw new Error('notes_account_scope_inactive');
  const notesRead = await readAccountNotes(accountId);
  assertActiveRequest(request);
  if (notesRead.kind === 'malformed') {
    writeState(accountId, NOTES_CORE_DOMAIN, 'RECOVERY_REQUIRED', 0);
    throw new Error('notes_account_authority_notes_malformed');
  }
  const notes = notesRead.kind === 'valid' ? notesRead.records : [];
  writeState(accountId, NOTES_CORE_DOMAIN, notes.length === 0 ? 'LOADED_EMPTY' : 'LOADED_POPULATED', notes.length);
  return notes;
}

export async function saveAccountScopedNotes(accountId: string, notes: readonly NoteBase[]): Promise<boolean> {
  const request = getActiveNotesAuthorityRequest();
  if (!request || request.accountId !== normalizedAccountId(accountId)) throw new Error('notes_account_scope_inactive');
  try {
    await replaceAccountNotes(accountId, notes);
    assertActiveRequest(request);
    writeState(accountId, NOTES_CORE_DOMAIN, notes.length === 0 ? 'LOADED_EMPTY' : 'LOADED_POPULATED', notes.length);
    return true;
  } catch {
    try { writeState(accountId, NOTES_CORE_DOMAIN, 'RECOVERY_REQUIRED', 0); } catch { /**/ }
    return false;
  }
}

export async function saveNotesForRecoveryContext(
  context: NotesAccountRecoveryContext,
  notes: readonly NoteBase[],
): Promise<boolean> {
  const request = recoveryRequest(context);
  if (!request) return false;
  try {
    await replaceAccountNotes(request.accountId, notes);
    writeState(request.accountId, NOTES_CORE_DOMAIN, notes.length === 0 ? 'LOADED_EMPTY' : 'LOADED_POPULATED', notes.length);
    return true;
  } catch {
    try { writeState(request.accountId, NOTES_CORE_DOMAIN, 'RECOVERY_REQUIRED', 0); } catch { /**/ }
    return false;
  }
}

export async function loadNotesForRecoveryContext(context: NotesAccountRecoveryContext): Promise<NoteBase[]> {
  const request = recoveryRequest(context);
  if (!request) throw new Error('notes_account_recovery_context_invalid');
  const result = await readAccountNotes(request.accountId);
  if (result.kind === 'malformed') {
    writeState(request.accountId, NOTES_CORE_DOMAIN, 'RECOVERY_REQUIRED', 0);
    throw new Error('notes_account_authority_notes_malformed');
  }
  const notes = result.kind === 'valid' ? result.records : [];
  writeState(request.accountId, NOTES_CORE_DOMAIN, notes.length === 0 ? 'LOADED_EMPTY' : 'LOADED_POPULATED', notes.length);
  return notes;
}

export function saveFoldersForRecoveryContext(
  context: NotesAccountRecoveryContext,
  folders: readonly NoteFolderBase[],
): boolean {
  const request = recoveryRequest(context);
  if (!request) return false;
  const saved = writeFolders(request.accountId, folders);
  if (!saved) {
    try { writeState(request.accountId, NOTES_FOLDERS_DOMAIN, 'RECOVERY_REQUIRED', 0); } catch { /**/ }
  }
  return saved;
}

export function loadFoldersForRecoveryContext(context: NotesAccountRecoveryContext): NoteFolderBase[] {
  const request = recoveryRequest(context);
  if (!request) throw new Error('notes_account_recovery_context_invalid');
  const result = readFolders(request.accountId);
  if (result.kind === 'malformed') {
    writeState(request.accountId, NOTES_FOLDERS_DOMAIN, 'RECOVERY_REQUIRED', 0);
    throw new Error('notes_account_authority_folders_malformed');
  }
  return result.kind === 'valid' ? result.records : [];
}

function sameNotes(left: readonly NoteBase[], right: readonly NoteBase[]): boolean {
  return JSON.stringify(cloneNotes(left)) === JSON.stringify(cloneNotes(right));
}

function sameFolders(left: readonly NoteFolderBase[], right: readonly NoteFolderBase[]): boolean {
  return JSON.stringify(cloneFolders(left)) === JSON.stringify(cloneFolders(right));
}

function markNotesFoldersRecoveryRequired(request: NotesAuthorityRequest): void {
  try { writeState(request.accountId, NOTES_CORE_DOMAIN, 'RECOVERY_REQUIRED', 0); } catch { /**/ }
  try { writeState(request.accountId, NOTES_FOLDERS_DOMAIN, 'RECOVERY_REQUIRED', 0); } catch { /**/ }
}

async function restoreNotesFoldersForRecoveryContext(
  request: NotesAuthorityRequest,
  context: NotesAccountRecoveryContext,
  previousNotes: readonly NoteBase[],
  previousFolders: readonly NoteFolderBase[],
): Promise<boolean> {
  const notesRestored = await saveNotesForRecoveryContext(context, previousNotes);
  const foldersRestored = saveFoldersForRecoveryContext(context, previousFolders);
  if (!notesRestored || !foldersRestored) {
    markNotesFoldersRecoveryRequired(request);
    return false;
  }
  try {
    const readbackNotes = await loadNotesForRecoveryContext(context);
    const readbackFolders = loadFoldersForRecoveryContext(context);
    const verified = sameNotes(readbackNotes, previousNotes) && sameFolders(readbackFolders, previousFolders);
    if (!verified) markNotesFoldersRecoveryRequired(request);
    return verified;
  } catch {
    markNotesFoldersRecoveryRequired(request);
    return false;
  }
}

async function rollbackPendingBootstrap(
  operation: NotesRecoveryOperation,
  context: NotesAccountRecoveryContext,
  previousNotes: readonly NoteBase[],
  previousFolders: readonly NoteFolderBase[],
): Promise<boolean> {
  const restored = await restoreNotesFoldersForRecoveryContext(
    operation.request,
    context,
    previousNotes,
    previousFolders,
  );
  if (!restored) return false;
  const cleared = clearPendingBootstrapMarker(operation);
  if (!cleared) markNotesFoldersRecoveryRequired(operation.request);
  return cleared;
}

export type NotesFoldersRecoveryApplyResult = {
  applied: boolean;
  rollbackVerified: boolean;
};

/** Applies both account-scoped domains and proves either the new or prior state. */
export async function applyNotesFoldersForRecoveryContext(
  context: NotesAccountRecoveryContext,
  previousNotes: readonly NoteBase[],
  previousFolders: readonly NoteFolderBase[],
  nextNotes: readonly NoteBase[],
  nextFolders: readonly NoteFolderBase[],
): Promise<NotesFoldersRecoveryApplyResult> {
  const operation = recoveryOperation(context);
  if (!operation) return { applied: false, rollbackVerified: false };
  const request = operation.request;
  if (!persistPendingBootstrapMarker(operation)) {
    markNotesFoldersRecoveryRequired(request);
    return { applied: false, rollbackVerified: false };
  }
  try {
    await notifyBootstrapApplyStage('after-marker');
    const notesSaved = await saveNotesForRecoveryContext(context, nextNotes);
    if (!notesSaved) {
      return {
        applied: false,
        rollbackVerified: await rollbackPendingBootstrap(
          operation, context, previousNotes, previousFolders,
        ),
      };
    }
    await notifyBootstrapApplyStage('after-notes-write');
    const foldersSaved = saveFoldersForRecoveryContext(context, nextFolders);
    if (!foldersSaved) {
      return {
        applied: false,
        rollbackVerified: await rollbackPendingBootstrap(
          operation, context, previousNotes, previousFolders,
        ),
      };
    }
    await notifyBootstrapApplyStage('after-folders-write');
    await notifyBootstrapApplyStage('before-readback');
    const readbackNotes = await loadNotesForRecoveryContext(context);
    const readbackFolders = loadFoldersForRecoveryContext(context);
    if (!sameNotes(readbackNotes, nextNotes) || !sameFolders(readbackFolders, nextFolders)) {
      return {
        applied: false,
        rollbackVerified: await rollbackPendingBootstrap(
          operation, context, previousNotes, previousFolders,
        ),
      };
    }
    writeState(request.accountId, NOTES_CORE_DOMAIN, nextNotes.length === 0 ? 'LOADED_EMPTY' : 'LOADED_POPULATED', nextNotes.length);
    writeState(request.accountId, NOTES_FOLDERS_DOMAIN, nextFolders.length === 0 ? 'LOADED_EMPTY' : 'LOADED_POPULATED', nextFolders.length);
    await notifyBootstrapApplyStage('before-marker-clear');
    if (!clearPendingBootstrapMarker(operation)) {
      markNotesFoldersRecoveryRequired(request);
      return { applied: false, rollbackVerified: false };
    }
    return { applied: true, rollbackVerified: true };
  } catch {
    return {
      applied: false,
      rollbackVerified: await rollbackPendingBootstrap(
        operation, context, previousNotes, previousFolders,
      ),
    };
  }
}

export function loadAccountScopedFolders(): NoteFolderBase[] {
  if (!activeRequest) return [];
  const folders = readFolders(activeRequest.accountId);
  if (folders.kind === 'malformed') {
    writeState(activeRequest.accountId, NOTES_FOLDERS_DOMAIN, 'RECOVERY_REQUIRED', 0);
    throw new Error('notes_account_authority_folders_malformed');
  }
  return folders.kind === 'valid' ? folders.records : [];
}

export function saveAccountScopedFolders(folders: readonly NoteFolderBase[]): boolean {
  if (!activeRequest) return false;
  return writeFolders(activeRequest.accountId, folders);
}

export function loadAccountScopedActiveNoteId(notes: readonly NoteBase[]): string | null {
  if (!activeRequest) return null;
  return readActiveNoteId(activeRequest.accountId, notes);
}

export function saveAccountScopedActiveNoteId(noteId: string | null): boolean {
  if (!activeRequest) return false;
  try {
    localStorage.setItem(storageKey(ACTIVE_KEY_PREFIX, activeRequest.accountId), noteId ?? '');
    return true;
  } catch {
    return false;
  }
}

export async function clearAccountScopedNotesAuthority(accountId: string): Promise<void> {
  const request = getActiveNotesAuthorityRequest();
  if (!request || request.accountId !== normalizedAccountId(accountId)) throw new Error('notes_account_scope_inactive');
  await replaceAccountNotes(accountId, []);
  assertActiveRequest(request);
  writeState(accountId, NOTES_CORE_DOMAIN, 'LOADED_EMPTY', 0);
  if (!writeFolders(accountId, [])) throw new Error('notes_account_authority_folders_clear_failed');
  saveAccountScopedActiveNoteId(null);
}

export function resetNotesAccountAuthorityForTests(): void {
  activeRequest = null;
  nextRequestGeneration = 0;
  nextRecoveryOperation = 0;
  testReadNotesOverride = null;
  testBootstrapStageOverride = null;
}

/** Test-only scheduling seam for deterministic account-load race coverage. */
export const __testOnlyNotesAccountAuthorityHooks = import.meta.env.MODE === 'test'
  ? Object.freeze({
    setReadNotesOverride(override: ((accountId: string) => Promise<ScopedReadResult<NoteBase>>) | null) {
      testReadNotesOverride = override;
    },
    setBootstrapStageOverride(override: ((stage: BootstrapApplyStage) => void | Promise<void>) | null) {
      testBootstrapStageOverride = override;
    },
    readPendingBootstrapMarker(accountId: string): PendingBootstrapMarker | null {
      const result = readPendingBootstrapMarker(accountId);
      return result.kind === 'valid' ? result.marker : null;
    },
  })
  : undefined;
