import { normalizeWikiTitle } from '../../../noteUtils';
import type { KnowledgeIndexService } from '../KnowledgeIndexService';
import { RELATED_SCORE } from '../related/relatedNotesScoring';
import { addEdge, incrementDegree } from './graphEdgeUtils';
import type { GraphData, GraphEdge, GraphNode } from './graphModels';

export interface BuildLocalGraphInput {
  noteId: string;
  noteTitle: string;
  service: KnowledgeIndexService;
}

/** Build one-hop local graph from precomputed knowledge index data — O(neighbors) */
export function buildLocalGraphData(input: BuildLocalGraphInput): GraphData {
  const { noteId, noteTitle, service } = input;
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

  for (const ref of incoming) {
    nodeTitles.set(ref.noteId, ref.noteTitle);
  }

  for (const ref of mentioning) {
    nodeTitles.set(ref.noteId, ref.noteTitle);
  }

  for (const ref of mentioned) {
    nodeTitles.set(ref.noteId, ref.noteTitle);
  }

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
    type: id === noteId ? 'current' : 'connected',
    degree: degrees.get(id) ?? 0,
  }));

  nodes.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'current' ? -1 : 1;
    return a.title.localeCompare(b.title);
  });

  return {
    scope: 'local',
    centerNoteId: noteId,
    nodes,
    edges: [...edgeMap.values()],
  };
}
