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
const owner = { compare: vi.fn(), cancel: vi.fn(() => { live = false; }), isCurrent: () => live };
const localNote = (id: string, title: string, overrides: Record<string, unknown> = {}) => ({
  id, title, body: 'Local body', folderId: null, updatedAt: 10, deletedAt: null, ...overrides,
});
let unregisterNotesTab: () => void, unregisterAppTab: () => void;
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true; useAppStore.getState().updateSetting('language', 'en');
  vi.clearAllMocks(); live = true; mock.available = true; mock.activeRequest = { accountId: 'A' };
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
    const request = mock.activeRequest, notes = mock.state.notes, folders = mock.state.folders;
    return {
      compare: owner.compare, cancel: owner.cancel,
      isCurrent: () => live && mock.available && isAccountCurrent() && mock.activeRequest === request
        && mock.state.activeAccountId === accountId && mock.state.notes === notes && mock.state.folders === folders,
    };
  });
  owner.compare.mockResolvedValue(report); owner.cancel.mockImplementation(() => { live = false; });
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
  await render(); expect(mock.create).not.toHaveBeenCalled(); host.querySelector('button')!.focus(); expect(document.activeElement).toBe(host.querySelector('button'));
  await check(); expect(owner.compare).toHaveBeenCalledTimes(1); expect(host.textContent).toContain('Local-only active IDs'); expect(host.textContent).toContain('not an atomic');
  expect([...host.querySelectorAll('dd')].map(el => el.textContent)).toEqual(['2', '1', '3', '4', '1', '2']);
  const sections = [...host.querySelectorAll('details')]; expect(sections).toHaveLength(5); expect(sections.every(section => !section.open)).toBe(true);
  const localSummary = sections[0].querySelector('summary')!; localSummary.focus(); expect(document.activeElement).toBe(localSummary);
  localSummary.click(); expect(sections[0].open).toBe(true); expect(sections[0].textContent).toContain('local-id'); expect(sections[0].textContent).toContain('Local title');
  expect(sections[1].textContent).toContain('Cloud title'); expect(sections[2].textContent).toContain('Local version'); expect(sections[2].textContent).toContain('Cloud version');
  expect([...host.querySelectorAll('button')].filter(button => button.textContent === 'Open note')).toHaveLength(3);
  for (const deniedId of ['cloud-id', 'unknown-id', 'deleted-id']) {
    const row = [...host.querySelectorAll('li')].find(item => item.querySelector('code')?.textContent === deniedId)!;
    expect(row.querySelector('button')).toBeNull();
  }
  expect(host.textContent).not.toContain('account-A'); expect(host.textContent).toContain('NOT enable cloud synchronization');
});

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
    const button = row.querySelector('button')!;
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
