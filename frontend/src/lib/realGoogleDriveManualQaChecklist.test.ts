import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const checklistPath = join(process.cwd(), 'docs', 'K-203-real-google-drive-manual-qa-checklist.md');

function readChecklist(): string {
  return readFileSync(checklistPath, 'utf8');
}

describe('K-203 real Google Drive manual QA checklist', () => {
  it('exists as a manual QA document with no real credential values', () => {
    expect(existsSync(checklistPath)).toBe(true);
    const text = readChecklist();

    for (const required of [
      'Real Google Drive Manual QA Checklist',
      'Validate the existing explicit-only remote attachment upload/recovery MVP using a real Google Drive session.',
      'manual QA, not a feature expansion',
      'Use a test Google account only.',
      'Use non-sensitive test images and attachments only.',
      'Do not commit real credentials',
      'Use placeholders only.',
      '<test OAuth client name>',
      '<configured callback URL>',
      '<test account alias only>',
    ]) {
      expect(text).toContain(required);
    }

    for (const forbidden of [
      'AI' + 'za',
      'ya' + '29.',
      '-----BEGIN PRIVATE KEY-----',
      'client_' + 'secret=',
      '"client_' + 'secret":',
    ]) {
      expect(text).not.toContain(forbidden);
    }
  });

  it('covers manual connection and session-only expectations', () => {
    const text = readChecklist();

    for (const required of [
      '## Connection Scenario',
      'Confirm Google Drive is disconnected or inert by default.',
      'Initiate manual Google Drive connection.',
      'Confirm no upload or recovery starts automatically after connection.',
      'no silent restore if the session is memory-only',
      'no token persistence',
      'Manual connection only.',
      'No app-boot upload.',
      'No diagnostics-refresh upload.',
      'No diagnostics-refresh recovery.',
      'No background sync.',
      'No automatic reconnect.',
    ]) {
      expect(text).toContain(required);
    }
  });

  it('covers per-item upload success and failure/manual-review cases', () => {
    const text = readChecklist();

    for (const required of [
      '## Per-item Upload Scenario',
      'Confirm the item appears Ready only when `availability.canUpload` is true.',
      'Click the explicit per-item upload control.',
      'Confirm one upload starts.',
      'Confirm no other item uploads.',
      'Confirm the uploaded item leaves Ready and appears Already Synced.',
      'Confirm the local blob remains available.',
      'No Upload all.',
      'No Run queue.',
      'No Run all.',
      '## Per-item Upload Failure / Manual-review Scenario',
      'Network offline before click.',
      'Session expired before click.',
      'Session expires during upload.',
      '`metadata_update_failed` simulation if possible.',
      '`invalid_response` or verification mismatch simulation if possible.',
      '`rate_limited` / network failure simulation if possible.',
      'Local blob missing simulation if possible.',
      'No auto retry.',
      'No Retry all.',
      'No retry queue.',
    ]) {
      expect(text).toContain(required);
    }
  });

  it('covers per-item recovery success and failure cases', () => {
    const text = readChecklist();

    for (const required of [
      '## Per-item Recovery Scenario',
      'remote metadata and a missing local blob',
      'provider, session, and token gating are valid',
      'Click explicit per-item recovery.',
      'Confirm one recovery starts.',
      'Confirm the local blob is restored.',
      'Confirm no other attachment recovers.',
      'No Recover all.',
      'No Download all.',
      'No auto recovery on render.',
      'No auto recovery on diagnostics refresh.',
      'No auto recovery on session connection.',
      '## Recovery Failure Scenario',
      'Missing remote file.',
      'Session expired.',
      'Provider unavailable.',
      'Network failure.',
      'Invalid blob response.',
      'No local destructive write.',
      'No recovery-all.',
    ]) {
      expect(text).toContain(required);
    }
  });

  it('covers limited selected queue success and non-success stop behavior', () => {
    const text = readChecklist();

    for (const required of [
      '## Limited Selected Queue Run Scenario',
      'Prepare at least three visible Ready attachments.',
      'Select up to three visible Ready items.',
      'Confirm hidden Ready items are not selected.',
      'Click Upload selected.',
      'uploads run one at a time in display order',
      'no observed parallel or `Promise.all` style upload behavior',
      'Confirm first non-success stops.',
      'Confirm not-started items remain Ready.',
      'Max 3.',
      'Selected visible Ready only.',
      'No hidden item upload.',
      'No Continue queue.',
      'No Run next.',
      'No queue drain.',
      '## Limited Selected Queue Failure Scenarios',
      'A success, B session expired, C not-started.',
      'A success, B network failure or rate limited, C not-started.',
      'A success, B `metadata_update_failed` / manual-review, C not-started.',
      'A success, B invalid response / verification mismatch, C not-started.',
      'A success, B null/no result if reproducible, C not-started.',
      'Stops after the first item that does not complete successfully.',
    ]) {
      expect(text).toContain(required);
    }
  });

  it('covers diagnostics, security/privacy, and non-destructive safety checks', () => {
    const text = readChecklist();

    for (const required of [
      '## Diagnostics Refresh Behavior',
      'Diagnostics refresh never uploads.',
      'Diagnostics refresh never recovers.',
      'Diagnostics refresh recomputes buckets/statuses only.',
      'Queue review render does not upload.',
      'Recovery review render does not recover.',
      '## Security / Privacy Checklist',
      'No access token rendered.',
      'No refresh token rendered.',
      'No ID token rendered.',
      'No auth code rendered.',
      'No code verifier rendered.',
      'No callback URL with code rendered.',
      'No Authorization or Bearer value rendered.',
      'No raw Google error body rendered.',
      'No client secret in source/docs.',
      'No token in localStorage.',
      'No token in sessionStorage.',
      'No token in cookies.',
      'No token persisted in IndexedDB.',
      'No `console.log` of token/provider payload.',
      'No real credential committed.',
      '## Non-destructive Checklist',
      'No local blob deletion during upload/recovery.',
      'No remote file deletion.',
      'No orphan cleanup from upload/recovery.',
      'No overwrite or replace policy.',
      'No eviction execution.',
      'No metadata marked synced without verified upload success.',
    ]) {
      expect(text).toContain(required);
    }
  });

  it('includes result log, exit criteria, and explicit out-of-scope boundaries', () => {
    const text = readChecklist();

    for (const required of [
      '## Result Log Template',
      'Date | Tester | Browser/profile | Google test account | App branch/commit | Scenario | Result | Evidence | Notes | Follow-up issue/PR',
      '<Pass / Fail / Blocked / Not run>',
      '## Exit Criteria',
      'Connection scenario passes.',
      'Per-item upload success and failure/manual-review scenarios pass.',
      'Per-item recovery success and failure scenarios pass.',
      'Limited selected queue success and non-success stop scenarios pass.',
      'Diagnostics refresh safety passes.',
      'Security/privacy checklist passes.',
      'Non-destructive checklist passes.',
      '## Out Of Scope',
      'Upload all.',
      'Full queue runner.',
      'Background sync.',
      'Persistent Drive connection.',
      'Refresh-token lifecycle.',
      'Auto retry/backoff.',
      'Auto reconnect.',
      'Remote cleanup or orphan cleanup.',
      'Overwrite/replace policy.',
      'Production credential deployment.',
      'Real credential config in source.',
      'Multi-account Google Drive UX.',
      'Shared Drive/team Drive behavior unless intentionally tested later.',
      'Queue drain.',
      'Download all.',
      'Recover all.',
    ]) {
      expect(text).toContain(required);
    }
  });
});
