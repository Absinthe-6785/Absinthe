// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import type { NoteBase } from '../../../noteUtils';
import { KnowledgeIndexService } from '../KnowledgeIndexService';
import { DatabaseCalendarView } from '../components/DatabaseCalendarView';
import type { NoteChromeColors } from '../../../noteEditorTheme';
import { filterNotes } from '../query/filterNotes';
import {
  bucketNotesByDate,
  NO_DATE_KEY,
} from './bucketNotesByDate';
import { defaultTablePresentationConfig } from './databasePresentationConfig';
import {
  addMonths,
  buildCalendarMonthGrid,
  parseDatabaseDate,
  toDateKey,
} from './parseDatabaseDate';
import { prepareDatabaseCalendarBuckets } from './prepareDatabaseCalendarBuckets';
import {
  createDatabaseView,
  normalizeDatabaseViews,
} from './databaseViews';
import {
  setDatabaseViewDateProperty,
  setDatabaseViewPresentation,
} from './databaseViewOperations';
import type { DatabaseView } from './databaseViewModels';
import { loadDatabaseViews, saveDatabaseViews, DATABASE_VIEWS_KEY } from './databaseViewsStorage';
import {
  activateDatabaseViewWorkspace,
  isWorkspaceKindActive,
} from '../workspace/workspaceActivation';
import { INACTIVE_WORKSPACE } from '../workspace/workspaceModels';
import { filterByDatabaseView } from './filterByDatabaseView';

const calendarColors: NoteChromeColors = {
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

function calendarView(overrides: Partial<DatabaseView> = {}): DatabaseView {
  return createDatabaseView([], 'Study Schedule', 'tag:japanese', {
    id: 'calendar-1',
    presentation: 'calendar',
    dateProperty: 'reviewDate',
  })[0];
}

describe('parseDatabaseDate', () => {
  it('parses ISO date-only strings as local dates', () => {
    const date = parseDatabaseDate('2026-06-10');
    expect(date).not.toBeNull();
    expect(toDateKey(date!)).toBe('2026-06-10');
  });

  it('parses ISO datetime strings', () => {
    const date = parseDatabaseDate('2026-06-10T12:00:00Z');
    expect(date).not.toBeNull();
    expect(toDateKey(date!)).toBe('2026-06-10');
  });

  it('returns null for invalid dates', () => {
    expect(parseDatabaseDate('not-a-date')).toBeNull();
    expect(parseDatabaseDate('2026-13-40')).toBeNull();
    expect(parseDatabaseDate('')).toBeNull();
  });
});

describe('calendar view creation', () => {
  it('creates a calendar database view with dateProperty config', () => {
    const created = createDatabaseView([], 'Study Schedule', 'tag:japanese', {
      presentation: 'calendar',
      dateProperty: 'reviewDate',
    })[0];
    expect(created.presentation).toBe('calendar');
    expect(created.presentationConfig).toMatchObject({
      type: 'calendar',
      dateProperty: 'reviewDate',
    });
  });
});

describe('presentation switching', () => {
  it('switches table to calendar and back', () => {
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

    view = setDatabaseViewPresentation(view, 'calendar');
    expect(view.presentation).toBe('calendar');
    expect(view.presentationConfig.type).toBe('calendar');

    view = setDatabaseViewPresentation(view, 'table');
    expect(view.presentation).toBe('table');
    expect(view.presentationConfig.type).toBe('table');
  });

  it('updates dateProperty on calendar views', () => {
    let view = calendarView();
    view = setDatabaseViewDateProperty(view, 'examDate');
    expect(view.presentationConfig).toMatchObject({
      type: 'calendar',
      dateProperty: 'examDate',
    });
  });
});

describe('bucketNotesByDate', () => {
  let service: KnowledgeIndexService;
  let notes: NoteBase[];

  beforeEach(() => {
    service = new KnowledgeIndexService();
    notes = [
      note('a', 'N1 Vocabulary', '', { properties: { tags: 'japanese', reviewDate: '2026-06-10' } }),
      note('b', 'Tobira Ch.4', '', { properties: { tags: 'japanese', reviewDate: '2026-06-12' } }),
      note('c', 'Reading Practice', '', { properties: { tags: 'japanese', reviewDate: '2026-06-15' } }),
      note('d', 'No date task', '', { properties: { tags: 'japanese' } }),
      note('e', 'Bad date task', '', { properties: { tags: 'japanese', reviewDate: 'invalid' } }),
    ];
    service.buildFromNotes(notes);
  });

  it('buckets notes by property date values', () => {
    const buckets = bucketNotesByDate(notes, 'reviewDate', service);
    expect(buckets.find(b => b.dateKey === '2026-06-10')?.notes.map(n => n.id)).toEqual(['a']);
    expect(buckets.find(b => b.dateKey === '2026-06-12')?.notes.map(n => n.id)).toEqual(['b']);
    expect(buckets.find(b => b.dateKey === '2026-06-15')?.notes.map(n => n.id)).toEqual(['c']);
  });

  it('places invalid and missing dates in the no-date bucket', () => {
    const buckets = bucketNotesByDate(notes, 'reviewDate', service);
    const noDate = buckets.find(b => b.dateKey === NO_DATE_KEY);
    expect(noDate?.notes.map(n => n.id).sort()).toEqual(['d', 'e']);
  });

  it('uses updatedAt when configured as dateProperty', () => {
    const datedNotes = [
      note('a', 'Recent', '', { updatedAt: Date.parse('2026-06-10T10:00:00Z') }),
      note('b', 'Older', '', { updatedAt: Date.parse('2026-06-12T10:00:00Z') }),
    ];
    service.buildFromNotes(datedNotes);
    const buckets = bucketNotesByDate(datedNotes, 'updatedAt', service);
    expect(buckets.some(b => b.notes.some(n => n.id === 'a'))).toBe(true);
    expect(buckets.some(b => b.notes.some(n => n.id === 'b'))).toBe(true);
  });
});

describe('prepareDatabaseCalendarBuckets', () => {
  it('filters then buckets without changing query semantics', () => {
    const service = new KnowledgeIndexService();
    const notes = [
      note('a', 'N1 Vocabulary', '', { properties: { tags: 'japanese', reviewDate: '2026-06-10' } }),
      note('b', 'English Notes', '', { properties: { tags: 'english', reviewDate: '2026-06-10' } }),
    ];
    service.buildFromNotes(notes);

    const view = calendarView({ query: 'tag:japanese' });
    const buckets = prepareDatabaseCalendarBuckets(view, notes, service);
    const ids = buckets.flatMap(bucket => bucket.notes.map(n => n.id));
    expect(ids).toEqual(['a']);

    const direct = filterNotes(notes, service, view.query);
    const viaView = filterByDatabaseView(notes, service, view);
    expect(viaView.notes.map(n => n.id)).toEqual(direct.notes.map(n => n.id));
  });
});

describe('month navigation helpers', () => {
  it('builds a 42-cell month grid', () => {
    expect(buildCalendarMonthGrid(2026, 6)).toHaveLength(42);
  });

  it('moves between months', () => {
    expect(addMonths(2026, 6, 1)).toEqual({ year: 2026, month: 7 });
    expect(addMonths(2026, 1, -1)).toEqual({ year: 2025, month: 12 });
  });
});

describe('persistence and backward compatibility', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('persists calendar presentation and dateProperty', () => {
    const views = [calendarView()];
    saveDatabaseViews(views);
    const loaded = loadDatabaseViews()[0];
    expect(loaded.presentation).toBe('calendar');
    expect(loaded.presentationConfig).toMatchObject({
      type: 'calendar',
      dateProperty: 'reviewDate',
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
  it('activates calendar views through workspace helpers', () => {
    const view = calendarView();
    const result = activateDatabaseViewWorkspace(view);
    expect(result.activation).toEqual({ kind: 'database-view', id: view.id });
    expect(isWorkspaceKindActive(result.activation, 'database-view', view.id)).toBe(true);
    expect(isWorkspaceKindActive(INACTIVE_WORKSPACE, 'database-view')).toBe(false);
  });
});

describe('DatabaseCalendarView', () => {
  it('renders month grid and note cards', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 12, 12, 0, 0));
    const service = new KnowledgeIndexService();
    const notes = [
      note('a', 'N1 Vocabulary', '', { properties: { tags: 'study', reviewDate: '2026-06-10' } }),
      note('b', 'Tobira Ch.4', '', { properties: { tags: 'study', reviewDate: '2026-06-12' } }),
    ];
    service.buildFromNotes(notes);
    const buckets = bucketNotesByDate(notes, 'reviewDate', service);
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(createElement(DatabaseCalendarView, {
        colors: calendarColors,
        buckets,
        service,
        activeNoteId: 'a',
        onSelectNote: () => {},
      }));
    });

    expect(container.textContent).toContain('N1 Vocabulary');
    expect(container.textContent).toContain('Tobira Ch.4');
    expect(container.textContent).toContain('Today');
    root.unmount();
    container.remove();
  });
});
