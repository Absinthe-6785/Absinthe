import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const docPath = join(
  process.cwd(),
  'docs',
  'K-288-auth-supabase-runtime-access-restoration-implementation-plan.md',
);
const k286DocPath = join(
  process.cwd(),
  'docs',
  'K-286-auth-supabase-runtime-access-restoration-boundary-plan.md',
);
const k287DocPath = join(
  process.cwd(),
  'docs',
  'K-287-auth-supabase-runtime-access-restoration-source-facts-audit.md',
);
const appPath = join(process.cwd(), 'src', 'App.tsx');
const mainPath = join(process.cwd(), 'src', 'main.tsx');
const localAuthPath = join(process.cwd(), 'src', 'lib', 'localAuth.ts');
const syncModePath = join(process.cwd(), 'src', 'lib', 'syncMode.ts');
const remoteBoundaryPath = join(process.cwd(), 'src', 'lib', 'remoteBoundary.ts');
const supabasePath = join(process.cwd(), 'src', 'lib', 'supabase.ts');
const appContentPath = join(process.cwd(), 'src', 'components', 'AppContent.tsx');
const loginViewPath = join(process.cwd(), 'src', 'components', 'views', 'LoginScreen.tsx');
const commonLoginPath = join(process.cwd(), 'src', 'components', 'common', 'LoginScreen.tsx');
const googleDriveOAuthCallbackPath = join(process.cwd(), 'src', 'lib', 'googleDriveOAuthCallback.ts');
const appLocalAuthTestPath = join(process.cwd(), 'src', 'App.localAuth.test.ts');
const localAuthTestPath = join(process.cwd(), 'src', 'lib', 'localAuth.test.ts');
const supabaseBoundaryTestPath = join(process.cwd(), 'src', 'lib', 'supabaseBoundary.test.ts');

function read(path: string): string {
  return readFileSync(path, 'utf8');
}

function readDoc(): string {
  return read(docPath);
}

describe('K-288 auth Supabase runtime access restoration implementation plan', () => {
  it('exists and states plan-only scope with forbidden implementation shortcuts', () => {
    expect(existsSync(docPath)).toBe(true);
    const doc = readDoc();

    for (const required of [
      'K-288 Auth/Supabase Runtime Access Restoration Implementation Plan',
      'K-288 plans the implementation for restoring Supabase-authenticated runtime access.',
      'K-288 follows the K-287 Auth/Supabase Runtime Access Restoration Source Facts Audit.',
      'K-288 is docs/plan plus audit test only.',
      'K-288 does not implement auth restoration.',
      'K-288 does not change runtime auth behavior.',
      'K-288 does not change `frontend/src/App.tsx`.',
      'K-288 does not change `frontend/src/lib/localAuth.ts`.',
      'K-288 does not change `frontend/src/lib/syncMode.ts`.',
      'K-288 does not change `frontend/src/lib/supabase.ts`.',
      'K-288 does not implement a route guard.',
      'K-288 does not add mock auth provider implementation.',
      'K-288 does not add test credentials.',
      'K-288 does not add a production bypass flag.',
      'K-288 does not add frontend secret/service-role keys.',
      'K-288 chooses the K-289 next path: Auth/Supabase Runtime Access Gate Restoration Implementation.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('recaps K-287 current source facts', () => {
    const doc = readDoc();

    for (const required of [
      '## Current Source Facts Recap',
      '`frontend/src/main.tsx` mounts `App` directly under `ThemeProvider`',
      '`frontend/src/App.tsx` owns top-level auth branching',
      '`frontend/src/App.tsx` currently checks `isLocalOnlyRuntime()` first.',
      '`setAuthUser(createLocalAuthUser())`',
      '`supabase.auth.getSession()` and `supabase.auth.onAuthStateChange(...)`',
      '`frontend/src/lib/localAuth.ts` synthesizes a Supabase-shaped local user',
      '`frontend/src/lib/syncMode.ts` selects mode from localStorage key `absinthe-notes-sync-mode`',
      '`import.meta.env.VITE_ABSINTHE_SYNC_MODE`',
      'defaults to `local`',
      '`frontend/src/lib/supabase.ts` creates the Supabase client',
      '`frontend/src/lib/supabase.ts` reads a Supabase session inside `authFetch`',
      '`frontend/src/components/views/LoginScreen.tsx` is the current app-level login/sign-up surface',
      'No app Supabase auth callback route file was found',
      'AI/Codex browser verification can be blocked by login once auth is restored.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('defines restoration target and protected/public surface plan', () => {
    const doc = readDoc();

    for (const required of [
      '## Restoration Target',
      'Protected product surfaces require an authenticated Supabase session.',
      'Login/auth entry remains public.',
      'Auth callback surfaces remain public',
      'Session loading must not flash protected app content.',
      'Local-first Notes runtime ownership remains unchanged after authenticated entry.',
      'Signal Panel remains unrelated, isolated, and unmounted.',
      'Backup, export, import, restore, preflight, provider recovery',
      '## Protected / Public Surface Plan',
      '`frontend/src/components/views/LoginScreen.tsx`',
      '## LEAN_03 Current-State Reconciliation',
      'active runtime authority remains `frontend/src/components/views/LoginScreen.tsx`',
      'App Supabase auth callback route: none was found',
      '`frontend/src/components/AppContent.tsx`: protected app shell.',
      '`frontend/src/components/views/NoteView.tsx`',
      '`frontend/src/components/views/HealthView.tsx`',
      '`frontend/src/components/views/PlannerView.tsx`',
      '`frontend/src/components/views/SettingsView.tsx`',
      '`frontend/src/components/views/noteview/EmbeddedAttachmentMigrationReviewPanel.tsx`',
      'the primary K-289 gate should be the existing `App.tsx` branch',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('defines App.tsx, localAuth.ts, syncMode.ts, and Supabase session plans', () => {
    const doc = readDoc();

    for (const required of [
      '## App.tsx Restoration Plan',
      'Exact source file:',
      '`frontend/src/App.tsx`',
      'The `useEffect` checks `if (isLocalOnlyRuntime())`.',
      'Remove local sync mode as a protected app-shell entry substitute.',
      'Require a Supabase-authenticated session before rendering protected `AppContent`.',
      'Use `supabase.auth.getSession()` and `supabase.auth.onAuthStateChange(...)` as the app-shell session source.',
      '## localAuth.ts Plan',
      '`frontend/src/lib/localAuth.ts`',
      'Do not delete `localAuth.ts` in K-289.',
      'Stop using `createLocalAuthUser()` as a production protected app-shell entry substitute.',
      'Do not keep local synthesized user as a production auth replacement.',
      '## syncMode.ts Plan',
      '`frontend/src/lib/syncMode.ts`',
      'Sync mode must not decide authentication.',
      'Default `local` must not bypass protected app access.',
      'Auth is Supabase session state; sync mode is data/runtime sync posture.',
      '## Supabase Session Plan',
      '`frontend/src/lib/supabase.ts`',
      'Loading: app is resolving Supabase session',
      'Authenticated: Supabase session has a user',
      'Unauthenticated: no session user',
      'Error/unavailable: fail closed for protected surfaces',
      'K-289 should not hardcode Supabase URL/key',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('defines redirect behavior and AI/Codex test-dev verification strategy', () => {
    const doc = readDoc();

    for (const required of [
      '## Redirect / Access Behavior Plan',
      'Logged-out protected app visit renders login/auth screen or redirects to login.',
      'Login/auth surface does not redirect-loop.',
      'Authenticated Supabase session reaches `AppContent`.',
      'Missing env, missing session, or Supabase session failure does not grant protected app access.',
      'Local mode cannot independently enter `AppContent`.',
      '## AI / Codex Test / Dev Verification Strategy',
      'K-288 plans these candidates only. K-288 implements none.',
      'Test-only mock Supabase session in Vitest',
      'Test-only auth provider wrapper',
      'Playwright/browser storage state only as explicit QA tooling',
      'Manual Supabase test account',
      'Blocked-proof documentation',
      'Production bypass flag.',
      'localStorage bypass that works in production.',
      'Frontend service-role key.',
      'Committed email/password credentials.',
      'AI/Codex verification must be solved with test/dev-only strategy',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('defines K-289 implementation files, test plan, manual QA, risks, and next path', () => {
    const doc = readDoc();

    for (const required of [
      '## K-289 Implementation File List',
      '`frontend/src/App.tsx`',
      '`frontend/src/App.localAuth.test.ts`',
      '`frontend/src/lib/localAuth.test.ts`',
      '`frontend/src/lib/supabaseBoundary.test.ts`',
      'K-289 should not modify these files unless separately justified:',
      '`frontend/src/lib/supabase.ts`',
      '`frontend/src/lib/localAuth.ts`',
      '`frontend/src/lib/syncMode.ts`',
      'K-289 must not modify without a separate milestone:',
      'Notes runtime, note store, note persistence',
      'Backup/export/import/restore/preflight/provider recovery.',
      '## K-289 Test Plan',
      'Unauthenticated protected `AppContent` is blocked.',
      'Public login/auth surface remains accessible.',
      'Authenticated Supabase session reaches `AppContent`.',
      'Session loading does not flash protected content.',
      'Local mode no longer bypasses protected auth gate.',
      'Sync mode does not decide authentication.',
      'Signal Panel remains isolated and unmounted.',
      '## K-289 Manual / Browser QA Plan',
      'Manual/browser QA is not required for K-288',
      'Run the app locally with Supabase env configured outside the repo.',
      'If credentials/env are unavailable, document manual QA as blocked rather than faking proof.',
      '## Implementation Risks And Mitigations',
      'Callback route accidentally protected.',
      'localStorage sync mode still bypasses auth.',
      'Missing env fails open.',
      '## K-289 Decision',
      '**K-289 Auth/Supabase Runtime Access Gate Restoration Implementation**',
      'Small implementation.',
      'Requires Codex 5.5 high.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('lists explicit non-goals and closure boundaries', () => {
    const doc = readDoc();

    for (const required of [
      '## Non-goals',
      'no auth restoration implementation in K-288.',
      'no `frontend/src/App.tsx` modification.',
      'no `frontend/src/lib/localAuth.ts` modification.',
      'no `frontend/src/lib/syncMode.ts` modification.',
      'no `frontend/src/lib/supabase.ts` modification.',
      'no route guard implementation.',
      'no mock auth provider implementation.',
      'no test credentials.',
      'no Playwright/browser auth helper.',
      'no production bypass flag.',
      'no frontend secret/service-role key.',
      'no Supabase client/config change.',
      'no OAuth callback change.',
      'no env changes.',
      'no database/RLS/migration changes.',
      'no Notes runtime change.',
      'no backup/export/import/restore behavior change.',
      'no provider recovery change.',
      'no Signal Panel change.',
      'no Health/Schedule change.',
      'no generated artifacts.',
      '## Closure Statement',
      'K-288 defines the auth restoration implementation plan only.',
      'K-288 does not restore auth behavior yet.',
      'K-289 may implement protected `AppContent` access restoration',
      'Protected product surfaces should require authenticated Supabase session.',
      'Login/auth callback must remain public.',
      'Sync mode must not be used as auth bypass.',
      'Local-first data ownership must be preserved.',
      'AI/Codex verification should use test/dev-only strategy, not production bypass.',
      'Backup/provider/Signal Panel remain untouched.',
      'Local runtime data remains source of truth.',
      'Remote systems remain support layers.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('verifies referenced source and prior audit files, while excluding the retired common login', () => {
    for (const path of [
      k286DocPath,
      k287DocPath,
      appPath,
      mainPath,
      localAuthPath,
      syncModePath,
      remoteBoundaryPath,
      supabasePath,
      appContentPath,
      loginViewPath,
      googleDriveOAuthCallbackPath,
      appLocalAuthTestPath,
      localAuthTestPath,
      supabaseBoundaryTestPath,
    ]) {
      expect(existsSync(path)).toBe(true);
    }

    expect(existsSync(commonLoginPath)).toBe(false);
  });

  it('uses source-invariant assertions without git branch topology', () => {
    const testSource = read(join(process.cwd(), 'src', 'lib', 'authSupabaseRuntimeAccessRestorationImplementationPlan.test.ts'));

    for (const forbidden of [
      `exec${'File'}Sync`,
      `spawn${'Sync'}`,
      `git ${'diff'}`,
      `origin/${'main'}`,
      `main${'...'}HEAD`,
      `HEAD${'^'}`,
      `rev-${'parse'}`,
    ]) {
      expect(testSource).not.toContain(forbidden);
    }
  });
});
