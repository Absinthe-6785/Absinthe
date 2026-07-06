import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const docPath = join(
  process.cwd(),
  'docs',
  'K-286-auth-supabase-runtime-access-restoration-boundary-plan.md',
);
const appPath = join(process.cwd(), 'src', 'App.tsx');
const localAuthPath = join(process.cwd(), 'src', 'lib', 'localAuth.ts');
const syncModePath = join(process.cwd(), 'src', 'lib', 'syncMode.ts');
const remoteBoundaryPath = join(process.cwd(), 'src', 'lib', 'remoteBoundary.ts');
const supabasePath = join(process.cwd(), 'src', 'lib', 'supabase.ts');
const appContentPath = join(process.cwd(), 'src', 'components', 'AppContent.tsx');
const loginViewPath = join(process.cwd(), 'src', 'components', 'views', 'LoginScreen.tsx');
const appLocalAuthTestPath = join(process.cwd(), 'src', 'App.localAuth.test.ts');
const localAuthTestPath = join(process.cwd(), 'src', 'lib', 'localAuth.test.ts');
const supabaseBoundaryTestPath = join(process.cwd(), 'src', 'lib', 'supabaseBoundary.test.ts');
const auditTestPath = join(process.cwd(), 'src', 'lib', 'authSupabaseRuntimeAccessRestorationBoundaryPlan.test.ts');
const expectedK286ChangedFiles = [
  'frontend/docs/K-286-auth-supabase-runtime-access-restoration-boundary-plan.md',
  'frontend/src/lib/authSupabaseRuntimeAccessRestorationBoundaryPlan.test.ts',
];

function read(path: string): string {
  return readFileSync(path, 'utf8');
}

function readDoc(): string {
  return read(docPath);
}

describe('K-286 auth Supabase runtime access restoration boundary plan', () => {
  it('exists and states docs/plan plus audit-test-only scope', () => {
    expect(existsSync(docPath)).toBe(true);
    const doc = readDoc();

    for (const required of [
      'K-286 Auth/Supabase Runtime Access Restoration Boundary Plan',
      'K-286 plans restoration of intended Supabase-authenticated runtime access',
      'K-286 is docs/plan plus audit test only.',
      'K-286 does not implement auth restoration.',
      'K-286 does not change runtime auth behavior.',
      'K-286 does not implement a route guard.',
      'K-286 does not modify the Supabase client/config.',
      'K-286 does not modify OAuth callback behavior.',
      'K-286 does not change session persistence.',
      'K-286 does not change database/RLS/migrations.',
      'K-286 chooses the K-287 next path: Auth/Supabase Runtime Access Restoration Source Facts Audit.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('summarizes current auth/runtime access state from source inspection', () => {
    const doc = readDoc();

    for (const required of [
      '## Current State Summary',
      'allows product app shell access without a Supabase login when the Notes runtime sync mode resolves to local.',
      '`frontend/src/App.tsx` checks `isLocalOnlyRuntime()` during app boot.',
      '`App.tsx` calls `createLocalAuthUser()`',
      'returns before Supabase auth is queried.',
      '`frontend/src/lib/localAuth.ts` creates a Supabase-shaped local user',
      '`frontend/src/lib/syncMode.ts` defaults `resolveNotesRuntimeSyncMode()` to `local`',
      '`frontend/src/App.localAuth.test.ts` locks the current behavior',
      'explicit remote mode still shows the login gate when Supabase auth fails.',
      '`frontend/src/lib/supabase.ts` keeps `authFetch` behind `shouldUseRemoteData()`',
      '`frontend/src/hooks/useDaily.ts` and `frontend/src/hooks/useStatic.ts` use `remoteSWRKey(...)`',
      'The bypass source is explicit, not merely a missing route guard.',
      'There is no file-based route map in the inspected app shell.',
      'Existing tests cover the current local-mode bypass and remote-mode login gate',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('defines intended restoration goal and protected/public surfaces', () => {
    const doc = readDoc();

    for (const required of [
      '## Intended Restoration Goal',
      'unauthenticated users should not access protected app surfaces by default.',
      'an authenticated Supabase session should be required for protected runtime surfaces.',
      'login/auth entry should remain accessible.',
      'auth callback/session recovery should remain accessible if present.',
      'logout should return the user to unauthenticated state.',
      'local-first note data must remain local-first after auth restoration.',
      'auth restoration must not convert Notes to remote-first.',
      'backup/preflight behavior must not be changed.',
      'Signal Panel remains unmounted and unrelated.',
      '## Protected Versus Public Surfaces',
      '`frontend/src/components/views/LoginScreen.tsx`',
      'Auth callback/session recovery route if one is added or identified in K-287.',
      '`frontend/src/components/AppContent.tsx`',
      'Notes workspace rendered from `AppContent`.',
      'Health workspace rendered from `AppContent`.',
      'Schedule/Planner workspace rendered from `AppContent`.',
      'Settings workspace rendered from `AppContent`.',
      'K-287 must lock the exact public/protected surface map before implementation.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('audits current bypass behavior and source files', () => {
    const doc = readDoc();

    for (const required of [
      '## Current Bypass / Access Audit',
      'Current no-login access is explicit production runtime behavior for default local mode.',
      '`frontend/src/App.tsx` allows app shell access without Supabase login',
      '`frontend/src/lib/localAuth.ts` defines the local user',
      '`frontend/src/lib/syncMode.ts` defaults Notes runtime sync mode to `local`.',
      '`frontend/src/App.localAuth.test.ts` asserts local mode does not touch Supabase auth',
      'explicit: yes.',
      'test-only: no.',
      'production runtime: yes',
      '`VITE_ABSINTHE_SYNC_MODE`, localStorage key `absinthe-notes-sync-mode`, and default local mode affect the branch.',
      'Supabase client/session touched: no in default local mode',
      'local persistence touched: indirectly yes',
      'note runtime state touched: indirectly yes',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('defines Supabase/auth and local-first data boundaries', () => {
    const doc = readDoc();

    for (const required of [
      '## Supabase / Auth Boundary',
      'Supabase should remain the auth/session source for authenticated runtime access.',
      'K-286 makes no Supabase schema/database/RLS changes.',
      'K-286 makes no provider/OAuth scope changes.',
      'K-286 makes no Google Drive/OAuth attachment recovery changes.',
      'K-286 makes no backup/provider recovery changes.',
      'K-286 commits no secrets or env values.',
      'avoid hardcoding Supabase URLs or keys beyond the existing environment pattern',
      '## Local-first Data Boundary',
      'Notes/local runtime data remains source of truth.',
      'force remote-first note hydration.',
      'fetch all notes from Supabase at boot.',
      'rewrite local vault persistence.',
      'alter backup/export/import/restore behavior.',
      'alter attachment blob/provider behavior.',
      'alter Google Drive recovery/upload behavior.',
      'Auth restoration only controls access/session gating.',
      'Remote systems remain support layers.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('defines risks, future strategy, future tests, and manual QA', () => {
    const doc = readDoc();

    for (const required of [
      '## Implementation Risk Analysis',
      'route guard accidentally blocks auth callback.',
      'app shell flashes protected content before session resolution.',
      'session loading state creates an infinite redirect or dead screen.',
      'existing tests rely on no-login access in default local mode.',
      'local-first data gets coupled to remote session or remote hydration.',
      'environment variables may be missing locally.',
      'OAuth callback mismatch may break login flow.',
      '## Proposed Restoration Strategy',
      'K-286 does not implement this strategy.',
      'Restore a single protected-app gate around `AppContent`',
      'Keep login/auth callback public.',
      'Add explicit loading/session-resolving state.',
      'Preserve local-first runtime data behavior after authenticated entry.',
      'Keep `authFetch`, `remoteSWRKey`, and local Notes durability guards intact.',
      '## Future Test Plan',
      'unauthenticated user is blocked from protected app shell.',
      'unauthenticated user can access login/auth callback.',
      'authenticated session can access app shell.',
      'session loading state does not flash protected app content.',
      'logout returns to login/unauthenticated state.',
      'local-first note behavior is unchanged.',
      'Signal Panel remains unmounted.',
      'backup/export/import tests remain unchanged.',
      '## Manual / Browser QA Requirements',
      'Manual browser QA is not required for K-286 because K-286 has no runtime/browser behavior changes.',
      'verify logged-out visit redirects to or shows login.',
      'verify callback does not get blocked.',
      'verify local-first Notes data remains intact after authenticated entry.',
      'document the proof as blocked rather than faking runtime proof.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('recommends K-287 path and lists non-goals', () => {
    const doc = readDoc();

    for (const required of [
      '## K-287 Decision',
      '**K-287 Auth/Supabase Runtime Access Restoration Source Facts Audit**',
      'docs/audit plus source test only.',
      'lock exact files, route map, auth provider/session state, and test strategy before implementation.',
      'no runtime changes.',
      'Not recommended as the default next step until the route/surface map and test harness are locked.',
      '## Non-goals',
      'no auth runtime behavior change in K-286.',
      'no route guard implementation.',
      'no login page modification.',
      'no OAuth callback modification.',
      'no Supabase client/config modification.',
      'no env variable changes.',
      'no secrets committed.',
      'no database/RLS/migration changes.',
      'no remote-first note hydration.',
      'no note store changes.',
      'no local persistence changes.',
      'no backup/export/import/restore behavior changes.',
      'no attachment blob/provider behavior changes.',
      'no Signal Panel changes.',
      `no ${'NotesOverview'}${'SignalPanel'} mount.`,
      'no Health/Schedule changes.',
      'no assets/fonts/dependencies.',
      'no generated artifacts.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('records closure statement', () => {
    const doc = readDoc();

    for (const required of [
      '## Closure Statement',
      'K-286 defines auth/Supabase restoration boundaries only.',
      'K-286 does not restore auth behavior yet.',
      'Future implementation must restore protected runtime access without changing local-first data ownership.',
      'Login/auth callback must remain public.',
      'Protected app surfaces must require an authenticated Supabase session.',
      'Backup/preflight and provider recovery remain untouched.',
      'Signal Panel line remains paused and unmounted.',
      'Local runtime data remains source of truth.',
      'Remote systems remain support layers.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('verifies referenced source files exist', () => {
    for (const path of [
      appPath,
      localAuthPath,
      syncModePath,
      remoteBoundaryPath,
      supabasePath,
      appContentPath,
      loginViewPath,
      appLocalAuthTestPath,
      localAuthTestPath,
      supabaseBoundaryTestPath,
    ]) {
      expect(existsSync(path)).toBe(true);
    }
  });

  it('verifies current local-auth bypass source facts still match the plan', () => {
    const app = read(appPath);
    const localAuth = read(localAuthPath);
    const syncMode = read(syncModePath);
    const appLocalAuthTest = read(appLocalAuthTestPath);

    expect(app).toContain("import { createLocalAuthUser, isLocalOnlyRuntime } from './lib/localAuth';");
    expect(app).toContain('if (isLocalOnlyRuntime())');
    expect(app).toContain('setAuthUser(createLocalAuthUser())');
    expect(app).toContain('supabase.auth.getSession()');
    expect(app).toContain('supabase.auth.onAuthStateChange');

    expect(localAuth).toContain("export const LOCAL_AUTH_USER_ID = 'local-user';");
    expect(localAuth).toContain("export const LOCAL_AUTH_EMAIL = 'local@absinthe.dev';");
    expect(localAuth).toContain('resolveNotesRuntimeSyncMode() === \'local\'');

    expect(syncMode).toContain("export const NOTES_RUNTIME_SYNC_MODE_KEY = 'absinthe-notes-sync-mode';");
    expect(syncMode).toContain("return 'local';");

    expect(appLocalAuthTest).toContain('boots the app shell with a local user without touching Supabase auth in local mode');
    expect(appLocalAuthTest).toContain('keeps the login gate for explicit remote mode when Supabase auth fails');
  });

  it('verifies remote boundary source facts remain separate from auth restoration planning', () => {
    const remoteBoundary = read(remoteBoundaryPath);
    const supabase = read(supabasePath);

    expect(remoteBoundary).toContain('return !isLocalOnlyRuntime();');
    expect(remoteBoundary).toContain('remoteSWRKey');
    expect(remoteBoundary).toContain('assertRemoteMutationAllowed');

    expect(supabase).toContain('createClient(');
    expect(supabase).toContain('import.meta.env.VITE_SUPABASE_URL');
    expect(supabase).toContain('import.meta.env.VITE_SUPABASE_ANON_KEY');
    expect(supabase).toContain('if (!shouldUseRemoteData())');
    expect(supabase).toContain('supabase.auth.getSession()');
  });

  it('documents the intended K-286 PR file scope without relying on git refs', () => {
    const doc = readDoc();
    const testSource = read(auditTestPath);

    // PR changed-file containment is validated by reviewer/CI diff commands.
    // This audit test intentionally avoids branch-diff assertions because CI
    // checkout refs may be shallow, detached, or missing main/origin refs.
    for (const expectedFile of expectedK286ChangedFiles) {
      expect(testSource).toContain(expectedFile);
    }

    for (const requiredBoundary of [
      'K-286 is docs/plan plus audit test only.',
      'K-286 does not change runtime auth behavior.',
      'no auth runtime behavior change in K-286.',
      'no route guard implementation.',
      'no Supabase client/config modification.',
      'no env variable changes.',
      'no Notes runtime changes.',
      'no Signal Panel changes.',
      'no backup/export/import/restore behavior changes.',
      'no provider recovery behavior changes.',
      'no Health/Schedule changes.',
      'no generated artifacts.',
    ]) {
      expect(doc).toContain(requiredBoundary);
    }
  });

  it('treats runtime auth files as source facts only, not implementation targets', () => {
    const doc = readDoc();
    const testSource = read(auditTestPath);

    for (const sourceFactFile of [
      'frontend/src/App.tsx',
      'frontend/src/lib/localAuth.ts',
      'frontend/src/lib/syncMode.ts',
    ]) {
      expect(doc).toContain(sourceFactFile);
      expect(testSource).toContain(sourceFactFile);
    }

    for (const forbiddenApproval of [
      'implements auth restoration',
      'implements a route guard',
      'modifies the Supabase client',
      'changes runtime auth behavior',
      'approves production bypass',
      'adds test auth bypass implementation',
      'adds mock auth provider implementation',
      'commits service role',
      'commits secrets',
    ]) {
      expect(doc.toLowerCase()).not.toContain(forbiddenApproval);
    }
  });
});
