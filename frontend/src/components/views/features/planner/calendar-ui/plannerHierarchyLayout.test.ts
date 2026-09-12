// @vitest-environment happy-dom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DateTime } from 'luxon';
import { describe, expect, it, vi } from 'vitest';
import type { AppSettings, Theme } from '../../../../../types';
import type { NoteBase } from '../../../../noteUtils';
import { CalendarShell } from './CalendarShell';
import { PLANNER_HIERARCHY, resolvePlannerHierarchyLayout } from './plannerHierarchyLayout';

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

function renderPlannerHierarchy() {
  return renderToStaticMarkup(createElement(CalendarShell, {
    now: DateTime.fromISO('2027-02-03T12:00:00', { zone: 'Asia/Seoul' }),
    anchorDate: '2027-02-03',
    schedules: [],
    todos: [],
    routines: [],
    ddaySchedules: [],
    weeklySchedules: [],
    appSettings,
    theme,
    THEME_COLORS: [{
      id: 'blue',
      bg: 'bg-blue-500',
      text: 'text-white',
      border: 'border-blue-500',
    }],
    mutateStatic: vi.fn(),
    showToast: vi.fn(),
    onAddSchedule: vi.fn(),
  }));
}

describe('UI-05 Planner hierarchy allocation', () => {
  it('binds VIS-06 treatment to rendered Planner surfaces without taking semantic state authority', () => {
    const html = renderPlannerHierarchy();
    const host = document.createElement('div');
    host.innerHTML = html;
    const css = readFileSync(join(process.cwd(), 'src', 'index.css'), 'utf8');
    const plannerCss = css.match(/\/\* VIS-06[^]*?\/\* K-99/)?.[0] ?? '';
    const plannerView = readFileSync(join(process.cwd(), 'src', 'components', 'views', 'PlannerView.tsx'), 'utf8');
    const monthCell = readFileSync(join(process.cwd(), 'src', 'components', 'views', 'features', 'planner', 'calendar-ui', 'month', 'MonthCalendarCell.tsx'), 'utf8');

    expect(plannerView).toContain('abs-cosmos-planner');
    expect(plannerView).toContain('abs-cosmos-planner-header');
    expect(host.querySelector('[data-planner-calendar-shell]')?.classList.contains('abs-cosmos-planner-shell')).toBe(true);
    expect(host.querySelector('[data-planner-primary-surface="calendar"]')?.classList.contains('abs-cosmos-planner-calendar')).toBe(true);
    expect(host.querySelector('[data-planner-support-role="today"] .abs-cosmos-planner-today-card')).not.toBeNull();
    expect(host.querySelector('[data-planner-weekly-timetable]')?.classList.contains('abs-cosmos-planner-timetable')).toBe(true);
    expect(host.querySelector('[data-planner-support-role="dday"]')?.classList.contains('abs-cosmos-planner-support')).toBe(true);
    expect(host.querySelector('[data-planner-calendar-period-nav]')?.classList.contains('abs-cosmos-planner-toolbar')).toBe(true);

    expect(plannerCss).toContain('background-color: var(--color-background)');
    expect(plannerCss).toContain('background-color: var(--color-surface-elevated)');
    expect(plannerCss).toContain('var(--color-selected) 30%');
    expect(plannerCss.match(/var\(--cosmos-pale-blue-dot\)/g)).toHaveLength(1);
    expect(plannerCss).not.toMatch(/data-planner-(?:month-event|month-block|day-event|day-block)/);
    expect(plannerCss).not.toMatch(/animation|requestAnimationFrame|setInterval|setTimeout/);
    expect(plannerCss.match(/pointer-events: none/g)?.length).toBeGreaterThanOrEqual(3);

    expect(monthCell).toContain('data-planner-month-block-color={block.color}');
    expect(monthCell).not.toContain('--cosmos-');
  });

  it.each([
    [1023, 'tablet', 'natural-flow', 'calendar-shell'],
    [1024, 'desktop', 'planning-column-support-rail', 'bounded-panes'],
    [1025, 'desktop', 'planning-column-support-rail', 'bounded-panes'],
  ] as const)('uses the canonical boundary contract at %ipx', (width, category, composition, rootScroll) => {
    expect(resolvePlannerHierarchyLayout(width)).toEqual({
      category,
      composition,
      rootScroll,
      order: PLANNER_HIERARCHY.compactOrder,
    });
  });

  it.each([
    [390, 'mobile'],
    [768, 'tablet'],
    [1023, 'tablet'],
  ] as const)('keeps a natural planning-first flow at %ipx', (width, category) => {
    const layout = resolvePlannerHierarchyLayout(width);
    expect(layout.category).toBe(category);
    expect(layout.composition).toBe('natural-flow');
    expect(layout.order).toEqual(['calendar', 'today', 'timetable', 'dday']);
  });

  it('renders two primary planning surfaces, Today secondary, and D-Day tertiary without capability loss', () => {
    const html = renderPlannerHierarchy();
    const host = document.createElement('div');
    host.innerHTML = html;

    const grid = host.querySelector('[data-planner-desktop-allocation="planning-column-support-rail"]');
    const primary = host.querySelectorAll('[data-planner-hierarchy-level="primary"]');
    expect(grid?.className).toContain('lg:grid-cols-[minmax(0,3fr)_minmax(240px,1fr)]');
    expect(grid?.className).toContain('lg:grid-rows-[minmax(0,3fr)_minmax(220px,2fr)]');
    expect(Array.from(primary).map(node => node.getAttribute('data-planner-primary-surface'))).toEqual([
      'calendar',
      'timetable',
    ]);
    expect(host.querySelector('[data-planner-support-role="today"]')?.getAttribute('data-planner-hierarchy-level')).toBe('secondary');
    expect(host.querySelector('[data-planner-support-role="dday"]')?.getAttribute('data-planner-hierarchy-level')).toBe('tertiary');
    expect(host.querySelector('[data-k140-calendar-add-event]')).not.toBeNull();
    expect(host.querySelector('[data-planner-weekly-timetable-add]')).not.toBeNull();
    expect(host.querySelector('[data-k105-planner-todays-note]')).not.toBeNull();
    expect(host.querySelector('[data-k139-schedule-dday-list]')).not.toBeNull();
  });

  it('keeps compact flow scrollable and desktop panes bounded without duplicate root owners', () => {
    const html = renderPlannerHierarchy();
    const host = document.createElement('div');
    host.innerHTML = html;
    const shell = host.querySelector('[data-planner-calendar-shell]');

    expect(shell?.getAttribute('data-planner-scroll-contract')).toBe('flow-below-desktop-bounded-desktop');
    expect(shell?.getAttribute('data-planner-primary-scroll-owner')).toBe('calendar-shell');
    expect(shell?.className).toContain('overflow-y-auto');
    expect(shell?.className).toContain('lg:overflow-hidden');
    expect(host.querySelectorAll('[data-planner-primary-scroll-owner]')).toHaveLength(1);
    expect(host.querySelector('[data-k139-timetable-scroll]')).not.toBeNull();
    expect(host.querySelector('[data-k139-schedule-dday-list] ul')).toBeNull();
  });

  it('keeps every populated Today capability inside one desktop body scroll owner', () => {
    const html = renderToStaticMarkup(createElement(CalendarShell, {
      now: DateTime.fromISO('2027-02-03T12:00:00', { zone: 'Asia/Seoul' }),
      anchorDate: '2027-02-03',
      schedules: Array.from({ length: 4 }, (_, index) => ({
        id: `schedule-${index}`,
        text: `Schedule ${index + 1}`,
        start_time: `${String(9 + index).padStart(2, '0')}:00`,
        end_time: `${String(10 + index).padStart(2, '0')}:00`,
        is_dday: false,
        color: 'blue',
        category: 'Personal',
      })),
      todos: Array.from({ length: 4 }, (_, index) => ({
        id: `todo-${index}`,
        date: '2027-02-03',
        text: `Todo ${index + 1}`,
        done: false,
      })),
      routines: Array.from({ length: 4 }, (_, index) => ({
        id: `routine-${index}`,
        date: '2027-02-03',
        text: `Routine ${index + 1}`,
        done: false,
        is_active: true,
      })),
      ddaySchedules: [],
      weeklySchedules: [],
      appSettings,
      theme,
      THEME_COLORS: [{
        id: 'blue',
        bg: 'bg-blue-500',
        text: 'text-white',
        border: 'border-blue-500',
      }],
      mutateStatic: vi.fn(),
      showToast: vi.fn(),
      onAddSchedule: vi.fn(),
      dayScheduleActions: {
        onAdd: vi.fn(),
        onView: vi.fn(),
        onEdit: vi.fn(),
        onDelete: vi.fn(),
        onDuplicate: vi.fn(),
      },
      routineActions: {
        onAdd: vi.fn(),
        onToggle: vi.fn(),
        onEdit: vi.fn(),
        onDelete: vi.fn(),
      },
    }));
    const host = document.createElement('div');
    host.innerHTML = html;

    const today = host.querySelector('[data-planner-support-role="today"]');
    const panel = today?.querySelector('[data-k105-planner-today]');
    const owner = today?.querySelector('[data-planner-today-scroll-owner="desktop-body"]');

    expect(today?.className).toContain('lg:overflow-hidden');
    expect(panel?.className).toContain('lg:h-full');
    expect(panel?.className).toContain('lg:overflow-hidden');
    expect(owner?.className).toContain('lg:overflow-y-auto');
    expect(owner?.className).toContain('lg:overscroll-contain');
    expect(owner?.className.split(/\s+/)).not.toContain('overflow-y-auto');
    expect(today?.querySelectorAll('[data-planner-today-scroll-owner]')).toHaveLength(1);
    expect(Array.from(owner?.children ?? []).every(child => child.className.includes('shrink-0'))).toBe(true);
    expect(owner?.querySelector('[data-k139-routine-list-scroll]')).not.toBeNull();
    expect(owner?.querySelector('[data-planner-day-todos]')).not.toBeNull();
    expect(owner?.querySelector('[data-planner-day-schedule-timeline]')).not.toBeNull();
    expect(owner?.querySelector('[data-k105-planner-todays-note] button')).not.toBeNull();
  });
});
