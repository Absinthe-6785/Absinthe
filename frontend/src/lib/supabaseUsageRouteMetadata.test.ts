import { describe, expect, it } from 'vitest';
import {
  getSupabaseUsageRouteMetadata,
  isKnownSupabaseUsageRoute,
  SUPABASE_USAGE_ROUTE_CATEGORIES,
  SUPABASE_USAGE_ROUTE_METADATA,
  SUPABASE_USAGE_ROUTE_RISKS,
  SUPABASE_USAGE_TRIGGERS,
  UNKNOWN_SUPABASE_USAGE_ROUTE_METADATA,
  type SupabaseUsageRouteMetadata,
} from './supabaseUsageRouteMetadata';

const secretPatterns = [
  /service[-_ ]?role/i,
  /storageState/i,
  /password/i,
  /secret/i,
  /credential/i,
  /access[_-]?token/i,
  /refresh[_-]?token/i,
  /api[_-]?key/i,
  /bearer\s+/i,
];

function metadataText(entry: SupabaseUsageRouteMetadata): string {
  return JSON.stringify(entry);
}

describe('supabase usage route metadata', () => {
  it('exports a non-empty route metadata list with required fields', () => {
    expect(SUPABASE_USAGE_ROUTE_METADATA.length).toBeGreaterThan(0);

    for (const entry of SUPABASE_USAGE_ROUTE_METADATA) {
      expect(entry.routeKey).toEqual(expect.any(String));
      expect(entry.routeKey.trim()).toBe(entry.routeKey);
      expect(entry.category).toEqual(expect.any(String));
      expect(entry.trigger).toEqual(expect.any(String));
      expect(entry.risk).toEqual(expect.any(String));
      expect(entry.expectedFrequency).toEqual(expect.any(String));
      expect(entry.notes).toEqual(expect.any(String));
      expect(entry.expectedFrequency.length).toBeGreaterThan(0);
      expect(entry.notes.length).toBeGreaterThan(0);
    }
  });

  it('keeps route keys unique', () => {
    const routeKeys = SUPABASE_USAGE_ROUTE_METADATA.map((entry) => entry.routeKey);
    expect(new Set(routeKeys).size).toBe(routeKeys.length);
  });

  it('uses only allowed categories, triggers, and risk values', () => {
    const categories = new Set(SUPABASE_USAGE_ROUTE_CATEGORIES);
    const triggers = new Set(SUPABASE_USAGE_TRIGGERS);
    const risks = new Set(SUPABASE_USAGE_ROUTE_RISKS);

    for (const entry of SUPABASE_USAGE_ROUTE_METADATA) {
      expect(categories.has(entry.category), entry.routeKey).toBe(true);
      expect(triggers.has(entry.trigger), entry.routeKey).toBe(true);
      expect(risks.has(entry.risk), entry.routeKey).toBe(true);
    }
  });

  it('covers the source-grounded route categories from K-298', () => {
    const categories = new Set(SUPABASE_USAGE_ROUTE_METADATA.map((entry) => entry.category));

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
    ].forEach((category) => {
      expect(categories.has(category), category).toBe(true);
    });
  });

  it('returns exact known metadata and known-route status', () => {
    const metadata = getSupabaseUsageRouteMetadata('legacy.analytics.workout-range-polling');

    expect(isKnownSupabaseUsageRoute('legacy.analytics.workout-range-polling')).toBe(true);
    expect(metadata).toBe(SUPABASE_USAGE_ROUTE_METADATA.find((entry) => entry.routeKey === 'legacy.analytics.workout-range-polling'));
    expect(metadata.category).toBe('analytics-polling');
    expect(metadata.trigger).toBe('polling');
    expect(metadata.risk).toBe('high');
    expect(metadata.automatic).toBe(true);
    expect(metadata.retrySensitive).toBe(true);
    expect(metadata.degradeCandidate).toBe(true);
    expect(metadata.routePattern).toContain('/api/workouts/range');
    expect(metadata.notes).toContain('refreshInterval: 60000');
  });

  it('returns conservative unknown metadata for unclassified routes', () => {
    const metadata = getSupabaseUsageRouteMetadata('/api/new-route');

    expect(isKnownSupabaseUsageRoute('/api/new-route')).toBe(false);
    expect(metadata).not.toBe(UNKNOWN_SUPABASE_USAGE_ROUTE_METADATA);
    expect(metadata.routeKey).toBe('/api/new-route');
    expect(metadata.category).toBe('unknown');
    expect(metadata.trigger).toBe('unknown');
    expect(metadata.risk).toBe('unknown');
    expect(metadata.automatic).toBe(false);
    expect(metadata.retrySensitive).toBe(true);
    expect(metadata.degradeCandidate).toBe(true);
    expect(metadata.notes).toContain('Unclassified route');
  });

  it('keeps retry-sensitive and degrade-candidate fields boolean', () => {
    for (const entry of SUPABASE_USAGE_ROUTE_METADATA) {
      expect(typeof entry.automatic, entry.routeKey).toBe('boolean');
      expect(typeof entry.retrySensitive, entry.routeKey).toBe('boolean');
      expect(typeof entry.degradeCandidate, entry.routeKey).toBe('boolean');
    }
  });

  it('keeps optional authRequired and routePattern fields valid when present', () => {
    for (const entry of SUPABASE_USAGE_ROUTE_METADATA) {
      if ('authRequired' in entry) {
        expect(typeof entry.authRequired, entry.routeKey).toBe('boolean');
      }
      if ('routePattern' in entry) {
        expect(entry.routePattern, entry.routeKey).toEqual(expect.any(String));
        expect(entry.routePattern?.length, entry.routeKey).toBeGreaterThan(0);
      }
    }
  });

  it('keeps metadata free of obvious secrets and credential artifacts', () => {
    for (const entry of [...SUPABASE_USAGE_ROUTE_METADATA, UNKNOWN_SUPABASE_USAGE_ROUTE_METADATA]) {
      const text = metadataText(entry);
      for (const pattern of secretPatterns) {
        expect(text, `${entry.routeKey} matched ${pattern}`).not.toMatch(pattern);
      }
    }
  });

  it('separates provider and attachment transfers from Supabase Storage traffic', () => {
    const provider = getSupabaseUsageRouteMetadata('provider.google-drive.transfer');
    const attachment = getSupabaseUsageRouteMetadata('attachments.remote.transfer');

    expect(provider.category).toBe('provider-transfer');
    expect(provider.trigger).toBe('provider-transfer');
    expect(provider.authRequired).toBe(false);
    expect(provider.notes).toContain('not Supabase Storage traffic');

    expect(attachment.category).toBe('attachment-transfer');
    expect(attachment.trigger).toBe('provider-transfer');
    expect(attachment.automatic).toBe(false);
    expect(attachment.notes).toContain('provider abstractions');
  });
});
