import { describe, expect, it } from 'vitest';
import { auditDesktopLayout, formatK103LayoutReport } from './k103LayoutAudit';

describe('k103LayoutAudit', () => {
  it('covers layout constants', () => {
    expect(auditDesktopLayout().find(r => r.surface === 'note-list-width')?.value).toBe('236px');
  });

  it('prints layout report', () => {
    const report = formatK103LayoutReport(auditDesktopLayout());
    console.log('\n' + report);
    expect(report).toContain('K-103 layout audit');
  });
});
