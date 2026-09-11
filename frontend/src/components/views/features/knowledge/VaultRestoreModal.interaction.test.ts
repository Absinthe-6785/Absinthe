// @vitest-environment happy-dom
import { createElement } from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { VaultRestorePreview } from '@/lib/importVaultBackup';
import { VaultRestoreModal } from './VaultRestoreModal';

vi.mock('@/lib/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const invalidPreview: VaultRestorePreview = {
  valid: false,
  manifest: null,
  validation: null,
  noteCount: 0,
  folderCount: 0,
  newNoteCount: 0,
  newFolderCount: 0,
  conflictCount: 0,
  conflictNoteIds: [],
  relationCount: 0,
  exportedAt: null,
  appVersion: null,
  folderOptions: [],
  noteOptions: [],
};

const baseProps = {
  preview: invalidPreview,
  strategy: 'skip' as const,
  selection: { noteIds: new Set<string>(), folderIds: new Set<string>() },
  onStrategyChange: vi.fn(),
  onToggleNote: vi.fn(),
  onToggleFolder: vi.fn(),
  onSelectAll: vi.fn(),
  onSelectNone: vi.fn(),
  onConfirm: vi.fn(),
  onCancel: vi.fn(),
};

describe('VaultRestoreModal outer interaction contract', () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    vi.clearAllMocks();
    delete (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
  });

  it('gives the invalid-backup dialog a valid name and safe initial focus', () => {
    act(() => root.render(createElement(VaultRestoreModal, baseProps)));
    const dialog = host.querySelector<HTMLElement>('[role="dialog"]')!;
    const cancel = dialog.querySelector<HTMLButtonElement>('button')!;

    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.getAttribute('aria-labelledby')).toBe('vault-restore-failed-title');
    expect(dialog.querySelector('#vault-restore-failed-title')?.textContent).toBe('vaultRestoreFailedTitle');
    expect(document.activeElement).toBe(cancel);
  });

  it('dismisses an invalid preview without invoking restore confirmation', () => {
    act(() => root.render(createElement(VaultRestoreModal, baseProps)));
    act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })));

    expect(baseProps.onCancel).toHaveBeenCalledTimes(1);
    expect(baseProps.onConfirm).not.toHaveBeenCalled();
  });

  it('focuses the safe footer cancel action in the valid restore dialog', () => {
    const preview = {
      ...invalidPreview,
      valid: true,
      manifest: { schemaVersion: 1, notes: [], folders: [] },
    } as VaultRestorePreview;
    act(() => root.render(createElement(VaultRestoreModal, { ...baseProps, preview })));
    const dialog = host.querySelector<HTMLElement>('[role="dialog"]')!;
    const buttons = [...dialog.querySelectorAll<HTMLButtonElement>('button')];
    const close = dialog.querySelector<HTMLButtonElement>('button[aria-label="cancel"]')!;
    const footerCancel = buttons.at(-2)!;

    expect(dialog.getAttribute('aria-labelledby')).toBe('vault-restore-title');
    expect(document.activeElement).toBe(footerCancel);
    expect(close.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    expect(close.className).toContain('abs-focus-ring');
  });
});
