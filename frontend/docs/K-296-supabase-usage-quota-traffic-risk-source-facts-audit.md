# K-296 Supabase Usage / Quota / Traffic Risk Source Facts Audit

## Purpose

K-296 source-audits current Supabase usage, quota, and traffic-risk paths after the K-286 through K-295 auth restoration line closed.

K-296 is docs/source audit plus audit test only. K-296 does not implement Supabase optimizations or runtime request behavior changes. K-296 has no Supabase runtime behavior change, no auth/session behavior change, no sync behavior change, no retry/polling behavior change, no circuit breaker implementation, no quota fallback implementation, no Supabase config/env change, and no database/RLS/migration change.

K-296 does not change Notes runtime, local persistence, backup/export/import/restore behavior, attachment/provider behavior, Signal Panel, Health/Schedule, assets/fonts/dependencies, scripts, or generated artifacts.

K-296 chooses the next path: K-297 Supabase Usage / Traffic Control Plan.

## Current Posture Summary

The auth line is closed through K-295. Protected `AppContent` requires a Supabase-authenticated session. Local-first data ownership remains the intended product posture after authenticated entry.

Supabase currently supports auth/session and authenticated backend access. Frontend source does not show direct Supabase table, storage, or realtime usage. Most product data traffic goes through `authFetch(...)` against `API_URL` backend routes, which then may use Supabase server-side. This audit focuses on quota and traffic risk, not auth behavior changes.

## Supabase Client Creation Audit

Inspected paths:

- `frontend/src/lib/supabase.ts`
- `frontend/src/App.tsx`
- `frontend/src/components/AppContent.tsx`
- `frontend/src/components/views/LoginScreen.tsx`
- `frontend/src/lib/fetcher.ts`
- `frontend/src/lib/remoteBoundary.ts`

`frontend/src/lib/supabase.ts` creates a singleton Supabase client:

- `createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY)`

No second frontend Supabase client was found. No service-role key appears in the client source. The anon/public key handling follows the existing Vite env pattern. K-296 makes no config or env changes.

## Auth / Session Request Audit

Source paths:

- `frontend/src/App.tsx`
- `frontend/src/components/AppContent.tsx`
- `frontend/src/components/views/LoginScreen.tsx`
- `frontend/src/lib/supabase.ts`
- `frontend/src/lib/fetcher.ts`
- `frontend/src/App.localAuth.test.ts`
- `frontend/src/lib/supabaseBoundary.test.ts`

`App.tsx` calls `supabase.auth.getSession()` once inside a mount effect and registers `supabase.auth.onAuthStateChange(...)`. The effect has an empty dependency array, so normal production rendering should not repeat the session call on every render. React development StrictMode could still duplicate mount effects if enabled around the app, but `frontend/src/main.tsx` was not identified as adding a `StrictMode` wrapper in this audit.

`authFetch(...)` in `frontend/src/lib/supabase.ts` calls `supabase.auth.getSession()` for each remote request after `shouldUseRemoteData()` allows remote access. This means every backend API request may add a Supabase auth session lookup before the HTTP call. The source comment states Supabase SDK session lookup is memory-backed, but this is still an important traffic and latency boundary to verify under real SDK behavior.

`fetcher.ts` calls `supabase.auth.refreshSession()` once on a first-attempt 401 and calls `supabase.auth.signOut()` if refresh fails. `AppContent.tsx` calls `supabase.auth.signOut()` on sign-out. `LoginScreen.tsx` calls `supabase.auth.signInWithPassword(...)` and `supabase.auth.signUp(...)` only from user action.

Risk level: Medium. App-mount auth is bounded, but `authFetch` per-request session lookup is on every authenticated backend call. Existing tests cover local-mode remote pause and app auth gate behavior.

## App Mount / Duplicate Request Audit

App start paths:

- `frontend/src/App.tsx`
- `frontend/src/components/AppContent.tsx`
- `frontend/src/hooks/useDaily.ts`
- `frontend/src/hooks/useStatic.ts`
- `frontend/src/lib/migrateLegacyDdays.ts`

`App.tsx` performs auth session resolution at mount. Once authenticated, `AppContent.tsx` initializes local Notes storage and calls `runPeriodicSnapshotSlots(...)` plus `migrateLegacyDdays(...)`. `migrateLegacyDdays(...)` is guarded by `shouldUseRemoteData()` and a localStorage migration flag.

`useDaily.ts` mounts five SWR data reads for daily product data when `remoteSWRKey(...)` is non-null. `useStatic.ts` mounts four SWR data reads for dates, blocks, routines, and weekly schedules when remote mode is active. Both use `revalidateOnFocus: false`. Remote keys are `null` in local mode.

Product surfaces can trigger backend API calls after authenticated entry, especially Home, Planner, Health, Recipe, Archive/Analytics, and Settings. K-289 changed protected entry posture but did not remove data fetch surfaces after login.

Risk level: Medium. Remote mode can fan out multiple backend requests at app/workspace mount. Some historical docs already mention Health request fanout. Current source includes at least one bounded Health previous-workout request path.

## Sync / Remote Data Audit

Frontend direct Supabase table APIs:

- No `supabase.from(...)` usage found in `frontend/src`.
- No direct `.select(...)`, `.insert(...)`, `.update(...)`, `.upsert(...)`, `.delete(...)`, or `.rpc(...)` chained from the Supabase client was identified.

Authenticated backend API paths through `authFetch(...)` include:

- `frontend/src/lib/fetcher.ts`
- `frontend/src/hooks/useApiMutation.ts`
- `frontend/src/hooks/useDaily.ts`
- `frontend/src/hooks/useStatic.ts`
- `frontend/src/store/useNotesStore.ts`
- `frontend/src/lib/notesSyncClient.ts`
- `frontend/src/lib/csvExport.ts`
- `frontend/src/lib/migrateLegacyDdays.ts`
- `frontend/src/lib/vaultCloudExport.ts`
- `frontend/src/lib/vaultCloudRestore.ts`
- `frontend/src/components/views/HealthView.tsx`
- `frontend/src/components/views/features/health/prevWorkoutFetch.ts`
- `frontend/src/components/views/features/health/nutrition/ProteinTracker.tsx`
- `frontend/src/components/views/RecipeView.tsx`
- `frontend/src/components/views/SettingsView.tsx`

`notesSyncClient.ts` uses changed-since pull with `updated_after` and stores the cursor in `absinthe-notes-last-sync-at`. Folder fetches are bootstrapped and can be skipped after `absinthe-note-folders-bootstrapped`.

`useNotesStore.ts` still contains cloud write paths for notes and folders through `/api/notes` and `/api/note_folders`. K-142 established dirty/delta foundations, but K-296 does not change runtime sync behavior.

Risk level: Medium. Local-first boundaries are present, but remote/hybrid mode and manual export/restore paths can issue several backend calls. Full-vault frontend Supabase table fetch was not found.

## Retry / Loop / Polling Audit

Retry paths:

- `frontend/src/lib/fetcher.ts` retries network errors and 502/503/504 up to `MAX_RETRIES = 3` with exponential backoff from `BASE_DELAY_MS = 600`.
- `fetcher.ts` refreshes Supabase auth once on initial 401.

Polling/focus paths:

- `useDaily.ts` and `useStatic.ts` set `revalidateOnFocus: false`.
- Several workspace SWR calls also use `revalidateOnFocus: false`.
- `frontend/src/components/views/LegacyAnalyticsView.tsx` contains a `refreshInterval: 60000` SWR path for workout days. This is legacy but still source-present.
- `frontend/src/hooks/useNow.ts` uses `setInterval` for local clock updates, not Supabase traffic.

Background sync:

- No automatic Supabase realtime subscription loop was found.
- Attachment upload/recovery queues are explicit/manual-oriented and use provider abstractions, not automatic timers in the inspected source.

Risk level: Medium. Retry caps exist in `fetcher.ts`; however, multiple SWR callers can each retry independently. A legacy 60-second refresh interval is a concrete polling source to evaluate in K-297.

## Realtime / Subscription Audit

No frontend Supabase realtime table subscription was found:

- No `supabase.channel(...)` usage found in `frontend/src`.
- No direct Supabase realtime `subscribe(...)` usage found in `frontend/src`.

The only Supabase subscription-like path identified is `supabase.auth.onAuthStateChange(...)` in `App.tsx`, with `subscription.unsubscribe()` cleanup in the effect return.

Risk level: Low for Supabase realtime quota from frontend source. Auth-state subscription duplication risk is bounded by the `App.tsx` mount effect and cleanup.

## Storage / Upload / Download Audit

No direct Supabase Storage frontend usage was found:

- No `supabase.storage` usage found in `frontend/src`.
- No `storage.from(...)` usage found in `frontend/src`.

Attachment remote upload/download paths are currently provider-based, primarily Google Drive:

- `frontend/src/lib/googleDriveBlobAdapter.ts`
- `frontend/src/lib/attachmentExplicitUploadAction.ts`
- `frontend/src/lib/attachmentRemoteRecovery.ts`
- `frontend/src/lib/attachmentSyncQueue.ts`

Google Drive upload uses resumable upload to Google APIs with default chunk size `256 * 1024`. Download uses Google Drive file media URLs. These can create network and provider quota pressure, but not Supabase Storage pressure unless a future Supabase blob provider is added.

Risk level: Low for Supabase Storage, Medium for general remote/provider traffic.

## Unauthenticated Traffic Audit

Before login, `App.tsx` calls Supabase auth session APIs to resolve session and subscribe to auth state. `LoginScreen.tsx` calls Supabase sign-in/sign-up only after user action.

Product data calls are gated behind protected `AppContent` and remote boundary logic. In local mode, `remoteSWRKey(...)` returns `null`, `authFetch(...)` throws before session lookup, and `useApiMutation(...)` returns false before remote mutation. This limits no-login product data traffic after K-289/K-295.

Risk level: Low to Medium. Auth session resolution still happens unauthenticated, but product data fetches should not run before protected shell entry.

## Rate Limit / Debounce / Throttle / Circuit Breaker Audit

Existing controls:

- `fetcher.ts` has retry caps and exponential backoff for network/502/503/504 failures.
- `fetcher.ts` performs a single 401 refresh attempt.
- `useDaily.ts`, `useStatic.ts`, and several product SWR paths disable focus refetch.
- `prevWorkoutFetch.ts` caps concurrent previous-workout calls at `PREV_WORKOUT_FETCH_CONCURRENCY = 4`.
- Attachment upload queues process explicit item lists sequentially in `runAttachmentUploadQueue(...)`.

Gaps:

- No global Supabase/backend request budget was found.
- No central request counter was found.
- No circuit breaker was found.
- No quota fallback or user-visible quota-degraded mode was found.
- No per-route request dedupe beyond SWR cache behavior was documented.
- No app-wide protection against many independent SWR hooks retrying at once was found.

Risk level: Medium. Some localized guards exist, but no app-wide quota control exists.

## Usage Monitoring / Observability Audit

No client-side Supabase request counting, quota dashboard integration, rate-limit alerting, or operational runbook was found in current source.

Relevant historical docs:

- `frontend/docs/K-91F-health-request-fanout-audit.md`
- `frontend/docs/K-91G-auth-verification-optimization.md`
- `frontend/docs/K-91G-pre-merge-verification.md`

These docs show prior awareness of Supabase Auth pressure, but K-296 did not find a current product-level monitoring or alerting implementation. K-297 should plan observability and traffic controls before broad optimization work.

## Risk Matrix

| Area | Source path | Trigger | Frequency risk | Quota impact risk | Existing guard | Gap | Recommended next action |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Auth/session | `frontend/src/App.tsx`, `frontend/src/lib/supabase.ts` | App mount and every `authFetch` | Medium | Medium | Mount effect, auth-state cleanup, local remote pause | Per-request session lookup needs real SDK behavior verification | Measure/session-call map in K-297 |
| App mount | `frontend/src/components/AppContent.tsx`, `frontend/src/hooks/useDaily.ts`, `frontend/src/hooks/useStatic.ts` | Authenticated app shell mount | Medium | Medium | `remoteSWRKey`, `revalidateOnFocus: false` | Multiple SWR hooks can fan out together | Plan mount request budget and dedupe review |
| Sync/table APIs | `frontend/src/lib/notesSyncClient.ts`, `frontend/src/store/useNotesStore.ts` | Remote/hybrid note sync and writes | Medium | Medium | Delta cursor, dirty selection foundations, local-first posture | Store cloud write paths still need traffic map | Plan Notes sync traffic audit/guard before expanding sync |
| Retry/polling | `frontend/src/lib/fetcher.ts`, `frontend/src/components/views/LegacyAnalyticsView.tsx` | Errors, legacy analytics view | Medium | Medium | `MAX_RETRIES = 3`, backoff, one 401 refresh | No global retry budget; legacy refresh interval exists | Plan retry budget and legacy polling decision |
| Realtime | `frontend/src/App.tsx` | Auth-state subscription | Low | Low | Unsubscribe cleanup | No table realtime found | Keep no-realtime posture unless explicitly planned |
| Storage | `frontend/src/lib/googleDriveBlobAdapter.ts` | Manual/explicit remote attachment actions | Low for Supabase, Medium for provider | Low for Supabase | Provider abstraction, explicit actions | No Supabase storage, no provider-wide quota monitor | Keep Supabase storage out of scope; document provider quota separately |
| Unauthenticated traffic | `frontend/src/App.tsx`, `frontend/src/components/views/LoginScreen.tsx` | Initial visit, login/sign-up action | Low to Medium | Low to Medium | Protected shell gate, user-triggered login | Auth session still checked on initial unauthenticated mount | Track auth request counts in release QA |
| Monitoring/observability | docs/source | Operational review | Unknown | Unknown | Historical K-91F/K-91G docs | No current request counter/runbook | K-297 should plan monitoring checklist |

## K-297 Decision

Recommended: **K-297 Supabase Usage / Traffic Control Plan**.

Scope:

- docs/plan plus audit test only.
- define exact mitigation order:
  - request map.
  - no duplicate mount calls.
  - SWR focus/polling policy.
  - debounce/throttle where needed.
  - retry caps and global retry budget.
  - circuit breaker/fallback design.
  - monitoring checklist and manual dashboard checks.
- no runtime changes.

Alternative if a specific high-risk source is chosen after review: **K-297 Supabase Legacy Analytics Polling Patch Plan** or **K-297 Supabase Health Request Fanout Guard Plan**.

Alternative if source facts are judged sufficient and low-risk: **K-297 Supabase Usage Guard Implementation**, requiring Codex 5.5 high and a tiny implementation scope.

Not recommended:

- broad sync rewrite.
- remote-first note hydration.
- Cloudflare/Firebase migration before source risks are known.
- disabling auth.
- production bypass.
- credential/env changes.

## Non-goals

K-296 has no Supabase runtime behavior change, no request frequency change, no auth/session behavior change, no sync behavior change, no retry/polling behavior change, no circuit breaker implementation, no quota fallback implementation, no monitoring implementation, no Supabase config/env change, no database/RLS/migration change, no Cloudflare/Firebase migration, no Notes runtime change, no local persistence change, no backup/export/import/restore behavior change, no attachment/provider behavior change, no Signal Panel change, no Health/Schedule change, no assets/fonts/dependencies, and no generated artifacts.

## Closure Statement

K-296 locks Supabase usage, quota, and traffic source facts only. No traffic optimization is implemented yet. Protected auth posture from K-289 through K-295 remains unchanged. Local-first data ownership remains preserved. Remote systems remain support layers.

K-297 should plan targeted traffic control based on this audit. Product work should not add broad Supabase traffic until quota risks are understood.
