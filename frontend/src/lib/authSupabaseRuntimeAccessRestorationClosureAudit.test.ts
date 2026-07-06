import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const docPath = join(root, 'docs', 'K-290-auth-supabase-runtime-access-restoration-closure-audit.md');
const appPath = join(root, 'src', 'App.tsx');
const appContentPath = join(root, 'src', 'components', 'AppContent.tsx');
const appLocalAuthTestPath = join(root, 'src', 'App.localAuth.test.ts');
const localAuthPath = join(root, 'src', 'lib', 'localAuth.ts');
const syncModePath = join(root, 'src', 'lib', 'syncMode.ts');
const supabasePath = join(root, 'src', 'lib', 'supabase.ts');
const loginScreenPath = join(root, 'src', 'components', 'views', 'LoginScreen.tsx');

function read(path: string): string {
  return readFileSync(path, 'utf8');
}

describe('K-290 auth Supabase runtime access restoration closure audit', () => {
  it('documents closure scope, restored posture, evidence, gaps, and non-goals', () => {
    expect(existsSync(docPath)).toBe(true);
    const doc = read(docPath);

    [
      'K-290 closes the K-289 auth restoration implementation',
      'docs/source audit plus audit test only',
      'does not modify auth gate behavior',
      'no `App.tsx` modification',
      'no `AppContent.tsx` modification',
      'no `localAuth.ts` modification',
      'no `syncMode.ts` modification',
      'no `supabase.ts` modification',
      'no mock auth provider implementation',
      'no test credentials',
      'no production bypass flag',
      'no frontend secret/service-role key',
      'Protected `AppContent` now requires a Supabase session',
      'K-289 Implementation Source Audit',
      'Protected Shell Gate Audit',
      'Public Auth Surface Audit',
      'localAuth / syncMode Boundary Audit',
      'Supabase / Session Boundary Audit',
      'Local-first / Notes Boundary Audit',
      'Test and CI Evidence Audit',
      'Security / Bypass Audit',
      'Remaining Gaps',
      'Runtime Exposure / Release Gate',
      'Recommended K-291 path: Auth Test/Dev Verification Strategy Plan',
      'Non-goals',
      'K-290 closes K-289 auth restoration implementation',
    ].forEach(expected => {
      expect(doc).toContain(expected);
    });
  });

  it('asserts restored auth gate source facts without relying on git refs', () => {
    [
      appPath,
      appContentPath,
      appLocalAuthTestPath,
      localAuthPath,
      syncModePath,
      supabasePath,
      loginScreenPath,
    ].forEach(path => {
      expect(existsSync(path), path).toBe(true);
    });

    const app = read(appPath);
    const appContent = read(appContentPath);
    const appLocalAuthTest = read(appLocalAuthTestPath);
    const localAuth = read(localAuthPath);
    const syncMode = read(syncModePath);
    const supabase = read(supabasePath);
    const loginScreen = read(loginScreenPath);

    expect(app).toContain('supabase.auth.getSession()');
    expect(app).toContain('supabase.auth.onAuthStateChange');
    expect(app).toContain('!authUser');
    expect(app).toContain('<LoginScreen />');
    expect(app).toContain('<AppContent authUser={authUser} />');
    expect(app).not.toContain("from './lib/localAuth'");
    expect(app).not.toContain('if (isLocalOnlyRuntime())');
    expect(app).not.toContain('setAuthUser(createLocalAuthUser())');

    expect(appContent).toContain('await supabase.auth.signOut();');
    expect(appContent).not.toContain('if (isLocalOnlyRuntime()) return;');

    expect(appLocalAuthTest).toContain('does not let default local sync mode bypass the Supabase auth gate');
    expect(appLocalAuthTest).toContain('renders the protected app shell for a real Supabase session in default local sync mode');
    expect(appLocalAuthTest).toContain('keeps protected content hidden while the Supabase session is loading');

    expect(localAuth).toContain('createLocalAuthUser');
    expect(syncMode).toContain("return 'local';");
    expect(supabase).toContain('supabase.auth.getSession()');
    expect(loginScreen).toContain('supabase.auth.signInWithPassword');
    expect(loginScreen).toContain('supabase.auth.signUp');
  });

  it('keeps source free of production bypass and secret markers', () => {
    const runtimeSources = [
      read(appPath),
      read(appContentPath),
      read(localAuthPath),
      read(syncModePath),
      read(supabasePath),
      read(loginScreenPath),
    ].join('\n');

    [
      'service-role',
      'service_role',
      'client secret',
      'production bypass flag',
      'auth disabled',
      'skip auth',
      'mock auth provider',
    ].forEach(forbidden => {
      expect(runtimeSources.toLowerCase()).not.toContain(forbidden);
    });
  });
});
