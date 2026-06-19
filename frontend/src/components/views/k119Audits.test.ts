import { describe, expect, it } from 'vitest';
import { auditPopoverRc } from './k119PopoverAudit';
import { auditToolbarRc } from './k119ToolbarAudit';
import { auditEmptyStateRc } from './k119EmptyStateAudit';
import { auditScrollRc } from './k119ScrollAudit';
import { auditSettingsRc } from './k119SettingsAudit';
import { auditAccessibilityRc } from './k119AccessibilityAudit';
import { auditTypographyRc } from './k119TypographyAudit';
import { auditPerformanceRc, K119_PERF_VAULT_COUNTS } from './k119PerformanceAudit';
import { auditTokenRc } from './k119TokenAudit';

describe('k119 workspace polish audits', () => {
  it('A — global popover system', () => {
    expect(auditPopoverRc()).toBe(true);
  });

  it('B — toolbar consistency', () => {
    expect(auditToolbarRc()).toBe(true);
  });

  it('C — empty state density', () => {
    expect(auditEmptyStateRc()).toBe(true);
  });

  it('D — scroll behavior', () => {
    expect(auditScrollRc()).toBe(true);
  });

  it('E — settings cleanup', () => {
    expect(auditSettingsRc()).toBe(true);
  });

  it('F — accessibility', () => {
    expect(auditAccessibilityRc()).toBe(true);
  });

  it('G — typography & density', () => {
    expect(auditTypographyRc()).toBe(true);
  });

  it('H — performance observation', () => {
    expect(auditPerformanceRc()).toBe(true);
    expect(K119_PERF_VAULT_COUNTS).toEqual([1000, 3000, 5000, 10000]);
  });

  it('I — maintenance tokens', () => {
    expect(auditTokenRc()).toBe(true);
  });
});
