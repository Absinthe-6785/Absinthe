import { describe, it, expect, beforeEach } from 'vitest';
import type { NoteBase } from '../../../noteUtils';
import { KnowledgeIndexService } from '../KnowledgeIndexService';
import { setProperty } from '../properties/noteProperties';
import { setTags } from '../tags/noteTags';
import { evaluateQuery, evaluateQueryString } from './evaluateQuery';
import { filterNotes } from './filterNotes';
import { formatParsedQuery, hasKnowledgeQuerySyntax, isKnowledgeQuery, parseQuery } from './parseQuery';

function note(id: string, title: string, body = ''): NoteBase {
  return { id, title, body, updatedAt: 0, folderId: null, deletedAt: null };
}

function withTags(id: string, title: string, tags: string[], body = ''): NoteBase {
  return setTags(note(id, title, body), tags);
}

function withProps(
  id: string,
  title: string,
  properties: Record<string, string>,
  body = '',
): NoteBase {
  let n = note(id, title, body);
  for (const [key, value] of Object.entries(properties)) {
    n = setProperty(n, key, value);
  }
  return n;
}

describe('parseQuery', () => {
  it('parses tag clauses', () => {
    expect(parseQuery('tag:japanese')).toEqual({
      clauses: [{ type: 'tag', value: 'japanese' }],
    });
  });

  it('parses property clauses', () => {
    expect(parseQuery('status:active')).toEqual({
      clauses: [{ type: 'property', key: 'status', value: 'active' }],
    });
  });

  it('parses AND combinations', () => {
    expect(parseQuery('tag:japanese status:active priority:high')).toEqual({
      clauses: [
        { type: 'tag', value: 'japanese' },
        { type: 'property', key: 'status', value: 'active' },
        { type: 'property', key: 'priority', value: 'high' },
      ],
    });
  });

  it('returns an error for invalid syntax', () => {
    const parsed = parseQuery('not-a-clause');
    expect(parsed.error).toBeTruthy();
    expect(parsed.clauses).toEqual([]);
  });

  it('detects knowledge query syntax', () => {
    expect(isKnowledgeQuery('tag:japanese status:active')).toBe(true);
    expect(isKnowledgeQuery('hello world')).toBe(false);
  });
});

describe('evaluateQuery', () => {
  let service: KnowledgeIndexService;
  let notes: NoteBase[];

  beforeEach(() => {
    service = new KnowledgeIndexService();
    notes = [
      withTags('grammar', 'Japanese Grammar', ['japanese'], 'body mention'),
      withProps('jlpt', 'JLPT N1 Notes', { status: 'active' }),
      withTags('vocab', 'Vocabulary', ['japanese'], 'plain'),
      setTags(setProperty(note('grammar-active', 'Grammar Active'), 'status', 'active'), ['japanese']),
    ];
    service.buildFromNotes(notes);
  });

  it('filters by tag using notesByTag index', () => {
    const parsed = parseQuery('tag:japanese');
    const ids = evaluateQuery(service, parsed);
    expect([...ids!].sort()).toEqual(['grammar', 'grammar-active', 'vocab']);
  });

  it('filters by property using property index', () => {
    const parsed = parseQuery('status:active');
    const ids = evaluateQuery(service, parsed);
    expect([...ids!].sort()).toEqual(['grammar-active', 'jlpt']);
  });

  it('intersects tag and property clauses with AND semantics', () => {
    const parsed = parseQuery('tag:japanese status:active');
    const ids = evaluateQuery(service, parsed);
    expect([...ids!]).toEqual(['grammar-active']);
  });

  it('returns empty set when no notes match', () => {
    const parsed = parseQuery('tag:missing');
    expect(evaluateQuery(service, parsed)?.size).toBe(0);
  });

  it('evaluates query strings', () => {
    const result = evaluateQueryString(service, 'priority:high');
    expect(result.noteIds?.size).toBe(0);
  });
});

describe('filterNotes', () => {
  let service: KnowledgeIndexService;
  let notes: NoteBase[];

  beforeEach(() => {
    service = new KnowledgeIndexService();
    notes = [
      withTags('grammar', 'Japanese Grammar', ['japanese']),
      withProps('jlpt', 'JLPT N1 Notes', { status: 'active' }),
    ];
    service.buildFromNotes(notes);
  });

  it('returns all notes for empty query', () => {
    const result = filterNotes(notes, service, '');
    expect(result.notes).toHaveLength(2);
    expect(result.usedKnowledgeQuery).toBe(false);
  });

  it('filters notes without scanning bodies', () => {
    const result = filterNotes(notes, service, 'tag:japanese');
    expect(result.usedKnowledgeQuery).toBe(true);
    expect(result.notes.map(n => n.id)).toEqual(['grammar']);
  });

  it('returns empty list for invalid knowledge query syntax', () => {
    const result = filterNotes(notes, service, 'tag:japanese invalid');
    expect(result.notes).toEqual([]);
    expect(result.parsed.error).toBeTruthy();
  });

  it('preserves note ordering from the input list', () => {
    const ordered = [
      withTags('b', 'Beta', ['shared']),
      withTags('a', 'Alpha', ['shared']),
    ];
    service.buildFromNotes(ordered);
    const result = filterNotes(ordered, service, 'tag:shared');
    expect(result.notes.map(n => n.id)).toEqual(['b', 'a']);
  });

  it('falls back to caller text search when syntax is not knowledge query', () => {
    const result = filterNotes(notes, service, 'grammar text');
    expect(result.usedKnowledgeQuery).toBe(false);
    expect(result.notes).toHaveLength(2);
  });
});

describe('formatParsedQuery', () => {
  it('formats clauses for display', () => {
    expect(formatParsedQuery(parseQuery('tag:japanese status:active'))).toBe(
      'tag:japanese status:active',
    );
  });
});

describe('KnowledgeIndexService property queries', () => {
  it('indexes property values for lookup', () => {
    const service = new KnowledgeIndexService();
    service.buildFromNotes([
      withProps('a', 'A', { status: 'active', priority: 'high' }),
      withProps('b', 'B', { status: 'done' }),
    ]);

    expect(service.getNotesWithProperty('status', 'active')).toEqual(['a']);
    expect(service.getPropertyValues('status').sort()).toEqual(['active', 'done']);
  });
});
