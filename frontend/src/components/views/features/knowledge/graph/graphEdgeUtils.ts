import type { GraphEdge, GraphRelationshipType } from './graphModels';

export function edgeKey(
  sourceId: string,
  targetId: string,
  relationshipType: GraphRelationshipType,
): string {
  return `${sourceId}\0${targetId}\0${relationshipType}`;
}

export function addEdge(
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

export function incrementDegree(degrees: Map<string, number>, sourceId: string, targetId: string): void {
  degrees.set(sourceId, (degrees.get(sourceId) ?? 0) + 1);
  degrees.set(targetId, (degrees.get(targetId) ?? 0) + 1);
}
