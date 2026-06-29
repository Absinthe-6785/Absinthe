# K-199 Upload Queue Run Final Boundary Audit

## Purpose

K-199 closes the limited manual upload queue run phase. It verifies that K-194 policy and K-195 through K-198 implementation/tests describe the same boundary: a small, explicit, non-destructive manual run for selected visible Ready attachments only.

This milestone does not add runtime upload behavior.

## Current Implemented Boundary

- Selection is visible Ready-only.
- The maximum selected count is 3 visible Ready items.
- Execution starts only from the explicit `Upload selected` action.
- Items execute in visible display order.
- Execution is sequential only.
- There is no `Promise.all` or parallel upload path in the limited queue runner.
- The limited queue runner reuses the existing `runUpload(attachmentId)` path.
- `uploaded` is the only success state.
- `failed`, `blocked`, `skipped`, `null`, and unknown non-success results all stop the run.
- The run stops on the first item that does not complete successfully.
- Selection clears after the run.
- Hidden Ready items and unselected Ready items are not executed.
- Diagnostics refresh is required to recompute Ready, Manual Review, Blocked, and Already Synced buckets after a run.
- There is no `Upload all`, `Run queue`, `Run all`, `Retry all`, `Sync now`, `Continue queue`, or `Run next` action.

## K-194 Policy Alignment

- Ready-only candidates are enforced by the review bucket and by click-time revalidation.
- Execution remains explicit limited selection, not queue drain.
- Uploads run one by one through the existing single-item upload boundary.
- Stop-on-first-non-success behavior matches the K-194 first implementation policy.
- Partial success is non-destructive: successful items are not rolled back and not-started items are not auto-run.
- The limited queue runner does not persist tokens.
- The limited queue runner does not start background sync.
- The limited queue runner does not bypass the existing upload path with direct adapter calls.
- Diagnostics refresh and queue review rendering remain read-only until explicit user action.

## Intentional Limitations

- No `Upload all`.
- No full queue runner.
- No automatic queue drain.
- No automatic retry.
- No `Retry all`.
- No `Continue queue`.
- No `Run next`.
- No cancellation UI.
- No rate-limit timer or backoff scheduler.
- No background sync.
- No automatic diagnostics refresh after every upload beyond existing explicit refresh behavior.
- Selection remains limited to 3 visible Ready items.
- Hidden Ready items require the existing per-item `Upload` action or a future explicit selection design.

## Safety Invariants

- No direct `GoogleDriveBlobAdapter` construction from the limited queue runner.
- No direct `uploadAttachmentBlobToRemote` call from the limited queue runner.
- No metadata writes outside the existing upload path.
- No remote delete.
- No local delete.
- No cleanup executor.
- No overwrite policy.
- No local blob eviction executor.
- No token persistence.
- No refresh token lifecycle.
- No silent session restore.
- No token endpoint call in the limited queue runner.
- No OAuth widening.

## Test Coverage Closure

- K-195 covers explicit limited selected execution, display order, hidden-item exclusion, and sequential upload.
- K-196 covers uploaded-only success, stop-on-first-non-success, selection clearing, stale revalidation, and in-flight guards.
- K-197 covers non-success wording so blocked, skipped, null, failed, and unknown results are not described as failure-only.
- K-198 covers real scenarios: metadata update failure, session expiration, rate limit, invalid response, checksum mismatch, null result, diagnostics recompute, and hidden Ready item exclusion.
- K-199 adds final source/doc boundary assertions so this phase remains aligned with K-194 policy.

## Exit Criteria

The limited queue run phase is MVP-complete when the above constraints remain true and the K-195 through K-199 tests pass. Remaining work should be treated as future product design or polish, not as a blocker for this phase.
