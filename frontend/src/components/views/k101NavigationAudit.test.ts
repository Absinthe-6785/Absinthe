import { describe, expect, it } from 'vitest';
import { auditNavigationShortcuts, formatK101NavigationReport, K101_NAV_SHORTCUTS } from './k101NavigationAudit';

describe('k101NavigationAudit', () => {
  it('documents Alt+1–5 and Ctrl+Shift+F', () => {
    expect(K101_NAV_SHORTCUTS.some(s => s.keys === 'Alt+3' && s.tab === 'planner')).toBe(true);
    expect(K101_NAV_SHORTCUTS.some(s => s.keys === 'Ctrl+Shift+F')).toBe(true);
  });

  it('prints navigation report', () => {
    const report = formatK101NavigationReport(auditNavigationShortcuts());
    console.log('\n' + report);
    expect(report).toContain('K-101 navigation audit');
  });
});
