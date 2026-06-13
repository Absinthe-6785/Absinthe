import type { GraphNodeTier } from './graphNodeTier';

export interface UniverseHudNode {
  tier: GraphNodeTier;
  galaxyId: string;
}

export interface UniverseHudSelection {
  title: string;
  backlinkCount: number;
  galaxyLabel: string;
  updatedAt: number | null;
}

export interface UniverseHudStats {
  nodeCount: number;
  linkCount: number;
  galaxyCount: number;
  starCount: number;
  planetCount: number;
  moonCount: number;
}

export function computeUniverseHudStats(
  nodes: readonly UniverseHudNode[],
  linkCount: number,
): UniverseHudStats {
  const galaxies = new Set(nodes.map(n => n.galaxyId));
  return {
    nodeCount: nodes.length,
    linkCount,
    galaxyCount: galaxies.size,
    starCount: nodes.filter(n => n.tier === 'star').length,
    planetCount: nodes.filter(n => n.tier === 'planet').length,
    moonCount: nodes.filter(n => n.tier === 'moon').length,
  };
}

export function formatUniverseUpdatedAt(updatedAt: number | null, locale = 'en'): string {
  if (updatedAt == null || updatedAt <= 0) return '—';
  return new Date(updatedAt).toLocaleDateString(locale, { month: 'short', day: 'numeric' });
}
