import type { GraphNodeTier } from './features/knowledge/graph/knowledgeUniverse/graphNodeTier';

export type GraphScaleTier = 'normal' | 'large' | 'xlarge';

export function graphScaleTier(nodeCount: number): GraphScaleTier {
  if (nodeCount >= 250) return 'xlarge';
  if (nodeCount >= 100) return 'large';
  return 'normal';
}

export interface GraphLabelVisibilityInput {
  nodeCount: number;
  isActive: boolean;
  isHovered: boolean;
  isSearchMatch: boolean;
  /** @deprecated use nodeTier — kept for backward-compatible tests */
  isHub: boolean;
  nodeTier?: GraphNodeTier;
  inFocusCluster: boolean;
  hasSearchFilter: boolean;
}

/** Label density policy for large graphs — K-33 tier rules + scale policy. */
export function shouldShowGraphNodeLabel(input: GraphLabelVisibilityInput): boolean {
  const nodeTier = input.nodeTier ?? (input.isHub ? 'star' : undefined);

  if (nodeTier === 'star') return true;
  if (input.isActive || input.isHovered || input.isSearchMatch) return true;
  if (nodeTier === 'moon') return false;

  const tier = graphScaleTier(input.nodeCount);

  if (input.hasSearchFilter) return false;

  if (tier === 'xlarge') {
    return (nodeTier === 'planet' || input.isHub) && input.inFocusCluster;
  }

  if (tier === 'large') {
    return input.inFocusCluster && (nodeTier === 'planet' || input.isHub || input.isHovered);
  }

  return input.inFocusCluster || nodeTier === 'planet' || input.isHub;
}

export function graphRepulsionStrength(nodeCount: number): number {
  const tier = graphScaleTier(nodeCount);
  if (tier === 'xlarge') return 1800;
  if (tier === 'large') return 2600;
  return 3200;
}

export function graphSimulationAlphaFloor(nodeCount: number): number {
  return graphScaleTier(nodeCount) === 'xlarge' ? 0.02 : 0.005;
}
