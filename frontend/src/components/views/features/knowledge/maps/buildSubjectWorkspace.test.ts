import { describe, it, expect } from 'vitest';
import { buildSubjectWorkspace, buildAllSubjectWorkspaces } from './buildSubjectWorkspace';
import type { NoteBase } from '../../../noteUtils';
import { addTag } from '../tags/noteTags';
import { setNoteKind } from '../research/noteClassification';
import { buildStudyNote } from '../study/studyNoteTemplate';
import { setWeakTopic } from '../study/weakTopicTracking';

function note(id: string, partial: Partial<NoteBase> = {}): NoteBase {
  return {
    id,
    title: partial.title ?? id,
    body: partial.body ?? '',
    updatedAt: partial.updatedAt ?? 100,
    folderId: partial.folderId ?? null,
    deletedAt: partial.deletedAt ?? null,
    properties: partial.properties,
  };
}

describe('buildSubjectWorkspace', () => {
  it('extends subject dashboard with weak topics, study notes, and activity', () => {
    const concept = setNoteKind(addTag(note('1', { updatedAt: 300 }), 'politics'), 'concept');
    const weakStudy = setWeakTopic(buildStudyNote(addTag(note('2', { updatedAt: 200 }), 'politics')), true);
    const workspace = buildSubjectWorkspace([concept, weakStudy], 'politics', { limit: 4 });
    expect(workspace).not.toBeNull();
    expect(workspace!.subject.id).toBe('politics');
    expect(workspace!.weakTopics.length).toBe(1);
    expect(workspace!.studyNotes.length).toBe(1);
    expect(workspace!.activity.length).toBeGreaterThan(0);
  });

  it('builds all five subject workspaces', () => {
    const workspaces = buildAllSubjectWorkspaces([]);
    expect(workspaces).toHaveLength(5);
  });
});
