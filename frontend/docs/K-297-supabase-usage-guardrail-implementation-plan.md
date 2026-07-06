# K-297 Supabase Usage Guardrail Implementation Plan

## Purpose

K-297 plans Supabase usage and quota guardrails after the K-296 source facts audit. K-297 is docs/plan plus audit test only.

K-297 does not implement traffic control. K-297 does not change runtime request behavior. K-297 does not change authFetch behavior, SWR behavior, fetcher behavior, analytics refreshInterval behavior, retry/backoff behavior, Supabase client/config/env, database/RLS/migrations, Notes runtime, sync/persistence, backup/export/import/restore, provider/attachment behavior, Signal Panel, Health/Schedule, assets/fonts/dependencies, scripts, or generated artifacts.

K-297 chooses the next path: K-298 Supabase Usage Guardrail Minimal Implementation Plan.

## K-296 Source Facts Recap

K-296 established these source facts:

- No direct runtime `supabase.from(...)` calls were found in `frontend/src`.
- No direct runtime `supabase.storage` or `storage.from(...)` calls were found in `frontend/src`.
- No direct runtime `supabase.channel(...)` calls were found in `frontend/src`.
- Product data traffic is primarily backend-route based through `authFetch(...)`.
- `authFetch(...)` in `frontend/src/lib/supabase.ts` performs a Supabase session lookup before each allowed remote request.
- `frontend/src/hooks/useDaily.ts` uses `remoteSWRKey(...)` and `revalidateOnFocus: false`.
- `frontend/src/hooks/useStatic.ts` uses `remoteSWRKey(...)` and `revalidateOnFocus: false`.
- `frontend/src/lib/fetcher.ts` has bounded retries with `MAX_RETRIES = 3`, retry statuses `502`, `503`, and `504`, and exponential backoff from `BASE_DELAY_MS = 600`.
- `frontend/src/components/views/LegacyAnalyticsView.tsx` has a source-present `refreshInterval: 60000`.
- Google Drive attachment traffic is provider-side traffic and not Supabase Storage traffic.

Current missing controls:

- No explicit request budget policy.
- No global request counter.
- No global circuit breaker.
- No quota-risk graceful degradation policy.
- No backend route fanout visibility map.
- No current usage monitoring, alerting, or runbook closure.

## Guardrail Principles

- Preserve auth restoration from K-289 through K-295.
- Preserve local-first data ownership after authenticated entry.
- Keep Supabase as auth/support/sync infrastructure, not the runtime source of truth for local workspace state.
- Avoid remote-first note hydration.
- Avoid broad sync rewrites.
- Avoid Cloudflare/Firebase migration before code-level Supabase traffic risks are understood.
- First guardrails should be observable, targeted, reversible, and easy to test.
- Production should fail gracefully, not enter request loops.
- User data must not be lost or overwritten by quota handling.
- Do not reintroduce production bypass, syncMode auth bypass, or localAuth production auth.
- Do not add secrets, credentials, service-role keys, or env changes.
- Do not add direct frontend Supabase table, storage, or realtime usage.

## Request Budget Policy Plan

These are proposed policy budgets, not measured product facts.

| Budget area | Source area | Proposed maximum or frequency | Reason | Enforceable now | K-298 candidate |
| --- | --- | --- | --- | --- | --- |
| App mount budget | `App.tsx`, `AppContent.tsx`, `useDaily.ts`, `useStatic.ts`, workspace SWR hooks | One auth session resolution plus only necessary first-screen remote keys for the active workspace | Prevent authenticated entry from fanning out into unrelated backend routes | Partly, by classifying automatic route sources before enforcement | Yes, plan classifier first |
| Unauthenticated budget | `App.tsx`, `LoginScreen.tsx` | Auth session check and auth-state subscription only; no product data routes before protected shell | Preserve K-289 auth gate and prevent no-login product traffic | Mostly already enforced by protected shell and remote boundary | Audit only unless regression appears |
| Authenticated idle budget | SWR hooks and legacy analytics | No high-frequency automatic backend polling while the user is idle; focus revalidation remains disabled where currently disabled | Avoid background quota pressure from passive workspace state | Partly, but needs a route/source map | Yes, plan route classification |
| User-triggered action budget | `useApiMutation.ts`, note writes, Health/Recipe/Settings actions | User actions may issue necessary route calls, but each action should have bounded retries and visible failure state | User intent should still work while avoiding loops | Partly through existing fetcher and explicit handlers | Later, after classifier |
| Analytics polling budget | `LegacyAnalyticsView.tsx` | Treat `refreshInterval: 60000` as a watched risk; decide whether to pause on hidden tab or failure before changing it | Polling is concrete source-present automatic traffic | Not in K-297 | Yes, likely K-298 plan item |
| Retry budget | `fetcher.ts` | Preserve maximum 3 attempts for network/502/503/504; do not retry quota-like failures aggressively | Bound failure amplification | Existing retry is bounded; rate-limit behavior is not classified | Yes, plan classification tests |
| Provider/attachment budget | Google Drive provider and queue files | Keep explicit/manual transfer posture; no automatic retry loops or Supabase Storage usage | Provider traffic is separate from Supabase quota but still remote pressure | Mostly through existing explicit actions | Later, provider-specific guardrail |

## authFetch / Session Cost Strategy

`authFetch(...)` should remain the centralized backend-route boundary. K-297 does not change `authFetch(...)`.

Planned strategy:

- Keep product data calls backend-route based.
- Avoid adding direct frontend Supabase table/storage/realtime calls.
- Keep session lookup centralized and out of render loops.
- Distinguish Supabase auth/session calls from product backend route calls in future measurement.
- Treat `getSession()` cost as a boundary to measure, not as already proven free.
- Define future error classification for backend route responses:
  - `401` auth/session failure.
  - `408` or network timeout.
  - `429` rate limit or quota-like response.
  - `5xx` backend/provider unavailable.
  - local-only remote pause.
- On quota/rate-limit-like errors, future guardrails should avoid aggressive retry, enter a cooldown, and preserve local-first state.

No auth behavior changes are made in K-297.

## Backend Route Fanout Visibility Plan

Frontend source sees backend routes, not direct Supabase table calls. Supabase quota risk can be hidden behind backend route fanout, so the first implementation line should make route sources visible before enforcement.

Future instrumentation or source-visible classification should identify:

- Route key or category.
- Triggering surface.
- Automatic versus user-triggered request.
- Retry count.
- Response class.
- Degraded or circuit state.
- Whether the request is auth/session, product data, sync, backup/restore, analytics, or provider-adjacent.

Do not log secrets, tokens, credentials, note body content, attachment bytes, or sensitive user content.

K-298 should either add a plan-only route classification contract or a tiny source-visible classifier if the boundary is precise enough.

## Circuit Breaker Strategy

The target is a global or domain-specific circuit breaker for repeated Supabase/backend-route failures. K-297 does not implement it.

Potential triggers:

- Repeated `429` or rate-limit-like responses.
- Repeated `502`, `503`, or `504`.
- Burst of network failures.
- Quota-like backend error messages if surfaced.
- Repeated auth/session expiration that cannot refresh.

Expected behavior:

- Stop automatic retries for a cooldown window.
- Allow explicit manual retry.
- Preserve local-first state.
- Keep local Notes and local workspace surfaces usable where possible.
- Show non-destructive degraded UI for remote-dependent widgets.
- Avoid exposing secrets or backend internals in user-facing errors.

Likely scope:

- Fetcher/backend API layer first.
- Analytics polling second.
- Provider transfers separately.
- Not a Notes persistence rewrite.
- Not a remote-first sync rewrite.

K-298 should not jump to a full circuit breaker unless it first locks source boundaries and tests.

## Graceful Degradation Strategy

- Unauthenticated state should not trigger product data traffic.
- Authenticated app shell should keep local-first views usable when remote routes are degraded.
- Remote-dependent widgets should show unavailable/degraded states rather than repeated retries.
- Analytics polling should pause, back off, or surface a quiet degraded state after repeated failure.
- Provider uploads/downloads should remain explicit and should not retry indefinitely.
- Error labels should be safe and avoid secrets, tokens, note content, attachment content, or service internals.
- No fallback may delete local data, overwrite local notes, or replace local-first state with stale remote data.

## Legacy Analytics Polling Policy

Current source fact: `frontend/src/components/views/LegacyAnalyticsView.tsx` uses SWR with `refreshInterval: 60000` for weekly workout data.

K-297 does not change the interval.

K-298 options:

- Disable or pause polling when the tab is hidden.
- Pause polling on repeated failure or circuit-open state.
- Keep the interval but document the request budget and monitoring expectation.
- Make the refresh user-triggered.
- Defer implementation if real usage evidence shows low risk.

Recommended path: K-298 should plan or implement only a small polling-risk boundary, not a broad analytics rewrite. If implementation is chosen, it should be limited to pause/degrade behavior with tests proving no request loops.

## Retry / Backoff Policy

Current source fact: `fetcher.ts` has `MAX_RETRIES = 3`, exponential backoff, and a one-time 401 refresh attempt.

Policy:

- Preserve bounded retry behavior.
- Avoid nested retry loops across SWR, fetcher, and UI-level retry handlers.
- Avoid retrying quota/rate-limit responses aggressively.
- Avoid treating auth failures as ordinary retryable traffic.
- Future implementation should classify `429` and quota-like errors separately from transient `5xx`.
- Future tests should prove retry caps, no unbounded loops, and no retry storm when several SWR hooks fail together.

K-297 does not change retry/backoff behavior.

## App Mount Fanout Limit

Current source facts from K-296:

- `App.tsx` performs session resolution and auth-state subscription.
- `AppContent.tsx` starts local Notes initialization and snapshot slot maintenance after protected entry.
- `useDaily.ts` can mount five backend route reads for a date.
- `useStatic.ts` can mount four backend route reads for static/month data.
- Workspace-specific SWR hooks can add additional backend calls.
- Remote keys are null in local mode.

Target:

- Protected shell should not fan out to many backend/Supabase calls without user action or necessary boot context.
- Acceptable first boot traffic:
  - Supabase auth/session check.
  - Existing minimal workspace metadata needed for the active screen.
  - Local durability/snapshot work that does not require remote traffic.
- Deferred or guarded traffic:
  - Analytics.
  - Heavy sync.
  - Provider recovery.
  - Large attachment operations.
  - Cross-workspace data not needed for the current surface.

K-297 does not change mount behavior.

## Usage Measurement / Logging / Alerting Plan

Future guardrails need lightweight measurement without leaking user data.

Possible future fields:

- Route key.
- Request source.
- Automatic or user-triggered.
- Retry count.
- Response class.
- Degraded/circuit state.
- Timestamp bucket.

Do not log:

- Access tokens.
- Refresh tokens.
- API keys.
- Note body content.
- Attachment content.
- Full user-entered schedule/health/recipe text.
- Raw backend error bodies that may contain sensitive data.

Manual Supabase dashboard/runbook checklist:

- Check API request count.
- Check auth usage.
- Check database egress and row counts if relevant.
- Check storage usage if a Supabase Storage provider is ever introduced.
- Check rate-limit or quota warnings.
- Record incident threshold and first response steps.
- Confirm no direct frontend table/storage/realtime usage was introduced.

K-297 does not implement monitoring.

## K-298 Implementation Candidate Matrix

| Candidate | Source area | Files likely touched | Expected benefit | Risk | Test plan | K-298 should implement |
| --- | --- | --- | --- | --- | --- | --- |
| Fetcher/backend-route request classifier only | Backend route boundary | New small lib/test, maybe fetcher-adjacent docs only | Makes route fanout visible without changing request behavior | Low | Source-invariant test and pure unit test | Recommended as plan or tiny implementation |
| Fetcher-level retry/quota classification plan | `fetcher.ts` policy | Docs/test first | Locks `429` and quota-like behavior before runtime edits | Low | Audit test against current retry facts | Recommended in K-298 plan |
| LegacyAnalyticsView polling pause/degrade | Legacy analytics polling | `LegacyAnalyticsView.tsx` only if implementation is approved later | Reduces concrete 60-second polling risk | Medium-low | Component/source test for hidden/failure pause | Later or narrow K-298 implementation |
| Auth/session duplicate-call guard | `App.tsx`, `supabase.ts` | Auth/runtime files | Could reduce session-call pressure | Medium | Auth gate tests and local-mode tests | Not first unless measured |
| Backend route fanout documentation/runbook | Docs | Guardrail doc/runbook | Clarifies hidden backend quota risk | Low | Doc audit test | Recommended if no runtime change |
| Global circuit breaker plan | Fetcher/authFetch/SWR policy | Docs/test | Defines degradation before code | Low | Audit test | Recommended before full implementation |
| Full circuit breaker implementation | `fetcher.ts`, shared state, UI surfaces | Runtime fetch path and UI consumers | Strong protection against loops | Medium-high | Broad retry, SWR, UI degradation tests | Not first |
| Provider/attachment transfer guard | Google Drive/provider queue | Provider and queue files | Controls non-Supabase provider traffic | Medium | Existing upload/recovery queue tests | Later, separate provider milestone |
| Supabase dashboard/runbook documentation | Docs | Runbook doc/test | Operational visibility | Low | Doc audit test | Good alternative if runtime risk is low |

## Recommended K-298 Path

Recommended primary path: **K-298 Supabase Usage Guardrail Minimal Implementation Plan**.

Scope:

- Docs/plan plus audit test only.
- Lock exact minimal implementation files and tests.
- Choose between:
  - pure backend-route request classifier contract, or
  - LegacyAnalytics polling pause/degrade plan, or
  - release monitoring runbook if operational visibility is the main gap.
- No runtime behavior change unless K-298 explicitly upgrades to implementation after review.

If source facts are judged precise enough for implementation, alternative path: **K-298 Supabase Usage Guardrail Minimal Implementation**.

Implementation constraints for that alternative:

- Small runtime implementation.
- One area only.
- Prefer fetcher/backend-route classification or LegacyAnalytics polling pause/degrade, not both.
- Requires focused tests.
- No broad rewrite.
- No auth bypass.
- No env/secrets changes.

Alternative path: **K-298 Supabase Release Monitoring Runbook** if operational monitoring is the highest-value gap.

Not recommended:

- Broad performance rewrite.
- Remote-first sync rewrite.
- Cloudflare/Firebase migration.
- Disabling auth.
- Direct frontend Supabase table/storage usage.
- Production bypass.
- Env/secrets changes.

## Non-goals

K-297 has no runtime traffic-control implementation, no authFetch behavior change, no SWR/fetcher behavior change, no analytics refreshInterval change, no retry/backoff behavior change, no circuit breaker implementation, no quota fallback implementation, no monitoring implementation, no Supabase client/config/env change, no database/RLS/migration change, no Cloudflare/Firebase migration, no Notes runtime change, no sync/persistence behavior change, no backup/export/import/restore behavior change, no provider/attachment behavior change, no Signal Panel change, no Health/Schedule change, no assets/fonts/dependencies, and no generated artifacts.

## Closure Statement

K-297 defines Supabase usage guardrail implementation strategy only. No request behavior changes are implemented yet. K-296 source facts remain the baseline. Protected auth posture remains unchanged. Local-first data ownership remains preserved. Direct frontend Supabase table/storage/realtime usage should not be introduced. K-298 should implement or further plan the smallest high-value guardrail. Remote systems remain support layers.
