import { describe, expect, it } from 'vitest';
import { auditK100SettingsSections, formatK100SettingsReport } from './k100SettingsAudit';

describe('k100SettingsAudit', () => {
  it('expects general-first section order', () => {
    const sections = auditK100SettingsSections();
    expect(sections[0]).toBe('general');
    expect(sections).toContain('danger');
  });

  it('prints settings report', () => {
    const report = formatK100SettingsReport(auditK100SettingsSections());
    console.log('\n' + report);
    expect(report).toContain('K-100 settings audit');
  });
});
