import { describe, expect, it } from 'vitest';
import { auditK125gRc } from './k125gNavigationAudit';
import { auditK126aRc } from './k126aHealthAnalyticsAudit';
import { auditK125eRc } from './k125eMobileMoreAudit';
import { auditK125fRc } from './k125fSidebarNavAudit';
import { auditK100SettingsSections, auditSettingsRc } from './k100SettingsAudit';
import { auditK126cRc } from './k126cNotesHeaderAudit';
import { auditK127Rc } from './k127DesignSystemAudit';
import {
  auditK128HealthSkeleton,
  auditK128NotesHeader,
  auditK128ReleaseRc,
  auditK128SearchIntegrity,
} from './k128ReleaseAudit';
import { auditK128PerformanceRc, K128_PERF_VAULT_COUNTS } from './k128PerformanceAudit';

describe('k128 release preparation audits', () => {
  it('retains K-125G navigation cohesion', () => {
    expect(auditK125gRc()).toBe(true);
  });

  it('retains K-126A health analytics', () => {
    expect(auditK126aRc()).toBe(true);
  });

  it('retains K-126B mobile navigation', () => {
    expect(auditK125eRc()).toBe(true);
    expect(auditK125fRc()).toBe(true);
    expect(auditK100SettingsSections().length).toBe(5);
    expect(auditSettingsRc()).toBe(true);
  });

  it('retains K-126C notes header polish', () => {
    expect(auditK126cRc()).toBe(true);
  });

  it('retains K-127 design system', () => {
    expect(auditK127Rc()).toBe(true);
  });

  it('consolidated search integrity', () => {
    expect(Object.values(auditK128SearchIntegrity()).every(Boolean)).toBe(true);
  });

  it('consolidated health skeleton heights', () => {
    expect(Object.values(auditK128HealthSkeleton()).every(Boolean)).toBe(true);
  });

  it('consolidated notes header hooks', () => {
    expect(Object.values(auditK128NotesHeader()).every(Boolean)).toBe(true);
  });

  it('performance observation', () => {
    expect(auditK128PerformanceRc()).toBe(true);
    expect(K128_PERF_VAULT_COUNTS).toEqual([1000, 3000, 5000, 10000]);
  });

  it('full release candidate', () => {
    expect(auditK128ReleaseRc()).toBe(true);
  });
});
