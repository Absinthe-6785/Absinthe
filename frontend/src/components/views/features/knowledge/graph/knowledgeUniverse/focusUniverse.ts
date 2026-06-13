export interface FocusGraphEdge {
  from: string;
  to: string;
}

export const DEFAULT_FOCUS_DEPTH = 2;

function buildAdjacency(edges: readonly FocusGraphEdge[]): Map<string, Set<string>> {
  const adjacency = new Map<string, Set<string>>();
  const connect = (a: string, b: string) => {
    const setA = adjacency.get(a) ?? new Set<string>();
    setA.add(b);
    adjacency.set(a, setA);
    const setB = adjacency.get(b) ?? new Set<string>();
    setB.add(a);
    adjacency.set(b, setB);
  };
  for (const edge of edges) {
    connect(edge.from, edge.to);
  }
  return adjacency;
}

/** BFS neighborhood around a selected note — parents, children, backlinks, neighbors. */
export function buildFocusUniverse(
  focusId: string,
  edges: readonly FocusGraphEdge[],
  depth = DEFAULT_FOCUS_DEPTH,
): Set<string> {
  return new Set(buildFocusUniverseDepthMap(focusId, edges, depth).keys());
}

/** Depth map: 0 = selected, 1 = direct, 2 = secondary (K-33.1). */
export function buildFocusUniverseDepthMap(
  focusId: string,
  edges: readonly FocusGraphEdge[],
  maxDepth = DEFAULT_FOCUS_DEPTH,
): Map<string, number> {
  const depths = new Map<string, number>([[focusId, 0]]);
  if (maxDepth <= 0) return depths;

  const adjacency = buildAdjacency(edges);
  let frontier = [focusId];

  for (let hop = 1; hop <= maxDepth; hop += 1) {
    const next: string[] = [];
    for (const id of frontier) {
      for (const neighbor of adjacency.get(id) ?? []) {
        if (depths.has(neighbor)) continue;
        depths.set(neighbor, hop);
        next.push(neighbor);
      }
    }
    frontier = next;
  }

  return depths;
}

export function isInFocusUniverse(
  nodeId: string,
  focusSet: Set<string> | null,
): boolean {
  if (!focusSet) return true;
  return focusSet.has(nodeId);
}

export function getFocusDepth(
  nodeId: string,
  depthMap: Map<string, number> | null,
): number | undefined {
  return depthMap?.get(nodeId);
}

/** Opacity by focus depth when a note is actively selected. */
export function focusUniverseNodeOpacityByDepth(
  depth: number | undefined,
  hasActiveSelection: boolean,
): number {
  if (!hasActiveSelection) return 1;
  if (depth === 0) return 1;
  if (depth === 1) return 0.94;
  if (depth === 2) return 0.72;
  return 0.06;
}

/** Stronger fade for unrelated nodes when a note is actively selected. */
export function focusUniverseNodeOpacity(
  inFocus: boolean,
  hasActiveSelection: boolean,
  baseDimOpacity = 0.3,
): number {
  if (inFocus) return 1;
  if (hasActiveSelection) return Math.min(baseDimOpacity, 0.06);
  return baseDimOpacity;
}

export function focusUniverseEdgeOpacity(
  depthA: number | undefined,
  depthB: number | undefined,
  hasActiveSelection: boolean,
): number {
  if (!hasActiveSelection) return 1;
  if (depthA == null || depthB == null) return 0.08;
  const maxDepth = Math.max(depthA, depthB);
  if (maxDepth === 0) return 1;
  if (maxDepth === 1) return 0.85;
  if (maxDepth === 2) return 0.55;
  return 0.08;
}
