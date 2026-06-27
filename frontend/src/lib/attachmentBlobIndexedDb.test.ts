// @vitest-environment happy-dom
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ATTACHMENT_BLOB_DB_NAME,
  ATTACHMENT_BLOB_DB_VERSION,
  ATTACHMENT_BLOB_STORE,
  clearAttachmentBlobIndexedDb,
  createLocalAttachmentBlobAdapter,
} from './attachmentBlobIndexedDb';

async function writeLegacyBlobRecord(record: unknown): Promise<void> {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(ATTACHMENT_BLOB_DB_NAME, ATTACHMENT_BLOB_DB_VERSION);
    request.onerror = () => reject(request.error ?? new Error('open failed'));
    request.onsuccess = () => resolve(request.result);
  });
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(ATTACHMENT_BLOB_STORE, 'readwrite');
      const store = tx.objectStore(ATTACHMENT_BLOB_STORE);
      tx.onerror = () => reject(tx.error ?? new Error('write failed'));
      tx.oncomplete = () => resolve();
      store.put(record);
    });
  } finally {
    db.close();
  }
}

describe('local attachment blob adapter', () => {
  beforeEach(async () => {
    try {
      await clearAttachmentBlobIndexedDb();
    } catch {
      /** first open */
    }
  });

  it('uses an explicit local blob store name', () => {
    expect(ATTACHMENT_BLOB_DB_NAME).toBe('absinthe.attachments.blobs');
  });

  it('stores and retrieves an image Blob by local key', async () => {
    const adapter = createLocalAttachmentBlobAdapter();
    const blob = new Blob(['image-bytes'], { type: 'image/png' });

    await adapter.putBlob({ key: 'local-image/att-1', blob, mimeType: blob.type });

    await expect(adapter.getBlob('local-image/att-1')).resolves.toMatchObject({
      key: 'local-image/att-1',
      mimeType: 'image/png',
      size: 11,
    });
  });

  it('lists blob inventory records without returning raw Blob bytes', async () => {
    const adapter = createLocalAttachmentBlobAdapter();
    const blob = new Blob(['image-bytes'], { type: 'image/png' });

    await adapter.putBlob({
      key: 'local-image/att-1',
      blob,
      mimeType: blob.type,
      checksum: 'fnv1a:image',
    });

    const inventory = await adapter.listBlobRecords?.();
    expect(inventory).toEqual([expect.objectContaining({
      localBlobKey: 'local-image/att-1',
      mimeType: 'image/png',
      size: 11,
      checksum: 'fnv1a:image',
      inventoryPartial: false,
    })]);
    expect(inventory?.[0]).not.toHaveProperty('blob');
    expect(inventory?.[0]).not.toHaveProperty('bytes');
    expect(inventory?.[0]).not.toHaveProperty('base64');
    expect(inventory?.[0]?.createdAt).toMatch(/^\d{4}-/);
    expect(inventory?.[0]?.updatedAt).toMatch(/^\d{4}-/);
  });

  it('returns blob info and hasBlob state without exposing raw bytes', async () => {
    const adapter = createLocalAttachmentBlobAdapter();

    await adapter.putBlob({
      key: 'local-image/att-1',
      blob: new Blob(['image'], { type: 'image/webp' }),
      mimeType: 'image/webp',
    });

    await expect(adapter.hasBlob?.('local-image/att-1')).resolves.toBe(true);
    await expect(adapter.hasBlob?.('local-image/missing')).resolves.toBe(false);
    const info = await adapter.getBlobInfo?.('local-image/att-1');
    expect(info).toMatchObject({
      localBlobKey: 'local-image/att-1',
      mimeType: 'image/webp',
      size: 5,
    });
    expect(info).not.toHaveProperty('blob');
    expect(info).not.toHaveProperty('bytes');
  });

  it('handles old partial blob records gracefully in inventory', async () => {
    const adapter = createLocalAttachmentBlobAdapter();

    await writeLegacyBlobRecord({
      key: 'local-image/legacy',
      blob: new Blob(['legacy'], { type: 'image/gif' }),
      size: 6,
    });

    await expect(adapter.listBlobRecords?.()).resolves.toEqual([expect.objectContaining({
      localBlobKey: 'local-image/legacy',
      mimeType: 'image/gif',
      size: 6,
      inventoryPartial: true,
    })]);
  });

  it('creates and revokes object URLs safely', async () => {
    const createSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:local-preview');
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const adapter = createLocalAttachmentBlobAdapter();

    await adapter.putBlob({
      key: 'local-image/att-1',
      blob: new Blob(['image'], { type: 'image/webp' }),
      mimeType: 'image/webp',
    });

    await expect(adapter.getObjectUrl('local-image/att-1')).resolves.toBe('blob:local-preview');
    adapter.revokeObjectUrl?.('blob:local-preview');

    expect(createSpy).toHaveBeenCalledTimes(1);
    expect(revokeSpy).toHaveBeenCalledWith('blob:local-preview');
    createSpy.mockRestore();
    revokeSpy.mockRestore();
  });

  it('deletes blobs explicitly', async () => {
    const adapter = createLocalAttachmentBlobAdapter();

    await adapter.putBlob({
      key: 'local-image/att-1',
      blob: new Blob(['image'], { type: 'image/png' }),
    });
    await adapter.deleteBlob('local-image/att-1');

    await expect(adapter.getBlob('local-image/att-1')).resolves.toBeNull();
  });
});
