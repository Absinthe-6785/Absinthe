/**
 * K-96B — Hybrid note persistence: IndexedDB primary, localStorage fallback.
 */
import {
  NOTES_KEY,
  defaultSeedNotes,
  loadRawNotesFromKey,
  mergeNoteArrays,
  registerNotesStorageBridge,
  type NoteBase,
} from '@/components/views/noteUtils';
import { runPersistenceCleanup } from '@/lib/persistenceCleanup';
import {
  markNotesOnboardingComplete,
  shouldSeedOnboardingNotes,
} from '@/lib/notesOnboarding';
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
  assertCurrentOperationEpoch,
  captureOperationEpoch,
  isCompletePersistedNote,
  isRecoveryModeActive,
  isOperationEpochCurrent,
  mayDeleteLegacyStorage,
  recordRecoveryBlock,
  validatePersistedNotesReplacement,
  type PersistedNotesReplacementResult,
} from '@/lib/recoverySafetyPolicy';

export type NotesPersistenceMode = 'indexeddb' | 'localStorage';

export interface NotesPersistenceInitResult {
  notes: NoteBase[];
  mode: NotesPersistenceMode;
  migrated: boolean;
  migrationMs: number;
  loadMs: number;
  fallbackError?: string;
}

let persistenceMode: NotesPersistenceMode = 'localStorage';
let notesCache: NoteBase[] | null = null;
let lastIndexedDbRevision = readNotesIndexedDbRevision();
let persistenceHydrated = false;

export const NOTES_DURABILITY_BACKUP_PREFIX = 'absinthe.notes.backup.';

function removeLegacyNotesKeyIfAllowed(): void {
  if (!mayDeleteLegacyStorage()) {
    recordRecoveryBlock('delete_legacy_storage');
    return;
  }
  try { localStorage.removeItem(NOTES_KEY); } catch { /**/ }
}

function backupNotesBeforeDurabilityWrite(
  reason: string,
  notes: readonly NoteBase[],
): string | null {
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
  if (raw && raw.length > 0) {
    markNotesOnboardingComplete();
    return raw;
  }
  if (raw) return [];
  return [];
}

async function resolveEmptyVaultNotes(): Promise<NoteBase[]> {
  if (!shouldSeedOnboardingNotes()) return [];
  const seeded = defaultSeedNotes();
  markNotesOnboardingComplete();
  return seeded;
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
  const validation = validateLocalStorageNotesReplacement(notes);
  if (!validation.ok) {
    recordRecoveryBlock('replace_persisted_notes', 'unsafe_replacement');
    return false;
  }
  try {
    localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
    return true;
  } catch {
    return false;
  }
}

export function isNotesPersistenceHydrated(): boolean {
  return persistenceHydrated;
}

export function getNotesPersistenceMode(): NotesPersistenceMode {
  return persistenceMode;
}

export function getCachedNotes(): NoteBase[] | null {
  return notesCache;
}

export function setCachedNotes(notes: readonly NoteBase[]): void {
  notesCache = [...notes];
}

export function clearNotesPersistenceCache(): void {
  notesCache = null;
}

export function loadNotesSync(): NoteBase[] {
  if (notesCache) return notesCache;
  if (isIndexedDbMigrationComplete()) {
    return [];
  }
  return loadNotesFromLocalStorage();
}

export async function migrateLocalStorageNotesToIndexedDb(): Promise<{ migrated: boolean; count: number }> {
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
      markNotesOnboardingComplete();
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
    markNotesOnboardingComplete();
  } else if (shouldSeedOnboardingNotes()) {
    notes = defaultSeedNotes();
    markNotesOnboardingComplete();
  } else {
    notes = [];
  }
  const ok = await saveNotesToIndexedDb(notes);
  if (!ok) throw new Error('IndexedDB migration write failed');

  markIndexedDbMigrationComplete();
  removeLegacyNotesKeyIfAllowed();
  return { migrated: true, count: notes.length };
}

export async function initNotesPersistence(): Promise<NotesPersistenceInitResult> {
  const migrationStarted = performance.now();

  if (!canUseIndexedDb()) {
    persistenceMode = 'localStorage';
    let notes = loadNotesFromLocalStorage();
    if (notes.length === 0) {
      notes = await resolveEmptyVaultNotes();
      if (notes.length > 0) saveNotesToLocalStorage(notes);
    }
    notesCache = notes;
    persistenceHydrated = true;
    runPersistenceCleanup();
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
    if (notes.length > 0) {
      markNotesOnboardingComplete();
    } else {
      const localRescue = loadNotesFromLocalStorage();
      if (localRescue.length > 0) {
        backupNotesBeforeDurabilityWrite('rescue-local-after-empty-idb', localRescue);
        resolved = localRescue;
      } else {
        resolved = await resolveEmptyVaultNotes();
      }
      if (resolved.length > 0) await saveNotesToIndexedDb(resolved);
    }
    persistenceMode = 'indexeddb';
    notesCache = resolved;
    persistenceHydrated = true;
    lastIndexedDbRevision = readNotesIndexedDbRevision();
    removeLegacyNotesKeyIfAllowed();
    runPersistenceCleanup();

    return {
      notes: resolved,
      mode: 'indexeddb',
      migrated: migration.migrated,
      migrationMs: loadStarted - migrationStarted,
      loadMs: performance.now() - loadStarted,
    };
  } catch {
    persistenceMode = 'localStorage';
    let notes = loadNotesFromLocalStorage();
    if (notes.length === 0) {
      notes = await resolveEmptyVaultNotes();
      if (notes.length > 0) saveNotesToLocalStorage(notes);
    }
    notesCache = notes;
    persistenceHydrated = true;
    runPersistenceCleanup();
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
  if (persistenceMode === 'indexeddb' && canUseIndexedDb()) {
    try {
      const notes = await loadNotesFromIndexedDb();
      if (notes.length > 0) markNotesOnboardingComplete();
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

export async function saveNotesAsync(notes: readonly NoteBase[]): Promise<boolean> {
  const epoch = captureOperationEpoch();
  if (!persistenceHydrated && notes.length === 0) {
    return true;
  }
  if (persistenceMode === 'indexeddb' && canUseIndexedDb()) {
    const ok = await saveNotesToIndexedDb(notes, () => isOperationEpochCurrent(epoch));
    assertCurrentOperationEpoch(epoch, 'replace_persisted_notes');
    if (ok) {
      notesCache = [...notes];
      removeLegacyNotesKeyIfAllowed();
      lastIndexedDbRevision = readNotesIndexedDbRevision();
      return true;
    }
    if (isRecoveryModeActive()) return false;
    persistenceMode = 'localStorage';
  }

  const ok = saveNotesToLocalStorage(notes);
  assertCurrentOperationEpoch(epoch, 'replace_persisted_notes');
  if (ok) notesCache = [...notes];
  return ok;
}

export async function deleteNoteFromPersistence(noteId: string): Promise<boolean> {
  if (!mayDeleteLegacyStorage()) {
    recordRecoveryBlock('delete_legacy_storage');
    return false;
  }
  if (notesCache) {
    notesCache = notesCache.filter(n => n.id !== noteId);
  }

  if (persistenceMode === 'indexeddb' && canUseIndexedDb()) {
    const ok = await deleteNoteFromIndexedDb(noteId);
    if (ok) {
      lastIndexedDbRevision = readNotesIndexedDbRevision();
      return true;
    }
    persistenceMode = 'localStorage';
  }

  if (!notesCache) return false;
  return saveNotesToLocalStorage(notesCache);
}

export async function clearNotesPersistence(): Promise<void> {
  if (!mayDeleteLegacyStorage()) {
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

export function hasNotesIndexedDbRevisionChanged(): boolean {
  const current = readNotesIndexedDbRevision();
  if (current === lastIndexedDbRevision) return false;
  lastIndexedDbRevision = current;
  return true;
}

export function resetNotesPersistenceForTests(): void {
  persistenceMode = 'localStorage';
  notesCache = null;
  lastIndexedDbRevision = 0;
  persistenceHydrated = false;
}

export { INDEXEDDB_FALLBACK_ERROR, NOTES_IDB_REV_KEY };

registerNotesStorageBridge(
  loadNotesSync,
  (notes) => {
    if (!persistenceHydrated && notes.length === 0) {
      return true;
    }
    if (persistenceMode === 'indexeddb') {
      void saveNotesAsync(notes);
      return true;
    }
    return saveNotesToLocalStorage(notes);
  },
);
