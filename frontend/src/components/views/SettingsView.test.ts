import { describe, expect, it } from 'vitest';

import { buildResetRequestInit } from './SettingsView';
import {
  resolveBackupControlCopy,
  resolveDataSafetyStatusPresentation,
} from './features/settings/RecoveryCenterPanel';

describe('SettingsView recovery request boundary', () => {
  it('includes the exact reset-confirmed intent header', () => {
    expect(buildResetRequestInit()).toEqual({
      method: 'DELETE',
      headers: { 'X-Absinthe-Recovery-Intent': 'reset-confirmed' },
    });
  });
});

describe('Settings backup coverage presentation', () => {
  it('shows explicit local scope before a logged-out backup', () => {
    expect(resolveBackupControlCopy(false)).toEqual({
      descriptionKey: 'dataSafetyLocalBackupDesc',
      actionKey: 'dataSafetyCreateLocalBackup',
    });
  });

  it('uses the complete backup control while cloud coverage is expected', () => {
    expect(resolveBackupControlCopy(true)).toEqual({
      descriptionKey: 'dataSafetyBackupDesc',
      actionKey: 'dataSafetyCreateBackup',
    });
  });

  it('maps only protected coverage to Healthy', () => {
    expect(resolveDataSafetyStatusPresentation('protected').labelKey).toBe('dataSafetyHealthy');
    expect(resolveDataSafetyStatusPresentation('partial').labelKey).toBe('dataSafetyLimited');
    expect(resolveDataSafetyStatusPresentation('none').labelKey).toBe('dataSafetyNeedsBackup');
  });
});
