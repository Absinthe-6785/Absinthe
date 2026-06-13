import { describe, it, expect } from 'vitest';
import type { NoteBase } from '../../../noteUtils';
import { buildProjectDashboard } from './buildProjectDashboard';
import { linkNoteToStudyProject, setStudyProjectContainer } from './studyProjectModels';
import { setNoteKind } from '../research/noteClassification';

function note(id: string, title = id): NoteBase {
  return { id, title, body: '', updatedAt: 100, folderId: null, deletedAt: null };
}

describe('buildProjectDashboard', () => {
  it('groups active and planned projects', () => {
    const active = setStudyProjectContainer(note('a', 'EJU 2027'), 'active', 'History focus');
    const planned = setStudyProjectContainer(note('p', 'JLPT N1'), 'planned');
    const member = linkNoteToStudyProject(setNoteKind(note('c1', 'Meiji'), 'concept'), 'a');
    const data = buildProjectDashboard([active, planned, member], { limit: 4 });
    expect(data.activeProjects).toHaveLength(1);
    expect(data.activeProjects[0].conceptNotes).toHaveLength(1);
    expect(data.plannedProjects).toHaveLength(1);
  });
});
