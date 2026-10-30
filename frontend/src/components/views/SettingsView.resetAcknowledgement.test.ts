// @vitest-environment happy-dom
import { createElement, act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { NOTES_RESET_STAGES, notesResetResult } from '../../lib/notesResetContract';
import {
  captureNotesResetContext, initNotesPersistence, resetNotesPersistenceForTests,
} from '../../lib/notePersistence';
import { setRecoveryModeActiveForTest } from '../../lib/recoverySafetyPolicy';

const harness = vi.hoisted(() => ({ notes: vi.fn(), health: vi.fn(), current: vi.fn(() => true) }));
vi.mock('../../lib/supabase', () => ({ authFetch: vi.fn(), authReadFetch: vi.fn() }));
vi.mock('../../lib/healthRoutineSync', () => ({ productionHealthRoutinePersistence: { reset: harness.health } }));
vi.mock('../../store/useNotesStore', () => ({ useNotesStore: (select: any) => select({
  notes: [], folders: [], resetAllNotes: harness.notes,
  captureResetContext: (account: string, isUiCurrent: () => boolean) => {
    const context = captureNotesResetContext(account, isUiCurrent);
    return context && { ...context, isStoreCurrent: harness.current };
  },
}), observePublishedNotesHydration: () => ({ status: 'UNAVAILABLE', reason: 'MISSING_AUTHORITY' }) }));
vi.mock('../../hooks/useVaultRestoreFlow', () => ({ useVaultRestoreFlow: () => ({ preview: null, fileInputRef: { current: null } }) }));
vi.mock('../../hooks/useRecoveryCenter', () => ({ useRecoveryCenter: () => ({ refresh: vi.fn() }) }));
vi.mock('./features/settings/RecoveryCenterPanel', () => ({ RecoveryCenterPanel: () => null }));
vi.mock('../../lib/i18n', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

const { SettingsView, performSettingsNotesReset } = await import('./SettingsView');

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}

let host: HTMLDivElement;
let root: Root;
const toast = vi.fn();
const daily = vi.fn();
const fixed = vi.fn();
const props = {
  appSettings: { darkMode: false, defaultCategory: 'Personal', defaultColor: 'gold', language: 'en' },
  updateSetting: vi.fn(), showToast: toast, theme: { card: '', input: '', border: '', text: '', textMuted: '', hoverBg: '' },
  THEME_COLORS: [], mutateDaily: daily, mutateStatic: fixed, onSignOut: vi.fn(),
};

async function render(account: string | null = 'account-a') {
  await act(async () => root.render(createElement(SettingsView, { ...props, user: account ? { id: account } : undefined } as any)));
}
async function open() {
  await act(async () => (host.querySelector('[data-settings-reset-action]') as HTMLButtonElement).click());
}
async function confirm() {
  const buttons = host.querySelectorAll<HTMLButtonElement>('[role="dialog"] button');
  await act(async () => { buttons[buttons.length - 1].click(); await Promise.resolve(); });
}

beforeEach(async () => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  harness.current.mockReturnValue(true);
  localStorage.clear();
  vi.stubGlobal('indexedDB', new IDBFactory());
  resetNotesPersistenceForTests();
  setRecoveryModeActiveForTest(false);
  await initNotesPersistence('account-a');
  harness.health.mockResolvedValue({});
  harness.notes.mockResolvedValue(notesResetResult('completed', NOTES_RESET_STAGES));
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount()); host.remove();
  resetNotesPersistenceForTests(); setRecoveryModeActiveForTest(true); localStorage.clear();
  delete (globalThis as any).IS_REACT_ACT_ENVIRONMENT;
});

describe('Settings scoped reset completion', () => {
  it('does not continue into Notes after a newer Store intent during Health reset', async () => {
    const gate = deferred<unknown>(); harness.health.mockReturnValueOnce(gate.promise);
    await render(); await open(); await confirm();
    harness.current.mockReturnValue(false);
    await act(async () => gate.resolve({}));
    expect(harness.notes).not.toHaveBeenCalled();
    expect(toast).not.toHaveBeenCalledWith('notesResetCompleted');
    expect(daily).not.toHaveBeenCalled();
  });
  it('does not toast success or refresh projections while the durable Notes acknowledgement is pending', async () => {
    const gate = deferred<ReturnType<typeof notesResetResult>>();
    harness.notes.mockReturnValueOnce(gate.promise);
    await render(); await open(); await confirm();
    try {
      expect(harness.health).toHaveBeenCalledWith('account-a');
      expect(harness.notes).toHaveBeenCalledTimes(1);
      expect(toast).not.toHaveBeenCalled(); expect(daily).not.toHaveBeenCalled(); expect(fixed).not.toHaveBeenCalled();
      expect((host.querySelector('[data-settings-reset-action]') as HTMLButtonElement).disabled).toBe(true);
    } finally { await act(async () => gate.resolve(notesResetResult('completed', NOTES_RESET_STAGES))); }
    expect(toast).toHaveBeenCalledExactlyOnceWith('notesResetCompleted');
    expect(daily).toHaveBeenCalledTimes(1); expect(fixed).toHaveBeenCalledTimes(1);
  });

  it('does not invoke Notes reset when Health fails and reports unresolved stages', async () => {
    const context = captureNotesResetContext('account-a')!;
    harness.health.mockRejectedValueOnce(new Error('synthetic_health_failure'));
    const result = await performSettingsNotesReset(context, harness.health, harness.notes);
    expect(result.status).toBe('incomplete'); expect(result.completedStages).toEqual([]);
    expect(result.unresolvedStages).toContain('health_routines'); expect(harness.notes).not.toHaveBeenCalled();
  });

  it('retains observed Health and Notes stages on a partial result, without reporting rollback', async () => {
    harness.notes.mockResolvedValueOnce(notesResetResult('incomplete', ['local_metadata_clear', 'notes_clear'], 'welcome_note_unresolved'));
    const result = await performSettingsNotesReset(captureNotesResetContext('account-a'), harness.health, harness.notes);
    expect(result.status).toBe('incomplete');
    expect(result.completedStages).toEqual(['health_routines', 'local_metadata_clear', 'notes_clear']);
    expect(result.unresolvedStages).toContain('welcome_note');
  });

  it('rejects a nominal completed response that lacks the required durable evidence', async () => {
    harness.notes.mockResolvedValueOnce(notesResetResult('completed', ['notes_clear']));
    const result = await performSettingsNotesReset(captureNotesResetContext('account-a'), harness.health, harness.notes);
    expect(result.status).toBe('incomplete'); expect(result.unresolvedStages).toContain('readback');
  });

  it('rejects a delayed confirmation after A -> B -> A', async () => {
    await render(); await open();
    await initNotesPersistence('account-b'); await render('account-b');
    await initNotesPersistence('account-a'); await render('account-a');
    await confirm();
    expect(harness.health).not.toHaveBeenCalled(); expect(harness.notes).not.toHaveBeenCalled(); expect(toast).not.toHaveBeenCalled();
  });

  it('does not continue into Notes or publish success after switching accounts during Health reset', async () => {
    const gate = deferred<unknown>(); harness.health.mockReturnValueOnce(gate.promise);
    await render(); await open(); await confirm();
    try { await initNotesPersistence('account-b'); await render('account-b'); }
    finally { await act(async () => gate.resolve({})); }
    expect(harness.notes).not.toHaveBeenCalled(); expect(toast).not.toHaveBeenCalled(); expect(daily).not.toHaveBeenCalled();
  });

  it('rejects same-account new-generation authority and logout before execution', async () => {
    const original = captureNotesResetContext('account-a');
    await initNotesPersistence('account-a');
    expect((await performSettingsNotesReset(original, harness.health, harness.notes)).status).toBe('stale');
    expect((await performSettingsNotesReset(null, harness.health, harness.notes)).status).toBe('blocked');
    expect(harness.health).not.toHaveBeenCalled(); expect(harness.notes).not.toHaveBeenCalled();
  });

  it('does not publish a late successful Notes result after UI logout', async () => {
    const gate = deferred<ReturnType<typeof notesResetResult>>(); harness.notes.mockReturnValueOnce(gate.promise);
    await render(); await open(); await confirm();
    try { await render(null); }
    finally { await act(async () => gate.resolve(notesResetResult('completed', NOTES_RESET_STAGES))); }
    expect(toast).not.toHaveBeenCalled(); expect(daily).not.toHaveBeenCalled(); expect(fixed).not.toHaveBeenCalled();
  });

  it('preserves the recovery-mode denial before either owner is called', async () => {
    setRecoveryModeActiveForTest(true);
    const result = await performSettingsNotesReset(captureNotesResetContext('account-a'), harness.health, harness.notes);
    expect(result.status).toBe('blocked'); expect(harness.health).not.toHaveBeenCalled(); expect(harness.notes).not.toHaveBeenCalled();
  });
});
