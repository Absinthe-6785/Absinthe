import type { NoteBase, NoteFolderBase } from '@/components/views/noteUtils';
import {
  captureOperationEpoch,
  isOperationEpochCurrent,
} from '@/lib/recoverySafetyPolicy';
import { withAccountNotesAttachmentMutationLock } from './notesAttachmentMutationLock';

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

/** Opaque, one-shot authority for one explicitly confirmed trashed Note. */
export interface NotesSingleDeleteAuthorization {
  readonly marker: symbol;
}

export const USER_INITIATED_SINGLE_NOTE_DELETE = 'USER_INITIATED_SINGLE_NOTE_DELETE' as const;

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
const SINGLE_DELETE_KEY_PREFIX = 'absinthe.notes.account-authority.single-delete.v1';
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

interface NotesSingleDeleteOperation {
  request: NotesAuthorityRequest;
  readonly noteId: string;
  readonly expectedUpdatedAt: number;
  readonly expectedDeletedAt: number;
  readonly operationEpoch: number;
  state: 'prepared' | 'pending' | 'confirmed' | 'completed';
}

export type NotesSingleDeleteConflictReason =
  | 'STALE_REVISION'
  | 'RESTORED_DURING_DELETE'
  | 'ACCOUNT_GENERATION_CHANGED'
  | 'OPERATION_EPOCH_CHANGED'
  | 'AUTHORIZATION_CONSUMED'
  | 'TARGET_NOTE_MISSING';

export type NotesSingleDeleteTargetValidation =
  | { readonly valid: true }
  | { readonly valid: false; readonly reason: NotesSingleDeleteConflictReason };

interface NotesSingleDeleteMarker {
  readonly accountId: string;
  readonly noteId: string;
  readonly expectedUpdatedAt: number;
  readonly expectedDeletedAt: number;
  readonly requestGeneration: number;
  readonly operationEpoch: number;
  readonly state: 'REMOTE_DELETE_PENDING' | 'REMOTE_DELETE_CONFIRMED' | 'REMOTE_DELETE_CONFLICT';
  readonly conflictReason?: NotesSingleDeleteConflictReason;
  readonly startedAt: number;
}

export interface NotesSingleDeleteBootstrapReconciliation {
  readonly authorizedMissingNoteIds: ReadonlySet<string>;
  readonly preservedConflictNoteIds: ReadonlySet<string>;
  readonly markersToClear: readonly NotesSingleDeleteMarker[];
}

export type NotesSingleDeleteCommitResult =
  | { readonly status: 'COMMITTED' }
  | { readonly status: 'CONFLICT'; readonly reason: NotesSingleDeleteConflictReason }
  | { readonly status: 'FAILED'; readonly reason: NotesSingleDeleteConflictReason };

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
const NOTES_SINGLE_DELETE_AUTHORIZATION = Symbol('notes-single-delete-authorization');
const singleDeleteOperations = new WeakMap<object, NotesSingleDeleteOperation>();

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

function singleDeleteKey(accountId: string, noteId: string): string {
  return `${SINGLE_DELETE_KEY_PREFIX}:${accountToken(accountId)}:${encodeURIComponent(noteId)}`;
}

function singleDeletePrefix(accountId: string): string {
  return `${SINGLE_DELETE_KEY_PREFIX}:${accountToken(accountId)}:`;
}

async function runAccountMutationExclusive<T>(accountId: string, action: () => Promise<T>): Promise<T> {
  return withAccountNotesAttachmentMutationLock({
    accountId: normalizedAccountId(accountId),
    operation: action,
  });
}

/**
 * Shares the origin-wide account-scoped Notes mutation lock with bounded local
 * attachment cleanup. Callers remain responsible for validating their active
 * authority and namespace before entering the mutation.
 */
export function runAccountScopedNotesMutation<T>(
  accountId: string,
  action: () => Promise<T>,
): Promise<T> {
  return runAccountMutationExclusive(accountId, action);
}

function validSingleDeleteMarker(value: unknown, accountId: string, storageKey: string): value is NotesSingleDeleteMarker {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const marker = value as Partial<NotesSingleDeleteMarker>;
  const baseKeys = [
    'accountId', 'expectedDeletedAt', 'expectedUpdatedAt', 'noteId',
    'operationEpoch', 'requestGeneration', 'startedAt', 'state',
  ];
  const expectedKeys = marker.state === 'REMOTE_DELETE_CONFLICT'
    ? [...baseKeys, 'conflictReason']
    : baseKeys;
  if (Object.keys(value).sort().join(',') !== expectedKeys.sort().join(',')) return false;
  return marker.accountId === normalizedAccountId(accountId)
    && typeof marker.noteId === 'string' && marker.noteId.trim().length > 0
    && storageKey === singleDeleteKey(accountId, marker.noteId)
    && typeof marker.expectedUpdatedAt === 'number' && Number.isFinite(marker.expectedUpdatedAt)
    && typeof marker.expectedDeletedAt === 'number' && Number.isFinite(marker.expectedDeletedAt)
    && Number.isSafeInteger(marker.requestGeneration) && (marker.requestGeneration as number) > 0
    && Number.isSafeInteger(marker.operationEpoch) && (marker.operationEpoch as number) > 0
    && (marker.state === 'REMOTE_DELETE_PENDING' || marker.state === 'REMOTE_DELETE_CONFIRMED'
      || marker.state === 'REMOTE_DELETE_CONFLICT')
    && (marker.state !== 'REMOTE_DELETE_CONFLICT' || marker.conflictReason === 'STALE_REVISION'
      || marker.conflictReason === 'RESTORED_DURING_DELETE'
      || marker.conflictReason === 'ACCOUNT_GENERATION_CHANGED'
      || marker.conflictReason === 'OPERATION_EPOCH_CHANGED'
      || marker.conflictReason === 'AUTHORIZATION_CONSUMED'
      || marker.conflictReason === 'TARGET_NOTE_MISSING')
    && typeof marker.startedAt === 'number' && Number.isFinite(marker.startedAt) && marker.startedAt > 0;
}

function sameSingleDeleteMarker(left: NotesSingleDeleteMarker, right: NotesSingleDeleteMarker): boolean {
  return left.accountId === right.accountId
    && left.noteId === right.noteId
    && left.expectedUpdatedAt === right.expectedUpdatedAt
    && left.expectedDeletedAt === right.expectedDeletedAt
    && left.requestGeneration === right.requestGeneration
    && left.operationEpoch === right.operationEpoch
    && left.state === right.state
    && left.conflictReason === right.conflictReason
    && left.startedAt === right.startedAt;
}

function readSingleDeleteMarker(accountId: string, noteId: string): NotesSingleDeleteMarker | null | 'malformed' {
  const key = singleDeleteKey(accountId, noteId);
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return null;
    const parsed = JSON.parse(raw) as unknown;
    return validSingleDeleteMarker(parsed, accountId, key) ? parsed : 'malformed';
  } catch {
    return 'malformed';
  }
}

function listSingleDeleteMarkers(accountId: string): NotesSingleDeleteMarker[] {
  const prefix = singleDeletePrefix(accountId);
  const markers: NotesSingleDeleteMarker[] = [];
  try {
    const keys: string[] = [];
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (key?.startsWith(prefix)) keys.push(key);
    }
    keys.sort();
    for (const key of keys) {
      const raw = localStorage.getItem(key);
      if (raw === null) throw new Error('notes_single_delete_marker_changed');
      const parsed = JSON.parse(raw) as unknown;
      if (!validSingleDeleteMarker(parsed, accountId, key)) throw new Error('notes_single_delete_marker_malformed');
      markers.push(parsed);
    }
    return markers;
  } catch (error) {
    throw error instanceof Error ? error : new Error('notes_single_delete_marker_malformed');
  }
}

function persistSingleDeleteMarker(
  marker: NotesSingleDeleteMarker,
  expectedCurrent: NotesSingleDeleteMarker | null,
): boolean {
  const key = singleDeleteKey(marker.accountId, marker.noteId);
  try {
    const current = readSingleDeleteMarker(marker.accountId, marker.noteId);
    if (current === 'malformed'
      || expectedCurrent === null && current !== null
      || expectedCurrent !== null && (current === null || !sameSingleDeleteMarker(current, expectedCurrent))) return false;
    localStorage.setItem(key, JSON.stringify(marker));
    const persisted = readSingleDeleteMarker(marker.accountId, marker.noteId);
    return persisted !== null && persisted !== 'malformed' && sameSingleDeleteMarker(persisted, marker);
  } catch {
    return false;
  }
}

function clearSingleDeleteMarker(marker: NotesSingleDeleteMarker): boolean {
  const current = readSingleDeleteMarker(marker.accountId, marker.noteId);
  if (current === 'malformed' || current === null || !sameSingleDeleteMarker(current, marker)) return false;
  try {
    localStorage.removeItem(singleDeleteKey(marker.accountId, marker.noteId));
    return readSingleDeleteMarker(marker.accountId, marker.noteId) === null;
  } catch {
    return false;
  }
}

function persistSingleDeleteConflict(
  marker: NotesSingleDeleteMarker,
  reason: NotesSingleDeleteConflictReason,
): boolean {
  const conflict: NotesSingleDeleteMarker = {
    ...marker,
    state: 'REMOTE_DELETE_CONFLICT',
    conflictReason: reason,
  };
  return persistSingleDeleteMarker(conflict, marker);
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

export interface PrepareNotesSingleDeleteInput {
  readonly operation: typeof USER_INITIATED_SINGLE_NOTE_DELETE;
  readonly accountId: string;
  readonly note: NoteBase;
  readonly explicitUserAction: true;
}

/**
 * Prepares one exact Note deletion for an already authenticated account scope.
 * The returned object carries no transferable data and is valid only once.
 */
export function prepareNotesSingleDelete(
  input: PrepareNotesSingleDeleteInput,
): NotesSingleDeleteAuthorization | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)
    || Object.keys(input).sort().join(',') !== [
      'accountId', 'explicitUserAction', 'note', 'operation',
    ].sort().join(',')) return null;
  const request = getActiveNotesAuthorityRequest();
  if (!request || input.operation !== USER_INITIATED_SINGLE_NOTE_DELETE
    || input.explicitUserAction !== true
    || request.accountId !== input.accountId.trim()
    || !validNote(input.note)
    || input.note.deletedAt === null) return null;
  const authorization = Object.freeze({ marker: NOTES_SINGLE_DELETE_AUTHORIZATION });
  singleDeleteOperations.set(authorization, {
    request,
    noteId: input.note.id,
    expectedUpdatedAt: input.note.updatedAt,
    expectedDeletedAt: input.note.deletedAt,
    operationEpoch: captureOperationEpoch(),
    state: 'prepared',
  });
  return authorization;
}

/** Returns the prepared Note id without exposing or mutating the authorization operation. */
export function getNotesSingleDeleteTargetId(
  authorization: NotesSingleDeleteAuthorization,
): string | null {
  if (!authorization || (typeof authorization !== 'object' && typeof authorization !== 'function')) return null;
  return singleDeleteOperations.get(authorization)?.noteId ?? null;
}

/** Treat malformed durable markers as present so recovery remains fail-closed. */
export function hasNotesSingleDeleteMarker(accountId: string, noteId: string): boolean {
  return readSingleDeleteMarker(accountId, noteId) !== null;
}

/** Returns whether any durable single-delete evidence remains for the account. */
export function hasNotesSingleDeleteMarkers(accountId: string): boolean {
  try {
    return listSingleDeleteMarkers(accountId).length > 0;
  } catch {
    return true;
  }
}

export function validateNotesSingleDeleteTarget(
  authorization: NotesSingleDeleteAuthorization,
  accountId: string,
  note: NoteBase | undefined,
): NotesSingleDeleteTargetValidation {
  const operation = singleDeleteOperations.get(authorization);
  if (!operation || operation.state === 'completed') {
    return { valid: false, reason: 'AUTHORIZATION_CONSUMED' };
  }
  let normalized: string;
  try {
    normalized = normalizedAccountId(accountId);
  } catch {
    return { valid: false, reason: 'ACCOUNT_GENERATION_CHANGED' };
  }
  if (operation.request.accountId !== normalized || !isNotesAuthorityRequestActive(operation.request)) {
    return { valid: false, reason: 'ACCOUNT_GENERATION_CHANGED' };
  }
  if (!isOperationEpochCurrent(operation.operationEpoch)) {
    return { valid: false, reason: 'OPERATION_EPOCH_CHANGED' };
  }
  if (!note || note.id !== operation.noteId) {
    return { valid: false, reason: 'TARGET_NOTE_MISSING' };
  }
  if (note.deletedAt === null) {
    return { valid: false, reason: 'RESTORED_DURING_DELETE' };
  }
  if (note.updatedAt !== operation.expectedUpdatedAt || note.deletedAt !== operation.expectedDeletedAt) {
    return { valid: false, reason: 'STALE_REVISION' };
  }
  return { valid: true };
}

export interface BegunNotesSingleDelete {
  readonly accountId: string;
  readonly noteId: string;
}

/** Binds the prepared action to a fresh generation and durable pending marker. */
export async function beginNotesSingleDelete(
  authorization: NotesSingleDeleteAuthorization,
): Promise<BegunNotesSingleDelete | null> {
  const operation = singleDeleteOperations.get(authorization);
  if (!operation || operation.state !== 'prepared'
    || !isNotesAuthorityRequestActive(operation.request)
    || !isOperationEpochCurrent(operation.operationEpoch)) return null;

  // Invalidates any older complete-bootstrap context before a remote delete can begin.
  operation.request = activateNotesAccountAuthority(operation.request.accountId);
  try {
    return await runAccountMutationExclusive(operation.request.accountId, async () => {
      if (!isNotesAuthorityRequestActive(operation.request)
        || !isOperationEpochCurrent(operation.operationEpoch)) return null;
      const stored = await readStoredAccountNote(operation.request.accountId, operation.noteId);
      if (!stored
        || stored.note.updatedAt !== operation.expectedUpdatedAt
        || stored.note.deletedAt !== operation.expectedDeletedAt) return null;
      const marker: NotesSingleDeleteMarker = {
        accountId: operation.request.accountId,
        noteId: operation.noteId,
        expectedUpdatedAt: operation.expectedUpdatedAt,
        expectedDeletedAt: operation.expectedDeletedAt,
        requestGeneration: operation.request.generation,
        operationEpoch: operation.operationEpoch,
        state: 'REMOTE_DELETE_PENDING',
        startedAt: Date.now(),
      };
      if (!persistSingleDeleteMarker(marker, null)) return null;
      operation.state = 'pending';
      return { accountId: operation.request.accountId, noteId: operation.noteId };
    });
  } catch {
    return null;
  }
}

export function isNotesSingleDeleteActive(
  authorization: NotesSingleDeleteAuthorization,
  accountId: string,
  noteId: string,
): boolean {
  const operation = singleDeleteOperations.get(authorization);
  return Boolean(operation
    && (operation.state === 'pending' || operation.state === 'confirmed')
    && operation.request.accountId === accountId
    && operation.noteId === noteId
    && isNotesAuthorityRequestActive(operation.request)
    && isOperationEpochCurrent(operation.operationEpoch));
}

export function confirmNotesSingleRemoteDelete(
  authorization: NotesSingleDeleteAuthorization,
): boolean {
  const operation = singleDeleteOperations.get(authorization);
  if (!operation || operation.state !== 'pending'
    || !isNotesSingleDeleteActive(authorization, operation.request.accountId, operation.noteId)) return false;
  const pending = readSingleDeleteMarker(operation.request.accountId, operation.noteId);
  if (!pending || pending === 'malformed'
    || pending.state !== 'REMOTE_DELETE_PENDING'
    || pending.requestGeneration !== operation.request.generation
    || pending.operationEpoch !== operation.operationEpoch) return false;
  const confirmed: NotesSingleDeleteMarker = { ...pending, state: 'REMOTE_DELETE_CONFIRMED' };
  if (!persistSingleDeleteMarker(confirmed, pending)) return false;
  operation.state = 'confirmed';
  return true;
}

export async function commitNotesSingleDelete(
  authorization: NotesSingleDeleteAuthorization,
  isCurrentTarget?: () => NotesSingleDeleteTargetValidation,
): Promise<NotesSingleDeleteCommitResult> {
  const operation = singleDeleteOperations.get(authorization);
  if (!operation || operation.state !== 'confirmed') {
    return { status: 'FAILED', reason: 'AUTHORIZATION_CONSUMED' };
  }
  try {
    return await runAccountMutationExclusive(operation.request.accountId, async () => {
      if (!isNotesSingleDeleteActive(authorization, operation.request.accountId, operation.noteId)) {
        return { status: 'FAILED', reason: 'ACCOUNT_GENERATION_CHANGED' };
      }
      const marker = readSingleDeleteMarker(operation.request.accountId, operation.noteId);
      if (!marker || marker === 'malformed' || marker.state !== 'REMOTE_DELETE_CONFIRMED'
        || marker.requestGeneration !== operation.request.generation
        || marker.operationEpoch !== operation.operationEpoch) {
        return { status: 'FAILED', reason: 'AUTHORIZATION_CONSUMED' };
      }
      const beforeDelete = isCurrentTarget?.() ?? { valid: true };
      if (!beforeDelete.valid) {
        if (!persistSingleDeleteConflict(marker, beforeDelete.reason)) {
          return { status: 'FAILED', reason: beforeDelete.reason };
        }
        operation.state = 'completed';
        return { status: 'CONFLICT', reason: beforeDelete.reason };
      }
      const stored = await readStoredAccountNote(operation.request.accountId, operation.noteId);
      if (!stored) {
        if (!persistSingleDeleteConflict(marker, 'TARGET_NOTE_MISSING')) {
          return { status: 'FAILED', reason: 'TARGET_NOTE_MISSING' };
        }
        operation.state = 'completed';
        return { status: 'CONFLICT', reason: 'TARGET_NOTE_MISSING' };
      }
      if (stored.note.updatedAt !== operation.expectedUpdatedAt
        || stored.note.deletedAt !== operation.expectedDeletedAt) {
        const reason: NotesSingleDeleteConflictReason = stored.note.deletedAt === null
          ? 'RESTORED_DURING_DELETE' : 'STALE_REVISION';
        if (!persistSingleDeleteConflict(marker, reason)) return { status: 'FAILED', reason };
        operation.state = 'completed';
        return { status: 'CONFLICT', reason };
      }
      if (!await deleteStoredAccountNote(operation.request.accountId, operation.noteId)) {
        return { status: 'FAILED', reason: 'TARGET_NOTE_MISSING' };
      }
      const afterDelete = isCurrentTarget?.() ?? { valid: true };
      if (!afterDelete.valid) {
        if (!persistSingleDeleteConflict(marker, afterDelete.reason)) {
          return { status: 'FAILED', reason: afterDelete.reason };
        }
        operation.state = 'completed';
        return { status: 'CONFLICT', reason: afterDelete.reason };
      }
      const remainingCount = await countStoredAccountNotes(operation.request.accountId);
      const afterCount = isCurrentTarget?.() ?? { valid: true };
      if (!afterCount.valid) {
        if (!persistSingleDeleteConflict(marker, afterCount.reason)) {
          return { status: 'FAILED', reason: afterCount.reason };
        }
        operation.state = 'completed';
        return { status: 'CONFLICT', reason: afterCount.reason };
      }
      writeState(
        operation.request.accountId,
        NOTES_CORE_DOMAIN,
        remainingCount === 0 ? 'LOADED_EMPTY' : 'LOADED_POPULATED',
        remainingCount,
      );
      operation.state = 'completed';
      return clearSingleDeleteMarker(marker)
        ? { status: 'COMMITTED' }
        : { status: 'FAILED', reason: 'AUTHORIZATION_CONSUMED' };
    });
  } catch {
    return { status: 'FAILED', reason: 'TARGET_NOTE_MISSING' };
  }
}

export function abortNotesSingleDelete(authorization: NotesSingleDeleteAuthorization): void {
  const operation = singleDeleteOperations.get(authorization);
  if (!operation || operation.state !== 'pending'
    || !isNotesAuthorityRequestActive(operation.request)
    || !isOperationEpochCurrent(operation.operationEpoch)) return;
  const marker = readSingleDeleteMarker(operation.request.accountId, operation.noteId);
  if (marker && marker !== 'malformed' && marker.state === 'REMOTE_DELETE_PENDING') {
    clearSingleDeleteMarker(marker);
  }
  operation.state = 'completed';
}

/**
 * Converts an exact durable delete marker plus complete remote absence into
 * deletion evidence. Any active/conflicting marker keeps bootstrap fail-closed.
 */
export function reconcileNotesSingleDeletesForBootstrap(
  accountId: string,
  remoteNoteIds: ReadonlySet<string>,
  localNotes: readonly NoteBase[] = [],
): NotesSingleDeleteBootstrapReconciliation {
  const request = getActiveNotesAuthorityRequest();
  if (!request || request.accountId !== normalizedAccountId(accountId)) {
    throw new Error('notes_single_delete_account_inactive');
  }
  const authorizedMissingNoteIds = new Set<string>();
  const preservedConflictNoteIds = new Set<string>();
  const markersToClear: NotesSingleDeleteMarker[] = [];
  const localById = new Map(localNotes.map(note => [note.id, note]));
  for (const marker of listSingleDeleteMarkers(accountId)) {
    const local = localById.get(marker.noteId);
    const localMatchesTarget = local !== undefined
      && local.updatedAt === marker.expectedUpdatedAt
      && local.deletedAt === marker.expectedDeletedAt;
    const localConflictReason: NotesSingleDeleteConflictReason | null = local === undefined || localMatchesTarget
      ? null
      : local.deletedAt === null ? 'RESTORED_DURING_DELETE' : 'STALE_REVISION';

    if (marker.state === 'REMOTE_DELETE_CONFLICT') {
      // A divergent local Note is still unresolved even when the remote row
      // exists. Keep the one marker durable so every later bootstrap protects
      // the local newer/restored state from the older remote snapshot.
      if (localConflictReason) {
        const conflict = persistSingleDeleteConflict(marker, localConflictReason)
          ? readSingleDeleteMarker(accountId, marker.noteId)
          : 'malformed';
        if (!conflict || conflict === 'malformed' || conflict.state !== 'REMOTE_DELETE_CONFLICT') {
          throw new Error('notes_single_delete_marker_conflict_persist_failed');
        }
        preservedConflictNoteIds.add(marker.noteId);
        continue;
      }
      // If local state has converged to the authorized target (or is absent),
      // fall through to the normal remote-present/absent terminal handling.
    }

    if (remoteNoteIds.has(marker.noteId)) {
      if (marker.state === 'REMOTE_DELETE_PENDING' && marker.requestGeneration === request.generation) {
        throw new Error('notes_single_delete_remote_pending');
      }
      if (localConflictReason) {
        const conflict = persistSingleDeleteConflict(marker, localConflictReason)
          ? readSingleDeleteMarker(accountId, marker.noteId)
          : 'malformed';
        if (!conflict || conflict === 'malformed' || conflict.state !== 'REMOTE_DELETE_CONFLICT') {
          throw new Error('notes_single_delete_marker_conflict_persist_failed');
        }
        preservedConflictNoteIds.add(marker.noteId);
        continue;
      }
      markersToClear.push(marker);
      continue;
    }

    if (localConflictReason) {
      const conflict = persistSingleDeleteConflict(marker, localConflictReason)
        ? readSingleDeleteMarker(accountId, marker.noteId)
        : 'malformed';
      if (!conflict || conflict === 'malformed' || conflict.state !== 'REMOTE_DELETE_CONFLICT') {
        throw new Error('notes_single_delete_marker_conflict_persist_failed');
      }
      preservedConflictNoteIds.add(marker.noteId);
      continue;
    }

    authorizedMissingNoteIds.add(marker.noteId);
    markersToClear.push(marker);
  }
  return { authorizedMissingNoteIds, preservedConflictNoteIds, markersToClear };
}

export function completeNotesSingleDeleteBootstrapReconciliation(
  markers: readonly NotesSingleDeleteMarker[],
): boolean {
  return markers.every(clearSingleDeleteMarker);
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

async function readStoredAccountNote(accountId: string, noteId: string): Promise<StoredScopedNote | null> {
  const database = await openDatabase();
  try {
    const stored = await requestResult(database.transaction(NOTES_STORE, 'readonly')
      .objectStore(NOTES_STORE).get(noteKey(accountId, noteId))) as unknown;
    if (stored === undefined) return null;
    if (!stored || typeof stored !== 'object') throw new Error('notes_account_authority_note_malformed');
    const candidate = stored as Partial<StoredScopedNote>;
    if (candidate.key !== noteKey(accountId, noteId)
      || candidate.accountId !== normalizedAccountId(accountId)
      || !validNote(candidate.note)
      || candidate.note.id !== noteId) throw new Error('notes_account_authority_note_malformed');
    return candidate as StoredScopedNote;
  } finally {
    database.close();
  }
}

async function deleteStoredAccountNote(accountId: string, noteId: string): Promise<boolean> {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(NOTES_STORE, 'readwrite');
    transaction.objectStore(NOTES_STORE).delete(noteKey(accountId, noteId));
    await transactionDone(transaction);
  } finally {
    database.close();
  }
  return (await readStoredAccountNote(accountId, noteId)) === null;
}

async function countStoredAccountNotes(accountId: string): Promise<number> {
  const database = await openDatabase();
  try {
    return await requestResult(database.transaction(NOTES_STORE, 'readonly')
      .objectStore(NOTES_STORE)
      .index('accountId')
      .count(normalizedAccountId(accountId)));
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
  return runAccountMutationExclusive(accountId, async () => {
    try {
      assertActiveRequest(request);
      await replaceAccountNotes(accountId, notes);
      assertActiveRequest(request);
      writeState(accountId, NOTES_CORE_DOMAIN, notes.length === 0 ? 'LOADED_EMPTY' : 'LOADED_POPULATED', notes.length);
      return true;
    } catch {
      if (isNotesAuthorityRequestActive(request)) {
        try { writeState(accountId, NOTES_CORE_DOMAIN, 'RECOVERY_REQUIRED', 0); } catch { /**/ }
      }
      return false;
    }
  });
}

async function saveNotesForRecoveryContextInternal(
  request: NotesAuthorityRequest,
  notes: readonly NoteBase[],
): Promise<boolean> {
  try {
    await replaceAccountNotes(request.accountId, notes);
    writeState(request.accountId, NOTES_CORE_DOMAIN, notes.length === 0 ? 'LOADED_EMPTY' : 'LOADED_POPULATED', notes.length);
    return true;
  } catch {
    try { writeState(request.accountId, NOTES_CORE_DOMAIN, 'RECOVERY_REQUIRED', 0); } catch { /**/ }
    return false;
  }
}

export async function saveNotesForRecoveryContext(
  context: NotesAccountRecoveryContext,
  notes: readonly NoteBase[],
): Promise<boolean> {
  const request = recoveryRequest(context);
  if (!request) return false;
  return runAccountMutationExclusive(request.accountId, () => saveNotesForRecoveryContextInternal(request, notes));
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
  const notesRestored = await saveNotesForRecoveryContextInternal(request, previousNotes);
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
async function applyNotesFoldersForRecoveryContextInternal(
  context: NotesAccountRecoveryContext,
  previousNotes: readonly NoteBase[],
  previousFolders: readonly NoteFolderBase[],
  nextNotes: readonly NoteBase[],
  nextFolders: readonly NoteFolderBase[],
): Promise<NotesFoldersRecoveryApplyResult> {
  const operation = recoveryOperation(context);
  if (!operation) return { applied: false, rollbackVerified: false };
  const request = operation.request;
  if (!isNotesAuthorityRequestActive(request)) return { applied: false, rollbackVerified: true };
  if (!persistPendingBootstrapMarker(operation)) {
    markNotesFoldersRecoveryRequired(request);
    return { applied: false, rollbackVerified: false };
  }
  try {
    await notifyBootstrapApplyStage('after-marker');
    if (!isNotesAuthorityRequestActive(request)) throw new Error('notes_bootstrap_stale');
    const notesSaved = await saveNotesForRecoveryContextInternal(request, nextNotes);
    if (!notesSaved) {
      return {
        applied: false,
        rollbackVerified: await rollbackPendingBootstrap(
          operation, context, previousNotes, previousFolders,
        ),
      };
    }
    await notifyBootstrapApplyStage('after-notes-write');
    if (!isNotesAuthorityRequestActive(request)) throw new Error('notes_bootstrap_stale');
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
    if (!isNotesAuthorityRequestActive(request)) throw new Error('notes_bootstrap_stale');
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

export async function applyNotesFoldersForRecoveryContext(
  context: NotesAccountRecoveryContext,
  previousNotes: readonly NoteBase[],
  previousFolders: readonly NoteFolderBase[],
  nextNotes: readonly NoteBase[],
  nextFolders: readonly NoteFolderBase[],
): Promise<NotesFoldersRecoveryApplyResult> {
  const operation = recoveryOperation(context);
  if (!operation) return { applied: false, rollbackVerified: false };
  return runAccountMutationExclusive(operation.request.accountId, () => applyNotesFoldersForRecoveryContextInternal(
    context, previousNotes, previousFolders, nextNotes, nextFolders,
  ));
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
  await runAccountMutationExclusive(accountId, async () => {
    assertActiveRequest(request);
    await replaceAccountNotes(accountId, []);
    assertActiveRequest(request);
    writeState(accountId, NOTES_CORE_DOMAIN, 'LOADED_EMPTY', 0);
    if (!writeFolders(accountId, [])) throw new Error('notes_account_authority_folders_clear_failed');
    saveAccountScopedActiveNoteId(null);
  });
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
