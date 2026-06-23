import { describe, expect, it } from 'vitest';
import { auditSettingsSections, formatK102SettingsReport } from './k102SettingsAudit';

describe('k102SettingsAudit', () => {
  it('lists all four settings sections', () => {
    expect(auditSettingsSections()).toHaveLength(4);
  });

  it('prints settings report', () => {
    const report = formatK102SettingsReport(auditSettingsSections());
    console.log('\n' + report);
    expect(report).toContain('K-102 settings audit');
  });
});
