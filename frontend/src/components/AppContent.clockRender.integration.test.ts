// @vitest-environment happy-dom
import { act, createElement, Profiler, StrictMode, useLayoutEffect, type ComponentType } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { getNoteReturnTab, openNote, openWorkspaceSearch, returnFromNote, switchToTab } from '../lib/noteNavigation';
import type { TabId } from './common/Sidebar';
import type { ToastType } from '../hooks/useToast';
import { pushSearchRecent } from './views/features/search/searchRecentStorage';

const fixture = vi.hoisted(() => {
  const empty: never[] = [];
  const mutate = vi.fn();
  const schedules = Array.from({ length: 24 }, (_, index) => ({
    id: `schedule-${index}`, text: `Schedule ${index}`, start_time: '09:00', end_time: '10:00',
    category: 'Study', color: 'blue', is_dday: index % 4 === 0,
  }));
  const healthBlocks = Array.from({ length: 8 }, (_, index) => ({
    id: `exercise-${index}`, name: `Exercise ${index}`, type: 'strength',
  }));
  const workouts = healthBlocks.map(block => ({
    id: `workout-${block.id}`, block_id: block.id, exercise_blocks: block,
    sets: Array.from({ length: 4 }, (_, index) => ({
      type: 'strength', set: index + 1, kg: '40', reps: '10', done: true,
    })),
  }));
  const recipes = Array.from({ length: 24 }, (_, index) => ({
    id: `recipe-${index}`, title: `Recipe ${index}`, category: 'Korean',
    ingredients: 'Rice', steps: 'Steam', memo: '', starred: false, created_at: '2026-11-14T00:00:00Z',
  }));
  return {
    empty, mutate, counts: {} as Record<string, number>,
    lastRead: null as { accountId: string; date: string } | null,
    homeClockMs: null as number | null,
    toast: null as ((message: string, type?: ToastType) => void) | null,
    authFetch: vi.fn(async () => { throw new Error('Unexpected authenticated I/O in clock fixture'); }),
    daily: {
      schedules, todos: empty, routines: empty, workouts, inbody: { weight: 0, smm: 0, pbf: 0 },
      mutate, mutateTodos: mutate, mutateRoutines: mutate, revalidateSelectedDaySchedules: mutate,
      isLoading: false, isScheduleLoading: false,
    },
    staticData: { markedDates: empty, healthBlocks, healthRoutines: empty, weeklySchedules: empty, mutate },
    swr: { data: empty, mutate, isLoading: false, isValidating: false },
    protein: { profile: null, sources: empty, intakeLogs: empty, rangeLogs: empty },
    recipes,
    note: { id: 'fixture-note', title: 'Fixture note', body: '', updatedAt: 1, folderId: null, deletedAt: null },
  };
});

function count(name: string) { fixture.counts[name] = (fixture.counts[name] ?? 0) + 1; }

// Route renders driven by AppContent are counted here. Profiler also observes
// commits caused by internal state in the real workspace subtree.
function measured<P extends object>(name: string, View: ComponentType<P>) {
  return function MeasuredView(props: P) {
    count(`${name}.render`);
    return createElement(Profiler, { id: name, onRender: () => count(`${name}.commit`) }, createElement(View, props));
  };
}

vi.mock('../lib/supabase', () => ({
  supabase: { auth: { signOut: vi.fn() } },
  authFetch: fixture.authFetch,
}));
vi.mock('../hooks/useDaily', () => ({
  useDailyData: (date: string, toast: NonNullable<typeof fixture.toast>, accountId: string) => {
    count('shell.render');
    useLayoutEffect(() => { count('shell.commit'); });
    fixture.lastRead = { accountId, date };
    fixture.toast = toast;
    return fixture.daily;
  },
}));
vi.mock('../hooks/useStatic', () => ({ useStaticData: () => fixture.staticData }));
vi.mock('../lib/migrateLegacyDdays', () => ({ migrateLegacyDdays: vi.fn(async () => undefined) }));
vi.mock('../lib/vaultSnapshotAuto', () => ({ runPeriodicSnapshotSlots: vi.fn() }));
vi.mock('../lib/healthSupabaseBootstrap', () => ({
  bootstrapHealthFromSupabase: vi.fn(async () => undefined),
  HEALTH_LOCAL_BOOTSTRAP_COMPLETE_EVENT: 'health-bootstrap-complete',
}));
vi.mock('../lib/workoutRuntimeAuthority', () => ({
  createProductionWorkoutRuntimeAuthorityController: () => ({ start: vi.fn(), cancel: vi.fn() }),
}));
vi.mock('swr', () => ({
  default: (key: string | readonly string[] | null) => {
    if (Array.isArray(key) && key[0] === 'local-health-protein') return { ...fixture.swr, data: fixture.protein };
    if (typeof key === 'string' && key.includes('/api/recipes\0')) return { ...fixture.swr, data: fixture.recipes };
    return fixture.swr;
  },
  useSWRConfig: () => ({ mutate: fixture.mutate }),
}));
vi.mock('../store/useNotesStore', async importOriginal => {
  const actual = await importOriginal<typeof import('../store/useNotesStore')>();
  actual.useNotesStore.setState({
    notes: [fixture.note], notesAuthorityState: 'LOADED_POPULATED', foldersAuthorityState: 'LOADED_EMPTY',
    setActiveNoteId: activeNoteId => actual.useNotesStore.setState({ activeNoteId }),
    initNotesStorage: vi.fn(async () => undefined),
    bootstrapFromSupabase: vi.fn(async () => undefined),
    detachNotesStorage: vi.fn(),
  });
  return actual;
});
vi.mock('../hooks/useElementVisible', () => ({ useElementVisible: () => ({ ref: { current: null }, visible: true }) }));
vi.mock('./views/features/health/prevWorkoutFetch', () => ({ fetchPrevWorkoutForBlocks: vi.fn(async () => ({})) }));
vi.mock('./views/HomeView', async importOriginal => {
  const actual = await importOriginal<typeof import('./views/HomeView')>();
  const MeasuredHome = measured('home', actual.HomeView);
  return { ...actual, HomeView: (props: import('./views/HomeView').HomeViewProps) => {
    fixture.homeClockMs = props.now.toMillis();
    return createElement(MeasuredHome, props);
  } };
});
vi.mock('./views/PlannerView', async importOriginal => {
  const actual = await importOriginal<typeof import('./views/PlannerView')>();
  return { ...actual, PlannerView: measured('planner', actual.PlannerView) };
});
vi.mock('./views/HealthView', async importOriginal => {
  const actual = await importOriginal<typeof import('./views/HealthView')>();
  return { ...actual, HealthView: measured('health', actual.HealthView) };
});
vi.mock('./views/RecipeView', async importOriginal => {
  const actual = await importOriginal<typeof import('./views/RecipeView')>();
  return { ...actual, RecipeView: measured('recipe', actual.RecipeView) };
});
vi.mock('./views/SettingsView', async importOriginal => {
  const actual = await importOriginal<typeof import('./views/SettingsView')>();
  return { ...actual, SettingsView: measured('settings', actual.SettingsView) };
});
vi.mock('./views/NoteView', async importOriginal => {
  const actual = await importOriginal<typeof import('./views/NoteView')>();
  return { ...actual, NoteView: measured('note', actual.NoteView) };
});
vi.mock('./views/features/planner/calendar-ui/CalendarShell', async importOriginal => {
  const actual = await importOriginal<typeof import('./views/features/planner/calendar-ui/CalendarShell')>();
  return { ...actual, CalendarShell: measured('plannerCalendar', actual.CalendarShell) };
});
vi.mock('./views/features/health/WorkoutMonthCalendar', async importOriginal => {
  const actual = await importOriginal<typeof import('./views/features/health/WorkoutMonthCalendar')>();
  return { ...actual, WorkoutMonthCalendar: measured('healthCalendar', actual.WorkoutMonthCalendar) };
});
vi.mock('./views/features/recipe/components/RecipeStudioView', async importOriginal => {
  const actual = await importOriginal<typeof import('./views/features/recipe/components/RecipeStudioView')>();
  return { ...actual, RecipeStudioView: measured('recipeStudio', actual.RecipeStudioView) };
});
vi.mock('./views/features/planner/calendar', async importOriginal => {
  const actual = await importOriginal<typeof import('./views/features/planner/calendar')>();
  return {
    ...actual,
    buildPlannerCalendarProjection: (...args: Parameters<typeof actual.buildPlannerCalendarProjection>) => {
      count('calendar.projection');
      return actual.buildPlannerCalendarProjection(...args);
    },
  };
});
vi.mock('./views/buildRecentActivityProjection', async importOriginal => {
  const actual = await importOriginal<typeof import('./views/buildRecentActivityProjection')>();
  return {
    ...actual,
    buildRecentActivityProjection: (...args: Parameters<typeof actual.buildRecentActivityProjection>) => {
      count('recentActivity.projection');
      return actual.buildRecentActivityProjection(...args);
    },
  };
});
vi.mock('./views/features/health/buildHealthProjection', async importOriginal => {
  const actual = await importOriginal<typeof import('./views/features/health/buildHealthProjection')>();
  return {
    ...actual,
    buildHealthProjection: (...args: Parameters<typeof actual.buildHealthProjection>) => {
      count('health.projection');
      return actual.buildHealthProjection(...args);
    },
  };
});

let host: HTMLDivElement;
let root: Root;

async function settle() { await act(async () => { await vi.dynamicImportSettled(); }); }
async function perform(action: () => void) {
  await act(async () => { action(); });
  await settle();
}
async function render(accountId = 'clock-a', strict = false) {
  const { AppContent } = await import('./AppContent');
  const app = createElement(AppContent, { authUser: { id: accountId, email: `${accountId}@example.test` } as never });
  await perform(() => root.render(strict ? createElement(StrictMode, null, app) : app));
}
async function sample(action: () => void) {
  fixture.counts = {};
  await perform(action);
  return { ...fixture.counts };
}
const tick = () => vi.advanceTimersByTime(60_000);
const select = (tab: TabId) => switchToTab(tab);
const viewSelectors = {
  home: '[data-workspace="home"]',
  planner: '[data-planner-calendar-shell]',
  health: '[data-health-workout-calendar]',
  note: '[data-workspace="notes"]',
  recipe: '[data-k110-recipe-studio]',
  settings: '[data-workspace="settings"]',
} satisfies Partial<Record<TabId, string>>;
const tabs = Object.keys(viewSelectors) as Array<keyof typeof viewSelectors>;

beforeAll(async () => {
  // The scenarios measure the mounted workspaces, not cold module load or
  // Suspense reveal timing. Keep those outside the fake clock and counters.
  await Promise.all([
    import('./views/HomeView'),
    import('./views/PlannerView'),
    import('./views/HealthView'),
    import('./views/NoteView'),
    import('./views/RecipeView'),
    import('./views/SettingsView'),
  ]);
}, 30_000);

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 10, 14, 23, 58, 30));
  localStorage.clear();
  sessionStorage.clear();
  fixture.counts = {};
  fixture.lastRead = null;
  vi.clearAllMocks();
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.useRealTimers();
});

describe('AppContent clock render measurement', () => {
  it.each(tabs)('records the same tick, rollover and shell-update scenarios on %s', async tab => {
    await render();
    const navigation = tab === 'home' ? await sample(() => {}) : await sample(() => select(tab));
    const readDay = fixture.lastRead;
    expect(readDay).toEqual({ accountId: 'clock-a', date: '2026-11-14' });
    if (tab !== 'home') expect(navigation[`${tab}.commit`]).toBeGreaterThan(0);
    expect(host.querySelector(viewSelectors[tab])).not.toBeNull();
    expect(host.querySelector('[data-k120-workspace-error]')).toBeNull();

    const minute = await sample(tick);
    const midnight = await sample(tick);
    const toast = await sample(() => fixture.toast!('Unrelated shell toast', 'info'));
    expect(fixture.lastRead).toEqual(readDay);
    expect(midnight['shell.render']).toBeGreaterThan(0);
    expect(midnight[`${tab}.commit`]).toBeGreaterThan(0);
    expect(toast[`${tab}.commit`]).toBeGreaterThan(0);
    expect(host.textContent).toContain('Unrelated shell toast');
    expect(host.querySelector('[data-k120-workspace-error]')).toBeNull();
    expect(fixture.authFetch).not.toHaveBeenCalled();
    expect(fixture.mutate).not.toHaveBeenCalled();
    // Emit the counters before asserting the optimization so the same
    // fixture can also measure the baseline without changing its actions.
    console.info('CLOCK_RENDERS', JSON.stringify({ tab, navigation, minute, midnight, toast }));
    if (tab === 'planner' || tab === 'health' || tab === 'recipe') {
      expect(minute).toEqual({});
    } else {
      expect(minute['shell.render']).toBe(1);
      expect(minute[`${tab}.commit`]).toBeGreaterThan(0);
    }
  });

  it('keeps the selected date and Note return target on a calendar interaction after midnight', async () => {
    await render();
    await perform(() => select('planner'));
    const today = () => host.querySelector<HTMLButtonElement>('[data-planner-calendar-nav-today]');
    expect(today()).toBeNull();
    const cell = (date: string) => host.querySelector(`[data-planner-month-cell="${date}"]`);
    expect(cell('2026-11-14')?.classList.contains('ring-2')).toBe(true);
    await perform(tick);
    await perform(tick);
    expect(cell('2026-11-14')?.classList.contains('ring-2')).toBe(false);
    expect(cell('2026-11-15')?.classList.contains('ring-2')).toBe(true);
    expect(today()).not.toBeNull();
    const selectedDate = await sample(() => today()!.click());
    expect(fixture.lastRead).toEqual({ accountId: 'clock-a', date: '2026-11-15' });
    await perform(() => openNote('fixture-note', { returnTab: 'planner' }));
    expect(host.querySelector('[data-workspace="notes"]')).not.toBeNull();
    expect(getNoteReturnTab()).toBe('planner');
    await perform(tick);
    await perform(() => { expect(returnFromNote()).toBe(true); });
    expect(getNoteReturnTab()).toBeNull();
    expect(fixture.lastRead).toEqual({ accountId: 'clock-a', date: '2026-11-15' });
    expect(today()).toBeNull();
    console.info('CLOCK_SELECTED_DATE', JSON.stringify(selectedDate));
  });

  it.each(['before', 'after'] as const)('keeps Planner Today current when the latest tick is %s the timezone switch', async tickPosition => {
    vi.stubEnv('TZ', 'Asia/Seoul');
    try {
      vi.setSystemTime(new Date('2026-11-13T15:10:00Z')); // Nov 14, 00:10 in Seoul
      expect(new Date().getTimezoneOffset()).toBe(-540);
      await render();
      await perform(() => select('planner'));
      const today = () => host.querySelector<HTMLButtonElement>('[data-planner-calendar-nav-today]');
      expect(today()).toBeNull();

      vi.setSystemTime(new Date('2026-11-14T00:09:00Z'));
      if (tickPosition === 'before') await perform(tick);
      vi.stubEnv('TZ', 'UTC');
      expect(new Date().getTimezoneOffset()).toBe(0);
      if (tickPosition === 'after') await perform(tick);
      // A stable date string alone is not evidence that the old sample is
      // safe: CalendarPeriodNav now interprets that instant in UTC.
      await perform(() => fixture.toast!('Unrelated shell update'));
      expect(fixture.lastRead).toEqual({ accountId: 'clock-a', date: '2026-11-14' });
      expect(today()).toBeNull();

      await perform(() => host.querySelector<HTMLElement>('[data-planner-month-cell="2026-11-13"]')!.click());
      expect(fixture.lastRead?.date).toBe('2026-11-13');
      await perform(() => today()!.click());
      expect(fixture.lastRead?.date).toBe('2026-11-14');
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('moves the Health today marker at midnight without selecting a different workout date', async () => {
    await render();
    await perform(() => select('health'));
    const day = (date: number) => [...host.querySelectorAll<HTMLButtonElement>('[data-health-workout-calendar] button')]
      .find(button => button.textContent?.trim() === String(date))!;
    expect(day(14).querySelector('.bg-primary.text-primary-foreground')).not.toBeNull();
    expect(day(15).querySelector('.ring-2')).toBeNull();
    await perform(tick);
    await perform(tick);
    expect(day(14).querySelector('.bg-primary.text-primary-foreground')).not.toBeNull();
    expect(day(15).querySelector('.ring-2')).not.toBeNull();
    const selectedDate = await sample(() => day(15).click());
    expect(fixture.lastRead).toEqual({ accountId: 'clock-a', date: '2026-11-15' });
    expect(day(15).querySelector('.bg-primary.text-primary-foreground')).not.toBeNull();
    console.info('CLOCK_HEALTH_SELECTED_DATE', JSON.stringify(selectedDate));
  });

  it('preserves the minute label for open Search even when launched from Recipe', async () => {
    vi.setSystemTime(new Date(2026, 10, 14, 12));
    pushSearchRecent({ domain: 'recipe', kind: 'recipe', id: 'recipe-0', title: 'Recipe 0' }, 'clock-a');
    await render();
    await perform(() => select('recipe'));
    await perform(openWorkspaceSearch);
    const recent = () => host.querySelector('[data-k111-recent-row]')?.textContent;
    expect(recent()).toContain('now');
    await perform(tick);
    expect(recent()).toContain('1m');
    await perform(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })));
    expect(host.querySelector('[data-k111-recent-row]')).toBeNull();
    expect((await sample(tick))['shell.render'] ?? 0).toBe(0);
    await perform(openWorkspaceSearch);
    await render('clock-b');
    expect(host.querySelector('[data-k111-recent-row]')).toBeNull();
    expect((await sample(tick))['shell.render'] ?? 0).toBe(0);
    await render('clock-a');
    expect(host.querySelector('[data-k111-recent-row]')).toBeNull();
    expect((await sample(tick))['shell.render'] ?? 0).toBe(0);
  });

  it('uses the last sampled instant on return to Home, without resetting the clock cadence', async () => {
    vi.setSystemTime(new Date(2026, 10, 14, 12));
    const initial = Date.now();
    await render();
    expect(fixture.homeClockMs).toBe(initial);
    await perform(() => select('recipe'));
    await perform(tick);
    await perform(() => vi.advanceTimersByTime(30_000));
    const homeReturn = await sample(() => select('home'));
    expect(fixture.homeClockMs).toBe(initial + 60_000);
    expect(homeReturn['recentActivity.projection']).toBe(1);
    await perform(() => vi.advanceTimersByTime(30_000));
    expect(fixture.homeClockMs).toBe(initial + 120_000);
  });

  it('uses one live clock through StrictMode, tab switches and A→B→A, then clears it on unmount', async () => {
    const start = vi.spyOn(globalThis, 'setInterval');
    const stop = vi.spyOn(globalThis, 'clearInterval');
    try {
      const clockTimers = () => start.mock.calls.flatMap(([, delay], index) =>
        delay === 60_000 ? [start.mock.results[index]!.value] : []);
      await render('clock-a', true);
      await perform(() => select('health'));
      await render('clock-b', true);
      expect(fixture.lastRead).toEqual({ accountId: 'clock-b', date: '2026-11-14' });
      await perform(tick);
      await render('clock-a', true);
      expect(fixture.lastRead).toEqual({ accountId: 'clock-a', date: '2026-11-14' });
      expect(clockTimers()).toHaveLength(2);
      expect(stop).toHaveBeenCalledWith(clockTimers()[0]);
      expect(stop).not.toHaveBeenCalledWith(clockTimers()[1]);
      await perform(() => root.render(null));
      expect(stop).toHaveBeenCalledWith(clockTimers()[1]);
      expect(await sample(tick)).toEqual({});
    } finally {
      start.mockRestore();
      stop.mockRestore();
    }
  });
});
