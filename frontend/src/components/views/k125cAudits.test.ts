import { describe, expect, it } from 'vitest';
import {
  auditK125cHealthPerformanceRc,
  K125C_DEFERRED_SECTIONS,
  K125C_HEALTH_ORDER,
  K125C_IMMEDIATE_SECTIONS,
} from './k125cHealthPerformanceAudit';
import { auditHealthAnalyticsRc } from './k121HealthAnalyticsAudit';
import { auditSkeletonRc } from './k121SkeletonAudit';
import { auditMemoryRc } from './k120MemoryAudit';
import { auditHealthLazySections } from './k107HealthLazyAudit';
import { readHealthSectionPrefs } from './features/health/healthSectionPrefs';

describe('k125c health performance audits', () => {
  it('K-125C — progressive rendering, layout order, collapsed defaults', () => {
    expect(auditK125cHealthPerformanceRc()).toBe(true);
    expect(K125C_IMMEDIATE_SECTIONS).toEqual(['library', 'routine', 'calendar']);
    expect(K125C_DEFERRED_SECTIONS).toEqual(['analytics', 'supporting']);
    expect(K125C_HEALTH_ORDER).toEqual(['workout', 'calendar', 'analytics', 'supporting']);
  });

  it('section prefs default collapsed analytics (K-125C)', () => {
    const prefs = readHealthSectionPrefs();
    expect(prefs.analyticsCollapsed).toBe(true);
    expect(prefs.prSectionCollapsed).toBe(true);
    expect(prefs.recentSessionsCollapsed).toBe(true);
    expect(prefs.exerciseHistoryCollapsed).toBe(true);
  });

  it('K-121 — health analytics simplification (regression)', () => {
    expect(auditHealthAnalyticsRc()).toBe(true);
  });

  it('K-121 — skeleton heights (regression)', () => {
    expect(auditSkeletonRc()).toBe(true);
  });

  it('K-120 — memory observation (regression)', () => {
    expect(auditMemoryRc()).toBe(true);
  });

  it('K-107 — lazy sections still registered (regression)', () => {
    expect(auditHealthLazySections().length).toBeGreaterThan(0);
  });
});
