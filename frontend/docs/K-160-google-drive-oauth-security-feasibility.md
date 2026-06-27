# K-160 Google Drive OAuth + Security Feasibility Spike

## Objective

Prepare the security contract for a future Google Drive remote blob provider without implementing OAuth, Drive calls, token storage, uploads, downloads, cleanup, eviction, sync queues, or UI.

K-160 keeps Absinthe local-first. Notes and attachments continue to work locally when remote auth is unavailable, revoked, disabled, or not configured.

## Non-goals

- No OAuth callback route.
- No authorization code exchange.
- No refresh token rotation implementation.
- No Google client ID or client secret in source.
- No Google OAuth or Drive API runtime calls.
- No upload, download, resumable upload, file creation, or remote delete.
- No sync queue.
- No remote cleanup, local blob eviction, or backup deletion.
- No Google Drive UI.
- No default sync mode change.
- No Health, Schedule, Recipe, schema, store, provider, persistence, or hydration changes.

## Google Drive Storage Target

Decision: use Google Drive `appDataFolder` by default for attachment backup/sync.

Reasoning:

- It is app-private storage for application-specific data.
- Users do not manage the files directly in Drive UI.
- It avoids broad Drive visibility and keeps Absinthe attachment blobs out of the user's normal file space.
- It maps well to local-first private attachment backup rather than document sharing.

Tradeoffs:

- Users cannot browse or share these files directly.
- Files are tied to the app's Drive application data area.
- Restore UX must be owned by Absinthe because the Drive UI is not the recovery surface.
- If the user deletes the app data folder or revokes access, remote backup is unavailable but local Notes must continue.

Reference:

- Google Drive app data folder: https://developers.google.com/workspace/drive/api/guides/appdata

## Scope Decision

Default future scope: `https://www.googleapis.com/auth/drive.appdata`.

This is the minimum useful Drive scope for app-private attachment backup/sync. Do not request broad Drive scopes such as `drive`, `drive.readonly`, or `drive.metadata` for the default attachment provider.

K-161 must verify granted scopes after OAuth completes. If `drive.appdata` is missing, the provider should enter `reconnect_required` or `disabled_by_user` rather than attempting partial remote writes.

Reference:

- Google Drive API scopes: https://developers.google.com/workspace/drive/api/guides/api-specific-auth

## OAuth Flow Decision

Future implementation should use Authorization Code + PKCE.

Desktop:

- Use the system browser for consent.
- Use a loopback redirect or platform-approved redirect mechanism.
- Store refresh tokens only in OS credential storage.
- Do not embed or persist a client secret in the desktop bundle.

Web:

- Avoid long-lived refresh token persistence where possible.
- Prefer short-lived access token/session patterns if a web-hosted mode is introduced.
- If persistence is required, prefer IndexedDB protected by a WebCrypto wrapper, while explicitly recognizing that WebCrypto does not protect against active XSS in the running origin.

## Token Endpoint Decision

Use `https://oauth2.googleapis.com/token`.

Do not use the older `/oauth2/v4/token` form.

Refresh and authorization code exchanges should use the same token endpoint when K-161 or a later auth milestone implements them.

Reference:

- Google OAuth web server flow: https://developers.google.com/identity/protocols/oauth2/web-server
- Google OAuth desktop/native flow: https://developers.google.com/identity/protocols/oauth2/native-app

## Token Storage Decision

Refresh tokens are high-value secrets.

Required policy:

- Never store refresh tokens in plaintext `localStorage`.
- Never log access tokens, refresh tokens, ID tokens, auth codes, DPoP proofs, Authorization headers, Set-Cookie headers, or token responses.
- Never persist raw token endpoint response bodies as diagnostics.
- Never include tokens in `remoteError`.

Desktop storage:

- Windows: Windows Credential Manager.
- macOS: Keychain.
- Linux: Secret Service or a compatible keyring.

Web storage:

- Avoid long-lived refresh token storage when possible.
- If persistent storage is required, use IndexedDB with a WebCrypto wrapper and document the XSS limitation.
- Do not use localStorage for refresh tokens.

## Security Model: Web vs Desktop

Desktop is the preferred initial target for Google Drive attachment sync because Absinthe is desktop-first and OS credential stores are available.

Web has higher token exposure risk:

- Browser JavaScript cannot fully protect secrets from active XSS.
- Query strings, console logs, network logs, and persisted diagnostics can leak tokens or session URIs.
- Browser storage protections help against passive disk inspection, not active compromised script execution.

K-161 should treat desktop as the safer prototype path. A web flow should remain explicitly gated until token persistence, CSP, redirect URI, and XSS hardening are reviewed.

## Connection States

Future provider/auth state should distinguish:

- `disconnected`: no provider connected.
- `connecting`: user has started connection or auth is in progress.
- `connected`: provider can make authenticated Drive requests.
- `refresh_failed`: stored refresh token failed and retry/reconnect is needed.
- `revoked`: Google or the user revoked access.
- `reconnect_required`: scopes/token/provider state cannot satisfy remote sync.
- `disabled_by_user`: user intentionally turned remote backup/sync off.

Failure rules:

- Local Notes and attachments remain usable.
- Local image rendering remains unchanged.
- Pending uploads pause or fail safely.
- No destructive cleanup runs because of auth failure.
- Remote failure must not delete local blobs or note metadata.

## Refresh, Revoke, and Reconnect Flow

Refresh:

- Refresh access tokens only through the token endpoint.
- Rotate stored credentials only after a successful response is validated.
- If refresh fails, set remote state to `refresh_failed` or `reconnect_required`.
- Do not clear local attachment metadata or blobs.

Revoke:

- Revoke should be explicit and user-initiated.
- A successful revoke transitions to `revoked` or `disconnected`.
- Revocation removes remote access only; it must not delete local Notes, local blobs, or backup metadata.

Reconnect:

- Reconnect starts a fresh Authorization Code + PKCE flow.
- Reconnect must verify `drive.appdata` was granted.
- Reconnect resumes remote work through the future sync queue.

## `syncStatus` vs `remoteSyncStatus`

`syncStatus` remains local attachment lifecycle ownership:

- local availability
- metadata/migration state
- local cleanup review
- restore availability
- local blob presence

`remoteSyncStatus` owns provider state:

- pending upload/download
- uploading/downloading
- synced
- remote failed
- remote unavailable
- remote backup/recovery status
- Drive provider errors

Do not collapse these fields. Local attachment safety and remote backup state must remain independently understandable.

## `remoteError` Sanitization Policy

`remoteError` must be human-readable and safe to persist.

It must never contain:

- access tokens
- refresh tokens
- ID tokens
- auth codes
- client secrets
- DPoP proofs
- Authorization headers
- Set-Cookie headers
- raw token endpoint responses
- raw Drive response bodies
- raw request/response headers
- resumable upload session URIs
- signed URLs
- full Drive internal URLs carrying secrets
- file bytes
- base64 blobs
- data URLs

K-160 adds a small provider-boundary sanitizer helper to formalize this rule. Future K-161/K-162 code should pass remote provider diagnostics through that helper, or through a stricter equivalent, before persisting or rendering them.

## K-161 Handoff: GoogleDriveBlobAdapter Prototype

K-161 may prototype a concrete Google Drive provider after this security boundary is accepted.

Required handoff rules:

- Use `appDataFolder`.
- Use `uploadType=resumable` for attachment blobs.
- Treat the resumable session URI as sensitive.
- Never log, persist in user-visible diagnostics, or expose the session URI.
- Track chunk progress and remote offset without leaking the session URI.
- Verify size and checksum before marking remote upload as synced.
- Never delete a local blob before verified remote upload.
- Report provider state through `remoteSyncStatus`, not `syncStatus`.
- Keep local mode fully remote-silent.

Reference:

- Google Drive resumable uploads: https://developers.google.com/workspace/drive/api/guides/manage-uploads

## K-162 Handoff: Sync Queue Orchestration

K-162 should own orchestration, not the blob adapter.

Required queue behavior:

- Local editing is never blocked by remote provider availability.
- Pending work retries safely.
- Remote failures remain non-destructive.
- Local-first Notes behavior remains the default.
- Empty remote responses must not clear local attachments or Notes.
- Upload/download state should be resumable and inspectable.

## Cleanup and Eviction Implications

Future cleanup/eviction must consider both local and remote state.

Do not evict a local blob unless all are true:

- attachment metadata is still referenced or explicitly eligible for cleanup
- remote provider is connected
- `remoteSyncStatus` is synced
- `remoteFileId` or equivalent remote identity exists
- remote checksum is verified
- remote size is verified
- local checksum/size matches verified remote values
- no upload/download is pending, failed, or in progress
- no migration, restore, or backup inspection block exists
- user did not mark the blob as keep-offline

Auth failure must never trigger cleanup.

## Security Audit Expectations

K-160 should remain implementation-free for Google runtime behavior.

Expected checks:

- No Google OAuth token exchange call in runtime code.
- No Drive upload/download call in runtime code.
- No refresh/access token persistence.
- No client secret in source.
- No resumable session URI persistence.
- No remote delete.
- Sanitizer tests cover token/session URI/blob redaction.

## Open Risks and Questions

- Whether the first Google Drive prototype should be desktop-only until OS keychain integration is complete.
- Whether DPoP is worth adopting for desktop refresh tokens in the first provider implementation.
- Whether appDataFolder quotas and user-facing recovery expectations are acceptable for large local vaults.
- Whether restore should support remote manifest-first recovery before individual blob downloads.
- How to expose remote backup confidence without turning Notes into a sync dashboard.
