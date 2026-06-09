import { normalizeWikiTitle } from '../../../noteUtils';
import type { KnowledgeIndexService } from '../KnowledgeIndexService';
import { RELATED_SCORE } from '../related/relatedNotesScoring';
import { addEdge, incrementDegree } from './graphEdgeUtils';
import type { GraphEdge, GraphNode } from './graphModels';

export interface NoteNeighborhood {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

/** Build one-hop neighborhood for a single note — O(neighbors) indexed lookups */
export function buildNoteNeighborhood(
  service: KnowledgeIndexService,
  noteId: string,
  noteTitle: string,
): NoteNeighborhood {
  const edgeMap = new Map<string, GraphEdge>();
  const nodeTitles = new Map<string, string>();
  const degrees = new Map<string, number>();

  nodeTitles.set(noteId, noteTitle);

  const incoming = service.getIncoming(noteTitle, { excludeNoteId: noteId });
  const mentioning = service.getMentioningNotes(noteId, { excludeNoteId: noteId });
  const mentioned = service.getMentionedNotes(noteId);
  const outgoingTitles = service.getOutgoing(noteId);
  const outgoingKeys = new Set(outgoingTitles.map(normalizeWikiTitle));
  const related = service.getRelatedNotes(noteId);

  const relatedByTitleKey = new Map<string, (typeof related)[number]>();
  for (const item of related) {
    const key = normalizeWikiTitle(item.noteTitle);
    if (key) relatedByTitleKey.set(key, item);
    nodeTitles.set(item.noteId, item.noteTitle);
  }

  for (const ref of incoming) nodeTitles.set(ref.noteId, ref.noteTitle);
  for (const ref of mentioning) nodeTitles.set(ref.noteId, ref.noteTitle);
  for (const ref of mentioned) nodeTitles.set(ref.noteId, ref.noteTitle);

  const incomingIds = new Set(incoming.map(ref => ref.noteId));

  const trackEdge = (
    sourceId: string,
    targetId: string,
    relationshipType: GraphEdge['relationshipType'],
    weight: number,
  ) => {
    addEdge(edgeMap, sourceId, targetId, relationshipType, weight);
    incrementDegree(degrees, sourceId, targetId);
  };

  for (const ref of incoming) {
    const mutual = outgoingKeys.has(normalizeWikiTitle(ref.noteTitle));
    if (mutual) {
      trackEdge(noteId, ref.noteId, 'mutual-backlink', RELATED_SCORE.MUTUAL_BACKLINK);
    } else {
      trackEdge(ref.noteId, noteId, 'backlink', RELATED_SCORE.BACKLINK);
    }
  }

  for (const title of outgoingTitles) {
    const key = normalizeWikiTitle(title);
    const match = key ? relatedByTitleKey.get(key) : undefined;
    if (!match || incomingIds.has(match.noteId)) continue;
    trackEdge(noteId, match.noteId, 'backlink', RELATED_SCORE.BACKLINK);
  }

  for (const ref of mentioning) {
    trackEdge(ref.noteId, noteId, 'mention', RELATED_SCORE.MENTION);
  }

  for (const ref of mentioned) {
    trackEdge(noteId, ref.noteId, 'mention', RELATED_SCORE.MENTION);
  }

  for (const item of related) {
    if (item.reasons.includes('shared tag')) {
      trackEdge(noteId, item.noteId, 'shared-tag', RELATED_SCORE.SHARED_TAG);
    }
  }

  const nodes: GraphNode[] = [...nodeTitles.entries()].map(([id, title]) => ({
    noteId: id,
    title,
    type: 'connected' as const,
    degree: degrees.get(id) ?? 0,
  }));

  return {
    nodes,
    edges: [...edgeMap.values()],
  };
}

export function mergeNeighborhoods(
  parts: readonly NoteNeighborhood[],
): NoteNeighborhood {
  const nodeMap = new Map<string, GraphNode>();
  const edgeMap = new Map<string, GraphEdge>();

  for (const part of parts) {
    for (const node of part.nodes) {
      const existing = nodeMap.get(node.noteId);
      if (!existing) {
        nodeMap.set(node.noteId, { ...node });
        continue;
      }
      nodeMap.set(node.noteId, {
        ...existing,
        degree: Math.max(existing.degree ?? 0, node.degree ?? 0),
      });
    }

    for (const edge of part.edges) {
      addEdge(edgeMap, edge.sourceId, edge.targetId, edge.relationshipType, edge.weight);
    }
  }

  return {
    nodes: [...nodeMap.values()],
    edges: [...edgeMap.values()],
  };
}
