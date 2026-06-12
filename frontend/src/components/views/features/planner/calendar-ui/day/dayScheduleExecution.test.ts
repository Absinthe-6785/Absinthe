// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DateTime } from 'luxon';
import type { Theme } from '../../../../../types';
import type { NoteBase } from '../../../../noteUtils';
import {
  buildPlannerCalendarProjection,
  formatPlannerCalendarPresentation,
} from '../../calendar';
import { CalendarShell } from '../CalendarShell';
import { DayCalendarView } from './DayCalendarView';
import { DayScheduleTimeline } from './DayScheduleTimeline';
import { dayScheduleActionsEnabled } from './dayScheduleActions';

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

const NOW = DateTime.fromISO('2027-02-03T12:00:00', { zone: 'Asia/Seoul' });

function buildDayFixture(
  overrides: Partial<Parameters<typeof buildPlannerCalendarProjection>[0]> = {},
) {
  const projection = buildPlannerCalendarProjection({
    notes: [],
    scheduleBlocks: [],
    weeklySchedules: [],
    todos: [],
    routines: [],
    legacyDdays: [],
    anchorDate: '2027-02-03',
    viewMode: 'day',
    now: NOW,
    ...overrides,
  });

  return {
    projection,
    presentation: formatPlannerCalendarPresentation(projection, 'en'),
  };
}

describe('dayScheduleActionsEnabled', () => {
  it('returns false when no callbacks are provided', () => {
    expect(dayScheduleActionsEnabled(undefined)).toBe(false);
    expect(dayScheduleActionsEnabled({})).toBe(false);
  });

  it('returns true when any callback is provided', () => {
    expect(dayScheduleActionsEnabled({ onAdd: () => {} })).toBe(true);
    expect(dayScheduleActionsEnabled({ onEdit: () => {} })).toBe(true);
    expect(dayScheduleActionsEnabled({ onDelete: () => {} })).toBe(true);
  });
});

describe('DayScheduleTimeline schedule execution wiring', () => {
  const todayBlock = {
    id: 'today',
    dateKey: '2027-02-03',
    title: 'Deep Work',
    startTime: '10:00',
    endTime: '12:00',
    endNextDay: false,
    category: 'Work',
    color: 'purple',
    source: 'schedule' as const,
  };

  const carryBlock = {
    id: 'carry',
    dateKey: '2027-02-02',
    title: 'Night work',
    startTime: '23:00',
    endTime: '01:00',
    endNextDay: true,
    category: 'Work',
    color: 'blue',
    source: 'schedule' as const,
  };

  it('renders add, edit, and delete controls when scheduleActions are provided', () => {
    const html = renderToStaticMarkup(
      createElement(DayScheduleTimeline, {
        blocks: [todayBlock],
        carryOverBlocks: [carryBlock],
        scheduleActions: {
          onAdd: () => {},
          onEdit: () => {},
          onDelete: () => {},
        },
      }),
    );

    expect(html).toContain('data-planner-day-schedule-add="true"');
    expect(html).toContain('data-planner-day-schedule-edit="today"');
    expect(html).toContain('data-planner-day-schedule-delete="today"');
    expect(html).not.toContain('data-planner-day-schedule-edit="carry"');
    expect(html).not.toContain('data-planner-day-schedule-delete="carry"');
    expect(html).toContain('data-planner-day-block-carryover="true"');
  });

  it('shows an actionable schedule section on empty days when onAdd is wired', () => {
    const html = renderToStaticMarkup(
      createElement(DayScheduleTimeline, {
        blocks: [],
        carryOverBlocks: [],
        scheduleActions: { onAdd: () => {} },
      }),
    );

    expect(html).toContain('data-planner-day-schedule-timeline');
    expect(html).toContain('data-planner-day-schedule-add="true"');
  });

  it('invokes schedule callbacks when action buttons are clicked', () => {
    const onAdd = vi.fn();
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    const container = document.createElement('div');
    const root = createRoot(container);

    act(() => {
      root.render(createElement(DayScheduleTimeline, {
        blocks: [todayBlock],
        carryOverBlocks: [],
        scheduleActions: { onAdd, onEdit, onDelete },
      }));
    });

    act(() => {
      (container.querySelector('[data-planner-day-schedule-add="true"]') as HTMLButtonElement).click();
      (container.querySelector('[data-planner-day-schedule-edit="today"]') as HTMLButtonElement).click();
      (container.querySelector('[data-planner-day-schedule-delete="today"]') as HTMLButtonElement).click();
    });

    expect(onAdd).toHaveBeenCalledTimes(1);
    expect(onEdit).toHaveBeenCalledWith('today');
    expect(onDelete).toHaveBeenCalledWith('today');

    act(() => {
      root.unmount();
    });
  });
});

describe('DayCalendarView schedule execution wiring', () => {
  it('forwards scheduleActions to the schedule timeline', () => {
    const { projection, presentation } = buildDayFixture();
    const html = renderToStaticMarkup(
      createElement(DayCalendarView, {
        projection,
        presentation,
        theme,
        scheduleActions: { onAdd: () => {} },
      }),
    );

    expect(html).toContain('data-planner-day-schedule-timeline');
    expect(html).toContain('data-planner-day-schedule-add="true"');
  });

  it('keeps schedule section hidden on empty days without scheduleActions', () => {
    const { projection, presentation } = buildDayFixture();
    const html = renderToStaticMarkup(
      createElement(DayCalendarView, { projection, presentation, theme }),
    );

    expect(html).not.toContain('data-planner-day-schedule-timeline');
  });
});

describe('CalendarShell day schedule execution wiring', () => {
  it('passes dayScheduleActions through to Day view', () => {
    const html = renderToStaticMarkup(
      createElement(CalendarShell, {
        now: NOW,
        anchorDate: '2027-02-03',
        schedules: [],
        todos: [],
        routines: [],
        weeklySchedules: [],
        legacyDdays: [],
        appSettings: {
          darkMode: false,
          defaultCategory: 'Personal',
          defaultColor: 'blue',
          language: 'en',
        },
        theme,
        initialMode: 'day',
        dayScheduleActions: { onAdd: () => {} },
      }),
    );

    expect(html).toContain('data-planner-calendar-day');
    expect(html).toContain('data-planner-day-schedule-add="true"');
  });
});
