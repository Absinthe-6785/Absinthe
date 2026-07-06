# K-288 Auth/Supabase Runtime Access Restoration Implementation Plan

## Purpose

K-288 plans the implementation for restoring Supabase-authenticated runtime access.

K-288 follows the K-287 Auth/Supabase Runtime Access Restoration Source Facts Audit.

K-288 is docs/plan plus audit test only. K-288 does not implement auth restoration. K-288 does not change runtime auth behavior. K-288 does not change `frontend/src/App.tsx`. K-288 does not change `frontend/src/lib/localAuth.ts`. K-288 does not change `frontend/src/lib/syncMode.ts`. K-288 does not change `frontend/src/lib/supabase.ts`. K-288 does not implement a route guard. K-288 does not add mock auth provider implementation. K-288 does not add test credentials. K-288 does not add a production bypass flag. K-288 does not add frontend secret/service-role keys.

K-288 chooses the K-289 next path: Auth/Supabase Runtime Access Gate Restoration Implementation.

## Current Source Facts Recap

Inspected source paths:

- `frontend/src/App.tsx`
- `frontend/src/main.tsx`
- `frontend/src/lib/localAuth.ts`
- `frontend/src/lib/syncMode.ts`
- `frontend/src/lib/remoteBoundary.ts`
- `frontend/src/lib/supabase.ts`
- `frontend/src/components/AppContent.tsx`
- `frontend/src/components/views/LoginScreen.tsx`
- `frontend/src/components/common/LoginScreen.tsx`
- `frontend/src/lib/googleDriveOAuthCallback.ts`
- `frontend/src/components/views/noteview/GoogleDriveManualConnectionPanel.tsx`
- `frontend/src/App.localAuth.test.ts`
- `frontend/src/lib/localAuth.test.ts`
- `frontend/src/lib/supabaseBoundary.test.ts`
- `frontend/src/lib/authSupabaseRuntimeAccessRestorationBoundaryPlan.test.ts`
- `frontend/src/lib/authSupabaseRuntimeAccessRestorationSourceFactsAudit.test.ts`

K-287 source facts to preserve:

- `frontend/src/main.tsx` mounts `App` directly under `ThemeProvider`; no router table is present in the inspected entry point.
- `frontend/src/App.tsx` owns top-level auth branching between loading, login, and `AppContent`.
- `frontend/src/App.tsx` currently checks `isLocalOnlyRuntime()` first. If true, it calls `setAuthUser(createLocalAuthUser())`, sets loading false, and returns before Supabase auth calls.
- `frontend/src/App.tsx` uses `supabase.auth.getSession()` and `supabase.auth.onAuthStateChange(...)` only in the remote/hybrid branch.
- `frontend/src/lib/localAuth.ts` synthesizes a Supabase-shaped local user with id `local-user`, email `local@absinthe.dev`, authenticated role/aud, and local provider metadata.
- `frontend/src/lib/syncMode.ts` selects mode from localStorage key `absinthe-notes-sync-mode`, then `import.meta.env.VITE_ABSINTHE_SYNC_MODE`, then defaults to `local`.
- `frontend/src/lib/supabase.ts` creates the Supabase client from `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
- `frontend/src/lib/supabase.ts` reads a Supabase session inside `authFetch`, but only after `shouldUseRemoteData()` allows remote access.
- `frontend/src/components/views/LoginScreen.tsx` is the current app-level login/sign-up surface imported by `App.tsx`.
- No app Supabase auth callback route file was found in the inspected app shell. Google Drive callback utilities belong to manual attachment provider connection and are not app-login callback routes.
- `frontend/src/components/AppContent.tsx` receives `authUser`, initializes the protected workspace shell, and no-ops logout when `isLocalOnlyRuntime()` is true.
- AI/Codex browser verification can be blocked by login once auth is restored. K-287 found no dedicated runtime verification helper.

The current no-login access path is explicit: default local sync mode can enter `AppContent` through `createLocalAuthUser()`. K-288 treats this as the current source fact to replace in K-289, not as the desired permanent product posture.

## Restoration Target

The intended product posture after K-289:

- Protected product surfaces require an authenticated Supabase session.
- Login/auth entry remains public.
- Auth callback surfaces remain public if added or discovered.
- Password reset and magic link callback surfaces remain public if added or discovered.
- Logout clears or invalidates the Supabase session and returns to unauthenticated state.
- Session loading must not flash protected app content.
- Missing Supabase session or missing auth environment must fail closed for protected app access, not open broadly.
- Local-first Notes runtime ownership remains unchanged after authenticated entry.
- Local mode may still control Notes data sync/local runtime behavior after app access is authenticated.
- Signal Panel remains unrelated, isolated, and unmounted.
- Backup, export, import, restore, preflight, provider recovery, Google Drive OAuth/upload/recovery, Health, and Schedule behavior remain unchanged.

Auth restoration gates access/session only. It must not make Notes remote-first.

## Protected / Public Surface Plan

Planned public surfaces:

- `frontend/src/components/views/LoginScreen.tsx`: current app-level login/sign-up surface imported by `App.tsx`.
- `frontend/src/components/common/LoginScreen.tsx`: older/common login component if retained or reachable; K-289 should not accidentally protect it if it remains a login surface.
- App Supabase auth callback route: none was found in the inspected app shell. If K-289 adds or discovers one, it must be public.
- Password reset or magic link route: none was found in the inspected app shell. If K-289 adds or discovers one, it must be public.
- Explicit public landing/help route: none was found in the inspected app shell. If one is added later, it needs an explicit allowlist decision.

Planned protected surfaces:

- `frontend/src/components/AppContent.tsx`: protected app shell.
- `frontend/src/components/views/HomeView.tsx`: rendered from `AppContent`.
- `frontend/src/components/views/NoteView.tsx`: Notes workspace rendered from `AppContent`.
- `frontend/src/components/views/HealthView.tsx`: Health workspace rendered from `AppContent`.
- `frontend/src/components/views/PlannerView.tsx`: Schedule/Planner workspace rendered from `AppContent`.
- `frontend/src/components/views/AnalyticsView.tsx`: Archive/Analytics workspace rendered from `AppContent`.
- `frontend/src/components/views/RecipeView.tsx`: Recipe workspace rendered from `AppContent`.
- `frontend/src/components/views/SettingsView.tsx`: Settings and Data Safety surfaces rendered from `AppContent`.
- `frontend/src/components/views/noteview/EmbeddedAttachmentMigrationReviewPanel.tsx`: attachment maintenance/recovery/upload surface reachable through Notes.
- Local vault, local persistence, and product data maintenance surfaces reachable from the app shell.

Because the app currently has no router table, the primary K-289 gate should be the existing `App.tsx` branch that decides whether to render `LoginScreen` or `AppContent`. If K-289 introduces an app auth callback path, the public allowlist must be explicit before any broad protected-shell redirect.

## App.tsx Restoration Plan

Exact source file:

- `frontend/src/App.tsx`

Current decision point:

- The `useEffect` checks `if (isLocalOnlyRuntime())`.
- That branch calls `setAuthUser(createLocalAuthUser())`, sets `authLoading` false, and returns before `supabase.auth.getSession()` and `supabase.auth.onAuthStateChange(...)`.
- The final render is `!authUser ? <LoginScreen /> : <AppContent authUser={authUser} />`.

K-289 planned change:

- Remove local sync mode as a protected app-shell entry substitute.
- Require a Supabase-authenticated session before rendering protected `AppContent`.
- Continue using `authLoading` or an equivalent session-resolving state so protected content does not flash before session resolution.
- Use `supabase.auth.getSession()` and `supabase.auth.onAuthStateChange(...)` as the app-shell session source.
- Render `LoginScreen` for unauthenticated protected access.
- Keep login/auth callback public. If there is still no router/callback surface, document that email/password login remains the only source-grounded app-login path.
- Avoid infinite redirect or loading loops. The unauthenticated state should settle visibly to `LoginScreen`.
- Preserve local-first runtime after authenticated entry. Once `AppContent` is reached by a real Supabase user, local Notes storage and local mode behavior remain owned by the existing Notes runtime.

K-289 should keep the patch small and centered on this decision point unless tests prove a tiny support change is necessary.

## localAuth.ts Plan

Exact source file:

- `frontend/src/lib/localAuth.ts`

Current behavior:

- `isLocalOnlyRuntime()` returns true when `resolveNotesRuntimeSyncMode() === 'local'`.
- `createLocalAuthUser()` returns a Supabase `User`-shaped object for local mode.
- The object is runtime code, not test-only code.

Preferred K-289 option:

- Do not delete `localAuth.ts` in K-289.
- Stop using `createLocalAuthUser()` as a production protected app-shell entry substitute.
- Leave `createLocalAuthUser()` available only if still needed by existing tests or later explicit test/dev tooling.
- If K-289 needs a test/dev helper, keep it separate from production runtime and explicitly test/dev-only.

Forbidden shortcuts:

- Do not keep local synthesized user as a production auth replacement.
- Do not add a production bypass flag.
- Do not add a frontend service-role key.
- Do not add committed credentials.
- Do not turn localStorage sync mode into an auth override.

## syncMode.ts Plan

Exact source file:

- `frontend/src/lib/syncMode.ts`

Current behavior:

- localStorage key `absinthe-notes-sync-mode`
- then `import.meta.env.VITE_ABSINTHE_SYNC_MODE`
- then default `local`

K-289 auth interpretation:

- Sync mode must not decide authentication.
- Local sync mode may still control Notes local-first data behavior after authenticated app entry.
- Remote/hybrid sync mode may still control remote-boundary behavior after authenticated app entry.
- Default `local` must not bypass protected app access.
- Avoid changing sync mode semantics in K-289 unless a narrow test requires an explicit auth/sync separation assertion.

The implementation target is not "remote mode means authenticated" and not "local mode means unauthenticated access." Auth is Supabase session state; sync mode is data/runtime sync posture.

## Supabase Session Plan

Exact source file:

- `frontend/src/lib/supabase.ts`

Current app-session source:

- `frontend/src/App.tsx` calls `supabase.auth.getSession()`.
- `frontend/src/App.tsx` subscribes through `supabase.auth.onAuthStateChange(...)`.
- `frontend/src/lib/supabase.ts` provides the shared `supabase` client and `authFetch`.

K-289 session target:

- Loading: app is resolving Supabase session and must not render protected `AppContent`.
- Authenticated: Supabase session has a user; render `AppContent` with the Supabase user.
- Unauthenticated: no session user; render public `LoginScreen` or route to public login.
- Error/unavailable: fail closed for protected surfaces and show public login/error state rather than entering `AppContent`.
- Auth-state changes: sign-in should move to `AppContent`; sign-out should return to unauthenticated state.

K-289 should not hardcode Supabase URL/key, add env files, commit secrets, change database/RLS/migrations, or alter the existing `authFetch` remote-boundary behavior unless a tiny test-support boundary is separately justified.

## Redirect / Access Behavior Plan

K-289 should define and test:

- Logged-out protected app visit renders login/auth screen or redirects to login.
- Login/auth surface does not redirect-loop.
- Auth callback surface remains public if present.
- Authenticated Supabase session reaches `AppContent`.
- Refresh preserves the authenticated session when Supabase SDK has a valid session.
- Logout calls Supabase sign-out when authenticated and returns to login/unauthenticated state.
- Missing env, missing session, or Supabase session failure does not grant protected app access.
- Local mode cannot independently enter `AppContent`.
- Session loading does not show protected content before session resolution.

Because the app currently has no router table, a login-render behavior is the likely smallest K-289 path. If redirect routing is introduced later, its public allowlist must be tested before merge.

## AI / Codex Test / Dev Verification Strategy

K-288 plans these candidates only. K-288 implements none.

Acceptable candidates for K-289 or later:

- Test-only mock Supabase session in Vitest for `App.tsx` and app-shell tests.
- Test-only auth provider wrapper if an implementation plan accepts the architecture cost.
- Test-only route/app-shell harness if a route layer is introduced.
- Playwright/browser storage state only as explicit QA tooling, not runtime code.
- Manual Supabase test account for browser QA when credentials are available outside the repo.
- Blocked-proof documentation when credentials or env are unavailable.

Forbidden:

- Production bypass flag.
- Query-param bypass.
- localStorage bypass that works in production.
- Broad auth-disabled runtime mode.
- Fake production session.
- Frontend service-role key.
- Committed email/password credentials.
- Committed access tokens, refresh tokens, client secrets, or callback URLs containing codes.

AI/Codex verification must be solved with test/dev-only strategy or explicit manual QA, not by weakening production auth.

## K-289 Implementation File List

K-289 may modify these files if needed:

- `frontend/src/App.tsx`
- `frontend/src/App.localAuth.test.ts`
- `frontend/src/lib/localAuth.test.ts`
- `frontend/src/lib/syncMode.test.ts` if present or a new narrow auth/sync separation test if needed.
- `frontend/src/lib/supabaseBoundary.test.ts`
- New focused `App` auth gate tests if separate from `App.localAuth.test.ts`.
- A new docs note or audit test only if the implementation requires source-grounded acceptance criteria.

K-289 should not modify these files unless separately justified:

- `frontend/src/lib/supabase.ts`, unless a tiny testable session boundary is required.
- `frontend/src/lib/localAuth.ts`, unless the selected implementation explicitly narrows production usage.
- `frontend/src/lib/syncMode.ts`, unless a tiny auth/sync separation change is required.
- `frontend/src/components/AppContent.tsx`, unless logout behavior must be adjusted to match restored Supabase auth.
- `frontend/src/components/views/LoginScreen.tsx`, unless a tiny testability or callback-safe behavior change is required.
- `frontend/src/components/common/LoginScreen.tsx`, unless legacy reachability is intentionally cleaned up.

K-289 must not modify without a separate milestone:

- Notes runtime, note store, note persistence, hydration, BlockEditor, Search, Cosmos, Signal Panel mount.
- Backup/export/import/restore/preflight/provider recovery.
- Google Drive OAuth/upload/recovery/session controller behavior.
- Health/Schedule/Recipe feature behavior.
- Supabase env/config files, package files, Vite config, generated artifacts, assets, fonts, dependencies.

## K-289 Test Plan

Focused K-289 tests:

- Unauthenticated protected `AppContent` is blocked.
- Public login/auth surface remains accessible.
- Auth callback route remains accessible if present or added.
- Authenticated Supabase session reaches `AppContent`.
- Session loading does not flash protected content.
- Local mode no longer bypasses protected auth gate.
- Sync mode does not decide authentication.
- Explicit remote/hybrid mode still uses Supabase session state.
- Logout returns to unauthenticated/login state.
- Missing Supabase session or auth error fails closed.
- Local-first Notes behavior remains unchanged after authenticated entry.
- `authFetch` local remote-boundary tests still pass.
- Signal Panel remains isolated and unmounted.
- Backup/export/import/restore/preflight tests remain unchanged.
- Provider recovery and Google Drive session-only tests remain unchanged.
- No secrets/env values are committed.

Existing tests expected to change or be superseded:

- `frontend/src/App.localAuth.test.ts` currently asserts local mode boots the app shell without touching Supabase auth. K-289 must replace that expectation with "local mode does not bypass protected app auth" or move local-user behavior into test/dev-only coverage.
- `frontend/src/lib/localAuth.test.ts` may still assert local user shape, but should not imply production app-shell access is approved.
- `frontend/src/lib/supabaseBoundary.test.ts` should keep proving local-mode `authFetch` pauses before Supabase session lookup.

## K-289 Manual / Browser QA Plan

Manual/browser QA is not required for K-288 because K-288 has no runtime/browser behavior changes.

K-289 manual QA should require:

- Run the app locally with Supabase env configured outside the repo.
- Logged-out visit to protected app shows login or redirects to login.
- Login succeeds with a test account or a documented available auth method.
- Auth callback is not blocked if a callback route exists.
- Refresh preserves authenticated session when Supabase session exists.
- Logout returns to login/unauthenticated state.
- Logged-out protected surfaces are inaccessible.
- Local-first Notes data remains present after authenticated entry.
- Sync mode local/remote/hybrid does not bypass app auth.
- If credentials/env are unavailable, document manual QA as blocked rather than faking proof.
- No generated artifacts, screenshots with secrets, callback URLs with codes, tokens, or env files are committed.

## Implementation Risks And Mitigations

- Callback route accidentally protected. Mitigation: explicit public allowlist before any redirect-based guard.
- Infinite redirect or loading loop. Mitigation: keep a simple settled unauthenticated state that renders `LoginScreen`.
- Loading state flashes `AppContent`. Mitigation: only render `AppContent` after authenticated session user is set.
- localStorage sync mode still bypasses auth. Mitigation: remove auth-gate dependence on `isLocalOnlyRuntime()` in `App.tsx`.
- Test/dev helper leaks into production. Mitigation: keep helper in tests/tooling only and assert no production bypass flag.
- Missing env fails open. Mitigation: session lookup failure must settle to unauthenticated, not synthesized user.
- Local-first Notes behavior gets coupled to remote. Mitigation: keep note hydration/persistence untouched and keep `authFetch` remote-boundary tests passing.
- Tests become brittle due to Supabase client mocking. Mitigation: mock only `supabase.auth.getSession`, `onAuthStateChange`, and `signOut` at the app-shell boundary.
- Browser QA blocked by missing credentials. Mitigation: report blocked proof honestly and rely on focused unit tests until credentials exist.
- Codex/AI verification blocked by login screen. Mitigation: use test-only mocked session or externally configured QA storage state, not production bypass.

## K-289 Decision

Recommended primary path:

**K-289 Auth/Supabase Runtime Access Gate Restoration Implementation**

Scope:

- Small implementation.
- Restore protected `AppContent` gate.
- Keep login/auth callback public.
- Add focused tests for unauthenticated, authenticated, loading, logout, and local-mode no-bypass behavior.
- Preserve local-first Notes runtime behavior.
- No Signal Panel, backup, provider, Notes data, Health, or Schedule behavior changes.
- Requires Codex 5.5 high.

Alternative:

**K-289 Auth/Supabase Runtime Access Restoration Implementation Prep**

Scope:

- Source/test prep only.
- No behavior change.
- Choose this only if K-288 review finds unresolved callback or test harness uncertainty.

Alternative:

**K-289 Auth Verification Test Harness Plan**

Scope:

- Docs/plan plus audit test.
- No runtime behavior change.
- Choose this only if test/dev verification strategy must be locked before any auth gate change.

## Non-goals

K-288 has these explicit non-goals:

- no auth restoration implementation in K-288.
- no `frontend/src/App.tsx` modification.
- no `frontend/src/lib/localAuth.ts` modification.
- no `frontend/src/lib/syncMode.ts` modification.
- no `frontend/src/lib/supabase.ts` modification.
- no route guard implementation.
- no login/logout behavior modification.
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

K-288 defines the auth restoration implementation plan only.

K-288 does not restore auth behavior yet. K-289 may implement protected `AppContent` access restoration if K-288 acceptance criteria are satisfied. Protected product surfaces should require authenticated Supabase session. Login/auth callback must remain public. Sync mode must not be used as auth bypass. Local-first data ownership must be preserved. AI/Codex verification should use test/dev-only strategy, not production bypass. Backup/provider/Signal Panel remain untouched. Local runtime data remains source of truth. Remote systems remain support layers.
