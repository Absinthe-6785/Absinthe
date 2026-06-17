/**
 * K-92B2A — Stable graph topology signature for Cosmos sim restart gating.
 */
import type { GraphData } from './features/knowledge/graph/graphModels';

export interface GraphTopologySignatureInput {
  nodeIds: readonly string[];
  edges: readonly {
    sourceId: string;
    targetId: string;
    relationshipType: string;
  }[];
}

/** Canonical signature from sorted node ids and edge triples. */
export function buildGraphTopologySignature(input: GraphTopologySignatureInput): string {
  const nodes = [...input.nodeIds].sort().join('\n');
  const edgeKeys = input.edges
    .map(e => `${e.sourceId}|${e.targetId}|${e.relationshipType}`)
    .sort()
    .join('\n');
  return `n:${nodes}\ne:${edgeKeys}`;
}

export function buildGraphTopologySignatureFromGraphData(graphData: GraphData): string {
  return buildGraphTopologySignature({
    nodeIds: graphData.nodes.map(node => node.noteId),
    edges: graphData.edges.map(edge => ({
      sourceId: edge.sourceId,
      targetId: edge.targetId,
      relationshipType: edge.relationshipType,
    })),
  });
}
