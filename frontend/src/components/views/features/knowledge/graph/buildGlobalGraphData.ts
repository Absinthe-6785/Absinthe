import type { KnowledgeIndexService } from '../KnowledgeIndexService';
import { logMemAudit } from '../../../../../lib/memAudit';
import { RELATED_SCORE } from '../related/relatedNotesScoring';
import { addEdge, incrementDegree } from './graphEdgeUtils';
import type {
  GlobalGraphRelationshipFilter,
  GraphData,
  GraphEdge,
  GraphNode,
} from './graphModels';

export interface BuildGlobalGraphOptions {
  relationshipFilter?: GlobalGraphRelationshipFilter;
  hideIsolated?: boolean;
}

export interface BuildGlobalGraphInput {
  service: KnowledgeIndexService;
  options?: BuildGlobalGraphOptions;
}

function includeBacklinks(filter: GlobalGraphRelationshipFilter): boolean {
  return filter === 'all' || filter === 'backlinks';
}

function includeMentions(filter: GlobalGraphRelationshipFilter): boolean {
  return filter === 'all' || filter === 'mentions';
}

function includeRelations(filter: GlobalGraphRelationshipFilter): boolean {
  return filter === 'all' || filter === 'relations';
}

/** Build full-vault graph from precomputed knowledge index data — O(N + E) */
export function buildGlobalGraphData(input: BuildGlobalGraphInput): GraphData {
  const { service, options = {} } = input;
  const relationshipFilter = options.relationshipFilter ?? 'all';
  const hideIsolated = options.hideIsolated ?? false;

  const edgeMap = new Map<string, GraphEdge>();
  const degrees = new Map<string, number>();

  for (const noteId of service.getAllNoteIds()) {
    if (includeBacklinks(relationshipFilter)) {
      for (const title of service.getOutgoing(noteId)) {
        const targetId = service.resolveNoteId(title);
        if (!targetId || targetId === noteId) continue;
        addEdge(edgeMap, noteId, targetId, 'backlink', RELATED_SCORE.BACKLINK);
        incrementDegree(degrees, noteId, targetId);
      }
    }

    if (includeMentions(relationshipFilter)) {
      for (const ref of service.getMentionedNotes(noteId)) {
        if (ref.noteId === noteId) continue;
        addEdge(edgeMap, noteId, ref.noteId, 'mention', RELATED_SCORE.MENTION);
        incrementDegree(degrees, noteId, ref.noteId);
      }
    }

    if (includeRelations(relationshipFilter)) {
      for (const edge of service.getOutgoingRelations(noteId)) {
        if (edge.targetId === noteId) continue;
        addEdge(edgeMap, edge.sourceId, edge.targetId, 'relation', RELATED_SCORE.RELATION);
        incrementDegree(degrees, edge.sourceId, edge.targetId);
      }
    }
  }

  let nodes: GraphNode[] = service.getAllNoteIds().map(noteId => ({
    noteId,
    title: service.getNoteTitle(noteId),
    type: 'connected' as const,
    degree: degrees.get(noteId) ?? 0,
  }));

  if (hideIsolated) {
    nodes = nodes.filter(node => (node.degree ?? 0) > 0);
    const visibleIds = new Set(nodes.map(node => node.noteId));
    const edges = [...edgeMap.values()].filter(
      edge => visibleIds.has(edge.sourceId) && visibleIds.has(edge.targetId),
    );
    nodes.sort((a, b) => a.title.localeCompare(b.title));
    const result = { scope: 'global' as const, nodes, edges };
    logMemAudit({
      source: 'buildGlobalGraphData',
      notes: nodes.length,
      links: edges.length,
      graphNodes: nodes.length,
      graphEdges: edges.length,
    });
    return result;
  }

  nodes.sort((a, b) => a.title.localeCompare(b.title));
  const result = {
    scope: 'global' as const,
    nodes,
    edges: [...edgeMap.values()],
  };
  logMemAudit({
    source: 'buildGlobalGraphData',
    notes: nodes.length,
    links: result.edges.length,
    graphNodes: nodes.length,
    graphEdges: result.edges.length,
  });
  return result;
}
