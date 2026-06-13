export interface FocusGraphEdge {
  from: string;
  to: string;
}

export const DEFAULT_FOCUS_DEPTH = 2;

/** BFS neighborhood around a selected note — parents, children, backlinks, neighbors. */
export function buildFocusUniverse(
  focusId: string,
  edges: readonly FocusGraphEdge[],
  depth = DEFAULT_FOCUS_DEPTH,
): Set<string> {
  if (depth <= 0) return new Set([focusId]);

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

  const visited = new Set<string>([focusId]);
  let frontier = [focusId];

  for (let hop = 0; hop < depth; hop += 1) {
    const next: string[] = [];
    for (const id of frontier) {
      for (const neighbor of adjacency.get(id) ?? []) {
        if (visited.has(neighbor)) continue;
        visited.add(neighbor);
        next.push(neighbor);
      }
    }
    frontier = next;
  }

  return visited;
}

export function isInFocusUniverse(
  nodeId: string,
  focusSet: Set<string> | null,
): boolean {
  if (!focusSet) return true;
  return focusSet.has(nodeId);
}

/** Stronger fade for unrelated nodes when a note is actively selected. */
export function focusUniverseNodeOpacity(
  inFocus: boolean,
  hasActiveSelection: boolean,
  baseDimOpacity = 0.3,
): number {
  if (inFocus) return 1;
  if (hasActiveSelection) return Math.min(baseDimOpacity, 0.12);
  return baseDimOpacity;
}
