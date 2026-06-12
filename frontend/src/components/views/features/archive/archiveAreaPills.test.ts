// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { AppSettings, Theme } from '../../../../types';
import type { ArchiveAreaPill } from '../knowledge/archive';
import { buildArchiveHomeProjection } from '../knowledge/archive';
import { applyAreaToNote } from '../knowledge/trace/areaNotes';
import type { NoteBase } from '../../noteUtils';
import { ArchiveAreaPills } from './home/ArchiveAreaPills';
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
    title: 'Note',
    body: '',
    updatedAt: NOW.getTime(),
    folderId: null,
    deletedAt: null,
    ...overrides,
  };
}

function areaPill(overrides: Partial<ArchiveAreaPill>): ArchiveAreaPill {
  return {
    areaNoteId: 'area-1',
    title: 'Japanese',
    markCount: 3,
    lastMarkDate: '2026-05-01',
    areaRef: { areaNoteId: 'area-1', title: 'Japanese' },
    ...overrides,
  };
}

describe('ArchiveAreaPills', () => {
  it('renders empty state when projection list is empty', () => {
    const html = renderToStaticMarkup(
      createElement(ArchiveAreaPills, {
        areaPills: [],
        theme,
        appSettings,
      }),
    );

    expect(html).toContain('data-archive-area-pills-empty="true"');
    expect(html).toContain('No areas recorded yet.');
    expect(html).not.toMatch(/score|rank|leaderboard|progress/i);
  });

  it('renders compact pills from projection titles', () => {
    const html = renderToStaticMarkup(
      createElement(ArchiveAreaPills, {
        areaPills: [
          areaPill({ areaNoteId: 'a1', title: 'Japanese' }),
          areaPill({ areaNoteId: 'a2', title: 'Absinthe' }),
          areaPill({ areaNoteId: 'a3', title: 'Exercise' }),
        ],
        theme,
        appSettings,
      }),
    );

    expect(html).toContain('data-archive-area-pill-label');
    expect(html).toContain('Japanese');
    expect(html).toContain('Absinthe');
    expect(html).toContain('Exercise');
    expect(html).not.toContain('progress');
  });

  it('preserves projection order without re-sorting', () => {
    const html = renderToStaticMarkup(
      createElement(ArchiveAreaPills, {
        areaPills: [
          areaPill({ areaNoteId: 'a1', title: 'First' }),
          areaPill({ areaNoteId: 'a2', title: 'Second' }),
        ],
        theme,
        appSettings,
      }),
    );

    expect(html.indexOf('First')).toBeLessThan(html.indexOf('Second'));
  });

  it('exposes markCount and lastMarkDate as data attributes only', () => {
    const html = renderToStaticMarkup(
      createElement(ArchiveAreaPills, {
        areaPills: [areaPill({ markCount: 7, lastMarkDate: '2026-04-10' })],
        theme,
        appSettings,
      }),
    );

    expect(html).toContain('data-archive-area-mark-count="7"');
    expect(html).toContain('data-archive-area-last-mark-date="2026-04-10"');
    expect(html).not.toContain('>7<');
  });

  it('invokes onAreaClick when a pill is clicked', async () => {
    const pill = areaPill({ areaNoteId: 'area-jp', title: 'Japanese' });
    const clicks: ArchiveAreaPill[] = [];
    const container = document.createElement('div');
    const root = createRoot(container);

    await act(async () => {
      root.render(createElement(ArchiveAreaPills, {
        areaPills: [pill],
        theme,
        appSettings,
        onAreaClick: entry => clicks.push(entry),
      }));
    });

    const button = container.querySelector('[data-archive-area-pill]') as HTMLButtonElement;
    button.click();
    expect(clicks).toEqual([pill]);
  });
});

describe('ArchiveAreaPills projection consumption', () => {
  it('renders area pills from buildArchiveHomeProjection', () => {
    const area = applyAreaToNote(note('area', { title: 'Japanese', updatedAt: new Date(2026, 4, 1).getTime() }));
    const linked = note('linked', {
      title: 'Study Log',
      body: '[[Japanese]]',
      updatedAt: new Date(2026, 5, 1).getTime(),
    });

    const projection = buildArchiveHomeProjection({
      notes: [area, linked],
      now: NOW,
    });

    expect(projection.areaPills.length).toBeGreaterThan(0);

    const html = renderToStaticMarkup(
      createElement(ArchiveAreaPills, {
        areaPills: projection.areaPills,
        theme,
        appSettings,
      }),
    );

    expect(html).toContain('Japanese');
    expect(html).toContain('data-archive-area-mark-count');
  });
});

describe('ArchiveHomeView area pills integration', () => {
  it('renders area pills below recent milestones', () => {
    const area = applyAreaToNote(note('area', { title: 'TOEFL', updatedAt: new Date(2026, 4, 1).getTime() }));
    const linked = note('linked', {
      title: 'Prep',
      body: '[[TOEFL]]',
      updatedAt: new Date(2026, 5, 1).getTime(),
    });

    const projection = buildArchiveHomeProjection({
      notes: [area, linked],
      now: NOW,
    });

    const html = renderToStaticMarkup(
      createElement(ArchiveHomeView, { projection, theme, appSettings }),
    );

    const milestonesIndex = html.indexOf('data-archive-recent-milestones');
    const areasIndex = html.indexOf('data-archive-area-pills');
    const shellIndex = html.indexOf('data-archive-home-shell');

    expect(milestonesIndex).toBeGreaterThan(-1);
    expect(areasIndex).toBeGreaterThan(milestonesIndex);
    expect(shellIndex).toBeGreaterThan(areasIndex);
  });
});
