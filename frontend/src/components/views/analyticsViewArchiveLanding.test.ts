// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DateTime } from 'luxon';
import type { AnalyticsProps } from '../../types';
import { applyMilestoneToNote } from './features/knowledge/trace/milestoneNotes';
import type { NoteBase } from './noteUtils';
import { AnalyticsView } from './AnalyticsView';
import { ARCHIVE_SHELL_ENABLED } from './features/archive';
import { buildArchiveHomeProjection } from './features/knowledge/archive';

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

vi.mock('../../store/useNotesStore', () => ({
  useNotesStore: (selector: (state: { notes: NoteBase[] }) => unknown) => selector({ notes: [] }),
}));

vi.mock('./features/archive/hooks/useArchiveDomainMarks', () => ({
  useArchiveDomainMarks: () => ({
    data: [],
    isLoading: false,
    error: undefined,
  }),
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

function analyticsProps(overrides: Partial<AnalyticsProps> = {}): AnalyticsProps {
  return {
    now: NOW,
    formatDate,
    schedules: [],
    routines: [],
    weeklySchedules: [],
    showToast: vi.fn(),
    appSettings,
    updateSetting: vi.fn(),
    theme,
    THEME_COLORS,
    mutateStatic: vi.fn(),
    ...overrides,
  };
}

function renderAnalyticsView(overrides: Partial<AnalyticsProps> = {}) {
  return renderToStaticMarkup(
    createElement(AnalyticsView, analyticsProps(overrides)),
  );
}

describe('ARCHIVE_SHELL_ENABLED', () => {
  it('is true so Archive Home is the default Analytics landing', () => {
    expect(ARCHIVE_SHELL_ENABLED).toBe(true);
  });
});

describe('AnalyticsView archive landing', () => {
  beforeEach(() => {
    swrState.keys.length = 0;
  });

  it('does not mount legacy Analytics SWR subscriptions when Archive is enabled', () => {
    renderAnalyticsView();

    const legacyKeys = swrState.keys.filter(
      (key): key is string => typeof key === 'string',
    );

    expect(legacyKeys.some(key => key.includes('/api/routine_exceptions'))).toBe(false);
    expect(legacyKeys.some(key => key.includes('/api/schedules/range'))).toBe(false);
    expect(legacyKeys.some(key => key.includes('/api/workouts/range'))).toBe(false);
    expect(legacyKeys.some(key => key.includes('/api/heatmap'))).toBe(false);
  });

  it('renders ArchiveShell with Archive Home as the default surface', () => {
    const html = renderAnalyticsView();

    expect(html).toContain('data-archive-shell');
    expect(html).toContain('data-archive-mode="home"');
    expect(html).toContain('data-archive-home="true"');
    expect(html).toContain('아카이브');
    expect(html).toContain('돌아보며 남는 것들.');
  });

  it('does not render legacy Analytics widgets by default', () => {
    const html = renderAnalyticsView();

    expect(html).not.toContain('Period Overview');
    expect(html).not.toContain('Activity This Week');
    expect(html).not.toContain('Scheduled Time by Category');
    expect(html).not.toContain('Weekly Timetable');
    expect(html).not.toContain('data-planner-weekly-timetable');
    expect(html).not.toContain('weeklyTimetable');
  });

  it('renders an empty Archive Home when the vault has no marks', () => {
    const html = renderAnalyticsView();

    expect(html).toContain('data-archive-empty="true"');
    expect(html).toContain('시간이 지나면 마크가 이곳에 쌓입니다.');
    expect(html).toContain('아직 기록된 마크가 없습니다.');
    expect(html).toContain('기록된 마일스톤이 없습니다.');
    expect(html).toContain('기록된 영역이 없습니다.');
  });
});

describe('AnalyticsView archive home audit', () => {
  it('renders all Home sections in order with no productivity language', () => {
    const html = renderAnalyticsView();

    const calendarIndex = html.indexOf('data-archive-mark-calendar');
    const milestonesIndex = html.indexOf('data-archive-recent-milestones');
    const areasIndex = html.indexOf('data-archive-area-pills');
    const browseIndex = html.indexOf('data-archive-browse');

    expect(calendarIndex).toBeGreaterThan(-1);
    expect(milestonesIndex).toBeGreaterThan(calendarIndex);
    expect(areasIndex).toBeGreaterThan(milestonesIndex);
    expect(browseIndex).toBeGreaterThan(areasIndex);
    expect(html).toContain('data-archive-home-complete="true"');
    expect(html).not.toMatch(/score|streak|rank|percent|Activity This Week|productivity/i);
  });

  it('preserves mobile-friendly layout classes on Archive Home', () => {
    const html = renderAnalyticsView();

    expect(html).toContain('px-2 lg:px-4');
    expect(html).toContain('text-2xl lg:text-3xl');
    expect(html).toContain('lg:rounded-[32px]');
  });
});

describe('AnalyticsView projection-driven home content', () => {
  it('matches buildArchiveHomeProjection section labels for populated vaults', () => {
    const notes = [
      applyMilestoneToNote(
        { id: 'm1', title: 'Shipped', body: '', updatedAt: NOW.toMillis(), folderId: null, deletedAt: null },
        { milestoneDate: '2026-06-11', milestoneLabel: 'Shipped' },
      ),
    ];
    const projection = buildArchiveHomeProjection({
      notes,
      now: NOW.toJSDate(),
    });

    const html = renderAnalyticsView();
    expect(html).toContain(projection.browse.thisMonth.label);
    expect(html).toContain('최근 전환');
    expect(html).toContain('영역');
    expect(html).toContain('탐색');
  });
});
