import { describe, expect, it } from 'vitest';
import {
  buildK98SettingsAuditMatrix,
  formatK98SettingsAuditReport,
  K98A_REMOVED_SETTINGS,
  K98A_SETTINGS_SECTIONS,
} from './k98aSettingsAudit';

describe('k98aSettingsAudit', () => {
  it('covers all K-98A settings sections', () => {
    const rows = buildK98SettingsAuditMatrix();
    expect(rows).toHaveLength(K98A_SETTINGS_SECTIONS.length);
    expect(rows.every(r => r.present)).toBe(true);
    expect(K98A_REMOVED_SETTINGS).toContain('defaultColor');
  });

  it('prints settings IA report', () => {
    const report = formatK98SettingsAuditReport(buildK98SettingsAuditMatrix());
    console.log('\n' + report);
    expect(report).toContain('storage');
    expect(report).toContain('danger');
  });
});
