// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { AppSettings, Theme } from '../../../../types';
import type { ArchiveBrowseProjection } from '../knowledge/archive';
import { buildArchiveHomeProjection } from '../knowledge/archive';
import { applyMilestoneToNote } from '../knowledge/trace/milestoneNotes';
import type { NoteBase } from '../../noteUtils';
import { ArchiveBrowseLinks } from './home/ArchiveBrowseLinks';
import { ArchiveHomeView } from './home/ArchiveHomeView';
import { listArchiveBrowseLinkItems } from './home/archiveBrowsePresentation';

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

function mockBrowse(overrides: Partial<ArchiveBrowseProjection> = {}): ArchiveBrowseProjection {
  return {
    thisMonth: { kind: 'month', year: 2026, month: 6, label: 'June 2026' },
    thisQuarter: { kind: 'quarter', year: 2026, quarter: 2, label: 'Q2 2026' },
    thisYear: { kind: 'year', year: 2026, label: '2026' },
    custom: { kind: 'custom', label: 'Custom' },
    allAreas: { kind: 'areas-index', label: '전체 영역' },
    timeline: {
      kind: 'timeline',
      label: '타임라인',
      defaultPeriod: { kind: 'month', year: 2026, month: 6, label: 'June 2026' },
    },
    ...overrides,
  };
}

describe('listArchiveBrowseLinkItems', () => {
  it('preserves Home display order from projection fields', () => {
    const items = listArchiveBrowseLinkItems(mockBrowse());
    expect(items.map(item => item.id)).toEqual([
      'this-month',
      'this-quarter',
      'this-year',
      'all-areas',
      'timeline',
      'custom',
    ]);
  });
});

describe('ArchiveBrowseLinks', () => {
  it('renders browse destinations from projection labels', () => {
    const html = renderToStaticMarkup(
      createElement(ArchiveBrowseLinks, {
        browse: mockBrowse(),
        theme,
        appSettings,
      }),
    );

    expect(html).toContain('data-archive-browse-empty="false"');
    expect(html).toContain('탐색');
    expect(html).toContain('June 2026');
    expect(html).toContain('Q2 2026');
    expect(html).toContain('전체 영역');
    expect(html).toContain('타임라인');
    expect(html).not.toMatch(/score|rank|percent|streak/i);
  });

  it('preserves link order in rendered output', () => {
    const html = renderToStaticMarkup(
      createElement(ArchiveBrowseLinks, {
        browse: mockBrowse(),
        theme,
        appSettings,
      }),
    );

    expect(html.indexOf('data-archive-browse-link="this-month"')).toBeLessThan(
      html.indexOf('data-archive-browse-link="this-quarter"'),
    );
    expect(html.indexOf('data-archive-browse-link="this-quarter"')).toBeLessThan(
      html.indexOf('data-archive-browse-link="this-year"'),
    );
    expect(html.indexOf('data-archive-browse-link="this-year"')).toBeLessThan(
      html.indexOf('data-archive-browse-link="all-areas"'),
    );
    expect(html.indexOf('data-archive-browse-link="all-areas"')).toBeLessThan(
      html.indexOf('data-archive-browse-link="timeline"'),
    );
  });

  it('invokes onBrowseClick with destination payload', async () => {
    const browse = mockBrowse();
    const clicks: unknown[] = [];
    const container = document.createElement('div');
    const root = createRoot(container);

    await act(async () => {
      root.render(createElement(ArchiveBrowseLinks, {
        browse,
        theme,
        appSettings,
        onBrowseClick: destination => clicks.push(destination),
      }));
    });

    const timelineButton = container.querySelector(
      '[data-archive-browse-link="timeline"]',
    ) as HTMLButtonElement;
    timelineButton.click();

    expect(clicks).toEqual([{
      type: 'timeline',
      defaultPeriod: browse.timeline.defaultPeriod,
    }]);
  });

  it('shows fallback empty message when no links are available', () => {
    const html = renderToStaticMarkup(
      createElement(ArchiveBrowseLinks, {
        browse: mockBrowse(),
        theme,
        appSettings,
      }),
    );

    expect(html).not.toContain('탐색할 항목이 없습니다.');
  });
});

describe('ArchiveBrowseLinks projection consumption', () => {
  it('renders browse links from buildArchiveHomeProjection', () => {
    const projection = buildArchiveHomeProjection({
      notes: [
        applyMilestoneToNote(
          { id: 'm1', title: 'M', body: '', updatedAt: NOW.getTime(), folderId: null, deletedAt: null },
          { milestoneDate: '2026-06-11' },
        ),
      ],
      now: NOW,
    });

    const html = renderToStaticMarkup(
      createElement(ArchiveBrowseLinks, {
        browse: projection.browse,
        theme,
        appSettings,
      }),
    );

    expect(html).toContain(projection.browse.thisMonth.label);
    expect(html).toContain(projection.browse.allAreas.label);
    expect(html).toContain('data-archive-browse-destination-type="period"');
  });
});

describe('ArchiveHomeView browse integration', () => {
  it('renders browse below area pills and marks home complete', () => {
    const projection = buildArchiveHomeProjection({ notes: [], now: NOW });
    const html = renderToStaticMarkup(
      createElement(ArchiveHomeView, { projection, theme, appSettings }),
    );

    const areasIndex = html.indexOf('data-archive-area-pills');
    const browseIndex = html.indexOf('data-archive-browse');

    expect(html).toContain('data-archive-home-complete="true"');
    expect(browseIndex).toBeGreaterThan(areasIndex);
    expect(html).not.toContain('data-archive-home-shell');
  });
});
