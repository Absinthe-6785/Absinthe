import type { KnowledgeIndexService } from '../KnowledgeIndexService';
import { buildNoteNeighborhood, mergeNeighborhoods } from './buildNoteNeighborhood';
import type { GraphData, GraphEdge, GraphNode } from './graphModels';

export const DEFAULT_MAX_VISIBLE_GRAPH_NODES = 100;

export interface BuildExpandedGraphInput {
  centerId: string;
  centerTitle: string;
  expandedNodeIds: readonly string[];
  service: KnowledgeIndexService;
  maxVisibleNodes?: number;
}

export interface ExpandedGraphMeta {
  maxVisibleNodes: number;
  limitReached: boolean;
  hiddenNodeCount: number;
}

function trimGraphToLimit(
  centerId: string,
  hopById: Map<string, number>,
  nodes: GraphNode[],
  edges: GraphEdge[],
  maxVisibleNodes: number,
): { nodes: GraphNode[]; edges: GraphEdge[]; limitReached: boolean; hiddenNodeCount: number } {
  if (nodes.length <= maxVisibleNodes) {
    return { nodes, edges, limitReached: false, hiddenNodeCount: 0 };
  }

  const sorted = [...nodes].sort((a, b) => {
    const hopA = hopById.get(a.noteId) ?? 99;
    const hopB = hopById.get(b.noteId) ?? 99;
    if (hopA !== hopB) return hopA - hopB;
    if (a.noteId === centerId) return -1;
    if (b.noteId === centerId) return 1;
    return a.title.localeCompare(b.title);
  });

  const kept = sorted.slice(0, maxVisibleNodes);
  const keptIds = new Set(kept.map(node => node.noteId));
  const keptEdges = edges.filter(
    edge => keptIds.has(edge.sourceId) && keptIds.has(edge.targetId),
  );

  return {
    nodes: kept,
    edges: keptEdges,
    limitReached: true,
    hiddenNodeCount: nodes.length - kept.length,
  };
}

/** Progressive graph: center neighborhood plus one-hop expansions from selected nodes */
export function buildExpandedGraphData(input: BuildExpandedGraphInput): GraphData {
  const {
    centerId,
    centerTitle,
    expandedNodeIds,
    service,
    maxVisibleNodes = DEFAULT_MAX_VISIBLE_GRAPH_NODES,
  } = input;

  const centerNeighborhood = buildNoteNeighborhood(service, centerId, centerTitle);
  const hopById = new Map<string, number>([[centerId, 0]]);
  const hopOneIds = new Set<string>();

  for (const node of centerNeighborhood.nodes) {
    if (node.noteId === centerId) continue;
    hopById.set(node.noteId, 1);
    hopOneIds.add(node.noteId);
  }

  const parts = [centerNeighborhood];
  const expandedSet = new Set(
    expandedNodeIds.filter(id => id !== centerId && hopOneIds.has(id)),
  );

  for (const expandedId of expandedSet) {
    const title = service.getNoteTitle(expandedId);
    const expandedNeighborhood = buildNoteNeighborhood(service, expandedId, title);
    for (const node of expandedNeighborhood.nodes) {
      if (node.noteId === centerId) continue;
      if (!hopById.has(node.noteId)) {
        hopById.set(node.noteId, 2);
      }
    }
    parts.push(expandedNeighborhood);
  }

  const merged = mergeNeighborhoods(parts);
  let nodes: GraphNode[] = merged.nodes.map(node => ({
    ...node,
    type: node.noteId === centerId ? 'current' : 'connected',
    hop: hopById.get(node.noteId),
    expanded: expandedSet.has(node.noteId),
    expandable: hopOneIds.has(node.noteId),
  }));

  nodes.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'current' ? -1 : 1;
    const hopA = a.hop ?? 99;
    const hopB = b.hop ?? 99;
    if (hopA !== hopB) return hopA - hopB;
    return a.title.localeCompare(b.title);
  });

  const trim = trimGraphToLimit(centerId, hopById, nodes, merged.edges, maxVisibleNodes);
  nodes = trim.nodes;

  const scope = expandedSet.size > 0 ? 'expanded' as const : 'local' as const;
  const meta: ExpandedGraphMeta = {
    maxVisibleNodes,
    limitReached: trim.limitReached,
    hiddenNodeCount: trim.hiddenNodeCount,
  };

  return {
    scope,
    centerNoteId: centerId,
    nodes,
    edges: trim.edges,
    meta,
  };
}

/** Add a hop-1 node to the expanded set — deterministic, deduped */
export function expandNode(
  expandedNodeIds: readonly string[],
  noteId: string,
  expandableNodeIds: ReadonlySet<string> | readonly string[],
): string[] {
  const expandable = expandableNodeIds instanceof Set
    ? expandableNodeIds
    : new Set(expandableNodeIds);
  if (!expandable.has(noteId)) return [...expandedNodeIds];
  if (expandedNodeIds.includes(noteId)) return [...expandedNodeIds];
  return [...expandedNodeIds, noteId];
}

/** Remove a node from the expanded set */
export function collapseNode(
  expandedNodeIds: readonly string[],
  noteId: string,
): string[] {
  return expandedNodeIds.filter(id => id !== noteId);
}
