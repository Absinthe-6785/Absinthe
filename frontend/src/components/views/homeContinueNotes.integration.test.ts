// @vitest-environment happy-dom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { DateTime } from 'luxon';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NoteBase } from './noteUtils';
import type { HomeViewProps } from './HomeView';
import type { NotesPersistenceInitResult } from '../../lib/notePersistence';
import type { RecipeActivityEntry } from './features/recipe/recipeActivityStorage';
import { PLANNER_ACTIVITY_KEY } from './features/planner/plannerActivityStorage';
import { ARCHIVE_RESTORE_RECENTS_KEY, readArchiveRestoreRecents } from './features/knowledge/archive/archiveRestoreRecents';
import { buildArchiveProjectionForHook } from './features/archive/hooks/useArchiveProjection';
import {
  activateNotesAccountAuthority, detachNotesAccountAuthority, getActiveNotesAuthorityRequest, NOTES_CORE_DOMAIN, NOTES_FOLDERS_DOMAIN,
  type NotesAuthorityDomainState, type NotesAuthorityRequest,
} from '../../lib/notesAccountAuthority';

const mocks = vi.hoisted(() => ({ initialize: vi.fn(), openNote: vi.fn(), switchToTab: vi.fn(), openRecipe: vi.fn(),
  recipeRecents: [] as RecipeActivityEntry[] }));
vi.mock('../../lib/notePersistence', async importOriginal => ({
  ...await importOriginal<typeof import('../../lib/notePersistence')>(), initNotesPersistence: mocks.initialize,
}));
vi.mock('../../lib/supabase', () => ({ authFetch: vi.fn(), authReadFetch: vi.fn() }));
vi.mock('../../lib/vaultSnapshotAuto', () => ({ scheduleAutoSnapshot: vi.fn() }));
vi.mock('swr', () => ({ default: () => ({ data: [] }) }));
vi.mock('../../lib/accountBoundRemote', () => ({ accountBoundRemoteKey: () => null, accountBoundRemoteFetcher: vi.fn() }));
vi.mock('../../lib/noteNavigation', () => ({ openNote: mocks.openNote, switchToTab: mocks.switchToTab }));
vi.mock('../../lib/i18n', async importOriginal => {
  const actual = await importOriginal<typeof import('../../lib/i18n')>();
  return { ...actual, useTranslation: () => ({ t: actual.getTranslator('en'), lang: 'en' }) };
});
vi.mock('./features/planner/calendar-ui/usePlannerCalendarProjection', () => ({ usePlannerCalendarProjection: () => ({ projection: {}, presentation: {} }) }));
vi.mock('./features/planner/calendar/buildPlannerProjection', () => ({ buildPlannerProjection: () => ({ todayItems: [], timetableToday: [] }) }));
vi.mock('./features/planner/hooks/useCountdownReviewed', () => ({ useCountdownReviewed: () => ({ isReviewed: () => false }) }));
vi.mock('./features/recipe/recipeActivityStorage', () => ({ readRecipeViewRecents: () => mocks.recipeRecents }));
vi.mock('../common/WorkspacePageHeader', () => ({ WorkspacePageHeader: () => null }));

const { useNotesStore, observePublishedNotesHydration } = await import('../../store/useNotesStore');
const { resetNotesPersistenceForTests } = await import('../../lib/notePersistence');
const { setRecoveryModeActiveForTest } = await import('../../lib/recoverySafetyPolicy');
const { HomeView } = await import('./HomeView');

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const note = (id: string, lastOpenedAt = 100): NoteBase => ({
  id, title: `Note ${id}`, body: '', updatedAt: 1, folderId: null, deletedAt: null, lastOpenedAt,
});
function domain(request: NotesAuthorityRequest, domainId: NotesAuthorityDomainState['domainId'], count: number): NotesAuthorityDomainState {
  return { accountId: request.accountId, domainId, schemaVersion: 1, state: count ? 'LOADED_POPULATED' : 'LOADED_EMPTY',
    recordCount: count, verifiedAt: 1, legacyGlobalDataPresent: false };
}
function hydrated(request: NotesAuthorityRequest, notes: NoteBase[]): NotesPersistenceInitResult {
  return { notes, mode: 'accountScoped', accountId: request.accountId, requestGeneration: request.generation,
    migrated: false, migrationMs: 0, loadMs: 0,
    notesAuthorityState: domain(request, NOTES_CORE_DOMAIN, notes.length),
    foldersAuthorityState: domain(request, NOTES_FOLDERS_DOMAIN, 0) };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(yes => { resolve = yes; });
  return { promise, resolve };
}
async function publish(accountId: string, notes = [note(accountId)]) {
  mocks.initialize.mockImplementationOnce(async (_account: string, request: NotesAuthorityRequest) => hydrated(request, notes));
  await act(async () => { await useNotesStore.getState().initNotesStorage(accountId); });
  expect(observePublishedNotesHydration().status).toBe('CURRENT');
}

let root: Root;
let host: HTMLDivElement;
async function render(accountId: string) {
  const props = { user: { id: accountId, name: accountId }, now: DateTime.local(2026, 6, 12, 12),
    selectedDate: new Date(2026, 5, 12), formatDate: () => '2026-06-12', schedules: [], routines: [], workouts: [], weeklySchedules: [],
    appSettings: { darkMode: false, language: 'en' }, theme: {}, isDailyLoading: true, onOpenRecipe: mocks.openRecipe } as HomeViewProps;
  await act(async () => root.render(createElement(HomeView, props)));
}
const section = () => host.querySelector<HTMLElement>('[data-k132a-home-section="continue"]')!;
const button = () => section().querySelector<HTMLButtonElement>('[data-k132a-home-row="continue-primary"]');
const noteTraces = () => [...host.querySelectorAll<HTMLButtonElement>('[data-k132a-home-row="trace-notes"]')];
function expectNoteTraces(...titles: string[]) {
  expect(noteTraces().map(row => row.querySelector('p')?.textContent)).toEqual(titles);
}
function expectEmpty() {
  expect(button()).toBeNull();
  expect(section().querySelector('[data-k132a-home-empty="continue"]')).not.toBeNull();
  expect(host.querySelector<HTMLButtonElement>('[data-k132a-home-continue-action]')?.disabled).toBe(true);
}
beforeEach(() => {
  useNotesStore.getState().detachNotesStorage();
  resetNotesPersistenceForTests();
  setRecoveryModeActiveForTest(false);
  localStorage.clear();
  vi.clearAllMocks();
  mocks.initialize.mockReset();
  mocks.recipeRecents = [];
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount()); host.remove();
  useNotesStore.getState().detachNotesStorage();
  resetNotesPersistenceForTests();
});

describe('Home Note-only Continue with actual Notes publication provenance', () => {
  it('opens the exact most-recent Note ID and leaves all global workspace bytes unchanged', async () => {
    await publish('A', [{ ...note('older', 10), title: 'Same title' }, { ...note('newer', 20), title: 'Same title' }]);
    const session = JSON.stringify({ activation: { kind: 'saved-view', id: 'stale' },
      resumeActivation: { kind: 'saved-view', id: 'stale' }, updatedAt: 1 });
    const prefs = JSON.stringify({ pinned: [], recent: [{ workspace: {
      kind: 'saved-view', id: 'stale', name: 'Private workspace',
    }, lastOpenedAt: 1 }] });
    localStorage.setItem('note-workspace-session-v1', session);
    localStorage.setItem('workspace-prefs-v1', prefs);
    await render('A');
    expect(button()?.textContent).toContain('Same title');
    expect(section().textContent).not.toContain('Private workspace');
    act(() => button()!.click());
    expect(mocks.openNote).toHaveBeenCalledExactlyOnceWith('newer', { returnTab: 'home' });
    expect(mocks.switchToTab).not.toHaveBeenCalled();
    expect(localStorage.getItem('note-workspace-session-v1')).toBe(session);
    expect(localStorage.getItem('workspace-prefs-v1')).toBe(prefs);
    expectNoteTraces('Same title', 'Same title');
    act(() => noteTraces()[0].click());
    expect(mocks.openNote.mock.calls).toEqual([
      ['newer', { returnTab: 'home' }], ['newer', { returnTab: 'home' }],
    ]);
  });

  it('shows the existing empty state before any proven publication, even with matching public account fields', async () => {
    useNotesStore.setState({ notes: [note('unproven')], activeAccountId: 'B',
      notesAuthorityState: 'LOADED_POPULATED', foldersAuthorityState: 'LOADED_EMPTY' });
    await render('B');
    expectEmpty();
    expectNoteTraces();
    await publish('B');
    expect(button()?.textContent).toContain('Note B');
    expectNoteTraces('Note B');
  });

  it('keeps A -> B -> A Continue empty until each account publishes its current Notes', async () => {
    await publish('A'); await render('A');
    expect(button()?.textContent).toContain('Note A');
    expectNoteTraces('Note A');
    await render('B');
    expectEmpty();
    expectNoteTraces();
    expect(useNotesStore.getState().notes[0].id).toBe('A');
    const pendingB = deferred<NotesPersistenceInitResult>();
    mocks.initialize.mockReturnValueOnce(pendingB.promise);
    let loadingB!: Promise<void>;
    await act(async () => { loadingB = useNotesStore.getState().initNotesStorage('B'); });
    const b = getActiveNotesAuthorityRequest()!;
    expectEmpty();
    expectNoteTraces();
    await act(async () => { pendingB.resolve(hydrated(b, [note('B')])); await loadingB; });
    expect(button()?.textContent).toContain('Note B');
    expectNoteTraces('Note B');
    await render('A');
    expectEmpty();
    expectNoteTraces();
    const pendingA = deferred<NotesPersistenceInitResult>();
    mocks.initialize.mockReturnValueOnce(pendingA.promise);
    let loadingA!: Promise<void>;
    await act(async () => { loadingA = useNotesStore.getState().initNotesStorage('A'); });
    const a2 = getActiveNotesAuthorityRequest()!;
    expectEmpty();
    expectNoteTraces();
    await act(async () => { pendingA.resolve(hydrated(a2, [note('A-new')])); await loadingA; });
    expect(button()?.textContent).toContain('Note A-new');
    expect(section().textContent).not.toContain('Note B');
    expectNoteTraces('Note A-new');
  });

  it('retires Continue immediately when same-account replacement starts, without a new Notes array', async () => {
    await publish('A'); await render('A');
    const oldNotes = useNotesStore.getState().notes;
    const pending = deferred<NotesPersistenceInitResult>();
    mocks.initialize.mockReturnValueOnce(pending.promise);
    let loading!: Promise<void>;
    await act(async () => { loading = useNotesStore.getState().initNotesStorage('A'); });
    expect(useNotesStore.getState().notes).toBe(oldNotes);
    expectEmpty();
    expectNoteTraces();
    const request = getActiveNotesAuthorityRequest()!;
    await act(async () => { pending.resolve(hydrated(request, [note('replacement')])); await loading; });
    expect(button()?.textContent).toContain('Note replacement');
    expectNoteTraces('Note replacement');
  });

  it('ignores a delayed A hydration after B has already published', async () => {
    const old = deferred<NotesPersistenceInitResult>();
    mocks.initialize.mockReturnValueOnce(old.promise);
    const loadingA = useNotesStore.getState().initNotesStorage('A');
    const a1 = getActiveNotesAuthorityRequest()!;
    await render('A'); expectEmpty(); expectNoteTraces();
    await render('B'); await publish('B');
    await act(async () => { old.resolve(hydrated(a1, [note('late-A')])); await loadingA; });
    expect(button()?.textContent).toContain('Note B');
    expect(section().textContent).not.toContain('late-A');
    expectNoteTraces('Note B');
  });

  it('fails closed on a stale click even before a Store notification and preserves hydration recovery errors', async () => {
    await publish('A'); await render('A');
    const staleButton = button()!;
    const staleTrace = noteTraces()[0];
    detachNotesAccountAuthority();
    act(() => staleButton.click());
    act(() => staleTrace.click());
    expect(mocks.openNote).not.toHaveBeenCalled();
    mocks.initialize.mockRejectedValueOnce(new Error('synthetic hydration failure'));
    await act(async () => { await expect(useNotesStore.getState().initNotesStorage('A')).rejects.toThrow('synthetic hydration failure'); });
    expectEmpty();
    expectNoteTraces();
    expect(useNotesStore.getState().notesAuthorityState).toBe('RECOVERY_REQUIRED');
    expect(useNotesStore.getState().syncError).toContain('synthetic hydration failure');
  });
});

describe('Home Notes-domain trace provenance', () => {
  it('excludes deleted Notes and preserves published Notes, ordering, authority and storage during projection/navigation', async () => {
    const notes = [note('older', 10), { ...note('deleted', 50), deletedAt: 60 }, note('newest', 30)];
    await publish('A', notes);
    const request = getActiveNotesAuthorityRequest();
    const beforeNotes = JSON.stringify(useNotesStore.getState().notes);
    localStorage.setItem('synthetic-unrelated', 'original');
    const beforeStorage = { ...localStorage };
    await render('A');
    expectNoteTraces('Note newest', 'Note older');
    act(() => noteTraces()[1].click());
    expect(mocks.openNote).toHaveBeenCalledExactlyOnceWith('older', { returnTab: 'home' });
    expect(JSON.stringify(useNotesStore.getState().notes)).toBe(beforeNotes);
    expect(getActiveNotesAuthorityRequest()).toBe(request);
    expect({ ...localStorage }).toEqual(beforeStorage);
  });

  it('rejects an old trace handler across A -> B -> A without a Store notification', async () => {
    await publish('A'); await render('A');
    const oldTrace = noteTraces()[0];
    const oldState = useNotesStore.getState();
    activateNotesAccountAuthority('B');
    activateNotesAccountAuthority('A');
    expect(useNotesStore.getState()).toBe(oldState);
    act(() => oldTrace.click());
    expect(mocks.openNote).not.toHaveBeenCalled();
    await render('A');
    expectNoteTraces();
  });

  it('rejects a superseded same-account trace handler even after a new request publishes the same Note ID', async () => {
    await publish('A'); await render('A');
    const oldTrace = noteTraces()[0];
    const oldRequest = getActiveNotesAuthorityRequest();
    let clickedDuringPublication = false;
    const unsubscribe = useNotesStore.subscribe(() => {
      const current = observePublishedNotesHydration();
      if (current.status === 'CURRENT' && current.request !== oldRequest) {
        clickedDuringPublication = true;
        oldTrace.click();
      }
    });
    try { await publish('A'); } finally { unsubscribe(); }
    expect(clickedDuringPublication).toBe(true);
    expect(mocks.openNote).not.toHaveBeenCalled();
    expectNoteTraces('Note A');
    act(() => noteTraces()[0].click());
    expect(mocks.openNote).toHaveBeenCalledExactlyOnceWith('A', { returnTab: 'home' });
  });

  it('rechecks deletion before an old trace click can navigate', async () => {
    await publish('A'); await render('A');
    const oldTrace = noteTraces()[0];
    await act(async () => {
      useNotesStore.setState({ notes: useNotesStore.getState().notes.map(item => ({ ...item, deletedAt: 200 })) });
      oldTrace.click();
    });
    expect(mocks.openNote).not.toHaveBeenCalled();
    expectNoteTraces();
  });

  it('retains Recipe and Schedule traces and navigation while Notes publication is unavailable', async () => {
    useNotesStore.setState({ notes: [note('unproven')] });
    const at = new Date(2026, 5, 12, 10).getTime();
    const plannerKey = `${PLANNER_ACTIVITY_KEY}:account:A`;
    const plannerRaw = JSON.stringify([{ kind: 'schedule', itemId: 'schedule-1', title: 'Schedule trace', at, eventDate: '2026-06-13' }]);
    localStorage.setItem(plannerKey, plannerRaw);
    mocks.recipeRecents = [{ recipeId: 'recipe-1', title: 'Recipe trace', at: at - 1 }];
    await render('A');
    expectNoteTraces();
    const planner = host.querySelector<HTMLButtonElement>('[data-k132a-home-row="trace-planner"]')!;
    const recipe = host.querySelector<HTMLButtonElement>('[data-k132a-home-row="trace-recipe"]')!;
    expect(planner.textContent).toContain('Schedule trace');
    expect(planner.textContent).toContain('2026-06-13');
    expect(recipe.textContent).toContain('Recipe trace');
    act(() => planner.click()); act(() => recipe.click());
    expect(mocks.switchToTab).toHaveBeenCalledExactlyOnceWith('planner');
    expect(mocks.openRecipe).toHaveBeenCalledExactlyOnceWith('recipe-1');
    expect(mocks.openNote).not.toHaveBeenCalled();
    expect(localStorage.getItem(plannerKey)).toBe(plannerRaw);
  });
});

describe('Home Archive trace account boundary', () => {
  it('preserves supported mixed trace ordering, date metadata, Continue and exact navigation when Archive data is newer', async () => {
    const at = new Date(2026, 5, 12, 10).getTime();
    const raw = JSON.stringify([{ noteId: 'foreign', restoredAt: at + 1 }]);
    localStorage.setItem(ARCHIVE_RESTORE_RECENTS_KEY, raw);
    await publish('A', [note('current', at)]);
    mocks.recipeRecents = [{ recipeId: 'recipe-1', title: 'Recipe trace', at: at - 1 }];
    localStorage.setItem(`${PLANNER_ACTIVITY_KEY}:account:A`, JSON.stringify([
      { kind: 'schedule', itemId: 'schedule-1', title: 'Schedule trace', at: at - 2, eventDate: '2026-06-13' },
    ]));
    await render('A');
    const rows = [...host.querySelectorAll<HTMLButtonElement>('[data-k132a-home-row^="trace-"]')];
    expect(rows.map(row => row.querySelector('p')?.textContent)).toEqual(['Note current', 'Recipe trace', 'Schedule trace']);
    expect(rows[2].textContent).toContain('2026-06-13');
    act(() => { rows.forEach(row => row.click()); button()!.click(); });
    expect(mocks.openNote.mock.calls).toEqual([['current', { returnTab: 'home' }], ['current', { returnTab: 'home' }]]);
    expect(mocks.openRecipe).toHaveBeenCalledExactlyOnceWith('recipe-1');
    expect(mocks.switchToTab).toHaveBeenCalledExactlyOnceWith('planner');
    expect(localStorage.getItem(ARCHIVE_RESTORE_RECENTS_KEY)).toBe(raw);
  });

  it('never shows or navigates global restore activity across A -> B -> A, even when a published Note ID matches', async () => {
    const at = new Date(2026, 5, 12, 10).getTime();
    const recents = [{ noteId: 'shared-id', restoredAt: at + 2 }, { noteId: 'foreign-id', restoredAt: at + 1 }];
    const raw = JSON.stringify(recents);
    localStorage.setItem(ARCHIVE_RESTORE_RECENTS_KEY, raw);
    const observations = [];
    for (const account of ['A', 'B', 'A']) {
      await publish(account, [{ ...note('shared-id', at), title: `${account} current Note` }]);
      const notesBefore = JSON.stringify(useNotesStore.getState().notes);
      const request = getActiveNotesAuthorityRequest();
      await render(account);
      expectNoteTraces(`${account} current Note`);
      expect(button()?.textContent).toContain(`${account} current Note`);
      const rows = [...host.querySelectorAll<HTMLButtonElement>('[data-k132a-home-row="trace-archive"]')];
      const count = host.querySelector<HTMLButtonElement>('[data-k132a-home-open-archive]');
      const callsBefore = mocks.openNote.mock.calls.length + mocks.switchToTab.mock.calls.length;
      act(() => { rows.forEach(row => row.click()); count?.click(); });
      observations.push({ account, archiveTitles: rows.map(row => row.querySelector('p')?.textContent),
        countVisible: Boolean(count), navigationCalls: mocks.openNote.mock.calls.length + mocks.switchToTab.mock.calls.length - callsBefore });
      expect(localStorage.getItem(ARCHIVE_RESTORE_RECENTS_KEY)).toBe(raw);
      expect(readArchiveRestoreRecents()).toEqual(recents);
      expect(JSON.stringify(useNotesStore.getState().notes)).toBe(notesBefore);
      expect(getActiveNotesAuthorityRequest()).toBe(request);
    }
    expect(observations).toEqual(['A', 'B', 'A'].map(account => ({
      account, archiveTitles: [], countVisible: false, navigationCalls: 0,
    })));
  });

  it('does not show a Home Archive count derived only from unpublished Notes; Archive internal history remains available', async () => {
    const at = new Date(2026, 5, 12, 10).getTime();
    useNotesStore.setState({ notes: [{ ...note('unpublished', at), updatedAt: at }] });
    const notesBefore = JSON.stringify(useNotesStore.getState().notes);
    const archive = buildArchiveProjectionForHook(useNotesStore.getState().notes, new Date(2026, 5, 12, 12), [], 'en');
    const today = archive.historyItems.groups.find(group => group.bucket === 'today')!;
    expect(today.opened.map(item => item.noteId)).toEqual(['unpublished']);
    expect(today.edited.map(item => item.noteId)).toEqual(['unpublished']);
    await render('B');
    expectEmpty(); expectNoteTraces();
    expect(host.querySelector('[data-k132a-home-open-archive]')).toBeNull();
    expect(JSON.stringify(useNotesStore.getState().notes)).toBe(notesBefore);
  });
});
