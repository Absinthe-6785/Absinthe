import {
  attachmentMetadataAccountId,
  isAttachmentMetadataLightweight,
  type AccountScopedAttachmentMetadata,
  type AttachmentMetadata,
  type AttachmentRepository,
  type AttachmentTimestamp,
  type ScopedAttachmentTombstoneInput,
  type ScopedAttachmentTombstoneResult,
  type AttachmentCreateStage,
  type ScopedAttachmentCreateContext,
} from './attachmentRepository';
import { addScopedAttachmentRecord, isScopedAttachmentCreateCurrent } from './attachmentScopedCreate';
import { getActiveNotesAuthorityRequest, isNotesAuthorityRequestActive } from './notesAccountAuthority';

export const ATTACHMENT_METADATA_DB_NAME = 'absinthe.attachments.metadata';
export const ATTACHMENT_METADATA_STORE = 'metadata';
export const ATTACHMENT_METADATA_DB_VERSION = 2;

function canUseIndexedDb(): boolean {
  try {
    return typeof indexedDB !== 'undefined';
  } catch {
    return false;
  }
}

function openAttachmentMetadataDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!canUseIndexedDb()) {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const request = indexedDB.open(ATTACHMENT_METADATA_DB_NAME, ATTACHMENT_METADATA_DB_VERSION);
    request.onerror = () => reject(request.error ?? new Error('Attachment metadata IndexedDB open failed'));
    request.onupgradeneeded = () => {
      const db = request.result;
      let store: IDBObjectStore;
      if (!db.objectStoreNames.contains(ATTACHMENT_METADATA_STORE)) {
        store = db.createObjectStore(ATTACHMENT_METADATA_STORE, { keyPath: 'id' });
        store.createIndex('noteId', 'noteId', { unique: false });
      } else {
        store = request.transaction!.objectStore(ATTACHMENT_METADATA_STORE);
      }
      if (!store.indexNames.contains('accountId')) store.createIndex('accountId', 'accountId', { unique: false });
    };
    request.onsuccess = () => resolve(request.result);
  });
}

function normalizeTimestamp(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

export function normalizeAttachmentMetadata(raw: AttachmentMetadata): AttachmentMetadata {
  const now = new Date().toISOString();
  const accountId = attachmentMetadataAccountId(raw);
  const metadata: AttachmentMetadata = {
    ...raw,
    id: raw.id.trim(),
    ...(accountId ? { accountId } : {}),
    noteId: raw.noteId?.trim() || undefined,
    fileName: accountId ? raw.fileName : raw.fileName.trim(),
    mimeType: raw.mimeType.trim(),
    size: Number.isFinite(raw.size) && raw.size >= 0 ? raw.size : 0,
    createdAt: normalizeTimestamp(raw.createdAt, now),
    updatedAt: normalizeTimestamp(raw.updatedAt, now),
    deletedAt: raw.deletedAt ?? null,
    syncStatus: raw.syncStatus ?? 'local',
  };

  if (!metadata.id) throw new Error('Attachment metadata requires an id');
  if (!metadata.fileName.trim()) throw new Error('Attachment metadata requires a fileName');
  if (!metadata.mimeType) throw new Error('Attachment metadata requires a mimeType');
  if (!isAttachmentMetadataLightweight(metadata)) {
    throw new Error('Attachment metadata cannot contain raw blob data');
  }
  return metadata;
}

function normalizeRecord(raw: unknown): AttachmentMetadata | null {
  if (!raw || typeof raw !== 'object') return null;
  try {
    return normalizeAttachmentMetadata(raw as AttachmentMetadata);
  } catch {
    return null;
  }
}

async function readAllMetadata(db: IDBDatabase): Promise<AttachmentMetadata[]> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(ATTACHMENT_METADATA_STORE, 'readonly');
    const store = tx.objectStore(ATTACHMENT_METADATA_STORE);
    const request = store.getAll();
    request.onerror = () => reject(request.error ?? new Error('Attachment metadata read failed'));
    request.onsuccess = () => {
      const records = Array.isArray(request.result)
        ? request.result
          .map(normalizeRecord)
          .filter((item): item is AttachmentMetadata => item !== null)
          .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        : [];
      resolve(records);
    };
  });
}

async function readMetadata(db: IDBDatabase, id: string): Promise<AttachmentMetadata | null> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(ATTACHMENT_METADATA_STORE, 'readonly');
    const store = tx.objectStore(ATTACHMENT_METADATA_STORE);
    const request = store.get(id);
    request.onerror = () => reject(request.error ?? new Error('Attachment metadata lookup failed'));
    request.onsuccess = () => resolve(normalizeRecord(request.result));
  });
}

async function writeMetadata(db: IDBDatabase, metadata: AttachmentMetadata): Promise<void> {
  const normalized = normalizeAttachmentMetadata(metadata);
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(ATTACHMENT_METADATA_STORE, 'readwrite');
    const store = tx.objectStore(ATTACHMENT_METADATA_STORE);
    tx.onerror = () => reject(tx.error ?? new Error('Attachment metadata write transaction failed'));
    tx.oncomplete = () => resolve();
    const request = store.put(normalized);
    request.onerror = () => reject(request.error ?? new Error('Attachment metadata write failed'));
  });
}

/** Compare all normalized metadata fields, including nested remote verification data. */
function metadataSnapshot(metadata: AttachmentMetadata): string {
  const seen = new WeakSet<object>();
  const data = (value: unknown): unknown => {
    if (value === undefined) return ['undefined'];
    if (value === null) return ['null'];
    if (typeof value === 'string' || typeof value === 'boolean') return [typeof value, value];
    if (typeof value === 'number' && Number.isFinite(value)) return ['number', Object.is(value, -0) ? '-0' : value];
    if (!value || typeof value !== 'object' || seen.has(value)) throw new Error('Unsupported metadata snapshot');
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null && prototype !== Array.prototype) throw new Error('Unsupported metadata shape');
    seen.add(value);
    const entries = Reflect.ownKeys(value).map(key => {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (typeof key !== 'string' || !descriptor || !('value' in descriptor)) throw new Error('Unsupported metadata slot');
      return [key, data(descriptor.value)];
    }).sort(([a], [b]) => String(a).localeCompare(String(b)));
    seen.delete(value);
    return [Array.isArray(value) ? 'array' : 'record', entries];
  };
  return JSON.stringify(data(metadata));
}

export class LocalAttachmentMetadataRepository implements AttachmentRepository {
  async createAttachmentForAccountNote(context: ScopedAttachmentCreateContext, metadata: AccountScopedAttachmentMetadata): Promise<AttachmentCreateStage> {
    const scope = Object.freeze({ ...context });
    const current = () => isScopedAttachmentCreateCurrent(scope);
    let record: AccountScopedAttachmentMetadata;
    try {
      record = structuredClone(metadata);
      if (!current() || record.accountId !== scope.accountId || record.noteId !== scope.noteId
        || record.id !== scope.attachmentId || record.deletedAt !== null || record.source !== 'local'
        || record.localBlobKey !== `local-image/${encodeURIComponent(scope.accountId)}/${scope.attachmentId}`) return 'DENIED';
      record = normalizeAttachmentMetadata(record) as AccountScopedAttachmentMetadata;
    } catch { return 'DENIED'; }
    let db: IDBDatabase;
    try { db = await openAttachmentMetadataDb(); } catch { return 'NOT_STARTED'; }
    try { return await addScopedAttachmentRecord(db, ATTACHMENT_METADATA_STORE, record, current); }
    finally { db.close(); }
  }

  async listAttachmentsForAccountNote(accountId: string, noteId: string): Promise<AccountScopedAttachmentMetadata[]> {
    if (!accountId || accountId !== accountId.trim() || !noteId || noteId !== noteId.trim()) return [];
    const db = await openAttachmentMetadataDb();
    try {
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(ATTACHMENT_METADATA_STORE, 'readonly');
        const request = tx.objectStore(ATTACHMENT_METADATA_STORE).index('accountId').getAll(accountId);
        request.onerror = () => reject(request.error ?? new Error('Attachment metadata scoped read failed'));
        request.onsuccess = () => resolve((Array.isArray(request.result) ? request.result : [])
          .filter((item: Partial<AccountScopedAttachmentMetadata>) => item.accountId === accountId && item.noteId === noteId)
          .map(normalizeRecord)
          .filter((item): item is AccountScopedAttachmentMetadata => item !== null)
          .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
      });
    } finally { db.close(); }
  }

  async tombstoneAttachmentForAccountNote(input: ScopedAttachmentTombstoneInput): Promise<ScopedAttachmentTombstoneResult> {
    const result = (status: ScopedAttachmentTombstoneResult['status']): ScopedAttachmentTombstoneResult => Object.freeze({ status });
    const request = input.request;
    const checkCurrent = input.isCurrent;
    const current = (): boolean => {
      try {
        return getActiveNotesAuthorityRequest() === request && request.accountId === input.accountId
          && isNotesAuthorityRequestActive(request) && checkCurrent() === true
          && getActiveNotesAuthorityRequest() === request && isNotesAuthorityRequestActive(request);
      } catch { return false; }
    };
    // Copy before the first await: callers cannot change the compared snapshot in flight.
    let expected: AccountScopedAttachmentMetadata;
    let fingerprint: string;
    const { accountId, noteId } = input;
    const deletedAt = input.deletedAt ?? new Date().toISOString();
    try {
      expected = normalizeAttachmentMetadata(structuredClone(input.expected)) as AccountScopedAttachmentMetadata;
      fingerprint = metadataSnapshot(expected);
      if (!accountId || accountId !== accountId.trim() || !noteId || noteId !== noteId.trim()
        || expected.accountId !== accountId || expected.noteId !== noteId || expected.deletedAt
        || !deletedAt.trim() || !current()) return result('DENIED');
    } catch { return result('DENIED'); }
    let db: IDBDatabase;
    try { db = await openAttachmentMetadataDb(); } catch { return result('NOT_STARTED'); }
    try {
      if (!current()) return result('DENIED');
      return await new Promise<ScopedAttachmentTombstoneResult>(resolve => {
        let tx: IDBTransaction;
        try { tx = db.transaction(ATTACHMENT_METADATA_STORE, 'readwrite'); }
        catch { resolve(result('NOT_STARTED')); return; }
        let settled = false;
        let putIssued = false;
        const finish = (status: ScopedAttachmentTombstoneResult['status']) => {
          if (!settled) { settled = true; resolve(result(status)); }
        };
        // Install before requests. Only actual terminal events establish commit/abort.
        tx.addEventListener('complete', () => finish(putIssued ? 'TOMBSTONED' : 'DENIED'));
        tx.addEventListener('abort', () => finish('ABORTED'));
        tx.addEventListener('error', () => finish('INDETERMINATE'));
        const abort = () => {
          try { tx.abort(); } catch { finish('INDETERMINATE'); }
        };
        try {
          const store = tx.objectStore(ATTACHMENT_METADATA_STORE);
          const lookup = store.get(expected.id);
          lookup.addEventListener('error', () => finish('INDETERMINATE'));
          lookup.addEventListener('success', () => {
            if (settled) return;
            try {
              const raw = lookup.result as Partial<AccountScopedAttachmentMetadata> | undefined;
              const record = normalizeRecord(raw);
              if (!raw || raw.accountId !== accountId || raw.noteId !== noteId || raw.id !== expected.id
                || !record || (record as AccountScopedAttachmentMetadata).accountId !== accountId
                || record.noteId !== noteId || record.id !== expected.id || record.deletedAt
                || metadataSnapshot(record) !== fingerprint || !current()) return;
              // No await between read, exact-record check, final authority check and put.
              const write = store.put({ ...record, deletedAt, updatedAt: deletedAt, syncStatus: 'deleted' });
              putIssued = true;
              write.addEventListener('error', () => finish('INDETERMINATE'));
            } catch { abort(); }
          });
        } catch { abort(); }
      });
    } finally {
      // close() is not abort proof; queued authorized work may still commit.
      db.close();
    }
  }

  async listAttachments(): Promise<AttachmentMetadata[]> {
    const db = await openAttachmentMetadataDb();
    try {
      return await readAllMetadata(db);
    } finally {
      db.close();
    }
  }

  async listAttachmentsForAccount(accountId: string): Promise<AccountScopedAttachmentMetadata[]> {
    const normalizedAccountId = accountId.trim();
    if (!normalizedAccountId) return [];
    const db = await openAttachmentMetadataDb();
    try {
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(ATTACHMENT_METADATA_STORE, 'readonly');
        const request = tx.objectStore(ATTACHMENT_METADATA_STORE).index('accountId').getAll(normalizedAccountId);
        request.onerror = () => reject(request.error ?? new Error('Attachment metadata account read failed'));
        request.onsuccess = () => resolve((Array.isArray(request.result) ? request.result : [])
          .map(normalizeRecord)
          .filter((item): item is AccountScopedAttachmentMetadata => item !== null
            && attachmentMetadataAccountId(item) === normalizedAccountId)
          .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
      });
    } finally {
      db.close();
    }
  }

  async listAttachmentsForNote(noteId: string): Promise<AttachmentMetadata[]> {
    const normalizedNoteId = noteId.trim();
    const all = await this.listAttachments();
    return all.filter(metadata => metadata.noteId === normalizedNoteId);
  }

  async getAttachment(id: string): Promise<AttachmentMetadata | null> {
    const db = await openAttachmentMetadataDb();
    try {
      return await readMetadata(db, id);
    } finally {
      db.close();
    }
  }

  async putAttachment(metadata: AttachmentMetadata): Promise<void> {
    const db = await openAttachmentMetadataDb();
    try {
      await writeMetadata(db, metadata);
    } finally {
      db.close();
    }
  }

  async updateAttachment(id: string, patch: Partial<AttachmentMetadata>): Promise<void> {
    const current = await this.getAttachment(id);
    if (!current) return;
    await this.putAttachment({
      ...current,
      ...patch,
      id: current.id,
      createdAt: current.createdAt,
    });
  }

  async tombstoneAttachment(id: string, deletedAt: AttachmentTimestamp = new Date().toISOString()): Promise<void> {
    await this.updateAttachment(id, {
      deletedAt,
      updatedAt: deletedAt,
      syncStatus: 'deleted',
    });
  }

  async deleteAttachmentMetadata(id: string): Promise<void> {
    const db = await openAttachmentMetadataDb();
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(ATTACHMENT_METADATA_STORE, 'readwrite');
        const store = tx.objectStore(ATTACHMENT_METADATA_STORE);
        tx.onerror = () => reject(tx.error ?? new Error('Attachment metadata delete transaction failed'));
        tx.oncomplete = () => resolve();
        const request = store.delete(id);
        request.onerror = () => reject(request.error ?? new Error('Attachment metadata delete failed'));
      });
    } finally {
      db.close();
    }
  }

  async deleteAttachmentMetadataForAccount(id: string, accountId: string): Promise<boolean> {
    const normalizedAccountId = accountId.trim();
    if (!normalizedAccountId) return false;
    const db = await openAttachmentMetadataDb();
    try {
      return await new Promise<boolean>((resolve, reject) => {
        const tx = db.transaction(ATTACHMENT_METADATA_STORE, 'readwrite');
        const store = tx.objectStore(ATTACHMENT_METADATA_STORE);
        const request = store.get(id);
        let deleted = false;
        request.onerror = () => reject(request.error ?? new Error('Attachment metadata scoped lookup failed'));
        request.onsuccess = () => {
          const current = normalizeRecord(request.result);
          if (current && attachmentMetadataAccountId(current) === normalizedAccountId) {
            store.delete(id);
            deleted = true;
          }
        };
        tx.onerror = () => reject(tx.error ?? new Error('Attachment metadata scoped delete failed'));
        tx.oncomplete = () => resolve(deleted);
      });
    } finally {
      db.close();
    }
  }

  async putMetadata(metadata: AttachmentMetadata): Promise<AttachmentMetadata> {
    const normalized = normalizeAttachmentMetadata(metadata);
    await this.putAttachment(normalized);
    return normalized;
  }

  async getMetadata(id: string): Promise<AttachmentMetadata | null> {
    return this.getAttachment(id);
  }

  async listForNote(noteId: string): Promise<AttachmentMetadata[]> {
    return this.listAttachmentsForNote(noteId);
  }

  async markDeleted(id: string, deletedAt: AttachmentTimestamp): Promise<AttachmentMetadata | null> {
    await this.tombstoneAttachment(id, deletedAt);
    return this.getAttachment(id);
  }
}

export function createLocalAttachmentMetadataRepository(): AttachmentRepository {
  return new LocalAttachmentMetadataRepository();
}

export async function clearAttachmentMetadataIndexedDb(): Promise<void> {
  const db = await openAttachmentMetadataDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(ATTACHMENT_METADATA_STORE, 'readwrite');
      const store = tx.objectStore(ATTACHMENT_METADATA_STORE);
      tx.onerror = () => reject(tx.error ?? new Error('Attachment metadata clear transaction failed'));
      tx.oncomplete = () => resolve();
      const request = store.clear();
      request.onerror = () => reject(request.error ?? new Error('Attachment metadata clear failed'));
    });
  } finally {
    db.close();
  }
}
