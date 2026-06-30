import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const retryResultsPath = join(process.cwd(), 'docs', 'K-206-real-google-drive-manual-qa-retry-results.md');
const checklistPath = join(process.cwd(), 'docs', 'K-203-real-google-drive-manual-qa-checklist.md');
const firstResultsPath = join(process.cwd(), 'docs', 'K-204-real-google-drive-manual-qa-results.md');
const setupPath = join(process.cwd(), 'docs', 'K-205-real-google-drive-qa-environment-setup-checklist.md');

function read(path: string): string {
  return readFileSync(path, 'utf8');
}

describe('K-206 real Google Drive manual QA retry results', () => {
  it('exists and records retry scope without adding runtime behavior', () => {
    expect(existsSync(retryResultsPath)).toBe(true);
    const text = read(retryResultsPath);

    for (const required of [
      'K-206 Real Google Drive Manual QA Retry Results',
      'This document records the K-206 retry of the real Google Drive manual QA.',
      'K-206 uses the K-203 checklist and K-205 environment setup.',
      'explicit-only remote attachment upload/recovery MVP',
      'does not introduce runtime behavior',
      'does not add production credentials',
      'does not claim support for background sync, Upload all, persistent OAuth, refresh-token lifecycle, broad Drive scope, queue drain, or auto retry',
      'Result values are limited to: Pass, Fail, Blocked, Not run.',
      'Untested scenarios must not be claimed as passed.',
    ]) {
      expect(text).toContain(required);
    }
  });

  it('documents environment, required scope, and appDataFolder expectations', () => {
    const text = read(retryResultsPath);

    for (const required of [
      '## Environment',
      '| Branch | `k206-retry-real-google-drive-manual-qa` |',
      '| Base commit | `cb66619` |',
      '| Required OAuth scope | `https://www.googleapis.com/auth/drive.appdata` |',
      '| Expected storage target | `appDataFolder` |',
      'Uploads are expected to target Google Drive `appDataFolder`, not arbitrary user-visible My Drive folders.',
      'Test artifacts may not appear in the normal My Drive UI.',
      'Do not mark upload as failed solely because a file is not visible in normal My Drive.',
      'If direct `appDataFolder` inspection is unavailable, record that limitation instead of broadening Drive scope.',
    ]) {
      expect(text).toContain(required);
    }
  });

  it('records K-205 readiness and summary rows for the retry', () => {
    const text = read(retryResultsPath);

    for (const required of [
      '## K-205 Readiness Checklist Status',
      'Disposable Google test account ready',
      'External OAuth test client ready',
      'Authorized JavaScript origin configured',
      'Authorized redirect/callback URL configured',
      'Drive API enabled',
      'OAuth consent/test user configured',
      'Local env values outside git',
      'Clean browser profile ready',
      'Non-sensitive test files ready',
      'No secrets staged',
      '## Summary Table',
      'Environment readiness',
      'Manual connection',
      'OAuth cancel/failure path',
      'appDataFolder expectation',
      'Per-item upload success',
      'Per-item upload failure/manual-review',
      'Per-item recovery success',
      'Per-item recovery failure',
      'Limited selected queue run success',
      'Limited selected queue run non-success stop',
      'Session expired / reconnect behavior',
      'Diagnostics refresh safety',
      'Security/privacy checks',
      'Non-destructive checks',
      'Cleanup after QA',
    ]) {
      expect(text).toContain(required);
    }
  });

  it('covers manual connection, upload, recovery, queue, and diagnostics result sections', () => {
    const text = read(retryResultsPath);

    for (const required of [
      '## Manual Connection Results',
      'Scope observed/requested',
      'Expected scope is `https://www.googleapis.com/auth/drive.appdata`',
      '## Per-item Upload Results',
      'Ready classification requires `availability.canUpload`',
      'appDataFolder storage expectation',
      'No raw resumable upload session URI exposed',
      '## Per-item Upload Failure / Manual-review Results',
      'no auto retry',
      'no Retry all',
      'no remote/local delete',
      'no cleanup/overwrite/eviction',
      'no raw token/provider payload shown',
      'no resumable upload session URI shown/logged/copied/persisted',
      '## Per-item Recovery Results',
      'No Recover all / Download all',
      '## Recovery Failure Results',
      '## Limited Selected Queue Run Results',
      'No Upload all / Run queue / Run all / Retry all / Continue queue / Run next',
      '## Queue Failure Scenarios',
      '## Diagnostics Refresh Results',
      'diagnostics refresh never uploads, never recovers, recomputes only, and starts no background sync',
    ]) {
      expect(text).toContain(required);
    }
  });

  it('covers security, privacy, non-destructive, cleanup, conclusion, and follow-up sections', () => {
    const text = read(retryResultsPath);

    for (const required of [
      '## Security / Privacy Results',
      'No access token rendered',
      'No refresh token rendered',
      'No ID token rendered',
      'No auth code rendered',
      'No code verifier rendered',
      'No callback URL with code rendered',
      'No Authorization/Bearer rendered',
      'No raw Google error body rendered',
      'No resumable upload session URI displayed/logged/copied/persisted',
      'No token in localStorage/sessionStorage/cookies',
      'No token persisted in IndexedDB',
      'No `console.log` of token/provider payload',
      'No real credential committed',
      'No broad Drive scope used',
      '`drive.appdata` scope expectation recorded',
      '## Non-destructive Results',
      'No local blob deletion during upload/recovery',
      'No remote file deletion from the app',
      'No orphan cleanup',
      'No overwrite/replace',
      'No eviction execution',
      'No metadata marked synced without verified upload success',
      '## Cleanup After QA',
      'No local env files committed',
      'No screenshots/secrets committed',
      '## Result Conclusion',
      'Manual QA remains blocked for real Google Drive scenarios in this environment.',
      '## Follow-up Recommendations',
      'Verify upload results against app behavior, remote metadata, diagnostics, adapter responses, and `appDataFolder` expectations rather than normal My Drive visibility.',
    ]) {
      expect(text).toContain(required);
    }
  });

  it('links K-203, K-204, and K-205 documents to the K-206 retry', () => {
    expect(read(checklistPath)).toContain('K-206 retries this checklist with the K-205 prepared environment in `frontend/docs/K-206-real-google-drive-manual-qa-retry-results.md`.');
    expect(read(firstResultsPath)).toContain('K-206 is the retry result after K-205 environment setup.');

    const setup = read(setupPath);
    expect(setup).toContain('Required OAuth scope: `https://www.googleapis.com/auth/drive.appdata`.');
    expect(setup).toContain('Expected storage target: Google Drive `appDataFolder`.');
    expect(setup).toContain('Uploads may not appear in the normal user-visible My Drive UI because `appDataFolder` is used.');
  });

  it('does not contain obvious real secrets or raw OAuth/session artifacts', () => {
    const text = read(retryResultsPath);

    for (const forbidden of [
      'AI' + 'za',
      'ya' + '29.',
      '-----BEGIN PRIVATE KEY-----',
      'client_' + 'secret=',
      '"client_' + 'secret":',
      'code=' + '4/',
      'upload_' + 'id=',
    ]) {
      expect(text).not.toContain(forbidden);
    }
  });
});
