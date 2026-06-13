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
  isHub: boolean;
  inFocusCluster: boolean;
  hasSearchFilter: boolean;
}

/** Label density policy for large graphs — hover/focus/hub only at scale. */
export function shouldShowGraphNodeLabel(input: GraphLabelVisibilityInput): boolean {
  if (input.isActive || input.isHovered || input.isSearchMatch) return true;

  const tier = graphScaleTier(input.nodeCount);

  if (input.hasSearchFilter) return false;

  if (tier === 'xlarge') {
    return input.isHub && input.inFocusCluster;
  }

  if (tier === 'large') {
    return input.inFocusCluster && (input.isHub || input.isHovered);
  }

  return input.inFocusCluster || input.isHub;
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
