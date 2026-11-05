# Connection-only Google Drive runtime

This integration exposes manual authorization and disconnect only. It does not
activate Notes backup, legacy upload queues, recovery, Cloud Copy, or sync.
The account owner is replaced synchronously on actual authenticated app-shell
session replacement, including same-account token replacement. Duplicate
notifications of the same account and unchanged session token (for example tab
refocus) preserve pending PKCE. The comparison is memory-only and does not log
or persist authentication tokens. Tokens and PKCE state remain
in memory; reload/logout/replacement requires explicit reconnection.

## Public build configuration

All three settings are required:

- `VITE_GOOGLE_DRIVE_OAUTH_CLIENT_ID`: approved public PKCE client ID.
- `VITE_GOOGLE_DRIVE_OAUTH_REDIRECT_URI`: same-origin
  `/oauth/google-drive/callback.html` (HTTPS, or HTTP loopback for local QA).
- `VITE_GOOGLE_DRIVE_OAUTH_ALLOWED_REDIRECT_URIS`: JSON array containing the exact URI.

Missing/invalid configuration fails closed. No client secret belongs in this
configuration. An OAuth client requiring a client secret is unsupported by this
frontend-only flow. No backend proxy or scope expansion is authorized.

The static callback page deliberately does not boot the application or Supabase
Auth. Keep the original app tab open, manually authorize in another tab, and
paste the full callback URL back into the original tab. Do not share or log that
URL. The only requested scope is `drive.appdata`, online access, without merging
previously granted scopes.

## QA/release gate

Mocked tests do not prove Google consent, public-client eligibility, browser CORS,
deployed callback routing, or live token exchange. Use an approved disposable
Google account and OAuth test client, approved origin/redirect, and enabled Drive
API for live QA. No production original may be uploaded as a fixture.

The runtime exposes no access-token provider and advertises upload/download/
recovery as disabled, even when connected. Do not inject it into the legacy
attachment panel to activate writers. A separately reviewed single-original
action and explicit QA-write authorization are required before any upload.
SHA-256 readback proves only point-in-time byte identity, not retention or restore.
