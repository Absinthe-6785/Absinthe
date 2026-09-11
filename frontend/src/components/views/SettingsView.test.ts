// @vitest-environment happy-dom
import { createElement } from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { buildResetRequestInit, SettingsView } from './SettingsView';
import { UI_INTERACTION } from '../../lib/uiInteractionTokens';
import {
  resolveBackupControlCopy,
  resolveDataSafetyStatusPresentation,
} from './features/settings/RecoveryCenterPanel';

const viewProps = {
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
};
const initialInnerWidth = window.innerWidth;
const initialScrollIntoView = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollIntoView');

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: initialInnerWidth });
  if (initialScrollIntoView) {
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', initialScrollIntoView);
  } else {
    delete (HTMLElement.prototype as Partial<HTMLElement>).scrollIntoView;
  }
  delete (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
});

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

    await act(async () => root.render(createElement(SettingsView, viewProps as never)));

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

  it('renders one ordered semantic reading path with stable section headings and safety surfaces', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => root.render(createElement(SettingsView, viewProps as never)));

    const workspace = container.querySelector<HTMLElement>('[data-workspace="settings"]');
    const sections = [...container.querySelectorAll<HTMLElement>('[data-settings-section]')];
    expect(sections.map(section => section.dataset.settingsSection)).toEqual([
      'general',
      'data-safety',
      'danger',
    ]);
    for (const section of sections) {
      expect(section.tagName).toBe('SECTION');
      expect(section.classList.contains('scroll-mt-4')).toBe(true);
      const headingId = section.getAttribute('aria-labelledby');
      expect(headingId).toBeTruthy();
      expect(section.querySelector(`#${headingId}`)?.hasAttribute('data-settings-section-heading')).toBe(true);
    }
    expect(container.querySelector('[data-settings-data-safety]')).not.toBeNull();
    expect(container.querySelector('[data-settings-reset-action]')).not.toBeNull();
    expect(container.querySelector('[data-settings-sign-out-action]')).not.toBeNull();
    expect(container.querySelectorAll('[data-workspace-scroll-owner="page"]')).toHaveLength(1);
    expect(container.querySelector('[data-settings-data-safety] [data-workspace-scroll-owner]')).toBeNull();

    const general = container.querySelector<HTMLElement>('[data-settings-section="general"]')!;
    const danger = container.querySelector<HTMLElement>('[data-settings-section="danger"]')!;
    const selectedLanguage = container.querySelector<HTMLElement>('[data-settings-segmented-control="language"] button')!;
    const reset = container.querySelector<HTMLElement>('[data-settings-reset-action]')!;
    const signOut = container.querySelector<HTMLElement>('[data-settings-sign-out-action]')!;

    expect(workspace?.classList.contains('abs-cosmos-settings')).toBe(true);
    expect(container.querySelector('[data-settings-header-shell]')?.classList.contains('abs-cosmos-settings-header')).toBe(true);
    expect(general.classList.contains('abs-cosmos-settings-card')).toBe(true);
    expect(danger.classList.contains('abs-cosmos-settings-danger')).toBe(true);
    expect(selectedLanguage.classList.contains('bg-selected')).toBe(true);
    expect(selectedLanguage.classList.contains('bg-primary')).toBe(false);
    expect(reset.classList.contains('text-danger')).toBe(true);
    expect(reset.classList.contains('abs-settings-danger-action')).toBe(true);
    expect(reset.className).not.toContain('red-500');
    expect(signOut.classList.contains('bg-surface-muted')).toBe(true);
    for (const control of [selectedLanguage, reset, signOut]) {
      for (const focusClass of UI_INTERACTION.focusRingClass.split(/\s+/)) {
        expect(control.classList.contains(focusClass)).toBe(true);
      }
    }

    act(() => root.unmount());
    container.remove();
  });

  it('keeps Settings Cosmos decoration static, pointer-transparent, and separate from semantic states', () => {
    const css = readFileSync(join(process.cwd(), 'src', 'index.css'), 'utf8');
    const headerMarker = css.match(/\.abs-cosmos-settings-header::after\s*\{([^}]*)\}/s)?.[1];
    const cardMark = css.match(/\.abs-cosmos-settings-card::before\s*\{([^}]*)\}/s)?.[1];
    const dangerAction = css.match(/\.abs-settings-danger-action\s*\{([^}]*)\}/s)?.[1];
    const warningPanel = css.match(/\.abs-settings-warning-panel,\s*\.abs-settings-warning-action\s*\{([^}]*)\}/s)?.[1];

    expect(headerMarker).toContain('var(--cosmos-pale-blue-dot)');
    expect(headerMarker).toContain('pointer-events: none');
    expect(cardMark).toContain('var(--cosmos-orbit)');
    expect(cardMark).toContain('var(--cosmos-starlight)');
    expect(cardMark).toContain('pointer-events: none');
    expect(`${headerMarker}${cardMark}`).not.toMatch(/animation|transition|z-index/);
    expect(dangerAction).toContain('var(--color-danger)');
    expect(warningPanel).toContain('var(--color-warning)');
    expect(`${dangerAction}${warningPanel}`).not.toContain('--cosmos-');
  });

  it.each([390, 768, 1024, 1279, 1280, 1440])(
    'keeps the production Settings document contract at %ipx',
    async width => {
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
      const container = document.createElement('div');
      document.body.appendChild(container);
      const root = createRoot(container);

      await act(async () => root.render(createElement(SettingsView, viewProps as never)));

      const workspace = container.querySelector('[data-workspace="settings"]');
      const sectionList = workspace?.querySelector('[data-settings-section-list]');
      expect(sectionList?.classList.contains('w-full')).toBe(true);
      expect(sectionList?.classList.contains('max-w-3xl')).toBe(true);
      expect(workspace?.querySelectorAll('[data-settings-section]')).toHaveLength(3);
      expect(workspace?.querySelectorAll('[data-workspace-scroll-owner="page"]')).toHaveLength(1);

      act(() => root.unmount());
      container.remove();
    },
  );

  it('handles every target inside the Settings workspace and supports repeated navigation', async () => {
    vi.useFakeTimers();
    const scrollIntoView = vi.fn();
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoView,
    });
    const consumed = vi.fn();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    const renderTarget = async (settingsScrollTarget: 'general' | 'data-safety' | 'danger' | null) => {
      await act(async () => root.render(createElement(SettingsView, {
        ...viewProps,
        settingsScrollTarget,
        onSettingsScrollTargetConsumed: consumed,
      } as never)));
      await act(async () => vi.advanceTimersByTime(120));
    };

    for (const target of ['general', 'data-safety', 'danger', 'general'] as const) {
      await renderTarget(null);
      await renderTarget(target);
      const section = container.querySelector(`[data-settings-section="${target}"]`);
      expect(scrollIntoView).toHaveBeenLastCalledWith({ behavior: 'smooth', block: 'start' });
      expect(scrollIntoView.mock.instances.at(-1)).toBe(section);
    }
    expect(scrollIntoView).toHaveBeenCalledTimes(4);
    expect(consumed).toHaveBeenCalledTimes(4);

    act(() => root.unmount());
    container.remove();
  });

  it('does not consume a missing target and still resolves a later valid target', async () => {
    vi.useFakeTimers();
    const scrollIntoView = vi.fn();
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoView,
    });
    const consumed = vi.fn();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => root.render(createElement(SettingsView, {
      ...viewProps,
      settingsScrollTarget: 'missing-target',
      onSettingsScrollTargetConsumed: consumed,
    } as never)));
    await act(async () => vi.advanceTimersByTime(120));

    expect(scrollIntoView).not.toHaveBeenCalled();
    expect(consumed).not.toHaveBeenCalled();

    await act(async () => root.render(createElement(SettingsView, {
      ...viewProps,
      settingsScrollTarget: 'danger',
      onSettingsScrollTargetConsumed: consumed,
    } as never)));
    await act(async () => vi.advanceTimersByTime(120));

    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(scrollIntoView.mock.instances[0]).toBe(
      container.querySelector('[data-settings-section="danger"]'),
    );
    expect(consumed).toHaveBeenCalledTimes(1);

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
