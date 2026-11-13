// @vitest-environment happy-dom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { fetchSnapshot } = vi.hoisted(() => ({ fetchSnapshot: vi.fn() }));
vi.mock('../../lib/notesSyncClient', () => ({ fetchCompleteNotesFoldersSnapshot: fetchSnapshot }));
vi.mock('../../lib/i18n', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('../../store/useNotesStore', () => { throw new Error('read-only route must not import the local Notes store'); });

import { NotesReadOnlyCloudView } from './NotesReadOnlyCloudView';

type Owner = { accountId: string | null; generation: number };
let root: Root | null = null;
let host: HTMLDivElement | null = null;
let owner: Owner;

const note = (id: string, title: string, body = `body-${id}`, extra: Record<string, unknown> = {}) => ({
  id, user_id: 'account-a', title, body, updated_at: 10, folder_id: null, deleted_at: null, ...extra,
});

function mount(accountId = 'account-a', generation = 1) {
  root = createRoot(host!);
  const render = (nextAccountId = accountId, nextGeneration = generation) => act(() => root?.render(createElement(NotesReadOnlyCloudView, {
    accountId: nextAccountId,
    authGeneration: nextGeneration,
    getCurrentAuthOwner: () => owner,
  })));
  render();
  return { render };
}

async function click(selector: string) {
  const element = host?.querySelector<HTMLButtonElement>(selector);
  if (!element) throw new Error(`missing button ${selector}`);
  await act(async () => { element.click(); await Promise.resolve(); });
}

async function flush() {
  await act(async () => { await Promise.resolve(); await Promise.resolve(); });
}

beforeEach(() => {
  owner = { accountId: 'account-a', generation: 1 };
  fetchSnapshot.mockReset();
  host = document.createElement('div');
  document.body.appendChild(host);
});

afterEach(() => {
  if (root) act(() => root?.unmount());
  host?.remove();
  root = null;
  host = null;
});

describe('Notes pre-AppContent read-only cloud route', () => {
  it('fetches only after explicit action, then previews an exact eligible Note ID without local store access', async () => {
    fetchSnapshot.mockResolvedValue({ notes: [note('remote-id-1', 'Remote title', 'Remote body')], folders: [] });
    mount();
    expect(fetchSnapshot).not.toHaveBeenCalled();
    await click('button');
    await flush();
    expect(fetchSnapshot).toHaveBeenCalledTimes(1);
    expect(fetchSnapshot.mock.calls[0][0]).toBe('account-a');
    expect(fetchSnapshot.mock.calls[0][1].singlePageLimit).toBe(500);
    expect(fetchSnapshot.mock.calls[0][1].isCurrent()).toBe(true);
    expect(host?.textContent).toContain('remote-id-1');
    expect(host?.textContent).toContain('Remote title');
    expect(host?.textContent).not.toContain('Remote body');
    const preview = host?.querySelector<HTMLButtonElement>('li button');
    expect(preview?.getAttribute('aria-label')).toContain('remote-id-1');
    await act(async () => { preview?.click(); });
    expect(host?.querySelector('pre')?.textContent).toBe('Remote body');
  });

  it('keeps duplicate titles distinct by exact ID and searches title or a complete exact ID', async () => {
    fetchSnapshot.mockResolvedValue({ notes: [note('id-a', 'Same title'), note('id-b', 'Same title'), note('prefix-id-c-suffix', 'Other')], folders: [] });
    mount();
    await click('button');
    await flush();
    expect(host?.querySelectorAll('li')).toHaveLength(3);
    const input = host?.querySelector<HTMLInputElement>('input[type="search"]')!;
    await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set?.call(input, 'id-b'); input.dispatchEvent(new Event('input', { bubbles: true })); });
    expect(host?.querySelectorAll('li')).toHaveLength(1);
    expect(host?.querySelector('li code')?.textContent).toBe('id-b');
    expect(host?.querySelector('pre')).toBeNull();
    expect(fetchSnapshot).toHaveBeenCalledTimes(1);
  });

  it('excludes deleted, unsupported, and foreign-account rows from preview', async () => {
    fetchSnapshot.mockResolvedValue({ notes: [
      note('active', 'Active'),
      note('deleted', 'Deleted', 'hidden', { deleted_at: 11 }),
      note('unsupported', 'Unsupported', 'hidden', { properties: { invalid: ['array'] } }),
      { ...note('foreign', 'Foreign'), user_id: 'account-b' },
    ], folders: [] });
    mount();
    await click('button');
    await flush();
    expect(host?.textContent).toContain('active');
    expect(host?.textContent).not.toContain('deleted');
    expect(host?.textContent).not.toContain('unsupported');
    expect(host?.textContent).not.toContain('foreign');
  });

  it('distinguishes a complete empty snapshot from unavailable and ineligible snapshots', async () => {
    fetchSnapshot
      .mockResolvedValueOnce({ notes: [], folders: [] })
      .mockResolvedValueOnce({ notes: [note('deleted', 'Deleted', 'x', { deleted_at: 11 })], folders: [] })
      .mockRejectedValueOnce(new Error('incomplete snapshot'));
    mount();
    await click('button');
    await flush();
    expect(host?.textContent).toContain('notesCloudReadOnlyEmpty');
    await click('button');
    await flush();
    expect(host?.textContent).toContain('notesCloudReadOnlyNoEligible');
    await click('button');
    await flush();
    expect(host?.textContent).toContain('notesCloudUnavailable');
    expect(host?.textContent).not.toContain('notesCloudReadOnlyEmpty');
  });

  it('discards an in-flight snapshot across A-B-A session generations', async () => {
    let resolve!: (value: unknown) => void;
    fetchSnapshot.mockReturnValueOnce(new Promise(value => { resolve = value; }));
    const view = mount();
    await click('button');
    owner = { accountId: 'account-b', generation: 2 };
    view.render('account-b', 2);
    owner = { accountId: 'account-a', generation: 3 };
    view.render('account-a', 3);
    resolve({ notes: [note('stale-a', 'Stale account A', 'must not appear')], folders: [] });
    await flush();
    expect(host?.textContent).not.toContain('stale-a');
    expect(host?.textContent).not.toContain('must not appear');
    expect(host?.querySelector('pre')).toBeNull();
  });

  it('clears an in-flight response on unmount and bounds inert preview text', async () => {
    let resolve!: (value: unknown) => void;
    const long = 'x'.repeat(12_001);
    fetchSnapshot.mockResolvedValueOnce({ notes: [note('large', 'Large', long)], folders: [] });
    mount();
    await click('button');
    await flush();
    await click('li button');
    expect(host?.querySelector('pre')?.textContent).toHaveLength(12_000);
    expect(host?.textContent).toContain('notesCloudPreviewPartial');
    fetchSnapshot.mockReturnValueOnce(new Promise(value => { resolve = value; }));
    await click('button');
    act(() => root?.unmount());
    root = null;
    resolve({ notes: [note('late', 'Late'),], folders: [] });
    await flush();
    expect(host?.textContent).not.toContain('Late');
  });

  it('uses a compact, scroll-bounded list suitable for narrow viewports', async () => {
    fetchSnapshot.mockResolvedValue({ notes: Array.from({ length: 40 }, (_, index) => note(`id-${index}`, `Note ${index}`)), folders: [] });
    mount();
    await click('button');
    await flush();
    expect(host?.querySelector('main')?.className).toContain('w-full');
    expect(host?.querySelector('ul')?.className).toContain('max-h-80');
    expect(host?.querySelectorAll('li')).toHaveLength(30);
    expect(host?.textContent).toContain('notesCloudShowMore');
  });
});
