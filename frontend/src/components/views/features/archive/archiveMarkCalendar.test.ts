// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { AppSettings, Theme } from '../../../../types';
import type { ArchiveMarkCalendarProjection } from '../knowledge/archive';
import { buildArchiveHomeProjection } from '../knowledge/archive';
import { applyMilestoneToNote } from '../knowledge/trace/milestoneNotes';
import type { NoteBase } from '../../noteUtils';
import { ArchiveMarkCalendar } from './home/ArchiveMarkCalendar';
import { ArchiveHomeView } from './home/ArchiveHomeView';
import {
  archiveMarkCellDensityLevel,
  formatArchiveMarkDayTooltip,
  formatArchiveMarkCalendarYearSpan,
} from './home/archiveMarkCalendarPresentation';

const theme: Theme = {
  card: 'bg-surface',
  input: 'bg-surface-alt',
  border: 'border-border',
  textMuted: 'text-muted',
  hoverBg: 'hover:bg-surface-alt',
};

const appSettings: AppSettings = {
  darkMode: false,
  language: 'en',
};

const END_DATE = '2026-06-12';

function note(id: string, overrides: Partial<NoteBase> = {}): NoteBase {
  return {
    id,
    title: 'Note',
    body: '',
    updatedAt: new Date(2026, 5, 11).getTime(),
    folderId: null,
    deletedAt: null,
    ...overrides,
  };
}

function mockCalendar(overrides: Partial<ArchiveMarkCalendarProjection> = {}): ArchiveMarkCalendarProjection {
  return {
    startDate: '2026-01-01',
    endDate: END_DATE,
    days: [],
    years: [2026],
    monthLabels: [{ year: 2026, month: 6, label: 'Jun', weekIndex: 0 }],
    weeks: [['2026-06-09', '2026-06-10', '2026-06-11', '2026-06-12', '2026-06-13', '2026-06-14', '2026-06-15']],
    hasAnyMarks: false,
    ...overrides,
  };
}

describe('archiveMarkCalendarPresentation', () => {
  it('formats neutral tooltips from projection types', () => {
    const tooltip = formatArchiveMarkDayTooltip({
      date: '2026-06-11',
      types: ['milestone', 'workout'],
      density: 2,
    }, '2026-06-11');
    expect(tooltip).toBe('2026-06-11 · Milestone · Workout');
    expect(tooltip).not.toMatch(/score|percent|streak/i);
  });

  it('caps visual density level at 3 from projection density', () => {
    expect(archiveMarkCellDensityLevel({ date: '2026-06-11', types: ['a', 'b', 'c', 'd'] as never, density: 5 })).toBe(3);
  });

  it('formats multi-year span labels', () => {
    expect(formatArchiveMarkCalendarYearSpan([2022, 2023, 2024, 2025, 2026])).toBe('2022–2026');
  });
});

describe('ArchiveMarkCalendar', () => {
  it('renders empty state when projection has no marks', () => {
    const html = renderToStaticMarkup(
      createElement(ArchiveMarkCalendar, {
        markCalendar: mockCalendar(),
        endDate: END_DATE,
        theme,
        appSettings,
      }),
    );

    expect(html).toContain('data-archive-mark-calendar-empty="true"');
    expect(html).toContain('No marks recorded yet.');
    expect(html).not.toContain('Fewer marks');
  });

  it('renders mark cells from projection without recomputing density', () => {
    const markCalendar = mockCalendar({
      hasAnyMarks: true,
      days: [{
        date: '2026-06-11',
        types: ['milestone', 'workout', 'note-activity'],
        density: 3,
      }],
    });

    const html = renderToStaticMarkup(
      createElement(ArchiveMarkCalendar, {
        markCalendar,
        endDate: END_DATE,
        theme,
        appSettings,
      }),
    );

    expect(html).toContain('data-archive-mark-calendar-empty="false"');
    expect(html).toContain('data-archive-mark-date="2026-06-11"');
    expect(html).toContain('data-archive-mark-density="3"');
    expect(html).toContain('data-archive-mark-types="milestone,workout,note-activity"');
    expect(html).toContain('Few marks');
    expect(html).not.toContain('Activity Calendar');
    expect(html).not.toContain('productivity');
  });

  it('shows exception styling separately from density count', () => {
    const markCalendar = mockCalendar({
      hasAnyMarks: true,
      days: [{
        date: '2026-06-10',
        types: ['exception'],
        density: 0,
      }],
    });

    const html = renderToStaticMarkup(
      createElement(ArchiveMarkCalendar, {
        markCalendar,
        endDate: END_DATE,
        theme,
        appSettings,
      }),
    );

    expect(html).toContain('data-archive-mark-density="0"');
    expect(html).toContain('Exception day');
    expect(html).toContain('bg-blue-100');
  });

  it('displays multi-year span from projection years', () => {
    const html = renderToStaticMarkup(
      createElement(ArchiveMarkCalendar, {
        markCalendar: mockCalendar({
          years: [2022, 2023, 2024, 2025, 2026],
          hasAnyMarks: true,
          days: [{ date: '2026-06-11', types: ['event'], density: 1 }],
        }),
        endDate: END_DATE,
        theme,
        appSettings,
      }),
    );

    expect(html).toContain('2022–2026');
  });

  it('combines multiple mark types in tooltip title', () => {
    const markCalendar = mockCalendar({
      hasAnyMarks: true,
      days: [{
        date: '2026-06-11',
        types: ['milestone', 'routine', 'scheduled-study'],
        density: 3,
      }],
    });

    const html = renderToStaticMarkup(
      createElement(ArchiveMarkCalendar, {
        markCalendar,
        endDate: END_DATE,
        theme,
        appSettings,
      }),
    );

    expect(html).toContain('title="2026-06-11 · Milestone · Routine mark · Scheduled study"');
  });
});

describe('ArchiveHomeView mark calendar integration', () => {
  it('renders mark calendar as the first primary section after the frame', () => {
    const milestone = applyMilestoneToNote(
      note('m1', { title: 'Shipped' }),
      { milestoneDate: '2026-06-11' },
    );
    const projection = buildArchiveHomeProjection({
      notes: [milestone],
      now: new Date(2026, 5, 12),
    });

    const html = renderToStaticMarkup(
      createElement(ArchiveHomeView, { projection, theme, appSettings }),
    );

    const archiveIndex = html.indexOf('data-archive-home=');
    const calendarIndex = html.indexOf('data-archive-mark-calendar');
    const milestonesIndex = html.indexOf('data-archive-recent-milestones');

    expect(calendarIndex).toBeGreaterThan(archiveIndex);
    expect(calendarIndex).toBeLessThan(milestonesIndex);
    expect(html).toContain('Mark calendar');
  });

  it('consumes projection markCalendar without Activity Calendar copy', () => {
    const html = renderToStaticMarkup(
      createElement(ArchiveHomeView, {
        projection: buildArchiveHomeProjection({ notes: [], now: new Date(2026, 5, 12) }),
        theme,
        appSettings,
      }),
    );

    expect(html).toContain('data-archive-mark-calendar');
    expect(html).not.toContain('Activity Calendar');
  });
});
