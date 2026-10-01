// @vitest-environment happy-dom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { DateTime } from 'luxon';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { validateWorkoutSessionV1 } from '../lib/workoutSessionV1';

const mocks = vi.hoisted(() => ({
  parent: true, child: true, range: false, now: '2026-10-01T12:00:00',
  legacy: vi.fn(), canonical: vi.fn(), open: vi.fn(), close: vi.fn(), rangeEligibility: [] as boolean[],
  commits: [] as Array<(accountId: string) => void>, rangeInvalidate: vi.fn(),
  mutate: vi.fn(), showToast: vi.fn(), updateSetting: vi.fn(), legacyDailyFlags: [] as boolean[],
}));
vi.mock('./views/features/health/healthSelectedDayCompositeConfig', () => ({
  get HEALTH_SELECTED_DAY_COMPOSITE_READER_ENABLED() { return mocks.parent; },
}));
vi.mock('./views/features/home/homeWorkoutCompositeConfig', () => ({
  HOME_WORKOUT_COMPOSITE_READER_ENABLED: false,
  isHomeWorkoutCompositeEnabled: ({ homeActive, accountPresent }: { homeActive: boolean; accountPresent: boolean }) =>
    mocks.parent && mocks.child && homeActive && accountPresent,
}));
vi.mock('./views/features/health/healthWorkoutRangeCompositeConfig', () => ({
  isHealthWorkoutRangeCompositeEnabled: ({ healthActive, accountPresent }: { healthActive: boolean; accountPresent: boolean }) =>
    mocks.parent && mocks.range && healthActive && accountPresent,
}));
vi.mock('./views/features/health/selectedDayLegacySnapshot', () => ({ loadVerifiedSelectedDayLegacySnapshot: mocks.legacy }));
vi.mock('../lib/workoutSelectedDayReader', () => ({
  WorkoutSelectedDayReader: { open: mocks.open }, readEstablishedWorkoutDeviceId: () => 'device-1',
}));
// Range remains a separate Health-only owner; the shared B1 and real Home are unmocked.
vi.mock('./views/features/health/useHealthWorkoutRangeSnapshot', () => ({
  useHealthWorkoutRangeSnapshot: (enabled: boolean) => {
    mocks.rangeEligibility.push(enabled);
    return { phase: 'loading', invalidateAndReload: mocks.rangeInvalidate, retry: mocks.rangeInvalidate };
  },
}));
vi.mock('../lib/supabase', () => ({ supabase: { auth: { signOut: vi.fn() } } }));
vi.mock('../lib/accountBoundRemote', () => ({ accountBoundRemoteKey: () => null, accountBoundRemoteFetcher: vi.fn() }));
vi.mock('../lib/noteNavigation', () => ({ registerNotesTabSwitcher: () => () => undefined,
  registerAppTabSwitcher: () => () => undefined, openWorkspaceSearch: vi.fn(), openNote: vi.fn(), switchToTab: vi.fn() }));
vi.mock('../store/useAppStore', () => ({ useAppStore: () => ({ appSettings: { language: 'en', darkMode: false }, updateSetting: mocks.updateSetting }) }));
vi.mock('../store/useNotesStore', () => {
  const state = { notes: [], folders: [], notesAuthorityState: 'LOADED_EMPTY', foldersAuthorityState: 'LOADED_EMPTY',
    syncError: null, vaultStructureVersion: 0, createNote: vi.fn(), initNotesStorage: vi.fn(async () => undefined),
    bootstrapFromSupabase: vi.fn(async () => undefined), detachNotesStorage: vi.fn() };
  return { useNotesStore: Object.assign((select: (value: typeof state) => unknown) => select(state), { getState: () => state }) };
});
vi.mock('../hooks/useNow', () => ({ useNow: () => ({ now: DateTime.fromISO(mocks.now),
  formatDate: (date: Date) => DateTime.fromJSDate(date).toISODate()!, isToday: () => true }) }));
vi.mock('../hooks/useToast', () => ({ useToast: () => ({ toast: null, showToast: mocks.showToast }) }));
vi.mock('../hooks/useDaily', () => ({ useDailyData: (...args: unknown[]) => {
  mocks.legacyDailyFlags.push(Boolean(args[3]));
  return { schedules: [], todos: [], todosState: {}, routines: [], workouts: [], inbody: {},
    mutate: mocks.mutate, mutateTodos: mocks.mutate, mutateRoutines: mocks.mutate, isLoading: false };
} }));
vi.mock('../hooks/useStatic', () => ({ useStaticData: () => ({ markedDates: [], healthBlocks: [], healthBlocksState: {},
  healthRoutines: [], healthRoutinesState: {}, weeklySchedules: [], mutate: mocks.mutate }) }));
vi.mock('../lib/i18n', async importOriginal => {
  const actual = await importOriginal<typeof import('../lib/i18n')>();
  return { ...actual, useTranslation: () => ({ t: actual.getTranslator('en'), lang: 'en' }) };
});
vi.mock('../theme', () => ({ buildThemeClasses: () => ({}) }));
vi.mock('./common/Sidebar', () => ({ Sidebar: ({ setActiveTab }: { setActiveTab: (tab: string) => void }) =>
  createElement('div', null, ...['home', 'health', 'note'].map(tab => createElement('button', {
    key: tab, 'data-nav': tab, onClick: () => setActiveTab(tab),
  }, tab))) }));
vi.mock('./NotesRouteBoundary', () => ({ NotesRouteBoundary: () => null }));
vi.mock('./views/HealthView', () => ({ HealthView: (props: {
  user: { id: string }; selectedDate: Date; currentDate: Date; setSelectedDate: (date: Date) => void;
  setCurrentDate: (date: Date) => void; onLocalWorkoutCommitted: (accountId: string) => void;
}) => {
  mocks.commits.push(props.onLocalWorkoutCommitted);
  return createElement('div', { 'data-health-account': props.user.id,
    'data-health-date': DateTime.fromJSDate(props.selectedDate).toISODate(),
    'data-health-month': props.currentDate.getMonth() },
    createElement('button', { 'data-historical': true, onClick: () => {
      props.setSelectedDate(new Date(2020, 0, 2)); props.setCurrentDate(new Date(2020, 0, 2));
    } }, 'historical'));
} }));
vi.mock('./views/features/search/GlobalSearchHost', () => ({ GlobalSearchHost: () => null }));
vi.mock('./views/features/planner/calendar-ui/usePlannerCalendarProjection', () => ({ usePlannerCalendarProjection: () => ({ projection: {}, presentation: {} }) }));
vi.mock('./views/features/planner/calendar/buildPlannerProjection', () => ({ buildPlannerProjection: () => ({ todayItems: [], timetableToday: [] }) }));
vi.mock('./views/features/planner/hooks/useCountdownReviewed', () => ({ useCountdownReviewed: () => ({ isReviewed: () => false }) }));
vi.mock('./views/features/archive/hooks/useArchiveProjection', () => ({ useArchiveProjection: () => ({ projection: { historyItems: { groups: [] } } }) }));
vi.mock('../lib/migrateLegacyDdays', () => ({ migrateLegacyDdays: vi.fn(async () => undefined) }));
vi.mock('../lib/vaultSnapshotAuto', () => ({ runPeriodicSnapshotSlots: vi.fn() }));
vi.mock('../lib/healthSupabaseBootstrap', () => ({ bootstrapHealthFromSupabase: vi.fn(async () => undefined),
  HEALTH_LOCAL_BOOTSTRAP_COMPLETE_EVENT: 'health-bootstrap-complete' }));
vi.mock('../lib/workoutRuntimeAuthority', () => ({ createProductionWorkoutRuntimeAuthorityController: () => ({ start: vi.fn(), cancel: vi.fn() }) }));
vi.mock('swr', () => ({ default: () => ({ data: [] }), useSWRConfig: () => ({ mutate: mocks.mutate }) }));

function canonical(accountId: string, localDate: string) {
  const session = { version: 1, id: '11111111-1111-4111-8111-111111111111', localDate,
    entries: [{ id: '22222222-2222-4222-8222-222222222222',
      exercise: { id: 'bench', name: 'Frozen', type: 'strength', tags: [], cardioMode: null },
      sets: [{ id: '33333333-3333-4333-8333-333333333333', ordinal: 1, kind: 'strength', loadKind: 'external_weight',
        weightKg: '10', sourceValue: '10', sourceUnit: 'kg', reps: 8, assistedReps: null, dropset: false, done: false }] }] };
  validateWorkoutSessionV1(session);
  return [{ accountId, namespaceKey: `ns-${accountId}`, generationId: 'g1', entityId: session.id, localRevision: 1, session }];
}
function legacySnapshot() { return { persistedRows: [], daily: { workouts: [], inbody: {}, routines: [] } }; }
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve };
}
let host: HTMLDivElement, root: Root;
async function flush() { await act(async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); }); }
async function render(accountId = 'a') {
  const { AppContent } = await import('./AppContent');
  await act(async () => root.render(createElement(AppContent, { authUser: { id: accountId, email: `${accountId}@example.com` } as never })));
  await flush();
}
async function click(selector: string) {
  await act(async () => host.querySelector<HTMLButtonElement>(selector)!.click()); await flush();
}
const todayCard = () => host.querySelector<HTMLElement>('[data-home-workout-composite]');
beforeEach(async () => {
  localStorage.clear(); mocks.parent = true; mocks.child = true; mocks.range = false; mocks.now = '2026-10-01T12:00:00';
  mocks.legacy.mockReset().mockResolvedValue(legacySnapshot()); mocks.canonical.mockReset().mockImplementation(async (a, d) => canonical(a, d));
  mocks.open.mockReset().mockImplementation(async (accountId: string) => ({ accountId, deviceId: 'device-1',
    scope: { accountId, deviceId: 'device-1', namespaceKey: `ns-${accountId}`, generationId: 'g1' },
    read: (date: string) => mocks.canonical(accountId, date), verifyCurrentScope: async () => undefined, close: mocks.close }));
  mocks.commits.length = 0; mocks.rangeEligibility.length = 0; mocks.legacyDailyFlags.length = 0; vi.clearAllMocks();
  await import('./views/HomeView'); await import('./views/HealthView');
  host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host);
});
afterEach(() => { act(() => root.unmount()); host.remove(); });

describe('real AppContent + Home + shared selected-day B1', () => {
  it('reads one pair, no canonical reads on rerender/minute tick; same-date Home to managed Health reuses it', async () => {
    await render(); expect(todayCard()?.getAttribute('data-home-workout-presence')).toBe('present');
    expect(mocks.legacy).toHaveBeenCalledTimes(1); expect(mocks.canonical).toHaveBeenCalledTimes(1);
    await render(); mocks.now = '2026-10-01T12:01:00'; await render();
    expect(mocks.canonical).toHaveBeenCalledTimes(1);
    mocks.range = true;
    await click('[data-nav="health"]');
    expect(mocks.legacy).toHaveBeenCalledTimes(1); expect(mocks.canonical).toHaveBeenCalledTimes(1);
    expect(mocks.rangeEligibility.at(-1)).toBe(true);
    await click('[data-nav="home"]');
    expect(mocks.rangeEligibility.at(-1)).toBe(false); expect(mocks.canonical).toHaveBeenCalledTimes(1);
  });
  it('ignores historical Health date on Home, sets today/month before Workout navigation, and rereads only on date change', async () => {
    await render(); await click('[data-nav="health"]'); await click('[data-historical]');
    expect(host.querySelector('[data-health-date="2020-01-02"]')).not.toBeNull();
    await click('[data-nav="home"]');
    expect(todayCard()?.getAttribute('data-home-workout-date')).toBe('2026-10-01');
    expect(mocks.canonical.mock.lastCall).toEqual(['a', '2026-10-01']);
    const before = mocks.canonical.mock.calls.length;
    await click('[data-k132a-home-open-health]');
    expect(host.querySelector('[data-health-date="2026-10-01"][data-health-month="9"]')).not.toBeNull();
    expect(mocks.canonical).toHaveBeenCalledTimes(before);
  });
  it('midnight changes today once and hides yesterday while the new pair is pending', async () => {
    await render(); const slow = deferred<ReturnType<typeof canonical>>();
    mocks.canonical.mockReturnValueOnce(slow.promise); mocks.now = '2026-10-02T00:00:00';
    await render();
    expect(todayCard()?.getAttribute('data-home-workout-date')).toBe('2026-10-02');
    expect(todayCard()?.getAttribute('data-home-workout-presence')).toBe('unknown');
    expect(todayCard()?.querySelector('[data-home-workout-canonical]')).toBeNull();
    await act(async () => slow.resolve(canonical('a', '2026-10-02'))); await flush();
    expect(mocks.canonical).toHaveBeenCalledTimes(2);
    mocks.now = '2026-10-02T00:01:00'; await render(); expect(mocks.canonical).toHaveBeenCalledTimes(2);
  });
  it('new enabled lifetime hides old evidence and rereads the same date', async () => {
    await render(); await click('[data-nav="note"]');
    const slow = deferred<ReturnType<typeof canonical>>(); mocks.canonical.mockReturnValueOnce(slow.promise);
    await click('[data-nav="home"]');
    expect(todayCard()?.getAttribute('data-home-workout-presence')).toBe('unknown');
    await act(async () => slow.resolve(canonical('a', '2026-10-01'))); await flush();
    expect(mocks.canonical).toHaveBeenCalledTimes(2);
  });
  it.each([[false, true], [true, false], [false, false]])('gate parent=%s child=%s fails closed with no B1 I/O/listeners', async (parent, child) => {
    mocks.parent = parent; mocks.child = child;
    const add = vi.spyOn(window, 'addEventListener'), docAdd = vi.spyOn(document, 'addEventListener');
    await render();
    expect(mocks.legacy).not.toHaveBeenCalled(); expect(mocks.open).not.toHaveBeenCalled();
    expect(todayCard()).toBeNull(); expect(add.mock.calls.filter(([event]) => event === 'focus')).toHaveLength(0);
    expect(docAdd.mock.calls.filter(([event]) => event === 'visibilitychange')).toHaveLength(0);
    expect(add.mock.calls.filter(([event]) => event === 'health-bootstrap-complete')).toHaveLength(1); // Existing daily/static owner only.
  });
  it('routes payload-free commits by current account with no owner replay; range-first order remains Health-only', async () => {
    await render(); await click('[data-nav="health"]'); const oldCommit = mocks.commits.at(-1)!;
    await render('b'); await click('[data-nav="home"]'); const bReads = mocks.canonical.mock.calls.length;
    await act(async () => oldCommit('a')); await flush(); expect(mocks.canonical).toHaveBeenCalledTimes(bReads);
    await render('a'); const aReads = mocks.canonical.mock.calls.length;
    await act(async () => oldCommit('a')); await flush(); expect(mocks.canonical).toHaveBeenCalledTimes(aReads + 1);
    expect(mocks.rangeInvalidate).not.toHaveBeenCalled();
    await click('[data-nav="note"]'); const noOwner = mocks.canonical.mock.calls.length;
    await act(async () => oldCommit('a')); await flush(); expect(mocks.canonical).toHaveBeenCalledTimes(noOwner);
    await click('[data-nav="home"]'); expect(mocks.canonical).toHaveBeenCalledTimes(noOwner + 1);
  });
  it('owns/coalesces focus+visibility and cleans listeners on disable; draft refresh adds no canonical owner', async () => {
    const add = vi.spyOn(window, 'addEventListener'), docAdd = vi.spyOn(document, 'addEventListener');
    const remove = vi.spyOn(window, 'removeEventListener'), docRemove = vi.spyOn(document, 'removeEventListener');
    await render();
    expect(add.mock.calls.filter(([event]) => event === 'focus')).toHaveLength(1);
    expect(docAdd.mock.calls.filter(([event]) => event === 'visibilitychange')).toHaveLength(1);
    localStorage.setItem('healthDraft:a:2026-10-01', '[{"block_id":"__session__","sets":[]}]');
    await act(async () => { window.dispatchEvent(new Event('focus')); document.dispatchEvent(new Event('visibilitychange')); });
    await flush(); expect(mocks.canonical).toHaveBeenCalledTimes(2);
    expect(todayCard()?.querySelector('[data-home-workout-draft]')).not.toBeNull();
    await click('[data-nav="note"]');
    expect(remove.mock.calls.filter(([event]) => event === 'focus')).toHaveLength(1);
    expect(docRemove.mock.calls.filter(([event]) => event === 'visibilitychange')).toHaveLength(1);
  });
});
