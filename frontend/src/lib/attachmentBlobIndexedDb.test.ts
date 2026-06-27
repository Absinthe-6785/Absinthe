// @vitest-environment happy-dom
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ATTACHMENT_BLOB_DB_NAME,
  clearAttachmentBlobIndexedDb,
  createLocalAttachmentBlobAdapter,
} from './attachmentBlobIndexedDb';

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
