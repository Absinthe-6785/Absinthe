/** View-model types for local note graph visualization — not persisted in the index */

export type GraphNodeType = 'current' | 'connected';

export type GraphRelationshipType =
  | 'backlink'
  | 'mutual-backlink'
  | 'mention'
  | 'shared-tag';

export interface GraphNode {
  noteId: string;
  title: string;
  type: GraphNodeType;
}

export interface GraphEdge {
  sourceId: string;
  targetId: string;
  relationshipType: GraphRelationshipType;
  weight: number;
}

export interface GraphData {
  centerNoteId: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
}
