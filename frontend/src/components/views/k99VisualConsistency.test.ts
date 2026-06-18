import { describe, expect, it } from 'vitest';
import { auditVisualConsistency, formatK99VisualConsistencyReport } from './k99VisualConsistency';

describe('k99VisualConsistency', () => {
  it('documents core layout tokens', () => {
    const rows = auditVisualConsistency();
    expect(rows.some(r => r.token === 'layout.readingMaxWidth')).toBe(true);
    expect(rows.some(r => r.token === 'layout.noteListWidth')).toBe(true);
  });

  it('prints visual consistency report', () => {
    const report = formatK99VisualConsistencyReport(auditVisualConsistency());
    console.log('\n' + report);
    expect(report).toContain('K-99 visual consistency report');
  });
});
