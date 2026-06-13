import type { GraphNodeTier } from './graphNodeTier';

export interface OrbitAssignment {
  parentId: string | null;
  orbitRadius: number;
  orbitAngle: number;
  orbitSpeed: number;
}

export interface OrbitGraphEdge {
  from: string;
  to: string;
}

export interface OrbitGraphNode {
  id: string;
  tier: GraphNodeTier;
  importance: number;
  galaxyId: string;
}

const PLANET_ORBIT_RADIUS = 28;
const MOON_ORBIT_RADIUS = 14;
const PLANET_ORBIT_SPEED = 0.00006;
const MOON_ORBIT_SPEED = 0.0001;

function pickGalaxyAnchor(
  nodes: OrbitGraphNode[],
  anchorNoteId: string | null,
): string | null {
  if (anchorNoteId && nodes.some(n => n.id === anchorNoteId)) {
    return anchorNoteId;
  }
  const stars = nodes.filter(n => n.tier === 'star');
  if (stars.length === 0) return null;
  stars.sort((a, b) => b.importance - a.importance);
  return stars[0]?.id ?? null;
}

function neighborsInGalaxy(
  nodeId: string,
  galaxyId: string,
  edges: readonly OrbitGraphEdge[],
  tierById: Map<string, GraphNodeTier>,
): string[] {
  const ids = new Set<string>();
  for (const edge of edges) {
    if (edge.from === nodeId && tierById.get(edge.to)) ids.add(edge.to);
    if (edge.to === nodeId && tierById.get(edge.from)) ids.add(edge.from);
  }
  return [...ids].filter(id => tierById.has(id));
}

/** Assign orbital parents: planets around galaxy star, moons around connected planets. */
export function assignOrbitHierarchy(
  nodes: readonly OrbitGraphNode[],
  edges: readonly OrbitGraphEdge[],
  anchorNoteId: string | null,
): Map<string, OrbitAssignment> {
  const byGalaxy = new Map<string, OrbitGraphNode[]>();
  for (const node of nodes) {
    const bucket = byGalaxy.get(node.galaxyId) ?? [];
    bucket.push(node);
    byGalaxy.set(node.galaxyId, bucket);
  }

  const assignments = new Map<string, OrbitAssignment>();

  for (const [, galaxyNodes] of byGalaxy) {
    const tierById = new Map(galaxyNodes.map(n => [n.id, n.tier]));
    const anchorId = pickGalaxyAnchor(galaxyNodes, anchorNoteId);

    for (const node of galaxyNodes) {
      if (node.tier === 'star' || node.id === anchorId) {
        assignments.set(node.id, {
          parentId: null,
          orbitRadius: 0,
          orbitAngle: hashAngle(node.id),
          orbitSpeed: 0,
        });
        continue;
      }

      if (node.tier === 'planet') {
        assignments.set(node.id, {
          parentId: anchorId,
          orbitRadius: PLANET_ORBIT_RADIUS,
          orbitAngle: hashAngle(node.id),
          orbitSpeed: PLANET_ORBIT_SPEED,
        });
        continue;
      }

      const neighborIds = neighborsInGalaxy(node.id, node.galaxyId, edges, tierById);
      const planetParent = neighborIds.find(id => tierById.get(id) === 'planet')
        ?? neighborIds.find(id => tierById.get(id) === 'star')
        ?? anchorId;

      assignments.set(node.id, {
        parentId: planetParent ?? null,
        orbitRadius: MOON_ORBIT_RADIUS,
        orbitAngle: hashAngle(node.id),
        orbitSpeed: MOON_ORBIT_SPEED,
      });
    }
  }

  return assignments;
}

function hashAngle(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash * 31 + id.charCodeAt(i)) % 628;
  }
  return hash / 100;
}

export interface DisplayPositionInput {
  x: number;
  y: number;
  parentX: number | null;
  parentY: number | null;
  orbitRadius: number;
  orbitAngle: number;
  orbitSpeed: number;
  timeMs: number;
  reducedMotion: boolean;
  enabled: boolean;
}

/** Subtle orbital offset layered on force-simulation positions. */
export function computeDisplayPosition(input: DisplayPositionInput): { x: number; y: number } {
  if (!input.enabled || input.reducedMotion || input.orbitRadius <= 0) {
    return { x: input.x, y: input.y };
  }
  if (input.parentX == null || input.parentY == null) {
    return { x: input.x, y: input.y };
  }

  const angle = input.orbitAngle + input.timeMs * input.orbitSpeed;
  const offsetX = Math.cos(angle) * input.orbitRadius;
  const offsetY = Math.sin(angle) * input.orbitRadius;

  return {
    x: input.x + offsetX * 0.35,
    y: input.y + offsetY * 0.35,
  };
}
