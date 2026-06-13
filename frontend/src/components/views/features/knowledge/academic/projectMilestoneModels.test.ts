import { describe, it, expect } from 'vitest';
import type { NoteBase } from '../../../noteUtils';
import {
  buildUpcomingMilestones,
  getMilestoneTargetDate,
  setProjectMilestone,
} from './projectMilestoneModels';
import { setStudyProjectContainer } from './studyProjectModels';

function note(id: string, title = id): NoteBase {
  return { id, title, body: '', updatedAt: 100, folderId: null, deletedAt: null };
}

describe('projectMilestoneModels', () => {
  it('stores milestone status and target date', () => {
    const m = setProjectMilestone(note('m1', 'Reach TOEFL 95'), 'p1', 'active', '2026-12-01');
    expect(getMilestoneTargetDate(m)).toBe('2026-12-01');
  });

  it('sorts upcoming milestones by target date', () => {
    const project = setStudyProjectContainer(note('p1', 'TOEFL 105'), 'active');
    const later = setProjectMilestone(note('m2', 'Reach 105'), 'p1', 'planned', '2027-01-01');
    const sooner = setProjectMilestone(note('m1', 'Reach 95'), 'p1', 'planned', '2026-06-01');
    const upcoming = buildUpcomingMilestones([project, later, sooner], { limit: 5 });
    expect(upcoming[0].noteId).toBe('m1');
    expect(upcoming[0].projectTitle).toBe('TOEFL 105');
  });
});
