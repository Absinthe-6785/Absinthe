import { normalizeWikiTitle } from '../../../noteUtils';
import type { KnowledgeIndexService } from '../KnowledgeIndexService';
import { RELATED_SCORE } from '../related/relatedNotesScoring';
import type { GraphData, GraphEdge, GraphNode, GraphRelationshipType } from './graphModels';

export interface BuildLocalGraphInput {
  noteId: string;
  noteTitle: string;
  service: KnowledgeIndexService;
}

function edgeKey(
  sourceId: string,
  targetId: string,
  relationshipType: GraphRelationshipType,
): string {
  return `${sourceId}\0${targetId}\0${relationshipType}`;
}

function addEdge(
  edges: Map<string, GraphEdge>,
  sourceId: string,
  targetId: string,
  relationshipType: GraphRelationshipType,
  weight: number,
): void {
  if (sourceId === targetId) return;
  const key = edgeKey(sourceId, targetId, relationshipType);
  if (!edges.has(key)) {
    edges.set(key, { sourceId, targetId, relationshipType, weight });
  }
}

/** Build one-hop local graph from precomputed knowledge index data — O(neighbors) */
export function buildLocalGraphData(input: BuildLocalGraphInput): GraphData {
  const { noteId, noteTitle, service } = input;
  const edgeMap = new Map<string, GraphEdge>();
  const nodeTitles = new Map<string, string>();

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

  for (const ref of incoming) {
    const mutual = outgoingKeys.has(normalizeWikiTitle(ref.noteTitle));
    if (mutual) {
      addEdge(
        edgeMap,
        noteId,
        ref.noteId,
        'mutual-backlink',
        RELATED_SCORE.MUTUAL_BACKLINK,
      );
    } else {
      addEdge(edgeMap, ref.noteId, noteId, 'backlink', RELATED_SCORE.BACKLINK);
    }
  }

  for (const title of outgoingTitles) {
    const key = normalizeWikiTitle(title);
    const match = key ? relatedByTitleKey.get(key) : undefined;
    if (!match || incomingIds.has(match.noteId)) continue;
    addEdge(edgeMap, noteId, match.noteId, 'backlink', RELATED_SCORE.BACKLINK);
  }

  for (const ref of mentioning) {
    addEdge(edgeMap, ref.noteId, noteId, 'mention', RELATED_SCORE.MENTION);
  }

  for (const ref of mentioned) {
    addEdge(edgeMap, noteId, ref.noteId, 'mention', RELATED_SCORE.MENTION);
  }

  for (const item of related) {
    if (item.reasons.includes('shared tag')) {
      addEdge(edgeMap, noteId, item.noteId, 'shared-tag', RELATED_SCORE.SHARED_TAG);
    }
  }

  const nodes: GraphNode[] = [...nodeTitles.entries()].map(([id, title]) => ({
    noteId: id,
    title,
    type: id === noteId ? 'current' : 'connected',
  }));

  nodes.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'current' ? -1 : 1;
    return a.title.localeCompare(b.title);
  });

  return {
    centerNoteId: noteId,
    nodes,
    edges: [...edgeMap.values()],
  };
}
