# K-205 Real Google Drive QA Environment Setup Checklist

## Purpose

Prepare a safe external environment for retrying real Google Drive manual QA.

K-204 was blocked/not-run because a disposable Google test account, external OAuth test client, authorized callback configuration, and real session setup were not available. K-205 does not execute real QA, does not add credentials, and does not change runtime behavior.

K-206 should retry the K-203 checklist only after this setup checklist is complete.

## Required External Prerequisites

- Isolated disposable Google test account.
- External Google Cloud OAuth test project/client.
- Authorized JavaScript origin for local development.
- Authorized redirect/callback URL for local development.
- Google Drive API enabled only for the test project.
- Test-only OAuth consent configuration.
- Test user allowlist if the Google OAuth app is in testing mode.
- Non-sensitive test image/attachment files.
- Clean browser profile.
- Local app running from the canonical repo: `C:\Users\이도현\GitRepos\Absinthe`.
- Local-only environment values stored outside git.

## Credential Handling Rules

- Do not commit OAuth client ID if project policy forbids it.
- Never commit `client_secret`.
- Never commit access token.
- Never commit refresh token.
- Never commit ID token.
- Never commit auth code.
- Never commit callback URL containing code/state.
- Never commit resumable upload session URI.
- Never commit raw Google error bodies if they contain identifiers/tokens.
- Never paste secrets into result docs.
- Use placeholders or redacted aliases only.
- Keep local credential values in shell/session-local configuration outside git.
- Confirm no `.env`, local credential file, screenshot, HAR export, browser profile artifact, or copied callback URL is staged.

## Local Environment Placeholders

Use placeholder names only. Do not commit actual values.

```text
GOOGLE_DRIVE_TEST_CLIENT_ID=<redacted test client id>
GOOGLE_DRIVE_TEST_REDIRECT_URI=http://localhost:<port>/<callback-path>
GOOGLE_DRIVE_TEST_ACCOUNT_ALIAS=<redacted disposable account>
GOOGLE_DRIVE_TEST_NOTE_NAME=<redacted test note>
GOOGLE_DRIVE_TEST_FILE_SET=<non-sensitive image attachments>
```

These placeholders describe the QA setup. They do not add production wiring, default OAuth values, app settings, or persistent credentials.

## OAuth Setup Checklist

1. Create or select an external test Google Cloud project.
2. Enable Google Drive API for the test project only.
3. Configure the OAuth consent screen for testing.
4. Add the disposable Google test account as a test user if needed.
5. Create an OAuth client suitable for local testing.
6. Add the authorized JavaScript origin for the local app.
7. Add the authorized redirect URI / callback URL for the local app.
8. Keep OAuth credentials outside the repository.
9. Confirm no production OAuth client is used.
10. Confirm the disposable test account contains no private data.
11. Confirm the consent screen does not expose production branding or production user data.

## Browser / Profile Setup

- Use a clean browser profile.
- Sign in only to the disposable Google test account.
- Clear previous localhost storage if needed.
- Clear localStorage/sessionStorage/cookies before QA when testing memory-only behavior.
- Do not install extensions that log traffic.
- Optionally use an incognito/private window if compatible with the local auth flow.
- Do not export browser HAR files unless they are sanitized and intentionally safe.

## Test Data Setup

- Create a redacted test note.
- Add one small non-sensitive image attachment for per-item upload.
- Add at least three small non-sensitive test images for limited selected queue run.
- Optionally create an attachment with missing local blob for recovery testing only if this can be done safely with existing product controls or fixtures.
- Optionally create a remote-only file fixture if safe.
- Avoid personal photos, private documents, regulated data, screenshots containing secrets, or irreplaceable files.
- Avoid large files until basic QA passes.

## Network / Failure Simulation Setup

Use safe external controls. Do not add runtime test hooks in this milestone.

- Network offline: use browser devtools or OS network toggle.
- Session expiry: reload/close browser, disconnect, or clear memory/session state if implementation is memory-only.
- Token unavailable: disconnect/reload if the implementation is memory-only.
- Missing local blob: use existing test controls only if safe; otherwise mark Not run.
- `metadata_update_failed`: simulate only if a safe existing test hook exists; otherwise mark Not run.
- Rate limit: usually Not run unless a safe simulation exists.
- Checksum mismatch / invalid response: usually Not run unless a safe fixture exists.
- Missing remote file: use only disposable remote files and redacted metadata if safe.

## Preflight Repo Hygiene

Run from `C:\Users\이도현\GitRepos\Absinthe`:

```powershell
git status
git diff --name-status origin/main...HEAD
git diff --check
rg -n "client_secret|refresh_token|access_token|id_token|Authorization|Bearer|oauth2.googleapis.com/token|code=|upload[_-]?id=|resumable|upload session" frontend/src frontend/docs
```

Confirm:

- No `.env` or local credential file is tracked.
- No screenshots with secrets are staged.
- No token, auth code, callback URL with code, resumable upload session URI, client secret, real credential, personal file name, or real account identifier appears in git diff.
- Changed files are docs/test-only unless an emergency is explicitly documented.

## Preflight App Safety

Before real Google Drive QA:

- App boots in local-first mode.
- Notes opens.
- Attachment Storage Maintenance panel opens.
- Manual Google Drive connection is inert/disconnected by default.
- No upload/recovery starts on app boot.
- No upload/recovery starts on diagnostics refresh.
- Queue review render does not upload.
- Recovery review render does not recover.
- No Upload all / Run queue / Run all control exists.
- No Retry all / Retry queue / Start queue control exists.
- No Continue queue / Run next / Sync now control exists.
- No Recover all / Download all control exists.
- No cleanup, delete, overwrite, or eviction behavior is triggered by upload/recovery UI.

## K-206 Retry Readiness Checklist

K-206 can begin only when:

- Disposable Google test account exists.
- External OAuth test client exists.
- Authorized JavaScript origin is configured.
- Authorized redirect/callback URL is configured.
- Drive API is enabled for the test project.
- OAuth consent test user allowlist includes the disposable account if needed.
- Local env placeholders are filled outside repo.
- Clean browser profile is ready.
- Test files are non-sensitive.
- Redaction rules are understood.
- K-203 checklist is available.
- K-204 blocked/not-run scenarios are identified for retry.
- No secrets are staged.
- K-205 setup checklist is complete.

## Cleanup After QA

After K-206 or any real Google Drive retry:

- Revoke test app access from the disposable Google account if needed.
- Delete test files from Drive manually if safe.
- Clear local browser profile/storage if needed.
- Remove local env values from shell/session.
- Do not commit local env files.
- Do not commit screenshots unless sanitized.
- Record cleanup status in the K-206/K-204 result document.
- Confirm no local or remote personal data was used.

## Out Of Scope

- Production OAuth deployment.
- Persistent Google Drive connection.
- Refresh-token lifecycle.
- Background sync.
- Upload all / Run queue.
- Auto retry/backoff.
- Auto reconnect.
- Remote cleanup or orphan cleanup.
- Overwrite/replace policy.
- Large-file/performance QA beyond basic smoke.
- Multi-account Google UX.
- Shared Drive/team Drive.
- Queue drain.
- Download all.
- Recover all.
