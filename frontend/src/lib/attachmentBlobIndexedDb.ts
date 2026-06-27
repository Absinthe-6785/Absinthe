import type {
  AttachmentBlobInventoryRecord,
  AttachmentBlobRecord,
  AttachmentBlobWrite,
  BlobStorageAdapter,
} from './attachmentRepository';

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
  createdAt?: string;
  updatedAt?: string;
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

function normalizeInventoryRecord(raw: unknown): AttachmentBlobInventoryRecord | null {
  if (!raw || typeof raw !== 'object') return null;
  const record = raw as Partial<PersistedAttachmentBlobRecord>;
  if (typeof record.key !== 'string' || !record.key.trim()) return null;
  const blobSize = record.blob && typeof record.blob.size === 'number' ? record.blob.size : undefined;
  const bytesSize = record.bytes instanceof ArrayBuffer ? record.bytes.byteLength : undefined;
  const size = Number.isFinite(record.size) ? Number(record.size) : blobSize ?? bytesSize ?? 0;
  const mimeType = typeof record.mimeType === 'string'
    ? record.mimeType
    : record.blob?.type || undefined;
  const inventoryPartial = !record.createdAt || !record.updatedAt || !Number.isFinite(record.size);
  return {
    localBlobKey: record.key,
    size,
    mimeType,
    createdAt: typeof record.createdAt === 'string' ? record.createdAt : undefined,
    updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : undefined,
    checksum: typeof record.checksum === 'string' ? record.checksum : undefined,
    inventoryPartial,
  };
}

export class LocalAttachmentBlobAdapter implements BlobStorageAdapter {
  async putBlob(input: AttachmentBlobWrite): Promise<AttachmentBlobRecord> {
    const now = new Date().toISOString();
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
      createdAt: now,
      updatedAt: now,
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

  async listBlobRecords(): Promise<AttachmentBlobInventoryRecord[]> {
    const db = await openAttachmentBlobDb();
    try {
      return await new Promise<AttachmentBlobInventoryRecord[]>((resolve, reject) => {
        const tx = db.transaction(ATTACHMENT_BLOB_STORE, 'readonly');
        const store = tx.objectStore(ATTACHMENT_BLOB_STORE);
        const request = store.getAll();
        request.onerror = () => reject(request.error ?? new Error('Attachment blob inventory read failed'));
        request.onsuccess = () => {
          const records = Array.isArray(request.result)
            ? request.result
              .map(normalizeInventoryRecord)
              .filter((item): item is AttachmentBlobInventoryRecord => item !== null)
              .sort((a, b) => a.localBlobKey.localeCompare(b.localBlobKey))
            : [];
          resolve(records);
        };
      });
    } finally {
      db.close();
    }
  }

  async getBlobInfo(key: string): Promise<AttachmentBlobInventoryRecord | null> {
    const db = await openAttachmentBlobDb();
    try {
      return await new Promise<AttachmentBlobInventoryRecord | null>((resolve, reject) => {
        const tx = db.transaction(ATTACHMENT_BLOB_STORE, 'readonly');
        const store = tx.objectStore(ATTACHMENT_BLOB_STORE);
        const request = store.get(key);
        request.onerror = () => reject(request.error ?? new Error('Attachment blob inventory lookup failed'));
        request.onsuccess = () => resolve(normalizeInventoryRecord(request.result));
      });
    } finally {
      db.close();
    }
  }

  async hasBlob(key: string): Promise<boolean> {
    return (await this.getBlobInfo(key)) !== null;
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
