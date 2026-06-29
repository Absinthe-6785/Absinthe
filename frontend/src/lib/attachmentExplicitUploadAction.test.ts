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

  it('does not call remote upload when the local blob is missing or unreadable', async () => {
    const missingRepository = memoryRepository([metadata()]);
    const missingBlobs = memoryBlobAdapter({});
    const missingProvider = remoteProvider();

    const missing = await uploadAttachmentBlobToRemote({
      attachmentRepository: missingRepository,
      localBlobAdapter: missingBlobs,
      remoteProvider: missingProvider,
      attachmentId: 'att-1',
    });

    expect(missing.status).toBe('blocked');
    expect(missing.error).toContain('Local attachment blob is missing');
    expect(missingProvider.uploadBlob).not.toHaveBeenCalled();
    expect(missingRepository.records.get('att-1')?.remoteFileId).toBeUndefined();
    expect(missingRepository.records.get('att-1')?.remoteSyncStatus).toBe('local_only');
    expect(missingRepository.records.get('att-1')?.localBlobKey).toBe('local/att-1');
    expect(missingBlobs.deleteBlob).not.toHaveBeenCalled();

    const unreadableRepository = memoryRepository([metadata()]);
    const unreadableBlobs = memoryBlobAdapter({ 'local/att-1': new Blob(['hello']) });
    unreadableBlobs.getBlob.mockRejectedValueOnce(new Error('IndexedDB read failed access_token=token-secret Authorization: Bearer bearer-secret'));
    const unreadableProvider = remoteProvider();

    const unreadable = await uploadAttachmentBlobToRemote({
      attachmentRepository: unreadableRepository,
      localBlobAdapter: unreadableBlobs,
      remoteProvider: unreadableProvider,
      attachmentId: 'att-1',
    });

    expect(unreadable.status).toBe('failed');
    expect(unreadable.errorDetails).toMatchObject({
      code: 'local_blob_unreadable',
    });
    expect(JSON.stringify(unreadable)).not.toContain('token-secret');
    expect(JSON.stringify(unreadable)).not.toContain('bearer-secret');
    expect(unreadableProvider.uploadBlob).not.toHaveBeenCalled();
    expect(unreadableRepository.records.get('att-1')?.remoteFileId).toBeUndefined();
    expect(unreadableRepository.records.get('att-1')?.remoteSyncStatus).toBe('local_only');
    expect(unreadableRepository.records.get('att-1')?.localBlobKey).toBe('local/att-1');
    expect(unreadableBlobs.deleteBlob).not.toHaveBeenCalled();
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

  it('keeps failed upload states non-destructive and does not trigger queue, sync, recovery, eviction, or remote delete', async () => {
    const repository = memoryRepository([metadata()]);
    const blobs = memoryBlobAdapter({ 'local/att-1': new Blob(['hello'], { type: 'text/plain' }) });
    const provider = remoteProvider(async () => {
      throw sanitizeRemoteBlobProviderError(
        new Error('provider failed access_token=token-secret refresh_token=refresh-secret id_token=id-secret code=auth-secret code_verifier=verifier-secret codeVerifier=camel-secret http://127.0.0.1:5173/oauth/google-drive/callback?code=callback-secret Authorization: Bearer bearer-secret data:image/png;base64,AAA111'),
        { category: 'upload', retryable: true, code: 'rate_limited' },
      );
    });
    const runQueue = vi.fn();
    const runSync = vi.fn();
    const runRecovery = vi.fn();
    const runEviction = vi.fn();
    const remoteDelete = vi.fn();
    const deleteBackups = vi.fn();

    const result = await uploadAttachmentBlobToRemote({
      attachmentRepository: repository,
      localBlobAdapter: blobs,
      remoteProvider: provider,
      attachmentId: 'att-1',
      now: fixedNow(),
    });

    expect(result.status).toBe('failed');
    expect(result.errorDetails).toMatchObject({
      code: 'rate_limited',
      retryable: true,
    });
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain('token-secret');
    expect(serialized).not.toContain('refresh-secret');
    expect(serialized).not.toContain('id-secret');
    expect(serialized).not.toContain('auth-secret');
    expect(serialized).not.toContain('verifier-secret');
    expect(serialized).not.toContain('camel-secret');
    expect(serialized).not.toContain('callback-secret');
    expect(serialized).not.toContain('bearer-secret');
    expect(serialized).not.toContain('AAA111');
    expect(repository.records.get('att-1')?.remoteFileId).toBeUndefined();
    expect(repository.records.get('att-1')?.remoteSyncStatus).toBe('failed');
    expect(repository.records.get('att-1')?.remoteSyncStatus).not.toBe('synced');
    expect(repository.records.get('att-1')?.localBlobKey).toBe('local/att-1');
    expect(blobs.deleteBlob).not.toHaveBeenCalled();
    expect(remoteDelete).not.toHaveBeenCalled();
    expect(deleteBackups).not.toHaveBeenCalled();
    expect(runQueue).not.toHaveBeenCalled();
    expect(runSync).not.toHaveBeenCalled();
    expect(runRecovery).not.toHaveBeenCalled();
    expect(runEviction).not.toHaveBeenCalled();
  });

  it('does not leave metadata stuck uploading when the final metadata update fails after remote upload succeeds', async () => {
    const repository = memoryRepository([metadata()]);
    const originalUpdate = repository.updateAttachment.bind(repository);
    repository.updateAttachment = vi.fn(async (id: string, patch: Partial<AttachmentMetadata>) => {
      if (patch.remoteSyncStatus === 'synced') {
        throw new Error('metadata write failed Authorization: Bearer token-secret');
      }
      return originalUpdate(id, patch);
    });
    const blobs = memoryBlobAdapter({ 'local/att-1': new Blob(['hello'], { type: 'text/plain' }) });
    const provider = remoteProvider();
    const remoteDelete = vi.fn();
    const cleanupOrEvict = vi.fn();

    const result = await uploadAttachmentBlobToRemote({
      attachmentRepository: repository,
      localBlobAdapter: blobs,
      remoteProvider: provider,
      attachmentId: 'att-1',
      now: fixedNow(),
    });

    expect(result.status).toBe('failed');
    expect(result.errorDetails).toMatchObject({
      code: 'metadata_update_failed',
      category: 'upload',
    });
    expect(result.error).not.toContain('token-secret');
    expect(result.remoteFileId).toBe('drive-file-1');
    expect(result.warnings).toContain('Remote upload may have completed before local metadata update failed. Review before retrying.');
    expect(repository.records.get('att-1')?.remoteSyncStatus).toBe('failed');
    expect(repository.records.get('att-1')?.remoteSyncStatus).not.toBe('uploading');
    expect(repository.records.get('att-1')?.remoteSyncStatus).not.toBe('synced');
    expect(repository.records.get('att-1')?.remoteFileId).toBeUndefined();
    expect(repository.records.get('att-1')?.localBlobKey).toBe('local/att-1');
    expect(blobs.deleteBlob).not.toHaveBeenCalled();
    expect(remoteDelete).not.toHaveBeenCalled();
    expect(cleanupOrEvict).not.toHaveBeenCalled();

    const later = await uploadAttachmentBlobToRemote({
      attachmentRepository: repository,
      localBlobAdapter: blobs,
      remoteProvider,
      attachmentId: 'att-1',
    });
    expect(later.status).toBe('blocked');
    expect(later.error).toContain('requires review');
    expect(later.error).not.toContain('already in progress');
  });
});
