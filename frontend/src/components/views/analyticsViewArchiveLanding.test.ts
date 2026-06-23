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

vi.mock('../../hooks/useVaultRestoreFlow', () => ({
  useVaultRestoreFlow: () => ({
    fileInputRef: { current: null },
    preview: null,
    selection: null,
    openSnapshotRestore: vi.fn(),
    openFilePicker: vi.fn(),
    handleFileChange: vi.fn(),
  }),
}));

vi.mock('../../lib/i18n', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/i18n')>();
  return {
    ...actual,
    useTranslation: () => ({ t: (key: string) => key, lang: 'en' as const }),
  };
});

vi.mock('../../store/useNotesStore', () => {
  const state = {
    notes: [] as NoteBase[],
    vaultStructureVersion: 0,
    vaultRestoreCanUndo: false,
  };
  const useNotesStore = (selector: (s: typeof state) => unknown) => selector(state);
  useNotesStore.getState = () => state;
  return { useNotesStore };
});

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
  text: 'text-foreground',
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

/** K-109 primary section order — index of each section hook in rendered HTML. */
function k109SectionIndices(html: string) {
  return {
    history: html.indexOf('data-k109-archive-section="history"'),
    deleted: html.indexOf('data-k109-archive-section="deleted"'),
    snapshots: html.indexOf('data-k109-archive-section="snapshots"'),
    timeline: html.indexOf('data-k109-archive-section="timeline"'),
    restoreTools: html.indexOf('data-k109-archive-section="restore-tools"'),
  };
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

  it('renders ArchiveShell with K-109 cohesion archive as the default surface', () => {
    const html = renderAnalyticsView();

    expect(html).toContain('data-archive-shell');
    expect(html).toContain('data-k109-archive-shell');
    expect(html).toContain('data-archive-mode="cohesion"');
    expect(html).toContain('data-k109-archive-unified');
    expect(html).toContain('Archive');
    expect(html).toContain('A library of traces, milestones, and long-term context.');
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

  it('renders K-109 empty states when the vault has no marks', () => {
    const html = renderAnalyticsView();

    expect(html).toContain('data-archive-empty="true"');
    expect(html).toContain('Your archive will fill as you work.');
    expect(html).toContain('No recent note activity yet.');
    expect(html).toContain('No deleted notes — trash is empty.');
    expect(html).toContain('No snapshots yet. Auto snapshots appear after note changes.');
    expect(html).toContain('No timeline marks yet.');
  });
});

describe('AnalyticsView archive cohesion audit', () => {
  it('renders K-109 sections in order with no productivity language', () => {
    const html = renderAnalyticsView();
    const sections = k109SectionIndices(html);

    expect(sections.history).toBeGreaterThan(-1);
    expect(sections.deleted).toBeGreaterThan(sections.history);
    expect(sections.snapshots).toBeGreaterThan(sections.deleted);
    expect(sections.timeline).toBeGreaterThan(sections.snapshots);
    expect(sections.restoreTools).toBeGreaterThan(sections.timeline);

    expect(html).toContain('Recent activity');
    expect(html).toContain('Deleted notes');
    expect(html).toContain('Snapshots');
    expect(html).toContain('Timeline');
    expect(html).toContain('Restore tools');

    expect(html).not.toContain('Recent transitions');
    expect(html).not.toContain('data-archive-home-complete');
    expect(html).not.toMatch(/score|streak|rank|percent|Activity This Week|productivity/i);
  });

  it('preserves mobile-friendly layout classes on Archive landing', () => {
    const html = renderAnalyticsView();

    expect(html).toContain('px-2 lg:px-4');
    expect(html).toContain('text-xl lg:text-2xl');
    expect(html).toContain('min-h-[44px]');
    expect(html).toContain('data-archive-browse');
  });
});

describe('AnalyticsView projection-driven archive content', () => {
  it('matches buildArchiveHomeProjection browse labels and K-109 section copy', () => {
    const notes = [
      applyMilestoneToNote(
        { id: 'm1', title: 'Shipped', body: '', updatedAt: NOW.toMillis(), folderId: null, deletedAt: null },
        { milestoneDate: '2026-06-11', milestoneLabel: 'Shipped' },
      ),
    ];
    const projection = buildArchiveHomeProjection({
      notes,
      now: NOW.toJSDate(),
      options: { locale: 'en-US' },
    });

    const html = renderAnalyticsView();
    expect(html).toContain('data-k109-archive-section="browse"');
    expect(html).toContain('Recent activity');
    expect(html).toContain('Browse');
    expect(html).not.toContain('Recent transitions');
  });
});
