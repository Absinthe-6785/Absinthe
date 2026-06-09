/** View-model types for note graph visualization — not persisted in the index */

export type GraphScope = 'local' | 'global';

export type GraphNodeType = 'current' | 'connected';

export type GlobalGraphRelationshipFilter = 'all' | 'backlinks' | 'mentions';

export type GraphRelationshipType =
  | 'backlink'
  | 'mutual-backlink'
  | 'mention'
  | 'shared-tag';

export interface GraphNode {
  noteId: string;
  title: string;
  type: GraphNodeType;
  /** Edge count after filters are applied */
  degree?: number;
}

export interface GraphEdge {
  sourceId: string;
  targetId: string;
  relationshipType: GraphRelationshipType;
  weight: number;
}

export interface GraphData {
  scope: GraphScope;
  centerNoteId?: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
}
