// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DateTime } from 'luxon';
import type { PlannerProps } from '../../types';
import { WeeklyTimetableSection } from './features/planner/WeeklyTimetableSection';

vi.mock('../../hooks/useConfirm', () => ({
  useConfirm: () => ({
    confirm: null,
    showConfirm: vi.fn(),
    clearConfirm: vi.fn(),
    handleConfirm: vi.fn(),
  }),
}));

vi.mock('../../hooks/useApiMutation', () => ({
  useApiMutation: () => ({ mutate: vi.fn() }),
}));

vi.mock('../../hooks/useEscapeKey', () => ({
  useEscapeKey: () => {},
}));

vi.mock('../../lib/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('swr', () => ({
  default: () => ({ data: undefined, isLoading: false, error: undefined }),
}));

vi.mock('../../store/useNotesStore', () => {
  const state = {
    notes: [],
    folders: [],
    activeNoteId: null,
    activeFolderId: null,
    createNote: vi.fn(),
    updateNote: vi.fn(),
    moveNoteToTrash: vi.fn(),
    restoreNote: vi.fn(),
    permanentDeleteNote: vi.fn(),
    setActiveNoteId: vi.fn(),
    createFolder: vi.fn(),
    renameFolder: vi.fn(),
    deleteFolder: vi.fn(),
    setActiveFolderId: vi.fn(),
  };
  return {
    useNotesStore: (selector?: (value: typeof state) => unknown) =>
      (selector ? selector(state) : state),
  };
});

const theme = {
  card: 'bg-surface',
  input: 'bg-surface-alt',
  border: 'border-border',
  textMuted: 'text-muted',
  hoverBg: 'hover:bg-surface-alt',
};

const appSettings = {
  darkMode: false,
  defaultCategory: 'Personal',
  defaultColor: 'blue',
  language: 'en' as const,
};

const THEME_COLORS = [{
  id: 'blue',
  bg: 'bg-blue-500',
  text: 'text-white',
  border: 'border-blue-500',
}];

const NOW = DateTime.fromISO('2026-06-12T12:00:00');
const CURRENT = NOW.toJSDate();

function formatDate(d: Date | DateTime): string {
  const date = d instanceof Date ? d : d.toJSDate();
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function plannerProps(overrides: Partial<PlannerProps> = {}): PlannerProps {
  return {
    now: NOW,
    currentDate: CURRENT,
    setCurrentDate: vi.fn(),
    selectedDate: CURRENT,
    setSelectedDate: vi.fn(),
    formatDate,
    isToday: () => true,
    schedules: [],
    todos: [],
    routines: [],
    markedDates: [],
    weeklySchedules: [
      {
        id: 'ws-1',
        day: 0,
        title: 'Morning Study',
        start_time: '09:00',
        end_time: '10:30',
        color: 'bg-blue-500',
      },
    ],
    showToast: vi.fn(),
    appSettings,
    updateSetting: vi.fn(),
    theme,
    THEME_COLORS,
    mutateDaily: vi.fn(),
    mutateStatic: vi.fn(),
    mutateTodos: vi.fn(),
    mutateRoutines: vi.fn(),
    ...overrides,
  };
}

describe('WeeklyTimetableSection', () => {
  it('renders planner weekly timetable markers and schedule blocks', () => {
    const html = renderToStaticMarkup(
      createElement(WeeklyTimetableSection, {
        weeklySchedules: plannerProps().weeklySchedules,
        theme,
        appSettings,
        THEME_COLORS,
        mutateStatic: vi.fn(),
        showToast: vi.fn(),
      }),
    );

    expect(html).toContain('data-planner-weekly-timetable');
    expect(html).toContain('data-planner-weekly-timetable-add');
    expect(html).toContain('data-planner-weekly-block="ws-1"');
    expect(html).toContain('weeklyTimetable');
    expect(html).toContain('Morning Study');
    expect(html).not.toContain('data-planner-weekly-timetable-modal');
  });
});

describe('PlannerView weekly timetable integration', () => {
  it('does not mount Weekly Timetable in calendar-only PlannerView (K-71)', async () => {
    const { PlannerView } = await import('./PlannerView');
    const html = renderToStaticMarkup(
      createElement(PlannerView, plannerProps()),
    );

    expect(html).not.toContain('data-planner-weekly-timetable');
    expect(html).not.toContain('data-planner-column="timeline"');
    expect(html).not.toContain('data-planner-column="planning"');
    expect(html).not.toContain('data-planner-mobile-tabs');
    expect(html).not.toContain('data-planner-legacy-mini-calendar');
    expect(html).toContain('data-planner-calendar-shell');
    expect(html).toContain('data-planner-calendar-mode="day"');
  });
});
