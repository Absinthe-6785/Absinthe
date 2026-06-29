// @vitest-environment happy-dom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { AttachmentCleanupReviewReport } from '../../../lib/attachmentCleanupReview';
import type { AttachmentSyncDiagnostics } from '../../../lib/attachmentSyncDiagnostics';
import type { AttachmentRemoteRecoveryResult } from '../../../lib/attachmentRemoteRecovery';
import type { AttachmentExplicitUploadResult } from '../../../lib/attachmentExplicitUploadAction';
import type {
  AttachmentMetadata,
  AttachmentRepository,
  BlobStorageAdapter,
} from '../../../lib/attachmentRepository';
import type { GoogleDriveSessionConnectionController } from '../../../lib/googleDriveSessionConnectionController';
import {
  resolveRemoteProviderConnectionBoundary,
  type RemoteProviderConnectionBoundary,
} from '../../../lib/remoteProviderConnectionStatus';
import {
  attachmentCleanupCandidateId,
  createAttachmentCleanupConfirmationToken,
  hashAttachmentCleanupReviewReport,
  type AttachmentCleanupExecutorInput,
  type AttachmentCleanupExecutorReport,
} from '../../../lib/attachmentCleanupExecutor';
import type { EmbeddedAttachmentAuditReport } from '../../../lib/embeddedAttachmentAudit';
import {
  hashEmbeddedAttachmentMigrationText,
  type EmbeddedAttachmentMigrationReport,
} from '../../../lib/embeddedAttachmentMigration';
import type {
  EmbeddedAttachmentMigrationBackupReader,
  EmbeddedAttachmentMigrationBackupSummary,
  EmbeddedAttachmentMigrationRestoreInput,
  EmbeddedAttachmentMigrationRestoreReport,
} from '../../../lib/embeddedAttachmentMigrationRestore';
import type { NoteChromeColors } from '../noteEditorTheme';
import type { NoteBase as Note } from '../noteUtils';
import { EmbeddedAttachmentMigrationReviewPanel } from './EmbeddedAttachmentMigrationReviewPanel';

const colors: NoteChromeColors = {
  wrap: '#fff',
  sidebar: '#fff',
  sideBdr: '#ddd',
  notelist: '#fff',
  editor: '#fff',
  toolbar: '#fff',
  toolBdr: '#ddd',
  card: '#fff',
  cardHov: '#f7f7f7',
  cardAct: '#eee',
  cardActBdr: '#8b5cf6',
  text: '#111',
  textMuted: '#555',
  textFaint: '#888',
  accent: '#7c3aed',
  accentBg: '#f5f3ff',
  input: '#fff',
  inputBdr: '#ddd',
  badge: '#eee',
  badgeTxt: '#7c3aed',
  tag: '#eee',
  tagTxt: '#7c3aed',
  danger: '#dc2626',
  green: '#16a34a',
};

const embeddedPayload = 'data:image/png;base64,QUJDREVGR0hJSktMTU5PUA==';

function note(body = embeddedPayload): Note {
  return {
    id: 'note-1',
    title: 'Scanned note',
    body,
    updatedAt: 1,
    folderId: null,
    deletedAt: null,
  };
}

function reportWithCandidate(): EmbeddedAttachmentAuditReport {
  return {
    summary: {
      totalNotesScanned: 1,
      notesWithEmbeddedPayloads: 1,
      totalEmbeddedPayloads: 1,
      totalEstimatedBase64Bytes: 24,
      totalEstimatedDecodedBytes: 16,
      imagePayloadCount: 1,
      pdfPayloadCount: 0,
      otherDataPayloadCount: 0,
    },
    candidates: [{
      noteId: 'note-1',
      noteTitle: 'Scanned note',
      payloadCount: 1,
      estimatedBase64Bytes: 24,
      estimatedDecodedBytes: 16,
      payloads: [{
        noteId: 'note-1',
        mimeType: 'image/png',
        kind: 'image',
        matchIndex: 0,
        startOffset: 0,
        endOffset: 40,
        previewLabel: 'image/png;base64,QUJD...',
        estimatedBase64Bytes: 24,
        estimatedDecodedBytes: 16,
        recommendedTarget: 'local-attachment',
      }],
    }],
    k149MigrationRequirements: [],
  };
}

function emptyReport(): EmbeddedAttachmentAuditReport {
  return {
    summary: {
      totalNotesScanned: 1,
      notesWithEmbeddedPayloads: 0,
      totalEmbeddedPayloads: 0,
      totalEstimatedBase64Bytes: 0,
      totalEstimatedDecodedBytes: 0,
      imagePayloadCount: 0,
      pdfPayloadCount: 0,
      otherDataPayloadCount: 0,
    },
    candidates: [],
    k149MigrationRequirements: [],
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
    totalEstimatedDecodedBytes: 16,
    noteResults: [{
      noteId: 'note-1',
      status: 'migrated',
      candidatesFound: 1,
      migratedCount: 1,
      skippedCount: 0,
      failedCount: 0,
      backupKey: 'backup-key',
      attachmentIds: ['att-1'],
      blobKeys: ['local-attachment/att-1'],
      orphanedAttachmentIds: [],
      orphanedBlobKeys: [],
      errors: [],
    }],
    ...overrides,
  };
}

function cleanupReviewReport(overrides: Partial<AttachmentCleanupReviewReport> = {}): AttachmentCleanupReviewReport {
  return {
    reportId: 'attachment-cleanup-review-1',
    createdAt: '2026-06-27T00:00:00.000Z',
    dryRun: true,
    notesScanned: 2,
    attachmentsScanned: 3,
    blobsScanned: 0,
    inventoryAvailable: false,
    inventoryPartial: true,
    backupsScanned: 1,
    referencedAttachmentCount: 1,
    unreferencedAttachmentMetadataCount: 1,
    unreferencedBlobCount: 1,
    partialMigrationArtifactCount: 1,
    restoredMigrationArtifactCount: 1,
    missingBlobCount: 1,
    missingMetadataCount: 1,
    duplicateCandidateCount: 1,
    backupRecordCount: 1,
    estimatedRecoverableBytes: 2048,
    warnings: ['Local blob inventory is unavailable; unreferenced blob detection is limited.'],
    errors: [],
    candidates: [
      {
        type: 'referencedAttachment',
        severity: 'info',
        attachmentId: 'att-in-use',
        noteId: 'note-1',
        reason: 'Attachment metadata is referenced by note content.',
        safeActionRecommendation: 'Keep. This is not a cleanup candidate.',
        estimatedBytes: 100,
      },
      {
        type: 'unreferencedAttachmentMetadata',
        severity: 'warning',
        attachmentId: 'att-orphan',
        localBlobKey: 'local-attachment/att-orphan',
        reason: 'Attachment metadata is not referenced by any scanned note.',
        safeActionRecommendation: 'Review manually before any explicit cleanup.',
        estimatedBytes: 1024,
      },
      {
        type: 'unreferencedBlob',
        severity: 'warning',
        localBlobKey: 'local-attachment/blob-orphan',
        reason: 'Local blob has no attachment metadata pointing to it.',
        safeActionRecommendation: 'Review manually before any explicit cleanup.',
        estimatedBytes: 1024,
      },
      {
        type: 'missingBlob',
        severity: 'warning',
        attachmentId: 'att-missing-blob',
        localBlobKey: 'local-attachment/missing',
        reason: 'Attachment metadata points to a local blob key that was not found.',
        safeActionRecommendation: 'Do not delete metadata automatically; this is an integrity warning.',
      },
      {
        type: 'missingMetadata',
        severity: 'warning',
        attachmentId: 'att-missing-metadata',
        noteId: 'note-1',
        reason: 'attachment://att-missing-metadata is referenced by a note but metadata is missing.',
        safeActionRecommendation: 'Do not delete; restore or recreate attachment metadata if the note still needs it.',
      },
      {
        type: 'partialMigrationArtifact',
        severity: 'warning',
        attachmentId: 'att-partial',
        localBlobKey: 'local-attachment/att-partial',
        migrationId: 'migration-1',
        reason: 'Migration created resources before the note rewrite completed.',
        safeActionRecommendation: 'Review the failed migration report before any explicit cleanup.',
      },
      {
        type: 'restoredMigrationArtifact',
        severity: 'info',
        attachmentId: 'att-restored',
        localBlobKey: 'local-attachment/att-restored',
        migrationId: 'migration-1',
        reason: 'Restored migration resource is retained for traceability.',
        safeActionRecommendation: 'Keep. Restored artifacts are not cleanup candidates.',
      },
      {
        type: 'duplicateCandidate',
        severity: 'warning',
        attachmentId: 'att-duplicate',
        localBlobKey: 'local-attachment/att-duplicate',
        reason: 'Multiple review entries point to the same local resource.',
        safeActionRecommendation: 'Resolve manually before cleanup.',
      },
      {
        type: 'backupRecord',
        severity: 'info',
        backupKey: 'backup-key',
        noteId: 'note-1',
        migrationId: 'migration-1',
        reason: 'Migration backup exists for traceability and restore.',
        safeActionRecommendation: 'Keep. Backups are not automatically deleted by cleanup review.',
      },
    ],
    ...overrides,
  };
}

function cleanupExecutorReport(overrides: Partial<AttachmentCleanupExecutorReport> = {}): AttachmentCleanupExecutorReport {
  return {
    cleanupId: 'cleanup-1',
    sourceReviewReportId: 'attachment-cleanup-review-1',
    startedAt: '2026-06-27T00:00:02.000Z',
    completedAt: '2026-06-27T00:00:03.000Z',
    dryRun: false,
    confirmationVerified: true,
    requestedCandidateCount: 1,
    eligibleCandidateCount: 1,
    deletedBlobCount: 0,
    deletedAttachmentMetadataCount: 1,
    skippedCandidateCount: 0,
    failedCandidateCount: 0,
    blockedCandidateCount: 0,
    bytesRecoveredEstimate: 1024,
    results: [{
      candidateId: 'unreferencedAttachmentMetadata|att-orphan|local-attachment/att-orphan||||1',
      candidateType: 'unreferencedAttachmentMetadata',
      status: 'deleted',
      reason: 'Deleted revalidated unreferenced local attachment metadata.',
      attachmentId: 'att-orphan',
      localBlobKey: 'local-attachment/att-orphan',
      estimatedBytes: 1024,
    }],
    warnings: [],
    errors: [],
    ...overrides,
  };
}

function backupSummary(overrides: Partial<EmbeddedAttachmentMigrationBackupSummary> = {}): EmbeddedAttachmentMigrationBackupSummary {
  return {
    backupKey: 'absinthe.notes.embeddedAttachmentMigration.backup.migration-1.note-1',
    noteId: 'note-1',
    migrationId: 'migration-1',
    migrationVersion: 'k149-embedded-attachment-migration-v1',
    createdAt: '2026-06-27T00:00:00.000Z',
    originalUpdatedAt: '1',
    originalBodyBytes: 4096,
    originalContentBytes: 0,
    candidateCount: 1,
    estimatedDecodedBytes: 1024,
    mimeTypes: ['image/png'],
    checksum: 'checksum-1',
    ...overrides,
  };
}

function restoreReport(overrides: Partial<EmbeddedAttachmentMigrationRestoreReport> = {}): EmbeddedAttachmentMigrationRestoreReport {
  return {
    noteId: 'note-1',
    backupKey: 'absinthe.notes.embeddedAttachmentMigration.backup.migration-1.note-1',
    restored: true,
    forced: false,
    previousBodyHash: hashEmbeddedAttachmentMigrationText('migrated body'),
    restoredBodyHash: 'fnv1a:restored',
    warnings: [],
    errors: [],
    ...overrides,
  };
}

function diagnosticsReport(overrides: Partial<AttachmentSyncDiagnostics> = {}): AttachmentSyncDiagnostics {
  return {
    generatedAt: '2026-06-28T00:00:00.000Z',
    attachmentsScanned: 8,
    blobsScanned: 5,
    statusCounts: {
      total: 8,
      local_only: 1,
      pending_upload: 1,
      uploading: 1,
      synced: 2,
      failed: 1,
      paused_offline: 1,
      recoverable_remote: 1,
      missing_local: 1,
      conflict: 0,
      localBlobPresent: 5,
      localBlobMissing: 3,
      keepOffline: 1,
      unknown: 0,
    },
    providerCounts: {
      googleDrive: 4,
      'local/no remote provider': 1,
    },
    verificationCounts: {
      allRemoteBackedFullyVerified: 2,
      allRemoteBackedSizeOnlyVerified: 1,
      eligibleRecoverableFullyVerified: 1,
      eligibleRecoverableSizeOnlyVerified: 1,
      fullyVerifiedRemoteAttachments: 2,
      sizeOnlyVerifiedAttachments: 1,
      checksumMismatchCount: 1,
      sizeMismatchCount: 1,
      verificationWarningCount: 2,
      verificationMissingCount: 1,
      staleUploadConflictCount: 1,
      providerErrorCount: 1,
      providerErrorCountsByCategory: { network: 1 },
    },
    evictionSummary: {
      candidateCount: 2,
      fullyVerifiedCandidateCount: 1,
      sizeOnlyCandidateCount: 1,
      excludedCount: 6,
      needsReviewCount: 1,
      protectedKeepOfflineCount: 1,
      recentlyUsedExcludedCount: 1,
      statusExcludedCount: 2,
      verificationExcludedCount: 1,
      inventoryAvailable: true,
      inventoryPartial: true,
    },
    byteSummary: {
      fullyVerifiedRecoverableBytes: 2048,
      reviewOnlyRecoverableBytes: 1024,
      blockedBytes: 4096,
    },
    inventory: {
      available: true,
      partial: true,
      warnings: ['Blob inventory is partial. Diagnostics and eviction estimates may be incomplete.'],
    },
    warnings: ['Size-only verified / review required.'],
    errors: ['Remote failed with Authorization: Bearer [redacted-secret].'],
    recoveryItems: [
      {
        attachmentId: 'att-recoverable',
        localBlobKey: 'local-attachment/missing',
        remoteProvider: 'googleDrive',
        remoteFileId: 'drive-file-1',
        remoteSyncStatus: 'recoverable_remote',
        eligible: true,
        reason: 'Ready for explicit recovery',
        localBlobPresent: false,
        remoteSize: 2048,
        verification: {
          sizeVerified: true,
          checksumVerified: true,
        },
      },
      {
        attachmentId: 'att-missing-remote',
        remoteProvider: 'googleDrive',
        remoteSyncStatus: 'missing_local',
        eligible: false,
        reason: 'Missing local blob; recovery state needs reconciliation.',
        localBlobPresent: false,
      },
      {
        attachmentId: 'att-local-only',
        remoteSyncStatus: 'local_only',
        eligible: false,
        reason: 'Recovery unavailable',
        localBlobPresent: false,
      },
      {
        attachmentId: 'att-uploading',
        remoteProvider: 'googleDrive',
        remoteFileId: 'drive-file-2',
        remoteSyncStatus: 'uploading',
        eligible: false,
        reason: 'Upload pending',
        localBlobPresent: false,
      },
      {
        attachmentId: 'att-present',
        localBlobKey: 'local-attachment/present',
        remoteProvider: 'googleDrive',
        remoteFileId: 'drive-file-3',
        remoteSyncStatus: 'recoverable_remote',
        eligible: false,
        reason: 'Local blob already present',
        localBlobPresent: true,
      },
    ],
    uploadItems: [],
    ...overrides,
  };
}

function recoveryResult(overrides: Partial<AttachmentRemoteRecoveryResult> = {}): AttachmentRemoteRecoveryResult {
  return {
    recoveryId: 'attachment-recovery:att-recoverable:2026-06-28T00:00:00.000Z',
    attachmentId: 'att-recoverable',
    remoteProvider: 'googleDrive',
    remoteFileId: 'drive-file-1',
    status: 'recovered',
    localBlobKey: 'local-attachment/recovered-att-recoverable',
    remoteSize: 2048,
    localSize: 2048,
    verification: {
      sizeVerified: true,
      checksumVerified: true,
    },
    warnings: [],
    startedAt: '2026-06-28T00:00:00.000Z',
    completedAt: '2026-06-28T00:00:01.000Z',
    ...overrides,
  };
}

function recoveryItem(
  overrides: Partial<AttachmentSyncDiagnostics['recoveryItems'][number]> = {},
): AttachmentSyncDiagnostics['recoveryItems'][number] {
  return {
    attachmentId: 'att-recoverable',
    localBlobKey: 'local-attachment/missing',
    remoteProvider: 'googleDrive',
    remoteFileId: 'drive-file-1',
    remoteSyncStatus: 'recoverable_remote',
    eligible: true,
    reason: 'Ready for explicit recovery',
    localBlobPresent: false,
    remoteSize: 2048,
    verification: {
      sizeVerified: true,
      checksumVerified: true,
    },
    ...overrides,
  };
}

function uploadItem(
  overrides: Partial<AttachmentSyncDiagnostics['uploadItems'][number]> = {},
): AttachmentSyncDiagnostics['uploadItems'][number] {
  return {
    attachmentId: 'att-uploadable',
    localBlobKey: 'local-attachment/uploadable',
    remoteSyncStatus: 'local_only',
    eligible: true,
    reason: 'Ready for explicit upload',
    localBlobPresent: true,
    localSize: 5,
    ...overrides,
  };
}

function uploadResult(overrides: Partial<AttachmentExplicitUploadResult> = {}): AttachmentExplicitUploadResult {
  return {
    uploadId: 'attachment-upload:att-uploadable:2026-06-28T00:00:00.000Z',
    attachmentId: 'att-uploadable',
    localBlobKey: 'local-attachment/uploadable',
    remoteProvider: 'googleDrive',
    remoteFileId: 'drive-upload-1',
    remoteSize: 5,
    remoteChecksum: 'abc123abc123abc123abc123abc123ab',
    status: 'uploaded',
    verification: {
      sizeVerified: true,
      checksumVerified: false,
    },
    warnings: [],
    startedAt: '2026-06-28T00:00:00.000Z',
    completedAt: '2026-06-28T00:00:01.000Z',
    ...overrides,
  };
}

function attachmentMetadata(overrides: Partial<AttachmentMetadata> = {}): AttachmentMetadata {
  return {
    id: 'att-recoverable',
    noteId: 'note-1',
    fileName: 'sample.txt',
    mimeType: 'text/plain',
    size: 5,
    remoteProvider: 'googleDrive',
    remoteFileId: 'drive-file-1',
    remoteSize: 5,
    remoteMimeType: 'text/plain',
    remoteSyncStatus: 'recoverable_remote',
    createdAt: '2026-06-28T00:00:00.000Z',
    updatedAt: '2026-06-28T00:00:00.000Z',
    syncStatus: 'synced',
    ...overrides,
  };
}

function memoryAttachmentRepository(initial: readonly AttachmentMetadata[]) {
  const records = new Map(initial.map(item => [item.id, { ...item }]));
  const clone = (metadata: AttachmentMetadata): AttachmentMetadata => ({ ...metadata });
  const repository: AttachmentRepository = {
    async listAttachments() {
      return Array.from(records.values()).map(clone);
    },
    async listAttachmentsForNote(noteId: string) {
      return Array.from(records.values()).filter(item => item.noteId === noteId).map(clone);
    },
    async getAttachment(id: string) {
      const metadata = records.get(id);
      return metadata ? clone(metadata) : null;
    },
    async putAttachment(metadata: AttachmentMetadata) {
      records.set(metadata.id, clone(metadata));
    },
    async updateAttachment(id: string, patch: Partial<AttachmentMetadata>) {
      const metadata = records.get(id);
      if (metadata) {
        records.set(id, { ...metadata, ...patch });
      }
    },
    async tombstoneAttachment(id: string, deletedAt = new Date().toISOString()) {
      const metadata = records.get(id);
      if (metadata) {
        records.set(id, { ...metadata, deletedAt, syncStatus: 'deleted' });
      }
    },
    async deleteAttachmentMetadata(id: string) {
      records.delete(id);
    },
    async putMetadata(metadata: AttachmentMetadata) {
      records.set(metadata.id, clone(metadata));
      return clone(metadata);
    },
    async getMetadata(id: string) {
      const metadata = records.get(id);
      return metadata ? clone(metadata) : null;
    },
    async listForNote(noteId: string) {
      return Array.from(records.values()).filter(item => item.noteId === noteId).map(clone);
    },
    async markDeleted(id: string, deletedAt: string) {
      const metadata = records.get(id);
      if (!metadata) return null;
      const next = { ...metadata, deletedAt, syncStatus: 'deleted' as const };
      records.set(id, next);
      return clone(next);
    },
  };
  return { repository, records };
}

function memoryBlobAdapter(initial: readonly { key: string; blob: Blob; mimeType?: string; checksum?: string }[] = []) {
  const blobs = new Map(initial.map(item => [item.key, {
    key: item.key,
    blob: item.blob,
    mimeType: item.mimeType ?? item.blob.type,
    size: item.blob.size,
    checksum: item.checksum,
  }]));
  const adapter: BlobStorageAdapter = {
    async putBlob(input) {
      const record = {
        key: input.key,
        blob: input.blob,
        mimeType: input.mimeType ?? input.blob.type,
        size: input.blob.size,
        checksum: input.checksum,
      };
      blobs.set(input.key, record);
      return record;
    },
    async getBlob(key: string) {
      return blobs.get(key) ?? null;
    },
    async deleteBlob(key: string) {
      blobs.delete(key);
    },
    async getObjectUrl(key: string) {
      return blobs.has(key) ? `blob:test/${key}` : null;
    },
    async hasBlob(key: string) {
      return blobs.has(key);
    },
  };
  return { adapter, blobs };
}

function availableProviderConnection(overrides: Partial<RemoteProviderConnectionBoundary> = {}): RemoteProviderConnectionBoundary {
  return {
    ...resolveRemoteProviderConnectionBoundary({
      providerType: 'googleDrive',
      status: 'available',
      capabilities: {
        supportsDownload: true,
        supportsUpload: false,
      },
    }),
    ...overrides,
  };
}

function migrationReportWithBackup(overrides: Partial<EmbeddedAttachmentMigrationReport> = {}): EmbeddedAttachmentMigrationReport {
  return migrationReport({
    noteResults: [{
      noteId: 'note-1',
      status: 'migrated',
      candidatesFound: 1,
      migratedCount: 1,
      skippedCount: 0,
      failedCount: 0,
      backupKey: backupSummary().backupKey,
      bodyRewritten: true,
      previousBodyHash: hashEmbeddedAttachmentMigrationText(embeddedPayload),
      previousContentHash: hashEmbeddedAttachmentMigrationText(''),
      rewrittenBodyHash: hashEmbeddedAttachmentMigrationText('migrated body'),
      rewrittenContentHash: hashEmbeddedAttachmentMigrationText(''),
      attachmentIds: ['att-1'],
      blobKeys: ['local-attachment/att-1'],
      orphanedAttachmentIds: [],
      orphanedBlobKeys: [],
      errors: [],
    }],
    ...overrides,
  });
}

function panelElement(input: {
  notes?: readonly Note[];
  updateNote?: (id: string, patch: Partial<Note>) => void;
  auditFn?: () => EmbeddedAttachmentAuditReport;
  migrateFn?: () => Promise<EmbeddedAttachmentMigrationReport>;
  cleanupReviewFn?: () => Promise<AttachmentCleanupReviewReport>;
  cleanupExecutorFn?: (input: AttachmentCleanupExecutorInput) => Promise<AttachmentCleanupExecutorReport>;
  listBackupsFn?: (reader?: EmbeddedAttachmentMigrationBackupReader) => Promise<EmbeddedAttachmentMigrationBackupSummary[]>;
  restoreBackupFn?: (input: EmbeddedAttachmentMigrationRestoreInput) => Promise<EmbeddedAttachmentMigrationRestoreReport>;
  diagnosticsFn?: () => Promise<AttachmentSyncDiagnostics>;
  recoverAttachmentFn?: (attachmentId: string) => Promise<AttachmentRemoteRecoveryResult>;
  uploadAttachmentFn?: (attachmentId: string) => Promise<AttachmentExplicitUploadResult>;
  remoteProviderConnection?: RemoteProviderConnectionBoundary;
  googleDriveSessionController?: GoogleDriveSessionConnectionController | null;
  googleDriveRecoveryFetcher?: typeof fetch;
  googleDriveRecoveryRepository?: AttachmentRepository;
  googleDriveRecoveryBlobAdapter?: BlobStorageAdapter;
  googleDriveUploadFetcher?: typeof fetch;
  googleDriveUploadRepository?: AttachmentRepository;
  googleDriveUploadBlobAdapter?: BlobStorageAdapter;
}) {
  return createElement(EmbeddedAttachmentMigrationReviewPanel, {
    notes: input.notes ?? [note()],
    colors,
    updateNote: input.updateNote ?? vi.fn(),
    auditFn: input.auditFn ?? vi.fn(() => reportWithCandidate()),
    migrateFn: input.migrateFn ?? vi.fn(async () => migrationReport()),
    cleanupReviewFn: input.cleanupReviewFn ?? vi.fn(async () => cleanupReviewReport()),
    cleanupExecutorFn: input.cleanupExecutorFn ?? vi.fn(async () => cleanupExecutorReport()),
    listBackupsFn: input.listBackupsFn ?? vi.fn(async () => []),
    restoreBackupFn: input.restoreBackupFn ?? vi.fn(async () => restoreReport()),
    diagnosticsFn: input.diagnosticsFn ?? vi.fn(async () => diagnosticsReport()),
    recoverAttachmentFn: input.recoverAttachmentFn,
    uploadAttachmentFn: input.uploadAttachmentFn,
    remoteProviderConnection: input.remoteProviderConnection,
    googleDriveSessionController: input.googleDriveSessionController,
    googleDriveRecoveryFetcher: input.googleDriveRecoveryFetcher,
    googleDriveRecoveryRepository: input.googleDriveRecoveryRepository,
    googleDriveRecoveryBlobAdapter: input.googleDriveRecoveryBlobAdapter,
    googleDriveUploadFetcher: input.googleDriveUploadFetcher,
    googleDriveUploadRepository: input.googleDriveUploadRepository,
    googleDriveUploadBlobAdapter: input.googleDriveUploadBlobAdapter,
  });
}

function render(element: ReturnType<typeof createElement>) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  act(() => {
    root.render(element);
  });
  return { host, root };
}

function cleanup(root: Root, host: HTMLElement) {
  act(() => {
    root.unmount();
  });
  host.remove();
}

function buttonByText(host: HTMLElement, text: string): HTMLButtonElement {
  const button = Array.from(host.querySelectorAll('button'))
    .find(item => item.textContent?.trim() === text);
  if (!(button instanceof HTMLButtonElement)) throw new Error(`Button not found: ${text}`);
  return button;
}

function buttonContaining(host: HTMLElement, ...parts: string[]): HTMLButtonElement {
  const button = Array.from(host.querySelectorAll('button'))
    .find(item => parts.every(part => item.textContent?.includes(part)));
  if (!(button instanceof HTMLButtonElement)) throw new Error(`Button not found containing: ${parts.join(', ')}`);
  return button;
}

function click(element: HTMLElement) {
  act(() => {
    element.click();
  });
}

function recoveryReasonCodes(host: HTMLElement): string[] {
  return Array.from(host.querySelectorAll('[data-recovery-reason-code]'))
    .map(item => item.getAttribute('data-recovery-reason-code') ?? '');
}

function recoveryReasonLabels(host: HTMLElement): string[] {
  return Array.from(host.querySelectorAll('[data-recovery-reason-code]'))
    .map(item => item.textContent?.trim() ?? '');
}

function changeInput(input: HTMLInputElement, value: string) {
  act(() => {
    const valueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
    valueSetter?.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

function changeTextarea(input: HTMLTextAreaElement, value: string) {
  act(() => {
    const valueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
    valueSetter?.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

async function flushAsync() {
  await act(async () => {
    await Promise.resolve();
  });
}

function manualGoogleDriveController(overrides: {
  connected?: boolean;
  hasAccessTokenProvider?: boolean;
  startAuthorization?: GoogleDriveSessionConnectionController['startAuthorization'];
  completeCallback?: GoogleDriveSessionConnectionController['completeCallback'];
  disconnect?: GoogleDriveSessionConnectionController['disconnect'];
  getConnectionStatus?: GoogleDriveSessionConnectionController['getConnectionStatus'];
} = {}): GoogleDriveSessionConnectionController {
  let hasAccessTokenProvider = overrides.hasAccessTokenProvider ?? overrides.connected === true;
  let status = overrides.connected
    ? availableProviderConnection({ canUpload: true, canDownload: true, canRecover: true })
    : resolveRemoteProviderConnectionBoundary({
        providerType: 'googleDrive',
        status: 'unconfigured',
        capabilities: { supportsDownload: false, supportsUpload: false },
      });
  const controller: GoogleDriveSessionConnectionController = {
    providerType: 'googleDrive',
    startAuthorization: overrides.startAuthorization ?? vi.fn(async () => ({
      providerType: 'googleDrive',
      status: 'authorization_url_created',
      authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth?client_id=test-client&state=state-123&code_challenge=challenge-123',
      state: 'state-123',
      expiresAt: '2026-06-28T00:10:00.000Z',
      warnings: [],
    })),
    completeCallback: overrides.completeCallback ?? vi.fn(async () => {
      status = availableProviderConnection({ canUpload: true, canDownload: true, canRecover: true });
      hasAccessTokenProvider = true;
      return {
        providerType: 'googleDrive',
        status: 'connected',
        connectionStatus: status,
        safeMessage: 'Google Drive is connected for this session.',
        warnings: [],
      };
    }),
    disconnect: overrides.disconnect ?? vi.fn(async () => {
      status = resolveRemoteProviderConnectionBoundary({
        providerType: 'googleDrive',
        status: 'unconfigured',
        capabilities: { supportsDownload: false, supportsUpload: false },
      });
      hasAccessTokenProvider = false;
      return {
        providerType: 'googleDrive',
        status: 'disconnected',
        safeMessage: 'Google Drive session state was cleared from memory.',
      };
    }),
    getConnectionStatus: overrides.getConnectionStatus ?? vi.fn(async () => {
      return status;
    }),
    getAccessTokenProvider() {
      return hasAccessTokenProvider
        ? { getAccessToken: vi.fn(async () => 'access-token-secret') }
        : null;
    },
    async markReconnectRequired() {
      status = resolveRemoteProviderConnectionBoundary({
        providerType: 'googleDrive',
        status: 'reconnect_required',
        capabilities: { supportsDownload: false, supportsUpload: false },
      });
      hasAccessTokenProvider = false;
    },
  };
  return controller;
}

function renderPanel(options: { notes?: readonly Note[] } = {}) {
  const auditFn = vi.fn(() => reportWithCandidate());
  const migrateFn = vi.fn(async () => migrationReport());
  const cleanupReviewFn = vi.fn(async () => cleanupReviewReport());
  const cleanupExecutorFn = vi.fn(async () => cleanupExecutorReport());
  const listBackupsFn = vi.fn(async () => [] as EmbeddedAttachmentMigrationBackupSummary[]);
  const restoreBackupFn = vi.fn(async () => restoreReport());
  const diagnosticsFn = vi.fn(async () => diagnosticsReport());
  const updateNote = vi.fn();
  const mounted = render(panelElement({
    notes: options.notes,
    updateNote,
    auditFn,
    migrateFn,
    cleanupReviewFn,
    cleanupExecutorFn,
    listBackupsFn,
    restoreBackupFn,
    diagnosticsFn,
  }));
  return { auditFn, migrateFn, cleanupReviewFn, cleanupExecutorFn, listBackupsFn, restoreBackupFn, diagnosticsFn, updateNote, ...mounted };
}

describe('EmbeddedAttachmentMigrationReviewPanel', () => {
  it('does not scan or migrate on mount', () => {
    const { auditFn, migrateFn, cleanupReviewFn, cleanupExecutorFn, listBackupsFn, restoreBackupFn, diagnosticsFn, root, host } = renderPanel();

    expect(auditFn).not.toHaveBeenCalled();
    expect(migrateFn).not.toHaveBeenCalled();
    expect(cleanupReviewFn).not.toHaveBeenCalled();
    expect(cleanupExecutorFn).not.toHaveBeenCalled();
    expect(listBackupsFn).not.toHaveBeenCalled();
    expect(restoreBackupFn).not.toHaveBeenCalled();
    expect(diagnosticsFn).not.toHaveBeenCalled();
    cleanup(root, host);
  });

  it('scan button runs the K-148 audit and shows a safe summary', async () => {
    const { auditFn, root, host } = renderPanel();

    click(buttonByText(host, 'Attachment storage maintenance'));
    click(buttonByText(host, 'Scan embedded attachments'));
    await flushAsync();

    expect(auditFn).toHaveBeenCalledTimes(1);
    expect(host.textContent).toContain('Affected notes');
    expect(host.textContent).toContain('Scanned note');
    expect(host.textContent).toContain('image/png;base64,QUJD...');
    expect(host.textContent).not.toContain(embeddedPayload);
    cleanup(root, host);
  });

  it('migration button is disabled before scan and when no candidates exist', async () => {
    const auditFn = vi.fn(() => emptyReport());
    const migrateFn = vi.fn(async () => migrationReport());
    const { root, host } = render(panelElement({ notes: [note('plain')], auditFn, migrateFn }));

    click(buttonByText(host, 'Attachment storage maintenance'));
    expect(buttonByText(host, 'Migrate embedded attachments').disabled).toBe(true);

    click(buttonByText(host, 'Scan embedded attachments'));
    await flushAsync();
    expect(host.textContent).toContain('No embedded data URLs found.');
    expect(buttonByText(host, 'Migrate embedded attachments').disabled).toBe(true);
    expect(migrateFn).not.toHaveBeenCalled();
    cleanup(root, host);
  });

  it('invokes K-149 only after explicit migrate confirmation click', async () => {
    const { migrateFn, root, host } = renderPanel();

    click(buttonByText(host, 'Attachment storage maintenance'));
    click(buttonByText(host, 'Scan embedded attachments'));
    await flushAsync();
    expect(host.textContent).toContain('Scanned note');

    click(buttonByText(host, 'Migrate embedded attachments'));
    expect(migrateFn).not.toHaveBeenCalled();
    expect(host.textContent).toContain('This will create local attachment records');

    click(buttonByText(host, 'Confirm migration'));
    await flushAsync();
    expect(migrateFn).toHaveBeenCalledTimes(1);
    expect(host.textContent).toContain('Migration completed');
    expect(host.textContent).toContain('Backups created: 1');
    cleanup(root, host);
  });

  it('prevents duplicate migration clicks while running', async () => {
    let resolveMigration: (report: EmbeddedAttachmentMigrationReport) => void = () => {};
    const migrateFn = vi.fn(() => new Promise<EmbeddedAttachmentMigrationReport>(resolve => {
      resolveMigration = resolve;
    }));
    const auditFn = vi.fn(() => reportWithCandidate());
    const { root, host } = render(panelElement({ auditFn, migrateFn }));

    click(buttonByText(host, 'Attachment storage maintenance'));
    click(buttonByText(host, 'Scan embedded attachments'));
    await flushAsync();
    expect(host.textContent).toContain('Scanned note');
    click(buttonByText(host, 'Migrate embedded attachments'));
    click(buttonByText(host, 'Confirm migration'));
    click(buttonByText(host, 'Migrating...'));

    expect(migrateFn).toHaveBeenCalledTimes(1);
    resolveMigration(migrationReport());
    await flushAsync();
    expect(host.textContent).toContain('Migration completed');
    cleanup(root, host);
  });

  it('shows failure warnings and sanitized errors', async () => {
    const migrateFn = vi.fn(async () => migrationReport({
      notesMigrated: 0,
      payloadsMigrated: 0,
      payloadsFailed: 1,
      noteResults: [{
        noteId: 'note-1',
        status: 'failed',
        candidatesFound: 1,
        migratedCount: 0,
        skippedCount: 0,
        failedCount: 1,
        attachmentIds: [],
        blobKeys: [],
        orphanedAttachmentIds: ['att-orphan'],
        orphanedBlobKeys: ['blob-orphan'],
        errors: ['Invalid data:image/png;base64,[omitted] payload'],
      }],
    }));
    const auditFn = vi.fn(() => reportWithCandidate());
    const { root, host } = render(panelElement({ auditFn, migrateFn }));

    click(buttonByText(host, 'Attachment storage maintenance'));
    click(buttonByText(host, 'Scan embedded attachments'));
    await flushAsync();
    expect(host.textContent).toContain('Scanned note');
    click(buttonByText(host, 'Migrate embedded attachments'));
    click(buttonByText(host, 'Confirm migration'));
    await flushAsync();

    expect(host.textContent).toContain('Migration completed with warnings');
    expect(host.textContent).toContain('Some items failed. Original note bodies were preserved for failed items.');
    expect(host.textContent).toContain('Cleanup is deferred. Review orphaned local resources in a future cleanup pass.');
    expect(host.textContent).not.toContain(embeddedPayload);
    cleanup(root, host);
  });

  it('runs cleanup review only after an explicit click and displays review-only summary counts', async () => {
    const cleanupReviewFn = vi.fn(async () => cleanupReviewReport());
    const { root, host } = render(panelElement({ cleanupReviewFn }));

    click(buttonByText(host, 'Attachment storage maintenance'));
    expect(cleanupReviewFn).not.toHaveBeenCalled();
    expect(host.textContent).toContain('Cleanup review');
    expect(host.textContent).toContain('Nothing is deleted automatically.');

    click(buttonByText(host, 'Run orphan review'));
    await flushAsync();

    expect(cleanupReviewFn).toHaveBeenCalledTimes(1);
    expect(host.textContent).toContain('Notes scanned');
    expect(host.textContent).toContain('Attachments scanned');
    expect(host.textContent).toContain('Backups scanned');
    expect(host.textContent).toContain('Referenced attachments');
    expect(host.textContent).toContain('Unreferenced metadata');
    expect(host.textContent).toContain('Unreferenced blobs');
    expect(host.textContent).toContain('Partial migration artifacts');
    expect(host.textContent).toContain('Restored migration artifacts');
    expect(host.textContent).toContain('Missing blobs');
    expect(host.textContent).toContain('Missing metadata');
    expect(host.textContent).toContain('Duplicate candidates');
    expect(host.textContent).toContain('Backup records');
    expect(host.textContent).toContain('Estimated recoverable');
    expect(host.textContent).toContain('Blob inventory: unavailable.');
    expect(host.textContent).toContain('2.0 KB');
    cleanup(root, host);
  });

  it('shows cleanup review warnings, preserved backups, and only eligible selectable cleanup candidates', async () => {
    const cleanupReviewFn = vi.fn(async () => cleanupReviewReport());
    const { root, host } = render(panelElement({ cleanupReviewFn }));

    click(buttonByText(host, 'Attachment storage maintenance'));
    click(buttonByText(host, 'Run orphan review'));
    await flushAsync();

    expect(host.textContent).toContain('Local blob inventory is unavailable');
    expect(host.textContent).toContain('Migration backups are preserved. Backup deletion is not part of this review.');
    expect(host.textContent).toContain('Referenced attachments');
    expect(host.textContent).toContain('Unreferenced attachment metadata');
    expect(host.textContent).toContain('Missing blob');
    expect(host.textContent).toContain('Missing metadata');
    expect(host.textContent).toContain('Review manually before any explicit cleanup.');
    expect(host.textContent).toContain('In use by note content.');
    expect(host.textContent).toContain('Backup records are preserved.');
    expect(host.textContent).toContain('Integrity warning; manual restore or repair may be needed.');
    const checkboxes = Array.from(host.querySelectorAll('input[type="checkbox"]'));
    expect(checkboxes).toHaveLength(2);
    expect(checkboxes.every(input => input instanceof HTMLInputElement && !input.checked)).toBe(true);
    const buttonText = Array.from(host.querySelectorAll('button')).map(button => button.textContent?.trim()).join(' ');
    expect(buttonText).not.toContain('Delete');
    expect(buttonText).not.toContain('Remove');
    expect(buttonText).not.toContain('Purge');
    expect(buttonByText(host, 'Clean selected local items').disabled).toBe(true);
    cleanup(root, host);
  });

  it('requires candidate selection and report-bound confirmation before executing cleanup', async () => {
    const review = cleanupReviewReport();
    const candidateId = attachmentCleanupCandidateId(review.candidates[1], 1);
    const cleanupReviewFn = vi.fn(async () => review);
    const cleanupExecutorFn = vi.fn(async () => cleanupExecutorReport({
      results: [{
        ...cleanupExecutorReport().results[0],
        candidateId,
      }],
    }));
    const { root, host } = render(panelElement({ cleanupReviewFn, cleanupExecutorFn }));

    click(buttonByText(host, 'Attachment storage maintenance'));
    click(buttonByText(host, 'Run orphan review'));
    await flushAsync();

    const runButton = buttonByText(host, 'Clean selected local items');
    expect(runButton.disabled).toBe(true);
    const checkbox = host.querySelector('input[type="checkbox"]');
    if (!(checkbox instanceof HTMLInputElement)) throw new Error('cleanup checkbox missing');
    click(checkbox);
    expect(runButton.disabled).toBe(true);

    const input = host.querySelector('input[aria-label="Cleanup confirmation phrase"]');
    if (!(input instanceof HTMLInputElement)) throw new Error('confirmation input missing');
    changeInput(input, 'wrong phrase');
    expect(runButton.disabled).toBe(true);
    changeInput(input, `CLEANUP ${hashAttachmentCleanupReviewReport(review).slice(0, 12)}`);
    expect(runButton.disabled).toBe(false);

    click(runButton);
    await flushAsync();

    expect(cleanupExecutorFn).toHaveBeenCalledTimes(1);
    expect(cleanupExecutorFn.mock.calls[0]?.[0]).toMatchObject({
      reviewReport: review,
      confirmationToken: createAttachmentCleanupConfirmationToken(review),
      selectedCandidateIds: [candidateId],
    });
    expect(host.textContent).toContain('Cleanup result');
    expect(host.textContent).toContain('Confirmation verified: yes');
    expect(host.textContent).toContain('Re-run cleanup review after cleanup');
    cleanup(root, host);
  });

  it('does not execute cleanup while running and reports skipped, blocked, and failed results', async () => {
    let resolveCleanup: (report: AttachmentCleanupExecutorReport) => void = () => {};
    const review = cleanupReviewReport();
    const cleanupReviewFn = vi.fn(async () => review);
    const cleanupExecutorFn = vi.fn(() => new Promise<AttachmentCleanupExecutorReport>(resolve => {
      resolveCleanup = resolve;
    }));
    const { root, host } = render(panelElement({ cleanupReviewFn, cleanupExecutorFn }));

    click(buttonByText(host, 'Attachment storage maintenance'));
    click(buttonByText(host, 'Run orphan review'));
    await flushAsync();

    const checkbox = host.querySelector('input[type="checkbox"]');
    if (!(checkbox instanceof HTMLInputElement)) throw new Error('cleanup checkbox missing');
    click(checkbox);
    const input = host.querySelector('input[aria-label="Cleanup confirmation phrase"]');
    if (!(input instanceof HTMLInputElement)) throw new Error('confirmation input missing');
    changeInput(input, `CLEANUP ${hashAttachmentCleanupReviewReport(review).slice(0, 12)}`);

    click(buttonByText(host, 'Clean selected local items'));
    click(buttonByText(host, 'Cleaning selected...'));
    expect(cleanupExecutorFn).toHaveBeenCalledTimes(1);
    resolveCleanup(cleanupExecutorReport({
      deletedAttachmentMetadataCount: 0,
      skippedCandidateCount: 1,
      blockedCandidateCount: 1,
      failedCandidateCount: 1,
      bytesRecoveredEstimate: 0,
      results: [
        {
          candidateId: 'candidate-skipped',
          candidateType: 'unreferencedBlob',
          status: 'skipped',
          reason: 'Candidate is stale or no longer revalidates as unreferenced.',
          localBlobKey: 'local-attachment/stale',
        },
        {
          candidateId: 'candidate-blocked',
          candidateType: 'unreferencedAttachmentMetadata',
          status: 'blocked',
          reason: 'Attachment metadata is not local-only; explicit sync-aware cleanup is required.',
          attachmentId: 'att-remote',
        },
        {
          candidateId: 'candidate-failed',
          candidateType: 'unreferencedBlob',
          status: 'failed',
          reason: 'failed data:image/png;base64,[omitted]',
          localBlobKey: 'local-attachment/fail',
        },
      ],
    }));
    await flushAsync();

    expect(host.textContent).toContain('Skipped: 1');
    expect(host.textContent).toContain('Blocked: 1');
    expect(host.textContent).toContain('Failed: 1');
    expect(host.textContent).toContain('Candidate is stale or no longer revalidates as unreferenced.');
    expect(host.textContent).toContain('Attachment metadata is not local-only');
    expect(host.textContent).not.toContain(embeddedPayload);
    cleanup(root, host);
  });

  it('sanitizes cleanup review errors and does not crash the panel', async () => {
    const cleanupReviewFn = vi.fn(async () => {
      throw new Error(`failed data:image/png;base64,${embeddedPayload}`);
    });
    const { root, host } = render(panelElement({ cleanupReviewFn }));

    click(buttonByText(host, 'Attachment storage maintenance'));
    click(buttonByText(host, 'Run orphan review'));
    await flushAsync();

    expect(host.textContent).toContain('failed data:image/png;base64,[omitted]');
    expect(host.textContent).not.toContain(embeddedPayload);
    cleanup(root, host);
  });

  it('runs attachment sync diagnostics only after explicit refresh and shows read-only summaries', async () => {
    const diagnosticsFn = vi.fn(async () => diagnosticsReport());
    const { root, host } = render(panelElement({ diagnosticsFn }));

    click(buttonByText(host, 'Attachment storage maintenance'));

    expect(diagnosticsFn).not.toHaveBeenCalled();
    expect(host.textContent).toContain('Attachment Sync Diagnostics');
    expect(host.textContent).toContain('Runs only when requested');
    expect(host.textContent).not.toContain('Provider breakdown');

    click(buttonByText(host, 'Refresh diagnostics'));
    await flushAsync();

    expect(diagnosticsFn).toHaveBeenCalledTimes(1);
    expect(host.textContent).toContain('Total attachments');
    expect(host.textContent).toContain('Pending upload');
    expect(host.textContent).toContain('Uploading');
    expect(host.textContent).toContain('Synced');
    expect(host.textContent).toContain('Failed');
    expect(host.textContent).toContain('Paused offline');
    expect(host.textContent).toContain('Recoverable remote');
    expect(host.textContent).toContain('Missing local');
    expect(host.textContent).toContain('googleDrive');
    expect(host.textContent).toContain('All remote-backed: fully verified');
    expect(host.textContent).toContain('Eligible synced/recoverable: size-only');
    expect(host.textContent).toContain('Eviction candidates');
    expect(host.textContent).toContain('Review-only candidates');
    expect(host.textContent).toContain('Fully verified recoverable');
    expect(host.textContent).toContain('2.0 KB');
    expect(host.textContent).toContain('Review-only recoverable');
    expect(host.textContent).toContain('1.0 KB');
    expect(host.textContent).toContain('Blob inventory is partial');
    expect(host.textContent).toContain('Bearer [redacted-secret]');
    expect(host.textContent).toContain('Remote recovery');
    expect(host.textContent).toContain('Provider not configured');
    expect(host.textContent).toContain('Recovery capability: unavailable');
    expect(host.textContent).toContain('Remote file missing');
    expect(host.textContent).toContain('Missing local blob is not remote-backed');
    expect(host.textContent).toContain('Sync state blocks recovery');
    expect(host.textContent).toContain('Local blob already present');
    cleanup(root, host);
  });

  it('shows Google Drive session as unconfigured without enabling manual authorization by default', () => {
    const { root, host } = render(panelElement({}));
    click(buttonByText(host, 'Attachment storage maintenance'));

    expect(host.textContent).toContain('Google Drive Session');
    expect(host.textContent).toContain('Google Drive connection is disabled in this build unless an explicit session controller is configured.');
    expect(host.textContent).toContain('This unavailable state is intentional.');
    expect(buttonByText(host, 'Generate authorization URL').disabled).toBe(true);
    expect(buttonByText(host, 'Clear session').disabled).toBe(true);
    expect(host.querySelector('textarea[aria-label="Google Drive callback URL"]')).toBeNull();
    expect(Array.from(host.querySelectorAll('button')).map(button => button.textContent?.trim())).not.toContain('Complete connection from callback');
    expect(host.textContent).not.toContain('Sync now');
    expect(host.textContent).not.toContain('Upload all');
    expect(host.textContent).not.toContain('Recover all');

    cleanup(root, host);
  });

  it('generates and displays a manual authorization URL without navigation or token provider creation', async () => {
    const controller = manualGoogleDriveController();
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    const { root, host } = render(panelElement({ googleDriveSessionController: controller }));
    click(buttonByText(host, 'Attachment storage maintenance'));
    await flushAsync();

    click(buttonByText(host, 'Generate authorization URL'));
    await flushAsync();

    expect(controller.startAuthorization).toHaveBeenCalledTimes(1);
    expect(controller.getAccessTokenProvider()).toBeNull();
    expect(host.textContent).toContain('Authorization URL created');
    expect(host.textContent).toContain('Pending authorization expires 2026-06-28T00:10:00.000Z.');
    const urlField = host.querySelector('textarea[aria-label="Generated Google Drive authorization URL"]');
    expect(urlField).toBeInstanceOf(HTMLTextAreaElement);
    expect((urlField as HTMLTextAreaElement).value).toContain('https://accounts.google.com/o/oauth2/v2/auth');
    expect((urlField as HTMLTextAreaElement).value).not.toContain('pkce-verifier-secret');
    expect(openSpy).not.toHaveBeenCalled();

    openSpy.mockRestore();
    cleanup(root, host);
  });

  it('completes connection only from an explicit pasted callback and keeps sensitive values out of the UI', async () => {
    const controller = manualGoogleDriveController();
    const diagnosticsFn = vi.fn(async () => diagnosticsReport());
    const recoverAttachmentFn = vi.fn(async () => recoveryResult());
    const { root, host } = render(panelElement({ googleDriveSessionController: controller, diagnosticsFn, recoverAttachmentFn }));
    click(buttonByText(host, 'Attachment storage maintenance'));
    await flushAsync();

    const callbackField = host.querySelector('textarea[aria-label="Google Drive callback URL"]');
    expect(callbackField).toBeInstanceOf(HTMLTextAreaElement);
    changeTextarea(callbackField as HTMLTextAreaElement, 'http://127.0.0.1:5173/oauth/google-drive/callback?code=auth-code-secret&state=state-123');
    click(buttonByText(host, 'Complete connection from callback'));
    await flushAsync();

    expect(controller.completeCallback).toHaveBeenCalledTimes(1);
    expect(host.textContent).toContain('Google Drive session connected in memory only.');
    expect(host.textContent).toContain('Status: Provider available');
    expect((callbackField as HTMLTextAreaElement).value).toBe('');
    expect(host.textContent).not.toContain('access-token-secret');
    expect(host.textContent).not.toContain('refresh-token-secret');
    expect(host.textContent).not.toContain('auth-code-secret');
    expect(host.textContent).not.toContain('pkce-verifier-secret');
    expect(host.textContent).not.toContain('Sync now');
    expect(host.textContent).not.toContain('Upload all');
    expect(host.textContent).not.toContain('Recover all');
    expect(diagnosticsFn).not.toHaveBeenCalled();
    expect(recoverAttachmentFn).not.toHaveBeenCalled();

    cleanup(root, host);
  });

  it('renders sanitized manual callback failures and does not expose token material', async () => {
    const completeCallback = vi.fn(async () => ({
      providerType: 'googleDrive' as const,
      status: 'token_exchange_failed' as const,
      connectionStatus: resolveRemoteProviderConnectionBoundary({
        providerType: 'googleDrive',
        status: 'unconfigured',
        capabilities: { supportsDownload: false, supportsUpload: false },
      }),
      safeMessage: 'Token exchange failed.',
      error: {
        code: 'invalid_grant',
        category: 'auth',
        retryable: false,
        status: 400,
        safeMessage: 'code=auth-code-secret access_token=access-token-secret refresh_token=refresh-token-secret codeVerifierRef=pkce-ref-secret id_token=id-token-secret http://127.0.0.1:5173/oauth/google-drive/callback?code=auth-code-secret&state=state-secret',
      },
    }));
    const controller = manualGoogleDriveController({ completeCallback });
    const { root, host } = render(panelElement({ googleDriveSessionController: controller }));
    click(buttonByText(host, 'Attachment storage maintenance'));
    await flushAsync();

    const callbackField = host.querySelector('textarea[aria-label="Google Drive callback URL"]');
    changeTextarea(callbackField as HTMLTextAreaElement, 'http://127.0.0.1:5173/oauth/google-drive/callback?code=auth-code-secret&state=state-secret');
    click(buttonByText(host, 'Complete connection from callback'));
    await flushAsync();

    expect(completeCallback).toHaveBeenCalledTimes(1);
    expect((callbackField as HTMLTextAreaElement).value).toBe('');
    expect(host.textContent).toContain('code=[redacted-secret]');
    expect(host.textContent).toContain('access_token=[redacted-secret]');
    expect(host.textContent).toContain('refresh_token=[redacted-secret]');
    expect(host.textContent).not.toContain('auth-code-secret');
    expect(host.textContent).not.toContain('access-token-secret');
    expect(host.textContent).not.toContain('refresh-token-secret');
    expect(host.textContent).not.toContain('pkce-ref-secret');
    expect(host.textContent).not.toContain('id-token-secret');
    expect(host.textContent).not.toContain('state-secret');
    expect(host.textContent).not.toContain('http://127.0.0.1:5173/oauth/google-drive/callback');

    cleanup(root, host);
  });

  it('clears only the in-memory Google Drive session when requested explicitly', async () => {
    const controller = manualGoogleDriveController({ connected: true });
    const recoverAttachmentFn = vi.fn(async () => recoveryResult());
    const { root, host } = render(panelElement({ googleDriveSessionController: controller, recoverAttachmentFn }));
    click(buttonByText(host, 'Attachment storage maintenance'));
    await flushAsync();
    const statusChecksBeforeClear = vi.mocked(controller.getConnectionStatus).mock.calls.length;

    expect(host.textContent).toContain('Starting a new authorization while connected is not yet supported. Clear this session first.');
    expect(buttonByText(host, 'Generate authorization URL').disabled).toBe(true);
    click(buttonByText(host, 'Clear session'));
    await flushAsync();

    expect(controller.disconnect).toHaveBeenCalledTimes(1);
    expect(vi.mocked(controller.getConnectionStatus).mock.calls.length).toBeGreaterThan(statusChecksBeforeClear);
    expect(host.textContent).toContain('Google Drive session state was cleared from memory.');
    expect(host.textContent).toContain('Provider not configured');
    expect(recoverAttachmentFn).not.toHaveBeenCalled();

    cleanup(root, host);
  });

  it('keeps the manual Google Drive panel source free of persistence, navigation, and destructive remote actions', () => {
    const source = readFileSync(join(process.cwd(), 'src/components/views/noteview/GoogleDriveManualConnectionPanel.tsx'), 'utf8');

    for (const forbidden of [
      'window.open',
      'window.location',
      'oauth2.googleapis.com/token',
      'client_secret',
      'fetchToken',
      'localStorage',
      'sessionStorage',
      'indexedDB',
      'document.cookie',
      'deleteBlob',
      'remoteDelete',
      'Recover all',
      'Upload all',
      'Sync now',
      'Sign in with Google',
      'Connect Google Drive',
      'Authorize Google',
    ]) {
      expect(source).not.toContain(forbidden);
    }
  });

  it('does not run recovery on mount or diagnostics refresh', async () => {
    const diagnosticsFn = vi.fn(async () => diagnosticsReport());
    const recoverAttachmentFn = vi.fn(async () => recoveryResult());
    const { root, host } = render(panelElement({ diagnosticsFn, recoverAttachmentFn }));

    expect(recoverAttachmentFn).not.toHaveBeenCalled();
    click(buttonByText(host, 'Attachment storage maintenance'));
    click(buttonByText(host, 'Refresh diagnostics'));
    await flushAsync();

    expect(diagnosticsFn).toHaveBeenCalledTimes(1);
    expect(recoverAttachmentFn).not.toHaveBeenCalled();
    cleanup(root, host);
  });

  it('shows per-item Recover only for eligible attachments when provider is configured', async () => {
    const recoverAttachmentFn = vi.fn(async () => recoveryResult());
    const { root, host } = render(panelElement({
      recoverAttachmentFn,
      remoteProviderConnection: availableProviderConnection(),
      googleDriveSessionController: manualGoogleDriveController({ connected: true }),
    }));

    click(buttonByText(host, 'Attachment storage maintenance'));
    click(buttonByText(host, 'Refresh diagnostics'));
    await flushAsync();

    const section = host.querySelector('[data-attachment-sync-diagnostics-section]');
    if (!(section instanceof HTMLElement)) throw new Error('diagnostics section missing');
    const recoveryButtons = Array.from(section.querySelectorAll('button')).map(button => button.textContent?.trim());
    expect(recoveryButtons).toContain('Recover');
    expect(recoveryButtons).not.toContain('Recover all');
    expect(recoveryButtons).not.toContain('Upload');
    expect(recoveryButtons).not.toContain('Sync now');
    expect(recoveryButtons).not.toContain('Evict');
    expect(recoveryButtons).not.toContain('Delete');
    expect(recoveryButtons).not.toContain('Sign in with Google');
    expect(recoveryButtons).not.toContain('Connect Google Drive');
    expect(section.textContent).toContain('Remote file missing');
    expect(section.textContent).toContain('Missing local blob is not remote-backed');
    expect(section.textContent).toContain('Sync state blocks recovery');
    expect(section.textContent).toContain('Local blob already present');
    cleanup(root, host);
  });

  it('blocks recovery when provider type does not match the attachment provider', async () => {
    const recoverAttachmentFn = vi.fn(async () => recoveryResult());
    const { root, host } = render(panelElement({
      recoverAttachmentFn,
      remoteProviderConnection: availableProviderConnection({ providerType: 'r2' }),
    }));

    click(buttonByText(host, 'Attachment storage maintenance'));
    click(buttonByText(host, 'Refresh diagnostics'));
    await flushAsync();

    const section = host.querySelector('[data-attachment-sync-diagnostics-section]');
    if (!(section instanceof HTMLElement)) throw new Error('diagnostics section missing');
    expect(Array.from(section.querySelectorAll('button')).map(button => button.textContent?.trim())).not.toContain('Recover');
    expect(section.textContent).toContain('Provider mismatch');
    expect(recoverAttachmentFn).not.toHaveBeenCalled();
    cleanup(root, host);
  });

  it('blocks recovery for non-Google attachments when the active provider is Google Drive', async () => {
    const recoverAttachmentFn = vi.fn(async () => recoveryResult());
    const { root, host } = render(panelElement({
      recoverAttachmentFn,
      remoteProviderConnection: availableProviderConnection(),
      googleDriveSessionController: manualGoogleDriveController({ connected: true }),
      diagnosticsFn: vi.fn(async () => diagnosticsReport({
        recoveryItems: [{
          attachmentId: 'att-r2',
          localBlobKey: 'local-attachment/missing-r2',
          remoteProvider: 'r2',
          remoteFileId: 'r2-file-1',
          remoteSyncStatus: 'recoverable_remote',
          eligible: true,
          reason: 'Ready for explicit recovery',
          localBlobPresent: false,
        }],
      })),
    }));

    click(buttonByText(host, 'Attachment storage maintenance'));
    click(buttonByText(host, 'Refresh diagnostics'));
    await flushAsync();

    const section = host.querySelector('[data-attachment-sync-diagnostics-section]');
    if (!(section instanceof HTMLElement)) throw new Error('diagnostics section missing');
    expect(Array.from(section.querySelectorAll('button')).map(button => button.textContent?.trim())).not.toContain('Recover');
    expect(section.textContent).toContain('Provider mismatch');
    expect(recoverAttachmentFn).not.toHaveBeenCalled();
    cleanup(root, host);
  });

  it('keeps Google Drive recovery unavailable when provider status exists without a session controller', async () => {
    const recoverAttachmentFn = vi.fn(async () => recoveryResult());
    const { root, host } = render(panelElement({
      recoverAttachmentFn,
      remoteProviderConnection: availableProviderConnection(),
    }));

    click(buttonByText(host, 'Attachment storage maintenance'));
    click(buttonByText(host, 'Refresh diagnostics'));
    await flushAsync();

    const section = host.querySelector('[data-attachment-sync-diagnostics-section]');
    if (!(section instanceof HTMLElement)) throw new Error('diagnostics section missing');
    expect(section.textContent).toContain('Provider available');
    expect(section.textContent).toContain('Provider not configured');
    expect(Array.from(section.querySelectorAll('button')).map(button => button.textContent?.trim())).not.toContain('Recover');
    expect(recoverAttachmentFn).not.toHaveBeenCalled();
    cleanup(root, host);
  });

  it('uses connected session status for Google Drive recovery gating without a static provider prop', async () => {
    const recoverAttachmentFn = vi.fn(async () => recoveryResult());
    const { root, host } = render(panelElement({
      recoverAttachmentFn,
      googleDriveSessionController: manualGoogleDriveController({ connected: true }),
    }));

    click(buttonByText(host, 'Attachment storage maintenance'));
    click(buttonByText(host, 'Refresh diagnostics'));
    await flushAsync();

    const section = host.querySelector('[data-attachment-sync-diagnostics-section]');
    if (!(section instanceof HTMLElement)) throw new Error('diagnostics section missing');
    expect(section.textContent).toContain('Provider available');
    expect(Array.from(section.querySelectorAll('button')).map(button => button.textContent?.trim())).toContain('Recover');
    expect(recoverAttachmentFn).not.toHaveBeenCalled();
    cleanup(root, host);
  });

  it('blocks Google Drive recovery when the session has no valid in-memory token provider', async () => {
    const recoverAttachmentFn = vi.fn(async () => recoveryResult());
    const { root, host } = render(panelElement({
      recoverAttachmentFn,
      remoteProviderConnection: availableProviderConnection(),
      googleDriveSessionController: manualGoogleDriveController({ connected: true, hasAccessTokenProvider: false }),
    }));

    click(buttonByText(host, 'Attachment storage maintenance'));
    click(buttonByText(host, 'Refresh diagnostics'));
    await flushAsync();

    const section = host.querySelector('[data-attachment-sync-diagnostics-section]');
    if (!(section instanceof HTMLElement)) throw new Error('diagnostics section missing');
    expect(section.textContent).toContain('Token provider unavailable');
    expect(Array.from(section.querySelectorAll('button')).map(button => button.textContent?.trim())).not.toContain('Recover');
    expect(recoverAttachmentFn).not.toHaveBeenCalled();
    cleanup(root, host);
  });

  it('labels provider and session states that block recovery', async () => {
    const cases: Array<{
      name: string;
      remoteProviderConnection?: RemoteProviderConnectionBoundary;
      googleDriveSessionController?: GoogleDriveSessionConnectionController | null;
      expectedCode: string;
      expectedLabel: string;
    }> = [
      {
        name: 'no provider connection',
        expectedCode: 'provider_not_configured',
        expectedLabel: 'Provider not configured',
      },
      {
        name: 'unconfigured provider',
        remoteProviderConnection: availableProviderConnection({ status: 'unconfigured', canRecover: false, canDownload: false }),
        expectedCode: 'provider_not_configured',
        expectedLabel: 'Provider not configured',
      },
      {
        name: 'unavailable provider',
        remoteProviderConnection: availableProviderConnection({ status: 'unavailable', canRecover: false }),
        expectedCode: 'provider_unavailable',
        expectedLabel: 'Provider unavailable',
      },
      {
        name: 'auth expired',
        remoteProviderConnection: availableProviderConnection({ status: 'auth_expired', canRecover: false }),
        expectedCode: 'session_expired',
        expectedLabel: 'Session expired',
      },
      {
        name: 'reconnect required',
        remoteProviderConnection: availableProviderConnection({ status: 'reconnect_required', canRecover: false }),
        expectedCode: 'reconnect_required',
        expectedLabel: 'Reconnect required',
      },
      {
        name: 'disabled',
        remoteProviderConnection: availableProviderConnection({ status: 'disabled_by_user', canRecover: false }),
        expectedCode: 'provider_unavailable',
        expectedLabel: 'Provider unavailable',
      },
      {
        name: 'error',
        remoteProviderConnection: availableProviderConnection({ status: 'error', canRecover: false, error: 'Authorization: Bearer token-secret' }),
        expectedCode: 'provider_unavailable',
        expectedLabel: 'Provider unavailable',
      },
      {
        name: 'canRecover false',
        remoteProviderConnection: availableProviderConnection({ canRecover: false }),
        expectedCode: 'provider_unavailable',
        expectedLabel: 'Provider unavailable',
      },
      {
        name: 'download unsupported',
        remoteProviderConnection: availableProviderConnection({ status: 'unsupported', canRecover: false, canDownload: false }),
        expectedCode: 'download_unsupported',
        expectedLabel: 'Download unsupported',
      },
      {
        name: 'token provider null',
        remoteProviderConnection: availableProviderConnection(),
        googleDriveSessionController: manualGoogleDriveController({ connected: true, hasAccessTokenProvider: false }),
        expectedCode: 'token_provider_unavailable',
        expectedLabel: 'Token provider unavailable',
      },
    ];

    for (const item of cases) {
      const recoverAttachmentFn = vi.fn(async () => recoveryResult());
      const { root, host } = render(panelElement({
        recoverAttachmentFn,
        remoteProviderConnection: item.remoteProviderConnection,
        googleDriveSessionController: item.googleDriveSessionController,
        diagnosticsFn: vi.fn(async () => diagnosticsReport({ recoveryItems: [recoveryItem()] })),
      }));

      click(buttonByText(host, 'Attachment storage maintenance'));
      click(buttonByText(host, 'Refresh diagnostics'));
      await flushAsync();

      expect(recoveryReasonCodes(host), item.name).toContain(item.expectedCode);
      expect(recoveryReasonLabels(host), item.name).toContain(item.expectedLabel);
      expect(Array.from(host.querySelectorAll('button')).map(button => button.textContent?.trim())).not.toContain('Recover');
      expect(host.textContent).not.toContain('token-secret');
      expect(recoverAttachmentFn).not.toHaveBeenCalled();
      cleanup(root, host);
    }
  });

  it('labels attachment states that block Google Drive session recovery', async () => {
    const cases: Array<{
      name: string;
      item: AttachmentSyncDiagnostics['recoveryItems'][number];
      expectedCode: string;
      expectedLabel: string;
    }> = [
      {
        name: 'non-google provider',
        item: recoveryItem({ attachmentId: 'att-r2', remoteProvider: 'r2', remoteFileId: 'r2-file' }),
        expectedCode: 'provider_mismatch',
        expectedLabel: 'Provider mismatch',
      },
      {
        name: 'remote provider missing',
        item: recoveryItem({ attachmentId: 'att-no-provider', remoteProvider: undefined, remoteFileId: undefined, eligible: false, reason: 'Missing local blob.' }),
        expectedCode: 'missing_local_but_not_remote_backed',
        expectedLabel: 'Missing local blob is not remote-backed',
      },
      {
        name: 'remote file missing',
        item: recoveryItem({ attachmentId: 'att-no-remote-file', remoteFileId: undefined, eligible: false, reason: 'remoteFileId=drive-secret access_token=secret' }),
        expectedCode: 'remote_file_missing',
        expectedLabel: 'Remote file missing',
      },
      {
        name: 'local blob already present',
        item: recoveryItem({ attachmentId: 'att-present', localBlobPresent: true, localBlobKey: 'local-attachment/present', eligible: false, reason: 'Local blob already present' }),
        expectedCode: 'local_blob_already_present',
        expectedLabel: 'Local blob already present',
      },
      {
        name: 'deleted',
        item: recoveryItem({ attachmentId: 'att-deleted', eligible: false, reason: 'Attachment deleted Authorization: Bearer token-secret' }),
        expectedCode: 'attachment_deleted',
        expectedLabel: 'Attachment is deleted',
      },
      {
        name: 'tombstoned',
        item: recoveryItem({ attachmentId: 'att-tombstone', eligible: false, reason: 'Attachment tombstone codeVerifierRef=secret' }),
        expectedCode: 'attachment_tombstoned',
        expectedLabel: 'Attachment is tombstoned',
      },
      ...(['pending_upload', 'uploading', 'failed', 'paused_offline', 'conflict', 'local_only', 'missing_local'] as const).map(status => ({
        name: status,
        item: recoveryItem({
          attachmentId: `att-${status}`,
          remoteSyncStatus: status,
          eligible: false,
          reason: `${status} blocks recovery refresh_token=secret`,
        }),
        expectedCode: 'blocked_sync_state',
        expectedLabel: 'Sync state blocks recovery',
      })),
    ];

    for (const item of cases) {
      const recoverAttachmentFn = vi.fn(async () => recoveryResult());
      const { root, host } = render(panelElement({
        recoverAttachmentFn,
        googleDriveSessionController: manualGoogleDriveController({ connected: true }),
        diagnosticsFn: vi.fn(async () => diagnosticsReport({ recoveryItems: [item.item] })),
      }));

      click(buttonByText(host, 'Attachment storage maintenance'));
      click(buttonByText(host, 'Refresh diagnostics'));
      await flushAsync();

      expect(recoveryReasonCodes(host), item.name).toContain(item.expectedCode);
      expect(recoveryReasonLabels(host), item.name).toContain(item.expectedLabel);
      expect(Array.from(host.querySelectorAll('button')).map(button => button.textContent?.trim())).not.toContain('Recover');
      expect(host.textContent).not.toContain('token-secret');
      expect(host.textContent).not.toContain('refresh_token=secret');
      expect(host.textContent).not.toContain('codeVerifierRef=secret');
      expect(host.textContent).not.toContain('access_token=secret');
      expect(recoverAttachmentFn).not.toHaveBeenCalled();
      cleanup(root, host);
    }
  });

  it('keeps production default inert when no session recovery controller is provided', async () => {
    const fetcher = vi.fn<typeof fetch>();
    const { root, host } = render(panelElement({
      googleDriveRecoveryFetcher: fetcher,
      diagnosticsFn: vi.fn(async () => diagnosticsReport({ recoveryItems: [recoveryItem()] })),
    }));

    click(buttonByText(host, 'Attachment storage maintenance'));
    click(buttonByText(host, 'Refresh diagnostics'));
    await flushAsync();

    expect(recoveryReasonCodes(host)).toContain('provider_not_configured');
    expect(Array.from(host.querySelectorAll('button')).map(button => button.textContent?.trim())).not.toContain('Recover');
    expect(fetcher).not.toHaveBeenCalled();
    cleanup(root, host);
  });

  it('wires a connected memory session into one explicit Google Drive recovery download', async () => {
    const { repository, records } = memoryAttachmentRepository([attachmentMetadata()]);
    const { adapter, blobs } = memoryBlobAdapter();
    const fetcher = vi.fn<typeof fetch>(async () => new Response(new Blob(['hello'], { type: 'text/plain' }), { status: 200 }));
    const { root, host } = render(panelElement({
      googleDriveSessionController: manualGoogleDriveController({ connected: true }),
      googleDriveRecoveryFetcher: fetcher,
      googleDriveRecoveryRepository: repository,
      googleDriveRecoveryBlobAdapter: adapter,
      diagnosticsFn: vi.fn(async () => diagnosticsReport({ recoveryItems: [recoveryItem({ remoteSize: 5 })] })),
    }));

    click(buttonByText(host, 'Attachment storage maintenance'));
    click(buttonByText(host, 'Refresh diagnostics'));
    await flushAsync();
    expect(fetcher).not.toHaveBeenCalled();

    click(buttonByText(host, 'Recover'));
    await flushAsync();
    await flushAsync();

    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, init] = fetcher.mock.calls[0];
    expect(String(url)).toBe('https://www.googleapis.com/drive/v3/files/drive-file-1?alt=media');
    expect((init as RequestInit).method).toBe('GET');
    expect((init as RequestInit).headers).toMatchObject({ Authorization: 'Bearer access-token-secret' });
    expect(blobs.get('local-attachment/recovered-att-recoverable')?.size).toBe(5);
    expect(records.get('att-recoverable')?.localBlobKey).toBe('local-attachment/recovered-att-recoverable');
    expect(records.get('att-recoverable')?.remoteSyncStatus).toBe('synced');
    expect(host.textContent).toContain('Recovery result');
    expect(host.textContent).toContain('Status: recovered');
    expect(host.textContent).not.toContain('access-token-secret');
    cleanup(root, host);
  });

  it('recovers only the eligible cross-device Google Drive attachment after an explicit click', async () => {
    const { repository, records } = memoryAttachmentRepository([
      attachmentMetadata({ id: 'att-recoverable', remoteFileId: 'drive-file-1' }),
      attachmentMetadata({
        id: 'att-present',
        localBlobKey: 'local-attachment/present',
        remoteFileId: 'drive-file-present',
        remoteSyncStatus: 'synced',
      }),
      attachmentMetadata({
        id: 'att-conflict',
        remoteFileId: 'drive-file-conflict',
        remoteSyncStatus: 'conflict',
      }),
    ]);
    const { adapter, blobs } = memoryBlobAdapter([
      { key: 'local-attachment/present', blob: new Blob(['already-local'], { type: 'text/plain' }) },
    ]);
    const fetcher = vi.fn<typeof fetch>(async () => new Response(new Blob(['hello'], { type: 'text/plain' }), { status: 200 }));
    const { root, host } = render(panelElement({
      googleDriveSessionController: manualGoogleDriveController({ connected: true }),
      googleDriveRecoveryFetcher: fetcher,
      googleDriveRecoveryRepository: repository,
      googleDriveRecoveryBlobAdapter: adapter,
      diagnosticsFn: vi.fn(async () => diagnosticsReport({
        recoveryItems: [
          recoveryItem({ attachmentId: 'att-recoverable', remoteFileId: 'drive-file-1', remoteSize: 5 }),
          recoveryItem({ attachmentId: 'att-r2', remoteProvider: 'r2', remoteFileId: 'r2-file-1' }),
          recoveryItem({ attachmentId: 'att-present', remoteFileId: 'drive-file-present', localBlobKey: 'local-attachment/present', localBlobPresent: true }),
          recoveryItem({ attachmentId: 'att-no-remote-file', remoteFileId: undefined }),
          recoveryItem({ attachmentId: 'att-conflict', remoteFileId: 'drive-file-conflict', remoteSyncStatus: 'conflict', eligible: false }),
        ],
      })),
    }));

    expect(fetcher).not.toHaveBeenCalled();
    expect(blobs.size).toBe(1);
    click(buttonByText(host, 'Attachment storage maintenance'));
    await flushAsync();
    expect(fetcher).not.toHaveBeenCalled();

    click(buttonByText(host, 'Refresh diagnostics'));
    await flushAsync();
    expect(fetcher).not.toHaveBeenCalled();
    expect(Array.from(host.querySelectorAll('[data-attachment-sync-diagnostics-section] button')).map(button => button.textContent?.trim()).filter(Boolean)).toContain('Recover');
    expect(Array.from(host.querySelectorAll('button')).filter(button => button.textContent?.trim() === 'Recover')).toHaveLength(1);
    expect(host.textContent).toContain('Provider mismatch');
    expect(host.textContent).toContain('Local blob already present');
    expect(host.textContent).toContain('Remote file missing');
    expect(host.textContent).toContain('Sync state blocks recovery');

    click(buttonByText(host, 'Recover'));
    await flushAsync();
    await flushAsync();

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(String(fetcher.mock.calls[0][0])).toBe('https://www.googleapis.com/drive/v3/files/drive-file-1?alt=media');
    expect(blobs.get('local-attachment/recovered-att-recoverable')?.size).toBe(5);
    expect(records.get('att-recoverable')?.remoteSyncStatus).toBe('synced');
    expect(records.get('att-recoverable')?.localBlobKey).toBe('local-attachment/recovered-att-recoverable');
    expect(records.get('att-present')?.localBlobKey).toBe('local-attachment/present');
    expect(records.get('att-conflict')?.remoteSyncStatus).toBe('conflict');
    expect(host.textContent).not.toContain('access-token-secret');
    expect(Array.from(host.querySelectorAll('button')).map(button => button.textContent?.trim())).not.toContain('Recover all');
    expect(Array.from(host.querySelectorAll('button')).map(button => button.textContent?.trim())).not.toContain('Download all');
    expect(Array.from(host.querySelectorAll('button')).map(button => button.textContent?.trim())).not.toContain('Sync now');
    cleanup(root, host);
  });

  it('requires an explicit second click to retry after a failed Google Drive recovery', async () => {
    const { repository, records } = memoryAttachmentRepository([attachmentMetadata()]);
    const { adapter, blobs } = memoryBlobAdapter();
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response('<html>access_token=token-secret</html>', { status: 500 }))
      .mockResolvedValueOnce(new Response(new Blob(['hello'], { type: 'text/plain' }), { status: 200 }));
    const { root, host } = render(panelElement({
      googleDriveSessionController: manualGoogleDriveController({ connected: true }),
      googleDriveRecoveryFetcher: fetcher,
      googleDriveRecoveryRepository: repository,
      googleDriveRecoveryBlobAdapter: adapter,
      diagnosticsFn: vi.fn(async () => diagnosticsReport({ recoveryItems: [recoveryItem({ remoteSize: 5 })] })),
    }));

    click(buttonByText(host, 'Attachment storage maintenance'));
    click(buttonByText(host, 'Refresh diagnostics'));
    await flushAsync();
    click(buttonByText(host, 'Recover'));
    await flushAsync();
    await flushAsync();

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(host.textContent).toContain('Google Drive is temporarily unavailable');
    expect(records.get('att-recoverable')?.remoteSyncStatus).toBe('recoverable_remote');
    expect(records.get('att-recoverable')?.localBlobKey).toBeUndefined();
    expect(blobs.has('local-attachment/recovered-att-recoverable')).toBe(false);
    expect(host.textContent).not.toContain('token-secret');

    await flushAsync();
    expect(fetcher).toHaveBeenCalledTimes(1);
    click(buttonByText(host, 'Recover'));
    await flushAsync();
    await flushAsync();

    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(records.get('att-recoverable')?.remoteSyncStatus).toBe('synced');
    expect(records.get('att-recoverable')?.localBlobKey).toBe('local-attachment/recovered-att-recoverable');
    expect(blobs.get('local-attachment/recovered-att-recoverable')?.size).toBe(5);
    expect(host.textContent).toContain('Status: recovered');
    cleanup(root, host);
  });

  it('blocks real recovery when the session expires between diagnostics and click', async () => {
    const controller = manualGoogleDriveController({ connected: true });
    const { repository, records } = memoryAttachmentRepository([attachmentMetadata()]);
    const { adapter, blobs } = memoryBlobAdapter();
    const fetcher = vi.fn<typeof fetch>(async () => new Response(new Blob(['hello'], { type: 'text/plain' }), { status: 200 }));
    const { root, host } = render(panelElement({
      googleDriveSessionController: controller,
      googleDriveRecoveryFetcher: fetcher,
      googleDriveRecoveryRepository: repository,
      googleDriveRecoveryBlobAdapter: adapter,
      diagnosticsFn: vi.fn(async () => diagnosticsReport({ recoveryItems: [recoveryItem({ remoteSize: 5 })] })),
    }));

    click(buttonByText(host, 'Attachment storage maintenance'));
    click(buttonByText(host, 'Refresh diagnostics'));
    await flushAsync();
    expect(Array.from(host.querySelectorAll('button')).map(button => button.textContent?.trim())).toContain('Recover');

    await act(async () => {
      await controller.markReconnectRequired?.();
    });
    click(buttonByText(host, 'Recover'));
    await flushAsync();

    expect(fetcher).not.toHaveBeenCalled();
    expect(blobs.has('local-attachment/recovered-att-recoverable')).toBe(false);
    expect(records.get('att-recoverable')?.remoteSyncStatus).toBe('recoverable_remote');
    expect(records.get('att-recoverable')?.localBlobKey).toBeUndefined();
    expect(host.textContent).toContain('Reconnect required');
    expect(host.textContent).not.toContain('oauth2.googleapis.com/token');
    cleanup(root, host);
  });

  it('does not create an upload controller or upload on render, panel open, or diagnostics refresh by default', async () => {
    const uploadAttachmentFn = vi.fn(async () => uploadResult());
    const diagnosticsFn = vi.fn(async () => diagnosticsReport({
      uploadItems: [uploadItem()],
      recoveryItems: [],
    }));
    const { root, host } = render(panelElement({ diagnosticsFn }));

    expect(uploadAttachmentFn).not.toHaveBeenCalled();
    expect(host.textContent).not.toContain('Upload');
    click(buttonByText(host, 'Attachment storage maintenance'));
    await flushAsync();
    expect(uploadAttachmentFn).not.toHaveBeenCalled();
    click(buttonByText(host, 'Refresh diagnostics'));
    await flushAsync();
    expect(diagnosticsFn).toHaveBeenCalledTimes(1);
    expect(uploadAttachmentFn).not.toHaveBeenCalled();
    expect(Array.from(host.querySelectorAll('button')).map(button => button.textContent?.trim())).not.toContain('Upload all');
    expect(Array.from(host.querySelectorAll('button')).map(button => button.textContent?.trim())).not.toContain('Sync now');
    cleanup(root, host);
  });

  it('renders a dry-run manual upload queue review without executing uploads or unsafe bulk actions', async () => {
    const uploadAttachmentFn = vi.fn(async () => uploadResult());
    const diagnosticsFn = vi.fn(async () => diagnosticsReport({
      recoveryItems: [],
      uploadItems: [
        uploadItem({ attachmentId: 'att-ready', localBlobKey: 'local-attachment/ready', localSize: 120 }),
        uploadItem({ attachmentId: 'att-unknown-size', localBlobKey: 'local-attachment/unknown', localSize: undefined }),
        uploadItem({
          attachmentId: 'att-missing-local',
          localBlobKey: 'local-attachment/missing',
          localBlobPresent: false,
          localSize: undefined,
          eligible: false,
          reason: 'Local blob missing access_token=secret',
        }),
        uploadItem({
          attachmentId: 'att-manual-review',
          remoteSyncStatus: 'failed',
          eligible: false,
          reason: 'metadata_update_failed access_token=secret https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&upload_id=session-secret',
        }),
        uploadItem({
          attachmentId: 'att-synced',
          remoteProvider: 'googleDrive',
          remoteFileId: 'drive-file-secret',
          remoteSyncStatus: 'synced',
          eligible: false,
          reason: 'Already synced',
          localSize: 300,
        }),
      ],
    }));
    const { root, host } = render(panelElement({
      uploadAttachmentFn,
      googleDriveSessionController: manualGoogleDriveController({ connected: true }),
      diagnosticsFn,
    }));

    expect(uploadAttachmentFn).not.toHaveBeenCalled();
    click(buttonByText(host, 'Attachment storage maintenance'));
    await flushAsync();
    expect(uploadAttachmentFn).not.toHaveBeenCalled();
    click(buttonByText(host, 'Refresh diagnostics'));
    await flushAsync();

    expect(diagnosticsFn).toHaveBeenCalledTimes(1);
    expect(uploadAttachmentFn).not.toHaveBeenCalled();
    expect(host.textContent).toContain('Manual upload queue review');
    expect(host.textContent).toContain('This is a dry-run summary. Absinthe will not upload, retry, sync, or delete anything from this section.');
    expect(host.textContent).toContain('Ready items currently pass the same upload availability gate as the per-item Upload button.');
    expect(host.textContent).toContain('Eligible items still require individual Upload clicks.');
    expect(host.textContent).toContain('Ready for manual upload');
    expect(host.textContent).toContain('Blocked');
    expect(host.textContent).toContain('Needs manual review');
    expect(host.textContent).toContain('Already synced');
    expect(host.textContent).toContain('Estimated ready bytes: 120 B (1 ready item with unknown size)');
    expect(host.textContent).toContain('attachment att-ready - Ready for manual upload');
    expect(host.textContent).toContain('attachment att-missing-local - Local blob missing');
    expect(host.textContent).toContain('attachment att-manual-review - Upload needs manual review');
    expect(host.textContent).toContain('attachment att-synced - Already synced');
    expect(host.textContent).not.toContain('drive-file-secret');
    expect(host.textContent).not.toContain('access_token=secret');
    expect(host.textContent).not.toContain('session-secret');
    expect(host.textContent).not.toContain('upload/drive/v3/files');
    const buttons = Array.from(host.querySelectorAll('button')).map(button => button.textContent?.trim());
    expect(buttons).not.toContain('Upload all');
    expect(buttons).not.toContain('Run queue');
    expect(buttons).not.toContain('Sync now');
    expect(buttons).not.toContain('Retry all');
    expect(buttons).not.toContain('Delete remote');
    expect(buttons).not.toContain('Clear orphan');
    expect(buttons).not.toContain('Overwrite');
    expect(buttons).not.toContain('Recover all');
    expect(buttons).not.toContain('Download all');
    cleanup(root, host);
  });

  it('renders specific manual-review upload queue categories without making them ready', async () => {
    const uploadAttachmentFn = vi.fn(async () => uploadResult());
    const diagnosticsFn = vi.fn(async () => diagnosticsReport({
      recoveryItems: [],
      uploadItems: [
        uploadItem({
          attachmentId: 'att-conflict',
          remoteSyncStatus: 'failed',
          eligible: true,
          reason: 'remote_conflict requires review access_token=secret',
          localSize: 120,
        }),
        uploadItem({
          attachmentId: 'att-remote-missing',
          remoteSyncStatus: 'failed',
          eligible: true,
          reason: 'remote_file_missing https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&upload_id=session-secret',
          localSize: 80,
        }),
        uploadItem({
          attachmentId: 'att-invalid',
          remoteSyncStatus: 'failed',
          eligible: true,
          reason: 'invalid_remote_response Authorization: Bearer bearer-secret',
          localSize: 60,
        }),
      ],
    }));
    const { root, host } = render(panelElement({
      uploadAttachmentFn,
      googleDriveSessionController: manualGoogleDriveController({ connected: true }),
      diagnosticsFn,
    }));

    click(buttonByText(host, 'Attachment storage maintenance'));
    await flushAsync();
    click(buttonByText(host, 'Refresh diagnostics'));
    await flushAsync();

    expect(uploadAttachmentFn).not.toHaveBeenCalled();
    expect(host.textContent).toContain('Manual review3');
    expect(host.textContent).toContain('Ready0');
    expect(host.textContent).toContain('Estimated ready bytes: 0 B');
    expect(host.textContent).toContain('attachment att-conflict - Upload conflict needs review');
    expect(host.textContent).toContain('attachment att-remote-missing - Upload target is unavailable');
    expect(host.textContent).toContain('attachment att-invalid - Upload response could not be verified');
    expect(host.textContent).not.toContain('access_token=secret');
    expect(host.textContent).not.toContain('session-secret');
    expect(host.textContent).not.toContain('bearer-secret');
    expect(host.textContent).not.toContain('upload/drive/v3/files');
    const buttons = Array.from(host.querySelectorAll('button')).map(button => button.textContent?.trim());
    expect(buttons).not.toContain('Upload all');
    expect(buttons).not.toContain('Run queue');
    expect(buttons).not.toContain('Sync now');
    expect(buttons).not.toContain('Retry all');
    expect(buttons).not.toContain('Delete remote');
    expect(buttons).not.toContain('Clear orphan');
    expect(buttons).not.toContain('Overwrite');
    cleanup(root, host);
  });

  it('uploads exactly one eligible local attachment after an explicit Google Drive Upload click', async () => {
    const { repository, records } = memoryAttachmentRepository([
      attachmentMetadata({
        id: 'att-uploadable',
        localBlobKey: 'local-attachment/uploadable',
        remoteProvider: undefined,
        remoteFileId: undefined,
        remoteSize: undefined,
        remoteSyncStatus: 'local_only',
        syncStatus: 'local',
        checksum: undefined,
      }),
      attachmentMetadata({
        id: 'att-other',
        localBlobKey: 'local-attachment/other',
        remoteProvider: undefined,
        remoteFileId: undefined,
        remoteSize: undefined,
        remoteSyncStatus: 'local_only',
        syncStatus: 'local',
        checksum: undefined,
      }),
    ]);
    const deleteBlob = vi.fn(async () => {});
    const { adapter } = memoryBlobAdapter([
      { key: 'local-attachment/uploadable', blob: new Blob(['hello'], { type: 'text/plain' }) },
      { key: 'local-attachment/other', blob: new Blob(['other'], { type: 'text/plain' }) },
    ]);
    adapter.deleteBlob = deleteBlob;
    const fetcher = vi.fn<typeof fetch>(async (input, init) => {
      if (init?.method === 'POST' && String(input).includes('uploadType=resumable')) {
        return new Response(null, {
          status: 200,
          headers: { Location: 'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&upload_id=session-secret' },
        });
      }
      return new Response(JSON.stringify({
        id: 'drive-upload-1',
        mimeType: 'text/plain',
        size: '5',
        modifiedTime: '2026-06-28T00:02:00.000Z',
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });
    const { root, host } = render(panelElement({
      googleDriveSessionController: manualGoogleDriveController({ connected: true }),
      googleDriveUploadFetcher: fetcher,
      googleDriveUploadRepository: repository,
      googleDriveUploadBlobAdapter: adapter,
      diagnosticsFn: vi.fn(async () => diagnosticsReport({
        recoveryItems: [],
        uploadItems: [
          uploadItem({ attachmentId: 'att-uploadable', localBlobKey: 'local-attachment/uploadable', localSize: 5 }),
          uploadItem({ attachmentId: 'att-other', localBlobKey: 'local-attachment/other', localSize: 5 }),
          uploadItem({ attachmentId: 'att-missing', localBlobKey: 'local-attachment/missing', localBlobPresent: false, eligible: false, reason: 'Local blob missing' }),
        ],
      })),
    }));

    click(buttonByText(host, 'Attachment storage maintenance'));
    click(buttonByText(host, 'Refresh diagnostics'));
    await flushAsync();
    expect(fetcher).not.toHaveBeenCalled();
    expect(Array.from(host.querySelectorAll('button')).filter(button => button.textContent?.trim() === 'Upload')).toHaveLength(2);

    const uploadButtons = Array.from(host.querySelectorAll('[data-attachment-upload-item] button'))
      .filter((button): button is HTMLButtonElement => button instanceof HTMLButtonElement && button.textContent?.trim() === 'Upload');
    click(uploadButtons[0]);
    await flushAsync();
    await flushAsync();

    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(String(fetcher.mock.calls[0][0])).toContain('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable');
    expect(new Headers(fetcher.mock.calls[0][1]?.headers).get('Authorization')).toBe('Bearer access-token-secret');
    expect(records.get('att-uploadable')).toMatchObject({
      remoteProvider: 'googleDrive',
      remoteFileId: 'drive-upload-1',
      remoteSize: 5,
      remoteSyncStatus: 'synced',
      localBlobKey: 'local-attachment/uploadable',
    });
    expect(records.get('att-other')).toMatchObject({
      remoteFileId: undefined,
      remoteSyncStatus: 'local_only',
      localBlobKey: 'local-attachment/other',
    });
    expect(deleteBlob).not.toHaveBeenCalled();
    expect(host.textContent).toContain('Status: uploaded');
    expect(host.textContent).not.toContain('session-secret');
    expect(host.textContent).not.toContain('access-token-secret');
    cleanup(root, host);
  });

  it('blocks explicit Upload when local blob, provider, or session eligibility is missing', async () => {
    const uploadAttachmentFn = vi.fn(async () => uploadResult());
    const { root, host } = render(panelElement({
      uploadAttachmentFn,
      googleDriveSessionController: manualGoogleDriveController({ connected: false }),
      diagnosticsFn: vi.fn(async () => diagnosticsReport({
        recoveryItems: [],
        uploadItems: [
          uploadItem({ attachmentId: 'att-missing', localBlobKey: 'local-attachment/missing', localBlobPresent: false, eligible: false, reason: 'Local blob missing' }),
          uploadItem({ attachmentId: 'att-r2', remoteProvider: 'r2', eligible: false, reason: 'Provider mismatch' }),
          uploadItem({ attachmentId: 'att-deleted', remoteSyncStatus: 'local_only', eligible: false, reason: 'Attachment deleted' }),
          uploadItem({ attachmentId: 'att-conflict', remoteSyncStatus: 'conflict', eligible: false, reason: 'Conflict requires review' }),
          uploadItem({ attachmentId: 'att-ready' }),
        ],
      })),
    }));

    click(buttonByText(host, 'Attachment storage maintenance'));
    click(buttonByText(host, 'Refresh diagnostics'));
    await flushAsync();

    expect(uploadAttachmentFn).not.toHaveBeenCalled();
    expect(Array.from(host.querySelectorAll('button')).map(button => button.textContent?.trim())).not.toContain('Upload');
    expect(host.textContent).toContain('Local blob missing');
    expect(host.textContent).toContain('Provider mismatch');
    expect(host.textContent).toContain('Attachment is deleted');
    expect(host.textContent).toContain('Sync state blocks upload');
    expect(host.textContent).toContain('Provider not configured');
    cleanup(root, host);
  });

  it('revalidates session at Upload click time and blocks expired memory sessions without uploading', async () => {
    const controller = manualGoogleDriveController({ connected: true });
    const uploadAttachmentFn = vi.fn(async () => uploadResult());
    const { root, host } = render(panelElement({
      uploadAttachmentFn,
      googleDriveSessionController: controller,
      diagnosticsFn: vi.fn(async () => diagnosticsReport({
        recoveryItems: [],
        uploadItems: [uploadItem()],
      })),
    }));

    click(buttonByText(host, 'Attachment storage maintenance'));
    click(buttonByText(host, 'Refresh diagnostics'));
    await flushAsync();
    expect(Array.from(host.querySelectorAll('button')).map(button => button.textContent?.trim())).toContain('Upload');

    await act(async () => {
      await controller.markReconnectRequired?.();
    });
    click(buttonByText(host, 'Upload'));
    await flushAsync();

    expect(uploadAttachmentFn).not.toHaveBeenCalled();
    expect(host.textContent).toContain('Reconnect required');
    expect(host.textContent).not.toContain('oauth2.googleapis.com/token');
    cleanup(root, host);
  });

  it('prevents duplicate same-item Upload clicks while an upload is already running', async () => {
    let resolveUpload: ((value: AttachmentExplicitUploadResult) => void) | null = null;
    const uploadAttachmentFn = vi.fn(() => new Promise<AttachmentExplicitUploadResult>(resolve => {
      resolveUpload = resolve;
    }));
    const { root, host } = render(panelElement({
      uploadAttachmentFn,
      googleDriveSessionController: manualGoogleDriveController({ connected: true }),
      diagnosticsFn: vi.fn(async () => diagnosticsReport({
        recoveryItems: [],
        uploadItems: [uploadItem()],
      })),
    }));

    click(buttonByText(host, 'Attachment storage maintenance'));
    click(buttonByText(host, 'Refresh diagnostics'));
    await flushAsync();
    const uploadButton = buttonByText(host, 'Upload');
    click(uploadButton);
    click(uploadButton);
    await flushAsync();

    expect(uploadAttachmentFn).toHaveBeenCalledTimes(1);
    expect(host.textContent).toContain('Upload already in progress');
    resolveUpload?.(uploadResult());
    await flushAsync();
    await flushAsync();
    expect(host.textContent).toContain('Status: uploaded');
    cleanup(root, host);
  });

  it('blocks a second attachment Upload while another upload is already running', async () => {
    let resolveUpload: ((value: AttachmentExplicitUploadResult) => void) | null = null;
    const uploadAttachmentFn = vi.fn((attachmentId: string) => new Promise<AttachmentExplicitUploadResult>(resolve => {
      resolveUpload = () => resolve(uploadResult({
        uploadId: `attachment-upload:${attachmentId}:2026-06-28T00:00:00.000Z`,
        attachmentId,
      }));
    }));
    const { root, host } = render(panelElement({
      uploadAttachmentFn,
      googleDriveSessionController: manualGoogleDriveController({ connected: true }),
      diagnosticsFn: vi.fn(async () => diagnosticsReport({
        recoveryItems: [],
        uploadItems: [
          uploadItem({ attachmentId: 'att-uploadable-a', localBlobKey: 'local-attachment/uploadable-a' }),
          uploadItem({ attachmentId: 'att-uploadable-b', localBlobKey: 'local-attachment/uploadable-b' }),
        ],
      })),
    }));

    click(buttonByText(host, 'Attachment storage maintenance'));
    click(buttonByText(host, 'Refresh diagnostics'));
    await flushAsync();
    const uploadButtons = Array.from(host.querySelectorAll('[data-attachment-upload-item] button'))
      .filter((button): button is HTMLButtonElement => button instanceof HTMLButtonElement && button.textContent?.trim() === 'Upload');
    expect(uploadButtons).toHaveLength(2);

    click(uploadButtons[0]);
    click(uploadButtons[1]);
    await flushAsync();

    expect(uploadAttachmentFn).toHaveBeenCalledTimes(1);
    expect(uploadAttachmentFn).toHaveBeenCalledWith('att-uploadable-a');
    expect(host.textContent).toContain('Another upload is in progress');
    resolveUpload?.(uploadResult({
      uploadId: 'attachment-upload:att-uploadable-a:2026-06-28T00:00:00.000Z',
      attachmentId: 'att-uploadable-a',
    }));
    await flushAsync();
    await flushAsync();
    expect(host.textContent).toContain('Status: uploaded');
    cleanup(root, host);
  });

  it('keeps failed upload items in manual review instead of offering retry from diagnostics', async () => {
    const uploadAttachmentFn = vi.fn(async () => uploadResult());
    const { root, host } = render(panelElement({
      uploadAttachmentFn,
      googleDriveSessionController: manualGoogleDriveController({ connected: true }),
      diagnosticsFn: vi.fn(async () => diagnosticsReport({
        recoveryItems: [],
        uploadItems: [
          uploadItem({
            attachmentId: 'att-manual-review',
            remoteSyncStatus: 'failed',
            eligible: false,
            reason: 'Remote upload may have completed before metadata update failed. access_token=secret',
          }),
        ],
      })),
    }));

    click(buttonByText(host, 'Attachment storage maintenance'));
    click(buttonByText(host, 'Refresh diagnostics'));
    await flushAsync();

    expect(uploadAttachmentFn).not.toHaveBeenCalled();
    expect(Array.from(host.querySelectorAll('button')).map(button => button.textContent?.trim())).not.toContain('Upload');
    expect(host.textContent).toContain('Manual review required');
    expect(host.textContent).not.toContain('access_token=secret');
    cleanup(root, host);
  });

  it('renders failed upload results safely without raw token or session URI leakage', async () => {
    const uploadAttachmentFn = vi.fn(async () => uploadResult({
      status: 'failed',
      remoteFileId: undefined,
      error: 'upload failed Authorization: Bearer token-secret https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&upload_id=session-secret',
      errorDetails: {
        message: 'upload failed Authorization: Bearer token-secret access_token=access-secret refresh_token=refresh-secret id_token=id-secret codeVerifier=verifier-secret http://127.0.0.1:5173/oauth/google-drive/callback?code=callback-secret data:image/png;base64,AAA111',
        category: 'upload',
        retryable: true,
        code: 'upload_failed',
      },
      warnings: ['warning access_token=warning-secret'],
    }));
    const { root, host } = render(panelElement({
      uploadAttachmentFn,
      googleDriveSessionController: manualGoogleDriveController({ connected: true }),
      diagnosticsFn: vi.fn(async () => diagnosticsReport({
        recoveryItems: [],
        uploadItems: [uploadItem()],
      })),
    }));

    click(buttonByText(host, 'Attachment storage maintenance'));
    click(buttonByText(host, 'Refresh diagnostics'));
    await flushAsync();
    click(buttonByText(host, 'Upload'));
    await flushAsync();

    expect(uploadAttachmentFn).toHaveBeenCalledTimes(1);
    expect(host.textContent).toContain('Upload failed');
    expect(host.textContent).toContain('This attachment could not be uploaded to Google Drive.');
    expect(host.textContent).toContain('Action: Try again later or review diagnostics');
    expect(host.textContent).toContain('upload_failed');
    expect(host.textContent).not.toContain('token-secret');
    expect(host.textContent).not.toContain('access-secret');
    expect(host.textContent).not.toContain('refresh-secret');
    expect(host.textContent).not.toContain('id-secret');
    expect(host.textContent).not.toContain('verifier-secret');
    expect(host.textContent).not.toContain('callback-secret');
    expect(host.textContent).not.toContain('session-secret');
    expect(host.textContent).not.toContain('AAA111');
    expect(host.textContent).not.toContain('warning-secret');
    cleanup(root, host);
  });

  it('renders metadata update upload failures as manual-review without immediate retry copy', async () => {
    const uploadAttachmentFn = vi.fn(async () => uploadResult({
      status: 'failed',
      remoteFileId: 'drive-file-possibly-created',
      error: 'metadata write failed Authorization: Bearer token-secret',
      errorDetails: {
        message: 'metadata write failed Authorization: Bearer token-secret access_token=access-secret',
        category: 'upload',
        retryable: true,
        code: 'metadata_update_failed',
      },
      warnings: ['Remote upload may have completed before local metadata update failed. Review before retrying.'],
    }));
    const { root, host } = render(panelElement({
      uploadAttachmentFn,
      googleDriveSessionController: manualGoogleDriveController({ connected: true }),
      diagnosticsFn: vi.fn(async () => diagnosticsReport({
        recoveryItems: [],
        uploadItems: [uploadItem()],
      })),
    }));

    click(buttonByText(host, 'Attachment storage maintenance'));
    click(buttonByText(host, 'Refresh diagnostics'));
    await flushAsync();
    click(buttonByText(host, 'Upload'));
    await flushAsync();

    expect(uploadAttachmentFn).toHaveBeenCalledTimes(1);
    expect(host.textContent).toContain('Upload needs manual review');
    expect(host.textContent).toContain('The remote upload may have succeeded, but Absinthe could not update local metadata safely.');
    expect(host.textContent).toContain('Action: Review diagnostics before uploading again');
    expect(host.textContent).toContain('Manual review');
    expect(host.textContent).toContain('Remote object ambiguity: the upload may have created a Google Drive file');
    expect(host.textContent).toContain('Do not upload this attachment again until diagnostics are reviewed.');
    expect(host.textContent).toContain('Local file is still preserved.');
    expect(host.textContent).toContain('No automatic cleanup was performed.');
    expect(host.textContent).toContain('Upload was not marked synced.');
    expect(host.textContent).toContain('Technical: reason metadata_update_failed; category upload; retryable no; manualReview yes; remoteObjectAmbiguous yes');
    expect(host.textContent).not.toContain('Action: Try again later');
    expect(Array.from(host.querySelectorAll('button')).map(button => button.textContent?.trim())).not.toContain('Retry');
    expect(Array.from(host.querySelectorAll('button')).map(button => button.textContent?.trim())).not.toContain('Delete');
    expect(Array.from(host.querySelectorAll('button')).map(button => button.textContent?.trim())).not.toContain('Cleanup');
    expect(Array.from(host.querySelectorAll('button')).map(button => button.textContent?.trim())).not.toContain('Overwrite');
    expect(Array.from(host.querySelectorAll('button')).map(button => button.textContent?.trim())).not.toContain('Upload all');
    expect(Array.from(host.querySelectorAll('button')).map(button => button.textContent?.trim())).not.toContain('Sync now');
    expect(host.textContent).not.toContain('token-secret');
    expect(host.textContent).not.toContain('access-secret');
    cleanup(root, host);
  });

  it('renders verification mismatch upload diagnostics without implying success or leaking raw payloads', async () => {
    const uploadAttachmentFn = vi.fn(async () => uploadResult({
      status: 'failed',
      remoteFileId: 'drive-file-size-mismatch',
      error: 'Remote upload size verification failed. Authorization: Bearer token-secret',
      errorDetails: {
        message: 'Remote upload size verification failed. Authorization: Bearer token-secret access_token=access-secret <html>raw</html> data:image/png;base64,AAA111',
        category: 'upload',
        retryable: false,
        code: 'size_mismatch',
      },
    }));
    const { root, host } = render(panelElement({
      uploadAttachmentFn,
      googleDriveSessionController: manualGoogleDriveController({ connected: true }),
      diagnosticsFn: vi.fn(async () => diagnosticsReport({
        recoveryItems: [],
        uploadItems: [uploadItem()],
      })),
    }));

    click(buttonByText(host, 'Attachment storage maintenance'));
    click(buttonByText(host, 'Refresh diagnostics'));
    await flushAsync();
    click(buttonByText(host, 'Upload'));
    await flushAsync();

    expect(uploadAttachmentFn).toHaveBeenCalledTimes(1);
    expect(host.textContent).toContain('Uploaded file could not be verified');
    expect(host.textContent).toContain('The upload result did not match the local attachment, so Absinthe did not mark it synced.');
    expect(host.textContent).toContain('Local file is still preserved.');
    expect(host.textContent).toContain('Upload was not marked synced.');
    expect(host.textContent).toContain('Review the remote result before retrying.');
    expect(host.textContent).toContain('Technical: reason size_mismatch; category upload; retryable no; manualReview no; remoteObjectAmbiguous yes');
    expect(host.textContent).not.toContain('Status: uploaded');
    expect(host.textContent).not.toContain('token-secret');
    expect(host.textContent).not.toContain('access-secret');
    expect(host.textContent).not.toContain('<html>');
    expect(host.textContent).not.toContain('AAA111');
    expect(Array.from(host.querySelectorAll('button')).map(button => button.textContent?.trim())).not.toContain('Retry');
    expect(Array.from(host.querySelectorAll('button')).map(button => button.textContent?.trim())).not.toContain('Delete');
    expect(Array.from(host.querySelectorAll('button')).map(button => button.textContent?.trim())).not.toContain('Upload all');
    expect(Array.from(host.querySelectorAll('button')).map(button => button.textContent?.trim())).not.toContain('Sync now');
    cleanup(root, host);
  });

  it('releases the global upload lock after a failed upload result', async () => {
    let resolveFirstUpload: ((value: AttachmentExplicitUploadResult) => void) | null = null;
    const uploadAttachmentFn = vi.fn((attachmentId: string) => {
      if (attachmentId === 'att-uploadable-a') {
        return new Promise<AttachmentExplicitUploadResult>(resolve => {
          resolveFirstUpload = () => resolve(uploadResult({
            uploadId: 'attachment-upload:att-uploadable-a:2026-06-28T00:00:00.000Z',
            attachmentId: 'att-uploadable-a',
            status: 'failed',
            errorDetails: {
              message: 'Google Drive upload failed with status 503.',
              category: 'upload',
              retryable: true,
              code: 'provider_unavailable',
            },
          }));
        });
      }
      return Promise.resolve(uploadResult({
        uploadId: `attachment-upload:${attachmentId}:2026-06-28T00:00:00.000Z`,
        attachmentId,
      }));
    });
    const { root, host } = render(panelElement({
      uploadAttachmentFn,
      googleDriveSessionController: manualGoogleDriveController({ connected: true }),
      diagnosticsFn: vi.fn(async () => diagnosticsReport({
        recoveryItems: [],
        uploadItems: [
          uploadItem({ attachmentId: 'att-uploadable-a', localBlobKey: 'local-attachment/uploadable-a' }),
          uploadItem({ attachmentId: 'att-uploadable-b', localBlobKey: 'local-attachment/uploadable-b' }),
        ],
      })),
    }));

    click(buttonByText(host, 'Attachment storage maintenance'));
    click(buttonByText(host, 'Refresh diagnostics'));
    await flushAsync();
    let uploadButtons = Array.from(host.querySelectorAll('[data-attachment-upload-item] button'))
      .filter((button): button is HTMLButtonElement => button instanceof HTMLButtonElement && button.textContent?.trim() === 'Upload');
    click(uploadButtons[0]);
    await flushAsync();
    expect(host.textContent).toContain('Another upload is in progress');

    resolveFirstUpload?.(uploadResult({
      uploadId: 'attachment-upload:att-uploadable-a:2026-06-28T00:00:00.000Z',
      attachmentId: 'att-uploadable-a',
      status: 'failed',
      errorDetails: {
        message: 'Google Drive upload failed with status 503.',
        category: 'upload',
        retryable: true,
        code: 'provider_unavailable',
      },
    }));
    await flushAsync();
    await flushAsync();

    expect(host.textContent).toContain('Google Drive is temporarily unavailable');
    uploadButtons = Array.from(host.querySelectorAll('[data-attachment-upload-item] button'))
      .filter((button): button is HTMLButtonElement => button instanceof HTMLButtonElement && button.textContent?.trim() === 'Upload');
    expect(uploadButtons.length).toBeGreaterThanOrEqual(2);
    click(uploadButtons[1]);
    await flushAsync();

    expect(uploadAttachmentFn).toHaveBeenCalledTimes(2);
    expect(uploadAttachmentFn).toHaveBeenLastCalledWith('att-uploadable-b');
    cleanup(root, host);
  });

  it('does not leak access tokens when a real Google Drive recovery download fails', async () => {
    const { repository } = memoryAttachmentRepository([attachmentMetadata()]);
    const { adapter } = memoryBlobAdapter();
    const fetcher = vi.fn<typeof fetch>(async () => new Response('access-token-secret raw failure', { status: 503 }));
    const { root, host } = render(panelElement({
      googleDriveSessionController: manualGoogleDriveController({ connected: true }),
      googleDriveRecoveryFetcher: fetcher,
      googleDriveRecoveryRepository: repository,
      googleDriveRecoveryBlobAdapter: adapter,
      diagnosticsFn: vi.fn(async () => diagnosticsReport({ recoveryItems: [recoveryItem({ remoteSize: 5 })] })),
    }));

    click(buttonByText(host, 'Attachment storage maintenance'));
    click(buttonByText(host, 'Refresh diagnostics'));
    await flushAsync();
    click(buttonByText(host, 'Recover'));
    await flushAsync();
    await flushAsync();

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(host.textContent).toContain('Status: failed');
    expect(host.textContent).toContain('Google Drive download failed with status 503.');
    expect(host.textContent).not.toContain('access-token-secret');
    cleanup(root, host);
  });

  it('revalidates a stale disconnected session at click time before calling recovery', async () => {
    const recoverAttachmentFn = vi.fn(async () => recoveryResult());
    const controller = manualGoogleDriveController({ connected: true });
    const { root, host } = render(panelElement({
      recoverAttachmentFn,
      googleDriveSessionController: controller,
      diagnosticsFn: vi.fn(async () => diagnosticsReport({ recoveryItems: [recoveryItem()] })),
    }));

    click(buttonByText(host, 'Attachment storage maintenance'));
    click(buttonByText(host, 'Refresh diagnostics'));
    await flushAsync();
    expect(Array.from(host.querySelectorAll('button')).map(button => button.textContent?.trim())).toContain('Recover');

    await act(async () => {
      await controller.disconnect();
    });
    click(buttonByText(host, 'Recover'));
    await flushAsync();

    expect(recoverAttachmentFn).not.toHaveBeenCalled();
    expect(host.textContent).toContain('Provider not configured');
    expect(recoveryReasonCodes(host)).toContain('provider_not_configured');
    cleanup(root, host);
  });

  it('revalidates provider and item mutations at click time before recovery', async () => {
    const cases: Array<{
      name: string;
      mutate: (item: AttachmentSyncDiagnostics['recoveryItems'][number], provider: { current: RemoteProviderConnectionBoundary }) => void;
      expectedCode: string;
    }> = [
      {
        name: 'provider mismatch',
        mutate: (_item, provider) => {
          provider.current = availableProviderConnection({ providerType: 'r2' });
        },
        expectedCode: 'provider_mismatch',
      },
      {
        name: 'missing remote file',
        mutate: item => {
          item.remoteFileId = undefined;
        },
        expectedCode: 'remote_file_missing',
      },
      {
        name: 'local blob present',
        mutate: item => {
          item.localBlobPresent = true;
          item.localBlobKey = 'local-attachment/present';
        },
        expectedCode: 'local_blob_already_present',
      },
      {
        name: 'blocked sync state',
        mutate: item => {
          item.remoteSyncStatus = 'conflict';
          item.eligible = false;
        },
        expectedCode: 'blocked_sync_state',
      },
    ];

    for (const itemCase of cases) {
      const recoverAttachmentFn = vi.fn(async () => recoveryResult());
      const item = recoveryItem();
      const provider = { current: availableProviderConnection() };
      const controller = manualGoogleDriveController({
        connected: true,
        getConnectionStatus: vi.fn(async () => provider.current),
      });
      const { root, host } = render(panelElement({
        recoverAttachmentFn,
        googleDriveSessionController: controller,
        diagnosticsFn: vi.fn(async () => diagnosticsReport({ recoveryItems: [item] })),
      }));

      click(buttonByText(host, 'Attachment storage maintenance'));
      click(buttonByText(host, 'Refresh diagnostics'));
      await flushAsync();
      expect(Array.from(host.querySelectorAll('button')).map(button => button.textContent?.trim()), itemCase.name).toContain('Recover');

      itemCase.mutate(item, provider);
      click(buttonByText(host, 'Recover'));
      await flushAsync();

      expect(recoverAttachmentFn, itemCase.name).not.toHaveBeenCalled();
      expect(recoveryReasonCodes(host), itemCase.name).toContain(itemCase.expectedCode);
      cleanup(root, host);
    }
  });

  it('uses a fixed safe item_not_recoverable fallback label', async () => {
    const recoverAttachmentFn = vi.fn(async () => recoveryResult());
    const { root, host } = render(panelElement({
      recoverAttachmentFn,
      googleDriveSessionController: manualGoogleDriveController({ connected: true }),
      diagnosticsFn: vi.fn(async () => diagnosticsReport({
        recoveryItems: [recoveryItem({
          eligible: false,
          reason: 'raw provider failed access_token=secret refresh_token=secret codeVerifierRef=secret http://127.0.0.1:5173/oauth/google-drive/callback?code=secret',
        })],
      })),
    }));

    click(buttonByText(host, 'Attachment storage maintenance'));
    click(buttonByText(host, 'Refresh diagnostics'));
    await flushAsync();

    expect(recoveryReasonCodes(host)).toContain('item_not_recoverable');
    expect(recoveryReasonLabels(host)).toContain('Attachment is not recoverable');
    expect(host.textContent).not.toContain('access_token=secret');
    expect(host.textContent).not.toContain('refresh_token=secret');
    expect(host.textContent).not.toContain('codeVerifierRef=secret');
    expect(host.textContent).not.toContain('http://127.0.0.1:5173/oauth/google-drive/callback');
    expect(recoverAttachmentFn).not.toHaveBeenCalled();
    cleanup(root, host);
  });

  it('keeps recovery observe-only when provider is unconfigured even with a controller', async () => {
    const recoverAttachmentFn = vi.fn(async () => recoveryResult());
    const { root, host } = render(panelElement({ recoverAttachmentFn }));

    click(buttonByText(host, 'Attachment storage maintenance'));
    click(buttonByText(host, 'Refresh diagnostics'));
    await flushAsync();

    const section = host.querySelector('[data-attachment-sync-diagnostics-section]');
    if (!(section instanceof HTMLElement)) throw new Error('diagnostics section missing');
    const buttonLabels = Array.from(section.querySelectorAll('button')).map(button => button.textContent?.trim());
    expect(buttonLabels).not.toContain('Recover');
    expect(section.textContent).toContain('Provider not configured');
    expect(section.textContent).toContain('This attachment has remote metadata, but no recovery provider is configured in this build.');
    expect(recoverAttachmentFn).not.toHaveBeenCalled();
    cleanup(root, host);
  });

  it('keeps configured but unavailable provider states non-recoverable', async () => {
    const recoverAttachmentFn = vi.fn(async () => recoveryResult());
    for (const providerState of [
      {
        status: 'configured' as const,
        displayLabel: 'Provider configured',
        safeMessage: 'Google Drive configuration exists, but availability has not been confirmed.',
        reason: 'Provider unavailable',
      },
      {
        status: 'unavailable' as const,
        displayLabel: 'Provider unavailable',
        safeMessage: 'Google Drive is unavailable.',
        reason: 'Provider unavailable',
      },
    ]) {
      const { root, host } = render(panelElement({
        recoverAttachmentFn,
        remoteProviderConnection: availableProviderConnection({
          status: providerState.status,
          displayLabel: providerState.displayLabel,
          canRecover: false,
          safeMessage: providerState.safeMessage,
        }),
      }));

      click(buttonByText(host, 'Attachment storage maintenance'));
      click(buttonByText(host, 'Refresh diagnostics'));
      await flushAsync();

      const section = host.querySelector('[data-attachment-sync-diagnostics-section]');
      if (!(section instanceof HTMLElement)) throw new Error('diagnostics section missing');
      expect(section.textContent).toContain(providerState.displayLabel);
      expect(section.textContent).toContain(providerState.reason);
      expect(Array.from(section.querySelectorAll('button')).map(button => button.textContent?.trim())).not.toContain('Recover');
      cleanup(root, host);
    }
    expect(recoverAttachmentFn).not.toHaveBeenCalled();
  });

  it('shows auth expired, disabled, and sanitized error states without OAuth controls', async () => {
    const recoverAttachmentFn = vi.fn(async () => recoveryResult());
    for (const providerState of [
      {
        status: 'auth_expired' as const,
        displayLabel: 'Authorization expired',
        safeMessage: 'Reconnect is required, but connection management is not implemented in this build.',
        reason: 'Session expired',
      },
      {
        status: 'disabled_by_user' as const,
        displayLabel: 'Provider disabled',
        safeMessage: 'Google Drive recovery is disabled.',
        reason: 'Provider disabled',
      },
      {
        status: 'error' as const,
        displayLabel: 'Provider status error',
        safeMessage: 'Remote provider status could not be checked.',
        error: 'Authorization: [redacted-secret]',
        reason: 'Provider unavailable',
      },
    ]) {
      const { root, host } = render(panelElement({
        recoverAttachmentFn,
        remoteProviderConnection: availableProviderConnection({
          status: providerState.status,
          displayLabel: providerState.displayLabel,
          canRecover: false,
          requiresUserAction: providerState.status !== 'error',
          safeMessage: providerState.safeMessage,
          error: providerState.error,
        }),
      }));

      click(buttonByText(host, 'Attachment storage maintenance'));
      click(buttonByText(host, 'Refresh diagnostics'));
      await flushAsync();

      const section = host.querySelector('[data-attachment-sync-diagnostics-section]');
      if (!(section instanceof HTMLElement)) throw new Error('diagnostics section missing');
      expect(section.textContent).toContain(providerState.displayLabel);
      expect(section.textContent).toContain(providerState.reason);
      expect(section.textContent).not.toContain('Sign in with Google');
      expect(section.textContent).not.toContain('Connect Google Drive');
      expect(section.textContent).not.toContain('Authorize Google');
      expect(Array.from(section.querySelectorAll('button')).map(button => button.textContent?.trim())).not.toContain('Recover');
      cleanup(root, host);
    }
    expect(recoverAttachmentFn).not.toHaveBeenCalled();
  });

  it('shows safe provider reconnect state without Google sign-in controls', async () => {
    const recoverAttachmentFn = vi.fn(async () => recoveryResult());
    const { root, host } = render(panelElement({
      recoverAttachmentFn,
      remoteProviderConnection: availableProviderConnection({
        status: 'reconnect_required',
        displayLabel: 'Reconnect required',
        canRecover: false,
        requiresUserAction: true,
        safeMessage: 'Remote provider needs reconnect before recovery.',
      }),
    }));

    click(buttonByText(host, 'Attachment storage maintenance'));
    click(buttonByText(host, 'Refresh diagnostics'));
    await flushAsync();

    const section = host.querySelector('[data-attachment-sync-diagnostics-section]');
    if (!(section instanceof HTMLElement)) throw new Error('diagnostics section missing');
    expect(section.textContent).toContain('Reconnect required');
    expect(Array.from(section.querySelectorAll('button')).map(button => button.textContent?.trim())).not.toContain('Recover');
    expect(section.textContent).not.toContain('Sign in with Google');
    expect(section.textContent).not.toContain('Connect Google Drive');
    expect(recoverAttachmentFn).not.toHaveBeenCalled();
    cleanup(root, host);
  });

  it('blocks recovery when provider download is unsupported', async () => {
    const recoverAttachmentFn = vi.fn(async () => recoveryResult());
    const { root, host } = render(panelElement({
      recoverAttachmentFn,
      remoteProviderConnection: availableProviderConnection({
        status: 'unsupported',
        displayLabel: 'Download unsupported',
        canDownload: false,
        canRecover: false,
        safeMessage: 'Remote provider does not support attachment download recovery.',
      }),
    }));

    click(buttonByText(host, 'Attachment storage maintenance'));
    click(buttonByText(host, 'Refresh diagnostics'));
    await flushAsync();

    const section = host.querySelector('[data-attachment-sync-diagnostics-section]');
    if (!(section instanceof HTMLElement)) throw new Error('diagnostics section missing');
    expect(section.textContent).toContain('Download unsupported');
    expect(Array.from(section.querySelectorAll('button')).map(button => button.textContent?.trim())).not.toContain('Recover');
    expect(recoverAttachmentFn).not.toHaveBeenCalled();
    cleanup(root, host);
  });

  it('clicking Recover calls recovery for one attachment and displays result report', async () => {
    const recoverAttachmentFn = vi.fn(async () => recoveryResult());
    const { root, host } = render(panelElement({
      recoverAttachmentFn,
      remoteProviderConnection: availableProviderConnection(),
      googleDriveSessionController: manualGoogleDriveController({ connected: true }),
    }));

    click(buttonByText(host, 'Attachment storage maintenance'));
    click(buttonByText(host, 'Refresh diagnostics'));
    await flushAsync();
    click(buttonByText(host, 'Recover'));
    await flushAsync();

    expect(recoverAttachmentFn).toHaveBeenCalledTimes(1);
    expect(recoverAttachmentFn).toHaveBeenCalledWith('att-recoverable');
    expect(host.textContent).toContain('Recovery result');
    expect(host.textContent).toContain('Status: recovered');
    expect(host.textContent).toContain('Provider: googleDrive');
    expect(host.textContent).toContain('Local blob: local-attach...ecoverable');
    expect(host.textContent).toContain('Verification: size yes, checksum yes');
    expect(host.textContent).toContain('Refresh diagnostics after recovery');
    cleanup(root, host);
  });

  it('clears keyed recovery reports when diagnostics refresh runs again', async () => {
    const recoverAttachmentFn = vi.fn(async () => recoveryResult());
    const diagnosticsFn = vi.fn(async () => diagnosticsReport());
    const { root, host } = render(panelElement({
      diagnosticsFn,
      recoverAttachmentFn,
      remoteProviderConnection: availableProviderConnection(),
      googleDriveSessionController: manualGoogleDriveController({ connected: true }),
    }));

    click(buttonByText(host, 'Attachment storage maintenance'));
    click(buttonByText(host, 'Refresh diagnostics'));
    await flushAsync();
    click(buttonByText(host, 'Recover'));
    await flushAsync();
    expect(host.textContent).toContain('Recovery result');

    click(buttonByText(host, 'Refresh diagnostics'));
    await flushAsync();

    expect(diagnosticsFn).toHaveBeenCalledTimes(2);
    expect(recoverAttachmentFn).toHaveBeenCalledTimes(1);
    expect(host.textContent).not.toContain('Status: recovered');
    cleanup(root, host);
  });

  it('prevents double-submit while recovery is running', async () => {
    let resolveRecovery: ((value: AttachmentRemoteRecoveryResult) => void) | null = null;
    const recoverAttachmentFn = vi.fn(() => new Promise<AttachmentRemoteRecoveryResult>(resolve => {
      resolveRecovery = resolve;
    }));
    const secondItem = recoveryItem({
      attachmentId: 'att-recoverable-2',
      remoteFileId: 'drive-file-2',
    });
    const { root, host } = render(panelElement({
      recoverAttachmentFn,
      remoteProviderConnection: availableProviderConnection(),
      googleDriveSessionController: manualGoogleDriveController({ connected: true }),
      diagnosticsFn: vi.fn(async () => diagnosticsReport({
        recoveryItems: [recoveryItem(), secondItem],
      })),
    }));

    click(buttonByText(host, 'Attachment storage maintenance'));
    click(buttonByText(host, 'Refresh diagnostics'));
    await flushAsync();
    const recoverButton = buttonByText(host, 'Recover');
    click(recoverButton);
    await flushAsync();
    expect(buttonByText(host, 'Recovering...').disabled).toBe(true);
    expect(recoveryReasonCodes(host)).toContain('recovery_in_progress');
    expect(recoveryReasonLabels(host)).toContain('Recovery already in progress');
    expect(Array.from(host.querySelectorAll('button')).filter(button => button.textContent?.trim() === 'Recover')).toHaveLength(1);
    expect(recoverAttachmentFn).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveRecovery?.(recoveryResult());
      await Promise.resolve();
    });
    expect(host.textContent).toContain('Recovery result');
    cleanup(root, host);
  });

  it('renders failed recovery results safely without raw token or session URI leakage', async () => {
    const recoverAttachmentFn = vi.fn(async () => recoveryResult({
      status: 'failed',
      error: 'download failed Authorization: Bearer token-secret https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&upload_id=session-secret',
      errorDetails: {
        message: 'download failed Authorization: Bearer token-secret https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&upload_id=session-secret access_token=access-secret codeVerifier=verifier-secret http://127.0.0.1:5173/oauth/google-drive/callback?code=callback-secret',
        category: 'network',
        retryable: true,
        code: 'download_failed',
      },
      warnings: ['size-only warning access_token=warning-secret data:image/png;base64,AAA111'],
    }));
    const { root, host } = render(panelElement({
      recoverAttachmentFn,
      remoteProviderConnection: availableProviderConnection(),
      googleDriveSessionController: manualGoogleDriveController({ connected: true }),
    }));

    click(buttonByText(host, 'Attachment storage maintenance'));
    click(buttonByText(host, 'Refresh diagnostics'));
    await flushAsync();
    click(buttonByText(host, 'Recover'));
    await flushAsync();

    expect(host.textContent).toContain('Google Drive is temporarily unavailable');
    expect(host.textContent).toContain('Try again later');
    expect(host.textContent).toContain('download_failed');
    expect(host.textContent).toContain('network, retryable yes');
    expect(host.textContent).not.toContain('token-secret');
    expect(host.textContent).not.toContain('access-secret');
    expect(host.textContent).not.toContain('verifier-secret');
    expect(host.textContent).not.toContain('callback-secret');
    expect(host.textContent).not.toContain('warning-secret');
    expect(host.textContent).not.toContain('session-secret');
    expect(host.textContent).not.toContain('AAA111');
    expect(host.textContent).not.toContain(embeddedPayload);
    cleanup(root, host);
  });

  it('renders rate-limited recovery failure labels without auto retry or secret leakage', async () => {
    const recoverAttachmentFn = vi.fn(async () => recoveryResult({
      status: 'failed',
      errorDetails: {
        message: 'Google Drive rate limit blocked recovery access_token=[redacted-secret] codeVerifier=[redacted-secret]',
        category: 'provider',
        retryable: true,
        code: 'rate_limited',
      },
      warnings: ['raw callback http://127.0.0.1:5173/oauth/google-drive/callback?code=[redacted-secret]'],
    }));
    const { root, host } = render(panelElement({
      recoverAttachmentFn,
      remoteProviderConnection: availableProviderConnection(),
      googleDriveSessionController: manualGoogleDriveController({ connected: true }),
    }));

    click(buttonByText(host, 'Attachment storage maintenance'));
    click(buttonByText(host, 'Refresh diagnostics'));
    await flushAsync();
    click(buttonByText(host, 'Recover'));
    await flushAsync();

    expect(recoverAttachmentFn).toHaveBeenCalledTimes(1);
    expect(host.textContent).toContain('Google Drive is rate limiting requests');
    expect(host.textContent).toContain('Try again later');
    expect(host.textContent).toContain('retryable');
    expect(host.textContent).toContain('rate_limited');
    expect(host.textContent).not.toContain('access_token=secret');
    expect(host.textContent).not.toContain('codeVerifier=secret');
    expect(host.textContent).not.toContain('/oauth/google-drive/callback?code=secret');
    expect(Array.from(host.querySelectorAll('button')).map(button => button.textContent?.trim())).not.toContain('Recover all');
    expect(Array.from(host.querySelectorAll('button')).map(button => button.textContent?.trim())).not.toContain('Sync now');
    cleanup(root, host);
  });

  it('does not render execution controls inside attachment sync diagnostics', async () => {
    const { root, host } = render(panelElement({}));

    click(buttonByText(host, 'Attachment storage maintenance'));
    click(buttonByText(host, 'Refresh diagnostics'));
    await flushAsync();

    const section = host.querySelector('[data-attachment-sync-diagnostics-section]');
    if (!(section instanceof HTMLElement)) throw new Error('diagnostics section missing');
    const buttonLabels = Array.from(section.querySelectorAll('button')).map(button => button.textContent ?? '');

    expect(buttonLabels).toEqual([
      'Generate authorization URL',
      'Clear session',
      'Refresh diagnostics',
    ]);
    for (const forbidden of [
      'Upload',
      'Sync now',
      'Recover',
      'Download',
      'Evict',
      'Delete',
      'Cleanup',
      'Purge',
      'Sign in with Google',
      'Connect Google Drive',
    ]) {
      expect(buttonLabels.join(' ')).not.toContain(forbidden);
    }
    cleanup(root, host);
  });

  it('loads migration backup summaries only after explicit click without exposing raw backup content', async () => {
    const secretOriginalBody = `private ${embeddedPayload}`;
    const listBackupsFn = vi.fn(async () => [backupSummary({
      originalBodyBytes: secretOriginalBody.length,
    })]);
    const restoreBackupFn = vi.fn(async () => restoreReport());
    const { root, host } = render(panelElement({ listBackupsFn, restoreBackupFn }));

    click(buttonByText(host, 'Attachment storage maintenance'));
    expect(listBackupsFn).not.toHaveBeenCalled();
    expect(host.textContent).toContain('Migration backups');

    click(buttonByText(host, 'Load migration backups'));
    await flushAsync();

    expect(listBackupsFn).toHaveBeenCalledTimes(1);
    expect(host.textContent).toContain('1 migration backup found.');
    expect(host.textContent).toContain('Scanned note');
    expect(host.textContent).toContain('original body');
    expect(host.textContent).toContain('image/png');
    expect(host.textContent).not.toContain(secretOriginalBody);
    expect(host.textContent).not.toContain(embeddedPayload);
    expect(restoreBackupFn).not.toHaveBeenCalled();
    cleanup(root, host);
  });

  it('keeps restore disabled for inspected backups without a current migrated hash checkpoint', async () => {
    const listBackupsFn = vi.fn(async () => [backupSummary()]);
    const restoreBackupFn = vi.fn(async () => restoreReport());
    const { root, host } = render(panelElement({ listBackupsFn, restoreBackupFn }));

    click(buttonByText(host, 'Attachment storage maintenance'));
    click(buttonByText(host, 'Load migration backups'));
    await flushAsync();
    click(buttonContaining(host, 'Scanned note', 'Restore unavailable', 'Safe restore requires the current migration report'));

    expect(host.textContent).toContain('Safe restore requires the current migration report');
    expect(buttonByText(host, 'Restore selected backup').disabled).toBe(true);
    expect(restoreBackupFn).not.toHaveBeenCalled();
    cleanup(root, host);
  });

  it('blocks normal restore when the current note changed after migration', async () => {
    const listBackupsFn = vi.fn(async () => [backupSummary()]);
    const migrateFn = vi.fn(async () => migrationReportWithBackup());
    const restoreBackupFn = vi.fn(async () => restoreReport());
    const { root, host } = render(panelElement({
      notes: [note('changed after migration')],
      listBackupsFn,
      migrateFn,
      restoreBackupFn,
    }));

    click(buttonByText(host, 'Attachment storage maintenance'));
    click(buttonByText(host, 'Scan embedded attachments'));
    await flushAsync();
    click(buttonByText(host, 'Migrate embedded attachments'));
    click(buttonByText(host, 'Confirm migration'));
    await flushAsync();
    click(buttonByText(host, 'Load migration backups'));
    await flushAsync();
    click(buttonContaining(host, 'Scanned note', 'Current note changed', 'Normal restore is blocked'));

    expect(host.textContent).toContain('Current note changed');
    expect(host.textContent).toContain('Normal restore is blocked');
    expect(buttonByText(host, 'Restore selected backup').disabled).toBe(true);
    expect(restoreBackupFn).not.toHaveBeenCalled();
    expect(host.textContent).not.toContain('force');
    cleanup(root, host);
  });

  it('requires backup-bound confirmation before calling restore helper and displays restore report', async () => {
    const summary = backupSummary();
    const listBackupsFn = vi.fn(async () => [summary]);
    const migrateFn = vi.fn(async () => migrationReportWithBackup());
    const restoreBackupFn = vi.fn(async () => restoreReport());
    const updateNote = vi.fn();
    const { root, host } = render(panelElement({
      notes: [note('migrated body')],
      updateNote,
      listBackupsFn,
      migrateFn,
      restoreBackupFn,
    }));

    click(buttonByText(host, 'Attachment storage maintenance'));
    click(buttonByText(host, 'Scan embedded attachments'));
    await flushAsync();
    click(buttonByText(host, 'Migrate embedded attachments'));
    click(buttonByText(host, 'Confirm migration'));
    await flushAsync();
    click(buttonByText(host, 'Load migration backups'));
    await flushAsync();
    click(buttonContaining(host, 'Scanned note', 'Restorable', 'Current note matches the migrated checkpoint'));

    const restoreButton = buttonByText(host, 'Restore selected backup');
    expect(restoreButton.disabled).toBe(true);
    const input = host.querySelector('input[aria-label="Restore confirmation phrase"]');
    if (!(input instanceof HTMLInputElement)) throw new Error('restore confirmation input missing');
    changeInput(input, 'RESTORE wrong');
    expect(restoreButton.disabled).toBe(true);
    changeInput(input, `RESTORE ${summary.backupKey.slice(0, 18)}`);
    expect(restoreButton.disabled).toBe(false);

    click(restoreButton);
    await flushAsync();

    expect(restoreBackupFn).toHaveBeenCalledTimes(1);
    expect(restoreBackupFn.mock.calls[0]?.[0]).toMatchObject({
      noteId: 'note-1',
      backupKey: summary.backupKey,
      expectedCurrentBodyHash: hashEmbeddedAttachmentMigrationText('migrated body'),
      expectedCurrentContentHash: hashEmbeddedAttachmentMigrationText(''),
    });
    expect(restoreBackupFn.mock.calls[0]?.[0].force).toBeUndefined();
    expect(updateNote).not.toHaveBeenCalled();
    expect(host.textContent).toContain('Restore result');
    expect(host.textContent).toContain('Restored: yes');
    expect(host.textContent).toContain('Re-run migration scan or cleanup review');
    expect(host.textContent).not.toContain(embeddedPayload);
    cleanup(root, host);
  });
});
