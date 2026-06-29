# K-201 Remote Attachment Upload/Recovery MVP Completion Audit

## Purpose

K-201 closes the remote attachment upload/recovery MVP phase as an audit milestone. It documents what is supported today, which safety boundaries remain intentional, and what is out of scope for this phase.

This milestone does not add runtime upload, recovery, sync, cleanup, eviction, OAuth, or token behavior.

## MVP Status

The current remote attachment MVP supports:

- local-first attachment metadata and local blob safety.
- explicit manual Google Drive session boundary.
- memory-only access token provider.
- explicit per-item remote recovery.
- explicit per-item Google Drive upload.
- upload failure labels and manual-review diagnostics.
- manual upload queue review.
- strict Ready classification.
- Ready requires `availability.canUpload`.
- explicit per-item queue shortcut.
- limited selected max-3 queue execution.
- selected queue execution is visible Ready-only.
- sequential display-order queue execution.
- `runUpload(attachmentId)` reuse.
- uploaded-only success.
- stop on first non-success.
- post-upload diagnostics/recompute QA.
- real-scenario queue-run QA.
- final upload queue run boundary audit.

## Safety Boundaries Preserved

- No remote-first attachment source of truth.
- No upload on app boot.
- No upload on render.
- No upload on diagnostics refresh.
- No upload on session connection.
- No recovery on render.
- No recovery on diagnostics refresh.
- No recovery on session connection.
- No background sync.
- No queue drain.
- No `Upload all`.
- No `Run queue`.
- No `Run all`.
- No `Retry all`.
- No `Retry queue`.
- No `Start queue`.
- No `Sync now`.
- No `Continue queue`.
- No `Run next`.
- No automatic retry.
- No automatic reconnect.
- No refresh-token persistence.
- No silent session restore.
- No remote delete.
- No local delete.
- No cleanup, overwrite, or eviction execution from upload/recovery flows.
- Local blob is preserved unless a separate explicit cleanup/eviction policy says otherwise.
- Metadata is marked synced only through the verified upload success path.

## Recovery MVP Status

- Recovery is explicit per-item only.
- No `Recover all`.
- No automatic recovery on render, diagnostics refresh, or session connection.
- Provider, session, and token gating are required.
- Stale click-time revalidation is required.
- Local blob write and metadata status update happen only after successful verified recovery.
- Failure states remain safe and sanitized.

## Upload MVP Status

- Per-item upload is explicit.
- Limited selected queue run is explicit and max 3.
- Ready requires `availability.canUpload`.
- Selected queue execution is visible Ready-only.
- Execution is sequential display order.
- `runUpload(attachmentId)` is reused.
- `report.status !== 'uploaded'` stops the run.
- Failed, blocked, skipped, null, and unknown results stop.
- No `Promise.all`.
- No direct adapter bypass.
- No delete, cleanup, overwrite, or eviction behavior.

## Google Drive/OAuth Status

- OAuth is manual/session-only.
- Authorization URL, callback validation, token exchange, and ephemeral token provider exist.
- Access token is memory-only.
- Refresh token is ignored/dropped.
- No token persistence.
- No silent refresh.
- No app boot restore.
- No production default Google Drive credentials.
- Manual connection UI remains controlled and inert unless configured.
- No browser redirect automation.
- No popup automation.

## Diagnostics And Manual Review Status

- Diagnostics panel shows queue review, recovery availability, upload statuses, and manual-review reasons.
- Manual-review diagnostics distinguish `metadata_update_failed`, verification mismatch, invalid response, and remote conflict where supported.
- Result and error details are sanitized.
- No raw provider body, token, verifier, callback URL, Authorization header, Bearer token, or secret payload is exposed by intended UI copy.

## Known Limitations And Out Of Scope

- No `Upload all`.
- No full queue runner.
- No background attachment sync.
- No automatic retry or backoff timer.
- No persistent Google Drive connection.
- No refresh token lifecycle.
- No automatic diagnostics refresh after every operation beyond existing behavior.
- No remote orphan cleanup.
- No remote overwrite or replace policy.
- No cancellation UI for selected queue run.
- Real Google Drive manual QA still needed.
- Post-upload diagnostics refresh UX remains future polish.
- Manual-review user guidance remains future polish.

## Recommended Next Steps

- K-202 Real Google Drive Manual QA Checklist.
- K-203 Post-upload Diagnostics Refresh UX Polish.
- K-204 Manual Review User Guidance Polish.
- K-205 Remote Attachment Sync Roadmap Re-evaluation.

## Completion Statement

The remote attachment upload/recovery MVP is closed at the current explicit, local-first, manual-session boundary when K-162 through K-201 tests pass. Future work should start from deliberate product design rather than widening this MVP by accident.
