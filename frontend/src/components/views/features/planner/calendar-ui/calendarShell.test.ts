// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DateTime } from 'luxon';
import type { AppSettings, Theme } from '../../../../types';
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
import { buildPlannerCalendarShellProjection } from './usePlannerCalendarProjection';

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
