// @vitest-environment happy-dom
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AttachmentMetadata, BlobStorageAdapter } from './attachmentRepository';
import {
  ATTACHMENT_METADATA_DB_NAME,
  clearAttachmentMetadataIndexedDb,
  createLocalAttachmentMetadataRepository,
  normalizeAttachmentMetadata,
} from './attachmentMetadataIndexedDb';

const CREATED_AT = '2026-01-01T00:00:00.000Z';
const UPDATED_AT = '2026-01-02T00:00:00.000Z';

function sampleAttachment(id: string, noteId = 'note-1'): AttachmentMetadata {
  return {
    id,
    noteId,
    fileName: `${id}.pdf`,
    mimeType: 'application/pdf',
    size: 2048,
    checksum: `sha256:${id}`,
    localBlobKey: `local/${id}`,
    createdAt: CREATED_AT,
    updatedAt: UPDATED_AT,
    deletedAt: null,
    syncStatus: 'local',
  };
}

describe('attachment metadata IndexedDB repository', () => {
  beforeEach(async () => {
    try {
      await clearAttachmentMetadataIndexedDb();
    } catch {
      /** first open */
    }
  });

  it('uses an explicit local metadata store name', () => {
    expect(ATTACHMENT_METADATA_DB_NAME).toBe('absinthe.attachments.metadata');
  });

  it('creates and reads attachment metadata locally', async () => {
    const repo = createLocalAttachmentMetadataRepository();
    const attachment = sampleAttachment('att-1');

    await repo.putAttachment(attachment);

    await expect(repo.getAttachment('att-1')).resolves.toEqual(attachment);
  });

  it('lists attachment metadata by noteId', async () => {
    const repo = createLocalAttachmentMetadataRepository();

    await repo.putAttachment(sampleAttachment('att-1', 'note-1'));
    await repo.putAttachment(sampleAttachment('att-2', 'note-1'));
    await repo.putAttachment(sampleAttachment('att-3', 'note-2'));

    const noteAttachments = await repo.listAttachmentsForNote('note-1');
    expect(noteAttachments.map(item => item.id)).toEqual(['att-1', 'att-2']);
  });

  it('updates metadata while preserving id and createdAt', async () => {
    const repo = createLocalAttachmentMetadataRepository();
    await repo.putAttachment(sampleAttachment('att-1'));

    await repo.updateAttachment('att-1', {
      id: 'changed',
      createdAt: '2030-01-01T00:00:00.000Z',
      fileName: 'renamed.pdf',
      updatedAt: '2026-01-03T00:00:00.000Z',
    });

    await expect(repo.getAttachment('att-1')).resolves.toMatchObject({
      id: 'att-1',
      createdAt: CREATED_AT,
      fileName: 'renamed.pdf',
      updatedAt: '2026-01-03T00:00:00.000Z',
    });
    await expect(repo.getAttachment('changed')).resolves.toBeNull();
  });

  it('tombstones metadata instead of requiring hard delete', async () => {
    const repo = createLocalAttachmentMetadataRepository();
    await repo.putAttachment(sampleAttachment('att-1'));

    await repo.tombstoneAttachment('att-1', '2026-01-04T00:00:00.000Z');

    await expect(repo.getAttachment('att-1')).resolves.toMatchObject({
      deletedAt: '2026-01-04T00:00:00.000Z',
      updatedAt: '2026-01-04T00:00:00.000Z',
      syncStatus: 'deleted',
    });
  });

  it('persists metadata across repository reloads', async () => {
    const firstRepo = createLocalAttachmentMetadataRepository();
    await firstRepo.putAttachment(sampleAttachment('att-1'));

    const secondRepo = createLocalAttachmentMetadataRepository();

    await expect(secondRepo.getAttachment('att-1')).resolves.toMatchObject({
      id: 'att-1',
      localBlobKey: 'local/att-1',
    });
  });

  it('hard deletes metadata only when explicitly requested', async () => {
    const repo = createLocalAttachmentMetadataRepository();
    await repo.putAttachment(sampleAttachment('att-1'));

    await repo.deleteAttachmentMetadata('att-1');

    await expect(repo.getAttachment('att-1')).resolves.toBeNull();
  });

  it('rejects raw blob data inside metadata fields', () => {
    expect(() => normalizeAttachmentMetadata({
      ...sampleAttachment('att-1'),
      thumbnailKey: 'data:image/png;base64,AAA111',
    })).toThrow('Attachment metadata cannot contain raw blob data');
  });

  it('local metadata operations do not call remote blob adapters', async () => {
    const adapter: BlobStorageAdapter = {
      putBlob: vi.fn(),
      getBlob: vi.fn(),
      deleteBlob: vi.fn(),
      getObjectUrl: vi.fn(),
    };
    const repo = createLocalAttachmentMetadataRepository();

    await repo.putAttachment(sampleAttachment('att-1'));
    await repo.getAttachment('att-1');
    await repo.listAttachmentsForNote('note-1');
    await repo.tombstoneAttachment('att-1');

    expect(adapter.putBlob).not.toHaveBeenCalled();
    expect(adapter.getBlob).not.toHaveBeenCalled();
    expect(adapter.deleteBlob).not.toHaveBeenCalled();
    expect(adapter.getObjectUrl).not.toHaveBeenCalled();
  });
});
