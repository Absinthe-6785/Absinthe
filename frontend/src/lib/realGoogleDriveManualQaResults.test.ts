import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const resultsPath = join(process.cwd(), 'docs', 'K-204-real-google-drive-manual-qa-results.md');
const checklistPath = join(process.cwd(), 'docs', 'K-203-real-google-drive-manual-qa-checklist.md');

function read(path: string): string {
  return readFileSync(path, 'utf8');
}

describe('K-204 real Google Drive manual QA results', () => {
  it('records a manual QA result log without claiming runtime changes', () => {
    expect(existsSync(resultsPath)).toBe(true);
    const text = read(resultsPath);

    for (const required of [
      'K-204 Real Google Drive Manual QA Results',
      'This document records manual QA results for the K-203 real Google Drive manual QA checklist.',
      'validate the existing explicit-only remote attachment upload/recovery MVP against a real Google Drive test account',
      'does not introduce new runtime behavior',
      'does not add production credentials',
      'does not claim support for background sync, Upload all, persistent OAuth, auto retry, queue drain, cleanup, overwrite, eviction, or broad remote sync',
      'Result values are limited to: Pass, Fail, Blocked, Not run.',
      'Untested scenarios must not be claimed as passed.',
    ]) {
      expect(text).toContain(required);
    }
  });

  it('includes environment, summary, conclusion, and follow-up sections', () => {
    const text = read(resultsPath);

    for (const required of [
      '## Environment',
      '| Date | 2026-06-30 |',
      '| Tester | Codex |',
      '| Branch | `k204-execute-real-google-drive-manual-qa` |',
      '| Base commit | `8366ac8` |',
      '| OAuth test configuration | `<redacted test OAuth client>` unavailable |',
      '## Summary Table',
      '| Scenario | Result | Evidence | Notes | Follow-up |',
      '## Result Conclusion',
      'Manual QA is blocked for real Google Drive scenarios in this environment.',
      'This result should not be treated as real Google Drive E2E validation.',
      '## Follow-up Recommendations',
      'Provide an isolated Google test account and externally configured OAuth test client/callback for manual QA.',
    ]) {
      expect(text).toContain(required);
    }
  });

  it('covers all required manual QA scenario result groups', () => {
    const text = read(resultsPath);

    for (const required of [
      'Manual connection',
      'OAuth cancel/failure path',
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
      '## Manual Connection Results',
      '## Per-item Upload Results',
      '## Per-item Upload Failure / Manual-review Results',
      '## Per-item Recovery Results',
      '## Recovery Failure Results',
      '## Limited Selected Queue Run Results',
      '## Queue Failure Scenarios',
      '## Diagnostics Refresh Results',
    ]) {
      expect(text).toContain(required);
    }
  });

  it('records blocked or not-run status honestly for unavailable real Google Drive scenarios', () => {
    const text = read(resultsPath);

    for (const required of [
      '| Manual connection | Blocked |',
      '| OAuth cancel/failure path | Blocked |',
      '| Per-item upload success | Blocked |',
      '| Per-item upload failure/manual-review | Blocked |',
      '| Per-item recovery success | Blocked |',
      '| Per-item recovery failure | Blocked |',
      '| Limited selected queue run success | Blocked |',
      '| Limited selected queue run non-success stop | Blocked |',
      '| Session expired / reconnect behavior | Blocked |',
      '| Diagnostics refresh safety | Blocked |',
      '| Security/privacy checks | Blocked |',
      '| Non-destructive checks | Blocked |',
      'No real Google Drive upload, recovery, OAuth connection, selected queue run, session expiry, or provider failure scenario was completed.',
      'external test prerequisites were unavailable',
    ]) {
      expect(text).toContain(required);
    }
  });

  it('covers security, privacy, and non-destructive result checks', () => {
    const text = read(resultsPath);

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
      '## Non-destructive Results',
      'No local blob deletion during upload/recovery',
      'No remote file deletion',
      'No orphan cleanup',
      'No overwrite/replace',
      'No eviction execution',
      'No metadata marked synced without verified upload success',
    ]) {
      expect(text).toContain(required);
    }
  });

  it('records upload and queue guardrails without adding widened controls', () => {
    const text = read(resultsPath);

    for (const required of [
      'No Upload all / Run queue / Run all / Retry all / Continue queue / Run next',
      'no Retry all',
      'no remote/local delete',
      'no cleanup/overwrite/eviction',
      'no auto retry',
      'no recovery-all',
      'no raw token/provider payload',
    ]) {
      expect(text).toContain(required);
    }
  });

  it('updates the K-203 checklist with K-204 execution and resumable URI privacy notes', () => {
    const text = read(checklistPath);

    expect(text).toContain('This checklist defines manual QA steps and should not be treated as executed until a result log exists.');
    expect(text).toContain('K-204 records the first execution attempt in `frontend/docs/K-204-real-google-drive-manual-qa-results.md`.');
    expect(text).toContain('No resumable upload session URI is displayed, logged, copied, or persisted.');
  });

  it('does not contain obvious real secrets or raw OAuth/session artifacts', () => {
    const text = read(resultsPath);

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
