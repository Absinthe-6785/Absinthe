import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const srcRoot = join(root, 'src');
const docsRoot = join(root, 'docs');

const docPath = join(docsRoot, 'K-295-auth-restoration-test-dev-verification-line-closure-audit.md');
const k286DocPath = join(docsRoot, 'K-286-auth-supabase-runtime-access-restoration-boundary-plan.md');
const k287DocPath = join(docsRoot, 'K-287-auth-supabase-runtime-access-restoration-source-facts-audit.md');
const k288DocPath = join(docsRoot, 'K-288-auth-supabase-runtime-access-restoration-implementation-plan.md');
const k290DocPath = join(docsRoot, 'K-290-auth-supabase-runtime-access-restoration-closure-audit.md');
const k291DocPath = join(docsRoot, 'K-291-auth-test-dev-verification-strategy-plan.md');
const k292DocPath = join(docsRoot, 'K-292-auth-test-dev-verification-helper-implementation-plan.md');
const k294DocPath = join(docsRoot, 'K-294-auth-test-dev-verification-helper-closure-audit.md');

const appPath = join(srcRoot, 'App.tsx');
const appContentPath = join(srcRoot, 'components', 'AppContent.tsx');
const loginScreenPath = join(srcRoot, 'components', 'views', 'LoginScreen.tsx');
const appLocalAuthTestPath = join(srcRoot, 'App.localAuth.test.ts');
const localAuthPath = join(srcRoot, 'lib', 'localAuth.ts');
const syncModePath = join(srcRoot, 'lib', 'syncMode.ts');
const supabasePath = join(srcRoot, 'lib', 'supabase.ts');
const k290AuditTestPath = join(srcRoot, 'lib', 'authSupabaseRuntimeAccessRestorationClosureAudit.test.ts');
const k291AuditTestPath = join(srcRoot, 'lib', 'authTestDevVerificationStrategyPlan.test.ts');
const k292AuditTestPath = join(srcRoot, 'lib', 'authTestDevVerificationHelperImplementationPlan.test.ts');
const k293AuditTestPath = join(srcRoot, 'lib', 'authTestDevVerificationHelperImplementationAudit.test.ts');
const k294AuditTestPath = join(srcRoot, 'lib', 'authTestDevVerificationHelperClosureAudit.test.ts');
const signalPanelClosureAuditPath = join(srcRoot, 'lib', 'notesOverviewSignalPanelIsolatedComponentClosureAudit.test.ts');
const signalPanelComponentPath = join(srcRoot, 'components', 'notes', ['NotesOverview', 'SignalPanel.tsx'].join(''));
const helperPath = join(srcRoot, 'test-utils', 'auth', 'mockSupabaseAuthSession.ts');
const helperTestPath = join(srcRoot, 'test-utils', 'auth', 'mockSupabaseAuthSession.test.ts');

function read(path: string): string {
  return readFileSync(path, 'utf8');
}

function collectSourceFiles(path: string): string[] {
  if (!existsSync(path)) return [];

  return readdirSync(path).flatMap(entry => {
    const child = join(path, entry);
    const stats = statSync(child);

    if (stats.isDirectory()) return collectSourceFiles(child);

    return /\.(ts|tsx)$/.test(entry) ? [child] : [];
  });
}

function toRepoPath(path: string): string {
  return relative(root, path).replace(/\\/g, '/');
}

function importsHelper(path: string): boolean {
  return /from\s+['"][^'"]*mockSupabaseAuthSession['"]/.test(read(path));
}

function isTestOrAuditSource(path: string): boolean {
  const repoPath = toRepoPath(path);
  if (repoPath === 'src/test-utils/auth/mockSupabaseAuthSession.ts') return true;
  if (repoPath.includes('/test-utils/')) return true;
  return /\.(test|spec)\.(ts|tsx)$/.test(repoPath);
}

describe('K-295 auth restoration and test/dev verification line closure audit', () => {
  it('documents scope, line closure, evidence categories, next path, and non-goals', () => {
    expect(existsSync(docPath)).toBe(true);
    const doc = read(docPath);

    [
      'K-295 closes the K-286 through K-294 auth restoration and test/dev verification line',
      'docs/source audit plus audit test only',
      'does not modify auth runtime behavior',
      'does not modify the test/dev auth helper',
      'no `App.tsx` change',
      'no `AppContent.tsx` change',
      'no route guard change',
      'no credentials',
      'no storageState artifact',
      'no production bypass flag',
      'no service-role key',
      'Line Summary',
      'Restored Auth Posture Audit',
      'Production Bypass Removal Audit',
      'Test/Dev Helper Audit',
      'Credential And Artifact Hygiene Audit',
      'Test And CI Evidence Audit',
      'Authenticated Browser QA Gap',
      'Date.now / expires_in Future Hardening',
      'Local-first / Notes Boundary Audit',
      'Remaining Release / Manual QA Items',
      'Line Closure Decision',
      'Recommended Next Path',
      'K-296 Notes Overview / Signal Panel Adapter Boundary Audit',
      'Non-goals',
      'Closure Statement',
    ].forEach(expected => {
      expect(doc).toContain(expected);
    });

    ['K-286', 'K-287', 'K-288', 'K-289', 'K-290', 'K-291', 'K-292', 'K-293', 'K-294'].forEach(milestone => {
      expect(doc).toContain(milestone);
    });
  });

  it('keeps line evidence files present for source-invariant closure', () => {
    [
      k286DocPath,
      k287DocPath,
      k288DocPath,
      k290DocPath,
      k291DocPath,
      k292DocPath,
      k294DocPath,
      k290AuditTestPath,
      k291AuditTestPath,
      k292AuditTestPath,
      k293AuditTestPath,
      k294AuditTestPath,
      appLocalAuthTestPath,
      appPath,
      appContentPath,
      loginScreenPath,
      localAuthPath,
      syncModePath,
      supabasePath,
      helperPath,
      helperTestPath,
      signalPanelClosureAuditPath,
      signalPanelComponentPath,
    ].forEach(path => {
      expect(existsSync(path), path).toBe(true);
    });
  });

  it('asserts the restored app shell auth posture from source', () => {
    const app = read(appPath);
    const appContent = read(appContentPath);
    const appTest = read(appLocalAuthTestPath);

    expect(app).toContain('supabase.auth.getSession()');
    expect(app).toContain('supabase.auth.onAuthStateChange');
    expect(app).toContain('<LoginScreen />');
    expect(app).toContain('<AppContent authUser={authUser} />');
    expect(app).not.toContain('createLocalAuthUser');
    expect(app).not.toContain('isLocalOnlyRuntime');
    expect(app).not.toContain('mockSupabaseAuthSession');

    expect(appContent).toContain('await supabase.auth.signOut();');
    expect(appContent).not.toContain('mockSupabaseAuthSession');

    expect(appTest).toContain('does not let default local sync mode bypass the Supabase auth gate');
    expect(appTest).toContain('renders the protected app shell for a real Supabase session');
    expect(appTest).toContain('keeps protected content hidden while the Supabase session is loading');
  });

  it('keeps helper imports limited to test and audit sources', () => {
    const occurrences = collectSourceFiles(srcRoot)
      .filter(path => path === helperPath || importsHelper(path))
      .map(path => ({
        repoPath: toRepoPath(path),
        allowed: isTestOrAuditSource(path),
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

  it('keeps helper source free of runtime side effects, credential artifacts, and production bypasses', () => {
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
      'client secret',
    ].forEach(forbidden => {
      expect(lowerHelper).not.toContain(forbidden);
    });
  });

  it('records browser QA and Date.now / expires_in as remaining release or future-hardening work', () => {
    const doc = read(docPath);
    const helper = read(helperPath);

    expect(doc).toContain('Authenticated browser QA with real Supabase credentials remains a release/manual QA gap');
    expect(doc).toContain('K-295 adds no fake login proof');
    expect(doc).toContain('storageState is used later, it must stay external and uncommitted');

    if (helper.includes('Date.now()') && helper.includes('expires_in')) {
      expect(doc).toContain('Date.now / expires_in Future Hardening');
      expect(doc).toContain('expires_in: Math.max(0, expiresAt - Math.floor(Date.now() / 1000))');
      expect(doc).toContain('does not block auth line closure');
    } else {
      expect(doc).toContain('deterministic');
    }
  });
});
