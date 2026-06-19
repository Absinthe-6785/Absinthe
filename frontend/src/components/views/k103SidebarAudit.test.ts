import { describe, expect, it } from 'vitest';
import { auditSidebarHierarchy, formatK103SidebarReport } from './k103SidebarAudit';

describe('k103SidebarAudit', () => {
  it('covers sidebar sections in order', () => {
    const rows = auditSidebarHierarchy();
    expect(rows[0]?.id).toBe('favorites');
    expect(rows.find(r => r.id === 'trash')).toBeTruthy();
    expect(rows.find(r => r.id === 'timeline-lens')).toBeTruthy();
  });

  it('prints sidebar report', () => {
    const report = formatK103SidebarReport(auditSidebarHierarchy());
    console.log('\n' + report);
    expect(report).toContain('K-103 sidebar audit');
  });
});
