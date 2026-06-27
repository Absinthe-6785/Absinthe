// @vitest-environment happy-dom
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { AttachmentCleanupReviewReport } from '../../../lib/attachmentCleanupReview';
import type { EmbeddedAttachmentAuditReport } from '../../../lib/embeddedAttachmentAudit';
import type { EmbeddedAttachmentMigrationReport } from '../../../lib/embeddedAttachmentMigration';
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

function panelElement(input: {
  notes?: readonly Note[];
  updateNote?: (id: string, patch: Partial<Note>) => void;
  auditFn?: () => EmbeddedAttachmentAuditReport;
  migrateFn?: () => Promise<EmbeddedAttachmentMigrationReport>;
  cleanupReviewFn?: () => Promise<AttachmentCleanupReviewReport>;
}) {
  return createElement(EmbeddedAttachmentMigrationReviewPanel, {
    notes: input.notes ?? [note()],
    colors,
    updateNote: input.updateNote ?? vi.fn(),
    auditFn: input.auditFn ?? vi.fn(() => reportWithCandidate()),
    migrateFn: input.migrateFn ?? vi.fn(async () => migrationReport()),
    cleanupReviewFn: input.cleanupReviewFn ?? vi.fn(async () => cleanupReviewReport()),
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

function click(element: HTMLElement) {
  act(() => {
    element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
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
  const updateNote = vi.fn();
  const mounted = render(panelElement({ notes: options.notes, updateNote, auditFn, migrateFn, cleanupReviewFn }));
  return { auditFn, migrateFn, cleanupReviewFn, updateNote, ...mounted };
}

describe('EmbeddedAttachmentMigrationReviewPanel', () => {
  it('does not scan or migrate on mount', () => {
    const { auditFn, migrateFn, cleanupReviewFn, root, host } = renderPanel();

    expect(auditFn).not.toHaveBeenCalled();
    expect(migrateFn).not.toHaveBeenCalled();
    expect(cleanupReviewFn).not.toHaveBeenCalled();
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
    expect(host.textContent).toContain('2.0 KB');
    cleanup(root, host);
  });

  it('shows cleanup review warnings, preserved backups, and candidate recommendations without delete actions', async () => {
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
    const buttonText = Array.from(host.querySelectorAll('button')).map(button => button.textContent?.trim()).join(' ');
    expect(buttonText).not.toContain('Delete');
    expect(buttonText).not.toContain('Remove');
    expect(buttonText).not.toContain('Purge');
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
});
