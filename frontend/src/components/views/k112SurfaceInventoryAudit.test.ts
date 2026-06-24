import { describe, expect, it } from 'vitest';
import { auditSurfaceInventory, auditSurfaceCount, K112_SURFACES } from './k112SurfaceInventoryAudit';
import { auditActionDuplication, auditRemovedActionCount } from './k112ActionAudit';
import { auditSettings } from './k112SettingsAudit';
import { auditNavigation, auditTabJustification } from './k112NavigationAudit';
import { auditEmptyStates } from './k112EmptyStateAudit';
import { auditTerminology, auditTerminologyNormalizedKeys } from './k112TerminologyAudit';
import { auditMobile, auditMobileTouchTargets } from './k112MobileAudit';
import { auditLayout } from './k112LayoutAudit';
import { auditProjections, auditProjectionSinglePass, auditProjectionLegacyRemoved } from './k112ProjectionAudit';

describe('k112SurfaceInventoryAudit', () => {
  it('lists eight product surfaces', () => {
    expect(auditSurfaceCount()).toBe(8);
    expect(K112_SURFACES).toContain('cosmos');
    const inv = auditSurfaceInventory();
    expect(inv.removed).toContain('WorkspaceSearchPalette.tsx');
  });
});

describe('k112 audits', () => {
  it('action duplication subtraction', () => {
    expect(auditRemovedActionCount()).toBeGreaterThanOrEqual(8);
    expect(auditActionDuplication()).toContain('openWorkspaceSearch');
  });

  it('settings sections', () => {
    expect(auditSettings()).toContain('data-safety');
    expect(auditSettings()).toContain('components/common/SettingsView.tsx');
  });

  it('navigation tab roles', () => {
    expect(auditTabJustification()).toBe(true);
    expect(auditNavigation()).toContain('search');
  });

  it('empty state surfaces', () => {
    expect(auditEmptyStates()).toContain('ProductEmptyState');
  });

  it('terminology map', () => {
    expect(auditTerminologyNormalizedKeys()).toBeGreaterThanOrEqual(8);
    expect(auditTerminology()).toContain('k111SearchTitle');
  });

  it('mobile widths', () => {
    expect(auditMobile()).toEqual([320, 375, 768]);
    expect(auditMobileTouchTargets()).toBe(true);
  });

  it('layout hooks', () => {
    expect(auditLayout()).toContain('data-workspace');
  });

  it('projection sanity', () => {
    expect(auditProjectionSinglePass()).toBe(true);
    expect(auditProjections()).toHaveLength(5);
    expect(auditProjectionLegacyRemoved()).toContain('WorkspaceSearchPalette.tsx');
  });
});
