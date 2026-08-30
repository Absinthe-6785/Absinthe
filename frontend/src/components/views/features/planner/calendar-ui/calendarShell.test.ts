// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DateTime } from 'luxon';
import type { AppSettings, Theme, Todo } from '../../../../types';
import type { NoteBase } from '../../../noteUtils';
import { applyEventToNote } from '../../knowledge/trace/eventNotes';
import { CalendarShell } from './CalendarShell';
import { DEFAULT_PLANNER_CALENDAR_MODE } from './calendarShellModels';
import {
  buildCalendarPlaceholderSummary,
  resolveCalendarPeriodLabel,
} from './calendarPlaceholderSummary';
import {
  buildPlannerCalendarProjection,
  formatPlannerCalendarPresentation,
} from '../calendar';
import {
  buildPlannerCalendarShellProjection,
  usePlannerCalendarProjection,
} from './usePlannerCalendarProjection';

vi.mock('../../../../../store/useNotesStore', () => ({
  useNotesStore: (selector: (state: { notes: NoteBase[] }) => unknown) => selector({ notes: [] }),
}));

const theme: Theme = {
  card: 'bg-surface',
  input: 'bg-surface-alt',
  border: 'border-border',
  textMuted: 'text-muted',
  hoverBg: 'hover:bg-surface-alt',
};

const appSettings: AppSettings = {
  darkMode: false,
  defaultCategory: 'Personal',
  defaultColor: 'blue',
  language: 'en',
};

const NOW = DateTime.fromISO('2027-02-03T12:00:00', { zone: 'Asia/Seoul' });

function note(id: string, overrides: Partial<NoteBase> = {}): NoteBase {
  return {
    id,
    title: 'Note',
    body: '',
    updatedAt: Date.now(),
    folderId: null,
    deletedAt: null,
    ...overrides,
  };
}

function shellProps(overrides: Partial<Parameters<typeof CalendarShell>[0]> = {}) {
  return {
    now: NOW,
    anchorDate: '2027-02-03',
    schedules: [],
    weeklySchedules: [],
    appSettings,
    theme,
    ...overrides,
  };
}

function ProjectionProbe({ todos }: { todos: readonly Todo[] }) {
  const { projection } = usePlannerCalendarProjection({
    now: NOW,
    anchorDate: '2027-02-03',
    schedules: [],
    weeklySchedules: [],
    appSettings,
    todos,
  });
  const bundle = projection.byDate.get('2027-02-03');
  return createElement('output', {
    'data-todo-count': String(bundle?.todos.length ?? 0),
    'data-todo-ids': bundle?.todos.map(todo => todo.id).join(',') ?? '',
  });
}

describe('DEFAULT_PLANNER_CALENDAR_MODE', () => {
  it('keeps month as the supporting calendar mode', () => {
    expect(DEFAULT_PLANNER_CALENDAR_MODE).toBe('month');
  });
});

describe('buildPlannerCalendarShellProjection', () => {
  it('wires notes and schedules into projection and presentation', () => {
    const travel = applyEventToNote(note('travel', { title: 'Travel' }), {
      title: 'Travel',
      eventDate: '2027-02-01',
      eventEndDate: '2027-02-05',
    });

    const result = buildPlannerCalendarShellProjection({
      notes: [travel],
      now: NOW,
      anchorDate: '2027-02-03',
      schedules: [{
        id: 's1',
        text: 'Study',
        start_time: '09:00',
        end_time: '10:00',
        is_dday: false,
        color: 'purple',
        category: 'Personal',
      }],
      weeklySchedules: [],
      appSettings,
    });

    expect(result.projection.core.eventOccurrences.length).toBeGreaterThan(0);
    expect(result.projection.views.month.cells).toHaveLength(42);
    expect(result.presentation.labels.monthTitle).toContain('2027');
    expect(JSON.stringify(result.projection)).not.toMatch(/February/);
  });

  it('keeps fetched Todos in the visible calendar bundle without mutating the source collection', () => {
    const todos: Array<Todo & { date: string }> = [
      { id: 'todo-visible-1', date: '2027-02-03', text: 'Visible first', done: false },
      { id: 'todo-visible-2', date: '2027-02-03', text: 'Visible second', done: true },
      { id: 'todo-outside', date: '2027-04-01', text: 'Outside range', done: false },
    ];
    const originalTodos = todos.map(todo => ({ ...todo }));

    const result = buildPlannerCalendarShellProjection({
      notes: [],
      now: NOW,
      anchorDate: '2027-02-03',
      schedules: [{
        id: 's1',
        text: 'Study',
        start_time: '09:00',
        end_time: '10:00',
        is_dday: false,
        color: 'purple',
        category: 'Personal',
      }],
      weeklySchedules: [],
      appSettings,
      todos,
    });

    expect(result.projection.byDate.get('2027-02-03')?.todos).toEqual([
      { id: 'todo-visible-1', text: 'Visible first', done: false },
      { id: 'todo-visible-2', text: 'Visible second', done: true },
    ]);
    expect(result.projection.byDate.get('2027-04-01')).toBeUndefined();
    expect(result.projection.byDate.get('2027-02-03')?.blocks).toHaveLength(1);
    expect(todos).toEqual(originalTodos);
  });

  it('keeps an empty Todo collection empty in the calendar bundle', () => {
    const result = buildPlannerCalendarShellProjection({
      notes: [],
      now: NOW,
      anchorDate: '2027-02-03',
      schedules: [],
      weeklySchedules: [],
      appSettings,
      todos: [],
    });

    expect(result.projection.byDate.get('2027-02-03')?.todos).toEqual([]);
  });

  it('passes fetched Todos through the real calendar projection hook', () => {
    const html = renderToStaticMarkup(createElement(ProjectionProbe, {
      todos: [
        { id: 'todo-hook-1', date: '2027-02-03', text: 'Hook visible', done: false },
      ],
    }));

    expect(html).toContain('data-todo-count="1"');
    expect(html).toContain('data-todo-ids="todo-hook-1"');
  });
});

describe('calendar presentation labels', () => {
  it('consumes presentation labels without embedding locale formatting logic', () => {
    const projection = buildPlannerCalendarProjection({
      notes: [],
      scheduleBlocks: [],
      weeklySchedules: [],
      todos: [],
      routines: [],
      anchorDate: '2027-02-03',
      viewMode: 'month',
      now: NOW,
    });
    const presentation = formatPlannerCalendarPresentation(projection, 'ko');

    expect(resolveCalendarPeriodLabel('month', presentation)).toBe(presentation.labels.monthTitle);
    expect(presentation.labels.monthTitle.length).toBeGreaterThan(0);
  });
});

describe('CalendarShell', () => {
  it('renders today-first schedule flow with calendar as supporting context', () => {
    const html = renderToStaticMarkup(
      createElement(CalendarShell, shellProps()),
    );

    expect(html).toContain('data-planner-calendar-shell');
    expect(html).toContain('data-planner-calendar-mode="month"');
    expect(html).toContain('data-planner-calendar-period-nav');
    expect(html).toContain('data-planner-calendar-month');
    expect(html).toContain('data-k133b-schedule-flow');
    expect(html).toContain('data-k133b-calendar-supporting-nav');
    expect(html).toContain('data-k117-schedule-workspace');
    expect(html).not.toContain('data-planner-upcoming-agenda');
    expect(html).not.toContain('data-planner-calendar-mode-switcher');
    expect(html).not.toContain('data-planner-calendar-day');
    expect(html).not.toContain('data-planner-calendar-week');
  });

  it('renders multiple eligible Todos once in the active production calendar surface', () => {
    const html = renderToStaticMarkup(
      createElement(CalendarShell, shellProps({
        schedules: [{
          id: 'schedule-visible',
          text: 'Study',
          start_time: '09:00',
          end_time: '10:00',
          is_dday: false,
          color: 'purple',
          category: 'Personal',
        }],
        routines: [{
          id: 'routine-visible',
          date: '2027-02-03',
          text: 'Stretch',
          done: false,
          is_active: true,
        }],
        todos: [
          { id: 'todo-render-1', date: '2027-02-03', text: 'Pack bag', done: false },
          { id: 'todo-render-2', date: '2027-02-03', text: 'Charge phone', done: true },
        ],
      })),
    );

    expect(html).toContain('data-planner-day-todos');
    expect(html).toContain('data-planner-day-todo="todo-render-1"');
    expect(html).toContain('data-planner-day-todo="todo-render-2"');
    expect((html.match(/data-planner-day-todo="/g) ?? []).length).toBe(2);
    expect(html).toContain('Pack bag');
    expect(html).toContain('Charge phone');
    expect(html).toContain('Study');
    expect(html).toContain('Stretch');
  });

  it('keeps an empty Todo collection safe while schedule and routine surfaces remain mounted', () => {
    const html = renderToStaticMarkup(
      createElement(CalendarShell, shellProps({
        schedules: [{
          id: 'schedule-empty-todo',
          text: 'Read',
          start_time: '11:00',
          end_time: '12:00',
          is_dday: false,
          color: 'blue',
          category: 'Personal',
        }],
        routines: [{
          id: 'routine-empty-todo',
          date: '2027-02-03',
          text: 'Walk',
          done: true,
          is_active: true,
        }],
        todos: [],
      })),
    );

    expect(html).not.toContain('data-planner-day-todos');
    expect(html).toContain('data-planner-day-routines');
    expect(html).toContain('Read');
    expect(html).toContain('Walk');
  });

  it('renders period navigation controls when onAnchorDateChange is provided', () => {
    const html = renderToStaticMarkup(
      createElement(CalendarShell, shellProps({ onAnchorDateChange: () => {} })),
    );

    expect(html).toContain('data-planner-calendar-nav-prev');
    expect(html).toContain('data-planner-calendar-nav-next');
    expect(html).toContain('data-planner-calendar-period-label');
  });
});

describe('CalendarShell projection wiring with populated vault', () => {
  it('surfaces event counts through the shell placeholder', () => {
    const notes = [
      applyEventToNote(note('e1', { title: 'Exam' }), {
        title: 'Exam',
        eventDate: '2027-02-10',
      }),
    ];

    const { projection } = buildPlannerCalendarShellProjection({
      notes,
      now: NOW,
      anchorDate: '2027-02-03',
      schedules: [],
      weeklySchedules: [],
      appSettings,
    });

    const summary = buildCalendarPlaceholderSummary('month', projection);
    expect(summary.lines.some(line => line.includes('events'))).toBe(true);
  });
});
