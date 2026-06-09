import { describe, it, expect, beforeEach } from 'vitest';
import type { NoteBase } from '../../../noteUtils';
import { KnowledgeIndexService } from '../KnowledgeIndexService';
import { buildLocalGraphData } from '../graph/buildLocalGraphData';
import { buildGlobalGraphData } from '../graph/buildGlobalGraphData';
import { RELATED_SCORE } from '../related/relatedNotesScoring';
import {
  addRelationTarget,
  removeRelationTarget,
  setRelationTargets,
} from './noteRelations';

function note(
  id: string,
  title: string,
  relations?: Record<string, string[]>,
): NoteBase {
  return {
    id,
    title,
    body: '',
    updatedAt: 0,
    folderId: null,
    deletedAt: null,
    relations,
  };
}

describe('relation UI authoring helpers', () => {
  it('creates and edits relations by note id', () => {
    let lecture = note('lecture-1', 'Lecture 1');
    lecture = addRelationTarget(lecture, 'course', 'course-1');
    expect(lecture.relations?.course).toEqual(['course-1']);

    lecture = addRelationTarget(lecture, 'course', 'course-2');
    expect(lecture.relations?.course).toEqual(['course-1', 'course-2']);

    lecture = setRelationTargets(lecture, 'project', ['project-1']);
    expect(lecture.relations?.project).toEqual(['project-1']);

    lecture = removeRelationTarget(lecture, 'course', 'course-1');
    expect(lecture.relations?.course).toEqual(['course-2']);
  });

  it('removes relation keys when last target is removed', () => {
    let lecture = addRelationTarget(note('lecture-1', 'Lecture 1'), 'course', 'course-1');
    lecture = removeRelationTarget(lecture, 'course', 'course-1');
    expect(lecture.relations).toBeUndefined();
  });
});

describe('relation panel index lookups', () => {
  let service: KnowledgeIndexService;

  beforeEach(() => {
    service = new KnowledgeIndexService();
    service.buildFromNotes([
      note('course-1', 'Japanese N1'),
      note('lecture-1', 'Lecture 1', { course: ['course-1'] }),
      note('plan-1', 'Study Plan', { course: ['course-1'] }),
    ]);
  });

  it('lists outgoing and incoming relations for navigation', () => {
    expect(service.resolveRelationTargets('lecture-1')).toEqual([
      {
        targetId: 'course-1',
        propertyKey: 'course',
        targetTitle: 'Japanese N1',
        missing: false,
      },
    ]);

    expect(service.getIncomingRelations('course-1')).toHaveLength(2);
    expect(service.getNoteTitle('lecture-1')).toBe('Lecture 1');
  });

  it('updates titles after rename without rewriting relation ids', () => {
    service.updateNote(note('course-1', 'Renamed Course'));
    expect(service.resolveRelationTargets('lecture-1')[0].targetTitle).toBe('Renamed Course');
  });

  it('marks missing targets when target note is deleted', () => {
    service.updateNote({ ...note('course-1', 'Japanese N1'), deletedAt: Date.now() });
    expect(service.resolveRelationTargets('lecture-1')).toEqual([
      {
        targetId: 'course-1',
        propertyKey: 'course',
        targetTitle: '',
        missing: true,
      },
    ]);
  });

  it('reflects relation edits incrementally in the index', () => {
    service.updateNote(note('lecture-2', 'Lecture 2', { course: ['course-1'] }));
    expect(service.getIncomingRelations('course-1')).toHaveLength(3);
    expect(service.getOutgoingRelations('lecture-2')).toHaveLength(1);
  });
});

describe('relation graph integration', () => {
  let service: KnowledgeIndexService;

  beforeEach(() => {
    service = new KnowledgeIndexService();
    service.buildFromNotes([
      note('course-1', 'Japanese N1'),
      note('lecture-1', 'Lecture 1', { course: ['course-1'] }),
    ]);
  });

  it('includes relation edges in local graph data', () => {
    const graph = buildLocalGraphData({
      noteId: 'lecture-1',
      noteTitle: 'Lecture 1',
      service,
    });

    expect(graph.edges).toContainEqual({
      sourceId: 'lecture-1',
      targetId: 'course-1',
      relationshipType: 'relation',
      weight: RELATED_SCORE.RELATION,
    });
  });

  it('includes relation edges in global graph data with relations filter', () => {
    const graph = buildGlobalGraphData({
      service,
      options: { relationshipFilter: 'relations' },
    });

    expect(graph.edges).toEqual([
      {
        sourceId: 'lecture-1',
        targetId: 'course-1',
        relationshipType: 'relation',
        weight: RELATED_SCORE.RELATION,
      },
    ]);
  });
});
