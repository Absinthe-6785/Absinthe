# K-301 Supabase Usage Guardrail Runbook / Monitoring Plan

## Purpose

K-301 defines the Supabase usage guardrail runbook and monitoring plan.

K-301 follows K-296 source facts, K-297 guardrail strategy, K-298 minimal implementation planning, K-299 pure route metadata implementation, and K-300 metadata closure.

K-301 is docs/plan plus audit test only.

K-301 does not implement runtime enforcement. K-301 does not add monitoring/logging code. K-301 does not modify metadata. K-301 does not wire metadata into runtime.

K-301 chooses the next path: K-302 Supabase Usage Guardrail Runbook Closure Audit.

## Current Posture Recap

K-296 established the source facts:

- No direct frontend runtime `supabase.from(...)` calls were found in `frontend/src`.
- No direct frontend runtime `supabase.storage`, `storage.from(...)`, or `supabase.channel(...)` calls were found in `frontend/src`.
- Product data traffic primarily goes through backend routes via `authFetch(...)`.
- `authFetch(...)` performs a Supabase session lookup before each allowed remote request.
- `useDaily.ts` and `useStatic.ts` use `remoteSWRKey(...)`.
- `useDaily.ts` and `useStatic.ts` use `revalidateOnFocus: false`.
- `fetcher.ts` has bounded retries with `MAX_RETRIES = 3`.
- `LegacyAnalyticsView.tsx` has a known `refreshInterval: 60000`.
- Google Drive attachment traffic is provider-side traffic, not Supabase Storage traffic.

K-297 planned guardrails:

- request budget policy.
- session-cost visibility.
- backend-route fanout strategy.
- circuit breaker design.
- graceful degradation.
- retry/backoff policy.
- monitoring/runbook needs.

K-298 selected the minimal implementation path: a pure metadata boundary before any runtime behavior change.

K-299 implemented pure Supabase usage route metadata in `frontend/src/lib/supabaseUsageRouteMetadata.ts`.

K-300 closed that metadata boundary and confirmed:

- metadata remains descriptive only.
- metadata remains pure and not runtime-wired.
- runtime request behavior remains unchanged.
- authFetch remains unchanged.
- fetcher/SWR behavior remains unchanged.
- analytics polling remains unchanged.
- Supabase client/config/env remains unchanged.

Current posture: direct frontend Supabase table/storage/realtime usage remains absent, backend-route based access remains the primary product data posture, and metadata is planning vocabulary only.

## Monitoring Objectives

K-301 monitoring objectives:

- detect quota/traffic spikes early.
- distinguish expected auth/session traffic from product/backend-route fanout.
- identify analytics polling impact.
- track retry/error bursts.
- identify storage, egress, provider, and Supabase Storage confusion.
- preserve local-first product behavior.
- avoid secrets or user-content logging.
- decide when to degrade, pause, investigate, or create a targeted K-ticket.

Operational visibility should be useful before runtime enforcement exists. The plan should answer what changed, where traffic came from, whether the traffic was automatic or user-triggered, and what non-destructive response is appropriate.

## Supabase Dashboard Metrics Checklist

Exact dashboard labels may vary. Treat these as checklist categories rather than guaranteed UI label names.

Manual Supabase dashboard checks:

- API request count.
- Auth request count, sign-in activity, session activity, and token refresh activity.
- Database usage, row reads, row writes, and query volume if available.
- Edge/API/backend route fanout proxy indicators if the deployment exposes them.
- Realtime usage, expected to remain absent unless source changes.
- Storage usage, expected to remain absent for Supabase Storage unless source changes.
- Egress and bandwidth.
- Error rate, including 4xx and 5xx categories where available.
- Rate-limit or quota warnings.
- Project quota and billing usage.

Do not paste secrets, tokens, raw payloads, note content, attachment bytes, schedule text, health details, recipe content, or raw backend error bodies into incident records.

## Backend-route Fanout Observation Plan

The frontend sees backend-route usage, not direct Supabase table/storage calls.

The K-299 metadata can classify route risk, but it does not measure backend fanout. A single backend route may create multiple Supabase server-side calls. Manual review should correlate:

- route key/category.
- trigger.
- automatic versus user action.
- expected frequency.
- Supabase dashboard usage.
- app scenario.
- auth state.
- time window.
- recent deploy or PR.

High-risk fanout requires source inspection before runtime enforcement. Runtime guardrails should not be added solely because a category sounds risky; they should be based on evidence and a narrow implementation plan.

No payload logging and no user-content logging are allowed.

## Request Budget Monitoring Plan

K-301 proposes monitoring budgets only. Runtime enforcement exists: currently no.

| Budget area | Expected posture | What to check | Warning signs | Suggested response |
| --- | --- | --- | --- | --- |
| App mount | Supabase auth/session check plus only needed active-workspace backend routes | Dashboard request change during first authenticated load; `useDaily` and `useStatic` route classes | Many backend calls before user sees active workspace; repeated boot spikes | Inspect active workspace hooks; create narrow source audit before runtime change |
| Unauthenticated idle | Auth session resolution and login/signup user actions only | Auth usage while logged out; absence of product backend routes | Product routes before protected shell; production bypass behavior | Treat as auth boundary regression; do not solve by bypass |
| Authenticated idle | Low automatic traffic; no high-frequency hidden polling | Dashboard usage after login with no user action | Sustained backend traffic while idle | Identify mounted surface; classify route category; consider K-ticket |
| Analytics polling | Known `LegacyAnalyticsView` polling at 60000 ms while active | Whether analytics view is open and correlated with request increases | Polling continues during failures or hidden/idle use | Consider LegacyAnalytics polling decision plan |
| User-triggered read/write | Explicit user action may call backend routes with visible failure states | Request burst around save, delete, restore, or navigation | Repeated failures, retries, or hidden fanout beyond action scope | Preserve action semantics; add targeted failure handling only after plan |
| Background refresh | Lower priority than active user action | Heatmap, summary, sync, or passive refresh usage | Background calls dominate user-action calls | Prefer pause/degrade policy before enforcement |
| Provider/attachment transfer | Explicit/manual transfer posture | Provider traffic versus Supabase traffic separation | Provider quota issue mistaken for Supabase Storage issue | Keep provider incident separate from Supabase quota incident |
| Unknown/unclassified | Conservative and risky until classified | Unknown route metadata and dashboard spike | New route lacks classification | Source-audit and classify before treating as safe |

## Analytics Polling Monitoring Plan

Known source fact: `LegacyAnalyticsView.tsx` has `refreshInterval: 60000` for workout range polling.

K-301 does not change it.

Monitoring should check:

- whether the analytics view is open.
- whether polling correlates with request spikes.
- whether failures retry aggressively.
- whether hidden-tab behavior matters.
- whether analytics polling creates user-visible value during the observed scenario.
- whether the request pattern is distinguishable from app bootstrap and background refresh traffic.

Future action may be a LegacyAnalytics polling decision plan or patch. Do not patch analytics polling in K-301.

## Error / Quota / Spike Response Runbook

Incident response steps:

1. Confirm the symptom: user report, dashboard warning, failed request class, or CI/manual QA observation.
2. Check Supabase dashboard usage categories.
3. Identify the time window.
4. Map the scenario to app surface and route metadata category.
5. Classify traffic as unauthenticated, authenticated idle, user action, polling, background refresh, sync, or provider transfer.
6. Check recent PRs, deploys, config changes, and manual QA activity.
7. Check retry/error burst shape, including 401, 429, 5xx, and network failures.
8. Decide mitigation:
   - pause a feature manually if possible.
   - communicate degraded state if user-visible.
   - avoid adding production bypass.
   - avoid broad rewrites under incident pressure.
   - avoid remote-first fallback that risks local data.
9. Record incident notes using the evidence template.
10. Create a targeted K-ticket for source fix, monitoring improvement, or runtime guardrail plan.

If evidence is incomplete, do not implement a broad circuit breaker as the first response.

## Near-limit Degradation Policy Draft

Near-limit policy:

- local-first views should remain usable where possible.
- remote/backend-route dependent features may show degraded or unavailable state.
- analytics polling can be paused or degraded in future if necessary.
- background refresh is lower priority than user action.
- provider/attachment transfer should not retry indefinitely.
- auth/session correctness must not be bypassed.
- local data must not be deleted, overwritten, or replaced with stale remote data.
- secrets must not be logged.
- user content must not be logged.
- fake success states are not allowed.

Any future degradation implementation must be reversible, narrow, and tested against local-first data ownership.

## Escalation Thresholds

Avoid inventing absolute quota numbers until project-specific limits and dashboard evidence are recorded.

| Level | Qualitative threshold | Response owner placeholder | Evidence required | Next action | Implementation K-ticket required |
| --- | --- | --- | --- | --- | --- |
| Warning | Unexpected usage increase but no user impact | Release owner or on-call reviewer | Time window, metric category, suspected route category | Continue monitoring and inspect recent changes | Maybe |
| Elevated | Sustained spike or repeated quota-like errors | Release owner plus domain owner | Dashboard category, route category, scenario, retry/error class | Pause risky manual flow if available; create targeted investigation | Usually |
| Incident | User-visible failures, near-limit risk, or repeated backend failures | Release owner plus product/runtime owner | User impact, dashboard evidence, affected route class, recent deploys | Communicate degraded state and create narrow fix plan | Yes |
| Release blocker | Authenticated core app cannot function or quota risk cannot be explained | Release owner | Repro steps, dashboard evidence, changed-file/source facts | Block release until source is understood | Yes |

## Evidence Capture Template

Use this template for manual QA, release review, or incident records:

- Date/time/window:
- Environment:
- Commit/deploy:
- Observed Supabase metric category:
- Route/category suspected:
- User scenario:
- Auth state:
- Automatic or user-triggered:
- Retry/error symptoms:
- Dashboard screenshots or logs location:
- Secrets redaction confirmation:
- User-content redaction confirmation:
- Decision:
- Follow-up K-ticket:

Do not include access tokens, refresh tokens, API keys, passwords, raw note bodies, attachment bytes, schedule text, health details, recipe content, or raw backend error bodies.

## Release Checklist

Manual release/QA checklist:

- Logged-out app shell stays blocked from protected product surfaces.
- Authenticated login/callback/logout verified if credentials are available.
- Supabase dashboard checked before smoke test.
- Supabase dashboard checked after smoke test.
- Analytics polling view checked if relevant.
- App idle usage observed.
- User-triggered read/write usage observed if relevant.
- No direct frontend Supabase table/storage/realtime usage introduced.
- No credentials or storageState artifacts committed.
- Metadata boundary remains closed.
- authFetch/fetcher/SWR behavior remains unchanged unless a later approved implementation explicitly changes it.
- Runbook evidence recorded.

Browser QA is not required for K-301 itself because it has no runtime/browser behavior change.

## K-302 Implementation Candidate Matrix

| Candidate | Scope | Files likely touched | Benefit | Risk | Tests | Recommended now |
| --- | --- | --- | --- | --- | --- | --- |
| Supabase monitoring/runbook closure audit | docs/source closure audit plus audit test | K-302 doc and audit test only | Closes K-301 and keeps operational plan honest | Low | Source-invariant audit test | Yes |
| LegacyAnalytics polling decision plan | docs/plan plus audit test | Legacy analytics docs/test only | Decides whether 60s polling needs pause/degrade work | Low | Source-fact audit against polling source | Alternative if polling appears urgent |
| Metadata granularity/immutability patch plan | docs/plan plus audit test | Metadata planning docs/test only | Prepares owner/routePattern/authRequired/read-only hardening | Low | Metadata boundary audit | Alternative |
| Lightweight request classification docs-to-runtime read-only wiring plan | plan only before code | fetcher/authFetch docs and tests later | Explores how metadata could be read without behavior change | Medium-low | Import-boundary and no-behavior tests | Not immediate |
| Fetcher error/quota classification plan | docs/plan plus audit test | fetcher policy docs/test later | Prepares 429/quota classification without retry changes | Low | Fetcher source-fact audit | Later |
| Circuit breaker plan | docs/plan plus audit test | fetcher/SWR policy docs/test later | Defines cooldown/degrade behavior before code | Low | Plan/audit tests | Later |
| Direct circuit breaker implementation | runtime implementation | fetcher, shared state, UI consumers | Stronger protection after evidence | Medium-high | Broad retry/SWR/UI/local-first tests | No |

## Recommended K-302 Path

Primary recommendation: K-302 Supabase Usage Guardrail Runbook Closure Audit.

Scope:

- docs/source closure audit plus audit test only.
- close K-301 runbook/monitoring plan.
- confirm no runtime changes.
- confirm metadata remains pure and unwired.
- confirm dashboard/runbook checklist is ready for release/manual QA.

Alternative: K-302 LegacyAnalytics Polling Decision Plan.

Scope:

- docs/plan plus audit test only.
- decide whether polling should be paused, degraded, or left as-is.
- no runtime change.

Alternative: K-302 Supabase Usage Metadata Granularity Hardening Plan.

Scope:

- docs/plan plus audit test only.
- plan routePattern, owner, authRequired, and readonly hardening before runtime consumers.

Not recommended:

- immediate circuit breaker implementation.
- request enforcement before runbook closure.
- broad performance rewrite.
- Cloudflare/Firebase migration.
- Supabase env/config changes.

## Non-goals

K-301 non-goals:

- no runtime enforcement implementation.
- no authFetch wiring.
- no request blocking/throttling.
- no circuit breaker implementation.
- no analytics polling change.
- no metadata module modification.
- no Supabase client/config/env change.
- no monitoring/logging code.
- no database/RLS/migration change.
- no auth/session behavior change.
- no fetcher/SWR behavior change.
- no retry/backoff behavior change.
- no Notes runtime change.
- no sync/persistence behavior change.
- no backup/export/import/restore behavior change.
- no provider/attachment behavior change.
- no Signal Panel change.
- no Health/Schedule change.
- no assets/fonts/dependencies.
- no generated artifacts.

## Closure Statement

K-301 defines operational runbook and monitoring plan only.

No runtime guardrails are implemented. Metadata remains pure and not runtime-wired. Request behavior remains unchanged.

Supabase usage risk should be monitored through dashboard/checklist/evidence capture. Future runtime enforcement should be based on evidence and narrow plans.

Protected auth posture remains unchanged. Local-first data ownership remains preserved. Remote systems remain support layers.
