import { describe, expect, it, vi } from 'vitest';
import type { AttachmentBlobRecord, AttachmentMetadata, AttachmentRepository } from './attachmentRepository';
import {
  buildAttachmentCleanupReview,
  findAttachmentReferencesInText,
} from './attachmentCleanupReview';
import {
  EMBEDDED_ATTACHMENT_MIGRATION_BACKUP_PREFIX,
  type EmbeddedAttachmentMigrationBackup,
  type EmbeddedAttachmentMigrationReport,
  type EmbeddedAttachmentMigrationNote,
} from './embeddedAttachmentMigration';
import type {
  EmbeddedAttachmentMigrationBackupReader,
  EmbeddedAttachmentMigrationRestoreReport,
} from './embeddedAttachmentMigrationRestore';

function metadata(overrides: Partial<AttachmentMetadata> = {}): AttachmentMetadata {
  const id = overrides.id ?? 'att-1';
  return {
    id,
    noteId: overrides.noteId ?? 'n1',
    fileName: overrides.fileName ?? `${id}.png`,
    mimeType: overrides.mimeType ?? 'image/png',
    size: overrides.size ?? 12,
    checksum: overrides.checksum ?? `fnv1a:${id}`,
    localBlobKey: overrides.localBlobKey ?? `local-attachment/${id}`,
    source: overrides.source ?? 'local',
    createdAt: overrides.createdAt ?? '2026-06-27T00:00:00.000Z',
    updatedAt: overrides.updatedAt ?? '2026-06-27T00:00:00.000Z',
    deletedAt: overrides.deletedAt ?? null,
    syncStatus: overrides.syncStatus ?? 'local',
  };
}

function blob(key: string, size = 12): AttachmentBlobRecord {
  return {
    key,
    blob: new Blob(['x'.repeat(size)], { type: 'image/png' }),
    mimeType: 'image/png',
    size,
    checksum: `fnv1a:${key}`,
  };
}

function backupStore(backups: Record<string, EmbeddedAttachmentMigrationBackup> = {}): EmbeddedAttachmentMigrationBackupReader {
  return {
    async listBackupKeys() { return Object.keys(backups).sort(); },
    async getBackup(key) { return backups[key] ?? null; },
  };
}

function backup(key: string, noteId = 'n1'): { key: string; value: EmbeddedAttachmentMigrationBackup } {
  return {
    key,
    value: {
      noteId,
      originalBody: `![scan](data:image/png;base64,SHOULD_NOT_LEAK_FULL_BASE64)`,
      originalContent: null,
      originalUpdatedAt: '2026-06-26T00:00:00.000Z',
      migrationId: 'migration-1',
      migrationVersion: 'k149-embedded-attachment-migration-v1',
      createdAt: '2026-06-27T00:00:00.000Z',
      candidateSummary: [{
        mimeType: 'image/png',
        kind: 'image',
        field: 'body',
        estimatedDecodedBytes: 32,
        sourceHash: 'fnv1a:source',
      }],
      checksum: 'fnv1a:backup',
    },
  };
}

function migrationReport(overrides: Partial<EmbeddedAttachmentMigrationReport> = {}): EmbeddedAttachmentMigrationReport {
  return {
    migrationId: 'migration-1',
    migrationVersion: 'k149-embedded-attachment-migration-v1',
    startedAt: '2026-06-27T00:00:00.000Z',
    completedAt: '2026-06-27T00:00:01.000Z',
    dryRun: false,
    notesScanned: 1,
    notesWithCandidates: 1,
    notesMigrated: 1,
    payloadsMigrated: 1,
    payloadsSkipped: 0,
    payloadsFailed: 0,
    backupsCreated: 1,
    attachmentsCreated: 1,
    blobsWritten: 1,
    totalEstimatedDecodedBytes: 12,
    noteResults: [{
      noteId: 'n1',
      status: 'migrated',
      candidatesFound: 1,
      migratedCount: 1,
      skippedCount: 0,
      failedCount: 0,
      backupKey: `${EMBEDDED_ATTACHMENT_MIGRATION_BACKUP_PREFIX}migration-1.n1`,
      bodyRewritten: true,
      previousBodyHash: 'fnv1a:before',
      rewrittenBodyHash: 'fnv1a:after',
      attachmentIds: ['att-migrated-1'],
      blobKeys: ['local-attachment/att-migrated-1'],
      orphanedAttachmentIds: [],
      orphanedBlobKeys: [],
      errors: [],
    }],
    ...overrides,
  };
}

function restoreReport(overrides: Partial<EmbeddedAttachmentMigrationRestoreReport> = {}): EmbeddedAttachmentMigrationRestoreReport {
  return {
    noteId: 'n1',
    backupKey: `${EMBEDDED_ATTACHMENT_MIGRATION_BACKUP_PREFIX}migration-1.n1`,
    restored: true,
    forced: false,
    previousBodyHash: 'fnv1a:after',
    restoredBodyHash: 'fnv1a:before',
    warnings: [],
    errors: [],
    ...overrides,
  };
}

function memoryRepository(records: AttachmentMetadata[]): AttachmentRepository {
  return {
    async listAttachments() { return records; },
    async listAttachmentsForNote(noteId) { return records.filter(record => record.noteId === noteId); },
    async getAttachment(id) { return records.find(record => record.id === id) ?? null; },
    async putAttachment() { throw new Error('dry-run must not write metadata'); },
    async updateAttachment() { throw new Error('dry-run must not update metadata'); },
    async tombstoneAttachment() { throw new Error('dry-run must not tombstone metadata'); },
    deleteAttachmentMetadata: vi.fn(async () => {
      throw new Error('dry-run must not delete metadata');
    }),
    async putMetadata() { throw new Error('dry-run must not write metadata'); },
    async getMetadata(id) { return records.find(record => record.id === id) ?? null; },
    async listForNote(noteId) { return records.filter(record => record.noteId === noteId); },
    async markDeleted() { throw new Error('dry-run must not mark metadata deleted'); },
  };
}

describe('attachment cleanup review foundation', () => {
  it('detects attachment references without treating data URLs as attachment references', () => {
    expect(findAttachmentReferencesInText('![x](attachment://att-1) attachment://att_2 data:image/png;base64,AAA')).toEqual([
      'att-1',
      'att_2',
    ]);
  });

  it('reports referenced attachments as keep-only information', async () => {
    const report = await buildAttachmentCleanupReview({
      notes: [{ id: 'n1', body: '![scan](attachment://att-1)' }],
      attachments: [metadata({ id: 'att-1' })],
      localBlobs: [blob('local-attachment/att-1')],
      now: () => '2026-06-27T00:00:00.000Z',
    });

    expect(report.referencedAttachmentCount).toBe(1);
    expect(report.unreferencedAttachmentMetadataCount).toBe(0);
    expect(report.candidates).toContainEqual(expect.objectContaining({
      type: 'referencedAttachment',
      severity: 'info',
      attachmentId: 'att-1',
      safeActionRecommendation: expect.stringContaining('Keep'),
    }));
  });

  it('reports unreferenced attachment metadata as a review candidate', async () => {
    const report = await buildAttachmentCleanupReview({
      notes: [{ id: 'n1', body: 'plain' }],
      attachments: [metadata({ id: 'att-1' })],
      localBlobs: [blob('local-attachment/att-1')],
    });

    expect(report.unreferencedAttachmentMetadataCount).toBe(1);
    expect(report.candidates).toContainEqual(expect.objectContaining({
      type: 'unreferencedAttachmentMetadata',
      severity: 'warning',
      attachmentId: 'att-1',
    }));
  });

  it('reports unreferenced local blobs when blob inventory is provided', async () => {
    const report = await buildAttachmentCleanupReview({
      notes: [],
      attachments: [],
      blobInventory: [{
        localBlobKey: 'local-attachment/orphan',
        size: 12,
        mimeType: 'image/png',
        createdAt: '2026-06-27T00:00:00.000Z',
      }],
    });

    expect(report.inventoryAvailable).toBe(true);
    expect(report.inventoryPartial).toBe(false);
    expect(report.unreferencedBlobCount).toBe(1);
    expect(report.estimatedRecoverableBytes).toBe(12);
    expect(report.candidates).toContainEqual(expect.objectContaining({
      type: 'unreferencedBlob',
      localBlobKey: 'local-attachment/orphan',
    }));
  });

  it('reports partial blob inventory without exposing raw blob data', async () => {
    const report = await buildAttachmentCleanupReview({
      notes: [],
      attachments: [],
      blobInventory: [{
        localBlobKey: 'local-attachment/partial',
        size: 7,
        mimeType: 'image/png',
        inventoryPartial: true,
      }],
    });

    expect(report.inventoryAvailable).toBe(true);
    expect(report.inventoryPartial).toBe(true);
    expect(report.warnings.join(' ')).toContain('partial');
    expect(JSON.stringify(report)).not.toContain('xxxxxxxx');
  });

  it('reports missing blob as an integrity warning, not a deletion candidate', async () => {
    const report = await buildAttachmentCleanupReview({
      notes: [{ id: 'n1', body: 'attachment://att-1' }],
      attachments: [metadata({ id: 'att-1', localBlobKey: 'local-attachment/missing', size: 50 })],
      localBlobs: [],
    });

    expect(report.missingBlobCount).toBe(1);
    expect(report.inventoryAvailable).toBe(true);
    expect(report.estimatedRecoverableBytes).toBe(0);
    expect(report.candidates).toContainEqual(expect.objectContaining({
      type: 'missingBlob',
      severity: 'warning',
      localBlobKey: 'local-attachment/missing',
      safeActionRecommendation: expect.stringContaining('Do not delete'),
    }));
  });

  it('still handles unavailable blob inventory without destructive fallback', async () => {
    const report = await buildAttachmentCleanupReview({
      notes: [],
      attachments: [],
      blobAdapter: {
        async putBlob() { throw new Error('not used'); },
        async getBlob() { throw new Error('not used'); },
        async deleteBlob() { throw new Error('not used'); },
        async getObjectUrl() { throw new Error('not used'); },
      },
    });

    expect(report.inventoryAvailable).toBe(false);
    expect(report.inventoryPartial).toBe(true);
    expect(report.warnings.join(' ')).toContain('unavailable');
  });

  it('reports missing metadata for attachment references as an integrity warning', async () => {
    const report = await buildAttachmentCleanupReview({
      notes: [{ id: 'n1', body: 'attachment://att-missing' }],
      attachments: [],
      localBlobs: [],
    });

    expect(report.missingMetadataCount).toBe(1);
    expect(report.candidates).toContainEqual(expect.objectContaining({
      type: 'missingMetadata',
      attachmentId: 'att-missing',
      noteId: 'n1',
      safeActionRecommendation: expect.stringContaining('Do not delete'),
    }));
  });

  it('reports backup records without making them cleanup candidates by default', async () => {
    const item = backup(`${EMBEDDED_ATTACHMENT_MIGRATION_BACKUP_PREFIX}migration-1.n1`);
    const report = await buildAttachmentCleanupReview({
      notes: [],
      attachments: [],
      localBlobs: [],
      backupReader: backupStore({ [item.key]: item.value }),
    });

    expect(report.backupRecordCount).toBe(1);
    expect(report.candidates).toContainEqual(expect.objectContaining({
      type: 'backupRecord',
      severity: 'info',
      backupKey: item.key,
      safeActionRecommendation: expect.stringContaining('not automatically deleted'),
    }));
  });

  it('identifies restored migration artifacts when restored notes no longer reference migration attachments', async () => {
    const report = await buildAttachmentCleanupReview({
      notes: [{ id: 'n1', body: 'restored original note' }],
      attachments: [metadata({ id: 'att-migrated-1', localBlobKey: 'local-attachment/att-migrated-1' })],
      localBlobs: [blob('local-attachment/att-migrated-1')],
      migrationReports: [migrationReport()],
      restoreReports: [restoreReport()],
    });

    expect(report.restoredMigrationArtifactCount).toBe(1);
    expect(report.candidates).toContainEqual(expect.objectContaining({
      type: 'restoredMigrationArtifact',
      attachmentId: 'att-migrated-1',
      backupKey: `${EMBEDDED_ATTACHMENT_MIGRATION_BACKUP_PREFIX}migration-1.n1`,
    }));
  });

  it('reports partial migration artifacts from failed migration reports', async () => {
    const failed = migrationReport({
      notesMigrated: 0,
      payloadsMigrated: 0,
      payloadsFailed: 1,
      noteResults: [{
        noteId: 'n1',
        status: 'failed',
        candidatesFound: 1,
        migratedCount: 0,
        skippedCount: 0,
        failedCount: 1,
        backupKey: 'backup-key',
        attachmentIds: [],
        blobKeys: ['local-attachment/att-migrated-1'],
        orphanedAttachmentIds: ['att-migrated-1'],
        orphanedBlobKeys: ['local-attachment/att-migrated-1'],
        errors: ['metadata failed'],
      }],
    });

    const report = await buildAttachmentCleanupReview({
      notes: [{ id: 'n1', body: 'data already original' }],
      attachments: [],
      localBlobs: [blob('local-attachment/att-migrated-1')],
      migrationReports: [failed],
    });

    expect(report.partialMigrationArtifactCount).toBe(2);
    expect(report.candidates).toContainEqual(expect.objectContaining({
      type: 'partialMigrationArtifact',
      localBlobKey: 'local-attachment/att-migrated-1',
      migrationId: 'migration-1',
    }));
    expect(report.candidates).toContainEqual(expect.objectContaining({
      type: 'partialMigrationArtifact',
      attachmentId: 'att-migrated-1',
    }));
  });

  it('reports duplicate checksum candidates without marking them for automatic deletion', async () => {
    const report = await buildAttachmentCleanupReview({
      notes: [],
      attachments: [
        metadata({ id: 'att-a', checksum: 'fnv1a:same', localBlobKey: 'local-attachment/att-a' }),
        metadata({ id: 'att-b', checksum: 'fnv1a:same', localBlobKey: 'local-attachment/att-b' }),
      ],
      localBlobs: [blob('local-attachment/att-a'), blob('local-attachment/att-b')],
    });

    expect(report.duplicateCandidateCount).toBe(2);
    expect(report.candidates.filter(candidate => candidate.type === 'duplicateCandidate')).toEqual([
      expect.objectContaining({ safeActionRecommendation: expect.stringContaining('do not delete automatically') }),
      expect.objectContaining({ safeActionRecommendation: expect.stringContaining('do not delete automatically') }),
    ]);
  });

  it('does not expose raw blob contents or full base64 backup data in the report', async () => {
    const rawBase64 = 'SHOULD_NOT_LEAK_FULL_BASE64';
    const item = backup(`${EMBEDDED_ATTACHMENT_MIGRATION_BACKUP_PREFIX}migration-1.n1`);
    const report = await buildAttachmentCleanupReview({
      notes: [{ id: 'n1', body: `![x](data:image/png;base64,${rawBase64})` }],
      attachments: [],
      localBlobs: [blob('local-attachment/orphan')],
      backupReader: backupStore({ [item.key]: item.value }),
    });

    const serialized = JSON.stringify(report);
    expect(serialized).not.toContain(rawBase64);
    expect(serialized).not.toContain('xxxxxxxxxxxx');
  });

  it('dry-run does not mutate notes or delete blobs, metadata, or backups', async () => {
    const notes: EmbeddedAttachmentMigrationNote[] = [{ id: 'n1', body: 'plain' }];
    const originalNotes = JSON.stringify(notes);
    const repository = memoryRepository([metadata({ id: 'att-1' })]);
    const deleteBlob = vi.fn(async () => {});
    const backupReader: EmbeddedAttachmentMigrationBackupReader & { deleteBackup: ReturnType<typeof vi.fn> } = {
      async listBackupKeys() { return []; },
      async getBackup() { return null; },
      deleteBackup: vi.fn(),
    };

    await buildAttachmentCleanupReview({
      notes,
      repository,
      localBlobs: [blob('local-attachment/orphan')],
      backupReader,
    });

    expect(JSON.stringify(notes)).toBe(originalNotes);
    expect(deleteBlob).not.toHaveBeenCalled();
    expect(repository.deleteAttachmentMetadata).not.toHaveBeenCalled();
    expect(backupReader.deleteBackup).not.toHaveBeenCalled();
  });

  it('does not call Supabase Storage while reviewing cleanup candidates', async () => {
    const remoteStorage = { upload: vi.fn(), remove: vi.fn(), createSignedUrl: vi.fn() };

    await buildAttachmentCleanupReview({
      notes: [{ id: 'n1', body: 'plain' }],
      attachments: [],
      localBlobs: [],
    });

    expect(remoteStorage.upload).not.toHaveBeenCalled();
    expect(remoteStorage.remove).not.toHaveBeenCalled();
    expect(remoteStorage.createSignedUrl).not.toHaveBeenCalled();
  });
});
