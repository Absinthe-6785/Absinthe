// @vitest-environment happy-dom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { DateTime } from 'luxon';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getTranslator, type Language } from '../../lib/i18n';
import { HomeView, type HomeViewProps } from './HomeView';
import { PLANNER_ACTIVITY_KEY } from './features/planner/plannerActivityStorage';

const state = vi.hoisted(() => ({ lang: 'en' as Language, openNote: vi.fn(), switchToTab: vi.fn(), openRecipe: vi.fn(),
  notes: [{ id: 'note-1', title: 'Note trace', body: '', folderId: null, deletedAt: null, updatedAt: new Date(2026, 5, 12, 9).getTime() }] }));
vi.mock('swr', () => ({ default: () => ({ data: [] }) }));
vi.mock('../../lib/accountBoundRemote', () => ({ accountBoundRemoteKey: () => null, accountBoundRemoteFetcher: vi.fn() }));
vi.mock('../../lib/noteNavigation', () => ({ openNote: state.openNote, switchToTab: state.switchToTab }));
vi.mock('../../store/useNotesStore', () => {
  const store = { notes: state.notes, vaultStructureVersion: 0, createNote: vi.fn() };
  return { useNotesStore: Object.assign((select: (value: typeof store) => unknown) => select(store), { getState: () => store }) };
});
vi.mock('../../lib/i18n', async importOriginal => {
  const actual = await importOriginal<typeof import('../../lib/i18n')>();
  return { ...actual, useTranslation: () => ({ t: actual.getTranslator(state.lang), lang: state.lang }) };
});
vi.mock('./features/planner/calendar-ui/usePlannerCalendarProjection', () => ({ usePlannerCalendarProjection: () => ({ projection: {}, presentation: {} }) }));
vi.mock('./features/planner/calendar/buildPlannerProjection', () => ({ buildPlannerProjection: () => ({ todayItems: [], timetableToday: [] }) }));
vi.mock('./features/planner/hooks/useCountdownReviewed', () => ({ useCountdownReviewed: () => ({ isReviewed: () => false }) }));
vi.mock('./features/archive/hooks/useArchiveProjection', () => ({ useArchiveProjection: () => ({ projection: { historyItems: { groups: [] } } }) }));
vi.mock('./features/knowledge/archive/archiveRestoreRecents', () => ({ readArchiveRestoreRecents: () => [] }));
vi.mock('./features/recipe/recipeActivityStorage', () => ({ readRecipeViewRecents: () => [
  { recipeId: 'recipe-1', title: 'Recipe trace', at: new Date(2026, 5, 12, 8).getTime() },
] }));
vi.mock('../common/WorkspacePageHeader', () => ({ WorkspacePageHeader: () => null }));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root, host: HTMLDivElement;
const key = `${PLANNER_ACTIVITY_KEY}:account:account-a`;
function seed(eventDate?: unknown) {
  const entries = [
    { kind: 'schedule', itemId: 'schedule-1', title: 'Dated Schedule', at: new Date(2026, 5, 12, 10).getTime(), eventDate },
    { kind: 'schedule', itemId: 'old', title: 'Undated Schedule', at: new Date(2026, 5, 11, 10).getTime() },
  ];
  localStorage.setItem(key, JSON.stringify(entries));
  return localStorage.getItem(key);
}
async function renderHome() {
  const props = { user: { id: 'account-a', name: 'A' }, now: DateTime.local(2026, 6, 12, 12),
    selectedDate: new Date(2026, 5, 12), formatDate: () => '2026-06-12', schedules: [], routines: [], workouts: [], weeklySchedules: [],
    appSettings: { darkMode: false, language: state.lang }, theme: {}, isDailyLoading: true, onOpenRecipe: state.openRecipe } as HomeViewProps;
  await act(async () => root.render(createElement(HomeView, props)));
}
function row(title: string) {
  const result = Array.from(host.querySelectorAll<HTMLButtonElement>('[data-k132a-home-row^="trace-"]'))
    .find(button => button.textContent?.includes(title));
  expect(result).toBeDefined();
  return result!;
}
beforeEach(() => {
  localStorage.clear(); vi.clearAllMocks(); state.lang = 'en';
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(() => { act(() => root.unmount()); host.remove(); localStorage.clear(); });

describe('Home Schedule trace source dates through real storage and recent projections', () => {
  it.each(['en', 'ko', 'ja'] as const)('shows a separately labeled verified date in %s while retaining activity time and tab navigation', async lang => {
    state.lang = lang;
    const raw = seed('2020-01-02');
    await renderHome();
    const dated = row('Dated Schedule');
    expect(dated.textContent).toContain(`${getTranslator(lang)('k76ScheduleDate')}: 2020-01-02`);
    expect(dated.textContent).toContain(getTranslator(lang)('nvToday'));
    expect(row('Undated Schedule').textContent).not.toContain('2020-01-02');
    act(() => dated.click());
    act(() => row('Undated Schedule').click());
    expect(state.switchToTab.mock.calls).toEqual([['planner'], ['planner']]);
    expect(localStorage.getItem(key)).toBe(raw);
  });

  it.each([undefined, '2026-02-30', '2026-13-01', 'bad', 123])('does not guess or display an invalid/missing date %s', async date => {
    const raw = seed(date);
    await renderHome();
    expect(row('Dated Schedule').textContent).not.toContain(`${getTranslator('en')('k76ScheduleDate')}:`);
    expect(row('Undated Schedule').textContent).not.toContain(`${getTranslator('en')('k76ScheduleDate')}:`);
    expect(localStorage.getItem(key)).toBe(raw);
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
