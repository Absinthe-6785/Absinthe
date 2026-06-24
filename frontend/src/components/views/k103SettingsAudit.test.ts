import { describe, expect, it } from 'vitest';
import { auditSettingsCleanup, formatK103SettingsReport } from './k103SettingsAudit';

describe('k103SettingsAudit', () => {
  it('covers settings sections', () => {
    expect(auditSettingsCleanup()).toHaveLength(3);
  });

  it('prints settings report', () => {
    const report = formatK103SettingsReport(auditSettingsCleanup());
    console.log('\n' + report);
    expect(report).toContain('K-103 settings audit');
  });
});
