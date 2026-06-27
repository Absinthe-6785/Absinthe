// @vitest-environment happy-dom
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { describe, expect, it, vi } from 'vitest';
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

function panelElement(input: {
  notes?: readonly Note[];
  updateNote?: (id: string, patch: Partial<Note>) => void;
  auditFn?: () => EmbeddedAttachmentAuditReport;
  migrateFn?: () => Promise<EmbeddedAttachmentMigrationReport>;
}) {
  return createElement(EmbeddedAttachmentMigrationReviewPanel, {
    notes: input.notes ?? [note()],
    colors,
    updateNote: input.updateNote ?? vi.fn(),
    auditFn: input.auditFn ?? vi.fn(() => reportWithCandidate()),
    migrateFn: input.migrateFn ?? vi.fn(async () => migrationReport()),
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
  const updateNote = vi.fn();
  const mounted = render(panelElement({ notes: options.notes, updateNote, auditFn, migrateFn }));
  return { auditFn, migrateFn, updateNote, ...mounted };
}

describe('EmbeddedAttachmentMigrationReviewPanel', () => {
  it('does not scan or migrate on mount', () => {
    const { auditFn, migrateFn, root, host } = renderPanel();

    expect(auditFn).not.toHaveBeenCalled();
    expect(migrateFn).not.toHaveBeenCalled();
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
});
