import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const docsPath = join(process.cwd(), 'docs', 'K-201-remote-attachment-upload-recovery-mvp-completion-audit.md');
const panelPath = join(process.cwd(), 'src', 'components', 'views', 'noteview', 'EmbeddedAttachmentMigrationReviewPanel.tsx');

function readText(path: string): string {
  return readFileSync(path, 'utf8');
}

function sourceSlice(source: string, startMarker: string, endMarker: string): string {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  if (start < 0 || end < 0) {
    throw new Error(`Source slice not found: ${startMarker} -> ${endMarker}`);
  }
  return source.slice(start, end);
}

function panelSource(): string {
  return readText(panelPath);
}

function runRecoverySource(): string {
  return sourceSlice(panelSource(), 'const runRecovery = async', 'const runUpload = async');
}

function runUploadSource(): string {
  return sourceSlice(panelSource(), 'const runUpload = async', 'const failedResults');
}

function selectedQueueRunnerSource(): string {
  return sourceSlice(panelSource(), 'const runSelectedUploadQueueItems', 'const renderUploadQueueGroup');
}

function manualQueueReviewSource(): string {
  return sourceSlice(panelSource(), 'Manual upload queue review', 'Remote recovery');
}

function remoteRecoveryUiSource(): string {
  return sourceSlice(panelSource(), 'Remote recovery', 'diagnosticsReport.inventory.warnings.map');
}

function expectAbsent(source: string, forbidden: readonly string[]): void {
  for (const term of forbidden) {
    expect(source).not.toContain(term);
  }
}

const destructiveTerms = [
  'deleteBlob',
  'remoteDelete',
  'executeAttachmentCleanup',
  'executeLocalBlobEviction',
] as const;

const oauthAndTokenPersistenceTerms = [
  'oauth2.googleapis.com/token',
  'window.open',
  'window.location',
  'localStorage',
  'sessionStorage',
  'document.cookie',
  'refresh_token',
  'access_token',
  'id_token',
  'client_secret',
] as const;

describe('K-202 remote attachment completion source audit polish', () => {
  it('documents the K-202 source audit polish without claiming wider runtime capability', () => {
    const doc = readText(docsPath);

    for (const required of [
      '## K-202 Source Audit Polish',
      'Recovery source remains explicit, per-item, and manually gated.',
      'Upload source remains explicit per-item or limited selected max-3 only.',
      'Upload/recovery UI source does not bypass provider, session, token, or guarded action paths.',
      'No `Recover all`, `Download all`, `Upload all`, `Run queue`, `Retry all`, or `Continue queue` controls are introduced.',
      'Upload/recovery UI source does not add cleanup, delete, overwrite, or eviction behavior.',
      'K-202 adds source-slice audit coverage only; it does not change runtime behavior.',
      'Real Google Drive manual QA remains the next step.',
    ]) {
      expect(doc).toContain(required);
    }

    for (const forbiddenClaim of [
      'Upload all is complete',
      'background sync is complete',
      'persistent OAuth is complete',
      'auto retry is complete',
      'remote cleanup is complete',
    ]) {
      expect(doc).not.toContain(forbiddenClaim);
    }
  });

  it('keeps recovery action source explicit, gated, and free of destructive or token-persistence behavior', () => {
    const recovery = runRecoverySource();

    for (const required of [
      'googleDriveSessionController.getConnectionStatus()',
      'getAttachmentRecoveryAvailability',
      'Boolean(activeRecoverAttachmentFn)',
      'if (!eligibility.canRecover)',
      'if (!activeRecoverAttachmentFn)',
      'setRunningRecoveryAttachmentId(attachmentId)',
      'const report = await activeRecoverAttachmentFn(attachmentId)',
      'sanitizeRemoteBlobProviderErrorMessage',
    ]) {
      expect(recovery).toContain(required);
    }

    expectAbsent(recovery, [
      ...destructiveTerms,
      ...oauthAndTokenPersistenceTerms,
      'Recover all',
      'Download all',
      'Auto recover',
      'Start recovery',
      'Promise.all',
      'GoogleDriveBlobAdapter',
      'uploadAttachmentBlobToRemote',
    ]);
  });

  it('keeps remote recovery UI per-item only with no bulk or destructive controls', () => {
    const recoveryUi = remoteRecoveryUiSource();

    for (const required of [
      'Google Drive recovery is session-only',
      'Nothing is recovered automatically',
      'getAttachmentRecoveryAvailability',
      'onClick={() => runRecovery(item.attachmentId)}',
      "{running ? 'Recovering...' : 'Recover'}",
    ]) {
      expect(recoveryUi).toContain(required);
    }

    expectAbsent(recoveryUi, [
      ...destructiveTerms,
      ...oauthAndTokenPersistenceTerms,
      'Recover all',
      'Download all',
      'Auto recover',
      'Start recovery',
      'Delete remote',
      'Clear orphan',
      'Overwrite',
      'Evict',
    ]);
  });

  it('keeps per-item upload source manually gated through the guarded action path', () => {
    const upload = runUploadSource();

    for (const required of [
      'runningUploadAttachmentIdsRef.current.size > 0',
      'googleDriveSessionController.getConnectionStatus()',
      'getAttachmentUploadAvailability',
      'Boolean(activeUploadAttachmentFn)',
      'if (!eligibility.canUpload)',
      'if (!activeUploadAttachmentFn)',
      'setRunningUploadAttachmentId(attachmentId)',
      'const report = await activeUploadAttachmentFn(attachmentId)',
      'sanitizeRemoteBlobProviderErrorMessage',
    ]) {
      expect(upload).toContain(required);
    }

    expectAbsent(upload, [
      ...destructiveTerms,
      ...oauthAndTokenPersistenceTerms,
      'Upload all',
      'Run queue',
      'Run all',
      'Retry all',
      'Retry queue',
      'Start queue',
      'Sync now',
      'Process queue',
      'Continue queue',
      'Run next',
      'Promise.all',
      'GoogleDriveBlobAdapter',
      'uploadAttachmentBlobToRemote',
    ]);
  });

  it('keeps selected queue execution limited, sequential, selected-only, and routed through runUpload', () => {
    const queueRunner = selectedQueueRunnerSource();

    for (const required of [
      'visibleReadyItems',
      'selectedUploadQueueAttachmentIds.has(id)',
      '.slice(0, maxManualUploadQueueSelection)',
      'for (const attachmentId of selectedIds)',
      'const report = await runUpload(attachmentId)',
      "report.status !== 'uploaded'",
      'break',
    ]) {
      expect(queueRunner).toContain(required);
    }

    expectAbsent(queueRunner, [
      ...destructiveTerms,
      ...oauthAndTokenPersistenceTerms,
      'Promise.all',
      'Promise.allSettled',
      'GoogleDriveBlobAdapter',
      'uploadAttachmentBlobToRemote',
      'Upload all',
      'Run queue',
      'Run all',
      'Retry all',
      'Retry queue',
      'Start queue',
      'Sync now',
      'Process queue',
      'Continue queue',
      'Run next',
    ]);
  });

  it('keeps manual queue review UI free of bulk, retry-all, sync-now, and destructive controls', () => {
    const review = manualQueueReviewSource();

    for (const required of [
      'Upload selected Ready items one at a time',
      'The run stops after the first item that does not complete successfully',
      'onClick={() => runSelectedUploadQueueItems(visibleReadyItems)}',
      'Upload selected',
      'onClick={() => runUpload(item.attachmentId)}',
      "{running ? 'Uploading...' : 'Upload'}",
    ]) {
      expect(review).toContain(required);
    }

    expectAbsent(review, [
      ...destructiveTerms,
      ...oauthAndTokenPersistenceTerms,
      'Upload all',
      'Run queue',
      'Run all',
      'Retry all',
      'Retry queue',
      'Start queue',
      'Sync now',
      'Process queue',
      'Continue queue',
      'Run next',
      'Recover all',
      'Download all',
      'Delete remote',
      'Clear orphan',
      'Overwrite',
      'Evict',
      'GoogleDriveBlobAdapter',
      'uploadAttachmentBlobToRemote',
    ]);
  });
});
