import { describe, it, expect } from 'vitest';
import type { NoteBase } from '../../../noteUtils';
import { buildProjectHealth, STALLED_PROJECT_DAYS } from './buildProjectHealth';
import { linkNoteToStudyProject, setStudyProjectContainer } from '../academic/studyProjectModels';

function note(id: string, title = id, updatedAt = 100): NoteBase {
  return { id, title, body: '', updatedAt, folderId: null, deletedAt: null };
}

describe('buildProjectHealth', () => {
  it('flags stalled active projects', () => {
    const now = Date.now();
    const staleTs = now - (STALLED_PROJECT_DAYS + 5) * 86_400_000;
    const project = setStudyProjectContainer(note('p1', 'EJU 2027', staleTs), 'active');
    const member = linkNoteToStudyProject(note('n1', 'Note', staleTs), 'p1');
    const data = buildProjectHealth([project, member], { now, limit: 5 });
    expect(data.stalledProjects).toHaveLength(1);
    expect(data.stalledProjects[0].indicator).toBe('stalled');
  });

  it('shows recent active projects', () => {
    const now = Date.now();
    const project = setStudyProjectContainer(note('p1', 'TOEFL 105', now - 1000), 'active');
    const data = buildProjectHealth([project], { now, limit: 5 });
    expect(data.activeProjects[0].indicator).toBe('active');
  });
});
