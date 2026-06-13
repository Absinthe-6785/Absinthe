import { describe, it, expect } from 'vitest';
import type { NoteBase } from '../../../noteUtils';
import { buildWeakTopicInsights } from './buildWeakTopicInsights';
import { setWeakTopic } from '../study/weakTopicTracking';
import { addTag } from '../tags/noteTags';

function note(id: string, title = id): NoteBase {
  return { id, title, body: '', updatedAt: 100, folderId: null, deletedAt: null };
}

describe('buildWeakTopicInsights', () => {
  it('groups weak topics by subject', () => {
    const w1 = setWeakTopic(addTag(note('w1', 'Grammar'), 'toefl'), true);
    const w2 = setWeakTopic(addTag(note('w2', 'Reading'), 'toefl'), true);
    const w3 = setWeakTopic(addTag(note('w3', 'Meiji'), 'japanese-history'), true);
    const data = buildWeakTopicInsights([w1, w2, w3], { limit: 5 });
    expect(data.totalCount).toBe(3);
    expect(data.bySubject.find(s => s.subjectId === 'toefl')?.count).toBe(2);
    expect(data.frequentAreas).toHaveLength(3);
  });
});
