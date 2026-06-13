import { describe, it, expect } from 'vitest';
import type { NoteBase } from '../../../noteUtils';
import { buildAcademicDashboard } from './buildAcademicDashboard';
import { setStudyProjectContainer } from './studyProjectModels';
import { setProjectMilestone } from './projectMilestoneModels';
import { buildStudyNote } from '../study/studyNoteTemplate';
import { setWeakTopic } from '../study/weakTopicTracking';

function note(id: string, body = '', title = id): NoteBase {
  return { id, title, body, updatedAt: 100, folderId: null, deletedAt: null };
}

describe('buildAcademicDashboard', () => {
  it('composes project, milestone, study, and weak topic sections', () => {
    const project = setStudyProjectContainer(note('p1', 'TOEFL 105'), 'active');
    const milestone = setProjectMilestone(note('m1', 'Reach 95'), 'p1', 'planned', '2026-08-01');
    const study = buildStudyNote(note('s1'), { title: 'Reading' });
    const weak = setWeakTopic(note('w1', '```question\nQ?\n```'), true);
    const data = buildAcademicDashboard([project, milestone, study, weak], { limit: 5 });
    expect(data.activeProjects).toHaveLength(1);
    expect(data.upcomingMilestones).toHaveLength(1);
    expect(data.studyNotes.length).toBeGreaterThan(0);
    expect(data.weakTopics).toHaveLength(1);
  });
});
