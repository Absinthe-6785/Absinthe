import { describe, expect, it } from 'vitest';
import {
  auditK125fHealthRecoveryRc,
  K125F_MOBILE_WORKOUT_ORDER,
} from './k125fHealthAudit';
import { auditHealthAnalyticsRc } from './k121HealthAnalyticsAudit';
import { auditK125cHealthPerformanceRc } from './k125cHealthPerformanceAudit';
import { auditHealthPerformanceHooks } from './k107HealthPerformanceAudit';
import { readHealthSectionPrefs } from './features/health/healthSectionPrefs';

describe('k125f health mobile recovery audits', () => {
  it('K-125F — analytics simplification, mobile flow, navigation', () => {
    expect(auditK125fHealthRecoveryRc()).toBe(true);
    expect(K125F_MOBILE_WORKOUT_ORDER).toEqual(['workout', 'inbody', 'analytics', 'supporting']);
  });

  it('section prefs summary visible, subsections collapsed (K-125F)', () => {
    const prefs = readHealthSectionPrefs();
    expect(prefs.analyticsCollapsed).toBe(false);
    expect(prefs.chartsCollapsed).toBe(true);
    expect(prefs.prSectionCollapsed).toBe(true);
    expect(prefs.recentSessionsCollapsed).toBe(true);
    expect(prefs.exerciseHistoryCollapsed).toBe(true);
  });

  it('K-121 — health analytics simplification (regression)', () => {
    expect(auditHealthAnalyticsRc()).toBe(true);
  });

  it('K-125C — progressive rendering (regression)', () => {
    expect(auditK125cHealthPerformanceRc()).toBe(true);
  });

  it('K-107 — performance hooks (regression)', () => {
    expect(auditHealthPerformanceHooks().length).toBeGreaterThan(0);
  });
});
