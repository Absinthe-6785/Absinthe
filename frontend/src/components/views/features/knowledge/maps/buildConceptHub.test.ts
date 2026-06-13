import { describe, it, expect, beforeEach } from 'vitest';
import type { NoteBase } from '../../../noteUtils';
import { KnowledgeIndexService } from '../KnowledgeIndexService';
import { extractNoteReferenceSummary } from '../references/extractNoteReferenceSummary';
import { setNoteKind } from '../research/noteClassification';
import { addRelationTarget } from '../relations/noteRelations';
import { buildConceptHub } from './buildConceptHub';

function note(id: string, title: string, body = '', extras: Partial<NoteBase> = {}): NoteBase {
  return { id, title, body, updatedAt: 1, folderId: null, deletedAt: null, ...extras };
}

describe('buildConceptHub', () => {
  let service: KnowledgeIndexService;

  beforeEach(() => {
    service = new KnowledgeIndexService();
  });

  it('aggregates concept relations, backlinks, and wiki links', () => {
    const meiji = setNoteKind(note('m', 'Meiji Restoration'), 'concept');
    const rights = setNoteKind(note('r', 'Rights Movement'), 'concept');
    const war = setNoteKind(note('w', 'Sino-Japanese War', 'See [[Meiji Restoration]]'), 'concept');
    let central = addRelationTarget(meiji, 'influences', 'r');
    central = addRelationTarget(central, 'causes', 'w');

    const notes = [central, rights, war];
    service.buildFromNotes(notes);

    const summary = extractNoteReferenceSummary(war, notes);
    const hub = buildConceptHub({
      note: central,
      notes,
      service,
      referenceSummary: extractNoteReferenceSummary(central, notes),
    });

    expect(hub.isConcept).toBe(true);
    expect(hub.relationCounts.influences).toBe(1);
    expect(hub.relationCounts.causes).toBe(1);
    expect(hub.relatedConcepts.some(r => r.noteId === 'r')).toBe(true);
    expect(hub.backlinkCount).toBeGreaterThanOrEqual(0);

    const warHub = buildConceptHub({
      note: war,
      notes,
      service,
      referenceSummary: summary,
    });
    expect(warHub.relatedConcepts.some(r => r.noteId === 'm')).toBe(true);
  });
});
