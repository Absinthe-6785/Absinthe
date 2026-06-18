import { describe, expect, it } from 'vitest';
import { auditWorkspacePanel, formatK103WorkspaceReport } from './k103WorkspaceAudit';

describe('k103WorkspaceAudit', () => {
  it('covers workspace hooks', () => {
    expect(auditWorkspacePanel().some(r => r.feature === 'pinned-empty')).toBe(true);
  });

  it('prints workspace report', () => {
    const report = formatK103WorkspaceReport(auditWorkspacePanel());
    console.log('\n' + report);
    expect(report).toContain('K-103 workspace audit');
  });
});
