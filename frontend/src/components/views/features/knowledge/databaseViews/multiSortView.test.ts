// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import type { NoteBase } from '../../../noteUtils';
import { KnowledgeIndexService } from '../KnowledgeIndexService';
import {
  addDatabaseViewFormulaColumn,
  addDatabaseViewRollupColumn,
  addDatabaseViewSortRule,
  moveDatabaseViewSortRule,
  removeDatabaseViewSortRule,
  setDatabaseViewSortRules,
} from './databaseViewOperations';
import { defaultTablePresentationConfig, normalizeTableConfig } from './databasePresentationConfig';
import { prepareDatabaseViewRows } from './prepareDatabaseViewRows';
import {
  resolveDatabaseViewSortRules,
  sortDatabaseViewRows,
} from './sortDatabaseViewRows';
import { createDatabaseView, normalizeDatabaseViews } from './databaseViews';
import { loadDatabaseViews, saveDatabaseViews, DATABASE_VIEWS_KEY } from './databaseViewsStorage';
import { syncTableSortConfig } from './databaseSortFutureModels';
import type { DatabaseView } from './databaseViewModels';
import { withPresentationDefaults } from './databasePresentationConfig';

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

function tableView(overrides: Partial<DatabaseView> = {}): DatabaseView {
  const tableConfig = defaultTablePresentationConfig();
  return withPresentationDefaults({
    id: 'db-1',
    name: 'Study',
    query: 'tag:japanese',
    presentation: 'table',
    presentationConfig: tableConfig,
    columns: tableConfig.columns,
    sort: tableConfig.sort,
    ...overrides,
  });
}

describe('normalizeTableConfig', () => {
  it('migrates legacy sort to sortRules', () => {
    const config = normalizeTableConfig({
      type: 'table',
      sort: { key: 'title', direction: 'asc' },
    });
    expect(config.sortRules).toEqual([{ key: 'title', direction: 'asc' }]);
    expect(config.sort).toEqual({ key: 'title', direction: 'asc' });
  });

  it('reconciles stale single sortRules with explicit sort shorthand', () => {
    const config = normalizeTableConfig({
      type: 'table',
      sort: { key: 'title', direction: 'asc' },
      sortRules: [{ key: 'updatedAt', direction: 'desc' }],
    });
    expect(config.sortRules).toEqual([{ key: 'title', direction: 'asc' }]);
    expect(config.sort).toEqual({ key: 'title', direction: 'asc' });
  });

  it('prefers sortRules and syncs legacy sort shorthand', () => {
    const config = normalizeTableConfig({
      type: 'table',
      sort: { key: 'updatedAt', direction: 'desc' },
      sortRules: [
        { key: 'status', direction: 'asc' },
        { key: 'priority', direction: 'desc' },
      ],
    });
    expect(config.sortRules).toEqual([
      { key: 'status', direction: 'asc' },
      { key: 'priority', direction: 'desc' },
    ]);
    expect(config.sort).toEqual({ key: 'status', direction: 'asc' });
  });
});

describe('sortDatabaseViewRows multi-rule', () => {
  let service: KnowledgeIndexService;
  let notes: NoteBase[];
  let view: DatabaseView;

  beforeEach(() => {
    service = new KnowledgeIndexService();
    notes = [
      note('a', 'Alpha', '', { updatedAt: 100, properties: { status: 'Todo', priority: 'high' } }),
      note('b', 'Beta', '', { updatedAt: 300, properties: { status: 'Todo', priority: 'low' } }),
      note('c', 'Gamma', '', { updatedAt: 200, properties: { status: 'Done', priority: 'high' } }),
      note('d', 'Delta', '', { updatedAt: 150, properties: { status: 'Todo', priority: 'high' } }),
    ];
    service.buildFromNotes(notes);
    view = tableView();
  });

  it('sorts by a single rule (legacy compatible)', () => {
    const table = defaultTablePresentationConfig();
    const sorted = sortDatabaseViewRows(
      notes,
      [{ key: 'updatedAt', direction: 'desc' }],
      service,
      table,
    );
    expect(sorted.map(n => n.id)).toEqual(['b', 'c', 'd', 'a']);
  });

  it('applies lexicographic multi-rule precedence', () => {
    const table = defaultTablePresentationConfig();
    const sorted = sortDatabaseViewRows(
      notes,
      [
        { key: 'status', direction: 'asc' },
        { key: 'priority', direction: 'desc' },
        { key: 'updatedAt', direction: 'desc' },
      ],
      service,
      table,
    );
    expect(sorted.map(n => n.id)).toEqual(['c', 'b', 'd', 'a']);
  });

  it('sorts by property metadata and tags', () => {
    const table = defaultTablePresentationConfig();
    const taggedNotes = [
      note('a', 'Alpha', '', { properties: { tags: 'beta' } }),
      note('b', 'Beta', '', { properties: { tags: 'alpha' } }),
    ];
    service.buildFromNotes(taggedNotes);
    const sorted = sortDatabaseViewRows(
      taggedNotes,
      [{ key: 'tags', direction: 'asc' }],
      service,
      table,
    );
    expect(sorted.map(n => n.id)).toEqual(['b', 'a']);
  });
});

describe('rollup and formula sort rules', () => {
  it('sorts by rollup column values', () => {
    const service = new KnowledgeIndexService();
    const notes = [
      note('course-1', 'Course A', ''),
      note('course-2', 'Course B', ''),
      note('lecture-1', 'Lecture', '', { course: ['course-1'] }),
      note('lecture-2', 'Lecture 2', '', { course: ['course-1'] }),
      note('lecture-3', 'Lecture 3', '', { course: ['course-2'] }),
    ];
    service.buildFromNotes(notes);

    let view = addDatabaseViewRollupColumn(tableView(), {
      key: 'lectureCount',
      visible: true,
      rollup: { relationKey: 'course', direction: 'incoming', function: 'count' },
    });
    view = setDatabaseViewSortRules(view, [{ key: 'lectureCount', direction: 'desc' }]);
    const table = view.presentationConfig.type === 'table' ? view.presentationConfig : defaultTablePresentationConfig();
    const courseNotes = notes.filter(n => n.id.startsWith('course'));
    const sorted = sortDatabaseViewRows(
      courseNotes,
      resolveDatabaseViewSortRules(table),
      service,
      table,
    );
    expect(sorted.map(n => n.id)).toEqual(['course-1', 'course-2']);
  });

  it('sorts by formula column values', () => {
    const service = new KnowledgeIndexService();
    const notes = [
      note('a', 'Course A', '', { properties: { completed: '10', total: '20' } }),
      note('b', 'Course B', '', { properties: { completed: '18', total: '20' } }),
    ];
    service.buildFromNotes(notes);

    let view = addDatabaseViewFormulaColumn(tableView(), {
      key: 'completionRate',
      visible: true,
      formula: {
        id: 'completionRate',
        expression: '(completed / total) * 100',
        inputs: {
          completed: { type: 'field', key: 'completed' },
          total: { type: 'field', key: 'total' },
        },
      },
    });
    view = setDatabaseViewSortRules(view, [{ key: 'completionRate', direction: 'desc' }]);
    const table = view.presentationConfig.type === 'table' ? view.presentationConfig : defaultTablePresentationConfig();
    const sorted = sortDatabaseViewRows(
      notes,
      resolveDatabaseViewSortRules(table),
      service,
      table,
    );
    expect(sorted.map(n => n.id)).toEqual(['b', 'a']);
  });
});

describe('sort rule operations', () => {
  it('adds, removes, and reorders sort rules', () => {
    let view = tableView();
    view = addDatabaseViewSortRule(view, { key: 'status', direction: 'asc' });
    view = addDatabaseViewSortRule(view, { key: 'priority', direction: 'desc' });
    const table = view.presentationConfig;
    expect(table.type).toBe('table');
    if (table.type !== 'table') return;
    expect(table.sortRules).toEqual([
      { key: 'updatedAt', direction: 'desc' },
      { key: 'status', direction: 'asc' },
      { key: 'priority', direction: 'desc' },
    ]);

    view = moveDatabaseViewSortRule(view, 2, 0);
    const moved = view.presentationConfig;
    if (moved.type !== 'table') return;
    expect(moved.sortRules?.[0]).toEqual({ key: 'priority', direction: 'desc' });

    view = removeDatabaseViewSortRule(view, 1);
    const trimmed = view.presentationConfig;
    if (trimmed.type !== 'table') return;
    expect(trimmed.sortRules).toHaveLength(2);
  });
});

describe('persistence and backward compatibility', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('persists sortRules and legacy sort shorthand', () => {
    let view = setDatabaseViewSortRules(tableView(), [
      { key: 'status', direction: 'asc' },
      { key: 'updatedAt', direction: 'desc' },
    ]);
    saveDatabaseViews([view]);
    const loaded = loadDatabaseViews()[0];
    expect(loaded.presentationConfig.type).toBe('table');
    if (loaded.presentationConfig.type === 'table') {
      expect(loaded.presentationConfig.sortRules).toEqual([
        { key: 'status', direction: 'asc' },
        { key: 'updatedAt', direction: 'desc' },
      ]);
      expect(loaded.presentationConfig.sort).toEqual({ key: 'status', direction: 'asc' });
      expect(loaded.sort).toEqual({ key: 'status', direction: 'asc' });
    }
  });

  it('migrates legacy views with sort only', () => {
    const tableConfig = defaultTablePresentationConfig();
    const views = normalizeDatabaseViews([
      {
        id: '1',
        name: 'Legacy',
        query: 'tag:legacy',
        presentation: 'table',
        columns: tableConfig.columns,
        sort: { key: 'title', direction: 'asc' },
      },
    ]);
    const table = views[0].presentationConfig;
    if (table.type === 'table') {
      expect(table.sortRules).toEqual([{ key: 'title', direction: 'asc' }]);
    }
  });

  it('ignores corrupted storage', () => {
    localStorage.setItem(DATABASE_VIEWS_KEY, '{bad json');
    expect(loadDatabaseViews()).toEqual([]);
  });
});

describe('prepareDatabaseViewRows', () => {
  it('uses multi-sort rules in the table pipeline', () => {
    const service = new KnowledgeIndexService();
    const notes = [
      note('a', 'Alpha', '', { properties: { tags: 'japanese', status: 'Todo', priority: 'high' }, updatedAt: 100 }),
      note('b', 'Beta', '', { properties: { tags: 'japanese', status: 'Todo', priority: 'low' }, updatedAt: 300 }),
      note('c', 'Gamma', '', { properties: { tags: 'english' }, updatedAt: 200 }),
    ];
    service.buildFromNotes(notes);

    const view = setDatabaseViewSortRules(
      createDatabaseView([], 'Study', 'tag:japanese')[0],
      [
        { key: 'status', direction: 'asc' },
        { key: 'priority', direction: 'desc' },
      ],
    );
    const rows = prepareDatabaseViewRows(view, notes, service);
    expect(rows.map(n => n.id)).toEqual(['b', 'a']);
  });
});

describe('syncTableSortConfig', () => {
  it('keeps sort and sortRules aligned', () => {
    expect(syncTableSortConfig(
      { key: 'updatedAt', direction: 'desc' },
      [{ key: 'status', direction: 'asc' }],
    )).toEqual({
      sort: { key: 'status', direction: 'asc' },
      sortRules: [{ key: 'status', direction: 'asc' }],
    });
  });
});
