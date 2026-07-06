import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const srcRoot = join(root, 'src');
const docsRoot = join(root, 'docs');
const libRoot = join(srcRoot, 'lib');
const metadataModuleStem = 'supabaseUsage' + 'RouteMetadata';

const metadataPath = join(libRoot, `${metadataModuleStem}.ts`);
const metadataTestPath = join(libRoot, `${metadataModuleStem}.test.ts`);
const metadataBoundaryAuditPath = join(libRoot, `${metadataModuleStem}BoundaryAudit.test.ts`);
const closureAuditPath = join(libRoot, `${metadataModuleStem}ClosureAudit.test.ts`);

const k300DocPath = join(docsRoot, 'K-300-supabase-usage-route-metadata-closure-audit.md');
const k299DocPath = join(docsRoot, 'K-299-supabase-usage-guardrail-metadata-boundary-implementation.md');
const k298DocPath = join(docsRoot, 'K-298-supabase-usage-guardrail-minimal-implementation-plan.md');
const k297DocPath = join(docsRoot, 'K-297-supabase-usage-guardrail-implementation-plan.md');
const k296DocPath = join(docsRoot, 'K-296-supabase-usage-quota-traffic-risk-source-facts-audit.md');

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

function collectSourceFiles(path: string): string[] {
  if (!existsSync(path)) return [];

  return readdirSync(path).flatMap((entry) => {
    const child = join(path, entry);
    const stats = statSync(child);

    if (stats.isDirectory()) return collectSourceFiles(child);

    return /\.(ts|tsx)$/.test(entry) ? [child] : [];
  });
}

function toRepoPath(path: string): string {
  return relative(root, path).replace(/\\/g, '/');
}

describe('supabase usage route metadata closure audit', () => {
  it('documents K-300 as closure-only and keeps runtime guardrails out of scope', () => {
    expect(existsSync(k300DocPath)).toBe(true);

    const doc = read(k300DocPath);

    [
      'K-300 is docs/source closure audit plus audit test only',
      'K-300 does not modify metadata',
      'K-300 does not wire metadata into runtime',
      'K-300 does not implement request guardrails',
      'no metadata module modification',
      'no authFetch wiring',
      'no request budget enforcement',
      'no circuit breaker implementation',
      'no analytics polling change',
      'no monitoring/logging implementation',
      'no route runtime classification wiring',
      'no Supabase client/config/env change',
    ].forEach((expected) => {
      expect(doc).toContain(expected);
    });
  });

  it('keeps the K-300 closure doc complete across required audit sections', () => {
    const doc = read(k300DocPath);

    [
      '## Purpose',
      '## Current Metadata Posture Summary',
      '## K-299 Implementation Source Audit',
      '## Runtime Import Boundary Audit',
      '## Request Behavior Preservation Audit',
      '## Supabase / Env / Credential Hygiene Audit',
      '## Unknown / Unclassified Fallback Audit',
      '## Read-only / Immutability Low Note',
      '## Future Metadata Granularity Low Note',
      '## Local-first / Product Boundary Audit',
      '## Test And CI Evidence Audit',
      '## Remaining Gaps',
      '## Recommended K-301 Path',
      '## Non-goals',
      '## Closure Statement',
    ].forEach((heading) => {
      expect(doc).toContain(heading);
    });
  });

  it('keeps K-299 metadata sources and K-296 through K-299 planning docs present', () => {
    [
      metadataPath,
      metadataTestPath,
      metadataBoundaryAuditPath,
      closureAuditPath,
      k300DocPath,
      k299DocPath,
      k298DocPath,
      k297DocPath,
      k296DocPath,
      ...protectedRuntimePaths,
    ].forEach((path) => {
      expect(existsSync(path), path).toBe(true);
    });
  });

  it('keeps the metadata module pure, static, and free of runtime side effects', () => {
    const source = read(metadataPath);

    [
      'export type SupabaseUsageRouteRisk',
      'export type SupabaseUsageTrigger',
      'export type SupabaseUsageRouteCategory',
      'export type SupabaseUsageRouteMetadata',
      'SUPABASE_USAGE_ROUTE_CATEGORIES',
      'SUPABASE_USAGE_TRIGGERS',
      'SUPABASE_USAGE_ROUTE_RISKS',
      'UNKNOWN_SUPABASE_USAGE_ROUTE_METADATA',
      'SUPABASE_USAGE_ROUTE_METADATA',
      'getSupabaseUsageRouteMetadata',
      'isKnownSupabaseUsageRoute',
      "routeKey: 'unknown/unclassified'",
      "category: 'unknown'",
      "trigger: 'unknown'",
      "risk: 'unknown'",
      'automatic: false',
      'retrySensitive: true',
      'degradeCandidate: true',
    ].forEach((expected) => {
      expect(source).toContain(expected);
    });

    [
      /from ['"].*supabase['"]/,
      /from ['"].*fetcher['"]/,
      /from ['"].*remoteBoundary['"]/,
      /from ['"]swr['"]/,
      /import\.meta\.env/,
      /process\.env/,
      /localStorage/,
      /sessionStorage/,
      /\bwindow\b/,
      /\bdocument\b/,
      /setInterval/,
      /setTimeout/,
      /\bfetch\s*\(/,
      /XMLHttpRequest/,
      /console\./,
      /service[-_ ]?role/i,
      /storageState/i,
      /credential/i,
    ].forEach((pattern) => {
      expect(source, String(pattern)).not.toMatch(pattern);
    });
  });

  it('keeps protected runtime request files from importing the metadata module', () => {
    for (const path of protectedRuntimePaths) {
      expect(read(path), toRepoPath(path)).not.toContain(metadataModuleStem);
    }
  });

  it('keeps metadata module references limited to metadata tests and audit tests', () => {
    const references = collectSourceFiles(srcRoot)
      .filter((path) => read(path).includes(metadataModuleStem))
      .map(toRepoPath)
      .sort();

    expect(references).toEqual([
      'src/lib/supabaseUsageGuardrailMinimalImplementationPlan.test.ts',
      `src/lib/${metadataModuleStem}.test.ts`,
      `src/lib/${metadataModuleStem}BoundaryAudit.test.ts`,
    ]);
  });

  it('documents request-neutral and credential-neutral closure facts', () => {
    const doc = read(k300DocPath);

    [
      'request behavior is unchanged',
      'No monitoring/logging implementation is added.',
      'no service-role key',
      'no credential handling',
      'no storage state helper',
      'no production bypass',
      'no hardcoded account',
      'no auth/session behavior change',
    ].forEach((expected) => {
      expect(doc).toContain(expected);
    });
  });

  it('keeps unknown fallback conservative and documents read-only hardening options', () => {
    const metadata = read(metadataPath);
    const doc = read(k300DocPath);

    expect(metadata).toContain('metadataByRouteKey.get(routeKey) ??');
    expect(metadata).toContain('...UNKNOWN_SUPABASE_USAGE_ROUTE_METADATA');

    [
      'Unknown route classification remains conservative.',
      'Callers should treat returned metadata as read-only.',
      'Object.freeze metadata objects.',
      'readonly type strengthening.',
      'return copy instead of shared object.',
    ].forEach((expected) => {
      expect(doc).toContain(expected);
    });
  });

  it('records future granularity gaps and the recommended K-301 path', () => {
    const doc = read(k300DocPath);

    [
      'route pattern coverage expansion.',
      'owner fields.',
      'authRequirement fields.',
      'source surface fields.',
      'enforcement eligibility fields.',
      'K-301 Supabase Usage Guardrail Runbook / Monitoring Plan',
      'LegacyAnalytics polling decision plan.',
      'Metadata immutability/granularity patch plan.',
    ].forEach((expected) => {
      expect(doc).toContain(expected);
    });
  });
});
