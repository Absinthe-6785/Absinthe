// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import type { NoteBase } from '../../../noteUtils';
import { KnowledgeIndexService } from '../KnowledgeIndexService';
import {
  defaultDatabaseViewColumns,
  normalizeDatabaseViewColumns,
  resolveVisibleColumns,
} from './databaseViewConfig';
import {
  addDatabaseViewColumn,
  hideDatabaseViewColumn,
  removeDatabaseViewColumn,
  setDatabaseViewSort,
  showDatabaseViewColumn,
} from './databaseViewOperations';
import type { DatabaseView } from './databaseViewModels';
import { prepareDatabaseViewRows } from './prepareDatabaseViewRows';
import { sortDatabaseViewRows } from './sortDatabaseViewRows';
import { createDatabaseView, normalizeDatabaseViews } from './databaseViews';
import { loadDatabaseViews, saveDatabaseViews, DATABASE_VIEWS_KEY } from './databaseViewsStorage';
import { getDatabaseCellValue } from '../components/DatabaseTableView';
import { toDatabaseColumn } from './databaseViewConfig';

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

function baseView(overrides: Partial<DatabaseView> = {}): DatabaseView {
  return {
    id: 'db-1',
    name: 'Study',
    query: 'tag:japanese',
    presentation: 'table',
    columns: defaultDatabaseViewColumns(),
    sort: { key: 'updatedAt', direction: 'desc' },
    ...overrides,
  };
}

describe('column operations', () => {
  it('adds property columns', () => {
    const view = addDatabaseViewColumn(baseView(), 'status');
    expect(resolveVisibleColumns(view.columns).map(c => c.key)).toContain('status');
  });

  it('re-shows an existing hidden property column on add', () => {
    let view = addDatabaseViewColumn(baseView(), 'priority');
    view = hideDatabaseViewColumn(view, 'priority');
    view = addDatabaseViewColumn(view, 'priority');
    expect(view.columns?.find(c => c.key === 'priority')?.visible).toBe(true);
  });

  it('removes property columns', () => {
    const view = removeDatabaseViewColumn(addDatabaseViewColumn(baseView(), 'source'), 'source');
    expect(view.columns?.some(c => c.key === 'source')).toBe(false);
  });

  it('hides built-in columns instead of removing them', () => {
    const view = hideDatabaseViewColumn(baseView(), 'tags');
    expect(view.columns?.find(c => c.key === 'tags')?.visible).toBe(false);
    expect(view.columns?.some(c => c.key === 'tags')).toBe(true);
  });

  it('shows hidden columns', () => {
    const view = showDatabaseViewColumn(hideDatabaseViewColumn(baseView(), 'title'), 'title');
    expect(view.columns?.find(c => c.key === 'title')?.visible).toBe(true);
  });

  it('resolveVisibleColumns respects visibility', () => {
    const view = hideDatabaseViewColumn(baseView(), 'tags');
    const visible = resolveVisibleColumns(view.columns);
    expect(visible.map(c => c.key)).toEqual(['title', 'updatedAt']);
  });
});

describe('sortDatabaseViewRows', () => {
  let service: KnowledgeIndexService;
  let notes: NoteBase[];

  beforeEach(() => {
    service = new KnowledgeIndexService();
    notes = [
      note('a', 'Alpha', '', { updatedAt: 100, properties: { priority: 'high' } }),
      note('b', 'Beta', '', { updatedAt: 300, properties: { priority: 'low' } }),
      note('c', 'Gamma', '', { updatedAt: 200, properties: { priority: 'medium' } }),
    ];
    service.buildFromNotes(notes);
  });

  it('sorts by updatedAt descending', () => {
    const sorted = sortDatabaseViewRows(notes, { key: 'updatedAt', direction: 'desc' }, service);
    expect(sorted.map(n => n.id)).toEqual(['b', 'c', 'a']);
  });

  it('sorts by updatedAt ascending', () => {
    const sorted = sortDatabaseViewRows(notes, { key: 'updatedAt', direction: 'asc' }, service);
    expect(sorted.map(n => n.id)).toEqual(['a', 'c', 'b']);
  });

  it('sorts by title ascending', () => {
    const sorted = sortDatabaseViewRows(notes, { key: 'title', direction: 'asc' }, service);
    expect(sorted.map(n => n.id)).toEqual(['a', 'b', 'c']);
  });

  it('sorts by property column ascending', () => {
    const sorted = sortDatabaseViewRows(notes, { key: 'priority', direction: 'asc' }, service);
    expect(sorted.map(n => n.id)).toEqual(['a', 'b', 'c']);
  });

  it('updates sort via setDatabaseViewSort', () => {
    const view = setDatabaseViewSort(baseView(), { key: 'title', direction: 'asc' });
    expect(view.sort).toEqual({ key: 'title', direction: 'asc' });
  });
});

describe('prepareDatabaseViewRows', () => {
  it('filters then sorts without changing query semantics', () => {
    const service = new KnowledgeIndexService();
    const notes = [
      note('a', 'Alpha', '', { properties: { tags: 'japanese', status: 'active' }, updatedAt: 100 }),
      note('b', 'Beta', '', { properties: { tags: 'japanese', status: 'draft' }, updatedAt: 300 }),
      note('c', 'Gamma', '', { properties: { tags: 'english' }, updatedAt: 200 }),
    ];
    service.buildFromNotes(notes);

    const rows = prepareDatabaseViewRows(
      baseView({ query: 'tag:japanese status:active', sort: { key: 'updatedAt', direction: 'desc' } }),
      notes,
      service,
    );

    expect(rows.map(n => n.id)).toEqual(['a']);
  });
});

describe('property columns', () => {
  it('reads property values via KnowledgeIndexService', () => {
    const service = new KnowledgeIndexService();
    const notes = [note('a', 'Alpha', '', { properties: { status: 'active' } })];
    service.buildFromNotes(notes);

    const value = getDatabaseCellValue(
      notes[0],
      toDatabaseColumn('status'),
      service,
    );
    expect(value).toBe('active');
  });
});

describe('persistence and backward compatibility', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('persists columns and sort settings', () => {
    const views = [baseView({
      columns: [
        { key: 'title', visible: true },
        { key: 'status', visible: true },
        { key: 'updatedAt', visible: false },
        { key: 'tags', visible: true },
      ],
      sort: { key: 'status', direction: 'asc' },
    })];
    saveDatabaseViews(views);
    expect(loadDatabaseViews()[0].sort).toEqual({ key: 'status', direction: 'asc' });
    expect(loadDatabaseViews()[0].columns?.some(c => c.key === 'status')).toBe(true);
  });

  it('migrates legacy database views without columns or sort', () => {
    const views = normalizeDatabaseViews([
      { id: '1', name: 'Legacy', query: 'tag:legacy', presentation: 'table' },
    ]);
    expect(views[0].columns?.length).toBeGreaterThan(0);
    expect(views[0].sort?.key).toBe('updatedAt');
  });

  it('creates new views with default columns and sort', () => {
    const created = createDatabaseView([], 'Japanese Study', 'tag:japanese')[0];
    expect(created.columns?.map(c => c.key)).toEqual(['title', 'updatedAt', 'tags']);
    expect(created.sort).toEqual({ key: 'updatedAt', direction: 'desc' });
  });

  it('normalizes invalid column entries', () => {
    const columns = normalizeDatabaseViewColumns([
      { key: 'status', visible: true },
      { key: '', visible: true },
      'invalid',
    ]);
    expect(columns.some(c => c.key === 'title')).toBe(true);
    expect(columns.some(c => c.key === 'status')).toBe(true);
  });
});

describe('workspace integration', () => {
  it('prepareDatabaseViewRows uses filterNotes before sorting', () => {
    const service = new KnowledgeIndexService();
    const notes = [
      note('a', 'A', '', { properties: { tags: 'work' }, updatedAt: 50 }),
      note('b', 'B', '', { properties: { tags: 'work' }, updatedAt: 150 }),
    ];
    service.buildFromNotes(notes);

    const rows = prepareDatabaseViewRows(
      baseView({ query: 'tag:work', sort: { key: 'updatedAt', direction: 'asc' } }),
      notes,
      service,
    );
    expect(rows.map(n => n.id)).toEqual(['a', 'b']);
  });
});
