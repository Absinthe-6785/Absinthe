// @vitest-environment happy-dom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RECOVERY_MODE_MESSAGE } from '../../../../../lib/recoverySafetyPolicy';
import type { AppSettings, Theme } from '../../../../../types';
import type { ArchiveRestoreToolsProjection } from '../../knowledge/archive';

const { undoRestore } = vi.hoisted(() => ({
  undoRestore: vi.fn(() => false),
}));

vi.mock('../../../../../store/useNotesStore', () => ({
  useNotesStore: (selector: (state: unknown) => unknown) => selector({
    undoLastVaultRestore: undoRestore,
    vaultRestoreCanUndo: true,
  }),
}));

import { ArchiveRestoreToolsSection } from './ArchiveRestoreToolsSection';

describe('K-319A ArchiveRestoreToolsSection', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    undoRestore.mockReset();
    undoRestore.mockReturnValue(false);
    container = document.createElement('div');
    document.body.appendChild(container);
    localStorage.setItem('k319-sentinel', 'unchanged');
  });

  afterEach(() => {
    container.remove();
    localStorage.clear();
    delete (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
  });

  it('shows recovery feedback for blocked Undo Restore without storage mutation or success text', async () => {
    const root = createRoot(container);
    await act(async () => {
      root.render(createElement(ArchiveRestoreToolsSection, {
        restoreTools: { protectionStatus: 'partial', snapshotCount: 1 } as ArchiveRestoreToolsProjection,
        theme: { border: 'border', input: 'input', textMuted: 'muted' } as Theme,
        appSettings: { language: 'en', darkMode: false } as AppSettings,
        collapsed: false,
        onToggle: vi.fn(),
        onImportBackup: vi.fn(),
      }));
    });

    const button = container.querySelector<HTMLButtonElement>('[data-k109-restore-undo]');
    expect(button).not.toBeNull();
    await act(async () => { button!.click(); });

    expect(undoRestore).toHaveBeenCalledTimes(1);
    expect(container.querySelector('[role="alert"]')?.textContent).toBe(RECOVERY_MODE_MESSAGE);
    expect(container.textContent).not.toContain('Restore complete');
    expect(localStorage.getItem('k319-sentinel')).toBe('unchanged');

    await act(async () => { root.unmount(); });
  });
});
