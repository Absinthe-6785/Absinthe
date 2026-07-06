# K-298 Supabase Usage Guardrail Minimal Implementation Plan

## Purpose

K-298 chooses the first minimal Supabase usage guardrail boundary after K-296 and K-297. K-298 is docs/plan plus audit test only.

K-298 does not implement runtime traffic control. K-298 does not implement route metadata. K-298 does not change request behavior, auth/session behavior, authFetch behavior, fetcher/SWR behavior, analytics refreshInterval behavior, retry/backoff behavior, Supabase client/config/env, database/RLS/migrations, Notes runtime, sync/persistence, backup/export/import/restore, provider/attachment behavior, Signal Panel, Health/Schedule, assets/fonts/dependencies, scripts, or generated artifacts.

K-298 chooses the next implementation path: K-299 Supabase Usage Route Metadata Implementation.

## K-296 / K-297 Recap

K-296 established these source facts:

- No direct frontend runtime `supabase.from(...)` calls were found in `frontend/src`.
- No direct frontend runtime `supabase.storage`, `storage.from(...)`, or `supabase.channel(...)` calls were found in `frontend/src`.
- Product data traffic is primarily backend-route based through `authFetch(...)`.
- `authFetch(...)` in `frontend/src/lib/supabase.ts` performs a Supabase session lookup before each allowed remote request.
- Supabase auth/session traffic and backend product-route traffic are different usage risks and need separate classification.
- `frontend/src/hooks/useDaily.ts` uses `remoteSWRKey(...)` and `revalidateOnFocus: false`.
- `frontend/src/hooks/useStatic.ts` uses `remoteSWRKey(...)` and `revalidateOnFocus: false`.
- `frontend/src/lib/fetcher.ts` has bounded retries with `MAX_RETRIES = 3`, retry statuses `502`, `503`, and `504`, and exponential backoff from `BASE_DELAY_MS = 600`.
- `frontend/src/components/views/LegacyAnalyticsView.tsx` has a source-present `refreshInterval: 60000`.
- Google Drive attachment traffic is provider-side traffic and not Supabase Storage traffic.

K-296 and K-297 identified these missing controls:

- No explicit request budget policy.
- No route classification map for backend-route fanout.
- No global request counter.
- No global circuit breaker.
- No quota-risk graceful degradation policy.
- No current usage monitoring, alerting, or runbook closure.

K-297 recommended starting with a narrow planning or metadata boundary, not a broad runtime rewrite.

## Why Backend Route Classification First

Backend route classification should come first because the source-visible product traffic is routed through backend endpoints, not direct frontend Supabase table/storage/realtime calls. Supabase usage risk may still exist behind those backend routes through database fanout, auth/session lookups, backend joins, polling, retries, or restore/export paths.

Classification is the smallest useful step because it:

- Makes automatic versus user-triggered traffic visible without changing behavior.
- Separates auth/session cost from product data route cost.
- Identifies polling and background-refresh surfaces before enforcement.
- Lets future tests lock request-budget intent without making runtime requests.
- Gives later circuit breaker, graceful degradation, monitoring, and runbook work a stable vocabulary.
- Avoids premature edits to `authFetch(...)`, `fetcher(...)`, SWR hooks, analytics polling, or app boot behavior.

## Proposed Classification Owner

The proposed K-299 owner is a pure metadata module:

`frontend/src/lib/supabaseUsageRouteMetadata.ts`

The parent directory `frontend/src/lib` already exists. The K-299 module should be pure data and pure helper functions only:

- no network calls
- no request execution
- no env reads
- no Supabase import
- no authFetch import
- no fetcher import
- no SWR import
- no browser storage
- no persistence writes
- no route registration side effects
- no runtime traffic-control behavior

K-299 may add tests at:

- `frontend/src/lib/supabaseUsageRouteMetadata.test.ts`
- `frontend/src/lib/supabaseUsageRouteMetadataBoundary.test.ts`

K-299 may add an optional doc:

- `frontend/docs/K-299-supabase-usage-route-metadata-implementation.md`

## Route Classification Taxonomy

The K-299 metadata should start with the following route taxonomy. Names may be adjusted in K-299 only if the same distinctions remain test-covered.

| Category | Description | Trigger | Risk posture | Budget posture | Examples for K-299 inclusion |
| --- | --- | --- | --- | --- | --- |
| `auth-session` | Supabase auth/session lookup, refresh, sign-in, sign-out, and callback-adjacent state | `auth-session` | Medium because auth can be called during app boot and request boundaries | Must remain bounded and separate from product route budgets | `supabase.auth.getSession()`, `supabase.auth.refreshSession()`, sign-in/sign-up/sign-out surfaces |
| `app-bootstrap` | First protected-shell data needed to render the active workspace | `app-mount` | Medium because multiple hooks can mount together | Keep minimal and route-visible | `useDaily.ts`, `useStatic.ts`, Home boot reads |
| `analytics-polling` | Repeating analytics or historical summary reads | `polling` | High when automatic or repeated | Must be classifiable before pause/degrade policy | `LegacyAnalyticsView.tsx` workout range polling with `refreshInterval: 60000` |
| `user-action-read` | Explicit reads caused by direct user intent | `user-action` | Low to medium | Allowed when bounded and visible | selected day reads, previous workout reads, recipe reads, search reads |
| `user-action-write` | Explicit writes caused by direct user intent | `user-action` | Medium because writes should report failures clearly | Allowed with safe failure labels and bounded retries | Health writes, recipe writes, protein writes, schedule writes |
| `sync-read` | Remote/hybrid sync reads that should not full-replace local data | `background-refresh` | Medium to high because sync can fan out | Must be changed-since or scoped, never destructive | Notes changed-since pull, folder sync read |
| `sync-write` | Dirty-only remote/hybrid sync writes | `background-refresh` | Medium to high because retries can amplify | Must be dirty-only and bounded | Notes dirty/deleted push |
| `provider-transfer` | External provider operation outside Supabase Storage | `provider-transfer` | Medium because provider limits differ from Supabase limits | Explicit/manual first; no background storm | Google Drive session transfer boundaries |
| `attachment-transfer` | Attachment upload/download/recovery queue activity | `provider-transfer` | Medium to high because blobs can be large | Explicit/manual and separately budgeted | manual upload queue, explicit recovery |
| `background-refresh` | Passive refresh that is not critical for current user action | `background-refresh` | Medium to high when automatic | Must be pausable/degradable later | periodic remote refresh, passive summary refresh |
| `unknown/unclassified` | Any route without explicit classification | `unknown` | Unknown and therefore treated as risky | Should fail K-299 tests until classified or intentionally documented | newly added API routes without metadata |

## Request Budget Metadata Shape

K-299 should begin with a small metadata shape. This is proposed only; K-299 may adjust names if the same safety properties remain covered.

```ts
export type SupabaseUsageRouteRisk = "low" | "medium" | "high" | "unknown";

export type SupabaseUsageTrigger =
  | "app-mount"
  | "auth-session"
  | "user-action"
  | "polling"
  | "background-refresh"
  | "provider-transfer"
  | "unknown";

export type SupabaseUsageBudget = {
  routeKey: string;
  category:
    | "auth-session"
    | "app-bootstrap"
    | "analytics-polling"
    | "user-action-read"
    | "user-action-write"
    | "sync-read"
    | "sync-write"
    | "provider-transfer"
    | "attachment-transfer"
    | "background-refresh"
    | "unknown/unclassified";
  trigger: SupabaseUsageTrigger;
  risk: SupabaseUsageRouteRisk;
  automatic: boolean;
  expectedFrequency: string;
  retrySensitive: boolean;
  degradeCandidate: boolean;
  notes: string;
};
```

Metadata must not include secrets, tokens, credentials, service-role keys, raw user IDs, note body content, attachment bytes, schedule text, health details, recipe content, raw backend error bodies, or payload contents.

## K-299 Minimal Implementation Boundary

K-299 should be named:

**K-299 Supabase Usage Route Metadata Implementation**

Expected K-299 scope:

- Add `frontend/src/lib/supabaseUsageRouteMetadata.ts`.
- Add `frontend/src/lib/supabaseUsageRouteMetadata.test.ts`.
- Add `frontend/src/lib/supabaseUsageRouteMetadataBoundary.test.ts` if useful for side-effect/import boundary checks.
- Optionally add `frontend/docs/K-299-supabase-usage-route-metadata-implementation.md`.
- Implement a pure metadata map for currently source-visible backend/auth/provider route classes.
- Add helper lookups such as `getSupabaseUsageBudget(routeKey)` or `listSupabaseUsageBudgets()` only if they stay pure.
- Classify `unknown/unclassified` as risky.

K-299 must not change:

- `frontend/src/lib/supabase.ts`
- `frontend/src/lib/fetcher.ts`
- `frontend/src/lib/remoteBoundary.ts`
- `frontend/src/hooks/useDaily.ts`
- `frontend/src/hooks/useStatic.ts`
- `frontend/src/components/views/LegacyAnalyticsView.tsx`
- auth runtime behavior
- SWR behavior
- analytics interval behavior
- retry/backoff behavior
- Supabase client/config/env
- database/RLS/migrations
- Notes runtime
- backup/provider runtime behavior

## K-299 Coverage Expectations

K-299 tests should prove:

- the metadata module is importable without network calls
- the metadata module imports no Supabase client
- the metadata module imports no authFetch/fetcher/SWR runtime
- all route categories in the K-298 taxonomy are represented or intentionally absent with a documented reason
- `analytics-polling` entries are marked `automatic: true`, `retrySensitive: true`, and `degradeCandidate: true`
- user-triggered writes are not mislabeled as background refresh
- provider and attachment transfers are separate from Supabase Storage
- unknown routes are treated as `unknown/unclassified`
- metadata contains no secrets, tokens, credentials, service-role keys, note body content, attachment bytes, or payload samples
- K-299 remains no-side-effect and does not change request behavior

## How Metadata Supports Future Guardrails

The metadata will support future guardrails by providing source-visible answers to:

- Which routes run during app mount?
- Which routes are automatic?
- Which routes are polling?
- Which routes are retry sensitive?
- Which routes can degrade without blocking local-first work?
- Which routes are explicit user actions?
- Which routes involve sync semantics?
- Which transfers are provider-side and not Supabase Storage?
- Which surfaces are still unknown or unclassified?

This lets later milestones add measured behavior carefully instead of guessing at hidden traffic.

## LegacyAnalytics Polling Handling

K-298 does not change `LegacyAnalyticsView.tsx` and does not change `refreshInterval: 60000`.

K-299 should classify LegacyAnalytics polling as `analytics-polling`, `automatic: true`, `retrySensitive: true`, and `degradeCandidate: true`.

Later milestones may consider pausing when hidden, pausing after repeated failures, switching to explicit refresh, or showing degraded analytics copy. Those are not K-298 or K-299 runtime changes unless explicitly approved in a later implementation milestone.

## Circuit Breaker / Graceful Degradation Staging

Staging should be:

1. K-298: plan the minimal route metadata boundary.
2. K-299: implement pure route metadata and no-side-effect tests.
3. K-300 or later: add a runbook or monitoring checklist if operational visibility is the next gap.
4. Later: classify response outcomes such as `401`, `429`, network timeout, and `5xx` without changing behavior.
5. Later: analytics pause/degrade policy if the polling risk remains concrete.
6. Later: fetcher-level quota classification or circuit breaker only after metadata and response policy are stable.

Circuit breaker work should remain reversible, local-first, and non-destructive. It must not delete local data, overwrite local notes, replace local-first state with stale remote state, or create a production auth bypass.

## Monitoring / Runbook Staging

Monitoring and runbook work should follow metadata because metadata defines the route vocabulary.

Future runbook items:

- Check Supabase API request count.
- Check Supabase auth usage.
- Check database egress and row count trends if relevant.
- Confirm no frontend direct `supabase.from(...)`, `supabase.storage`, or `supabase.channel(...)` usage was introduced.
- Track known automatic routes.
- Track analytics polling separately from user action routes.
- Record incident thresholds and first response steps.
- Preserve local-first data during degraded remote availability.

Do not log secrets, access tokens, refresh tokens, API keys, note content, attachment content, schedule text, health details, recipe content, or raw backend error bodies.

## K-300 Outlook

Likely K-300 candidates after K-299:

- Supabase usage guardrail runbook and release checklist.
- Metadata coverage closure audit.
- LegacyAnalytics polling pause/degrade plan.
- Fetcher response classification plan for `429` and quota-like failures.
- Minimal monitoring labels for manual QA only.

K-300 should not jump directly to a broad circuit breaker unless K-299 metadata shows a precise and testable runtime boundary.

## Non-goals

K-298 has no route metadata implementation, no runtime traffic-control implementation, no authFetch behavior change, no fetcher/SWR behavior change, no analytics refreshInterval change, no retry/backoff behavior change, no circuit breaker implementation, no quota fallback implementation, no monitoring/logging implementation, no Supabase client/config/env change, no database/RLS/migration change, no direct frontend Supabase table/storage/realtime usage, no Cloudflare/Firebase migration, no Notes runtime change, no sync/persistence behavior change, no backup/export/import/restore behavior change, no provider/attachment behavior change, no Signal Panel change, no Health/Schedule change, no assets/fonts/dependencies, and no generated artifacts.

## Closure Statement

K-298 selects the minimal next guardrail: a pure K-299 backend-route usage metadata module. The current product behavior remains unchanged. K-296 source facts and K-297 guardrail strategy remain the baseline. Auth restoration remains protected. Local-first data ownership remains preserved. Remote systems remain support layers. No request behavior, storage, schema, provider, auth, or UI behavior is changed by K-298.
