// @vitest-environment happy-dom
import { act, createElement, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DateTime } from 'luxon';
import type { PlannerProps, Schedule } from '../../types';
import { setRuntimeAccountSyncAccount } from '../../lib/remoteBoundary';
import { formatLongDateKey } from './k102DateFormat';
import { PlannerView } from './PlannerView';

const state = vi.hoisted(() => ({
  api: vi.fn(),
  previous: [] as Schedule[],
  ddays: [] as Array<Schedule & { date: string }>,
}));

vi.mock('swr', () => ({
  default: (key: string | null) => ({
    data: key?.includes('/schedules/ddays') ? state.ddays
      : key?.includes('date=2026-06-11') ? state.previous : [],
    mutate: vi.fn(),
  }),
}));
vi.mock('../../hooks/useApiMutation', () => ({ useApiMutation: () => ({ mutate: state.api }) }));
vi.mock('../../hooks/useConfirm', () => ({
  useConfirm: () => ({ confirm: null, showConfirm: vi.fn(), clearConfirm: vi.fn(), handleConfirm: vi.fn() }),
}));
vi.mock('../../hooks/useElementVisible', () => ({
  useElementVisible: () => ({ ref: { current: null }, visible: true }),
}));
vi.mock('../../store/useNotesStore', () => ({
  useNotesStore: (selector: (value: { notes: [] }) => unknown) => selector({ notes: [] }),
}));
vi.mock('../../lib/i18n', async importOriginal => ({
  ...await importOriginal<typeof import('../../lib/i18n')>(),
  useTranslation: () => ({ t: (key: string) => key, lang: 'en' as const }),
}));
vi.mock('../../lib/noteNavigation', () => ({ openNote: vi.fn() }));
vi.mock('./features/search/searchDomainNavigation', () => ({ registerSearchDomainHandlers: () => () => undefined }));
vi.mock('./features/planner/hooks/usePlannerScheduleEventActions', () => ({
  usePlannerScheduleEventActions: () => ({
    eventDialog: null, setEventDialog: vi.fn(), agendaEventActions: {},
    handleEventDialogSave: vi.fn(), handleRemoveEventStatus: vi.fn(),
  }),
}));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const previousEvent: Schedule = Object.freeze({
  id: 'previous-event', text: 'Previous night', start_time: '23:00', end_time: '01:00',
  end_next_day: true, is_dday: false, category: 'Work', color: 'blue',
});
const currentEvent: Schedule = Object.freeze({
  id: 'current-event', text: 'Current meeting', start_time: '10:00', end_time: '11:00',
  end_next_day: false, is_dday: false, category: 'Personal', color: 'purple',
});
const selectedDay = new Date(2026, 5, 12, 12);
const formatDate = (date: Date) => DateTime.fromJSDate(date).toFormat('yyyy-MM-dd');

function StatefulPlanner() {
  const [selectedDate, setSelectedDate] = useState(selectedDay);
  const [currentDate, setCurrentDate] = useState(selectedDay);
  const props: PlannerProps = {
    now: DateTime.fromJSDate(selectedDay), currentDate, setCurrentDate,
    selectedDate, setSelectedDate, formatDate, isToday: () => false,
    schedules: [currentEvent], todos: [], routines: [], weeklySchedules: [], markedDates: [],
    user: { id: 'account-a', name: 'Account A' },
    theme: { card: '', input: '', border: '', textMuted: '', hoverBg: '' },
    appSettings: { darkMode: false, defaultCategory: 'Personal', defaultColor: 'purple', language: 'en' },
    THEME_COLORS: [{ id: 'blue', bg: 'blue', text: 'white', border: 'blue' }],
    showToast: vi.fn(), updateSetting: vi.fn(),
    mutateDaily: vi.fn(), mutateStatic: vi.fn(), mutateTodos: vi.fn(), mutateRoutines: vi.fn(),
  };
  return createElement('div', null,
    createElement('output', { 'data-selected-date': true }, formatDate(selectedDate)),
    createElement(PlannerView, props),
  );
}

let root: Root | undefined;
let host: HTMLDivElement;

async function mountPlanner() {
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  await act(async () => root!.render(createElement(StatefulPlanner)));
}

async function click(selector: string) {
  const target = host.querySelector<HTMLElement>(selector);
  if (!target) throw new Error(`Missing production UI action: ${selector}`);
  await act(async () => target.click());
}

function formDate() {
  const input = host.querySelector<HTMLInputElement>('[data-k139-event-date-picker]');
  if (!input) throw new Error('Missing Schedule edit form date');
  return input;
}

async function save() {
  const button = Array.from(host.querySelectorAll('button')).find(item => item.textContent?.trim() === 'saveSchedule');
  if (!button) throw new Error('Missing Schedule save action');
  await act(async () => button.click());
}

function editDate(value: string) {
  const input = formDate();
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
  act(() => {
    setter.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

beforeEach(() => {
  localStorage.clear();
  setRuntimeAccountSyncAccount('account-a');
  state.api.mockReset().mockResolvedValue(true);
  state.previous = [previousEvent];
  state.ddays = [];
});
afterEach(() => {
  if (root) act(() => root!.unmount());
  root = undefined;
  host?.remove();
  setRuntimeAccountSyncAccount(null);
});

describe('Planner previous-day Schedule editing through the production month calendar', () => {
  it.each([false, true])('keeps the previous-day date in detail, edit form, and PUT payload (API date present: %s)', async withDate => {
    if (withDate) {
      const datedPrevious = { ...previousEvent, date: '2026-06-11' };
      state.previous = [datedPrevious];
    }
    await mountPlanner();
    await click('[data-planner-month-cell="2026-06-11"] [data-planner-month-block="previous-event"]');
    expect(host.querySelector('[data-selected-date]')?.textContent).toBe('2026-06-12');
    const detailDate = host.querySelector('[data-schedule-event-detail] dd')?.textContent;

    await click('[data-schedule-event-edit]');
    const editDate = formDate().value;
    await save();
    expect(state.api).toHaveBeenCalledExactlyOnceWith('PUT', '/api/schedules/previous-event',
      expect.objectContaining({ text: 'Previous night', end_next_day: true }), expect.any(Object));

    expect({ detailDate, editDate, savedDate: state.api.mock.calls[0][2].date }).toEqual({
      detailDate: formatLongDateKey('2026-06-11', 'en'), editDate: '2026-06-11', savedDate: '2026-06-11',
    });
    expect(previousEvent).toEqual({
      id: 'previous-event', text: 'Previous night', start_time: '23:00', end_time: '01:00',
      end_next_day: true, is_dday: false, category: 'Work', color: 'blue',
    });
  });

  it('preserves current-day detail and editing dates', async () => {
    await mountPlanner();
    await click('[data-planner-month-cell="2026-06-12"] [data-planner-month-block="current-event"]');
    expect(host.querySelector('[data-schedule-event-detail] dd')?.textContent).toBe(formatLongDateKey('2026-06-12', 'en'));
    await click('[data-schedule-event-edit]');
    expect(formDate().value).toBe('2026-06-12');
    await save();
    expect(state.api).toHaveBeenCalledExactlyOnceWith('PUT', '/api/schedules/current-event',
      expect.objectContaining({ date: '2026-06-12', text: currentEvent.text, category: currentEvent.category }), expect.any(Object));
  });

  it('keeps an explicitly edited date in the outgoing payload without mutating the source', async () => {
    await mountPlanner();
    await click('[data-planner-month-block="previous-event"]');
    await click('[data-schedule-event-edit]');
    expect(formDate().value).toBe('2026-06-11');
    editDate('2026-06-15');
    expect(formDate().value).toBe('2026-06-15');
    await save();
    expect(state.api.mock.calls[0][2]).toMatchObject({ date: '2026-06-15', text: previousEvent.text });
    expect(state.previous[0]).toBe(previousEvent);
    expect(previousEvent).not.toHaveProperty('date');
  });

  it('retains the explicit D-Day date and its existing all-day payload behavior', async () => {
    const dday = { ...currentEvent, id: 'dday-event', text: 'Countdown', date: '2026-06-20', is_dday: true };
    state.ddays = [dday];
    await mountPlanner();
    await click('[data-k139-schedule-dday-edit="dday-event"]');
    expect(formDate().value).toBe('2026-06-20');
    expect(host.querySelectorAll('input[type="time"]')).toHaveLength(0);
    await save();
    expect(state.api).toHaveBeenCalledExactlyOnceWith('PUT', '/api/schedules/dday-event',
      expect.objectContaining({ date: '2026-06-20', is_dday: true, start_time: '00:00', end_time: '23:59', end_next_day: false }),
      expect.any(Object));
    expect(dday.date).toBe('2026-06-20');
  });
});
