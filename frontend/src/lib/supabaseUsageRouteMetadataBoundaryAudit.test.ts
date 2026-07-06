import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const srcRoot = join(root, 'src');
const docsRoot = join(root, 'docs');
const libRoot = join(srcRoot, 'lib');

const metadataPath = join(libRoot, 'supabaseUsageRouteMetadata.ts');
const metadataTestPath = join(libRoot, 'supabaseUsageRouteMetadata.test.ts');
const boundaryAuditPath = join(libRoot, 'supabaseUsageRouteMetadataBoundaryAudit.test.ts');
const k298DocPath = join(docsRoot, 'K-298-supabase-usage-guardrail-minimal-implementation-plan.md');
const k297DocPath = join(docsRoot, 'K-297-supabase-usage-guardrail-implementation-plan.md');
const k296DocPath = join(docsRoot, 'K-296-supabase-usage-quota-traffic-risk-source-facts-audit.md');

const runtimePaths = [
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

describe('supabase usage route metadata boundary audit', () => {
  it('keeps K-299 files and prior planning docs present', () => {
    [
      metadataPath,
      metadataTestPath,
      boundaryAuditPath,
      k298DocPath,
      k297DocPath,
      k296DocPath,
    ].forEach((path) => {
      expect(existsSync(path), path).toBe(true);
    });
  });

  it('keeps the metadata module pure and free of runtime imports or side effects', () => {
    const source = read(metadataPath);

    [
      /from ['"].*supabase['"]/,
      /from ['"].*fetcher['"]/,
      /from ['"].*remoteBoundary['"]/,
      /from ['"].*App['"]/,
      /from ['"].*AppContent['"]/,
      /from ['"][^'"]*components\/notes\/[^'"]*['"]/,
      /from ['"].*notePersistence['"]/,
      /from ['"].*useNotesStore['"]/,
      /from ['"].*vault/i,
      /from ['"].*googleDrive/i,
      /from ['"].*attachment/i,
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
    for (const path of runtimePaths) {
      expect(existsSync(path), path).toBe(true);
      expect(read(path), toRepoPath(path)).not.toContain('supabaseUsageRouteMetadata');
    }
  });

  it('keeps metadata module imports limited to tests and documentation references', () => {
    const references = collectSourceFiles(srcRoot)
      .filter((path) => read(path).includes('supabaseUsageRouteMetadata'))
      .map(toRepoPath)
      .sort();

    expect(references).toEqual([
      'src/lib/supabaseUsageGuardrailMinimalImplementationPlan.test.ts',
      'src/lib/supabaseUsageRouteMetadata.test.ts',
      'src/lib/supabaseUsageRouteMetadataBoundaryAudit.test.ts',
    ]);
  });

  it('keeps the K-299 boundary aligned with K-298 no-runtime-wiring guidance', () => {
    const k298 = read(k298DocPath);
    const metadata = read(metadataPath);

    [
      'K-299 remains no-side-effect and does not change request behavior',
      'the metadata module imports no Supabase client',
      'the metadata module imports no authFetch/fetcher/SWR runtime',
      'unknown routes are treated as `unknown/unclassified`',
    ].forEach((expected) => {
      expect(k298).toContain(expected);
    });

    expect(metadata).toContain('UNKNOWN_SUPABASE_USAGE_ROUTE_METADATA');
    expect(metadata).toContain('SUPABASE_USAGE_ROUTE_METADATA');
    expect(metadata).toContain('getSupabaseUsageRouteMetadata');
    expect(metadata).toContain('isKnownSupabaseUsageRoute');
  });
});
