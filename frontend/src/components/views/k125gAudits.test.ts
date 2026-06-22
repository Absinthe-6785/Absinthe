import { describe, expect, it } from 'vitest';
import {
  auditK125gEmptyStates,
  auditK125gPageHeaders,
  auditK125gRc,
  auditK125gSectionNav,
  auditK125gSpacingAndCards,
} from './k125gNavigationAudit';

describe('k125g global navigation & layout cohesion audits', () => {
  it('G — unified workspace page headers', () => {
    const r = auditK125gPageHeaders();
    expect(r.sharedHeaderComponent).toBe(true);
    expect(r.notesHeader).toBe(true);
    expect(r.healthHeader).toBe(true);
    expect(r.scheduleHeader).toBe(true);
    expect(r.archiveHeader).toBe(true);
    expect(r.recipeHeader).toBe(true);
    expect(r.settingsHeader).toBe(true);
    expect(r.unifiedTitleScale).toBe(true);
  });

  it('G — shared section navigation without parallel systems', () => {
    const r = auditK125gSectionNav();
    expect(r.sharedSectionNav).toBe(true);
    expect(r.healthDelegates).toBe(true);
    expect(r.scheduleDelegates).toBe(true);
    expect(r.notesListFilterDelegates).toBe(true);
    expect(r.noParallelScheduleWorkspaceNav).toBe(true);
    expect(r.scheduleLegacyHook).toBe(true);
  });

  it('G — spacing and card surface cohesion', () => {
    const r = auditK125gSpacingAndCards();
    expect(r.healthGapToken).toBe(true);
    expect(r.settingsCardSurface).toBe(true);
    expect(r.cardSurfaceToken).toBe(true);
    expect(r.settingsWorkspaceHook).toBe(true);
  });

  it('G — archive empty state migration', () => {
    const r = auditK125gEmptyStates();
    expect(r.archiveProductEmpty).toBe(true);
    expect(r.archiveEmptyAction).toBe(true);
  });

  it('G — release candidate', () => {
    expect(auditK125gRc()).toBe(true);
  });
});
