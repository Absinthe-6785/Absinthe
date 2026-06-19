import { describe, it, expect } from 'vitest';
import { buildUnifiedWorkspaceDashboard } from './buildUnifiedWorkspaceDashboard';
import type { NoteBase } from '../../../noteUtils';
import { buildStudyNote } from '../study/studyNoteTemplate';

function note(id: string, partial: Partial<NoteBase> = {}): NoteBase {
  return {
    id,
    title: partial.title ?? id,
    body: partial.body ?? '',
    updatedAt: partial.updatedAt ?? 100,
    folderId: partial.folderId ?? null,
    deletedAt: partial.deletedAt ?? null,
    properties: partial.properties,
    relations: partial.relations,
  };
}

describe('buildUnifiedWorkspaceDashboard', () => {
  it('composes existing builder outputs into one model', () => {
    const notes = [
      note('1', { properties: { noteKind: 'source' }, updatedAt: 100 }),
      buildStudyNote(note('2'), { title: 'Study' }),
      note('3', { properties: { tags: 'politics' }, updatedAt: 200 }),
    ];
    const data = buildUnifiedWorkspaceDashboard(notes, { limit: 3 });
    expect(data.research).toBeDefined();
    expect(data.study).toBeDefined();
    expect(data.projects).toBeDefined();
    expect(data.insights).toBeDefined();
    expect(data.review).toBeDefined();
    expect(data.subjects.some(s => s.subject.id === 'politics')).toBe(true);
  });
});
