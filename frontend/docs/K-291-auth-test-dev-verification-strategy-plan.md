# K-291 Auth Test/Dev Verification Strategy Plan

## Purpose

K-291 plans safe auth test/dev verification after K-289 restored the protected app shell behind Supabase auth and K-290 closed that work with a source audit. This milestone is docs/plan plus audit test only.

K-291 does not implement a mock auth provider. K-291 does not implement a Playwright/browser auth helper. K-291 does not add test credentials. K-291 does not add a production bypass flag, localStorage spoofing bypass, service-role key, or Supabase env/config change.

K-291 chooses the next path: K-292 Auth Test/Dev Verification Helper Implementation Plan.

## Current Restored Auth Posture Recap

Protected `AppContent` is behind Supabase session. The unauthenticated state renders `LoginScreen`. `AppContent` sign-out uses `supabase.auth.signOut()`.

`localAuth` and `createLocalAuthUser()` no longer grant production protected shell entry. `syncMode` does not decide authentication. Login/auth/callback surfaces remain public, with callback proof still tracked as release/manual QA. Authenticated browser QA remains a gap. AI/Codex/browser verification may now be blocked by login.

## Verification Problem Statement

The restored auth gate is correct product behavior. The verification problem is that automated and browser verification now need an authenticated path, while Codex/AI and CI may not have real Supabase credentials.

CI must not depend on real credentials by default. Manual QA may need a real Supabase test account. Verification friction must not be solved by reopening production app access. A test/dev-only strategy is needed so tests can prove authenticated and unauthenticated behavior without creating a production bypass.

## Existing Test Coverage Audit

Paths inspected:

- `frontend/src/App.tsx`
- `frontend/src/components/AppContent.tsx`
- `frontend/src/App.localAuth.test.ts`
- `frontend/src/components/views/LoginScreen.tsx`
- `frontend/src/lib/localAuth.ts`
- `frontend/src/lib/syncMode.ts`
- `frontend/src/lib/supabase.ts`
- `frontend/src/lib/authSupabaseRuntimeAccessRestorationClosureAudit.test.ts`
- `frontend/docs/K-290-auth-supabase-runtime-access-restoration-closure-audit.md`
- `frontend/scripts/productQaCapture.mjs`

Current coverage:

- `App.localAuth.test.ts` mocks `supabase.auth.getSession`, `onAuthStateChange`, and `signOut` at the Vitest module boundary.
- It covers default local sync mode not bypassing the Supabase auth gate.
- It covers explicit remote mode failure showing login.
- It covers a mocked authenticated Supabase session rendering the protected shell.
- It covers session loading hiding protected content.
- K-290 audit tests assert the restored source facts and closure boundaries.
- `localAuth.ts` and `syncMode.ts` remain source facts but not app auth entry.

Gaps:

- No authenticated browser QA with real Supabase credentials.
- No app Supabase callback proof.
- No release-level login/logout/refresh proof.
- No reusable test-only auth render helper has been locked.
- Full CI/full npm test evidence should remain separate from this planning PR.

## Unit / Component Test Strategy

Unit and component tests should mock Supabase session at the module/test boundary. Use existing Vitest `vi.mock` patterns where possible. Tests should not use real Supabase credentials in CI, hardcoded real users, localStorage authenticated spoofing, or production runtime helpers.

Required coverage:

- Unauthenticated state renders `LoginScreen`.
- Authenticated mocked session renders protected `AppContent`.
- Session loading hides protected content.
- Login/auth public behavior remains reachable.
- Sign-out calls Supabase sign-out.
- `syncMode` does not grant auth.
- `localAuth` does not grant protected shell entry.
- Local-first Notes boundaries remain unchanged after authenticated entry when tested.

## Test/dev-only Helper Candidate Analysis

### 1. Vitest-only Supabase auth mock helper

What it solves: reduces repeated `getSession` / `onAuthStateChange` mock wiring in unit/component tests.

Possible location: `frontend/src/test/authSupabaseMock.ts` or similar test-only path.

Why test/dev-only: imported only from `*.test.ts` / `*.test.tsx` files.

Production avoidance: no production import path, no app runtime branch, no Vite env flag.

Risks: accidental import from runtime source; mitigate with source audit test.

Recommendation: recommended first implementation candidate.

### 2. Test-only App render wrapper with injected mocked Supabase session

What it solves: standardizes render setup for authenticated and unauthenticated app shell tests.

Possible location: `frontend/src/test/renderAuthApp.tsx` or equivalent.

Why test/dev-only: lives under test utility path and is only imported by tests.

Production avoidance: no production dependency and no route/app gate changes.

Risks: can hide real app behavior if wrapper becomes too magical; keep it thin.

Recommendation: useful after or alongside the Vitest auth mock helper.

### 3. Playwright storageState generated outside repo

What it solves: authenticated browser QA without committing credentials.

Possible location: outside the repository or in ignored local artifact paths only.

Why test/dev-only: generated per-machine or CI-secret-backed, never committed.

Production avoidance: no runtime code, no bundle impact.

Risks: stale sessions, accidental artifact commits, CI secret leakage.

Recommendation: acceptable later for optional authenticated E2E, not the default K-292 step.

### 4. Manual Supabase test account documented outside repo

What it solves: real login/callback/logout manual QA.

Possible location: password manager, CI secret store, or private runbook outside repository.

Why test/dev-only: credentials are never committed.

Production avoidance: no code changes.

Risks: account lifecycle and access control.

Recommendation: required for release/manual QA, not for unit CI.

### 5. Local dev-only fixture account through environment variables, not committed

What it solves: local manual QA where a safe test account exists.

Possible location: local `.env` or secret manager, never in repo.

Why test/dev-only: explicitly external to committed source.

Production avoidance: no bypass and no frontend service-role key.

Risks: accidental logging or committing env files.

Recommendation: possible later with strict docs and ignore rules.

## Production Bypass Prohibition

Do not add a production bypass flag, auth-disabled runtime mode, localStorage authenticated spoof, `createLocalAuthUser()` app-shell bypass, `syncMode` auth decision, mock provider wired into production app, frontend service-role key, committed Supabase credentials, generated storageState committed to repo, broad route guard disable switch, or CI secret leakage into logs.

## Browser / Manual QA Strategy

Unauthenticated browser smoke can remain automated/manual without credentials. Authenticated browser QA needs a real Supabase test user or externally provisioned storageState. If credentials are unavailable, authenticated browser QA must be marked blocked. Do not fake authenticated browser proof.

Release readiness should include:

- Login works.
- Callback works.
- Refresh preserves session if intended.
- Logout works.
- Logged-out protected surfaces are blocked.
- Local-first Notes smoke passes after login.
- No secrets or auth artifacts are committed.

## CI Strategy

CI should rely on mocked unit/component tests for auth gate behavior. CI should not require real Supabase credentials by default and should not use a production bypass.

Optional authenticated E2E can be separate and secret-backed later. Missing E2E credentials should produce a skip/blocked result with explicit reporting, not a fake-auth pass.

## AI / Codex Verification Strategy

Codex can run unit/component tests with mocked sessions and unauthenticated browser smoke. Codex should report authenticated browser QA as blocked when no credentials or external storageState is available.

AI/Codex must not add temporary production bypasses for verification. Any future helper must be test/dev-only and source-audited. Any browser storageState must not be committed.

## K-292 Implementation Boundary

If K-292 implements a helper, require:

- Test-only files only.
- No production runtime imports.
- No `App.tsx` production bypass.
- No route guard loosening.
- No Supabase env/config changes.
- No credentials.
- No service-role key.
- Source audit proving the helper is only imported by tests.
- Focused tests proving authenticated, unauthenticated, and loading states.
- Typecheck, build, and diff-check.
- No generated artifacts.

## Recommended K-292 Path

Recommended: K-292 Auth Test/Dev Verification Helper Implementation Plan.

Scope:

- Docs/plan plus audit test only.
- Lock exact test-only helper file path, import boundaries, and acceptance criteria before implementation.
- No runtime behavior change.

Alternative if confident: K-292 Auth Test/Dev Verification Vitest Helper Implementation.

Scope:

- Small test-only helper implementation.
- Vitest/unit/component only.
- No production runtime import.
- No browser helper.
- No credentials.
- Requires Codex 5.5 high.

Alternative: K-292 Supabase Auth Manual QA / Release Readiness Audit.

Scope:

- Docs/audit plus evidence only.
- Collect real manual QA if credentials are available.
- No implementation.

Not recommended:

- Production bypass flag.
- Committed credentials.
- Playwright helper before test-only strategy is locked.
- Route guard loosening.
- Mock provider wired into production.

## Non-goals

K-291 has no mock auth provider implementation, no Playwright/browser auth helper implementation, no test credentials, no production bypass flag, no localStorage spoofing bypass, no service-role key, no `App.tsx` change, no `AppContent.tsx` change, no route guard change, no Supabase env/config change, no `localAuth.ts` change, no `syncMode.ts` change, no `supabase.ts` change, no login/logout behavior change, no OAuth callback change, no session persistence change, no Notes runtime change, no Signal Panel change, no backup/export/import/restore behavior change, no provider recovery change, no Health/Schedule change, no assets/fonts/dependencies, and no generated artifacts.

## Closure Statement

K-291 defines test/dev verification strategy only. K-291 does not reopen production access. Protected `AppContent` remains behind Supabase session. Verification must use test/dev-only or manual QA strategy.

Authenticated browser QA remains blocked unless real credentials or external storageState are available. AI/Codex verification must not rely on production bypass. Local-first data ownership remains preserved. Backup/provider/Signal Panel remain untouched. Local runtime data remains source of truth. Remote systems remain support layers.
