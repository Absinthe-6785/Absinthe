import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const docPath = join(
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
const dailyHookPath = join(process.cwd(), 'src', 'hooks', 'useDaily.ts');
const staticHookPath = join(process.cwd(), 'src', 'hooks', 'useStatic.ts');
const appContentPath = join(process.cwd(), 'src', 'components', 'AppContent.tsx');
const loginViewPath = join(process.cwd(), 'src', 'components', 'views', 'LoginScreen.tsx');
const commonLoginPath = join(process.cwd(), 'src', 'components', 'common', 'LoginScreen.tsx');
const appLocalAuthTestPath = join(process.cwd(), 'src', 'App.localAuth.test.ts');
const localAuthTestPath = join(process.cwd(), 'src', 'lib', 'localAuth.test.ts');
const supabaseBoundaryTestPath = join(process.cwd(), 'src', 'lib', 'supabaseBoundary.test.ts');
const googleDriveOAuthCallbackPath = join(process.cwd(), 'src', 'lib', 'googleDriveOAuthCallback.ts');

function read(path: string): string {
  return readFileSync(path, 'utf8');
}

function readDoc(): string {
  return read(docPath);
}

describe('K-287 auth Supabase runtime access restoration source facts audit', () => {
  it('exists and states docs/source-audit-only scope', () => {
    expect(existsSync(docPath)).toBe(true);
    const doc = readDoc();

    for (const required of [
      'K-287 Auth/Supabase Runtime Access Restoration Source Facts Audit',
      'K-287 source-audits current auth/Supabase runtime access facts before restoration implementation.',
      'K-287 follows the K-286 Auth/Supabase Runtime Access Restoration Boundary Plan.',
      'K-287 is docs/source audit plus audit test only.',
      'K-287 does not implement auth restoration.',
      'K-287 does not change runtime auth behavior.',
      'K-287 does not change route guards.',
      'K-287 does not remove the local-mode bypass.',
      'K-287 does not change the Supabase session gate.',
      'K-287 does not add mock auth provider implementation.',
      'K-287 does not add test credentials.',
      'K-287 does not add Playwright/browser auth helpers.',
      'K-287 does not add a production bypass flag.',
      'K-287 does not add frontend secret/service-role keys.',
      'K-287 chooses the K-288 next path: Auth/Supabase Runtime Access Restoration Implementation Plan.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('summarizes current source facts for app access, local auth, sync mode, and Supabase', () => {
    const doc = readDoc();

    for (const required of [
      '## Current Source Facts Summary',
      '`frontend/src/main.tsx` mounts `App` directly under `ThemeProvider`',
      '`frontend/src/App.tsx` owns top-level auth branching',
      '`frontend/src/App.tsx` can render `AppContent` without a Supabase session',
      '`frontend/src/lib/localAuth.ts` synthesizes a Supabase-shaped local user',
      '`frontend/src/lib/syncMode.ts` selects sync mode from localStorage',
      '`frontend/src/lib/supabase.ts` creates the Supabase client',
      '`frontend/src/lib/supabase.ts` reads a Supabase session inside `authFetch`',
      '`frontend/src/components/views/LoginScreen.tsx` is the current app-level login screen',
      'No app auth callback route file was found in the inspected app shell.',
      '`frontend/src/App.localAuth.test.ts` covers local-mode app-shell access',
      '`frontend/src/lib/localAuth.test.ts` covers default local mode',
      '`frontend/src/lib/supabaseBoundary.test.ts` covers local-mode `authFetch` pausing',
      'Current no-login access is therefore explicit',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('audits App.tsx app shell access and localAuth.ts behavior', () => {
    const doc = readDoc();

    for (const required of [
      '## App Shell Access Audit',
      'Exact file path:',
      '`frontend/src/App.tsx`',
      '`authUser` state.',
      '`authLoading` state.',
      'an effect that first checks `isLocalOnlyRuntime()`.',
      'a local branch that calls `setAuthUser(createLocalAuthUser())`',
      'a remote/hybrid branch that calls `supabase.auth.getSession()`',
      '`supabase.auth.onAuthStateChange(...)`',
      '`!authUser ? <LoginScreen /> : <AppContent authUser={authUser} />`',
      'Current app shell can render without a Supabase session',
      'K-287 must not change `frontend/src/App.tsx`.',
      '## localAuth.ts Audit',
      '`frontend/src/lib/localAuth.ts`',
      '`LOCAL_AUTH_USER_ID`',
      '`LOCAL_AUTH_EMAIL`',
      '`isLocalOnlyRuntime()`',
      '`createLocalAuthUser()`',
      'This is synthesized authenticated state.',
      'It is not restricted to tests.',
      'K-287 must not change `frontend/src/lib/localAuth.ts`.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('audits syncMode and Supabase client/session flow', () => {
    const doc = readDoc();

    for (const required of [
      '## syncMode.ts Audit',
      '`frontend/src/lib/syncMode.ts`',
      '`NOTES_RUNTIME_SYNC_MODE_KEY`',
      '`resolveNotesRuntimeSyncMode()`',
      'localStorage key `absinthe-notes-sync-mode`',
      '`import.meta.env.VITE_ABSINTHE_SYNC_MODE`',
      'default `local`',
      'sync mode currently controls whether `App.tsx` bypasses Supabase session lookup.',
      'must not use sync mode as a production auth bypass.',
      '## Supabase Client / Session Audit',
      '`frontend/src/lib/supabase.ts`',
      '`import.meta.env.VITE_SUPABASE_URL`',
      '`import.meta.env.VITE_SUPABASE_ANON_KEY`',
      'No Supabase URL, anon key, service role key, password, access token, refresh token, or client secret is documented here.',
      '`frontend/src/App.tsx` via `supabase.auth.getSession()`',
      '`frontend/src/App.tsx` via `supabase.auth.onAuthStateChange(...)`',
      '`frontend/src/lib/supabase.ts` via `supabase.auth.getSession()` inside `authFetch`.',
      'Missing session blocks `AppContent` only when local mode is not active.',
      'K-287 must not change `frontend/src/lib/supabase.ts`.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('audits public surfaces and protected surface candidates', () => {
    const doc = readDoc();

    for (const required of [
      '## Public Surface Audit',
      '`frontend/src/components/views/LoginScreen.tsx`',
      '`frontend/src/components/common/LoginScreen.tsx`',
      'No app Supabase auth callback route file was identified',
      '`frontend/src/lib/googleDriveOAuthCallback.ts` exists',
      'not be treated as the app Supabase auth callback.',
      '## Protected Surface Candidate Audit',
      '`frontend/src/components/AppContent.tsx`',
      '`frontend/src/components/views/HomeView.tsx`',
      '`frontend/src/components/views/NoteView.tsx`',
      '`frontend/src/components/views/HealthView.tsx`',
      '`frontend/src/components/views/PlannerView.tsx`',
      '`frontend/src/components/views/AnalyticsView.tsx`',
      '`frontend/src/components/views/RecipeView.tsx`',
      '`frontend/src/components/views/SettingsView.tsx`',
      '`frontend/src/components/views/noteview/EmbeddedAttachmentMigrationReviewPanel.tsx`',
      'There is no route table separating these surfaces today',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('audits AI/Codex verification blockers and test/dev strategy candidates', () => {
    const doc = readDoc();

    for (const required of [
      '## AI / Codex Verification Blocker Audit',
      'The source does not contain a dedicated AI/Codex auth verification helper.',
      'current runtime posture, not a desired production access policy.',
      'deterministic app-shell testing without committed real credentials.',
      'no production bypass flag.',
      'no frontend service-role key.',
      'no real credentials committed.',
      'no broad auth-disabled mode in production.',
      'no query-param or localStorage production bypass',
      '## Test / Dev Verification Strategy Candidates',
      'Test-only mock session helper',
      'Test-only auth provider wrapper',
      'Local dev fixture session',
      'Playwright storage state or browser auth helper',
      '`frontend/scripts/productQaCapture.mjs`',
      'Supabase test user manual QA',
      'Route-level test harness',
      'K-287 implements none.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('audits production bypass risks and local-first boundary', () => {
    const doc = readDoc();

    for (const required of [
      '## Production Bypass Risk Audit',
      '`localAuth.ts` behavior is runtime code, not test-only.',
      '`syncMode.ts` defaults to local',
      'localStorage key `absinthe-notes-sync-mode`',
      '`VITE_ABSINTHE_SYNC_MODE`',
      'no route guard or router table currently separates public and protected surfaces.',
      'tests currently assert no-login local app-shell access',
      'service-role or secret keys must never be introduced into frontend code.',
      'missing Supabase env must not silently widen protected app access in production.',
      '## Local-first Boundary Audit',
      'Auth restoration must not make Notes remote-first.',
      'fetch all notes from Supabase at boot.',
      'rewrite local vault persistence.',
      'change `initNotesStorage()` / `hydrateFromDB()` ownership.',
      'alter backup/export/import/restore behavior.',
      'alter attachment blob/provider behavior.',
      'Auth restoration only gates access/session.',
      'Local runtime data remains source of truth',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('defines implementation prerequisites, K-288 path, non-goals, and closure', () => {
    const doc = readDoc();

    for (const required of [
      '## Implementation Prerequisites',
      'exact protected gate file.',
      'exact public route allowlist.',
      'exact session loading behavior.',
      'redirect or login-render behavior.',
      'callback behavior.',
      'logout behavior.',
      'test/dev verification strategy.',
      'migration path for tests that currently expect local no-login app-shell access.',
      '## K-288 Decision',
      '**K-288 Auth/Supabase Runtime Access Restoration Implementation Plan**',
      'docs/plan plus audit test only.',
      'no runtime changes.',
      'Not recommended yet:',
      'K-288 direct implementation.',
      '## Non-goals',
      'no auth restoration implementation in K-287.',
      'no local-mode bypass removal.',
      'no Supabase session gate change.',
      'no route guard change.',
      'no mock auth provider implementation.',
      'no test credentials.',
      'no Playwright/browser auth helper.',
      'no production bypass flag.',
      'no frontend secret/service-role key.',
      'no Supabase client/config change.',
      'no OAuth callback change.',
      'no Notes runtime change.',
      'no Signal Panel change.',
      'no Health/Schedule change.',
      'no generated artifacts.',
      '## Closure Statement',
      'K-287 locks source facts only.',
      'K-287 does not restore auth behavior yet.',
      'Current local/no-login access structure is documented from source.',
      'AI/Codex verification should be solved with test/dev-only strategy, not production bypass.',
      'Auth restoration must preserve local-first data ownership.',
      'Backup/provider/Signal Panel remain untouched.',
      'Local runtime data remains source of truth.',
      'Remote systems remain support layers.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('verifies referenced source files exist', () => {
    for (const path of [
      appPath,
      mainPath,
      localAuthPath,
      syncModePath,
      remoteBoundaryPath,
      supabasePath,
      dailyHookPath,
      staticHookPath,
      appContentPath,
      loginViewPath,
      commonLoginPath,
      appLocalAuthTestPath,
      localAuthTestPath,
      supabaseBoundaryTestPath,
      googleDriveOAuthCallbackPath,
    ]) {
      expect(existsSync(path)).toBe(true);
    }
  });

  it('verifies source facts without changing runtime files', () => {
    const app = read(appPath);
    const localAuth = read(localAuthPath);
    const syncMode = read(syncModePath);
    const supabase = read(supabasePath);
    const remoteBoundary = read(remoteBoundaryPath);
    const appContent = read(appContentPath);
    const login = read(loginViewPath);

    expect(app).toContain("import { createLocalAuthUser, isLocalOnlyRuntime } from './lib/localAuth';");
    expect(app).toContain('if (isLocalOnlyRuntime())');
    expect(app).toContain('setAuthUser(createLocalAuthUser())');
    expect(app).toContain('supabase.auth.getSession()');
    expect(app).toContain('supabase.auth.onAuthStateChange');
    expect(app).toContain('!authUser');
    expect(app).toContain('<LoginScreen />');
    expect(app).toContain('<AppContent authUser={authUser} />');

    expect(localAuth).toContain("export const LOCAL_AUTH_USER_ID = 'local-user';");
    expect(localAuth).toContain("export const LOCAL_AUTH_EMAIL = 'local@absinthe.dev';");
    expect(localAuth).toContain("resolveNotesRuntimeSyncMode() === 'local'");
    expect(localAuth).toContain('createLocalAuthUser');

    expect(syncMode).toContain("export const NOTES_RUNTIME_SYNC_MODE_KEY = 'absinthe-notes-sync-mode';");
    expect(syncMode).toContain('localStorage.getItem(NOTES_RUNTIME_SYNC_MODE_KEY)');
    expect(syncMode).toContain('import.meta.env.VITE_ABSINTHE_SYNC_MODE');
    expect(syncMode).toContain("return 'local';");

    expect(supabase).toContain('createClient(');
    expect(supabase).toContain('import.meta.env.VITE_SUPABASE_URL');
    expect(supabase).toContain('import.meta.env.VITE_SUPABASE_ANON_KEY');
    expect(supabase).toContain('supabase.auth.getSession()');
    expect(supabase).toContain('Authorization: `Bearer ${session.access_token}`');

    expect(remoteBoundary).toContain('return !isLocalOnlyRuntime();');
    expect(remoteBoundary).toContain('remoteSWRKey');

    expect(appContent).toContain('if (isLocalOnlyRuntime()) return;');
    expect(appContent).toContain('await supabase.auth.signOut();');

    expect(login).toContain('supabase.auth.signUp');
    expect(login).toContain('supabase.auth.signInWithPassword');
  });

  it('does not shell out to git or depend on branch topology', () => {
    const testSource = read(join(process.cwd(), 'src', 'lib', 'authSupabaseRuntimeAccessRestorationSourceFactsAudit.test.ts'));

    for (const forbidden of [
      `exec${'File'}Sync`,
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
