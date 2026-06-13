import { describe, it, expect } from 'vitest';
import type { NoteBase } from '../../../noteUtils';
import { buildStudyDashboard } from './buildStudyDashboard';
import { buildStudyNote } from './studyNoteTemplate';
import { setWeakTopic } from './weakTopicTracking';

function note(id: string, body = '', title = id): NoteBase {
  return { id, title, body, updatedAt: 100, folderId: null, deletedAt: null };
}

describe('buildStudyDashboard', () => {
  it('aggregates study metrics', () => {
    const study = buildStudyNote(note('s1'), { title: 'History' });
    const weak = setWeakTopic(note('w1', '```question\nQ: Test?\n```'), true);
    const data = buildStudyDashboard([study, weak], { limit: 5 });
    expect(data.recentStudyNotes.length).toBeGreaterThan(0);
    expect(data.weakTopics.length).toBe(1);
    expect(data.questionCount).toBe(2);
    expect(data.reviewCandidates.length).toBeGreaterThan(0);
  });
});
