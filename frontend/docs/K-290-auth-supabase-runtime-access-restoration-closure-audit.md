# K-290 Auth/Supabase Runtime Access Restoration Closure Audit

## Purpose

K-290 closes the K-289 auth restoration implementation after the K-286 boundary plan, K-287 source-facts audit, and K-288 implementation plan. This milestone is docs/source audit plus audit test only.

K-290 does not modify auth gate behavior. K-290 does not add a mock provider, test credentials, or a browser auth helper. K-290 does not change routes, navigation, Supabase env/config, Notes runtime, backup/provider behavior, Signal Panel work, Health, or Schedule.

K-290 chooses the next path: K-291 Auth Test/Dev Verification Strategy Plan.

## Current Restored Posture Summary

Protected `AppContent` now requires a Supabase session. The unauthenticated state renders `LoginScreen`. `AppContent` sign-out goes through `supabase.auth.signOut()`.

`localAuth` and `createLocalAuthUser()` remain present as local helper/source facts, but they are no longer production protected-shell entry. `syncMode` remains a data/runtime posture and no longer decides authentication. Default local mode no longer means unauthenticated `AppContent` access.

Login/auth surfaces remain public. No app Supabase callback route was added or blocked by K-289; callback proof remains part of release QA. Local-first runtime data ownership remains unchanged after authenticated entry. No production bypass, frontend secret, service-role key, or committed credential was added.

## K-289 Implementation Source Audit

| Path inspected | K-289 finding | K-289 changed it | K-290 changes it |
| --- | --- | --- | --- |
| `frontend/src/App.tsx` | Uses `supabase.auth.getSession()` and `supabase.auth.onAuthStateChange(...)`; renders `LoginScreen` when `!authUser`; renders `AppContent authUser={authUser}` only after a session user exists. The local-mode `isLocalOnlyRuntime()` / `createLocalAuthUser()` protected-shell bypass was removed. | Yes | No |
| `frontend/src/components/AppContent.tsx` | `handleSignOut` calls `await supabase.auth.signOut();`. Since protected shell entry requires Supabase auth, no local-only sign-out branch is required. | Yes | No |
| `frontend/src/App.localAuth.test.ts` | Covers default local sync mode not bypassing the Supabase auth gate, explicit remote mode failure showing login, authenticated Supabase session rendering protected shell, and session loading hiding protected content. | Yes | No |
| `frontend/src/lib/localAuth.ts` | Still defines `isLocalOnlyRuntime()` and `createLocalAuthUser()`, but K-289 removed their use from `App.tsx` protected-shell entry. | No | No |
| `frontend/src/lib/syncMode.ts` | Still resolves Notes runtime sync mode from localStorage, env, then default local. It does not provide app authentication. | No | No |
| `frontend/src/lib/supabase.ts` | Supabase client and `authFetch` remain unchanged. `authFetch` still obtains the session from `supabase.auth.getSession()` and requires a bearer token for remote calls. | No | No |
| `frontend/src/components/views/LoginScreen.tsx` | Public login/sign-up surface still calls `supabase.auth.signInWithPassword` and `supabase.auth.signUp`. | No | No |

## Protected Shell Gate Audit

`AppContent` entry is session-based. Unauthenticated protected entry does not render `AppContent`; it renders `LoginScreen` after session resolution. The loading state displays a spinner and does not intentionally expose protected content.

Local mode no longer grants protected shell entry. `syncMode`, localStorage mode selection, and env mode selection do not grant auth. No route/nav broad rewrite was needed for K-289 because the app shell gate lives in `App.tsx`.

## Public Auth Surface Audit

`LoginScreen` remains accessible when unauthenticated. It provides sign-in and sign-up actions through Supabase auth. K-289 did not add, remove, or block an app Supabase auth callback route. No app callback route file was identified in the audited shell; callback behavior remains a release QA proof item.

Logout/sign-out returns control to Supabase session state by calling `supabase.auth.signOut()`. The authenticated session path is covered by focused tests. Authenticated browser QA with real Supabase credentials was not performed and remains a tracked gap.

## localAuth / syncMode Boundary Audit

`createLocalAuthUser()` no longer substitutes for a Supabase session at protected shell entry. `localAuth.ts` may remain as source/test/dev support, but it is not the production app auth gate.

`syncMode` remains data/runtime posture, not an auth decision. Default local mode no longer means unauthenticated `AppContent` access. Future test/dev verification strategy must not reintroduce a production bypass.

## Supabase / Session Boundary Audit

Supabase session remains the auth source. Supabase sign-out is used for protected app sign-out. Supabase client/config/env files were not changed by K-289 or K-290.

No hardcoded Supabase keys, service-role keys, client secrets, tokens, passwords, test credentials, database/RLS migrations, or provider/OAuth attachment recovery changes were introduced.

## Local-first / Notes Boundary Audit

Auth restoration gates access/session only. Notes remain local-first after authenticated entry. K-289 did not introduce remote-first note hydration, note store changes, note schema changes, note persistence changes, backup/export/import/restore changes, attachment blob/provider behavior changes, or Signal Panel activation.

Signal Panel work from K-278 through K-285 remains paused/unmounted and unrelated to auth restoration. Backup/preflight foundations from K-235 through K-262 remain support systems, not auth gate dependencies.

## Test and CI Evidence Audit

K-289 focused auth tests passed during implementation and review. The unauthenticated browser smoke passed: the local app showed Absinthe sign-in, email/password inputs, and no protected workspace navigation. Typecheck and build passed.

Full npm test status:

- K-289 implementation report: full-suite PASS.
- K-289 review: full npm test timed out before completion, while focused tests/typecheck/build passed.
- GitHub CI should be green before merging auth restoration work.

Authenticated browser QA gap:

- Real Supabase login with credentials was not performed.
- This was not a K-289 merge blocker when focused tests and CI were green.
- It must be tracked for release/manual QA and must not be solved by adding a production bypass.

## Security / Bypass Audit

K-289 and K-290 add no production bypass flag, no auth-disabled runtime flag, no frontend service-role key, no committed credential, no broad localStorage auth bypass, no fake production session, no mock provider production wiring, no route/nav broad rewrite, and no generated artifact.

Docs and tests may mention bypass terms as audit findings or guardrails. Runtime source should not add those bypasses.

## Remaining Gaps

- Authenticated browser QA with real Supabase credentials was not performed.
- AI/Codex browser verification may be blocked by login.
- A safe test/dev-only verification strategy remains needed.
- Release readiness requires manual login, callback, logout, refresh/session persistence, and logged-out protected-access proof.
- Any missing E2E/browser helper should be planned separately.
- These gaps must not be solved by adding a production bypass.

## Runtime Exposure / Release Gate

Before release confidence, require:

- Real Supabase login manual QA.
- Auth callback proof.
- Logout proof.
- Refresh/session persistence proof.
- Logged-out protected access proof.
- Unauthenticated app shell blocked proof.
- No secrets or env values committed.
- Local-first Notes smoke after login.
- Backup/provider unaffected smoke if relevant.

## K-291 Decision

Recommended K-291 path: Auth Test/Dev Verification Strategy Plan.

Scope:

- Docs/plan plus audit test only.
- Define a safe test/dev-only strategy so Codex/AI/browser verification can work after auth gate restoration.
- No runtime behavior change.
- No production bypass.

Alternatives:

- K-291 Supabase Auth Manual QA / Release Readiness Audit: docs/audit plus audit test only; collect real Supabase login/callback/logout/browser evidence; no implementation.
- K-291 Auth Test/Dev Verification Helper Implementation Plan: docs/plan plus audit test; plan the exact test-only helper before implementation.

Not recommended:

- Production bypass flag.
- Committed test credentials.
- Broad auth-disabled mode.
- Mock provider wired into production runtime.
- Route/nav rewrite.

## Non-goals

K-290 has no auth gate changes, no `App.tsx` modification, no `AppContent.tsx` modification, no `localAuth.ts` modification, no `syncMode.ts` modification, no `supabase.ts` modification, no `LoginScreen` modification, no auth callback modification, no mock auth provider implementation, no test credentials, no Playwright/browser auth helper, no production bypass flag, no frontend secret/service-role key, no Supabase env/config change, no OAuth callback change, no database/RLS/migration changes, no Notes runtime change, no local persistence change, no backup/export/import/restore behavior change, no provider recovery change, no Signal Panel change, no Health/Schedule change, no assets/fonts/dependencies, and no generated artifacts.

## Closure Statement

K-290 closes K-289 auth restoration implementation. Protected `AppContent` is restored behind Supabase session. Local-mode/syncMode no longer functions as production protected-shell bypass. Login/auth/callback public surfaces remain preserved.

Authenticated browser QA remains a tracked gap, not solved by production bypass. AI/Codex verification should be solved by test/dev-only strategy. Local-first data ownership remains preserved. Backup/provider/Signal Panel remain untouched. Local runtime data remains source of truth. Remote systems remain support layers.
