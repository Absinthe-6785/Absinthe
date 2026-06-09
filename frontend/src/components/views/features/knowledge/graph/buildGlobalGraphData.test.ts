import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { NoteBase } from '../../../noteUtils';
import { KnowledgeIndexService } from '../KnowledgeIndexService';
import { RELATED_SCORE } from '../related/relatedNotesScoring';
import { buildGlobalGraphData } from './buildGlobalGraphData';

function note(id: string, title: string, body: string): NoteBase {
  return { id, title, body, updatedAt: 0, folderId: null, deletedAt: null };
}

describe('buildGlobalGraphData', () => {
  let service: KnowledgeIndexService;

  beforeEach(() => {
    service = new KnowledgeIndexService();
  });

  it('creates nodes for all indexed notes with global scope', () => {
    service.buildFromNotes([
      note('a', 'Alpha', ''),
      note('b', 'Beta', '[[Alpha]]'),
      note('c', 'Gamma', ''),
    ]);

    const graph = buildGlobalGraphData({ service });

    expect(graph.scope).toBe('global');
    expect(graph.nodes).toHaveLength(3);
    expect(graph.nodes.map(n => n.noteId).sort()).toEqual(['a', 'b', 'c']);
    expect(graph.nodes.every(n => n.type === 'connected')).toBe(true);
  });

  it('creates backlink edges from indexed outgoing links', () => {
    service.buildFromNotes([
      note('a', 'Alpha', ''),
      note('b', 'Beta', 'See [[Alpha]] here.'),
    ]);

    const graph = buildGlobalGraphData({ service });

    expect(graph.edges).toContainEqual({
      sourceId: 'b',
      targetId: 'a',
      relationshipType: 'backlink',
      weight: RELATED_SCORE.BACKLINK,
    });
  });

  it('creates mention edges from indexed mention maps', () => {
    service.buildFromNotes([
      note('a', 'Alpha', ''),
      note('b', 'Beta', 'Alpha is mentioned here.'),
    ]);

    const graph = buildGlobalGraphData({ service });

    expect(graph.edges).toContainEqual({
      sourceId: 'b',
      targetId: 'a',
      relationshipType: 'mention',
      weight: RELATED_SCORE.MENTION,
    });
  });

  it('filters to backlinks only', () => {
    service.buildFromNotes([
      note('a', 'Alpha', ''),
      note('b', 'Beta', 'Alpha and [[Alpha]].'),
    ]);

    const graph = buildGlobalGraphData({
      service,
      options: { relationshipFilter: 'backlinks' },
    });

    expect(graph.edges.every(edge => edge.relationshipType === 'backlink')).toBe(true);
    expect(graph.edges.some(edge => edge.relationshipType === 'mention')).toBe(false);
  });

  it('filters to mentions only', () => {
    service.buildFromNotes([
      note('a', 'Alpha', ''),
      note('b', 'Beta', 'Alpha and [[Alpha]].'),
    ]);

    const graph = buildGlobalGraphData({
      service,
      options: { relationshipFilter: 'mentions' },
    });

    expect(graph.edges.every(edge => edge.relationshipType === 'mention')).toBe(true);
    expect(graph.edges.some(edge => edge.relationshipType === 'backlink')).toBe(false);
  });

  it('computes node degree from visible edges', () => {
    service.buildFromNotes([
      note('a', 'Alpha', ''),
      note('b', 'Beta', '[[Alpha]]'),
      note('c', 'Gamma', ''),
    ]);

    const graph = buildGlobalGraphData({ service });

    expect(graph.nodes.find(n => n.noteId === 'a')?.degree).toBe(1);
    expect(graph.nodes.find(n => n.noteId === 'b')?.degree).toBe(1);
    expect(graph.nodes.find(n => n.noteId === 'c')?.degree).toBe(0);
  });

  it('hides isolated nodes when hideIsolated is enabled', () => {
    service.buildFromNotes([
      note('a', 'Alpha', ''),
      note('b', 'Beta', '[[Alpha]]'),
      note('c', 'Gamma', ''),
    ]);

    const graph = buildGlobalGraphData({
      service,
      options: { hideIsolated: true },
    });

    expect(graph.nodes.map(n => n.noteId).sort()).toEqual(['a', 'b']);
    expect(graph.edges.every(edge => edge.sourceId !== 'c' && edge.targetId !== 'c')).toBe(true);
  });

  it('uses only indexed service lookups without scanning note bodies', () => {
    service.buildFromNotes([
      note('a', 'Alpha', ''),
      note('b', 'Beta', '[[Alpha]]'),
    ]);

    const spyAll = vi.spyOn(service, 'getAllNoteIds');
    const spyOutgoing = vi.spyOn(service, 'getOutgoing');
    const spyMentioned = vi.spyOn(service, 'getMentionedNotes');
    const spyResolve = vi.spyOn(service, 'resolveNoteId');
    const spyTitle = vi.spyOn(service, 'getNoteTitle');

    buildGlobalGraphData({ service });

    expect(spyAll).toHaveBeenCalled();
    expect(spyOutgoing).toHaveBeenCalled();
    expect(spyMentioned).toHaveBeenCalled();
    expect(spyResolve).toHaveBeenCalled();
    expect(spyTitle).toHaveBeenCalled();
  });
});

describe('KnowledgeIndexService graph accessors', () => {
  it('exposes note ids, titles, and title resolution', () => {
    const service = new KnowledgeIndexService();
    service.buildFromNotes([
      note('a', 'Alpha', ''),
      note('b', 'Beta', ''),
    ]);

    expect(service.getAllNoteIds().sort()).toEqual(['a', 'b']);
    expect(service.getNoteTitle('a')).toBe('Alpha');
    expect(service.resolveNoteId('Beta')).toBe('b');
    expect(service.resolveNoteId('Missing')).toBeUndefined();
  });
});
