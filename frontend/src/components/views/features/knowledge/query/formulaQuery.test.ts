// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import type { NoteBase } from '../../../noteUtils';
import { KnowledgeIndexService } from '../KnowledgeIndexService';
import { setProperty } from '../properties/noteProperties';
import { setTags } from '../tags/noteTags';
import { filterByRuleCollection } from '../collections/filterByRuleCollection';
import { isValidRuleCollectionQuery } from '../collections/ruleCollections';
import { addDatabaseViewFormulaColumn } from '../databaseViews/databaseViewOperations';
import { filterByDatabaseView } from '../databaseViews/filterByDatabaseView';
import { createDatabaseView } from '../databaseViews/databaseViews';
import { withPresentationDefaults } from '../databaseViews/databasePresentationConfig';
import { buildFormulaQueryCatalog } from '../formulas/formulaQueryCatalog';
import { isValidSavedViewQuery } from '../views/savedViews';
import { evaluateQuery, evaluateQueryString } from './evaluateQuery';
import { filterNotes } from './filterNotes';
import { formatParsedQuery, isKnowledgeQuery, parseQuery } from './parseQuery';

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

const formulaCatalog = [
  {
    key: 'completionRate',
    visible: true,
    formula: {
      id: 'completionRate',
      expression: '(completed / total) * 100',
      inputs: {
        completed: { type: 'field' as const, key: 'completed' },
        total: { type: 'field' as const, key: 'total' },
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
        completed: { type: 'field' as const, key: 'completed' },
        total: { type: 'field' as const, key: 'total' },
      },
    },
  },
  {
    key: 'weightedProgress',
    visible: true,
    formula: {
      id: 'weightedProgress',
      expression: 'progress * 1.5',
      inputs: {
        progress: { type: 'formula' as const, formulaKey: 'progress' },
      },
    },
  },
  {
    key: 'lectureCount',
    visible: true,
    formula: {
      id: 'lectureCount',
      expression: 'count * 2',
      inputs: {
        count: {
          type: 'rollup' as const,
          definition: { relationKey: 'course', function: 'count' as const },
        },
      },
    },
  },
];

describe('parseQuery formula clauses', () => {
  it('parses formula predicates with comparison operators', () => {
    expect(parseQuery('formula:completionRate>80')).toEqual({
      clauses: [{ type: 'formula', key: 'completionRate', operator: '>', value: 80 }],
    });
    expect(parseQuery('formula:score>=100')).toEqual({
      clauses: [{ type: 'formula', key: 'score', operator: '>=', value: 100 }],
    });
    expect(parseQuery('formula:progress<50')).toEqual({
      clauses: [{ type: 'formula', key: 'progress', operator: '<', value: 50 }],
    });
    expect(parseQuery('formula:efficiency=100')).toEqual({
      clauses: [{ type: 'formula', key: 'efficiency', operator: '=', value: 100 }],
    });
    expect(parseQuery('formula:score!=0')).toEqual({
      clauses: [{ type: 'formula', key: 'score', operator: '!=', value: 0 }],
    });
    expect(parseQuery('formula:score<=75')).toEqual({
      clauses: [{ type: 'formula', key: 'score', operator: '<=', value: 75 }],
    });
  });

  it('parses formula clauses combined with indexed clauses', () => {
    expect(parseQuery('tag:japanese formula:completionRate>80')).toEqual({
      clauses: [
        { type: 'tag', value: 'japanese' },
        { type: 'formula', key: 'completionRate', operator: '>', value: 80 },
      ],
    });
  });

  it('round-trips formula clauses through formatParsedQuery', () => {
    const parsed = parseQuery('status:active formula:completionRate>80');
    expect(formatParsedQuery(parsed)).toBe('status:active formula:completionRate>80');
  });

  it('rejects invalid formula syntax', () => {
    expect(parseQuery('formula:bad').error).toBeTruthy();
    expect(parseQuery('formula:completionRate').error).toBeTruthy();
  });

  it('accepts formula queries as valid knowledge queries', () => {
    expect(isKnowledgeQuery('formula:completionRate>80')).toBe(true);
    expect(isValidSavedViewQuery('formula:progress<50')).toBe(true);
    expect(isValidRuleCollectionQuery('tag:work formula:progress<50')).toBe(true);
  });
});

describe('evaluateQuery formula clauses', () => {
  let service: KnowledgeIndexService;
  let notes: NoteBase[];

  beforeEach(() => {
    service = new KnowledgeIndexService();
    notes = [
      setTags(note('course-a', 'Course A', { properties: { completed: '90', total: '100' } }), ['japanese']),
      setTags(note('course-b', 'Course B', { properties: { completed: '60', total: '100' } }), ['japanese']),
      setTags(note('course-c', 'Course C', { properties: { completed: '18', total: '24' } }), ['japanese']),
      setTags(note('course-d', 'Course D', { properties: { completed: '0', total: '0' } }), ['japanese']),
    ];
    service.buildFromNotes(notes);
  });

  const context = () => ({ notes, formulaColumns: formulaCatalog });

  it('filters with > operator', () => {
    const ids = evaluateQuery(service, parseQuery('formula:completionRate>80'), context());
    expect([...ids!].sort()).toEqual(['course-a']);
  });

  it('filters with >= operator', () => {
    const ids = evaluateQuery(service, parseQuery('formula:completionRate>=75'), context());
    expect([...ids!].sort()).toEqual(['course-a', 'course-c']);
  });

  it('filters with < operator', () => {
    const ids = evaluateQuery(service, parseQuery('formula:progress<0.7'), context());
    expect([...ids!].sort()).toEqual(['course-b']);
  });

  it('filters with <= operator', () => {
    const ids = evaluateQuery(service, parseQuery('formula:progress<=0.75'), context());
    expect([...ids!].sort()).toEqual(['course-b', 'course-c']);
  });

  it('filters with = operator', () => {
    const ids = evaluateQuery(service, parseQuery('formula:completionRate=75'), context());
    expect([...ids!].sort()).toEqual(['course-c']);
  });

  it('filters with != operator', () => {
    const ids = evaluateQuery(service, parseQuery('formula:completionRate!=75'), context());
    expect([...ids!].sort()).toEqual(['course-a', 'course-b']);
  });

  it('combines tag and formula clauses with AND semantics', () => {
    const ids = evaluateQuery(
      service,
      parseQuery('tag:japanese formula:completionRate>80'),
      context(),
    );
    expect([...ids!].sort()).toEqual(['course-a']);
  });

  it('evaluates formula dependency chains', () => {
    const ids = evaluateQuery(service, parseQuery('formula:weightedProgress>1'), context());
    expect([...ids!].sort()).toEqual(['course-a', 'course-c']);
  });

  it('excludes notes when formula has error', () => {
    const ids = evaluateQuery(service, parseQuery('formula:completionRate>80'), context());
    expect(ids?.has('course-d')).toBe(false);
  });

  it('excludes all notes when formula key is missing from catalog', () => {
    const ids = evaluateQuery(service, parseQuery('formula:unknown>1'), context());
    expect([...ids!]).toEqual([]);
  });

  it('returns empty set when formula clauses present without notes context', () => {
    const ids = evaluateQuery(service, parseQuery('formula:completionRate>80'));
    expect([...ids!]).toEqual([]);
  });
});

describe('filterNotes formula integration', () => {
  let service: KnowledgeIndexService;
  let notes: NoteBase[];

  beforeEach(() => {
    service = new KnowledgeIndexService();
    notes = [
      note('course-a', 'Course A', { properties: { completed: '90', total: '100' } }),
      note('course-b', 'Course B', { properties: { completed: '50', total: '100' } }),
    ];
    service.buildFromNotes(notes);
  });

  it('filters notes through filterNotes with formula catalog', () => {
    const result = filterNotes(notes, service, 'formula:completionRate>80', {
      formulaColumns: formulaCatalog,
    });
    expect(result.notes.map(n => n.id)).toEqual(['course-a']);
  });
});

describe('rollup-backed formula queries', () => {
  it('filters using rollup-backed formulas', () => {
    const service = new KnowledgeIndexService();
    const notes = [
      note('course-1', 'Japanese N1'),
      note('lecture-1', 'Lecture 1', { relations: { course: ['course-1'] } }),
      note('lecture-2', 'Lecture 2', { relations: { course: ['course-1'] } }),
      note('course-2', 'Empty Course'),
    ];
    service.buildFromNotes(notes);

    const ids = evaluateQuery(
      service,
      parseQuery('formula:lectureCount>=4'),
      { notes, formulaColumns: formulaCatalog },
    );
    expect([...ids!]).toEqual(['course-1']);
  });
});

describe('saved views and rule collections', () => {
  it('supports formula queries in rule collections', () => {
    const service = new KnowledgeIndexService();
    const notes = [
      note('a', 'A', { properties: { completed: '90', total: '100' } }),
      note('b', 'B', { properties: { completed: '50', total: '100' } }),
    ];
    service.buildFromNotes(notes);

    const result = filterByRuleCollection(notes, service, {
      id: 'rc1',
      name: 'High completion',
      query: 'formula:completionRate>80',
    }, { formulaColumns: formulaCatalog });

    expect(result.notes.map(n => n.id)).toEqual(['a']);
  });
});

describe('database view formula queries', () => {
  it('uses database view formula columns for query evaluation', () => {
    const service = new KnowledgeIndexService();
    const notes = [
      note('a', 'A', { properties: { completed: '80', total: '100' } }),
      note('b', 'B', { properties: { completed: '40', total: '100' } }),
    ];
    service.buildFromNotes(notes);

    let view = createDatabaseView([], 'Courses', 'formula:completionRate>=80')[0];
    view = addDatabaseViewFormulaColumn(view, {
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
    view = withPresentationDefaults(view);

    const result = filterByDatabaseView(notes, service, view);
    expect(result.notes.map(n => n.id)).toEqual(['a']);
  });

  it('builds formula catalog from database views', () => {
    let view = createDatabaseView([], 'Courses', 'tag:course')[0];
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
    view = withPresentationDefaults(view);

    const catalog = buildFormulaQueryCatalog([view]);
    expect(catalog).toHaveLength(1);
    expect(catalog[0]?.key).toBe('completionRate');
  });
});

describe('backward compatibility', () => {
  it('preserves existing tag and property query behavior', () => {
    const service = new KnowledgeIndexService();
    const notes = [
      setTags(setProperty(note('a', 'A'), 'status', 'active'), ['japanese']),
      setTags(note('b', 'B'), ['japanese']),
    ];
    service.buildFromNotes(notes);

    expect([...evaluateQuery(service, parseQuery('tag:japanese status:active'), { notes })!])
      .toEqual(['a']);
  });

  it('evaluateQueryString works without formula context for indexed queries', () => {
    const service = new KnowledgeIndexService();
    service.buildFromNotes([setTags(note('a', 'A'), ['work'])]);
    const result = evaluateQueryString(service, 'tag:work');
    expect([...result.noteIds!]).toEqual(['a']);
  });
});
