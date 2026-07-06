import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const srcRoot = join(root, 'src');
const docPath = join(root, 'docs', 'K-294-auth-test-dev-verification-helper-closure-audit.md');
const helperPath = join(srcRoot, 'test-utils', 'auth', 'mockSupabaseAuthSession.ts');
const helperTestPath = join(srcRoot, 'test-utils', 'auth', 'mockSupabaseAuthSession.test.ts');
const k293AuditPath = join(srcRoot, 'lib', 'authTestDevVerificationHelperImplementationAudit.test.ts');
const k292PlanPath = join(root, 'docs', 'K-292-auth-test-dev-verification-helper-implementation-plan.md');
const k291PlanPath = join(root, 'docs', 'K-291-auth-test-dev-verification-strategy-plan.md');
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

function importsHelper(path: string): boolean {
  return /from\s+['"][^'"]*mockSupabaseAuthSession['"]/.test(read(path));
}

function isAllowedHelperImporter(path: string): boolean {
  const repoPath = toRepoPath(path);
  if (repoPath === 'src/test-utils/auth/mockSupabaseAuthSession.ts') return true;
  if (repoPath === 'src/test-utils/auth/mockSupabaseAuthSession.test.ts') return true;
  if (repoPath === 'src/App.localAuth.test.ts') return true;
  return /\.(test|spec)\.(ts|tsx)$/.test(repoPath);
}

describe('K-294 auth test/dev verification helper closure audit', () => {
  it('documents closure scope, source audits, gaps, K-295 path, and non-goals', () => {
    expect(existsSync(docPath)).toBe(true);
    const doc = read(docPath);

    [
      'docs/source audit plus audit test only',
      'does not modify the helper',
      'does not change auth runtime behavior',
      'no `App.tsx` change',
      'no `AppContent.tsx` change',
      'no route guard change',
      'no mock provider runtime wiring',
      'no browser/Playwright helper',
      'no credentials',
      'no storageState artifact',
      'no production bypass flag',
      'no service-role key',
      'Current Helper Posture Summary',
      'K-293 Implementation Source Audit',
      'Import Boundary Audit',
      'Credential And Artifact Hygiene Audit',
      'Production Bypass Audit',
      'Test Coverage Audit',
      'Date.now / expires_in Low Note',
      'Browser / Manual QA Boundary',
      'Runtime Safety Audit',
      'Remaining Gaps',
      'K-295 Supabase Auth Manual QA / Release Readiness Audit',
      'Non-goals',
      'K-294 closes K-293 test/dev-only auth helper implementation',
    ].forEach(expected => {
      expect(doc).toContain(expected);
    });
  });

  it('asserts helper, tests, prior plans, and protected runtime files exist', () => {
    [
      helperPath,
      helperTestPath,
      k293AuditPath,
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

  it('audits helper API, fake values, and forbidden side effects', () => {
    const helper = read(helperPath);
    const lowerHelper = helper.toLowerCase();

    [
      'createMockSupabaseUser',
      'createMockSupabaseSession',
      'createMockSupabaseAuthResponse',
      'createMockSupabaseUnauthenticatedAuthResponse',
      'createMockSupabaseSignOutResponse',
      'test-user-id',
      'auth-test@example.com',
      'fake-access-token',
      'fake-refresh-token',
    ].forEach(expected => {
      expect(helper).toContain(expected);
    });

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

  it('keeps helper imports limited to tests and protected runtime files free of helper imports', () => {
    const occurrences = collectSourceFiles(srcRoot)
      .filter(path => path === helperPath || importsHelper(path))
      .map(path => ({
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

  it('records the Date.now / expires_in low note when the helper uses that derived value', () => {
    const helper = read(helperPath);
    const doc = read(docPath);

    if (helper.includes('Date.now()') && helper.includes('expires_in')) {
      expect(doc).toContain('Date.now / expires_in Low Note');
      expect(doc).toContain('expires_in: Math.max(0, expiresAt - Math.floor(Date.now() / 1000))');
      expect(doc).toContain('low risk');
      expect(doc).toContain('Future hardening options');
    } else {
      expect(doc).toContain('already deterministic');
    }
  });
});
