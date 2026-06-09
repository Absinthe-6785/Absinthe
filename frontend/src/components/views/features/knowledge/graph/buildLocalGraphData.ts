import type { KnowledgeIndexService } from '../KnowledgeIndexService';
import { buildNoteNeighborhood } from './buildNoteNeighborhood';
import type { GraphData, GraphNode } from './graphModels';

export interface BuildLocalGraphInput {
  noteId: string;
  noteTitle: string;
  service: KnowledgeIndexService;
}

/** Build one-hop local graph from precomputed knowledge index data — O(neighbors) */
export function buildLocalGraphData(input: BuildLocalGraphInput): GraphData {
  const { noteId, noteTitle, service } = input;
  const neighborhood = buildNoteNeighborhood(service, noteId, noteTitle);
  const hopOneIds = new Set(
    neighborhood.nodes.filter(node => node.noteId !== noteId).map(node => node.noteId),
  );

  const nodes: GraphNode[] = neighborhood.nodes.map(node => ({
    ...node,
    type: node.noteId === noteId ? 'current' : 'connected',
    hop: node.noteId === noteId ? 0 : 1,
    expandable: hopOneIds.has(node.noteId),
  }));

  nodes.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'current' ? -1 : 1;
    return a.title.localeCompare(b.title);
  });

  return {
    scope: 'local',
    centerNoteId: noteId,
    nodes,
    edges: neighborhood.edges,
  };
}
