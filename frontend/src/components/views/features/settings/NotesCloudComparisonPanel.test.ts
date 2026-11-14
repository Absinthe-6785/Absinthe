// @vitest-environment happy-dom
import React, { act, useSyncExternalStore } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useAppStore } from '../../../../store/useAppStore';
import { NotesBootstrapDiagnosticError } from '../../../../lib/notesBootstrapDiagnostics';
import { getNoteReturnTab, registerAppTabSwitcher, registerNotesTabSwitcher, returnFromNote, setNoteReturnTab } from '../../../../lib/noteNavigation';
import { getNoteNavigationStack, pushNoteNavigation, resetNoteNavigationStack } from '../../../../lib/noteNavigationStack';
const mock = vi.hoisted(() => ({
  create: vi.fn(),
  getRemoteOnlyNote: vi.fn(),
  getDivergentNotePair: vi.fn(),
  searchCloudNotes: vi.fn(),
  subscribeInvalidation: vi.fn(),
  invalidationListeners: new Set<() => void>(),
  authorityListeners: new Set<(request: object | null) => void>(),
  prepareCloudCopy: vi.fn(), createCloudCopy: vi.fn(), readCloudCopyStatus: vi.fn(), cloudCopyEnabled: false,
  preflightLaptop: vi.fn(), requestLaptop: vi.fn(), laptopEnabled: false, initialEnabled: false,
  state: { notes: [] as any[], folders: [] as any[], revision: 0, activeAccountId: 'A' as string | null, activeNoteId: null as string | null, setActiveNoteId: vi.fn() },
  listeners: new Set<() => void>(), available: true, activeRequest: { accountId: 'A' },
  setActiveNoteId: vi.fn(), notesTabSwitch: vi.fn(), appTabSwitch: vi.fn(),
}));
vi.mock('../../../../store/useNotesStore', () => ({
  useNotesStore: Object.assign(
    (select: any) => useSyncExternalStore(listener => { mock.listeners.add(listener); return () => { mock.listeners.delete(listener); }; }, () => select(mock.state), () => select(mock.state)),
    { getState: () => mock.state },
  ),
  observePublishedNotesHydration: () => mock.available ? { status: 'CURRENT', request: mock.activeRequest } : { status: 'UNAVAILABLE' },
}));
vi.mock('../../../../lib/notesCloudComparison', () => ({
  createNotesCloudComparison: mock.create,
  NOTES_CLOUD_SEARCH_QUERY_LIMIT: 120,
  NOTES_COMPARISON_LIMIT: 500,
}));
vi.mock('../../../../lib/notesCloudCopy', () => ({
  prepareNotesCloudCopy: mock.prepareCloudCopy,
  createNotesCloudCopy: mock.createCloudCopy,
  readNotesCloudCopyStatus: mock.readCloudCopyStatus,
  notesCloudCopyUiEnabled: () => mock.cloudCopyEnabled,
}));
vi.mock('../../../../lib/notesCloudCopyLocalPreflight', () => ({
  preflightLocalNoteForCloudCopy: mock.preflightLaptop,
}));
vi.mock('../../../../lib/notesLaptopPublication', async importOriginal => ({
  ...await importOriginal<typeof import('../../../../lib/notesLaptopPublication')>(),
  notesLaptopPublicationUiEnabled: () => mock.laptopEnabled,
  notesInitialPublicationUiEnabled: () => mock.initialEnabled,
  requestLaptopPublication: mock.requestLaptop,
  requestInitialLaptopPublication: mock.requestLaptop,
}));
vi.mock('../../../../lib/notesAccountAuthority', async importOriginal => ({
  ...await importOriginal<typeof import('../../../../lib/notesAccountAuthority')>(),
  subscribeNotesAuthorityRequestChange: (listener: (request: object | null) => void) => {
    mock.authorityListeners.add(listener); return () => { mock.authorityListeners.delete(listener); };
  },
}));
import { NotesCloudComparisonPanel } from './NotesCloudComparisonPanel';
let root: Root, host: HTMLDivElement;
let originalCreateObjectURL: PropertyDescriptor | undefined;
let originalRevokeObjectURL: PropertyDescriptor | undefined;
let originalAnchorClick: PropertyDescriptor | undefined;
let createdCloudTextFiles: Blob[];
let revokedObjectUrls: string[];
let requestedDownloads: Array<{ filename: string; href: string }>;
let createObjectUrl: ReturnType<typeof vi.fn>;
let rootMounted = true;
const report = {
  localOnly: 2, remoteOnly: 1, matching: 3, divergent: 4, incomparable: 1, deleted: 2,
  localFoldersOnly: 1, remoteFoldersOnly: 0, folderDifferences: 2, unresolvedFolders: 1,
  details: {
    localOnly: [{ id: 'local-id', localTitle: 'Local title' }, { id: 'local-id-2' }],
    remoteOnly: [{ id: 'cloud-id', remoteTitle: 'Cloud title' }],
    divergent: [{ id: 'different-id', localTitle: 'Local version', remoteTitle: 'Cloud version' }],
    incomparable: [{ id: 'unknown-id' }], deleted: [{ id: 'deleted-id', localTitle: 'Deleted local' }],
  },
};
let live = true;
const owner = { compare: vi.fn(), getRemoteOnlyNote: mock.getRemoteOnlyNote, getDivergentNotePair: mock.getDivergentNotePair, searchCloudNotes: mock.searchCloudNotes, subscribeInvalidation: mock.subscribeInvalidation, cancel: vi.fn(() => { live = false; mock.invalidationListeners.clear(); }), isCurrent: () => live };
const localNote = (id: string, title: string, overrides: Record<string, unknown> = {}) => ({
  id, title, body: 'Local body', folderId: null, updatedAt: 10, deletedAt: null, ...overrides,
});
let unregisterNotesTab: () => void, unregisterAppTab: () => void;
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true; useAppStore.getState().updateSetting('language', 'en');
  originalCreateObjectURL = Object.getOwnPropertyDescriptor(URL, 'createObjectURL');
  originalRevokeObjectURL = Object.getOwnPropertyDescriptor(URL, 'revokeObjectURL');
  originalAnchorClick = Object.getOwnPropertyDescriptor(HTMLAnchorElement.prototype, 'click');
  createdCloudTextFiles = []; revokedObjectUrls = []; requestedDownloads = [];
  createObjectUrl = vi.fn((file: Blob) => { createdCloudTextFiles.push(file); return `blob:cloud-text-${createdCloudTextFiles.length}`; });
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectUrl });
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn((url: string) => { revokedObjectUrls.push(url); }) });
  Object.defineProperty(HTMLAnchorElement.prototype, 'click', { configurable: true, value: function(this: HTMLAnchorElement) {
    requestedDownloads.push({ filename: this.download, href: this.href });
  } });
  vi.clearAllMocks(); live = true; mock.available = true; mock.activeRequest = { accountId: 'A' }; mock.invalidationListeners.clear();
  mock.cloudCopyEnabled = false;
  mock.laptopEnabled = false;
  mock.initialEnabled = false;
  mock.authorityListeners.clear();
  mock.prepareCloudCopy.mockResolvedValue({
    status: 'ELIGIBLE_PREVIEW_ONLY', authority: 'NONE', localNoteId: 'local-id',
    snapshot: { title: 'Local title', body: 'Local body', updated_at: 10, starred: false },
    sourceRevision: { authorityGeneration: 1, vaultStructureVersion: 1, indexContentVersion: 1,
      noteUpdatedAt: 10, durableReadback: 'MATCHED', attachmentMetadata: 'COMPLETE_EMPTY' },
    isCurrentInMemory: () => true, isCurrent: async () => true,
  });
  mock.createCloudCopy.mockResolvedValue({ status: 'CREATED', cloudNoteId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' });
  mock.readCloudCopyStatus.mockResolvedValue({ status: 'LIVE' });
  mock.preflightLaptop.mockImplementation(async () => mock.prepareCloudCopy());
  mock.requestLaptop.mockImplementation(async (_mode, _payload, _account, _preview, current, dispatch) =>
    current() && dispatch() ? 'VERIFIED' : 'STALE_RESULT');
  mock.state = {
    notes: [
      localNote('local-id', 'Local title'), localNote('local-id-2', 'Second local'),
      localNote('different-id', 'Duplicate title'), localNote('deleted-id', 'Deleted local', { deletedAt: 5 }),
    ], folders: [], revision: 0, activeAccountId: 'A', activeNoteId: null, setActiveNoteId: mock.setActiveNoteId,
  };
  mock.setActiveNoteId.mockImplementation((id: string) => {
    mock.state = { ...mock.state, activeNoteId: id };
    mock.listeners.forEach(listener => listener());
  });
  mock.create.mockImplementation((accountId: string, isAccountCurrent: () => boolean) => {
    live = true;
    const request = mock.activeRequest, notes = mock.state.notes, notesIdentity = JSON.stringify(notes), folders = mock.state.folders;
    return {
      compare: owner.compare, cancel: owner.cancel,
      getRemoteOnlyNote: owner.getRemoteOnlyNote,
      getDivergentNotePair: owner.getDivergentNotePair,
      searchCloudNotes: owner.searchCloudNotes,
      subscribeInvalidation: owner.subscribeInvalidation,
      isCurrent: () => live && mock.available && isAccountCurrent() && mock.activeRequest === request
        && mock.state.activeAccountId === accountId && mock.state.notes === notes && JSON.stringify(mock.state.notes) === notesIdentity
        && mock.state.folders === folders,
    };
  });
  owner.compare.mockResolvedValue(report); owner.cancel.mockImplementation(() => { live = false; mock.invalidationListeners.clear(); });
  owner.subscribeInvalidation.mockImplementation((listener: () => void) => {
    mock.invalidationListeners.add(listener); return () => mock.invalidationListeners.delete(listener);
  });
  owner.getRemoteOnlyNote.mockImplementation((id: string) => live && id === 'cloud-id'
    ? { id, title: 'Cloud title', body: 'Cloud body\n<script>window.bad=true</script>\nattachment://remote-original' } : null);
  owner.getDivergentNotePair.mockImplementation((id: string) => live && id === 'different-id'
    ? {
      id,
      local: { title: 'Local version', body: 'Local body <script>bad()</script>' },
      cloud: { title: 'Cloud version', body: 'Cloud body' },
      differingFields: ['title', 'body'],
    } : null);
  owner.searchCloudNotes.mockImplementation((query: string) => {
    const normalized = query.normalize('NFKC').toLowerCase().trim();
    const remoteOnly = !normalized || 'cloud title cloud body'.includes(normalized) ? ['cloud-id'] : [];
    const divergent = !normalized || 'cloud version cloud body'.includes(normalized) ? ['different-id'] : [];
    return { remoteOnly, divergent, total: 2 };
  });
  resetNoteNavigationStack(); sessionStorage.removeItem('absinthe.noteNav.returnTab');
  unregisterNotesTab = registerNotesTabSwitcher(mock.notesTabSwitch);
  unregisterAppTab = registerAppTabSwitcher(mock.appTabSwitch);
  host = document.createElement('div'); document.body.append(host); root = createRoot(host); rootMounted = true;
});
afterEach(async () => {
  if (rootMounted) await act(async () => root.unmount());
  host.remove(); unregisterNotesTab(); unregisterAppTab();
  resetNoteNavigationStack(); sessionStorage.removeItem('absinthe.noteNav.returnTab'); vi.restoreAllMocks();
  if (originalCreateObjectURL) Object.defineProperty(URL, 'createObjectURL', originalCreateObjectURL); else Reflect.deleteProperty(URL, 'createObjectURL');
  if (originalRevokeObjectURL) Object.defineProperty(URL, 'revokeObjectURL', originalRevokeObjectURL); else Reflect.deleteProperty(URL, 'revokeObjectURL');
  if (originalAnchorClick) Object.defineProperty(HTMLAnchorElement.prototype, 'click', originalAnchorClick); else Reflect.deleteProperty(HTMLAnchorElement.prototype, 'click');
});
async function render(account: string | null = 'A') { await act(async () => root.render(React.createElement(NotesCloudComparisonPanel, { accountId: account }))); }
async function check() { await act(async () => host.querySelector('button')!.click()); }
async function setComparisonSearch(value: string) {
  await act(async () => {
    const input = host.querySelector<HTMLInputElement>('#notes-cloud-comparison-search')!;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    setter?.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}
async function openRemoteOnlyPreview() {
  await render(); await check();
  const section = host.querySelectorAll('details')[1]!;
  section.querySelector('summary')!.click();
  const action = [...section.querySelectorAll('button')].find(item => item.textContent === 'Preview cloud Note')!;
  await act(async () => { action.click(); });
}
async function openDivergentPreview() {
  await render(); await check();
  const section = host.querySelectorAll('details')[2]!;
  section.querySelector('summary')!.click();
  const action = [...section.querySelectorAll('button')].find(item => item.textContent === 'Compare local and cloud versions')!;
  await act(async () => { action.click(); });
}
it('does no automatic fetch, exposes an accessible manual action and counts without private data', async () => {
  await render(); expect(mock.create).not.toHaveBeenCalled(); expect(mock.readCloudCopyStatus).not.toHaveBeenCalled(); host.querySelector('button')!.focus(); expect(document.activeElement).toBe(host.querySelector('button'));
  await check(); expect(owner.compare).toHaveBeenCalledTimes(1); expect(host.textContent).toContain('Local-only active IDs'); expect(host.textContent).toContain('not an atomic');
  expect([...host.querySelectorAll('dd')].map(el => el.textContent)).toEqual(['2', '1', '3', '4', '1', '2']);
  const sections = [...host.querySelectorAll('details')]; expect(sections).toHaveLength(5); expect(sections.every(section => !section.open)).toBe(true);
  const localSummary = sections[0].querySelector('summary')!; localSummary.focus(); expect(document.activeElement).toBe(localSummary);
  localSummary.click(); expect(sections[0].open).toBe(true); expect(sections[0].textContent).toContain('local-id'); expect(sections[0].textContent).toContain('Local title');
  expect(sections[1].textContent).toContain('Cloud title'); expect(sections[2].textContent).toContain('Local version'); expect(sections[2].textContent).toContain('Cloud version');
  expect([...host.querySelectorAll('button')].filter(button => button.textContent === 'Open note')).toHaveLength(3);
  for (const deniedId of ['unknown-id', 'deleted-id']) {
    const row = [...host.querySelectorAll('li')].find(item => item.querySelector('code')?.textContent === deniedId)!;
    expect(row.querySelector('button')).toBeNull();
  }
  const eligibleCloudRow = [...host.querySelectorAll('li')].find(item => item.querySelector('code')?.textContent === 'cloud-id')!;
  expect(eligibleCloudRow.querySelector('button')?.textContent).toBe('Preview cloud Note');
  expect(host.textContent).not.toContain('account-A'); expect(host.textContent).toContain('NOT enable cloud synchronization');
});

it('searches the current cloud-only and divergent snapshot while preserving totals and exact-ID actions', async () => {
  const notesBefore = JSON.stringify(mock.state.notes);
  const storageBefore = JSON.stringify(Object.fromEntries(Object.keys(localStorage).map(key => [key, localStorage.getItem(key)])));
  await render(); await check();
  expect(mock.create).toHaveBeenCalledTimes(1);
  expect(owner.compare).toHaveBeenCalledTimes(1);
  const input = host.querySelector<HTMLInputElement>('#notes-cloud-comparison-search')!;
  expect(input.type).toBe('search'); expect(input.maxLength).toBe(120);
  expect(host.querySelector('label[for="notes-cloud-comparison-search"]')?.textContent).toBe('Search cloud-only and divergent Notes');

  await setComparisonSearch('ＣＬＯＵＤ ＢＯＤＹ');
  expect(host.textContent).toContain('2 matches among 2 searchable cloud-only and divergent Notes');
  expect(host.textContent).toContain('comparison totals above are unchanged');
  expect([...host.querySelectorAll('dd')].map(el => el.textContent)).toEqual(['2', '1', '3', '4', '1', '2']);
  const ids = [...host.querySelectorAll('li code')].map(node => node.textContent);
  expect(ids).toEqual(['cloud-id', 'different-id']);
  expect(host.textContent).not.toContain('local-id');

  const cloudOnlyRow = [...host.querySelectorAll('li')].find(item => item.querySelector('code')?.textContent === 'cloud-id')!;
  await act(async () => { [...cloudOnlyRow.querySelectorAll('button')].find(button => button.textContent === 'Preview cloud Note')!.click(); });
  expect(mock.getRemoteOnlyNote).toHaveBeenCalledWith('cloud-id');
  const cloudPreview = host.querySelector<HTMLElement>('[data-remote-note-preview]')!;
  expect(cloudPreview.querySelector('pre')?.textContent).toContain('Cloud body');
  expect(cloudPreview.querySelector('script')).toBeNull();
  await act(async () => { [...cloudPreview.querySelectorAll('button')].find(button => button.textContent === 'Download cloud text')!.click(); });
  expect(createdCloudTextFiles).toHaveLength(1);
  await act(async () => { [...cloudPreview.querySelectorAll('button')].find(button => button.textContent === 'Cancel')!.click(); });

  const divergentRow = [...host.querySelectorAll('li')].find(item => item.querySelector('code')?.textContent === 'different-id')!;
  await act(async () => { [...divergentRow.querySelectorAll('button')].find(button => button.textContent === 'Compare local and cloud versions')!.click(); });
  expect(mock.getDivergentNotePair).toHaveBeenCalledWith('different-id');
  const divergentPreview = host.querySelector<HTMLElement>('[data-divergent-note-preview]')!;
  expect(divergentPreview.querySelectorAll('article')).toHaveLength(2);
  await act(async () => { [...divergentPreview.querySelectorAll('button')].find(button => button.textContent === 'Download cloud text')!.click(); });
  expect(createdCloudTextFiles).toHaveLength(2);

  await setComparisonSearch('no such cloud text');
  expect(host.textContent).toContain('No cloud-only or divergent Note matches');
  expect(host.textContent).toContain('this does not mean the cloud is empty');
  expect(host.querySelectorAll('li code')).toHaveLength(0);
  expect([...host.querySelectorAll('dd')].map(el => el.textContent)).toEqual(['2', '1', '3', '4', '1', '2']);
  expect(mock.create).toHaveBeenCalledTimes(1);
  expect(owner.compare).toHaveBeenCalledTimes(1);
  expect(mock.createCloudCopy).not.toHaveBeenCalled();
  expect(mock.state.activeNoteId).toBeNull();
  expect(JSON.stringify(mock.state.notes)).toBe(notesBefore);
  expect(JSON.stringify(Object.fromEntries(Object.keys(localStorage).map(key => [key, localStorage.getItem(key)])))).toBe(storageBefore);
});

it('bounds matching-result rendering and reveals additional matches only on request', async () => {
  const remoteOnly = Array.from({ length: 45 }, (_, index) => ({ id: `cloud-${index}`, remoteTitle: `Cloud ${index}` }));
  owner.compare.mockResolvedValue({ ...report, remoteOnly: 45, details: { ...report.details, remoteOnly } });
  owner.searchCloudNotes.mockReturnValue({ remoteOnly: remoteOnly.map(({ id }) => id), divergent: [], total: 45 });
  await render(); await check(); await setComparisonSearch('cloud');
  expect(host.querySelectorAll('li')).toHaveLength(30);
  expect(host.textContent).toContain('45 matches among 45 searchable cloud-only and divergent Notes');
  const more = [...host.querySelectorAll('button')].find(button => button.textContent === 'Show 15 more notes')!;
  await act(async () => { more.click(); });
  expect(host.querySelectorAll('li')).toHaveLength(45);
});

it('localizes the search control for English, Korean, and Japanese', async () => {
  for (const [language, label] of [
    ['en', 'Search cloud-only and divergent Notes'],
    ['ko', '클라우드 전용·차이 있는 노트 검색'],
    ['ja', 'クラウドのみ・差異のあるノートを検索'],
  ] as const) {
    useAppStore.getState().updateSetting('language', language);
    await render(); await check();
    expect(host.querySelector('label[for="notes-cloud-comparison-search"]')?.textContent).toBe(label);
  }
});

it('discards an active search on account A/B/A, cancellation, and authority invalidation', async () => {
  await render(); await check(); await setComparisonSearch('cloud body');
  expect(host.querySelectorAll('li code')).toHaveLength(2);

  await render('B'); await render('A');
  expect(host.querySelector('#notes-cloud-comparison-search')).toBeNull();
  expect(host.textContent).not.toContain('cloud-id');
  expect(owner.cancel).toHaveBeenCalled();

  await check(); await setComparisonSearch('cloud body');
  await check();
  expect(host.querySelector<HTMLInputElement>('#notes-cloud-comparison-search')?.value).toBe('');
  await setComparisonSearch('cloud body');
  await act(async () => { [...host.querySelectorAll('button')].find(button => button.textContent === 'Cancel')!.click(); });
  expect(host.querySelector('#notes-cloud-comparison-search')).toBeNull();

  await check(); await setComparisonSearch('cloud body');
  mock.activeRequest = { accountId: 'A' };
  await act(async () => { for (const listener of [...mock.invalidationListeners]) listener(); });
  expect(host.querySelector('#notes-cloud-comparison-search')).toBeNull();
  expect(host.textContent).not.toContain('different-id');
});

it('clears search immediately when the current local Notes publication changes', async () => {
  await render(); await check(); await setComparisonSearch('cloud body');
  expect(host.querySelectorAll('li code')).toHaveLength(2);
  await act(async () => {
    mock.state = { ...mock.state, notes: [...mock.state.notes] };
    mock.listeners.forEach(listener => listener());
  });
  expect(host.querySelector('#notes-cloud-comparison-search')).toBeNull();
  expect(host.textContent).not.toContain('cloud-id');
  expect(owner.cancel).toHaveBeenCalled();
});

it('cancels the owner and discards the search on unmount', async () => {
  await render(); await check(); await setComparisonSearch('cloud body');
  expect(host.querySelectorAll('li code')).toHaveLength(2);
  await act(async () => root.unmount());
  rootMounted = false;
  expect(host.querySelector('#notes-cloud-comparison-search')).toBeNull();
  expect(host.textContent).not.toContain('cloud-id');
  expect(owner.cancel).toHaveBeenCalled();
});

it('previews one exact cloud-only ID as inert text without creating or changing a local Note', async () => {
  mock.state.notes = [...mock.state.notes, localNote('duplicate-title-local-id', 'Cloud title')];
  const before = JSON.stringify(mock.state.notes);
  await render(); await check();
  const remoteSection = host.querySelectorAll('details')[1]!;
  remoteSection.querySelector('summary')!.click();
  const row = [...remoteSection.querySelectorAll('li')].find(item => item.querySelector('code')?.textContent === 'cloud-id')!;
  const button = [...row.querySelectorAll('button')].find(item => item.textContent === 'Preview cloud Note')!;
  button.focus(); expect(document.activeElement).toBe(button);
  expect(host.querySelector('[data-remote-note-preview]')).toBeNull();
  await act(async () => { button.click(); });

  const preview = host.querySelector<HTMLElement>('[data-remote-note-preview]')!;
  expect(owner.getRemoteOnlyNote).toHaveBeenCalledExactlyOnceWith('cloud-id');
  expect(preview.textContent).toContain('Cloud-only Note preview');
  expect(preview.textContent).toContain('This content is not a local Note and has not been imported.');
  expect(preview.textContent).toContain('Attachment originals are not included in this preview.');
  expect(preview.querySelector('script')).toBeNull();
  expect(preview.querySelector('pre')?.textContent).toContain('<script>window.bad=true</script>');
  expect(preview.querySelector('pre')?.textContent).toContain('attachment://remote-original');
  expect(mock.state.notes.some((note: any) => note.id === 'cloud-id')).toBe(false);
  expect(JSON.stringify(mock.state.notes)).toBe(before);
  expect(mock.state.activeNoteId).toBeNull();
  expect(getNoteNavigationStack()).toEqual([]);
  expect(mock.createCloudCopy).not.toHaveBeenCalled();
  expect(mock.prepareCloudCopy).not.toHaveBeenCalled();
  expect(mock.readCloudCopyStatus).not.toHaveBeenCalled();
  expect(owner.compare).toHaveBeenCalledTimes(1);
  expect(host.textContent).toContain('not an atomic');
});

it('downloads the full cloud-only body, not the truncated preview, without importing or mutating Notes', async () => {
  const body = `# 雲 ☁️\r\n\r\n${'café 🧪\n'.repeat(2_000)}  `;
  mock.state.notes = [...mock.state.notes, localNote('duplicate-cloud-title', 'Cloud title')];
  mock.getRemoteOnlyNote.mockImplementation((id: string) => id === 'cloud-id' ? { id, title: 'Cloud title', body } : null);
  const before = JSON.stringify(mock.state.notes);
  await openRemoteOnlyPreview();
  const preview = host.querySelector<HTMLElement>('[data-remote-note-preview]')!;
  const previewText = preview.querySelector('pre')?.textContent ?? '';
  expect(previewText.length).toBeLessThanOrEqual(12_000);
  expect(previewText).not.toMatch(/[\uD800-\uDBFF]$/u);
  expect(preview.textContent).toContain('not a synchronized local Note');
  const download = [...preview.querySelectorAll('button')].find(button => button.textContent === 'Download cloud text')!;
  download.focus(); expect(document.activeElement).toBe(download);
  mock.getRemoteOnlyNote.mockClear();
  await act(async () => { download.click(); });

  expect(mock.getRemoteOnlyNote.mock.calls.map(([id]) => id)).toEqual(['cloud-id', 'cloud-id']);
  expect(createdCloudTextFiles).toHaveLength(1);
  expect(new Uint8Array(await createdCloudTextFiles[0]!.arrayBuffer())).toEqual(new TextEncoder().encode(body));
  expect(requestedDownloads).toHaveLength(1);
  expect(requestedDownloads[0]!.filename).toContain('Cloud title-0063006c006f00750064002d00690064.md');
  expect(requestedDownloads[0]!.href).toBe('blob:cloud-text-1');
  expect(host.textContent).toContain('A Markdown download was requested. Check your browser downloads; this is not a durable backup.');
  expect(JSON.stringify(mock.state.notes)).toBe(before);
  expect(mock.state.activeNoteId).toBeNull(); expect(mock.setActiveNoteId).not.toHaveBeenCalled();
  expect(getNoteNavigationStack()).toEqual([]); expect(getNoteReturnTab()).toBeNull();
  expect(mock.createCloudCopy).not.toHaveBeenCalled(); expect(mock.prepareCloudCopy).not.toHaveBeenCalled();
  expect(mock.readCloudCopyStatus).not.toHaveBeenCalled(); expect(owner.compare).toHaveBeenCalledTimes(1);

  const close = [...preview.querySelectorAll('button')].find(button => button.textContent === 'Cancel')!;
  await act(async () => { close.click(); });
  expect(revokedObjectUrls).toEqual(['blob:cloud-text-1']);
});

it('downloads only the cloud side of an exact-ID divergent pair', async () => {
  const cloudBody = `Cloud Ω\n${'remote text 🧭\n'.repeat(1_200)}`;
  mock.getDivergentNotePair.mockImplementation((id: string) => id === 'different-id' ? {
    id,
    local: { title: 'Local version', body: 'LOCAL SOURCE MUST NOT BE EXPORTED' },
    cloud: { title: 'Cloud version', body: cloudBody },
    differingFields: ['body'],
  } : null);
  await openDivergentPreview();
  const preview = host.querySelector<HTMLElement>('[data-divergent-note-preview]')!;
  expect(preview.querySelectorAll('article')[1]?.querySelector('pre')?.textContent).toHaveLength(12_000);
  const download = [...preview.querySelectorAll('button')].find(button => button.textContent === 'Download cloud text')!;
  mock.getDivergentNotePair.mockClear();
  await act(async () => { download.click(); });

  expect(createdCloudTextFiles).toHaveLength(1);
  expect(requestedDownloads).toHaveLength(1);
  expect(mock.getDivergentNotePair.mock.calls.map(([id]) => id)).toEqual(['different-id', 'different-id']);
  expect(await createdCloudTextFiles[0]!.text()).toBe(cloudBody);
  expect(await createdCloudTextFiles[0]!.text()).not.toContain('LOCAL SOURCE MUST NOT BE EXPORTED');
  expect(requestedDownloads[0]!.filename).toContain('Cloud version-');
  expect(requestedDownloads[0]!.filename.endsWith('.md')).toBe(true);
  expect(mock.createCloudCopy).not.toHaveBeenCalled(); expect(mock.state.activeNoteId).toBeNull();
});

it('refuses a divergent cloud body when the comparison pair has a different identity', async () => {
  await openDivergentPreview();
  const preview = host.querySelector<HTMLElement>('[data-divergent-note-preview]')!;
  const download = [...preview.querySelectorAll('button')].find(button => button.textContent === 'Download cloud text')!;
  mock.getDivergentNotePair.mockReturnValue({
    id: 'another-note-id',
    local: { title: 'Local version', body: 'local' },
    cloud: { title: 'Cloud version', body: 'must not be exported' },
    differingFields: ['body'],
  });
  await act(async () => { download.click(); });
  expect(createdCloudTextFiles).toHaveLength(0);
  expect(requestedDownloads).toHaveLength(0);
  expect(host.textContent).toContain('The complete cloud text could not be prepared or downloaded. No partial Markdown file was created.');
});

it.each(['same-account authority replacement', 'local publication change', 'account switch'])('refuses a cloud-text download after %s', async change => {
  await openRemoteOnlyPreview();
  const preview = host.querySelector<HTMLElement>('[data-remote-note-preview]')!;
  const download = [...preview.querySelectorAll('button')].find(button => button.textContent === 'Download cloud text')!;
  if (change === 'same-account authority replacement') mock.activeRequest = { accountId: 'A' };
  if (change === 'local publication change') mock.state = { ...mock.state, notes: [...mock.state.notes] };
  if (change === 'account switch') mock.state = { ...mock.state, activeAccountId: 'B' };
  await act(async () => { download.click(); });
  expect(createdCloudTextFiles).toHaveLength(0);
  expect(requestedDownloads).toHaveLength(0);
  expect(host.textContent).toContain('This comparison is no longer current. Run it again before previewing.');
});

it('reports unavailable full content and does not create a partial file', async () => {
  await openRemoteOnlyPreview();
  const preview = host.querySelector<HTMLElement>('[data-remote-note-preview]')!;
  const download = [...preview.querySelectorAll('button')].find(button => button.textContent === 'Download cloud text')!;
  mock.getRemoteOnlyNote.mockReturnValue(null);
  await act(async () => { download.click(); });
  expect(createdCloudTextFiles).toHaveLength(0);
  expect(requestedDownloads).toHaveLength(0);
  expect(host.textContent).toContain('The complete cloud text could not be prepared or downloaded. No partial Markdown file was created.');
});

it('revokes cloud text object URLs when the comparison panel unmounts', async () => {
  await openRemoteOnlyPreview();
  const preview = host.querySelector<HTMLElement>('[data-remote-note-preview]')!;
  const download = [...preview.querySelectorAll('button')].find(button => button.textContent === 'Download cloud text')!;
  await act(async () => { download.click(); });
  expect(revokedObjectUrls).toEqual([]);
  await act(async () => root.unmount()); rootMounted = false;
  expect(revokedObjectUrls).toEqual(['blob:cloud-text-1']);
});

it('renders the comparison panel during SSR without invoking a download', () => {
  const html = renderToString(React.createElement(NotesCloudComparisonPanel, { accountId: 'A' }));
  expect(html).toContain('notes-cloud-comparison-heading');
  expect(createObjectUrl).not.toHaveBeenCalled();
  expect(requestedDownloads).toHaveLength(0);
});

it('compares one exact-ID divergent pair side by side without mutation or navigation', async () => {
  const before = JSON.stringify(mock.state.notes);
  await render(); await check();
  const divergentSection = host.querySelectorAll('details')[2]!;
  divergentSection.querySelector('summary')!.click();
  const row = [...divergentSection.querySelectorAll('li')].find(item => item.querySelector('code')?.textContent === 'different-id')!;
  const action = [...row.querySelectorAll('button')].find(item => item.textContent === 'Compare local and cloud versions')!;
  action.focus(); expect(document.activeElement).toBe(action);
  await act(async () => { action.click(); });

  const preview = host.querySelector<HTMLElement>('[data-divergent-note-preview]')!;
  expect(mock.getDivergentNotePair).toHaveBeenCalledExactlyOnceWith('different-id');
  expect(preview.textContent).toContain('Read-only comparison of Note versions');
  expect(preview.textContent).toContain('not continuous synchronization');
  expect(preview.textContent).toContain('one atomic local/cloud transaction');
  expect(preview.textContent).toContain('Attachment originals and Note history');
  expect(preview.textContent).toContain('Supported fields that differ');
  expect(preview.textContent).toContain('Text body');
  const localPanel = preview.querySelector('#notes-cloud-divergent-local-heading')?.parentElement!;
  const cloudPanel = preview.querySelector('#notes-cloud-divergent-cloud-heading')?.parentElement!;
  expect(localPanel.textContent).toContain('Local version');
  expect(localPanel.textContent).toContain('Local body <script>bad()</script>');
  expect(cloudPanel.textContent).toContain('Cloud version');
  expect(cloudPanel.textContent).toContain('Cloud body');
  expect(preview.querySelector('script')).toBeNull();
  expect(mock.state.activeNoteId).toBeNull();
  expect(mock.setActiveNoteId).not.toHaveBeenCalled();
  expect(getNoteNavigationStack()).toEqual([]);
  expect(getNoteReturnTab()).toBeNull();
  expect(JSON.stringify(mock.state.notes)).toBe(before);
  expect(owner.compare).toHaveBeenCalledTimes(1);
  expect(mock.prepareCloudCopy).not.toHaveBeenCalled();
  expect(mock.createCloudCopy).not.toHaveBeenCalled();
  expect(mock.readCloudCopyStatus).not.toHaveBeenCalled();
});

it('bounds both divergent titles and bodies independently and labels each partial preview', async () => {
  owner.getDivergentNotePair.mockImplementation((id: string) => id === 'different-id' ? {
    id,
    local: { title: 'L'.repeat(2_000), body: 'l'.repeat(15_000) },
    cloud: { title: 'C'.repeat(1_800), body: 'c'.repeat(14_000) },
    differingFields: ['body'],
  } : null);
  await render(); await check();
  const section = host.querySelectorAll('details')[2]!;
  section.querySelector('summary')!.click();
  const action = [...section.querySelectorAll('button')].find(item => item.textContent === 'Compare local and cloud versions')!;
  await act(async () => { action.click(); });
  const preview = host.querySelector<HTMLElement>('[data-divergent-note-preview]')!;
  const panels = [...preview.querySelectorAll('article')];
  expect(panels).toHaveLength(2);
  expect(panels[0]!.querySelector('p')?.textContent).toHaveLength('Local title: '.length + 512);
  expect(panels[1]!.querySelector('p')?.textContent).toHaveLength('Cloud title: '.length + 512);
  expect(panels[0]!.querySelector('pre')?.textContent).toHaveLength(12_000);
  expect(panels[1]!.querySelector('pre')?.textContent).toHaveLength(12_000);
  expect(panels.every(panel => [...panel.querySelectorAll('[role="status"]')].length === 2
    && [...panel.querySelectorAll('[role="status"]')].every(status => status.textContent === 'Partial preview; the remaining text is omitted.'))).toBe(true);
});

it('does not render either version when the current comparison owner denies the divergent pair', async () => {
  owner.getDivergentNotePair.mockReturnValue(null);
  await render(); await check();
  const section = host.querySelectorAll('details')[2]!;
  section.querySelector('summary')!.click();
  const row = [...section.querySelectorAll('li')].find(item => item.querySelector('code')?.textContent === 'different-id')!;
  const action = [...row.querySelectorAll('button')].find(item => item.textContent === 'Compare local and cloud versions')!;
  await act(async () => { action.click(); });
  expect(host.querySelector('[data-divergent-note-preview]')).toBeNull();
  expect(host.textContent).toContain('These Note versions are unavailable in the current comparison. Run it again before comparing.');
  expect(host.textContent).not.toContain('Local body');
  expect(host.textContent).not.toContain('Cloud body');
});

it('discards a displayed divergent pair across account A-B-A and synchronous owner invalidation', async () => {
  await render(); await check();
  const section = host.querySelectorAll('details')[2]!;
  section.querySelector('summary')!.click();
  const action = [...section.querySelectorAll('button')].find(item => item.textContent === 'Compare local and cloud versions')!;
  await act(async () => { action.click(); });
  expect(host.textContent).toContain('Local body');

  await render('B'); await render('A');
  expect(host.querySelector('[data-divergent-note-preview]')).toBeNull();

  await check();
  const currentSection = host.querySelectorAll('details')[2]!;
  currentSection.querySelector('summary')!.click();
  const currentAction = [...currentSection.querySelectorAll('button')].find(item => item.textContent === 'Compare local and cloud versions')!;
  await act(async () => { currentAction.click(); });
  expect(host.textContent).toContain('Local body');
  const listeners = [...mock.invalidationListeners];
  live = false;
  mock.invalidationListeners.clear();
  await act(async () => { listeners.forEach(listener => listener()); });
  expect(host.querySelector('[data-divergent-note-preview]')).toBeNull();
  expect(host.textContent).not.toContain('Local body <script>bad()</script>');
  expect(host.textContent).toContain('Comparison cancelled or its account/Notes context changed. Run a new manual check.');
});

it('bounds large cloud text and labels it as a partial preview', async () => {
  owner.getRemoteOnlyNote.mockImplementation((id: string) => id === 'cloud-id'
    ? { id, title: 'Cloud title', body: 'x'.repeat(15_000) } : null);
  await render(); await check();
  const section = host.querySelectorAll('details')[1]!;
  section.querySelector('summary')!.click();
  const button = [...section.querySelectorAll('button')].find(item => item.textContent === 'Preview cloud Note')!;
  await act(async () => { button.click(); });
  expect(host.querySelector('[data-remote-note-preview-partial="true"]')?.textContent).toContain('Partial preview');
  expect(host.querySelector('[data-remote-note-preview] pre')?.textContent).toHaveLength(12_000);
});

it('reports an unavailable exact remote record without displaying a body', async () => {
  owner.getRemoteOnlyNote.mockReturnValue(null);
  await render(); await check();
  const section = host.querySelectorAll('details')[1]!;
  section.querySelector('summary')!.click();
  const button = [...section.querySelectorAll('button')].find(item => item.textContent === 'Preview cloud Note')!;
  await act(async () => { button.click(); });
  expect(host.textContent).toContain('Cloud-only text is unavailable in the current comparison.');
  expect(host.querySelector('[data-remote-note-preview]')).toBeNull();
});

it('clears displayed remote text after account A-B-A, Notes publication change, cancellation, and unmount', async () => {
  await render(); await check();
  let section = host.querySelectorAll('details')[1]!;
  section.querySelector('summary')!.click();
  let button = [...section.querySelectorAll('button')].find(item => item.textContent === 'Preview cloud Note')!;
  await act(async () => { button.click(); });
  expect(host.textContent).toContain('Cloud body');

  await render('B'); await render('A');
  expect(host.querySelector('[data-remote-note-preview]')).toBeNull();
  expect(host.textContent).not.toContain('<script>window.bad=true</script>');
  expect(owner.cancel).toHaveBeenCalled();

  await check();
  section = host.querySelectorAll('details')[1]!;
  section.querySelector('summary')!.click();
  button = [...section.querySelectorAll('button')].find(item => item.textContent === 'Preview cloud Note')!;
  await act(async () => { button.click(); });
  mock.state = { ...mock.state, notes: [...mock.state.notes] };
  await render('A');
  expect(host.querySelector('[data-remote-note-preview]')).toBeNull();

  await check();
  section = host.querySelectorAll('details')[1]!;
  section.querySelector('summary')!.click();
  button = [...section.querySelectorAll('button')].find(item => item.textContent === 'Preview cloud Note')!;
  await act(async () => { button.click(); });
  const cancel = [...host.querySelectorAll('button')].find(item => item.textContent === 'Cancel')!;
  await act(async () => { cancel.click(); });
  expect(host.querySelector('[data-remote-note-preview]')).toBeNull();

  await check();
  section = host.querySelectorAll('details')[1]!;
  section.querySelector('summary')!.click();
  button = [...section.querySelectorAll('button')].find(item => item.textContent === 'Preview cloud Note')!;
  await act(async () => { button.click(); });
  await act(async () => { root.unmount(); });
  expect(host.textContent).not.toContain('Cloud body');
  expect(owner.cancel).toHaveBeenCalled();
});

it('rejects a stale comparison at preview activation and reports that a new comparison is needed', async () => {
  await render(); await check();
  const section = host.querySelectorAll('details')[1]!;
  section.querySelector('summary')!.click();
  const button = [...section.querySelectorAll('button')].find(item => item.textContent === 'Preview cloud Note')!;
  mock.activeRequest = { accountId: 'A' };
  await act(async () => { button.click(); });
  expect(host.textContent).toContain('This comparison is no longer current. Run it again before previewing.');
  expect(host.querySelector('[data-remote-note-preview]')).toBeNull();
});

it('clears preview content immediately when owner authority rolls over without a Store notification', async () => {
  await render(); await check();
  const section = host.querySelectorAll('details')[1]!;
  section.querySelector('summary')!.click();
  const button = [...section.querySelectorAll('button')].find(item => item.textContent === 'Preview cloud Note')!;
  await act(async () => { button.click(); });
  expect(host.textContent).toContain('Cloud body');

  const listeners = [...mock.invalidationListeners];
  live = false;
  mock.invalidationListeners.clear();
  await act(async () => { listeners.forEach(listener => listener()); });

  expect(host.querySelector('[data-remote-note-preview]')).toBeNull();
  expect(host.querySelector('[role="alert"]')).not.toBeNull();
});

it.each(['same-account publication invalidation', 'in-place local Note change'] as const)(
  'discards displayed remote text after %s', async change => {
    await render(); await check();
    const section = host.querySelectorAll('details')[1]!;
    section.querySelector('summary')!.click();
    const button = [...section.querySelectorAll('button')].find(item => item.textContent === 'Preview cloud Note')!;
    await act(async () => { button.click(); });
    expect(host.textContent).toContain('Cloud body');

    if (change === 'same-account publication invalidation') mock.activeRequest = { accountId: 'A' };
    else mock.state.notes[0]!.body = 'changed in place';
    mock.state = { ...mock.state };
    await act(async () => { mock.listeners.forEach(listener => listener()); });
    expect(host.querySelector('[data-remote-note-preview]')).toBeNull();
    if (change === 'same-account publication invalidation') expect(owner.cancel).toHaveBeenCalled();
  },
);

it('opens only eligible local IDs from local-only, divergent, and incomparable details and returns to Settings', async () => {
  const duplicateTitle = 'Same title';
  mock.state.notes = [localNote('local-exact-id', duplicateTitle), localNote('divergent-exact-id', duplicateTitle), localNote('incomparable-exact-id', 'Unrelated local')];
  const resultWithEligibleIncomparable = {
    ...report,
    details: {
      ...report.details,
      localOnly: [{ id: 'local-exact-id', localTitle: duplicateTitle }],
      remoteOnly: [{ id: 'cloud-only-id', remoteTitle: duplicateTitle }],
      divergent: [{ id: 'divergent-exact-id', localTitle: duplicateTitle, remoteTitle: duplicateTitle }],
      incomparable: [{ id: 'incomparable-exact-id', localTitle: 'Unrelated local' }],
      deleted: [{ id: 'deleted-id', localTitle: duplicateTitle }],
    },
  };
  owner.compare.mockResolvedValue(resultWithEligibleIncomparable);
  await render(); await check();

  for (const expectedId of ['local-exact-id', 'divergent-exact-id', 'incomparable-exact-id']) {
    const row = [...host.querySelectorAll('li')].find(item => item.querySelector('code')?.textContent === expectedId)!;
    const button = [...row.querySelectorAll('button')].find(candidate => candidate.textContent === 'Open note')!;
    expect(button.tagName).toBe('BUTTON');
    button.focus(); expect(document.activeElement).toBe(button);
    button.click();
    expect(mock.state.activeNoteId).toBe(expectedId);
    expect(getNoteNavigationStack()[getNoteNavigationStack().length - 1]?.id).toBe(expectedId);
    expect(getNoteReturnTab()).toBe('settings');
    expect(mock.notesTabSwitch).toHaveBeenCalled();
    expect(returnFromNote()).toBe(true);
    expect(mock.appTabSwitch).toHaveBeenLastCalledWith('settings');
    expect(getNoteReturnTab()).toBeNull();
  }
  expect(owner.compare).toHaveBeenCalledTimes(1);
});

it.each(['deleted-local', 'malformed-local', 'missing-local', 'same-account-republication', 'other-account', 'account-a-b-a', 'stale-comparison'] as const)(
  'does not change active note, navigation history, or return context for %s', async scenario => {
    await render(); await check();
    const row = [...host.querySelectorAll('li')].find(item => item.querySelector('code')?.textContent === 'local-id')!;
    const button = row.querySelector('button')!;
    setNoteReturnTab('planner'); pushNoteNavigation('prior-note');
    mock.state = { ...mock.state, activeNoteId: 'prior-note' };
    const historyBefore = [...getNoteNavigationStack()];

    if (scenario === 'deleted-local') mock.state.notes.find(note => note.id === 'local-id')!.deletedAt = 20;
    if (scenario === 'malformed-local') mock.state.notes.find(note => note.id === 'local-id')!.body = undefined;
    if (scenario === 'missing-local') mock.state.notes = mock.state.notes.filter(note => note.id !== 'local-id');
    if (scenario === 'same-account-republication') mock.activeRequest = { accountId: 'A' };
    if (scenario === 'other-account') {
      mock.activeRequest = { accountId: 'B' };
      mock.state = { ...mock.state, activeAccountId: 'B' };
    }
    if (scenario === 'account-a-b-a') {
      mock.activeRequest = { accountId: 'B' };
      mock.activeRequest = { accountId: 'A' };
    }
    if (scenario === 'stale-comparison') live = false;

    button.click();
    expect(mock.state.activeNoteId).toBe('prior-note');
    expect(getNoteNavigationStack()).toEqual(historyBefore);
    expect(getNoteReturnTab()).toBe('planner');
    expect(mock.notesTabSwitch).not.toHaveBeenCalled();
  },
);
it('keeps large detail groups collapsed and previews a bounded list with an accessible remainder', async () => {
  const large = {
    ...report, localOnly: 65,
    details: { ...report.details, localOnly: Array.from({ length: 65 }, (_, index) => ({ id: `local-${String(index).padStart(2, '0')}`, localTitle: `Note ${index}` })) },
  };
  owner.compare.mockResolvedValue(large); await render(); await check();
  const section = host.querySelector('details')!; expect(section.open).toBe(false);
  section.querySelector('summary')!.click(); expect(section.open).toBe(true);
  expect(section.querySelector(':scope > ul')!.querySelectorAll('li')).toHaveLength(30);
  const remainder = [...section.querySelectorAll('details')].find(item => item !== section)!;
  expect(remainder.textContent).toContain('Show 35 more'); expect(remainder.open).toBe(false);
  remainder.querySelector('summary')!.click(); expect(remainder.open).toBe(true);
  expect(remainder.querySelectorAll(':scope > ul > li')).toHaveLength(35);
  expect(section.querySelectorAll('code')).toHaveLength(65);
});
it.each([
  { language: 'en', localTitle: 'Local title', cloudTitle: 'Cloud title' },
  { language: 'ko', localTitle: '로컬 제목', cloudTitle: '클라우드 제목' },
  { language: 'ja', localTitle: 'ローカルのタイトル', cloudTitle: 'クラウドのタイトル' },
] as const)('localizes comparison details and unavailable states in $language', async ({ language, localTitle, cloudTitle }) => {
  useAppStore.getState().updateSetting('language', language); await render();
  expect(host.textContent).toMatch(/read-only|읽기 전용|読み取り専用/); await check(); expect(host.querySelectorAll('dd')).toHaveLength(6);
  expect(host.textContent).toContain(localTitle); expect(host.textContent).toContain(cloudTitle);
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
  expect(host.textContent).not.toContain('local-id'); expect(host.textContent).not.toContain('Local title');
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

it('requires a separate accessible confirmation and clears the pre-copy comparison after exact readback success', async () => {
  mock.cloudCopyEnabled = true;
  await render(); await check();
  const localOnly = host.querySelector('details')!;
  localOnly.querySelector('summary')!.click();
  const create = [...host.querySelectorAll('button')].find(button => button.textContent === 'Create cloud copy')!;
  await act(async () => { create.click(); await Promise.resolve(); });
  expect(mock.prepareCloudCopy).toHaveBeenCalledWith('local-id');
  expect(mock.createCloudCopy).not.toHaveBeenCalled();
  const confirmation = host.querySelector('[role="group"][aria-label="Confirm copy"]')!;
  expect(confirmation.textContent).toContain('last-updated timestamp, and starred state are copied');
  expect(confirmation.textContent).toContain('local Note and its ID stay unchanged');
  await act(async () => { confirmation.querySelector('button')!.click(); await Promise.resolve(); });
  expect(mock.createCloudCopy).toHaveBeenCalledTimes(1);
  expect(mock.createCloudCopy.mock.calls[0][0]).toBe('local-id');
  expect(mock.createCloudCopy.mock.calls[0][1]).toBe('A');
  expect(host.textContent).toContain('Cloud copy created and read back');
  const receipt = host.querySelector('[data-cloud-copy-receipt]')!;
  expect([...receipt.querySelectorAll('code')].map(code => code.textContent))
    .toEqual(['local-id', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa']);
  expect(receipt.textContent).toContain('another device signed in to this account');
  expect(host.querySelectorAll('details')).toHaveLength(0);
  expect(mock.state.activeNoteId).toBeNull();
});

async function confirmOneCloudCopy() {
  mock.cloudCopyEnabled = true;
  await render(); await check();
  host.querySelector('details > summary')!.click();
  await act(async () => {
    [...host.querySelectorAll('button')].find(button => button.textContent === 'Create cloud copy')!.click();
    await Promise.resolve();
  });
  const confirm = host.querySelector<HTMLButtonElement>('[role="group"] button')!;
  await act(async () => { confirm.click(); confirm.click(); await Promise.resolve(); });
}

it('confirms one write at a time and shows the existing cloud identity without mutating local Notes', async () => {
  const originalNotes = mock.state.notes;
  mock.createCloudCopy.mockResolvedValue({ status: 'ALREADY_COPIED', cloudNoteId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' });
  await confirmOneCloudCopy();
  expect(mock.createCloudCopy).toHaveBeenCalledTimes(1);
  expect(host.querySelector('[data-cloud-copy-receipt]')!.textContent).toContain('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
  expect(mock.state.notes).toBe(originalNotes);
  expect(mock.state.notes[0].id).toBe('local-id');
  expect(mock.appTabSwitch).not.toHaveBeenCalled();
});

it('stitches explicit Device A Cloud Copy to Device B exact-ID search and explicit read-only preview', async () => {
  const cloudNoteId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const deviceANotes = mock.state.notes;
  const deviceAData = JSON.stringify(deviceANotes);
  mock.createCloudCopy.mockResolvedValue({ status: 'CREATED', cloudNoteId });

  // Device A: the user confirms one copy; the local identity and authored data remain unchanged.
  await confirmOneCloudCopy();
  expect(mock.createCloudCopy).toHaveBeenCalledTimes(1);
  expect(mock.createCloudCopy.mock.calls[0].slice(0, 2)).toEqual(['local-id', 'A']);
  expect(JSON.stringify(deviceANotes)).toBe(deviceAData);
  expect(deviceANotes[0].id).toBe('local-id');

  // Device B has separate local state, but the same account-scoped cloud snapshot.
  mock.state = { ...mock.state, notes: [], activeAccountId: 'A', activeNoteId: null };
  mock.activeRequest = { accountId: 'A', device: 'B' };
  const deviceBNotes = mock.state.notes;
  const deviceBData = JSON.stringify(deviceBNotes);
  owner.compare.mockResolvedValue({
    ...report,
    remoteOnly: 1,
    details: { ...report.details, remoteOnly: [{ id: cloudNoteId, remoteTitle: 'Local title' }] },
  });
  owner.getRemoteOnlyNote.mockImplementation((id: string) => live && id === cloudNoteId
    ? { id, title: 'Local title', body: 'Cloud body from Device A' } : null);
  owner.searchCloudNotes.mockImplementation((query: string) => query.trim() === cloudNoteId
    ? { remoteOnly: [cloudNoteId], divergent: [], total: 1 }
    : { remoteOnly: [], divergent: [], total: 1 });
  await render('A');
  await check();
  await setComparisonSearch(cloudNoteId);

  const result = [...host.querySelectorAll('li')].find(item => item.querySelector('code')?.textContent === cloudNoteId)!;
  expect(result).toBeTruthy();
  expect(mock.getRemoteOnlyNote).not.toHaveBeenCalled();
  expect(host.querySelector('[data-remote-note-preview]')).toBeNull();
  const preview = [...result.querySelectorAll('button')].find(button => button.textContent === 'Preview cloud Note')!;
  await act(async () => { preview.click(); });
  expect(mock.getRemoteOnlyNote).toHaveBeenCalledWith(cloudNoteId);
  expect(host.querySelector('[data-remote-note-preview] pre')?.textContent).toContain('Cloud body from Device A');
  expect(mock.state.notes).toBe(deviceBNotes);
  expect(JSON.stringify(deviceBNotes)).toBe(deviceBData);
  expect(mock.createCloudCopy).toHaveBeenCalledTimes(1);
  expect(mock.state.activeNoteId).toBeNull();
  const previewCallsBeforeOtherAccount = mock.getRemoteOnlyNote.mock.calls.length;

  // A different account's complete comparison does not contain or resolve this identity.
  owner.compare.mockResolvedValue({ ...report, remoteOnly: 0, details: { ...report.details, remoteOnly: [] } });
  owner.searchCloudNotes.mockReturnValue({ remoteOnly: [], divergent: [], total: 0 });
  owner.getRemoteOnlyNote.mockReturnValue(null);
  mock.state = { ...mock.state, notes: [], activeAccountId: 'B' };
  mock.activeRequest = { accountId: 'B', device: 'B' };
  await render('B');
  await check();
  await setComparisonSearch(cloudNoteId);
  expect(host.querySelectorAll('li code')).toHaveLength(0);
  expect(mock.getRemoteOnlyNote).toHaveBeenCalledTimes(previewCallsBeforeOtherAccount);
});

it('does not display a cloud identity for indeterminate completion', async () => {
  mock.createCloudCopy.mockResolvedValue({ status: 'INDETERMINATE' });
  await confirmOneCloudCopy();
  expect(mock.createCloudCopy).toHaveBeenCalledTimes(1);
  expect(host.querySelector('[data-cloud-copy-receipt]')).toBeNull();
  expect(host.textContent).not.toContain('Saved cloud copy ID');
});

it('clears the completed identity receipt on authority replacement and account A-B-A', async () => {
  await confirmOneCloudCopy();
  expect(host.querySelector('[data-cloud-copy-receipt]')).not.toBeNull();
  await act(async () => {
    mock.activeRequest = { accountId: 'A' };
    mock.authorityListeners.forEach(listener => listener(mock.activeRequest));
  });
  expect(host.querySelector('[data-cloud-copy-receipt]')).toBeNull();
  expect(host.textContent).not.toContain('Cloud copy created and read back');
  await render('B'); await render('A');
  expect(host.querySelector('[data-cloud-copy-receipt]')).toBeNull();
});

it('suppresses pending completion after authority replacement without redispatching', async () => {
  let finish!: (result: unknown) => void;
  mock.createCloudCopy.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  await confirmOneCloudCopy();
  await act(async () => {
    mock.activeRequest = { accountId: 'A' };
    mock.authorityListeners.forEach(listener => listener(mock.activeRequest));
    finish({ status: 'CREATED', cloudNoteId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' });
    await Promise.resolve();
  });
  expect(mock.createCloudCopy).toHaveBeenCalledTimes(1);
  expect(host.querySelector('[data-cloud-copy-receipt]')).toBeNull();
  expect(host.textContent).not.toContain('Cloud copy created and read back');
});

it('suppresses pending copy completion after local source replacement', async () => {
  let finish!: (result: unknown) => void;
  mock.createCloudCopy.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  await confirmOneCloudCopy();
  await act(async () => {
    mock.state = { ...mock.state, notes: [...mock.state.notes] };
    mock.listeners.forEach(listener => listener());
  });
  await act(async () => { finish({ status: 'CREATED', cloudNoteId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' }); await Promise.resolve(); });
  expect(host.querySelector('[data-cloud-copy-receipt]')).toBeNull();
  expect(host.textContent).not.toContain('Cloud copy created and read back');
});

it('does not revive a pending copy result after account A-B-A', async () => {
  let finish!: (result: unknown) => void;
  mock.createCloudCopy.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  await confirmOneCloudCopy();
  await render('B'); await render('A');
  await act(async () => { finish({ status: 'CREATED', cloudNoteId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' }); await Promise.resolve(); });
  expect(host.querySelector('[data-cloud-copy-receipt]')).toBeNull();
  expect(host.textContent).not.toContain('Cloud copy created and read back');
  expect(mock.createCloudCopy).toHaveBeenCalledTimes(1);
});

it('releases authority observers and ignores copy completion after unmount', async () => {
  let finish!: (result: unknown) => void;
  mock.createCloudCopy.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  await confirmOneCloudCopy();
  await act(async () => { root.unmount(); }); rootMounted = false;
  expect(mock.authorityListeners.size).toBe(0);
  await act(async () => { finish({ status: 'CREATED', cloudNoteId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' }); await Promise.resolve(); });
  expect(host.textContent).toBe('');
  expect(mock.createCloudCopy).toHaveBeenCalledTimes(1);
});

it('does not dispatch a copy when the comparison/account becomes stale before confirmation', async () => {
  mock.cloudCopyEnabled = true;
  await render(); await check();
  host.querySelector('details > summary')!.click();
  await act(async () => {
    [...host.querySelectorAll('button')].find(button => button.textContent === 'Create cloud copy')!.click();
    await Promise.resolve();
  });
  const confirm = host.querySelector('[role="group"] button')!;
  mock.activeRequest = { accountId: 'B' };
  mock.state = { ...mock.state, activeAccountId: 'B' };
  await act(async () => { confirm.click(); await Promise.resolve(); });
  expect(mock.createCloudCopy).not.toHaveBeenCalled();
  expect(mock.state.activeNoteId).toBeNull();
  expect(host.querySelectorAll('dd')).toHaveLength(0);
  expect(host.querySelector('[role="group"]')).toBeNull();
});

it('keeps the Cloud Copy action invisible unless its dedicated build flag is enabled', async () => {
  mock.cloudCopyEnabled = false;
  await render(); await check();
  host.querySelector('details > summary')!.click();
  expect([...host.querySelectorAll('button')].some(button => button.textContent === 'Create cloud copy')).toBe(false);
  expect([...host.querySelectorAll('button')].some(button => button.textContent === 'Check cloud copy status')).toBe(false);
  expect(mock.prepareCloudCopy).not.toHaveBeenCalled();
  expect(mock.createCloudCopy).not.toHaveBeenCalled();
  expect(mock.readCloudCopyStatus).not.toHaveBeenCalled();
});

it('manually reads historical status by exact local ID without requiring the current Note payload to be copy-eligible', async () => {
  mock.cloudCopyEnabled = true;
  mock.state.notes = [localNote('local-id', 'Local title', { properties: { custom: 'unsupported for Cloud Copy' } })];
  await render(); await check();
  host.querySelector('details > summary')!.click();
  const row = [...host.querySelectorAll('li')].find(item => item.querySelector('code')?.textContent === 'local-id')!;
  const status = [...row.querySelectorAll('button')].find(button => button.textContent === 'Check cloud copy status')!;
  await act(async () => { status.click(); await Promise.resolve(); });
  expect(mock.readCloudCopyStatus).toHaveBeenCalledTimes(1);
  expect(mock.readCloudCopyStatus.mock.calls[0][0]).toBe('local-id');
  expect(mock.readCloudCopyStatus.mock.calls[0][1]).toBe('A');
  expect(mock.prepareCloudCopy).not.toHaveBeenCalled();
  expect(mock.createCloudCopy).not.toHaveBeenCalled();
  expect(mock.state.activeNoteId).toBeNull();
  expect(owner.cancel).not.toHaveBeenCalled();
  expect(row.textContent).toContain('matched its publication receipt');
  expect(host.querySelectorAll('dd')).toHaveLength(6);
});

it('offers status only for current local-side IDs and never for a remote-only ID', async () => {
  mock.cloudCopyEnabled = true;
  await render(); await check();
  host.querySelector('details > summary')!.click();
  host.querySelectorAll('details > summary')[1]!.click();
  host.querySelectorAll('details > summary')[2]!.click();
  for (const id of ['local-id', 'different-id']) {
    const row = [...host.querySelectorAll('li')].find(item => item.querySelector('code')?.textContent === id)!;
    expect([...row.querySelectorAll('button')].some(button => button.textContent === 'Check cloud copy status')).toBe(true);
  }
  const remote = [...host.querySelectorAll('li')].find(item => item.querySelector('code')?.textContent === 'cloud-id')!;
  expect([...remote.querySelectorAll('button')].some(button => button.textContent === 'Check cloud copy status')).toBe(false);
});

it('suppresses a pending status result after the comparison account changes', async () => {
  mock.cloudCopyEnabled = true;
  let resolve!: (value: { status: string }) => void;
  mock.readCloudCopyStatus.mockReturnValue(new Promise(yes => { resolve = yes; }));
  await render(); await check();
  host.querySelector('details > summary')!.click();
  const row = [...host.querySelectorAll('li')].find(item => item.querySelector('code')?.textContent === 'local-id')!;
  const button = [...row.querySelectorAll('button')].find(item => item.textContent === 'Check cloud copy status')!;
  await act(async () => { button.click(); await Promise.resolve(); });
  expect(mock.readCloudCopyStatus).toHaveBeenCalledTimes(1);
  await render('B');
  await act(async () => { resolve({ status: 'LIVE' }); await Promise.resolve(); });
  expect(host.textContent).not.toContain('A live cloud copy was verified');
  expect(host.querySelectorAll('dd')).toHaveLength(0);
  expect(mock.state.activeNoteId).toBeNull();
});

it('does not dispatch a status request after the current account publication has changed', async () => {
  mock.cloudCopyEnabled = true;
  await render(); await check();
  host.querySelector('details > summary')!.click();
  const row = [...host.querySelectorAll('li')].find(item => item.querySelector('code')?.textContent === 'local-id')!;
  const button = [...row.querySelectorAll('button')].find(item => item.textContent === 'Check cloud copy status')!;
  mock.activeRequest = { accountId: 'B' };
  mock.state = { ...mock.state, activeAccountId: 'B' };
  await act(async () => { button.click(); await Promise.resolve(); });
  expect(mock.readCloudCopyStatus).not.toHaveBeenCalled();
  expect(mock.state.activeNoteId).toBeNull();
});

it('releases a superseded status request when the user starts a fresh comparison', async () => {
  mock.cloudCopyEnabled = true;
  let resolve!: (value: { status: string }) => void;
  mock.readCloudCopyStatus.mockReturnValue(new Promise(yes => { resolve = yes; }));
  await render(); await check();
  host.querySelector('details > summary')!.click();
  let row = [...host.querySelectorAll('li')].find(item => item.querySelector('code')?.textContent === 'local-id')!;
  let statusButton = [...row.querySelectorAll('button')].find(button => button.textContent === 'Check cloud copy status')!;
  await act(async () => { statusButton.click(); await Promise.resolve(); });
  expect(statusButton.disabled).toBe(true);

  await act(async () => { host.querySelector('button')!.click(); await Promise.resolve(); });
  host.querySelector('details > summary')!.click();
  row = [...host.querySelectorAll('li')].find(item => item.querySelector('code')?.textContent === 'local-id')!;
  statusButton = [...row.querySelectorAll('button')].find(button => button.textContent === 'Check cloud copy status')!;
  expect(statusButton.disabled).toBe(false);
  await act(async () => { resolve({ status: 'LIVE' }); await Promise.resolve(); });
  expect(row.textContent).not.toContain('matched its publication receipt');
  expect(statusButton.disabled).toBe(false);
});

const laptopRow = () => [...host.querySelectorAll('li')].find(item => item.querySelector('code')?.textContent === 'local-id')!;
const laptopAction = (text: string) => [...laptopRow().querySelectorAll('button')].find(button => button.textContent === text)!;

it.each(['VERIFIED', 'INDETERMINATE'] as const)('initial publication requires historical-policy acknowledgment and explicit confirmation: %s', async outcome => {
  mock.initialEnabled = true;
  mock.requestLaptop.mockImplementation(async (_mode, _payload, _account, _preview, current, dispatch) =>
    current() && dispatch() ? outcome : 'STALE_RESULT');
  const before = JSON.stringify(mock.state.notes);
  await render(); await check();
  host.querySelector('details > summary')!.click();
  expect(laptopRow().querySelector('input[type=text]')).toBeNull();
  expect(laptopRow().textContent).toContain('cannot prove whether an absent ID was deleted historically');
  expect(laptopAction('Prepare initial laptop publication').disabled).toBe(true);
  await act(async () => laptopRow().querySelector<HTMLInputElement>('input[type=checkbox]')!.click());
  await act(async () => laptopAction('Prepare initial laptop publication').click());
  expect(mock.requestLaptop).not.toHaveBeenCalled();
  laptopAction('Confirm publication of this original ID').focus();
  expect(document.activeElement).toBe(laptopAction('Confirm publication of this original ID'));
  await act(async () => laptopAction('Confirm publication of this original ID').click());
  expect(mock.requestLaptop).toHaveBeenCalledTimes(1);
  expect(mock.requestLaptop.mock.calls[0][1]).toMatchObject({
    noteId: 'local-id', approvalOperationId: 'OWNER_ACKNOWLEDGED_INITIAL_ADOPTION_V1', knownDeletedIds: ['deleted-id'],
  });
  expect(JSON.stringify(mock.state.notes)).toBe(before);
  expect(mock.createCloudCopy).not.toHaveBeenCalled();
  expect(requestedDownloads).toEqual([]);
  if (outcome === 'INDETERMINATE') {
    expect(laptopRow().textContent).toContain('Repeat writes are blocked');
    expect(mock.requestLaptop.mock.calls.every(call => call[0] === 'publish')).toBe(true);
  }
});
async function fillLaptopApproval(value = 'operator-operation') {
  await act(async () => {
    const input = laptopRow().querySelector<HTMLInputElement>('[data-laptop-publication] input')!;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}
async function prepareLaptopPublication() {
  mock.laptopEnabled = true;
  await render(); await check();
  host.querySelector('details > summary')!.click();
  await fillLaptopApproval();
  await act(async () => laptopAction('Prepare original Note publication').click());
}

it('keeps laptop publication default off and independent of enabled Cloud Copy controls', async () => {
  mock.cloudCopyEnabled = true;
  await render(); await check();
  expect(host.querySelector('[data-laptop-publication]')).toBeNull();
  expect(mock.preflightLaptop).not.toHaveBeenCalled(); expect(mock.requestLaptop).not.toHaveBeenCalled();
});

it('requires operator ID then separate exact-original confirmation; performs no unrequested actions or local mutation', async () => {
  const notesBefore = JSON.stringify(mock.state.notes);
  const storageBefore = JSON.stringify(Object.fromEntries(Object.keys(localStorage).map(key => [key, localStorage.getItem(key)])));
  mock.laptopEnabled = true;
  await render(); await check();
  expect(mock.preflightLaptop).not.toHaveBeenCalled(); expect(mock.requestLaptop).not.toHaveBeenCalled();
  expect(host.querySelectorAll('[data-laptop-publication]')).toHaveLength(2);
  expect(host.querySelector('details:nth-of-type(2) [data-laptop-publication]')).toBeNull();
  host.querySelector('details > summary')!.click();
  const input = laptopRow().querySelector<HTMLInputElement>('[data-laptop-publication] input')!;
  expect(host.querySelector(`label[for="${input.id}"]`)?.textContent).toBe('Operator-issued approval operation ID');
  expect(input.getAttribute('aria-describedby')).toBeTruthy();
  expect(laptopAction('Prepare original Note publication').disabled).toBe(true);
  expect(laptopRow().textContent).toContain('this input does not grant approval');
  await fillLaptopApproval();
  laptopAction('Prepare original Note publication').focus(); expect(document.activeElement).toBe(laptopAction('Prepare original Note publication'));
  await act(async () => laptopAction('Prepare original Note publication').click());
  expect(mock.preflightLaptop).toHaveBeenCalledWith('local-id');
  expect(mock.requestLaptop).not.toHaveBeenCalled();
  const confirmation = laptopRow().querySelector('[role="group"][aria-label="Confirm publication of this original ID"]')!;
  expect(confirmation.querySelector('code')?.textContent).toBe('local-id');
  expect(confirmation.textContent).not.toContain('Local title');
  await act(async () => laptopAction('Confirm publication of this original ID').click());
  expect(mock.requestLaptop).toHaveBeenCalledTimes(1);
  expect(mock.requestLaptop.mock.calls[0].slice(0, 3)).toEqual(['publish', {
    noteId: 'local-id', approvalOperationId: 'operator-operation',
    snapshot: { title: 'Local title', body: 'Local body', updated_at: 10, starred: false },
  }, 'A']);
  expect(host.textContent).toContain('Publication verified for the exact original Note ID');
  expect(host.querySelector('details')).toBeNull();
  expect(JSON.stringify(mock.state.notes)).toBe(notesBefore);
  expect(JSON.stringify(Object.fromEntries(Object.keys(localStorage).map(key => [key, localStorage.getItem(key)])))).toBe(storageBefore);
  expect(mock.createCloudCopy).not.toHaveBeenCalled(); expect(mock.readCloudCopyStatus).not.toHaveBeenCalled();
  expect(mock.getRemoteOnlyNote).not.toHaveBeenCalled(); expect(mock.getDivergentNotePair).not.toHaveBeenCalled();
  expect(requestedDownloads).toEqual([]);
});

it('cancels a laptop confirmation without a publication or status request', async () => {
  await prepareLaptopPublication();
  const confirmation = laptopRow().querySelector('[role="group"][aria-label="Confirm publication of this original ID"]')!;
  await act(async () => [...confirmation.querySelectorAll('button')].find(button => button.textContent === 'Cancel')!.click());
  expect(mock.requestLaptop).not.toHaveBeenCalled();
  expect(laptopAction('Prepare original Note publication')).toBeTruthy();
});

it.each(['same-account authority replacement', 'new comparison'] as const)(
  'clears prior laptop publication success after %s without permitting another write',
  async change => {
    await prepareLaptopPublication();
    await act(async () => laptopAction('Confirm publication of this original ID').click());
    expect(host.textContent).toContain('Publication verified for the exact original Note ID');
    const notes = mock.state.notes, folders = mock.state.folders;
    if (change === 'same-account authority replacement') {
      await act(async () => {
        mock.activeRequest = { accountId: 'A' };
        mock.authorityListeners.forEach(listener => listener(mock.activeRequest));
      });
    } else {
      await check();
    }
    expect(host.textContent).not.toContain('Publication verified for the exact original Note ID');
    expect(mock.state.notes).toBe(notes); expect(mock.state.folders).toBe(folders);
    expect(mock.requestLaptop).toHaveBeenCalledTimes(1);
    if (change === 'same-account authority replacement') await check();
    host.querySelector('details > summary')!.click();
    expect(laptopRow().textContent).toContain('Repeat writes are blocked');
    expect(mock.requestLaptop).toHaveBeenCalledTimes(1);
  },
);

it.each(['INDETERMINATE', 'UNAVAILABLE', 'DISABLED', 'CONFLICT', 'BAD_REQUEST'] as const)('blocks repeat publication after any %s dispatch, including recomparison; readback is manual only', async outcome => {
  mock.requestLaptop.mockImplementation(async (_mode, _payload, _account, _preview, current, dispatch) =>
    current() && dispatch() ? outcome : 'STALE_RESULT');
  await prepareLaptopPublication();
  const confirm = laptopAction('Confirm publication of this original ID');
  await act(async () => { confirm.click(); confirm.click(); });
  expect(mock.requestLaptop).toHaveBeenCalledTimes(1);
  expect(laptopRow().textContent).toContain('Repeat writes are blocked');
  expect(laptopRow().querySelector('input')).toBeNull();
  expect(mock.requestLaptop.mock.calls.every(call => call[0] === 'publish')).toBe(true);
  await check(); host.querySelector('details > summary')!.click();
  expect(laptopRow().textContent).toContain('Repeat writes are blocked');
  expect(mock.requestLaptop).toHaveBeenCalledTimes(1);
  mock.requestLaptop.mockImplementation(async (_mode, _payload, _account, _preview, current, dispatch) =>
    current() && dispatch() ? 'VERIFIED' : 'STALE_RESULT');
  await act(async () => laptopAction('Read publication status (manual)').click());
  expect(mock.requestLaptop).toHaveBeenCalledTimes(2);
  expect(mock.requestLaptop.mock.calls[1][0]).toBe('status');
  expect(mock.requestLaptop.mock.calls[1][1]).toEqual(mock.requestLaptop.mock.calls[0][1]);
  expect(host.textContent).toContain('Publication verified for the exact original Note ID');
  expect(host.querySelector('details')).toBeNull();
});

it('rejects ineligible durable preflight without opening confirmation or dispatching', async () => {
  mock.preflightLaptop.mockResolvedValue({ status: 'INELIGIBLE', reasons: ['LOCAL_PERSISTENCE_UNVERIFIED'] });
  await prepareLaptopPublication();
  expect(host.textContent).toContain('durable storage, or account request changed');
  expect(host.textContent).not.toContain('Publish exactly this one'); expect(mock.requestLaptop).not.toHaveBeenCalled();
});

it('does not publish a source changed after confirmation, even before React renders', async () => {
  await prepareLaptopPublication();
  const confirm = laptopAction('Confirm publication of this original ID');
  mock.state.notes[0].body = 'changed in place';
  await act(async () => confirm.click());
  expect(mock.requestLaptop).not.toHaveBeenCalled();
});

it('fences pending preparation across authority A-B-A without array changes', async () => {
  let finish!: (value: unknown) => void;
  mock.preflightLaptop.mockReturnValue(new Promise(resolve => { finish = resolve; }));
  await prepareLaptopPublication();
  await act(async () => {
    for (const accountId of ['B', 'A']) {
      mock.activeRequest = { accountId };
      mock.authorityListeners.forEach(listener => listener(mock.activeRequest));
    }
    finish(await mock.prepareCloudCopy());
  });
  expect(mock.requestLaptop).not.toHaveBeenCalled();
  expect(host.textContent).not.toContain('Publish exactly this one');
});

it('preserves the dispatch ledger through account A-B-A and suppresses a late result', async () => {
  let finish!: (value: string) => void;
  mock.requestLaptop.mockImplementation((_mode, _payload, _account, _preview, current, dispatch) => {
    expect(current()).toBe(true); expect(dispatch()).toBe(true);
    return new Promise(resolve => { finish = resolve; });
  });
  await prepareLaptopPublication();
  await act(async () => laptopAction('Confirm publication of this original ID').click());
  await render('B'); await render('A');
  await act(async () => finish('VERIFIED'));
  expect(host.textContent).not.toContain('Publication verified');
  await check(); host.querySelector('details > summary')!.click();
  expect(laptopRow().textContent).toContain('Repeat writes are blocked');
  expect(mock.requestLaptop).toHaveBeenCalledTimes(1);
});

it('blocks manual readback if the newly durable-validated snapshot no longer matches the dispatched one', async () => {
  mock.requestLaptop.mockImplementation(async (_mode, _payload, _account, _preview, _current, dispatch) => {
    dispatch(); return 'INDETERMINATE';
  });
  await prepareLaptopPublication();
  await act(async () => laptopAction('Confirm publication of this original ID').click());
  await check(); host.querySelector('details > summary')!.click();
  mock.preflightLaptop.mockResolvedValue({ ...await mock.prepareCloudCopy(), snapshot: { title: 'changed', body: 'Local body', updated_at: 10, starred: false } });
  await act(async () => laptopAction('Read publication status (manual)').click());
  expect(mock.requestLaptop).toHaveBeenCalledTimes(1);
  expect(laptopRow().textContent).toContain('durable storage, or account request changed');
});

it('does not dispatch after preparation unmounts', async () => {
  let finish!: (value: unknown) => void;
  mock.preflightLaptop.mockReturnValue(new Promise(resolve => { finish = resolve; }));
  await prepareLaptopPublication();
  await act(async () => { root.unmount(); rootMounted = false; });
  await act(async () => finish(await mock.prepareCloudCopy()));
  expect(mock.requestLaptop).not.toHaveBeenCalled();
});
