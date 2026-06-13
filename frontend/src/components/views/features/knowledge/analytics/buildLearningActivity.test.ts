import { describe, it, expect } from 'vitest';
import type { NoteBase } from '../../../noteUtils';
import { buildLearningActivity } from './buildLearningActivity';
import { buildStudyNote } from '../study/studyNoteTemplate';
import { setNoteKind } from '../research/noteClassification';
import { setStudyProjectContainer } from '../academic/studyProjectModels';

function note(id: string, title = id, updatedAt = 100): NoteBase {
  return { id, title, body: '', updatedAt, folderId: null, deletedAt: null };
}

describe('buildLearningActivity', () => {
  it('merges study, research, review, and project activity', () => {
    const study = buildStudyNote(note('s1', 'Study', 300), { title: 'Study' });
    const research = setNoteKind(note('r1', 'Source', 200), 'source');
    const project = setStudyProjectContainer(note('p1', 'EJU', 400), 'active');
    const data = buildLearningActivity([study, research, project], { limit: 10 });
    expect(data.items.length).toBe(3);
    expect(data.items[0].kind).toBe('project');
    expect(data.items.map(i => i.kind).sort()).toEqual(['project', 'research', 'study']);
  });
});
