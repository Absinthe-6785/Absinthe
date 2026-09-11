// @vitest-environment happy-dom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { PendingReducedVaultBackup } from '@/lib/vaultBackupFlow';
import type { VaultBackupManifest } from '@/lib/exportVaultBackup';
import {
  RecoveryCenterPanel,
  resolveDataSafetyStatusPresentation,
  type RecoveryCenterPanelProps,
} from './RecoveryCenterPanel';
import { UI_INTERACTION } from '@/lib/uiInteractionTokens';

vi.mock('@/lib/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const theme = { card: 'card', border: 'border', input: 'input', textMuted: 'muted' };
const storageMetrics = {
  storageType: 'browser-local-storage' as const,
  vaultBytes: 0,
  snapshotBytes: 0,
  snapshotCount: 0,
  lastSnapshotAt: null,
  lastSnapshotNoteCount: null,
};

function recovery(
  protectionStatus: RecoveryCenterPanelProps['recovery']['protectionStatus'] = 'partial',
): RecoveryCenterPanelProps['recovery'] {
  return {
    snapshots: [],
    snapshotCount: 0,
    lastSnapshotAt: null,
    lastExportAt: null,
    lastExportCoverage: null,
    protectionStatus,
    refresh: vi.fn(),
    validateSnapshot: vi.fn(),
    getSnapshotSchemaVersion: vi.fn(),
  };
}

function pendingReducedBackup(recipeUnavailable = false): PendingReducedVaultBackup {
  return {
    coverage: 'cloud-partial',
    recipeUnavailable,
    cloudGaps: ['/api/backup:503'],
    accountId: 'account-a',
    manifest: {} as VaultBackupManifest,
  };
}

function restoreFlow(): RecoveryCenterPanelProps['vaultRestore'] {
  return {
    openFilePicker: vi.fn(),
    openSnapshotRestore: vi.fn(),
  } as RecoveryCenterPanelProps['vaultRestore'];
}

function button(container: HTMLDivElement, label: string): HTMLButtonElement {
  const found = [...container.querySelectorAll('button')]
    .find(candidate => candidate.textContent?.includes(label));
  if (!found) throw new Error(`Missing button: ${label}`);
  return found as HTMLButtonElement;
}

function renderPanel(overrides: Partial<RecoveryCenterPanelProps> = {}) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  const props: RecoveryCenterPanelProps = {
    recovery: recovery(),
    vaultRestore: restoreFlow(),
    storageMetrics,
    theme,
    onCreateBackup: vi.fn(),
    onRetryBackup: vi.fn(),
    onCreateLimitedBackup: vi.fn(),
    backingUp: false,
    cloudSyncEnabled: true,
    pendingReducedBackup: null,
    ...overrides,
  };
  act(() => root.render(createElement(RecoveryCenterPanel, props)));
  return { container, root, props };
}

let roots: Root[] = [];
let containers: HTMLDivElement[] = [];

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

afterEach(() => {
  for (const root of roots) act(() => root.unmount());
  for (const container of containers) container.remove();
  roots = [];
  containers = [];
  delete (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
});

function mounted(overrides: Partial<RecoveryCenterPanelProps> = {}) {
  const result = renderPanel(overrides);
  roots.push(result.root);
  containers.push(result.container);
  return result;
}

describe('RecoveryCenterPanel backup coverage presentation', () => {
  it('routes protection status through semantic success and warning authority', () => {
    expect(resolveDataSafetyStatusPresentation('protected').className).toBe('abs-settings-status-success text-success');
    expect(resolveDataSafetyStatusPresentation('partial').className).toBe('abs-settings-status-warning text-warning');
    expect(resolveDataSafetyStatusPresentation('none').className).toBe('abs-settings-status-warning text-warning');
  });
  it('renders local-only backup semantics from mounted props', () => {
    const { container } = mounted({ cloudSyncEnabled: false });

    expect(container.textContent).toContain('dataSafetyLocalBackupDesc');
    expect(container.textContent).toContain('dataSafetyCreateLocalBackup');
    expect(container.querySelector('[data-settings-limited-backup-warning]')).toBeNull();
  });

  it('renders the normal cloud backup control without a limited warning', () => {
    const { container } = mounted({ cloudSyncEnabled: true });

    expect(container.textContent).toContain('dataSafetyBackupDesc');
    expect(container.textContent).toContain('dataSafetyCreateBackup');
    expect(container.querySelector('[data-settings-limited-backup-warning]')).toBeNull();

    const panel = container.querySelector<HTMLElement>('[data-settings-data-safety]')!;
    const summary = container.querySelector<HTMLElement>('[data-settings-storage-summary]')!;
    const backup = container.querySelector<HTMLElement>('[data-settings-backup-action]')!;
    const restore = container.querySelector<HTMLElement>('[data-settings-restore-action]')!;
    expect(panel.classList.contains('abs-cosmos-settings-card')).toBe(true);
    expect(summary.classList.contains('bg-surface-muted')).toBe(true);
    for (const control of [backup, restore]) {
      for (const focusClass of UI_INTERACTION.focusRingClass.split(/\s+/)) {
        expect(control.classList.contains(focusClass)).toBe(true);
      }
    }
  });

  it('renders a partial protection warning and wires both mounted actions', () => {
    const onRetryBackup = vi.fn();
    const onCreateLimitedBackup = vi.fn();
    const { container } = mounted({
      recovery: recovery('partial'),
      pendingReducedBackup: pendingReducedBackup(false),
      onRetryBackup,
      onCreateLimitedBackup,
    });

    const warning = container.querySelector<HTMLElement>('[data-settings-limited-backup-warning]')!;
    expect(warning).not.toBeNull();
    expect(warning.classList.contains('abs-settings-warning-panel')).toBe(true);
    expect(warning.className).not.toContain('amber-');
    expect(container.textContent).toContain('dataSafetyLimited');
    expect(container.textContent).toContain('dataSafetyLimitedBackupTitle');
    expect(container.textContent).toContain('dataSafetyLimitedBackupDesc');
    expect(container.textContent).toContain('dataSafetyLimitedBackupServerSafe');

    act(() => button(container, 'dataSafetyRetryBackup').click());
    act(() => button(container, 'dataSafetyCreateLimitedBackup').click());
    expect(onRetryBackup).toHaveBeenCalledTimes(1);
    expect(onCreateLimitedBackup).toHaveBeenCalledTimes(1);
  });

  it('selects the Recipe-unavailable description branch in the mounted warning', () => {
    const { container } = mounted({ pendingReducedBackup: pendingReducedBackup(true) });

    expect(container.textContent).toContain('dataSafetyLimitedBackupRecipeDesc');
    expect(container.textContent).not.toContain('dataSafetyLimitedBackupDesc');
    expect(container.querySelector('[data-settings-limited-backup-warning]')).not.toBeNull();
  });

  it('disables the main, Retry, and Create Limited Backup controls while backing up', () => {
    const { container } = mounted({
      backingUp: true,
      pendingReducedBackup: pendingReducedBackup(false),
    });

    const backup = button(container, 'vaultBackupZipping');
    expect(backup.disabled).toBe(true);
    expect(backup.classList.contains('disabled:bg-surface-muted')).toBe(true);
    expect(backup.classList.contains('disabled:text-disabled')).toBe(true);
    expect(button(container, 'dataSafetyRetryBackup').disabled).toBe(true);
    expect(button(container, 'dataSafetyCreateLimitedBackup').disabled).toBe(true);
  });
});
