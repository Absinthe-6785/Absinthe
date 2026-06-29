import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const docsPath = join(process.cwd(), 'docs', 'K-201-remote-attachment-upload-recovery-mvp-completion-audit.md');
const panelPath = join(process.cwd(), 'src', 'components', 'views', 'noteview', 'EmbeddedAttachmentMigrationReviewPanel.tsx');

function readText(path: string): string {
  return readFileSync(path, 'utf8');
}

function limitedQueueRunnerSource(): string {
  const source = readText(panelPath);
  const start = source.indexOf('const runSelectedUploadQueueItems');
  const end = source.indexOf('const renderUploadQueueGroup', start);
  if (start < 0 || end < 0) throw new Error('Limited queue runner segment not found.');
  return source.slice(start, end);
}

function manualQueueReviewSource(): string {
  const source = readText(panelPath);
  const start = source.indexOf('Manual upload queue review');
  const end = source.indexOf('Remote recovery', start);
  if (start < 0 || end < 0) throw new Error('Manual upload queue review segment not found.');
  return source.slice(start, end);
}

describe('K-201 remote attachment MVP completion audit', () => {
  it('documents the local-first upload, recovery, and queue MVP status', () => {
    const text = readText(docsPath);

    for (const required of [
      'local-first attachment metadata and local blob safety',
      'explicit manual Google Drive session boundary',
      'memory-only access token provider',
      'explicit per-item remote recovery',
      'explicit per-item Google Drive upload',
      'upload failure labels and manual-review diagnostics',
      'manual upload queue review',
      'strict Ready classification',
      'Ready requires `availability.canUpload`',
      'explicit per-item queue shortcut',
      'limited selected max-3 queue execution',
      'selected queue execution is visible Ready-only',
      'sequential display-order queue execution',
      '`runUpload(attachmentId)` reuse',
      'uploaded-only success',
      'stop on first non-success',
      'post-upload diagnostics/recompute QA',
      'real-scenario queue-run QA',
      'final upload queue run boundary audit',
    ]) {
      expect(text).toContain(required);
    }
  });

  it('documents preserved safety boundaries against automatic or destructive behavior', () => {
    const text = readText(docsPath);

    for (const required of [
      'No remote-first attachment source of truth',
      'No upload on app boot',
      'No upload on render',
      'No upload on diagnostics refresh',
      'No upload on session connection',
      'No recovery on render',
      'No recovery on diagnostics refresh',
      'No recovery on session connection',
      'No background sync',
      'No queue drain',
      'No `Upload all`',
      'No `Run queue`',
      'No `Run all`',
      'No `Retry all`',
      'No `Retry queue`',
      'No `Start queue`',
      'No `Sync now`',
      'No `Continue queue`',
      'No `Run next`',
      'No automatic retry',
      'No automatic reconnect',
      'No refresh-token persistence',
      'No silent session restore',
      'No remote delete',
      'No local delete',
      'No cleanup, overwrite, or eviction execution from upload/recovery flows',
      'Local blob is preserved',
      'Metadata is marked synced only through the verified upload success path',
    ]) {
      expect(text).toContain(required);
    }
  });

  it('documents explicit recovery and upload status without widening success or queue policy', () => {
    const text = readText(docsPath);

    for (const required of [
      'Recovery is explicit per-item only',
      'No `Recover all`',
      'Provider, session, and token gating are required',
      'Stale click-time revalidation is required',
      'Local blob write and metadata status update happen only after successful verified recovery',
      'Per-item upload is explicit',
      'Limited selected queue run is explicit and max 3',
      'Execution is sequential display order',
      "`report.status !== 'uploaded'` stops the run",
      'Failed, blocked, skipped, null, and unknown results stop',
      'No `Promise.all`',
      'No direct adapter bypass',
      'No delete, cleanup, overwrite, or eviction behavior',
    ]) {
      expect(text).toContain(required);
    }
  });

  it('documents Google Drive OAuth and diagnostics/manual-review boundaries', () => {
    const text = readText(docsPath);

    for (const required of [
      'OAuth is manual/session-only',
      'Authorization URL, callback validation, token exchange, and ephemeral token provider exist',
      'Access token is memory-only',
      'Refresh token is ignored/dropped',
      'No token persistence',
      'No silent refresh',
      'No app boot restore',
      'No production default Google Drive credentials',
      'Manual connection UI remains controlled and inert unless configured',
      'No browser redirect automation',
      'No popup automation',
      'Diagnostics panel shows queue review, recovery availability, upload statuses, and manual-review reasons',
      'metadata_update_failed',
      'verification mismatch',
      'invalid response',
      'remote conflict',
      'Result and error details are sanitized',
      'No raw provider body, token, verifier, callback URL, Authorization header, Bearer token, or secret payload',
    ]) {
      expect(text).toContain(required);
    }
  });

  it('documents known limitations and next phase recommendations', () => {
    const text = readText(docsPath);

    for (const required of [
      'No full queue runner',
      'No background attachment sync',
      'No automatic retry or backoff timer',
      'No persistent Google Drive connection',
      'No refresh token lifecycle',
      'No automatic diagnostics refresh after every operation beyond existing behavior',
      'No remote orphan cleanup',
      'No remote overwrite or replace policy',
      'No cancellation UI for selected queue run',
      'Real Google Drive manual QA still needed',
      'Post-upload diagnostics refresh UX remains future polish',
      'Manual-review user guidance remains future polish',
      'K-202 Real Google Drive Manual QA Checklist',
      'K-203 Post-upload Diagnostics Refresh UX Polish',
      'K-204 Manual Review User Guidance Polish',
      'K-205 Remote Attachment Sync Roadmap Re-evaluation',
      'MVP is closed at the current explicit, local-first, manual-session boundary',
    ]) {
      expect(text).toContain(required);
    }
  });

  it('keeps runtime queue source bounded away from bulk controls, parallelism, and destructive paths', () => {
    const runner = limitedQueueRunnerSource();
    const review = manualQueueReviewSource();

    expect(runner).toContain('for (const attachmentId of selectedIds)');
    expect(runner).toContain('const report = await runUpload(attachmentId)');
    expect(runner).toContain("report.status !== 'uploaded'");
    for (const forbidden of [
      'Promise.all',
      'Promise.allSettled',
      'GoogleDriveBlobAdapter',
      'uploadAttachmentBlobToRemote',
      'deleteBlob',
      'remoteDelete',
      'executeAttachmentCleanup',
      'executeLocalBlobEviction',
      'localStorage',
      'sessionStorage',
      'oauth2.googleapis.com/token',
    ]) {
      expect(runner).not.toContain(forbidden);
    }

    for (const forbidden of [
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
    ]) {
      expect(review).not.toContain(forbidden);
    }
  });
});
