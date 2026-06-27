import type { AttachmentBlobRecord, AttachmentBlobWrite, BlobStorageAdapter } from './attachmentRepository';

export const ATTACHMENT_BLOB_DB_NAME = 'absinthe.attachments.blobs';
export const ATTACHMENT_BLOB_STORE = 'blobs';
export const ATTACHMENT_BLOB_DB_VERSION = 1;

function canUseIndexedDb(): boolean {
  try {
    return typeof indexedDB !== 'undefined';
  } catch {
    return false;
  }
}

function openAttachmentBlobDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!canUseIndexedDb()) {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const request = indexedDB.open(ATTACHMENT_BLOB_DB_NAME, ATTACHMENT_BLOB_DB_VERSION);
    request.onerror = () => reject(request.error ?? new Error('Attachment blob IndexedDB open failed'));
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(ATTACHMENT_BLOB_STORE)) {
        db.createObjectStore(ATTACHMENT_BLOB_STORE, { keyPath: 'key' });
      }
    };
    request.onsuccess = () => resolve(request.result);
  });
}

interface PersistedAttachmentBlobRecord {
  key: string;
  bytes?: ArrayBuffer;
  blob?: Blob;
  mimeType?: string;
  size: number;
  checksum?: string;
}

function normalizeRecord(raw: unknown): AttachmentBlobRecord | null {
  if (!raw || typeof raw !== 'object') return null;
  const record = raw as Partial<PersistedAttachmentBlobRecord>;
  if (typeof record.key !== 'string' || !record.key.trim()) return null;
  const mimeType = typeof record.mimeType === 'string' ? record.mimeType : record.blob?.type || undefined;
  const blob = record.bytes
    ? new Blob([record.bytes], { type: mimeType })
    : record.blob;
  if (!blob || typeof blob !== 'object' || typeof blob.size !== 'number') return null;
  return {
    key: record.key,
    blob,
    mimeType,
    size: Number.isFinite(record.size) ? Number(record.size) : blob.size,
    checksum: typeof record.checksum === 'string' ? record.checksum : undefined,
  };
}

export class LocalAttachmentBlobAdapter implements BlobStorageAdapter {
  async putBlob(input: AttachmentBlobWrite): Promise<AttachmentBlobRecord> {
    const bytes = typeof input.blob.arrayBuffer === 'function'
      ? await input.blob.arrayBuffer()
      : undefined;
    const record: PersistedAttachmentBlobRecord = {
      key: input.key,
      blob: bytes ? undefined : input.blob,
      bytes,
      mimeType: input.mimeType ?? (input.blob.type || undefined),
      size: input.blob.size,
      checksum: input.checksum,
    };
    const db = await openAttachmentBlobDb();
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(ATTACHMENT_BLOB_STORE, 'readwrite');
        const store = tx.objectStore(ATTACHMENT_BLOB_STORE);
        tx.onerror = () => reject(tx.error ?? new Error('Attachment blob write transaction failed'));
        tx.oncomplete = () => resolve();
        const request = store.put(record);
        request.onerror = () => reject(request.error ?? new Error('Attachment blob write failed'));
      });
      return {
        key: record.key,
        blob: input.blob,
        mimeType: record.mimeType,
        size: record.size,
        checksum: record.checksum,
      };
    } finally {
      db.close();
    }
  }

  async getBlob(key: string): Promise<AttachmentBlobRecord | null> {
    const db = await openAttachmentBlobDb();
    try {
      return await new Promise<AttachmentBlobRecord | null>((resolve, reject) => {
        const tx = db.transaction(ATTACHMENT_BLOB_STORE, 'readonly');
        const store = tx.objectStore(ATTACHMENT_BLOB_STORE);
        const request = store.get(key);
        request.onerror = () => reject(request.error ?? new Error('Attachment blob read failed'));
        request.onsuccess = () => resolve(normalizeRecord(request.result));
      });
    } finally {
      db.close();
    }
  }

  async deleteBlob(key: string): Promise<void> {
    const db = await openAttachmentBlobDb();
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(ATTACHMENT_BLOB_STORE, 'readwrite');
        const store = tx.objectStore(ATTACHMENT_BLOB_STORE);
        tx.onerror = () => reject(tx.error ?? new Error('Attachment blob delete transaction failed'));
        tx.oncomplete = () => resolve();
        const request = store.delete(key);
        request.onerror = () => reject(request.error ?? new Error('Attachment blob delete failed'));
      });
    } finally {
      db.close();
    }
  }

  async getObjectUrl(key: string): Promise<string | null> {
    const record = await this.getBlob(key);
    if (!record) return null;
    return URL.createObjectURL(record.blob);
  }

  revokeObjectUrl(url: string): void {
    URL.revokeObjectURL(url);
  }
}

export function createLocalAttachmentBlobAdapter(): BlobStorageAdapter {
  return new LocalAttachmentBlobAdapter();
}

export async function clearAttachmentBlobIndexedDb(): Promise<void> {
  const db = await openAttachmentBlobDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(ATTACHMENT_BLOB_STORE, 'readwrite');
      const store = tx.objectStore(ATTACHMENT_BLOB_STORE);
      tx.onerror = () => reject(tx.error ?? new Error('Attachment blob clear transaction failed'));
      tx.oncomplete = () => resolve();
      const request = store.clear();
      request.onerror = () => reject(request.error ?? new Error('Attachment blob clear failed'));
    });
  } finally {
    db.close();
  }
}
