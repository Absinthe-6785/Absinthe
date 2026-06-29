import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const docsPath = join(process.cwd(), 'docs', 'K-199-upload-queue-run-final-boundary-audit.md');
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

describe('K-199 upload queue run final boundary audit', () => {
  it('documents the final implemented boundary for selected visible Ready queue execution', () => {
    const text = readText(docsPath);

    for (const required of [
      'Selection is visible Ready-only',
      'maximum selected count is 3 visible Ready items',
      'explicit `Upload selected` action',
      'visible display order',
      'Execution is sequential only',
      'There is no `Promise.all` or parallel upload path',
      'reuses the existing `runUpload(attachmentId)` path',
      '`uploaded` is the only success state',
      '`failed`, `blocked`, `skipped`, `null`, and unknown non-success results all stop the run',
      'stops on the first item that does not complete successfully',
      'Selection clears after the run',
      'Hidden Ready items and unselected Ready items are not executed',
      'Diagnostics refresh is required to recompute',
    ]) {
      expect(text).toContain(required);
    }
  });

  it('documents K-194 policy alignment and intentional limitations', () => {
    const text = readText(docsPath);

    for (const required of [
      'Ready-only candidates are enforced',
      'explicit limited selection, not queue drain',
      'Uploads run one by one',
      'Partial success is non-destructive',
      'does not persist tokens',
      'does not start background sync',
      'does not bypass the existing upload path',
      'No `Upload all`',
      'No full queue runner',
      'No automatic queue drain',
      'No automatic retry',
      'No `Retry all`',
      'No `Continue queue`',
      'No `Run next`',
      'No cancellation UI',
      'No rate-limit timer or backoff scheduler',
      'No background sync',
      'Selection remains limited to 3 visible Ready items',
    ]) {
      expect(text).toContain(required);
    }
  });

  it('documents destructive-operation, token, and OAuth safety invariants', () => {
    const text = readText(docsPath);

    for (const required of [
      'No direct `GoogleDriveBlobAdapter` construction from the limited queue runner',
      'No direct `uploadAttachmentBlobToRemote` call from the limited queue runner',
      'No metadata writes outside the existing upload path',
      'No remote delete',
      'No local delete',
      'No cleanup executor',
      'No overwrite policy',
      'No local blob eviction executor',
      'No token persistence',
      'No refresh token lifecycle',
      'No silent session restore',
      'No token endpoint call in the limited queue runner',
      'No OAuth widening',
    ]) {
      expect(text).toContain(required);
    }
  });

  it('keeps the limited queue runner sequential, selected-only, and uploaded-only', () => {
    const runner = limitedQueueRunnerSource();

    expect(runner).toContain('visibleReadyItems');
    expect(runner).toContain('.filter(id => selectedUploadQueueAttachmentIds.has(id))');
    expect(runner).toContain('.slice(0, maxManualUploadQueueSelection)');
    expect(runner).toContain('for (const attachmentId of selectedIds)');
    expect(runner).toContain('const report = await runUpload(attachmentId)');
    expect(runner).toContain("report.status !== 'uploaded'");
    expect(runner).toContain('break');
    expect(runner).toContain('setSelectedUploadQueueAttachmentIds(new Set())');
    expect(runner).not.toContain('Promise.all');
    expect(runner).not.toContain('Promise.allSettled');
    expect(runner).not.toContain('GoogleDriveBlobAdapter');
    expect(runner).not.toContain('uploadAttachmentBlobToRemote');
    expect(runner).not.toContain('deleteBlob');
    expect(runner).not.toContain('remoteDelete');
    expect(runner).not.toContain('executeAttachmentCleanup');
    expect(runner).not.toContain('executeLocalBlobEviction');
    expect(runner).not.toContain('localStorage');
    expect(runner).not.toContain('sessionStorage');
    expect(runner).not.toContain('oauth2.googleapis.com/token');
  });

  it('keeps manual queue review controls limited to Upload selected and forbids bulk/drain controls', () => {
    const review = manualQueueReviewSource();

    expect(review).toContain('Upload selected');
    expect(review).toContain('Select up to {maxManualUploadQueueSelection} visible Ready items');
    expect(review).toContain('Only selected items upload');
    expect(review).toContain('hidden items are never uploaded by review rendering or by a limited selected run');
    expect(review).toContain('The run stops after the first item that does not complete successfully');
    for (const forbidden of [
      'Upload all',
      'Run queue',
      'Run all',
      'Retry all',
      'Sync now',
      'Process queue',
      'Continue queue',
      'Run next',
      'Delete remote',
      'Clear orphan',
      'Overwrite',
      'Recover all',
      'Download all',
    ]) {
      expect(review).not.toContain(forbidden);
    }
  });
});
