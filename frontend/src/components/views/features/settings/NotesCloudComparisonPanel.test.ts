// @vitest-environment happy-dom
import React, { act, useSyncExternalStore } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useAppStore } from '../../../../store/useAppStore';
import { NotesBootstrapDiagnosticError } from '../../../../lib/notesBootstrapDiagnostics';
const mock = vi.hoisted(() => ({ create: vi.fn(), state: { notes: [], folders: [], revision: 0 }, listeners: new Set<() => void>(), available: true }));
vi.mock('../../../../store/useNotesStore', () => ({
  useNotesStore: (select: any) => useSyncExternalStore(listener => { mock.listeners.add(listener); return () => { mock.listeners.delete(listener); }; }, () => select(mock.state)),
  observePublishedNotesHydration: () => mock.available ? { status: 'CURRENT', request: { accountId: 'A' } } : { status: 'UNAVAILABLE' },
}));
vi.mock('../../../../lib/notesCloudComparison', () => ({ createNotesCloudComparison: mock.create }));
import { NotesCloudComparisonPanel } from './NotesCloudComparisonPanel';
let root: Root, host: HTMLDivElement;
const report = { localOnly: 2, remoteOnly: 1, matching: 3, divergent: 4, incomparable: 1, deleted: 2, localFoldersOnly: 1, remoteFoldersOnly: 0, folderDifferences: 2, unresolvedFolders: 1 };
let live = true;
const owner = { compare: vi.fn(), cancel: vi.fn(() => { live = false; }), isCurrent: () => live };
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true; useAppStore.getState().updateSetting('language', 'en');
  vi.clearAllMocks(); live = true; mock.available = true; mock.create.mockReturnValue(owner); owner.compare.mockResolvedValue(report);
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.restoreAllMocks(); });
async function render(account: string | null = 'A') { await act(async () => root.render(React.createElement(NotesCloudComparisonPanel, { accountId: account }))); }
async function check() { await act(async () => host.querySelector('button')!.click()); }
it('does no automatic fetch, exposes an accessible manual action and counts without private data', async () => {
  await render(); expect(mock.create).not.toHaveBeenCalled(); host.querySelector('button')!.focus(); expect(document.activeElement).toBe(host.querySelector('button'));
  await check(); expect(owner.compare).toHaveBeenCalledTimes(1); expect(host.textContent).toContain('Local-only active IDs'); expect(host.textContent).toContain('not an atomic');
  expect([...host.querySelectorAll('dd')].map(el => el.textContent)).toEqual(['2', '1', '3', '4', '1', '2']);
  expect(host.textContent).not.toContain('account-A'); expect(host.textContent).toContain('NOT enable cloud synchronization');
});
it.each(['en', 'ko', 'ja'] as const)('localizes comparison and unavailable states in %s', async language => {
  useAppStore.getState().updateSetting('language', language); await render();
  expect(host.textContent).toMatch(/read-only|읽기 전용|読み取り専用/); await check(); expect(host.querySelectorAll('dd')).toHaveLength(6);
  owner.compare.mockRejectedValue(new Error('private-id-token')); await check();
  expect(host.querySelector('[role="alert"]')).not.toBeNull(); expect(host.textContent).not.toContain('private-id-token'); expect(host.querySelectorAll('dd')).toHaveLength(0);
});
it('distinguishes authentication and source unavailability without empty counts', async () => {
  await render(null); expect(host.textContent).toContain('Sign in'); expect(host.querySelector('button')!.disabled).toBe(true);
  mock.available = false; await render(); expect(host.textContent).toContain('unproven'); expect(host.querySelectorAll('dd')).toHaveLength(0);
});
it('reports offline and incomplete sources instead of empty cloud data', async () => {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false); await render(); await check(); expect(mock.create).not.toHaveBeenCalled(); expect(host.textContent).toContain('Offline');
  vi.restoreAllMocks(); owner.compare.mockRejectedValue(new NotesBootstrapDiagnosticError('VALIDATE_NOTES_SNAPSHOT', 'SNAPSHOT_INCOMPLETE'));
  await check(); expect(host.textContent).toContain('incomplete'); expect(host.querySelectorAll('dd')).toHaveLength(0);
});
it('discards pending results after account A/B/A, local state replacement and unmount', async () => {
  let resolve!: (value: typeof report) => void; owner.compare.mockReturnValue(new Promise(yes => { resolve = yes; }));
  await render(); await check(); await render('B'); await render('A'); resolve(report); await act(async () => {});
  expect(owner.cancel).toHaveBeenCalled(); expect(host.querySelectorAll('dd')).toHaveLength(0);
});
it('removes counts immediately on publication-only revocation with unchanged arrays', async () => {
  await render(); await check(); expect(host.querySelectorAll('dd')).toHaveLength(6);
  await act(async () => {
    live = false; mock.available = false; mock.state = { ...mock.state, revision: mock.state.revision + 1 };
    mock.listeners.forEach(listener => listener());
  });
  expect(host.querySelectorAll('dd')).toHaveLength(0); expect(owner.cancel).toHaveBeenCalled();
  expect(host.querySelector('button')!.disabled).toBe(true);
});
