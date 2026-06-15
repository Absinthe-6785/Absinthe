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
import { CalendarModeSwitcher } from './features/planner/calendar-ui/CalendarModeSwitcher';

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

  it('defaults calendar mode to Day with Day-first tab order (K-71: no Agenda)', () => {
    expect(DEFAULT_PLANNER_CALENDAR_MODE).toBe('day');
    expect(PLANNER_CALENDAR_MODES).toEqual(['day', 'week', 'month']);
  });

  it('renders calendar mode tabs in Day → Week → Month order', () => {
    const theme = {
      card: 'bg-surface',
      input: 'bg-surface-alt',
      border: 'border-border',
      textMuted: 'text-muted',
      hoverBg: 'hover:bg-surface-alt',
    };

    const html = renderToStaticMarkup(
      createElement(CalendarModeSwitcher, {
        activeMode: 'day',
        onModeChange: () => {},
        theme,
      }),
    );

    const dayIdx = html.indexOf('data-planner-calendar-mode-option="day"');
    const weekIdx = html.indexOf('data-planner-calendar-mode-option="week"');
    const monthIdx = html.indexOf('data-planner-calendar-mode-option="month"');

    expect(dayIdx).toBeGreaterThan(-1);
    expect(dayIdx).toBeLessThan(weekIdx);
    expect(weekIdx).toBeLessThan(monthIdx);
    expect(html).not.toContain('data-planner-calendar-mode-option="agenda"');
  });

  it('uses Schedule + Timetable workspace tabs (K-74)', () => {
    const source = readSource('PlannerView.tsx');
    expect(source).toContain('ScheduleWorkspaceNav');
    expect(source).toContain('WeeklyTimetableSection');
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
