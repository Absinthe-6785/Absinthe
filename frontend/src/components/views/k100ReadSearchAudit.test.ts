import { describe, expect, it } from 'vitest';
import {
  auditReadSearchFeatures,
  formatK100ReadSearchReport,
  K100_READ_SEARCH_FEATURES,
} from './k100ReadSearchAudit';

const BLOCKS = [
  { id: 'b1', type: 'paragraph' as const, content: 'alpha beta', children: [] },
];

describe('k100ReadSearchAudit', () => {
  it.each(K100_READ_SEARCH_FEATURES)('audits feature %s', feature => {
    const row = auditReadSearchFeatures(BLOCKS, 'alpha').find(r => r.feature === feature);
    expect(row?.enabled).toBe(true);
  });

  it('prints read search report', () => {
    const report = formatK100ReadSearchReport(auditReadSearchFeatures(BLOCKS, 'alpha'));
    console.log('\n' + report);
    expect(report).toContain('K-100 read mode search audit');
  });
});
