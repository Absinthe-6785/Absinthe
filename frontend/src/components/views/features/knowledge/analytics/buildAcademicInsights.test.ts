import { describe, it, expect } from 'vitest';
import type { NoteBase } from '../../../noteUtils';
import { buildAcademicInsights } from './buildAcademicInsights';
import { setStudyProjectContainer } from '../academic/studyProjectModels';
import { setWeakTopic } from '../study/weakTopicTracking';
import { buildStudyNote } from '../study/studyNoteTemplate';
import { addTag } from '../tags/noteTags';

function note(id: string, title = id): NoteBase {
  return { id, title, body: '', updatedAt: 100, folderId: null, deletedAt: null };
}

describe('buildAcademicInsights', () => {
  it('composes all insight sections', () => {
    const project = setStudyProjectContainer(addTag(note('p1', 'EJU'), 'japanese-history'), 'active');
    const study = buildStudyNote(addTag(note('s1'), 'toefl'), { title: 'Vocab' });
    const weak = setWeakTopic(addTag(note('w1'), 'toefl'), true);
    const data = buildAcademicInsights([project, study, weak], { limit: 4 });
    expect(data.subjectProgress.subjects.length).toBeGreaterThan(0);
    expect(data.projectHealth.activeProjects.length).toBe(1);
    expect(data.weakTopicInsights.totalCount).toBe(1);
    expect(data.learningActivity.items.length).toBeGreaterThan(0);
  });
});
