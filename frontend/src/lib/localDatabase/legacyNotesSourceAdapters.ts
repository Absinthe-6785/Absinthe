import { LocalDatabaseError } from './errors';
import {
  legacyNotesAuthorityReference, type LegacyNotesSourceAuthorityRecordV1,
} from './legacyNotesAuthority';
import type { LegacyNotesSourceAdapter, LegacyNotesSourceCapture, LegacyNotesSourceRecord } from './legacyNotesMigration';

export const LEGACY_NOTES_INDEXED_DB_NAME = 'absinthe-notes-v1';
export const LEGACY_NOTES_INDEXED_DB_STORE = 'notes';
export const LEGACY_NOTES_INDEXED_DB_VERSION = 1;
export const LEGACY_NOTES_LOCAL_STORAGE_KEY = 'notes-v2';

export interface LegacyNotesAdapterOptions {
  authority: LegacyNotesSourceAuthorityRecordV1;
  clock?: () => string;
}

function unavailable(): never { throw new LocalDatabaseError('LEGACY_SOURCE_UNAVAILABLE', 'capture_legacy_notes_source'); }
function capturedAt(clock: (() => string) | undefined): string {
  const value = (clock ?? (() => new Date().toISOString()))();
  if (!Number.isFinite(Date.parse(value))) throw new LocalDatabaseError('INVALID_LEGACY_MIGRATION', 'capture_legacy_notes_source');
  return value;
}
function openExistingLegacyDatabase(factory: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    let state: 'pending' | 'resolved' | 'rejected' = 'pending';
    const closedLateDatabases = new WeakSet<IDBDatabase>();
    const unavailable = (operation: 'list_legacy_databases' | 'open_legacy_database') =>
      new LocalDatabaseError('LEGACY_SOURCE_UNAVAILABLE', operation);
    const rejectOnce = (operation: 'list_legacy_databases' | 'open_legacy_database'): boolean => {
      if (state !== 'pending') return false;
      state = 'rejected'; reject(unavailable(operation)); return true;
    };
    const closeLateDatabase = (database: IDBDatabase): void => {
      if (closedLateDatabases.has(database)) return;
      closedLateDatabases.add(database);
      try { database.close(); } catch { /* bounded cleanup */ }
    };
    const resolveOnce = (database: IDBDatabase): boolean => {
      if (state === 'rejected') { closeLateDatabase(database); return false; }
      if (state === 'resolved') return false;
      state = 'resolved'; resolve(database); return true;
    };

    void (async () => {
      try {
        if (typeof factory.databases !== 'function') { rejectOnce('list_legacy_databases'); return; }
        const databases = await factory.databases();
        if (!databases.some(item => item.name === LEGACY_NOTES_INDEXED_DB_NAME)) {
          rejectOnce('open_legacy_database'); return;
        }
        const request = factory.open(LEGACY_NOTES_INDEXED_DB_NAME);
        request.onupgradeneeded = () => {
          try { request.transaction?.abort(); } catch { /* bounded abort */ }
          rejectOnce('open_legacy_database');
        };
        request.onblocked = () => { rejectOnce('open_legacy_database'); };
        request.onerror = () => { rejectOnce('open_legacy_database'); };
        request.onsuccess = () => {
          let database: IDBDatabase;
          try { database = request.result; }
          catch { rejectOnce('open_legacy_database'); return; }
          resolveOnce(database);
        };
      } catch { rejectOnce('open_legacy_database'); }
    })();
  });
}

export function createLegacyNotesIndexedDbAdapter(
  options: LegacyNotesAdapterOptions & { indexedDB?: IDBFactory },
): LegacyNotesSourceAdapter {
  const factory = options.indexedDB ?? globalThis.indexedDB;
  const authority = legacyNotesAuthorityReference(options.authority);
  if (authority.sourceType !== 'indexeddb' || authority.sourceInstanceId !== 'absinthe-notes-v1.notes.v1') {
    throw new LocalDatabaseError('LEGACY_SOURCE_IDENTITY_MISMATCH', 'create_legacy_notes_indexeddb_adapter');
  }
  return Object.freeze({
    ...authority,
    adapter: 'absinthe_notes_indexeddb_v1', schemaVersion: LEGACY_NOTES_INDEXED_DB_VERSION,
    async capture(): Promise<LegacyNotesSourceCapture> {
      if (!factory) unavailable();
      const db = await openExistingLegacyDatabase(factory);
      try {
        if (db.version !== LEGACY_NOTES_INDEXED_DB_VERSION || !db.objectStoreNames.contains(LEGACY_NOTES_INDEXED_DB_STORE)) unavailable();
        const tx = db.transaction(LEGACY_NOTES_INDEXED_DB_STORE, 'readonly');
        const store = tx.objectStore(LEGACY_NOTES_INDEXED_DB_STORE);
        const keysRequest = store.getAllKeys(); const valuesRequest = store.getAll();
        const [keys, values] = await Promise.all([
          new Promise<IDBValidKey[]>((resolve, reject) => {
            keysRequest.onsuccess = () => resolve(keysRequest.result); keysRequest.onerror = () => reject(keysRequest.error);
          }),
          new Promise<unknown[]>((resolve, reject) => {
            valuesRequest.onsuccess = () => resolve(valuesRequest.result); valuesRequest.onerror = () => reject(valuesRequest.error);
          }),
        ]);
        await new Promise<void>((resolve, reject) => {
          tx.oncomplete = () => resolve(); tx.onabort = () => reject(tx.error); tx.onerror = () => undefined;
        });
        if (keys.length !== values.length) throw new LocalDatabaseError('INVALID_LEGACY_MIGRATION', 'capture_legacy_notes_source');
        const records: LegacyNotesSourceRecord[] = values.map((value, index) => ({
          legacyKey: String(keys[index]), value, ownership: { kind: 'bound', namespaceKey: authority.namespaceKey },
        }));
        return { capturedAt: capturedAt(options.clock), records };
      } finally { db.close(); }
    },
  });
}

export function createLegacyNotesLocalStorageAdapter(
  options: LegacyNotesAdapterOptions & { source: Pick<Storage, 'getItem'> },
): LegacyNotesSourceAdapter {
  const authority = legacyNotesAuthorityReference(options.authority);
  if (authority.sourceType !== 'localstorage' || authority.sourceInstanceId !== 'localStorage.notes-v2') {
    throw new LocalDatabaseError('LEGACY_SOURCE_IDENTITY_MISMATCH', 'create_legacy_notes_localstorage_adapter');
  }
  return Object.freeze({
    ...authority,
    adapter: 'absinthe_notes_localstorage_v2', schemaVersion: 2,
    async capture(): Promise<LegacyNotesSourceCapture> {
      let raw: string | null;
      try { raw = options.source.getItem(LEGACY_NOTES_LOCAL_STORAGE_KEY); }
      catch { throw new LocalDatabaseError('LEGACY_SOURCE_UNAVAILABLE', 'capture_legacy_notes_source'); }
      if (raw === null) unavailable();
      let values: unknown;
      try { values = JSON.parse(raw); } catch { throw new LocalDatabaseError('INVALID_LEGACY_MIGRATION', 'capture_legacy_notes_source'); }
      if (!Array.isArray(values)) throw new LocalDatabaseError('INVALID_LEGACY_MIGRATION', 'capture_legacy_notes_source');
      const records: LegacyNotesSourceRecord[] = values.map((value, index) => ({
        legacyKey: value && typeof value === 'object' && typeof (value as { id?: unknown }).id === 'string'
          ? (value as { id: string }).id : `invalid-${index}`,
        value, ownership: { kind: 'bound', namespaceKey: authority.namespaceKey },
      }));
      return { capturedAt: capturedAt(options.clock), records };
    },
  });
}
