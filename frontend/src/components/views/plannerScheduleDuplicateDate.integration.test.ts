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
  overlap: false,
  duplicateTitle: false,
}));

vi.mock('../../hooks/useApiMutation', () => ({
  useApiMutation: () => ({ mutate: testState.apiMutate }),
}));

vi.mock('../../hooks/useEscapeKey', () => ({ useEscapeKey: () => {} }));

vi.mock('../../lib/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key, lang: 'en' as const }),
  resolveIntlLocale: () => 'en-US',
}));

vi.mock('swr', () => ({ default: () => ({ data: [], mutate: vi.fn() }) }));

vi.mock('./features/planner/calendar-ui', async () => {
  const { createElement } = await import('react');
  return {
    CalendarShell: (props: {
      anchorDate: string;
      onAnchorDateChange: (date: string) => void;
      onAddSchedule: () => void;
      dayScheduleActions: { onDuplicate: (id: string) => void; onView: (id: string) => void };
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
        'data-test-view-duplicate-title': true,
        onClick: () => props.dayScheduleActions.onView('same-title-other-id'),
      }, 'Open duplicate-title event'),
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
    schedules: [
      sourceSchedule,
      ...(testState.duplicateTitle ? [{ ...sourceSchedule, id: 'same-title-other-id' }] : []),
      ...(testState.overlap ? [{ ...sourceSchedule, id: 'overlap', start_time: '09:00', end_time: '12:00', end_next_day: false }] : []),
    ],
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

function deferredSave() {
  let resolve!: (ok: boolean) => void;
  const promise = new Promise<boolean>(done => { resolve = done; });
  return { promise, resolve };
}

function saveButton(): HTMLButtonElement {
  const button = [...host.querySelectorAll('button')].find(value => value.textContent === 'saveSchedule');
  if (!button) throw new Error('Schedule save button is not mounted');
  return button;
}

function namedButton(label: string): HTMLButtonElement {
  const button = [...host.querySelectorAll('button')].find(value => value.textContent === label);
  if (!button) throw new Error(`Missing button: ${label}`);
  return button;
}

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
  testState.overlap = false;
  testState.duplicateTitle = false;
  testState.apiMutate.mockReset().mockResolvedValue(true);
  testState.showToast.mockReset();
});

afterEach(() => {
  if (root) act(() => root!.unmount());
  root = undefined;
  host?.remove();
});

describe('PlannerView Schedule duplication date', () => {
  it('carries quick-edit draft into the existing form and mutates only the selected duplicate-title event on explicit Save', async () => {
    testState.duplicateTitle = true;
    await mountPlanner();
    click('[data-test-view-duplicate-title]');
    const title = host.querySelector('[data-schedule-event-detail] h3')!;
    act(() => title.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })));
    const quickEdit = host.querySelector<HTMLInputElement>('[data-schedule-event-quick-edit]')!;
    setInputValue(quickEdit, 'Draft for selected duplicate');

    act(() => quickEdit.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })));

    const formTitle = host.querySelector<HTMLInputElement>('.fixed.inset-0 input[type="text"]')!;
    expect(formTitle.value).toBe('Draft for selected duplicate');
    expect(testState.apiMutate).not.toHaveBeenCalled();
    expect(sourceSchedule.text).toBe('Study session');

    await act(async () => saveButton().click());
    expect(testState.apiMutate).toHaveBeenCalledTimes(1);
    expect(testState.apiMutate.mock.calls[0][0]).toBe('PUT');
    expect(testState.apiMutate.mock.calls[0][1]).toBe('/api/schedules/same-title-other-id');
    expect(testState.apiMutate.mock.calls[0][2]).toMatchObject({
      text: 'Draft for selected duplicate',
      date: '2026-06-12',
      start_time: '23:00',
      end_time: '01:00',
      end_next_day: true,
      category: 'Study',
      is_dday: false,
    });
    expect(sourceSchedule.text).toBe('Study session');
  });

  it('does not save on quick-edit Escape, and ordinary Edit opens the original title', async () => {
    testState.duplicateTitle = true;
    await mountPlanner();
    click('[data-test-view-duplicate-title]');
    const title = host.querySelector('[data-schedule-event-detail] h3')!;
    act(() => title.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })));
    const quickEdit = host.querySelector<HTMLInputElement>('[data-schedule-event-quick-edit]')!;
    setInputValue(quickEdit, 'Cancelled draft');
    act(() => quickEdit.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    expect(testState.apiMutate).not.toHaveBeenCalled();
    expect(host.querySelector('[data-schedule-event-detail]')).toBeNull();

    click('[data-test-view-duplicate-title]');
    act(() => (host.querySelector('[data-schedule-event-edit]') as HTMLButtonElement).click());
    expect(host.querySelector<HTMLInputElement>('.fixed.inset-0 input[type="text"]')!.value).toBe('Study session');
    expect(testState.apiMutate).not.toHaveBeenCalled();
    expect(sourceSchedule.text).toBe('Study session');
  });

  it('cancelling the edit form after quick edit leaves the original Schedule unchanged', async () => {
    testState.duplicateTitle = true;
    await mountPlanner();
    click('[data-test-view-duplicate-title]');
    act(() => host.querySelector('[data-schedule-event-detail] h3')!.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })));
    const quickEdit = host.querySelector<HTMLInputElement>('[data-schedule-event-quick-edit]')!;
    setInputValue(quickEdit, 'Cancelled in form');
    act(() => quickEdit.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })));
    act(() => host.querySelector<HTMLElement>('.fixed.inset-0')!.click());
    expect(testState.apiMutate).not.toHaveBeenCalled();
    expect(sourceSchedule.text).toBe('Study session');
  });

  it('keeps a whitespace-only quick-edit draft subject to the existing form validation', async () => {
    testState.duplicateTitle = true;
    await mountPlanner();
    click('[data-test-view-duplicate-title]');
    act(() => host.querySelector('[data-schedule-event-detail] h3')!.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })));
    const quickEdit = host.querySelector<HTMLInputElement>('[data-schedule-event-quick-edit]')!;
    setInputValue(quickEdit, '   ');
    act(() => quickEdit.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })));
    expect(host.querySelector<HTMLInputElement>('.fixed.inset-0 input[type="text"]')!.value).toBe('   ');
    await act(async () => saveButton().click());
    expect(testState.apiMutate).not.toHaveBeenCalled();
    expect(testState.showToast).toHaveBeenCalledWith('enterText', 'error');
  });

  it('reproduces the active IME Enter submission candidate', async () => {
    await mountPlanner();
    click('[data-test-add]');
    const input = host.querySelector<HTMLInputElement>('input[type="text"]')!;
    setInputValue(input, '조합 중 제목');
    act(() => {
      input.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true, data: '조합 중' }));
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, isComposing: true }));
      input.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: '조합 중' }));
    });
    expect(testState.apiMutate).toHaveBeenCalledTimes(0);
  });

  it('suppresses the keyCode 229 fallback but saves on Enter after composition ends', async () => {
    await mountPlanner();
    click('[data-test-add]');
    const input = host.querySelector<HTMLInputElement>('input[type="text"]')!;
    setInputValue(input, '한국어 일정');

    act(() => {
      input.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true, data: '한국어' }));
      input.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'Enter', keyCode: 229, bubbles: true, isComposing: false,
      }));
    });
    expect(testState.apiMutate).not.toHaveBeenCalled();

    act(() => input.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: '한국어' })));
    expect(testState.apiMutate).not.toHaveBeenCalled();

    await act(async () => {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });
    expect(testState.apiMutate).toHaveBeenCalledTimes(1);
    expect(testState.apiMutate.mock.calls[0][2]).toMatchObject({ text: '한국어 일정' });
  });

  it.each(['POST', 'PUT', 'D-day'] as const)('guards repeated Enter and click submissions for %s', async kind => {
    const pending = deferredSave();
    testState.apiMutate.mockReturnValue(pending.promise);
    await mountPlanner();
    click(kind === 'PUT' ? '[data-test-edit-legacy]' : '[data-test-add]');
    if (kind === 'D-day') act(() => host.querySelector<HTMLInputElement>('.fixed.inset-0 input[type="checkbox"]')!.click());
    const input = host.querySelector<HTMLInputElement>('input[type="text"]')!;
    setInputValue(input, '  One event  ');
    act(() => {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      saveButton().click();
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });
    expect(testState.apiMutate).toHaveBeenCalledTimes(1);
    expect(testState.apiMutate.mock.calls[0][0]).toBe(kind === 'PUT' ? 'PUT' : 'POST');
    expect(testState.apiMutate.mock.calls[0][2]).toMatchObject({
      text: '  One event  ', date: '2026-06-12', color: 'purple',
      category: kind === 'PUT' ? 'LegacyCustomCategory' : 'Personal',
      is_dday: kind === 'D-day', end_next_day: kind === 'PUT',
      start_time: kind === 'D-day' ? '00:00' : kind === 'PUT' ? '23:00' : '10:00',
      end_time: kind === 'D-day' ? '23:59' : kind === 'PUT' ? '01:00' : '11:00',
    });
    expect(testState.apiMutate.mock.calls[0][3]).toEqual({ revalidate: 'both', successMsg: 'scheduleSaved' });
    expect(saveButton().disabled).toBe(true);
    await act(async () => { pending.resolve(true); });
    expect(host.querySelector('.fixed.inset-0')).toBeNull();
  });

  it('keeps failed input open and permits a deliberate retry', async () => {
    const pending = deferredSave();
    testState.apiMutate.mockReturnValueOnce(pending.promise).mockResolvedValueOnce(true);
    await mountPlanner();
    click('[data-test-add]');
    setInputValue(host.querySelector<HTMLInputElement>('input[type="text"]')!, 'Retry title');
    act(() => saveButton().click());
    await act(async () => { pending.resolve(false); });
    expect(saveButton().disabled).toBe(false);
    expect(host.querySelector<HTMLInputElement>('input[type="text"]')!.value).toBe('Retry title');
    await act(async () => saveButton().click());
    expect(testState.apiMutate).toHaveBeenCalledTimes(2);
    expect(testState.apiMutate.mock.calls[1]).toEqual(testState.apiMutate.mock.calls[0]);
    expect(host.querySelector('.fixed.inset-0')).toBeNull();
  });

  it.each([true, false])('does not let an old completion (%s) close or unlock a newer pending form', async result => {
    const old = deferredSave();
    const current = deferredSave();
    testState.apiMutate.mockReturnValueOnce(old.promise).mockReturnValueOnce(current.promise);
    await mountPlanner();
    click('[data-test-add]');
    setInputValue(host.querySelector<HTMLInputElement>('input[type="text"]')!, 'Old');
    act(() => saveButton().click());
    act(() => host.querySelector<HTMLElement>('.fixed.inset-0')!.click());
    click('[data-test-duplicate]');
    act(() => saveButton().click());
    await act(async () => { old.resolve(result); });
    expect(saveButton().disabled).toBe(true);
    expect(host.querySelector<HTMLInputElement>('input[type="text"]')!.value).toBe('Study session');
    act(() => host.querySelector<HTMLInputElement>('input[type="text"]')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })));
    expect(testState.apiMutate).toHaveBeenCalledTimes(2);
    await act(async () => { current.resolve(true); });
    expect(host.querySelector('.fixed.inset-0')).toBeNull();
  });

  it.each([true, false])('preserves overlap confirmation, confirmed=%s', async confirmed => {
    testState.overlap = true;
    const pending = deferredSave();
    testState.apiMutate.mockReturnValue(pending.promise);
    await mountPlanner();
    click('[data-test-add]');
    setInputValue(host.querySelector<HTMLInputElement>('input[type="text"]')!, 'Overlap');
    act(() => { saveButton().click(); saveButton().click(); });
    expect(testState.apiMutate).not.toHaveBeenCalled();
    expect(host.textContent).toContain('overlapMsg');
    if (!confirmed) {
      act(() => namedButton('cancel').click());
      expect(testState.apiMutate).not.toHaveBeenCalled();
      expect(saveButton().disabled).toBe(false);
      return;
    }
    const confirm = namedButton('saveLabel');
    act(() => { confirm.click(); confirm.click(); });
    expect(testState.apiMutate).toHaveBeenCalledTimes(1);
    expect(saveButton().disabled).toBe(true);
    await act(async () => { pending.resolve(true); });
    expect(host.querySelector('.fixed.inset-0')).toBeNull();
  });

  it('dispatches one POST for two rapid Save clicks while the request is unresolved', async () => {
    let resolve!: (ok: boolean) => void;
    testState.apiMutate.mockReturnValue(new Promise<boolean>(done => { resolve = done; }));
    await mountPlanner();
    click('[data-test-add]');
    setInputValue(host.querySelector<HTMLInputElement>('input[type="text"]')!, 'One event');
    const save = [...host.querySelectorAll('button')].find(button => button.textContent === 'saveSchedule')!;
    act(() => { save.click(); save.click(); });
    const count = testState.apiMutate.mock.calls.length;
    await act(async () => { resolve(true); });
    expect(count).toBe(1);
    expect(host.querySelector('.fixed.inset-0')).toBeNull();
  });
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
