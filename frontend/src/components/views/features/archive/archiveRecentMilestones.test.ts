// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { AppSettings, Theme } from '../../../../types';
import type { ArchiveMilestoneEntry } from '../knowledge/archive';
import { buildArchiveHomeProjection } from '../knowledge/archive';
import { applyMilestoneToNote } from '../knowledge/trace/milestoneNotes';
import type { NoteBase } from '../../noteUtils';
import { ArchiveRecentMilestones } from './home/ArchiveRecentMilestones';
import { ArchiveHomeView } from './home/ArchiveHomeView';

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

const NOW = new Date(2026, 5, 12);

function note(id: string, overrides: Partial<NoteBase> = {}): NoteBase {
  return {
    id,
    title: 'Note Title',
    body: '',
    updatedAt: NOW.getTime(),
    folderId: null,
    deletedAt: null,
    ...overrides,
  };
}

function milestoneEntry(overrides: Partial<ArchiveMilestoneEntry>): ArchiveMilestoneEntry {
  return {
    noteId: 'm1',
    label: 'K-30 Complete',
    kind: '',
    date: '2026-06-11',
    displayLabel: 'K-30 Complete',
    periodRef: { kind: 'month', year: 2026, month: 6, label: 'June 2026' },
    ...overrides,
  };
}

describe('ArchiveRecentMilestones', () => {
  it('renders empty state when projection list is empty', () => {
    const html = renderToStaticMarkup(
      createElement(ArchiveRecentMilestones, {
        milestones: [],
        theme,
        appSettings,
      }),
    );

    expect(html).toContain('data-archive-recent-milestones-empty="true"');
    expect(html).toContain('No milestones recorded yet.');
    expect(html).not.toMatch(/achievement|streak|score|congrat/i);
  });

  it('renders date and label from projection entries', () => {
    const html = renderToStaticMarkup(
      createElement(ArchiveRecentMilestones, {
        milestones: [
          milestoneEntry({ noteId: 'm1', date: '2026-06-11', displayLabel: 'K-30 Complete' }),
          milestoneEntry({ noteId: 'm2', date: '2026-07-15', displayLabel: 'TOEFL Exam' }),
        ],
        theme,
        appSettings,
      }),
    );

    expect(html).toContain('data-archive-milestone-date="2026-06-11"');
    expect(html).toContain('K-30 Complete');
    expect(html).toContain('data-archive-milestone-date="2026-07-15"');
    expect(html).toContain('TOEFL Exam');
  });

  it('preserves projection ordering without re-sorting', () => {
    const html = renderToStaticMarkup(
      createElement(ArchiveRecentMilestones, {
        milestones: [
          milestoneEntry({ noteId: 'new', date: '2026-07-01', displayLabel: 'Newer' }),
          milestoneEntry({ noteId: 'old', date: '2026-01-01', displayLabel: 'Older' }),
        ],
        theme,
        appSettings,
      }),
    );

    expect(html.indexOf('Newer')).toBeLessThan(html.indexOf('Older'));
  });

  it('surfaces optional milestone kind via data attribute only', () => {
    const html = renderToStaticMarkup(
      createElement(ArchiveRecentMilestones, {
        milestones: [milestoneEntry({ kind: 'exam', displayLabel: 'TOEFL Exam' })],
        theme,
        appSettings,
      }),
    );

    expect(html).toContain('data-archive-milestone-kind="exam"');
    expect(html).not.toContain('badge');
  });
});

describe('ArchiveRecentMilestones projection consumption', () => {
  it('uses displayLabel from buildArchiveHomeProjection label fallback', () => {
    const labeled = applyMilestoneToNote(
      note('m1', { title: 'Note Title' }),
      { milestoneDate: '2026-06-11', milestoneLabel: 'Custom Label' },
    );
    const titled = applyMilestoneToNote(
      note('m2', { title: 'Fallback Title' }),
      { milestoneDate: '2026-05-01' },
    );

    const projection = buildArchiveHomeProjection({
      notes: [labeled, titled],
      now: NOW,
    });

    const html = renderToStaticMarkup(
      createElement(ArchiveRecentMilestones, {
        milestones: projection.recentMilestones,
        theme,
        appSettings,
      }),
    );

    expect(html).toContain('Custom Label');
    expect(html).toContain('Fallback Title');
  });

  it('renders milestones newest-first as provided by projection', () => {
    const projection = buildArchiveHomeProjection({
      notes: [
        applyMilestoneToNote(note('m1'), { milestoneDate: '2024-01-01', milestoneLabel: 'Old' }),
        applyMilestoneToNote(note('m2'), { milestoneDate: '2026-06-01', milestoneLabel: 'New' }),
      ],
      now: NOW,
      options: { recentMilestoneLimit: 5 },
    });

    expect(projection.recentMilestones[0]?.displayLabel).toBe('New');

    const html = renderToStaticMarkup(
      createElement(ArchiveRecentMilestones, {
        milestones: projection.recentMilestones,
        theme,
        appSettings,
      }),
    );

    expect(html.indexOf('New')).toBeLessThan(html.indexOf('Old'));
  });
});

describe('ArchiveHomeView recent milestones integration', () => {
  it('renders milestones directly below mark calendar', () => {
    const projection = buildArchiveHomeProjection({
      notes: [
        applyMilestoneToNote(note('m1'), { milestoneDate: '2026-06-11', milestoneLabel: 'K-30 Complete' }),
      ],
      now: NOW,
    });

    const html = renderToStaticMarkup(
      createElement(ArchiveHomeView, { projection, theme, appSettings }),
    );

    const calendarIndex = html.indexOf('data-archive-mark-calendar');
    const milestonesIndex = html.indexOf('data-archive-recent-milestones');
    const browseIndex = html.indexOf('data-archive-browse');

    expect(calendarIndex).toBeGreaterThan(-1);
    expect(milestonesIndex).toBeGreaterThan(calendarIndex);
    expect(browseIndex).toBeGreaterThan(milestonesIndex);
  });
});
