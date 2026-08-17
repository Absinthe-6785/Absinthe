// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { noteSyncPayload } from '@/components/views/noteUtils';
import type { AttachmentMetadata, AttachmentRepository, BlobStorageAdapter } from './attachmentRepository';
import {
  appendAttachmentReferenceToBody,
  attachLocalImageToNote,
  validateLocalImageFile,
} from './localImageAttachments';

function imageFile(name = 'scan.png', type = 'image/png') {
  return new File(['image-bytes'], name, { type });
}

function memoryRepository(): AttachmentRepository & { records: Map<string, AttachmentMetadata> } {
  const records = new Map<string, AttachmentMetadata>();
  return {
    records,
    async listAttachments() { return [...records.values()]; },
    async listAttachmentsForNote(noteId) { return [...records.values()].filter(item => item.noteId === noteId); },
    async getAttachment(id) { return records.get(id) ?? null; },
    async putAttachment(metadata) { records.set(metadata.id, metadata); },
    async updateAttachment(id, patch) {
      const current = records.get(id);
      if (current) records.set(id, { ...current, ...patch, id: current.id, createdAt: current.createdAt });
    },
    async tombstoneAttachment(id, deletedAt = '2026-01-03T00:00:00.000Z') {
      const current = records.get(id);
      if (current) records.set(id, { ...current, deletedAt, updatedAt: deletedAt, syncStatus: 'deleted' });
    },
    async deleteAttachmentMetadata(id) { records.delete(id); },
    async putMetadata(metadata) { records.set(metadata.id, metadata); return metadata; },
    async getMetadata(id) { return records.get(id) ?? null; },
    async listForNote(noteId) { return [...records.values()].filter(item => item.noteId === noteId); },
    async markDeleted(id, deletedAt) {
      await this.tombstoneAttachment(id, deletedAt);
      return records.get(id) ?? null;
    },
  };
}

function memoryBlobAdapter() {
  const putBlob = vi.fn<BlobStorageAdapter['putBlob']>(async input => ({
    key: input.key,
    blob: input.blob,
    mimeType: input.mimeType,
    size: input.blob.size,
    checksum: input.checksum,
  }));
  return {
    putBlob,
    getBlob: vi.fn<BlobStorageAdapter['getBlob']>(async () => null),
    deleteBlob: vi.fn<BlobStorageAdapter['deleteBlob']>(async () => {}),
    getObjectUrl: vi.fn<BlobStorageAdapter['getObjectUrl']>(async () => null),
  } satisfies BlobStorageAdapter;
}

describe('local image attachments', () => {
  it('rejects unsupported non-image files', () => {
    expect(validateLocalImageFile(new File(['pdf'], 'doc.pdf', { type: 'application/pdf' }))).toBe('Unsupported image type');
  });

  it('appends a lightweight attachment reference once', () => {
    const body = appendAttachmentReferenceToBody('hello', 'attachment://att-1');

    expect(body).toBe('hello\n\nattachment://att-1');
    expect(appendAttachmentReferenceToBody(body, 'attachment://att-1')).toBe(body);
  });

  it('stores blob externally, creates metadata, and updates note body by reference only', async () => {
    const repository = memoryRepository();
    const blobAdapter = memoryBlobAdapter();

    const result = await attachLocalImageToNote({
      accountId: 'account-a',
      noteId: 'note-1',
      file: imageFile(),
      currentBody: 'body',
      repository,
      blobAdapter,
      now: () => '2026-01-02T00:00:00.000Z',
      idFactory: () => 'att-1',
    });

    expect(blobAdapter.putBlob).toHaveBeenCalledWith(expect.objectContaining({
      key: 'local-image/account-a/att-1',
      blob: expect.any(Blob),
      mimeType: 'image/png',
    }));
    expect(result.metadata).toMatchObject({
      id: 'att-1',
      accountId: 'account-a',
      noteId: 'note-1',
      fileName: 'scan.png',
      mimeType: 'image/png',
      localBlobKey: 'local-image/account-a/att-1',
      source: 'local',
    });
    expect(repository.records.get('att-1')).toEqual(result.metadata);
    expect(result.body).toContain('attachment://att-1');
    expect(result.body).not.toContain('data:image');
    expect(result.body).not.toContain('base64');
  });

  it('fails closed before any blob or metadata write when Return-to-Use attachment isolation is active', async () => {
    vi.stubEnv('VITE_ABSINTHE_RETURN_TO_USE_ATTACHMENT_ISOLATION', 'true');
    const repository = memoryRepository();
    const blobAdapter = memoryBlobAdapter();
    try {
      await expect(attachLocalImageToNote({
        accountId: 'account-a',
        noteId: 'note-1',
        file: imageFile(),
        currentBody: 'body',
        repository,
        blobAdapter,
      })).rejects.toThrow('Attachments are temporarily disabled');
      expect(blobAdapter.putBlob).not.toHaveBeenCalled();
      expect(repository.records.size).toBe(0);
    } finally {
      vi.stubEnv('VITE_ABSINTHE_RETURN_TO_USE_ATTACHMENT_ISOLATION', 'false');
    }
  });

  it('keeps Notes sync payload lightweight after attachment insertion', async () => {
    const result = await attachLocalImageToNote({
      accountId: 'account-a',
      noteId: 'note-1',
      file: imageFile('photo.webp', 'image/webp'),
      currentBody: '',
      repository: memoryRepository(),
      blobAdapter: memoryBlobAdapter(),
      now: () => '2026-01-02T00:00:00.000Z',
      idFactory: () => 'att-webp',
    });

    const payload = noteSyncPayload({
      id: 'note-1',
      title: 'T',
      body: result.body,
      updatedAt: 1,
      folderId: null,
      deletedAt: null,
    });

    expect(String(payload.body)).toBe('attachment://att-webp');
    expect(String(payload.body)).not.toContain('data:image');
    expect(String(payload.body)).not.toContain('base64');
  });
});
