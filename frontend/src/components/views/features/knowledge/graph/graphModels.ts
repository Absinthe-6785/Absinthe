/** View-model types for note graph visualization — not persisted in the index */

export type GraphScope = 'local' | 'global' | 'expanded';

export type GraphNodeType = 'current' | 'connected';

export type GlobalGraphRelationshipFilter = 'all' | 'backlinks' | 'mentions' | 'relations';

export type LocalGraphRelationshipFilter = GlobalGraphRelationshipFilter;

export type GraphRelationshipType =
  | 'backlink'
  | 'mutual-backlink'
  | 'mention'
  | 'shared-tag'
  | 'relation';

export interface GraphNode {
  noteId: string;
  title: string;
  type: GraphNodeType;
  /** Edge count after filters are applied */
  degree?: number;
  /** Hop distance from the center note in progressive graphs */
  hop?: number;
  /** Whether this hop-1 node is currently expanded */
  expanded?: boolean;
  /** Whether this node can be expanded (hop-1 neighbor of center) */
  expandable?: boolean;
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
  meta?: {
    maxVisibleNodes?: number;
    limitReached?: boolean;
    hiddenNodeCount?: number;
  };
}
