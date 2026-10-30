// @vitest-environment happy-dom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { DateTime } from 'luxon';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getTranslator, type Language } from '../../lib/i18n';
import { HomeView, type HomeViewProps } from './HomeView';
import { PLANNER_ACTIVITY_KEY } from './features/planner/plannerActivityStorage';
import { ARCHIVE_RESTORE_RECENTS_KEY } from './features/knowledge/archive/archiveRestoreRecents';

const state = vi.hoisted(() => ({ lang: 'en' as Language, openNote: vi.fn(), switchToTab: vi.fn(), openRecipe: vi.fn(),
  openSchedule: vi.fn(),
  todayItems: [] as Array<Record<string, unknown>>,
  ddays: [] as Array<{ id: string; text: string; date: string; is_dday: boolean; start_time: string; end_time: string; category: string; color: string }>,
  notes: [{ id: 'note-1', title: 'Note trace', body: '', folderId: null, deletedAt: null, updatedAt: new Date(2026, 5, 12, 9).getTime() }] }));
vi.mock('swr', () => ({ default: (key: string | null) => ({ data: key?.includes('/api/schedules/ddays') ? state.ddays : [] }) }));
vi.mock('../../lib/accountBoundRemote', () => ({ accountBoundRemoteKey: (url: string) => url, accountBoundRemoteFetcher: vi.fn() }));
vi.mock('../../lib/noteNavigation', () => ({ openNote: state.openNote, switchToTab: state.switchToTab }));
vi.mock('../../store/useNotesStore', () => {
  const store = { notes: state.notes, vaultStructureVersion: 0, createNote: vi.fn() };
  const request = Object.freeze({ accountId: 'account-a', generation: 1 });
  return { useNotesStore: Object.assign((select: (value: typeof store) => unknown) => select(store), { getState: () => store }),
    observePublishedNotesHydration: () => ({ status: 'CURRENT', request }) };
});
vi.mock('../../lib/i18n', async importOriginal => {
  const actual = await importOriginal<typeof import('../../lib/i18n')>();
  return { ...actual, useTranslation: () => ({ t: actual.getTranslator(state.lang), lang: state.lang }) };
});
vi.mock('./features/planner/calendar-ui/usePlannerCalendarProjection', () => ({ usePlannerCalendarProjection: () => ({ projection: {}, presentation: {} }) }));
vi.mock('./features/planner/calendar/buildPlannerProjection', () => ({ buildPlannerProjection: () => ({ todayItems: state.todayItems, timetableToday: [] }) }));
vi.mock('./features/planner/hooks/useCountdownReviewed', () => ({ useCountdownReviewed: () => ({ isReviewed: () => false }) }));
vi.mock('./features/recipe/recipeActivityStorage', () => ({ readRecipeViewRecents: () => [
  { recipeId: 'recipe-1', title: 'Recipe trace', at: new Date(2026, 5, 12, 8).getTime() },
] }));
vi.mock('../common/WorkspacePageHeader', () => ({ WorkspacePageHeader: () => null }));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root, host: HTMLDivElement;
const key = `${PLANNER_ACTIVITY_KEY}:account:account-a`;
function seed(eventDate?: unknown, itemId = 'schedule-1') {
  const entries = [
    { kind: 'schedule', itemId, title: 'Dated Schedule', at: new Date(2026, 5, 12, 10).getTime(), eventDate },
    { kind: 'schedule', itemId: 'old', title: 'Undated Schedule', at: new Date(2026, 5, 11, 10).getTime() },
  ];
  localStorage.setItem(key, JSON.stringify(entries));
  return localStorage.getItem(key);
}
async function renderHome(isDailyLoading = true) {
  const props = { user: { id: 'account-a', name: 'A' }, now: DateTime.local(2026, 6, 12, 12),
    selectedDate: new Date(2026, 5, 12), formatDate: () => '2026-06-12', schedules: [], routines: [], workouts: [], weeklySchedules: [],
    appSettings: { darkMode: false, language: state.lang }, theme: {}, isDailyLoading,
    onOpenRecipe: state.openRecipe, onOpenScheduleTarget: state.openSchedule } as HomeViewProps;
  await act(async () => root.render(createElement(HomeView, props)));
}
function row(title: string) {
  const result = Array.from(host.querySelectorAll<HTMLButtonElement>('[data-k132a-home-row^="trace-"]'))
    .find(button => button.textContent?.includes(title));
  expect(result).toBeDefined();
  return result!;
}
beforeEach(() => {
  localStorage.clear(); vi.clearAllMocks(); state.lang = 'en'; state.todayItems = []; state.ddays = [];
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(() => { act(() => root.unmount()); host.remove(); localStorage.clear(); });

describe('Home Schedule target navigation through real storage and projections', () => {
  it.each(['en', 'ko', 'ja'] as const)('shows a separately labeled verified date in %s and opens its exact ID/date', async lang => {
    state.lang = lang;
    const raw = seed('2020-01-02');
    await renderHome();
    const dated = row('Dated Schedule');
    expect(dated.textContent).toContain(`${getTranslator(lang)('k76ScheduleDate')}: 2020-01-02`);
    expect(dated.textContent).toContain(getTranslator(lang)('nvToday'));
    expect(row('Undated Schedule').textContent).not.toContain('2020-01-02');
    expect(row('Dated Schedule').textContent).toContain(`· ${getTranslator(lang)('planner')}`);
    act(() => dated.click());
    act(() => row('Undated Schedule').click());
    expect(state.openSchedule).toHaveBeenCalledExactlyOnceWith('schedule-1', '2020-01-02');
    expect(state.switchToTab.mock.calls).toEqual([['planner']]);
    expect(localStorage.getItem(key)).toBe(raw);
  });

  it.each(['en', 'ko', 'ja'] as const)('localizes supported Recent Traces labels and excludes global Archive activity in %s', async lang => {
    state.lang = lang;
    const archiveRaw = JSON.stringify([{ noteId: 'archive-note', restoredAt: new Date(2026, 5, 12, 7).getTime() }]);
    localStorage.setItem(ARCHIVE_RESTORE_RECENTS_KEY, archiveRaw);
    seed('2026-06-12');
    await renderHome();
    const t = getTranslator(lang);

    const labels = [
      ['Note trace', 'note', 'notes'],
      ['Dated Schedule', 'planner', 'planner'],
      ['Recipe trace', 'recipe', 'recipe'],
    ] as const;
    for (const [title, translationKey, rawDomain] of labels) {
      const text = row(title).textContent ?? '';
      expect(text).toContain(`· ${t(translationKey)}`);
      expect(text).not.toContain(`· ${rawDomain}`);
    }
    expect(row('Dated Schedule').textContent).toContain(`${t('k76ScheduleDate')}: 2026-06-12`);
    expect(host.querySelector('[data-k132a-home-row="trace-archive"]')).toBeNull();
    expect(host.querySelector('[data-k132a-home-open-archive]')).toBeNull();
    expect(localStorage.getItem(ARCHIVE_RESTORE_RECENTS_KEY)).toBe(archiveRaw);
  });

  it.each([undefined, '2026-02-30', '2026-13-01', 'bad', 123])('does not guess or display an invalid/missing date %s', async date => {
    const raw = seed(date);
    await renderHome();
    expect(row('Dated Schedule').textContent).not.toContain(`${getTranslator('en')('k76ScheduleDate')}:`);
    expect(row('Dated Schedule').textContent).toContain(`· ${getTranslator('en')('planner')}`);
    expect(row('Undated Schedule').textContent).not.toContain(`${getTranslator('en')('k76ScheduleDate')}:`);
    act(() => row('Dated Schedule').click());
    expect(state.openSchedule).not.toHaveBeenCalled();
    expect(state.switchToTab).toHaveBeenCalledExactlyOnceWith('planner');
    expect(localStorage.getItem(key)).toBe(raw);
  });

  it('does not normalize a malformed item ID into a different stable target', async () => {
    seed('2026-06-12', ' schedule-1 ');
    await renderHome();
    act(() => row('Dated Schedule').click());
    expect(state.openSchedule).not.toHaveBeenCalled();
    expect(state.switchToTab).toHaveBeenCalledExactlyOnceWith('planner');
  });

  it('uses the carried Schedule row ID/date, not its title, while non-Schedule agenda entries keep generic navigation', async () => {
    state.todayItems = [
      { kind: 'block', key: 'block-one', title: 'Duplicate', blockId: 'schedule-one', eventDate: '2026-06-11' },
      { kind: 'block', key: 'block-two', title: 'Duplicate', blockId: 'schedule-two', eventDate: '2026-06-12' },
      { kind: 'event', key: 'note-event', title: 'Note event', noteId: 'note-target' },
    ];
    await renderHome(false);
    const scheduleRows = host.querySelectorAll<HTMLButtonElement>('[data-k132a-home-row="today-block"]');
    expect(scheduleRows).toHaveLength(2);
    act(() => scheduleRows[1]!.click());
    const eventRow = host.querySelector<HTMLButtonElement>('[data-k132a-home-row="today-event"]');
    expect(eventRow).not.toBeNull();
    act(() => eventRow!.click());
    expect(state.openSchedule.mock.calls).toEqual([['schedule-two', '2026-06-12']]);
    expect(state.switchToTab.mock.calls).toEqual([['planner']]);
  });

  it('uses the explicit date and ID for an upcoming Schedule D-day card', async () => {
    state.ddays = [{ id: 'dday-target', text: 'D-day title', date: '2026-06-20', is_dday: true,
      start_time: '00:00', end_time: '23:59', category: 'Personal', color: 'purple' }];
    await renderHome();
    const ddayRow = host.querySelector<HTMLButtonElement>('[data-k132a-home-row="dday-item"]');
    expect(ddayRow).not.toBeNull();
    act(() => ddayRow!.click());
    expect(state.openSchedule).toHaveBeenCalledExactlyOnceWith('dday-target', '2026-06-20');
    expect(state.switchToTab).not.toHaveBeenCalled();
  });

  it('preserves Notes and Recipe trace navigation and metadata', async () => {
    seed('2026-06-11');
    await renderHome();
    act(() => row('Note trace').click());
    act(() => row('Recipe trace').click());
    expect(state.openNote).toHaveBeenCalledExactlyOnceWith('note-1', { returnTab: 'home' });
    expect(state.openRecipe).toHaveBeenCalledExactlyOnceWith('recipe-1');
    expect(state.switchToTab).not.toHaveBeenCalled();
    expect(row('Note trace').textContent).not.toContain(`${getTranslator('en')('k76ScheduleDate')}:`);
    expect(row('Recipe trace').textContent).not.toContain(`${getTranslator('en')('k76ScheduleDate')}:`);
  });
});
