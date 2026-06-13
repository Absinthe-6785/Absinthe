import { describe, it, expect } from 'vitest';
import type { NoteBase } from '../../../noteUtils';
import { buildSubjectProgress } from './buildSubjectProgress';
import { addTag } from '../tags/noteTags';
import { setNoteKind } from '../research/noteClassification';
import { buildStudyNote } from '../study/studyNoteTemplate';
import { setWeakTopic } from '../study/weakTopicTracking';
import { setStudyProjectContainer } from '../academic/studyProjectModels';

function note(id: string, title = id): NoteBase {
  return { id, title, body: '', updatedAt: 100, folderId: null, deletedAt: null };
}

describe('buildSubjectProgress', () => {
  it('aggregates subject metrics', () => {
    const history = addTag(setNoteKind(note('h1', 'Meiji'), 'concept'), 'japanese-history');
    const study = buildStudyNote(addTag(note('s1'), 'japanese-history'), { title: 'Study' });
    const weak = setWeakTopic(addTag(note('w1'), 'toefl'), true);
    const project = setStudyProjectContainer(addTag(note('p1', 'EJU'), 'japanese-history'), 'active');
    const data = buildSubjectProgress([history, study, weak, project], { includeEmpty: true });
    const jh = data.subjects.find(s => s.subjectId === 'japanese-history');
    const toefl = data.subjects.find(s => s.subjectId === 'toefl');
    expect(jh?.noteCount).toBe(3);
    expect(jh?.studyNoteCount).toBe(1);
    expect(jh?.conceptCount).toBe(1);
    expect(jh?.projectCount).toBe(1);
    expect(toefl?.weakTopicCount).toBe(1);
  });
});
