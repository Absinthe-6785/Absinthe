// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import type { NoteBase } from '../../../noteUtils';
import { KnowledgeIndexService } from '../KnowledgeIndexService';
import {
  addDatabaseViewFilterCondition,
  moveDatabaseViewFilterCondition,
  removeDatabaseViewFilterCondition,
  setDatabaseViewFilterConditions,
  setDatabaseViewQuery,
  setDatabaseViewVisualFilters,
  updateDatabaseViewFilterCondition,
} from './databaseViewOperations';
import { defaultTablePresentationConfig, withPresentationDefaults } from './databasePresentationConfig';
import { filterByDatabaseView } from './filterByDatabaseView';
import { prepareDatabaseViewRows } from './prepareDatabaseViewRows';
import { resolveDatabaseViewEffectiveQuery } from './resolveDatabaseViewQuery';
import { createDatabaseView, normalizeDatabaseViews } from './databaseViews';
import { loadDatabaseViews, saveDatabaseViews } from './databaseViewsStorage';
import { filterNotes } from '../query/filterNotes';
import {
  compileVisualFilters,
  mergeQueryWithVisualFilter,
  visualFilterFromConditions,
} from '../query/visualFilterModels';
import { parseQuery } from '../query/parseQuery';
import type { DatabaseView } from './databaseViewModels';

function note(
  id: string,
  title: string,
  extras: Partial<NoteBase> = {},
): NoteBase {
  return {
    id,
    title,
    body: '',
    updatedAt: 0,
    folderId: null,
    deletedAt: null,
    ...extras,
  };
}

function baseView(overrides: Partial<DatabaseView> = {}): DatabaseView {
  const tableConfig = defaultTablePresentationConfig();
  return withPresentationDefaults({
    id: 'db-1',
    name: 'Study',
    query: '',
    presentation: 'table',
    presentationConfig: tableConfig,
    columns: tableConfig.columns,
    sort: tableConfig.sort,
    ...overrides,
  });
}

describe('compileVisualFilters', () => {
  it('compiles property, tag, formula, relation, and metadata filters', () => {
    const query = compileVisualFilters({
      groups: [{
        logic: 'and',
        conditions: [
          { kind: 'property', field: 'status', operator: '=', value: 'active' },
          { kind: 'tag', value: 'japanese' },
          { kind: 'formula', field: 'completionRate', operator: '>', value: 80 },
          { kind: 'relation', field: 'course', operator: '=', value: 'Japanese N1' },
          { kind: 'metadata', field: 'updatedAt', operator: '>', value: '2026-01-01' },
        ],
      }],
    });

    expect(query).toContain('status:active');
    expect(query).toContain('tag:japanese');
    expect(query).toContain('formula:completionRate>80');
    expect(query).toContain('relation:course:"Japanese N1"');
    expect(query).toContain('meta:updatedAt>2026-01-01');
    expect(parseQuery(query).error).toBeUndefined();
  });

  it('compiles property inequality via prop: tokens', () => {
    const query = compileVisualFilters({
      groups: [{
        logic: 'and',
        conditions: [
          { kind: 'property', field: 'status', operator: '!=', value: 'draft' },
        ],
      }],
    });
    expect(query).toBe('prop:status!=draft');
    expect(parseQuery(query).error).toBeUndefined();
  });
});

describe('filter operations', () => {
  it('adds, updates, removes, and reorders persisted filters', () => {
    let view = baseView();
    view = addDatabaseViewFilterCondition(view, {
      kind: 'property',
      field: 'status',
      operator: '=',
      value: 'active',
    });
    view = addDatabaseViewFilterCondition(view, {
      kind: 'property',
      field: 'priority',
      operator: '=',
      value: 'high',
    });

    const table = withPresentationDefaults(view).presentationConfig;
    expect(table.type).toBe('table');
    if (table.type !== 'table') return;
    expect(table.visualFilters?.groups[0].conditions).toHaveLength(2);

    view = updateDatabaseViewFilterCondition(view, 1, {
      kind: 'tag',
      value: 'japanese',
    });
    view = moveDatabaseViewFilterCondition(view, 1, 0);
    const moved = getTableConfigFrom(view);
    expect(moved.visualFilters?.groups[0].conditions[0].kind).toBe('tag');

    view = removeDatabaseViewFilterCondition(view, 1);
    expect(getTableConfigFrom(view).visualFilters?.groups[0].conditions).toHaveLength(1);
  });
});

function getTableConfigFrom(view: DatabaseView) {
  const config = withPresentationDefaults(view).presentationConfig;
  if (config.type !== 'table') throw new Error('expected table');
  return config;
}

describe('resolveDatabaseViewEffectiveQuery', () => {
  it('merges base query, persisted filters, and session overlay', () => {
    let view = setDatabaseViewQuery(baseView(), 'status:active');
    view = setDatabaseViewFilterConditions(view, [
      { kind: 'tag', value: 'japanese' },
    ]);

    const session = visualFilterFromConditions([
      { kind: 'property', field: 'priority', operator: '=', value: 'high' },
    ]);

    expect(resolveDatabaseViewEffectiveQuery(view)).toBe('status:active tag:japanese');
    expect(resolveDatabaseViewEffectiveQuery(view, { sessionFilter: session! })).toBe(
      'status:active tag:japanese priority:high',
    );
  });
});

describe('query equivalence through filterNotes', () => {
  let service: KnowledgeIndexService;
  let notes: NoteBase[];

  beforeEach(() => {
    service = new KnowledgeIndexService();
    notes = [
      note('a', 'Alpha', {
        properties: { tags: 'japanese', status: 'active', priority: 'high' },
        updatedAt: new Date('2026-06-01').getTime(),
      }),
      note('b', 'Beta', {
        properties: { tags: 'japanese', status: 'active', priority: 'low' },
        updatedAt: new Date('2025-01-01').getTime(),
      }),
      note('c', 'Gamma', {
        properties: { tags: 'english', status: 'draft', priority: 'high' },
        updatedAt: new Date('2026-06-01').getTime(),
      }),
    ];
    service.buildFromNotes(notes);
  });

  it('filters properties and tags via compiled visual filters', () => {
    const view = setDatabaseViewFilterConditions(baseView(), [
      { kind: 'tag', value: 'japanese' },
      { kind: 'property', field: 'status', operator: '=', value: 'active' },
    ]);

    const viaView = filterByDatabaseView(notes, service, view).notes;
    const manual = filterNotes(
      notes,
      service,
      'tag:japanese status:active',
    ).notes;

    expect(viaView.map(n => n.id)).toEqual(manual.map(n => n.id));
    expect(viaView.map(n => n.id)).toEqual(['a', 'b']);
  });

  it('filters metadata via compiled query engine path', () => {
    const query = compileVisualFilters({
      groups: [{
        logic: 'and',
        conditions: [
          { kind: 'metadata', field: 'updatedAt', operator: '>', value: '2026-01-01' },
        ],
      }],
    });

    const filtered = filterNotes(notes, service, query).notes;
    expect(filtered.map(n => n.id)).toEqual(['a', 'c']);
  });

  it('applies session filters without persisting them', () => {
    let view = setDatabaseViewQuery(baseView(), 'tag:japanese');
    const session = visualFilterFromConditions([
      { kind: 'property', field: 'priority', operator: '=', value: 'high' },
    ]);

    const filtered = filterByDatabaseView(notes, service, view, {
      sessionFilter: session,
    }).notes;

    expect(getTableConfigFrom(view).visualFilters).toBeUndefined();
    expect(filtered.map(n => n.id)).toEqual(['a']);
  });

  it('uses prepareDatabaseViewRows with effective query', () => {
    const view = setDatabaseViewFilterConditions(
      setDatabaseViewQuery(baseView(), 'tag:japanese'),
      [{ kind: 'property', field: 'priority', operator: '=', value: 'high' }],
    );
    const rows = prepareDatabaseViewRows(view, notes, service);
    expect(rows.map(n => n.id)).toEqual(['a']);
  });
});

describe('persistence and backward compatibility', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('persists visualFilters on table config', () => {
    const view = setDatabaseViewVisualFilters(
      setDatabaseViewQuery(baseView(), 'tag:japanese'),
      {
        groups: [{
          logic: 'and',
          conditions: [{ kind: 'tag', value: 'study' }],
        }],
      },
    );
    saveDatabaseViews([view]);
    const loaded = loadDatabaseViews()[0];
    const table = getTableConfigFrom(loaded);
    expect(table.visualFilters?.groups[0].conditions[0]).toEqual({
      kind: 'tag',
      value: 'study',
    });
  });

  it('loads legacy views without visualFilters', () => {
    const views = normalizeDatabaseViews([
      {
        id: '1',
        name: 'Legacy',
        query: 'tag:legacy',
        presentation: 'table',
      },
    ]);
    expect(getTableConfigFrom(views[0]).visualFilters).toBeUndefined();
  });

  it('merges manual query strings equivalently', () => {
    const model = visualFilterFromConditions([
      { kind: 'property', field: 'status', operator: '=', value: 'active' },
      { kind: 'formula', field: 'progress', operator: '>', value: 80 },
    ]);
    expect(mergeQueryWithVisualFilter('tag:japanese', model!)).toBe(
      'tag:japanese status:active formula:progress>80',
    );
  });
});
