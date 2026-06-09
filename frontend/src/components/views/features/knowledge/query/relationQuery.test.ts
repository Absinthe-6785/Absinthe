import { describe, it, expect, beforeEach } from 'vitest';
import type { NoteBase } from '../../../noteUtils';
import { KnowledgeIndexService } from '../KnowledgeIndexService';
import { setProperty } from '../properties/noteProperties';
import { setTags } from '../tags/noteTags';
import { filterByRuleCollection } from '../collections/filterByRuleCollection';
import { isValidRuleCollectionQuery } from '../collections/ruleCollections';
import { filterByDatabaseView } from '../databaseViews/filterByDatabaseView';
import { isValidDatabaseViewQuery } from '../databaseViews/databaseViews';
import { defaultTablePresentationConfig } from '../databaseViews/databasePresentationConfig';
import { isValidSavedViewQuery } from '../views/savedViews';
import { evaluateQuery, evaluateQueryString } from './evaluateQuery';
import { filterNotes } from './filterNotes';
import { formatParsedQuery, isKnowledgeQuery, parseQuery, tokenizeQuery } from './parseQuery';

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

describe('parseQuery relation clauses', () => {
  it('parses hasRelation clauses', () => {
    expect(parseQuery('hasRelation:course')).toEqual({
      clauses: [{ type: 'hasRelation', propertyKey: 'course' }],
    });
  });

  it('parses linkedTo with quoted titles', () => {
    expect(parseQuery('linkedTo:"Japanese N1"')).toEqual({
      clauses: [{ type: 'linkedTo', title: 'Japanese N1' }],
    });
  });

  it('parses relation:key:title clauses', () => {
    expect(parseQuery('relation:course:"Japanese N1"')).toEqual({
      clauses: [{ type: 'relation', propertyKey: 'course', title: 'Japanese N1' }],
    });
  });

  it('tokenizes quoted relation clauses without splitting on spaces', () => {
    expect(tokenizeQuery('relation:course:"Japanese N1" tag:japanese')).toEqual([
      'relation:course:"Japanese N1"',
      'tag:japanese',
    ]);
  });

  it('parses AND combinations with relation clauses', () => {
    expect(parseQuery('tag:japanese status:active relation:course:"N1"')).toEqual({
      clauses: [
        { type: 'tag', value: 'japanese' },
        { type: 'property', key: 'status', value: 'active' },
        { type: 'relation', propertyKey: 'course', title: 'N1' },
      ],
    });
  });

  it('accepts case-insensitive relation clause keys', () => {
    expect(parseQuery('HasRelation:Course linkedTo:"Japanese N1"')).toEqual({
      clauses: [
        { type: 'hasRelation', propertyKey: 'Course' },
        { type: 'linkedTo', title: 'Japanese N1' },
      ],
    });
  });

  it('returns an error for invalid relation syntax', () => {
    expect(parseQuery('relation:course').error).toBeTruthy();
  });

  it('formats relation clauses for display', () => {
    expect(formatParsedQuery(parseQuery('hasRelation:course linkedTo:"Japanese N1"'))).toBe(
      'hasRelation:course linkedTo:"Japanese N1"',
    );
  });

  it('detects knowledge query syntax with relation clauses', () => {
    expect(isKnowledgeQuery('relation:course:"Japanese N1" tag:japanese')).toBe(true);
  });
});

describe('evaluateQuery relation clauses', () => {
  let service: KnowledgeIndexService;
  let notes: NoteBase[];

  beforeEach(() => {
    service = new KnowledgeIndexService();
    notes = [
      setTags(setProperty(note('course-1', 'Japanese N1'), 'status', 'active'), ['japanese']),
      setTags(note('lecture-1', 'Lecture 1', { course: ['course-1'] }), ['japanese']),
      setTags(note('lecture-2', 'Lecture 2', { course: ['course-1'], project: ['course-1'] }), ['japanese']),
      note('lecture-3', 'Lecture 3', { project: ['course-1'] }),
    ];
    service.buildFromNotes(notes);
  });

  it('filters by hasRelation using outgoing relation key index', () => {
    const ids = evaluateQuery(service, parseQuery('hasRelation:course'));
    expect([...ids!].sort()).toEqual(['lecture-1', 'lecture-2']);
  });

  it('filters by linkedTo using title resolution and incoming index', () => {
    const ids = evaluateQuery(service, parseQuery('linkedTo:"Japanese N1"'));
    expect([...ids!].sort()).toEqual(['lecture-1', 'lecture-2', 'lecture-3']);
  });

  it('filters by relation:key:title', () => {
    const ids = evaluateQuery(service, parseQuery('relation:course:"Japanese N1"'));
    expect([...ids!].sort()).toEqual(['lecture-1', 'lecture-2']);
  });

  it('matches relation queries case-insensitively', () => {
    const ids = evaluateQuery(service, parseQuery('relation:Course:"japanese n1"'));
    expect([...ids!].sort()).toEqual(['lecture-1', 'lecture-2']);
  });

  it('intersects relation clauses with tag and property clauses', () => {
    const ids = evaluateQuery(service, parseQuery('tag:japanese hasRelation:course status:active'));
    expect([...ids!]).toEqual([]);
  });

  it('intersects relation and property clauses on source notes', () => {
    notes[1] = setProperty(notes[1], 'status', 'active');
    service.updateNote(notes[1]);

    const ids = evaluateQuery(service, parseQuery('tag:japanese hasRelation:course status:active'));
    expect([...ids!]).toEqual(['lecture-1']);
  });

  it('remains rename-safe after target title changes', () => {
    service.updateNote(note('course-1', 'Renamed Course'));
    const ids = evaluateQuery(service, parseQuery('relation:course:"Renamed Course"'));
    expect([...ids!].sort()).toEqual(['lecture-1', 'lecture-2']);
  });

  it('returns empty when target title cannot be resolved after delete', () => {
    service.updateNote(note('course-1', 'Japanese N1', undefined, { deletedAt: Date.now() }));
    expect(evaluateQuery(service, parseQuery('linkedTo:"Japanese N1"'))?.size).toBe(0);
    expect(evaluateQuery(service, parseQuery('relation:course:"Japanese N1"'))?.size).toBe(0);
    expect([...evaluateQuery(service, parseQuery('hasRelation:course'))!].sort()).toEqual(['lecture-1', 'lecture-2']);
  });

  it('updates relation query results incrementally', () => {
    service.updateNote(note('lecture-4', 'Lecture 4', { course: ['course-1'] }));
    const ids = evaluateQueryString(service, 'relation:course:"Japanese N1"').noteIds;
    expect([...ids!].sort()).toEqual(['lecture-1', 'lecture-2', 'lecture-4']);
  });
});

describe('filterNotes relation integration', () => {
  let service: KnowledgeIndexService;
  let notes: NoteBase[];

  beforeEach(() => {
    service = new KnowledgeIndexService();
    notes = [
      note('course-1', 'Japanese N1'),
      note('lecture-1', 'Lecture 1', { course: ['course-1'] }),
    ];
    service.buildFromNotes(notes);
  });

  it('filters notes through the existing query pipeline', () => {
    const result = filterNotes(notes, service, 'hasRelation:course');
    expect(result.usedKnowledgeQuery).toBe(true);
    expect(result.notes.map(n => n.id)).toEqual(['lecture-1']);
  });
});

describe('saved view, rule collection, and database view integration', () => {
  let service: KnowledgeIndexService;
  let notes: NoteBase[];

  beforeEach(() => {
    service = new KnowledgeIndexService();
    notes = [
      note('course-1', 'Japanese N1'),
      note('lecture-1', 'Lecture 1', { course: ['course-1'] }),
      note('lecture-2', 'Lecture 2'),
    ];
    service.buildFromNotes(notes);
  });

  it('accepts relation queries in saved views', () => {
    expect(isValidSavedViewQuery('relation:course:"Japanese N1"')).toBe(true);
  });

  it('accepts relation queries in rule collections', () => {
    expect(isValidRuleCollectionQuery('hasRelation:course')).toBe(true);
  });

  it('accepts relation queries in database views', () => {
    expect(isValidDatabaseViewQuery('linkedTo:"Japanese N1"')).toBe(true);
  });

  it('filters rule collections by relation query', () => {
    const collection = { id: '1', name: 'Course Lectures', query: 'relation:course:"Japanese N1"' };
    const result = filterByRuleCollection(notes, service, collection);
    expect(result.notes.map(n => n.id)).toEqual(['lecture-1']);
  });

  it('filters database views by relation query', () => {
    const tableConfig = defaultTablePresentationConfig();
    const view = {
      id: 'db-1',
      name: 'Linked Lectures',
      query: 'hasRelation:course',
      presentation: 'table' as const,
      presentationConfig: tableConfig,
      columns: tableConfig.columns,
      sort: tableConfig.sort,
    };
    const result = filterByDatabaseView(notes, service, view);
    expect(result.notes.map(n => n.id)).toEqual(['lecture-1']);
  });
});
