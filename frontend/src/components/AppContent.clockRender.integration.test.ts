// @vitest-environment happy-dom
import { act, createElement, Profiler, StrictMode, useLayoutEffect, type ComponentType } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { getNoteReturnTab, openNote, openWorkspaceSearch, returnFromNote, switchToTab } from '../lib/noteNavigation';
import type { TabId } from './common/Sidebar';
import type { ToastType } from '../hooks/useToast';
import { pushSearchRecent } from './views/features/search/searchRecentStorage';
import { recordPlannerActivity } from './views/features/planner/plannerActivityStorage';
import { recordRecipeView } from './views/features/recipe/recipeActivityStorage';
import { resetWorkspaceSearchStateForTests, writeWorkspaceSearchState } from './views/k101WorkspaceSearchState';
import type { NotesAuthorityRequest } from '../lib/notesAccountAuthority';

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
    searchProjectionFirstTitle: null as string | null,
    searchProjectionGeneratedAt: null as string | null,
    searchHostPreviousProps: null as Record<string, unknown> | null,
    lastRead: null as { accountId: string; date: string } | null,
    homeClockMs: null as number | null,
    homePublication: null as NotesAuthorityRequest | null,
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
  return { ...actual, observePublishedNotesHydration: () => fixture.homePublication
    ? { status: 'CURRENT', request: fixture.homePublication }
    : actual.observePublishedNotesHydration() };
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
vi.mock('../lib/i18n', async importOriginal => {
  const actual = await importOriginal<typeof import('../lib/i18n')>();
  type Translator = ReturnType<typeof actual.useTranslation>['t'];
  const wrapped = new WeakMap<Translator, Translator>();
  return { ...actual, useTranslation: () => {
    const { t, lang } = actual.useTranslation();
    let measuredTranslator = wrapped.get(t);
    if (!measuredTranslator) {
      measuredTranslator = key => {
        // The active Notes route calls this private label exactly once per render.
        if (key === 'notesRouteLoadFailed') count('notesBoundary.render');
        return t(key);
      };
      wrapped.set(t, measuredTranslator);
    }
    return { t: measuredTranslator, lang };
  } };
});
vi.mock('./views/noteview/renderDiagnostics', async importOriginal => {
  const actual = await importOriginal<typeof import('./views/noteview/renderDiagnostics')>();
  return { ...actual, useRenderDiagnostic: (label: string) => {
    if (label === 'NoteView') count('note.actualRender');
    actual.useRenderDiagnostic(label);
  } };
});
vi.mock('./views/noteview/NoteViewEditorArea', async importOriginal => {
  const actual = await importOriginal<typeof import('./views/noteview/NoteViewEditorArea')>();
  return { ...actual, NoteViewEditorArea: measured('noteEditor', actual.NoteViewEditorArea) };
});
vi.mock('./views/traceSidebarCounts', async importOriginal => {
  const actual = await importOriginal<typeof import('./views/traceSidebarCounts')>();
  return { ...actual, countTraceMonth: (...args: Parameters<typeof actual.countTraceMonth>) => {
    count('notesTraceMonth.scan');
    return actual.countTraceMonth(...args);
  } };
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
    buildRecentActivityGroups: (...args: Parameters<typeof actual.buildRecentActivityGroups>) => {
      count('recentActivity.projection');
      fixture.counts['recentActivity.notesScanned'] = (fixture.counts['recentActivity.notesScanned'] ?? 0) + args[0].notes.length;
      return actual.buildRecentActivityGroups(...args);
    },
  };
});
vi.mock('./views/k102DateFormat', async importOriginal => {
  const actual = await importOriginal<typeof import('./views/k102DateFormat')>();
  return { ...actual, formatActivityTimestamp: (...args: Parameters<typeof actual.formatActivityTimestamp>) => {
    count('recentActivity.formatted');
    return actual.formatActivityTimestamp(...args);
  } };
});
vi.mock('./views/features/home/buildHomeFoundationProjection', async importOriginal => {
  const actual = await importOriginal<typeof import('./views/features/home/buildHomeFoundationProjection')>();
  return { ...actual, buildHomeFoundationProjection: (...args: Parameters<typeof actual.buildHomeFoundationProjection>) => {
    count('home.foundation');
    return actual.buildHomeFoundationProjection(...args);
  } };
});

vi.mock('./views/features/search/GlobalSearchHost', async importOriginal => {
  const actual = await importOriginal<typeof import('./views/features/search/GlobalSearchHost')>();
  return {
    ...actual,
    GlobalSearchHost: (props: import('./views/features/search/GlobalSearchHost').GlobalSearchHostProps) => {
      const next = props as unknown as Record<string, unknown>;
      const previous = fixture.searchHostPreviousProps;
      if (previous) {
        for (const [key, value] of Object.entries(next)) {
          if (!Object.is(previous[key], value)) count(`searchHost.propChanged.${key}`);
        }
      }
      fixture.searchHostPreviousProps = next;
      return createElement(actual.GlobalSearchHost, props);
    },
  };
});

vi.mock('./views/features/search/hooks/useSearchProjection', async importOriginal => {
  const actual = await importOriginal<typeof import('./views/features/search/hooks/useSearchProjection')>();
  return { ...actual, useSearchProjection: (...args: Parameters<typeof actual.useSearchProjection>) => {
    count('searchHost.render');
    return actual.useSearchProjection(...args);
  } };
});
vi.mock('./views/features/search/components/SearchWorkspacePalette', async importOriginal => {
  const actual = await importOriginal<typeof import('./views/features/search/components/SearchWorkspacePalette')>();
  return {
    ...actual,
    SearchWorkspacePalette: (props: import('./views/features/search/components/SearchWorkspacePalette').SearchWorkspacePaletteProps) => {
      count('searchPalette.render');
      fixture.searchProjectionGeneratedAt = props.projection.generatedAt;
      return createElement(Profiler, { id: 'searchPalette', onRender: () => count('searchPalette.commit') },
        createElement(actual.SearchWorkspacePalette, props));
    },
  };
});
vi.mock('./views/features/search/searchProjectionRuntime', async importOriginal => {
  const actual = await importOriginal<typeof import('./views/features/search/searchProjectionRuntime')>();
  return {
    ...actual,
    buildDiscoveryFeed: (...args: Parameters<typeof actual.buildDiscoveryFeed>) => {
      count('search.discovery');
      return actual.buildDiscoveryFeed(...args);
    },
    buildSearchProjection: (...args: Parameters<typeof actual.buildSearchProjection>) => {
      count('search.projectionBuild');
      fixture.searchProjectionFirstTitle = args[0].notes[0]?.title ?? null;
      return actual.buildSearchProjection(...args);
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
  resetWorkspaceSearchStateForTests();
  fixture.counts = {};
  fixture.searchProjectionFirstTitle = null;
  fixture.searchProjectionGeneratedAt = null;
  fixture.searchHostPreviousProps = null;
  fixture.lastRead = null;
  vi.clearAllMocks();
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  fixture.homePublication = null;
  resetWorkspaceSearchStateForTests();
  host.remove();
  vi.useRealTimers();
});

it.each([250, 1000])('measures closed Global Search work with %i Notes and checks fresh reopen data', async size => {
  const { useNotesStore } = await import('../store/useNotesStore');
  const { notes: previousNotes, folders: previousFolders } = useNotesStore.getState();
  const notes = Array.from({ length: size }, (_, index) => ({
    ...fixture.note,
    id: `search-measure-${index}`,
    title: index === 0 ? 'Initial Search Target' : `Search Fixture ${index}`,
    body: `Body ${index}`,
    folderId: null,
    updatedAt: Date.now() - index,
  }));
  const report: Record<string, Record<string, number>> = {};
  const latestTitle = () => fixture.searchProjectionFirstTitle;
  const updateFirstNote = (patch: Record<string, unknown>) => {
    const current = useNotesStore.getState().notes;
    useNotesStore.setState({ notes: [{ ...current[0]!, ...patch }, ...current.slice(1)] });
  };

  try {
    useNotesStore.setState({ notes, folders: [] });
    await render('clock-a');
    report.mountClosed = { ...fixture.counts };

    report.closedBodyEdit = await sample(() => updateFirstNote({ body: 'Changed while closed' }));
    report.closedTitleFolderChange = await sample(() => {
      updateFirstNote({ title: 'Fresh Search Target', folderId: 'search-measure-folder' });
      useNotesStore.setState({ folders: [{ id: 'search-measure-folder', name: 'Updated Folder' }] as never });
    });
    report.unrelatedShellToast = await sample(() => fixture.toast!('Unrelated shell update'));

    writeWorkspaceSearchState({ query: 'Fresh Search Target', filter: 'all' });
    report.open = await sample(openWorkspaceSearch);
    expect(latestTitle()).toBe('Fresh Search Target');

    report.noteEditWhileOpen = await sample(() => updateFirstNote({ title: 'Live Search Target' }));
    expect(latestTitle()).toBe('Live Search Target');
    report.close = await sample(() => host.querySelector<HTMLButtonElement>('[data-k111-search-modal] button[aria-label]')!.click());
    expect(host.querySelector('[data-k111-search-modal]')).toBeNull();
    report.reopenPersistedQuery = await sample(openWorkspaceSearch);
    expect(host.querySelector<HTMLInputElement>('[data-k111-search-input]')?.value).toBe('Fresh Search Target');
    expect(latestTitle()).toBe('Live Search Target');
    report.closeAfterReopen = await sample(() => host.querySelector<HTMLButtonElement>('[data-k111-search-modal] button[aria-label]')!.click());

    report.closedEditAfterClose = await sample(() => updateFirstNote({ body: 'Updated after closing' }));
    report.unrelatedShellAfterClose = await sample(() => fixture.toast!('Another unrelated update'));
    expect(fixture.authFetch).not.toHaveBeenCalled();
    for (const phase of ['closedBodyEdit', 'closedTitleFolderChange', 'unrelatedShellToast', 'closedEditAfterClose', 'unrelatedShellAfterClose']) {
      expect(report[phase]?.['searchHost.render'] ?? 0, `${phase} host renders at ${size} Notes`).toBe(0);
      expect(report[phase]?.['searchPalette.render'] ?? 0, `${phase} palette renders at ${size} Notes`).toBe(0);
      expect(report[phase]?.['searchPalette.commit'] ?? 0, `${phase} palette commits at ${size} Notes`).toBe(0);
    }
    expect(report.open?.['search.discovery']).toBe(1);
    expect(report.open?.['search.projectionBuild']).toBe(1);
    expect(report.noteEditWhileOpen?.['searchHost.render']).toBe(1);
    expect(report.noteEditWhileOpen?.['search.projectionBuild']).toBe(1);
    console.info('GLOBAL_SEARCH_CLOSED_RENDER_WORK', JSON.stringify({ size, report }));
  } finally {
    await perform(() => root.render(null));
    useNotesStore.setState({ notes: previousNotes, folders: previousFolders });
  }
});

it('keeps a persisted query dormant while Search is closed and restores it on open', async () => {
  writeWorkspaceSearchState({ query: 'Persisted while closed', filter: 'all' });
  await render('clock-a');
  const closedTimer = await sample(() => vi.advanceTimersByTime(100));
  console.info('GLOBAL_SEARCH_PERSISTED_CLOSED_TIMER', JSON.stringify(closedTimer));
  expect(closedTimer['searchHost.render'] ?? 0).toBe(0);
  expect(closedTimer['searchPalette.render'] ?? 0).toBe(0);
  expect(closedTimer['searchPalette.commit'] ?? 0).toBe(0);
  await perform(openWorkspaceSearch);
  expect(host.querySelector<HTMLInputElement>('[data-k111-search-input]')?.value).toBe('Persisted while closed');
  expect(fixture.authFetch).not.toHaveBeenCalled();
});

it.each([250, 1000])('measures Home projection work on the same mounted actions with %i Notes', async size => {
  const { useNotesStore } = await import('../store/useNotesStore');
  const initialNotes = useNotesStore.getState().notes;
  const at = new Date(2026, 10, 14, 22).getTime();
  const notes = Array.from({ length: size }, (_, i) => ({
    ...fixture.note, id: `measure-${i}`, title: `Measured Note ${i}`, updatedAt: at - i * 1000,
    ...(i === 0 ? { lastOpenedAt: at + 1 } : {}),
  }));
  fixture.homePublication = Object.freeze({ accountId: 'clock-a', generation: 1 });
  const trace = (domain: string) => host.querySelector(`[data-k132a-home-row="trace-${domain}"]`)?.textContent;
  const report: Record<string, Record<string, number>> = {};
  try {
    useNotesStore.setState({ notes });
    vi.setSystemTime(new Date(2026, 10, 14, 23, 57, 30));
    fixture.counts = {};
    await render();
    report.mount = { ...fixture.counts };
    const initialTrace = trace('notes');
    expect(initialTrace).toContain('Measured Note 0');
    report.minute1 = await sample(tick);
    report.minute2 = await sample(tick);
    report.toast = await sample(() => fixture.toast!('Unrelated shell update'));
    report.store = await sample(() => useNotesStore.setState({ activeNoteId: 'measure-1' }));
    expect(trace('notes')).toBe(initialTrace);
    report.midnight = await sample(tick);
    expect(trace('notes')).not.toBe(initialTrace);
    expect(trace('notes')).toContain('Measured Note 0');

    report.notes = await sample(() => useNotesStore.setState({
      notes: [{ ...notes[0]!, title: 'Edited Note', updatedAt: Date.now() }, ...notes.slice(1)],
    }));
    expect(trace('notes')).toContain('Edited Note');
    report.planner = await sample(() => {
      recordPlannerActivity('clock-a', 'schedule', 'local-event', 'New Planner activity', Date.now(), '2026-11-16');
      fixture.toast!('Planner cache updated');
    });
    expect(trace('planner')).toContain('New Planner activity');
    report.recipe = await sample(() => {
      recordRecipeView('local-recipe', 'New Recipe activity', 'clock-a');
      tick();
    });
    expect(trace('recipe')).toContain('New Recipe activity');

    report.departure = await sample(() => select('recipe'));
    expect(host.querySelector(viewSelectors.home)).toBeNull();
    recordRecipeView('local-recipe', 'Updated while Home was closed', 'clock-a');
    report.reentry = await sample(() => select('home'));
    expect(trace('recipe')).toContain('Updated while Home was closed');
    const resume = host.querySelector<HTMLButtonElement>('[data-k132a-home-row="continue-primary"]')!;
    expect(resume.textContent).toContain('Edited Note');
    await perform(() => resume.click());
    expect(useNotesStore.getState().activeNoteId).toBe('measure-0');
    expect(getNoteReturnTab()).toBe('home');
    expect(fixture.authFetch).not.toHaveBeenCalled();
    console.info('HOME_PROJECTION_WORK', JSON.stringify({ size, report }));
    for (const phase of ['minute1', 'minute2', 'toast', 'store', 'departure']) {
      expect(report[phase]?.['recentActivity.projection'] ?? 0, phase).toBe(0);
    }
    for (const phase of ['midnight', 'notes', 'planner', 'recipe', 'reentry']) {
      expect(report[phase]?.['recentActivity.projection'], phase).toBe(1);
      expect(report[phase]?.['recentActivity.notesScanned'], phase).toBe(size);
    }
    expect(report.mount?.['recentActivity.projection']).toBeGreaterThan(0);
  } finally {
    fixture.homePublication = null;
    await act(async () => useNotesStore.setState({ notes: initialNotes, activeNoteId: null }));
  }
});

it('refreshes Home trace labels for a same-day, same-offset timezone change and a locale change', async () => {
  const { useAppStore } = await import('../store/useAppStore');
  const initialSettings = useAppStore.getState().appSettings;
  const trace = () => host.querySelector('[data-k132a-home-row="trace-planner"]')?.textContent;
  vi.stubEnv('TZ', 'UTC');
  try {
    vi.setSystemTime(new Date('2026-11-14T12:00:00Z'));
    useAppStore.getState().updateSetting('language', 'en');
    recordPlannerActivity('clock-a', 'schedule', 'event', 'Summer trace',
      Date.parse('2026-07-01T23:30:00Z'), '2026-07-01');
    await render();
    expect(trace()).toContain('Jul 1');
    expect(new Date().getTimezoneOffset()).toBe(0);
    vi.stubEnv('TZ', 'Europe/London');
    expect(new Date().getTimezoneOffset()).toBe(0);
    const zoneChange = await sample(() => fixture.toast!('Timezone changed'));
    expect(zoneChange['recentActivity.projection']).toBe(1);
    expect(trace()).toContain('Jul 2');
    expect(trace()).toContain('2026-07-01'); // The exact Schedule target did not change.
    const localeChange = await sample(() => useAppStore.getState().updateSetting('language', 'ja'));
    expect(localeChange['recentActivity.projection']).toBeGreaterThan(0);
    expect(trace()).toContain('7月2日');
  } finally {
    vi.unstubAllEnvs();
    await act(async () => useAppStore.setState({ appSettings: initialSettings }));
  }
});

it('retains the record time and local day across the repeated DST hour on Home', async () => {
  vi.stubEnv('TZ', 'America/New_York');
  try {
    vi.setSystemTime(new Date('2026-11-01T05:59:30Z')); // 01:59 EDT
    recordRecipeView('dst-recipe', 'DST trace', 'clock-a');
    await render();
    const trace = () => host.querySelector('[data-k132a-home-row="trace-recipe"]')?.textContent;
    const before = trace();
    expect(before).toContain('DST trace');
    expect(new Date().getTimezoneOffset()).toBe(240);
    const fallback = await sample(tick); // 01:00 EST
    expect(new Date().getTimezoneOffset()).toBe(300);
    expect(fallback['recentActivity.projection']).toBe(1);
    expect(trace()).toBe(before);
    const ordinary = await sample(tick);
    expect(ordinary['recentActivity.projection'] ?? 0).toBe(0);
    expect(trace()).toBe(before);
  } finally {
    vi.unstubAllEnvs();
  }
});

describe('AppContent clock render measurement', () => {
  it.each([250, 1000])('measures unrelated Notes shell renders with %i synthetic Notes', async size => {
    const { useNotesStore } = await import('../store/useNotesStore');
    const previous = useNotesStore.getState();
    const notes = Array.from({ length: size }, (_, i) => ({
      ...fixture.note,
      id: `notes-shell-${i}`,
      title: `Shell fixture ${i}`,
      body: `Synthetic body ${i}`,
      updatedAt: Date.now() - i * 60_000,
    }));
    const titleInput = () => host.querySelector<HTMLInputElement>('[data-note-header-title-row] input')!;
    const report: Record<string, Record<string, number>> = {};
    try {
      useNotesStore.setState({ notes, folders: [], activeNoteId: notes[0]!.id });
      await render();
      await perform(() => openNote(notes[0]!.id));
      const title = titleInput();
      expect(title.value).toBe(notes[0]!.title);

      await perform(() => {
        title.focus();
        title.setSelectionRange(1, 4);
      });
      report.toast1 = await sample(() => fixture.toast!('First unrelated toast'));
      expect(host.textContent).toContain('First unrelated toast');
      report.toast2 = await sample(() => fixture.toast!('Second unrelated toast'));
      expect(host.textContent).toContain('Second unrelated toast');
      expect(titleInput()).toBe(title);
      expect(document.activeElement).toBe(title);
      expect([title.selectionStart, title.selectionEnd]).toEqual([1, 4]);

      report.searchOpen = await sample(openWorkspaceSearch);
      expect(host.querySelector('[data-k111-search-modal]')).not.toBeNull();
      report.searchClose = await sample(() =>
        host.querySelector<HTMLButtonElement>('[data-k111-search-modal] button[aria-label]')!.click());
      expect(host.querySelector('[data-k111-search-modal]')).toBeNull();
      expect(titleInput()).toBe(title);

      report.sameDayMinute = await sample(tick);
      expect(titleInput()).toBe(title);
      report.midnight = await sample(tick);
      expect(titleInput()).toBe(title);

      report.sourceEdit = await sample(() => useNotesStore.setState({
        notes: [{ ...notes[0]!, title: 'Updated shell fixture', body: 'Updated body' }, ...notes.slice(1)],
        folders: [{ id: 'notes-shell-folder', name: 'New test folder' }] as never,
      }));
      expect(titleInput().value).toBe('Updated shell fixture');
      expect(host.textContent).toContain('Updated body');
      expect(titleInput().closest('[data-note-header-title-row]')?.textContent).toContain('New test folder');
      expect(fixture.authFetch).not.toHaveBeenCalled();
      expect(fixture.mutate).not.toHaveBeenCalled();
      console.info('NOTES_SHELL_RENDER_WORK', JSON.stringify({ size, report }));
      for (const phase of ['toast1', 'toast2', 'searchOpen', 'searchClose']) {
        expect(report[phase]?.['shell.render'], phase).toBeGreaterThan(0);
        for (const counter of ['notesBoundary.render', 'note.actualRender', 'note.commit', 'notesTraceMonth.scan', 'noteEditor.commit']) {
          expect(report[phase]?.[counter] ?? 0, `${phase} ${counter}`).toBe(0);
        }
      }
      for (const phase of ['sameDayMinute', 'midnight', 'sourceEdit']) {
        expect(report[phase]?.['note.actualRender'], phase).toBeGreaterThan(0);
        expect(report[phase]?.['note.commit'], phase).toBeGreaterThan(0);
      }
    } finally {
      await perform(() => root.render(null));
      useNotesStore.setState({ notes: previous.notes, folders: previous.folders, activeNoteId: previous.activeNoteId });
    }
  });

  it('preserves an in-progress Notes title edit and selection during a shell toast', async () => {
    const { useNotesStore } = await import('../store/useNotesStore');
    const previous = useNotesStore.getState();
    const save = vi.fn<typeof previous.updateNote>();
    const note = { ...fixture.note, id: 'notes-draft-fixture', title: 'Original title' };
    try {
      useNotesStore.setState({ notes: [note], activeNoteId: note.id, updateNote: save });
      await render();
      await perform(() => openNote(note.id));
      const selector = '[data-note-header-title-row] input';
      const input = host.querySelector<HTMLInputElement>(selector)!;
      await perform(() => {
        input.focus();
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, 'Draft title');
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.setSelectionRange(1, 5);
      });
      expect(save).toHaveBeenCalledWith(note.id, { title: 'Draft title' });
      const calls = save.mock.calls.length;
      const toast = await sample(() => fixture.toast!('Do not disturb the editor'));
      expect(toast['note.actualRender'] ?? 0).toBe(0);
      expect(host.querySelector(selector)).toBe(input);
      expect(document.activeElement).toBe(input);
      expect(input.value).toBe('Draft title');
      expect([input.selectionStart, input.selectionEnd]).toEqual([1, 5]);
      expect(save).toHaveBeenCalledTimes(calls);
    } finally {
      await perform(() => root.render(null));
      useNotesStore.setState({ notes: previous.notes, activeNoteId: previous.activeNoteId, updateNote: previous.updateNote });
    }
  });

  it('keeps the Trace day, month, quarter and year current before the next shell clock sample', async () => {
    vi.stubEnv('TZ', 'UTC');
    try {
      vi.setSystemTime(new Date('2026-12-31T23:59:55Z'));
      await render();
      await perform(() => select('note'));
      const click = (selector: string) => perform(() => host.querySelector<HTMLElement>(selector)!.click());
      const value = (label: string) => host.querySelector<HTMLInputElement>(`[aria-label="${label}"]`)?.value;
      await click('[data-trace-quick-nav-toggle]');
      await click('[data-k108-timeline-today]');
      expect(value('Select date')).toBe('2026-12-31');

      // A shell update arrives after midnight, but before the clock's interval fires.
      vi.setSystemTime(new Date('2027-01-01T00:00:05Z'));
      const rollover = await sample(() => fixture.toast!('Midnight between clock samples'));
      expect(rollover['notesBoundary.render']).toBe(1);
      expect(value('Select date')).toBe('2026-12-31'); // No automatic selection change.
      await click('[data-k108-timeline-today]');
      expect(value('Select date')).toBe('2027-01-01');
      await click('[data-k108-timeline-month]');
      expect(value('Select month')).toBe('2027-01');
      await click('[data-k108-timeline-quarter]');
      expect(value('Select quarter')).toBe('1');
      expect(value('Select year')).toBe('2027');
      await click('[data-k108-timeline-year]');
      expect(value('Select year')).toBe('2027');
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('keeps Trace current through a DST tick, timezone change and locale update', async () => {
    const { useAppStore } = await import('../store/useAppStore');
    const { getTranslator } = await import('../lib/i18n');
    const { appSettings } = useAppStore.getState();
    const currentDay = () => host.querySelector<HTMLElement>('[data-k108-timeline-today]')!;
    vi.stubEnv('TZ', 'America/New_York');
    try {
      vi.setSystemTime(new Date('2026-03-08T06:59:30Z'));
      expect(new Date().getTimezoneOffset()).toBe(300);
      await render();
      await perform(() => select('note'));
      await perform(() => host.querySelector<HTMLElement>('[data-trace-quick-nav-toggle]')!.click());
      const dst = await sample(tick);
      expect(new Date().getTimezoneOffset()).toBe(240);
      expect(dst['notesBoundary.render']).toBe(1);
      await perform(() => currentDay().click());
      const traceDate = () => host.querySelector<HTMLInputElement>('[aria-label="Select date"]')?.value;
      expect(traceDate()).toBe('2026-03-08');

      vi.stubEnv('TZ', 'Pacific/Honolulu');
      const zone = await sample(() => fixture.toast!('Zone changed between samples'));
      expect(zone['notesBoundary.render']).toBe(1);
      expect(traceDate()).toBe('2026-03-08');
      await perform(() => currentDay().click());
      expect(traceDate()).toBe('2026-03-07');

      const switchedLanguage = appSettings.language === 'ja' ? 'en' : 'ja';
      await perform(() => useAppStore.setState({ appSettings: { ...appSettings, language: switchedLanguage } }));
      expect(currentDay().textContent).toContain(getTranslator(switchedLanguage)('nvToday'));
      expect(traceDate()).toBe('2026-03-07');
    } finally {
      await perform(() => root.render(null));
      useAppStore.setState({ appSettings });
      vi.unstubAllEnvs();
    }
  });

  it('keeps Notes available when the default timezone lookup fails', async () => {
    await render();
    await perform(() => select('note'));
    const zone = vi.spyOn(Intl, 'DateTimeFormat')
      .mockImplementationOnce(() => { throw new Error('Default timezone unavailable'); });
    try {
      await perform(() => fixture.toast!('Timezone fallback'));
      expect(zone).toHaveBeenCalled();
      expect(host.textContent).toContain('Timezone fallback');
      expect(host.querySelector('[data-workspace="notes"]')).not.toBeNull();
      expect(host.querySelector('[data-testid="notes-route-load-error"]')).toBeNull();
    } finally {
      zone.mockRestore();
    }
  });

  it('refreshes dashboard relative ages between clock samples without rendering NoteView', async () => {
    const { useNotesStore } = await import('../store/useNotesStore');
    const { getTranslator } = await import('../lib/i18n');
    const { useAppStore } = await import('../store/useAppStore');
    const previous = useNotesStore.getState();
    const t = getTranslator(useAppStore.getState().appSettings.language);
    const note = { ...fixture.note, id: 'recent-age-fixture', title: 'Recent age fixture', updatedAt: Date.now() - 59_000 };
    try {
      useNotesStore.setState({ notes: [note], activeNoteId: note.id });
      await render();
      await perform(() => openNote(note.id));
      const toggle = host.querySelector<HTMLElement>('[data-notes-advanced-organization-toggle]');
      if (toggle?.getAttribute('aria-expanded') === 'false') await perform(() => toggle.click());
      const dashboard = [...host.querySelectorAll<HTMLElement>('[data-notes-advanced-organization-content] .bfi > span')]
        .find(item => item.textContent === t('wsDashboard'));
      expect(dashboard).toBeDefined();
      await perform(() => dashboard!.click());
      const recent = () => [...host.querySelectorAll('button')].find(button =>
        button.firstElementChild?.textContent === note.title && button.children.length === 2);
      const row = recent();
      expect(row?.textContent).toContain(t('wsEdited').replace('{time}', '방금'));

      vi.setSystemTime(new Date(Date.now() + 5_000));
      const shell = await sample(() => fixture.toast!('Dashboard age crossed a threshold'));
      expect(shell['shell.render']).toBe(1);
      expect(shell['notesBoundary.render'] ?? 0).toBe(0);
      expect(shell['note.actualRender'] ?? 0).toBe(0);
      expect(recent()).toBe(row);
      expect(row?.textContent).toContain(t('wsEdited').replace('{time}', '1분 전'));
    } finally {
      await perform(() => root.render(null));
      useNotesStore.setState({ notes: previous.notes, activeNoteId: previous.activeNoteId });
    }
  });

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
    if (tab === 'note') {
      expect(toast['note.commit'] ?? 0).toBe(0);
    } else {
      expect(toast[`${tab}.commit`]).toBeGreaterThan(0);
    }
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

it('uses render-time clock when results change between shell clock samples', async () => {
  vi.setSystemTime(new Date(2026, 10, 14, 23, 58, 30));
  const { useNotesStore } = await import('../store/useNotesStore');
  const { notes: previousNotes, folders: previousFolders } = useNotesStore.getState();
  const matchingNotes = [
    { ...fixture.note, id: 'search-result-a', title: 'Target Alpha', updatedAt: Date.now() },
    { ...fixture.note, id: 'search-result-b', title: 'Target Beta', updatedAt: Date.now() - 1 },
  ];

  try {
    useNotesStore.setState({ notes: matchingNotes, folders: [] });
    writeWorkspaceSearchState({ query: 'Target', filter: 'all' });
    await render('clock-a');
    await perform(openWorkspaceSearch);
    const sampledClockMs = fixture.searchHostPreviousProps?.searchNowMs;
    const input = host.querySelector<HTMLInputElement>('[data-k111-search-input]')!;
    expect(input.getAttribute('aria-activedescendant')).toBe('k111-search-opt-0');
    await perform(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })));
    expect(input.getAttribute('aria-activedescendant')).toBe('k111-search-opt-1');
    const previousGeneratedAt = fixture.searchProjectionGeneratedAt;

    // Change the actual instant without advancing AppContent's minute sample.
    vi.setSystemTime(new Date(Date.now() + 5_000));
    await perform(() => useNotesStore.setState({ notes: [{ ...matchingNotes[0]!, title: 'Target Updated' }] }));

    expect(fixture.searchHostPreviousProps?.searchNowMs).toBe(sampledClockMs);
    expect(fixture.searchProjectionGeneratedAt).not.toBe(previousGeneratedAt);
    expect(input.getAttribute('aria-activedescendant')).toBe('k111-search-opt-0');
  } finally {
    await perform(() => root.render(null));
    useNotesStore.setState({ notes: previousNotes, folders: previousFolders });
  }
});

it('uses the current local day when Search opens between shell clock samples', async () => {
  vi.setSystemTime(new Date(2026, 10, 14, 23, 59, 55));
  pushSearchRecent({ domain: 'recipe', kind: 'recipe', id: 'midnight-recent', title: 'Previous day recent' }, 'clock-a');
  await render('clock-a');

  vi.setSystemTime(new Date(2026, 10, 15, 0, 0, 5));
  await perform(openWorkspaceSearch);

  expect(host.querySelector('[data-k111-recent-bucket="today"]')).toBeNull();
  expect(host.querySelector('[data-k111-recent-bucket="earlier"]')).not.toBeNull();
  expect(host.querySelector('[data-k111-recent-row]')?.textContent).toContain('now');
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
