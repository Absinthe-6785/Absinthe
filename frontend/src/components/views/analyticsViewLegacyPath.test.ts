// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DateTime } from 'luxon';
import type { AnalyticsProps } from '../../types';

vi.mock('./features/archive/archiveShellConfig', () => ({
  ARCHIVE_SHELL_ENABLED: false,
}));

const swrState = vi.hoisted(() => ({
  keys: [] as unknown[],
}));

vi.mock('swr', () => ({
  default: (key: unknown) => {
    swrState.keys.push(key);
    return { data: undefined, isLoading: false, error: undefined };
  },
}));

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

function formatDate(d: Date | DateTime): string {
  const date = d instanceof Date ? d : d.toJSDate();
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function analyticsProps(): AnalyticsProps {
  return {
    now: NOW,
    formatDate,
    schedules: [],
    routines: [],
    showToast: vi.fn(),
    appSettings,
    updateSetting: vi.fn(),
    theme,
    THEME_COLORS,
    mutateStatic: vi.fn(),
  };
}

describe('AnalyticsView legacy rollback path', () => {
  beforeEach(() => {
    swrState.keys.length = 0;
  });

  it('renders legacy Analytics when ARCHIVE_SHELL_ENABLED is false', async () => {
    const { AnalyticsView } = await import('./AnalyticsView');
    const html = renderToStaticMarkup(
      createElement(AnalyticsView, analyticsProps()),
    );

    expect(html).toContain('data-legacy-analytics');
    expect(html).toContain('Period Overview');
    expect(html).not.toContain('data-archive-home');
  }, 30_000);

  it('subscribes to legacy Analytics SWR keys when rollback flag is false', async () => {
    const { AnalyticsView } = await import('./AnalyticsView');
    renderToStaticMarkup(createElement(AnalyticsView, analyticsProps()));

    const legacyKeys = swrState.keys.filter(
      (key): key is string => typeof key === 'string',
    );

    expect(legacyKeys.some(key => key.includes('/api/routine_exceptions'))).toBe(true);
    expect(legacyKeys.some(key => key.includes('/api/schedules/range'))).toBe(true);
    expect(legacyKeys.some(key => key.includes('/api/workouts/range'))).toBe(true);
    expect(legacyKeys.some(key => key.includes('/api/heatmap'))).toBe(true);
  });

  it('does not render Weekly Timetable planning surface on legacy Analytics', async () => {
    const { AnalyticsView } = await import('./AnalyticsView');
    const html = renderToStaticMarkup(
      createElement(AnalyticsView, analyticsProps()),
    );

    expect(html).not.toContain('data-planner-weekly-timetable');
    expect(html).not.toContain('weeklyTimetable');
    expect(html).not.toContain('data-planner-weekly-timetable-add');
  });
});
