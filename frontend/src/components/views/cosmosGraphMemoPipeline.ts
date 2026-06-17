/**
 * K-92B3B — Tick-decoupled Cosmos graph memo pipeline.
 *
 * Separates topology-stable graph snapshots from simulation position updates.
 */
import type { GraphRelationshipType } from './features/knowledge';
import type { GraphNodeTier } from './features/knowledge/graph/knowledgeUniverse';
import type { CosmosGalaxyVisual, CosmosOrbitPath } from './cosmosGraphLayers';

export interface CosmosVisibleNodeRef {
  id: string;
  title: string;
  folderId: string | null;
  x: number;
  y: number;
  links: number;
  backlinkCount: number;
  importance: number;
  radius: number;
  tier: GraphNodeTier;
  galaxyId: string;
  galaxyLabel: string;
  isAreaNote: boolean;
  orbitParentId: string | null;
  orbitRadius: number;
  orbitAngle: number;
  orbitSpeed: number;
  starred?: boolean;
}

export interface CosmosVisibleEdgeRef {
  from: string;
  to: string;
  relationshipType: GraphRelationshipType;
  weight: number;
}

export interface CosmosVisibleGraphSnapshot {
  visibleNodes: CosmosVisibleNodeRef[];
  visibleEdges: CosmosVisibleEdgeRef[];
}

/** P1 — Filter visible nodes/edges from refs; stable until topology or isolate toggle changes. */
export function buildVisibleGraphSnapshot(
  nodes: readonly CosmosVisibleNodeRef[],
  edges: readonly CosmosVisibleEdgeRef[],
  showIsolated: boolean,
): CosmosVisibleGraphSnapshot {
  const visibleNodes = showIsolated ? [...nodes] : nodes.filter(node => node.links > 0);
  const visibleNodeIds = new Set(visibleNodes.map(node => node.id));
  const visibleEdges = edges.filter(
    edge => visibleNodeIds.has(edge.from) && visibleNodeIds.has(edge.to),
  );
  return { visibleNodes, visibleEdges };
}

export interface GalaxyVisualTopology {
  galaxyId: string;
  label: string;
  displayTitle: string;
  nodeCount: number;
  starCount: number;
  anchorNodeId: string | null;
  memberIds: readonly string[];
  hue: number;
}

const GALAXY_PALETTE = [265, 210, 190, 160, 320, 240, 280, 200];

function galaxyHue(galaxyId: string): number {
  let hash = 0;
  for (let i = 0; i < galaxyId.length; i += 1) {
    hash = (hash * 31 + galaxyId.charCodeAt(i)) % GALAXY_PALETTE.length;
  }
  return GALAXY_PALETTE[hash] ?? 265;
}

function formatGalaxyTitle(label: string): string {
  const trimmed = label.trim();
  if (!trimmed) return 'Uncategorized Galaxy';
  if (/galaxy$/i.test(trimmed)) return trimmed;
  return `${trimmed} Galaxy`;
}

/** P2 — Galaxy grouping metadata without simulation positions. */
export function buildGalaxyVisualTopology(
  nodes: readonly Pick<
    CosmosVisibleNodeRef,
    'id' | 'galaxyId' | 'galaxyLabel' | 'tier' | 'isAreaNote'
  >[],
): GalaxyVisualTopology[] {
  const groups = new Map<string, Pick<
    CosmosVisibleNodeRef,
    'id' | 'galaxyId' | 'galaxyLabel' | 'tier' | 'isAreaNote'
  >[]>();
  const anchorByGalaxy = new Map<string, string | null>();

  for (const node of nodes) {
    const bucket = groups.get(node.galaxyId);
    if (bucket) {
      bucket.push(node);
    } else {
      groups.set(node.galaxyId, [node]);
    }
    if (node.isAreaNote) anchorByGalaxy.set(node.galaxyId, node.id);
  }

  const topology: GalaxyVisualTopology[] = [];
  for (const [galaxyId, members] of groups) {
    if (members.length === 0) continue;
    const label = members[0]?.galaxyLabel ?? 'Uncategorized';
    const anchorNodeId = anchorByGalaxy.get(galaxyId) ?? null;
    const anchor = anchorNodeId
      ? members.find(member => member.id === anchorNodeId)
      : members.find(member => member.tier === 'star');

    topology.push({
      galaxyId,
      label,
      displayTitle: formatGalaxyTitle(label),
      nodeCount: members.length,
      starCount: members.filter(member => member.tier === 'star').length,
      anchorNodeId: anchor?.id ?? anchorNodeId,
      memberIds: members.map(member => member.id),
      hue: galaxyHue(galaxyId),
    });
  }

  return topology.sort((a, b) => b.nodeCount - a.nodeCount);
}

type GalaxyPositionNode = Pick<CosmosVisibleNodeRef, 'id' | 'x' | 'y' | 'tier'>;

/** Apply live positions to topology-stable galaxy visuals (per render, not memoized on tick). */
export function resolveGalaxyVisualsFromTopology(
  topology: readonly GalaxyVisualTopology[],
  getNode: (id: string) => GalaxyPositionNode | undefined,
): CosmosGalaxyVisual[] {
  return topology.map(entry => {
    const members = entry.memberIds
      .map(id => getNode(id))
      .filter((node): node is GalaxyPositionNode => node != null);

    let centerX = 0;
    let centerY = 0;
    let maxDist = 48;

    if (members.length > 0) {
      for (const member of members) {
        centerX += member.x;
        centerY += member.y;
      }
      centerX /= members.length;
      centerY /= members.length;
      for (const member of members) {
        const dx = member.x - centerX;
        const dy = member.y - centerY;
        maxDist = Math.max(maxDist, Math.sqrt(dx * dx + dy * dy) + 36);
      }
    }

    const anchor = entry.anchorNodeId ? getNode(entry.anchorNodeId) : members.find(m => m.tier === 'star');
    if (anchor) {
      centerX = anchor.x;
      centerY = anchor.y;
    }

    return {
      galaxyId: entry.galaxyId,
      displayTitle: entry.displayTitle,
      nodeCount: entry.nodeCount,
      anchorNodeId: entry.anchorNodeId,
      hue: entry.hue,
      centerX,
      centerY,
      boundaryRadius: maxDist + 24,
      nebulaRadius: maxDist + 56,
    };
  });
}

export interface OrbitPathTopology {
  id: string;
  parentId: string;
  childId: string;
  orbitRadius: number;
  tier: 'planet' | 'moon';
}

const ORBIT_RENDER_SCALE = 0.35;

/** P3 — Orbit track definitions without parent simulation positions. */
export function buildOrbitPathTopology(
  nodes: readonly Pick<
    CosmosVisibleNodeRef,
    'id' | 'tier' | 'orbitParentId' | 'orbitRadius'
  >[],
): OrbitPathTopology[] {
  const paths: OrbitPathTopology[] = [];
  for (const node of nodes) {
    if (!node.orbitParentId || node.orbitRadius <= 0) continue;
    if (node.tier !== 'planet' && node.tier !== 'moon') continue;
    paths.push({
      id: `${node.orbitParentId}->${node.id}`,
      parentId: node.orbitParentId,
      childId: node.id,
      orbitRadius: node.orbitRadius,
      tier: node.tier,
    });
  }
  return paths;
}

/** Resolve orbit path geometry from topology + live simulation positions. */
export function resolveOrbitPathsFromTopology(
  topology: readonly OrbitPathTopology[],
  getNode: (id: string) => Pick<CosmosVisibleNodeRef, 'x' | 'y'> | undefined,
): CosmosOrbitPath[] {
  const paths: CosmosOrbitPath[] = [];
  for (const entry of topology) {
    const parent = getNode(entry.parentId);
    if (!parent) continue;
    paths.push({
      id: entry.id,
      cx: parent.x,
      cy: parent.y,
      radius: entry.orbitRadius * ORBIT_RENDER_SCALE,
      tier: entry.tier,
    });
  }
  return paths;
}

export interface CosmosMemoPipelinePolicySnapshot {
  visibleGraphMemoized: boolean;
  galaxyTopologyDecoupled: boolean;
  orbitTopologyDecoupled: boolean;
  focusDepthMapTickDecoupled: boolean;
  focusNeighborhoodTickDecoupled: boolean;
}

/** Count how many tick-coupled memo hooks remain in NoteGraphView source. */
export function countTickCoupledMemoHooks(noteGraphSource: string): number {
  const memoBlocks = noteGraphSource.match(/useMemo\([\s\S]*?\), \[[^\]]*tick[^\]]*\]\)/g) ?? [];
  return memoBlocks.length;
}
