// @vitest-environment happy-dom
import { act, createElement, Profiler, type ComponentProps } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { buildLargeVaultDataset } from '../dev/realisticUsageFixture';
import type { NotesAuthorityDomainState, NotesAuthorityRequest } from '../lib/notesAccountAuthority';
import type { NotesPersistenceInitResult } from '../lib/notePersistence';
import type { NoteBase } from './views/noteUtils';
import { serializeIdWikiLink } from './views/wikiLinks';

type Projection = 'health' | 'stale' | 'orphans' | 'queue';
const fixture = vi.hoisted(() => ({
  read: vi.fn<(accountId: string, request: NotesAuthorityRequest) => Promise<NotesPersistenceInitResult>>(),
  save: vi.fn(async () => ({ status: 'persisted' })),
  select: vi.fn(async () => true),
  network: vi.fn(async () => { throw new Error('Unexpected network from synthetic Notes entry'); }),
  imports: 0,
  commits: 0,
  onNotesCommit: undefined as ((owner: string | undefined) => void) | undefined,
  work: {} as Partial<Record<Projection, { calls: number; inputRows: number }>>,
}));

function count(projection: Projection, notes: readonly NoteBase[]) {
  const counts = fixture.work[projection] ??= { calls: 0, inputRows: 0 };
  counts.calls++;
  // Each entry point scans the supplied collection. Count source rows once
  // per call, not the additional passes or sorts within the builder.
  counts.inputRows += notes.length;
}

vi.mock('./views/features/knowledge/review/knowledgeHealth', async importOriginal => {
  const actual = await importOriginal<typeof import('./views/features/knowledge/review/knowledgeHealth')>();
  return { ...actual, buildKnowledgeHealthMetrics: (...args: Parameters<typeof actual.buildKnowledgeHealthMetrics>) => {
    count('health', args[0]);
    return actual.buildKnowledgeHealthMetrics(...args);
  } };
});

vi.mock('./views/features/knowledge/review/staleNotes', async importOriginal => {
  const actual = await importOriginal<typeof import('./views/features/knowledge/review/staleNotes')>();
  return { ...actual, buildStaleNotesBuckets: (...args: Parameters<typeof actual.buildStaleNotesBuckets>) => {
    // The editor's ranked queue has a separate four-per-tier stale pass.
    if (args[1]?.limitPerTier === 6) count('stale', args[0]);
    return actual.buildStaleNotesBuckets(...args);
  } };
});

vi.mock('./views/features/knowledge/review/orphanNotes', async importOriginal => {
  const actual = await importOriginal<typeof import('./views/features/knowledge/review/orphanNotes')>();
  return { ...actual, buildOrphanNotes: (...args: Parameters<typeof actual.buildOrphanNotes>) => {
    count('orphans', args[0]);
    return actual.buildOrphanNotes(...args);
  } };
});

vi.mock('./views/features/knowledge/review/reviewQueue', async importOriginal => {
  const actual = await importOriginal<typeof import('./views/features/knowledge/review/reviewQueue')>();
  return { ...actual, buildReviewQueue: (...args: Parameters<typeof actual.buildReviewQueue>) => {
    count('queue', args[0]);
    return actual.buildReviewQueue(...args);
  } };
});

vi.mock('../lib/notePersistence', async importOriginal => ({
  ...await importOriginal<typeof import('../lib/notePersistence')>(),
  initNotesPersistence: fixture.read,
  getNotesPersistenceMode: () => 'accountScoped',
  saveNotesAsync: fixture.save,
  saveActiveNoteIdAsync: fixture.select,
}));
vi.mock('../lib/supabase', () => ({
  supabase: { auth: { signOut: vi.fn() } }, authFetch: fixture.network, authReadFetch: fixture.network,
}));
vi.mock('../lib/healthSupabaseBootstrap', () => ({
  bootstrapHealthFromSupabase: vi.fn(async () => undefined), HEALTH_LOCAL_BOOTSTRAP_COMPLETE_EVENT: 'health-bootstrap-complete',
}));
vi.mock('../lib/healthLocalRuntime', async importOriginal => ({
  ...await importOriginal<typeof import('../lib/healthLocalRuntime')>(),
  readLocalHealthDaily: vi.fn(async () => ({ workouts: [], routines: [], inbody: { weight: null, smm: null, pbf: null } })),
}));
vi.mock('../lib/workoutRuntimeAuthority', () => ({
  createProductionWorkoutRuntimeAuthorityController: () => ({ start: vi.fn(), cancel: vi.fn() }),
}));
vi.mock('../lib/vaultSnapshotAuto', () => ({ runPeriodicSnapshotSlots: vi.fn(), scheduleAutoSnapshot: vi.fn() }));
vi.mock('../lib/migrateLegacyDdays', () => ({ migrateLegacyDdays: vi.fn(async () => undefined) }));
vi.mock('./views/NoteView', async importOriginal => {
  fixture.imports++;
  const { NoteView } = await importOriginal<typeof import('./views/NoteView')>();
  return { NoteView: (props: ComponentProps<typeof NoteView>) => createElement(Profiler, {
    id: 'notes',
    onRender: () => { fixture.commits++; fixture.onNotesCommit?.(props.accountId); },
  }, createElement(NoteView, props)) };
});

const account = 'notes-entry-fixture';
let root: Root | undefined;
let host: HTMLDivElement;

beforeEach(() => {
  vi.clearAllMocks();
  fixture.read.mockReset();
  fixture.commits = 0;
  fixture.onNotesCommit = undefined;
  fixture.work = {};
  localStorage.clear();
  sessionStorage.clear();
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('fetch', fixture.network);
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 10, 14, 12));
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => { root?.unmount(); });
  root = undefined;
  host.remove();
  vi.restoreAllMocks();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function hydrated(request: NotesAuthorityRequest, notes: NoteBase[]): NotesPersistenceInitResult {
  function domain(domainId: NotesAuthorityDomainState['domainId'], count: number): NotesAuthorityDomainState {
    return { accountId: request.accountId, domainId, schemaVersion: 1,
      state: count ? 'LOADED_POPULATED' : 'LOADED_EMPTY', recordCount: count, verifiedAt: 1, legacyGlobalDataPresent: false };
  }
  return { notes, mode: 'accountScoped', accountId: request.accountId, requestGeneration: request.generation,
    migrated: false, loadMs: 0, migrationMs: 0,
    notesAuthorityState: domain('notes.core', notes.length), foldersAuthorityState: domain('notes.folders', 0) };
}

async function mountedApp() {
  const { useNotesStore, observePublishedNotesHydration } = await import('../store/useNotesStore');
  // The real store publishes (and revokes) account provenance from synthetic
  // local reads; the independent remote startup stage is not under test.
  useNotesStore.setState({ bootstrapFromSupabase: vi.fn(async () => undefined) });
  const { AppContent } = await import('./AppContent');
  const { getNoteReturnTab, returnFromNote } = await import('../lib/noteNavigation');
  const navigation = await import('../lib/noteNavigationStack');
  navigation.resetNoteNavigationStack();
  const { getRenderDiagnostics, resetRenderDiagnostics } = await import('./views/noteview/renderDiagnostics');
  resetRenderDiagnostics();
  const { getTranslator } = await import('../lib/i18n');
  const { useAppStore } = await import('../store/useAppStore');
  const { SWRConfig } = await import('swr');
  const swr = { provider: () => new Map(), shouldRetryOnError: false };
  const t = getTranslator(useAppStore.getState().appSettings.language);
  const settle = () => act(async () => { await vi.dynamicImportSettled(); });
  const awaitNotes = () => vi.waitFor(() => {
    expect(Boolean(notesSurface()), 'Notes route is mounted').toBe(true);
  }, { timeout: 5000 });
  const click = async (element: HTMLElement | null | undefined) => {
    expect(element).toBeTruthy();
    await act(async () => { element!.click(); });
    await settle();
  };
  return {
    store: useNotesStore, observePublishedNotesHydration, getNoteReturnTab, returnFromNote, awaitNotes, navigation,
    async render(owner: string) {
      // The normal App shell stays mounted on authenticated prop changes.
      await act(async () => { root!.render(createElement(SWRConfig, { value: swr },
        createElement(AppContent, { authUser: { id: owner } as ComponentProps<typeof AppContent>['authUser'] }))); });
      await settle();
    },
    go: (tab: 'home' | 'note') => click([...host.querySelectorAll<HTMLElement>('[data-k126-mobile-sidebar] button')]
      .find(button => button.getAttribute('aria-label') === t(tab))),
    notesStartupPending: () => [...host.querySelectorAll('[data-workspace-viewport] [role="status"]')]
      .some(status => status.textContent === t('startupNotesLoading')),
    async openContinue() {
      await click(host.querySelector('[data-k132a-home-row="continue-primary"]'));
      await awaitNotes();
    },
    async openDashboard() {
      const toggle = host.querySelector<HTMLElement>('[data-notes-advanced-organization-toggle]');
      if (toggle?.getAttribute('aria-expanded') === 'false') await click(toggle);
      const items = host.querySelectorAll<HTMLElement>('[data-notes-advanced-organization-content] .bfi > span');
      await click([...items].find(item => item.textContent === t('wsDashboard')));
    },
    closeDashboard: () => click([...host.querySelectorAll<HTMLButtonElement>('#noteview-note-list button')]
      .find(button => button.title === t('nvLeaveDashboard'))),
    reviewReason: (reason: 'knReviewReasonRecent' | 'knReviewReasonLinked') =>
      [...host.querySelectorAll('.be-note-context-strip [title]')].some(chip => chip.getAttribute('title') === t(reason)),
    sample() {
      const result = { renders: getRenderDiagnostics().NoteView?.renders ?? 0, commits: fixture.commits, projections: fixture.work };
      fixture.commits = 0;
      fixture.work = {};
      resetRenderDiagnostics();
      return result;
    },
  };
}

const notesSurface = () => host.querySelector('[data-workspace="notes"]');
const editor = () => host.querySelector('#noteview-main');
const dashboard = () => host.querySelector('.be-knowledge-maintenance');

it.each([250, 1000])('measures real Notes entry and maintenance consumers with %i synthetic notes', async size => {
  const notes = buildLargeVaultDataset({ noteCount: size }).notes.map(note => ({ ...note, folderId: null }));
  const [first, resume] = notes;
  const orphan = notes.at(-1)!;
  const old = Date.now() - 100 * 24 * 60 * 60 * 1000;
  Object.assign(orphan, { title: 'Old unlinked synthetic note', body: 'Unlinked body', properties: undefined,
    lastOpenedAt: old, updatedAt: old });
  first!.title = resume!.title = 'Same synthetic title';
  resume!.lastOpenedAt = Date.now();
  first!.lastOpenedAt = Date.now() - 120_000;
  resume!.body = 'Exact resume body';
  fixture.read.mockImplementation(async (_account, request) => hydrated(request, notes));
  const initialImports = fixture.imports;
  const app = await mountedApp();

  await app.render(account);
  expect(app.observePublishedNotesHydration().status).toBe('CURRENT');
  expect(notesSurface()).toBeNull();
  expect(fixture.imports).toBe(initialImports);
  const home = app.sample();

  await app.go('note');
  await app.awaitNotes();
  expect(app.store.getState().activeNoteId).toBe(first!.id);
  expect(app.reviewReason('knReviewReasonRecent')).toBe(true);
  expect(dashboard()).toBeNull();
  expect(fixture.imports).toBe(1);
  const cold = app.sample();

  await app.go('home');
  expect(notesSurface()).toBeNull();
  await app.go('note');
  await app.awaitNotes();
  expect(app.store.getState().activeNoteId).toBe(first!.id);
  const warm = app.sample();

  await app.go('home');
  await app.openContinue();
  expect(app.store.getState().activeNoteId).toBe(resume!.id);
  expect(editor()?.textContent).toContain('Exact resume body');
  expect(app.getNoteReturnTab()).toBe('home');
  expect(app.reviewReason('knReviewReasonRecent')).toBe(true);
  const fromHome = app.sample();

  const editedText = 'Edited synthetic body';
  const targets = [notes[2]!.id, notes[3]!.id];
  const body = [editedText, ...targets.map((id, index) => serializeIdWikiLink(id, `Exact linked note ${index + 1}`))].join('\n\n');
  const version = app.store.getState().indexContentVersion;
  await act(async () => { app.store.getState().updateNote(resume!.id, { body }); });
  await act(async () => {
    await vi.waitFor(() => expect(app.store.getState().indexContentVersion).toBeGreaterThan(version), { timeout: 4000 });
  });
  expect(editor()?.textContent).toContain(editedText);
  expect(editor()?.textContent).toContain('Exact linked note 1');
  const bodyEdit = app.sample();

  const title = 'Updated synthetic title';
  await act(async () => { app.store.getState().updateNote(resume!.id, { title, relations: { source: targets } }); });
  expect(app.reviewReason('knReviewReasonLinked')).toBe(true);
  const structureEdit = app.sample();

  await act(async () => { expect(app.returnFromNote()).toBe(true); });
  await vi.dynamicImportSettled();
  expect(notesSurface()).toBeNull();
  await app.openContinue();
  expect(app.store.getState().activeNoteId).toBe(resume!.id);
  expect(app.store.getState().notes.find(note => note.id === resume!.id)?.relations?.source).toEqual(targets);
  expect(editor()?.textContent).toContain(editedText);
  expect(app.getNoteReturnTab()).toBe('home');
  expect(app.reviewReason('knReviewReasonLinked')).toBe(true);
  const resumeFromHome = app.sample();

  // One representative dashboard scenario suffices; the larger fixture
  // measures the ordinary entry/edit path without unrelated dashboard work.
  let dashboardOpen: ReturnType<typeof app.sample> | undefined;
  let dashboardClose: ReturnType<typeof app.sample> | undefined;
  let dashboardReopen: ReturnType<typeof app.sample> | undefined;
  let dashboardUpdate: ReturnType<typeof app.sample> | undefined;
  if (size === 250) {
    const structureVersion = app.store.getState().vaultStructureVersion;
    await app.openDashboard();
    const maintenance = dashboard();
    expect(maintenance?.querySelector('.be-knowledge-health')).not.toBeNull();
    expect(maintenance?.querySelector('.be-stale-notes')?.textContent).toContain(orphan.title);
    expect(maintenance?.querySelector('.be-orphan-notes')?.textContent).toContain(orphan.title);
    expect(maintenance?.querySelector('.be-review-queue')?.textContent).toContain(title);
    dashboardOpen = app.sample();

    await app.closeDashboard();
    expect(dashboard()).toBeNull();
    expect(app.reviewReason('knReviewReasonLinked')).toBe(true);
    expect(app.store.getState().activeNoteId).toBe(resume!.id);
    expect(app.store.getState().vaultStructureVersion).toBe(structureVersion);
    dashboardClose = app.sample();

    await app.openDashboard();
    expect(dashboard()?.querySelector('.be-review-queue')?.textContent).toContain(title);
    dashboardReopen = app.sample();

    await act(async () => { app.store.getState().updateNote(resume!.id, { title: 'Current dashboard title' }); });
    expect(dashboard()?.querySelector('.be-review-queue')?.textContent).toContain('Current dashboard title');
    dashboardUpdate = app.sample();
  }

  await app.go('home');
  expect(notesSurface()).toBeNull(); // re-entry doesn't keep a hidden editor mounted
  expect(fixture.imports).toBe(1);
  expect(fixture.read).toHaveBeenCalledTimes(1);
  expect(fixture.network).not.toHaveBeenCalled();
  console.info('NOTES_ENTRY_WORK', JSON.stringify({ size, imports: fixture.imports - initialImports, home, cold, warm, fromHome,
    bodyEdit, structureEdit, resumeFromHome, dashboardOpen, dashboardClose, dashboardReopen, dashboardUpdate }));

  const once = { calls: 1, inputRows: size };
  for (const phase of [cold, warm, fromHome, structureEdit, resumeFromHome]) {
    expect(phase.projections).toEqual({ queue: once });
  }
  expect(home.projections).toEqual({});
  expect(bodyEdit.projections).toEqual({});
  if (size === 250) {
    const scans = { health: once, stale: once, orphans: once };
    expect(dashboardOpen?.projections).toEqual(scans);
    expect(dashboardClose?.projections).toEqual({});
    expect(dashboardReopen?.projections).toEqual(scans);
    expect(dashboardUpdate?.projections).toEqual({ ...scans, queue: once });
  }
}, 60_000); // Real 1,000-note UI mounts share a CI worker; timings are not assertions.

it('keeps Notes commits account-current while discarding a late B vault across A→B→A', async () => {
  const [base] = buildLargeVaultDataset({ noteCount: 1 }).notes;
  const note = (title: string) => ({ ...base!, title, body: title, folderId: null });
  let release!: () => void;
  const wait = new Promise<void>(resolve => { release = resolve; });
  let releaseCurrentA!: () => void;
  const waitForCurrentA = new Promise<void>(resolve => { releaseCurrentA = resolve; });
  let currentA = 'Earlier A';
  const prior = { ...note('Earlier A prior navigation'), id: 'notes-entry-prior-navigation' };
  fixture.read.mockImplementation(async (owner, request) => {
    if (owner === 'b') { await wait; return hydrated(request, [note('Late B')]); }
    if (currentA === 'Earlier A') return hydrated(request, [note(currentA), prior]);
    await waitForCurrentA;
    return hydrated(request, [note(currentA)]);
  });
  const commits: { owner: string | undefined; earlierEditor: boolean; earlierMaintenance: boolean; lateB: boolean }[] = [];
  const app = await mountedApp();
  try {
    await app.render('a');
    await app.go('note');
    await app.awaitNotes();
    await act(async () => {
      app.navigation.navigateToNoteWithHistory(prior.id, 'wiki');
      app.navigation.navigateToNoteWithHistory(base!.id, 'wiki');
    });
    expect(app.navigation.getNoteNavigationSnapshot().canBack).toBe(true);
    await app.openDashboard();
    expect(dashboard()?.textContent).toContain('Earlier A');
    fixture.onNotesCommit = owner => {
      commits.push({
        owner,
        earlierEditor: editor()?.textContent?.includes('Earlier A') === true,
        earlierMaintenance: dashboard()?.textContent?.includes('Earlier A') === true,
        lateB: host.textContent?.includes('Late B') === true,
      });
    };

    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    await app.render('b');
    expect(fixture.read.mock.calls.some(([owner]) => owner === 'b')).toBe(true);
    expect(Boolean(notesSurface())).toBe(false);
    expect(app.notesStartupPending()).toBe(true);
    expect(host.textContent?.includes('Earlier A')).toBe(false);

    currentA = 'Current A';
    await app.render('a');
    expect(Boolean(notesSurface())).toBe(false);
    expect(app.notesStartupPending()).toBe(true);
    await act(async () => { release(); await wait; });
    expect(Boolean(notesSurface())).toBe(false);
    expect(app.notesStartupPending()).toBe(true);

    await act(async () => { releaseCurrentA(); await waitForCurrentA; });
    await app.awaitNotes();
    expect(editor()?.textContent).toContain('Current A');
    await app.openDashboard();
    expect(dashboard()?.textContent).toContain('Current A');
    expect(dashboard()?.textContent).not.toContain('Earlier A');
    expect(host.textContent?.includes('Late B')).toBe(false);
    expect(app.store.getState().activeNoteId).toBe(base!.id);
    expect(app.observePublishedNotesHydration().status).toBe('CURRENT');
    expect(fixture.network).not.toHaveBeenCalled();
    console.info('NOTES_OWNER_TRANSITION', JSON.stringify(commits));
    expect(commits.some(commit => commit.owner === 'a')).toBe(true);
    expect(commits.some(commit => commit.owner === 'b')).toBe(false);
    expect(commits.some(commit => commit.earlierEditor || commit.earlierMaintenance || commit.lateB)).toBe(false);
  } finally {
    fixture.onNotesCommit = undefined;
    release();
    releaseCurrentA();
  }
}, 30_000);
