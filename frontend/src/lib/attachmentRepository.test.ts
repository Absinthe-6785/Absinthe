import { describe, expect, it } from 'vitest';
import {
  attachmentMarkdownImage,
  attachmentReference,
  findAttachmentReferencesInText,
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

  it('finds only complete canonical attachment references in text', () => {
    expect(findAttachmentReferencesInText([
      'attachment://asset-1',
      '(attachment://abc)',
      '[attachment://ABC]',
      'attachment://asset_1,',
      'attachment://asset-1',
    ].join(' '))).toEqual(['asset-1', 'abc', 'ABC', 'asset_1']);

    expect(findAttachmentReferencesInText([
      'notattachment://asset-1', 'xattachment://asset-1', 'pre-attachment://asset-1',
      'myattachment://asset-1', 'https://example.com/attachment://asset-1',
      'attachment://asset%2F1', 'attachment://asset%201', 'attachment://asset/child',
      'attachment://asset\\child', 'attachment://asset?query', 'attachment://asset#fragment',
      'attachment://asset%', 'attachment://asset%ZZ',
      'attachment:\\/\\/asset-1', 'attachment%3A%2F%2Fasset-1', 'ATTACHMENT://asset-1',
    ].join(' '))).toEqual([]);
  });

  it('applies deterministic case-sensitive Unicode and zero-width token boundaries', () => {
    expect(findAttachmentReferencesInText([
      'attachment://asset-1', 'attachment://Asset-1', 'attachment://asset-1',
      '\uD55Cattachment://blocked-before', 'attachment://blocked-after\uD55C',
      '\u200battachment://blocked-zero-before', 'attachment://blocked-zero-after\u200b',
      '\uFF08attachment://fullwidth\uFF09', '\u{1F600}attachment://emoji\u{1F600}',
      '\nattachment://newline\n', 'attachment://colon:',
    ].join(' '))).toEqual(['asset-1', 'Asset-1', 'fullwidth', 'emoji', 'newline', 'colon:']);
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
