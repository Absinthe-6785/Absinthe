// @vitest-environment happy-dom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { DateTime } from 'luxon';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Schedule } from '../../types';
import { setRuntimeAccountSyncAccount } from '../../lib/remoteBoundary';
import { PlannerView, type PlannerViewProps, type ScheduleNavigationRequest } from './PlannerView';

const state = vi.hoisted(() => ({
  api: vi.fn(),
  ddays: [] as Array<Schedule & { date: string }>,
  ddayLoading: false,
}));

vi.mock('swr', () => ({
  default: (key: string | null) => ({
    data: key?.includes('/schedules/ddays') ? state.ddays : [],
    isLoading: key?.includes('/schedules/ddays') ? state.ddayLoading : false,
    mutate: vi.fn(),
  }),
}));
vi.mock('../../hooks/useApiMutation', () => ({ useApiMutation: () => ({ mutate: state.api }) }));
vi.mock('../../hooks/useConfirm', () => ({
  useConfirm: () => ({ confirm: null, showConfirm: vi.fn(), clearConfirm: vi.fn(), handleConfirm: vi.fn() }),
}));
vi.mock('../../hooks/useElementVisible', () => ({ useElementVisible: () => ({ ref: { current: null }, visible: true }) }));
vi.mock('../../hooks/useEscapeKey', () => ({ useEscapeKey: vi.fn() }));
vi.mock('../../store/useNotesStore', () => ({ useNotesStore: (selector: (value: { notes: [] }) => unknown) => selector({ notes: [] }) }));
vi.mock('../../lib/i18n', async importOriginal => ({
  ...await importOriginal<typeof import('../../lib/i18n')>(),
  useTranslation: () => ({ t: (key: string) => key, lang: 'en' as const }),
}));
vi.mock('../common/WorkspacePageHeader', () => ({ WorkspacePageHeader: () => null }));
vi.mock('../common/ConfirmModal', () => ({ ConfirmModal: () => null }));
vi.mock('./features/planner/calendar-ui', () => ({ CalendarShell: () => null }));
vi.mock('./features/knowledge/trace/EventNoteDialog', () => ({ EventNoteDialog: () => null }));
vi.mock('./features/search/searchDomainNavigation', () => ({ registerSearchDomainHandlers: () => () => undefined }));
vi.mock('./features/planner/hooks/usePlannerScheduleEventActions', () => ({
  usePlannerScheduleEventActions: () => ({
    eventDialog: null, setEventDialog: vi.fn(), agendaEventActions: {},
    handleEventDialogSave: vi.fn(), handleRemoveEventStatus: vi.fn(),
  }),
}));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const day = new Date(2026, 5, 12, 12);
const dateKey = (date: Date) => DateTime.fromJSDate(date).toFormat('yyyy-MM-dd');
const event = (id: string): Schedule => ({
  id, text: 'Duplicate meeting', start_time: '10:00', end_time: '11:00', end_next_day: false,
  is_dday: false, category: 'Work', color: 'purple',
});
const request = (overrides: Partial<ScheduleNavigationRequest> = {}): ScheduleNavigationRequest => ({
  accountId: 'account-a', accountGeneration: 3, requestId: 1,
  itemId: 'schedule-b', eventDate: '2026-06-12', ...overrides,
});
const consumed = vi.fn();
const props = (overrides: Partial<PlannerViewProps> = {}): PlannerViewProps => ({
  now: DateTime.local(2026, 6, 12, 12), currentDate: day, setCurrentDate: vi.fn(),
  selectedDate: day, setSelectedDate: vi.fn(), formatDate: dateKey, isToday: () => false,
  schedules: [], todos: [], routines: [], weeklySchedules: [], markedDates: [],
  user: { id: 'account-a', name: 'Account A' },
  theme: { card: '', input: '', border: '', text: '', textMuted: '', hoverBg: '' },
  appSettings: { darkMode: false, defaultCategory: 'Personal', defaultColor: 'purple', language: 'en' as const },
  THEME_COLORS: [], showToast: vi.fn(), updateSetting: vi.fn(),
  mutateDaily: vi.fn(), mutateStatic: vi.fn(), mutateTodos: vi.fn(), mutateRoutines: vi.fn(),
  isScheduleLoading: false, scheduleNavigationGeneration: 3,
  scheduleNavigationRequest: request(), onScheduleNavigationConsumed: consumed,
  ...overrides,
});

let root: Root;
let host: HTMLDivElement;
async function renderPlanner(nextProps: PlannerViewProps) {
  await act(async () => root.render(createElement(PlannerView, nextProps)));
}
async function click(selector: string) {
  const target = host.querySelector<HTMLButtonElement>(selector);
  if (!target) throw new Error(`Missing Planner UI target: ${selector}`);
  await act(async () => target.click());
}
async function save() {
  const button = Array.from(host.querySelectorAll<HTMLButtonElement>('button'))
    .find(item => item.textContent?.trim() === 'saveSchedule');
  if (!button) throw new Error('Missing Schedule save button');
  await act(async () => button.click());
}

beforeEach(() => {
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  localStorage.clear(); setRuntimeAccountSyncAccount('account-a');
  state.api.mockReset().mockResolvedValue(true); state.ddays = []; state.ddayLoading = false;
  consumed.mockReset();
});
afterEach(() => {
  act(() => root.unmount()); host.remove(); localStorage.clear(); setRuntimeAccountSyncAccount(null);
});

describe('Home-to-Planner exact Schedule target resolution', () => {
  it('waits for the selected-date Schedule read and opens only the requested ID among duplicate titles', async () => {
    const navigation = request();
    await renderPlanner(props({ scheduleNavigationRequest: navigation, isScheduleLoading: true }));
    expect(host.querySelector('[data-schedule-event-detail]')).toBeNull();
    expect(consumed).not.toHaveBeenCalled();

    await renderPlanner(props({ schedules: [
      { ...event('schedule-a'), start_time: '08:00', end_time: '09:00' },
      event('schedule-b'),
    ],
      scheduleNavigationRequest: navigation, isScheduleLoading: false }));
    expect(host.querySelector('[data-schedule-event-detail]')?.textContent).toContain('Duplicate meeting');
    expect(host.querySelector('[data-schedule-event-detail]')?.textContent).toContain('June 12, 2026');
    expect(consumed).toHaveBeenCalledExactlyOnceWith(navigation.requestId);
    expect(state.api).not.toHaveBeenCalled();

    await click('[data-schedule-event-edit]');
    expect(state.api).not.toHaveBeenCalled();
    await save();
    expect(state.api).toHaveBeenCalledExactlyOnceWith('PUT', '/api/schedules/schedule-b',
      expect.objectContaining({ date: '2026-06-12', text: 'Duplicate meeting' }), expect.any(Object));
  });

  it('waits for the account-scoped D-day publication, then opens the exact dated D-day without a false time range', async () => {
    const navigation = request({ itemId: 'dday-b', eventDate: '2026-06-20', requestId: 2 });
    state.ddayLoading = true;
    await renderPlanner(props({ selectedDate: new Date(2026, 5, 20, 12), currentDate: new Date(2026, 5, 1, 12),
      scheduleNavigationRequest: navigation, isScheduleLoading: false }));
    expect(host.querySelector('[data-schedule-event-detail]')).toBeNull();
    expect(consumed).not.toHaveBeenCalled();

    state.ddays = [{ ...event('dday-b'), is_dday: true, date: '2026-06-20', start_time: '00:00', end_time: '23:59' }];
    state.ddayLoading = false;
    await renderPlanner(props({ selectedDate: new Date(2026, 5, 20, 12), currentDate: new Date(2026, 5, 1, 12),
      scheduleNavigationRequest: navigation, isScheduleLoading: false }));
    const detail = host.querySelector('[data-schedule-event-detail]');
    expect(detail?.textContent).toContain('June 20, 2026');
    expect(detail?.textContent).toContain('k80DdayTimeHint');
    expect(detail?.textContent).not.toContain('00:00–23:59');
    expect(host.querySelector('[data-schedule-event-duplicate]')).toBeNull();
    expect(consumed).toHaveBeenCalledExactlyOnceWith(navigation.requestId);
    expect(state.api).not.toHaveBeenCalled();

    await click('[data-schedule-event-edit]');
    expect(host.querySelector<HTMLInputElement>('[data-k139-event-date-picker]')?.value).toBe('2026-06-20');
    expect(host.querySelectorAll('input[type="time"]')).toHaveLength(0);
    expect(state.api).not.toHaveBeenCalled();
  });

  it('fails closed for a missing target, a date mismatch, and an A/B/A-stale account generation', async () => {
    await renderPlanner(props({ scheduleNavigationRequest: request({ itemId: 'deleted-id' }) }));
    expect(host.querySelector('[data-schedule-event-detail]')).toBeNull();
    expect(consumed).toHaveBeenCalledExactlyOnceWith(1);

    consumed.mockClear();
    await renderPlanner(props({ scheduleNavigationRequest: request({ requestId: 2, eventDate: '2026-06-11' }) }));
    expect(host.querySelector('[data-schedule-event-detail]')).toBeNull();
    expect(consumed).toHaveBeenCalledExactlyOnceWith(2);

    consumed.mockClear();
    await renderPlanner(props({ scheduleNavigationRequest: request({ requestId: 3, accountGeneration: 2 }) }));
    expect(host.querySelector('[data-schedule-event-detail]')).toBeNull();
    expect(consumed).toHaveBeenCalledExactlyOnceWith(3);

    consumed.mockClear();
    await renderPlanner(props({ user: { id: 'account-b', name: 'Account B' }, schedules: [event('schedule-b')],
      scheduleNavigationRequest: request({ requestId: 4, accountId: 'account-a' }), scheduleNavigationGeneration: 3 }));
    expect(host.querySelector('[data-schedule-event-detail]')).toBeNull();
    expect(consumed).toHaveBeenCalledExactlyOnceWith(4);
    expect(state.api).not.toHaveBeenCalled();
  });
});
