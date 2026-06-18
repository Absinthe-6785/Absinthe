import { describe, expect, it } from 'vitest';
import { readWorkspaceSearchState, writeWorkspaceSearchState, resetWorkspaceSearchStateForTests } from './k101WorkspaceSearchState';
import { auditSearchFeatures, formatK101SearchReport } from './k101SearchAudit';

describe('k101WorkspaceSearchState', () => {
  it('persists query in session storage', () => {
    resetWorkspaceSearchStateForTests();
    writeWorkspaceSearchState({ query: 'hello', filter: 'note' });
    expect(readWorkspaceSearchState().query).toBe('hello');
    expect(readWorkspaceSearchState().filter).toBe('note');
  });
});

describe('k101SearchAudit', () => {
  it('prints search report', () => {
    const report = formatK101SearchReport(auditSearchFeatures());
    console.log('\n' + report);
    expect(report).toContain('K-101 search audit');
  });
});
