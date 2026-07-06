# K-287 Auth/Supabase Runtime Access Restoration Source Facts Audit

## Purpose

K-287 source-audits current auth/Supabase runtime access facts before restoration implementation.

K-287 follows the K-286 Auth/Supabase Runtime Access Restoration Boundary Plan.

K-287 is docs/source audit plus audit test only. K-287 does not implement auth restoration. K-287 does not change runtime auth behavior. K-287 does not change route guards. K-287 does not remove the local-mode bypass. K-287 does not change the Supabase session gate. K-287 does not add mock auth provider implementation. K-287 does not add test credentials. K-287 does not add Playwright/browser auth helpers. K-287 does not add a production bypass flag. K-287 does not add frontend secret/service-role keys.

K-287 chooses the K-288 next path: Auth/Supabase Runtime Access Restoration Implementation Plan.

## Current Source Facts Summary

Inspected paths:

- `frontend/src/App.tsx`
- `frontend/src/main.tsx`
- `frontend/src/lib/localAuth.ts`
- `frontend/src/lib/syncMode.ts`
- `frontend/src/lib/remoteBoundary.ts`
- `frontend/src/lib/supabase.ts`
- `frontend/src/hooks/useDaily.ts`
- `frontend/src/hooks/useStatic.ts`
- `frontend/src/components/AppContent.tsx`
- `frontend/src/components/views/LoginScreen.tsx`
- `frontend/src/components/common/LoginScreen.tsx`
- `frontend/src/App.localAuth.test.ts`
- `frontend/src/lib/localAuth.test.ts`
- `frontend/src/lib/supabaseBoundary.test.ts`
- `frontend/src/lib/authSupabaseRuntimeAccessRestorationBoundaryPlan.test.ts`

Source-grounded facts:

- `frontend/src/main.tsx` mounts `App` directly under `ThemeProvider`; no router table is present in the inspected entry point.
- `frontend/src/App.tsx` owns top-level auth branching between loading, login, and `AppContent`.
- `frontend/src/App.tsx` can render `AppContent` without a Supabase session when `isLocalOnlyRuntime()` is true.
- `frontend/src/lib/localAuth.ts` synthesizes a Supabase-shaped local user for local mode.
- `frontend/src/lib/syncMode.ts` selects sync mode from localStorage, then `VITE_ABSINTHE_SYNC_MODE`, then defaults to `local`.
- `frontend/src/lib/supabase.ts` creates the Supabase client from `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
- `frontend/src/lib/supabase.ts` reads a Supabase session inside `authFetch`, but only after `shouldUseRemoteData()` allows remote access.
- `frontend/src/components/views/LoginScreen.tsx` is the current app-level login screen imported by `App.tsx`.
- `frontend/src/components/common/LoginScreen.tsx` exists but is not the login screen imported by `App.tsx`.
- No app auth callback route file was found in the inspected app shell. Google Drive OAuth callback utilities exist for attachment provider work, not app Supabase login routing.
- `frontend/src/App.localAuth.test.ts` covers local-mode app-shell access without touching Supabase auth and explicit remote-mode login fallback.
- `frontend/src/lib/localAuth.test.ts` covers default local mode, local user shape, and explicit remote mode not being local-only.
- `frontend/src/lib/supabaseBoundary.test.ts` covers local-mode `authFetch` pausing before Supabase session lookup and remote-mode session usage.

Current no-login access is therefore explicit: default local sync mode flows through `App.tsx` into a synthesized local user and then into `AppContent`.

## App Shell Access Audit

Exact file path:

- `frontend/src/App.tsx`

`App.tsx` defines:

- `authUser` state.
- `authLoading` state.
- an effect that first checks `isLocalOnlyRuntime()`.
- a local branch that calls `setAuthUser(createLocalAuthUser())`, sets loading false, and returns before Supabase auth calls.
- a remote/hybrid branch that calls `supabase.auth.getSession()` and subscribes through `supabase.auth.onAuthStateChange(...)`.
- a loading screen while `authLoading` is true.
- a final render branch: `!authUser ? <LoginScreen /> : <AppContent authUser={authUser} />`.

Current app shell can render without a Supabase session when local mode is active. Because `resolveNotesRuntimeSyncMode()` defaults to `local`, this appears production-reachable unless deployment configuration or runtime localStorage overrides it.

Session loading state exists. In local mode it is resolved immediately by synthesizing the local user. In remote/hybrid mode it resolves after Supabase session lookup or failure.

Unauthenticated users can reach product surfaces in current default local mode because `AppContent` receives the local user.

K-287 must not change `frontend/src/App.tsx`.

## localAuth.ts Audit

Exact file path:

- `frontend/src/lib/localAuth.ts`

Exports:

- `LOCAL_AUTH_USER_ID`
- `LOCAL_AUTH_EMAIL`
- `isLocalOnlyRuntime()`
- `createLocalAuthUser()`

`isLocalOnlyRuntime()` returns true when `resolveNotesRuntimeSyncMode() === 'local'`.

`createLocalAuthUser()` returns a Supabase `User`-shaped object with:

- id `local-user`.
- email `local@absinthe.dev`.
- `aud` and `role` set to `authenticated`.
- local provider metadata.

This is synthesized authenticated state. It is not a Supabase session. It is not restricted to tests. It is runtime code used by `App.tsx`.

Future restoration must decide whether local mode may still exist for local-first data while no longer granting protected app shell access without a Supabase session. Future restoration must not confuse local-first data ownership with unauthenticated product access.

Uncertainty: the final desired local development access path is not implemented. It must be defined as test/dev-only and must not become a production bypass.

K-287 must not change `frontend/src/lib/localAuth.ts`.

## syncMode.ts Audit

Exact file path:

- `frontend/src/lib/syncMode.ts`

Exports:

- `NOTES_RUNTIME_SYNC_MODE_KEY`
- `NotesRuntimeSyncMode`
- `isNotesRuntimeSyncMode(...)`
- `resolveNotesRuntimeSyncMode()`
- `isNotesCloudSyncEnabled()`

Sync mode selection order:

1. localStorage key `absinthe-notes-sync-mode`.
2. `import.meta.env.VITE_ABSINTHE_SYNC_MODE`.
3. default `local`.

Because `localAuth.ts` derives local-only runtime from this mode, sync mode currently controls whether `App.tsx` bypasses Supabase session lookup.

The mode is both user/runtime-controlled through localStorage and configuration-controlled through Vite env. Future implementation must not use sync mode as a production auth bypass. It must also not break local-first Notes durability or future explicit remote/hybrid sync work.

K-287 must not change `frontend/src/lib/syncMode.ts`.

## Supabase Client / Session Audit

Exact file path:

- `frontend/src/lib/supabase.ts`

Supabase client initialization uses:

- `import.meta.env.VITE_SUPABASE_URL`
- `import.meta.env.VITE_SUPABASE_ANON_KEY`

No Supabase URL, anon key, service role key, password, access token, refresh token, or client secret is documented here.

Session reads occur in:

- `frontend/src/App.tsx` via `supabase.auth.getSession()`.
- `frontend/src/App.tsx` via `supabase.auth.onAuthStateChange(...)`.
- `frontend/src/lib/supabase.ts` via `supabase.auth.getSession()` inside `authFetch`.

Authenticated user/session enters runtime state in `frontend/src/App.tsx` through `setAuthUser(session?.user ?? null)` in remote/hybrid mode. Missing session blocks `AppContent` only when local mode is not active.

`authFetch` requires a Supabase access token only when `shouldUseRemoteData()` allows remote access. In local mode, it throws `LocalOnlyRemoteMutationPausedError` before session lookup.

Login exists through `frontend/src/components/views/LoginScreen.tsx`, which calls `supabase.auth.signUp(...)` or `supabase.auth.signInWithPassword(...)`.

Logout exists in `frontend/src/components/AppContent.tsx` through `handleSignOut`, but it returns early in local-only runtime and calls `supabase.auth.signOut()` otherwise.

No app Supabase auth callback route was found in the inspected source. Future implementation must verify whether Supabase email/password only is intended or whether callback routes are required before guarding.

K-287 must not change `frontend/src/lib/supabase.ts`.

## Public Surface Audit

Source-grounded public surfaces:

- `frontend/src/components/views/LoginScreen.tsx`: current app-level login/sign-up surface imported by `App.tsx`. It must remain public after restoration.
- `frontend/src/components/common/LoginScreen.tsx`: older/common login component still present. If reachable, it must remain public; if unreachable, K-288 should document whether it remains legacy.

Source-grounded callback surfaces:

- No app Supabase auth callback route file was identified in the inspected app shell.
- `frontend/src/lib/googleDriveOAuthCallback.ts` exists, but it belongs to manual Google Drive provider connection and should not be treated as the app Supabase auth callback.
- `frontend/src/components/views/noteview/GoogleDriveManualConnectionPanel.tsx` accepts Google Drive callback URLs for explicit attachment provider sessions; it is not an app-login public route.

Implementation risk: a future broad app-shell guard must not block whatever Supabase auth callback, password reset, or magic link callback route is added or discovered.

## Protected Surface Candidate Audit

Protected candidates are all surfaces reachable from `frontend/src/components/AppContent.tsx`:

- `frontend/src/components/AppContent.tsx`: main protected app shell candidate. Currently reachable without Supabase login in local mode.
- `frontend/src/components/views/HomeView.tsx`: rendered from `AppContent`; should require authenticated Supabase session after restoration.
- `frontend/src/components/views/NoteView.tsx`: Notes workspace rendered from `AppContent`; currently local-first and should require app access auth without becoming remote-first.
- `frontend/src/components/views/HealthView.tsx`: Health workspace rendered from `AppContent`; should require authenticated app access after restoration.
- `frontend/src/components/views/PlannerView.tsx`: Schedule/Planner workspace rendered from `AppContent`; should require authenticated app access after restoration.
- `frontend/src/components/views/AnalyticsView.tsx`: Archive/Analytics workspace rendered from `AppContent`; should require authenticated app access after restoration.
- `frontend/src/components/views/RecipeView.tsx`: Recipe workspace rendered from `AppContent`; should require authenticated app access after restoration.
- `frontend/src/components/views/SettingsView.tsx`: Settings and data safety surfaces rendered from `AppContent`; should require authenticated app access after restoration.
- `frontend/src/components/views/noteview/EmbeddedAttachmentMigrationReviewPanel.tsx`: attachment maintenance/recovery/upload surface reachable through Notes; should remain protected by app shell and keep explicit provider-session gating.

There is no route table separating these surfaces today; access is tab-based inside `AppContent`.

## AI / Codex Verification Blocker Audit

K-286 records that no-login local-mode access exists and that future manual/browser proof may need Supabase env and credentials. Source/tests show local-mode app boot currently makes automated app-shell rendering possible without calling Supabase auth.

The source does not contain a dedicated AI/Codex auth verification helper. The current local-mode path solves test/browser access by entering product surfaces with a synthesized local user, but that is a current runtime posture, not a desired production access policy.

Future verification need:

- deterministic app-shell testing without committed real credentials.
- browser QA path that does not weaken production auth.
- optional manual Supabase QA using configured environment and test account.

Must not be done:

- no production bypass flag.
- no frontend service-role key.
- no real credentials committed.
- no broad auth-disabled mode in production.
- no query-param or localStorage production bypass for protected app access.

## Test / Dev Verification Strategy Candidates

Candidates only; K-287 implements none.

- Test-only mock session helper: source-supported by existing Vitest mocks in `frontend/src/App.localAuth.test.ts`; low risk if test-only and excluded from runtime bundle.
- Test-only auth provider wrapper: not currently source-supported because there is no auth provider abstraction; medium risk because adding one could become architecture work.
- Local dev fixture session: not currently implemented; medium risk because it may leak into production if controlled by broad env/localStorage flags.
- Playwright storage state or browser auth helper: source-adjacent through `frontend/scripts/productQaCapture.mjs`, which injects Supabase session for product QA; medium risk and should remain explicit tooling, not runtime code.
- Supabase test user manual QA: source-independent; low runtime risk if credentials remain outside the repo.
- Route-level test harness: not currently source-supported because there is no router table; medium risk and should wait until the route/public allowlist is defined.

Future work should prefer explicit test/dev-only mocks or external QA tooling over runtime bypasses.

## Production Bypass Risk Audit

Risk points:

- `localAuth.ts` behavior is runtime code, not test-only.
- `syncMode.ts` defaults to local, causing the local auth branch to be default behavior.
- localStorage key `absinthe-notes-sync-mode` can influence whether Supabase session lookup is skipped.
- `VITE_ABSINTHE_SYNC_MODE` can influence whether Supabase session lookup is skipped.
- `App.tsx` can render `AppContent` before Supabase session lookup in local mode.
- no route guard or router table currently separates public and protected surfaces.
- a future guard might accidentally block auth callback or password reset routes.
- tests currently assert no-login local app-shell access, so implementation will require test updates or test-only helpers.
- fake/mock session helpers could leak into runtime if not kept in tests/tooling.
- service-role or secret keys must never be introduced into frontend code.
- missing Supabase env must not silently widen protected app access in production.

## Local-first Boundary Audit

Auth restoration must not make Notes remote-first.

Auth restoration must not:

- fetch all notes from Supabase at boot.
- rewrite local vault persistence.
- change `initNotesStorage()` / `hydrateFromDB()` ownership.
- alter backup/export/import/restore behavior.
- alter attachment blob/provider behavior.
- alter Google Drive explicit session provider behavior.
- alter local backup/preflight diagnostics.

Auth restoration only gates access/session. Local runtime data remains source of truth after authenticated entry. Remote systems remain support layers.

## Implementation Prerequisites

Before any implementation, K-288/K-289 must lock:

- exact protected gate file.
- exact public route allowlist.
- exact session loading behavior.
- redirect or login-render behavior.
- callback behavior.
- logout behavior.
- tests for unauthenticated and authenticated access.
- test/dev verification strategy.
- manual Supabase QA requirements.
- no secrets/env changes.
- no local-first data behavior changes.
- migration path for tests that currently expect local no-login app-shell access.

## K-288 Decision

Recommended primary path:

**K-288 Auth/Supabase Runtime Access Restoration Implementation Plan**

Scope:

- docs/plan plus audit test only.
- define exact files to change, public allowlist, protected gate, session loading state, tests, manual QA, and rollback risks.
- no runtime changes.

This is recommended because K-287 identifies the source facts, but implementation still needs an exact patch contract for `App.tsx`, local-mode semantics, test/dev verification, and public callback handling.

Alternative:

**K-288 Auth/Supabase Runtime Access Restoration Source Facts Closure Audit**

Scope:

- docs/audit plus source test only.
- close remaining uncertainties before implementation.

Alternative:

**K-288 Auth/Supabase Runtime Access Restoration Implementation Prep**

Scope:

- docs/plan plus focused test skeleton only.
- still no behavior change.

Not recommended yet:

- K-288 direct implementation. Direct implementation should wait until the public allowlist, test/dev strategy, and local-mode replacement semantics are explicit.

## Non-goals

K-287 has these explicit non-goals:

- no auth restoration implementation in K-287.
- no local-mode bypass removal.
- no Supabase session gate change.
- no route guard change.
- no mock auth provider implementation.
- no test credentials.
- no Playwright/browser auth helper.
- no production bypass flag.
- no frontend secret/service-role key.
- no Supabase client/config change.
- no OAuth callback change.
- no env changes.
- no database/RLS/migration changes.
- no Notes runtime change.
- no local persistence change.
- no backup/export/import/restore behavior change.
- no provider recovery change.
- no attachment blob/provider behavior change.
- no Signal Panel change.
- no NotesOverviewSignalPanel mount.
- no Health/Schedule change.
- no assets/fonts/dependencies.
- no generated artifacts.

## Closure Statement

K-287 locks source facts only.

K-287 does not restore auth behavior yet. Current local/no-login access structure is documented from source. Protected, public, and test/dev boundaries are identified. Future restoration must protect product surfaces while keeping login/callback public. AI/Codex verification should be solved with test/dev-only strategy, not production bypass. Auth restoration must preserve local-first data ownership. Backup/provider/Signal Panel remain untouched. Local runtime data remains source of truth. Remote systems remain support layers.
