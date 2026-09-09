// @vitest-environment happy-dom
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
});
