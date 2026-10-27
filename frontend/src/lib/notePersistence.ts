/**
 * K-96B — Hybrid note persistence: IndexedDB primary, localStorage fallback.
 */
import {
  NOTES_KEY,
  FOLDERS_KEY,
  ACTIVE_KEY,
  clearNotesStorage,
  saveFolders,
  saveActiveNoteId,
  normalizeNote,
  loadRawNotesFromKey,
  mergeNoteArrays,
  registerNotesStorageBridge,
  type NotesStorageBridgeSaveResult,
  type NoteBase,
  type NoteFolderBase,
} from '@/components/views/noteUtils';
import { runPersistenceCleanup } from '@/lib/persistenceCleanup';
import {
  INDEXEDDB_FALLBACK_ERROR,
  NOTES_IDB_MIGRATION_FLAG,
  NOTES_IDB_REV_KEY,
  canUseIndexedDb,
  clearIndexedDbNotes,
  isIndexedDbMigrationComplete,
  isIndexedDbNotesEmpty,
  loadNotesFromIndexedDb,
  markIndexedDbMigrationComplete,
  readNotesIndexedDbRevision,
  saveNotesToIndexedDb,
} from '@/lib/noteIndexedDb';
import {
  captureOperationEpoch,
  isCompletePersistedNote,
  isRecoveryModeActive,
  isOperationEpochCurrent,
  mayDeleteLegacyStorage,
  mayReset,
  mayWriteLegacyNotes,
  recordRecoveryBlock,
  validatePersistedNotesReplacement,
  type PersistedNotesReplacementFailure,
  type PersistedNotesReplacementResult,
} from '@/lib/recoverySafetyPolicy';
import {
  detachNotesAccountAuthority,
  getActiveNotesAuthorityAccountId,
  getActiveNotesAuthorityRequest,
  isNotesAuthorityRequestActive,
  loadAccountScopedFolders,
  loadAccountScopedActiveNoteId,
  initializeAccountScopedNotesAuthority,
  loadAccountScopedNotes,
  resetNotesAccountAuthorityForTests,
  saveAccountScopedNotes,
  clearAccountScopedNotesAuthority,
  resetAccountScopedNotes,
  saveAccountScopedFolders,
  saveAccountScopedActiveNoteId,
  type NotesAuthorityRequest,
  type NotesAuthorityDomainState,
} from '@/lib/notesAccountAuthority';
import { notesResetResult, type NotesResetResult, type NotesResetStage } from './notesResetContract';

export type NotesPersistenceMode = 'accountScoped' | 'indexeddb' | 'localStorage';

export type NotesPersistenceWriteResult =
  | { status: 'persisted' }
  | { status: 'blocked'; reason: 'recovery_mode_active' | 'stale_epoch' }
  | { status: 'rejected'; reason: PersistedNotesReplacementFailure }
  | { status: 'failed'; reason: 'storage_failure' | 'indexeddb_rejected' };

export interface NotesPersistenceInitResult {
  notes: NoteBase[];
  mode: NotesPersistenceMode;
  migrated: boolean;
  migrationMs: number;
  loadMs: number;
  fallbackError?: string;
  accountId?: string;
  requestGeneration?: number;
  notesAuthorityState?: NotesAuthorityDomainState;
  foldersAuthorityState?: NotesAuthorityDomainState;
  legacyGlobalDataPresent?: boolean;
}

let persistenceMode: NotesPersistenceMode = 'localStorage';
let notesCache: NoteBase[] | null = null;
let lastIndexedDbRevision = readNotesIndexedDbRevision();
let persistenceHydrated = false;

export const NOTES_DURABILITY_BACKUP_PREFIX = 'absinthe.notes.backup.';

function runLegacyPersistenceCleanupIfWritable(): void {
  if (mayWriteLegacyNotes()) runPersistenceCleanup();
}

function removeLegacyNotesKeyIfAllowed(): void {
  if (!mayWriteLegacyNotes() || !mayDeleteLegacyStorage()) {
    recordRecoveryBlock('delete_legacy_storage');
    return;
  }
  try { localStorage.removeItem(NOTES_KEY); } catch { /**/ }
}

function backupNotesBeforeDurabilityWrite(
  reason: string,
  notes: readonly NoteBase[],
): string | null {
  if (!mayWriteLegacyNotes()) return null;
  if (notes.length === 0) return null;
  try {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const key = `${NOTES_DURABILITY_BACKUP_PREFIX}${stamp}.${reason}`;
    localStorage.setItem(key, JSON.stringify({
      reason,
      createdAt: Date.now(),
      notes,
    }));
    return key;
  } catch {
    return null;
  }
}

function loadNotesFromLocalStorage(): NoteBase[] {
  const raw = loadRawNotesFromKey(NOTES_KEY);
  if (raw && raw.length > 0) return raw;
  if (raw) return [];
  return [];
}

function readCurrentLocalStorageNotes(): readonly { id: string }[] | null {
  try {
    const raw = localStorage.getItem(NOTES_KEY);
    if (raw === null) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return null;
    const notes: Array<{ id: string }> = [];
    const ids = new Set<string>();
    for (const item of parsed) {
      if (!isCompletePersistedNote(item)) return null;
      const id = item.id.trim();
      if (ids.has(id)) return null;
      ids.add(id);
      notes.push({ id });
    }
    return notes;
  } catch {
    return null;
  }
}

export function validateLocalStorageNotesReplacement(
  notes: unknown,
): PersistedNotesReplacementResult {
  return validatePersistedNotesReplacement(readCurrentLocalStorageNotes(), notes);
}

function saveNotesToLocalStorage(notes: readonly NoteBase[]): boolean {
  return saveNotesToLocalStorageResult(notes).status === 'persisted';
}

function saveNotesToLocalStorageResult(notes: unknown): NotesPersistenceWriteResult {
  if (!mayWriteLegacyNotes()) return { status: 'blocked', reason: 'recovery_mode_active' };
  if (!Array.isArray(notes)) {
    recordRecoveryBlock('replace_persisted_notes', 'unsafe_replacement');
    return { status: 'rejected', reason: 'invalid_replacement' };
  }
  if (notes.length === 0 && isRecoveryModeActive()) {
    recordRecoveryBlock('replace_persisted_notes', 'unsafe_replacement');
    return { status: 'rejected', reason: 'empty_replacement' };
  }
  if (notes.length === 0) {
    try {
      localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
      return { status: 'persisted' };
    } catch {
      return { status: 'failed', reason: 'storage_failure' };
    }
  }
  if (!notes.every(isCompletePersistedNote)) {
    recordRecoveryBlock('replace_persisted_notes', 'unsafe_replacement');
    return { status: 'rejected', reason: 'malformed_note' };
  }
  if (new Set(notes.map(note => note.id)).size !== notes.length) {
    recordRecoveryBlock('replace_persisted_notes', 'unsafe_replacement');
    return { status: 'rejected', reason: 'duplicate_id' };
  }
  const validation = validateLocalStorageNotesReplacement(notes);
  if (!validation.ok) {
    recordRecoveryBlock('replace_persisted_notes', 'unsafe_replacement');
    return { status: 'rejected', reason: validation.reason };
  }
  try {
    localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
    return { status: 'persisted' };
  } catch {
    return { status: 'failed', reason: 'storage_failure' };
  }
}

export function saveNotesSyncResult(notes: unknown): NotesPersistenceWriteResult {
  if (persistenceMode === 'indexeddb') {
    return { status: 'failed', reason: 'indexeddb_rejected' };
  }
  return saveNotesToLocalStorageResult(notes);
}

export function getNotesPersistenceMode(): NotesPersistenceMode {
  return persistenceMode;
}

export function setCachedNotes(notes: readonly NoteBase[]): void {
  notesCache = [...notes];
}

export function loadNotesSync(): NoteBase[] {
  if (notesCache) return notesCache;
  if (isIndexedDbMigrationComplete()) {
    return [];
  }
  return loadNotesFromLocalStorage();
}

export async function migrateLocalStorageNotesToIndexedDb(): Promise<{ migrated: boolean; count: number }> {
  if (!mayWriteLegacyNotes()) throw new Error('Post-cutover legacy writes are blocked');
  if (isIndexedDbMigrationComplete()) {
    return { migrated: false, count: 0 };
  }

  const legacy = loadRawNotesFromKey(NOTES_KEY) ?? [];
  const idbEmpty = await isIndexedDbNotesEmpty();
  if (!idbEmpty) {
    if (legacy.length > 0) {
      const idbNotes = await loadNotesFromIndexedDb();
      const merged = mergeNoteArrays(idbNotes, legacy);
      backupNotesBeforeDurabilityWrite('merge-local-into-existing-idb', legacy);
      const ok = await saveNotesToIndexedDb(merged);
      if (!ok) throw new Error('IndexedDB migration merge failed');
      markIndexedDbMigrationComplete();
      removeLegacyNotesKeyIfAllowed();
      return { migrated: true, count: merged.length };
    }
    markIndexedDbMigrationComplete();
    removeLegacyNotesKeyIfAllowed();
    return { migrated: false, count: 0 };
  }

  let notes: NoteBase[];
  if (legacy.length > 0) {
    notes = legacy;
    backupNotesBeforeDurabilityWrite('migrate-local-to-idb', legacy);
  } else {
    notes = [];
  }
  const ok = await saveNotesToIndexedDb(notes);
  if (!ok) throw new Error('IndexedDB migration write failed');

  markIndexedDbMigrationComplete();
  removeLegacyNotesKeyIfAllowed();
  return { migrated: true, count: notes.length };
}

export async function initNotesPersistence(
  accountId?: string,
  request?: NotesAuthorityRequest,
): Promise<NotesPersistenceInitResult> {
  const migrationStarted = performance.now();

  if (accountId?.trim()) {
    const snapshot = await initializeAccountScopedNotesAuthority(accountId, request);
    persistenceMode = 'accountScoped';
    notesCache = snapshot.notes;
    persistenceHydrated = true;
    return {
      notes: snapshot.notes,
      mode: 'accountScoped',
      migrated: false,
      migrationMs: 0,
      loadMs: performance.now() - migrationStarted,
      accountId: snapshot.accountId,
      requestGeneration: snapshot.requestGeneration,
      notesAuthorityState: snapshot.notesState,
      foldersAuthorityState: snapshot.foldersState,
      legacyGlobalDataPresent: snapshot.notesState.legacyGlobalDataPresent,
    };
  }

  if (!canUseIndexedDb()) {
    persistenceMode = 'localStorage';
    const notes = loadNotesFromLocalStorage();
    notesCache = notes;
    persistenceHydrated = true;
    runLegacyPersistenceCleanupIfWritable();
    return {
      notes,
      mode: 'localStorage',
      migrated: false,
      migrationMs: 0,
      loadMs: performance.now() - migrationStarted,
      fallbackError: INDEXEDDB_FALLBACK_ERROR,
    };
  }

  try {
    const migration = await migrateLocalStorageNotesToIndexedDb();
    const loadStarted = performance.now();
    const notes = await loadNotesFromIndexedDb();
    let resolved = notes;
    if (notes.length === 0) {
      const localRescue = loadNotesFromLocalStorage();
      if (localRescue.length > 0) {
        backupNotesBeforeDurabilityWrite('rescue-local-after-empty-idb', localRescue);
        resolved = localRescue;
      }
      if (resolved.length > 0) await saveNotesToIndexedDb(resolved);
    }
    persistenceMode = 'indexeddb';
    notesCache = resolved;
    persistenceHydrated = true;
    lastIndexedDbRevision = readNotesIndexedDbRevision();
    removeLegacyNotesKeyIfAllowed();
    runLegacyPersistenceCleanupIfWritable();

    return {
      notes: resolved,
      mode: 'indexeddb',
      migrated: migration.migrated,
      migrationMs: loadStarted - migrationStarted,
      loadMs: performance.now() - loadStarted,
    };
  } catch {
    persistenceMode = 'localStorage';
    const notes = loadNotesFromLocalStorage();
    notesCache = notes;
    persistenceHydrated = true;
    runLegacyPersistenceCleanupIfWritable();
    return {
      notes,
      mode: 'localStorage',
      migrated: false,
      migrationMs: 0,
      loadMs: performance.now() - migrationStarted,
      fallbackError: INDEXEDDB_FALLBACK_ERROR,
    };
  }
}

export async function loadNotesAsync(): Promise<NoteBase[]> {
  const accountId = getActiveNotesAuthorityAccountId();
  if (persistenceMode === 'accountScoped' && accountId) {
    const notes = await loadAccountScopedNotes(accountId);
    notesCache = notes;
    return notes;
  }
  if (persistenceMode === 'indexeddb' && canUseIndexedDb()) {
    try {
      const notes = await loadNotesFromIndexedDb();
      notesCache = notes;
      lastIndexedDbRevision = readNotesIndexedDbRevision();
      return notesCache;
    } catch {
      persistenceMode = 'localStorage';
    }
  }
  const notes = loadNotesFromLocalStorage();
  notesCache = notes;
  return notes;
}

async function saveNotesAsyncInternal(
  notes: unknown,
  isCurrent: () => boolean = () => true,
): Promise<NotesPersistenceWriteResult> {
  if (!isCurrent()) return { status: 'blocked', reason: 'stale_epoch' };
  const epoch = captureOperationEpoch();
  const accountId = getActiveNotesAuthorityAccountId();
  if (persistenceMode === 'accountScoped' && accountId) {
    if (!Array.isArray(notes)) return { status: 'rejected', reason: 'invalid_replacement' };
    if (!persistenceHydrated) return { status: 'rejected', reason: 'empty_replacement' };
    if (!notes.every(isCompletePersistedNote)) return { status: 'rejected', reason: 'malformed_note' };
    if (new Set(notes.map(note => note.id)).size !== notes.length) return { status: 'rejected', reason: 'duplicate_id' };
    const ok = await saveAccountScopedNotes(accountId, notes as unknown as readonly NoteBase[], isCurrent);
    if (!isCurrent() || !isOperationEpochCurrent(epoch)) return { status: 'blocked', reason: 'stale_epoch' };
    if (!ok) return { status: 'failed', reason: 'indexeddb_rejected' };
    notesCache = [...notes] as NoteBase[];
    return { status: 'persisted' };
  }
  if (!mayWriteLegacyNotes()) return { status: 'blocked', reason: 'recovery_mode_active' };
  if (!Array.isArray(notes)) {
    recordRecoveryBlock('replace_persisted_notes', 'unsafe_replacement');
    return { status: 'rejected', reason: 'invalid_replacement' };
  }
  if (!persistenceHydrated && notes.length === 0) {
    recordRecoveryBlock('replace_persisted_notes', 'unsafe_replacement');
    return { status: 'rejected', reason: 'empty_replacement' };
  }
  if (persistenceMode === 'indexeddb' && canUseIndexedDb()) {
    const ok = await saveNotesToIndexedDb(notes as readonly NoteBase[], () => isCurrent() && isOperationEpochCurrent(epoch));
    if (!isCurrent() || !isOperationEpochCurrent(epoch)) {
      recordRecoveryBlock('replace_persisted_notes', 'stale_operation_epoch');
      return { status: 'blocked', reason: 'stale_epoch' };
    }
    if (ok) {
      notesCache = [...notes] as NoteBase[];
      removeLegacyNotesKeyIfAllowed();
      lastIndexedDbRevision = readNotesIndexedDbRevision();
      return { status: 'persisted' };
    }
    if (isRecoveryModeActive()) return { status: 'failed', reason: 'indexeddb_rejected' };
    persistenceMode = 'localStorage';
  }

  const result = saveNotesToLocalStorageResult(notes);
  if (!isOperationEpochCurrent(epoch)) {
    recordRecoveryBlock('replace_persisted_notes', 'stale_operation_epoch');
    return { status: 'blocked', reason: 'stale_epoch' };
  }
  if (result.status === 'persisted') notesCache = [...notes] as NoteBase[];
  return result;
}

export async function saveNotesAsync(notes: unknown, isCurrent: () => boolean = () => true): Promise<NotesPersistenceWriteResult> {
  return saveNotesAsyncInternal(notes, isCurrent);
}

export async function clearNotesPersistence(isCurrent: () => boolean = () => true): Promise<boolean> {
  if (!isCurrent()) return false;
  const accountId = getActiveNotesAuthorityAccountId();
  if (persistenceMode === 'accountScoped' && accountId) {
    await clearAccountScopedNotesAuthority(accountId, isCurrent);
    if (!isCurrent()) return false;
    notesCache = [];
    return true;
  }
  if (!mayWriteLegacyNotes() || !mayDeleteLegacyStorage()) {
    recordRecoveryBlock('delete_legacy_storage');
    return false;
  }
  localStorage.removeItem(NOTES_KEY);
  localStorage.removeItem(NOTES_IDB_MIGRATION_FLAG);
  localStorage.removeItem(NOTES_IDB_REV_KEY);
  if (canUseIndexedDb()) {
    if (!await clearIndexedDbNotes(isCurrent)) return false;
  }
  if (!isCurrent()) return false;
  notesCache = null;
  return true;
}

export interface NotesResetContext {
  readonly accountId: string | null;
  readonly request: NotesAuthorityRequest | null;
  readonly safetyEpoch: number;
  readonly mode: NotesPersistenceMode;
  readonly isUiCurrent: () => boolean;
  readonly isStoreCurrent?: () => boolean;
  readonly expectedSnapshot?: {
    readonly notes: readonly NoteBase[];
    readonly folders: readonly NoteFolderBase[];
    readonly activeNoteId: string | null;
  };
}

/** Explicit completion bridge; legacy callers retain their synchronous APIs. */
export async function saveFoldersAsync(folders: NoteFolderBase[]): Promise<boolean> {
  if (getActiveNotesAuthorityRequest()) {
    try { return await saveAccountScopedFolders(folders); } catch { return false; }
  }
  return persistenceMode === 'accountScoped' ? false : saveFolders(folders);
}

export async function saveActiveNoteIdAsync(id: string | null): Promise<boolean> {
  if (getActiveNotesAuthorityRequest()) {
    try { return await saveAccountScopedActiveNoteId(id); } catch { return false; }
  }
  return persistenceMode === 'accountScoped' ? false : saveActiveNoteId(id);
}

/** Bind an existing reset to its original authority; missing authenticated scope never falls back to legacy. */
export function captureNotesResetContext(
  expectedAccountId?: string,
  isUiCurrent: () => boolean = () => true,
): NotesResetContext | null {
  const request = getActiveNotesAuthorityRequest();
  if (expectedAccountId !== undefined && (!expectedAccountId.trim()
    || expectedAccountId !== request?.accountId)) return null;
  if ((persistenceMode === 'accountScoped') !== (request !== null)) return null;
  return Object.freeze({
    accountId: request?.accountId ?? null,
    request,
    safetyEpoch: captureOperationEpoch(),
    mode: persistenceMode,
    isUiCurrent,
  });
}

export function isNotesResetContextCurrent(context: NotesResetContext): boolean {
  try {
    return context.isUiCurrent()
      && isOperationEpochCurrent(context.safetyEpoch)
      && persistenceMode === context.mode
      && getActiveNotesAuthorityRequest() === context.request
      && (context.request === null || isNotesAuthorityRequestActive(context.request));
  } catch { return false; }
}

/** Only observes the existing reset writes; never retries, compensates, or deletes attachments. */
export async function persistNotesReset(
  context: NotesResetContext,
  welcome: readonly NoteBase[],
  isStoreCurrent: () => boolean,
): Promise<NotesResetResult> {
  const completed: NotesResetStage[] = [];
  const current = () => isNotesResetContextCurrent(context) && isStoreCurrent()
    && (context.isStoreCurrent?.() ?? true);
  const allowed = () => current() && mayReset();
  if (!current()) return notesResetResult('stale', completed, 'reset_scope_changed');
  if (!mayReset()) return notesResetResult('blocked', completed, 'reset_denied');
  if (context.accountId) {
    const expected = context.expectedSnapshot;
    if (!context.request || !expected) return notesResetResult('blocked', [], 'reset_snapshot_unavailable');
    const notesJson = (notes: readonly NoteBase[]) => JSON.stringify([...notes].map(normalizeNote).sort((a, b) => a.id.localeCompare(b.id)));
    const foldersJson = (folders: readonly NoteFolderBase[]) => JSON.stringify([...folders].sort((a, b) => a.id.localeCompare(b.id)));
    const result = await resetAccountScopedNotes(context.request, welcome, allowed, (notes, folders, active) => (
      notesJson(notes) === notesJson(expected.notes)
      && foldersJson(folders) === foldersJson(expected.folders)
      && active === expected.activeNoteId
    ));
    if (result.status === 'completed' && allowed()) notesCache = welcome.map(normalizeNote);
    return result;
  }
  let stage: NotesResetStage = 'local_metadata_clear';
  try {
    if (!clearNotesStorage()) throw new Error('reset_metadata_clear_failed');
    completed.push(stage);
    stage = 'notes_clear';
    if (!allowed() || !await clearNotesPersistence(allowed)) throw new Error('reset_notes_clear_failed');
    completed.push(stage);
    if (!allowed()) return notesResetResult('stale', completed, 'reset_scope_changed');
    stage = 'welcome_note';
    const saved = await saveNotesAsync(welcome, allowed);
    if (!allowed()) return notesResetResult('stale', completed, 'reset_scope_changed');
    if (saved.status !== 'persisted') throw new Error('reset_welcome_save_failed');
    completed.push(stage);
    stage = 'folders';
    if (!saveFolders([])) throw new Error('reset_folders_save_failed');
    completed.push(stage);
    stage = 'active_note';
    const activeId = welcome[0]?.id ?? null;
    if (!saveActiveNoteId(activeId)) throw new Error('reset_active_note_save_failed');
    completed.push(stage);
    stage = 'readback';
    const durable = context.accountId
      ? await loadAccountScopedNotes(context.accountId)
      : context.mode === 'indexeddb'
        ? await loadNotesFromIndexedDb()
        : JSON.parse(localStorage.getItem(NOTES_KEY) ?? 'null') as NoteBase[] | null;
    if (!allowed()) return notesResetResult('stale', completed, 'reset_scope_changed');
    const folders = context.accountId ? loadAccountScopedFolders() : JSON.parse(localStorage.getItem(FOLDERS_KEY) ?? 'null');
    const active = context.accountId ? loadAccountScopedActiveNoteId(welcome) : localStorage.getItem(ACTIVE_KEY);
    if (!Array.isArray(durable)
      || JSON.stringify(durable.map(normalizeNote)) !== JSON.stringify(welcome.map(normalizeNote))
      || JSON.stringify(folders) !== '[]' || active !== activeId) throw new Error('reset_readback_mismatch');
    completed.push(stage);
    return notesResetResult('completed', completed);
  } catch {
    return notesResetResult(current() && mayReset() ? 'incomplete' : 'stale', completed, `${stage}_unresolved`);
  }
}

export function isNotesIndexedDbRevisionEvent(key: string | null): boolean {
  return key === NOTES_IDB_REV_KEY;
}

export function resetNotesPersistenceForTests(): void {
  persistenceMode = 'localStorage';
  notesCache = null;
  lastIndexedDbRevision = 0;
  persistenceHydrated = false;
  resetNotesAccountAuthorityForTests();
}

/** Detach memory from an account without changing any durable account data. */
export function detachNotesPersistenceAccount(): void {
  detachNotesAccountAuthority();
  persistenceMode = 'localStorage';
  notesCache = null;
  persistenceHydrated = false;
}

export { INDEXEDDB_FALLBACK_ERROR, NOTES_IDB_REV_KEY };

registerNotesStorageBridge(
  loadNotesSync,
  (notes): NotesStorageBridgeSaveResult => {
    if (!persistenceHydrated && notes.length === 0) {
      recordRecoveryBlock('replace_persisted_notes', 'unsafe_replacement');
      return 'rejected';
    }
    if (persistenceMode === 'indexeddb' || persistenceMode === 'accountScoped') {
      void saveNotesAsync(notes);
      return 'pending';
    }
    return saveNotesToLocalStorageResult(notes).status === 'persisted' ? 'persisted' : 'rejected';
  },
);
