// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DateTime } from 'luxon';
import type { AppSettings, Theme } from '../../../../types';
import type { NoteBase } from '../../../noteUtils';
import { applyEventToNote } from '../../knowledge/trace/eventNotes';
import { CalendarShell } from './CalendarShell';
import { CalendarModeSwitcher } from './CalendarModeSwitcher';
import { CalendarViewPlaceholder } from './CalendarViewPlaceholder';
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
    todos: [],
    routines: [],
    weeklySchedules: [],
    legacyDdays: [],
    appSettings,
    theme,
    ...overrides,
  };
}

describe('DEFAULT_PLANNER_CALENDAR_MODE', () => {
  it('defaults to day for daily-first planner entry', () => {
    expect(DEFAULT_PLANNER_CALENDAR_MODE).toBe('day');
  });
});

describe('buildPlannerCalendarShellProjection', () => {
  it('wires notes and operational data into projection and presentation', () => {
    const travel = applyEventToNote(note('travel', { title: 'Travel' }), {
      title: 'Travel',
      eventDate: '2027-02-01',
      eventEndDate: '2027-02-05',
    });

    const result = buildPlannerCalendarShellProjection({
      notes: [travel],
      now: NOW,
      anchorDate: '2027-02-03',
      viewMode: 'month',
      schedules: [{
        id: 's1',
        text: 'Study',
        start_time: '09:00',
        end_time: '10:00',
        is_dday: false,
        color: 'blue',
        category: 'Study',
      }],
      todos: [{ id: 't1', text: 'Pack', done: false }],
      routines: [{ id: 'r1', text: 'Stretch', done: false, is_active: true }],
      weeklySchedules: [],
      legacyDdays: [],
      appSettings,
    });

    expect(result.projection.core.eventOccurrences.length).toBeGreaterThan(0);
    expect(result.projection.views.month.cells).toHaveLength(42);
    expect(result.presentation.labels.monthTitle).toContain('2027');
    expect(JSON.stringify(result.projection)).not.toMatch(/February/);
  });
});

describe('CalendarModeSwitcher', () => {
  it('renders all calendar modes', () => {
    const html = renderToStaticMarkup(
      createElement(CalendarModeSwitcher, {
        activeMode: 'month',
        onModeChange: () => {},
        theme,
      }),
    );

    expect(html).toContain('data-planner-calendar-mode-switcher');
    expect(html).toContain('data-planner-calendar-mode-option="month"');
    expect(html).toContain('data-planner-calendar-mode-option="week"');
    expect(html).toContain('data-planner-calendar-mode-option="day"');
    expect(html).toContain('data-planner-calendar-mode-option="agenda"');
  });
});

describe('CalendarViewPlaceholder', () => {
  it('renders month stats from projection', () => {
    const travel = applyEventToNote(note('travel', { title: 'Travel' }), {
      title: 'Travel',
      eventDate: '2027-02-01',
      eventEndDate: '2027-02-05',
    });

    const { projection, presentation } = buildPlannerCalendarShellProjection({
      notes: [travel],
      now: NOW,
      anchorDate: '2027-02-03',
      viewMode: 'month',
      schedules: [],
      todos: [],
      routines: [],
      weeklySchedules: [],
      legacyDdays: [],
      appSettings,
    });

    const html = renderToStaticMarkup(
      createElement(CalendarViewPlaceholder, {
        mode: 'month',
        projection,
        presentation,
        theme,
      }),
    );

    expect(html).toContain('data-planner-calendar-placeholder-mode="month"');
    expect(html).toContain('Month View');
    expect(html).toContain('42 days loaded');
    expect(html).toContain('data-planner-calendar-period-label');
  });

  it('shows empty state when projection has no items in range', () => {
    const projection = buildPlannerCalendarProjection({
      notes: [],
      scheduleBlocks: [],
      weeklySchedules: [],
      todos: [],
      routines: [],
      legacyDdays: [],
      anchorDate: '2027-02-03',
      viewMode: 'agenda',
      now: NOW,
    });
    const presentation = formatPlannerCalendarPresentation(projection, 'en');
    const summary = buildCalendarPlaceholderSummary('agenda', projection);

    expect(summary.isEmpty).toBe(true);

    const html = renderToStaticMarkup(
      createElement(CalendarViewPlaceholder, {
        mode: 'agenda',
        projection,
        presentation,
        theme,
      }),
    );

    expect(html).toContain('data-planner-calendar-empty="true"');
  });

  it('consumes presentation labels without embedding locale formatting logic', () => {
    const projection = buildPlannerCalendarProjection({
      notes: [],
      scheduleBlocks: [],
      weeklySchedules: [],
      todos: [],
      routines: [],
      legacyDdays: [],
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
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders shell with default day mode and day calendar view', () => {
    const html = renderToStaticMarkup(
      createElement(CalendarShell, shellProps()),
    );

    expect(html).toContain('data-planner-calendar-shell');
    expect(html).toContain('data-planner-calendar-mode="day"');
    expect(html).toContain('data-planner-calendar-period-nav');
    expect(html).toContain('data-planner-calendar-day');
    expect(html).not.toContain('data-planner-calendar-placeholder-mode="day"');
  });

  it('renders period navigation controls when onAnchorDateChange is provided', () => {
    const html = renderToStaticMarkup(
      createElement(CalendarShell, shellProps({ onAnchorDateChange: () => {} })),
    );

    expect(html).toContain('data-planner-calendar-nav-prev');
    expect(html).toContain('data-planner-calendar-nav-next');
    expect(html).toContain('data-planner-calendar-period-label');
  });

  it('honours initial mode override for week view', () => {
    const html = renderToStaticMarkup(
      createElement(CalendarShell, shellProps({ initialMode: 'week' })),
    );

    expect(html).toContain('data-planner-calendar-mode="week"');
    expect(html).toContain('data-planner-calendar-week');
    expect(html).toContain('data-planner-week-columns');
    expect(html).toContain('Week View');
    expect(html).not.toContain('data-planner-calendar-placeholder-mode="week"');
  });

  it('honours initial mode override for day view', () => {
    const html = renderToStaticMarkup(
      createElement(CalendarShell, shellProps({ initialMode: 'day' })),
    );

    expect(html).toContain('data-planner-calendar-mode="day"');
    expect(html).toContain('data-planner-calendar-day');
    expect(html).toContain('Day View');
    expect(html).not.toContain('data-planner-calendar-placeholder-mode="day"');
  });

  it('honours initial mode override for agenda view', () => {
    const html = renderToStaticMarkup(
      createElement(CalendarShell, shellProps({ initialMode: 'agenda' })),
    );

    expect(html).toContain('data-planner-calendar-mode="agenda"');
    expect(html).toContain('data-planner-calendar-agenda');
    expect(html).toContain('아젠다');
    expect(html).not.toContain('data-planner-calendar-placeholder-mode="agenda"');
  });
});

describe('CalendarModeSwitcher interaction', () => {
  it('calls onModeChange when a mode button is clicked', () => {
    const onModeChange = vi.fn();
    const container = document.createElement('div');
    const root = createRoot(container);

    act(() => {
      root.render(createElement(CalendarModeSwitcher, {
        activeMode: 'month',
        onModeChange,
        theme,
      }));
    });

    const weekButton = container.querySelector('[data-planner-calendar-mode-option="week"]') as HTMLButtonElement;
    act(() => {
      weekButton.click();
    });

    expect(onModeChange).toHaveBeenCalledWith('week');
    act(() => {
      root.unmount();
    });
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

    vi.doMock('../../../../../store/useNotesStore', () => ({
      useNotesStore: (selector: (state: { notes: NoteBase[] }) => unknown) => selector({ notes }),
    }));

    const { projection } = buildPlannerCalendarShellProjection({
      notes,
      now: NOW,
      anchorDate: '2027-02-03',
      viewMode: 'month',
      schedules: [],
      todos: [],
      routines: [],
      weeklySchedules: [],
      legacyDdays: [],
      appSettings,
    });

    const summary = buildCalendarPlaceholderSummary('month', projection);
    expect(summary.lines.some(line => line.includes('events'))).toBe(true);
  });
});
