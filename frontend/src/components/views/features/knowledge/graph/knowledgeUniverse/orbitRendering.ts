import type { GraphNodeTier } from './graphNodeTier';

export interface OrbitPathNode {
  id: string;
  tier: GraphNodeTier;
  orbitParentId: string | null;
  orbitRadius: number;
}

export interface OrbitPath {
  id: string;
  cx: number;
  cy: number;
  radius: number;
  tier: 'planet' | 'moon';
}

const ORBIT_RENDER_SCALE = 0.35;

/** Visible orbit tracks for planets and moons (universe mode). */
export function buildOrbitPaths(
  nodes: readonly OrbitPathNode[],
  positions: ReadonlyMap<string, { x: number; y: number }>,
): OrbitPath[] {
  const paths: OrbitPath[] = [];
  for (const node of nodes) {
    if (!node.orbitParentId || node.orbitRadius <= 0) continue;
    if (node.tier !== 'planet' && node.tier !== 'moon') continue;
    const parent = positions.get(node.orbitParentId);
    if (!parent) continue;
    paths.push({
      id: `${node.orbitParentId}->${node.id}`,
      cx: parent.x,
      cy: parent.y,
      radius: node.orbitRadius * ORBIT_RENDER_SCALE,
      tier: node.tier,
    });
  }
  return paths;
}
