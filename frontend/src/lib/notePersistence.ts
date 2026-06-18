/**
 * K-96B — Hybrid note persistence: IndexedDB primary, localStorage fallback.
 */
import {
  NOTES_KEY,
  defaultSeedNotes,
  loadRawNotesFromKey,
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

function saveNotesToLocalStorage(notes: readonly NoteBase[]): boolean {
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

  const idbEmpty = await isIndexedDbNotesEmpty();
  if (!idbEmpty) {
    markIndexedDbMigrationComplete();
    try { localStorage.removeItem(NOTES_KEY); } catch { /**/ }
    return { migrated: false, count: 0 };
  }

  const legacy = loadRawNotesFromKey(NOTES_KEY) ?? [];
  let notes: NoteBase[];
  if (legacy.length > 0) {
    notes = legacy;
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
  try { localStorage.removeItem(NOTES_KEY); } catch { /**/ }
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
      resolved = await resolveEmptyVaultNotes();
      if (resolved.length > 0) await saveNotesToIndexedDb(resolved);
    }
    persistenceMode = 'indexeddb';
    notesCache = resolved;
    persistenceHydrated = true;
    lastIndexedDbRevision = readNotesIndexedDbRevision();
    try { localStorage.removeItem(NOTES_KEY); } catch { /**/ }
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
  notesCache = [...notes];

  if (persistenceMode === 'indexeddb' && canUseIndexedDb()) {
    const ok = await saveNotesToIndexedDb(notes);
    if (ok) {
      try { localStorage.removeItem(NOTES_KEY); } catch { /**/ }
      lastIndexedDbRevision = readNotesIndexedDbRevision();
      return true;
    }
    persistenceMode = 'localStorage';
  }

  return saveNotesToLocalStorage(notes);
}

export async function deleteNoteFromPersistence(noteId: string): Promise<boolean> {
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
    notesCache = [...notes];
    if (persistenceMode === 'indexeddb') {
      void saveNotesAsync(notes);
      return true;
    }
    return saveNotesToLocalStorage(notes);
  },
);
