/**
 * K-96B — IndexedDB-backed note persistence (full note records, unchanged schema).
 */
import {
  normalizeNote,
  type NoteBase,
} from '@/components/views/noteUtils';
import {
  isRecoveryModeActive,
  mayDeleteLegacyStorage,
  mayReplacePersistedNotes,
  recordRecoveryBlock,
} from '@/lib/recoverySafetyPolicy';

export const NOTES_IDB_NAME = 'absinthe-notes-v1';
export const NOTES_IDB_STORE = 'notes';
export const NOTES_IDB_VERSION = 1;
export const NOTES_IDB_MIGRATION_FLAG = 'notes-indexeddb-migrated-v1';
export const NOTES_IDB_REV_KEY = 'notes-idb-rev-v1';

export const INDEXEDDB_FALLBACK_ERROR =
  'IndexedDB unavailable. Falling back to local storage.';

function canUseIndexedDb(): boolean {
  try {
    return typeof indexedDB !== 'undefined';
  } catch {
    return false;
  }
}

function openNotesDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!canUseIndexedDb()) {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const request = indexedDB.open(NOTES_IDB_NAME, NOTES_IDB_VERSION);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB open failed'));
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(NOTES_IDB_STORE)) {
        db.createObjectStore(NOTES_IDB_STORE, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
  });
}

function normalizeRecord(raw: unknown): NoteBase | null {
  if (!raw || typeof raw !== 'object') return null;
  const record = raw as Partial<NoteBase>;
  if (typeof record.id !== 'string' || !record.id.trim()) return null;
  return normalizeNote(record);
}

export function isIndexedDbMigrationComplete(): boolean {
  try {
    return localStorage.getItem(NOTES_IDB_MIGRATION_FLAG) === '1';
  } catch {
    return false;
  }
}

export function markIndexedDbMigrationComplete(): void {
  try {
    localStorage.setItem(NOTES_IDB_MIGRATION_FLAG, '1');
  } catch {
    /** ignore quota errors */
  }
}

export function bumpNotesIndexedDbRevision(): void {
  try {
    const prev = Number.parseInt(localStorage.getItem(NOTES_IDB_REV_KEY) ?? '0', 10);
    localStorage.setItem(NOTES_IDB_REV_KEY, String(Number.isFinite(prev) ? prev + 1 : 1));
  } catch {
    /** ignore quota errors */
  }
}

export function readNotesIndexedDbRevision(): number {
  try {
    const value = Number.parseInt(localStorage.getItem(NOTES_IDB_REV_KEY) ?? '0', 10);
    return Number.isFinite(value) ? value : 0;
  } catch {
    return 0;
  }
}

export async function isIndexedDbNotesEmpty(): Promise<boolean> {
  const db = await openNotesDb();
  try {
    return await new Promise<boolean>((resolve, reject) => {
      const tx = db.transaction(NOTES_IDB_STORE, 'readonly');
      const store = tx.objectStore(NOTES_IDB_STORE);
      const countReq = store.count();
      countReq.onerror = () => reject(countReq.error ?? new Error('IndexedDB count failed'));
      countReq.onsuccess = () => resolve((countReq.result ?? 0) === 0);
    });
  } finally {
    db.close();
  }
}

export async function loadNotesFromIndexedDb(): Promise<NoteBase[]> {
  const db = await openNotesDb();
  try {
    const records = await new Promise<NoteBase[]>((resolve, reject) => {
      const tx = db.transaction(NOTES_IDB_STORE, 'readonly');
      const store = tx.objectStore(NOTES_IDB_STORE);
      const req = store.getAll();
      req.onerror = () => reject(req.error ?? new Error('IndexedDB getAll failed'));
      req.onsuccess = () => {
        const raw = req.result;
        if (!Array.isArray(raw)) {
          resolve([]);
          return;
        }
        const notes = raw
          .map(normalizeRecord)
          .filter((note): note is NoteBase => note !== null)
          .sort((a, b) => b.updatedAt - a.updatedAt);
        resolve(notes);
      };
    });
    return records;
  } finally {
    db.close();
  }
}

export async function saveNotesToIndexedDb(
  notes: readonly NoteBase[],
  isEpochCurrent: () => boolean = () => true,
): Promise<boolean> {
  const db = await openNotesDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(NOTES_IDB_STORE, 'readwrite');
      const store = tx.objectStore(NOTES_IDB_STORE);
      tx.onerror = () => reject(tx.error ?? new Error('IndexedDB write transaction failed'));
      tx.onabort = () => reject(new Error('IndexedDB write transaction blocked'));
      tx.oncomplete = () => resolve();

      const keysReq = store.getAllKeys();
      keysReq.onerror = () => reject(keysReq.error ?? new Error('IndexedDB key read failed'));
      keysReq.onsuccess = () => {
        const current = keysReq.result.map(id => ({ id: String(id) }));
        if (!isEpochCurrent() || (isRecoveryModeActive() && !mayReplacePersistedNotes(current, notes))) {
          recordRecoveryBlock('replace_persisted_notes', isEpochCurrent() ? 'unsafe_replacement' : 'stale_operation_epoch');
          tx.abort();
          return;
        }
        const clearReq = store.clear();
        clearReq.onerror = () => reject(clearReq.error ?? new Error('IndexedDB clear failed'));
        clearReq.onsuccess = () => {
          if (!isEpochCurrent()) {
            recordRecoveryBlock('replace_persisted_notes', 'stale_operation_epoch');
            tx.abort();
            return;
          }
          for (const note of notes) {
            store.put(normalizeNote(note));
          }
        };
      };
    });
    bumpNotesIndexedDbRevision();
    return true;
  } catch {
    return false;
  } finally {
    db.close();
  }
}

export async function deleteNoteFromIndexedDb(noteId: string): Promise<boolean> {
  if (!mayDeleteLegacyStorage()) {
    recordRecoveryBlock('delete_legacy_storage');
    return false;
  }
  const db = await openNotesDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(NOTES_IDB_STORE, 'readwrite');
      const store = tx.objectStore(NOTES_IDB_STORE);
      tx.onerror = () => reject(tx.error ?? new Error('IndexedDB delete transaction failed'));
      tx.oncomplete = () => resolve();
      const req = store.delete(noteId);
      req.onerror = () => reject(req.error ?? new Error('IndexedDB delete failed'));
    });
    bumpNotesIndexedDbRevision();
    return true;
  } catch {
    return false;
  } finally {
    db.close();
  }
}

export async function clearIndexedDbNotes(): Promise<boolean> {
  if (!mayDeleteLegacyStorage()) {
    recordRecoveryBlock('delete_legacy_storage');
    return false;
  }
  const db = await openNotesDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(NOTES_IDB_STORE, 'readwrite');
      const store = tx.objectStore(NOTES_IDB_STORE);
      tx.onerror = () => reject(tx.error ?? new Error('IndexedDB clear transaction failed'));
      tx.oncomplete = () => resolve();
      const req = store.clear();
      req.onerror = () => reject(req.error ?? new Error('IndexedDB clear failed'));
    });
    bumpNotesIndexedDbRevision();
    return true;
  } finally {
    db.close();
  }
}

export async function countIndexedDbNotes(): Promise<number> {
  const db = await openNotesDb();
  try {
    return await new Promise<number>((resolve, reject) => {
      const tx = db.transaction(NOTES_IDB_STORE, 'readonly');
      const store = tx.objectStore(NOTES_IDB_STORE);
      const req = store.count();
      req.onerror = () => reject(req.error ?? new Error('IndexedDB count failed'));
      req.onsuccess = () => resolve(req.result ?? 0);
    });
  } finally {
    db.close();
  }
}

export { canUseIndexedDb };
