import { describe, expect, it } from 'vitest';
import {
  auditHealthPerformanceHooks,
  formatK107HealthPerformanceReport,
  runK107HealthPerformanceMatrix,
} from './k107HealthPerformanceAudit';
import { auditHealthProjectionCompleteness, auditHealthProjectionConsumers } from './k107HealthProjectionAudit';
import { auditHealthLazySections, auditHealthLazyNutritionGate } from './k107HealthLazyAudit';
import { auditCalendarMonthKeyMemo, auditCalendarHooks } from './k107HealthCalendarAudit';
import { auditHealthChartLazyMount } from './k107HealthChartAudit';
import { auditHealthVirtualization, auditHealthVirtualizationThresholds } from './k107HealthVirtualizationAudit';
import { auditTabPerformanceMatrix, auditTabPerformanceHooks } from './k107TabPerformanceAudit';
import { auditSearchPerformance, auditSearchLazyProjection } from './k107SearchPerformanceAudit';
import { auditMobilePerformance, auditMobileTouchTargets } from './k107MobilePerformanceAudit';
import { buildHealthProjection, synthesizeRangeWorkouts } from './features/health/buildHealthProjection';
import { readHealthSectionPrefs } from './features/health/healthSectionPrefs';

describe('k107HealthPerformanceAudit', () => {
  it('runs projection matrix at all scales', () => {
    const rows = runK107HealthPerformanceMatrix();
    expect(rows).toHaveLength(5);
    expect(rows.every(r => r.projectionMs >= 0)).toBe(true);
    console.log('\n' + formatK107HealthPerformanceReport(rows));
  });

  it('documents performance hooks', () => {
    expect(auditHealthPerformanceHooks()).toContain('data-k107-health-analytics');
  });
});

describe('k107HealthProjectionAudit', () => {
  it('builds complete projection', () => {
    expect(auditHealthProjectionCompleteness()).toBe(true);
  });

  it('lists consumers', () => {
    expect(auditHealthProjectionConsumers()).toContain('HealthView.tsx');
  });

  it('projection at 10k records completes', () => {
    const rows = synthesizeRangeWorkouts(10000);
    const start = performance.now();
    const p = buildHealthProjection({ rangeWorkouts: rows, selectedDateKey: '2026-06-18' });
    const ms = performance.now() - start;
    expect(p.exerciseHistory.length).toBeGreaterThan(0);
    expect(ms).toBeLessThan(500);
  });
});

describe('k107 health lazy/calendar/chart/virtual audits', () => {
  it('lazy sections', () => {
    expect(auditHealthLazySections().length).toBeGreaterThan(0);
    expect(auditHealthLazyNutritionGate()).toBe(true);
  });

  it('calendar monthKey memo', () => {
    const { monthKey, cellCount } = auditCalendarMonthKeyMemo();
    expect(monthKey).toBe('2026-06');
    expect(cellCount).toBeGreaterThan(0);
    expect(auditCalendarHooks()).toContain('buildMonthCellDecorations');
  });

  it('chart lazy rules', () => {
    expect(auditHealthChartLazyMount()).toContain('data-k107-health-weekly-chart');
  });

  it('virtualization thresholds', () => {
    expect(auditHealthVirtualization().length).toBe(4);
    expect(auditHealthVirtualizationThresholds()['block-library']).toBe(48);
  });
});

describe('k107 product-wide audits', () => {
  it('tab performance matrix', () => {
    const rows = auditTabPerformanceMatrix();
    expect(rows.every(r => !r.mountsWhenHidden)).toBe(true);
    expect(auditTabPerformanceHooks().length).toBeGreaterThan(0);
  });

  it('search memo rules', () => {
    expect(auditSearchLazyProjection()).toBe(true);
    expect(auditSearchPerformance().length).toBeGreaterThan(0);
  });

  it('mobile widths', () => {
    expect(auditMobilePerformance()).toEqual([320, 375, 768]);
    expect(auditMobileTouchTargets()).toBe(true);
  });

  it('section prefs default collapsed analytics (K-125C)', () => {
    const prefs = readHealthSectionPrefs();
    expect(prefs.analyticsCollapsed).toBe(true);
    expect(prefs.chartsCollapsed).toBe(true);
    expect(prefs.prSectionCollapsed).toBe(true);
  });
});
