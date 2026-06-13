import { describe, it, expect } from 'vitest';
import type { NoteBase } from '../../../noteUtils';
import {
  buildStudyProjectSummary,
  filterNotesLinkedToProject,
  filterStudyProjectContainers,
  getStudyProjectStatus,
  linkNoteToStudyProject,
  setStudyProjectContainer,
} from './studyProjectModels';
import { setProjectMilestone } from './projectMilestoneModels';
import { addTag } from '../tags/noteTags';

function note(id: string, title = id): NoteBase {
  return { id, title, body: '', updatedAt: 100, folderId: null, deletedAt: null };
}

describe('studyProjectModels', () => {
  it('marks container notes with status and description', () => {
    const project = setStudyProjectContainer(note('p1', 'EJU 2027'), 'active', 'Exam prep');
    expect(getStudyProjectStatus(project)).toBe('active');
    expect(filterStudyProjectContainers([project], 'active')).toHaveLength(1);
  });

  it('links member notes to a project', () => {
    const project = setStudyProjectContainer(note('p1', 'TOEFL 105'), 'planned');
    const member = linkNoteToStudyProject(note('n1'), 'p1');
    expect(filterNotesLinkedToProject([project, member], 'p1')).toHaveLength(1);
  });

  it('summarizes milestones and linked notes', () => {
    const project = setStudyProjectContainer(note('p1', 'JLPT N1'), 'active');
    const milestone = setProjectMilestone(note('m1', 'Finish N1 vocab'), 'p1', 'planned', '2027-06-01');
    const done = setProjectMilestone(note('m2', 'Mock test'), 'p1', 'completed');
    const linked = linkNoteToStudyProject(addTag(note('s1'), 'study'), 'p1');
    const summary = buildStudyProjectSummary([project, milestone, done, linked], project);
    expect(summary.milestoneCount).toBe(2);
    expect(summary.completedMilestoneCount).toBe(1);
    expect(summary.progressPercent).toBe(50);
    expect(summary.studyNoteCount).toBe(1);
  });
});
