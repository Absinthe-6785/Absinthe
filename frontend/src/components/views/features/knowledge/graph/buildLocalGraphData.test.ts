import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { NoteBase } from '../../../noteUtils';
import { setTags } from '../tags/noteTags';
import { KnowledgeIndexService } from '../KnowledgeIndexService';
import { RELATED_SCORE } from '../related/relatedNotesScoring';
import { buildLocalGraphData } from './buildLocalGraphData';

function note(
  id: string,
  title: string,
  body: string,
  tags: string[] = [],
): NoteBase {
  let n: NoteBase = { id, title, body, updatedAt: 0, folderId: null, deletedAt: null };
  if (tags.length > 0) n = setTags(n, tags);
  return n;
}

describe('buildLocalGraphData', () => {
  let service: KnowledgeIndexService;

  beforeEach(() => {
    service = new KnowledgeIndexService();
  });

  it('centers the current note and marks it as current', () => {
    service.buildFromNotes([
      note('genki', 'Genki', ''),
      note('grammar', 'Japanese Grammar', 'See [[Genki]].'),
    ]);

    const graph = buildLocalGraphData({
      noteId: 'genki',
      noteTitle: 'Genki',
      service,
    });

    const center = graph.nodes.find(n => n.noteId === 'genki');
    expect(center).toMatchObject({ noteId: 'genki', title: 'Genki', type: 'current' });
    expect(graph.scope).toBe('local');
    expect(graph.centerNoteId).toBe('genki');
  });

  it('creates backlink edges from incoming wiki links', () => {
    service.buildFromNotes([
      note('genki', 'Genki', ''),
      note('study', 'Japanese Study', 'See [[Genki]] for details.'),
    ]);

    const graph = buildLocalGraphData({
      noteId: 'genki',
      noteTitle: 'Genki',
      service,
    });

    expect(graph.nodes).toHaveLength(2);
    expect(graph.edges).toContainEqual({
      sourceId: 'study',
      targetId: 'genki',
      relationshipType: 'backlink',
      weight: RELATED_SCORE.BACKLINK,
    });
  });

  it('creates outgoing backlink edges from the current note', () => {
    service.buildFromNotes([
      note('genki', 'Genki', 'Use [[Japanese Grammar]].'),
      note('grammar', 'Japanese Grammar', ''),
    ]);

    const graph = buildLocalGraphData({
      noteId: 'genki',
      noteTitle: 'Genki',
      service,
    });

    expect(graph.edges).toContainEqual({
      sourceId: 'genki',
      targetId: 'grammar',
      relationshipType: 'backlink',
      weight: RELATED_SCORE.BACKLINK,
    });
  });

  it('maps mutual backlinks to mutual-backlink edges', () => {
    service.buildFromNotes([
      note('a', 'Alpha', '[[Beta]]'),
      note('b', 'Beta', '[[Alpha]]'),
    ]);

    const graph = buildLocalGraphData({
      noteId: 'a',
      noteTitle: 'Alpha',
      service,
    });

    expect(graph.edges).toContainEqual({
      sourceId: 'a',
      targetId: 'b',
      relationshipType: 'mutual-backlink',
      weight: RELATED_SCORE.MUTUAL_BACKLINK,
    });
  });

  it('creates mention edges for incoming and outgoing mentions', () => {
    service.buildFromNotes([
      note('genki', 'Genki', 'Pair with Japanese Study notes.'),
      note('study', 'Japanese Study', 'Genki is useful.'),
      note('vocab', 'Vocabulary', 'Review Genki words.'),
    ]);

    const graph = buildLocalGraphData({
      noteId: 'genki',
      noteTitle: 'Genki',
      service,
    });

    expect(graph.edges).toContainEqual({
      sourceId: 'study',
      targetId: 'genki',
      relationshipType: 'mention',
      weight: RELATED_SCORE.MENTION,
    });
    expect(graph.edges).toContainEqual({
      sourceId: 'vocab',
      targetId: 'genki',
      relationshipType: 'mention',
      weight: RELATED_SCORE.MENTION,
    });
    expect(graph.edges).toContainEqual({
      sourceId: 'genki',
      targetId: 'study',
      relationshipType: 'mention',
      weight: RELATED_SCORE.MENTION,
    });
  });

  it('creates shared-tag edges from related note reasons', () => {
    service.buildFromNotes([
      note('genki', 'Genki', '', ['japanese', 'textbook']),
      note('grammar', 'Japanese Grammar', '', ['japanese']),
    ]);

    const graph = buildLocalGraphData({
      noteId: 'genki',
      noteTitle: 'Genki',
      service,
    });

    expect(graph.edges).toContainEqual({
      sourceId: 'genki',
      targetId: 'grammar',
      relationshipType: 'shared-tag',
      weight: RELATED_SCORE.SHARED_TAG,
    });
  });

  it('handles an empty graph with only the current note', () => {
    service.buildFromNotes([note('solo', 'Solo Note', '')]);

    const graph = buildLocalGraphData({
      noteId: 'solo',
      noteTitle: 'Solo Note',
      service,
    });

    expect(graph.nodes).toEqual([
      { noteId: 'solo', title: 'Solo Note', type: 'current', degree: 0, hop: 0, expandable: false },
    ]);
    expect(graph.edges).toEqual([]);
  });

  it('uses only indexed service lookups without scanning notes', () => {
    service.buildFromNotes([
      note('genki', 'Genki', ''),
      note('hidden', 'Hidden Note', 'Genki appears here but note is unrelated to index APIs used directly'),
    ]);

    const spyIncoming = vi.spyOn(service, 'getIncoming');
    const spyOutgoing = vi.spyOn(service, 'getOutgoing');
    const spyMentions = vi.spyOn(service, 'getMentioningNotes');
    const spyMentioned = vi.spyOn(service, 'getMentionedNotes');
    const spyRelated = vi.spyOn(service, 'getRelatedNotes');

    buildLocalGraphData({ noteId: 'genki', noteTitle: 'Genki', service });

    expect(spyIncoming).toHaveBeenCalledWith('Genki', { excludeNoteId: 'genki' });
    expect(spyOutgoing).toHaveBeenCalledWith('genki');
    expect(spyMentions).toHaveBeenCalledWith('genki', { excludeNoteId: 'genki' });
    expect(spyMentioned).toHaveBeenCalledWith('genki');
    expect(spyRelated).toHaveBeenCalledWith('genki');
  });
});
