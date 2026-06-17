/**
 * K-92B3C1 — Topology-stable Cosmos renderMap memoization.
 *
 * Rebuild node id → node Map only when graph topology changes.
 * Node x/y mutate in-place during simulation; Map values stay valid.
 */

/** Memo deps used in NoteGraphView (topology-only; showIsolated does not change node set). */
export const COSMOS_RENDERMAP_MEMO_DEPS = ['graphTopologySignature'] as const;

export function buildCosmosRenderMapFromNodes<T extends { id: string }>(
  nodes: readonly T[],
): Map<string, T> {
  const map = new Map<string, T>();
  for (const node of nodes) {
    map.set(node.id, node);
  }
  return map;
}

/** Pre-K-92B3C1: one Map rebuild per React commit during settle. */
export function countLegacyRenderMapBuildsDuringSettle(reactCommits: number): number {
  return reactCommits;
}

/** Post-K-92B3C1: one Map rebuild per topology generation (cold/warm open). */
export function countMemoizedRenderMapBuildsDuringSettle(): number {
  return 1;
}

export function countLegacyRenderMapAllocationsDuringSettle(
  reactCommits: number,
  nodeCount: number,
): number {
  return reactCommits * nodeCount * 2;
}

export function countMemoizedRenderMapAllocationsDuringSettle(nodeCount: number): number {
  return nodeCount * 2;
}
