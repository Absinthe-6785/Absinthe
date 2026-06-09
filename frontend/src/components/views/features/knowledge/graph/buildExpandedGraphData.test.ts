import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { NoteBase } from '../../../noteUtils';
import { KnowledgeIndexService } from '../KnowledgeIndexService';
import { RELATED_SCORE } from '../related/relatedNotesScoring';
import {
  buildExpandedGraphData,
  collapseNode,
  DEFAULT_MAX_VISIBLE_GRAPH_NODES,
  expandNode,
} from './buildExpandedGraphData';

function note(id: string, title: string, body: string): NoteBase {
  return { id, title, body, updatedAt: 0, folderId: null, deletedAt: null };
}

describe('expandNode / collapseNode', () => {
  const expandable = new Set(['grammar', 'vocab']);

  it('adds a node to the expanded set once', () => {
    expect(expandNode([], 'grammar', expandable)).toEqual(['grammar']);
    expect(expandNode(['grammar'], 'grammar', expandable)).toEqual(['grammar']);
  });

  it('ignores nodes that are not expandable', () => {
    expect(expandNode([], 'patterns', expandable)).toEqual([]);
  });

  it('removes a node on collapse', () => {
    expect(collapseNode(['grammar', 'vocab'], 'grammar')).toEqual(['vocab']);
  });
});

describe('buildExpandedGraphData', () => {
  let service: KnowledgeIndexService;

  beforeEach(() => {
    service = new KnowledgeIndexService();
  });

  it('matches local graph when nothing is expanded', () => {
    service.buildFromNotes([
      note('genki', 'Genki', ''),
      note('grammar', 'Japanese Grammar', '[[Genki]]'),
      note('vocab', 'Vocabulary', 'Genki words'),
    ]);

    const graph = buildExpandedGraphData({
      centerId: 'genki',
      centerTitle: 'Genki',
      expandedNodeIds: [],
      service,
    });

    expect(graph.scope).toBe('local');
    expect(graph.nodes.map(n => n.noteId).sort()).toEqual(['genki', 'grammar', 'vocab']);
    expect(graph.nodes.find(n => n.noteId === 'genki')?.type).toBe('current');
    expect(graph.nodes.find(n => n.noteId === 'grammar')?.expandable).toBe(true);
    expect(graph.nodes.find(n => n.noteId === 'grammar')?.hop).toBe(1);
  });

  it('reveals one additional hop when a neighbor is expanded', () => {
    service.buildFromNotes([
      note('genki', 'Genki', ''),
      note('grammar', 'Japanese Grammar', '[[Genki]] · [[Particles]]'),
      note('vocab', 'Vocabulary', 'Genki words'),
      note('particles', 'Particles', 'Core grammar topic'),
    ]);

    const graph = buildExpandedGraphData({
      centerId: 'genki',
      centerTitle: 'Genki',
      expandedNodeIds: ['grammar'],
      service,
    });

    expect(graph.scope).toBe('expanded');
    expect(graph.nodes.some(n => n.noteId === 'particles')).toBe(true);
    expect(graph.nodes.find(n => n.noteId === 'particles')?.hop).toBe(2);
    expect(graph.nodes.find(n => n.noteId === 'grammar')?.expanded).toBe(true);
    expect(graph.edges).toContainEqual({
      sourceId: 'grammar',
      targetId: 'particles',
      relationshipType: 'backlink',
      weight: RELATED_SCORE.BACKLINK,
    });
  });

  it('prevents duplicate nodes and edges when neighborhoods overlap', () => {
    service.buildFromNotes([
      note('genki', 'Genki', ''),
      note('grammar', 'Japanese Grammar', '[[Genki]] · [[Vocabulary]]'),
      note('vocab', 'Vocabulary', '[[Genki]]'),
    ]);

    const graph = buildExpandedGraphData({
      centerId: 'genki',
      centerTitle: 'Genki',
      expandedNodeIds: ['grammar'],
      service,
    });

    const vocabNodes = graph.nodes.filter(n => n.noteId === 'vocab');
    expect(vocabNodes).toHaveLength(1);
  });

  it('removes expanded-hop nodes when a node is collapsed', () => {
    service.buildFromNotes([
      note('genki', 'Genki', ''),
      note('grammar', 'Japanese Grammar', '[[Genki]] · [[Particles]]'),
      note('particles', 'Particles', ''),
    ]);

    const expanded = buildExpandedGraphData({
      centerId: 'genki',
      centerTitle: 'Genki',
      expandedNodeIds: ['grammar'],
      service,
    });
    expect(expanded.nodes.some(n => n.noteId === 'particles')).toBe(true);

    const collapsed = buildExpandedGraphData({
      centerId: 'genki',
      centerTitle: 'Genki',
      expandedNodeIds: collapseNode(['grammar'], 'grammar'),
      service,
    });
    expect(collapsed.scope).toBe('local');
    expect(collapsed.nodes.some(n => n.noteId === 'particles')).toBe(false);
  });

  it('enforces maxVisibleNodes and reports limit metadata', () => {
    const notes: NoteBase[] = [note('center', 'Center', '')];
    for (let i = 0; i < 8; i += 1) {
      notes.push(note(`n${i}`, `Neighbor ${i}`, '[[Center]]'));
    }
    notes.push(note('expanded', 'Expanded Hub', '[[Center]] · [[Extra 0]] · [[Extra 1]]'));
    notes.push(note('extra0', 'Extra 0', ''));
    notes.push(note('extra1', 'Extra 1', ''));

    service.buildFromNotes(notes);

    const graph = buildExpandedGraphData({
      centerId: 'center',
      centerTitle: 'Center',
      expandedNodeIds: ['expanded'],
      service,
      maxVisibleNodes: 6,
    });

    expect(graph.nodes.length).toBeLessThanOrEqual(6);
    expect(graph.meta?.limitReached).toBe(true);
    expect(graph.meta?.hiddenNodeCount).toBeGreaterThan(0);
    expect(graph.nodes.some(n => n.noteId === 'center')).toBe(true);
  });

  it('uses indexed lookups only when expanding', () => {
    service.buildFromNotes([
      note('genki', 'Genki', ''),
      note('grammar', 'Japanese Grammar', '[[Genki]] · [[Particles]]'),
      note('particles', 'Particles', ''),
    ]);

    const spyNeighborhood = vi.spyOn(service, 'getOutgoing');
    buildExpandedGraphData({
      centerId: 'genki',
      centerTitle: 'Genki',
      expandedNodeIds: ['grammar'],
      service,
    });

    expect(spyNeighborhood).toHaveBeenCalled();
  });

  it('does not expand hop-2 nodes even if requested', () => {
    service.buildFromNotes([
      note('genki', 'Genki', ''),
      note('grammar', 'Japanese Grammar', '[[Genki]] · [[Particles]]'),
      note('particles', 'Particles', '[[Sentence Structure]]'),
      note('sentences', 'Sentence Structure', ''),
    ]);

    const graph = buildExpandedGraphData({
      centerId: 'genki',
      centerTitle: 'Genki',
      expandedNodeIds: ['grammar', 'particles'],
      service,
    });

    expect(graph.nodes.some(n => n.noteId === 'particles')).toBe(true);
    expect(graph.nodes.some(n => n.noteId === 'sentences')).toBe(false);
    expect(graph.nodes.find(n => n.noteId === 'particles')?.expanded).toBe(false);
  });
});

describe('DEFAULT_MAX_VISIBLE_GRAPH_NODES', () => {
  it('defaults to 100', () => {
    expect(DEFAULT_MAX_VISIBLE_GRAPH_NODES).toBe(100);
  });
});
