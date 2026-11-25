// @vitest-environment happy-dom
import { act, createElement, Profiler, type ComponentProps } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import type { LocalHealthDailyProjection } from '../lib/healthLocalRuntime';
import type { ExerciseBlock, ViewProps, WorkoutSet } from '../types';
import type { RangeWorkoutRow } from './views/features/health/workout/workoutMetrics';

const fixture = vi.hoisted(() => ({
  counts: {} as Record<string, number>,
  imports: 0,
  bootstrap: vi.fn<() => Promise<void>>(),
  daily: vi.fn<(account: string, date: string) => Promise<LocalHealthDailyProjection>>(),
  library: vi.fn<(account: string) => Promise<{ healthBlocks: ExerciseBlock[]; healthRoutines: [] }>>(),
  month: vi.fn<(account: string, start: string, end: string) => Promise<RangeWorkoutRow[]>>(),
  previous: vi.fn(async () => ({})),
  protein: vi.fn(async () => ({ profile: null, sources: [], intakeLogs: [], rangeLogs: [] })),
  network: vi.fn(async () => { throw new Error('Unexpected network in synthetic Health entry'); }),
}));

vi.mock('../lib/supabase', () => ({
  supabase: { auth: { signOut: vi.fn() } }, authFetch: fixture.network, authReadFetch: fixture.network,
}));
vi.mock('../lib/healthSupabaseBootstrap', () => ({
  bootstrapHealthFromSupabase: fixture.bootstrap, HEALTH_LOCAL_BOOTSTRAP_COMPLETE_EVENT: 'health-bootstrap-complete',
}));
vi.mock('../lib/workoutRuntimeAuthority', () => ({
  createProductionWorkoutRuntimeAuthorityController: () => ({ start: vi.fn(), cancel: vi.fn() }),
}));
vi.mock('../lib/migrateLegacyDdays', () => ({ migrateLegacyDdays: vi.fn(async () => undefined) }));
vi.mock('../lib/vaultSnapshotAuto', () => ({ runPeriodicSnapshotSlots: vi.fn() }));
vi.mock('../store/useNotesStore', async importOriginal => {
  const actual = await importOriginal<typeof import('../store/useNotesStore')>();
  actual.useNotesStore.setState({
    notesAuthorityState: 'LOADED_EMPTY', foldersAuthorityState: 'LOADED_EMPTY',
    initNotesStorage: vi.fn(async () => undefined), bootstrapFromSupabase: vi.fn(async () => undefined),
    detachNotesStorage: vi.fn(),
  });
  return actual;
});
vi.mock('../lib/healthLocalRuntime', async importOriginal => ({
  ...await importOriginal<typeof import('../lib/healthLocalRuntime')>(),
  readLocalHealthDaily: fixture.daily,
  readLocalHealthStatic: fixture.library,
  readLocalHealthWorkoutRange: fixture.month,
  readLocalHealthProtein: fixture.protein,
}));
vi.mock('../hooks/useElementVisible', () => ({ useElementVisible: () => ({ ref: { current: null }, visible: true }) }));
vi.mock('./views/features/health/prevWorkoutFetch', () => ({ fetchPrevWorkoutForBlocks: fixture.previous }));

function count(name: string) { fixture.counts[name] = (fixture.counts[name] ?? 0) + 1; }

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}

const account = 'health-entry-fixture';
const day = '2026-11-14';
function sets(length: number): WorkoutSet[] {
  return Array.from({ length }, (_, index) => ({ type: 'strength', set: index + 1, kg: '50', reps: '8', done: true }));
}

function monthRows(size: number, setCount: number, updated = false): RangeWorkoutRow[] {
  return Array.from({ length: size }, (_, index) => {
    // Six exercises per session, with duplicate dates. Two rows cannot mark a date.
    const date = index === size - 1 ? undefined : index === size - 2 ? ''
      : updated && index < 6 ? '2026-11-28' : `2026-11-${String(1 + Math.floor(index / 6)).padStart(2, '0')}`;
    const workoutSets = sets(setCount);
    return {
      get date() { count('monthDateReads'); return date; },
      get sets() { count('monthSetCollections'); return workoutSets; },
      exercise_blocks: { name: `Exercise ${index % 6}` },
    };
  });
}

function readCounts() {
  return {
    daily: fixture.daily.mock.calls.length,
    library: fixture.library.mock.calls.length,
    month: fixture.month.mock.calls.length,
    previous: fixture.previous.mock.calls.length,
    protein: fixture.protein.mock.calls.length,
    remote: fixture.network.mock.calls.length,
  };
}

let host: HTMLDivElement;
let root: Root;
afterEach(() => {
  if (root) act(() => root.unmount());
  host?.remove();
  vi.doUnmock('./views/HealthView');
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it.each([{ size: 18, setsPerRow: 3 }, { size: 144, setsPerRow: 4 }])(
  'measures cold, warm and updated Health entry with $size month rows',
  async ({ size, setsPerRow }) => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    vi.stubGlobal('fetch', fixture.network);
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 14, 12));
    fixture.imports = 0;

    const bootstrap = deferred<void>();
    const chunk = deferred<void>();
    const loaded = deferred<void>();
    const firstDay = deferred<LocalHealthDailyProjection>();
    const firstMonth = deferred<RangeWorkoutRow[]>();
    vi.doMock('./views/HealthView', async importOriginal => {
      fixture.imports++;
      // Control module availability without pre-importing the view.
      const module = chunk.promise.then(() => importOriginal<typeof import('./views/HealthView')>());
      loaded.resolve(module.then(() => undefined));
      const { HealthView } = await module;
      return { HealthView: (props: ViewProps) => {
        count('routeRenders'); // AppContent-driven renders; Profiler includes internal commits.
        return createElement(Profiler, { id: 'health', onRender: () => count('commits') }, createElement(HealthView, props));
      } };
    });

    const blocks: ExerciseBlock[] = Array.from({ length: 6 }, (_, index) => ({
      id: `exercise-${index}`, name: `Fixture exercise ${index}`, type: 'strength', tags: [],
    }));
    const daily = (count: number): LocalHealthDailyProjection => ({
      workouts: blocks.slice(0, count).map(block => ({
        id: `workout-${block.id}`, block_id: block.id, exercise_blocks: block, sets: sets(setsPerRow),
      })),
      inbody: { weight: null, smm: null, pbf: null }, routines: [],
    });
    const original = monthRows(size, setsPerRow);
    fixture.bootstrap.mockReturnValue(bootstrap.promise);
    fixture.daily.mockReturnValue(firstDay.promise);
    fixture.library.mockResolvedValue({ healthBlocks: blocks, healthRoutines: [] });
    fixture.month.mockReturnValue(firstMonth.promise);

    const { AppContent } = await import('./AppContent');
    const { switchToTab } = await import('../lib/noteNavigation');
    const { SWRConfig, useSWRConfig } = await import('swr');
    let revalidate!: ReturnType<typeof useSWRConfig>['mutate'];
    const swr: ComponentProps<typeof SWRConfig>['value'] = {
      provider: () => new Map(),
      // Attribute row property accesses to rendering, not SWR deep equality.
      compare: Object.is, dedupingInterval: 0, shouldRetryOnError: false,
    };
    function Shell() {
      revalidate = useSWRConfig().mutate;
      return createElement(AppContent, { authUser: { id: account } as ComponentProps<typeof AppContent>['authUser'] });
    }
    function calendarDay(value: number) {
      return [...host.querySelectorAll<HTMLButtonElement>('[data-health-workout-calendar] button')]
        .find(button => button.textContent?.trim() === String(value));
    }
    const marked = (value: number) => !!calendarDay(value)?.querySelector('.rounded-full.w-1.h-1.bg-primary');
    const workspace = () => host.querySelector('[data-workspace="health"]');
    const workoutCards = () => host.querySelectorAll('[data-k126-workout-exercise-card]');
    const settleImports = () => act(async () => { await vi.dynamicImportSettled(); });
    let lastReads = readCounts();
    function sample() {
      const now = readCounts();
      const reads = Object.fromEntries(Object.entries(now).map(([key, value]) => [key, value - lastReads[key as keyof typeof now]]));
      lastReads = now;
      const work = fixture.counts;
      fixture.counts = {};
      return {
        routeRenders: work.routeRenders ?? 0,
        commits: work.commits ?? 0,
        monthDateReads: work.monthDateReads ?? 0,
        monthSetCollections: work.monthSetCollections ?? 0,
        reads,
      };
    }
    const nextTab = async (tab: 'home' | 'health') => {
      await act(async () => { switchToTab(tab); });
      await settleImports();
    };
    const awaitMonthRead = async (calls: number) => {
      await act(async () => { await vi.waitFor(() => expect(fixture.month).toHaveBeenCalledTimes(calls)); });
    };

    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
    try {
      await act(async () => { root.render(createElement(SWRConfig, { value: swr }, createElement(Shell))); });
      await settleImports();
      expect(host.querySelector('[data-workspace="home"]')).not.toBeNull();
      expect(fixture.imports).toBe(0);
      expect(fixture.month).not.toHaveBeenCalled();
      sample();

      await act(async () => { switchToTab('health'); });
      expect(host.querySelector('[role="status"]')).not.toBeNull();
      expect(workspace()).toBeNull();
      expect(fixture.imports).toBe(0);
      expect(fixture.month).not.toHaveBeenCalled();
      await act(async () => { bootstrap.resolve(); });
      await vi.waitFor(() => expect(fixture.imports).toBe(1));
      expect(workspace()).toBeNull();
      expect(fixture.month).not.toHaveBeenCalled();
      await act(async () => {
        chunk.resolve();
        await loaded.promise;
        await vi.dynamicImportSettled();
      });
      expect(workspace()).not.toBeNull();
      expect(marked(1)).toBe(false);
      expect(workoutCards()).toHaveLength(0);
      expect(fixture.daily).toHaveBeenCalledWith(account, day);
      expect(fixture.month).toHaveBeenCalledExactlyOnceWith(account, '2026-11-01', '2026-11-30');
      const firstUi = sample();

      await act(async () => { firstDay.resolve(daily(2)); firstMonth.resolve(original); });
      expect(marked(1)).toBe(true);
      expect(marked(28)).toBe(false);
      expect(workoutCards()).toHaveLength(2);
      const firstData = sample();

      await nextTab('home');
      expect(workspace()).toBeNull();
      sample();
      await nextTab('health');
      expect(marked(1)).toBe(true);
      await awaitMonthRead(2);
      const warm = sample();

      await nextTab('home');
      expect(workspace()).toBeNull();
      const updatedMonth = deferred<RangeWorkoutRow[]>();
      fixture.month.mockReturnValue(updatedMonth.promise);
      fixture.daily.mockResolvedValue(daily(3));
      // Simulate a current-account durable update, revalidating the existing daily key.
      await act(async () => { await revalidate(['local-health-daily', account, day]); });
      expect(fixture.month).toHaveBeenCalledTimes(2);
      sample();
      await nextTab('health');
      expect(marked(1)).toBe(true);
      expect(workoutCards()).toHaveLength(3);
      expect(workoutCards()[2]?.textContent).toContain('Fixture exercise 2');
      await awaitMonthRead(3);
      await act(async () => { updatedMonth.resolve(monthRows(size, setsPerRow, true)); });
      expect(marked(1)).toBe(false);
      expect(marked(28)).toBe(true);
      const updated = sample();

      await act(async () => { calendarDay(28)!.click(); });
      expect(fixture.daily).toHaveBeenLastCalledWith(account, '2026-11-28');
      expect(marked(28)).toBe(true);
      const dateSelection = sample();
      expect(fixture.month).toHaveBeenCalledTimes(3);
      expect(fixture.imports).toBe(1);
      expect(fixture.network).not.toHaveBeenCalled();

      console.info('HEALTH_ENTRY_WORK', JSON.stringify({ size, setsPerRow, imports: fixture.imports, firstUi, firstData, warm, updated, dateSelection }));
      const phases = [firstUi, firstData, warm, updated, dateSelection];
      expect(phases.map(phase => phase.monthDateReads)).toEqual([0, size, size, 2 * size, 0]);
      expect(phases.map(phase => phase.monthSetCollections)).toEqual([0, 0, 0, 0, 0]);
    } finally {
      // Release gates even on assertion failure; no pending module mocks at teardown.
      bootstrap.resolve();
      chunk.resolve();
      firstDay.resolve(daily(2));
      firstMonth.resolve(original);
      await settleImports();
    }
  }, 30_000,
);
