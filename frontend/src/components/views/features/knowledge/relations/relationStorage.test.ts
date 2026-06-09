// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import type { NoteBase } from '../../../noteUtils';
import { normalizeNote, NOTES_KEY } from '../../../noteUtils';
import { KnowledgeIndexService } from '../KnowledgeIndexService';
import {
  addRelationTarget,
  setRelationTargets,
} from './noteRelations';
import {
  parseRelationsFrontmatter,
  serializeRelationsFrontmatter,
} from './relationMarkdown';
import { relationEdgeKey } from './relationNormalize';
import { parseNoteMarkdown, serializeNoteMarkdown } from '../properties/noteProperties';

function note(
  id: string,
  title: string,
  relations?: Record<string, string[]>,
  deletedAt: number | null = null,
): NoteBase {
  return {
    id,
    title,
    body: '',
    updatedAt: 0,
    folderId: null,
    deletedAt,
    relations,
  };
}

describe('relation storage helpers', () => {
  it('stores note-id targets on notes', () => {
    const lecture = setRelationTargets(note('lecture-1', 'Lecture 1'), 'course', ['course-1']);
    expect(lecture.relations?.course).toEqual(['course-1']);
  });

  it('dedupes relation targets', () => {
    const n = addRelationTarget(note('a', 'A'), 'course', 'course-1');
    const next = addRelationTarget(n, 'course', 'course-1');
    expect(next.relations?.course).toEqual(['course-1']);
  });

  it('uses stable relation edge identity', () => {
    expect(relationEdgeKey('a', 'b', 'course')).toBe(relationEdgeKey('a', 'b', 'Course'));
  });
});

describe('relation markdown persistence', () => {
  it('round-trips relations through frontmatter', () => {
    const raw = serializeNoteMarkdown({
      id: 'lecture-1',
      title: 'Lecture 1',
      body: 'Content',
      updatedAt: 0,
      folderId: null,
      deletedAt: null,
      relations: { course: ['course-1', 'course-2'] },
    });

    const parsed = parseNoteMarkdown(raw);
    expect(parsed.relations?.course).toEqual(['course-1', 'course-2']);
    expect(parsed.body).toBe('Content');
  });

  it('parses relations block from frontmatter content', () => {
    const content = `tags:\n  - work\nrelations:\n  course:\n    - course-1\nstatus: active`;
    expect(parseRelationsFrontmatter(content)).toEqual({ course: ['course-1'] });
    expect(serializeRelationsFrontmatter({ course: ['course-1'] })).toEqual([
      'relations:',
      '  course:',
      '    - course-1',
    ]);
  });
});

describe('KnowledgeIndexService relations', () => {
  let service: KnowledgeIndexService;

  beforeEach(() => {
    service = new KnowledgeIndexService();
  });

  it('indexes forward and reverse relation lookups', () => {
    service.buildFromNotes([
      note('course-1', 'Japanese N1'),
      note('lecture-1', 'Lecture 1', { course: ['course-1'] }),
      note('lecture-2', 'Lecture 2', { course: ['course-1'] }),
    ]);

    expect(service.getOutgoingRelations('lecture-1')).toEqual([
      { sourceId: 'lecture-1', targetId: 'course-1', propertyKey: 'course' },
    ]);
    expect(service.getRelationTargets('lecture-1', 'course')).toEqual(['course-1']);
    expect(service.getRelatedNotesByRelation('course-1', 'course').sort()).toEqual(['lecture-1', 'lecture-2']);
    expect(service.getIncomingRelations('course-1')).toHaveLength(2);
  });

  it('updates relations incrementally', () => {
    service.buildFromNotes([
      note('course-1', 'Japanese N1'),
      note('lecture-1', 'Lecture 1'),
    ]);

    service.updateNote(note('lecture-1', 'Lecture 1', { course: ['course-1'] }));
    expect(service.getRelationTargets('lecture-1', 'course')).toEqual(['course-1']);

    service.updateNote(note('lecture-1', 'Lecture 1', { course: ['course-1', 'course-2'] }));
    expect(service.getRelationTargets('lecture-1', 'course')).toEqual(['course-1', 'course-2']);

    service.updateNote(note('lecture-1', 'Lecture 1'));
    expect(service.getOutgoingRelations('lecture-1')).toEqual([]);
  });

  it('keeps reverse edges when target is deleted but marks missing on resolve', () => {
    service.buildFromNotes([
      note('course-1', 'Japanese N1'),
      note('lecture-1', 'Lecture 1', { course: ['course-1'] }),
    ]);

    service.updateNote(note('course-1', 'Japanese N1', undefined, Date.now()));
    expect(service.getRelatedNotesByRelation('course-1', 'course')).toEqual(['lecture-1']);
    expect(service.resolveRelationTargets('lecture-1', 'course')).toEqual([
      {
        targetId: 'course-1',
        propertyKey: 'course',
        targetTitle: '',
        missing: true,
      },
    ]);
  });

  it('survives title rename without rewriting relation ids', () => {
    service.buildFromNotes([
      note('course-1', 'Japanese N1'),
      note('lecture-1', 'Lecture 1', { course: ['course-1'] }),
    ]);

    service.updateNote(note('course-1', 'Renamed Course'));
    expect(service.getRelationTargets('lecture-1', 'course')).toEqual(['course-1']);
    expect(service.resolveRelationTargets('lecture-1', 'course')[0].targetTitle).toBe('Renamed Course');
  });

  it('restores relations after note restore', () => {
    service.buildFromNotes([
      note('course-1', 'Japanese N1'),
      note('lecture-1', 'Lecture 1', { course: ['course-1'] }),
    ]);

    service.updateNote(note('lecture-1', 'Lecture 1', { course: ['course-1'] }, Date.now()));
    expect(service.getOutgoingRelations('lecture-1')).toEqual([]);

    service.updateNote(note('lecture-1', 'Lecture 1', { course: ['course-1'] }, null));
    expect(service.getOutgoingRelations('lecture-1')).toHaveLength(1);
  });

  it('normalizes notes without relations for backward compatibility', () => {
    const normalized = normalizeNote({
      id: 'legacy-1',
      title: 'Legacy',
      body: '',
    });
    expect(normalized.relations).toBeUndefined();

    service.buildFromNotes([normalized]);
    expect(service.getRelations('legacy-1')).toEqual([]);
  });
});

describe('localStorage persistence', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('persists relations in notes-v2 storage', () => {
    const notes = [note('lecture-1', 'Lecture 1', { course: ['course-1'] })];
    localStorage.setItem(NOTES_KEY, JSON.stringify(notes));

    const loaded = JSON.parse(localStorage.getItem(NOTES_KEY) ?? '[]').map((n: Partial<NoteBase>) => normalizeNote(n));
    expect(loaded[0].relations?.course).toEqual(['course-1']);
  });
});
