# K-203 Real Google Drive Manual QA Checklist

## Purpose

Validate the existing explicit-only remote attachment upload/recovery MVP using a real Google Drive session.

This checklist is manual QA, not a feature expansion. It does not introduce persistent credentials, refresh token lifecycle, background sync, Upload all, Run queue, Recover all, or any production Google Drive credential wiring.

This checklist defines manual QA steps and should not be treated as executed until a result log exists. K-204 records the first execution attempt in `frontend/docs/K-204-real-google-drive-manual-qa-results.md`.

Before executing this checklist, complete `frontend/docs/K-205-real-google-drive-qa-environment-setup-checklist.md`.

## Preconditions

- Use a test Google account only.
- Use non-sensitive test images and attachments only.
- Do not use personal, private, regulated, or irreplaceable files.
- Confirm the app is running from the canonical repo: `C:\Users\이도현\GitRepos\Absinthe`.
- Confirm local-first mode remains the default.
- Confirm Google Drive connection is manually initiated by the tester.
- Confirm no access token, refresh token, ID token, auth code, code verifier, callback URL with code, Authorization header, or Bearer token appears in UI or logs.
- Confirm no token is persisted across reload. A memory-only active session may exist only inside the same running app runtime if the current implementation supports it.
- Do not commit real credentials, real client secrets, real test account details, or real file IDs.

## Environment Checklist

Use placeholders only. Do not paste real secrets into this file, screenshots, issue descriptions, PR comments, or committed test artifacts.

| Field | Value |
| --- | --- |
| App URL / dev URL | `<http://localhost:5173>` |
| App branch / commit | `<branch>` / `<commit>` |
| OAuth client configured externally | `<test OAuth client name>` |
| Redirect / callback URL | `<configured callback URL>` |
| Google test account | `<test account alias only>` |
| Test note name | `<test note>` |
| Test attachments | `<non-sensitive image/file names>` |
| Local browser profile | `<isolated browser profile>` |
| Expected Drive folder/location | `<test folder/location if applicable>` |

## Connection Scenario

Manual steps:

1. Open the app.
2. Open Notes.
3. Open the Attachment Storage Maintenance panel.
4. Confirm Google Drive is disconnected or inert by default.
5. Initiate manual Google Drive connection.
6. Complete Google authorization with the test account.
7. Confirm session-only connection status appears.
8. Confirm no upload or recovery starts automatically after connection.
9. Reload the app and verify expected session behavior: no silent restore if the session is memory-only, and no token persistence.
10. Disconnect or expire the session if supported, or simulate by reload/token removal.

Expected:

- Manual connection only.
- No app-boot upload.
- No diagnostics-refresh upload.
- No diagnostics-refresh recovery.
- No background sync.
- No automatic reconnect.
- No token exposed.

## Per-item Upload Scenario

Manual steps:

1. Create or select a note with a local image attachment.
2. Open diagnostics.
3. Confirm the item appears Ready only when `availability.canUpload` is true.
4. Click the explicit per-item upload control.
5. Confirm one upload starts.
6. Confirm no other item uploads.
7. Confirm success state and remote metadata.
8. Refresh diagnostics.
9. Confirm the uploaded item leaves Ready and appears Already Synced.
10. Confirm the local blob remains available.
11. Confirm no delete, cleanup, overwrite, or eviction occurs.

Expected:

- Explicit one item only.
- No Upload all.
- No Run queue.
- No Run all.
- No background sync.
- Result is sanitized.
- Metadata is marked synced only after verified upload success.

## Per-item Upload Failure / Manual-review Scenario

Manual scenarios where practical:

- Network offline before click.
- Session expired before click.
- Session expires during upload.
- `metadata_update_failed` simulation if possible.
- `invalid_response` or verification mismatch simulation if possible.
- `rate_limited` / network failure simulation if possible.
- Local blob missing simulation if possible.

Expected:

- Failure does not upload other items.
- Item enters Blocked or Manual Review according to reason.
- No auto retry.
- No Retry all.
- No retry queue.
- No remote delete.
- No local delete.
- No cleanup, overwrite, or eviction.
- Local blob is preserved if present.
- Raw Google error body, token, auth code, verifier, and callback URL are not shown.

## Per-item Recovery Scenario

Manual steps:

1. Prepare an attachment with remote metadata and a missing local blob, if safely possible.
2. Confirm recovery availability appears only when provider, session, and token gating are valid.
3. Click explicit per-item recovery.
4. Confirm one recovery starts.
5. Confirm the local blob is restored.
6. Confirm metadata/state updates only after verified recovery.
7. Confirm no other attachment recovers.

Expected:

- Explicit recovery only.
- No Recover all.
- No Download all.
- No auto recovery on render.
- No auto recovery on diagnostics refresh.
- No auto recovery on session connection.
- Sanitized result.

## Recovery Failure Scenario

Manual scenarios where practical:

- Missing remote file.
- Session expired.
- Provider unavailable.
- Network failure.
- Invalid blob response.

Expected:

- Safe failure label.
- No local destructive write.
- No auto retry.
- No recovery-all.
- No raw provider payload, access token, refresh token, ID token, auth code, verifier, Authorization header, or Bearer token exposed.

## Limited Selected Queue Run Scenario

Manual steps:

1. Prepare at least three visible Ready attachments.
2. Select up to three visible Ready items.
3. Confirm hidden Ready items are not selected.
4. Click Upload selected.
5. Confirm uploads run one at a time in display order.
6. Confirm there is no observed parallel or `Promise.all` style upload behavior.
7. Confirm first success continues.
8. Confirm first non-success stops.
9. Confirm not-started items remain Ready.
10. Refresh diagnostics and confirm bucket movement.

Expected:

- Max 3.
- Selected visible Ready only.
- No hidden item upload.
- No Upload all.
- No Run queue.
- No Run all.
- No Continue queue.
- No Run next.
- No Retry all.
- No queue drain.
- No background sync.

## Limited Selected Queue Failure Scenarios

Manual scenarios where practical:

- A success, B session expired, C not-started.
- A success, B network failure or rate limited, C not-started.
- A success, B `metadata_update_failed` / manual-review, C not-started.
- A success, B invalid response / verification mismatch, C not-started.
- A success, B null/no result if reproducible, C not-started.

Expected:

- Stops after the first item that does not complete successfully.
- Summary is clear.
- C remains not-started.
- No retry-all, retry queue, continue queue, or run next.
- No delete, cleanup, overwrite, or eviction.
- Sensitive details are sanitized.

## Diagnostics Refresh Behavior

Manual steps:

- Run refresh diagnostics before connection.
- Run refresh diagnostics after connection.
- Run refresh diagnostics after upload success.
- Run refresh diagnostics after upload failure.
- Run refresh diagnostics after recovery success.
- Run refresh diagnostics after recovery failure.
- Reload app and reopen diagnostics.

Expected:

- Diagnostics refresh never uploads.
- Diagnostics refresh never recovers.
- Diagnostics refresh recomputes buckets/statuses only.
- Queue review render does not upload.
- Recovery review render does not recover.
- No background sync starts.

## Security / Privacy Checklist

Verify:

- No access token rendered.
- No refresh token rendered.
- No ID token rendered.
- No auth code rendered.
- No code verifier rendered.
- No callback URL with code rendered.
- No Authorization or Bearer value rendered.
- No raw Google error body rendered.
- No resumable upload session URI is displayed, logged, copied, or persisted.
- No client secret in source/docs.
- No token in localStorage.
- No token in sessionStorage.
- No token in cookies.
- No token persisted in IndexedDB.
- No `console.log` of token/provider payload.
- No real credential committed.
- No default production Google Drive credential wiring.

## Non-destructive Checklist

Verify:

- No local blob deletion during upload/recovery.
- No remote file deletion.
- No orphan cleanup from upload/recovery.
- No overwrite or replace policy.
- No eviction execution.
- No metadata marked synced without verified upload success.
- Local blob remains available after upload success.
- Failed recovery does not write partial or unverified local blobs.

## Result Log Template

| Date | Tester | Browser/profile | Google test account | App branch/commit | Scenario | Result | Evidence | Notes | Follow-up issue/PR |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `<YYYY-MM-DD>` | `<name>` | `<browser/profile>` | `<test alias>` | `<branch @ commit>` | `<scenario>` | `<Pass / Fail / Blocked / Not run>` | `<screenshot/log link>` | `<notes>` | `<issue/PR>` |

## Exit Criteria

Manual QA can be considered complete only when:

- Connection scenario passes.
- Per-item upload success and failure/manual-review scenarios pass.
- Per-item recovery success and failure scenarios pass.
- Limited selected queue success and non-success stop scenarios pass.
- Diagnostics refresh safety passes.
- Security/privacy checklist passes.
- Non-destructive checklist passes.
- No Upload all, Run queue, Run all, Retry all, Continue queue, background sync, or persistent token behavior appears.
- All failures are documented with follow-up tasks.

## Out Of Scope

- Upload all.
- Full queue runner.
- Background sync.
- Persistent Drive connection.
- Refresh-token lifecycle.
- Auto retry/backoff.
- Auto reconnect.
- Remote cleanup or orphan cleanup.
- Overwrite/replace policy.
- Production credential deployment.
- Real credential config in source.
- Large-file/performance tuning beyond basic sanity.
- Multi-account Google Drive UX.
- Shared Drive/team Drive behavior unless intentionally tested later.
- Queue drain.
- Download all.
- Recover all.
