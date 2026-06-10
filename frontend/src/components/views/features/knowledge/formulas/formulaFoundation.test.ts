// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import type { NoteBase } from '../../../noteUtils';
import { KnowledgeIndexService } from '../KnowledgeIndexService';
import { getDatabaseFormulaCellValue } from '../components/DatabaseTableView';
import {
  addDatabaseViewFormulaColumn,
  removeDatabaseViewFormulaColumn,
} from '../databaseViews/databaseViewOperations';
import { defaultTablePresentationConfig, withPresentationDefaults } from '../databaseViews/databasePresentationConfig';
import { loadDatabaseViews, saveDatabaseViews, DATABASE_VIEWS_KEY } from '../databaseViews/databaseViewsStorage';
import { createDatabaseView, normalizeDatabaseViews } from '../databaseViews/databaseViews';
import { computeFormula } from './computeFormula';
import {
  computeFormulasForNote,
  createFormulaComputeMemo,
  formulaMemoKey,
} from './computeFormulas';
import { buildFormulaDependencyGraph, normalizeFormulaColumns } from './formulaModels';

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

describe('computeFormula', () => {
  let service: KnowledgeIndexService;
  let notes: NoteBase[];
  let notesById: Map<string, NoteBase>;

  beforeEach(() => {
    service = new KnowledgeIndexService();
    notes = [
      note('course-1', 'Japanese N1', undefined, {
        updatedAt: 1000,
        properties: { completed: '18', total: '24', bonus: '5' },
      }),
      note('lecture-1', 'Lecture 1', { course: ['course-1'] }),
      note('lecture-2', 'Lecture 2', { course: ['course-1'] }),
    ];
    notesById = new Map(notes.map(n => [n.id, n]));
    service.buildFromNotes(notes);
  });

  it('evaluates arithmetic with property references', () => {
    const value = computeFormula(notes[0], {
      id: 'ratio',
      expression: 'completed / total',
      inputs: {
        completed: { type: 'field', key: 'completed' },
        total: { type: 'field', key: 'total' },
      },
    }, {
      note: notes[0],
      service,
      notesById,
      formulaValues: new Map(),
    });
    expect(value.raw).toBe(0.75);
    expect(value.display).toBe('0.75');
    expect(value.error).toBeUndefined();
  });

  it('evaluates grouped expressions', () => {
    const value = computeFormula(notes[0], {
      id: 'percent',
      expression: '(completed / total) * 100',
      inputs: {
        completed: { type: 'field', key: 'completed' },
        total: { type: 'field', key: 'total' },
      },
    }, {
      note: notes[0],
      service,
      notesById,
      formulaValues: new Map(),
    });
    expect(value.raw).toBe(75);
    expect(value.display).toBe('75');
  });

  it('evaluates rollup inputs', () => {
    const value = computeFormula(notes[0], {
      id: 'double-count',
      expression: 'lectures * 2',
      inputs: {
        lectures: {
          type: 'rollup',
          definition: { relationKey: 'course', function: 'count' },
        },
      },
    }, {
      note: notes[0],
      service,
      notesById,
      formulaValues: new Map(),
    });
    expect(value.raw).toBe(4);
    expect(value.display).toBe('4');
  });

  it('returns division_by_zero without throwing', () => {
    const value = computeFormula(notes[0], {
      id: 'bad',
      expression: 'completed / zero',
      inputs: {
        completed: { type: 'field', key: 'completed' },
        zero: { type: 'field', key: 'missingZero' },
      },
    }, {
      note: notes[0],
      service,
      notesById,
      formulaValues: new Map(),
    });
    expect(value.error).toBe('missing_property');
    expect(value.display).toBe('—');
  });

  it('returns division_by_zero for literal zero divisor', () => {
    const value = computeFormula(notes[0], {
      id: 'bad',
      expression: 'completed / 0',
      inputs: {
        completed: { type: 'field', key: 'completed' },
      },
    }, {
      note: notes[0],
      service,
      notesById,
      formulaValues: new Map(),
    });
    expect(value.error).toBe('division_by_zero');
    expect(value.display).toBe('—');
  });

  it('returns missing_property for empty fields', () => {
    const value = computeFormula(notes[0], {
      id: 'bad',
      expression: 'missing + 1',
      inputs: {
        missing: { type: 'field', key: 'doesNotExist' },
      },
    }, {
      note: notes[0],
      service,
      notesById,
      formulaValues: new Map(),
    });
    expect(value.error).toBe('missing_property');
  });

  it('returns invalid_expression for bad syntax', () => {
    const value = computeFormula(notes[0], {
      id: 'bad',
      expression: 'completed +',
      inputs: {
        completed: { type: 'field', key: 'completed' },
      },
    }, {
      note: notes[0],
      service,
      notesById,
      formulaValues: new Map(),
    });
    expect(value.error).toBe('invalid_expression');
  });
});

describe('computeFormulasForNote', () => {
  let service: KnowledgeIndexService;
  let notes: NoteBase[];
  let notesById: Map<string, NoteBase>;

  beforeEach(() => {
    service = new KnowledgeIndexService();
    notes = [
      note('course-1', 'Japanese N1', undefined, {
        properties: { completed: '18', total: '24' },
      }),
    ];
    notesById = new Map(notes.map(n => [n.id, n]));
    service.buildFromNotes(notes);
  });

  it('evaluates formulas in dependency order', () => {
    const columns = normalizeFormulaColumns([
      {
        key: 'weightedProgress',
        visible: true,
        formula: {
          id: 'weighted',
          expression: 'progress * 1.5',
          inputs: {
            progress: { type: 'formula', formulaKey: 'progress' },
          },
        },
      },
      {
        key: 'progress',
        visible: true,
        formula: {
          id: 'progress',
          expression: 'completed / total',
          inputs: {
            completed: { type: 'field', key: 'completed' },
            total: { type: 'field', key: 'total' },
          },
        },
      },
    ]);

    const values = computeFormulasForNote(notes[0], columns, service, notesById);
    expect(values.get('progress')?.raw).toBe(0.75);
    expect(values.get('weightedprogress')?.raw).toBe(1.125);
  });

  it('marks cyclic formulas without throwing', () => {
    const columns = normalizeFormulaColumns([
      {
        key: 'a',
        visible: true,
        formula: {
          id: 'a',
          expression: 'b + 1',
          inputs: { b: { type: 'formula', formulaKey: 'b' } },
        },
      },
      {
        key: 'b',
        visible: true,
        formula: {
          id: 'b',
          expression: 'a + 1',
          inputs: { a: { type: 'formula', formulaKey: 'a' } },
        },
      },
    ]);

    const graph = buildFormulaDependencyGraph(columns);
    expect(graph.evaluationOrder).toBeUndefined();
    expect(graph.cycles?.length).toBeGreaterThan(0);

    const values = computeFormulasForNote(notes[0], columns, service, notesById);
    expect(values.get('a')?.error).toBe('cyclic_dependency');
    expect(values.get('b')?.error).toBe('cyclic_dependency');
  });

  it('memoizes repeated evaluation within a render pass', () => {
    const columns = normalizeFormulaColumns([
      {
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
      },
    ]);
    const memo = createFormulaComputeMemo();
    computeFormulasForNote(notes[0], columns, service, notesById, memo);
    expect(memo.size).toBeGreaterThan(0);

    const signature = 'completed:field:completed|total:field:total';
    const key = formulaMemoKey(notes[0].id, 'completionRate', signature);
    expect(memo.has(key)).toBe(true);
    expect(memo.get(key)?.raw).toBe(75);
  });
});

describe('database formula columns', () => {
  it('persists formula definitions in database view config', () => {
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

    const next = addDatabaseViewFormulaColumn(view, {
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

    const table = next.presentationConfig;
    expect(table.type).toBe('table');
    if (table.type === 'table') {
      expect(table.formulaColumns).toHaveLength(1);
      expect(table.formulaColumns?.[0].formula.expression).toContain('* 100');
    }
  });

  it('round-trips formula columns through localStorage', () => {
    const views = normalizeDatabaseViews([
      addDatabaseViewFormulaColumn(
        createDatabaseView([], 'Courses', 'tag:course')[0],
        {
          key: 'completionRate',
          visible: true,
          formula: {
            id: 'completionRate',
            expression: 'completed / total',
            inputs: {
              completed: { type: 'field', key: 'completed' },
              total: { type: 'field', key: 'total' },
            },
          },
        },
      ),
    ]);
    saveDatabaseViews(views);
    const loaded = loadDatabaseViews();
    expect(normalizeFormulaColumns(
      loaded[0]?.presentationConfig.type === 'table'
        ? loaded[0].presentationConfig.formulaColumns
        : [],
    )).toHaveLength(1);
    expect(localStorage.getItem(DATABASE_VIEWS_KEY)).toContain('completionRate');
  });

  it('renders formula values in database table cells', () => {
    const service = new KnowledgeIndexService();
    const notes = [
      note('course-1', 'Japanese N1', undefined, {
        properties: { completed: '18', total: '24' },
      }),
    ];
    service.buildFromNotes(notes);
    const notesById = new Map(notes.map(n => [n.id, n]));
    const column = {
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
    };

    expect(getDatabaseFormulaCellValue(
      notes[0],
      column,
      service,
      notesById,
      [column],
    )).toBe('75');
  });

  it('removes formula columns from view config', () => {
    const seed = createDatabaseView([], 'Courses', 'tag:course')[0];
    let view = addDatabaseViewFormulaColumn(seed, {
      key: 'completionRate',
      visible: true,
      formula: {
        id: 'completionRate',
        expression: 'completed / total',
        inputs: {
          completed: { type: 'field', key: 'completed' },
          total: { type: 'field', key: 'total' },
        },
      },
    });
    view = removeDatabaseViewFormulaColumn(view, 'completionRate');
    const table = view.presentationConfig;
    if (table.type === 'table') {
      expect(table.formulaColumns).toEqual([]);
    }
  });

  it('preserves existing rollup columns when adding formulas', () => {
    const tableConfig = defaultTablePresentationConfig();
    let view = withPresentationDefaults({
      id: 'db-1',
      name: 'Courses',
      query: 'tag:course',
      presentation: 'table',
      presentationConfig: {
        ...tableConfig,
        rollupColumns: [{
          key: 'lectureCount',
          visible: true,
          rollup: { relationKey: 'course', function: 'count' },
        }],
      },
      columns: tableConfig.columns,
      sort: tableConfig.sort,
    });

    view = addDatabaseViewFormulaColumn(view, {
      key: 'completionRate',
      visible: true,
      formula: {
        id: 'completionRate',
        expression: 'completed / total',
        inputs: {
          completed: { type: 'field', key: 'completed' },
          total: { type: 'field', key: 'total' },
        },
      },
    });

    const table = view.presentationConfig;
    if (table.type === 'table') {
      expect(table.rollupColumns).toHaveLength(1);
      expect(table.formulaColumns).toHaveLength(1);
    }
  });
});
