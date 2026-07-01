// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import type { NoteBase } from '../../../noteUtils';
import { KnowledgeIndexService } from '../KnowledgeIndexService';
import { DatabaseTimelineView } from '../components/DatabaseTimelineView';
import type { NoteChromeColors } from '../../../noteEditorTheme';
import { filterNotes } from '../query/filterNotes';
import {
  defaultTablePresentationConfig,
  normalizeTimelineConfig,
} from './databasePresentationConfig';
import { toDateKey } from './parseDatabaseDate';
import { prepareDatabaseTimelineItems } from './prepareDatabaseTimelineItems';
import { prepareDatabaseViewPresentation } from './prepareDatabaseViewPresentation';
import {
  createDatabaseView,
  normalizeDatabaseViews,
} from './databaseViews';
import {
  setDatabaseViewPresentation,
  setDatabaseViewTimelineEndProperty,
  setDatabaseViewTimelineStartProperty,
} from './databaseViewOperations';
import type { DatabaseView } from './databaseViewModels';
import { loadDatabaseViews, saveDatabaseViews, DATABASE_VIEWS_KEY } from './databaseViewsStorage';
import {
  activateDatabaseViewWorkspace,
  isWorkspaceKindActive,
} from '../workspace/workspaceActivation';
import { INACTIVE_WORKSPACE } from '../workspace/workspaceModels';
import { filterByDatabaseView } from './filterByDatabaseView';
import {
  formatTimelineDateRange,
  timelineItemOverlapsMonth,
} from './timelineModels';

const timelineColors: NoteChromeColors = {
  wrap: '#fff',
  sidebar: '#fff',
  sideBdr: '#ddd',
  notelist: '#fff',
  editor: '#fff',
  toolbar: '#fff',
  toolBdr: '#ddd',
  card: '#fff',
  cardHov: '#f5f5f5',
  cardAct: '#eee',
  cardActBdr: '#8B5CF6',
  input: '#fff',
  inputBdr: '#ddd',
  text: '#111',
  textMuted: '#666',
  textFaint: '#999',
  accent: '#8B5CF6',
  accentBg: '#eee',
  badge: '#eee',
  badgeTxt: '#333',
  tag: '#eee',
  tagTxt: '#333',
  green: '#0a0',
  danger: '#c00',
};

afterEach(() => {
  vi.useRealTimers();
});

function note(
  id: string,
  title: string,
  body: string,
  extras: Partial<NoteBase> = {},
): NoteBase {
  return {
    id,
    title,
    body,
    updatedAt: 0,
    folderId: null,
    deletedAt: null,
    ...extras,
  };
}

function timelineView(overrides: Partial<DatabaseView> = {}): DatabaseView {
  return createDatabaseView([], 'Project Timeline', 'tag:japanese', {
    id: 'timeline-1',
    presentation: 'timeline',
    startDateProperty: 'startDate',
    endDateProperty: 'endDate',
    ...overrides,
  })[0];
}

describe('normalizeTimelineConfig', () => {
  it('normalizes start and end date properties', () => {
    expect(normalizeTimelineConfig({
      type: 'timeline',
      startDateProperty: ' startDate ',
      endDateProperty: ' endDate ',
      sortBy: 'title',
    })).toMatchObject({
      type: 'timeline',
      startDateProperty: 'startDate',
      endDateProperty: 'endDate',
      sortBy: 'title',
    });
  });

  it('falls back to defaults when startDateProperty is missing', () => {
    expect(normalizeTimelineConfig({ type: 'timeline' })).toMatchObject({
      type: 'timeline',
      startDateProperty: 'startDate',
      endDateProperty: 'endDate',
    });
  });
});

describe('timeline view creation', () => {
  it('creates a timeline database view with date range config', () => {
    const created = createDatabaseView([], 'Project Timeline', 'tag:japanese', {
      presentation: 'timeline',
      startDateProperty: 'startDate',
      endDateProperty: 'endDate',
    })[0];
    expect(created.presentation).toBe('timeline');
    expect(created.presentationConfig).toMatchObject({
      type: 'timeline',
      startDateProperty: 'startDate',
      endDateProperty: 'endDate',
    });
  });
});

describe('presentation switching', () => {
  it('switches table to timeline and back', () => {
    const tableConfig = defaultTablePresentationConfig();
    let view: DatabaseView = {
      id: 'db-1',
      name: 'Study',
      query: 'tag:japanese',
      presentation: 'table',
      presentationConfig: tableConfig,
      columns: tableConfig.columns,
      sort: tableConfig.sort,
    };

    view = setDatabaseViewPresentation(view, 'timeline');
    expect(view.presentation).toBe('timeline');
    expect(view.presentationConfig.type).toBe('timeline');

    view = setDatabaseViewPresentation(view, 'table');
    expect(view.presentation).toBe('table');
    expect(view.presentationConfig.type).toBe('table');
  });

  it('updates timeline date properties', () => {
    let view = timelineView();
    view = setDatabaseViewTimelineStartProperty(view, 'updatedAt');
    view = setDatabaseViewTimelineEndProperty(view, 'createdAt');
    expect(view.presentationConfig).toMatchObject({
      type: 'timeline',
      startDateProperty: 'updatedAt',
      endDateProperty: 'createdAt',
    });
  });
});

describe('prepareDatabaseTimelineItems', () => {
  let service: KnowledgeIndexService;
  let notes: NoteBase[];

  beforeEach(() => {
    service = new KnowledgeIndexService();
    notes = [
      note('a', 'Single Day', '', {
        properties: { tags: 'japanese', startDate: '2026-06-10', endDate: '2026-06-10' },
      }),
      note('b', 'Date Range', '', {
        properties: { tags: 'japanese', startDate: '2026-06-05', endDate: '2026-06-15' },
      }),
      note('c', 'No Start', '', { properties: { tags: 'japanese', endDate: '2026-06-12' } }),
      note('d', 'Bad Dates', '', {
        properties: { tags: 'japanese', startDate: 'invalid', endDate: '2026-06-12' },
      }),
      note('e', 'English', '', {
        properties: { tags: 'english', startDate: '2026-06-10', endDate: '2026-06-12' },
      }),
      note('f', 'Metadata Start', '', {
        updatedAt: Date.parse('2026-06-08T10:00:00Z'),
        properties: { tags: 'japanese' },
      }),
    ];
    service.buildFromNotes(notes);
  });

  it('resolves single-day items when start equals end', () => {
    const items = prepareDatabaseTimelineItems(timelineView(), notes, service);
    const single = items.find(item => item.noteId === 'a');
    expect(single).toBeDefined();
    expect(toDateKey(single!.startDate)).toBe('2026-06-10');
    expect(toDateKey(single!.endDate)).toBe('2026-06-10');
    expect(formatTimelineDateRange(single!.startDate, single!.endDate)).not.toContain('–');
  });

  it('resolves range items when start is before end', () => {
    const items = prepareDatabaseTimelineItems(timelineView(), notes, service);
    const range = items.find(item => item.noteId === 'b');
    expect(range).toBeDefined();
    expect(toDateKey(range!.startDate)).toBe('2026-06-05');
    expect(toDateKey(range!.endDate)).toBe('2026-06-15');
    expect(formatTimelineDateRange(range!.startDate, range!.endDate)).toContain('–');
  });

  it('excludes notes with invalid or missing start dates', () => {
    const items = prepareDatabaseTimelineItems(timelineView(), notes, service);
    expect(items.some(item => item.noteId === 'c')).toBe(false);
    expect(items.some(item => item.noteId === 'd')).toBe(false);
  });

  it('uses updatedAt when configured as startDateProperty', () => {
    const view = timelineView({
      startDateProperty: 'updatedAt',
      endDateProperty: undefined,
    });
    const items = prepareDatabaseTimelineItems(view, notes, service);
    expect(items.some(item => item.noteId === 'f')).toBe(true);
  });

  it('filters then resolves without changing query semantics', () => {
    const view = timelineView({ query: 'tag:japanese' });
    const items = prepareDatabaseTimelineItems(view, notes, service);
    expect(items.map(item => item.noteId).sort()).toEqual(['a', 'b']);

    const direct = filterNotes(notes, service, view.query);
    const viaView = filterByDatabaseView(notes, service, view);
    expect(viaView.notes.map(n => n.id)).toEqual(direct.notes.map(n => n.id));
  });
});

describe('timelineItemOverlapsMonth', () => {
  it('detects overlap for ranges spanning the month', () => {
    const item = {
      noteId: 'x',
      note: note('x', 'X', ''),
      title: 'X',
      startDate: new Date(2026, 5, 1),
      endDate: new Date(2026, 6, 15),
    };
    expect(timelineItemOverlapsMonth(item, 2026, 6)).toBe(true);
    expect(timelineItemOverlapsMonth(item, 2026, 7)).toBe(true);
    expect(timelineItemOverlapsMonth(item, 2026, 8)).toBe(false);
  });
});

describe('prepareDatabaseViewPresentation', () => {
  it('dispatches timeline presentation', () => {
    const service = new KnowledgeIndexService();
    const notes = [
      note('a', 'Task', '', {
        properties: { tags: 'japanese', startDate: '2026-06-10', endDate: '2026-06-12' },
      }),
    ];
    service.buildFromNotes(notes);
    const view = timelineView();
    const data = prepareDatabaseViewPresentation(view, notes, service);
    expect(data.type).toBe('timeline');
    if (data.type === 'timeline') {
      expect(data.items.map(item => item.noteId)).toEqual(['a']);
    }
  });
});

describe('persistence and backward compatibility', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('persists timeline presentation and date properties', () => {
    const views = [timelineView()];
    saveDatabaseViews(views);
    const loaded = loadDatabaseViews()[0];
    expect(loaded.presentation).toBe('timeline');
    expect(loaded.presentationConfig).toMatchObject({
      type: 'timeline',
      startDateProperty: 'startDate',
      endDateProperty: 'endDate',
    });
  });

  it('migrates legacy table views without presentationConfig', () => {
    const tableConfig = defaultTablePresentationConfig();
    const views = normalizeDatabaseViews([
      {
        id: '1',
        name: 'Legacy',
        query: 'tag:legacy',
        presentation: 'table',
        columns: tableConfig.columns,
        sort: tableConfig.sort,
      },
    ]);
    expect(views[0].presentationConfig.type).toBe('table');
  });

  it('ignores corrupted storage', () => {
    localStorage.setItem(DATABASE_VIEWS_KEY, '{bad json');
    expect(loadDatabaseViews()).toEqual([]);
  });
});

describe('workspace integration', () => {
  it('activates timeline views through workspace helpers', () => {
    const view = timelineView();
    const result = activateDatabaseViewWorkspace(view);
    expect(result.activation).toEqual({ kind: 'database-view', id: view.id });
    expect(isWorkspaceKindActive(result.activation, 'database-view', view.id)).toBe(true);
    expect(isWorkspaceKindActive(INACTIVE_WORKSPACE, 'database-view')).toBe(false);
  });
});

describe('DatabaseTimelineView', () => {
  it('renders month navigation and timeline items', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 12, 12, 0, 0));
    const service = new KnowledgeIndexService();
    const notes = [
      note('a', 'N1 Vocabulary', '', {
        properties: { tags: 'japanese', startDate: '2026-06-10', endDate: '2026-06-12' },
      }),
      note('b', 'Tobira Ch.4', '', {
        properties: { tags: 'japanese', startDate: '2026-06-05', endDate: '2026-06-05' },
      }),
    ];
    service.buildFromNotes(notes);
    const items = prepareDatabaseTimelineItems(timelineView(), notes, service);
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    let selectedId: string | null = null;

    act(() => {
      root.render(createElement(DatabaseTimelineView, {
        colors: timelineColors,
        items,
        service,
        activeNoteId: 'a',
        onSelectNote: id => { selectedId = id; },
      }));
    });

    expect(container.textContent).toContain('N1 Vocabulary');
    expect(container.textContent).toContain('Tobira Ch.4');
    expect(container.textContent).toContain('Today');

    const noteButton = Array.from(container.querySelectorAll('button')).find(
      btn => btn.textContent?.includes('N1 Vocabulary'),
    );
    expect(noteButton).toBeTruthy();
    act(() => {
      noteButton!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(selectedId).toBe('a');
    root.unmount();
    container.remove();
  });
});
