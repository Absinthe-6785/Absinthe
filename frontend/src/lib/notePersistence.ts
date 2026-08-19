/**
 * K-96B — Hybrid note persistence: IndexedDB primary, localStorage fallback.
 */
import {
  NOTES_KEY,
  loadRawNotesFromKey,
  mergeNoteArrays,
  registerNotesStorageBridge,
  type NotesStorageBridgeSaveResult,
  type NoteBase,
} from '@/components/views/noteUtils';
import { runPersistenceCleanup } from '@/lib/persistenceCleanup';
import {
  INDEXEDDB_FALLBACK_ERROR,
  NOTES_IDB_MIGRATION_FLAG,
  NOTES_IDB_REV_KEY,
  canUseIndexedDb,
  clearIndexedDbNotes,
  deleteNoteFromIndexedDb,
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
  mayWriteLegacyNotes,
  recordRecoveryBlock,
  validatePersistedNotesReplacement,
  type PersistedNotesReplacementFailure,
  type PersistedNotesReplacementResult,
} from '@/lib/recoverySafetyPolicy';
import {
  detachNotesAccountAuthority,
  getActiveNotesAuthorityAccountId,
  initializeAccountScopedNotesAuthority,
  loadAccountScopedNotes,
  resetNotesAccountAuthorityForTests,
  saveAccountScopedNotes,
  clearAccountScopedNotesAuthority,
  type NotesAuthorityRequest,
  type NotesAuthorityDomainState,
} from '@/lib/notesAccountAuthority';

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
): Promise<NotesPersistenceWriteResult> {
  const epoch = captureOperationEpoch();
  const accountId = getActiveNotesAuthorityAccountId();
  if (persistenceMode === 'accountScoped' && accountId) {
    if (!Array.isArray(notes)) return { status: 'rejected', reason: 'invalid_replacement' };
    if (!persistenceHydrated) return { status: 'rejected', reason: 'empty_replacement' };
    if (!notes.every(isCompletePersistedNote)) return { status: 'rejected', reason: 'malformed_note' };
    if (new Set(notes.map(note => note.id)).size !== notes.length) return { status: 'rejected', reason: 'duplicate_id' };
    const ok = await saveAccountScopedNotes(accountId, notes as unknown as readonly NoteBase[]);
    if (!isOperationEpochCurrent(epoch)) return { status: 'blocked', reason: 'stale_epoch' };
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
    const ok = await saveNotesToIndexedDb(notes as readonly NoteBase[], () => isOperationEpochCurrent(epoch));
    if (!isOperationEpochCurrent(epoch)) {
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

export async function saveNotesAsync(notes: unknown): Promise<NotesPersistenceWriteResult> {
  return saveNotesAsyncInternal(notes);
}

export async function clearNotesPersistence(): Promise<void> {
  const accountId = getActiveNotesAuthorityAccountId();
  if (persistenceMode === 'accountScoped' && accountId) {
    await clearAccountScopedNotesAuthority(accountId);
    notesCache = [];
    return;
  }
  if (!mayWriteLegacyNotes() || !mayDeleteLegacyStorage()) {
    recordRecoveryBlock('delete_legacy_storage');
    return;
  }
  notesCache = null;
  try {
    localStorage.removeItem(NOTES_KEY);
    localStorage.removeItem(NOTES_IDB_MIGRATION_FLAG);
    localStorage.removeItem(NOTES_IDB_REV_KEY);
  } catch { /**/ }
  if (canUseIndexedDb()) {
    try { await clearIndexedDbNotes(); } catch { /**/ }
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
