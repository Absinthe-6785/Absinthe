# K-292 Auth Test/Dev Verification Helper Implementation Plan

## Purpose

K-292 plans the exact boundary for a future test/dev-only auth verification helper. It follows K-291's strategy plan and keeps the restored K-289/K-290 auth posture intact.

K-292 is docs/plan plus audit test only. K-292 does not implement the helper. K-292 does not add mock provider/runtime wiring. K-292 does not add credentials, storageState artifacts, localStorage spoofing, service-role keys, or a production bypass flag.

K-292 chooses the next path: K-293 Auth Test/Dev Verification Vitest Helper Implementation.

## Current Restored Auth And Verification Recap

Protected `AppContent` remains behind a Supabase session. `frontend/src/App.tsx` calls `supabase.auth.getSession()` and subscribes with `supabase.auth.onAuthStateChange(...)`. The unauthenticated state renders `LoginScreen`. `frontend/src/components/AppContent.tsx` signs out through `await supabase.auth.signOut();`.

`localAuth` and `createLocalAuthUser()` are not production protected-shell entry. `syncMode` is a data/runtime posture and does not decide authentication. Authenticated entry preserves local-first Notes ownership after the user reaches the protected shell.

Authenticated browser QA remains manual or externally credentialed. AI/Codex/CI need test-only authenticated verification support without reopening production access.

## Helper Problem Statement

Tests need an authenticated Supabase session without real Supabase credentials. CI must not require real Supabase credentials by default. Browser authenticated QA must not be faked. Production access must remain closed behind Supabase auth.

The helper must support unit/component tests first. It must never become a production bypass, route guard override, localStorage authenticated spoof, browser storageState artifact, or production mock auth provider.

## Source Context Inspected

- `frontend/src/App.tsx`
- `frontend/src/components/AppContent.tsx`
- `frontend/src/App.localAuth.test.ts`
- `frontend/src/components/views/LoginScreen.tsx`
- `frontend/src/lib/localAuth.ts`
- `frontend/src/lib/syncMode.ts`
- `frontend/src/lib/supabase.ts`
- `frontend/src/lib/authTestDevVerificationStrategyPlan.test.ts`
- `frontend/src/lib/authSupabaseRuntimeAccessRestorationClosureAudit.test.ts`
- `frontend/src/lib/authSupabaseRuntimeAccessRestorationImplementationPlan.test.ts`
- `frontend/src/lib/authSupabaseRuntimeAccessRestorationSourceFactsAudit.test.ts`
- `frontend/docs/K-291-auth-test-dev-verification-strategy-plan.md`
- `frontend/docs/K-290-auth-supabase-runtime-access-restoration-closure-audit.md`
- `frontend/docs/K-288-auth-supabase-runtime-access-restoration-implementation-plan.md`
- `frontend/docs/K-287-auth-supabase-runtime-access-restoration-source-facts-audit.md`
- `frontend/docs/K-286-auth-supabase-runtime-access-restoration-boundary-plan.md`
- `frontend/scripts/productQaCapture.mjs`

Current source facts:

- `App.localAuth.test.ts` already mocks `supabase.auth.getSession`, `onAuthStateChange`, and `signOut` at the Vitest module boundary.
- That test covers unauthenticated local mode, unauthenticated remote mode, authenticated mocked Supabase session, and loading state.
- There is no established `frontend/src/test-utils` auth helper yet.
- Browser capture tooling is separate and must not be mixed into K-293's unit/component helper.

## Proposed Helper Location

Recommended future helper path:

`frontend/src/test-utils/auth/mockSupabaseAuthSession.ts`

The parent directory does not need to exist in K-292. K-293 may create it if implementing the helper.

Why this location:

- It is visibly test-only.
- It avoids production auth/runtime directories.
- It keeps auth mocking near test infrastructure instead of `App.tsx`, `localAuth.ts`, `syncMode.ts`, or `supabase.ts`.
- It can be source-audited for import boundaries.

Allowed importers:

- `*.test.ts`
- `*.test.tsx`
- Vitest-only setup files, if K-293 explicitly justifies that setup-level import.

Forbidden importers:

- `frontend/src/App.tsx`
- `frontend/src/components/AppContent.tsx`
- runtime route/nav files
- production auth provider files
- `frontend/src/lib/localAuth.ts`
- `frontend/src/lib/syncMode.ts`
- `frontend/src/lib/supabase.ts`
- Notes runtime files
- backup/provider files
- Signal Panel runtime/component files, unless imported only from tests
- Health/Schedule runtime files

## Helper API Plan

K-293 may implement a small Vitest-only API shaped around the current `App.localAuth.test.ts` needs:

```ts
type MockSupabaseAuthSessionOptions = {
  userId?: string;
  email?: string;
  accessToken?: string;
  expiresAt?: number;
};

function createMockSupabaseSession(options?: MockSupabaseAuthSessionOptions): SessionLike;

function mockSupabaseAuthenticatedSession(options?: MockSupabaseAuthSessionOptions): void;

function mockSupabaseUnauthenticatedSession(): void;

function mockSupabaseLoadingSession(): {
  resolveUnauthenticated(): void;
  resolveAuthenticated(options?: MockSupabaseAuthSessionOptions): void;
};

function resetSupabaseAuthMocks(): void;
```

Rules:

- Mock data only.
- No real credentials.
- No service-role key.
- No real Supabase URL/key.
- No network calls.
- No localStorage production spoof.
- No storageState artifact.
- No app runtime bypass.
- Align with the minimal `getSession`, `onAuthStateChange`, and `signOut` behavior tests need.
- Do not over-model Supabase if the app shell only needs session, subscription, and sign-out behavior.

## Mock Session Shape

Allowed mock fields:

- stable fake user id such as `test-user-id`
- fake email using the reserved example domain, such as `signed-in@example.com`
- fake access token clearly marked as fake, such as `fake-access-token`
- fake `expires_at` / `expiresAt`
- minimal user/session fields needed by Vitest component tests

Forbidden mock fields:

- real emails
- real tokens
- service-role key
- Supabase anon key
- OAuth tokens
- real-looking refresh tokens
- committed storageState JSON
- credentials in env/example files

## Production Exclusion Rule

The helper must be imported only by tests or explicitly justified Vitest setup. The helper must not be exported from production barrel/index files. The helper must not be referenced by `App.tsx`, `AppContent.tsx`, route/nav files, `supabase.ts`, `localAuth.ts`, or `syncMode.ts`.

The helper must not intentionally appear in the production bundle. K-293 must include source audit assertions for import boundaries. K-293 must not change Vite build behavior to include the helper.

## Unit / Component Verification Plan

K-293 should use the helper to prove:

- mocked unauthenticated session renders `LoginScreen`.
- mocked authenticated session renders protected `AppContent`.
- session loading hides protected content.
- sign-out calls the Supabase `signOut` mock.
- `syncMode` local mode does not grant auth.
- `localAuth` does not grant protected shell entry.
- public login/auth behavior remains reachable where unit-testable.
- local-first Notes runtime ownership remains unchanged after authenticated entry where focused tests already cover that boundary.

K-293 should avoid browser/E2E credential requirements. Browser proof belongs to manual QA or a later secret-backed E2E path.

## Browser / Manual QA Boundary

K-292 and the proposed K-293 helper are not browser authenticated QA. Real browser login proof requires a real Supabase test account or external storageState. storageState must not be committed. If credentials are unavailable, authenticated browser QA remains blocked.

Unauthenticated browser smoke may still be performed. Release readiness must separately collect login, callback, refresh, logout, and protected-surface proof with real auth.

## CI Boundary

CI may run unit/component tests using the mock helper. CI should not require real Supabase credentials by default. CI must not use a production bypass. Optional future E2E with secrets can be separate. Missing E2E credentials should report skipped or blocked, not fake pass. Test logs must not expose secrets.

## K-293 Implementation Acceptance Criteria

If K-293 implements the helper, require:

- Codex 5.5 high.
- helper file is test-only.
- no production runtime files changed except tests if necessary.
- no `App.tsx` behavior change.
- no route guard change.
- no Supabase env/config change.
- no credentials.
- no storageState artifacts.
- focused auth tests updated or added.
- source audit test proves helper import boundaries.
- typecheck, build, and diff-check pass.
- full `npm test` if feasible.
- no generated artifacts.

## K-293 Expected Files

Expected implementation candidates:

- `frontend/src/test-utils/auth/mockSupabaseAuthSession.ts`
- `frontend/src/App.localAuth.test.ts`
- `frontend/src/lib/authTestDevVerificationHelperBoundary.test.ts`
- optional short `frontend/docs/K-293-auth-test-dev-verification-vitest-helper.md`

Forbidden files unless explicitly justified:

- `frontend/src/App.tsx`
- `frontend/src/components/AppContent.tsx`
- route/nav files
- `frontend/src/lib/localAuth.ts`
- `frontend/src/lib/syncMode.ts`
- `frontend/src/lib/supabase.ts`
- env files
- `frontend/package.json`
- Vite config
- Notes runtime
- backup/provider runtime
- Signal Panel runtime/component files
- Health/Schedule runtime files

## K-293 Decision

Recommended: K-293 Auth Test/Dev Verification Vitest Helper Implementation.

Scope:

- small test-only helper implementation.
- Vitest/unit-component only.
- no browser helper.
- no credentials.
- no production runtime imports.
- focused auth tests.
- source import-boundary audit test.
- requires Codex 5.5 high.

Alternative: K-293 Auth Test/Dev Verification Helper Source Facts Audit.

Scope:

- docs/audit plus source test only.
- use if helper location or import boundary remains uncertain.

Alternative: K-293 Supabase Auth Manual QA / Release Readiness Audit.

Scope:

- docs/audit plus manual evidence only.
- use if real credentials become available before helper implementation.

Not recommended:

- production bypass.
- committed credentials.
- storageState artifact.
- Playwright/browser helper before unit-helper boundary is proven.
- route guard loosening.
- mock provider wired into production.

## Non-goals

K-292 has no helper implementation, no mock auth provider implementation, no Playwright/browser auth helper implementation, no test credentials, no storageState artifact, no production bypass flag, no localStorage spoofing bypass, no service-role key, no `App.tsx` change, no `AppContent.tsx` change, no route guard change, no Supabase env/config change, no `localAuth.ts` change, no `syncMode.ts` change, no `supabase.ts` change, no login/logout behavior change, no OAuth callback change, no session persistence change, no Notes runtime change, no Signal Panel change, no backup/export/import/restore behavior change, no provider recovery change, no Health/Schedule change, no assets/fonts/dependencies, and no generated artifacts.

## Closure Statement

K-292 defines helper implementation boundaries only. K-292 does not implement the helper. K-293 may implement a Vitest-only helper if boundaries are satisfied. Production access remains closed behind Supabase session. The helper must never become production bypass.

Authenticated browser QA remains external/manual unless real credentials or external storageState are available. AI/Codex verification should use test/dev-only strategy. Local-first data ownership remains preserved. Backup/provider/Signal Panel remain untouched. Local runtime data remains source of truth. Remote systems remain support layers.
