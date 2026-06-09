// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import type { NoteBase } from '../../../noteUtils';
import { KnowledgeIndexService } from '../KnowledgeIndexService';
import { getDatabaseRollupCellValue } from '../components/DatabaseTableView';
import {
  addDatabaseViewRollupDefinition,
  removeDatabaseViewRollupColumn,
} from '../databaseViews/databaseViewOperations';
import { defaultTablePresentationConfig, withPresentationDefaults } from '../databaseViews/databasePresentationConfig';
import { loadDatabaseViews, saveDatabaseViews, DATABASE_VIEWS_KEY } from '../databaseViews/databaseViewsStorage';
import { createDatabaseView, normalizeDatabaseViews } from '../databaseViews/databaseViews';
import { computeRollup, resolveRollupLinkedNotes } from './computeRollup';
import { normalizeRollupColumns } from './rollupModels';

function note(
  id: string,
  title: string,
  relations?: Record<string, string[]>,
  extras: Partial<NoteBase> = {},
): NoteBase {
  return {
    id,
    title,
    body: '',
    updatedAt: 0,
    folderId: null,
    deletedAt: null,
    relations,
    ...extras,
  };
}

describe('computeRollup', () => {
  let service: KnowledgeIndexService;
  let notes: NoteBase[];
  let notesById: Map<string, NoteBase>;

  beforeEach(() => {
    service = new KnowledgeIndexService();
    notes = [
      note('course-1', 'Japanese N1', undefined, { updatedAt: 1000 }),
      note('lecture-1', 'Lecture 1', { course: ['course-1'] }, {
        updatedAt: 2000,
        properties: { hours: '2' },
      }),
      note('lecture-2', 'Lecture 2', { course: ['course-1'] }, {
        updatedAt: 3000,
        properties: { hours: '3' },
      }),
      note('lecture-3', 'Lecture 3', { course: ['course-1'] }, {
        updatedAt: 1500,
        properties: { hours: '1' },
      }),
    ];
    notesById = new Map(notes.map(n => [n.id, n]));
    service.buildFromNotes(notes);
  });

  it('counts incoming relations', () => {
    const value = computeRollup(notes[0], {
      relationKey: 'course',
      function: 'count',
    }, service, notesById);
    expect(value.raw).toBe(3);
    expect(value.display).toBe('3');
  });

  it('lists linked note titles', () => {
    const value = computeRollup(notes[0], {
      relationKey: 'course',
      function: 'list',
    }, service, notesById);
    expect(value.display).toBe('Lecture 1, Lecture 2, Lecture 3');
  });

  it('sums numeric target fields', () => {
    const value = computeRollup(notes[0], {
      relationKey: 'course',
      function: 'sum',
      targetField: 'hours',
    }, service, notesById);
    expect(value.raw).toBe(6);
    expect(value.display).toBe('6');
  });

  it('finds latest updatedAt among linked notes', () => {
    const value = computeRollup(notes[0], {
      relationKey: 'course',
      function: 'latest',
      targetField: 'updatedAt',
    }, service, notesById);
    expect(value.raw).toBe(3000);
    expect(value.display).not.toBe('—');
  });

  it('picks first and last linked notes by title', () => {
    const first = computeRollup(notes[0], {
      relationKey: 'course',
      function: 'first',
      sortBy: 'title',
    }, service, notesById);
    const last = computeRollup(notes[0], {
      relationKey: 'course',
      function: 'last',
      sortBy: 'title',
    }, service, notesById);
    expect(first.display).toBe('Lecture 1');
    expect(last.display).toBe('Lecture 3');
  });

  it('updates counts when relations change incrementally', () => {
    service.updateNote(note('lecture-4', 'Lecture 4', { course: ['course-1'] }));
    notesById.set('lecture-4', note('lecture-4', 'Lecture 4', { course: ['course-1'] }));
    const value = computeRollup(notes[0], {
      relationKey: 'course',
      function: 'count',
    }, service, notesById);
    expect(value.raw).toBe(4);
  });

  it('excludes missing targets from count by default', () => {
    service.updateNote({ ...notes[0], deletedAt: Date.now() });
    const linked = resolveRollupLinkedNotes('lecture-1', {
      relationKey: 'course',
      direction: 'outgoing',
      function: 'count',
    }, service);
    expect(linked.filter(item => item.missing)).toHaveLength(1);

    const value = computeRollup(notes[1], {
      relationKey: 'course',
      direction: 'outgoing',
      function: 'count',
    }, service, notesById);
    expect(value.raw).toBe(0);
    expect(value.missingTargets).toBe(1);
  });

  it('remains rename-safe via title resolution', () => {
    service.updateNote(note('lecture-1', 'Renamed Lecture', { course: ['course-1'] }, {
      updatedAt: 2000,
      properties: { hours: '2' },
    }));
    notesById.set('lecture-1', note('lecture-1', 'Renamed Lecture', { course: ['course-1'] }, {
      updatedAt: 2000,
      properties: { hours: '2' },
    }));
    const value = computeRollup(notes[0], {
      relationKey: 'course',
      function: 'list',
    }, service, notesById);
    expect(value.display).toContain('Renamed Lecture');
  });
});

describe('database rollup columns', () => {
  it('persists rollup definitions in database view config', () => {
    const tableConfig = defaultTablePresentationConfig();
    const view = withPresentationDefaults({
      id: 'db-1',
      name: 'Courses',
      query: 'tag:course',
      presentation: 'table',
      presentationConfig: tableConfig,
      columns: tableConfig.columns,
      sort: tableConfig.sort,
    });

    const next = addDatabaseViewRollupDefinition(view, 'lectureCount', {
      relationKey: 'course',
      function: 'count',
    }, 'Lecture Count');

    const table = next.presentationConfig;
    expect(table.type).toBe('table');
    if (table.type === 'table') {
      expect(table.rollupColumns).toHaveLength(1);
      expect(table.rollupColumns?.[0].rollup.function).toBe('count');
    }
  });

  it('round-trips rollup columns through localStorage', () => {
    const views = normalizeDatabaseViews([
      addDatabaseViewRollupDefinition(
        createDatabaseView([], 'Courses', 'tag:course')[0],
        'lectureCount',
        { relationKey: 'course', function: 'count' },
      ),
    ]);
    saveDatabaseViews(views);
    const loaded = loadDatabaseViews();
    expect(normalizeRollupColumns(
      loaded[0]?.presentationConfig.type === 'table'
        ? loaded[0].presentationConfig.rollupColumns
        : [],
    )).toHaveLength(1);
    expect(localStorage.getItem(DATABASE_VIEWS_KEY)).toContain('lectureCount');
  });

  it('renders rollup values in database table cells', () => {
    const service = new KnowledgeIndexService();
    const notes = [
      note('course-1', 'Japanese N1'),
      note('lecture-1', 'Lecture 1', { course: ['course-1'] }),
      note('lecture-2', 'Lecture 2', { course: ['course-1'] }),
    ];
    service.buildFromNotes(notes);
    const notesById = new Map(notes.map(n => [n.id, n]));
    const column = {
      key: 'lectureCount',
      visible: true,
      rollup: { relationKey: 'course', function: 'count' as const },
    };

    expect(getDatabaseRollupCellValue(notes[0], column, service, notesById)).toBe('2');
  });

  it('removes rollup columns from view config', () => {
    const seed = createDatabaseView([], 'Courses', 'tag:course')[0];
    let view = addDatabaseViewRollupDefinition(
      seed,
      'lectureCount',
      { relationKey: 'course', function: 'count' },
    );
    view = removeDatabaseViewRollupColumn(view, 'lectureCount');
    const table = view.presentationConfig;
    if (table.type === 'table') {
      expect(table.rollupColumns).toEqual([]);
    }
  });
});

describe('rollup normalization', () => {
  it('defaults direction to incoming and rejects phase 2 functions', () => {
    expect(normalizeRollupColumns([
      {
        key: 'lectureCount',
        visible: true,
        rollup: { relationKey: 'course', function: 'count' },
      },
      {
        key: 'bad',
        visible: true,
        rollup: { relationKey: 'course', function: 'average' },
      },
    ])).toHaveLength(1);
  });
});
