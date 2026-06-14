import type { GraphNodeTier } from './features/knowledge/graph/knowledgeUniverse/graphNodeTier';

export type GraphScaleTier = 'normal' | 'large' | 'xlarge' | 'massive' | 'galaxy';

export function graphScaleTier(nodeCount: number): GraphScaleTier {
  if (nodeCount >= 1000) return 'galaxy';
  if (nodeCount >= 500) return 'massive';
  if (nodeCount >= 250) return 'xlarge';
  if (nodeCount >= 100) return 'large';
  return 'normal';
}

export interface GraphLabelVisibilityInput {
  nodeCount: number;
  zoomK?: number;
  isActive: boolean;
  isHovered: boolean;
  isSearchMatch: boolean;
  /** @deprecated use nodeTier — kept for backward-compatible tests */
  isHub: boolean;
  nodeTier?: GraphNodeTier;
  inFocusCluster: boolean;
  focusDepth?: number;
  hasSearchFilter: boolean;
}

/** Label density policy — K-33.1 scale-aware + viewport zoom. */
export function shouldShowGraphNodeLabel(input: GraphLabelVisibilityInput): boolean {
  const nodeTier = input.nodeTier ?? (input.isHub ? 'star' : undefined);
  const zoomK = input.zoomK ?? 1;

  if (nodeTier === 'star') return true;
  if (input.isActive || input.isHovered || input.isSearchMatch) return true;

  if (nodeTier === 'moon') {
    return input.isActive || input.isHovered || input.isSearchMatch;
  }

  if (nodeTier === 'planet') {
    if (input.inFocusCluster && (input.focusDepth ?? 99) <= 2) return true;
    if (input.isActive || input.isHovered || input.isSearchMatch) return true;
  }

  const tier = graphScaleTier(input.nodeCount);

  if (input.hasSearchFilter) return false;

  if (tier === 'galaxy') {
    return zoomK >= 1.2 && input.isHub;
  }

  if (tier === 'massive' || tier === 'xlarge') {
    return (nodeTier === 'planet' || input.isHub) && input.inFocusCluster && zoomK >= 0.85;
  }

  if (tier === 'large') {
    return input.inFocusCluster && (nodeTier === 'planet' || input.isHub || input.isHovered);
  }

  return input.inFocusCluster || nodeTier === 'planet' || input.isHub;
}

export function shouldRenderGalaxyNebula(
  nodeCount: number,
  zoomK: number,
  universeMode: boolean,
): boolean {
  if (!universeMode) return false;
  const tier = graphScaleTier(nodeCount);
  if (tier === 'galaxy') return zoomK >= 0.55;
  if (tier === 'massive') return zoomK >= 0.45;
  return true;
}

export function shouldRenderGalaxyLabels(
  nodeCount: number,
  zoomK: number,
  universeMode: boolean,
): boolean {
  if (!universeMode) return false;
  const tier = graphScaleTier(nodeCount);
  if (tier === 'galaxy') return zoomK >= 0.9;
  if (tier === 'massive') return zoomK >= 0.7;
  return zoomK >= 0.5;
}

export function graphRepulsionStrength(nodeCount: number): number {
  const tier = graphScaleTier(nodeCount);
  if (tier === 'galaxy') return 1400;
  if (tier === 'massive') return 1600;
  if (tier === 'xlarge') return 1800;
  if (tier === 'large') return 2600;
  return 3200;
}

export function graphSimulationAlphaFloor(nodeCount: number): number {
  const tier = graphScaleTier(nodeCount);
  if (tier === 'galaxy' || tier === 'massive' || tier === 'xlarge') return 0.02;
  return 0.005;
}
