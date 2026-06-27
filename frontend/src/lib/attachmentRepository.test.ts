import { describe, expect, it } from 'vitest';
import {
  attachmentMarkdownImage,
  attachmentReference,
  isAttachmentMetadataLightweight,
  isAttachmentReference,
  noteBodyContainsRawBlob,
  type AttachmentMetadata,
  type BlobStorageAdapter,
} from './attachmentRepository';

describe('attachment repository boundary', () => {
  it('formats note body references without raw blob data', () => {
    const ref = attachmentReference('att-123');

    expect(ref).toBe('attachment://att-123');
    expect(isAttachmentReference(ref)).toBe(true);
    expect(noteBodyContainsRawBlob(`see ${ref}`)).toBe(false);
  });

  it('formats markdown image references through attachment ids', () => {
    expect(attachmentMarkdownImage('att-abc', 'scan] copy')).toBe('![scan\\] copy](attachment://att-abc)');
  });

  it('rejects raw blob data as attachment identity', () => {
    expect(() => attachmentReference('data:image/png;base64,AAA111')).toThrow('Invalid attachment id');
    expect(isAttachmentReference('attachment://data:image/png;base64,AAA111')).toBe(false);
  });

  it('keeps attachment metadata lightweight', () => {
    const metadata: AttachmentMetadata = {
      id: 'att-1',
      noteId: 'note-1',
      fileName: 'scan.pdf',
      mimeType: 'application/pdf',
      size: 1234,
      checksum: 'sha256:abc',
      localBlobKey: 'local/att-1',
      remoteBlobKey: 'remote/att-1',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
      deletedAt: null,
      syncStatus: 'dirty',
    };

    expect(isAttachmentMetadataLightweight(metadata)).toBe(true);
    expect(isAttachmentMetadataLightweight({
      ...metadata,
      localBlobKey: 'data:application/pdf;base64,BBB222',
    })).toBe(false);
  });

  it('allows a local adapter boundary without remote behavior', async () => {
    const records = new Map<string, Blob>();
    const adapter: BlobStorageAdapter = {
      async putBlob(input) {
        records.set(input.key, input.blob);
        return {
          key: input.key,
          blob: input.blob,
          mimeType: input.mimeType,
          size: input.blob.size,
          checksum: input.checksum,
        };
      },
      async getBlob(key) {
        const blob = records.get(key);
        return blob ? { key, blob, size: blob.size } : null;
      },
      async deleteBlob(key) {
        records.delete(key);
      },
      async getObjectUrl() {
        return null;
      },
    };

    const blob = new Blob(['hello'], { type: 'text/plain' });
    await expect(adapter.putBlob({ key: 'local/att-1', blob, mimeType: blob.type })).resolves.toMatchObject({
      key: 'local/att-1',
      mimeType: 'text/plain',
      size: 5,
    });
    await expect(adapter.getBlob('local/att-1')).resolves.toMatchObject({ key: 'local/att-1', size: 5 });
    await adapter.deleteBlob('local/att-1');
    await expect(adapter.getBlob('local/att-1')).resolves.toBeNull();
  });
});
