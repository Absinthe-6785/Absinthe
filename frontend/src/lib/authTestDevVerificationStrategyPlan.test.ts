import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const docPath = join(root, 'docs', 'K-291-auth-test-dev-verification-strategy-plan.md');
const k290DocPath = join(root, 'docs', 'K-290-auth-supabase-runtime-access-restoration-closure-audit.md');
const appPath = join(root, 'src', 'App.tsx');
const appContentPath = join(root, 'src', 'components', 'AppContent.tsx');
const appLocalAuthTestPath = join(root, 'src', 'App.localAuth.test.ts');
const localAuthPath = join(root, 'src', 'lib', 'localAuth.ts');
const syncModePath = join(root, 'src', 'lib', 'syncMode.ts');
const supabasePath = join(root, 'src', 'lib', 'supabase.ts');

function read(path: string): string {
  return readFileSync(path, 'utf8');
}

describe('K-291 auth test/dev verification strategy plan', () => {
  it('documents plan-only scope, restored posture, strategy, handoff, and non-goals', () => {
    expect(existsSync(docPath)).toBe(true);
    const doc = read(docPath);

    [
      'docs/plan plus audit test only',
      'does not implement a mock auth provider',
      'does not implement a Playwright/browser auth helper',
      'does not add test credentials',
      'does not add a production bypass flag',
      'localStorage spoofing bypass',
      'service-role key',
      'no `App.tsx` change',
      'no Supabase env/config change',
      'Current Restored Auth Posture Recap',
      'Verification Problem Statement',
      'Existing Test Coverage Audit',
      'Unit / Component Test Strategy',
      'Test/dev-only Helper Candidate Analysis',
      'Production Bypass Prohibition',
      'Browser / Manual QA Strategy',
      'CI Strategy',
      'AI / Codex Verification Strategy',
      'K-292 Implementation Boundary',
      'Recommended K-292 Path',
      'Non-goals',
    ].forEach(expected => {
      expect(doc).toContain(expected);
    });
  });

  it('keeps the plan grounded in current source files without relying on git refs', () => {
    [
      k290DocPath,
      appPath,
      appContentPath,
      appLocalAuthTestPath,
      localAuthPath,
      syncModePath,
      supabasePath,
    ].forEach(path => {
      expect(existsSync(path), path).toBe(true);
    });

    const app = read(appPath);
    const appContent = read(appContentPath);
    const appLocalAuthTest = read(appLocalAuthTestPath);
    const localAuth = read(localAuthPath);
    const syncMode = read(syncModePath);
    const supabase = read(supabasePath);

    expect(app).toContain('supabase.auth.getSession()');
    expect(app).toContain('<LoginScreen />');
    expect(app).toContain('<AppContent authUser={authUser} />');
    expect(app).not.toContain('setAuthUser(createLocalAuthUser())');
    expect(app).not.toContain('if (isLocalOnlyRuntime())');

    expect(appContent).toContain('await supabase.auth.signOut();');
    expect(appLocalAuthTest).toContain('does not let default local sync mode bypass the Supabase auth gate');
    expect(appLocalAuthTest).toContain('renders the protected app shell for a real Supabase session in default local sync mode');
    expect(localAuth).toContain('createLocalAuthUser');
    expect(syncMode).toContain("return 'local';");
    expect(supabase).toContain('supabase.auth.getSession()');
  });

  it('does not approve production auth bypasses or committed credential strategies', () => {
    const doc = read(docPath).toLowerCase();

    [
      'do not add a production bypass flag',
      'do not fake authenticated browser proof',
      'generated storagestate committed to repo',
      'committed supabase credentials',
      'frontend service-role key',
      'mock provider wired into production',
      'ci should not require real supabase credentials by default',
      'no production bypass',
    ].forEach(expected => {
      expect(doc).toContain(expected);
    });
  });
});
