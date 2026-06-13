// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DateTime } from 'luxon';
import type { AppSettings, Theme } from '../../../../types';
import { buildArchiveHomeProjection } from '../knowledge/archive';
import { ArchiveHomeView } from './home/ArchiveHomeView';
import { ArchivePlaceholderView } from './ArchivePlaceholderView';
import { ArchiveShell } from './ArchiveShell';
import { DEFAULT_ARCHIVE_VIEW_MODE } from './archiveNavigationModels';
import { ARCHIVE_SHELL_ENABLED } from './archiveShellConfig';
import { buildArchiveHomeProjectionForHook } from './hooks/useArchiveHomeProjection';

vi.mock('../../../../../store/useNotesStore', () => ({
  useNotesStore: (selector: (state: { notes: [] }) => unknown) => selector({ notes: [] }),
}));

vi.mock('./hooks/useArchiveDomainMarks', () => ({
  useArchiveDomainMarks: () => ({
    data: [],
    isLoading: false,
    error: undefined,
  }),
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
  language: 'en',
};

const NOW = new Date(2026, 5, 12, 12, 0, 0);

function emptyProjection() {
  return buildArchiveHomeProjection({ notes: [], now: NOW });
}

describe('ARCHIVE_SHELL_ENABLED', () => {
  it('is true so Archive Home is the default Analytics landing in K-30.16', () => {
    expect(ARCHIVE_SHELL_ENABLED).toBe(true);
  });
});

describe('ArchiveHomeView', () => {
  it('renders frame copy from projection', () => {
    const projection = emptyProjection();
    const html = renderToStaticMarkup(
      createElement(ArchiveHomeView, { projection, theme, appSettings }),
    );

    expect(html).toContain('Archive');
    expect(html).toContain('What remains when you look back.');
    expect(html).toContain('data-archive-home="true"');
    expect(html).toContain('data-archive-mark-calendar');
    expect(html).toContain('data-archive-browse');
  });

  it('shows empty-state hint when projection is empty', () => {
    const projection = emptyProjection();
    expect(projection.empty.isEmpty).toBe(true);

    const html = renderToStaticMarkup(
      createElement(ArchiveHomeView, { projection, theme, appSettings }),
    );

    expect(html).toContain('data-archive-empty="true"');
    expect(html).toContain('시간이 지나면 마크가 이곳에 쌓입니다.');
  });

  it('marks Archive Home structurally complete', () => {
    const html = renderToStaticMarkup(
      createElement(ArchiveHomeView, {
        projection: emptyProjection(),
        theme,
        appSettings,
      }),
    );

    expect(html).toContain('data-archive-home-complete="true"');
    expect(html).toContain('data-archive-mark-calendar');
    expect(html).toContain('data-archive-browse');
    expect(html).not.toContain('data-archive-home-shell');
  });
});

describe('ArchiveShell', () => {
  it('defaults to home mode', () => {
    const html = renderToStaticMarkup(
      createElement(ArchiveShell, {
        now: DateTime.fromJSDate(NOW),
        appSettings,
        theme,
      }),
    );

    expect(html).toContain('data-archive-mode="home"');
    expect(html).toContain('data-archive-home="true"');
    expect(DEFAULT_ARCHIVE_VIEW_MODE).toBe('home');
  });

  it('renders branch placeholders when mode is overridden', () => {
    const periodHtml = renderToStaticMarkup(
      createElement(ArchiveShell, {
        now: DateTime.fromJSDate(NOW),
        appSettings,
        theme,
        initialMode: 'period',
      }),
    );
    expect(periodHtml).toContain('data-archive-mode="period"');
    expect(periodHtml).toContain('data-archive-placeholder="period"');
    expect(periodHtml).toContain('Period view is not available yet.');
  });
});

describe('ArchivePlaceholderView', () => {
  it('renders timeline placeholder copy', () => {
    const html = renderToStaticMarkup(
      createElement(ArchivePlaceholderView, { mode: 'timeline', theme }),
    );
    expect(html).toContain('data-archive-placeholder="timeline"');
    expect(html).toContain('Timeline view is not available yet.');
  });
});

describe('useArchiveHomeProjection wiring', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('buildArchiveHomeProjectionForHook mirrors hook output shape', () => {
    const projection = buildArchiveHomeProjectionForHook([], NOW, []);
    expect(projection.frame.title).toBe('Archive');
    expect(projection.markCalendar).toBeDefined();
    expect(projection.empty.isEmpty).toBe(true);
  });
});

describe('ArchiveShell with hook', () => {
  it('renders home view wired through useArchiveHomeProjection', () => {
    const html = renderToStaticMarkup(
      createElement(ArchiveShell, {
        now: DateTime.fromJSDate(NOW),
        appSettings,
        theme,
      }),
    );
    expect(html).toContain('Archive');
    expect(html).toContain('data-archive-home="true"');
  });
});
