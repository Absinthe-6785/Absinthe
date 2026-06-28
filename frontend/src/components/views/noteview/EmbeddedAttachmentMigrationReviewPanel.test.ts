// @vitest-environment happy-dom
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { AttachmentCleanupReviewReport } from '../../../lib/attachmentCleanupReview';
import type { AttachmentSyncDiagnostics } from '../../../lib/attachmentSyncDiagnostics';
import type { AttachmentRemoteRecoveryResult } from '../../../lib/attachmentRemoteRecovery';
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
  remoteProviderConnection?: RemoteProviderConnectionBoundary;
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
    remoteProviderConnection: input.remoteProviderConnection,
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

function changeInput(input: HTMLInputElement, value: string) {
  act(() => {
    const valueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
    valueSetter?.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

async function flushAsync() {
  await act(async () => {
    await Promise.resolve();
  });
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
    expect(host.textContent).toContain('Missing local blob; recovery state needs reconciliation.');
    expect(host.textContent).toContain('Recovery unavailable');
    expect(host.textContent).toContain('Upload pending');
    expect(host.textContent).toContain('Local blob already present');
    cleanup(root, host);
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
    expect(section.textContent).toContain('Missing local blob; recovery state needs reconciliation.');
    expect(section.textContent).toContain('Recovery unavailable');
    expect(section.textContent).toContain('Upload pending');
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
    expect(section.textContent).toContain('Recovery provider does not match this attachment.');
    expect(recoverAttachmentFn).not.toHaveBeenCalled();
    cleanup(root, host);
  });

  it('blocks recovery for non-Google attachments when the active provider is Google Drive', async () => {
    const recoverAttachmentFn = vi.fn(async () => recoveryResult());
    const { root, host } = render(panelElement({
      recoverAttachmentFn,
      remoteProviderConnection: availableProviderConnection(),
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
    expect(section.textContent).toContain('Recovery provider does not match this attachment.');
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
        reason: 'Reconnect required',
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
    expect(section.textContent).toContain('Download unsupported by provider');
    expect(Array.from(section.querySelectorAll('button')).map(button => button.textContent?.trim())).not.toContain('Recover');
    expect(recoverAttachmentFn).not.toHaveBeenCalled();
    cleanup(root, host);
  });

  it('clicking Recover calls recovery for one attachment and displays result report', async () => {
    const recoverAttachmentFn = vi.fn(async () => recoveryResult());
    const { root, host } = render(panelElement({
      recoverAttachmentFn,
      remoteProviderConnection: availableProviderConnection(),
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
    const { root, host } = render(panelElement({
      recoverAttachmentFn,
      remoteProviderConnection: availableProviderConnection(),
    }));

    click(buttonByText(host, 'Attachment storage maintenance'));
    click(buttonByText(host, 'Refresh diagnostics'));
    await flushAsync();
    const recoverButton = buttonByText(host, 'Recover');
    click(recoverButton);
    click(buttonByText(host, 'Recovering...'));
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
        message: 'download failed Authorization: Bearer [redacted-secret] [redacted-remote-url]',
        category: 'network',
        retryable: true,
        code: 'download_failed',
      },
      warnings: ['size-only warning access_token=[redacted-secret]'],
    }));
    const { root, host } = render(panelElement({
      recoverAttachmentFn,
      remoteProviderConnection: availableProviderConnection(),
    }));

    click(buttonByText(host, 'Attachment storage maintenance'));
    click(buttonByText(host, 'Refresh diagnostics'));
    await flushAsync();
    click(buttonByText(host, 'Recover'));
    await flushAsync();

    expect(host.textContent).toContain('download_failed');
    expect(host.textContent).toContain('network, retryable yes');
    expect(host.textContent).not.toContain('token-secret');
    expect(host.textContent).not.toContain('session-secret');
    expect(host.textContent).not.toContain(embeddedPayload);
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

    expect(buttonLabels).toEqual(['Refresh diagnostics']);
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
