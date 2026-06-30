import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const setupPath = join(process.cwd(), 'docs', 'K-205-real-google-drive-qa-environment-setup-checklist.md');
const checklistPath = join(process.cwd(), 'docs', 'K-203-real-google-drive-manual-qa-checklist.md');
const resultsPath = join(process.cwd(), 'docs', 'K-204-real-google-drive-manual-qa-results.md');

function read(path: string): string {
  return readFileSync(path, 'utf8');
}

describe('K-205 real Google Drive QA environment setup checklist', () => {
  it('exists and defines setup scope without executing QA or adding behavior', () => {
    expect(existsSync(setupPath)).toBe(true);
    const text = read(setupPath);

    for (const required of [
      'K-205 Real Google Drive QA Environment Setup Checklist',
      'Prepare a safe external environment for retrying real Google Drive manual QA.',
      'K-204 was blocked/not-run',
      'K-205 does not execute real QA',
      'does not add credentials',
      'does not change runtime behavior',
      'K-206 should retry the K-203 checklist only after this setup checklist is complete.',
    ]) {
      expect(text).toContain(required);
    }
  });

  it('covers required external Google and local prerequisites', () => {
    const text = read(setupPath);

    for (const required of [
      'Isolated disposable Google test account.',
      'External Google Cloud OAuth test project/client.',
      'Authorized JavaScript origin for local development.',
      'Authorized redirect/callback URL for local development.',
      'Google Drive API enabled only for the test project.',
      'Test-only OAuth consent configuration.',
      'Test user allowlist if the Google OAuth app is in testing mode.',
      'Non-sensitive test image/attachment files.',
      'Clean browser profile.',
      'Local app running from the canonical repo',
      'Local-only environment values stored outside git.',
    ]) {
      expect(text).toContain(required);
    }
  });

  it('documents credential handling rules and placeholder-only local values', () => {
    const text = read(setupPath);

    for (const required of [
      'Never commit `client_secret`.',
      'Never commit access token.',
      'Never commit refresh token.',
      'Never commit ID token.',
      'Never commit auth code.',
      'Never commit callback URL containing code/state.',
      'Never commit resumable upload session URI.',
      'Never commit raw Google error bodies if they contain identifiers/tokens.',
      'Use placeholders or redacted aliases only.',
      'GOOGLE_DRIVE_TEST_CLIENT_ID=<redacted test client id>',
      'GOOGLE_DRIVE_TEST_REDIRECT_URI=http://localhost:<port>/<callback-path>',
      'GOOGLE_DRIVE_TEST_ACCOUNT_ALIAS=<redacted disposable account>',
      'GOOGLE_DRIVE_TEST_NOTE_NAME=<redacted test note>',
      'GOOGLE_DRIVE_TEST_FILE_SET=<non-sensitive image attachments>',
      'They do not add production wiring, default OAuth values, app settings, or persistent credentials.',
    ]) {
      expect(text).toContain(required);
    }
  });

  it('covers OAuth, browser, and test data setup', () => {
    const text = read(setupPath);

    for (const required of [
      '## OAuth Setup Checklist',
      'Create or select an external test Google Cloud project.',
      'Enable Google Drive API for the test project only.',
      'Configure the OAuth consent screen for testing.',
      'Add the disposable Google test account as a test user if needed.',
      'Create an OAuth client suitable for local testing.',
      'Add the authorized JavaScript origin for the local app.',
      'Add the authorized redirect URI / callback URL for the local app.',
      'Confirm no production OAuth client is used.',
      '## Browser / Profile Setup',
      'Use a clean browser profile.',
      'Sign in only to the disposable Google test account.',
      'Clear localStorage/sessionStorage/cookies before QA when testing memory-only behavior.',
      '## Test Data Setup',
      'Create a redacted test note.',
      'Add one small non-sensitive image attachment for per-item upload.',
      'Add at least three small non-sensitive test images for limited selected queue run.',
      'Avoid personal photos, private documents, regulated data, screenshots containing secrets, or irreplaceable files.',
    ]) {
      expect(text).toContain(required);
    }
  });

  it('covers safe failure simulation guidance without adding runtime hooks', () => {
    const text = read(setupPath);

    for (const required of [
      '## Network / Failure Simulation Setup',
      'Do not add runtime test hooks in this milestone.',
      'Network offline: use browser devtools or OS network toggle.',
      'Session expiry: reload/close browser, disconnect, or clear memory/session state if implementation is memory-only.',
      'Token unavailable: disconnect/reload if the implementation is memory-only.',
      'Missing local blob: use existing test controls only if safe; otherwise mark Not run.',
      '`metadata_update_failed`: simulate only if a safe existing test hook exists; otherwise mark Not run.',
      'Rate limit: usually Not run unless a safe simulation exists.',
      'Checksum mismatch / invalid response: usually Not run unless a safe fixture exists.',
    ]) {
      expect(text).toContain(required);
    }
  });

  it('covers repo hygiene, app safety, retry readiness, and cleanup', () => {
    const text = read(setupPath);

    for (const required of [
      '## Preflight Repo Hygiene',
      'git status',
      'git diff --name-status origin/main...HEAD',
      'git diff --check',
      'No `.env` or local credential file is tracked.',
      'No screenshots with secrets are staged.',
      '## Preflight App Safety',
      'App boots in local-first mode.',
      'No upload/recovery starts on app boot.',
      'No upload/recovery starts on diagnostics refresh.',
      'No Upload all / Run queue / Run all control exists.',
      'No Retry all / Retry queue / Start queue control exists.',
      'No Continue queue / Run next / Sync now control exists.',
      'No Recover all / Download all control exists.',
      '## K-206 Retry Readiness Checklist',
      'Disposable Google test account exists.',
      'External OAuth test client exists.',
      'Authorized JavaScript origin is configured.',
      'Authorized redirect/callback URL is configured.',
      'No secrets are staged.',
      '## Cleanup After QA',
      'Revoke test app access from the disposable Google account if needed.',
      'Delete test files from Drive manually if safe.',
      'Remove local env values from shell/session.',
      'Record cleanup status in the K-206/K-204 result document.',
    ]) {
      expect(text).toContain(required);
    }
  });

  it('lists explicit out-of-scope behavior boundaries', () => {
    const text = read(setupPath);

    for (const required of [
      '## Out Of Scope',
      'Production OAuth deployment.',
      'Persistent Google Drive connection.',
      'Refresh-token lifecycle.',
      'Background sync.',
      'Upload all / Run queue.',
      'Auto retry/backoff.',
      'Auto reconnect.',
      'Remote cleanup or orphan cleanup.',
      'Overwrite/replace policy.',
      'Large-file/performance QA beyond basic smoke.',
      'Multi-account Google UX.',
      'Shared Drive/team Drive.',
      'Queue drain.',
      'Download all.',
      'Recover all.',
    ]) {
      expect(text).toContain(required);
    }
  });

  it('links K-203 and K-204 to the K-205 setup checklist', () => {
    expect(read(checklistPath)).toContain('Before executing this checklist, complete `frontend/docs/K-205-real-google-drive-qa-environment-setup-checklist.md`.');
    expect(read(resultsPath)).toContain('K-205 defines the setup needed before retrying these blocked/not-run scenarios in K-206.');
  });

  it('does not contain obvious real secrets or raw OAuth/session artifacts', () => {
    const text = read(setupPath);

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
