import { describe, it, expect } from 'vitest';
import type { NoteBase } from '../../../noteUtils';
import { setNoteKind } from '../research/noteClassification';
import { addTag } from '../tags/noteTags';
import {
  buildLearningPath,
  buildSubjectDashboard,
  listLearningPathIds,
  setLearningPathStep,
  SUBJECT_DASHBOARDS,
} from './subjectDashboards';

function note(id: string, title = id): NoteBase {
  return { id, title, body: '', updatedAt: 100, folderId: null, deletedAt: null };
}

describe('subjectDashboards', () => {
  it('builds tag-based subject dashboard', () => {
    const tagged = addTag(setNoteKind(note('c1', 'Meiji'), 'concept'), 'japanese-history');
    const other = addTag(note('n1', 'Essay'), 'japanese-history');
    const dash = buildSubjectDashboard([tagged, other], 'japanese-history', { limit: 4 });
    expect(dash?.subject.name).toBe('Japanese History');
    expect(dash?.noteCount).toBe(2);
    expect(dash?.conceptCount).toBe(1);
    expect(SUBJECT_DASHBOARDS.length).toBeGreaterThanOrEqual(5);
  });

  it('orders learning path steps manually', () => {
    const step1 = setLearningPathStep(note('a', 'Meiji Restoration'), 'meiji-era', 1);
    const step2 = setLearningPathStep(note('b', 'Rights Movement'), 'meiji-era', 2);
    const step3 = setLearningPathStep(note('c', 'Annexation'), 'meiji-era', 3);
    const path = buildLearningPath([step2, step3, step1], 'meiji-era');
    expect(path?.steps.map(s => s.noteId)).toEqual(['a', 'b', 'c']);
    expect(listLearningPathIds([step1, step2])).toEqual(['meiji-era']);
  });
});
