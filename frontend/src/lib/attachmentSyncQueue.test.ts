import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import type {
  AttachmentMetadata,
  AttachmentRepository,
  BlobStorageAdapter,
} from './attachmentRepository';
import {
  buildAttachmentUploadQueue,
  enqueueAttachmentUpload,
  processAttachmentUploadItem,
  runAttachmentUploadQueue,
  type AttachmentSyncQueueItem,
} from './attachmentSyncQueue';
import {
  sanitizeRemoteBlobProviderError,
  type RemoteBlobProvider,
  type RemoteBlobProviderCapabilities,
  type RemoteBlobProviderConnectionStatus,
  type RemoteBlobUploadInput,
  type RemoteBlobUploadResult,
} from './remoteBlobProvider';

function metadata(overrides: Partial<AttachmentMetadata> = {}): AttachmentMetadata {
  return {
    id: 'att-1',
    noteId: 'note-1',
    fileName: 'scan.txt',
    mimeType: 'text/plain',
    size: 11,
    checksum: 'md5:abc123abc123abc123abc123abc123ab',
    localBlobKey: 'local/att-1',
    createdAt: '2026-06-27T00:00:00.000Z',
    updatedAt: '2026-06-27T00:00:00.000Z',
    deletedAt: null,
    syncStatus: 'local',
    remoteSyncStatus: 'pending_upload',
    ...overrides,
  };
}

function memoryRepository(records: AttachmentMetadata[]): AttachmentRepository & {
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
      map.set(id, {
        ...current,
        ...patch,
        id: current.id,
        createdAt: current.createdAt,
      });
    },
    async tombstoneAttachment(id, deletedAt = '2026-06-27T00:10:00.000Z') {
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
  deleteBlob: ReturnType<typeof vi.fn<BlobStorageAdapter['deleteBlob']>>;
} {
  const map = new Map(Object.entries(records));
  return {
    async putBlob(input) {
      map.set(input.key, input.blob);
      return {
        key: input.key,
        blob: input.blob,
        mimeType: input.mimeType,
        size: input.blob.size,
        checksum: input.checksum,
      };
    },
    async getBlob(key) {
      const blob = map.get(key);
      return blob
        ? {
            key,
            blob,
            mimeType: blob.type,
            size: blob.size,
          }
        : null;
    },
    deleteBlob: vi.fn(async (key: string) => {
      map.delete(key);
    }),
    async getObjectUrl() { return null; },
    async hasBlob(key) { return map.has(key); },
  };
}

function remoteProvider(upload?: (input: RemoteBlobUploadInput) => Promise<RemoteBlobUploadResult>): RemoteBlobProvider & {
  uploadBlob: ReturnType<typeof vi.fn<RemoteBlobProvider['uploadBlob']>>;
} {
  const capabilities: RemoteBlobProviderCapabilities = {
    supportsUpload: true,
    supportsDownload: false,
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
      return {
        providerType: 'googleDrive',
        state: 'connected',
        checkedAt: '2026-06-27T00:00:00.000Z',
      };
    },
    uploadBlob: vi.fn(upload ?? (async input => ({
      providerType: 'googleDrive',
      remoteProvider: 'googleDrive',
      attachmentId: input.attachmentId,
      remoteFileId: 'drive-file-1',
      remoteSize: input.size,
      remoteChecksum: input.checksum?.replace(/^md5:/, ''),
      remoteMimeType: input.mimeType,
      remoteSyncedAt: '2026-06-27T00:02:00.000Z',
      syncedAt: '2026-06-27T00:02:00.000Z',
      verification: {
        sizeVerified: true,
        checksumVerified: true,
        checksumAlgorithm: 'md5',
      },
    }))),
    async getBlobInfo() { return null; },
    async downloadBlob() { throw new Error('not implemented'); },
  };
}

const fixedNow = (() => {
  const times = [
    '2026-06-27T00:01:00.000Z',
    '2026-06-27T00:02:00.000Z',
    '2026-06-27T00:03:00.000Z',
    '2026-06-27T00:04:00.000Z',
  ];
  let index = 0;
  return () => new Date(times[Math.min(index++, times.length - 1)]);
});

function item(overrides: Partial<AttachmentSyncQueueItem> = {}): AttachmentSyncQueueItem {
  return {
    id: 'attachment-upload:att-1:2026-06-27T00:00:00.000Z',
    attachmentId: 'att-1',
    localBlobKey: 'local/att-1',
    remoteProvider: 'googleDrive',
    requestedAt: '2026-06-27T00:00:00.000Z',
    status: 'pending_upload',
    attemptCount: 0,
    ...overrides,
  };
}

describe('attachment sync queue', () => {
  it('builds queue items for pending uploads only', async () => {
    const repo = memoryRepository([
      metadata({ id: 'att-pending', localBlobKey: 'local/pending', remoteSyncStatus: 'pending_upload' }),
      metadata({ id: 'att-synced', localBlobKey: 'local/synced', remoteSyncStatus: 'synced' }),
      metadata({ id: 'att-deleted', localBlobKey: 'local/deleted', remoteSyncStatus: 'pending_upload', deletedAt: '2026-06-27T00:01:00.000Z' }),
    ]);

    const queue = await buildAttachmentUploadQueue({
      attachmentRepository: repo,
      remoteProvider: 'googleDrive',
      now: () => new Date('2026-06-27T00:05:00.000Z'),
    });

    expect(queue).toHaveLength(1);
    expect(queue[0]).toMatchObject({
      attachmentId: 'att-pending',
      localBlobKey: 'local/pending',
      remoteProvider: 'googleDrive',
      status: 'pending_upload',
      requestedAt: '2026-06-27T00:05:00.000Z',
    });
  });

  it('enqueue marks one attachment pending without running provider upload', async () => {
    const repo = memoryRepository([metadata({ remoteSyncStatus: 'local_only' })]);
    const queued = await enqueueAttachmentUpload({
      attachmentRepository: repo,
      attachmentId: 'att-1',
      remoteProvider: 'googleDrive',
      now: () => new Date('2026-06-27T00:01:00.000Z'),
    });

    expect(queued).toMatchObject({
      attachmentId: 'att-1',
      status: 'pending_upload',
    });
    expect(repo.records.get('att-1')).toMatchObject({
      remoteSyncStatus: 'pending_upload',
      remoteProvider: 'googleDrive',
    });
  });

  it('does not auto-run the queue on import', () => {
    const queueSource = readFileSync(join(process.cwd(), 'src/lib/attachmentSyncQueue.ts'), 'utf8');

    expect(queueSource).not.toContain('setInterval');
    expect(queueSource).not.toContain('addEventListener');
    expect(queueSource).not.toContain('createLocalAttachmentMetadataRepository');
    expect(queueSource).not.toContain('createLocalAttachmentBlobAdapter');
    expect(queueSource).not.toContain('GoogleDriveBlobAdapter');
  });

  it('processes an item, marks uploading, uploads blob, and writes verified remote metadata', async () => {
    const repo = memoryRepository([metadata()]);
    const blobs = memoryBlobAdapter({ 'local/att-1': new Blob(['hello world'], { type: 'text/plain' }) });
    const provider = remoteProvider();

    const result = await processAttachmentUploadItem(item(), {
      attachmentRepository: repo,
      localBlobAdapter: blobs,
      remoteProvider: provider,
      now: fixedNow(),
    });

    expect(provider.uploadBlob).toHaveBeenCalledWith(expect.objectContaining({
      attachmentId: 'att-1',
      localBlobKey: 'local/att-1',
      fileName: 'scan.txt',
      mimeType: 'text/plain',
      size: 11,
      checksum: 'md5:abc123abc123abc123abc123abc123ab',
    }));
    expect(repo.updates[0].patch).toMatchObject({
      remoteSyncStatus: 'uploading',
      remoteProvider: 'googleDrive',
      updatedAt: '2026-06-27T00:01:00.000Z',
    });
    expect(repo.records.get('att-1')).toMatchObject({
      remoteProvider: 'googleDrive',
      remoteFileId: 'drive-file-1',
      remoteSize: 11,
      remoteChecksum: 'abc123abc123abc123abc123abc123ab',
      remoteMimeType: 'text/plain',
      remoteSyncedAt: '2026-06-27T00:02:00.000Z',
      remoteSyncStatus: 'synced',
      remoteError: undefined,
      remoteVerification: {
        sizeVerified: true,
        checksumVerified: true,
        checksumAlgorithm: 'md5',
      },
    });
    expect(result).toMatchObject({
      attachmentId: 'att-1',
      status: 'synced',
      remoteFileId: 'drive-file-1',
      remoteSize: 11,
    });
    expect(blobs.deleteBlob).not.toHaveBeenCalled();
  });

  it('does not mark synced when remote size mismatches', async () => {
    const repo = memoryRepository([metadata()]);
    const blobs = memoryBlobAdapter({ 'local/att-1': new Blob(['hello world'], { type: 'text/plain' }) });
    const provider = remoteProvider(async input => ({
      providerType: 'googleDrive',
      attachmentId: input.attachmentId,
      remoteFileId: 'drive-file-1',
      remoteSize: 999,
      remoteChecksum: 'abc123abc123abc123abc123abc123ab',
      syncedAt: '2026-06-27T00:02:00.000Z',
    }));

    const result = await processAttachmentUploadItem(item(), {
      attachmentRepository: repo,
      localBlobAdapter: blobs,
      remoteProvider: provider,
      now: fixedNow(),
    });

    expect(result.status).toBe('failed');
    expect(repo.records.get('att-1')?.remoteSyncStatus).toBe('failed');
    expect(repo.records.get('att-1')?.remoteFileId).toBeUndefined();
    expect(blobs.deleteBlob).not.toHaveBeenCalled();
  });

  it('does not mark synced when compatible md5 checksum mismatches', async () => {
    const repo = memoryRepository([metadata()]);
    const blobs = memoryBlobAdapter({ 'local/att-1': new Blob(['hello world'], { type: 'text/plain' }) });
    const provider = remoteProvider(async input => ({
      providerType: 'googleDrive',
      attachmentId: input.attachmentId,
      remoteFileId: 'drive-file-1',
      remoteSize: 11,
      remoteChecksum: 'ffffffffffffffffffffffffffffffff',
      syncedAt: '2026-06-27T00:02:00.000Z',
    }));

    const result = await processAttachmentUploadItem(item(), {
      attachmentRepository: repo,
      localBlobAdapter: blobs,
      remoteProvider: provider,
      now: fixedNow(),
    });

    expect(result.status).toBe('failed');
    expect(repo.records.get('att-1')?.remoteSyncStatus).toBe('failed');
    expect(repo.records.get('att-1')?.remoteFileId).toBeUndefined();
    expect(blobs.deleteBlob).not.toHaveBeenCalled();
  });

  it('records partial checksum warning while still syncing verified size', async () => {
    const repo = memoryRepository([metadata({ checksum: 'sha256:not-compatible' })]);
    const blobs = memoryBlobAdapter({ 'local/att-1': new Blob(['hello world'], { type: 'text/plain' }) });
    const provider = remoteProvider(async input => ({
      providerType: 'googleDrive',
      attachmentId: input.attachmentId,
      remoteFileId: 'drive-file-1',
      remoteSize: 11,
      remoteChecksum: 'abc123abc123abc123abc123abc123ab',
      syncedAt: '2026-06-27T00:02:00.000Z',
    }));

    const result = await processAttachmentUploadItem(item(), {
      attachmentRepository: repo,
      localBlobAdapter: blobs,
      remoteProvider: provider,
      now: fixedNow(),
    });

    expect(result.status).toBe('synced');
    expect(result.verification).toMatchObject({
      sizeVerified: true,
      checksumVerified: false,
    });
    expect(result.warnings).toContain('Local checksum algorithm is not compatible with remote checksum.');
    expect(repo.records.get('att-1')?.remoteVerification?.warnings).toContain('Local checksum algorithm is not compatible with remote checksum.');
  });

  it('classifies network/provider failure as paused_offline and sanitizes secrets', async () => {
    const repo = memoryRepository([metadata()]);
    const blobs = memoryBlobAdapter({ 'local/att-1': new Blob(['hello world'], { type: 'text/plain' }) });
    const provider = remoteProvider(async () => {
      throw sanitizeRemoteBlobProviderError(
        new Error('network failed Authorization: Bearer token-secret https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&upload_id=session-secret'),
        { category: 'network', retryable: true, code: 'network_failed' }
      );
    });

    const result = await processAttachmentUploadItem(item(), {
      attachmentRepository: repo,
      localBlobAdapter: blobs,
      remoteProvider: provider,
      now: fixedNow(),
    });

    expect(result.status).toBe('paused_offline');
    expect(repo.records.get('att-1')?.remoteSyncStatus).toBe('paused_offline');
    expect(JSON.stringify(result)).not.toContain('token-secret');
    expect(JSON.stringify(result)).not.toContain('session-secret');
    expect(repo.records.get('att-1')?.remoteError).not.toContain('token-secret');
    expect(blobs.deleteBlob).not.toHaveBeenCalled();
  });

  it('fails missing localBlobKey without upload or local deletion', async () => {
    const repo = memoryRepository([metadata({ localBlobKey: undefined })]);
    const blobs = memoryBlobAdapter({});
    const provider = remoteProvider();

    const result = await processAttachmentUploadItem(item({ localBlobKey: undefined }), {
      attachmentRepository: repo,
      localBlobAdapter: blobs,
      remoteProvider: provider,
      now: fixedNow(),
    });

    expect(result.status).toBe('failed');
    expect(repo.records.get('att-1')?.remoteSyncStatus).toBe('missing_local');
    expect(provider.uploadBlob).not.toHaveBeenCalled();
    expect(blobs.deleteBlob).not.toHaveBeenCalled();
  });

  it('fails missing local blob without upload or local deletion', async () => {
    const repo = memoryRepository([metadata()]);
    const blobs = memoryBlobAdapter({});
    const provider = remoteProvider();

    const result = await processAttachmentUploadItem(item(), {
      attachmentRepository: repo,
      localBlobAdapter: blobs,
      remoteProvider: provider,
      now: fixedNow(),
    });

    expect(result.status).toBe('failed');
    expect(repo.records.get('att-1')?.remoteSyncStatus).toBe('missing_local');
    expect(provider.uploadBlob).not.toHaveBeenCalled();
    expect(blobs.deleteBlob).not.toHaveBeenCalled();
  });

  it('skips deleted attachments without upload', async () => {
    const repo = memoryRepository([metadata({ deletedAt: '2026-06-27T00:01:00.000Z' })]);
    const blobs = memoryBlobAdapter({ 'local/att-1': new Blob(['hello world']) });
    const provider = remoteProvider();

    const result = await processAttachmentUploadItem(item(), {
      attachmentRepository: repo,
      localBlobAdapter: blobs,
      remoteProvider: provider,
    });

    expect(result.status).toBe('skipped');
    expect(provider.uploadBlob).not.toHaveBeenCalled();
    expect(blobs.deleteBlob).not.toHaveBeenCalled();
  });

  it('re-reads metadata and skips success update when metadata changed during upload', async () => {
    const repo = memoryRepository([metadata()]);
    const blobs = memoryBlobAdapter({ 'local/att-1': new Blob(['hello world'], { type: 'text/plain' }) });
    const provider = remoteProvider(async input => {
      const current = repo.records.get(input.attachmentId);
      if (current) {
        repo.records.set(input.attachmentId, {
          ...current,
          localBlobKey: 'local/newer',
          updatedAt: '2026-06-27T00:01:30.000Z',
        });
      }
      return {
        providerType: 'googleDrive',
        attachmentId: input.attachmentId,
        remoteFileId: 'drive-file-1',
        remoteSize: 11,
        remoteChecksum: 'abc123abc123abc123abc123abc123ab',
        syncedAt: '2026-06-27T00:02:00.000Z',
      };
    });

    const result = await processAttachmentUploadItem(item(), {
      attachmentRepository: repo,
      localBlobAdapter: blobs,
      remoteProvider: provider,
      now: fixedNow(),
    });

    expect(result.status).toBe('skipped');
    expect(result.error).toContain('metadata changed');
    expect(repo.records.get('att-1')?.remoteFileId).toBeUndefined();
    expect(repo.records.get('att-1')?.localBlobKey).toBe('local/newer');
    expect(blobs.deleteBlob).not.toHaveBeenCalled();
  });

  it('returns safe aggregate queue results without raw blob, token, base64, or session URI', async () => {
    const repo = memoryRepository([metadata()]);
    const blobs = memoryBlobAdapter({ 'local/att-1': new Blob(['hello world'], { type: 'text/plain' }) });
    const provider = remoteProvider();

    const result = await runAttachmentUploadQueue([item()], {
      attachmentRepository: repo,
      localBlobAdapter: blobs,
      remoteProvider: provider,
      now: fixedNow(),
    });
    const serialized = JSON.stringify(result);

    expect(result).toMatchObject({
      processedCount: 1,
      uploadedCount: 1,
      syncedCount: 1,
      failedCount: 0,
      pausedOfflineCount: 0,
      skippedCount: 0,
    });
    expect(serialized).not.toContain('data:image');
    expect(serialized).not.toContain(';base64,');
    expect(serialized).not.toContain('access_token');
    expect(serialized).not.toContain('refresh_token');
    expect(serialized).not.toContain('upload_id=');
    expect(blobs.deleteBlob).not.toHaveBeenCalled();
  });

  it('does not import note stores, remote delete, OAuth, or cleanup executors', () => {
    const queueSource = readFileSync(join(process.cwd(), 'src/lib/attachmentSyncQueue.ts'), 'utf8');

    expect(queueSource).not.toContain('useNotesStore');
    expect(queueSource).not.toContain('oauth2.googleapis.com/token');
    expect(queueSource).not.toContain('refresh_token');
    expect(queueSource).not.toContain('client_secret');
    expect(queueSource).not.toContain('deleteBlob(');
    expect(queueSource).not.toContain('remoteDelete');
    expect(queueSource).not.toContain('executeAttachmentCleanup');
  });
});
