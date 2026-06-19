import { describe, expect, it } from 'vitest';
import { auditStartupGuards, auditLargeVaultStartup } from './k115StartupAudit';
import { auditSessionStability, estimateSessionRequestCount } from './k115SessionAudit';
import { auditMobileChecklist, auditMobileTouchTargets, auditMobileDomains } from './k115MobileAudit';
import { auditDesktopLayout, auditDesktopPanels } from './k115DesktopAudit';
import { auditKeyboardRc, auditKeyboardMatrix } from './k115KeyboardAudit';
import { auditProjectionIndependence, auditProjectionRc } from './k115ProjectionAudit';
import { auditRecoveryComplete, auditRecoveryRc } from './k115RecoveryAudit';
import { auditPerformanceMatrix, runK115PerformanceMatrix } from './k115PerformanceAudit';
import { auditRenderReady, auditRenderRc } from './k115RenderAudit';

describe('k115 release candidate audits', () => {
  it('A — startup guards', () => {
    const guards = auditStartupGuards();
    expect(guards.bootstrapOnce).toBe(true);
    expect(guards.noDuplicateHydration).toBe(true);
    expect(guards.coalescedHydrate).toBe(true);
    expect(auditLargeVaultStartup().length).toBeGreaterThan(0);
  });

  it('B — session stability policy', () => {
    const items = auditSessionStability();
    expect(items).toContain('hydrate-coalesced');
    expect(items).toContain('delta-default');
    expect(estimateSessionRequestCount(120)).toBeLessThan(500);
  });

  it('C — mobile QA matrix', () => {
    expect(auditMobileTouchTargets()).toBe(true);
    expect(auditMobileChecklist()).toContain('320');
    expect(auditMobileDomains().some(d => d.startsWith('search:'))).toBe(true);
  });

  it('D — desktop QA', () => {
    expect(auditDesktopPanels().length).toBeGreaterThan(3);
    expect(auditDesktopLayout()).toContain('panel-widths-bounded');
  });

  it('E — keyboard RC matrix', () => {
    expect(auditKeyboardRc()).toBe(true);
    expect(auditKeyboardMatrix().length).toBe(12);
  });

  it('F — projection independence', () => {
    const ind = auditProjectionIndependence();
    expect(ind.count).toBe(6);
    expect(ind.noGlobalProjection).toBe(true);
    expect(ind.noCircularImports).toBe(true);
    expect(auditProjectionRc()).toContain('no-cycles');
  });

  it('G — error recovery', () => {
    expect(auditRecoveryComplete()).toBe(true);
    expect(auditRecoveryRc()).toContain('sync-failure-retrySync');
  });

  it('H — performance matrix', () => {
    const rows = runK115PerformanceMatrix();
    expect(rows[rows.length - 1]?.noteCount).toBe(10000);
    expect(auditPerformanceMatrix()).toContain('10000');
  });

  it('I — render production validation', () => {
    expect(auditRenderReady()).toBe(true);
    expect(auditRenderRc()).toContain('bootstrap-once');
    expect(auditRenderRc()).toContain('delta-adopted');
    expect(auditRenderRc()).toContain('no-get-loop');
  });
});
