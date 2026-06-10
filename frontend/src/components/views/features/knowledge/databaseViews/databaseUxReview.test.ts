// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import type { NoteBase } from '../../../noteUtils';
import { KnowledgeIndexService } from '../KnowledgeIndexService';
import {
  DatabasePresentationSwitcher,
} from '../components/DatabasePresentationSwitcher';
import {
  DatabasePropertyKeyField,
} from '../components/DatabasePropertyKeyField';
import {
  BOARD_GROUP_BY_FIELD,
  CALENDAR_DATE_PROPERTY_FIELD,
  DATABASE_PRESENTATION_OPTIONS,
  presentationLabel,
} from './databasePresentationMeta';
import { defaultTablePresentationConfig } from './databasePresentationConfig';
import { prepareDatabaseViewPresentation } from './prepareDatabaseViewPresentation';
import {
  createDatabaseView,
  normalizeDatabaseViews,
} from './databaseViews';
import {
  setDatabaseViewPresentation,
} from './databaseViewOperations';
import type { DatabaseView } from './databaseViewModels';
import { loadDatabaseViews, saveDatabaseViews } from './databaseViewsStorage';

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

describe('databasePresentationMeta', () => {
  it('exposes all presentation options', () => {
    expect(DATABASE_PRESENTATION_OPTIONS.map(o => o.value)).toEqual(['table', 'board', 'calendar', 'timeline']);
    expect(presentationLabel('board')).toBe('Board');
    expect(presentationLabel('calendar')).toBe('Calendar');
    expect(presentationLabel('timeline')).toBe('Timeline');
  });

  it('defines shared property field presets', () => {
    expect(BOARD_GROUP_BY_FIELD.defaultValue).toBe('status');
    expect(CALENDAR_DATE_PROPERTY_FIELD.defaultValue).toBe('reviewDate');
  });
});

describe('prepareDatabaseViewPresentation', () => {
  let service: KnowledgeIndexService;
  let notes: NoteBase[];

  beforeEach(() => {
    service = new KnowledgeIndexService();
    notes = [
      note('a', 'Alpha', '', { properties: { tags: 'japanese', status: 'Todo', reviewDate: '2026-06-10' } }),
      note('b', 'Beta', '', { properties: { tags: 'english' } }),
    ];
    service.buildFromNotes(notes);
  });

  it('dispatches table presentation', () => {
    const view = createDatabaseView([], 'Study', 'tag:japanese')[0];
    const data = prepareDatabaseViewPresentation(view, notes, service);
    expect(data.type).toBe('table');
    if (data.type === 'table') {
      expect(data.notes.map(n => n.id)).toEqual(['a']);
    }
  });

  it('dispatches board presentation', () => {
    const view = createDatabaseView([], 'Board', 'tag:japanese', {
      presentation: 'board',
      groupBy: 'status',
    })[0];
    const data = prepareDatabaseViewPresentation(view, notes, service);
    expect(data.type).toBe('board');
    if (data.type === 'board') {
      expect(data.lanes.some(l => l.notes.some(n => n.id === 'a'))).toBe(true);
    }
  });

  it('dispatches calendar presentation', () => {
    const view = createDatabaseView([], 'Calendar', 'tag:japanese', {
      presentation: 'calendar',
      dateProperty: 'reviewDate',
    })[0];
    const data = prepareDatabaseViewPresentation(view, notes, service);
    expect(data.type).toBe('calendar');
    if (data.type === 'calendar') {
      expect(data.buckets.some(b => b.notes.some(n => n.id === 'a'))).toBe(true);
    }
  });

  it('dispatches timeline presentation', () => {
    const view = createDatabaseView([], 'Timeline', 'tag:japanese', {
      presentation: 'timeline',
      startDateProperty: 'startDate',
      endDateProperty: 'endDate',
    })[0];
    const notesWithRange = [
      ...notes,
      note('t', 'Timeline task', '', {
        properties: { tags: 'japanese', startDate: '2026-06-10', endDate: '2026-06-12' },
      }),
    ];
    service.buildFromNotes(notesWithRange);
    const data = prepareDatabaseViewPresentation(view, notesWithRange, service);
    expect(data.type).toBe('timeline');
    if (data.type === 'timeline') {
      expect(data.items.some(item => item.noteId === 't')).toBe(true);
    }
  });
});

describe('presentation switching persistence', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('preserves table config when switching table → board → table', () => {
    const tableConfig = defaultTablePresentationConfig();
    let view: DatabaseView = {
      id: 'db-1',
      name: 'Study',
      query: 'tag:japanese',
      presentation: 'table',
      presentationConfig: {
        ...tableConfig,
        sort: { key: 'title', direction: 'asc' },
      },
      columns: tableConfig.columns,
      sort: { key: 'title', direction: 'asc' },
    };

    view = setDatabaseViewPresentation(view, 'board');
    expect(view.presentation).toBe('board');

    view = setDatabaseViewPresentation(view, 'table');
    expect(view.presentation).toBe('table');
    if (view.presentationConfig.type === 'table') {
      expect(view.presentationConfig.sort).toEqual({ key: 'title', direction: 'asc' });
    }

    saveDatabaseViews([view]);
    const loaded = loadDatabaseViews()[0];
    expect(loaded.presentation).toBe('table');
  });

  it('normalizes legacy views without presentationConfig', () => {
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
});

describe('shared control components', () => {
  it('renders presentation switcher with all options', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    let selected = 'table';

    act(() => {
      root.render(createElement(DatabasePresentationSwitcher, {
        value: selected as 'table',
        onChange: value => { selected = value; },
      }));
    });

    expect(container.textContent).toContain('Table');
    expect(container.textContent).toContain('Board');
    expect(container.textContent).toContain('Calendar');
    expect(container.textContent).toContain('Timeline');
  });

  it('renders property key field with preset label', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(createElement(DatabasePropertyKeyField, {
        preset: BOARD_GROUP_BY_FIELD,
        value: 'status',
        onChange: () => {},
      }));
    });

    expect(container.textContent).toContain('Group by');
    expect(container.querySelector('input')?.getAttribute('placeholder')).toBe(BOARD_GROUP_BY_FIELD.placeholder);
  });
});
