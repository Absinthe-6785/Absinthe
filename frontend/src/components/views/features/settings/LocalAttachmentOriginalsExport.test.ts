// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useAppStore } from '../../../../store/useAppStore';
const mock = vi.hoisted(() => ({ create: vi.fn(), notes: [], report: { included: 1, excluded: 1, coverage: 'partial' } }));
vi.mock('../../../../store/useNotesStore', () => ({
  useNotesStore: (selector: (state: { notes: never[] }) => unknown) => selector({ notes: mock.notes }),
  observePublishedNotesHydration: () => ({ status: 'CURRENT', request: { accountId: 'A' } }),
}));
vi.mock('../../../../lib/localAttachmentOriginalsExport', () => ({
  createLocalOriginalsExport: mock.create,
  localOriginalsCoverageText: () => 'included image.png; excluded missing.png: missing blob. Not a complete backup.',
}));
import { LocalAttachmentOriginalsExport } from './LocalAttachmentOriginalsExport';
let root: Root, host: HTMLDivElement;
const owner = { preflight: vi.fn(), download: vi.fn(), cancel: vi.fn(), isCurrent: () => true };
beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  useAppStore.getState().updateSetting('language', 'en');
  vi.clearAllMocks(); mock.create.mockReturnValue(owner);
  owner.preflight.mockResolvedValue(mock.report); owner.download.mockResolvedValue(undefined);
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  act(() => root.render(React.createElement(LocalAttachmentOriginalsExport, { accountId: 'A' })));
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
async function click(label: string) {
  const button = [...host.querySelectorAll('button')].find(element => element.textContent === label)!;
  expect(button).toBeDefined(); await act(async () => button.click());
}
it('shows partial coverage and exclusions before a separate explicit subset download', async () => {
  await click('Check local originals');
  expect(host.textContent).toContain('Partial coverage'); expect(host.textContent).toContain('Included: 1. Excluded: 1.');
  expect(host.textContent).toContain('excluded missing.png'); expect(owner.download).not.toHaveBeenCalled();
  const button = [...host.querySelectorAll('button')].find(el => el.textContent === 'Download available subset only')!;
  expect(button.type).toBe('button'); button.focus(); expect(document.activeElement).toBe(button);
  await click('Download available subset only'); expect(owner.download).toHaveBeenCalledWith(true);
  expect(host.textContent).toContain('Download requested');
});
it('distinguishes full preflight coverage without claiming a full attachment backup', async () => {
  owner.preflight.mockResolvedValue({ ...mock.report, excluded: 0, coverage: 'complete_for_preflight' });
  await click('Check local originals'); expect(host.textContent).toContain('not a complete attachment backup');
  await click('Download originals ZIP'); expect(owner.download).toHaveBeenCalledWith(false);
});
it('does not offer a download for zero available files', async () => {
  owner.preflight.mockResolvedValue({ ...mock.report, included: 0 }); await click('Check local originals');
  const button = [...host.querySelectorAll('button')].find(el => el.textContent === 'Download available subset only')!;
  expect(button.disabled).toBe(true); expect(owner.download).not.toHaveBeenCalled();
});
it('cancels and hides pending results on account switch and unmount', async () => {
  let resolve!: (report: unknown) => void; owner.preflight.mockReturnValue(new Promise(yes => { resolve = yes; }));
  await click('Check local originals');
  await act(async () => root.render(React.createElement(LocalAttachmentOriginalsExport, { accountId: 'B' })));
  expect(owner.cancel).toHaveBeenCalled(); await act(async () => resolve(mock.report));
  expect(host.textContent).not.toContain('excluded missing.png'); expect(owner.download).not.toHaveBeenCalled();
});
it('reports failure without exposing raw errors or claiming success', async () => {
  owner.preflight.mockRejectedValue(new Error('private storage path'));
  await click('Check local originals'); expect(host.querySelector('[role="alert"]')).not.toBeNull();
  expect(host.textContent).not.toContain('private storage path'); expect(host.textContent).not.toContain('Download requested');
});
