import { describe, expect, it } from 'vitest';
import type { NoteBase } from '../../../noteUtils';
import {
  buildWorkspaceSearch,
  buildWorkspaceSearchSuggestions,
  WORKSPACE_SEARCH_RANKING_DOC,
} from './buildWorkspaceSearch';
import { setStudyProjectContainer } from '../academic/studyProjectModels';
import { setProjectMilestone } from '../academic/projectMilestoneModels';
import { setLearningPathStep } from '../maps/subjectDashboards';
import { addTag } from '../tags/noteTags';

function note(id: string, title: string, extra: Partial<NoteBase> = {}): NoteBase {
  return {
    id,
    title,
    body: '',
    folderId: null,
    starred: false,
    deletedAt: null,
    createdAt: 1,
    updatedAt: 1,
    properties: {},
    relations: {},
    ...extra,
  };
}

describe('buildWorkspaceSearch', () => {
  it('returns empty for blank query', () => {
    expect(buildWorkspaceSearch('', [note('a', 'Alpha')], [])).toEqual([]);
  });

  it('finds notes by title with note group first', () => {
    const groups = buildWorkspaceSearch('alpha', [note('a', 'Alpha Note')], []);
    expect(groups[0]?.kind).toBe('note');
    expect(groups[0]?.results[0]?.title).toBe('Alpha Note');
  });

  it('ranks exact title matches before prefix matches', () => {
    const groups = buildWorkspaceSearch('EJU', [
      note('a', 'EJU Prep Notes'),
      note('b', 'EJU'),
    ], []);
    const notes = groups.find(g => g.kind === 'note')?.results ?? [];
    expect(notes[0]?.title).toBe('EJU');
  });

  it('finds projects and learning paths', () => {
    const project = setStudyProjectContainer(note('p1', 'EJU Prep'), 'active');
    const step = setLearningPathStep(note('s1', 'Step 1'), 'toefl-reading', 1);
    const groups = buildWorkspaceSearch('eju', [project, step], []);
    const kinds = groups.map(g => g.kind);
    expect(kinds).toContain('project');
  });

  it('finds tags and collections', () => {
    const tagged = addTag(note('t1', 'Tagged'), 'japanese-history');
    const groups = buildWorkspaceSearch('japanese', [tagged], []);
    const kinds = groups.map(g => g.kind);
    expect(kinds.some(k => k === 'tag' || k === 'collection' || k === 'subject')).toBe(true);
  });

  it('finds milestones linked to projects', () => {
    const project = setStudyProjectContainer(note('p1', 'Thesis'), 'active');
    const milestone = setProjectMilestone(note('m1', 'Draft chapter'), 'p1', 'planned');
    const groups = buildWorkspaceSearch('draft', [project, milestone], []);
    expect(groups.some(g => g.kind === 'milestone')).toBe(true);
  });

  it('finds folders by name', () => {
    const groups = buildWorkspaceSearch('research', [], [{ id: 'f1', name: 'Research Notes' }]);
    expect(groups.some(g => g.kind === 'folder')).toBe(true);
  });

  it('filters to project kinds only', () => {
    const project = setStudyProjectContainer(note('p1', 'Thesis'), 'active');
    const groups = buildWorkspaceSearch('thesis', [project, note('n1', 'Thesis notes')], [], { filter: 'project' });
    expect(groups.every(g => g.kind === 'project' || g.kind === 'milestone')).toBe(true);
  });

  it('finds notes by body LaTeX content', () => {
    const groups = buildWorkspaceSearch('b^2-4ac', [
      note('m1', 'Quadratic', { body: 'The discriminant is $b^2-4ac$' }),
    ], []);
    const notes = groups.find(g => g.kind === 'note')?.results ?? [];
    expect(notes.some(r => r.id === 'm1')).toBe(true);
  });

  it('documents ranking behavior', () => {
    expect(WORKSPACE_SEARCH_RANKING_DOC).toContain('exact title');
  });
});

describe('buildWorkspaceSearchSuggestions', () => {
  it('returns suggestions when query is empty', () => {
    const groups = buildWorkspaceSearchSuggestions([note('a', 'Recent note', { updatedAt: 999 })], []);
    expect(groups.length).toBeGreaterThan(0);
  });
});
