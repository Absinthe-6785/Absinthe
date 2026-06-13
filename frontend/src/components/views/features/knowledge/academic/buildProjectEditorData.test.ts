import { describe, it, expect } from 'vitest';
import type { NoteBase } from '../../../noteUtils';
import { setStudyProjectContainer, linkNoteToStudyProject } from './studyProjectModels';
import { setProjectMilestone } from './projectMilestoneModels';
import { buildProjectEditorData } from './buildProjectEditorData';
import { setNoteKind } from '../research/noteClassification';

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

describe('buildProjectEditorData', () => {
  it('aggregates linked notes, milestones, and concepts', () => {
    const project = setStudyProjectContainer(note('p1', { title: 'Thesis' }), 'active', 'Doctoral thesis');
    const milestone = setProjectMilestone(note('m1', { title: 'Proposal' }), 'p1', 'planned');
    const concept = linkNoteToStudyProject(setNoteKind(note('c1', { title: 'Theory' }), 'concept'), 'p1');
    const data = buildProjectEditorData([project, milestone, concept], project);
    expect(data.title).toBe('Thesis');
    expect(data.description).toBe('Doctoral thesis');
    expect(data.milestones.length).toBe(1);
    expect(data.concepts.length).toBe(1);
  });
});
