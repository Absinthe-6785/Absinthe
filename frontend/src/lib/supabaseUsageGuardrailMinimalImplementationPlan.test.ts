import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const srcRoot = join(root, 'src');
const docsRoot = join(root, 'docs');

const planDocPath = join(docsRoot, 'K-298-supabase-usage-guardrail-minimal-implementation-plan.md');
const k297DocPath = join(docsRoot, 'K-297-supabase-usage-guardrail-implementation-plan.md');
const k296DocPath = join(docsRoot, 'K-296-supabase-usage-quota-traffic-risk-source-facts-audit.md');
const libRoot = join(srcRoot, 'lib');
const proposedMetadataPath = join(libRoot, 'supabaseUsageRouteMetadata.ts');

const supabasePath = join(libRoot, 'supabase.ts');
const fetcherPath = join(libRoot, 'fetcher.ts');
const remoteBoundaryPath = join(libRoot, 'remoteBoundary.ts');
const configPath = join(libRoot, 'config.ts');
const googleDriveBlobAdapterPath = join(libRoot, 'googleDriveBlobAdapter.ts');
const attachmentSyncQueuePath = join(libRoot, 'attachmentSyncQueue.ts');
const useDailyPath = join(srcRoot, 'hooks', 'useDaily.ts');
const useStaticPath = join(srcRoot, 'hooks', 'useStatic.ts');
const legacyAnalyticsPath = join(srcRoot, 'components', 'views', 'LegacyAnalyticsView.tsx');

function read(path: string): string {
  return readFileSync(path, 'utf8');
}

describe('K-298 Supabase usage guardrail minimal implementation plan', () => {
  it('keeps K-298 as a docs and audit-test only planning milestone', () => {
    expect(existsSync(planDocPath)).toBe(true);
    const doc = read(planDocPath);

    [
      'K-298 is docs/plan plus audit test only',
      'K-298 does not implement runtime traffic control',
      'K-298 does not implement route metadata',
      'no authFetch behavior change',
      'no fetcher/SWR behavior change',
      'no analytics refreshInterval change',
      'no retry/backoff behavior change',
      'no circuit breaker implementation',
      'no quota fallback implementation',
      'no monitoring/logging implementation',
      'no Supabase client/config/env change',
      'no database/RLS/migration change',
    ].forEach(expected => {
      expect(doc).toContain(expected);
    });
  });

  it('recaps K-296 and K-297 source facts and missing guardrail controls', () => {
    const doc = read(planDocPath);

    [
      'No direct frontend runtime `supabase.from(...)` calls',
      'No direct frontend runtime `supabase.storage`, `storage.from(...)`, or `supabase.channel(...)` calls',
      'Product data traffic is primarily backend-route based through `authFetch(...)`',
      '`authFetch(...)` in `frontend/src/lib/supabase.ts` performs a Supabase session lookup',
      '`frontend/src/hooks/useDaily.ts` uses `remoteSWRKey(...)` and `revalidateOnFocus: false`',
      '`frontend/src/hooks/useStatic.ts` uses `remoteSWRKey(...)` and `revalidateOnFocus: false`',
      '`frontend/src/lib/fetcher.ts` has bounded retries',
      '`frontend/src/components/views/LegacyAnalyticsView.tsx` has a source-present `refreshInterval: 60000`',
      'Google Drive attachment traffic is provider-side traffic and not Supabase Storage traffic',
      'No explicit request budget policy',
      'No route classification map for backend-route fanout',
      'No global circuit breaker',
      'No quota-risk graceful degradation policy',
      'K-297 recommended starting with a narrow planning or metadata boundary',
    ].forEach(expected => {
      expect(doc).toContain(expected);
    });
  });

  it('defines the required K-298 planning sections', () => {
    const doc = read(planDocPath);

    [
      '## K-296 / K-297 Recap',
      '## Why Backend Route Classification First',
      '## Proposed Classification Owner',
      '## Route Classification Taxonomy',
      '## Request Budget Metadata Shape',
      '## K-299 Minimal Implementation Boundary',
      '## K-299 Coverage Expectations',
      '## How Metadata Supports Future Guardrails',
      '## LegacyAnalytics Polling Handling',
      '## Circuit Breaker / Graceful Degradation Staging',
      '## Monitoring / Runbook Staging',
      '## K-300 Outlook',
      '## Non-goals',
      '## Closure Statement',
    ].forEach(expected => {
      expect(doc).toContain(expected);
    });
  });

  it('chooses a pure K-299 route metadata owner without granting K-298 runtime scope', () => {
    const doc = read(planDocPath);

    expect(existsSync(libRoot)).toBe(true);
    expect(proposedMetadataPath).toContain('supabaseUsageRouteMetadata.ts');
    expect(doc).toContain('frontend/src/lib/supabaseUsageRouteMetadata.ts');
    expect(doc).toContain('K-298 does not implement route metadata');
    expect(doc).toContain('The parent directory `frontend/src/lib` already exists.');
    expect(doc).toContain('no network calls');
    expect(doc).toContain('no request execution');
    expect(doc).toContain('no env reads');
    expect(doc).toContain('no Supabase import');
    expect(doc).toContain('no authFetch import');
    expect(doc).toContain('no fetcher import');
    expect(doc).toContain('no SWR import');
    expect(doc).toContain('no runtime traffic-control behavior');
  });

  it('locks the route taxonomy and request budget metadata contract proposed for K-299', () => {
    const doc = read(planDocPath);

    [
      'auth-session',
      'app-bootstrap',
      'analytics-polling',
      'user-action-read',
      'user-action-write',
      'sync-read',
      'sync-write',
      'provider-transfer',
      'attachment-transfer',
      'background-refresh',
      'unknown/unclassified',
      'SupabaseUsageRouteRisk',
      'SupabaseUsageTrigger',
      'SupabaseUsageBudget',
      'routeKey: string',
      'category:',
      'trigger: SupabaseUsageTrigger',
      'risk: SupabaseUsageRouteRisk',
      'automatic: boolean',
      'expectedFrequency: string',
      'retrySensitive: boolean',
      'degradeCandidate: boolean',
      'notes: string',
    ].forEach(expected => {
      expect(doc).toContain(expected);
    });
  });

  it('defines the K-299 implementation boundary without authorizing runtime edits', () => {
    const doc = read(planDocPath);

    [
      'K-299 Supabase Usage Route Metadata Implementation',
      'frontend/src/lib/supabaseUsageRouteMetadata.test.ts',
      'frontend/src/lib/supabaseUsageRouteMetadataBoundary.test.ts',
      'frontend/docs/K-299-supabase-usage-route-metadata-implementation.md',
      'the metadata module is importable without network calls',
      'the metadata module imports no Supabase client',
      'the metadata module imports no authFetch/fetcher/SWR runtime',
      '`analytics-polling` entries are marked `automatic: true`, `retrySensitive: true`, and `degradeCandidate: true`',
      'unknown routes are treated as `unknown/unclassified`',
      'K-299 remains no-side-effect and does not change request behavior',
      'K-299 must not change:',
      'frontend/src/lib/supabase.ts',
      'frontend/src/lib/fetcher.ts',
      'frontend/src/components/views/LegacyAnalyticsView.tsx',
    ].forEach(expected => {
      expect(doc).toContain(expected);
    });
  });

  it('stages LegacyAnalytics, circuit breaker, graceful degradation, monitoring, and K-300 without implementing them', () => {
    const doc = read(planDocPath);

    [
      'K-298 does not change `LegacyAnalyticsView.tsx` and does not change `refreshInterval: 60000`.',
      'K-299 should classify LegacyAnalytics polling as `analytics-polling`, `automatic: true`, `retrySensitive: true`, and `degradeCandidate: true`.',
      'K-300 or later: add a runbook or monitoring checklist',
      'Later: classify response outcomes such as `401`, `429`, network timeout, and `5xx` without changing behavior.',
      'Later: analytics pause/degrade policy',
      'Later: fetcher-level quota classification or circuit breaker',
      'Check Supabase API request count.',
      'Check Supabase auth usage.',
      'Supabase usage guardrail runbook and release checklist.',
    ].forEach(expected => {
      expect(doc).toContain(expected);
    });
  });

  it('keeps referenced docs and source evidence files present without git refs or shell commands', () => {
    [
      k297DocPath,
      k296DocPath,
      supabasePath,
      fetcherPath,
      remoteBoundaryPath,
      configPath,
      googleDriveBlobAdapterPath,
      attachmentSyncQueuePath,
      useDailyPath,
      useStaticPath,
      legacyAnalyticsPath,
    ].forEach(path => {
      expect(existsSync(path), path).toBe(true);
    });
  });

  it('locks current source facts that the K-298 plan depends on', () => {
    const supabase = read(supabasePath);
    const fetcher = read(fetcherPath);
    const remoteBoundary = read(remoteBoundaryPath);
    const config = read(configPath);
    const daily = read(useDailyPath);
    const statics = read(useStaticPath);
    const legacyAnalytics = read(legacyAnalyticsPath);
    const googleDrive = read(googleDriveBlobAdapterPath);
    const queue = read(attachmentSyncQueuePath);

    expect(supabase).toContain('createClient');
    expect(supabase).toContain('import.meta.env.VITE_SUPABASE_URL');
    expect(supabase).toContain('import.meta.env.VITE_SUPABASE_ANON_KEY');
    expect(supabase).toContain('supabase.auth.getSession()');
    expect(supabase.toLowerCase()).not.toContain('service_role');

    expect(fetcher).toContain('MAX_RETRIES = 3');
    expect(fetcher).toContain('RETRY_STATUSES');
    expect(fetcher).toContain('BASE_DELAY_MS = 600');
    expect(fetcher).toContain('supabase.auth.refreshSession()');

    expect(remoteBoundary).toContain('remoteSWRKey');
    expect(config).toContain('VITE_API_URL');
    expect(daily).toContain('remoteSWRKey');
    expect(daily).toContain('revalidateOnFocus: false');
    expect(statics).toContain('remoteSWRKey');
    expect(statics).toContain('revalidateOnFocus: false');
    expect(legacyAnalytics).toContain('refreshInterval: 60000');
    expect(googleDrive).toContain('supportsQuotaInfo: false');
    expect(queue).toContain('runAttachmentUploadQueue');
  });
});
