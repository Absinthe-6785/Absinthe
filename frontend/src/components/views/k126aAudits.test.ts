import { describe, expect, it } from 'vitest';
import {
  auditK126aAnalyticsSimplification,
  auditK126aMobileFlow,
  auditK126aRc,
} from './k126aHealthAnalyticsAudit';

describe('k126a health analytics simplification & mobile flow audits', () => {
  it('A — analytics simplification', () => {
    const r = auditK126aAnalyticsSimplification();
    expect(r.twoColumnSummary).toBe(true);
    expect(r.noStreakUi).toBe(true);
    expect(r.noRecentSessionsUi).toBe(true);
    expect(r.historyOpenNote).toBe(true);
    expect(r.compactChart).toBe(true);
    expect(r.overviewAnalysisSplit).toBe(true);
    expect(r.workoutRecordsScroll).toBe(true);
    expect(r.scrollAfterSave).toBe(true);
  });

  it('A — mobile overflow menus and inbody quick panel', () => {
    const r = auditK126aMobileFlow();
    expect(r.workoutBlockCardExtracted).toBe(true);
    expect(r.blockOverflowMenu).toBe(true);
    expect(r.workoutOverflowMenu).toBe(true);
    expect(r.inbodyQuickPanel).toBe(true);
  });

  it('A — release candidate', () => {
    expect(auditK126aRc()).toBe(true);
  });
});
