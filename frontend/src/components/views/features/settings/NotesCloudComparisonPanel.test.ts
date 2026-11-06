// @vitest-environment happy-dom
import React, { act, useSyncExternalStore } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useAppStore } from '../../../../store/useAppStore';
import { NotesBootstrapDiagnosticError } from '../../../../lib/notesBootstrapDiagnostics';
import { getNoteReturnTab, registerAppTabSwitcher, registerNotesTabSwitcher, returnFromNote, setNoteReturnTab } from '../../../../lib/noteNavigation';
import { getNoteNavigationStack, pushNoteNavigation, resetNoteNavigationStack } from '../../../../lib/noteNavigationStack';
const mock = vi.hoisted(() => ({
  create: vi.fn(),
  getRemoteOnlyNote: vi.fn(),
  getDivergentNotePair: vi.fn(),
  subscribeInvalidation: vi.fn(),
  invalidationListeners: new Set<() => void>(),
  prepareCloudCopy: vi.fn(), createCloudCopy: vi.fn(), readCloudCopyStatus: vi.fn(), cloudCopyEnabled: false,
  state: { notes: [] as any[], folders: [] as any[], revision: 0, activeAccountId: 'A' as string | null, activeNoteId: null as string | null, setActiveNoteId: vi.fn() },
  listeners: new Set<() => void>(), available: true, activeRequest: { accountId: 'A' },
  setActiveNoteId: vi.fn(), notesTabSwitch: vi.fn(), appTabSwitch: vi.fn(),
}));
vi.mock('../../../../store/useNotesStore', () => ({
  useNotesStore: Object.assign(
    (select: any) => useSyncExternalStore(listener => { mock.listeners.add(listener); return () => { mock.listeners.delete(listener); }; }, () => select(mock.state)),
    { getState: () => mock.state },
  ),
  observePublishedNotesHydration: () => mock.available ? { status: 'CURRENT', request: mock.activeRequest } : { status: 'UNAVAILABLE' },
}));
vi.mock('../../../../lib/notesCloudComparison', () => ({ createNotesCloudComparison: mock.create }));
vi.mock('../../../../lib/notesCloudCopy', () => ({
  prepareNotesCloudCopy: mock.prepareCloudCopy,
  createNotesCloudCopy: mock.createCloudCopy,
  readNotesCloudCopyStatus: mock.readCloudCopyStatus,
  notesCloudCopyUiEnabled: () => mock.cloudCopyEnabled,
}));
import { NotesCloudComparisonPanel } from './NotesCloudComparisonPanel';
let root: Root, host: HTMLDivElement;
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
const owner = { compare: vi.fn(), getRemoteOnlyNote: mock.getRemoteOnlyNote, getDivergentNotePair: mock.getDivergentNotePair, subscribeInvalidation: mock.subscribeInvalidation, cancel: vi.fn(() => { live = false; mock.invalidationListeners.clear(); }), isCurrent: () => live };
const localNote = (id: string, title: string, overrides: Record<string, unknown> = {}) => ({
  id, title, body: 'Local body', folderId: null, updatedAt: 10, deletedAt: null, ...overrides,
});
let unregisterNotesTab: () => void, unregisterAppTab: () => void;
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true; useAppStore.getState().updateSetting('language', 'en');
  vi.clearAllMocks(); live = true; mock.available = true; mock.activeRequest = { accountId: 'A' }; mock.invalidationListeners.clear();
  mock.cloudCopyEnabled = false;
  mock.prepareCloudCopy.mockResolvedValue({
    status: 'ELIGIBLE_PREVIEW_ONLY', authority: 'NONE', localNoteId: 'local-id',
    snapshot: { title: 'Local title', body: 'Local body', updated_at: 10, starred: false },
    sourceRevision: { authorityGeneration: 1, vaultStructureVersion: 1, indexContentVersion: 1,
      noteUpdatedAt: 10, durableReadback: 'MATCHED', attachmentMetadata: 'COMPLETE_EMPTY' },
    isCurrentInMemory: () => true, isCurrent: async () => true,
  });
  mock.createCloudCopy.mockResolvedValue({ status: 'CREATED', cloudNoteId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' });
  mock.readCloudCopyStatus.mockResolvedValue({ status: 'LIVE' });
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
  resetNoteNavigationStack(); sessionStorage.removeItem('absinthe.noteNav.returnTab');
  unregisterNotesTab = registerNotesTabSwitcher(mock.notesTabSwitch);
  unregisterAppTab = registerAppTabSwitcher(mock.appTabSwitch);
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount()); host.remove(); unregisterNotesTab(); unregisterAppTab();
  resetNoteNavigationStack(); sessionStorage.removeItem('absinthe.noteNav.returnTab'); vi.restoreAllMocks();
});
async function render(account: string | null = 'A') { await act(async () => root.render(React.createElement(NotesCloudComparisonPanel, { accountId: account }))); }
async function check() { await act(async () => host.querySelector('button')!.click()); }
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
  expect(host.querySelectorAll('dd')).toHaveLength(0);
  expect(mock.state.activeNoteId).toBeNull();
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
