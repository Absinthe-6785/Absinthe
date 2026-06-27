import { describe, expect, it, vi } from 'vitest';
import type {
  AttachmentBlobInventoryRecord,
  AttachmentMetadata,
  AttachmentRepository,
  BlobStorageAdapter,
} from './attachmentRepository';
import { buildLocalBlobEvictionReview } from './localBlobEvictionPolicy';

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

async function review(
  attachments: AttachmentMetadata[],
  blobs: AttachmentBlobInventoryRecord[],
  options: { thresholdDays?: number } = {},
) {
  return buildLocalBlobEvictionReview({
    attachments,
    blobInventory: blobs,
    recentlyUsedThresholdDays: options.thresholdDays,
    now: () => new Date(NOW),
  });
}

describe('local blob eviction dry-run policy', () => {
  it('reports a synced remote-backed verified local blob as a future eviction candidate', async () => {
    const report = await review([metadata()], [inventory()]);

    expect(report).toMatchObject({
      dryRun: true,
      attachmentsScanned: 1,
      blobsScanned: 1,
      candidateCount: 1,
      excludedCount: 0,
      estimatedRecoverableBytes: 128,
      fullyVerifiedCandidateCount: 1,
      sizeOnlyCandidateCount: 0,
      inventoryAvailable: true,
      inventoryPartial: false,
    });
    expect(report.candidates[0]).toMatchObject({
      attachmentId: 'att-1',
      localBlobKey: 'local-attachment/att-1',
      remoteProvider: 'googleDrive',
      remoteFileId: 'drive-file-1',
      estimatedBytes: 128,
      confidence: 'high',
      recommendedAction: 'eligible_for_future_eviction',
      verification: {
        sizeVerified: true,
        checksumVerified: true,
      },
    });
  });

  it('allows recoverable_remote metadata with a present verified local blob as a candidate', async () => {
    const report = await review([metadata({ remoteSyncStatus: 'recoverable_remote' })], [inventory()]);

    expect(report.candidateCount).toBe(1);
    expect(report.candidates[0]?.confidence).toBe('high');
  });

  it.each([
    ['pending_upload'],
    ['uploading'],
    ['failed'],
    ['paused_offline'],
    ['local_only'],
    ['missing_local'],
    ['conflict'],
  ] as const)('excludes %s attachments from eviction candidates', async status => {
    const report = await review([metadata({ remoteSyncStatus: status })], [inventory()]);

    expect(report.candidateCount).toBe(0);
    expect(report.exclusions[0]).toMatchObject({
      attachmentId: 'att-1',
      reason: 'remote_status_excluded',
      status,
    });
    expect(report.statusExcludedCount).toBe(1);
  });

  it('excludes attachments missing remote recovery fields', async () => {
    const noProvider = await review([metadata({ remoteProvider: undefined })], [inventory()]);
    const noFile = await review([metadata({ remoteFileId: undefined })], [inventory()]);

    expect(noProvider.exclusions[0]?.reason).toBe('missing_remote_provider');
    expect(noFile.exclusions[0]?.reason).toBe('missing_remote_file_id');
  });

  it('excludes missing local blob keys and missing local inventory records', async () => {
    const noKey = await review([metadata({ localBlobKey: undefined })], [inventory()]);
    const missingBlob = await review([metadata()], []);

    expect(noKey.exclusions[0]?.reason).toBe('missing_local_blob_key');
    expect(missingBlob.exclusions[0]?.reason).toBe('local_blob_missing');
  });

  it('excludes size mismatches and checksum mismatches', async () => {
    const sizeMismatch = await review([metadata()], [inventory({ size: 127 })]);
    const checksumMismatch = await review([metadata()], [inventory({ checksum: 'md5:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' })]);

    expect(sizeMismatch.exclusions[0]?.reason).toBe('size_mismatch');
    expect(checksumMismatch.exclusions[0]?.reason).toBe('checksum_mismatch');
    expect(sizeMismatch.verificationExcludedCount).toBe(1);
    expect(checksumMismatch.verificationExcludedCount).toBe(1);
  });

  it('marks incompatible or unavailable checksums as size-only medium-confidence review candidates', async () => {
    const report = await review([
      metadata({
        checksum: 'sha256:abc',
        remoteChecksum: 'md5:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        remoteVerification: {
          sizeVerified: true,
          checksumVerified: false,
          sizeOnlyVerified: true,
          warnings: ['Local checksum algorithm is not compatible with remote checksum.'],
        },
      }),
    ], [inventory({ checksum: 'sha256:abc' })]);

    expect(report.candidateCount).toBe(1);
    expect(report.sizeOnlyCandidateCount).toBe(1);
    expect(report.fullyVerifiedCandidateCount).toBe(0);
    expect(report.needsReviewCount).toBe(1);
    expect(report.candidates[0]).toMatchObject({
      confidence: 'medium',
      recommendedAction: 'review_only',
      verification: {
        sizeVerified: true,
        checksumVerified: false,
        sizeOnlyVerified: true,
      },
    });
  });

  it('does not treat missing verification as fully safe', async () => {
    const report = await review([
      metadata({
        remoteChecksum: 'sha256:def',
        remoteVerification: undefined,
      }),
    ], [inventory({ checksum: 'sha256:abc' })]);

    expect(report.candidateCount).toBe(0);
    expect(report.exclusions[0]?.reason).toBe('checksum_mismatch');
  });

  it('excludes keepOffline and recently used attachments', async () => {
    const keepOffline = await review([metadata({ keepOffline: true })], [inventory()]);
    const recentlyUsed = await review([metadata({ lastPreviewedAt: '2026-06-27T23:00:00.000Z' })], [inventory()]);

    expect(keepOffline.exclusions[0]?.reason).toBe('keep_offline');
    expect(keepOffline.protectedKeepOfflineCount).toBe(1);
    expect(recentlyUsed.exclusions[0]?.reason).toBe('recently_used');
    expect(recentlyUsed.recentlyUsedExcludedCount).toBe(1);
  });

  it('does not exclude old usage timestamps beyond the configured threshold', async () => {
    const report = await review([metadata({ lastOpenedAt: '2026-05-01T00:00:00.000Z' })], [inventory()], { thresholdDays: 7 });

    expect(report.candidateCount).toBe(1);
  });

  it('excludes tombstoned metadata, stale conflicts, and migration or restore warnings', async () => {
    const deleted = await review([metadata({ deletedAt: '2026-06-20T00:00:00.000Z' })], [inventory()]);
    const stale = await review([metadata({ remoteSyncStatus: undefined, remoteError: 'stale upload conflict' })], [inventory()]);
    const migration = await review([metadata({
      localBlobKey: 'local-attachment/att-migrated-1',
      remoteVerification: {
        sizeVerified: true,
        checksumVerified: true,
        warnings: ['restore warning requires review'],
      },
    })], [inventory({ localBlobKey: 'local-attachment/att-migrated-1' })]);

    expect(deleted.exclusions[0]?.reason).toBe('deleted_metadata');
    expect(stale.exclusions[0]?.reason).toBe('stale_upload_conflict');
    expect(migration.exclusions[0]?.reason).toBe('migration_or_restore_warning');
    expect(stale.needsReviewCount).toBe(1);
    expect(migration.needsReviewCount).toBe(1);
  });

  it('reports inventory availability and excludes partial inventory conservatively', async () => {
    const partial = await review([metadata()], [inventory({ inventoryPartial: true })]);
    const unavailable = await buildLocalBlobEvictionReview({
      attachments: [metadata()],
      blobAdapter: {} as BlobStorageAdapter,
      now: () => new Date(NOW),
    });

    expect(partial.inventoryAvailable).toBe(true);
    expect(partial.inventoryPartial).toBe(true);
    expect(partial.exclusions[0]?.reason).toBe('inventory_partial');
    expect(unavailable.inventoryAvailable).toBe(false);
    expect(unavailable.inventoryPartial).toBe(true);
    expect(unavailable.candidateCount).toBe(0);
    expect(unavailable.exclusions[0]?.reason).toBe('inventory_unavailable');
  });

  it('can read through repository and blob inventory adapters without deleting anything', async () => {
    const repo = repository([metadata()]);
    const blobs = blobAdapter([inventory()]);

    const report = await buildLocalBlobEvictionReview({
      repository: repo,
      blobAdapter: blobs,
      now: () => new Date(NOW),
    });

    expect(report.candidateCount).toBe(1);
    expect(repo.deleteAttachmentMetadata).not.toHaveBeenCalled();
    expect(repo.tombstoneAttachment).not.toHaveBeenCalled();
    expect(repo.updateAttachment).not.toHaveBeenCalled();
    expect(blobs.deleteBlob).not.toHaveBeenCalled();
    expect(blobs.getBlob).not.toHaveBeenCalled();
    expect(blobs.getObjectUrl).not.toHaveBeenCalled();
  });

  it('does not expose raw blobs, base64, tokens, session URIs, or remote delete actions in report output', async () => {
    const report = await review([metadata()], [inventory()]);
    const serialized = JSON.stringify(report);

    expect(serialized).not.toContain('data:image');
    expect(serialized).not.toContain('base64');
    expect(serialized).not.toContain('access_token');
    expect(serialized).not.toContain('refresh_token');
    expect(serialized).not.toContain('client_secret');
    expect(serialized).not.toContain('upload_id');
    expect(serialized).not.toContain('resumableSessionUri');
    expect(serialized).not.toContain('remoteDelete');
    expect(serialized).not.toContain('deleteBlob');
  });

  it('is report-only on import and does not auto-run cleanup or eviction executors', async () => {
    const source = await import('./localBlobEvictionPolicy');

    expect(source.buildLocalBlobEvictionReview).toBeTypeOf('function');
    expect(Object.keys(source)).toEqual(expect.arrayContaining(['buildLocalBlobEvictionReview']));
    expect(Object.keys(source)).not.toContain('executeLocalBlobEviction');
  });
});
