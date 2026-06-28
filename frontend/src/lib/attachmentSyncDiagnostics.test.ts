import { describe, expect, it, vi } from 'vitest';
import type {
  AttachmentBlobInventoryRecord,
  AttachmentMetadata,
  AttachmentRepository,
  BlobStorageAdapter,
} from './attachmentRepository';
import { buildAttachmentSyncDiagnostics } from './attachmentSyncDiagnostics';

const NOW = '2026-06-28T00:00:00.000Z';

function metadata(overrides: Partial<AttachmentMetadata> = {}): AttachmentMetadata {
  return {
    id: 'att-1',
    noteId: 'note-1',
    fileName: 'image.png',
    mimeType: 'image/png',
    size: 128,
    checksum: 'md5:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    localBlobKey: 'local-attachment/att-1',
    remoteProvider: 'googleDrive',
    remoteFileId: 'drive-file-1',
    remoteChecksum: 'md5:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    remoteSize: 128,
    remoteSyncStatus: 'synced',
    remoteVerification: {
      sizeVerified: true,
      checksumVerified: true,
      checksumAlgorithm: 'md5',
    },
    createdAt: '2026-06-01T00:00:00.000Z',
    updatedAt: '2026-06-20T00:00:00.000Z',
    syncStatus: 'synced',
    ...overrides,
  };
}

function inventory(overrides: Partial<AttachmentBlobInventoryRecord> = {}): AttachmentBlobInventoryRecord {
  return {
    localBlobKey: 'local-attachment/att-1',
    size: 128,
    mimeType: 'image/png',
    checksum: 'md5:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    createdAt: '2026-06-01T00:00:00.000Z',
    updatedAt: '2026-06-20T00:00:00.000Z',
    ...overrides,
  };
}

function repository(records: AttachmentMetadata[]): AttachmentRepository {
  return {
    listAttachments: vi.fn(async () => records),
    listAttachmentsForNote: vi.fn(async noteId => records.filter(record => record.noteId === noteId)),
    getAttachment: vi.fn(async id => records.find(record => record.id === id) ?? null),
    putAttachment: vi.fn(async () => {}),
    updateAttachment: vi.fn(async () => {}),
    tombstoneAttachment: vi.fn(async () => {}),
    deleteAttachmentMetadata: vi.fn(async () => {}),
    putMetadata: vi.fn(async item => item),
    getMetadata: vi.fn(async id => records.find(record => record.id === id) ?? null),
    listForNote: vi.fn(async noteId => records.filter(record => record.noteId === noteId)),
    markDeleted: vi.fn(async () => null),
  };
}

function blobAdapter(records: AttachmentBlobInventoryRecord[]): BlobStorageAdapter {
  return {
    putBlob: vi.fn(),
    getBlob: vi.fn(),
    deleteBlob: vi.fn(),
    getObjectUrl: vi.fn(),
    listBlobRecords: vi.fn(async () => records),
  } as unknown as BlobStorageAdapter;
}

describe('attachment sync diagnostics', () => {
  it('summarizes status counts, provider breakdown, verification health, and byte split', async () => {
    const attachments = [
      metadata(),
      metadata({
        id: 'att-size-only',
        localBlobKey: 'local-attachment/att-size-only',
        remoteFileId: 'drive-file-2',
        remoteChecksum: 'sha256:remote',
        checksum: 'sha1:local',
        remoteVerification: {
          sizeVerified: true,
          checksumVerified: false,
          sizeOnlyVerified: true,
          warnings: ['Local checksum algorithm is incompatible; size-only verification used.'],
        },
      }),
      metadata({ id: 'att-local', remoteProvider: undefined, remoteFileId: undefined, remoteSyncStatus: 'local_only', localBlobKey: undefined }),
      metadata({ id: 'att-pending', remoteSyncStatus: 'pending_upload', localBlobKey: 'local-attachment/att-pending' }),
      metadata({ id: 'att-uploading', remoteSyncStatus: 'uploading', localBlobKey: 'local-attachment/att-uploading' }),
      metadata({ id: 'att-failed', remoteSyncStatus: 'failed', localBlobKey: 'local-attachment/att-failed', remoteError: 'Authorization: Bearer access-token-secret refresh_token=refresh-secret' }),
      metadata({ id: 'att-paused', remoteSyncStatus: 'paused_offline', localBlobKey: 'local-attachment/att-paused' }),
      metadata({ id: 'att-recoverable', remoteSyncStatus: 'recoverable_remote', localBlobKey: 'local-attachment/att-recoverable' }),
      metadata({ id: 'att-missing-local', remoteSyncStatus: 'missing_local', localBlobKey: undefined }),
      metadata({ id: 'att-conflict', remoteSyncStatus: 'conflict', localBlobKey: 'local-attachment/att-conflict', remoteError: 'stale upload conflict' }),
      metadata({ id: 'att-keep', keepOffline: true, localBlobKey: 'local-attachment/att-keep' }),
    ];
    const blobs = [
      inventory(),
      inventory({ localBlobKey: 'local-attachment/att-size-only' }),
      inventory({ localBlobKey: 'local-attachment/att-pending' }),
      inventory({ localBlobKey: 'local-attachment/att-uploading' }),
      inventory({ localBlobKey: 'local-attachment/att-failed' }),
      inventory({ localBlobKey: 'local-attachment/att-paused' }),
      inventory({ localBlobKey: 'local-attachment/att-recoverable' }),
      inventory({ localBlobKey: 'local-attachment/att-conflict' }),
      inventory({ localBlobKey: 'local-attachment/att-keep' }),
    ];

    const diagnostics = await buildAttachmentSyncDiagnostics({
      attachments,
      blobInventory: blobs,
      now: () => new Date(NOW),
    });

    expect(diagnostics.statusCounts).toMatchObject({
      total: 11,
      local_only: 1,
      pending_upload: 1,
      uploading: 1,
      synced: 3,
      failed: 1,
      paused_offline: 1,
      recoverable_remote: 1,
      missing_local: 1,
      conflict: 1,
      localBlobPresent: 9,
      localBlobMissing: 2,
      keepOffline: 1,
    });
    expect(diagnostics.providerCounts.googleDrive).toBe(10);
    expect(diagnostics.providerCounts['local/no remote provider']).toBe(1);
    expect(diagnostics.verificationCounts).toMatchObject({
      fullyVerifiedRemoteAttachments: 9,
      sizeOnlyVerifiedAttachments: 1,
      verificationWarningCount: 1,
      staleUploadConflictCount: 1,
      providerErrorCount: 2,
    });
    expect(diagnostics.evictionSummary).toMatchObject({
      candidateCount: 3,
      fullyVerifiedCandidateCount: 2,
      sizeOnlyCandidateCount: 1,
      excludedCount: 8,
      needsReviewCount: 1,
      protectedKeepOfflineCount: 1,
      statusExcludedCount: 5,
    });
    expect(diagnostics.byteSummary.fullyVerifiedRecoverableBytes).toBe(256);
    expect(diagnostics.byteSummary.reviewOnlyRecoverableBytes).toBe(128);
    expect(diagnostics.byteSummary.blockedBytes).toBeGreaterThan(0);
  });

  it('reports inventory partial state and sanitizes warnings/errors', async () => {
    const diagnostics = await buildAttachmentSyncDiagnostics({
      attachments: [metadata({
        remoteError: 'failed https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&upload_id=session-secret Authorization: Bearer token-secret',
        remoteVerification: {
          sizeVerified: true,
          checksumVerified: false,
          warnings: ['checksum mismatch access_token=secret-token'],
        },
      })],
      blobInventory: [inventory({ inventoryPartial: true })],
      now: () => new Date(NOW),
    });

    const serialized = JSON.stringify(diagnostics);
    expect(diagnostics.inventory).toMatchObject({ available: true, partial: true });
    expect(diagnostics.inventory.warnings.join(' ')).toContain('partial');
    expect(serialized).not.toContain('session-secret');
    expect(serialized).not.toContain('token-secret');
    expect(serialized).not.toContain('secret-token');
    expect(serialized).not.toContain('data:image');
    expect(serialized).not.toContain('base64');
  });

  it('reads repository and blob inventory explicitly without mutating data or calling delete paths', async () => {
    const repo = repository([metadata()]);
    const blobs = blobAdapter([inventory()]);

    const diagnostics = await buildAttachmentSyncDiagnostics({
      repository: repo,
      blobAdapter: blobs,
      now: () => new Date(NOW),
    });

    expect(diagnostics.attachmentsScanned).toBe(1);
    expect(repo.listAttachments).toHaveBeenCalledTimes(1);
    expect(repo.updateAttachment).not.toHaveBeenCalled();
    expect(repo.tombstoneAttachment).not.toHaveBeenCalled();
    expect(repo.deleteAttachmentMetadata).not.toHaveBeenCalled();
    expect(blobs.listBlobRecords).toHaveBeenCalledTimes(1);
    expect(blobs.deleteBlob).not.toHaveBeenCalled();
    expect(blobs.getBlob).not.toHaveBeenCalled();
  });

  it('does not export execution helpers or import remote execution boundaries', async () => {
    const source = await import('./attachmentSyncDiagnostics');

    expect(source.buildAttachmentSyncDiagnostics).toBeTypeOf('function');
    expect(Object.keys(source)).not.toContain('executeAttachmentCleanup');
    expect(Object.keys(source)).not.toContain('recoverAttachmentBlobFromRemote');
    expect(Object.keys(source)).not.toContain('processAttachmentUploadQueue');
    expect(Object.keys(source)).not.toContain('executeLocalBlobEviction');
  });
});
