import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const docPath = join(root, 'docs', 'K-292-auth-test-dev-verification-helper-implementation-plan.md');
const k291DocPath = join(root, 'docs', 'K-291-auth-test-dev-verification-strategy-plan.md');
const k290DocPath = join(root, 'docs', 'K-290-auth-supabase-runtime-access-restoration-closure-audit.md');
const k288DocPath = join(root, 'docs', 'K-288-auth-supabase-runtime-access-restoration-implementation-plan.md');
const k287DocPath = join(root, 'docs', 'K-287-auth-supabase-runtime-access-restoration-source-facts-audit.md');
const k286DocPath = join(root, 'docs', 'K-286-auth-supabase-runtime-access-restoration-boundary-plan.md');
const appPath = join(root, 'src', 'App.tsx');
const appContentPath = join(root, 'src', 'components', 'AppContent.tsx');
const appLocalAuthTestPath = join(root, 'src', 'App.localAuth.test.ts');
const loginScreenPath = join(root, 'src', 'components', 'views', 'LoginScreen.tsx');
const localAuthPath = join(root, 'src', 'lib', 'localAuth.ts');
const syncModePath = join(root, 'src', 'lib', 'syncMode.ts');
const supabasePath = join(root, 'src', 'lib', 'supabase.ts');
const proposedHelperParentPath = join(root, 'src', 'test-utils', 'auth');

function read(path: string): string {
  return readFileSync(path, 'utf8');
}

describe('K-292 auth test/dev verification helper implementation plan', () => {
  it('documents plan-only scope, helper boundary sections, K-293 handoff, and non-goals', () => {
    expect(existsSync(docPath)).toBe(true);
    const doc = read(docPath);

    [
      'docs/plan plus audit test only',
      'does not implement the helper',
      'does not add mock provider/runtime wiring',
      'does not add credentials',
      'storageState artifacts',
      'localStorage spoofing',
      'service-role keys',
      'production bypass flag',
      'Current Restored Auth And Verification Recap',
      'Helper Problem Statement',
      'Proposed Helper Location',
      'Helper API Plan',
      'Mock Session Shape',
      'Production Exclusion Rule',
      'Unit / Component Verification Plan',
      'Browser / Manual QA Boundary',
      'CI Boundary',
      'K-293 Implementation Acceptance Criteria',
      'K-293 Expected Files',
      'K-293 Decision',
      'Non-goals',
      'K-293 Auth Test/Dev Verification Vitest Helper Implementation',
    ].forEach(expected => {
      expect(doc).toContain(expected);
    });
  });

  it('anchors the proposed helper path and import policy without implementing the helper', () => {
    const doc = read(docPath);

    expect(doc).toContain('frontend/src/test-utils/auth/mockSupabaseAuthSession.ts');
    expect(doc).toContain('The parent directory does not need to exist in K-292. K-293 may create it');
    expect(doc).toContain('*.test.ts');
    expect(doc).toContain('*.test.tsx');
    expect(doc).toContain('Vitest-only setup files');
    expect(doc).toContain('frontend/src/App.tsx');
    expect(doc).toContain('frontend/src/components/AppContent.tsx');
    expect(doc).toContain('frontend/src/lib/localAuth.ts');
    expect(doc).toContain('frontend/src/lib/syncMode.ts');
    expect(doc).toContain('frontend/src/lib/supabase.ts');
    expect(doc).toContain('The helper must not intentionally appear in the production bundle.');
    expect(doc).toContain('K-293 must include source audit assertions for import boundaries.');

    expect(existsSync(proposedHelperParentPath)).toBe(true);
  });

  it('defines the future helper API and safe mock session shape', () => {
    const doc = read(docPath);

    [
      'MockSupabaseAuthSessionOptions',
      'createMockSupabaseSession',
      'mockSupabaseAuthenticatedSession',
      'mockSupabaseUnauthenticatedSession',
      'mockSupabaseLoadingSession',
      'resetSupabaseAuthMocks',
      'Mock data only.',
      'No real credentials.',
      'No service-role key.',
      'No network calls.',
      'No localStorage production spoof.',
      'No storageState artifact.',
      'stable fake user id',
      'signed-in@example.com',
      'fake-access-token',
      'minimal user/session fields needed by Vitest component tests',
      'real emails',
      'real tokens',
      'Supabase anon key',
      'OAuth tokens',
    ].forEach(expected => {
      expect(doc).toContain(expected);
    });
  });

  it('keeps the plan grounded in current auth source facts and prior docs', () => {
    [
      k291DocPath,
      k290DocPath,
      k288DocPath,
      k287DocPath,
      k286DocPath,
      appPath,
      appContentPath,
      appLocalAuthTestPath,
      loginScreenPath,
      localAuthPath,
      syncModePath,
      supabasePath,
    ].forEach(path => {
      expect(existsSync(path), path).toBe(true);
    });

    const app = read(appPath);
    const appContent = read(appContentPath);
    const appLocalAuthTest = read(appLocalAuthTestPath);
    const loginScreen = read(loginScreenPath);
    const localAuth = read(localAuthPath);
    const syncMode = read(syncModePath);
    const supabase = read(supabasePath);

    expect(app).toContain('supabase.auth.getSession()');
    expect(app).toContain('supabase.auth.onAuthStateChange');
    expect(app).toContain('<LoginScreen />');
    expect(app).toContain('<AppContent authUser={authUser} />');
    expect(app).not.toContain('setAuthUser(createLocalAuthUser())');
    expect(app).not.toContain('if (isLocalOnlyRuntime())');

    expect(appContent).toContain('await supabase.auth.signOut();');
    expect(appLocalAuthTest).toContain('vi.mock');
    expect(appLocalAuthTest).toContain('getSessionMock');
    expect(appLocalAuthTest).toContain('onAuthStateChangeMock');
    expect(appLocalAuthTest).toContain('renders the protected app shell for a real Supabase session');
    expect(loginScreen).toContain('supabase.auth.signInWithPassword');
    expect(loginScreen).toContain('supabase.auth.signUp');
    expect(localAuth).toContain('createLocalAuthUser');
    expect(syncMode).toContain("return 'local';");
    expect(supabase).toContain('supabase.auth.getSession()');
  });

  it('does not approve runtime auth widening, credential artifacts, or browser fake-login proof', () => {
    const doc = read(docPath);
    const lowerDoc = doc.toLowerCase();

    [
      'no helper implementation',
      'no mock auth provider implementation',
      'no playwright/browser auth helper implementation',
      'no test credentials',
      'no storagestate artifact',
      'no production bypass flag',
      'no localstorage spoofing bypass',
      'no service-role key',
      'no `app.tsx` change',
      'no `appcontent.tsx` change',
      'no route guard change',
      'no supabase env/config change',
      'no `localauth.ts` change',
      'no `syncmode.ts` change',
      'no `supabase.ts` change',
      'no notes runtime change',
      'no signal panel change',
      'no backup/export/import/restore behavior change',
      'no health/schedule change',
      'no generated artifacts',
      'storageState must not be committed',
      'authenticated browser QA remains blocked',
      'missing E2E credentials should report skipped or blocked, not fake pass',
    ].forEach(expected => {
      expect(lowerDoc).toContain(expected.toLowerCase());
    });
  });
});
