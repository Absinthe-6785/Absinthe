import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import type {
  AttachmentMetadata,
  AttachmentRepository,
  BlobStorageAdapter,
} from './attachmentRepository';
import {
  classifyAttachmentRemoteRecoveryState,
  recoverAttachmentBlobFromRemote,
  reconcileStaleRemoteSyncStatus,
} from './attachmentRemoteRecovery';
import {
  sanitizeRemoteBlobProviderError,
  type RemoteBlobProvider,
  type RemoteBlobProviderCapabilities,
  type RemoteBlobProviderConnectionStatus,
  type RemoteBlobDownloadInput,
  type RemoteBlobDownloadResult,
} from './remoteBlobProvider';

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function metadata(overrides: Partial<AttachmentMetadata> = {}): AttachmentMetadata {
  return {
    id: 'att-1',
    noteId: 'note-1',
    fileName: 'scan.txt',
    mimeType: 'text/plain',
    size: 11,
    checksum: `sha256:${sha256('hello world')}`,
    localBlobKey: undefined,
    remoteProvider: 'googleDrive',
    remoteFileId: 'drive-file-1',
    remoteSize: 11,
    remoteChecksum: `sha256:${sha256('hello world')}`,
    remoteMimeType: 'text/plain',
    remoteSyncStatus: 'recoverable_remote',
    createdAt: '2026-06-27T00:00:00.000Z',
    updatedAt: '2026-06-27T00:00:00.000Z',
    deletedAt: null,
    syncStatus: 'local',
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

function memoryBlobAdapter(records: Record<string, Blob> = {}): BlobStorageAdapter & {
  records: Map<string, Blob>;
  putBlob: ReturnType<typeof vi.fn<BlobStorageAdapter['putBlob']>>;
  deleteBlob: ReturnType<typeof vi.fn<BlobStorageAdapter['deleteBlob']>>;
} {
  const map = new Map(Object.entries(records));
  return {
    records: map,
    putBlob: vi.fn(async input => {
      map.set(input.key, input.blob);
      return {
        key: input.key,
        blob: input.blob,
        mimeType: input.mimeType,
        size: input.blob.size,
        checksum: input.checksum,
      };
    }),
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

function remoteProvider(download?: (input: RemoteBlobDownloadInput) => Promise<Blob | RemoteBlobDownloadResult>): RemoteBlobProvider & {
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
      return {
        providerType: 'googleDrive',
        state: 'connected',
        checkedAt: '2026-06-27T00:00:00.000Z',
      };
    },
    async uploadBlob() { throw new Error('not used'); },
    async getBlobInfo() { return null; },
    downloadBlob: vi.fn(download ?? (async input => {
      const blob = new Blob(['hello world'], { type: 'text/plain' });
      return {
        blob,
        providerType: 'googleDrive',
        remoteProvider: 'googleDrive',
        remoteFileId: input.remoteFileId,
        remoteSize: blob.size,
        remoteChecksum: `sha256:${sha256('hello world')}`,
        remoteMimeType: 'text/plain',
        downloadedAt: '2026-06-27T00:02:00.000Z',
      };
    })),
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

describe('attachment remote recovery', () => {
  it('classifies remote-backed missing local blob as recoverable_remote', async () => {
    const blobs = memoryBlobAdapter();

    await expect(classifyAttachmentRemoteRecoveryState({
      metadata: metadata(),
      localBlobAdapter: blobs,
    })).resolves.toBe('recoverable_remote');
  });

  it('classifies missing local blob without remoteFileId as missing_local', async () => {
    const blobs = memoryBlobAdapter();

    await expect(classifyAttachmentRemoteRecoveryState({
      metadata: metadata({ remoteFileId: undefined }),
      localBlobAdapter: blobs,
    })).resolves.toBe('missing_local');
  });

  it('recovers a selected remote-backed attachment into local blob cache after verification', async () => {
    const repo = memoryRepository([metadata()]);
    const blobs = memoryBlobAdapter();
    const provider = remoteProvider();

    const result = await recoverAttachmentBlobFromRemote({
      attachmentRepository: repo,
      localBlobAdapter: blobs,
      remoteProvider: provider,
      attachmentId: 'att-1',
      now: fixedNow(),
    });

    expect(provider.downloadBlob).toHaveBeenCalledWith(expect.objectContaining({
      attachmentId: 'att-1',
      remoteFileId: 'drive-file-1',
      expectedSize: 11,
      expectedChecksum: `sha256:${sha256('hello world')}`,
    }));
    expect(blobs.putBlob).toHaveBeenCalledWith(expect.objectContaining({
      key: 'local-attachment/recovered-att-1',
      mimeType: 'text/plain',
    }));
    expect(repo.records.get('att-1')).toMatchObject({
      localBlobKey: 'local-attachment/recovered-att-1',
      remoteSyncStatus: 'synced',
      remoteError: undefined,
      lastRemoteRecoveryAt: '2026-06-27T00:02:00.000Z',
      remoteVerification: {
        sizeVerified: true,
        checksumVerified: true,
        checksumAlgorithm: 'sha256',
        sizeOnlyVerified: false,
      },
    });
    expect(result).toMatchObject({
      status: 'recovered',
      localBlobKey: 'local-attachment/recovered-att-1',
      verification: {
        sizeVerified: true,
        checksumVerified: true,
        checksumAlgorithm: 'sha256',
      },
    });
    expect(blobs.deleteBlob).not.toHaveBeenCalled();
  });

  it('refuses tombstoned attachments without download', async () => {
    const repo = memoryRepository([metadata({ deletedAt: '2026-06-27T00:00:30.000Z' })]);
    const blobs = memoryBlobAdapter();
    const provider = remoteProvider();

    const result = await recoverAttachmentBlobFromRemote({
      attachmentRepository: repo,
      localBlobAdapter: blobs,
      remoteProvider: provider,
      attachmentId: 'att-1',
    });

    expect(result.status).toBe('skipped');
    expect(provider.downloadBlob).not.toHaveBeenCalled();
    expect(blobs.putBlob).not.toHaveBeenCalled();
  });

  it('blocks attachment without remoteProvider or remoteFileId', async () => {
    const repo = memoryRepository([metadata({ remoteProvider: undefined, remoteFileId: undefined })]);
    const blobs = memoryBlobAdapter();
    const provider = remoteProvider();

    const result = await recoverAttachmentBlobFromRemote({
      attachmentRepository: repo,
      localBlobAdapter: blobs,
      remoteProvider: provider,
      attachmentId: 'att-1',
      now: fixedNow(),
    });

    expect(result.status).toBe('blocked');
    expect(repo.records.get('att-1')?.remoteSyncStatus).toBe('missing_local');
    expect(provider.downloadBlob).not.toHaveBeenCalled();
    expect(blobs.putBlob).not.toHaveBeenCalled();
  });

  it('fails recovery on size mismatch without writing local blob', async () => {
    const repo = memoryRepository([metadata()]);
    const blobs = memoryBlobAdapter();
    const provider = remoteProvider(async input => ({
      blob: new Blob(['bad'], { type: 'text/plain' }),
      providerType: 'googleDrive',
      remoteFileId: input.remoteFileId,
      remoteSize: 3,
      remoteChecksum: `sha256:${sha256('bad')}`,
    }));

    const result = await recoverAttachmentBlobFromRemote({
      attachmentRepository: repo,
      localBlobAdapter: blobs,
      remoteProvider: provider,
      attachmentId: 'att-1',
      now: fixedNow(),
    });

    expect(result.status).toBe('failed');
    expect(repo.records.get('att-1')?.remoteSyncStatus).toBe('recoverable_remote');
    expect(repo.records.get('att-1')?.localBlobKey).toBeUndefined();
    expect(blobs.putBlob).not.toHaveBeenCalled();
    expect(blobs.deleteBlob).not.toHaveBeenCalled();
  });

  it('fails recovery on compatible checksum mismatch without writing local blob', async () => {
    const repo = memoryRepository([metadata()]);
    const blobs = memoryBlobAdapter();
    const provider = remoteProvider(async input => ({
      blob: new Blob(['hello world'], { type: 'text/plain' }),
      providerType: 'googleDrive',
      remoteFileId: input.remoteFileId,
      remoteSize: 11,
      remoteChecksum: `sha256:${sha256('different')}`,
    }));

    const result = await recoverAttachmentBlobFromRemote({
      attachmentRepository: repo,
      localBlobAdapter: blobs,
      remoteProvider: provider,
      attachmentId: 'att-1',
      now: fixedNow(),
    });

    expect(result.status).toBe('failed');
    expect(repo.records.get('att-1')?.localBlobKey).toBeUndefined();
    expect(blobs.putBlob).not.toHaveBeenCalled();
  });

  it('allows size-only recovery with explicit warning when checksum is incompatible', async () => {
    const repo = memoryRepository([metadata({
      checksum: 'fnv1a:not-compatible',
      remoteChecksum: 'fnv1a:not-compatible',
    })]);
    const blobs = memoryBlobAdapter();
    const provider = remoteProvider(async input => ({
      blob: new Blob(['hello world'], { type: 'text/plain' }),
      providerType: 'googleDrive',
      remoteFileId: input.remoteFileId,
      remoteSize: 11,
      remoteChecksum: 'fnv1a:not-compatible',
    }));

    const result = await recoverAttachmentBlobFromRemote({
      attachmentRepository: repo,
      localBlobAdapter: blobs,
      remoteProvider: provider,
      attachmentId: 'att-1',
      now: fixedNow(),
    });

    expect(result.status).toBe('recovered');
    expect(result.verification).toMatchObject({
      sizeVerified: true,
      checksumVerified: false,
      sizeOnlyVerified: true,
    });
    expect(result.warnings).toContain('Remote checksum algorithm is unavailable or incompatible; size-only verification used.');
    expect(result.warnings).toContain('Downloaded blob was verified by size only.');
  });

  it('re-reads metadata and skips local write when metadata changed during recovery', async () => {
    const repo = memoryRepository([metadata()]);
    const blobs = memoryBlobAdapter();
    const provider = remoteProvider(async input => {
      const current = repo.records.get('att-1');
      if (current) {
        repo.records.set('att-1', {
          ...current,
          remoteFileId: 'new-drive-file',
          updatedAt: '2026-06-27T00:01:30.000Z',
        });
      }
      return {
        blob: new Blob(['hello world'], { type: 'text/plain' }),
        providerType: 'googleDrive',
        remoteFileId: input.remoteFileId,
        remoteSize: 11,
        remoteChecksum: `sha256:${sha256('hello world')}`,
      };
    });

    const result = await recoverAttachmentBlobFromRemote({
      attachmentRepository: repo,
      localBlobAdapter: blobs,
      remoteProvider: provider,
      attachmentId: 'att-1',
      now: fixedNow(),
    });

    expect(result.status).toBe('skipped');
    expect(result.error).toContain('metadata changed');
    expect(blobs.putBlob).not.toHaveBeenCalled();
    expect(repo.records.get('att-1')?.remoteFileId).toBe('new-drive-file');
  });

  it('sanitizes recovery errors and preserves structured code/category/retryable safely', async () => {
    const repo = memoryRepository([metadata()]);
    const blobs = memoryBlobAdapter();
    const provider = remoteProvider(async () => {
      throw sanitizeRemoteBlobProviderError(
        new Error('download failed Authorization: Bearer token-secret https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&upload_id=session-secret'),
        { category: 'network', retryable: true, code: 'download_failed' }
      );
    });

    const result = await recoverAttachmentBlobFromRemote({
      attachmentRepository: repo,
      localBlobAdapter: blobs,
      remoteProvider: provider,
      attachmentId: 'att-1',
      now: fixedNow(),
    });

    const serialized = JSON.stringify(result);
    expect(result.status).toBe('failed');
    expect(result.errorDetails).toMatchObject({
      category: 'network',
      retryable: true,
      code: 'download_failed',
    });
    expect(serialized).not.toContain('token-secret');
    expect(serialized).not.toContain('session-secret');
    expect(repo.records.get('att-1')?.remoteError).not.toContain('token-secret');
    expect(blobs.putBlob).not.toHaveBeenCalled();
    expect(blobs.deleteBlob).not.toHaveBeenCalled();
  });

  it('keeps metadata retryable and unsynced when Drive download fails', async () => {
    const repo = memoryRepository([metadata()]);
    const blobs = memoryBlobAdapter();
    const provider = remoteProvider(async () => {
      throw sanitizeRemoteBlobProviderError(
        new Error('Google Drive download failed with status 404. Authorization: Bearer token-secret access_token=secret'),
        { category: 'provider', retryable: false, code: 'remote_file_missing' }
      );
    });

    const result = await recoverAttachmentBlobFromRemote({
      attachmentRepository: repo,
      localBlobAdapter: blobs,
      remoteProvider: provider,
      attachmentId: 'att-1',
      now: fixedNow(),
    });

    const stored = repo.records.get('att-1');
    expect(result).toMatchObject({
      status: 'failed',
      remoteProvider: 'googleDrive',
      remoteFileId: 'drive-file-1',
      errorDetails: {
        code: 'remote_file_missing',
        category: 'provider',
        retryable: false,
      },
    });
    expect(result.localBlobKey).toBeUndefined();
    expect(stored).toMatchObject({
      remoteSyncStatus: 'recoverable_remote',
      remoteProvider: 'googleDrive',
      remoteFileId: 'drive-file-1',
    });
    expect(stored?.remoteBlobKey).toBeUndefined();
    expect(stored?.localBlobKey).toBeUndefined();
    expect(repo.records.has('att-1')).toBe(true);
    expect(blobs.records.size).toBe(0);
    expect(blobs.putBlob).not.toHaveBeenCalled();
    expect(blobs.deleteBlob).not.toHaveBeenCalled();
    expect(JSON.stringify(result)).not.toContain('token-secret');
    expect(JSON.stringify(result)).not.toContain('access_token=secret');
  });

  it('preserves adapter sanitized rate-limit errors through recovery normalization', async () => {
    const repo = memoryRepository([metadata()]);
    const blobs = memoryBlobAdapter();
    const provider = remoteProvider(async () => {
      throw {
        sanitized: {
          message: 'Google Drive rate limit blocked recovery access_token=token-secret codeVerifier=verifier-secret',
          category: 'provider',
          retryable: true,
          code: 'rate_limited',
        },
      };
    });

    const result = await recoverAttachmentBlobFromRemote({
      attachmentRepository: repo,
      localBlobAdapter: blobs,
      remoteProvider: provider,
      attachmentId: 'att-1',
      now: fixedNow(),
    });

    const stored = repo.records.get('att-1');
    expect(result.status).toBe('failed');
    expect(result.errorDetails).toMatchObject({
      code: 'rate_limited',
      category: 'provider',
      retryable: true,
    });
    expect(result.errorDetails?.message).toContain('Google Drive rate limit blocked recovery');
    expect(result.localBlobKey).toBeUndefined();
    expect(stored?.remoteSyncStatus).toBe('recoverable_remote');
    expect(stored?.remoteProvider).toBe('googleDrive');
    expect(stored?.remoteFileId).toBe('drive-file-1');
    expect(stored?.localBlobKey).toBeUndefined();
    expect(blobs.putBlob).not.toHaveBeenCalled();
    expect(JSON.stringify(result)).not.toContain('token-secret');
    expect(JSON.stringify(result)).not.toContain('verifier-secret');
  });

  it('does not mark recovered when local blob write fails', async () => {
    const repo = memoryRepository([metadata()]);
    const blobs = memoryBlobAdapter();
    blobs.putBlob.mockImplementation(async () => {
      throw new Error('local blob write failed Authorization: Bearer token-secret');
    });
    const provider = remoteProvider();

    const result = await recoverAttachmentBlobFromRemote({
      attachmentRepository: repo,
      localBlobAdapter: blobs,
      remoteProvider: provider,
      attachmentId: 'att-1',
      now: fixedNow(),
    });

    const stored = repo.records.get('att-1');
    expect(result.status).toBe('failed');
    expect(result.errorDetails).toMatchObject({
      code: 'local_blob_write_failed',
      retryable: false,
    });
    expect(result.localBlobKey).toBeUndefined();
    expect(stored?.remoteSyncStatus).toBe('recoverable_remote');
    expect(stored?.remoteProvider).toBe('googleDrive');
    expect(stored?.remoteFileId).toBe('drive-file-1');
    expect(stored?.localBlobKey).toBeUndefined();
    expect(blobs.deleteBlob).not.toHaveBeenCalled();
    expect(JSON.stringify(result)).not.toContain('token-secret');
  });

  it('does not report success when final metadata update fails after local write', async () => {
    const repo = memoryRepository([metadata()]);
    const originalUpdate = repo.updateAttachment;
    repo.updateAttachment = vi.fn(async (id, patch) => {
      if (patch.remoteSyncStatus === 'synced') {
        throw new Error('metadata update failed code_verifier=verifier-secret');
      }
      return originalUpdate(id, patch);
    });
    const blobs = memoryBlobAdapter();
    const provider = remoteProvider();

    const result = await recoverAttachmentBlobFromRemote({
      attachmentRepository: repo,
      localBlobAdapter: blobs,
      remoteProvider: provider,
      attachmentId: 'att-1',
      now: fixedNow(),
    });

    const stored = repo.records.get('att-1');
    expect(result.status).toBe('failed');
    expect(result.errorDetails).toMatchObject({
      code: 'metadata_update_failed',
      retryable: false,
    });
    expect(result.localBlobKey).toBeUndefined();
    expect(stored?.remoteSyncStatus).toBe('recoverable_remote');
    expect(stored?.localBlobKey).toBeUndefined();
    expect(blobs.records.has('local-attachment/recovered-att-1')).toBe(true);
    expect(blobs.deleteBlob).not.toHaveBeenCalled();
    expect(JSON.stringify(result)).not.toContain('verifier-secret');
  });

  it('sanitizes callback, code verifier, token, and raw blob payload failures', async () => {
    const repo = memoryRepository([metadata()]);
    const blobs = memoryBlobAdapter();
    const provider = remoteProvider(async () => {
      throw new Error(
        'download failed access_token=token-secret refresh_token=refresh-secret code=auth-secret code_verifier=verifier-secret codeVerifierRef=ref-secret Authorization: Bearer bearer-secret http://127.0.0.1:5173/oauth/google-drive/callback?code=callback-secret&state=state-secret data:image/png;base64,AAA111'
      );
    });

    const result = await recoverAttachmentBlobFromRemote({
      attachmentRepository: repo,
      localBlobAdapter: blobs,
      remoteProvider: provider,
      attachmentId: 'att-1',
      now: fixedNow(),
    });

    const serialized = JSON.stringify(result);
    expect(result.status).toBe('failed');
    expect(serialized).not.toContain('token-secret');
    expect(serialized).not.toContain('refresh-secret');
    expect(serialized).not.toContain('auth-secret');
    expect(serialized).not.toContain('verifier-secret');
    expect(serialized).not.toContain('ref-secret');
    expect(serialized).not.toContain('bearer-secret');
    expect(serialized).not.toContain('/oauth/google-drive/callback?code=');
    expect(serialized).not.toContain('AAA111');
    expect(repo.records.get('att-1')?.remoteSyncStatus).toBe('recoverable_remote');
    expect(repo.records.get('att-1')?.localBlobKey).toBeUndefined();
    expect(blobs.putBlob).not.toHaveBeenCalled();
  });

  it('reconciles stale uploading status only when explicitly invoked', async () => {
    const repo = memoryRepository([
      metadata({
        id: 'att-stale',
        remoteSyncStatus: 'uploading',
        lastRemoteSyncAttemptAt: '2026-06-27T00:00:00.000Z',
      }),
      metadata({
        id: 'att-fresh',
        remoteSyncStatus: 'uploading',
        lastRemoteSyncAttemptAt: '2026-06-27T00:09:30.000Z',
      }),
    ]);

    const result = await reconcileStaleRemoteSyncStatus({
      attachmentRepository: repo,
      maxUploadingAgeMs: 60_000,
      now: () => new Date('2026-06-27T00:10:00.000Z'),
    });

    expect(result).toMatchObject({
      checkedCount: 2,
      reconciledCount: 1,
    });
    expect(repo.records.get('att-stale')?.remoteSyncStatus).toBe('failed');
    expect(repo.records.get('att-fresh')?.remoteSyncStatus).toBe('uploading');
  });

  it('does not import UI, Google adapter, cleanup, OAuth, remote delete, or schedulers', () => {
    const source = readFileSync(join(process.cwd(), 'src/lib/attachmentRemoteRecovery.ts'), 'utf8');

    expect(source).not.toContain('setInterval');
    expect(source).not.toContain('addEventListener');
    expect(source).not.toContain('GoogleDriveBlobAdapter');
    expect(source).not.toContain('useNotesStore');
    expect(source).not.toContain('oauth2.googleapis.com/token');
    expect(source).not.toContain('refresh_token');
    expect(source).not.toContain('client_secret');
    expect(source).not.toContain('deleteBlob(');
    expect(source).not.toContain('remoteDelete');
    expect(source).not.toContain('executeAttachmentCleanup');
  });
});
