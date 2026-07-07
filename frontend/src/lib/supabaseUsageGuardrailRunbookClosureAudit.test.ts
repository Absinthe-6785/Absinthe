import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const docsRoot = join(root, 'docs');
const srcRoot = join(root, 'src');
const libRoot = join(srcRoot, 'lib');
const metadataModuleStem = 'supabaseUsage' + 'RouteMetadata';

const k302DocPath = join(docsRoot, 'K-302-supabase-usage-guardrail-runbook-closure-audit.md');
const k301DocPath = join(docsRoot, 'K-301-supabase-usage-guardrail-runbook-monitoring-plan.md');
const k300DocPath = join(docsRoot, 'K-300-supabase-usage-route-metadata-closure-audit.md');
const k298DocPath = join(docsRoot, 'K-298-supabase-usage-guardrail-minimal-implementation-plan.md');
const k297DocPath = join(docsRoot, 'K-297-supabase-usage-guardrail-implementation-plan.md');
const k296DocPath = join(docsRoot, 'K-296-supabase-usage-quota-traffic-risk-source-facts-audit.md');
const k301TestPath = join(libRoot, 'supabaseUsageGuardrailRunbookMonitoringPlan.test.ts');
const metadataPath = join(libRoot, `${metadataModuleStem}.ts`);
const metadataTestPath = join(libRoot, `${metadataModuleStem}.test.ts`);
const metadataBoundaryAuditPath = join(libRoot, `${metadataModuleStem}BoundaryAudit.test.ts`);

const protectedRuntimePaths = [
  join(srcRoot, 'App.tsx'),
  join(srcRoot, 'components', 'AppContent.tsx'),
  join(libRoot, 'supabase.ts'),
  join(libRoot, 'fetcher.ts'),
  join(libRoot, 'remoteBoundary.ts'),
  join(srcRoot, 'hooks', 'useDaily.ts'),
  join(srcRoot, 'hooks', 'useStatic.ts'),
  join(srcRoot, 'components', 'views', 'LegacyAnalyticsView.tsx'),
];

function read(path: string): string {
  return readFileSync(path, 'utf8');
}

describe('supabase usage guardrail runbook closure audit', () => {
  it('adds K-302 closure audit and keeps the prior Supabase usage line present', () => {
    [
      k302DocPath,
      k301DocPath,
      k301TestPath,
      k300DocPath,
      k298DocPath,
      k297DocPath,
      k296DocPath,
      metadataPath,
      metadataTestPath,
      metadataBoundaryAuditPath,
      ...protectedRuntimePaths,
    ].forEach((path) => {
      expect(existsSync(path), path).toBe(true);
    });
  });

  it('states K-302 is closure-only with no runtime enforcement or wiring', () => {
    const doc = read(k302DocPath);

    [
      'K-302 is docs/source closure audit plus audit test only.',
      'K-302 does not implement runtime enforcement.',
      'K-302 does not add monitoring/logging code.',
      'K-302 does not modify metadata.',
      'no runtime enforcement implementation.',
      'no authFetch wiring.',
      'no request blocking/throttling.',
      'no circuit breaker implementation.',
      'no analytics polling change.',
      'no metadata module modification.',
      'no metadata runtime wiring.',
      'no Supabase client/config/env change.',
      'no monitoring/logging code.',
    ].forEach((expected) => {
      expect(doc).toContain(expected);
    });
  });

  it('summarizes the current line posture from K-296 through K-301', () => {
    const doc = read(k302DocPath);

    [
      'K-296 completed source facts audit',
      'K-297 completed guardrail strategy planning',
      'K-298 completed the minimal implementation plan',
      'K-299 implemented pure Supabase usage route metadata.',
      'K-300 closed the metadata boundary',
      'K-301 added the operational runbook/monitoring plan',
      'direct frontend Supabase table/storage/realtime usage remains absent.',
      'authFetch/backend-route based posture remains.',
      'metadata remains pure and not runtime-wired.',
      'Runtime request behavior remains unchanged.',
    ].forEach((expected) => {
      expect(doc).toContain(expected);
    });
  });

  it('audits K-301 coverage, runbook quality, and closure decision', () => {
    const doc = read(k302DocPath);

    [
      '## K-301 Plan Coverage Audit',
      '| Monitoring objectives | Present | No | Operational guidance only |',
      '| Supabase dashboard metrics checklist | Present | No | Category-level checklist only |',
      '| Backend-route fanout observation plan | Present | No | Manual correlation plan only |',
      '| Request budget monitoring plan | Present | No | Monitoring budgets only; no enforcement |',
      '| Analytics polling monitoring plan | Present | No | Observes `refreshInterval: 60000`; no polling change |',
      '| Error/quota/spike response runbook | Present | No | Incident response steps only |',
      '| Evidence capture template | Present | No | Manual template only |',
      'K-301 does not claim live monitoring exists.',
      'dashboard metrics are category-level',
      'evidence capture template avoids secrets and user content.',
      'escalation thresholds are qualitative',
      'K-296 through K-302 Supabase usage/quota prevention planning line is now documented',
      'It is safe to pause this line after K-302 if CI is green.',
    ].forEach((expected) => {
      expect(doc).toContain(expected);
    });
  });

  it('audits metadata continuity, credential hygiene, and product boundaries', () => {
    const doc = read(k302DocPath);

    [
      'metadata module remains unchanged.',
      'metadata remains pure.',
      'metadata is not imported by protected runtime files.',
      'unknown/unclassified fallback remains conservative.',
      'metadata is still not enforcement.',
      'no credentials committed.',
      'no service-role key.',
      'no storageState artifact.',
      'no Supabase env/config changes.',
      'no package/Vite changes.',
      'protected auth posture from K-289 through K-295 remains unchanged.',
      'local-first Notes ownership remains unchanged.',
      'no remote-first note hydration.',
      'no backup/export/import/restore behavior changes.',
      'Signal Panel remains paused/unmounted and unrelated.',
      'Health/Schedule unchanged.',
    ].forEach((expected) => {
      expect(doc).toContain(expected);
    });
  });

  it('records remaining gaps and recommends a safe K-303 path', () => {
    const doc = read(k302DocPath);

    [
      'no runtime enforcement yet.',
      'no live monitoring/logging code yet.',
      'no circuit breaker yet.',
      'no analytics polling change yet.',
      'no metadata runtime consumer yet.',
      'future absolute quota thresholds may require real Supabase plan/project data.',
      'Primary recommendation: K-303 Notes Overview / Signal Panel Adapter Boundary Audit.',
      'docs/source audit plus audit test only.',
      'no runtime mount.',
      'no data adapter implementation.',
      'no Supabase usage changes.',
      'Not recommended:',
      'immediate circuit breaker implementation.',
      'production bypass.',
    ].forEach((expected) => {
      expect(doc).toContain(expected);
    });
  });

  it('keeps source assertions deterministic and free of git or shell dependencies', () => {
    const testSource = read(__filename);
    const metadata = read(metadataPath);
    const legacyAnalytics = read(join(srcRoot, 'components', 'views', 'LegacyAnalyticsView.tsx'));
    const fetcher = read(join(libRoot, 'fetcher.ts'));
    const useDaily = read(join(srcRoot, 'hooks', 'useDaily.ts'));
    const useStatic = read(join(srcRoot, 'hooks', 'useStatic.ts'));

    [
      'git' + ' diff',
      'origin' + '/main',
      'HEAD' + '^',
      'exec' + 'Sync',
      'spawn' + 'Sync',
      'child' + '_process',
    ].forEach((forbidden) => {
      expect(testSource).not.toContain(forbidden);
    });

    expect(metadata).toContain('UNKNOWN_SUPABASE_USAGE_ROUTE_METADATA');
    expect(metadata).toContain('SUPABASE_USAGE_ROUTE_METADATA');
    expect(metadata).toContain('unknown/unclassified');
    expect(legacyAnalytics).toContain('refreshInterval: 60000');
    expect(fetcher).toContain('MAX_RETRIES = 3');
    expect(useDaily).toContain('remoteSWRKey');
    expect(useStatic).toContain('remoteSWRKey');
  });

  it('keeps protected runtime files from importing the metadata module', () => {
    for (const path of protectedRuntimePaths) {
      expect(read(path), path).not.toContain(metadataModuleStem);
    }
  });
});
