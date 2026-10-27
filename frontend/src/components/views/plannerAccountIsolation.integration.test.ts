// @vitest-environment happy-dom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { DateTime } from 'luxon';
import useSWR, { SWRConfig } from 'swr';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { accountBoundRemoteFetcher, accountBoundRemoteKey } from '../../lib/accountBoundRemote';
import { HomeView } from './HomeView';
import { PlannerView } from './PlannerView';
import { switchToTab } from '../../lib/noteNavigation';
import {
  PLANNER_ACTIVITY_KEY,
  readPlannerActivityRecents,
  recordPlannerActivity,
} from './features/planner/plannerActivityStorage';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type PlannerRequest = { url: string; account: string };

const harness = vi.hoisted(() => ({
  account: 'account-a',
  requests: [] as PlannerRequest[],
  notesState: { notes: [], folders: [], vaultStructureVersion: 0 },
  recipeRecents: {} as Record<string, Array<{ recipeId: string; title: string; at: number }>>,
  apiMutation: vi.fn(),
}));

vi.mock('../../lib/config', () => ({ API_URL: 'https://example.invalid' }));
vi.mock('../../lib/remoteBoundary', () => ({ remoteSWRKey: (url: string) => url }));
vi.mock('../../lib/fetcher', () => ({
  fetcher: (input: unknown) => {
    const url = String(input);
    const account = harness.account;
    harness.requests.push({ url, account });
    const parsed = new URL(url);
    const date = parsed.searchParams.get('date') ?? '';
    if (parsed.pathname.endsWith('/schedules/ddays')) {
      return Promise.resolve([{
        id: `dday-${account}`,
        text: `${account} dday`,
        date: '2026-08-20',
        start_time: '00:00',
        end_time: '23:59',
        is_dday: true,
      }]);
    }
    if (parsed.pathname.endsWith('/schedules')) {
      return Promise.resolve([{
        id: `schedule-${account}-${date}`,
        text: `${account} schedule ${date}`,
        date,
        start_time: '10:00',
        end_time: '11:00',
        is_dday: false,
      }]);
    }
    if (parsed.pathname.endsWith('/routines_with_logs')) {
      return Promise.resolve([{ id: `routine-${account}-${date}`, text: `${account} routine`, account }]);
    }
    if (parsed.pathname.endsWith('/workouts')) {
      return Promise.resolve([{ id: `workout-${account}-${date}`, block_id: 'block-1', sets: [], account }]);
    }
    return Promise.resolve([]);
  },
}));
vi.mock('../../lib/i18n', () => ({
  useTranslation: () => ({
    lang: 'en',
    t: (key: string) => ({
      home: 'Home',
      homeSubtitle: 'Home subtitle',
      homeContinue: 'Continue',
      homeContinueEmpty: 'Nothing to continue',
      homeToday: 'Today',
      homeTodayEmpty: 'No schedule',
      homeWorkout: 'Workout',
      homeWorkoutEmpty: 'No workout',
      homeWorkoutEmptyDesc: 'No workout',
      homeOpenHealth: 'Open Health',
      homeRecentTraces: 'Recent traces',
      homeTracesEmpty: 'No traces',
      homeQuickActions: 'Quick actions',
      homeNewNote: 'New note',
      homeOpenSchedule: 'Open schedule',
      homeContinueAction: 'Continue',
      homeOpenNotes: 'Open notes',
      homeOpenWorkout: 'Open workout',
      healthSessionActive: 'Active',
      healthSessionSaved: 'Saved',
      healthSessionExerciseCount: '{count} exercises',
      healthSessionDoneCount: '{count} done',
      k139UpcomingDday: 'Upcoming D-Days',
    }[key] ?? key),
  }),
  resolveAppLanguage: () => 'en',
  getTranslator: () => (key: string) => key,
}));
vi.mock('../../store/useNotesStore', () => {
  const useNotesStore = Object.assign(
    (selector: (state: typeof harness.notesState & { createNote: () => void }) => unknown) => selector({
      ...harness.notesState,
      createNote: () => undefined,
    }),
    { getState: () => harness.notesState },
  );
  return { useNotesStore, observePublishedNotesHydration: () => ({ status: 'UNAVAILABLE', reason: 'NO_PUBLISHED_HYDRATION' }) };
});
vi.mock('../common/WorkspaceErrorBoundary', () => ({ WorkspaceErrorBoundary: ({ children }: { children: unknown }) => children }));
vi.mock('../common/WorkspacePageHeader', () => ({ WorkspacePageHeader: () => null }));
vi.mock('../common/ProductEmptyState', () => ({ ProductEmptyState: () => null }));
vi.mock('../../hooks/useApiMutation', () => ({ useApiMutation: () => ({ mutate: harness.apiMutation }) }));
vi.mock('./features/planner/calendar-ui', () => ({
  CalendarShell: ({ dayScheduleActions, schedules }: {
    dayScheduleActions: { onView: (id: string) => void };
    schedules: Array<{ id: string }>;
  }) => createElement('button', {
    'data-open-planner-activity': true,
    onClick: () => dayScheduleActions.onView(schedules[0].id),
  }, 'Open schedule'),
}));
vi.mock('../../lib/noteNavigation', () => ({ openNote: vi.fn(), switchToTab: vi.fn() }));
vi.mock('./buildRecentActivityProjection', () => ({
  buildRecentActivityProjection: ({ recipeRecents, plannerRecents }: {
    recipeRecents: Array<{ recipeId: string; title: string; at: number }>;
    plannerRecents: Array<{ kind: string; itemId: string; title: string; at: number }>;
  }) => ({
    groups: [{
      bucket: 'today',
      items: [...plannerRecents.map(entry => ({
        id: `planner:${entry.kind}:${entry.itemId}`,
        domain: 'planner', kind: entry.kind, title: entry.title,
        timestamp: entry.at, relativeLabel: 'now', plannerItemId: entry.itemId,
      })), ...recipeRecents.map(entry => ({
        id: `recipe:${entry.recipeId}`,
        domain: 'recipe',
        kind: 'viewed',
        title: entry.title,
        timestamp: entry.at,
        relativeLabel: 'now',
        recipeId: entry.recipeId,
      }))],
    }],
  }),
}));
vi.mock('./k102RelativeDateLabels', () => ({ buildRelativeDateLabels: () => ({}) }));
vi.mock('./features/recipe/recipeActivityStorage', () => ({
  readRecipeViewRecents: (accountId?: string) => harness.recipeRecents[accountId ?? ''] ?? [],
}));
vi.mock('./features/knowledge/archive/archiveRestoreRecents', () => ({ readArchiveRestoreRecents: () => [] }));
vi.mock('./features/planner/calendar-ui/usePlannerCalendarProjection', () => ({
  usePlannerCalendarProjection: ({ schedules, previousDaySchedules }: { schedules: unknown[]; previousDaySchedules: unknown[] }) => ({
    projection: { schedules, previousDaySchedules },
    presentation: {},
  }),
}));
vi.mock('./features/planner/calendar/buildPlannerProjection', () => ({
  buildPlannerProjection: ({ calendarProjection }: { calendarProjection: { schedules?: Array<{ id: string; text: string; start_time?: string }>; previousDaySchedules?: Array<{ id: string; text: string; start_time?: string }> } }) => ({
    todayItems: [...(calendarProjection.schedules ?? []), ...(calendarProjection.previousDaySchedules ?? [])]
      .map(item => ({ key: item.id, title: item.text, time: item.start_time ?? '' })),
    timetableToday: [],
  }),
}));
vi.mock('./features/planner/calendar-ui/agenda/buildUpcomingTierGroups', () => ({ resolveUpcomingRelativeLabel: () => 'today' }));
vi.mock('./features/planner/hooks/useCountdownReviewed', () => ({ useCountdownReviewed: () => ({ isReviewed: false }) }));
vi.mock('./features/knowledge/databaseViews/parseDatabaseDate', () => ({ toDateKey: (date: Date) => date.toISOString().slice(0, 10) }));
vi.mock('./features/archive/hooks/useArchiveProjection', () => ({ useArchiveProjection: () => ({ projection: { historyItems: [] } }) }));
vi.mock('./features/home/buildHomeFoundationProjection', () => ({
  buildHomeFoundationProjection: ({ plannerProjection, workouts, recentActivity }: { plannerProjection?: { todayItems?: unknown[] }; workouts: unknown[]; recentActivity?: { groups?: Array<{ items?: unknown[] }> } }) => ({
    continueItem: null,
    todayAgenda: plannerProjection?.todayItems ?? [],
    timetableSlots: [],
    workout: {
      exerciseCount: workouts.length,
      setCount: 0,
      doneCount: 0,
      hasSession: workouts.length > 0,
      isDraft: false,
      isLocked: false,
    },
    traces: recentActivity?.groups?.flatMap(group => group.items ?? []) ?? [],
    archiveTracesToday: 0,
  }),
}));
vi.mock('./features/knowledge/workspace/workspaceSessionStorage', () => ({
  saveWorkspaceSession: vi.fn(),
  workspaceSessionFromActivation: vi.fn(),
}));
vi.mock('./k102DateFormat', () => ({
  formatLongDate: () => 'August 18, 2026',
  formatLongDateKey: () => 'August 18, 2026',
}));
vi.mock('../../lib/healthBackfillUiSafety', () => ({ readLocalHealthWorkoutDraft: () => null }));

type ProbeProps = { account?: string; active: boolean; onOpenRecipe?: (recipeId: string) => void };

function ProductionHomeProbe({ account, active, onOpenRecipe }: ProbeProps) {
  harness.account = account ?? 'account-a';
  const date = '2026-08-18';
  const accountId = active ? account : undefined;
  const scheduleKey = accountBoundRemoteKey(`https://example.invalid/api/schedules?date=${date}`, accountId, 'planner_events');
  const routineKey = accountBoundRemoteKey(`https://example.invalid/api/routines_with_logs?date=${date}`, accountId, 'planner_routines');
  const workoutKey = accountBoundRemoteKey(`https://example.invalid/api/workouts?date=${date}`, accountId, 'health_workouts');
  const { data: schedules = [] } = useSWR<any[]>(scheduleKey, accountBoundRemoteFetcher, { dedupingInterval: 0, revalidateOnFocus: false });
  const { data: routines = [] } = useSWR<any[]>(routineKey, accountBoundRemoteFetcher, { dedupingInterval: 0, revalidateOnFocus: false });
  const { data: workouts = [] } = useSWR<any[]>(workoutKey, accountBoundRemoteFetcher, { dedupingInterval: 0, revalidateOnFocus: false });

  if (!active || !account) {
    return createElement('output', { 'data-testid': 'planner-logged-out' }, 'logged-out');
  }

  const selectedDate = new Date(2026, 7, 18);
  return createElement('div', { 'data-testid': 'planner-home-probe' },
    createElement('output', {
      'data-daily-sources': [...schedules, ...routines, ...workouts].map(item => item.id).join('|'),
    }),
    createElement(HomeView, {
      now: DateTime.fromISO(`${date}T00:00:00`),
      selectedDate,
      formatDate: (value: Date) => {
        const year = value.getFullYear();
        const month = String(value.getMonth() + 1).padStart(2, '0');
        const day = String(value.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      },
      schedules,
      routines,
      workouts,
      weeklySchedules: [],
      appSettings: { darkMode: false, language: 'en' },
      theme: { card: '', input: '', border: '', text: '', textMuted: '', hoverBg: '' },
      isDailyLoading: false,
      user: { id: account, name: account },
      onOpenRecipe,
    } as any),
  );
}

async function flush(): Promise<void> {
  for (let i = 0; i < 8; i += 1) {
    await act(async () => {
      await Promise.resolve();
      await new Promise<void>(resolve => setTimeout(resolve, 0));
    });
  }
}

function renderProbe(root: Root, cache: Map<unknown, unknown>, props: ProbeProps): void {
  root.render(createElement(SWRConfig, {
    value: { provider: () => cache, dedupingInterval: 0, revalidateOnFocus: false },
  }, createElement(ProductionHomeProbe, props)));
}

describe('Planner/Home account-bound production paths', () => {
  let root: Root | null = null;
  let host: HTMLDivElement | null = null;

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    harness.account = 'account-a';
    harness.requests.length = 0;
    harness.recipeRecents = {
      'account-a': [{ recipeId: 'recipe-a', title: 'Account A recipe', at: Date.now() }],
      'account-b': [{ recipeId: 'recipe-b', title: 'Account B recipe', at: Date.now() }],
    };
    host = document.createElement('div');
    document.body.appendChild(host);
  });

  afterEach(() => {
    if (root) act(() => root?.unmount());
    host?.remove();
    root = null;
    host = null;
    localStorage.clear();
  });

  it('keeps direct D-Day and Home Planner data isolated across authenticated A -> B', async () => {
    const cache = new Map<unknown, unknown>();
    root = createRoot(host!);
    await act(async () => {
      renderProbe(root!, cache, { active: true, account: 'account-a' });
    });
    await flush();

    const initial = host?.textContent ?? '';
    expect(initial).toContain('account-a dday');
    expect(initial).toContain('account-a schedule 2026-08-18');
    expect(initial).toContain('account-a schedule 2026-08-17');
    expect(host?.querySelector('[data-daily-sources]')?.getAttribute('data-daily-sources')).toContain('routine-account-a-2026-08-18');
    expect(host?.querySelector('[data-daily-sources]')?.getAttribute('data-daily-sources')).toContain('workout-account-a-2026-08-18');

    harness.requests.length = 0;
    await act(async () => {
      renderProbe(root!, cache, { active: true, account: 'account-b' });
    });
    expect(host?.textContent ?? '').not.toContain('account-a');
    await flush();

    const switched = host?.textContent ?? '';
    expect(switched).toContain('account-b dday');
    expect(switched).toContain('account-b schedule 2026-08-18');
    expect(switched).toContain('account-b schedule 2026-08-17');
    expect(switched).not.toContain('account-a');
    expect(host?.querySelector('[data-daily-sources]')?.getAttribute('data-daily-sources')).toContain('routine-account-b-2026-08-18');
    expect(host?.querySelector('[data-daily-sources]')?.getAttribute('data-daily-sources')).toContain('workout-account-b-2026-08-18');
    expect(harness.requests.every(request => request.account === 'account-b')).toBe(true);
    expect(harness.requests.some(request => request.url.includes('/schedules/ddays'))).toBe(true);
    expect(harness.requests.some(request => request.url.includes('/schedules?date=2026-08-17'))).toBe(true);
  });

  it('keeps Planner/Home data absent through logout and a later login for B', async () => {
    const cache = new Map<unknown, unknown>();
    root = createRoot(host!);
    await act(async () => {
      renderProbe(root!, cache, { active: true, account: 'account-a' });
    });
    await flush();
    expect(host?.textContent ?? '').toContain('account-a dday');

    await act(async () => {
      renderProbe(root!, cache, { active: false });
    });
    await flush();
    expect(host?.querySelector('[data-testid="planner-logged-out"]')).not.toBeNull();
    expect(host?.textContent ?? '').not.toContain('account-a');

    harness.requests.length = 0;
    await act(async () => {
      renderProbe(root!, cache, { active: true, account: 'account-b' });
    });
    expect(host?.textContent ?? '').not.toContain('account-a');
    await flush();
    expect(host?.textContent ?? '').toContain('account-b dday');
    expect(host?.textContent ?? '').not.toContain('account-a');
    expect(host?.querySelector('[data-daily-sources]')?.getAttribute('data-daily-sources')).not.toContain('account-a');
    expect(harness.requests.every(request => request.account === 'account-b')).toBe(true);
  });

  it('does not expose Account A Recipe activity in Home after an authenticated A -> B transition', async () => {
    const cache = new Map<unknown, unknown>();
    root = createRoot(host!);
    await act(async () => {
      renderProbe(root!, cache, { active: true, account: 'account-a' });
    });
    await flush();
    expect(host?.textContent ?? '').toContain('Account A recipe');

    await act(async () => {
      renderProbe(root!, cache, { active: true, account: 'account-b' });
    });
    expect(host?.textContent ?? '').not.toContain('Account A recipe');
    await flush();
    expect(host?.textContent ?? '').toContain('Account B recipe');
    expect(host?.textContent ?? '').not.toContain('Account A recipe');
  });

  it('hands the exact recipe ID from a Home recent trace to app navigation', async () => {
    const cache = new Map<unknown, unknown>();
    const onOpenRecipe = vi.fn();
    root = createRoot(host!);
    await act(async () => renderProbe(root!, cache, { active: true, account: 'account-a', onOpenRecipe }));
    await flush();

    const trace = Array.from(host!.querySelectorAll('button')).find(button => button.textContent?.includes('Account A recipe'));
    expect(trace).toBeDefined();
    act(() => trace!.click());
    expect(onOpenRecipe).toHaveBeenCalledExactlyOnceWith('recipe-a');
  });

  it('uses real Planner storage in Home across A -> B -> A and preserves current-account navigation', async () => {
    const legacy = JSON.stringify([{ kind: 'schedule', itemId: 'old', title: 'Legacy private event', at: Date.now() }]);
    localStorage.setItem(PLANNER_ACTIVITY_KEY, legacy);
    recordPlannerActivity('account-a', 'schedule', 'same-id', 'Planner A private event');
    recordPlannerActivity('account-b', 'schedule', 'same-id', 'Planner B private event');
    const cache = new Map<unknown, unknown>();
    root = createRoot(host!);
    await act(async () => renderProbe(root!, cache, { active: true, account: 'account-a' }));
    await flush();
    expect(host!.textContent).toContain('Planner A private event');
    expect(host!.textContent).not.toContain('Planner B private event');
    expect(host!.textContent).not.toContain('Legacy private event');
    const requestsBeforeNavigation = harness.requests.length;
    const trace = Array.from(host!.querySelectorAll('button')).find(button => button.textContent?.includes('Planner A private event'));
    expect(trace).toBeDefined();
    act(() => trace!.click());
    expect(switchToTab).toHaveBeenCalledWith('planner');
    expect(harness.requests).toHaveLength(requestsBeforeNavigation);

    await act(async () => renderProbe(root!, cache, { active: true, account: 'account-b' }));
    expect(host!.textContent).not.toContain('Planner A private event');
    expect(host!.textContent).toContain('Planner B private event');
    await flush();
    await act(async () => renderProbe(root!, cache, { active: true, account: 'account-a' }));
    expect(host!.textContent).toContain('Planner A private event');
    expect(host!.textContent).not.toContain('Planner B private event');
    expect(host!.textContent).not.toContain('Legacy private event');
    expect(localStorage.getItem(PLANNER_ACTIVITY_KEY)).toBe(legacy);
    expect(readPlannerActivityRecents('account-a')).toHaveLength(1);
    expect(readPlannerActivityRecents('account-b')).toHaveLength(1);
  });

  it.each([
    { explicitDate: undefined, collectionDate: '2026-08-18', expected: '2026-08-18' },
    { explicitDate: '2026-08-20', collectionDate: '2026-08-18', expected: '2026-08-20' },
    { explicitDate: '2026-02-30', collectionDate: '2026-08-18', expected: '2026-08-18' },
    { explicitDate: undefined, collectionDate: '', expected: undefined },
    { explicitDate: 'bad', collectionDate: '2026-02-30', expected: undefined },
  ])('records current-account detail opens only with a verified source date: $explicitDate / $collectionDate', async ({ explicitDate, collectionDate, expected }) => {
    const cache = new Map<unknown, unknown>();
    const selectedDate = new Date(2026, 7, 18);
    const schedules = [{ id: 'same-id', text: 'Event title', start_time: '10:00', end_time: '11:00', is_dday: false, date: explicitDate }];
    root = createRoot(host!);
    const renderPlanner = async (account?: string) => {
      harness.account = account ?? '';
      await act(async () => root!.render(createElement(SWRConfig, {
        value: { provider: () => cache, revalidateOnFocus: false },
      }, createElement(PlannerView, {
        now: DateTime.fromISO('2026-08-18T12:00:00'), currentDate: selectedDate, selectedDate,
        setCurrentDate: vi.fn(), setSelectedDate: vi.fn(), formatDate: () => collectionDate,
        isToday: true, showToast: vi.fn(), mutateDaily: vi.fn(), mutateStatic: vi.fn(), mutateRoutines: vi.fn(),
        appSettings: { darkMode: false, language: 'en' }, schedules, todos: [], routines: [], weeklySchedules: [],
        theme: { card: '', input: '', border: '', textMuted: '', hoverBg: '' }, THEME_COLORS: {},
        user: account ? { id: account } : undefined,
      } as any))));
      act(() => (host!.querySelector('[data-open-planner-activity]') as HTMLButtonElement).click());
    };
    await renderPlanner('account-a');
    expect(readPlannerActivityRecents('account-a')).toEqual([
      expect.objectContaining({ kind: 'schedule', itemId: 'same-id', title: 'Event title' }),
    ]);
    expect(readPlannerActivityRecents('account-a')[0].eventDate).toBe(expected);
    await renderPlanner('account-b');
    expect(readPlannerActivityRecents('account-b')).toEqual([
      expect.objectContaining({ kind: 'schedule', itemId: 'same-id', title: 'Event title' }),
    ]);
    expect(readPlannerActivityRecents('account-b')[0].eventDate).toBe(expected);
    await renderPlanner();
    expect(readPlannerActivityRecents(undefined)).toEqual([]);
    expect(readPlannerActivityRecents('account-a')).toHaveLength(1);
    expect(readPlannerActivityRecents('account-b')).toHaveLength(1);
    expect(harness.apiMutation).not.toHaveBeenCalled();
  });
});
