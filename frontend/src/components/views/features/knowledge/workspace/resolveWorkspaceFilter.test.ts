import { describe, it, expect, beforeEach } from 'vitest';
import type { NoteBase } from '../../../noteUtils';
import { KnowledgeIndexService } from '../KnowledgeIndexService';
import { applyWorkspaceListFilter } from './resolveWorkspaceFilter';
import { INACTIVE_WORKSPACE } from './workspaceModels';

function note(id: string, title: string, body: string, extras: Partial<NoteBase> = {}): NoteBase {
  return { id, title, body, updatedAt: 0, folderId: null, deletedAt: null, ...extras };
}

describe('applyWorkspaceListFilter', () => {
  let service: KnowledgeIndexService;
  let notes: NoteBase[];

  beforeEach(() => {
    service = new KnowledgeIndexService();
    notes = [
      note('a', 'Alpha', '', { properties: { tags: 'work' } }),
      note('b', 'Beta', '', { properties: { tags: 'work', status: 'active' } }),
      note('c', 'Gamma', '', { properties: { tags: 'personal' } }),
    ];
    service.buildFromNotes(notes);
  });

  it('returns notes unchanged when workspace is inactive', () => {
    const filtered = applyWorkspaceListFilter(notes, INACTIVE_WORKSPACE, {
      service,
      vaultNotes: notes,
      ruleCollections: [],
    });
    expect(filtered.map(n => n.id)).toEqual(['a', 'b', 'c']);
  });

  it('filters by rule collection through filterNotes', () => {
    const filtered = applyWorkspaceListFilter(notes, { kind: 'rule-collection', id: 'rc1' }, {
      service,
      vaultNotes: notes,
      ruleCollections: [{ id: 'rc1', name: 'Active Work', query: 'tag:work status:active' }],
    });
    expect(filtered.map(n => n.id)).toEqual(['b']);
  });

  it('filters by smart collection through index evaluators', () => {
    const filtered = applyWorkspaceListFilter(notes, { kind: 'smart-collection', id: 'untagged' }, {
      service,
      vaultNotes: notes,
      ruleCollections: [],
    });
    expect(filtered).toEqual([]);
  });

  it('leaves saved-view, database-view, and dashboard activations to their dedicated paths', () => {
    const savedViewFiltered = applyWorkspaceListFilter(notes, { kind: 'saved-view', id: 'sv-1' }, {
      service,
      vaultNotes: notes,
      ruleCollections: [],
    });
    const databaseFiltered = applyWorkspaceListFilter(notes, { kind: 'database-view', id: 'db-1' }, {
      service,
      vaultNotes: notes,
      ruleCollections: [],
    });
    const dashboardFiltered = applyWorkspaceListFilter(notes, { kind: 'dashboard' }, {
      service,
      vaultNotes: notes,
      ruleCollections: [],
    });
    expect(savedViewFiltered.map(n => n.id)).toEqual(['a', 'b', 'c']);
    expect(databaseFiltered.map(n => n.id)).toEqual(['a', 'b', 'c']);
    expect(dashboardFiltered.map(n => n.id)).toEqual(['a', 'b', 'c']);
  });
});
