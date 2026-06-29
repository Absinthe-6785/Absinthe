# K-194 Manual Upload Queue Run Policy

## Purpose

Future manual upload queue execution is explicit user-triggered execution for selected Ready items only. It must remain local-first, non-destructive, and session-bound. It is not background sync, not an automatic queue drain, and not a replacement for the existing single-item `Upload this item` boundary.

The first implementation target is K-195: Explicit Limited Multi-Select Queue Execute Boundary.

## Non-goals

- No Upload all by default.
- No Run all, Run queue, Process queue, Continue queue, Run next, Retry all, or Sync now action.
- No automatic queue drain.
- No background sync.
- No upload on app boot, panel mount, note render, preview render, diagnostics refresh, queue review render, or session connection success.
- No automatic retry or automatic reconnect.
- No remote delete.
- No local delete.
- No orphan cleanup.
- No overwrite policy.
- No token persistence.
- No app boot session restore.
- No OAuth widening.
- No broadened upload eligibility or recovery behavior.

## Execution Candidate Policy

Eligible execution candidates must come from the strict K-189 Ready bucket only. A candidate is executable only when `availability.canUpload === true` at review time and again at execution time.

Excluded candidates:

- Manual-review items.
- Blocked items.
- Already-synced items.
- Hidden or not-rendered Ready items unless a future UI explicitly selects them.
- Deleted or tombstoned items.
- Provider mismatch items.
- Missing local blob items.
- Failed/manual-review items, including `metadata_update_failed`, `size_mismatch`, `checksum_mismatch`, `invalid_response`, remote conflict, and missing remote target states.
- Paused, offline, conflict, or otherwise blocked sync states.

## Selection Policy

The recommended K-195 shape is limited multi-select, not Upload all.

- User selects each item explicitly.
- Initial maximum selected count should be small: 1 to 3 visible Ready items.
- Hidden Ready items are not selected by default.
- Manual-review, blocked, already-synced, deleted/tombstoned, missing-local, and provider-mismatch items cannot be selected.
- The UI must show a visible selection summary before execution.
- Confirmation copy should say: "Upload selected items one at a time."
- There is no implicit "all Ready" execution.

## Execution Order

Execution must be sequential only.

- No parallel upload.
- One in-flight upload at a time.
- Reuse the existing `runUpload(attachmentId)` path.
- Do not call `GoogleDriveBlobAdapter` directly from a queue runner.
- Do not call `uploadAttachmentBlobToRemote` directly from a queue runner.
- Recompute or revalidate availability before each item.
- Ensure the item is still Ready before each item starts.
- Stop on first failure for the first implementation.

## Failure Policy

The first implementation must stop on first failure.

- Do not continue to the next selected item after a failure.
- Do not auto retry.
- Do not queue retry.
- Do not add Retry all.
- Do not run queue drain.
- Do not call recovery.
- Do not call sync.
- Do not call eviction.
- Do not remote delete.
- Do not local delete.
- Do not orphan cleanup.
- Do not overwrite.
- Preserve the local blob.

Failure display and diagnostics must reuse existing K-184/K-186/K-187 behavior:

- `metadata_update_failed` moves to manual review.
- Verification mismatch, including `size_mismatch` and `checksum_mismatch`, moves to manual review.
- `invalid_response` and invalid remote/upload responses move to manual review.
- Remote object ambiguity remains visible in safe copy.
- Raw provider payloads and secrets are sanitized.

## Partial Success Policy

Partial success is allowed but never rolled back.

- Previous successful items remain successful.
- The failed item stops the run.
- Not-started items remain not started and Ready until diagnostics recompute says otherwise.
- No rollback.
- No delete.
- No overwrite.
- No cleanup.
- No automatic continuation after panel close.

The run summary must distinguish:

- Succeeded.
- Failed.
- Skipped or not started.

Diagnostics refresh is required after run completion, or the user can explicitly refresh diagnostics to recompute buckets.

## Rate Limit / 429 Policy

Treat 429 and rate-limit responses as failures for the first implementation.

- Stop on first failure.
- Show the existing safe rate-limit label.
- Do not schedule an automatic retry.
- Do not start a timer.
- Do not silently continue.
- The user may refresh and retry manually later through a future explicit path.

## Cancellation Policy

Cancellation can be deferred until multi-item execution exists.

If cancellation is added later:

- Cancellation means stop before the next item.
- Do not abort an already in-flight upload unless the adapter supports safe abort semantics.
- Do not rollback.
- Do not remote delete.
- Do not local delete.
- Do not cleanup.

## Progress UI Policy

Progress must be visible and bounded.

- Show selected count.
- Show current item.
- Show succeeded, failed, and not-started counts.
- Show a final summary.
- No hidden background progress.
- No silent continuation after panel close unless explicitly designed later.
- No Upload all, Run all, Run queue, Process queue, Continue queue, Run next, Retry all, Sync now, Recover all, or Download all controls.

## Refresh Policy

Queue review rendering is read-only.

- Queue review render must not upload.
- Diagnostics refresh must not upload.
- Diagnostics refresh must not auto-run remaining items.
- Session connection success must not upload.
- Stale Ready state must be revalidated before each item.
- Diagnostics refresh after run completion, or explicit user refresh, recomputes Ready, Manual Review, Blocked, and Already Synced buckets.

## Security Policy

The queue run policy inherits the Google Drive session boundary.

- Memory-only token provider only.
- No access token persistence.
- No refresh token persistence.
- No localStorage, sessionStorage, IndexedDB, or cookie token storage.
- No silent refresh.
- No app boot restore.
- No OAuth widening.
- Do not render token, authorization code, code verifier, callback URL, Authorization header, Bearer token, raw provider body, raw HTML, raw JSON secrets, data URL payloads, sensitive local file path, or full remote id unless already intentionally safe.
- No token endpoint call in a runtime queue runner.

## K-195 Audit Guard Checklist

K-195 must prove:

- Ready bucket only.
- `availability.canUpload === true` at review time.
- Click-time revalidation before each item.
- Selected items only.
- Maximum selected count enforced, initially 1 to 3.
- Hidden items not selected by default.
- Sequential only.
- One in-flight upload at a time.
- Reuse `runUpload(attachmentId)`.
- No direct adapter call from a queue runner.
- No direct `uploadAttachmentBlobToRemote` call from a queue runner.
- Stop on first failure.
- No auto retry.
- No Retry all.
- No queue drain.
- No background sync.
- No Upload all.
- No Run all.
- No Run queue by default.
- No Sync now.
- No Process queue.
- No Continue queue.
- No Run next.
- No remote delete.
- No local delete.
- No orphan cleanup.
- No overwrite.
- Preserve local blob.
- Partial success summary includes succeeded, failed, and skipped/not-started.
- 429 stops the run and does not schedule automatic retry.
- Cancellation, if present, stops before next item only.
- Diagnostics refresh/recompute after completion does not auto-run.
- Memory-only token provider.
- No token persistence.
- No raw token/code/verifier/callback/provider payload rendering.
- No OAuth widening.

