import { describe, expect, it } from 'vitest';
import type { NoteBase } from '../../../../noteUtils';
import { KnowledgeIndexService } from '../../KnowledgeIndexService';
import {
  countActiveNotes,
  countVaultLinks,
  resolveCosmosEmptyScenario,
  resolveCosmosVaultPhase,
} from './cosmosVaultState';

function note(id: string, title: string, body = ''): NoteBase {
  return { id, title, body };
}

describe('cosmosVaultState', () => {
  it('detects no-notes phase', () => {
    expect(resolveCosmosVaultPhase([], new KnowledgeIndexService(), 0)).toBe('no-notes');
    expect(countActiveNotes([])).toBe(0);
  });

  it('detects no-links phase', () => {
    const notes = [note('a', 'Alpha'), note('b', 'Beta')];
    const service = new KnowledgeIndexService();
    service.buildFromNotes(notes);
    expect(resolveCosmosVaultPhase(notes, service, 0)).toBe('no-links');
    expect(countVaultLinks(notes, service)).toBe(0);
  });

  it('detects linked-healthy phase', () => {
    const notes = [note('a', 'Alpha', '[[Beta]]'), note('b', 'Beta')];
    const service = new KnowledgeIndexService();
    service.buildFromNotes(notes);
    expect(resolveCosmosVaultPhase(notes, service, 0)).toBe('linked-healthy');
    expect(countVaultLinks(notes, service)).toBeGreaterThan(0);
  });

  it('resolves empty scenario for graph overlay', () => {
    expect(resolveCosmosEmptyScenario({
      activeNoteCount: 0,
      linkCount: 0,
      hasSearchFilter: false,
      searchHasMatches: true,
    })).toBe('no-notes');

    expect(resolveCosmosEmptyScenario({
      activeNoteCount: 3,
      linkCount: 0,
      hasSearchFilter: false,
      searchHasMatches: true,
    })).toBe('no-links');
  });
});
