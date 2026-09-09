// @vitest-environment happy-dom
import { createElement } from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';

import { buildResetRequestInit, SettingsView } from './SettingsView';
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

describe('SettingsView scroll contract', () => {
  it('renders one page-level scroll owner inside a bounded workspace root', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => root.render(createElement(SettingsView, {
      appSettings: {
        darkMode: false,
        defaultCategory: 'Personal',
        defaultColor: 'gold',
        language: 'en',
      },
      updateSetting: vi.fn(),
      showToast: vi.fn(),
      theme: {
        card: 'bg-surface',
        input: 'bg-surface-alt',
        border: 'border-border',
        text: 'text-foreground',
        textMuted: 'text-muted',
        hoverBg: 'hover:bg-surface-alt',
      },
      THEME_COLORS: [],
      mutateDaily: vi.fn(),
      mutateStatic: vi.fn(),
      mutateTodos: vi.fn(),
      mutateRoutines: vi.fn(),
      onSignOut: vi.fn(),
      user: { id: 'settings-account', name: 'Settings User' },
    } as never)));

    const workspace = container.querySelector('[data-workspace="settings"]');
    const owners = workspace?.querySelectorAll('[data-workspace-scroll-owner="page"]');
    expect(workspace?.getAttribute('data-workspace-scroll-mode')).toBe('page');
    expect(workspace?.classList.contains('overflow-hidden')).toBe(true);
    expect(workspace?.classList.contains('overflow-y-auto')).toBe(false);
    expect(owners).toHaveLength(1);
    expect(owners?.[0]?.hasAttribute('data-settings-scroll')).toBe(true);

    act(() => root.unmount());
    container.remove();
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
