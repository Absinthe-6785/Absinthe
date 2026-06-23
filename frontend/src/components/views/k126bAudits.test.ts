import { describe, expect, it } from 'vitest';
import { auditK125eRc } from './k125eMobileMoreAudit';
import { auditK125fRc } from './k125fSidebarNavAudit';
import { auditK100SettingsSections, auditSettingsRc } from './k100SettingsAudit';

describe('k126b mobile navigation & More sheet audits', () => {
  it('K-125E — mobile More sheet', () => {
    expect(auditK125eRc()).toBe(true);
  });

  it('K-125F — sidebar mobile navigation', () => {
    expect(auditK125fRc()).toBe(true);
  });

  it('settings sections remain complete', () => {
    expect(auditK100SettingsSections().length).toBe(4);
    expect(auditSettingsRc()).toBe(true);
  });
});
