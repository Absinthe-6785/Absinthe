import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const srcRoot = join(root, 'src');
const docsRoot = join(root, 'docs');
const helperPath = join(srcRoot, 'test-utils', 'auth', 'mockSupabaseAuthSession.ts');
const helperTestPath = join(srcRoot, 'test-utils', 'auth', 'mockSupabaseAuthSession.test.ts');
const auditTestPath = join(srcRoot, 'lib', 'authTestDevVerificationHelperImplementationAudit.test.ts');
const k292PlanPath = join(docsRoot, 'K-292-auth-test-dev-verification-helper-implementation-plan.md');
const k291PlanPath = join(docsRoot, 'K-291-auth-test-dev-verification-strategy-plan.md');
const appPath = join(srcRoot, 'App.tsx');
const appContentPath = join(srcRoot, 'components', 'AppContent.tsx');
const appLocalAuthTestPath = join(srcRoot, 'App.localAuth.test.ts');
const localAuthPath = join(srcRoot, 'lib', 'localAuth.ts');
const syncModePath = join(srcRoot, 'lib', 'syncMode.ts');
const supabasePath = join(srcRoot, 'lib', 'supabase.ts');

function read(path: string): string {
  return readFileSync(path, 'utf8');
}

function collectSourceFiles(path: string): string[] {
  if (!existsSync(path)) return [];

  return readdirSync(path).flatMap(entry => {
    const child = join(path, entry);
    const stats = statSync(child);

    if (stats.isDirectory()) {
      return collectSourceFiles(child);
    }

    return /\.(ts|tsx)$/.test(entry) ? [child] : [];
  });
}

function toRepoPath(path: string): string {
  return relative(root, path).replace(/\\/g, '/');
}

function isAllowedHelperImporter(path: string): boolean {
  const repoPath = toRepoPath(path);
  if (path === helperPath) return true;
  if (path === helperTestPath) return true;
  if (path === auditTestPath) return true;
  if (repoPath === 'src/App.localAuth.test.ts') return true;
  return /\.(test|spec)\.(ts|tsx)$/.test(repoPath);
}

function importsHelper(path: string): boolean {
  return /from\s+['"][^'"]*mockSupabaseAuthSession['"]/.test(read(path));
}

describe('K-293 auth test/dev verification helper implementation audit', () => {
  it('adds the helper, helper test, and planning docs without git-ref assumptions', () => {
    [
      helperPath,
      helperTestPath,
      auditTestPath,
      k292PlanPath,
      k291PlanPath,
      appPath,
      appContentPath,
      appLocalAuthTestPath,
      localAuthPath,
      syncModePath,
      supabasePath,
    ].forEach(path => {
      expect(existsSync(path), path).toBe(true);
    });
  });

  it('keeps the helper pure, fake-only, and free of runtime bypass mechanisms', () => {
    const helper = read(helperPath);
    const lowerHelper = helper.toLowerCase();

    expect(helper).toContain("DEFAULT_MOCK_SUPABASE_USER_ID = 'test-user-id'");
    expect(helper).toContain("DEFAULT_MOCK_SUPABASE_EMAIL = 'auth-test@example.com'");
    expect(helper).toContain("DEFAULT_MOCK_SUPABASE_ACCESS_TOKEN = 'fake-access-token'");
    expect(helper).toContain("DEFAULT_MOCK_SUPABASE_REFRESH_TOKEN = 'fake-refresh-token'");
    expect(helper).toContain('createMockSupabaseSession');
    expect(helper).toContain('createMockSupabaseAuthResponse');
    expect(helper).toContain('createMockSupabaseUnauthenticatedAuthResponse');
    expect(helper).toContain('createMockSupabaseSignOutResponse');

    [
      'service-role',
      'service_role',
      'storagestate',
      'localstorage',
      'sessionstorage',
      'fetch(',
      'xmlhttprequest',
      'import.meta.env',
      'process.env',
      'production bypass',
      'skip auth',
      'auth disabled',
      'supabase.co',
    ].forEach(forbidden => {
      expect(lowerHelper).not.toContain(forbidden);
    });
  });

  it('does not import runtime app, route, data, backup, provider, or signal panel modules from the helper', () => {
    const helper = read(helperPath);
    const lowerHelper = helper.toLowerCase();

    [
      '../app',
      'appcontent',
      'loginscreen',
      'localauth',
      'syncmode',
      './supabase',
      '../supabase',
      'usenotesstore',
      'notesoverviewsignalpanel',
      'vaultbackup',
      'vaultrestore',
      'googledrive',
      'healthview',
      'plannerview',
    ].forEach(forbidden => {
      expect(lowerHelper).not.toContain(forbidden);
    });
  });

  it('keeps helper imports limited to tests and the helper itself', () => {
    const occurrences = collectSourceFiles(srcRoot)
      .filter(path => path === helperPath || importsHelper(path))
      .map(path => ({
        path,
        repoPath: toRepoPath(path),
        allowed: isAllowedHelperImporter(path),
      }));

    expect(occurrences.map(item => item.repoPath).sort()).toEqual([
      'src/App.localAuth.test.ts',
      'src/test-utils/auth/mockSupabaseAuthSession.test.ts',
      'src/test-utils/auth/mockSupabaseAuthSession.ts',
    ]);

    occurrences.forEach(item => {
      expect(item.allowed, item.repoPath).toBe(true);
    });
  });

  it('keeps protected runtime sources free of helper imports', () => {
    [
      appPath,
      appContentPath,
      localAuthPath,
      syncModePath,
      supabasePath,
    ].forEach(path => {
      expect(read(path)).not.toContain('mockSupabaseAuthSession');
    });
  });
});
