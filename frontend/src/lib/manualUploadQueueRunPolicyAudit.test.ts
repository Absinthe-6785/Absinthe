import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const policyPath = join(process.cwd(), 'docs', 'K-194-manual-upload-queue-run-policy.md');

function policyText(): string {
  return readFileSync(policyPath, 'utf8');
}

describe('K-194 manual upload queue run policy audit', () => {
  it('documents the future queue-run candidate and selection policy', () => {
    const text = policyText();

    expect(text).toContain('Ready bucket only');
    expect(text).toContain('availability.canUpload === true');
    expect(text).toContain('Manual-review items');
    expect(text).toContain('Blocked items');
    expect(text).toContain('Already-synced items');
    expect(text).toContain('Hidden or not-rendered Ready items unless a future UI explicitly selects them');
    expect(text).toContain('Deleted or tombstoned items');
    expect(text).toContain('Provider mismatch items');
    expect(text).toContain('Missing local blob items');
    expect(text).toContain('limited multi-select, not Upload all');
    expect(text).toContain('1 to 3 visible Ready items');
    expect(text).toContain('Upload selected items one at a time.');
  });

  it('requires sequential execution through the existing single-item upload path', () => {
    const text = policyText();

    expect(text).toContain('Execution must be sequential only');
    expect(text).toContain('No parallel upload');
    expect(text).toContain('One in-flight upload at a time');
    expect(text).toContain('Reuse the existing `runUpload(attachmentId)` path');
    expect(text).toContain('Do not call `GoogleDriveBlobAdapter` directly from a queue runner');
    expect(text).toContain('Do not call `uploadAttachmentBlobToRemote` directly from a queue runner');
    expect(text).toContain('Recompute or revalidate availability before each item');
    expect(text).toContain('Stop on first failure');
  });

  it('defines non-destructive failure, partial success, rate-limit, and cancellation policy', () => {
    const text = policyText();

    expect(text).toContain('Do not continue to the next selected item after a failure');
    expect(text).toContain('Do not auto retry');
    expect(text).toContain('Do not queue retry');
    expect(text).toContain('Do not remote delete');
    expect(text).toContain('Do not local delete');
    expect(text).toContain('Do not orphan cleanup');
    expect(text).toContain('Do not overwrite');
    expect(text).toContain('Preserve the local blob');
    expect(text).toContain('Previous successful items remain successful');
    expect(text).toContain('Not-started items remain not started and Ready');
    expect(text).toContain('Treat 429 and rate-limit responses as failures');
    expect(text).toContain('Cancellation means stop before the next item');
  });

  it('forbids queue-run controls, background execution, token persistence, and OAuth widening', () => {
    const text = policyText();

    for (const required of [
      'No Upload all',
      'No Run all',
      'No Run queue',
      'No Process queue',
      'No Continue queue',
      'No Run next',
      'No Retry all',
      'No Sync now',
      'No background sync',
      'No automatic retry',
      'No token persistence',
      'No access token persistence',
      'No refresh token persistence',
      'No localStorage, sessionStorage, IndexedDB, or cookie token storage',
      'No silent refresh',
      'No app boot restore',
      'No OAuth widening',
    ]) {
      expect(text).toContain(required);
    }
  });

  it('keeps queue review and diagnostics refresh read-only until explicit future implementation', () => {
    const text = policyText();

    expect(text).toContain('Queue review rendering is read-only');
    expect(text).toContain('Queue review render must not upload');
    expect(text).toContain('Diagnostics refresh must not upload');
    expect(text).toContain('Diagnostics refresh must not auto-run remaining items');
    expect(text).toContain('Session connection success must not upload');
    expect(text).toContain('Stale Ready state must be revalidated before each item');
  });
});
