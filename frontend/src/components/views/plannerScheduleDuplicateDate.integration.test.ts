// @vitest-environment happy-dom
import { act, createElement, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DateTime } from 'luxon';
import type { PlannerProps, Schedule } from '../../types';
import { PlannerView } from './PlannerView';

const testState = vi.hoisted(() => ({
  apiMutate: vi.fn(),
  showToast: vi.fn(),
}));

vi.mock('../../hooks/useConfirm', () => ({
  useConfirm: () => ({
    confirm: null,
    showConfirm: vi.fn(),
    clearConfirm: vi.fn(),
    handleConfirm: vi.fn(),
  }),
}));

vi.mock('../../hooks/useApiMutation', () => ({
  useApiMutation: () => ({ mutate: testState.apiMutate }),
}));

vi.mock('../../hooks/useEscapeKey', () => ({ useEscapeKey: () => {} }));

vi.mock('../../lib/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key, lang: 'en' as const }),
}));

vi.mock('swr', () => ({ default: () => ({ data: [], mutate: vi.fn() }) }));

vi.mock('./features/planner/calendar-ui', async () => {
  const { createElement } = await import('react');
  return {
    CalendarShell: (props: {
      anchorDate: string;
      onAnchorDateChange: (date: string) => void;
      onAddSchedule: () => void;
      dayScheduleActions: { onDuplicate: (id: string) => void };
      onEditDday: (schedule: Schedule & { date: string }) => void;
    }) => createElement('div', null,
      createElement('output', { 'data-calendar-date': true }, props.anchorDate),
      createElement('button', {
        type: 'button',
        'data-test-navigate': true,
        onClick: () => props.onAnchorDateChange('2026-06-20'),
      }, 'Navigate'),
      createElement('button', {
        type: 'button',
        'data-test-add': true,
        onClick: props.onAddSchedule,
      }, 'Add'),
      createElement('button', {
        type: 'button',
        'data-test-duplicate': true,
        onClick: () => props.dayScheduleActions.onDuplicate('source-event'),
      }, 'Duplicate'),
      createElement('button', {
        type: 'button',
        'data-test-edit-legacy': true,
        onClick: () => props.onEditDday({
          ...sourceSchedule,
          id: 'legacy-category-event',
          text: 'Legacy category event',
          category: 'LegacyCustomCategory',
          date: '2026-06-12',
        }),
      }, 'Edit legacy category'),
      createElement('button', {
        type: 'button',
        'data-test-edit-missing-title': true,
        onClick: () => props.onEditDday({
          ...sourceSchedule,
          id: 'missing-title-event',
          text: undefined as unknown as string,
          date: '2026-06-12',
        }),
      }, 'Edit missing title'),
    ),
  };
});

vi.mock('./features/planner/hooks/usePlannerScheduleEventActions', () => ({
  usePlannerScheduleEventActions: () => ({
    eventDialog: null,
    setEventDialog: vi.fn(),
    agendaEventActions: {},
    handleEventDialogSave: vi.fn(),
    handleRemoveEventStatus: vi.fn(),
  }),
}));

vi.mock('./features/knowledge/trace/EventNoteDialog', () => ({ EventNoteDialog: () => null }));

vi.mock('../../store/useNotesStore', () => {
  const state = {
    notes: [], folders: [], activeNoteId: null, activeFolderId: null,
    createNote: vi.fn(), updateNote: vi.fn(), moveNoteToTrash: vi.fn(),
    restoreNote: vi.fn(), permanentDeleteNote: vi.fn(), setActiveNoteId: vi.fn(),
    createFolder: vi.fn(), renameFolder: vi.fn(), deleteFolder: vi.fn(), setActiveFolderId: vi.fn(),
  };
  return {
    useNotesStore: (selector?: (value: typeof state) => unknown) => selector ? selector(state) : state,
  };
});

const selectedDay = new Date(2026, 5, 12, 12);
const sourceSchedule: Schedule = Object.freeze({
  id: 'source-event',
  text: 'Study session',
  start_time: '23:00',
  end_time: '01:00',
  end_next_day: true,
  is_dday: false,
  color: 'blue',
  category: 'Study',
});

const theme = {
  card: 'card', input: 'input', border: 'border', textMuted: 'muted', hoverBg: 'hover',
};
const appSettings = { darkMode: false, defaultCategory: 'Personal', defaultColor: 'blue', language: 'en' as const };
const themeColors = [{ id: 'blue', bg: 'blue', text: 'white', border: 'blue' }];

function formatDate(value: Date | DateTime): string {
  const date = value instanceof Date ? value : value.toJSDate();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function props(overrides: Partial<PlannerProps> = {}): PlannerProps {
  return {
    now: DateTime.fromJSDate(selectedDay),
    currentDate: selectedDay,
    setCurrentDate: vi.fn(),
    selectedDate: selectedDay,
    setSelectedDate: vi.fn(),
    formatDate,
    isToday: () => false,
    schedules: [sourceSchedule],
    todos: [], routines: [], markedDates: [], weeklySchedules: [],
    showToast: testState.showToast, appSettings, updateSetting: vi.fn(), theme, THEME_COLORS: themeColors,
    mutateDaily: vi.fn(), mutateStatic: vi.fn(), mutateTodos: vi.fn(), mutateRoutines: vi.fn(),
    user: { id: 'account-a', name: 'Account A' },
    ...overrides,
  };
}

function StatefulPlanner() {
  const [selectedDate, setSelectedDate] = useState(selectedDay);
  const [currentDate, setCurrentDate] = useState(selectedDay);
  return createElement(PlannerView, props({ selectedDate, setSelectedDate, currentDate, setCurrentDate }));
}

let root: Root | undefined;
let host: HTMLDivElement;

async function mountPlanner() {
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  await act(async () => { root!.render(createElement(StatefulPlanner)); });
}

function click(selector: string) {
  const button = host.querySelector<HTMLButtonElement>(selector);
  if (!button) throw new Error(`Missing button: ${selector}`);
  act(() => button.click());
}

function duplicateDateInput(): HTMLInputElement {
  const input = host.querySelector<HTMLInputElement>('[data-k139-event-date-picker]');
  if (!input) throw new Error('Schedule form date input is not mounted');
  return input;
}

function setInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  act(() => {
    setter?.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

beforeEach(() => {
  testState.apiMutate.mockReset().mockResolvedValue(true);
  testState.showToast.mockReset();
});

afterEach(() => {
  if (root) act(() => root!.unmount());
  root = undefined;
  host?.remove();
});

describe('PlannerView Schedule duplication date', () => {
  it.each(['', '   ', '\t\n'])(
    'rejects a title containing only whitespace (%j) without closing the form or mutating',
    async title => {
      await mountPlanner();
      click('[data-test-add]');
      setInputValue(host.querySelector<HTMLInputElement>('input[type="text"]')!, title);

      await act(async () => {
        const save = [...host.querySelectorAll('button')].find(button => button.textContent === 'saveSchedule');
        if (!save) throw new Error('Schedule save button is not mounted');
        save.click();
      });

      expect(testState.apiMutate).not.toHaveBeenCalled();
      expect(testState.showToast).toHaveBeenCalledWith('enterText', 'error');
      expect(host.querySelector('.fixed.inset-0')).not.toBeNull();
      expect(host.querySelector('input[type="text"]')).not.toBeNull();
    },
  );

  it('rejects whitespace-only titles when editing and creating a D-day', async () => {
    await mountPlanner();
    click('[data-test-edit-legacy]');
    setInputValue(host.querySelector<HTMLInputElement>('input[type="text"]')!, ' \t ');

    await act(async () => {
      const save = [...host.querySelectorAll('button')].find(button => button.textContent === 'saveSchedule');
      if (!save) throw new Error('Schedule save button is not mounted');
      save.click();
    });

    expect(testState.apiMutate).not.toHaveBeenCalled();
    expect(testState.showToast).toHaveBeenLastCalledWith('enterText', 'error');
    expect(host.querySelector('.fixed.inset-0')).not.toBeNull();

    click('[data-test-add]');
    const ddayToggle = host.querySelector<HTMLInputElement>('.fixed.inset-0 input[type="checkbox"]');
    if (!ddayToggle) throw new Error('D-day toggle is not mounted');
    act(() => ddayToggle.click());
    setInputValue(host.querySelector<HTMLInputElement>('.fixed.inset-0 input[type="text"]')!, '\n\t');

    await act(async () => {
      const save = [...host.querySelectorAll('button')].find(button => button.textContent === 'saveSchedule');
      if (!save) throw new Error('Schedule save button is not mounted');
      save.click();
    });

    expect(testState.apiMutate).not.toHaveBeenCalled();
    expect(testState.showToast).toHaveBeenLastCalledWith('enterText', 'error');
    expect(host.querySelector('.fixed.inset-0')).not.toBeNull();
  });

  it('rejects a missing title on an existing Schedule without mutation', async () => {
    await mountPlanner();
    click('[data-test-edit-missing-title]');

    await act(async () => {
      const save = [...host.querySelectorAll('button')].find(button => button.textContent === 'saveSchedule');
      if (!save) throw new Error('Schedule save button is not mounted');
      save.click();
    });

    expect(testState.apiMutate).not.toHaveBeenCalled();
    expect(testState.showToast).toHaveBeenCalledWith('enterText', 'error');
    expect(host.querySelector('.fixed.inset-0')).not.toBeNull();
  });

  it('preserves leading and trailing spaces in a nonempty title payload', async () => {
    await mountPlanner();
    click('[data-test-add]');
    setInputValue(host.querySelector<HTMLInputElement>('input[type="text"]')!, '  Preserve title spacing  ');

    await act(async () => {
      const save = [...host.querySelectorAll('button')].find(button => button.textContent === 'saveSchedule');
      if (!save) throw new Error('Schedule save button is not mounted');
      save.click();
    });

    expect(testState.apiMutate).toHaveBeenCalledWith(
      'POST', '/api/schedules',
      expect.objectContaining({ text: '  Preserve title spacing  ' }),
      expect.any(Object),
    );
  });

  it('uses the newly selected calendar date after navigation instead of the prior form date', async () => {
    await mountPlanner();

    click('[data-test-navigate]');
    expect(host.querySelector('[data-calendar-date]')?.textContent).toBe('2026-06-20');
    click('[data-test-duplicate]');

    expect(host.querySelector('.fixed.inset-0')?.querySelectorAll('select')).toHaveLength(0);
    expect(duplicateDateInput().value).toBe('2026-06-20');
    expect(host.textContent).toContain('newSchedule');
    expect(host.textContent).not.toContain('editSchedule');
    expect((host.querySelector('input[type="text"]') as HTMLInputElement).value).toBe('Study session');
    expect(sourceSchedule).toMatchObject({ id: 'source-event', text: 'Study session', start_time: '23:00' });
  });

  it('resets a date from a closed prior form, preserves duplicate edits, and saves a new event', async () => {
    await mountPlanner();

    click('[data-test-add]');
    expect(host.querySelector('.fixed.inset-0')?.querySelectorAll('select')).toHaveLength(0);
    const firstDateInput = duplicateDateInput();
    setInputValue(firstDateInput, '2026-06-30');
    expect(firstDateInput.value).toBe('2026-06-30');
    setInputValue(host.querySelector<HTMLInputElement>('input[type="text"]')!, 'Temporary event');
    await act(async () => {
      const save = [...host.querySelectorAll('button')].find(button => button.textContent === 'saveSchedule');
      if (!save) throw new Error('Schedule save button is not mounted');
      save.click();
    });
    expect(testState.apiMutate).toHaveBeenCalledTimes(1);
    expect(testState.apiMutate).toHaveBeenLastCalledWith(
      'POST', '/api/schedules', expect.objectContaining({ date: '2026-06-30', text: 'Temporary event', category: 'Personal' }), expect.any(Object),
    );
    expect(() => duplicateDateInput()).toThrow();

    click('[data-test-duplicate]');
    expect(duplicateDateInput().value).toBe('2026-06-12');
    expect(host.textContent).toContain('newSchedule');
    expect((host.querySelector('input[type="text"]') as HTMLInputElement).value).toBe('Study session');
    expect((host.querySelector('input[type="time"]') as HTMLInputElement).value).toBe('23:00');
    expect((host.querySelector('input[type="checkbox"]') as HTMLInputElement).checked).toBe(false);
    expect(host.querySelector('.fixed.inset-0')?.querySelectorAll('select')).toHaveLength(0);
    expect([...host.querySelectorAll('button')].some(button => button.textContent === '+1 day' && button.className.includes('bg-primary'))).toBe(true);

    const dateInput = duplicateDateInput();
    setInputValue(dateInput, '2026-07-01');
    await act(async () => {
      const save = [...host.querySelectorAll('button')].find(button => button.textContent === 'saveSchedule');
      if (!save) throw new Error('Schedule save button is not mounted');
      save.click();
    });

    expect(testState.apiMutate).toHaveBeenCalledTimes(2);
    expect(testState.apiMutate).toHaveBeenLastCalledWith(
      'POST', '/api/schedules', expect.objectContaining({ date: '2026-07-01', text: 'Study session', category: 'Study' }), expect.any(Object),
    );
    expect(sourceSchedule).toMatchObject({ id: 'source-event', text: 'Study session', start_time: '23:00' });
  });

  it('preserves an existing legacy category when editing without rendering a category selector', async () => {
    await mountPlanner();

    click('[data-test-edit-legacy]');
    expect(host.querySelector('.fixed.inset-0')?.querySelectorAll('select')).toHaveLength(0);
    expect((host.querySelector('input[type="text"]') as HTMLInputElement).value).toBe('Legacy category event');

    await act(async () => {
      const save = [...host.querySelectorAll('button')].find(button => button.textContent === 'saveSchedule');
      if (!save) throw new Error('Schedule save button is not mounted');
      save.click();
    });

    expect(testState.apiMutate).toHaveBeenCalledWith(
      'PUT', '/api/schedules/legacy-category-event',
      expect.objectContaining({ category: 'LegacyCustomCategory', date: '2026-06-12', text: 'Legacy category event' }),
      expect.any(Object),
    );
  });

  it('creates a D-day with the existing default category and without time or category selectors', async () => {
    await mountPlanner();

    click('[data-test-add]');
    const modal = host.querySelector('.fixed.inset-0');
    const ddayToggle = modal?.querySelector<HTMLInputElement>('input[type="checkbox"]');
    if (!ddayToggle) throw new Error('D-day toggle is not mounted');
    act(() => ddayToggle.click());
    const titleInput = modal?.querySelector<HTMLInputElement>('input[type="text"]');
    if (!titleInput) throw new Error('Schedule title input is not mounted');
    setInputValue(titleInput, 'Important date');

    expect(modal?.querySelectorAll('select')).toHaveLength(0);
    expect(modal?.querySelectorAll('input[type="time"]')).toHaveLength(0);
    expect(modal?.textContent).toContain('k80DdayTimeHint');

    await act(async () => {
      const save = [...host.querySelectorAll('button')].find(button => button.textContent === 'saveSchedule');
      if (!save) throw new Error('Schedule save button is not mounted');
      save.click();
    });

    expect(testState.apiMutate).toHaveBeenCalledWith(
      'POST', '/api/schedules',
      expect.objectContaining({ category: 'Personal', is_dday: true, start_time: '00:00', end_time: '23:59' }),
      expect.any(Object),
    );
  });
});
