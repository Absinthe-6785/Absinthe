import { describe, expect, it, beforeEach } from 'vitest';
import type { NoteBase } from '../../../noteUtils';
import { KnowledgeIndexService } from '../KnowledgeIndexService';
import { evaluateNoteIsolation, collectIsolatedNoteIds } from './vaultIsolation';

function note(id: string, title: string, extra: Partial<NoteBase> = {}): NoteBase {
  return { id, title, body: '', updatedAt: Date.now(), ...extra };
}

describe('vaultIsolation', () => {
  let service: KnowledgeIndexService;

  beforeEach(() => {
    service = new KnowledgeIndexService();
  });

  it('marks notes with no links, mentions, relations, or tags as isolated', () => {
    const notes = [
      note('a', 'Alpha'),
      note('b', 'Beta', { properties: { tags: 'study' } }),
    ];
    service.buildFromNotes(notes);

    expect(evaluateNoteIsolation(notes[0]!, service).isIsolated).toBe(true);
    expect(evaluateNoteIsolation(notes[1]!, service).isIsolated).toBe(false);
  });

  it('detects non-isolation when wiki-linked', () => {
    const notes = [
      note('a', 'Alpha'),
      note('c', 'Gamma', { body: '[[Alpha]]' }),
    ];
    service.buildFromNotes(notes);
    expect(evaluateNoteIsolation(notes[0]!, service).isIsolated).toBe(false);
  });

  it('collects isolated note ids sorted by recency', () => {
    const notes = [
      note('old', 'Old', { updatedAt: 1 }),
      note('new', 'New', { updatedAt: 99 }),
    ];
    service.buildFromNotes(notes);
    expect(collectIsolatedNoteIds(notes, service)).toEqual(['new', 'old']);
  });
});
