// @vitest-environment happy-dom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import type { GlobalSearchHostProps } from './views/features/search/GlobalSearchHost';
import type { SearchWorkspacePaletteProps } from './views/features/search/components/SearchWorkspacePalette';
import type { ViewProps } from '../types';
import type { ActiveCanonicalWorkoutReadInput } from './views/features/health/compositeWorkoutReadProjection';
import { CompositeWorkoutReadIsolationError } from './views/features/health/compositeWorkoutReadProjection';
import { buildSearchWorkoutPreview } from './views/features/search/searchWorkoutCompositeProjection';
import { saveHealthWorkouts, deleteHealthWorkout } from './views/features/health/healthWorkoutPersistence';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const h = vi.hoisted(() => ({
  parent: true, child: true, healthRange: false,
  hosts: [] as GlobalSearchHostProps[], palette: null as SearchWorkspacePaletteProps | null,
  view: null as ViewProps | null, activeTab: 'home', opener: null as (() => void) | null,
  persisted: { query: 'Bench', filter: 'all' as const },
  legacyReads: [] as string[], canonicalReads: [] as string[], closes: [] as string[],
  versions: new Map<string, number>(), holdNext: false,
  held: [] as Array<() => void>, sourceError: '' as '' | 'legacy' | 'canonical' | 'isolation',
  verifyFails: false,
  deleted: new Set<string>(), mutationGate: null as Promise<void> | null, mutationStarted: false,
  showToast: vi.fn(), mutate: vi.fn(), updateSetting: vi.fn(),
  notes: { createNote: vi.fn(), updateNote: vi.fn() }, openHealthDayNote: vi.fn(),
}));
vi.mock('./views/features/health/healthSelectedDayCompositeConfig', () => ({
  get HEALTH_SELECTED_DAY_COMPOSITE_READER_ENABLED() { return h.parent; },
}));
vi.mock('./views/features/search/searchWorkoutCompositeConfig', async original => {
  const actual = await original<typeof import('./views/features/search/searchWorkoutCompositeConfig')>();
  return { ...actual, get SEARCH_WORKOUT_COMPOSITE_READER_ENABLED() { return h.child; },
    isSearchWorkoutCompositeEnabled: (host: Parameters<typeof actual.isSearchWorkoutCompositeEnabled>[0],
      signal: Parameters<typeof actual.isSearchWorkoutCompositeEnabled>[1], account: string) =>
      actual.isSearchWorkoutCompositeEnabled(host, signal, account, { parentEnabled: h.parent, childEnabled: h.child }) };
});
vi.mock('./views/features/home/homeWorkoutCompositeConfig', () => ({ isHomeWorkoutCompositeEnabled: () => false }));
vi.mock('./views/features/health/healthWorkoutRangeCompositeConfig', () => ({
  isHealthWorkoutRangeCompositeEnabled: ({ healthActive }: { healthActive: boolean }) => h.parent && h.healthRange && healthActive,
}));
vi.mock('./views/features/health/useHealthSelectedDayComposite', () => ({
  useHealthSelectedDayComposite: (_enabled: boolean, accountId: string, localDate: string) => ({
    phase: 'settled', accountId, localDate, result: null, legacyDaily: null, isolationError: false, retry: vi.fn(),
  }),
}));
vi.mock('../lib/workoutRangeReader', () => ({
  WorkoutRangeReader: class {
    accountId: string;
    verifications = 0;
    scope: { accountId: string; namespaceKey: string; generationId: string };
    constructor(accountId: string) { this.accountId = accountId; this.scope = { accountId, namespaceKey: `ns-${accountId}`, generationId: 'g' }; }
    static async open(accountId: string) { return new this(accountId); }
    async readAllActive() {
      h.canonicalReads.push(this.accountId);
      if (h.sourceError === 'canonical') throw new Error('offline');
      if (h.sourceError === 'isolation') throw new CompositeWorkoutReadIsolationError('ACCOUNT_MISMATCH');
      const rows = canonicalRows(this.accountId);
      if (h.holdNext) {
        h.holdNext = false;
        await new Promise<void>(resolve => h.held.push(resolve));
      }
      return rows;
    }
    async verifyCurrentScope() { if (++this.verifications > 1 && h.verifyFails) throw new Error('stale scope'); }
    close() { h.closes.push(this.accountId); }
  },
}));
vi.mock('../lib/workoutSelectedDayReader', () => ({ readEstablishedWorkoutDeviceId: () => 'device' }));
vi.mock('../lib/healthLocalRuntime', () => ({ createLocalHealthRepository: async (account: string) => ({
  readAll: async () => {
    h.legacyReads.push(account);
    if (h.sourceError === 'legacy') throw new Error('offline');
    return { workout_logs: h.deleted.has(account) ? [] : [{ id: 'row', user_id: account, date: '2026-09-30', block_id: 'bench', sort_order: 0, sets: [] }],
      exercise_blocks: [{ id: 'bench', user_id: account, name: 'Bench', type: 'strength' }] };
  },
  saveWorkouts: async () => {
    h.mutationStarted = true; await h.mutationGate;
    h.versions.set(account, 2); h.deleted.delete(account);
    return [{ id: '11111111-1111-4111-8111-111111111111', version: 'v2' }];
  },
  deleteWorkout: async () => {
    h.mutationStarted = true; await h.mutationGate;
    h.deleted.add(account); h.versions.set(account, 2);
  },
}) }));
vi.mock('swr', () => ({ default: () => ({ data: [], isLoading: false, isValidating: false }),
  useSWRConfig: () => ({ mutate: vi.fn() }) }));
vi.mock('../lib/supabase', () => ({ supabase: { auth: { signOut: vi.fn() } }, authFetch: vi.fn() }));
vi.mock('../lib/remoteBoundary', () => ({ remoteSWRKey: () => null }));
vi.mock('../lib/noteNavigation', () => ({
  registerNotesTabSwitcher: () => () => undefined, registerAppTabSwitcher: () => () => undefined,
  registerWorkspaceSearchOpener: (open: () => void) => { h.opener = open; return () => { if (h.opener === open) h.opener = null; }; },
  openWorkspaceSearch: () => h.opener?.(), openHealthDayNote: h.openHealthDayNote,
}));
vi.mock('../store/useAppStore', () => ({ useAppStore: () => ({ appSettings: { language: 'en', darkMode: false }, updateSetting: h.updateSetting }) }));
vi.mock('../store/useNotesStore', () => {
  const state = { ...h.notes, notes: [], folders: [], notesAuthorityState: 'LOADED_EMPTY', foldersAuthorityState: 'LOADED_EMPTY', syncError: null,
    initNotesStorage: vi.fn(async () => undefined), detachNotesStorage: vi.fn(), bootstrapFromSupabase: vi.fn(async () => undefined) };
  return { useNotesStore: Object.assign((select: (value: typeof state) => unknown) => select(state), { getState: () => state }) };
});
vi.mock('../hooks/useNow', () => ({ useNow: () => ({ now: { toJSDate: () => new Date(2026, 8, 30, 12) },
  formatDate: (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`, isToday: () => true }) }));
vi.mock('../hooks/useToast', () => ({ useToast: () => ({ toast: null, showToast: h.showToast }) }));
vi.mock('../hooks/useDaily', () => ({ useDailyData: () => ({ schedules: [], todos: [], routines: [], workouts: [], inbody: {},
  mutate: h.mutate, mutateTodos: h.mutate, mutateRoutines: h.mutate, isLoading: false }) }));
vi.mock('../hooks/useStatic', () => ({ useStaticData: () => ({ markedDates: [], healthBlocks: [], healthRoutines: [], weeklySchedules: [], mutate: h.mutate }) }));
vi.mock('../theme', () => ({ buildThemeClasses: () => ({}) }));
vi.mock('../lib/syncAuthority', () => ({ domainUsesLocalWorkingCopy: () => false }));
vi.mock('../lib/migrateLegacyDdays', () => ({ migrateLegacyDdays: vi.fn(async () => undefined) }));
vi.mock('../lib/vaultSnapshotAuto', () => ({ runPeriodicSnapshotSlots: vi.fn() }));
vi.mock('../lib/healthSupabaseBootstrap', () => ({ bootstrapHealthFromSupabase: vi.fn(async () => undefined), HEALTH_LOCAL_BOOTSTRAP_COMPLETE_EVENT: 'health-bootstrap-complete' }));
vi.mock('../lib/workoutRuntimeAuthority', () => ({ createProductionWorkoutRuntimeAuthorityController: () => ({ start: vi.fn(), cancel: vi.fn() }) }));
vi.mock('../lib/i18n', () => ({ useTranslation: () => ({ t: (k: string) => k, lang: 'en' }), resolveAppLanguage: () => 'en' }));
vi.mock('./NotesRouteBoundary', () => ({ NotesRouteBoundary: () => null }));
vi.mock('./common/ViewLoadingFallback', () => ({ ViewLoadingFallback: () => null }));
vi.mock('./common/Sidebar', () => ({ Sidebar: ({ activeTab, setActiveTab }: { activeTab: string; setActiveTab: (tab: string) => void }) => {
  h.activeTab = activeTab;
  return createElement('div', null, ...['home', 'health', 'note'].map(tab => createElement('button', {
    key: tab, 'data-nav': tab, onClick: () => setActiveTab(tab),
  }, tab)));
} }));
vi.mock('./views/HomeView', () => ({ HomeView: (props: ViewProps) => { h.view = props; return null; } }));
vi.mock('./views/HealthView', () => ({ HealthView: (props: ViewProps) => { h.view = props; return null; } }));
vi.mock('./views/PlannerView', () => ({ PlannerView: () => null }));
vi.mock('./views/AnalyticsView', () => ({ AnalyticsView: () => null }));
vi.mock('./views/SettingsView', () => ({ SettingsView: () => null }));
vi.mock('./views/RecipeView', () => ({ RecipeView: () => null }));
vi.mock('./views/features/knowledge/KnowledgeIndexService', () => ({ knowledgeIndexService: {} }));
vi.mock('./views/features/knowledge/discovery', () => ({ buildDiscoveryFeed: () => ({ items: [], sections: {}, summary: {} }) }));
vi.mock('./views/k101WorkspaceSearchState', () => ({ readWorkspaceSearchState: () => h.persisted,
  writeWorkspaceSearchState: (state: typeof h.persisted) => { h.persisted = state; } }));
vi.mock('./views/features/search/GlobalSearchHost', async original => {
  const actual = await original<typeof import('./views/features/search/GlobalSearchHost')>();
  return { GlobalSearchHost: (props: GlobalSearchHostProps) => {
    h.hosts.push(props); return createElement(actual.GlobalSearchHost, props);
  } };
});
vi.mock('./views/features/search/components/SearchWorkspacePalette', () => ({ SearchWorkspacePalette: (props: SearchWorkspacePaletteProps) => {
  h.palette = props;
  return createElement('output', { 'data-open': props.open }, props.projection.workoutPreview?.state ?? 'off');
} }));

function canonicalRows(accountId: string): ActiveCanonicalWorkoutReadInput[] {
  return [{ accountId, namespaceKey: `ns-${accountId}`, generationId: 'g', localRevision: 1,
    entityId: '11111111-1111-4111-8111-111111111111', session: { version: 1,
      id: '11111111-1111-4111-8111-111111111111', localDate: '2026-09-30', entries: [{
        id: '22222222-2222-4222-8222-222222222222', exercise: { id: null, name: `Bench v${h.versions.get(accountId) ?? 1}`, type: 'bodyweight', tags: [], cardioMode: null },
        sets: [{ id: '33333333-3333-4333-8333-333333333333', ordinal: 1, done: false,
          kind: 'bodyweight', loadKind: 'bodyweight', reps: 5, assistedReps: null, dropset: false }],
      }] } }];
}
let root: Root;
let container: HTMLDivElement;
async function render(account = 'a') {
  const { AppContent } = await import('./AppContent');
  await act(async () => root.render(createElement(AppContent, { authUser: { id: account, email: `${account}@example.com` } as never })));
  await flush();
}
async function flush() { await act(async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); }); }
async function open() { h.persisted = { query: 'Bench', filter: 'all' }; await act(async () => h.opener?.()); await flush(); }
const latestHost = () => h.hosts.at(-1)!;
const evidence = () => h.palette!.projection.results.find(r => r.workoutPreview?.source === 'canonical')!.workoutPreview!;
const durable = () => (h.view as ViewProps & { onLocalWorkoutCommitted: (account: string) => void }).onLocalWorkoutCommitted;
async function health() { await act(async () => container.querySelector<HTMLButtonElement>('[data-nav="health"]')!.click()); await flush(); }

beforeEach(() => {
  h.parent = true; h.child = true; h.healthRange = false; h.sourceError = ''; h.verifyFails = false;
  h.hosts.length = 0; h.legacyReads.length = 0; h.canonicalReads.length = 0; h.held.length = 0;
  h.holdNext = false; h.versions.clear(); h.persisted = { query: 'Bench', filter: 'all' };
  h.deleted.clear(); h.mutationGate = null; h.mutationStarted = false;
  h.notes.createNote.mockClear(); h.notes.updateNote.mockClear(); h.openHealthDayNote.mockClear();
  container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); });

describe('D1 real shell + host + shared hook + range coordinator', () => {
  it.each([[false, true], [true, false], [false, false]])('parent=%s child=%s prevents owner creation and reads', async (parent, child) => {
    h.parent = parent; h.child = child;
    await render(); await open();
    expect(h.legacyReads).toEqual([]); expect(h.canonicalReads).toEqual([]);
    expect(h.palette!.projection.workoutPreview).toBeUndefined();
  });
  it('fresh Search-only owns exactly 1L/1C; name typing and date derivation add no reads', async () => {
    await render(); expect(h.canonicalReads).toEqual([]);
    await open();
    expect(h.legacyReads).toEqual(['a']); expect(h.canonicalReads).toEqual(['a']);
    const activation = latestHost().searchHostLifetime!.current;
    await act(async () => h.palette!.onQueryChange('Bench v')); await flush();
    expect(latestHost().searchHostLifetime!.current).toBe(activation);
    expect(h.canonicalReads).toEqual(['a']);
    expect(h.palette!.projection.workoutPreview?.canonicalMatches).toBe(1);
    await act(async () => h.view!.setSelectedDate(new Date(2026, 9, 1, 12))); await flush();
    expect(h.palette!.projection.workoutPreview).toMatchObject({ localDate: '2026-10-01', state: 'verified_no_match' });
    expect(h.canonicalReads).toEqual(['a']); expect(h.legacyReads).toEqual(['a']);
  });
  it('A1 active -> B closed rejects old signals before B owner/read; A2 rejects old A1 proof and click', async () => {
    h.holdNext = true; await render(); await open();
    const a1 = latestHost(); const signal = a1.searchHostLifetime!.current!;
    const oldPalette = h.palette!;
    await render('b');
    await act(async () => a1.onSearchActivationChange!(signal));
    expect(h.canonicalReads).toEqual(['a']); expect(h.legacyReads).toEqual(['a']);
    expect(h.palette!.open).toBe(false);
    await render('a'); expect(latestHost().searchHostLifetime).not.toBe(a1.searchHostLifetime);
    await act(async () => { a1.onSearchActivationChange!(signal); h.held.shift()!(); }); await flush();
    expect(h.palette!.projection.workoutPreview).toBeUndefined();
    await open();
    expect(h.canonicalReads).toEqual(['a', 'a']);
    const now = evidence();
    expect(oldPalette.onOpenWorkoutPreview!(now)).toBe(false);
    expect(a1.onOpenWorkoutPreview!({ ...now, read: { ...now.read, scope: { ...now.read.scope, lifetime: signal } } })).toBe(false);
  });
  it('Health source is reused with 0L/0C, close/reopen changes child but neither owner nor listeners', async () => {
    h.healthRange = true;
    await render(); await health();
    const focus = vi.spyOn(window, 'addEventListener'); const visibility = vi.spyOn(document, 'addEventListener');
    await open(); const old = evidence(); const oldPalette = h.palette!;
    expect(h.canonicalReads).toEqual(['a']); expect(h.legacyReads).toEqual(['a']);
    await act(async () => h.palette!.onClose()); await flush();
    expect(old.read.scope.isCurrent()).toBe(false);
    await open(); const next = evidence();
    expect(next.read.scope.lifetime).not.toBe(old.read.scope.lifetime);
    expect(oldPalette.onOpenWorkoutPreview!(old)).toBe(false);
    expect(latestHost().onOpenWorkoutPreview!(old)).toBe(false);
    expect(h.canonicalReads).toEqual(['a']); expect(h.legacyReads).toEqual(['a']);
    expect(focus.mock.calls.filter(([event]) => event === 'focus')).toEqual([]);
    expect(visibility.mock.calls.filter(([event]) => event === 'visibilitychange')).toEqual([]);
    focus.mockRestore(); visibility.mockRestore();
  });
  it('close final Search owner releases it; reopen makes one fresh pair; delayed old child cannot publish', async () => {
    await render(); h.holdNext = true; await open(); const old = h.palette!;
    await act(async () => old.onClose()); await flush(); await open();
    const current = evidence();
    await act(async () => h.held.shift()!()); await flush();
    expect(evidence().read).toBe(current.read);
    expect(h.canonicalReads).toEqual(['a', 'a']);
    expect(old.onOpenWorkoutPreview!(current)).toBe(false);
  });
  it('current durable commit synchronously revokes click proof; foreign and no-owner commits cannot create/replay', async () => {
    await render(); await health(); const commit = durable();
    await act(async () => container.querySelector<HTMLButtonElement>('[data-nav="home"]')!.click());
    await act(async () => commit('a')); expect(h.canonicalReads).toEqual([]);
    await open(); const old = evidence();
    await act(async () => {
      commit('b'); expect(latestHost().onOpenWorkoutPreview!(old)).toBe(true);
    }); await flush(); // navigation is read-only and does not rescan
    const before = h.canonicalReads.length;
    await act(async () => {
      h.versions.set('a', 2); commit('a');
      expect(latestHost().onOpenWorkoutPreview!(old)).toBe(false);
      expect(buildSearchWorkoutPreview('Bench', old.read).results).toEqual([]);
    }); await flush();
    expect(h.canonicalReads.length).toBe(before + 1);
    expect(evidence().read).not.toBe(old.read);
    expect(h.palette!.projection.results.some(r => r.title === 'Bench v2')).toBe(true);
    await render('b'); await act(async () => commit('a'));
    expect(h.canonicalReads).not.toContain('b');
  });
  it('uses the stored month-boundary date for Health and performs no Notes or click source reads', async () => {
    await render(); await open(); const item = evidence();
    const reads = h.canonicalReads.length;
    await act(async () => expect(h.palette!.onOpenWorkoutPreview!(item)).toBe(true)); await flush();
    expect(h.activeTab).toBe('health');
    expect(h.view!.selectedDate.getDate()).toBe(30); expect(h.view!.selectedDate.getMonth()).toBe(8);
    expect(h.view!.currentDate.getDate()).toBe(30); expect(h.view!.currentDate.getMonth()).toBe(8);
    expect(h.canonicalReads.length).toBe(reads);
    expect(h.openHealthDayNote).not.toHaveBeenCalled(); expect(h.notes.createNote).not.toHaveBeenCalled();
    expect(h.notes.updateNote).not.toHaveBeenCalled();
    await act(async () => h.view!.setSelectedDate(new Date(2026, 9, 1, 12))); await flush();
    expect(latestHost().onOpenWorkoutPreview!(item)).toBe(false);
  });
  it.each(['legacy', 'canonical', 'isolation'] as const)('real shared coordinator propagates %s disposition', async failure => {
    h.sourceError = failure; await render(); await open();
    const preview = h.palette!.projection.workoutPreview!;
    expect(preview.state).toBe(failure === 'isolation' ? 'isolation_error' : 'partial');
    expect(preview.results.length).toBe(failure === 'isolation' ? 0 : 1);
    expect(h.palette!.projection.empty.noResults).toBe(false);
  });
  it('typing and child close/reopen do not reset the exhausted shared recovery budget', async () => {
    h.healthRange = true; h.verifyFails = true;
    await render(); await health(); await open();
    expect(h.canonicalReads).toEqual(['a', 'a']);
    expect(h.palette!.projection.workoutPreview?.state).toBe('unavailable');
    await act(async () => h.palette!.onQueryChange('Bench changed')); await flush();
    await act(async () => h.palette!.onClose()); await open();
    expect(h.canonicalReads).toEqual(['a', 'a']);
    h.verifyFails = false;
    await act(async () => h.palette!.onRetryWorkoutPreview!()); await flush();
    expect(h.canonicalReads).toEqual(['a', 'a', 'a']);
    expect(h.palette!.projection.workoutPreview?.state).toBe('matches');
  });
  it.each(['save', 'delete'] as const)('real durable %s from A1 cannot refresh B; A2 receives current durable data, never stale A1 UI', async operation => {
    await render(); await health(); await open(); const commit = durable();
    const a1Evidence = evidence(); const a1Click = h.palette!.onOpenWorkoutPreview!;
    let release!: () => void;
    h.mutationGate = new Promise<void>(resolve => { release = resolve; });
    let uiCurrent = true;
    let pending!: Promise<{ status: string }>;
    await act(async () => {
      pending = operation === 'save'
        ? saveHealthWorkouts({ mode: 'local', accountId: 'a', date: '2026-09-30',
          workouts: [{ id: 'draft', block_id: 'bench', exercise_blocks: { name: 'Bench', type: 'strength' }, sets: [] }] as never,
          shouldContinue: () => uiCurrent, onLocalCommit: () => commit('a') })
        : deleteHealthWorkout({ mode: 'local', accountId: 'a', workoutId: 'row', expectedVersion: 'v1',
          shouldContinue: () => uiCurrent, onLocalCommit: () => commit('a') });
    });
    expect(h.mutationStarted).toBe(true);
    uiCurrent = false;
    await render('b');
    expect(h.canonicalReads).not.toContain('b');
    await render('a'); await open();
    const a2Evidence = evidence(); const before = h.canonicalReads.length;
    await act(async () => { release(); expect((await pending).status).toBe('aborted'); }); await flush();
    // A matching durable account commit must refresh the *current* A2 owner.
    // It carries no A1 view data. Old A1 result/click authority stays revoked.
    expect(h.canonicalReads.length).toBe(before + 1);
    expect(evidence().read).not.toBe(a2Evidence.read);
    expect(a1Click(a1Evidence)).toBe(false);
    expect(latestHost().onOpenWorkoutPreview!(a1Evidence)).toBe(false);
    expect(h.palette!.projection.workoutPreview?.legacyMatches).toBe(operation === 'delete' ? 0 : 1);
    expect(h.palette!.projection.results.some(row => row.title === 'Bench v2')).toBe(true);
  });
  it.each(['save', 'delete'] as const)('late real durable %s completes under B closed without B owner creation or queued replay', async operation => {
    await render(); await health(); await open(); const commit = durable();
    let release!: () => void; h.mutationGate = new Promise<void>(resolve => { release = resolve; });
    let pending!: Promise<unknown>;
    await act(async () => {
      pending = operation === 'save'
        ? saveHealthWorkouts({ mode: 'local', accountId: 'a', date: '2026-09-30', workouts: [], onLocalCommit: () => commit('a') })
        : deleteHealthWorkout({ mode: 'local', accountId: 'a', workoutId: 'row', expectedVersion: 'v1', onLocalCommit: () => commit('a') });
    });
    expect(h.mutationStarted).toBe(true);
    await render('b');
    await act(async () => { release(); await pending; }); await flush();
    expect(h.canonicalReads).not.toContain('b'); expect(h.legacyReads).not.toContain('b');
    expect(h.palette!.projection.workoutPreview).toBeUndefined();
  });
});
