// @vitest-environment happy-dom
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  DEFAULT_PLANNER_CALENDAR_MODE,
  PLANNER_CALENDAR_MODES,
} from './features/planner/calendar-ui/calendarShellModels';
import { CalendarShell } from './features/planner/calendar-ui/CalendarShell';
import { DateTime } from 'luxon';

const viewsRoot = dirname(fileURLToPath(import.meta.url));

function readSource(relativePath: string): string {
  return readFileSync(join(viewsRoot, relativePath), 'utf8');
}

describe('K-32.1 planner validation', () => {
  it('removes legacy mini-calendar from PlannerView source', () => {
    const source = readSource('PlannerView.tsx');
    expect(source).not.toContain('data-planner-legacy-mini-calendar');
    expect(source).not.toContain('buildCalendarDays');
    expect(source).not.toMatch(/mini calendar/i);
  });

  it('mounts exactly one CalendarShell in PlannerView', () => {
    const source = readSource('PlannerView.tsx');
    expect(source.match(/<CalendarShell/g)?.length).toBe(1);
  });

  it('does not define duplicate planner calendar components in src', () => {
    const plannerView = readSource('PlannerView.tsx');
    expect(plannerView).not.toMatch(/MobileCalendar/);
    expect(plannerView).not.toMatch(/<PlannerCalendarView[\s/>]/);
  });

  it('defaults calendar mode to month with no mode switcher (K-80)', () => {
    expect(DEFAULT_PLANNER_CALENDAR_MODE).toBe('month');
    expect(PLANNER_CALENDAR_MODES).toEqual(['month']);
  });

  it('renders month calendar without day/week mode tabs (K-80)', () => {
    const theme = {
      card: 'bg-surface',
      input: 'bg-surface-alt',
      border: 'border-border',
      textMuted: 'text-muted',
      hoverBg: 'hover:bg-surface-alt',
    };
    const now = DateTime.fromISO('2027-02-03T12:00:00', { zone: 'Asia/Seoul' });

    const html = renderToStaticMarkup(
      createElement(CalendarShell, {
        now,
        anchorDate: '2027-02-03',
        schedules: [],
        weeklySchedules: [],
        appSettings: {
          darkMode: false,
          defaultCategory: 'Personal',
          defaultColor: 'blue',
          language: 'en',
        },
        theme,
      }),
    );

    expect(html).toContain('data-planner-calendar-mode="month"');
    expect(html).not.toContain('data-planner-calendar-mode-switcher');
    expect(html).not.toContain('data-planner-calendar-mode-option="day"');
    expect(html).not.toContain('data-planner-calendar-mode-option="week"');
  });

  it('uses unified Schedule section nav with embedded timetable (K-117)', () => {
    const source = readSource('PlannerView.tsx');
    const month = readSource('features/planner/calendar-ui/month/MonthCalendarView.tsx');
    expect(source).toContain('ScheduleSectionNav');
    expect(source).toContain('PlannerStickyActions');
    expect(month).toContain('WeeklyTimetableSection');
    expect(source).not.toContain('ScheduleWorkspaceNav');
    expect(source).not.toContain('ScheduleCountdownPanel');
    expect(source).not.toContain('MOBILE_PLANNER_TABS');
    expect(source).not.toContain('data-planner-column="timeline"');
  });

  it('does not declare legacy side-column hierarchy markers', () => {
    const source = readSource('PlannerView.tsx');
    expect(source).not.toContain('data-planner-column="planning"');
    expect(source).not.toContain('data-planner-column="memo"');
  });
});
