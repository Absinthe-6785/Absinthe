import { describe, expect, it, vi } from 'vitest';
import type {
  AttachmentMetadata,
  AttachmentRepository,
  BlobStorageAdapter,
} from './attachmentRepository';
import { uploadAttachmentBlobToRemote } from './attachmentExplicitUploadAction';
import type {
  RemoteBlobProvider,
  RemoteBlobProviderCapabilities,
  RemoteBlobProviderConnectionStatus,
  RemoteBlobUploadInput,
  RemoteBlobUploadResult,
} from './remoteBlobProvider';
import { sanitizeRemoteBlobProviderError } from './remoteBlobProvider';

function metadata(overrides: Partial<AttachmentMetadata> = {}): AttachmentMetadata {
  return {
    id: 'att-1',
    noteId: 'note-1',
    fileName: 'scan.txt',
    mimeType: 'text/plain',
    size: 5,
    checksum: undefined,
    localBlobKey: 'local/att-1',
    createdAt: '2026-06-28T00:00:00.000Z',
    updatedAt: '2026-06-28T00:00:00.000Z',
    deletedAt: null,
    syncStatus: 'local',
    remoteSyncStatus: 'local_only',
    ...overrides,
  };
}

function memoryRepository(records: readonly AttachmentMetadata[]): AttachmentRepository & {
  records: Map<string, AttachmentMetadata>;
  updates: Array<{ id: string; patch: Partial<AttachmentMetadata> }>;
} {
  const map = new Map(records.map(record => [record.id, { ...record }]));
  const updates: Array<{ id: string; patch: Partial<AttachmentMetadata> }> = [];
  return {
    records: map,
    updates,
    async listAttachments() { return Array.from(map.values()).map(record => ({ ...record })); },
    async listAttachmentsForNote(noteId) { return Array.from(map.values()).filter(record => record.noteId === noteId).map(record => ({ ...record })); },
    async getAttachment(id) {
      const current = map.get(id);
      return current ? { ...current } : null;
    },
    async putAttachment(record) { map.set(record.id, { ...record }); },
    async updateAttachment(id, patch) {
      updates.push({ id, patch });
      const current = map.get(id);
      if (!current) return;
      map.set(id, { ...current, ...patch, id: current.id, createdAt: current.createdAt });
    },
    async tombstoneAttachment(id, deletedAt = '2026-06-28T00:01:00.000Z') {
      const current = map.get(id);
      if (!current) return;
      map.set(id, { ...current, deletedAt, syncStatus: 'deleted', updatedAt: deletedAt });
    },
    async deleteAttachmentMetadata(id) { map.delete(id); },
    async putMetadata(record) { map.set(record.id, { ...record }); return { ...record }; },
    async getMetadata(id) {
      const current = map.get(id);
      return current ? { ...current } : null;
    },
    async listForNote(noteId) { return Array.from(map.values()).filter(record => record.noteId === noteId).map(record => ({ ...record })); },
    async markDeleted(id, deletedAt) {
      const current = map.get(id);
      if (!current) return null;
      const next = { ...current, deletedAt, syncStatus: 'deleted' as const, updatedAt: deletedAt };
      map.set(id, next);
      return { ...next };
    },
  };
}

function memoryBlobAdapter(records: Record<string, Blob>): BlobStorageAdapter & {
  getBlob: ReturnType<typeof vi.fn<BlobStorageAdapter['getBlob']>>;
  deleteBlob: ReturnType<typeof vi.fn<BlobStorageAdapter['deleteBlob']>>;
} {
  const map = new Map(Object.entries(records));
  return {
    async putBlob(input) {
      map.set(input.key, input.blob);
      return { key: input.key, blob: input.blob, mimeType: input.mimeType, size: input.blob.size, checksum: input.checksum };
    },
    getBlob: vi.fn(async (key: string) => {
      const blob = map.get(key);
      return blob ? { key, blob, mimeType: blob.type, size: blob.size } : null;
    }),
    deleteBlob: vi.fn(async (key: string) => {
      map.delete(key);
    }),
    async getObjectUrl() { return null; },
    async hasBlob(key) { return map.has(key); },
  };
}

function remoteProvider(upload?: (input: RemoteBlobUploadInput) => Promise<RemoteBlobUploadResult>): RemoteBlobProvider & {
  uploadBlob: ReturnType<typeof vi.fn<RemoteBlobProvider['uploadBlob']>>;
  downloadBlob: ReturnType<typeof vi.fn<RemoteBlobProvider['downloadBlob']>>;
} {
  const capabilities: RemoteBlobProviderCapabilities = {
    supportsUpload: true,
    supportsDownload: true,
    supportsDelete: false,
    supportsResumableUpload: true,
    supportsAppPrivateStorage: true,
    supportsChecksum: true,
    supportsQuotaInfo: false,
  };
  return {
    providerType: 'googleDrive',
    capabilities,
    async getConnectionStatus(): Promise<RemoteBlobProviderConnectionStatus> {
      return { providerType: 'googleDrive', state: 'connected', checkedAt: '2026-06-28T00:00:00.000Z' };
    },
    uploadBlob: vi.fn(upload ?? (async input => ({
      providerType: 'googleDrive',
      remoteProvider: 'googleDrive',
      attachmentId: input.attachmentId,
      remoteFileId: 'drive-file-1',
      remoteSize: input.size,
      remoteMimeType: input.mimeType,
      syncedAt: '2026-06-28T00:02:00.000Z',
    }))),
    async getBlobInfo() { return null; },
    downloadBlob: vi.fn(async () => {
      throw new Error('not used');
    }),
  };
}

const fixedNow = (() => {
  const times = [
    '2026-06-28T00:01:00.000Z',
    '2026-06-28T00:02:00.000Z',
    '2026-06-28T00:03:00.000Z',
    '2026-06-28T00:04:00.000Z',
  ];
  let index = 0;
  return () => new Date(times[Math.min(index++, times.length - 1)]);
});

describe('explicit attachment upload action', () => {
  it('uploads one local blob and updates only the selected attachment after verification', async () => {
    const repository = memoryRepository([
      metadata(),
      metadata({ id: 'att-2', localBlobKey: 'local/att-2' }),
    ]);
    const blobs = memoryBlobAdapter({
      'local/att-1': new Blob(['hello'], { type: 'text/plain' }),
      'local/att-2': new Blob(['other'], { type: 'text/plain' }),
    });
    const provider = remoteProvider();

    const result = await uploadAttachmentBlobToRemote({
      attachmentRepository: repository,
      localBlobAdapter: blobs,
      remoteProvider: provider,
      attachmentId: 'att-1',
      now: fixedNow(),
    });

    expect(result).toMatchObject({
      attachmentId: 'att-1',
      status: 'uploaded',
      remoteProvider: 'googleDrive',
      remoteFileId: 'drive-file-1',
      remoteSize: 5,
    });
    expect(provider.uploadBlob).toHaveBeenCalledTimes(1);
    expect(provider.uploadBlob).toHaveBeenCalledWith(expect.objectContaining({
      attachmentId: 'att-1',
      localBlobKey: 'local/att-1',
      fileName: 'scan.txt',
      size: 5,
    }));
    expect(blobs.getBlob).toHaveBeenCalledTimes(1);
    expect(blobs.getBlob).toHaveBeenCalledWith('local/att-1');
    expect(blobs.deleteBlob).not.toHaveBeenCalled();
    expect(provider.downloadBlob).not.toHaveBeenCalled();
    expect(repository.records.get('att-1')).toMatchObject({
      remoteProvider: 'googleDrive',
      remoteFileId: 'drive-file-1',
      remoteSize: 5,
      remoteSyncStatus: 'synced',
      localBlobKey: 'local/att-1',
    });
    expect(repository.records.get('att-2')?.remoteFileId).toBeUndefined();
    expect(repository.records.get('att-2')).toMatchObject({
      remoteSyncStatus: 'local_only',
      localBlobKey: 'local/att-2',
    });
  });

  it('blocks missing, deleted, queued, conflict, and provider-mismatched attachments without upload', async () => {
    const cases = [
      metadata({ id: 'missing-local-key', localBlobKey: undefined }),
      metadata({ id: 'deleted', deletedAt: '2026-06-28T00:00:10.000Z', syncStatus: 'deleted' }),
      metadata({ id: 'pending', remoteSyncStatus: 'pending_upload' }),
      metadata({ id: 'conflict', remoteSyncStatus: 'conflict' }),
      metadata({ id: 'r2', remoteProvider: 'r2' }),
    ];
    const repository = memoryRepository(cases);
    const blobs = memoryBlobAdapter({ 'local/att-1': new Blob(['hello']) });
    const provider = remoteProvider();

    for (const item of cases) {
      const result = await uploadAttachmentBlobToRemote({
        attachmentRepository: repository,
        localBlobAdapter: blobs,
        remoteProvider: provider,
        attachmentId: item.id,
      });
      expect(result.status, item.id).toBe('blocked');
    }

    expect(provider.uploadBlob).not.toHaveBeenCalled();
    expect(blobs.deleteBlob).not.toHaveBeenCalled();
  });

  it('does not set remote metadata or delete local blob when upload fails', async () => {
    const repository = memoryRepository([metadata()]);
    const blobs = memoryBlobAdapter({ 'local/att-1': new Blob(['hello'], { type: 'text/plain' }) });
    const provider = remoteProvider(async () => {
      throw sanitizeRemoteBlobProviderError(
        new Error('upload failed Authorization: Bearer token-secret https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&upload_id=session-secret'),
        { category: 'network', retryable: true, code: 'network_failed' },
      );
    });

    const result = await uploadAttachmentBlobToRemote({
      attachmentRepository: repository,
      localBlobAdapter: blobs,
      remoteProvider: provider,
      attachmentId: 'att-1',
      now: fixedNow(),
    });

    expect(result.status).toBe('failed');
    expect(JSON.stringify(result)).not.toContain('token-secret');
    expect(JSON.stringify(result)).not.toContain('session-secret');
    expect(repository.records.get('att-1')?.remoteFileId).toBeUndefined();
    expect(repository.records.get('att-1')?.remoteSyncStatus).toBe('failed');
    expect(repository.records.get('att-1')?.localBlobKey).toBe('local/att-1');
    expect(blobs.deleteBlob).not.toHaveBeenCalled();
  });

  it('does not update remote metadata when upload response is invalid or metadata changes during upload', async () => {
    const invalidRepository = memoryRepository([metadata()]);
    const invalidBlobs = memoryBlobAdapter({ 'local/att-1': new Blob(['hello'], { type: 'text/plain' }) });
    const invalidProvider = remoteProvider(async input => ({
      providerType: 'googleDrive',
      attachmentId: input.attachmentId,
      remoteSize: input.size,
      syncedAt: '2026-06-28T00:02:00.000Z',
    }));

    const invalid = await uploadAttachmentBlobToRemote({
      attachmentRepository: invalidRepository,
      localBlobAdapter: invalidBlobs,
      remoteProvider: invalidProvider,
      attachmentId: 'att-1',
      now: fixedNow(),
    });
    expect(invalid.status).toBe('failed');
    expect(invalidRepository.records.get('att-1')?.remoteFileId).toBeUndefined();
    expect(invalidBlobs.deleteBlob).not.toHaveBeenCalled();

    const changedRepository = memoryRepository([metadata()]);
    const changedBlobs = memoryBlobAdapter({ 'local/att-1': new Blob(['hello'], { type: 'text/plain' }) });
    const changedProvider = remoteProvider(async input => {
      const current = changedRepository.records.get(input.attachmentId);
      if (current) {
        changedRepository.records.set(input.attachmentId, {
          ...current,
          localBlobKey: 'local/newer',
          updatedAt: '2026-06-28T00:01:30.000Z',
        });
      }
      return {
        providerType: 'googleDrive',
        remoteProvider: 'googleDrive',
        attachmentId: input.attachmentId,
        remoteFileId: 'drive-file-1',
        remoteSize: input.size,
        syncedAt: '2026-06-28T00:02:00.000Z',
      };
    });
    const changed = await uploadAttachmentBlobToRemote({
      attachmentRepository: changedRepository,
      localBlobAdapter: changedBlobs,
      remoteProvider: changedProvider,
      attachmentId: 'att-1',
      now: fixedNow(),
    });
    expect(changed.status).toBe('skipped');
    expect(changed.error).toContain('metadata changed');
    expect(changedRepository.records.get('att-1')?.remoteFileId).toBeUndefined();
    expect(changedRepository.records.get('att-1')?.localBlobKey).toBe('local/newer');
    expect(changedBlobs.deleteBlob).not.toHaveBeenCalled();
  });
});
