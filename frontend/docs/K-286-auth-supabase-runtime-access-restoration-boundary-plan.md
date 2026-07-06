# K-286 Auth/Supabase Runtime Access Restoration Boundary Plan

## Purpose

K-286 plans restoration of intended Supabase-authenticated runtime access after the K-278 through K-285 Notes Overview / Signal Panel isolated component line closed.

K-286 is docs/plan plus audit test only. K-286 does not implement auth restoration. K-286 does not change runtime auth behavior. K-286 does not implement a route guard. K-286 does not modify the Supabase client/config. K-286 does not modify OAuth callback behavior. K-286 does not change session persistence. K-286 does not change database/RLS/migrations.

K-286 chooses the K-287 next path: Auth/Supabase Runtime Access Restoration Source Facts Audit.

## Current State Summary

Source inspection shows that the app currently allows product app shell access without a Supabase login when the Notes runtime sync mode resolves to local.

Inspected files:

- `frontend/src/App.tsx`
- `frontend/src/lib/localAuth.ts`
- `frontend/src/lib/syncMode.ts`
- `frontend/src/lib/remoteBoundary.ts`
- `frontend/src/lib/supabase.ts`
- `frontend/src/components/AppContent.tsx`
- `frontend/src/components/views/LoginScreen.tsx`
- `frontend/src/components/common/LoginScreen.tsx`
- `frontend/src/hooks/useDaily.ts`
- `frontend/src/hooks/useStatic.ts`
- `frontend/src/App.localAuth.test.ts`
- `frontend/src/lib/localAuth.test.ts`
- `frontend/src/lib/supabaseBoundary.test.ts`
- `frontend/src/main.tsx`

Observed behavior from source:

- `frontend/src/App.tsx` checks `isLocalOnlyRuntime()` during app boot.
- If local-only mode is active, `App.tsx` calls `createLocalAuthUser()`, sets `authLoading` to false, and returns before Supabase auth is queried.
- `frontend/src/lib/localAuth.ts` creates a Supabase-shaped local user with id `local-user` and email `local@absinthe.dev`.
- `frontend/src/lib/syncMode.ts` defaults `resolveNotesRuntimeSyncMode()` to `local` when no explicit localStorage or environment mode is set.
- `frontend/src/App.localAuth.test.ts` locks the current behavior: local mode boots the app shell with a local user and does not call Supabase auth.
- The same test confirms explicit remote mode still shows the login gate when Supabase auth fails.
- `frontend/src/lib/supabase.ts` keeps `authFetch` behind `shouldUseRemoteData()` so local mode remote mutations are paused before Supabase session lookup.
- `frontend/src/hooks/useDaily.ts` and `frontend/src/hooks/useStatic.ts` use `remoteSWRKey(...)`, so local mode avoids remote SWR keys for daily/static API reads.
- `frontend/src/components/AppContent.tsx` treats the passed `authUser` as the product user and skips `supabase.auth.signOut()` in local-only runtime.

The bypass source is explicit, not merely a missing route guard. The explicit source is the local runtime branch in `frontend/src/App.tsx`, backed by `frontend/src/lib/localAuth.ts` and `frontend/src/lib/syncMode.ts`.

There is no file-based route map in the inspected app shell. `frontend/src/main.tsx` mounts `App`, and `frontend/src/components/AppContent.tsx` switches product workspaces through internal tab state. K-287 must lock the exact route/surface map before implementation.

Existing tests cover the current local-mode bypass and remote-mode login gate, but they do not yet define the intended restored authenticated access posture.

## Intended Restoration Goal

The target product posture is:

- unauthenticated users should not access protected app surfaces by default.
- an authenticated Supabase session should be required for protected runtime surfaces.
- login/auth entry should remain accessible.
- auth callback/session recovery should remain accessible if present.
- logout should return the user to unauthenticated state.
- local-first note data must remain local-first after auth restoration.
- auth restoration must not convert Notes to remote-first.
- backup/preflight behavior must not be changed.
- Signal Panel remains unmounted and unrelated.

Auth restoration controls access/session gating only. It must not alter local runtime data ownership.

## Protected Versus Public Surfaces

Source-grounded public or unauthenticated-allowed surfaces:

- `frontend/src/components/views/LoginScreen.tsx`
- `frontend/src/components/common/LoginScreen.tsx` if still reachable or retained.
- Auth callback/session recovery route if one is added or identified in K-287.
- Password reset or magic link callback if one is added or identified in K-287.

Source-grounded protected surfaces:

- `frontend/src/components/AppContent.tsx`
- Home workspace rendered from `AppContent`.
- Notes workspace rendered from `AppContent`.
- Health workspace rendered from `AppContent`.
- Schedule/Planner workspace rendered from `AppContent`.
- Archive/Analytics workspace rendered from `AppContent`.
- Recipe workspace rendered from `AppContent`.
- Settings workspace rendered from `AppContent`.
- Attachment and local vault maintenance surfaces reachable from the app shell.

The route structure is currently not a router table. K-287 must lock the exact public/protected surface map before implementation.

## Current Bypass / Access Audit

Current no-login access is explicit production runtime behavior for default local mode.

Exact source files:

- `frontend/src/App.tsx` allows app shell access without Supabase login when `isLocalOnlyRuntime()` is true.
- `frontend/src/lib/localAuth.ts` defines the local user and local-only runtime predicate.
- `frontend/src/lib/syncMode.ts` defaults Notes runtime sync mode to `local`.
- `frontend/src/App.localAuth.test.ts` asserts local mode does not touch Supabase auth and still renders app shell.

Bypass classification:

- explicit: yes.
- implicit missing guard: partly yes at the app-shell level because local mode intentionally enters `AppContent`, but the primary source is explicit local-auth branching.
- test-only: no. The branch is in `App.tsx` runtime code.
- production runtime: yes, because the default sync mode is local unless overridden.
- env/dev affected: yes. `VITE_ABSINTHE_SYNC_MODE`, localStorage key `absinthe-notes-sync-mode`, and default local mode affect the branch.
- Supabase client/session touched: no in default local mode; `App.tsx` returns before `supabase.auth.getSession()` and `onAuthStateChange(...)`.
- local persistence touched: indirectly yes, because `AppContent` boots local Notes storage after the local user is created. K-286 does not change this.
- note runtime state touched: indirectly yes, because protected app shell opens Notes runtime. K-286 does not change this.

## Supabase / Auth Boundary

Supabase should remain the auth/session source for authenticated runtime access.

K-286 makes no Supabase schema/database/RLS changes. K-286 makes no provider/OAuth scope changes. K-286 makes no Google Drive/OAuth attachment recovery changes. K-286 makes no backup/provider recovery changes. K-286 commits no secrets or env values.

Future implementation must avoid hardcoding Supabase URLs or keys beyond the existing environment pattern in `frontend/src/lib/supabase.ts`.

## Local-first Data Boundary

Notes/local runtime data remains source of truth.

Auth restoration must not:

- force remote-first note hydration.
- fetch all notes from Supabase at boot.
- rewrite local vault persistence.
- alter backup/export/import/restore behavior.
- alter attachment blob/provider behavior.
- alter Google Drive recovery/upload behavior.
- alter remote sync queue behavior.

Auth restoration only controls access/session gating. Remote systems remain support layers.

## Implementation Risk Analysis

Risks for a future implementation PR:

- route guard accidentally blocks auth callback.
- app shell flashes protected content before session resolution.
- session loading state creates an infinite redirect or dead screen.
- existing tests rely on no-login access in default local mode.
- local-first data gets coupled to remote session or remote hydration.
- dev/test harnesses need authenticated mocks.
- E2E/browser QA may need Supabase test credentials.
- environment variables may be missing locally.
- OAuth callback mismatch may break login flow.
- logout behavior currently no-ops in local-only runtime, so restored auth must define the desired logged-out state clearly.
- data hooks that use `remoteSWRKey(...)` must remain local-mode safe.

## Proposed Restoration Strategy

K-286 does not implement this strategy.

Recommended future strategy:

1. Identify existing auth provider/session state and exact app-shell boundary.
2. Restore a single protected-app gate around `AppContent` or the protected route/surface wrapper.
3. Keep login/auth callback public.
4. Add explicit loading/session-resolving state.
5. Redirect or render login for unauthenticated protected access.
6. Preserve local-first runtime data behavior after authenticated entry.
7. Keep `authFetch`, `remoteSWRKey`, and local Notes durability guards intact.
8. Add focused tests for authenticated and unauthenticated paths.
9. Avoid data migration, provider behavior, backup behavior, or note storage changes.

## Future Test Plan

Expected K-287/K-288 implementation tests:

- unauthenticated user is blocked from protected app shell.
- unauthenticated user can access login/auth callback.
- authenticated session can access app shell.
- session loading state does not flash protected app content.
- logout returns to login/unauthenticated state.
- local-first note behavior is unchanged.
- local mode does not trigger remote Notes reads/writes unless explicitly approved by a later sync milestone.
- Signal Panel remains unmounted.
- backup/export/import tests remain unchanged.
- no secrets or env values are committed.
- Supabase unavailable state is handled intentionally and visibly.

## Manual / Browser QA Requirements

Manual browser QA is not required for K-286 because K-286 has no runtime/browser behavior changes.

Before merging a future implementation PR:

- run the app locally with Supabase env configured.
- verify logged-out visit redirects to or shows login.
- verify login flow works.
- verify callback does not get blocked.
- verify logout works.
- verify refresh preserves session if intended.
- verify protected pages are inaccessible when logged out.
- verify local-first Notes data remains intact after authenticated entry.
- verify no generated artifacts or secrets are committed.
- if real Supabase credentials or a test account are unavailable, document the proof as blocked rather than faking runtime proof.

## K-287 Decision

Recommended primary path:

**K-287 Auth/Supabase Runtime Access Restoration Source Facts Audit**

Scope:

- docs/audit plus source test only.
- lock exact files, route map, auth provider/session state, and test strategy before implementation.
- no runtime changes.

This is recommended because K-286 found the explicit local-auth bypass, but the app has no conventional route table and K-287 should lock the exact public/protected map before changing runtime access.

Alternative:

**K-287 Auth/Supabase Runtime Access Restoration Plan**

Scope:

- docs/plan plus audit test.
- define exact implementation patch boundaries and acceptance criteria.
- no runtime changes.

Alternative:

**K-287 Auth/Supabase Runtime Access Restoration Implementation**

Scope:

- small implementation.
- restore protected access gate.
- preserve login/callback.
- focused tests.
- requires Codex 5.5 high.

Not recommended as the default next step until the route/surface map and test harness are locked.

## Non-goals

K-286 has these explicit non-goals:

- no auth runtime behavior change in K-286.
- no route guard implementation.
- no login page modification.
- no logout behavior modification.
- no OAuth callback modification.
- no Supabase client/config modification.
- no env variable changes.
- no secrets committed.
- no database/RLS/migration changes.
- no remote-first note hydration.
- no note store changes.
- no local persistence changes.
- no backup/export/import/restore behavior changes.
- no attachment blob/provider behavior changes.
- no provider recovery behavior changes.
- no Google Drive upload/recovery behavior changes.
- no Signal Panel changes.
- no NotesOverviewSignalPanel mount.
- no Notes runtime changes.
- no Health/Schedule changes.
- no assets/fonts/dependencies.
- no generated artifacts.

## Closure Statement

K-286 defines auth/Supabase restoration boundaries only.

K-286 does not restore auth behavior yet. Future implementation must restore protected runtime access without changing local-first data ownership. Login/auth callback must remain public. Protected app surfaces must require an authenticated Supabase session. Backup/preflight and provider recovery remain untouched. Signal Panel line remains paused and unmounted. Local runtime data remains source of truth. Remote systems remain support layers.
