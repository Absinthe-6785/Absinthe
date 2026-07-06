import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const srcRoot = join(root, 'src');
const docsRoot = join(root, 'docs');

const planDocPath = join(docsRoot, 'K-297-supabase-usage-guardrail-implementation-plan.md');
const k296DocPath = join(docsRoot, 'K-296-supabase-usage-quota-traffic-risk-source-facts-audit.md');
const k295DocPath = join(docsRoot, 'K-295-auth-restoration-test-dev-verification-line-closure-audit.md');
const supabasePath = join(srcRoot, 'lib', 'supabase.ts');
const fetcherPath = join(srcRoot, 'lib', 'fetcher.ts');
const remoteBoundaryPath = join(srcRoot, 'lib', 'remoteBoundary.ts');
const useDailyPath = join(srcRoot, 'hooks', 'useDaily.ts');
const useStaticPath = join(srcRoot, 'hooks', 'useStatic.ts');
const legacyAnalyticsPath = join(srcRoot, 'components', 'views', 'LegacyAnalyticsView.tsx');
const googleDriveBlobAdapterPath = join(srcRoot, 'lib', 'googleDriveBlobAdapter.ts');

function read(path: string): string {
  return readFileSync(path, 'utf8');
}

describe('K-297 Supabase usage guardrail implementation plan', () => {
  it('keeps K-297 as a docs and audit-test only planning milestone', () => {
    expect(existsSync(planDocPath)).toBe(true);
    const doc = read(planDocPath);

    [
      'K-297 is docs/plan plus audit test only',
      'K-297 does not implement traffic control',
      'K-297 does not change runtime request behavior',
      'no runtime traffic-control implementation',
      'no authFetch behavior change',
      'no SWR/fetcher behavior change',
      'no analytics refreshInterval change',
      'no retry/backoff behavior change',
      'no circuit breaker implementation',
      'no quota fallback implementation',
      'no monitoring implementation',
      'no Supabase client/config/env change',
      'no database/RLS/migration change',
    ].forEach(expected => {
      expect(doc).toContain(expected);
    });
  });

  it('recaps K-296 source facts and preserves Supabase boundary facts', () => {
    const doc = read(planDocPath);

    [
      'No direct runtime `supabase.from(...)` calls',
      'No direct runtime `supabase.storage` or `storage.from(...)` calls',
      'No direct runtime `supabase.channel(...)` calls',
      'Product data traffic is primarily backend-route based through `authFetch(...)`',
      '`authFetch(...)` in `frontend/src/lib/supabase.ts` performs a Supabase session lookup',
      '`frontend/src/hooks/useDaily.ts` uses `remoteSWRKey(...)` and `revalidateOnFocus: false`',
      '`frontend/src/hooks/useStatic.ts` uses `remoteSWRKey(...)` and `revalidateOnFocus: false`',
      '`frontend/src/lib/fetcher.ts` has bounded retries',
      '`frontend/src/components/views/LegacyAnalyticsView.tsx` has a source-present `refreshInterval: 60000`',
      'Google Drive attachment traffic is provider-side traffic and not Supabase Storage traffic',
      'No explicit request budget policy',
      'No global circuit breaker',
      'No quota-risk graceful degradation policy',
      'No backend route fanout visibility map',
    ].forEach(expected => {
      expect(doc).toContain(expected);
    });
  });

  it('defines all required guardrail planning sections and K-298 decision surface', () => {
    const doc = read(planDocPath);

    [
      '## Guardrail Principles',
      '## Request Budget Policy Plan',
      '## authFetch / Session Cost Strategy',
      '## Backend Route Fanout Visibility Plan',
      '## Circuit Breaker Strategy',
      '## Graceful Degradation Strategy',
      '## Legacy Analytics Polling Policy',
      '## Retry / Backoff Policy',
      '## App Mount Fanout Limit',
      '## Usage Measurement / Logging / Alerting Plan',
      '## K-298 Implementation Candidate Matrix',
      '## Recommended K-298 Path',
      '## Non-goals',
      '## Closure Statement',
    ].forEach(expected => {
      expect(doc).toContain(expected);
    });
  });

  it('plans budgets, degradation, measurement, and K-298 without approving broad rewrites', () => {
    const doc = read(planDocPath);

    [
      'App mount budget',
      'Unauthenticated budget',
      'Authenticated idle budget',
      'User-triggered action budget',
      'Analytics polling budget',
      'Retry budget',
      'Provider/attachment budget',
      'Do not log secrets, tokens, credentials, note body content, attachment bytes, or sensitive user content.',
      'Stop automatic retries for a cooldown window.',
      'Allow explicit manual retry.',
      'Preserve local-first state.',
      'K-298 Supabase Usage Guardrail Minimal Implementation Plan',
      'pure backend-route request classifier contract',
      'LegacyAnalytics polling pause/degrade plan',
      'Supabase Release Monitoring Runbook',
      'Not recommended',
      'Broad performance rewrite',
      'Remote-first sync rewrite',
      'Cloudflare/Firebase migration',
      'Production bypass',
    ].forEach(expected => {
      expect(doc).toContain(expected);
    });
  });

  it('keeps source evidence files present without relying on git refs or shell commands', () => {
    [
      k296DocPath,
      k295DocPath,
      supabasePath,
      fetcherPath,
      remoteBoundaryPath,
      useDailyPath,
      useStaticPath,
      legacyAnalyticsPath,
      googleDriveBlobAdapterPath,
    ].forEach(path => {
      expect(existsSync(path), path).toBe(true);
    });
  });

  it('locks current source facts that the K-297 plan depends on', () => {
    const supabase = read(supabasePath);
    const fetcher = read(fetcherPath);
    const remoteBoundary = read(remoteBoundaryPath);
    const daily = read(useDailyPath);
    const statics = read(useStaticPath);
    const legacyAnalytics = read(legacyAnalyticsPath);
    const googleDrive = read(googleDriveBlobAdapterPath);

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
    expect(daily).toContain('remoteSWRKey');
    expect(daily).toContain('revalidateOnFocus: false');
    expect(statics).toContain('remoteSWRKey');
    expect(statics).toContain('revalidateOnFocus: false');
    expect(legacyAnalytics).toContain('refreshInterval: 60000');
    expect(googleDrive).toContain('supportsQuotaInfo: false');
  });
});
