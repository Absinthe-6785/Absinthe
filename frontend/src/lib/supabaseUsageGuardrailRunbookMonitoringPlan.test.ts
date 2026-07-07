import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const docsRoot = join(root, 'docs');
const srcRoot = join(root, 'src');
const libRoot = join(srcRoot, 'lib');
const metadataModuleStem = 'supabaseUsage' + 'RouteMetadata';

const k301DocPath = join(docsRoot, 'K-301-supabase-usage-guardrail-runbook-monitoring-plan.md');
const k300DocPath = join(docsRoot, 'K-300-supabase-usage-route-metadata-closure-audit.md');
const k298DocPath = join(docsRoot, 'K-298-supabase-usage-guardrail-minimal-implementation-plan.md');
const k297DocPath = join(docsRoot, 'K-297-supabase-usage-guardrail-implementation-plan.md');
const k296DocPath = join(docsRoot, 'K-296-supabase-usage-quota-traffic-risk-source-facts-audit.md');
const metadataPath = join(libRoot, `${metadataModuleStem}.ts`);
const metadataTestPath = join(libRoot, `${metadataModuleStem}.test.ts`);
const metadataBoundaryAuditPath = join(libRoot, `${metadataModuleStem}BoundaryAudit.test.ts`);

const referencedSourcePaths = [
  join(srcRoot, 'App.tsx'),
  join(srcRoot, 'components', 'AppContent.tsx'),
  join(libRoot, 'supabase.ts'),
  join(libRoot, 'fetcher.ts'),
  join(libRoot, 'remoteBoundary.ts'),
  join(srcRoot, 'hooks', 'useDaily.ts'),
  join(srcRoot, 'hooks', 'useStatic.ts'),
  join(srcRoot, 'components', 'views', 'LegacyAnalyticsView.tsx'),
  join(libRoot, 'googleDriveBlobAdapter.ts'),
];

function read(path: string): string {
  return readFileSync(path, 'utf8');
}

describe('supabase usage guardrail runbook monitoring plan', () => {
  it('adds the K-301 runbook plan and keeps prior source facts present', () => {
    [
      k301DocPath,
      k300DocPath,
      k298DocPath,
      k297DocPath,
      k296DocPath,
      metadataPath,
      metadataTestPath,
      metadataBoundaryAuditPath,
      ...referencedSourcePaths,
    ].forEach((path) => {
      expect(existsSync(path), path).toBe(true);
    });
  });

  it('states K-301 is plan-only and excludes runtime implementation work', () => {
    const doc = read(k301DocPath);

    [
      'K-301 is docs/plan plus audit test only.',
      'K-301 does not implement runtime enforcement.',
      'K-301 does not add monitoring/logging code.',
      'K-301 does not modify metadata.',
      'K-301 does not wire metadata into runtime.',
      'no authFetch wiring.',
      'no request blocking/throttling.',
      'no circuit breaker implementation.',
      'no analytics polling change.',
      'no metadata module modification.',
      'no Supabase client/config/env change.',
      'no monitoring/logging code.',
    ].forEach((expected) => {
      expect(doc).toContain(expected);
    });
  });

  it('summarizes the current posture from K-296 through K-300', () => {
    const doc = read(k301DocPath);

    [
      'K-296 established the source facts',
      'K-297 planned guardrails',
      'K-298 selected the minimal implementation path',
      'K-299 implemented pure Supabase usage route metadata',
      'K-300 closed that metadata boundary',
      'direct frontend Supabase table/storage/realtime usage remains absent',
      'backend-route based access remains the primary product data posture',
      'metadata is planning vocabulary only',
      'runtime request behavior remains unchanged',
    ].forEach((expected) => {
      expect(doc).toContain(expected);
    });
  });

  it('defines monitoring objectives and dashboard checklist categories', () => {
    const doc = read(k301DocPath);

    [
      'detect quota/traffic spikes early.',
      'distinguish expected auth/session traffic from product/backend-route fanout.',
      'identify analytics polling impact.',
      'track retry/error bursts.',
      'identify storage, egress, provider, and Supabase Storage confusion.',
      'API request count.',
      'Auth request count, sign-in activity, session activity, and token refresh activity.',
      'Database usage, row reads, row writes, and query volume if available.',
      'Realtime usage, expected to remain absent unless source changes.',
      'Storage usage, expected to remain absent for Supabase Storage unless source changes.',
      'Egress and bandwidth.',
      'Rate-limit or quota warnings.',
      'Project quota and billing usage.',
    ].forEach((expected) => {
      expect(doc).toContain(expected);
    });
  });

  it('defines backend fanout, request budget, and analytics polling monitoring plans', () => {
    const doc = read(k301DocPath);

    [
      'The frontend sees backend-route usage, not direct Supabase table/storage calls.',
      'The K-299 metadata can classify route risk, but it does not measure backend fanout.',
      'No payload logging and no user-content logging are allowed.',
      'Runtime enforcement exists: currently no.',
      '| App mount |',
      '| Unauthenticated idle |',
      '| Authenticated idle |',
      '| Analytics polling |',
      '| User-triggered read/write |',
      '| Background refresh |',
      '| Provider/attachment transfer |',
      '| Unknown/unclassified |',
      'Known source fact: `LegacyAnalyticsView.tsx` has `refreshInterval: 60000`',
      'K-301 does not change it.',
      'Do not patch analytics polling in K-301.',
    ].forEach((expected) => {
      expect(doc).toContain(expected);
    });
  });

  it('defines incident response, degradation policy, thresholds, and evidence capture', () => {
    const doc = read(k301DocPath);

    [
      '## Error / Quota / Spike Response Runbook',
      'Confirm the symptom',
      'Check Supabase dashboard usage categories.',
      'Map the scenario to app surface and route metadata category.',
      'avoid adding production bypass.',
      'create a targeted K-ticket',
      'local-first views should remain usable where possible.',
      'auth/session correctness must not be bypassed.',
      'fake success states are not allowed.',
      '| Warning |',
      '| Elevated |',
      '| Incident |',
      '| Release blocker |',
      '- Date/time/window:',
      '- Environment:',
      '- Commit/deploy:',
      '- Observed Supabase metric category:',
      '- Secrets redaction confirmation:',
      '- User-content redaction confirmation:',
    ].forEach((expected) => {
      expect(doc).toContain(expected);
    });
  });

  it('defines release checklist, K-302 matrix, recommendation, and non-goals', () => {
    const doc = read(k301DocPath);

    [
      '## Release Checklist',
      'Logged-out app shell stays blocked from protected product surfaces.',
      'Authenticated login/callback/logout verified if credentials are available.',
      'Supabase dashboard checked before smoke test.',
      'Supabase dashboard checked after smoke test.',
      'No direct frontend Supabase table/storage/realtime usage introduced.',
      'No credentials or storageState artifacts committed.',
      '## K-302 Implementation Candidate Matrix',
      '| Supabase monitoring/runbook closure audit |',
      '| LegacyAnalytics polling decision plan |',
      '| Metadata granularity/immutability patch plan |',
      '| Direct circuit breaker implementation |',
      'Primary recommendation: K-302 Supabase Usage Guardrail Runbook Closure Audit.',
      'Not recommended:',
      'immediate circuit breaker implementation.',
      'request enforcement before runbook closure.',
      'no assets/fonts/dependencies.',
      'no generated artifacts.',
    ].forEach((expected) => {
      expect(doc).toContain(expected);
    });
  });

  it('keeps source assumptions grounded without adding git or shell dependencies', () => {
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
    expect(metadata).toContain('analytics-polling');
    expect(metadata).toContain('provider.google-drive.transfer');
    expect(legacyAnalytics).toContain('refreshInterval: 60000');
    expect(fetcher).toContain('MAX_RETRIES = 3');
    expect(useDaily).toContain('remoteSWRKey');
    expect(useDaily).toContain('revalidateOnFocus: false');
    expect(useStatic).toContain('remoteSWRKey');
    expect(useStatic).toContain('revalidateOnFocus: false');
  });
});
