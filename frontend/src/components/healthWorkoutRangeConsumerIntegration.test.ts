// @vitest-environment happy-dom
import { createElement, useMemo } from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { deleteHealthWorkout, saveHealthWorkouts } from './views/features/health/healthWorkoutPersistence';

const mocks = vi.hoisted(() => ({
  selectedRetryByAccount: new Map<string, ReturnType<typeof vi.fn>>(),
  rangeInvalidateByAccount: new Map<string, ReturnType<typeof vi.fn>>(),
  rangeRetryByAccount: new Map<string, ReturnType<typeof vi.fn>>(),
  healthProps: [] as Array<Record<string, unknown>>,
  mutateDaily: vi.fn(), mutateStatic: vi.fn(), showToast: vi.fn(), updateSetting: vi.fn(),
  mutateTodos: vi.fn(), mutateRoutines: vi.fn(),
}));

vi.mock('./views/features/health/healthSelectedDayCompositeConfig', () => ({
  HEALTH_SELECTED_DAY_COMPOSITE_READER_ENABLED: true,
}));
vi.mock('./views/features/health/healthWorkoutRangeCompositeConfig', () => ({
  HEALTH_WORKOUT_RANGE_COMPOSITE_READER_ENABLED: true,
  isHealthWorkoutRangeCompositeEnabled: ({ healthActive, accountPresent }: { healthActive: boolean; accountPresent: boolean }) => healthActive && accountPresent,
}));
vi.mock('./views/features/health/useHealthSelectedDayComposite', () => ({
  useHealthSelectedDayComposite: (enabled: boolean, accountId: string, localDate: string, options?: { managedLifecycle?: boolean }) => {
    const retry = useMemo(() => vi.fn(), [accountId]);
    mocks.selectedRetryByAccount.set(accountId, retry);
    return { phase: enabled ? 'settled' : 'loading', accountId, localDate, cacheKey: null,
      result: enabled ? { status: 'complete', legacyStatus: 'success', canonicalStatus: 'success', records: [] } : null,
      legacyDaily: { workouts: [], inbody: { weight: null, smm: null, pbf: null }, routines: [] },
      isolationError: false, retry, managedLifecycle: options?.managedLifecycle };
  },
}));
vi.mock('./views/features/health/useHealthWorkoutRangeSnapshot', () => ({
  useHealthWorkoutRangeSnapshot: (enabled: boolean, accountId: string, previousBounds: unknown, monthBounds: unknown) => {
    const invalidateAndReload = useMemo(() => vi.fn(), [accountId]);
    const retry = useMemo(() => vi.fn(), [accountId]);
    mocks.rangeInvalidateByAccount.set(accountId, invalidateAndReload);
    mocks.rangeRetryByAccount.set(accountId, retry);
    return { phase: enabled ? 'settled' : 'disabled', accountId, previousBounds, monthBounds,
      previousView: null, monthView: null, isolationError: false, retry, invalidateAndReload };
  },
}));
vi.mock('../lib/supabase', () => ({ supabase: { auth: { signOut: vi.fn() } }, authFetch: vi.fn() }));
vi.mock('../lib/noteNavigation', () => ({ registerNotesTabSwitcher: () => () => undefined,
  registerAppTabSwitcher: () => () => undefined, openWorkspaceSearch: vi.fn() }));
vi.mock('../store/useAppStore', () => ({ useAppStore: () => ({ appSettings: { language: 'en', darkMode: false }, updateSetting: mocks.updateSetting }) }));
vi.mock('../store/useNotesStore', () => {
  const state = { notes: [], folders: [], notesAuthorityState: 'LOADED_EMPTY', foldersAuthorityState: 'LOADED_EMPTY', syncError: null,
    initNotesStorage: vi.fn(async () => undefined), bootstrapFromSupabase: vi.fn(async () => undefined), detachNotesStorage: vi.fn() };
  return { useNotesStore: Object.assign((select: (value: typeof state) => unknown) => select(state), { getState: () => state }) };
});
vi.mock('../hooks/useNow', () => ({ useNow: () => ({
  now: { toJSDate: () => new Date('2026-09-29T12:00:00Z') },
  formatDate: (date: Date) => date.toISOString().slice(0, 10), isToday: () => false,
}) }));
vi.mock('../hooks/useToast', () => ({ useToast: () => ({ toast: null, showToast: mocks.showToast }) }));
vi.mock('../hooks/useDaily', () => ({ useDailyData: () => ({ schedules: [], todos: [], todosState: {}, routines: [], workouts: [], inbody: {},
  mutate: mocks.mutateDaily, mutateTodos: mocks.mutateTodos, mutateRoutines: mocks.mutateRoutines, isLoading: false }) }));
vi.mock('../hooks/useStatic', () => ({ useStaticData: () => ({ markedDates: [], healthBlocks: [], healthBlocksState: {}, healthRoutines: [],
  healthRoutinesState: { status: 'READY_EMPTY', validating: false }, weeklySchedules: [], mutate: mocks.mutateStatic }) }));
vi.mock('../theme', () => ({ buildThemeClasses: () => ({}) }));
vi.mock('./common/Sidebar', () => ({ Sidebar: ({ setActiveTab }: { setActiveTab: (tab: string) => void }) =>
  createElement('button', { type: 'button', 'data-testid': 'nav-health', onClick: () => setActiveTab('health') }, 'Health') }));
vi.mock('./common/ViewLoadingFallback', () => ({ ViewLoadingFallback: () => null }));
vi.mock('./views/HomeView', () => ({ HomeView: () => null }));
vi.mock('./views/PlannerView', () => ({ PlannerView: () => null }));
vi.mock('./views/HealthView', () => ({ HealthView: (props: Record<string, unknown>) => {
  mocks.healthProps.push(props);
  return createElement('div', { 'data-testid': 'health-view' });
} }));
vi.mock('./views/AnalyticsView', () => ({ AnalyticsView: () => null }));
vi.mock('./views/SettingsView', () => ({ SettingsView: () => null }));
vi.mock('./views/RecipeView', () => ({ RecipeView: () => null }));
vi.mock('./views/features/search/GlobalSearchHost', () => ({ GlobalSearchHost: () => null }));
vi.mock('../lib/migrateLegacyDdays', () => ({ migrateLegacyDdays: vi.fn(async () => undefined) }));
vi.mock('../lib/vaultSnapshotAuto', () => ({ runPeriodicSnapshotSlots: vi.fn() }));
vi.mock('../lib/i18n', () => ({ useTranslation: () => ({ t: (key: string) => key, lang: 'en' }) }));
vi.mock('../lib/healthSupabaseBootstrap', () => ({ bootstrapHealthFromSupabase: vi.fn(async () => undefined),
  HEALTH_LOCAL_BOOTSTRAP_COMPLETE_EVENT: 'health-bootstrap-complete' }));
vi.mock('../lib/workoutRuntimeAuthority', () => ({ createProductionWorkoutRuntimeAuthorityController: () => ({
  start: vi.fn(async () => ({ kind: 'retry_later' })), cancel: vi.fn(),
}) }));

const user = (id: string) => ({ id, email: `${id}@example.com` } as never);
const workout = { id: 'temp-workout', block_id: 'bench',
  exercise_blocks: { id: 'bench', name: 'Bench', type: 'strength', tags: [] },
  sets: [{ type: 'strength', set: 1, kg: '20', reps: '5', done: true }] } as never;
function deferredVoid() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  return { promise, resolve };
}
let root: Root | null;
let host: HTMLDivElement;

async function mountA() {
  const { AppContent } = await import('./AppContent');
  await act(async () => {
    root = createRoot(host);
    root.render(createElement(AppContent, { authUser: user('account-a') }));
  });
  await act(async () => host.querySelector<HTMLButtonElement>('[data-testid="nav-health"]')!.click());
  return AppContent;
}

beforeEach(() => {
  host = document.createElement('div'); document.body.appendChild(host);
  root = null; mocks.healthProps.length = 0; mocks.selectedRetryByAccount.clear();
  mocks.rangeInvalidateByAccount.clear(); mocks.rangeRetryByAccount.clear();
  mocks.mutateDaily.mockClear(); mocks.mutateStatic.mockClear();
});
afterEach(() => { if (root) act(() => root?.unmount()); root = null; host.remove(); });

describe('AppContent Workout range freshness owner', () => {
  it('fans actual durable save/delete commits to range first and B1 second, with no payload', async () => {
    await mountA();
    const props = mocks.healthProps.at(-1)! as { onLocalWorkoutCommitted: (accountId: string) => void };
    const range = mocks.rangeInvalidateByAccount.get('account-a')!;
    const selected = mocks.selectedRetryByAccount.get('account-a')!;
    const repository = { saveWorkouts: vi.fn(async () => [{ id: 'saved', date: '2026-09-29', version: 'v1' }]),
      deleteWorkout: vi.fn(async () => undefined) };
    const dependencies = { createLocalHealthRepository: vi.fn(async () => repository) };
    await act(async () => {
      await saveHealthWorkouts({ mode: 'local', accountId: 'account-a', date: '2026-09-29', workouts: [workout],
        dependencies, onLocalCommit: () => props.onLocalWorkoutCommitted('account-a') });
      await deleteHealthWorkout({ mode: 'local', accountId: 'account-a', workoutId: 'saved', expectedVersion: 'v1',
        dependencies, onLocalCommit: () => props.onLocalWorkoutCommitted('account-a') });
    });
    expect(range).toHaveBeenCalledTimes(2);
    expect(selected).toHaveBeenCalledTimes(2);
    expect(range.mock.invocationCallOrder[0]).toBeLessThan(selected.mock.invocationCallOrder[0]!);
    expect(range.mock.calls[0]).toEqual([]);
    expect(selected.mock.calls[0]).toEqual([]);
  });

  it('routes A1→B→A2 late commits to current A2, while A1→B and sign-out are ignored', async () => {
    const AppContent = await mountA();
    const oldCommit = (mocks.healthProps.at(-1)! as { onLocalWorkoutCommitted: (accountId: string) => void }).onLocalWorkoutCommitted;
    const oldRange = mocks.rangeInvalidateByAccount.get('account-a')!;
    const oldSelected = mocks.selectedRetryByAccount.get('account-a')!;
    const saveGate = deferredVoid();
    const deleteGate = deferredVoid();
    let oldOperationCurrent = true;
    const delayedRepository = {
      saveWorkouts: vi.fn(async () => { await saveGate.promise; return [{ id: 'saved', date: '2026-09-29', version: 'v1' }]; }),
      deleteWorkout: vi.fn(async () => { await deleteGate.promise; }),
    };
    const delayedDependencies = { createLocalHealthRepository: vi.fn(async () => delayedRepository) };
    const pendingSave = saveHealthWorkouts({ mode: 'local', accountId: 'account-a', date: '2026-09-29', workouts: [workout],
      dependencies: delayedDependencies, shouldContinue: () => oldOperationCurrent,
      onLocalCommit: () => oldCommit('account-a') });
    const pendingDelete = deleteHealthWorkout({ mode: 'local', accountId: 'account-a', workoutId: 'saved', expectedVersion: 'v1',
      dependencies: delayedDependencies, shouldContinue: () => oldOperationCurrent,
      onLocalCommit: () => oldCommit('account-a') });
    await act(async () => { await Promise.resolve(); });
    await act(async () => root!.render(createElement(AppContent, { authUser: user('account-b') })));
    oldOperationCurrent = false;
    const bRange = mocks.rangeInvalidateByAccount.get('account-b')!;
    const bSelected = mocks.selectedRetryByAccount.get('account-b')!;
    oldCommit('account-a');
    expect(bRange).not.toHaveBeenCalled();
    expect(bSelected).not.toHaveBeenCalled();
    await act(async () => root!.render(createElement(AppContent, { authUser: user('account-a') })));
    const currentRange = mocks.rangeInvalidateByAccount.get('account-a')!;
    const currentSelected = mocks.selectedRetryByAccount.get('account-a')!;
    oldRange.mockClear(); oldSelected.mockClear(); currentRange.mockClear(); currentSelected.mockClear();
    let saveResult!: Awaited<typeof pendingSave>;
    let deleteResult!: Awaited<typeof pendingDelete>;
    await act(async () => {
      saveGate.resolve(); deleteGate.resolve();
      [saveResult, deleteResult] = await Promise.all([pendingSave, pendingDelete]);
    });
    expect(saveResult.status).toBe('aborted');
    expect(deleteResult.status).toBe('aborted');
    expect(currentRange).toHaveBeenCalledTimes(2);
    expect(currentSelected).toHaveBeenCalledTimes(2);
    expect(oldRange).not.toHaveBeenCalled();
    expect(oldSelected).not.toHaveBeenCalled();
    act(() => root?.unmount()); root = null;
    currentRange.mockClear(); currentSelected.mockClear();
    oldCommit('account-a');
    expect(currentRange).not.toHaveBeenCalled();
    expect(currentSelected).not.toHaveBeenCalled();
  });

  it('owns one coalesced focus/visibility lifecycle and one bootstrap fanout', async () => {
    await mountA();
    const range = mocks.rangeInvalidateByAccount.get('account-a')!;
    const selected = mocks.selectedRetryByAccount.get('account-a')!;
    range.mockClear(); selected.mockClear();
    act(() => {
      window.dispatchEvent(new Event('focus'));
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(range).toHaveBeenCalledTimes(1);
    expect(selected).toHaveBeenCalledTimes(1);
    act(() => window.dispatchEvent(new Event('health-bootstrap-complete')));
    expect(range).toHaveBeenCalledTimes(2);
    expect(selected).toHaveBeenCalledTimes(2);
    expect(mocks.mutateDaily).toHaveBeenCalledTimes(1);
    expect(mocks.mutateStatic).toHaveBeenCalledTimes(1);
  });
});
